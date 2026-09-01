import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { eventOrderBy } from './eventlog.js';
import { buildLog, type LogQueryOptions } from './logquery.js';

/**
 * Rework: the work that was done more than once.
 *
 * The most reliably valuable finding in an engagement, and the one a process
 * map shows worst. A self-loop on a busy activity is a thin arc among many,
 * visually indistinguishable from a rare branch — while representing, on a
 * real log, weeks of repeated effort. Counting it makes the size of the
 * problem arguable rather than aesthetic.
 *
 * Three distinct things get counted, because they have different causes and
 * different fixes:
 *
 *  - **repetition** — an activity ran more than once in a case, at all. The
 *    broadest measure, and the one that answers "how much of our volume is
 *    work we have already done".
 *  - **self-loops** — it ran again IMMEDIATELY. Usually a retry, a correction,
 *    or a system emitting duplicates.
 *  - **revisits** — it ran again LATER, after other work. Usually a genuine
 *    loop in the process: sent back, reassessed, chased again.
 *
 * Time is attributed to the repeats only. The first execution of an activity
 * is the work; everything after it is the rework, and charging the first
 * occurrence to the rework total would make every process look pathological.
 */

export interface ReworkActivity {
  activity: string;
  /** Cases performing it at least once. */
  cases: number;
  /** Cases performing it more than once — where the rework is. */
  casesWithRepeat: number;
  /** Share of the cases doing it that had to do it again, 0–1. */
  repeatRate: number;
  /** Total executions across the log. */
  executions: number;
  /** Executions beyond the first per case. The count of avoidable work. */
  repeatExecutions: number;
  /** Immediate repetitions — the same activity twice in a row. */
  selfLoops: number;
  /** Repetitions after intervening work — a genuine loop back. */
  revisits: number;
  /** Highest number of executions any single case needed. */
  maxInOneCase: number;
  /**
   * Seconds spent on the repeat executions, where the source records handling
   * time. Null when it does not — unmeasured is not zero.
   */
  repeatHandlingSeconds: number | null;
  /** One sentence, safe to quote. */
  finding: string;
}

export interface ReworkReport {
  objectType: string;
  totalCases: number;
  /** Cases in which anything at all was repeated. */
  casesWithRework: number;
  /** Share of all cases carrying rework, 0–1. */
  reworkRate: number;
  totalEvents: number;
  /** Events that were a repeat of work already done in that case. */
  repeatEvents: number;
  /** Share of all effort that was repetition, 0–1. The headline number. */
  effortShare: number;
  activities: ReworkActivity[];
  summary: string;
  /**
   * Stated rather than assumed: without recorded handling times the engine can
   * count repeats but cannot cost them.
   */
  handlingTimesRecorded: boolean;
}

export interface ReworkOptions extends LogQueryOptions {
  /** Activities to return, worst first. Default 50. */
  limit?: number;
}

export async function analyseRework(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ReworkOptions,
): Promise<ReworkReport> {
  const params: unknown[] = [];
  const { sql: log } = buildLog(dialect, params, opts);
  const order = eventOrderBy('');

  // occurrence: which execution of this activity, within this case, this is.
  // previous: what ran immediately before it, so an immediate repeat can be
  // told apart from a loop back after other work.
  const marked = `
    SELECT case_id, activity, duration_s,
           ROW_NUMBER() OVER (PARTITION BY case_id, activity ORDER BY ${order}) AS occurrence,
           LAG(activity)  OVER (PARTITION BY case_id ORDER BY ${order}) AS previous
    FROM (${log}) p`;

  const perActivity = `
    SELECT activity,
           COUNT(DISTINCT case_id) AS cases,
           COUNT(*) AS executions,
           SUM(CASE WHEN occurrence > 1 THEN 1 ELSE 0 END) AS repeats,
           SUM(CASE WHEN occurrence > 1 AND previous = activity THEN 1 ELSE 0 END) AS self_loops,
           SUM(CASE WHEN occurrence > 1 AND (previous IS NULL OR previous <> activity)
                    THEN 1 ELSE 0 END) AS revisits,
           SUM(CASE WHEN occurrence > 1 THEN duration_s ELSE 0 END) AS repeat_handling_s,
           COUNT(DISTINCT CASE WHEN occurrence > 1 THEN case_id END) AS cases_with_repeat,
           MAX(occurrence) AS max_in_one_case
    FROM (${marked}) m
    GROUP BY activity`;

  const { rows } = await client.query(
    `SELECT * FROM (${perActivity}) r ORDER BY repeats DESC, activity ASC`,
    params,
  );

  const totalsParams: unknown[] = [];
  const totalsLog = buildLog(dialect, totalsParams, opts).sql;
  const totalsMarked = `
    SELECT case_id, duration_s,
           ROW_NUMBER() OVER (PARTITION BY case_id, activity ORDER BY ${order}) AS occurrence
    FROM (${totalsLog}) p`;
  const { rows: totalRows } = await client.query(
    `SELECT COUNT(*) AS events,
            COUNT(DISTINCT case_id) AS cases,
            SUM(CASE WHEN occurrence > 1 THEN 1 ELSE 0 END) AS repeat_events,
            COUNT(DISTINCT CASE WHEN occurrence > 1 THEN case_id END) AS cases_with_rework,
            COUNT(duration_s) AS durations_recorded
     FROM (${totalsMarked}) t`,
    totalsParams,
  );

  const totals = totalRows[0] ?? {};
  const totalCases = countOf(totals['cases']);
  const totalEvents = countOf(totals['events']);
  const repeatEvents = countOf(totals['repeat_events']);
  const casesWithRework = countOf(totals['cases_with_rework']);
  const handlingTimesRecorded = countOf(totals['durations_recorded']) > 0;

  const limit = opts.limit ?? 50;
  const activities: ReworkActivity[] = rows
    .map((r) => {
      const activity = String(r['activity']);
      const cases = countOf(r['cases']);
      const casesWithRepeat = countOf(r['cases_with_repeat']);
      const repeatExecutions = countOf(r['repeats']);
      const repeatRate = cases === 0 ? 0 : casesWithRepeat / cases;
      const repeatHandlingSeconds = handlingTimesRecorded
        ? numberOrNull(r['repeat_handling_s'])
        : null;
      return {
        activity,
        cases,
        casesWithRepeat,
        repeatRate,
        executions: countOf(r['executions']),
        repeatExecutions,
        selfLoops: countOf(r['self_loops']),
        revisits: countOf(r['revisits']),
        maxInOneCase: countOf(r['max_in_one_case']),
        repeatHandlingSeconds,
        finding: describe(activity, casesWithRepeat, cases, repeatRate, repeatExecutions),
      };
    })
    .filter((a) => a.repeatExecutions > 0)
    .slice(0, limit);

  return {
    objectType: opts.objectType,
    totalCases,
    casesWithRework,
    reworkRate: totalCases === 0 ? 0 : casesWithRework / totalCases,
    totalEvents,
    repeatEvents,
    effortShare: totalEvents === 0 ? 0 : repeatEvents / totalEvents,
    activities,
    handlingTimesRecorded,
    summary: summarise(totalCases, casesWithRework, totalEvents, repeatEvents, activities),
  };
}

function describe(
  activity: string,
  casesWithRepeat: number,
  cases: number,
  rate: number,
  repeats: number,
): string {
  const pct = (rate * 100).toFixed(0);
  return (
    `${activity} was done more than once in ${casesWithRepeat.toLocaleString()} of ` +
    `${cases.toLocaleString()} cases (${pct}%), costing ` +
    `${repeats.toLocaleString()} extra executions`
  );
}

function summarise(
  cases: number,
  withRework: number,
  events: number,
  repeats: number,
  activities: readonly ReworkActivity[],
): string {
  if (cases === 0) return 'no cases in this selection';
  if (repeats === 0) return 'no activity was performed twice in any case';

  const casePct = ((withRework / cases) * 100).toFixed(0);
  const effortPct = ((repeats / Math.max(events, 1)) * 100).toFixed(0);
  const worst = activities[0];
  const lead =
    `${withRework.toLocaleString()} of ${cases.toLocaleString()} cases (${casePct}%) ` +
    `repeated some step, accounting for ${effortPct}% of all recorded effort`;
  return worst === undefined ? lead : `${lead}. Worst: ${worst.finding}`;
}
