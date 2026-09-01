import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import {
  assessReportability,
  benjaminiHochberg,
  cliffsDeltaFromU,
  mannWhitneyFromRanks,
  type CliffsDelta,
} from '../stats/tests.js';
import { eventLogTables } from './eventlog.js';
import {
  caseFilterPredicate,
  describeFilter,
  type CaseFilter,
  type FilterContext,
} from './filter.js';
import { CASE_CYCLE_SECONDS, buildLog } from './logquery.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * Comparative mining: is this cohort genuinely different from that one?
 *
 * The four rules from the statistics module are enforced here rather than left
 * to the caller. Every comparison runs Mann–Whitney (not a t-test), carries
 * Cliff's delta beside its p-value, is corrected across the whole family with
 * Benjamini–Hochberg, and is suppressed unless it clears a minimum sample size
 * and a non-negligible effect.
 *
 * The ranking runs **inside the database**. A rank is a window function and a
 * rank sum is a GROUP BY, so the test is exact over millions of cases without
 * a single duration crossing into Node. Sampling would have been easier and
 * would have made every result unreproducible.
 */

/**
 * How a cohort is picked out.
 *
 * The same `CaseFilter` the rest of the engine uses, plus `complement` for
 * "everything not in cohort A". Sharing the type is what lets a selection made
 * by clicking around the explorer be handed straight to a comparison — the
 * cohort and the filter are the same idea, and having two vocabularies for it
 * would guarantee they drifted.
 */
export type CohortSpec = CaseFilter | { kind: 'complement' };

export interface ComparativeOptions {
  objectType: string;
  schema?: string | undefined;
  lifecycle?: readonly string[] | undefined;
  /** Scope the whole comparison to these cases before splitting into cohorts. */
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
  a: CohortSpec;
  b: CohortSpec;
  labelA?: string;
  labelB?: string;
  /** False-discovery rate for the family of comparisons. Default 0.05. */
  fdr?: number;
  /** Activities to compare individually. Default: the 30 most frequent. */
  activityLimit?: number;
}

export interface Comparison {
  /** What was compared, e.g. 'cycle time' or 'duration of Approve'. */
  metric: string;
  medianA: number | null;
  medianB: number | null;
  /** medianA − medianB, in seconds. */
  difference: number | null;
  nA: number;
  nB: number;
  pValue: number;
  /** Benjamini–Hochberg adjusted p across the whole family. */
  adjustedP: number;
  effect: CliffsDelta;
  /** False when the comparison should not be acted on, with the reason why. */
  reportable: boolean;
  reason: string;
}

export interface ComparativeReport {
  objectType: string;
  labelA: string;
  labelB: string;
  casesA: number;
  casesB: number;
  /** Comparisons that survived every rule, worst-offender first. */
  findings: Comparison[];
  /** Everything tested but suppressed, with the reason. Never hidden. */
  suppressed: Comparison[];
  /** Total tests in the family. The number BH corrected across. */
  comparisonsRun: number;
  fdr: number;
  summary: string;
}

const ORDER = `ts, CASE lower(COALESCE(lifecycle, ''))
    WHEN 'schedule' THEN 0 WHEN 'assign' THEN 1 WHEN 'start' THEN 2
    WHEN '' THEN 3 WHEN 'complete' THEN 4 ELSE 5 END, event_id`;

const DEFAULT_ACTIVITY_LIMIT = 30;

export async function compareCohorts(
  client: SqlClient,
  dialect: SqlDialect,
  opts: ComparativeOptions,
): Promise<ComparativeReport> {
  const tables = eventLogTables(dialect, opts.schema);
  const fdr = opts.fdr ?? 0.05;
  const labelA = opts.labelA ?? describeCohort(opts.a);
  const labelB = opts.labelB ?? describeCohort(opts.b);
  // Cohorts split the same log the comparison reads, so a sequence-aware
  // cohort spec has to see the same lifecycle restriction.
  const ctx: FilterContext = {
    lifecycle: opts.lifecycle,
    perspective: opts.perspective,
    calendar: opts.calendar,
  };

  /**
   * Every query builds its OWN parameter array.
   *
   * Numbered placeholders bind by index, so a query must be given exactly the
   * values its own SQL references — handing it a shared array that also holds
   * another query's parameters is a bind error, and handing it one built in a
   * different order used to be a silent misalignment. Rebuilding per query
   * makes both impossible by construction.
   */
  const buildScoped = (params: unknown[]): string => {
    const log = buildLog(dialect, params, opts).sql;
    const membershipA = cohortPredicate(opts.a, tables, dialect, params, opts.objectType, ctx);
    const membershipB =
      opts.b.kind === 'complement'
        ? `NOT (${membershipA})`
        : cohortPredicate(opts.b, tables, dialect, params, opts.objectType, ctx);

    const perCase = `
      SELECT case_id,
             ${CASE_CYCLE_SECONDS} AS cycle_s,
             MIN(ts) AS first_ts
      FROM (${log}) c GROUP BY case_id`;

    return `SELECT * FROM (
              SELECT p.case_id, p.cycle_s,
                     CASE WHEN ${membershipA} THEN 'A' WHEN ${membershipB} THEN 'B' END AS cohort
              FROM (${perCase}) p
            ) s WHERE cohort IS NOT NULL`;
  };

  const logOf = (params: unknown[]): string => buildLog(dialect, params, opts).sql;

  const raw: Comparison[] = [];

  // --- the headline: cycle time -------------------------------------------
  {
    const params: unknown[] = [];
    const scoped = buildScoped(params);
    const cycle = await rankSumInSql(client, dialect, scoped, 'cycle_s', params);
    raw.push(toComparison('cycle time', cycle));
  }

  // --- per-activity step time, for the busiest activities -----------------
  const activityLimit = opts.activityLimit ?? DEFAULT_ACTIVITY_LIMIT;
  const activityParams: unknown[] = [];
  const activityLog = logOf(activityParams);
  const { rows: activityRows } = await client.query(
    `SELECT activity, COUNT(*) AS n FROM (${activityLog}) a GROUP BY activity
     ORDER BY n DESC LIMIT ${Math.max(1, activityLimit)}`,
    activityParams,
  );

  for (const row of activityRows) {
    const activity = String(row['activity']);
    const params: unknown[] = [];
    const log = logOf(params);
    const scoped = buildScoped(params);
    params.push(activity);
    const activityHole = dialect.placeholder(params.length);

    // Time from this activity to the next step, per case, for cases that
    // performed it. Comparing the same activity across cohorts is what
    // localises a difference to a step rather than to the whole process.
    const stepped = `
      SELECT case_id, activity,
             (LEAD(business_s) OVER (PARTITION BY case_id ORDER BY ${ORDER}) - business_s) AS step_s
      FROM (${log}) p`;

    const perCaseStep = `
      SELECT case_id, ${dialect.medianOf('step_s')} AS value_s
      FROM (${stepped}) s WHERE activity = ${activityHole} AND step_s IS NOT NULL
      GROUP BY case_id`;

    const joined = `
      SELECT v.value_s AS metric, l.cohort
      FROM (${perCaseStep}) v
      JOIN (${scoped}) l ON l.case_id = v.case_id`;

    const result = await rankSumInSql(client, dialect, joined, 'metric', params);
    if (result.nA === 0 || result.nB === 0) continue;
    raw.push(toComparison(`time after ${activity}`, result));
  }

  // --- correct across the whole family ------------------------------------
  // Every test above is one family. Correcting per-test would let one in
  // twenty look real by chance, and with thirty activities that is a finding
  // or two of pure noise in every report.
  const adjusted = benjaminiHochberg(
    raw.map((c) => (Number.isNaN(c.pValue) ? 1 : c.pValue)),
    fdr,
  );

  const evaluated = raw.map((c, i) => {
    const adjustedP = adjusted[i]!.adjusted;
    const verdict = assessReportability(c.nA, c.nB, c.effect, adjustedP, fdr);
    return { ...c, adjustedP, reportable: verdict.reportable, reason: verdict.reason };
  });

  const findings = evaluated
    .filter((c) => c.reportable)
    .sort((x, y) => Math.abs(y.effect.delta) - Math.abs(x.effect.delta));
  const suppressed = evaluated.filter((c) => !c.reportable);

  const countParams: unknown[] = [];
  const countScoped = buildScoped(countParams);
  const counts = await client.query(
    `SELECT cohort, COUNT(*) AS n FROM (${countScoped}) s GROUP BY cohort`,
    countParams,
  );
  let casesA = 0;
  let casesB = 0;
  for (const row of counts.rows) {
    if (row['cohort'] === 'A') casesA = countOf(row['n']);
    if (row['cohort'] === 'B') casesB = countOf(row['n']);
  }

  return {
    objectType: opts.objectType,
    labelA,
    labelB,
    casesA,
    casesB,
    findings,
    suppressed,
    comparisonsRun: raw.length,
    fdr,
    summary: summarise(findings, raw.length, labelA, labelB, casesA, casesB),
  };
}

interface RankSumOutcome {
  rankSumA: number;
  nA: number;
  nB: number;
  tieGroupSizes: number[];
  medianA: number | null;
  medianB: number | null;
}

/**
 * Rank, sum and count entirely in SQL.
 *
 * Midranks come from averaging the row number within each distinct value,
 * which is the same definition the in-memory implementation uses — so the two
 * routes cannot drift apart.
 */
async function rankSumInSql(
  client: SqlClient,
  dialect: SqlDialect,
  source: string,
  column: string,
  params: readonly unknown[],
): Promise<RankSumOutcome> {
  const base = `SELECT ${column} AS v, cohort FROM (${source}) x WHERE ${column} IS NOT NULL`;

  const ranked = `
    SELECT v, cohort,
           AVG(CAST(rn AS DOUBLE PRECISION)) OVER (PARTITION BY v) AS midrank
    FROM (SELECT v, cohort, ROW_NUMBER() OVER (ORDER BY v) AS rn FROM (${base}) b) r`;

  const [sums, ties] = await Promise.all([
    client.query(
      `SELECT cohort, SUM(midrank) AS rank_sum, COUNT(*) AS n,
              ${dialect.medianOf('v')} AS med
       FROM (${ranked}) s GROUP BY cohort`,
      params,
    ),
    client.query(
      `SELECT COUNT(*) AS tied FROM (${base}) t GROUP BY v HAVING COUNT(*) > 1`,
      params,
    ),
  ]);

  let rankSumA = 0;
  let nA = 0;
  let nB = 0;
  let medianA: number | null = null;
  let medianB: number | null = null;

  for (const row of sums.rows) {
    if (row['cohort'] === 'A') {
      rankSumA = numberOrNull(row['rank_sum']) ?? 0;
      nA = countOf(row['n']);
      medianA = numberOrNull(row['med']);
    } else if (row['cohort'] === 'B') {
      nB = countOf(row['n']);
      medianB = numberOrNull(row['med']);
    }
  }

  return {
    rankSumA,
    nA,
    nB,
    tieGroupSizes: ties.rows.map((r) => countOf(r['tied'])),
    medianA,
    medianB,
  };
}

function toComparison(metric: string, outcome: RankSumOutcome): Comparison {
  const test = mannWhitneyFromRanks(outcome);
  // The variance travels from the test so the interval and the p-value rest on
  // exactly the same tie correction rather than two implementations of it.
  const effect = cliffsDeltaFromU(test.u, outcome.nA, outcome.nB, test.varianceU);
  return {
    metric,
    medianA: outcome.medianA,
    medianB: outcome.medianB,
    difference:
      outcome.medianA !== null && outcome.medianB !== null
        ? outcome.medianA - outcome.medianB
        : null,
    nA: outcome.nA,
    nB: outcome.nB,
    pValue: test.pValue,
    adjustedP: Number.NaN, // filled in after the family correction
    effect,
    reportable: false,
    reason: '',
  };
}

function cohortPredicate(
  spec: CohortSpec,
  tables: { caseAttrs: string; objects: string; events: string },
  dialect: SqlDialect,
  params: unknown[],
  objectType: string,
  ctx: FilterContext,
): string {
  // `complement` is resolved by the caller, which holds the paired predicate
  // to negate; it has no meaning on its own.
  if (spec.kind === 'complement') return 'FALSE';
  return caseFilterPredicate(spec, tables, dialect, params, objectType, 'p.case_id', ctx);
}

function describeCohort(spec: CohortSpec): string {
  return spec.kind === 'complement' ? 'everything else' : describeFilter(spec);
}

function summarise(
  findings: readonly Comparison[],
  total: number,
  labelA: string,
  labelB: string,
  casesA: number,
  casesB: number,
): string {
  if (casesA === 0 || casesB === 0) {
    return `one cohort is empty (${labelA}: ${casesA}, ${labelB}: ${casesB}) — nothing to compare`;
  }
  if (findings.length === 0) {
    return `${total} comparisons run between ${labelA} (${casesA.toLocaleString()} cases) and ${labelB} (${casesB.toLocaleString()}); none survived correction with a non-negligible effect. The cohorts behave alike on what was measured`;
  }
  const top = findings[0]!;
  const direction = (top.difference ?? 0) > 0 ? 'slower' : 'faster';
  return `${findings.length} of ${total} comparisons hold up. The largest: ${labelA} is ${direction} on ${top.metric} (${top.effect.magnitude} effect, q = ${top.adjustedP.toFixed(3)})`;
}
