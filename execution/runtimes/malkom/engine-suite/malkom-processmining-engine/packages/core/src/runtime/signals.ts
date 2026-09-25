import { z } from 'zod';
import { registryIdSchema } from '../domain/identifiers.js';
import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { buildLog, perCaseSql, EVENT_ORDER } from './logquery.js';
import { businessElapsed, type BusinessCalendar } from './calendar.js';
import type { CaseFilter } from './filter.js';
import { describeFilter } from './filter.js';
import { analyseVariants } from './variants.js';

/**
 * Action-oriented mining: turning a finding into something that fires.
 *
 * The distinction this module rests on is that **a threshold alert is not
 * process mining**. "Tell me when a case passes five days" needs no process
 * model at all, and a tool that only does that has automated a report, not
 * learned anything. What makes a signal *mined* is that the decision comes
 * from the discovered process: cases currently sitting on a path that
 * historically ends badly, activities repeating beyond what the model allows,
 * traces already departing from the reference.
 *
 * The engine emits; it never acts. There is no HTTP call, no queue write and
 * no rule invocation here — the host receives firings and decides what they
 * mean, because the consequences of acting belong to whoever owns the process.
 */

// ---------------------------------------------------------------------------
// What "open" means
// ---------------------------------------------------------------------------

/**
 * How to tell a case that is still running from one that simply ended.
 *
 * This has to be declared, and getting it wrong is the failure that makes a
 * signal engine worthless. A log is a SNAPSHOT: every case whose ending was
 * not recorded looks identical to a case still in flight. Treating all of them
 * as live fires thousands of alerts about work that finished months ago, and
 * the alerts get muted, and then the real ones are missed too.
 */
export const openCaseRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('missing-end-activity'),
    /** A case is closed once it performs any of these. */
    endActivities: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal('recent-activity'),
    /**
     * A case is open if its last event is within this many seconds of `now`.
     * Anything older is treated as finished-but-unrecorded rather than stuck,
     * which is the safer reading of a historical export.
     */
    withinSeconds: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('all'),
    /** Every case is treated as open. Only sensible on a live-updating store. */
  }),
]);
export type OpenCaseRule = z.infer<typeof openCaseRuleSchema>;

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export const signalTriggerSchema = z.discriminatedUnion('kind', [
  /**
   * Open longer than a threshold. The one trigger that needs no model — kept
   * because it is genuinely useful, and labelled `mined: false` so nobody
   * mistakes it for a discovery.
   */
  z.object({ kind: z.literal('running-longer-than'), seconds: z.number().positive() }),
  /** No progress for a while, optionally at a particular step. */
  z.object({
    kind: z.literal('stalled'),
    seconds: z.number().positive(),
    atActivity: z.string().min(1).optional(),
  }),
  /** An activity repeating more than it should — rework, in flight. */
  z.object({
    kind: z.literal('repeating'),
    activity: z.string().min(1),
    times: z.number().int().min(2),
  }),
  /**
   * The genuinely mined one: this case's path so far historically ends in a
   * bad outcome more often than the threshold.
   */
  z.object({
    kind: z.literal('path-risk'),
    /** The outcome to predict, e.g. an activity meaning rejection. */
    outcomeActivity: z.string().min(1),
    /** Fire when the historical rate for this prefix is at least this, 0-1. */
    minRate: z.number().min(0).max(1),
    /**
     * Minimum historical cases behind the rate.
     *
     * Without it, a prefix seen twice — both of which went badly — reads as a
     * 100% risk and fires on every case that touches it.
     */
    minSupport: z.number().int().min(1).default(20),
  }),
]);
export type SignalTrigger = z.infer<typeof signalTriggerSchema>;

export const signalDefinitionSchema = z.object({
  id: registryIdSchema,
  name: z.string().min(1).max(200).optional(),
  objectType: z.string().min(1),
  trigger: signalTriggerSchema,
  /** Restrict the signal to a subset of cases. */
  filter: z.unknown().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  /**
   * What the host should do. The engine only carries this through — it does
   * not interpret it, call it, or know what a 'rule' is.
   */
  action: z
    .object({ kind: z.string().min(1), ref: z.string().min(1) })
    .optional(),
});
export type SignalDefinition = Omit<z.infer<typeof signalDefinitionSchema>, 'filter'> & {
  filter?: CaseFilter | undefined;
};

// ---------------------------------------------------------------------------
// Firings
// ---------------------------------------------------------------------------

export interface SignalFiring {
  signalId: string;
  signalName: string;
  caseId: string;
  severity: 'info' | 'warning' | 'critical';
  /** One sentence a human can act on, with the numbers in it. */
  reason: string;
  /** Machine-readable evidence, for a rule to branch on. */
  evidence: Record<string, unknown>;
  /** The case's last known activity and when. */
  currentActivity: string | null;
  lastEventAt: Date | null;
  openForSeconds: number | null;
  action: { kind: string; ref: string } | null;
  /**
   * False for triggers that are plain thresholds.
   *
   * A threshold needs no process model, and calling it a mined insight would
   * misrepresent what the engine actually did.
   */
  mined: boolean;
}

export interface EvaluateSignalsOptions {
  objectType: string;
  schema?: string | undefined;
  lifecycle?: readonly string[] | undefined;
  /** How to tell a running case from a finished one. */
  openCases: OpenCaseRule;
  /** Evaluation time. Injected so a run over historical data is reproducible. */
  now: Date;
  /** Cap on firings returned per signal. Default 500. */
  limit?: number;
  /**
   * Measure durations in working time rather than wall-clock. See
   * `LogQueryOptions.calendar`. A staleness horizon follows it too: a case
   * untouched since Friday evening is not stale on Monday morning, because the
   * office was shut, not because the case stopped moving.
   */
  calendar?: BusinessCalendar | undefined;
}

export interface SignalReport {
  evaluatedAt: Date;
  objectType: string;
  /** Cases considered live under the declared rule. */
  openCases: number;
  totalCases: number;
  firings: SignalFiring[];
  /** Per signal, how many fired and whether it was capped. */
  bySignal: { signalId: string; firings: number; truncated: boolean; note?: string }[];
  /**
   * Stated on every report. A log is a snapshot, and a signal engine that does
   * not say which definition of "open" it used invites its numbers to be read
   * as live operational truth when they may be nothing of the kind.
   */
  openCaseRule: string;
}

const DEFAULT_LIMIT = 500;

/**
 * Everything a signal run looks at is bounded by the evaluation instant.
 *
 * Without this an evaluation "as of last Tuesday" would quietly consult events
 * from Thursday, and both the open-case detection and the historical rates
 * would be computed from information that did not exist at the time.
 */
function asOfNow(opts: EvaluateSignalsOptions): {
  objectType: string;
  schema?: string | undefined;
  lifecycle?: readonly string[] | undefined;
  calendar?: BusinessCalendar | undefined;
  window: { to: Date };
} {
  return {
    objectType: opts.objectType,
    ...(opts.schema !== undefined ? { schema: opts.schema } : {}),
    ...(opts.lifecycle !== undefined ? { lifecycle: opts.lifecycle } : {}),
    // Must travel: the age check reads the clock column this sets, and comparing
    // working seconds against epoch seconds would be off by fifty years.
    ...(opts.calendar !== undefined ? { calendar: opts.calendar } : {}),
    window: { to: opts.now },
  };
}

export async function evaluateSignals(
  client: SqlClient,
  dialect: SqlDialect,
  signals: readonly SignalDefinition[],
  opts: EvaluateSignalsOptions,
): Promise<SignalReport> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const firings: SignalFiring[] = [];
  const bySignal: SignalReport['bySignal'] = [];

  const live = await loadOpenCases(client, dialect, opts);

  for (const signal of signals) {
    const scoped =
      signal.filter === undefined
        ? live.cases
        : await restrictToFilter(client, dialect, opts, signal.filter, live.cases);

    const produced = await evaluateOne(client, dialect, signal, scoped, opts);
    const capped = produced.slice(0, limit);
    firings.push(...capped);
    bySignal.push({
      signalId: signal.id,
      firings: capped.length,
      truncated: produced.length > capped.length,
      ...(produced.length > capped.length
        ? { note: `${produced.length - capped.length} further firings suppressed by the limit` }
        : {}),
    });
  }

  return {
    evaluatedAt: opts.now,
    objectType: opts.objectType,
    openCases: live.cases.length,
    totalCases: live.totalCases,
    firings,
    bySignal,
    openCaseRule: describeOpenRule(opts.openCases),
  };
}

interface OpenCase {
  caseId: string;
  firstAt: Date;
  lastAt: Date;
  lastActivity: string | null;
  events: number;
  path: string[];
}

interface LiveSet {
  cases: OpenCase[];
  totalCases: number;
}

async function loadOpenCases(
  client: SqlClient,
  dialect: SqlDialect,
  opts: EvaluateSignalsOptions,
): Promise<LiveSet> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, asOfNow(opts));
  const perCase = perCaseSql(log, dialect);

  const totals = await client.query(`SELECT COUNT(*) AS n FROM (${perCase}) t`, params);
  const totalCases = countOf(totals.rows[0]?.['n']);

  // Build the open-case predicate. Everything is expressed against the
  // per-case summary so one query decides liveness.
  let predicate = 'TRUE';
  if (opts.openCases.kind === 'missing-end-activity') {
    const holes = opts.openCases.endActivities.map((a) => {
      params.push(a);
      return dialect.placeholder(params.length);
    });
    // Asked of the WINDOWED log, not the raw events table. The window ends at
    // `now`, so a case that performs its end activity tomorrow is open today —
    // which is the whole point of evaluating as of an instant. Reading the raw
    // table here would let an event that has not happened yet close a case
    // retrospectively, and every historical run would flatter itself.
    predicate = `NOT EXISTS (
      SELECT 1 FROM (${log}) le
      WHERE le.case_id = pc.case_id AND le.activity IN (${holes.join(', ')}))`;
  } else if (opts.openCases.kind === 'recent-activity') {
    // Age on whichever clock the analysis measures on. `now` is one instant
    // rather than a column, so its reading is taken here and bound as a number;
    // the SQL twin exists for per-event work and would buy nothing.
    let age: string;
    if (opts.calendar === undefined) {
      params.push(dialect.timestampParam(opts.now));
      age = dialect.durationSeconds('pc.last_ts', dialect.timestampPlaceholder(params.length));
    } else {
      params.push(businessElapsed(opts.now, opts.calendar));
      age = `(${dialect.placeholder(params.length)} - pc.last_business_s)`;
    }
    // The lower bound matters. A case whose last event is AFTER `now` has a
    // negative age, which passes a bare `<=` and makes every future-dated case
    // look live. Events after `now` are outside the horizon entirely.
    predicate = `${age} >= 0 AND ${age} <= ${Number(opts.openCases.withinSeconds)}`;
  }

  const { rows } = await client.query(
    `SELECT pc.case_id, pc.first_ts, pc.last_ts, pc.events
     FROM (${perCase}) pc
     WHERE ${predicate}`,
    params,
  );

  if (rows.length === 0) return { cases: [], totalCases };

  // Fetch the traces of the open cases only. This is the one place event rows
  // cross into Node, and it is bounded by the number of LIVE cases rather than
  // the size of the log.
  const ids = rows.map((r) => String(r['case_id']));
  const traceParams: unknown[] = [];
  const { sql: traceLog } = buildLog(dialect, traceParams, {
    ...asOfNow(opts),
    filter: { kind: 'cases', ids },
  });
  const traces = await client.query(
    `SELECT case_id, activity, ts FROM (${traceLog}) t ORDER BY case_id, ${EVENT_ORDER}`,
    traceParams,
  );

  const paths = new Map<string, string[]>();
  for (const row of traces.rows) {
    const id = String(row['case_id']);
    const list = paths.get(id) ?? [];
    list.push(String(row['activity']));
    paths.set(id, list);
  }

  const cases: OpenCase[] = rows.map((r) => {
    const caseId = String(r['case_id']);
    const path = paths.get(caseId) ?? [];
    return {
      caseId,
      firstAt: asDate(r['first_ts']) ?? opts.now,
      lastAt: asDate(r['last_ts']) ?? opts.now,
      lastActivity: path[path.length - 1] ?? null,
      events: countOf(r['events']),
      path,
    };
  });

  return { cases, totalCases };
}

async function restrictToFilter(
  client: SqlClient,
  dialect: SqlDialect,
  opts: EvaluateSignalsOptions,
  filter: CaseFilter,
  candidates: readonly OpenCase[],
): Promise<OpenCase[]> {
  if (candidates.length === 0) return [];
  const params: unknown[] = [];
  const { sql } = buildLog(dialect, params, {
    ...asOfNow(opts),
    filter: {
      kind: 'and',
      args: [filter, { kind: 'cases', ids: candidates.map((c) => c.caseId) }],
    },
  });
  const { rows } = await client.query(`SELECT DISTINCT case_id FROM (${sql}) f`, params);
  const keep = new Set(rows.map((r) => String(r['case_id'])));
  return candidates.filter((c) => keep.has(c.caseId));
}

async function evaluateOne(
  client: SqlClient,
  dialect: SqlDialect,
  signal: SignalDefinition,
  cases: readonly OpenCase[],
  opts: EvaluateSignalsOptions,
): Promise<SignalFiring[]> {
  const name = signal.name ?? signal.id;
  const base = (c: OpenCase) => ({
    signalId: signal.id,
    signalName: name,
    caseId: c.caseId,
    severity: signal.severity,
    currentActivity: c.lastActivity,
    lastEventAt: c.lastAt,
    openForSeconds: (opts.now.getTime() - c.firstAt.getTime()) / 1000,
    action: signal.action ?? null,
  });

  switch (signal.trigger.kind) {
    case 'running-longer-than': {
      const threshold = signal.trigger.seconds;
      return cases
        .filter((c) => (opts.now.getTime() - c.firstAt.getTime()) / 1000 > threshold)
        .map((c) => {
          const open = (opts.now.getTime() - c.firstAt.getTime()) / 1000;
          return {
            ...base(c),
            mined: false, // a threshold, not a discovery
            reason: `open ${fmt(open)}, past the ${fmt(threshold)} threshold`,
            evidence: { openForSeconds: open, thresholdSeconds: threshold },
          };
        });
    }

    case 'stalled': {
      const { seconds, atActivity } = signal.trigger;
      return cases
        .filter((c) => {
          const idle = (opts.now.getTime() - c.lastAt.getTime()) / 1000;
          if (idle <= seconds) return false;
          return atActivity === undefined || c.lastActivity === atActivity;
        })
        .map((c) => {
          const idle = (opts.now.getTime() - c.lastAt.getTime()) / 1000;
          return {
            ...base(c),
            mined: false,
            reason: `no progress for ${fmt(idle)}${c.lastActivity !== null ? `, sitting at "${c.lastActivity}"` : ''}`,
            evidence: { idleSeconds: idle, thresholdSeconds: seconds, atActivity: c.lastActivity },
          };
        });
    }

    case 'repeating': {
      const { activity, times } = signal.trigger;
      return cases
        .map((c) => ({ c, count: c.path.filter((a) => a === activity).length }))
        .filter(({ count }) => count >= times)
        .map(({ c, count }) => ({
          ...base(c),
          mined: false,
          reason: `"${activity}" has happened ${count} times in this case, at or above the ${times} threshold`,
          evidence: { activity, occurrences: count, threshold: times },
        }));
    }

    case 'path-risk': {
      const { outcomeActivity, minRate, minSupport } = signal.trigger;
      const history = await buildPrefixRisk(client, dialect, opts, outcomeActivity);

      const out: SignalFiring[] = [];
      for (const c of cases) {
        // Match the LONGEST known prefix: the more of the path is accounted
        // for, the more specific the prediction. Taking the shortest match
        // would answer a vaguer question than the one being asked.
        const stat = longestPrefixMatch(history, c.path, minSupport);
        if (stat === null || stat.rate < minRate) continue;
        out.push({
          ...base(c),
          mined: true,
          reason:
            `cases that reached this point historically end in "${outcomeActivity}" ` +
            `${(stat.rate * 100).toFixed(0)}% of the time (${stat.bad} of ${stat.total})`,
          evidence: {
            outcomeActivity,
            historicalRate: stat.rate,
            support: stat.total,
            badCases: stat.bad,
            matchedPrefix: stat.prefix,
            baseRate: history.baseRate,
            // The lift is the point. A 40% risk is not a finding if 40% of
            // everything ends that way.
            lift: history.baseRate > 0 ? stat.rate / history.baseRate : null,
          },
        });
      }
      return out;
    }
  }
}

interface PrefixStat {
  prefix: string[];
  total: number;
  bad: number;
  rate: number;
}

interface PrefixRisk {
  byPrefix: Map<string, PrefixStat>;
  baseRate: number;
}

const SEP = String.fromCharCode(31);
/** Prefixes longer than this are too specific to have useful support. */
const MAX_PREFIX = 12;

/**
 * Historical outcome rate for every path prefix.
 *
 * Built from VARIANTS rather than raw cases: two cases with the same activity
 * sequence contribute the same prefixes, so a million cases over four thousand
 * paths is four thousand walks. The counts are identical either way.
 */
async function buildPrefixRisk(
  client: SqlClient,
  dialect: SqlDialect,
  opts: EvaluateSignalsOptions,
  outcomeActivity: string,
): Promise<PrefixRisk> {
  const report = await analyseVariants(client, dialect, {
    objectType: opts.objectType,
    ...(opts.schema !== undefined ? { schema: opts.schema } : {}),
    ...(opts.lifecycle !== undefined ? { lifecycle: opts.lifecycle } : {}),
    // History is what happened BEFORE now. Learning the outcome rate from
    // events that have not occurred yet is straightforward data leakage: the
    // prediction would be scored against information it could never have had.
    window: { to: opts.now },
    limit: 5000,
  });

  const byPrefix = new Map<string, PrefixStat>();
  let totalCases = 0;
  let badCases = 0;

  for (const variant of report.variants) {
    const bad = variant.path.includes(outcomeActivity);
    totalCases += variant.cases;
    if (bad) badCases += variant.cases;

    // Stop at the outcome itself: a prefix that already contains it predicts
    // nothing, and would report a 100% risk for something that has happened.
    const end = bad ? variant.path.indexOf(outcomeActivity) : variant.path.length;
    const usable = variant.path.slice(0, Math.min(end, MAX_PREFIX));

    for (let length = 1; length <= usable.length; length += 1) {
      const prefix = usable.slice(0, length);
      const key = prefix.join(SEP);
      const stat = byPrefix.get(key) ?? { prefix, total: 0, bad: 0, rate: 0 };
      stat.total += variant.cases;
      if (bad) stat.bad += variant.cases;
      stat.rate = stat.bad / stat.total;
      byPrefix.set(key, stat);
    }
  }

  return { byPrefix, baseRate: totalCases > 0 ? badCases / totalCases : 0 };
}

function longestPrefixMatch(
  history: PrefixRisk,
  path: readonly string[],
  minSupport: number,
): PrefixStat | null {
  for (let length = Math.min(path.length, MAX_PREFIX); length >= 1; length -= 1) {
    const key = path.slice(0, length).join(SEP);
    const stat = history.byPrefix.get(key);
    // Support is checked here, not after: a prefix seen twice, both badly,
    // reads as a 100% risk and would fire on everything that touches it.
    if (stat !== undefined && stat.total >= minSupport) return stat;
  }
  return null;
}

function describeOpenRule(rule: OpenCaseRule): string {
  switch (rule.kind) {
    case 'missing-end-activity':
      return `open = has not performed any of: ${rule.endActivities.join(', ')}`;
    case 'recent-activity':
      return `open = last event within ${fmt(rule.withinSeconds)} of the evaluation time`;
    case 'all':
      return 'open = every case (only valid on a live-updating store)';
  }
}

function fmt(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}

/** A human-readable line describing a signal, for listings and logs. */
export function describeSignal(signal: SignalDefinition): string {
  const scope = signal.filter === undefined ? '' : ` (within ${describeFilter(signal.filter)})`;
  switch (signal.trigger.kind) {
    case 'running-longer-than':
      return `open longer than ${fmt(signal.trigger.seconds)}${scope}`;
    case 'stalled':
      return `no progress for ${fmt(signal.trigger.seconds)}${
        signal.trigger.atActivity !== undefined ? ` at "${signal.trigger.atActivity}"` : ''
      }${scope}`;
    case 'repeating':
      return `"${signal.trigger.activity}" repeated ${signal.trigger.times}+ times${scope}`;
    case 'path-risk':
      return `on a path that historically ends in "${signal.trigger.outcomeActivity}" ${(
        signal.trigger.minRate * 100
      ).toFixed(0)}%+ of the time${scope}`;
  }
}

/**
 * Where firings go.
 *
 * A port, not an implementation. The engine has no business making an HTTP
 * call, writing to a queue or invoking a rule: those are decisions with
 * consequences, and they belong to whoever owns the process. The engine's job
 * ends at "here is what I found, and here is the evidence".
 */
export interface SignalSink {
  emit(firings: readonly SignalFiring[]): Promise<void>;
}

/** Collects firings in memory. Useful for tests and for a batch caller. */
export function collectingSink(): SignalSink & { firings: SignalFiring[] } {
  const firings: SignalFiring[] = [];
  return {
    firings,
    async emit(batch) {
      firings.push(...batch);
    },
  };
}
