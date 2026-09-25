import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { buildLog, perCaseSql, type LogQueryOptions } from './logquery.js';

/**
 * Chart-ready data shapes.
 *
 * The engine ships no charting library and never will — the host renders with
 * whatever it already uses. What it does owe the host is data small enough to
 * render, which for one view is not a detail but the whole problem.
 *
 * The dotted chart plots one mark per event. A real log means hundreds of
 * thousands to millions of them, and SVG collapses at roughly five thousand
 * nodes. Even on canvas, holding every point costs memory and makes
 * hover-to-find-nearest a linear scan. So the binning happens HERE, in the
 * database, and what crosses the wire is a fixed-size grid regardless of log
 * size.
 *
 * Everything below returns plain `{x, y, value}` arrays with no library
 * anywhere in the types.
 */

export interface Bin {
  /** Bin index, 0-based. */
  x: number;
  y: number;
  /** Events falling in this cell. */
  value: number;
}

export interface DottedChart {
  /** Grid dimensions actually used; may be smaller than requested for a small log. */
  xBins: number;
  yBins: number;
  bins: Bin[];
  /** Real-world extent of the x axis, so the host can label it. */
  timeFrom: Date | null;
  timeTo: Date | null;
  /** Cases represented, in the order the y axis is sorted. */
  caseCount: number;
  eventCount: number;
  /** Busiest cell, so the host can scale opacity without a second pass. */
  maxValue: number;
  sortedBy: DottedSort;
  /** True when binning actually reduced the data. */
  binned: boolean;
}

/**
 * How cases are ordered on the y axis.
 *
 * This choice IS the chart. Sorted by start time it shows arrival patterns and
 * seasonality; sorted by duration it shows the long tail as a curve you can
 * point at. The same data tells two different stories, so it is never chosen
 * silently.
 */
export type DottedSort = 'start' | 'duration' | 'end';

export interface DottedChartOptions extends LogQueryOptions {
  /** Horizontal resolution. Default 400 — roughly a pixel per bin on a wide screen. */
  xBins?: number;
  /** Vertical resolution. Default 300. */
  yBins?: number;
  sortBy?: DottedSort;
  /** Restrict the x axis; defaults to the log's own extent. */
  from?: Date;
  to?: Date;
}

const DEFAULT_X_BINS = 400;
const DEFAULT_Y_BINS = 300;

export async function dottedChart(
  client: SqlClient,
  dialect: SqlDialect,
  opts: DottedChartOptions,
): Promise<DottedChart> {
  const xBins = clampBins(opts.xBins ?? DEFAULT_X_BINS);
  const yBins = clampBins(opts.yBins ?? DEFAULT_Y_BINS);
  const sortBy = opts.sortBy ?? 'start';

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const perCase = perCaseSql(log, dialect);

  const extent = await client.query(
    `SELECT MIN(ts) AS lo, MAX(ts) AS hi, COUNT(*) AS events, COUNT(DISTINCT case_id) AS cases
     FROM (${log}) e`,
    params,
  );
  const row = extent.rows[0] ?? {};
  const eventCount = countOf(row['events']);
  const caseCount = countOf(row['cases']);
  const lo = opts.from ?? asDate(row['lo']);
  const hi = opts.to ?? asDate(row['hi']);

  if (eventCount === 0 || lo === null || hi === null) {
    return {
      xBins: 0,
      yBins: 0,
      bins: [],
      timeFrom: null,
      timeTo: null,
      caseCount,
      eventCount,
      maxValue: 0,
      sortedBy: sortBy,
      binned: false,
    };
  }

  // A zero-width span would divide by zero; give it one second so every event
  // lands in the first column rather than nowhere.
  const spanSeconds = Math.max(1, (hi.getTime() - lo.getTime()) / 1000);
  const orderColumn = sortBy === 'duration' ? 'cycle_s' : sortBy === 'end' ? 'last_ts' : 'first_ts';

  // Rank cases once, then bucket. Sorting inside the bucketing expression
  // would re-rank per row on some planners.
  const ranked = `SELECT case_id,
                         ROW_NUMBER() OVER (ORDER BY ${orderColumn}, case_id) - 1 AS rn,
                         COUNT(*) OVER () AS total_cases
                  FROM (${perCase}) pc`;

  params.push(dialect.timestampParam(lo));
  const loHole = dialect.timestampPlaceholder(params.length);

  const xExpr = `CAST(FLOOR(
      LEAST(${xBins - 1}, GREATEST(0,
        (${dialect.durationSeconds(loHole, 'e.ts')} / ${spanSeconds}) * ${xBins}
      ))) AS INTEGER)`;
  const yExpr = `CAST(FLOOR(
      LEAST(${yBins - 1}, GREATEST(0,
        (CAST(r.rn AS DOUBLE PRECISION) / GREATEST(1, r.total_cases)) * ${yBins}
      ))) AS INTEGER)`;

  const { rows } = await client.query(
    `SELECT ${xExpr} AS bx, ${yExpr} AS by, COUNT(*) AS n
     FROM (${log}) e
     JOIN (${ranked}) r ON r.case_id = e.case_id
     GROUP BY 1, 2
     ORDER BY 1, 2`,
    params,
  );

  const bins: Bin[] = rows.map((r) => ({
    x: countOf(r['bx']),
    y: countOf(r['by']),
    value: countOf(r['n']),
  }));

  return {
    xBins,
    yBins,
    bins,
    timeFrom: lo,
    timeTo: hi,
    caseCount,
    eventCount,
    maxValue: bins.reduce((max, b) => Math.max(max, b.value), 0),
    sortedBy: sortBy,
    binned: bins.length < eventCount,
  };
}

// ---------------------------------------------------------------------------

export interface HistogramBucket {
  /** Lower edge of the bucket, in the unit of the measure. */
  from: number;
  to: number;
  count: number;
}

export interface Histogram {
  buckets: HistogramBucket[];
  /** Observations counted. */
  n: number;
  min: number | null;
  max: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  /**
   * True when bucket edges grow geometrically rather than evenly.
   *
   * Cycle times span minutes to months, and even buckets put 99% of cases in
   * the first bar and render a useless chart. Log buckets are the honest
   * default for this shape of data, and the flag tells the host to label the
   * axis accordingly.
   */
  logarithmic: boolean;
}

export interface CycleTimeHistogramOptions extends LogQueryOptions {
  /** Bucket count. Default 40. */
  buckets?: number;
  /** Force even buckets. Default is logarithmic, which suits durations. */
  linear?: boolean;
}

/** Distribution of case durations, bucketed for a bar chart. */
export async function cycleTimeHistogram(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CycleTimeHistogramOptions,
): Promise<Histogram> {
  const bucketCount = Math.min(200, Math.max(4, opts.buckets ?? 40));
  const logarithmic = opts.linear !== true;

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const perCase = perCaseSql(log, dialect);

  const stats = await client.query(
    `SELECT COUNT(*) AS n, MIN(cycle_s) AS lo, MAX(cycle_s) AS hi,
            ${dialect.quantileOf('cycle_s', 0.5)} AS p50,
            ${dialect.quantileOf('cycle_s', 0.9)} AS p90,
            ${dialect.quantileOf('cycle_s', 0.95)} AS p95
     FROM (${perCase}) c`,
    params,
  );
  const s = stats.rows[0] ?? {};
  const n = countOf(s['n']);
  const min = numberOrNull(s['lo']);
  const max = numberOrNull(s['hi']);

  if (n === 0 || min === null || max === null) {
    return { buckets: [], n, min, max, p50: null, p90: null, p95: null, logarithmic };
  }

  // Log scaling needs a positive floor: a case completed in the same instant
  // has a duration of zero, and log(0) is undefined.
  const floor = Math.max(1, min);
  const ceiling = Math.max(floor + 1, max);
  const edges: number[] = [];
  for (let i = 0; i <= bucketCount; i += 1) {
    const t = i / bucketCount;
    edges.push(
      logarithmic
        ? floor * Math.pow(ceiling / floor, t)
        : min + (max - min) * t,
    );
  }

  const bucketExpr = logarithmic
    ? `CAST(FLOOR(LEAST(${bucketCount - 1}, GREATEST(0,
         (LN(GREATEST(${floor}, cycle_s)) - LN(${floor})) / (LN(${ceiling}) - LN(${floor})) * ${bucketCount}
       ))) AS INTEGER)`
    : `CAST(FLOOR(LEAST(${bucketCount - 1}, GREATEST(0,
         (cycle_s - ${min}) / ${Math.max(1e-9, max - min)} * ${bucketCount}
       ))) AS INTEGER)`;

  const { rows } = await client.query(
    `SELECT ${bucketExpr} AS b, COUNT(*) AS n FROM (${perCase}) c GROUP BY 1 ORDER BY 1`,
    params,
  );

  const counts = new Map(rows.map((r) => [countOf(r['b']), countOf(r['n'])]));
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < bucketCount; i += 1) {
    buckets.push({ from: edges[i]!, to: edges[i + 1]!, count: counts.get(i) ?? 0 });
  }

  return {
    buckets,
    n,
    min,
    max,
    p50: numberOrNull(s['p50']),
    p90: numberOrNull(s['p90']),
    p95: numberOrNull(s['p95']),
    logarithmic,
  };
}

// ---------------------------------------------------------------------------

export interface TimeSeriesPoint {
  /** Start of the interval. */
  at: Date;
  cases: number;
  events: number;
  medianCycleSeconds: number | null;
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface ThroughputOptions extends LogQueryOptions {
  granularity?: Granularity;
  /** Count a case at its first event ('start') or its last ('end'). */
  countAt?: 'start' | 'end';
}

/**
 * Cases over time — arrivals or completions.
 *
 * `countAt` matters more than it looks: counting at the start shows demand,
 * counting at the end shows delivery, and a backlog is precisely the gap
 * between the two. Reporting one as though it were the other hides the thing
 * most people are looking for.
 */
export async function throughput(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ThroughputOptions,
): Promise<TimeSeriesPoint[]> {
  const granularity = opts.granularity ?? 'day';
  const countAt = opts.countAt ?? 'start';

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const perCase = perCaseSql(log, dialect);
  const column = countAt === 'end' ? 'last_ts' : 'first_ts';

  const { rows } = await client.query(
    `SELECT DATE_TRUNC('${granularity}', ${column}) AS bucket,
            COUNT(*) AS cases,
            SUM(events) AS events,
            ${dialect.medianOf('cycle_s')} AS median_cycle
     FROM (${perCase}) c
     GROUP BY 1 ORDER BY 1`,
    params,
  );

  return rows
    .map((r) => {
      const at = asDate(r['bucket']);
      return at === null
        ? null
        : {
            at,
            cases: countOf(r['cases']),
            events: countOf(r['events']),
            medianCycleSeconds: numberOrNull(r['median_cycle']),
          };
    })
    .filter((p): p is TimeSeriesPoint => p !== null);
}

function clampBins(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_X_BINS;
  return Math.min(2000, Math.max(1, Math.trunc(n)));
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}
