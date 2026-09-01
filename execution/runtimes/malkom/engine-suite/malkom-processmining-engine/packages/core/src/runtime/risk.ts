import { ConfigInvalidError } from '../domain/errors.js';
import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { businessElapsed } from './calendar.js';
import { CASE_CYCLE_SECONDS, buildLog, type LogQueryOptions } from './logquery.js';
import type { OpenCaseRule } from './signals.js';

/**
 * Which work in flight is heading for trouble.
 *
 * Not a forecast, and deliberately not dressed as one. The claim is only this:
 * of the finished cases that reached the same point by the same route, this
 * share ended badly. That is a rate observed in the log, so it can be shown to
 * the person it is about and defended — which a model score cannot be.
 *
 * Two rules keep it honest.
 *
 * **Nothing after the evaluation instant is consulted.** The rate for a route
 * is learned only from cases that had already finished by then. Learning from
 * the future is the classic way a prediction flatters itself, and it is
 * invisible in the output: the numbers look excellent right up until the model
 * meets a real case.
 *
 * **A rate with no support behind it is refused.** A route seen twice, both
 * ending badly, is not a 100% failure rate. The prefix is shortened until
 * enough cases stand behind it, and the length actually used is reported so a
 * reader can see how specific the claim is.
 */

export interface RiskFactor {
  /** The route prefix the rate was learned from. */
  prefix: string[];
  /** Finished cases that took this prefix, before the evaluation instant. */
  support: number;
  /** Share of them that ended badly, 0-1. */
  rate: number;
}

export interface CaseAtRisk {
  caseId: string;
  /** What it has done so far, in order. */
  path: string[];
  /** Where it is now. */
  currentActivity: string;
  /** How long it has been open, on whichever clock the analysis uses. */
  ageSeconds: number;
  /**
   * Historical share of cases on this route that ended badly, 0-1.
   *
   * Null when no prefix of this route has enough support to say anything. A
   * null is a refusal, not a zero — "we have never seen this route before" and
   * "this route is safe" are opposite statements.
   */
  risk: number | null;
  /** The prefix the rate came from, and how much stood behind it. */
  basis: RiskFactor | null;
  /** True when the case has already exceeded the SLA. */
  breached: boolean;
}

export interface RiskReport {
  objectType: string;
  asOf: Date;
  /** How "open" was decided, stated so the count cannot be read as live truth. */
  openCaseRule: string;
  /** What counted as a bad ending. */
  outcome: string;
  openCases: number;
  /** Finished cases the rates were learned from. */
  learnedFrom: number;
  /** Base rate across all finished cases, so a route's rate has something to beat. */
  baseRate: number | null;
  /** Open cases, riskiest first. */
  cases: CaseAtRisk[];
  /** Open cases for which no route had enough support. */
  unknownRoutes: number;
}

export interface RiskOptions extends LogQueryOptions {
  /** How to tell a running case from a finished one. */
  openCases: OpenCaseRule;
  /** Evaluation instant. Injected so a historical run is reproducible. */
  now: Date;
  /** A finished case ending slower than this ended badly. */
  slaSeconds?: number | undefined;
  /** A finished case reaching any of these ended badly. */
  badActivities?: readonly string[] | undefined;
  /** Prefix length to learn routes at. Default 6. */
  maxPrefix?: number | undefined;
  /** Finished cases a rate needs behind it before it is reported. Default 10. */
  minSupport?: number | undefined;
  /** Cases returned, riskiest first. Default 50. */
  limit?: number | undefined;
}

const DEFAULT_MAX_PREFIX = 6;
const DEFAULT_MIN_SUPPORT = 10;
const DEFAULT_LIMIT = 50;
const SEPARATOR = ' → ';

/**
 * Rank the work in flight by how its route has historically ended.
 */
export async function casesAtRisk(
  client: SqlClient,
  dialect: SqlDialect,
  opts: RiskOptions,
): Promise<RiskReport> {
  if (opts.slaSeconds === undefined && (opts.badActivities ?? []).length === 0) {
    throw new ConfigInvalidError('nothing defines a bad ending', [
      'set slaSeconds, or badActivities, or both',
    ]);
  }

  const maxPrefix = Math.max(1, Math.trunc(opts.maxPrefix ?? DEFAULT_MAX_PREFIX));
  const minSupport = Math.max(1, Math.trunc(opts.minSupport ?? DEFAULT_MIN_SUPPORT));
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT));

  const params: unknown[] = [];
  // Everything is bounded by the evaluation instant. Without this the rates
  // would be learned partly from cases that had not finished yet.
  const scoped: LogQueryOptions = { ...opts, window: { ...(opts.window ?? {}), to: opts.now } };
  const { sql: log } = buildLog(dialect, params, scoped);

  const perCase = `SELECT case_id,
                          ${dialect.stringAgg('activity', SEPARATOR, 'ts, event_id')} AS route,
                          ${CASE_CYCLE_SECONDS} AS cycle_s,
                          MAX(business_s) AS last_business_s,
                          MAX(ts) AS last_ts,
                          MAX(CASE WHEN rn = 1 THEN activity END) AS current_activity
                   FROM (SELECT case_id, activity, ts, event_id, business_s,
                                ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY ts DESC, event_id DESC) AS rn
                         FROM (${log}) o) r
                   GROUP BY case_id`;

  const open = openPredicate(opts, dialect, params, log);
  const age = ageExpr(opts, dialect, params);

  const { rows } = await client.query(
    `SELECT case_id, route, cycle_s, current_activity, ${age} AS age_s,
            CASE WHEN ${open} THEN 1 ELSE 0 END AS is_open
     FROM (${perCase}) pc`,
    params,
  );

  const bad = new Set((opts.badActivities ?? []).map((a) => a));
  const endedBadly = (path: readonly string[], cycleSeconds: number | null): boolean => {
    if (opts.slaSeconds !== undefined && (cycleSeconds ?? 0) > opts.slaSeconds) return true;
    const last = path[path.length - 1];
    return last !== undefined && bad.has(last);
  };

  // Learn from the finished cases only.
  const learned = new Map<string, { n: number; bad: number }>();
  let learnedFrom = 0;
  let badTotal = 0;
  const openRows: { caseId: string; path: string[]; current: string; age: number }[] = [];

  for (const row of rows) {
    const path = String(row['route'] ?? '')
      .split(SEPARATOR)
      .filter((s) => s !== '');
    if (path.length === 0) continue;

    if (countOf(row['is_open']) === 1) {
      openRows.push({
        caseId: String(row['case_id']),
        path,
        current: String(row['current_activity'] ?? path[path.length - 1]),
        age: Math.max(0, numberOrNull(row['age_s']) ?? 0),
      });
      continue;
    }

    learnedFrom += 1;
    const outcome = endedBadly(path, numberOrNull(row['cycle_s']));
    if (outcome) badTotal += 1;
    for (let depth = 1; depth <= Math.min(maxPrefix, path.length); depth += 1) {
      const key = path.slice(0, depth).join(SEPARATOR);
      const seen = learned.get(key) ?? { n: 0, bad: 0 };
      seen.n += 1;
      if (outcome) seen.bad += 1;
      learned.set(key, seen);
    }
  }

  const baseRate = learnedFrom === 0 ? null : badTotal / learnedFrom;

  const cases: CaseAtRisk[] = openRows.map((row) => {
    // Longest prefix with enough behind it. Shortening rather than giving up is
    // what makes a partially-familiar route usable: the claim gets broader, and
    // the reported prefix says exactly how broad.
    let basis: RiskFactor | null = null;
    for (let depth = Math.min(maxPrefix, row.path.length); depth >= 1; depth -= 1) {
      const prefix = row.path.slice(0, depth);
      const seen = learned.get(prefix.join(SEPARATOR));
      if (seen !== undefined && seen.n >= minSupport) {
        basis = { prefix, support: seen.n, rate: seen.bad / seen.n };
        break;
      }
    }

    return {
      caseId: row.caseId,
      path: row.path,
      currentActivity: row.current,
      ageSeconds: row.age,
      risk: basis?.rate ?? null,
      basis,
      breached: opts.slaSeconds !== undefined && row.age > opts.slaSeconds,
    };
  });

  // Riskiest first; among equals, the one that has been waiting longest. An
  // unknown route sorts last rather than as risk zero — it is not a safe case,
  // it is one nothing is known about.
  cases.sort(
    (a, b) =>
      (b.risk ?? -1) - (a.risk ?? -1) ||
      b.ageSeconds - a.ageSeconds ||
      a.caseId.localeCompare(b.caseId),
  );

  return {
    objectType: opts.objectType,
    asOf: opts.now,
    openCaseRule: describeOpenRule(opts.openCases),
    outcome: describeOutcome(opts),
    openCases: cases.length,
    learnedFrom,
    baseRate,
    cases: cases.slice(0, limit),
    unknownRoutes: cases.filter((c) => c.risk === null).length,
  };
}

/** Age of a case at `now`, on whichever clock the analysis uses. */
function ageExpr(opts: RiskOptions, dialect: SqlDialect, params: unknown[]): string {
  if (opts.calendar === undefined) {
    params.push(dialect.timestampParam(opts.now));
    return dialect.durationSeconds('last_ts', dialect.timestampPlaceholder(params.length));
  }
  params.push(businessElapsed(opts.now, opts.calendar));
  return `(${dialect.placeholder(params.length)} - last_business_s)`;
}

/** The open-case predicate, over the per-case summary aliased `pc`. */
function openPredicate(
  opts: RiskOptions,
  dialect: SqlDialect,
  params: unknown[],
  log: string,
): string {
  const rule = opts.openCases;
  if (rule.kind === 'all') return 'TRUE';

  if (rule.kind === 'missing-end-activity') {
    const holes = rule.endActivities.map((a) => {
      params.push(a);
      return dialect.placeholder(params.length);
    });
    // The windowed log, so an end activity performed after `now` cannot close
    // this case retrospectively.
    return `NOT EXISTS (SELECT 1 FROM (${log}) le
                        WHERE le.case_id = pc.case_id AND le.activity IN (${holes.join(', ')}))`;
  }

  const within = Number(rule.withinSeconds);
  if (opts.calendar === undefined) {
    params.push(dialect.timestampParam(opts.now));
    const nowHole = dialect.timestampPlaceholder(params.length);
    const age = dialect.durationSeconds('pc.last_ts', nowHole);
    return `${age} >= 0 AND ${age} <= ${within}`;
  }
  params.push(businessElapsed(opts.now, opts.calendar));
  const age = `(${dialect.placeholder(params.length)} - pc.last_business_s)`;
  return `${age} >= 0 AND ${age} <= ${within}`;
}

function describeOpenRule(rule: OpenCaseRule): string {
  switch (rule.kind) {
    case 'all':
      return 'every case treated as open';
    case 'missing-end-activity':
      return `open until one of: ${rule.endActivities.join(', ')}`;
    case 'recent-activity':
      return `open if touched within ${rule.withinSeconds}s`;
  }
}

function describeOutcome(opts: RiskOptions): string {
  const parts: string[] = [];
  if (opts.slaSeconds !== undefined) parts.push(`took longer than ${opts.slaSeconds}s`);
  if ((opts.badActivities ?? []).length > 0) {
    parts.push(`ended at ${(opts.badActivities ?? []).join(' or ')}`);
  }
  return parts.join(', or ');
}
