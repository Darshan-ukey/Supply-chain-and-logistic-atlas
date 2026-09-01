import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { hourExpr, weekdayExpr } from './calendar.js';
import {
  PREVIOUS_STEP_LAGS,
  buildLog,
  waitingSecondsExpr,
  type LogQueryOptions,
} from './logquery.js';

/**
 * When work happens, rather than how long it takes.
 *
 * Every other performance view in this engine collapses time away: a median, a
 * total, a rank. That answers "which step is slow" and cannot answer "slow at
 * four in the afternoon, every Thursday". A queue that forms at nine and clears
 * by eleven has the same median as one that never clears, and only one of them
 * is a staffing problem.
 *
 * Three grids, all cheap — each is one GROUP BY over parts of a timestamp.
 *
 * **Local time, not UTC.** A shift pattern is a local-clock fact. Bucketing a
 * London log by UTC hour is right in winter and an hour out all summer, which
 * shifts the morning peak into the wrong bucket for half the year and looks
 * like nothing at all. The zone is required for the same reason it is required
 * on a working calendar.
 *
 * **Dense, not sparse.** A weekday-by-hour grid is 168 cells whatever the log
 * holds, so every cell is returned even when it is empty. A missing cell and a
 * zero cell mean different things to a reader — "nobody worked then" is a
 * finding — and a sparse response makes the caller guess which it had.
 */

export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;

/** What a cell counts. */
export type SeasonMeasure =
  /** Every event in the log. "When is work being done." */
  | 'events'
  /** The first event of each case. "When does work arrive." */
  | 'starts'
  /** The last event of each case. "When does work finish." */
  | 'ends';

export interface SeasonCell {
  /** 0 = Monday, matching `BusinessCalendar.workingDays`. */
  weekday: number;
  /** 0-23, local. */
  hour: number;
  /** Events falling in this cell under the chosen measure. */
  events: number;
  /** Distinct cases touching this cell. */
  cases: number;
  /**
   * Median idle time before the events in this cell.
   *
   * Null when nothing landed here, and null on 'starts' — nothing precedes a
   * case's first event, so there is no wait to report and zero would be a
   * claim rather than an absence.
   */
  medianWaitSeconds: number | null;
}

export interface SeasonGrid {
  objectType: string;
  /** The zone the buckets are in. Stated because the grid is meaningless without it. */
  timezone: string;
  measure: SeasonMeasure;
  /** Always 168 cells, Monday 00:00 first, row-major by weekday then hour. */
  cells: SeasonCell[];
  /** Total events placed. Zero means the log is empty, not that the grid failed. */
  total: number;
  /** Busiest cell, or null when nothing landed anywhere. */
  peak: SeasonCell | null;
}

export interface SeasonalityOptions extends LogQueryOptions {
  /** IANA zone the buckets are cut in. Defaults to the calendar's, else UTC. */
  timezone?: string | undefined;
  measure?: SeasonMeasure | undefined;
}

/** The zone to bucket in: explicit, else the working calendar's, else UTC. */
function zoneOf(opts: SeasonalityOptions): string {
  return opts.timezone ?? opts.calendar?.timezone ?? 'UTC';
}

/**
 * Events by weekday and hour of day.
 *
 * The first chart to reach for on an unfamiliar log: a shift pattern, a batch
 * job, a Monday spike or a dead weekend all appear without being looked for.
 */
export async function seasonality(
  client: SqlClient,
  dialect: SqlDialect,
  opts: SeasonalityOptions,
): Promise<SeasonGrid> {
  const measure = opts.measure ?? 'events';
  const timezone = zoneOf(opts);

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  params.push(timezone);
  const zone = dialect.placeholder(params.length);
  const local = dialect.localTimestamp('ts', zone);

  // Waiting needs the previous step, so the lags are always projected; on
  // 'starts' the value is discarded rather than the query being rebuilt.
  const stepped = `SELECT case_id, ts, business_s,
                          ${PREVIOUS_STEP_LAGS}
                   FROM (${log}) p`;
  const waiting = waitingSecondsExpr(dialect);

  const scoped = pickEvents(stepped, measure, waiting);

  const { rows } = await client.query(
    `SELECT ${weekdayExpr(dialect, local)} AS weekday,
            ${hourExpr(dialect, local)} AS hour,
            COUNT(*) AS events,
            COUNT(DISTINCT case_id) AS cases,
            ${dialect.medianOf('waiting_s')} AS median_wait
     FROM (${scoped}) s
     GROUP BY 1, 2`,
    params,
  );

  const placed = new Map<number, SeasonCell>();
  for (const row of rows) {
    const weekday = countOf(row['weekday']);
    const hour = countOf(row['hour']);
    placed.set(weekday * HOURS_PER_DAY + hour, {
      weekday,
      hour,
      events: countOf(row['events']),
      cases: countOf(row['cases']),
      medianWaitSeconds: measure === 'starts' ? null : numberOrNull(row['median_wait']),
    });
  }

  const cells = fullGrid(placed);
  const total = cells.reduce((n, c) => n + c.events, 0);
  const peak = total === 0
    ? null
    : cells.reduce((best, c) => (c.events > best.events ? c : best), cells[0]!);

  return { objectType: opts.objectType, timezone, measure, cells, total, peak };
}

/** Restrict a stepped log to the events the measure counts. */
function pickEvents(stepped: string, measure: SeasonMeasure, waiting: string): string {
  const projected = `SELECT case_id, ts, ${waiting} AS waiting_s FROM (${stepped}) w`;
  if (measure === 'events') return projected;

  // First or last event per case, by timestamp. Ranked rather than joined to a
  // MIN/MAX so a case with two events at the same instant contributes one row
  // and not two.
  const rank = measure === 'starts' ? 'ASC' : 'DESC';
  return `SELECT case_id, ts, waiting_s FROM (
            SELECT case_id, ts, waiting_s,
                   ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY ts ${rank}) AS rn
            FROM (${projected}) e
          ) r WHERE rn = 1`;
}

/** Every weekday-hour pair, empty cells included. */
function fullGrid(placed: Map<number, SeasonCell>): SeasonCell[] {
  const cells: SeasonCell[] = [];
  for (let weekday = 0; weekday < DAYS_PER_WEEK; weekday += 1) {
    for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
      cells.push(
        placed.get(weekday * HOURS_PER_DAY + hour) ?? {
          weekday,
          hour,
          events: 0,
          cases: 0,
          medianWaitSeconds: null,
        },
      );
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------

export interface QueueHour {
  /** 0-23, local. */
  hour: number;
  /** Events that began waiting in this hour. */
  events: number;
  medianWaitSeconds: number | null;
  p90WaitSeconds: number | null;
  /** Summed idle time accruing to this hour — what ranks the worst hour. */
  totalWaitSeconds: number;
}

export interface QueueCurve {
  objectType: string;
  timezone: string;
  /** Always 24 entries, midnight first. */
  hours: QueueHour[];
  /** Hour carrying the most total waiting, or null when nothing waited. */
  worst: QueueHour | null;
}

/**
 * Waiting time by hour of day.
 *
 * Read with a roster beside it, this is the shift-planning chart: a queue that
 * builds from four and never clears is a capacity problem, and one that builds
 * at nine and is gone by eleven is a start-of-day batching problem. They look
 * identical in a daily median.
 *
 * Ranked by TOTAL rather than median wait, for the reason the bottleneck
 * ranking is: an hour that delays two thousand cases by ten minutes costs more
 * than one that delays three by an afternoon.
 */
export async function queueFormation(
  client: SqlClient,
  dialect: SqlDialect,
  opts: SeasonalityOptions,
): Promise<QueueCurve> {
  const timezone = zoneOf(opts);

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  params.push(timezone);
  const zone = dialect.placeholder(params.length);
  const local = dialect.localTimestamp('ts', zone);

  const stepped = `SELECT case_id, ts, business_s, ${PREVIOUS_STEP_LAGS} FROM (${log}) p`;
  const waiting = waitingSecondsExpr(dialect);

  const { rows } = await client.query(
    `SELECT ${hourExpr(dialect, local)} AS hour,
            COUNT(*) AS events,
            ${dialect.medianOf('waiting_s')} AS median_wait,
            ${dialect.quantileOf('waiting_s', 0.9)} AS p90_wait,
            COALESCE(SUM(waiting_s), 0) AS total_wait
     FROM (SELECT ts, ${waiting} AS waiting_s FROM (${stepped}) w) s
     WHERE waiting_s IS NOT NULL
     GROUP BY 1`,
    params,
  );

  const placed = new Map<number, QueueHour>();
  for (const row of rows) {
    const hour = countOf(row['hour']);
    placed.set(hour, {
      hour,
      events: countOf(row['events']),
      medianWaitSeconds: numberOrNull(row['median_wait']),
      p90WaitSeconds: numberOrNull(row['p90_wait']),
      totalWaitSeconds: numberOrNull(row['total_wait']) ?? 0,
    });
  }

  const hours = Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
    placed.get(hour) ?? {
      hour,
      events: 0,
      medianWaitSeconds: null,
      p90WaitSeconds: null,
      totalWaitSeconds: 0,
    },
  );

  const busiest = hours.reduce((best, h) => (h.totalWaitSeconds > best.totalWaitSeconds ? h : best), hours[0]!);
  return {
    objectType: opts.objectType,
    timezone,
    hours,
    worst: busiest.totalWaitSeconds > 0 ? busiest : null,
  };
}

// ---------------------------------------------------------------------------

export interface RosterCell {
  resource: string;
  weekday: number;
  hour: number;
  events: number;
}

export interface Roster {
  objectType: string;
  timezone: string;
  /** People, busiest first. */
  resources: { resource: string; events: number }[];
  /** Sparse: only the hours somebody actually worked. */
  cells: RosterCell[];
}

export interface RosterOptions extends SeasonalityOptions {
  /** Cap on people returned, busiest first. Default 40. */
  limit?: number | undefined;
}

const DEFAULT_ROSTER_LIMIT = 40;

/**
 * Who works which hours.
 *
 * Laid over the queue curve this explains most overnight waiting: work arriving
 * at eight in the evening into a team that finished at six is not a slow team.
 *
 * Sparse here, unlike the seasonality grid, because the grid is people x 168
 * and most of it is genuinely empty. An absent cell means that person recorded
 * nothing in that hour.
 */
export async function roster(
  client: SqlClient,
  dialect: SqlDialect,
  opts: RosterOptions,
): Promise<Roster> {
  const timezone = zoneOf(opts);
  const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_ROSTER_LIMIT));

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  params.push(timezone);
  const zone = dialect.placeholder(params.length);
  const local = dialect.localTimestamp('ts', zone);

  // Unattributed events are dropped rather than bucketed under a placeholder
  // name: a roster is a statement about named people.
  const attributed = `SELECT resource, ts FROM (${log}) r WHERE resource IS NOT NULL`;

  const { rows } = await client.query(
    `SELECT resource,
            ${weekdayExpr(dialect, local)} AS weekday,
            ${hourExpr(dialect, local)} AS hour,
            COUNT(*) AS events
     FROM (${attributed}) a
     GROUP BY 1, 2, 3`,
    params,
  );

  const cells = rows.map((row) => ({
    resource: String(row['resource']),
    weekday: countOf(row['weekday']),
    hour: countOf(row['hour']),
    events: countOf(row['events']),
  }));

  const totals = new Map<string, number>();
  for (const cell of cells) {
    totals.set(cell.resource, (totals.get(cell.resource) ?? 0) + cell.events);
  }
  const resources = [...totals.entries()]
    .map(([resource, events]) => ({ resource, events }))
    .sort((a, b) => b.events - a.events || a.resource.localeCompare(b.resource))
    .slice(0, limit);

  const kept = new Set(resources.map((r) => r.resource));
  return {
    objectType: opts.objectType,
    timezone,
    resources,
    cells: cells.filter((c) => kept.has(c.resource)),
  };
}

// ---------------------------------------------------------------------------

export interface DayVolume {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** 0 = Monday, so a caller can lay the year out in week columns. */
  weekday: number;
  events: number;
  cases: number;
}

export interface CalendarVolume {
  objectType: string;
  timezone: string;
  measure: SeasonMeasure;
  /** Contiguous — every date between the first and last, quiet days included. */
  days: DayVolume[];
  total: number;
  /** Days inside the range on which nothing at all happened. */
  silentDays: number;
  busiest: DayVolume | null;
}

/** A decade of days, which is far more than any calendar view renders. */
export const MAX_CALENDAR_DAYS = 4000;

/**
 * A year of days, one cell each.
 *
 * Month-ends, holiday shutdowns, change freezes and outages appear without
 * anybody looking for them, which is the argument for the view: it is the one
 * chart where a reader finds something they did not think to ask about.
 *
 * Contiguous, and the quiet days counted. A gap closed up reads as continuous
 * work, and "the system was down for four days in March" is exactly the kind of
 * thing that explains an otherwise baffling cycle-time spike.
 */
export async function calendarVolume(
  client: SqlClient,
  dialect: SqlDialect,
  opts: SeasonalityOptions,
): Promise<CalendarVolume> {
  const measure = opts.measure ?? 'events';
  const timezone = zoneOf(opts);

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);

  params.push(timezone);
  const zone = dialect.placeholder(params.length);
  const local = dialect.localTimestamp('ts', zone);

  const scoped =
    measure === 'events'
      ? `SELECT case_id, ts FROM (${log}) e`
      : `SELECT case_id, ts FROM (
           SELECT case_id, ts,
                  ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY ts ${measure === 'starts' ? 'ASC' : 'DESC'}) AS rn
           FROM (${log}) o
         ) r WHERE rn = 1`;

  const { rows } = await client.query(
    `SELECT ${dialect.dateOf(local)} AS day,
            ${weekdayExpr(dialect, local)} AS weekday,
            COUNT(*) AS events,
            COUNT(DISTINCT case_id) AS cases
     FROM (${scoped}) s GROUP BY 1, 2 ORDER BY 1`,
    params,
  );

  const observed = rows.map((row) => ({
    date: asDateText(row['day']),
    weekday: countOf(row['weekday']),
    events: countOf(row['events']),
    cases: countOf(row['cases']),
  }));

  if (observed.length === 0) {
    return {
      objectType: opts.objectType,
      timezone,
      measure,
      days: [],
      total: 0,
      silentDays: 0,
      busiest: null,
    };
  }

  const byDate = new Map(observed.map((d) => [d.date, d]));
  const days: DayVolume[] = [];
  const first = observed[0]!.date;
  const last = observed[observed.length - 1]!.date;

  let cursor = Date.parse(`${first}T00:00:00Z`);
  const end = Date.parse(`${last}T00:00:00Z`);
  while (cursor <= end && days.length < MAX_CALENDAR_DAYS) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    days.push(
      byDate.get(date) ?? {
        date,
        // Derived rather than looked up, so a silent day still sits in the
        // right column of the calendar.
        weekday: weekdayOfDate(date),
        events: 0,
        cases: 0,
      },
    );
    cursor += 86_400_000;
  }

  const total = days.reduce((n, d) => n + d.events, 0);
  return {
    objectType: opts.objectType,
    timezone,
    measure,
    days,
    total,
    silentDays: days.filter((d) => d.events === 0).length,
    busiest:
      total === 0 ? null : days.reduce((best, d) => (d.events > best.events ? d : best), days[0]!),
  };
}

/** Weekday of a YYYY-MM-DD, 0 = Monday, matching `weekdayExpr`. */
function weekdayOfDate(date: string): number {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  // 1970-01-05 was a Monday; the same origin the working calendar uses.
  return (((days - 4) % 7) + 7) % 7;
}

/** A DATE comes back as a Date from one driver and as text from another. */
function asDateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
