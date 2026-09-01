import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { benjaminiHochberg, type EffectMagnitude } from '../stats/tests.js';
import { eventLogTables } from './eventlog.js';
import type { CaseFilter } from './filter.js';
import { CASE_CYCLE_SECONDS, buildLog } from './logquery.js';
import type { LogCapabilities, Perspective } from './eventlog.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * Root-cause analysis: which properties of a case predict a bad outcome.
 *
 * Discovery says what happens, performance says where the time goes, and this
 * says **which cases it happens to**. It is the step that turns a bottleneck
 * from an observation into something actionable — "approval is slow" is a fact,
 * "approval is slow specifically for free-text orders from the web channel" is
 * a thing somebody can go and change.
 *
 * The method is deliberately plain: define a bad outcome, then for every case
 * attribute and every activity, compare how often it appears among the bad
 * cases against everything else. Rank by lift, correct across the whole family,
 * and suppress anything too rare or too weak to act on.
 *
 * No model is fitted. A decision tree would find interactions this cannot, but
 * it would also hand back a structure nobody can check, and every finding here
 * has to survive being read aloud in a room.
 */

export type OutcomeSpec =
  /** Cases whose end-to-end time exceeds a threshold. */
  | { kind: 'slower-than'; seconds: number }
  /** The slowest share of cases, e.g. 0.2 for the worst fifth. */
  | { kind: 'slowest-fraction'; fraction: number }
  /** Cases whose trace contains a particular activity — a rejection, a rework. */
  | { kind: 'contains'; activity: string }
  /** Cases that never reach a particular activity — never completed, never paid. */
  | { kind: 'missing'; activity: string };

export interface RootCauseOptions {
  objectType: string;
  schema?: string | undefined;
  lifecycle?: readonly string[] | undefined;
  outcome: OutcomeSpec;
  /** Restrict to whole CASES matching this selection. */
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
  /** False-discovery rate across the family of factors. Default 0.05. */
  fdr?: number;
  /** Ignore factors present in fewer cases than this. Default 30. */
  minCases?: number;
  /** Factors to return. Default 20. */
  limit?: number;
  /**
   * Activities to leave out of the factor list.
   *
   * The activity that DEFINES the outcome is always excluded on top of these:
   * "cases that do A_DECLINED are 999x more likely to reach A_DECLINED" is a
   * tautology, and a tool that reports it as its headline finding has told the
   * reader nothing while looking authoritative.
   */
  excludeActivities?: readonly string[];
  /** Test pairs of case attributes as well as single ones. Default true. */
  pairs?: boolean;
  /** Cap on pairs tested, most common first. Default 200. */
  maxPairFactors?: number;
}

export interface Factor {
  /**
   * 'attribute' for a case property, 'activity' for something the case did,
   * 'attribute-pair' for two properties that only matter together.
   */
  kind: 'attribute' | 'activity' | 'attribute-pair';
  /** e.g. 'channel' or the activity name. */
  name: string;
  /** The value, for attributes. */
  value: string | null;
  /**
   * The second half of a pair, when this factor is a combination.
   *
   * A pair is only reported when it beats BOTH halves on its own. Otherwise it
   * is the stronger half wearing a longer name — and a list padded with those
   * looks thorough while saying one thing several times.
   */
  and: { name: string; value: string } | null;
  /** Cases having this factor. */
  cases: number;
  /** Bad-outcome rate among cases with the factor, 0–1. */
  outcomeRateWith: number;
  /** Bad-outcome rate among cases without it, 0–1. */
  outcomeRateWithout: number;
  /**
   * How many times more likely the bad outcome is when the factor is present.
   * 2.0 means twice as likely. The number a reader actually wants.
   */
  lift: number;
  pValue: number;
  adjustedP: number;
  effectMagnitude: EffectMagnitude;
  reportable: boolean;
  reason: string;
  /**
   * True when the factor never co-occurs with the outcome, or always does.
   *
   * For an activity this almost always means an alternative branch of the same
   * decision rather than an explanation — approved and declined cases exclude
   * each other by construction. Kept and reported, but never presented as a
   * cause.
   */
  structural: boolean;
  /** One sentence, safe to quote directly. */
  finding: string;
}

export interface RootCauseReport {
  objectType: string;
  outcome: string;
  totalCases: number;
  outcomeCases: number;
  baseRate: number;
  factors: Factor[];
  suppressed: Factor[];
  factorsTested: number;
  fdr: number;
  summary: string;
  /**
   * Correlation, not causation. Stated in the payload rather than left to a
   * footnote, because "root cause" is a name that invites the stronger reading
   * and the data cannot support it.
   */
  caveat: string;
}

/** Symmetric bound on the lift ratio, so "always" and "never" rank alike. */
const LIFT_CAP = 999;

const DEFAULT_MIN_CASES = 30;

const DEFAULT_MAX_PAIRS = 200;

/**
 * How much stronger a pair must be than its best half to count as a finding.
 *
 * 1.15 on |log(lift)| — roughly "fifteen percent more extreme". Low enough to
 * catch a real interaction, high enough that a pair riding on one dominant
 * attribute is suppressed rather than restated.
 */
const PAIR_MARGIN = 1.15;
const DEFAULT_LIMIT = 20;

export async function findRootCauses(
  client: SqlClient,
  dialect: SqlDialect,
  opts: RootCauseOptions,
): Promise<RootCauseReport> {
  const tables = eventLogTables(dialect, opts.schema);
  const fdr = opts.fdr ?? 0.05;
  const minCases = opts.minCases ?? DEFAULT_MIN_CASES;

  // Each query builds its own parameter array: numbered placeholders bind by
  // index, so a query must receive exactly the values its SQL references.
  const logOf = (params: unknown[]): string => buildLog(dialect, params, opts).sql;

  const buildPerCase = (params: unknown[]): string =>
    `SELECT case_id, ${CASE_CYCLE_SECONDS} AS cycle_s
     FROM (${logOf(params)}) c GROUP BY case_id`;

  // The slowest-fraction outcome needs a cutoff resolved first, against its
  // own query; every later query then treats it as a plain number.
  let cutoff: number | null = null;
  if (opts.outcome.kind === 'slowest-fraction') {
    const cutoffParams: unknown[] = [];
    const perCase = buildPerCase(cutoffParams);
    const q = 1 - Math.min(0.99, Math.max(0.01, opts.outcome.fraction));
    const { rows } = await client.query(
      `SELECT ${dialect.quantileOf('cycle_s', q)} AS cutoff FROM (${perCase}) c`,
      cutoffParams,
    );
    cutoff = numberOrNull(rows[0]?.['cutoff']) ?? 0;
  }

  const buildFlagged = (params: unknown[]): string => {
    const perCase = buildPerCase(params);
    const outcomeExpr = outcomePredicate(opts.outcome, cutoff, dialect, params, tables, opts.objectType);
    return `SELECT p.case_id, p.cycle_s, CASE WHEN ${outcomeExpr} THEN 1 ELSE 0 END AS bad
            FROM (${perCase}) p`;
  };

  const totalParams: unknown[] = [];
  const totals = await client.query(
    `SELECT COUNT(*) AS total, SUM(bad) AS bad FROM (${buildFlagged(totalParams)}) f`,
    totalParams,
  );
  const totalCases = countOf(totals.rows[0]?.['total']);
  const outcomeCases = countOf(totals.rows[0]?.['bad']);
  const baseRate = totalCases > 0 ? outcomeCases / totalCases : 0;

  // The outcome activity can never be its own explanation.
  const excluded = new Set<string>(opts.excludeActivities ?? []);
  if (opts.outcome.kind === 'contains' || opts.outcome.kind === 'missing') {
    excluded.add(opts.outcome.activity);
  }

  const raw: Omit<Factor, 'adjustedP' | 'reportable' | 'reason' | 'structural' | 'finding'>[] = [];

  // --- case attributes -----------------------------------------------------
  {
    const params: unknown[] = [];
    const flagged = buildFlagged(params);
    params.push(opts.objectType);
    const typeHole = dialect.placeholder(params.length);
    const attributeRows = await client.query(
      `SELECT ca.key AS name, ca.value AS value,
              COUNT(*) AS cases,
              SUM(f.bad) AS bad
       FROM ${tables.caseAttrs} ca
       JOIN (${flagged}) f ON f.case_id = ca.object_id
       WHERE ca.object_type = ${typeHole} AND ca.value IS NOT NULL
       GROUP BY 1, 2`,
      params,
    );
    for (const row of attributeRows.rows) {
      const cases = countOf(row['cases']);
      if (cases < minCases) continue;
      raw.push(
        buildFactor(
          'attribute',
          String(row['name']),
          String(row['value']),
          cases,
          countOf(row['bad']),
          totalCases,
          outcomeCases,
        ),
      );
    }
  }

  // --- pairs of case attributes -------------------------------------------
  //
  // Some causes only exist as a combination: neither "merchant = Etsy" nor
  // "card = credit" is remarkable alone, while the two together are. Testing
  // singles only leaves that finding invisible.
  //
  // Bounded deliberately. Pairs are quadratic in distinct attribute values, so
  // every pair must clear the same support floor as a single, and the number
  // tested is capped — an unbounded family would also weaken the correction
  // applied to the honest single-factor findings, since they are corrected
  // together.
  const singleFactorCount = raw.length;
  if (opts.pairs !== false) {
    const maxPairs = opts.maxPairFactors ?? DEFAULT_MAX_PAIRS;
    const params: unknown[] = [];
    const flagged = buildFlagged(params);
    params.push(opts.objectType);
    const typeHole = dialect.placeholder(params.length);
    const { rows } = await client.query(
      `SELECT a.key AS k1, a.value AS v1, b.key AS k2, b.value AS v2,
              COUNT(*) AS cases, SUM(f.bad) AS bad
       FROM ${tables.caseAttrs} a
       JOIN ${tables.caseAttrs} b
         ON b.object_type = a.object_type AND b.object_id = a.object_id
        AND a.key < b.key
       JOIN (${flagged}) f ON f.case_id = a.object_id
       WHERE a.object_type = ${typeHole}
         AND a.value IS NOT NULL AND b.value IS NOT NULL
       GROUP BY 1, 2, 3, 4
       HAVING COUNT(*) >= ${Math.trunc(minCases)}
       ORDER BY COUNT(*) DESC
       LIMIT ${Math.trunc(maxPairs)}`,
      params,
    );
    for (const row of rows) {
      raw.push(
        buildFactor(
          'attribute-pair',
          String(row['k1']),
          String(row['v1']),
          countOf(row['cases']),
          countOf(row['bad']),
          totalCases,
          outcomeCases,
          { name: String(row['k2']), value: String(row['v2']) },
        ),
      );
    }
  }

  // --- activities the case performed --------------------------------------
  {
    const params: unknown[] = [];
    const log = logOf(params);
    const flagged = buildFlagged(params);
    const activityRows = await client.query(
      `SELECT activity AS name, COUNT(*) AS cases, SUM(bad) AS bad
       FROM (SELECT DISTINCT l.case_id, l.activity, f.bad
             FROM (${log}) l JOIN (${flagged}) f ON f.case_id = l.case_id) d
       GROUP BY activity`,
      params,
    );
    for (const row of activityRows.rows) {
      const cases = countOf(row['cases']);
      const activity = String(row['name']);
      if (excluded.has(activity)) continue;
      // Present in every case explains nothing: there is no contrast group.
      if (cases < minCases || cases === totalCases) continue;
      raw.push(
        buildFactor('activity', activity, null, cases, countOf(row['bad']), totalCases, outcomeCases),
      );
    }
  }

  const adjusted = benjaminiHochberg(
    raw.map((f) => (Number.isNaN(f.pValue) ? 1 : f.pValue)),
    fdr,
  );

  const evaluated: Factor[] = raw.map((f, i) => {
    const adjustedP = adjusted[i]!.adjusted;
    const significant = adjustedP <= fdr;
    // A lift below this is not worth anyone's time however certain it is.
    const meaningful = f.lift >= 1.2 || f.lift <= 0.83;
    // Perfect separation among ACTIVITIES is structural, not explanatory: two
    // activities that never co-occur are alternative branches of one decision.
    // Among attributes it is an extreme but genuine discovery, so it stands.
    const structural =
      f.kind === 'activity' && (f.outcomeRateWith === 0 || f.outcomeRateWith === 1);
    // A pair earns its place only by beating both halves on their own.
    const redundant = f.kind === 'attribute-pair' && !beatsParents(f, raw, singleFactorCount);
    const reportable = significant && meaningful && !structural && !redundant;
    const reason = structural
      ? `mutually exclusive with the outcome — an alternative branch of the same decision, not an explanation of it`
      : redundant
        ? `adds nothing to ${f.name} = ${f.value} on its own — the pair is the stronger half wearing a longer name`
        : !significant
        ? `not significant after correcting across ${raw.length} factors (q = ${adjustedP.toFixed(3)})`
        : !meaningful
          ? `real but too small to act on (lift ${f.lift.toFixed(2)})`
          : `lift ${f.lift.toFixed(2)}, q = ${adjustedP.toFixed(3)}`;
    return { ...f, adjustedP, reportable, reason, structural, finding: phrase(f) };
  });

  const factors = evaluated
    .filter((f) => f.reportable)
    // Strength first, then breadth: two equally extreme factors are ordered by
    // how many cases they actually cover, so the actionable one comes first.
    .sort(
      (a, b) =>
        Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift)) || b.cases - a.cases,
    )
    .slice(0, opts.limit ?? DEFAULT_LIMIT);

  return {
    objectType: opts.objectType,
    outcome: describeOutcome(opts.outcome),
    totalCases,
    outcomeCases,
    baseRate,
    factors,
    suppressed: evaluated.filter((f) => !f.reportable),
    factorsTested: raw.length,
    fdr,
    summary: summarise(factors, raw.length, outcomeCases, totalCases, describeOutcome(opts.outcome)),
    caveat:
      'These are associations, not causes. A factor may sit downstream of the real driver, or both may follow from something not in the log. Treat each as a place to look, not a conclusion.',
  };
}

function buildFactor(
  kind: 'attribute' | 'activity' | 'attribute-pair',
  name: string,
  value: string | null,
  cases: number,
  badWith: number,
  totalCases: number,
  totalBad: number,
  and?: { name: string; value: string },
): Omit<Factor, 'adjustedP' | 'reportable' | 'reason' | 'structural' | 'finding'> {
  const casesWithout = totalCases - cases;
  const badWithout = totalBad - badWith;
  const rateWith = cases > 0 ? badWith / cases : 0;
  const rateWithout = casesWithout > 0 ? badWithout / casesWithout : 0;

  // Clamp the ratio at both ends, symmetrically.
  //
  // A factor present in every bad case and no good one gives Infinity; one
  // that never coincides with the outcome gives 0. Both are real findings, but
  // ranking uses |log(lift)|, and log(0) is -Infinity — so an unclamped zero
  // sorts above every finite result no matter how strong. Capping at 999 and
  // 1/999 keeps "always" and "never" equally extreme, which is what they are.
  const rawLift =
    rateWithout > 0 ? rateWith / rateWithout : rateWith > 0 ? LIFT_CAP : 1;
  const lift = Math.min(LIFT_CAP, Math.max(1 / LIFT_CAP, rawLift));

  return {
    kind,
    name,
    value,
    cases,
    outcomeRateWith: rateWith,
    outcomeRateWithout: rateWithout,
    lift,
    pValue: twoProportionP(badWith, cases, badWithout, casesWithout),
    effectMagnitude: liftMagnitude(lift),
    and: and ?? null,
  };
}

/**
 * Two-proportion z-test.
 *
 * The outcome is binary — a case is bad or it is not — so this is a comparison
 * of proportions rather than of distributions, and Mann–Whitney does not apply.
 * The normal approximation is used, guarded by the minimum-cases rule above,
 * which is also what keeps it valid.
 */
function twoProportionP(
  successesA: number,
  nA: number,
  successesB: number,
  nB: number,
): number {
  if (nA === 0 || nB === 0) return 1;
  const pooled = (successesA + successesB) / (nA + nB);
  if (pooled <= 0 || pooled >= 1) return 1;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return 1;
  const z = (successesA / nA - successesB / nB) / se;
  return Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))));
}

/** Abramowitz & Stegun 7.1.26 — accurate to ~1e-7, ample for a p-value. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function liftMagnitude(lift: number): EffectMagnitude {
  const ratio = lift >= 1 ? lift : lift > 0 ? 1 / lift : 1;
  if (ratio < 1.2) return 'negligible';
  if (ratio < 1.5) return 'small';
  if (ratio < 2.5) return 'medium';
  return 'large';
}

/**
 * The predicate marking a case as a bad outcome.
 *
 * Synchronous, and the slowest-fraction cutoff arrives pre-resolved: inlining
 * a quantile here would have some planners recompute it per row.
 */
function outcomePredicate(
  outcome: OutcomeSpec,
  cutoff: number | null,
  dialect: SqlDialect,
  params: unknown[],
  tables: { events: string; objects: string; caseAttrs: string },
  objectType: string,
): string {
  switch (outcome.kind) {
    case 'slower-than':
      return `p.cycle_s > ${Number(outcome.seconds)}`;
    case 'slowest-fraction':
      return `p.cycle_s > ${cutoff ?? 0}`;
    case 'contains':
    case 'missing': {
      params.push(objectType);
      const typeHole = dialect.placeholder(params.length);
      params.push(outcome.activity);
      const activityHole = dialect.placeholder(params.length);
      const exists = `EXISTS (SELECT 1 FROM ${tables.events} e
                              JOIN ${tables.objects} o ON o.event_id = e.event_id
                              WHERE o.object_type = ${typeHole} AND o.object_id = p.case_id
                                AND e.activity = ${activityHole})`;
      return outcome.kind === 'contains' ? exists : `NOT ${exists}`;
    }
  }
}

function describeOutcome(outcome: OutcomeSpec): string {
  switch (outcome.kind) {
    case 'slower-than':
      return `cases taking longer than ${(outcome.seconds / 86400).toFixed(1)} days`;
    case 'slowest-fraction':
      return `the slowest ${(outcome.fraction * 100).toFixed(0)}% of cases`;
    case 'contains':
      return `cases that reach "${outcome.activity}"`;
    case 'missing':
      return `cases that never reach "${outcome.activity}"`;
  }
}

type RawFactor = Omit<Factor, 'adjustedP' | 'reportable' | 'reason' | 'structural' | 'finding'>;

/**
 * Does this pair say more than either half alone?
 *
 * The margin is what stops a list filling with near-duplicates. If "Etsy"
 * alone reaches 96.8% and "Etsy AND credit" reaches 97.1%, the pair is not a
 * second finding — it is the first one, restated. Only a pair that lifts
 * meaningfully above BOTH parents describes an interaction.
 *
 * Where a parent was never tested — it fell below the support floor — the pair
 * stands on its own, since there is nothing it could be duplicating.
 */
function beatsParents(f: RawFactor, all: readonly RawFactor[], singleCount: number): boolean {
  if (f.and === null) return true;
  const singles = all.slice(0, singleCount);
  const parentLifts = [
    singles.find((s) => s.kind === 'attribute' && s.name === f.name && s.value === f.value)?.lift,
    singles.find(
      (s) => s.kind === 'attribute' && s.name === f.and?.name && s.value === f.and?.value,
    )?.lift,
  ].filter((l): l is number => l !== undefined);

  if (parentLifts.length === 0) return true;
  const best = Math.max(...parentLifts.map((l) => Math.abs(Math.log(l))));
  return Math.abs(Math.log(f.lift)) >= best * PAIR_MARGIN;
}

function phrase(f: RawFactor): string {
  const subject =
    f.kind === 'attribute-pair'
      ? `cases where ${f.name} = ${f.value} AND ${f.and?.name} = ${f.and?.value}`
      : f.kind === 'attribute'
        ? `cases where ${f.name} = ${f.value}`
        : `cases that do "${f.name}"`;
  const withPct = (f.outcomeRateWith * 100).toFixed(1);
  const withoutPct = (f.outcomeRateWithout * 100).toFixed(1);
  if (f.lift >= 1) {
    return `${subject} hit the outcome ${withPct}% of the time, against ${withoutPct}% otherwise — ${f.lift.toFixed(1)}x more likely (${f.cases.toLocaleString()} cases)`;
  }
  return `${subject} hit the outcome ${withPct}% of the time, against ${withoutPct}% otherwise — ${(1 / f.lift).toFixed(1)}x LESS likely (${f.cases.toLocaleString()} cases)`;
}

function summarise(
  factors: readonly Factor[],
  tested: number,
  outcomeCases: number,
  totalCases: number,
  outcome: string,
): string {
  if (outcomeCases === 0) {
    return `no case matched ${outcome} — nothing to explain`;
  }
  if (outcomeCases === totalCases) {
    return `every case matched ${outcome} — with no contrast there is nothing to compare against`;
  }
  if (factors.length === 0) {
    return `${outcomeCases.toLocaleString()} of ${totalCases.toLocaleString()} cases matched ${outcome}, but none of the ${tested} factors tested explains it. The outcome is spread evenly across everything the log records`;
  }
  const top = factors[0]!;
  return `${outcomeCases.toLocaleString()} of ${totalCases.toLocaleString()} cases matched ${outcome}. Strongest association: ${top.finding}`;
}
