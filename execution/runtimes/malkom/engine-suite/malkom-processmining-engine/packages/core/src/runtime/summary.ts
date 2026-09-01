import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { buildLog, perCaseSql, type LogQueryOptions } from './logquery.js';

/**
 * The header figures: how big is this log, and over what period.
 *
 * Every number here could be assembled from the analysis endpoints, and that
 * is exactly the problem — it takes three round trips to fill a strip of text
 * that renders before anything else on the screen, and the three answers are
 * computed over three separately-built logs. Doing it once means the header
 * cannot disagree with itself, and the panel it sits above.
 */

export interface LogSummary {
  objectType: string;
  cases: number;
  events: number;
  activities: number;
  /** Distinct paths through the process. */
  variants: number;
  resources: number;
  /** End-to-end case duration in seconds. Null when the log has no cases. */
  duration: {
    minSeconds: number | null;
    medianSeconds: number | null;
    meanSeconds: number | null;
    maxSeconds: number | null;
  };
  /**
   * Cost per case, where the log records it. Null throughout when it does not.
   *
   * The reference tools put "case cost" beside "case duration" in the header,
   * and it is the figure that turns a process finding into a budget line.
   */
  cost: {
    minCost: number | null;
    medianCost: number | null;
    meanCost: number | null;
    maxCost: number | null;
    totalCost: number | null;
  };
  /** First and last event in the filtered log. */
  timeframe: { from: Date | null; to: Date | null };
  /**
   * Share of events that name who did them, 0–1.
   *
   * Stated because the organizational perspective is unavailable below a
   * certain coverage, and a caller should be able to grey out that tab rather
   * than render a confident answer over a handful of rows.
   */
  resourceCoverage: number;
  /** Lifecycle transitions present, most frequent first. */
  lifecycles: { transition: string | null; events: number }[];
}

export async function summariseLog(
  client: SqlClient,
  dialect: SqlDialect,
  opts: LogQueryOptions,
): Promise<LogSummary> {
  const headParams: unknown[] = [];
  const headLog = buildLog(dialect, headParams, opts).sql;
  const perCase = perCaseSql(headLog, dialect);

  // The variant key is assembled here rather than reusing the variants report,
  // which pages its output: the header wants the total, not the first fifty.
  // Cost per case is a sum over that case's events, so it needs its own
  // per-case aggregate — the duration one groups the same rows but keeps
  // min/max of a span rather than a total.
  const perCaseCost = `SELECT case_id, SUM(cost) AS case_cost, COUNT(cost) AS cost_rows
                       FROM (${headLog}) cc GROUP BY case_id`;

  const { rows: head } = await client.query(
    `WITH log AS (${headLog}), c AS (${perCase}), cost AS (${perCaseCost}),
          v AS (SELECT case_id, ${dialect.stringAgg('activity', ' → ', `ts, event_id`)} AS path
                FROM log GROUP BY case_id)
     SELECT (SELECT COUNT(*) FROM log)                              AS events,
            (SELECT COUNT(DISTINCT case_id) FROM log)               AS cases,
            (SELECT COUNT(DISTINCT activity) FROM log)              AS activities,
            (SELECT COUNT(DISTINCT resource) FROM log
              WHERE resource IS NOT NULL)                           AS resources,
            (SELECT COUNT(*) FROM log WHERE resource IS NOT NULL)   AS with_resource,
            (SELECT COUNT(DISTINCT path) FROM v)                    AS variants,
            (SELECT MIN(ts) FROM log)                               AS first_ts,
            (SELECT MAX(ts) FROM log)                               AS last_ts,
            (SELECT MIN(cycle_s) FROM c)                            AS min_s,
            (SELECT ${dialect.medianOf('cycle_s')} FROM c)          AS median_s,
            (SELECT AVG(cycle_s) FROM c)                            AS mean_s,
            (SELECT MAX(cycle_s) FROM c)                            AS max_s,
            (SELECT COUNT(*) FROM cost WHERE cost_rows > 0)         AS cases_with_cost,
            (SELECT MIN(case_cost) FROM cost WHERE cost_rows > 0)   AS min_cost,
            (SELECT ${dialect.medianOf('case_cost')} FROM cost
              WHERE cost_rows > 0)                                  AS median_cost,
            (SELECT AVG(case_cost) FROM cost WHERE cost_rows > 0)   AS mean_cost,
            (SELECT MAX(case_cost) FROM cost WHERE cost_rows > 0)   AS max_cost,
            (SELECT SUM(case_cost) FROM cost WHERE cost_rows > 0)   AS total_cost`,
    headParams,
  );

  const lifeParams: unknown[] = [];
  const lifeLog = buildLog(dialect, lifeParams, opts).sql;
  const { rows: life } = await client.query(
    `SELECT lifecycle, COUNT(*) AS events FROM (${lifeLog}) l
     GROUP BY lifecycle ORDER BY COUNT(*) DESC`,
    lifeParams,
  );

  const row = head[0] ?? {};
  const events = countOf(row.events);

  return {
    objectType: opts.objectType,
    cases: countOf(row.cases),
    events,
    activities: countOf(row.activities),
    variants: countOf(row.variants),
    resources: countOf(row.resources),
    duration: {
      minSeconds: numberOrNull(row.min_s),
      medianSeconds: numberOrNull(row.median_s),
      meanSeconds: numberOrNull(row.mean_s),
      maxSeconds: numberOrNull(row.max_s),
    },
    cost: costOf(row),
    timeframe: { from: asDate(row.first_ts), to: asDate(row.last_ts) },
    resourceCoverage: events === 0 ? 0 : countOf(row.with_resource) / events,
    lifecycles: life.map((l) => ({
      transition: l.lifecycle === null || l.lifecycle === undefined ? null : String(l.lifecycle),
      events: countOf(l.events),
    })),
  };
}

/**
 * Cost figures, or nulls throughout.
 *
 * All-or-nothing on purpose: a partial answer here would be a total over
 * whichever cases happened to carry a cost, presented beside a case count that
 * covers all of them. That is a number nobody can act on and everybody would.
 */
function costOf(row: Record<string, unknown>): LogSummary['cost'] {
  const none = {
    minCost: null,
    medianCost: null,
    meanCost: null,
    maxCost: null,
    totalCost: null,
  };
  if (countOf(row['cases_with_cost']) === 0) return none;
  return {
    minCost: numberOrNull(row['min_cost']),
    medianCost: numberOrNull(row['median_cost']),
    meanCost: numberOrNull(row['mean_cost']),
    maxCost: numberOrNull(row['max_cost']),
    totalCost: numberOrNull(row['total_cost']),
  };
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
