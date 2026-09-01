import { countOf } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { eventOrderBy } from './eventlog.js';
import { buildLog, type LogQueryOptions } from './logquery.js';

/**
 * Animated replay — the ▶ button on a process map.
 *
 * The engine's job here is arithmetic, not animation. A browser can tween
 * tokens along an arc perfectly well; what it cannot do is hold 262,000 events
 * in memory and decide, sixty times a second, which of them are in flight.
 *
 * So the timeline is cut into frames in the database, and each frame reports
 * how many cases sat on each arc during it. What crosses into Node is bounded
 * by frames x arcs rather than by log size — the same reasoning that keeps the
 * dotted chart drawable.
 *
 * An event is placed on the arc it BEGINS, and occupies that arc until its
 * successor happens. That is what makes replay show waiting: a case sitting
 * for three days between two steps is visibly parked on one arc for three
 * days, rather than blinking at each end of it.
 */

export interface ReplayFrame {
  index: number;
  from: Date;
  to: Date;
  /** Arcs occupied during this frame, and by how many cases. */
  arcs: { from: string; to: string; cases: number }[];
  /** Cases that started somewhere in this frame. */
  started: number;
  /** Cases that finished. */
  finished: number;
  /** Cases in flight at the end of the frame — started, not yet finished. */
  inFlight: number;
}

export interface ReplayFeed {
  objectType: string;
  from: Date;
  to: Date;
  frames: ReplayFrame[];
  frameSeconds: number;
  /** Total cases in the selection, so a player can show progress honestly. */
  totalCases: number;
  /**
   * True when arcs were dropped from a frame because it held more distinct
   * arcs than the cap allows.
   *
   * Surfaced rather than swallowed: a replay quietly missing its rarest
   * transitions looks like a process that does not have them.
   */
  truncated: boolean;
}

export interface ReplayOptions extends LogQueryOptions {
  /** Frames to produce. Default 120 — about four seconds at 30fps. */
  frames?: number;
  /** Cap on arcs reported per frame, busiest first. Default 200. */
  maxArcsPerFrame?: number;
}

const DEFAULT_FRAMES = 120;
const DEFAULT_MAX_ARCS = 200;

export async function replayFeed(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ReplayOptions,
): Promise<ReplayFeed> {
  const frameCount = Math.max(1, Math.trunc(opts.frames ?? DEFAULT_FRAMES));
  const maxArcs = Math.max(1, Math.trunc(opts.maxArcsPerFrame ?? DEFAULT_MAX_ARCS));

  const boundsParams: unknown[] = [];
  const boundsLog = buildLog(dialect, boundsParams, opts).sql;
  const { rows: bounds } = await client.query(
    `SELECT MIN(ts) AS lo, MAX(ts) AS hi, COUNT(DISTINCT case_id) AS cases
     FROM (${boundsLog}) b`,
    boundsParams,
  );

  const lo = asDate(bounds[0]?.['lo']);
  const hi = asDate(bounds[0]?.['hi']);
  const totalCases = countOf(bounds[0]?.['cases']);
  if (lo === null || hi === null) {
    return {
      objectType: opts.objectType,
      from: new Date(0),
      to: new Date(0),
      frames: [],
      frameSeconds: 0,
      totalCases: 0,
      truncated: false,
    };
  }

  // A single-instant log would divide by zero. One second is arbitrary but
  // produces one sane frame rather than an error.
  const spanMs = Math.max(1000, hi.getTime() - lo.getTime());
  const frameMs = spanMs / frameCount;

  const params: unknown[] = [];
  const log = buildLog(dialect, params, opts).sql;
  const order = eventOrderBy('');

  // Each event, the arc it begins, and when that arc is vacated. The last
  // event of a case begins no arc and is dropped by the NOT NULL below.
  const spans = `
    SELECT case_id,
           activity AS from_activity,
           LEAD(activity) OVER (PARTITION BY case_id ORDER BY ${order}) AS to_activity,
           ts AS started_at,
           LEAD(ts) OVER (PARTITION BY case_id ORDER BY ${order}) AS ended_at
    FROM (${log}) p`;

  // Frame index bounds for each span, by arithmetic rather than a join against
  // a generated series: the series would multiply rows by frame count before
  // filtering, which is exactly the blow-up this endpoint exists to avoid.
  params.push(dialect.timestampParam(lo));
  const origin = dialect.timestampPlaceholder(params.length);

  const framed = `
    SELECT from_activity, to_activity,
           CAST(FLOOR(${elapsedMs(dialect, origin, 'started_at')} / ${frameMs}) AS BIGINT) AS first_frame,
           CAST(FLOOR(${elapsedMs(dialect, origin, 'ended_at')} / ${frameMs}) AS BIGINT) AS last_frame,
           case_id
    FROM (${spans}) s
    WHERE to_activity IS NOT NULL`;

  const { rows: arcRows } = await client.query(
    `SELECT f.first_frame, f.last_frame, f.from_activity, f.to_activity,
            COUNT(DISTINCT f.case_id) AS cases
     FROM (${framed}) f
     GROUP BY 1, 2, 3, 4`,
    params,
  );

  const boundaryParams: unknown[] = [];
  const boundaryLog = buildLog(dialect, boundaryParams, opts).sql;
  boundaryParams.push(dialect.timestampParam(lo));
  const boundaryOrigin = dialect.timestampPlaceholder(boundaryParams.length);
  const { rows: boundaryRows } = await client.query(
    `SELECT CAST(FLOOR(${elapsedMs(dialect, boundaryOrigin, 'MIN(ts)')} / ${frameMs}) AS BIGINT) AS start_frame,
            CAST(FLOOR(${elapsedMs(dialect, boundaryOrigin, 'MAX(ts)')} / ${frameMs}) AS BIGINT) AS end_frame,
            COUNT(*) AS n
     FROM (${boundaryLog}) c GROUP BY case_id`,
    boundaryParams,
  );

  const started = new Array<number>(frameCount).fill(0);
  const finished = new Array<number>(frameCount).fill(0);
  for (const row of boundaryRows) {
    const s = clamp(Number(row['start_frame']), frameCount);
    const e = clamp(Number(row['end_frame']), frameCount);
    started[s] = (started[s] ?? 0) + 1;
    finished[e] = (finished[e] ?? 0) + 1;
  }

  // Expand each arc-span across the frames it covers. This is the one place
  // the row count grows, and it grows against FRAMES rather than events.
  const perFrame: Map<string, { from: string; to: string; cases: number }>[] = Array.from(
    { length: frameCount },
    () => new Map(),
  );
  for (const row of arcRows) {
    const from = String(row['from_activity']);
    const to = String(row['to_activity']);
    const cases = countOf(row['cases']);
    const first = clamp(Number(row['first_frame']), frameCount);
    const last = clamp(Number(row['last_frame']), frameCount);
    for (let f = first; f <= last; f += 1) {
      const bucket = perFrame[f]!;
      const key = `${from}\u0000${to}`;
      const existing = bucket.get(key);
      if (existing === undefined) bucket.set(key, { from, to, cases });
      else existing.cases += cases;
    }
  }

  let truncated = false;
  let running = 0;
  const frames: ReplayFrame[] = perFrame.map((bucket, index) => {
    const all = [...bucket.values()].sort((a, b) => b.cases - a.cases);
    if (all.length > maxArcs) truncated = true;
    running += (started[index] ?? 0) - (finished[index] ?? 0);
    return {
      index,
      from: new Date(lo.getTime() + index * frameMs),
      to: new Date(lo.getTime() + (index + 1) * frameMs),
      arcs: all.slice(0, maxArcs),
      started: started[index] ?? 0,
      finished: finished[index] ?? 0,
      inFlight: running,
    };
  });

  return {
    objectType: opts.objectType,
    from: lo,
    to: hi,
    frames,
    frameSeconds: frameMs / 1000,
    totalCases,
    truncated,
  };
}

/**
 * Milliseconds since the log's first event.
 *
 * The origin is bound as a parameter rather than recomputed per query, so
 * every frame index in this feed is measured from the same instant. Two
 * queries each taking their own MIN(ts) would agree here and disagree the
 * moment a filter made one of them see a different first event.
 */
function elapsedMs(dialect: SqlDialect, origin: string, expr: string): string {
  return `(${dialect.durationSeconds(origin, expr)} * 1000.0)`;
}

function clamp(value: number, frames: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(frames - 1, Math.max(0, Math.trunc(value)));
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
