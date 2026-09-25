import { ConfigInvalidError } from '../domain/errors.js';
import { countOf, instantMsOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { eventOrderBy } from './eventlog.js';
import {
  CASE_CYCLE_SECONDS,
  PREVIOUS_STEP_LAGS,
  buildLog,
  waitingSecondsExpr,
  type LogQueryOptions,
} from './logquery.js';

/**
 * The cases themselves.
 *
 * Every other analysis in this engine stops at the aggregate. That is the right
 * place for a finding to be measured and the wrong place for it to end: a
 * ranked bottleneck, a slow variant and a rework rate are all statements about
 * a population, and the first question anyone asks of a population statement is
 * "show me one".
 *
 * It answers two other things worth having. A mapping mistake is far easier to
 * see in one trace than in a distribution — a case whose steps run in an order
 * nobody recognises usually means the case key identifies rows rather than
 * business items, which is exactly what the profiler warns about in words. And
 * a finding that can be traced to a real booking is believed; the same finding
 * as a percentage is argued with.
 *
 * Both queries are ordinary aggregates over the same filtered log every other
 * analysis reads, so a case list and the chart it was opened from always
 * describe the same population.
 */

/** What the list is ordered by. All are per-case aggregates. */
export type CaseSort = 'start' | 'end' | 'duration' | 'events' | 'cost';

export type SortDirection = 'asc' | 'desc';

export interface CaseRow {
  caseId: string;
  firstEvent: Date;
  lastEvent: Date;
  /** First event to last event. Zero for a single-event case, never null. */
  cycleSeconds: number;
  events: number;
  /** Distinct activities — a crude but useful measure of how involved it was. */
  activities: number;
  /** Distinct people. Zero when the log records none for this case. */
  resources: number;
  /** Summed cost, where the log records it. Null when it does not. */
  cost: number | null;
  /** Summed recorded handling time. Null when the source records none. */
  handlingSeconds: number | null;
}

export interface CasePage {
  objectType: string;
  cases: CaseRow[];
  /** Cases matching the selection, before paging. */
  total: number;
  /** Pass back as `cursor` for the next page. Null when this is the last. */
  nextCursor: string | null;
  sortedBy: CaseSort;
  direction: SortDirection;
}

export interface CaseListOptions extends LogQueryOptions {
  /** Default 'duration'. */
  sort?: CaseSort;
  /** Default 'desc'. */
  direction?: SortDirection;
  /** Page size. Default 50, capped at 500. */
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string | undefined;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/** Per-case aggregate column each sort key reads. */
const SORT_COLUMN: Record<CaseSort, string> = {
  start: 'first_ts',
  end: 'last_ts',
  duration: 'cycle_s',
  events: 'events',
  cost: 'cost',
};

/**
 * A page position: the sort value and case id of the last row returned.
 *
 * Keyset, not OFFSET. The refresh module avoids OFFSET on the same grounds and
 * they apply harder here: OFFSET makes the database walk and discard every
 * skipped row, so page 400 costs four hundred times page 1, and if the log is
 * refreshed mid-browse the rows shift underneath the offset and a case can be
 * skipped or shown twice.
 */
interface Cursor {
  /** 0 when the sort value is present, 1 when null. Nulls sort last. */
  group: 0 | 1;
  /** Epoch ms for instants, the plain number otherwise. Null when group is 1. */
  value: number | null;
  caseId: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new ConfigInvalidError('cursor is not a page position this engine issued');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ConfigInvalidError('cursor is not a page position this engine issued');
  }
  const { group, value, caseId } = parsed as Record<string, unknown>;
  if ((group !== 0 && group !== 1) || typeof caseId !== 'string') {
    throw new ConfigInvalidError('cursor is not a page position this engine issued');
  }
  if (value !== null && typeof value !== 'number') {
    throw new ConfigInvalidError('cursor is not a page position this engine issued');
  }
  return { group, value, caseId };
}

/**
 * One page of cases matching the current selection.
 *
 * The per-case roll-up deliberately uses plain aggregates only. First and last
 * activity would each need a window pass over every event in the log to answer
 * a question the timeline answers exactly for the one case actually opened —
 * an expensive way to decorate a list.
 */
export async function listCases(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CaseListOptions,
): Promise<CasePage> {
  const sort = opts.sort ?? 'duration';
  const direction = opts.direction ?? 'desc';
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const column = SORT_COLUMN[sort];

  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const perCase = caseAggregateSql(log, dialect);

  // Nulls last in both directions: a case with no recorded cost is not the
  // cheapest case, it is a case nobody costed, and floating it to the top of a
  // "most expensive first" list would read as the opposite of what it means.
  const nullGroup = `CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END`;
  const way = direction === 'asc' ? 'ASC' : 'DESC';
  const comparison = direction === 'asc' ? '>' : '<';

  let predicate = '';
  if (opts.cursor !== undefined && opts.cursor !== '') {
    const cursor = decodeCursor(opts.cursor);
    params.push(cursor.caseId);
    const idHole = dialect.placeholder(params.length);

    if (cursor.group === 1) {
      // Already inside the null group; only the tie-break remains.
      predicate = `WHERE ${nullGroup} = 1 AND case_id ${comparison} ${idHole}`;
    } else {
      const isInstant = sort === 'start' || sort === 'end';
      const value = cursor.value ?? 0;
      params.push(isInstant ? dialect.timestampParam(new Date(value)) : value);
      const valueHole = isInstant
        ? dialect.timestampPlaceholder(params.length)
        : dialect.placeholder(params.length);
      predicate =
        `WHERE ${nullGroup} = 1 OR (${column} ${comparison} ${valueHole}` +
        ` OR (${column} = ${valueHole} AND case_id ${comparison} ${idHole}))`;
    }
  }

  const { rows } = await client.query(
    `SELECT * FROM (${perCase}) c ${predicate}
     ORDER BY ${nullGroup} ASC, ${column} ${way}, case_id ${way}
     LIMIT ${limit + 1}`,
    params,
  );

  // One row past the page proves there is a next page without a second query,
  // and is dropped before anything is returned.
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(readCaseRow);

  const totalParams: unknown[] = [];
  const totalLog = buildLog(dialect, totalParams, opts).sql;
  const { rows: totalRows } = await client.query(
    `SELECT COUNT(DISTINCT case_id) AS n FROM (${totalLog}) t`,
    totalParams,
  );

  const last = rows[limit - 1];
  const nextCursor =
    hasMore && last !== undefined
      ? encodeCursor({
          group: last[column] === null || last[column] === undefined ? 1 : 0,
          value: cursorValue(last, sort, column),
          caseId: String(last['case_id']),
        })
      : null;

  return {
    objectType: opts.objectType,
    cases: page,
    total: countOf(totalRows[0]?.['n']),
    nextCursor,
    sortedBy: sort,
    direction,
  };
}

function cursorValue(row: Record<string, unknown>, sort: CaseSort, column: string): number | null {
  const raw = row[column];
  if (raw === null || raw === undefined) return null;
  return sort === 'start' || sort === 'end' ? instantMsOf(raw) : numberOrNull(raw);
}

/**
 * Per-case roll-up.
 *
 * `COUNT(resource)` rather than `COUNT(*)` counts only the events that name
 * somebody, so a case whose resource column is empty reports zero people rather
 * than one unnamed one.
 */
function caseAggregateSql(logSql: string, dialect: SqlDialect): string {
  return `SELECT case_id,
                 MIN(ts) AS first_ts,
                 MAX(ts) AS last_ts,
                 ${CASE_CYCLE_SECONDS} AS cycle_s,
                 COUNT(*) AS events,
                 COUNT(DISTINCT activity) AS activities,
                 COUNT(DISTINCT resource) AS resources,
                 SUM(cost) AS cost,
                 SUM(duration_s) AS handling_s
          FROM (${logSql}) e
          GROUP BY case_id`;
}

function readCaseRow(row: Record<string, unknown>): CaseRow {
  const first = instantMsOf(row['first_ts']);
  const last = instantMsOf(row['last_ts']);
  return {
    caseId: String(row['case_id']),
    firstEvent: new Date(first ?? 0),
    lastEvent: new Date(last ?? 0),
    cycleSeconds: numberOrNull(row['cycle_s']) ?? 0,
    events: countOf(row['events']),
    activities: countOf(row['activities']),
    resources: countOf(row['resources']),
    cost: numberOrNull(row['cost']),
    handlingSeconds: numberOrNull(row['handling_s']),
  };
}

// ---------------------------------------------------------------------------
// One case, step by step
// ---------------------------------------------------------------------------

export interface TimelineStep {
  eventId: number;
  activity: string;
  at: Date;
  lifecycle: string | null;
  resource: string | null;
  /** Recorded handling time. Null when the source records none — not zero. */
  handlingSeconds: number | null;
  /**
   * Idle seconds before this step began. Null on the first step of a case:
   * nothing preceded it, which is a different claim from a wait of zero.
   *
   * The same definition the performance analysis ranks bottlenecks by.
   */
  waitingSeconds: number | null;
  cost: number | null;
}

export interface CaseTimeline {
  objectType: string;
  caseId: string;
  /** Case-scoped attributes, as the snapshot sources supplied them. */
  attributes: { key: string; value: string | null }[];
  steps: TimelineStep[];
  /** Events in the case, before any truncation. */
  events: number;
  /** True when `steps` holds fewer than `events`. */
  truncated: boolean;
  firstEvent: Date | null;
  lastEvent: Date | null;
  cycleSeconds: number | null;
  /** Summed recorded handling. Null when the source records none. */
  handlingSeconds: number | null;
  /** Summed idle time between steps. */
  waitingSeconds: number | null;
  cost: number | null;
}

export interface CaseTimelineOptions extends LogQueryOptions {
  /**
   * Steps to return. Default 1,000, capped at 10,000.
   *
   * A cap rather than a promise to render everything: one pathological case can
   * carry tens of thousands of events, and a browser asked to lay them all out
   * stops responding. Truncation is reported, never silent.
   */
  limit?: number;
}

const DEFAULT_STEP_LIMIT = 1_000;
const MAX_STEP_LIMIT = 10_000;

export async function caseTimeline(
  client: SqlClient,
  dialect: SqlDialect,
  caseId: string,
  opts: CaseTimelineOptions,
): Promise<CaseTimeline> {
  const limit = Math.min(MAX_STEP_LIMIT, Math.max(1, opts.limit ?? DEFAULT_STEP_LIMIT));

  const params: unknown[] = [];
  const { sql: log, tables } = buildLog(dialect, params, opts);
  params.push(caseId);
  const caseHole = dialect.placeholder(params.length);

  // The window runs over this case only. Filtering after the LAG would compute
  // every case's lags and discard all but one.
  const scoped = `SELECT * FROM (${log}) l WHERE l.case_id = ${caseHole}`;
  const stepped = `
    SELECT case_id, event_id, activity, ts, lifecycle, resource, duration_s, cost, business_s,
           ${PREVIOUS_STEP_LAGS}
    FROM (${scoped}) p`;

  const { rows } = await client.query(
    `SELECT event_id, activity, ts, lifecycle, resource, duration_s, cost,
            ${waitingSecondsExpr(dialect)} AS wait_s
     FROM (${stepped}) s
     ORDER BY ${eventOrderBy('s')}
     LIMIT ${limit}`,
    params,
  );

  const totalParams: unknown[] = [];
  const totalLog = buildLog(dialect, totalParams, opts).sql;
  totalParams.push(caseId);
  const totalHole = dialect.placeholder(totalParams.length);
  const { rows: totals } = await client.query(
    `SELECT COUNT(*) AS events,
            MIN(ts) AS first_ts,
            MAX(ts) AS last_ts,
            ${CASE_CYCLE_SECONDS} AS cycle_s,
            SUM(duration_s) AS handling_s,
            SUM(cost) AS cost
     FROM (${totalLog}) t WHERE t.case_id = ${totalHole}`,
    totalParams,
  );

  const attrParams: unknown[] = [opts.objectType, caseId];
  const { rows: attrRows } = await client.query(
    `SELECT key, value FROM ${tables.caseAttrs}
     WHERE object_type = ${dialect.placeholder(1)} AND object_id = ${dialect.placeholder(2)}
     ORDER BY key`,
    attrParams,
  );

  const steps: TimelineStep[] = rows.map((r) => ({
    eventId: countOf(r['event_id']),
    activity: String(r['activity']),
    at: new Date(instantMsOf(r['ts']) ?? 0),
    lifecycle: r['lifecycle'] === null || r['lifecycle'] === undefined ? null : String(r['lifecycle']),
    resource: r['resource'] === null || r['resource'] === undefined ? null : String(r['resource']),
    handlingSeconds: numberOrNull(r['duration_s']),
    waitingSeconds: numberOrNull(r['wait_s']),
    cost: numberOrNull(r['cost']),
  }));

  const total = totals[0] ?? {};
  const events = countOf(total['events']);
  const firstMs = instantMsOf(total['first_ts']);
  const lastMs = instantMsOf(total['last_ts']);

  // Summed over the steps returned. Stated on the type rather than implied,
  // because on a truncated timeline it is a partial figure.
  const waited = steps.reduce<number | null>(
    (sum, step) => (step.waitingSeconds === null ? sum : (sum ?? 0) + step.waitingSeconds),
    null,
  );

  return {
    objectType: opts.objectType,
    caseId,
    attributes: attrRows.map((r) => ({
      key: String(r['key']),
      value: r['value'] === null || r['value'] === undefined ? null : String(r['value']),
    })),
    steps,
    events,
    truncated: steps.length < events,
    firstEvent: firstMs === null ? null : new Date(firstMs),
    lastEvent: lastMs === null ? null : new Date(lastMs),
    cycleSeconds: numberOrNull(total['cycle_s']),
    handlingSeconds: numberOrNull(total['handling_s']),
    waitingSeconds: waited,
    cost: numberOrNull(total['cost']),
  };
}
