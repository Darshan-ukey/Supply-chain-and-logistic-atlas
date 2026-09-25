import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { binEdges } from './distribution.js';
import {
  CASE_CYCLE_SECONDS,
  buildLog,
  type LogQueryOptions,
} from './logquery.js';

/**
 * Queue discipline, and where slow is not the same as complicated.
 *
 * Two charts that answer questions no aggregate can. A median wait of two days
 * is the same number whether the queue is first-in-first-out, whether some work
 * overtakes the rest, or whether everything sits until a batch job runs on
 * Friday. Those are three different problems with three different fixes, and
 * only the shape of the individual passages tells them apart.
 */

export interface Passage {
  caseId: string;
  /** When the case left the first step. */
  from: Date;
  /** When it reached the second. */
  to: Date;
  /** Elapsed between them, on whichever clock the analysis uses. */
  seconds: number;
}

export interface PerformanceSpectrum {
  objectType: string;
  fromActivity: string;
  toActivity: string;
  /** One segment per case, ordered by when it started. */
  passages: Passage[];
  /** Passages found before any cap was applied. */
  totalPassages: number;
  /** True when `passages` holds fewer than `totalPassages`. */
  truncated: boolean;
  /**
   * What the shape says, in words.
   *
   * Parallel segments are first-in-first-out. Crossing segments mean later work
   * overtook earlier work. A vertical fan means a batch released everything at
   * once. The distinction is the whole point of the chart, and it is worth
   * stating rather than leaving to be read off.
   */
  reading: string;
  /** Share of passages where a later start finished first, 0-1. */
  overtakingRate: number;
}

export interface SpectrumOptions extends LogQueryOptions {
  /** The step work leaves. */
  fromActivity: string;
  /** The step it arrives at. */
  toActivity: string;
  /** Cap on segments returned. Default 2000. */
  limit?: number | undefined;
}

const DEFAULT_PASSAGE_LIMIT = 2000;

/**
 * Every case's passage between two steps.
 *
 * Consecutive passages only: the pair must be adjacent in the trace, so this
 * measures a real handover rather than "eventually reached", which would draw a
 * segment across every intervening step and mean nothing.
 */
export async function performanceSpectrum(
  client: SqlClient,
  dialect: SqlDialect,
  opts: SpectrumOptions,
): Promise<PerformanceSpectrum> {
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_PASSAGE_LIMIT));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  params.push(opts.fromActivity);
  const fromHole = dialect.placeholder(params.length);
  params.push(opts.toActivity);
  const toHole = dialect.placeholder(params.length);

  const stepped = `SELECT case_id, activity, ts, business_s,
                          LEAD(activity)   OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS next_activity,
                          LEAD(ts)         OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS next_ts,
                          LEAD(business_s) OVER (PARTITION BY case_id ORDER BY ${ORDER}) AS next_business_s
                   FROM (${log}) p`;

  const matched = `SELECT case_id, ts AS from_ts, next_ts AS to_ts,
                          (next_business_s - business_s) AS seconds
                   FROM (${stepped}) s
                   WHERE activity = ${fromHole} AND next_activity = ${toHole}`;

  const [{ rows }, { rows: totals }] = await Promise.all([
    client.query(
      `SELECT * FROM (${matched}) m ORDER BY from_ts ASC, case_id ASC LIMIT ${limit}`,
      params,
    ),
    client.query(`SELECT COUNT(*) AS n FROM (${matched}) c`, params),
  ]);

  const passages: Passage[] = [];
  for (const row of rows) {
    const from = asDate(row['from_ts']);
    const to = asDate(row['to_ts']);
    if (from === null || to === null) continue;
    passages.push({
      caseId: String(row['case_id']),
      from,
      to,
      seconds: numberOrNull(row['seconds']) ?? 0,
    });
  }

  const totalPassages = countOf(totals[0]?.['n']);
  const overtaking = overtakingRate(passages);

  return {
    objectType: opts.objectType,
    fromActivity: opts.fromActivity,
    toActivity: opts.toActivity,
    passages,
    totalPassages,
    truncated: passages.length < totalPassages,
    reading: readSpectrum(passages, overtaking),
    overtakingRate: overtaking,
  };
}

const ORDER = `ts, event_id`;

/**
 * Share of passages a later-starting case finished ahead of.
 *
 * Counted against the running latest finish rather than pairwise: pairwise is
 * quadratic and a spectrum can hold thousands of segments. Walking in start
 * order and remembering the latest finish so far gives the same answer to the
 * question being asked — "did this one jump the queue" — in one pass.
 */
function overtakingRate(passages: readonly Passage[]): number {
  if (passages.length < 2) return 0;

  let overtaken = 0;
  let latestFinish = passages[0]!.to.getTime();
  for (let i = 1; i < passages.length; i += 1) {
    const finish = passages[i]!.to.getTime();
    if (finish < latestFinish) overtaken += 1;
    else latestFinish = finish;
  }
  return overtaken / (passages.length - 1);
}

/** Distinct arrival instants below this share means work is being released in batches. */
const BATCH_THRESHOLD = 0.34;
const FIFO_THRESHOLD = 0.05;

function readSpectrum(passages: readonly Passage[], overtaking: number): string {
  if (passages.length < 2) return 'too few passages to read a pattern';

  // A batch shows as many segments landing on the same instant, which is a
  // vertical fan on the chart and a small number of distinct arrivals here.
  const arrivals = new Set(passages.map((p) => p.to.getTime())).size;
  if (arrivals / passages.length < BATCH_THRESHOLD) {
    return `work arrives in batches — ${passages.length} passages land on only ${arrivals} distinct moments, so the wait is until the next run rather than until somebody is free`;
  }
  if (overtaking < FIFO_THRESHOLD) {
    return 'first in, first out — the queue is being worked in order';
  }
  return `${Math.round(overtaking * 100)}% of work is overtaken by something that started later — the queue is not being worked in order`;
}

// ---------------------------------------------------------------------------

export interface HexCell {
  /** Bin index along trace length. */
  x: number;
  /** Bin index along cycle time. */
  y: number;
  cases: number;
  /** Bounds of the cell, in the units of the axes. */
  fromLength: number;
  toLength: number;
  fromSeconds: number;
  toSeconds: number;
}

export interface ComplexityScatter {
  objectType: string;
  cells: HexCell[];
  totalCases: number;
  /** True when the time axis grows geometrically. */
  logarithmic: boolean;
  /**
   * Cases that are slow WITHOUT being complex — few steps, long elapsed.
   *
   * The interesting quadrant, and the reason the chart is two-dimensional. A
   * case with forty steps taking three weeks is working; a case with three
   * steps taking three weeks is waiting, and only the second is a queue.
   */
  slowAndSimple: { caseId: string; events: number; seconds: number }[];
}

export interface ComplexityOptions extends LogQueryOptions {
  /** Bins along each axis. Default 24. */
  bins?: number | undefined;
  /** Cases listed in the slow-and-simple corner. Default 20. */
  limit?: number | undefined;
}

const DEFAULT_HEX_BINS = 24;
const DEFAULT_CORNER = 20;

/**
 * Cycle time against trace length.
 *
 * Binned in the database for the reason the dotted chart is: a real log holds
 * more cases than SVG can draw, and a fixed grid crosses the wire whatever the
 * log size.
 */
export async function complexityScatter(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ComplexityOptions,
): Promise<ComplexityScatter> {
  const bins = Math.min(100, Math.max(2, Math.trunc(opts.bins ?? DEFAULT_HEX_BINS)));
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_CORNER));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const perCase = `SELECT case_id, COUNT(*) AS events, ${CASE_CYCLE_SECONDS} AS seconds
                   FROM (${log}) c GROUP BY case_id`;

  const { rows: bounds } = await client.query(
    `SELECT MIN(events) AS lo_len, MAX(events) AS hi_len,
            MIN(seconds) AS lo_s, MAX(seconds) AS hi_s, COUNT(*) AS n
     FROM (${perCase}) b`,
    params,
  );

  const totalCases = countOf(bounds[0]?.['n']);
  if (totalCases === 0) {
    return {
      objectType: opts.objectType,
      cells: [],
      totalCases: 0,
      logarithmic: true,
      slowAndSimple: [],
    };
  }

  const loLength = countOf(bounds[0]?.['lo_len']);
  const hiLength = countOf(bounds[0]?.['hi_len']);
  const loSeconds = numberOrNull(bounds[0]?.['lo_s']) ?? 0;
  const hiSeconds = numberOrNull(bounds[0]?.['hi_s']) ?? 0;

  // Trace length is a small count and reads correctly on a linear axis; cycle
  // time spans minutes to months and does not.
  const lengthEdges = binEdges(loLength, hiLength, bins, false);
  const timeEdges = binEdges(loSeconds, hiSeconds, bins, true);

  const { rows } = await client.query(
    `SELECT case_id, events, seconds FROM (${perCase}) s`,
    params,
  );

  const tally = new Map<string, number>();
  const cases: { caseId: string; events: number; seconds: number }[] = [];
  for (const row of rows) {
    const events = countOf(row['events']);
    const seconds = numberOrNull(row['seconds']) ?? 0;
    const x = bucketOf(events, lengthEdges);
    const y = bucketOf(seconds, timeEdges);
    tally.set(`${x}:${y}`, (tally.get(`${x}:${y}`) ?? 0) + 1);
    cases.push({ caseId: String(row['case_id']), events, seconds });
  }

  const cells: HexCell[] = [...tally.entries()].map(([key, count]) => {
    const [x, y] = key.split(':').map(Number) as [number, number];
    return {
      x,
      y,
      cases: count,
      fromLength: lengthEdges[x]!,
      toLength: lengthEdges[x + 1]!,
      fromSeconds: timeEdges[y]!,
      toSeconds: timeEdges[y + 1]!,
    };
  });

  // Slow and simple: in the slowest quarter by time, and the shortest half by
  // length. Ranked by how far the two disagree, so the clearest examples lead.
  const slowFrom = quantile(cases.map((c) => c.seconds), 0.75);
  const shortTo = quantile(cases.map((c) => c.events), 0.5);
  const slowAndSimple = cases
    .filter((c) => c.seconds >= slowFrom && c.events <= shortTo)
    .sort((a, b) => b.seconds / Math.max(1, b.events) - a.seconds / Math.max(1, a.events))
    .slice(0, limit);

  return {
    objectType: opts.objectType,
    cells: cells.sort((a, b) => a.x - b.x || a.y - b.y),
    totalCases,
    logarithmic: true,
    slowAndSimple,
  };
}

/** Nearest-rank quantile over an unsorted list. */
function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[at]!;
}

function bucketOf(value: number, edges: readonly number[]): number {
  for (let i = 1; i < edges.length; i += 1) {
    if (value < edges[i]!) return i - 1;
  }
  return edges.length - 2;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}
