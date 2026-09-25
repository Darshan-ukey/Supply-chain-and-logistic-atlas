import type { SqlDialect } from '../sql/dialect.js';
import {
  eventLogTables,
  projectedLogSql,
  type EventLogTables,
  type LogCapabilities,
  type Perspective,
} from './eventlog.js';
import { caseFilterPredicate, type CaseFilter } from './filter.js';
import { businessElapsedExpr, type BusinessCalendar } from './calendar.js';

/**
 * One definition of "the log this analysis is looking at".
 *
 * Every analysis previously repeated its own window and lifecycle handling,
 * which is exactly the kind of duplication that lets two reports over the same
 * selection quietly disagree. Building the log through here means discovery,
 * performance, variants, resources, conformance and root cause are all looking
 * at precisely the same set of events — which is the whole premise of
 * interactive exploration, where a click is expected to move every panel
 * together.
 */

export interface LogQueryOptions {
  objectType: string;
  schema?: string | undefined;
  /**
   * Restrict to EVENTS in this window. Trims traces at the edges.
   *
   * Either bound may be omitted. A `to` on its own expresses "as of this
   * instant", which is what any evaluation of the present must use: deciding
   * what is at risk now from events that happen later is the classic leak of
   * future information into a prediction, and it makes the result look far
   * better than it is.
   */
  window?: { from?: Date | undefined; to?: Date | undefined } | undefined;
  /** Keep only these lifecycle transitions, compared case-insensitively. */
  lifecycle?: readonly string[] | undefined;
  /** Restrict to whole CASES matching this selection. */
  filter?: CaseFilter | undefined;
  /**
   * What goes in the boxes: the step, the person, or any event attribute.
   *
   * Re-projects the SAME materialised events onto a different notion of
   * "activity", which is what makes "show me this process as a picture of
   * people" a query rather than a second extraction.
   */
  perspective?: Perspective | undefined;
  /**
   * What the store supports. Probe once per client with `detectCapabilities`.
   *
   * Omitting it is safe: anything the store may not have is projected as a
   * typed NULL, which is what an older store honestly contains. Assuming the
   * column is present instead would break every store written before it
   * existed — and read paths open read-only, so they cannot migrate it away.
   */
  capabilities?: LogCapabilities | undefined;
  /**
   * Measure durations in working time rather than wall-clock time.
   *
   * Off by default, and deliberately so: it changes figures the product already
   * reports, and a bottleneck ranking that re-orders itself without being asked
   * is not an improvement. With no calendar every duration is the wall-clock
   * difference it has always been.
   */
  calendar?: BusinessCalendar | undefined;
}

export interface BuiltLog {
  /** A SELECT producing case_id, activity, ts, lifecycle, resource, duration_s, event_id. */
  sql: string;
  tables: EventLogTables;
}

/**
 * Build the filtered event log.
 *
 * Order matters and is deliberate:
 *
 *  1. project the chosen object type into a flat case-centric log;
 *  2. apply the CASE filter, which keeps or drops whole traces;
 *  3. apply the EVENT window and lifecycle, which trim within a trace.
 *
 * Doing the case filter first is what makes "show me cases that reach Approve"
 * return their complete traces rather than only their Approve events.
 */
export function buildLog(
  dialect: SqlDialect,
  params: unknown[],
  opts: LogQueryOptions,
): BuiltLog {
  const tables = eventLogTables(dialect, opts.schema);
  let sql = projectedLogSql(
    tables,
    opts.objectType,
    params,
    dialect,
    opts.perspective,
    opts.capabilities,
  );

  if (opts.filter !== undefined) {
    const predicate = caseFilterPredicate(
      opts.filter,
      tables,
      dialect,
      params,
      opts.objectType,
      'f.case_id',
      // Sequence-aware filters must reason over the same events the analysis
      // will go on to see, or a variant click matches a sequence nobody saw.
      { lifecycle: opts.lifecycle, perspective: opts.perspective, calendar: opts.calendar },
    );
    sql = `SELECT * FROM (${sql}) f WHERE ${predicate}`;
  }

  const eventPredicates: string[] = [];
  if (opts.window?.from !== undefined) {
    params.push(dialect.timestampParam(opts.window.from));
    eventPredicates.push(`w.ts >= ${dialect.timestampPlaceholder(params.length)}`);
  }
  if (opts.window?.to !== undefined) {
    params.push(dialect.timestampParam(opts.window.to));
    eventPredicates.push(`w.ts < ${dialect.timestampPlaceholder(params.length)}`);
  }
  if (opts.lifecycle !== undefined && opts.lifecycle.length > 0) {
    const holes = opts.lifecycle.map((value) => {
      params.push(value.toLowerCase());
      return dialect.placeholder(params.length);
    });
    eventPredicates.push(`lower(COALESCE(w.lifecycle, '')) IN (${holes.join(', ')})`);
  }
  if (eventPredicates.length > 0) {
    sql = `SELECT * FROM (${sql}) w WHERE ${eventPredicates.join(' AND ')}`;
  }

  // One clock for the whole log, projected once per event. Every duration
  // downstream is a difference of two of these, so no analysis can measure on a
  // different clock from the one beside it — and with no calendar the value is
  // the epoch second, which makes those differences exactly what they were.
  const clock =
    opts.calendar === undefined
      ? dialect.epochSeconds('ts')
      : businessElapsedExpr(dialect, 'ts', opts.calendar, params);
  sql = `SELECT c.*, ${clock} AS business_s FROM (${sql}) c`;

  return { sql, tables };
}

/**
 * Canonical event ordering within a case.
 *
 * Shared rather than repeated: timestamp ties are routine, lifecycle breaks
 * them, and the comparison is case-insensitive because real logs ship
 * SCHEDULE/START/COMPLETE in capitals despite the XES spec. Two analyses
 * ordering events differently would put the same case in two different orders.
 */
export const EVENT_ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0
    WHEN 'assign'   THEN 1
    WHEN 'start'    THEN 2
    WHEN ''         THEN 3
    WHEN 'complete' THEN 4
    ELSE 5 END, event_id`;

/**
 * Seconds a case sat idle before an event, as a SQL expression.
 *
 * Measured from the END of the previous event to the START of this one, so it
 * is genuinely idle time rather than the gap between two start stamps — which
 * would silently count the previous activity's own work as waiting.
 *
 * Shared rather than repeated. Performance ranks bottlenecks by it and the case
 * timeline shows it step by step; two spellings of "waiting" would let a
 * bottleneck ranking and the case that supposedly demonstrates it disagree.
 *
 * Expects the columns `previousStepLags` produces, over a log ordered by
 * `EVENT_ORDER`. Null for the first event of a case: nothing preceded it, which
 * is not the same claim as a wait of zero.
 *
 * The dialect is no longer read — the arithmetic is now a subtraction of two
 * numbers rather than of two timestamps — but stays in the signature because
 * this is exported, and the parameter costs a caller nothing.
 */
export function waitingSecondsExpr(_dialect: SqlDialect): string {
  // Recorded handling time is work, so it advances the clock directly rather
  // than being added to a timestamp and re-measured.
  const previousEnd = `(prev_business_s + COALESCE(prev_duration, 0))`;
  // A negative gap means overlapping work, not negative waiting: clamp at zero
  // rather than letting it subtract from someone else's delay.
  const gap = clockGap(previousEnd, 'business_s');
  return `CASE WHEN prev_business_s IS NULL THEN NULL ELSE ${gap} END`;
}

/** The LAG columns `waitingSecondsExpr` reads. Select these alongside it. */
export const PREVIOUS_STEP_LAGS = `LAG(activity)    OVER (PARTITION BY case_id ORDER BY ${EVENT_ORDER}) AS prev_activity,
           LAG(business_s)  OVER (PARTITION BY case_id ORDER BY ${EVENT_ORDER}) AS prev_business_s,
           LAG(duration_s)  OVER (PARTITION BY case_id ORDER BY ${EVENT_ORDER}) AS prev_duration`;

/**
 * Elapsed time across a case, as a SQL expression over a grouped log.
 *
 * A difference of two clock readings rather than a timestamp subtraction, which
 * is what makes a configured calendar reach every cycle time at once. With no
 * calendar the clock holds epoch seconds and this is the wall-clock span it
 * always was.
 *
 * Valid wherever the log is grouped by case; select it beside `GROUP BY case_id`.
 */
export const CASE_CYCLE_SECONDS = '(MAX(business_s) - MIN(business_s))';

/**
 * Working seconds between two clock readings, as a SQL expression.
 *
 * Clamped at zero for the same reason `businessSecondsBetween` is: a negative
 * gap means two events overlap or arrived out of order, not that time ran
 * backwards. Pass the columns, not timestamps — `business_s`, a `LAG` of it, or
 * a `LEAD`.
 *
 * Only for a gap that can genuinely go negative, which in practice means one
 * measured from a recorded end time: the clock never runs backwards, so an
 * ordered pair of readings cannot. That distinction matters because GREATEST
 * IGNORES NULLS in both dialects — `GREATEST(NULL - x, 0)` is 0, not null — so
 * clamping a gap whose far end may be missing reports a wait of zero where
 * there was no second event at all. Guard the null first, as
 * `waitingSecondsExpr` does, or subtract plainly and let the null travel.
 */
export function clockGap(from: string, to: string): string {
  return `GREATEST((${to}) - (${from}), 0)`;
}

/**
 * Per-case summary: duration and event count, from an already-built log.
 *
 * The dialect is unread for the same reason it is in `waitingSecondsExpr`.
 */
export function perCaseSql(logSql: string, _dialect: SqlDialect): string {
  return `SELECT case_id,
                 ${CASE_CYCLE_SECONDS} AS cycle_s,
                 COUNT(*) AS events,
                 MIN(ts) AS first_ts,
                 MAX(ts) AS last_ts,
                 MAX(business_s) AS last_business_s
          FROM (${logSql}) c GROUP BY case_id`;
}
