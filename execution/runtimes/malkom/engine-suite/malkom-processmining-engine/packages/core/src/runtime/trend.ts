import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import type { Granularity } from './charts.js';
import { checkConformance, type ConformanceOptions } from './conformance.js';
import { eventOrderBy } from './eventlog.js';
import { bucketRange } from './flow.js';
import {
  CASE_CYCLE_SECONDS,
  PREVIOUS_STEP_LAGS,
  buildLog,
  waitingSecondsExpr,
  type LogQueryOptions,
} from './logquery.js';

/**
 * A number with a trend behind it is a different number.
 *
 * "Median cycle time is 4.2 days" invites one response; "4.2 days, up from 2.9
 * over six weeks" invites another, and the engine already holds everything
 * needed to say the second. Every report here is otherwise a single snapshot.
 *
 * The hard part is not the series, it is knowing when a move is real. Teams
 * react to noise — a bad week gets a project, and the next week regresses to the
 * mean and the project takes the credit. So a trend here carries **process
 * behaviour limits**: the range within which variation is just the process being
 * itself. A point outside them is worth a meeting; a point inside them is not,
 * however much worse it looks than last week.
 */

export type TrendMetric =
  /** Median case cycle time, in seconds. */
  | 'cycle'
  /** Cases finished in the period. */
  | 'throughput'
  /** Cases started in the period. */
  | 'arrivals'
  /** Median idle time before a step, in seconds. */
  | 'waiting'
  /** Share of events that repeated work already done, 0-1. */
  | 'rework'
  /** Repeated handling time in the period, in seconds — rework priced. */
  | 'reworkCost'
  /** Median recorded handling time of one step. Needs `activity`. */
  | 'stepDuration';

export interface TrendPoint {
  at: Date;
  /** Null when the period held nothing to measure — not zero, which is a claim. */
  value: number | null;
  /** Observations behind the value, so a spike on n=2 can be seen for what it is. */
  n: number;
  /** True when the value falls outside the behaviour limits. */
  exceptional: boolean;
}

export interface BehaviourLimits {
  /** Mean of the observed values — the centre line. */
  centre: number;
  upper: number;
  /** Clamped at zero for metrics that cannot go negative. */
  lower: number;
  /**
   * Mean moving range, the spread the limits are built from.
   *
   * Reported because the limits are meaningless without it: a tiny moving range
   * makes narrow limits that flag ordinary variation, which is how a control
   * chart turns into the noise it exists to suppress.
   */
  meanMovingRange: number;
}

export interface Trend {
  objectType: string;
  metric: TrendMetric;
  granularity: Granularity;
  unit: 'seconds' | 'cases' | 'share';
  /** Contiguous — a period with no work is present with a null value. */
  points: TrendPoint[];
  /**
   * Null when fewer than three periods carried a value.
   *
   * Limits from two points are arithmetic, not evidence: any third point is
   * then outside them by construction, and every week looks exceptional.
   */
  limits: BehaviourLimits | null;
  /** Plain statement of what the series does, including that it does nothing. */
  reading: string;
}

export interface TrendOptions extends LogQueryOptions {
  metric?: TrendMetric | undefined;
  granularity?: Granularity | undefined;
  /** Required by `stepDuration`; ignored otherwise. */
  activity?: string | undefined;
}

/**
 * The constant that turns a mean moving range into three-sigma limits.
 *
 * 3 / d2 for n = 2, where d2 = 1.128. Wheeler's constant, and the reason an XmR
 * chart needs no distributional assumption: the limits come from the observed
 * period-to-period movement rather than from a variance that assumes normality
 * on data that is never normal.
 */
const SIGMA_FROM_RANGE = 2.66;

/** Below this, limits describe the sample rather than the process. */
const MIN_POINTS_FOR_LIMITS = 3;

export async function metricTrend(
  client: SqlClient,
  dialect: SqlDialect,
  opts: TrendOptions,
): Promise<Trend> {
  const metric = opts.metric ?? 'cycle';
  const granularity = opts.granularity ?? 'week';

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const query = seriesQuery(dialect, log, metric, granularity, opts, params);

  const [{ rows }, { rows: bounds }] = await Promise.all([
    client.query(query, params),
    client.query(`SELECT MIN(ts) AS lo, MAX(ts) AS hi FROM (${log}) b`, params),
  ]);

  const lo = asDate(bounds[0]?.['lo']);
  const hi = asDate(bounds[0]?.['hi']);
  const unit = UNITS[metric];

  if (lo === null || hi === null) {
    return {
      objectType: opts.objectType,
      metric,
      granularity,
      unit,
      points: [],
      limits: null,
      reading: 'nothing in the log to trend',
    };
  }

  const measured = new Map<number, { value: number | null; n: number }>();
  for (const row of rows) {
    const at = asDate(row['bucket']);
    if (at === null) continue;
    measured.set(at.getTime(), {
      value: numberOrNull(row['value']),
      n: countOf(row['n']),
    });
  }

  // Contiguous: a quiet period is a fact about the process, and closing the gap
  // would draw a line straight through it as though work continued.
  const points: TrendPoint[] = bucketRange(lo, hi, granularity).map((at) => {
    const found = measured.get(at.getTime());
    return {
      at,
      value: found?.value ?? null,
      n: found?.n ?? 0,
      exceptional: false,
    };
  });

  const limits = behaviourLimits(points.map((p) => p.value), metric);
  if (limits !== null) {
    for (const point of points) {
      if (point.value === null) continue;
      point.exceptional = point.value > limits.upper || point.value < limits.lower;
    }
  }

  return {
    objectType: opts.objectType,
    metric,
    granularity,
    unit,
    points,
    limits,
    reading: readTrend(points, limits),
  };
}

const UNITS: Record<TrendMetric, Trend['unit']> = {
  cycle: 'seconds',
  throughput: 'cases',
  arrivals: 'cases',
  waiting: 'seconds',
  rework: 'share',
  reworkCost: 'seconds',
  stepDuration: 'seconds',
};

/** One row per period: `bucket`, `value`, `n`. */
function seriesQuery(
  dialect: SqlDialect,
  log: string,
  metric: TrendMetric,
  granularity: Granularity,
  opts: TrendOptions,
  params: unknown[],
): string {
  const bucket = (column: string): string => `DATE_TRUNC('${granularity}', ${column})`;

  if (metric === 'cycle' || metric === 'throughput' || metric === 'arrivals') {
    // Per case. A case is placed by when it finished, except arrivals, which
    // are about demand and so are placed by when it started.
    const perCase = `SELECT case_id, ${CASE_CYCLE_SECONDS} AS cycle_s,
                            MIN(ts) AS first_ts, MAX(ts) AS last_ts
                     FROM (${log}) c GROUP BY case_id`;
    const column = metric === 'arrivals' ? 'first_ts' : 'last_ts';
    const value =
      metric === 'cycle' ? dialect.medianOf('cycle_s') : 'CAST(COUNT(*) AS DOUBLE)';
    return `SELECT ${bucket(column)} AS bucket, ${value} AS value, COUNT(*) AS n
            FROM (${perCase}) k GROUP BY 1`;
  }

  if (metric === 'waiting') {
    const stepped = `SELECT ts, business_s, duration_s, case_id, activity,
                            ${PREVIOUS_STEP_LAGS}
                     FROM (${log}) p`;
    return `SELECT ${bucket('ts')} AS bucket,
                   ${dialect.medianOf('waiting_s')} AS value,
                   COUNT(waiting_s) AS n
            FROM (SELECT ts, ${waitingSecondsExpr(dialect)} AS waiting_s
                  FROM (${stepped}) w) s
            WHERE waiting_s IS NOT NULL
            GROUP BY 1`;
  }

  if (metric === 'stepDuration') {
    params.push(opts.activity ?? '');
    const hole = dialect.placeholder(params.length);
    return `SELECT ${bucket('ts')} AS bucket,
                   ${dialect.medianOf('duration_s')} AS value,
                   COUNT(duration_s) AS n
            FROM (${log}) d WHERE activity = ${hole}
            GROUP BY 1`;
  }

  // Rework: an event repeating an activity already performed in its case. The
  // same definition rework.ts uses, so the trend and the report agree.
  const order = eventOrderBy('');
  const numbered = `SELECT ts, duration_s, activity, case_id,
                           ROW_NUMBER() OVER (PARTITION BY case_id, activity ORDER BY ${order}) AS occurrence
                    FROM (${log}) r`;

  if (metric === 'rework') {
    return `SELECT ${bucket('ts')} AS bucket,
                   CAST(SUM(CASE WHEN occurrence > 1 THEN 1 ELSE 0 END) AS DOUBLE)
                     / NULLIF(COUNT(*), 0) AS value,
                   COUNT(*) AS n
            FROM (${numbered}) o GROUP BY 1`;
  }

  return `SELECT ${bucket('ts')} AS bucket,
                 SUM(CASE WHEN occurrence > 1 THEN duration_s ELSE 0 END) AS value,
                 SUM(CASE WHEN occurrence > 1 THEN 1 ELSE 0 END) AS n
          FROM (${numbered}) o GROUP BY 1`;
}

/**
 * Process behaviour limits from the period-to-period movement.
 *
 * The moving range is used rather than the standard deviation on purpose. A
 * standard deviation over the whole series absorbs the very shift the chart is
 * meant to detect: a process that steps up halfway through gets wide limits from
 * its own step change and then reports that nothing happened.
 */
export function behaviourLimits(
  values: readonly (number | null)[],
  metric: TrendMetric,
): BehaviourLimits | null {
  const observed = values.filter((v): v is number => v !== null);
  if (observed.length < MIN_POINTS_FOR_LIMITS) return null;

  const centre = observed.reduce((sum, v) => sum + v, 0) / observed.length;
  const ranges: number[] = [];
  for (let i = 1; i < observed.length; i += 1) {
    ranges.push(Math.abs(observed[i]! - observed[i - 1]!));
  }
  const meanMovingRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
  const spread = SIGMA_FROM_RANGE * meanMovingRange;

  // Every metric here is a duration, a count or a share; none can be negative,
  // and a lower limit below zero would be an unreachable threshold that reads
  // as though the process could not possibly be too fast.
  const floor = metric === 'rework' ? 0 : 0;
  return {
    centre,
    upper: centre + spread,
    lower: Math.max(floor, centre - spread),
    meanMovingRange,
  };
}

/** How many consecutive points on one side of the centre count as a shift. */
const RUN_LENGTH = 8;

function readTrend(points: readonly TrendPoint[], limits: BehaviourLimits | null): string {
  const measured = points.filter((p) => p.value !== null);
  if (measured.length === 0) return 'nothing in the log to trend';
  if (limits === null) {
    return `only ${measured.length} period${measured.length === 1 ? '' : 's'} carry a value — too few to say what is normal`;
  }

  const exceptional = measured.filter((p) => p.exceptional).length;
  if (exceptional > 0) {
    return `${exceptional} period${exceptional === 1 ? '' : 's'} outside the range this process normally holds — worth explaining`;
  }

  // A perfectly flat series has no movement to interpret. Without this the run
  // rule below reads every point as "not above the centre" and announces a
  // shift on a series that never moved at all.
  if (limits.meanMovingRange === 0) {
    return 'every period is identical — nothing is varying';
  }

  // A long run on one side is a shift the limits alone would not catch: every
  // point can sit inside the limits while the process has plainly moved.
  //
  // Points exactly on the centre are skipped rather than counted as below it,
  // which is the standard treatment and matters here: a metric that sits on its
  // own mean for a stretch is the calmest possible signal, and counting those
  // points as "below" would report the opposite.
  let run = 0;
  let side = 0;
  for (const point of measured) {
    const delta = point.value! - limits.centre;
    if (delta === 0) continue;
    const now = delta > 0 ? 1 : -1;
    run = now === side ? run + 1 : 1;
    side = now;
    if (run >= RUN_LENGTH) {
      return `${RUN_LENGTH} or more periods running ${now > 0 ? 'above' : 'below'} the centre — the process has shifted, even though no single period looks unusual`;
    }
  }

  return 'variation is ordinary — nothing here needs explaining';
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}

// ---------------------------------------------------------------------------

export interface ConformancePeriod {
  at: Date;
  cases: number;
  /** Null when the period held no cases to replay. */
  fitness: number | null;
  precision: number | null;
}

export interface ConformanceTrend {
  objectType: string;
  granularity: Granularity;
  periods: ConformancePeriod[];
  /** Periods skipped because the series exceeded the cap, so a gap is explained. */
  omittedPeriods: number;
  reading: string;
}

/** Replaying a model per period is one full pass each; bounded rather than open. */
export const MAX_CONFORMANCE_PERIODS = 60;

export interface ConformanceTrendOptions extends ConformanceOptions {
  granularity?: Granularity | undefined;
}

/**
 * Fitness and precision per period.
 *
 * Compliance is a trend, not a snapshot: "94% fitness" is a different statement
 * from "94%, down from 99% since the new routing went in", and an audit wants
 * the line rather than the number.
 *
 * Genuinely more expensive than the rest of this module — each period is a
 * complete replay — so the number of periods is capped and any shortfall is
 * reported rather than silently truncated.
 */
export async function conformanceTrend(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ConformanceTrendOptions,
): Promise<ConformanceTrend> {
  const granularity = opts.granularity ?? 'month';

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const { rows } = await client.query(
    `SELECT MIN(ts) AS lo, MAX(ts) AS hi FROM (${log}) b`,
    params,
  );

  const lo = asDate(rows[0]?.['lo']);
  const hi = asDate(rows[0]?.['hi']);
  if (lo === null || hi === null) {
    return {
      objectType: opts.objectType,
      granularity,
      periods: [],
      omittedPeriods: 0,
      reading: 'nothing in the log to check',
    };
  }

  const all = bucketRange(lo, hi, granularity);
  // The most recent periods are the ones anybody acts on, so the cap drops the
  // oldest rather than stopping partway through the series.
  const kept = all.slice(Math.max(0, all.length - MAX_CONFORMANCE_PERIODS));

  const periods: ConformancePeriod[] = [];
  for (let i = 0; i < kept.length; i += 1) {
    const from = kept[i]!;
    const to = kept[i + 1] ?? new Date(hi.getTime() + 1000);
    // Cases are scoped by their events falling in the window, which trims
    // traces at the edges — the same trimming every windowed analysis does.
    const report = await checkConformance(client, dialect, { ...opts, window: { from, to } });
    // `casesReplayed`, not the total: every rate in the report is computed over
    // the cases actually replayed, and pairing a rate with the wrong
    // denominator is how a capped run reads as full coverage.
    const replayed = report.casesReplayed;
    periods.push({
      at: from,
      cases: replayed,
      fitness: replayed === 0 ? null : report.logFitness,
      precision: replayed === 0 ? null : (report.precision?.precision ?? null),
    });
  }

  return {
    objectType: opts.objectType,
    granularity,
    periods,
    omittedPeriods: all.length - kept.length,
    reading: readConformance(periods),
  };
}

function readConformance(periods: readonly ConformancePeriod[]): string {
  const measured = periods.filter((p) => p.fitness !== null);
  if (measured.length < 2) return 'too few periods to say whether conformance is moving';

  const first = measured[0]!.fitness!;
  const last = measured[measured.length - 1]!.fitness!;
  const change = last - first;
  if (Math.abs(change) < 0.02) return 'conformance is holding steady';
  return change < 0
    ? `fitness has fallen ${(Math.abs(change) * 100).toFixed(1)} points across the series — the process is drifting from the model`
    : `fitness has risen ${(change * 100).toFixed(1)} points across the series`;
}
