import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { CaseFilter } from './filter.js';
import {
  CASE_CYCLE_SECONDS,
  PREVIOUS_STEP_LAGS,
  buildLog,
  waitingSecondsExpr,
} from './logquery.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * The performance perspective: where the time actually goes.
 *
 * The distinction this module exists for is **waiting versus handling**. Total
 * cycle time on its own cannot tell you what to do about a slow process. Split
 * it and the answer usually becomes obvious: work that spends its time being
 * handled needs more capacity or a simpler task; work that spends its time
 * waiting needs different routing or a smaller queue. Most tools report only
 * the total, and most improvement projects start by guessing which of the two
 * they are looking at.
 *
 * Everything here is aggregate SQL. No event rows cross into Node.
 */

export interface PerformanceOptions {
  objectType: string;
  schema?: string | undefined;
  window?: { from?: Date | undefined; to?: Date | undefined } | undefined;
  lifecycle?: readonly string[] | undefined;
  /** Restrict to whole CASES matching this selection. */
  filter?: CaseFilter | undefined;
  /** Step, person, or an event attribute — what goes in the boxes. */
  perspective?: Perspective | undefined;
  /** Probe with detectCapabilities; omitting it projects absent columns as NULL. */
  capabilities?: LogCapabilities | undefined;
  /**
   * Measure durations in working time rather than wall-clock. See
   * `LogQueryOptions.calendar`; off by default, and every figure here is the
   * wall-clock one without it.
   */
  calendar?: BusinessCalendar | undefined;
  /** Cases longer than this many seconds count as breaches. */
  slaSeconds?: number | undefined;
}

/** A distribution, reported the way skewed data has to be reported. */
export interface Distribution {
  count: number;
  /** Reported, but never on its own — a long tail drags it somewhere no case lives. */
  mean: number | null;
  /**
   * The quartiles, which are what a box plot's box is.
   *
   * Carried alongside p90/p95 rather than instead of them: the quartiles draw
   * the box, the upper percentiles are what an SLA is written against, and
   * neither substitutes for the other on skewed data.
   */
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  min: number | null;
  max: number | null;
  /** Sum across all observations — what ranks a bottleneck. */
  total: number | null;
}

export interface ActivityPerformance {
  activity: string;
  occurrences: number;
  cases: number;
  /** Time spent BEING WORKED, from the source's recorded duration. */
  handling: Distribution;
  /** Time spent waiting BEFORE this activity started. */
  waiting: Distribution;
  /**
   * Share of all waiting time in the log that accrues before this activity.
   * The bottleneck ranking: an activity waited on briefly ten thousand times
   * costs more than one waited on for a week twice.
   */
  waitShare: number;
}

export interface CasePerformance {
  /** First event to last event. */
  cycleTime: Distribution;
  /** Summed recorded handling time per case. */
  handlingTime: Distribution;
  /** Cycle time minus handling — the part nobody was working on it. */
  waitingTime: Distribution;
  caseCount: number;
  /**
   * Fraction of total elapsed time that was handling, 0–1.
   *
   * **Null when the source records no handling times at all**, which is a
   * different statement from zero. Reporting "0% being worked" for a log that
   * simply never measured handling asserts a finding that was never observed —
   * and it is the more damaging error, because it reads as though the work sat
   * untouched the entire time.
   */
  handlingRatio: number | null;
  /** Events carrying a recorded handling time. Zero means handling is unknown. */
  durationsRecorded: number;
}

export interface TransitionPerformance {
  from: string;
  to: string;
  frequency: number;
  waiting: Distribution;
  /** frequency x median wait — total delay this arc contributes. */
  totalWait: number | null;
}

export interface SlaReport {
  thresholdSeconds: number;
  breached: number;
  total: number;
  breachRate: number;
  /** Median overshoot among breaching cases, in seconds. */
  medianOvershoot: number | null;
}

export interface PerformanceReport {
  objectType: string;
  caseCount: number;
  eventCount: number;
  activities: ActivityPerformance[];
  transitions: TransitionPerformance[];
  cases: CasePerformance;
  sla: SlaReport | null;
  /** Ordered worst-first: the arcs and activities to look at, with why. */
  bottlenecks: Bottleneck[];
}

export interface Bottleneck {
  kind: 'activity-wait' | 'transition-wait' | 'activity-handling';
  label: string;
  /** Total seconds this contributes across the whole log. */
  totalSeconds: number;
  /** Share of all delay in the log, 0–1. */
  share: number;
  occurrences: number;
  medianSeconds: number | null;
  /** Which of the two levers this points at. */
  advice: string;
}

const ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0 WHEN 'assign' THEN 1 WHEN 'start' THEN 2
    WHEN '' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END, event_id`;

export async function analysePerformance(
  client: SqlClient,
  dialect: SqlDialect,
  opts: PerformanceOptions,
): Promise<PerformanceReport> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  // Waiting is defined once, in logquery, because the case timeline shows the
  // same quantity step by step. Two spellings would let a bottleneck ranking
  // and the case that supposedly demonstrates it disagree.
  const stepped = `
    SELECT case_id, activity, ts, duration_s, business_s,
           ${PREVIOUS_STEP_LAGS}
    FROM (${log}) p`;

  const withWait = `SELECT case_id, activity, ts, duration_s, prev_activity,
                           ${waitingSecondsExpr(dialect)} AS wait_s
                    FROM (${stepped}) s`;

  const [activityRows, transitionRows, caseRows, totalsRows] = await Promise.all([
    client.query(
      `SELECT activity,
              COUNT(*) AS occurrences,
              COUNT(DISTINCT case_id) AS cases,
              ${dist(dialect, 'duration_s', 'h')},
              ${dist(dialect, 'wait_s', 'w')}
       FROM (${withWait}) a GROUP BY activity`,
      params,
    ),
    client.query(
      `SELECT prev_activity AS from_activity, activity AS to_activity,
              COUNT(*) AS frequency,
              ${dist(dialect, 'wait_s', 'w')}
       FROM (${withWait}) t WHERE prev_activity IS NOT NULL
       GROUP BY 1, 2`,
      params,
    ),
    client.query(
      `SELECT ${dist(dialect, 'cycle_s', 'c')},
              ${dist(dialect, 'handling_s', 'h')},
              ${dist(dialect, 'waiting_s', 'w')},
              COUNT(*) AS case_count,
              SUM(cycle_s) AS total_cycle,
              SUM(handling_s) AS total_handling
       FROM (
         SELECT case_id,
                ${CASE_CYCLE_SECONDS} AS cycle_s,
                COALESCE(SUM(duration_s), 0) AS handling_s,
                GREATEST(${CASE_CYCLE_SECONDS} - COALESCE(SUM(duration_s), 0), 0) AS waiting_s
         FROM (${log}) c GROUP BY case_id
       ) per_case`,
      params,
    ),
    client.query(
      `SELECT COUNT(*) AS events, COUNT(DISTINCT case_id) AS cases,
              COUNT(duration_s) AS durations
       FROM (${log}) t`,
      params,
    ),
  ]);

  const totals = totalsRows.rows[0] ?? {};
  const caseRow = caseRows.rows[0] ?? {};

  const activities: ActivityPerformance[] = activityRows.rows.map((r) => ({
    activity: String(r['activity']),
    occurrences: countOf(r['occurrences']),
    cases: countOf(r['cases']),
    handling: readDist(r, 'h'),
    waiting: readDist(r, 'w'),
    waitShare: 0,
  }));

  const totalWaiting = activities.reduce((sum, a) => sum + (a.waiting.total ?? 0), 0);
  for (const a of activities) {
    a.waitShare = totalWaiting > 0 ? (a.waiting.total ?? 0) / totalWaiting : 0;
  }
  activities.sort((a, b) => (b.waiting.total ?? 0) - (a.waiting.total ?? 0));

  const transitions: TransitionPerformance[] = transitionRows.rows
    .map((r) => {
      const waiting = readDist(r, 'w');
      return {
        from: String(r['from_activity']),
        to: String(r['to_activity']),
        frequency: countOf(r['frequency']),
        waiting,
        totalWait: waiting.total,
      };
    })
    .sort((a, b) => (b.totalWait ?? 0) - (a.totalWait ?? 0));

  const totalCycle = numberOrNull(caseRow['total_cycle']) ?? 0;
  const totalHandling = numberOrNull(caseRow['total_handling']) ?? 0;

  // Distinguish "handling was measured and was small" from "handling was never
  // measured". Only the first is a finding.
  const durationsRecorded = countOf(totals['durations']);
  const cases: CasePerformance = {
    cycleTime: readDist(caseRow, 'c'),
    handlingTime: readDist(caseRow, 'h'),
    waitingTime: readDist(caseRow, 'w'),
    caseCount: countOf(caseRow['case_count']),
    handlingRatio:
      durationsRecorded > 0 && totalCycle > 0 ? totalHandling / totalCycle : null,
    durationsRecorded,
  };

  const sla =
    opts.slaSeconds === undefined
      ? null
      : await measureSla(client, dialect, log, params, opts.slaSeconds);

  return {
    objectType: opts.objectType,
    caseCount: countOf(totals['cases']),
    eventCount: countOf(totals['events']),
    activities,
    transitions,
    cases,
    sla,
    bottlenecks: rankBottlenecks(activities, transitions),
  };
}

/** Aggregate expressions for one distribution, aliased with a prefix. */
function dist(dialect: SqlDialect, expr: string, prefix: string): string {
  return [
    `COUNT(${expr}) AS ${prefix}_count`,
    `AVG(${expr}) AS ${prefix}_mean`,
    `${dialect.quantileOf(expr, 0.25)} AS ${prefix}_p25`,
    `${dialect.quantileOf(expr, 0.5)} AS ${prefix}_p50`,
    `${dialect.quantileOf(expr, 0.75)} AS ${prefix}_p75`,
    `${dialect.quantileOf(expr, 0.9)} AS ${prefix}_p90`,
    `${dialect.quantileOf(expr, 0.95)} AS ${prefix}_p95`,
    `MIN(${expr}) AS ${prefix}_min`,
    `MAX(${expr}) AS ${prefix}_max`,
    `SUM(${expr}) AS ${prefix}_total`,
  ].join(', ');
}

function readDist(row: Record<string, unknown>, prefix: string): Distribution {
  return {
    count: countOf(row[`${prefix}_count`]),
    mean: numberOrNull(row[`${prefix}_mean`]),
    p25: numberOrNull(row[`${prefix}_p25`]),
    p50: numberOrNull(row[`${prefix}_p50`]),
    p75: numberOrNull(row[`${prefix}_p75`]),
    p90: numberOrNull(row[`${prefix}_p90`]),
    p95: numberOrNull(row[`${prefix}_p95`]),
    min: numberOrNull(row[`${prefix}_min`]),
    max: numberOrNull(row[`${prefix}_max`]),
    total: numberOrNull(row[`${prefix}_total`]),
  };
}

async function measureSla(
  client: SqlClient,
  dialect: SqlDialect,
  log: string,
  params: readonly unknown[],
  thresholdSeconds: number,
): Promise<SlaReport> {
  const perCase = `SELECT case_id, ${CASE_CYCLE_SECONDS} AS cycle_s
                   FROM (${log}) c GROUP BY case_id`;
  const bound = Number.isFinite(thresholdSeconds) ? thresholdSeconds : 0;
  const { rows } = await client.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE cycle_s > ${bound}) AS breached,
            ${dialect.quantileOf(`CASE WHEN cycle_s > ${bound} THEN cycle_s - ${bound} END`, 0.5)} AS overshoot
     FROM (${perCase}) s`,
    params,
  );
  const row = rows[0] ?? {};
  const total = countOf(row['total']);
  const breached = countOf(row['breached']);
  return {
    thresholdSeconds: bound,
    breached,
    total,
    breachRate: total > 0 ? breached / total : 0,
    medianOvershoot: numberOrNull(row['overshoot']),
  };
}

/**
 * Rank where the time goes, worst first.
 *
 * Ranked by TOTAL contribution, not by the slowest single instance: an arc
 * that waits ten minutes fifty thousand times costs the business far more than
 * one that waits three weeks twice, and only the first is worth fixing.
 */
function rankBottlenecks(
  activities: readonly ActivityPerformance[],
  transitions: readonly TransitionPerformance[],
): Bottleneck[] {
  const out: Bottleneck[] = [];

  const totalDelay =
    transitions.reduce((s, t) => s + (t.totalWait ?? 0), 0) +
    activities.reduce((s, a) => s + (a.handling.total ?? 0), 0);
  if (totalDelay <= 0) return out;

  for (const t of transitions) {
    const total = t.totalWait ?? 0;
    if (total <= 0) continue;
    out.push({
      kind: 'transition-wait',
      label: `${t.from} → ${t.to}`,
      totalSeconds: total,
      share: total / totalDelay,
      occurrences: t.frequency,
      medianSeconds: t.waiting.p50,
      advice:
        'work sits idle between these two steps — look at routing, batching and queue length, not at headcount',
    });
  }

  for (const a of activities) {
    const total = a.handling.total ?? 0;
    if (total <= 0) continue;
    out.push({
      kind: 'activity-handling',
      label: a.activity,
      totalSeconds: total,
      share: total / totalDelay,
      occurrences: a.occurrences,
      medianSeconds: a.handling.p50,
      advice:
        'time is spent actively working this step — look at capacity, training or simplifying the task',
    });
  }

  return out.sort((x, y) => y.totalSeconds - x.totalSeconds);
}

/** Seconds as something a human reads. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}
