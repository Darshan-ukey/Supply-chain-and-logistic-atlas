import { countOf, numberOrNull } from '../domain/identifiers.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { allOf, type CaseFilter } from './filter.js';
import { buildLog, perCaseSql, type LogQueryOptions } from './logquery.js';
import { analyseRework } from './rework.js';

/**
 * The bridge to declared targets — the processmetrics engine's side of the
 * platform.
 *
 * Two engines answer two different questions about the same process. Metrics
 * holds what the business SAID should happen: the SLA, the threshold, the KPI
 * with its calendar and its owner. Mining measures what actually did. Neither
 * is the other's source of truth, and the useful output is precisely where
 * they disagree.
 *
 * Deliberately NOT a dependency on that engine. Targets arrive as plain data,
 * so this works whether they came from processmetrics, a config file, or a
 * spreadsheet somebody keeps — and neither engine can break the other's build.
 * Duplicating the target definitions here would give the platform two answers
 * to "what is the SLA", which is worse than having none.
 *
 * What this does NOT do is decide whether a breach matters. It reports the
 * declared number, the observed number, and the population each was measured
 * over. Escalation is the rules engine's job.
 */

export type Comparator = 'at-most' | 'at-least';

export type TargetMetric =
  /**
   * End-to-end case time.
   *
   * `statistic` matters more than it looks. "Cases must complete within five
   * days" is almost never a claim about the mean — it is a claim about the
   * 90th percentile, or about the share of cases that made it. Measuring a
   * skewed distribution with its average is how a process passes its SLA on
   * paper while a fifth of its cases are late.
   */
  | { kind: 'cycle-time'; statistic: 'median' | 'p90' | 'p95' | 'mean'; seconds: number; comparator: Comparator }
  /** Share of cases finishing inside a time budget, 0–1. The honest SLA form. */
  | { kind: 'on-time-rate'; withinSeconds: number; rate: number; comparator: Comparator }
  /** Share of cases that ever reach an activity, 0–1. */
  | { kind: 'completion-rate'; activity: string; rate: number; comparator: Comparator }
  /** Share of cases repeating a step, 0–1. Named or any. */
  | { kind: 'rework-rate'; activity?: string; rate: number; comparator: Comparator };

export interface DeclaredTarget {
  /** The metrics engine's id, echoed back so a caller can join the two. */
  id: string;
  name: string;
  metric: TargetMetric;
  /** Cases this target applies to. Omitted means every case in the selection. */
  filter?: CaseFilter | undefined;
}

export interface TargetCheck {
  id: string;
  name: string;
  metric: TargetMetric;
  /** What was declared. */
  target: number;
  /** What the log actually shows. Null when nothing could be measured. */
  observed: number | null;
  /** True when the observation satisfies the declared comparator. */
  meets: boolean | null;
  /**
   * observed − target, in the metric's own units. Positive means above the
   * declared number, whichever direction is good.
   */
  gap: number | null;
  /** Cases the observation was computed over. */
  casesEvaluated: number;
  /** One sentence, safe to quote. */
  finding: string;
}

export interface TargetReport {
  objectType: string;
  checks: TargetCheck[];
  /** Targets the log fails. */
  breaches: TargetCheck[];
  /**
   * Targets that could not be measured at all — the data does not support them.
   *
   * Kept separate from breaches on purpose. "We cannot tell" and "we are
   * failing" call for completely different responses, and folding the first
   * into the second manufactures alarm.
   */
  unmeasurable: TargetCheck[];
  summary: string;
}

export interface TargetOptions extends LogQueryOptions {
  targets: readonly DeclaredTarget[];
}

export async function reconcileTargets(
  client: SqlClient,
  dialect: SqlDialect,
  opts: TargetOptions,
): Promise<TargetReport> {
  const checks: TargetCheck[] = [];

  for (const target of opts.targets) {
    // A target's own filter narrows the ambient selection rather than
    // replacing it: a user exploring "web cases" and checking an SLA scoped to
    // "priority orders" means the intersection, not one or the other.
    const scoped: LogQueryOptions = {
      ...opts,
      ...(allOf(opts.filter, target.filter) !== undefined
        ? { filter: allOf(opts.filter, target.filter)! }
        : {}),
    };
    checks.push(await measure(client, dialect, scoped, target));
  }

  const breaches = checks.filter((c) => c.meets === false);
  const unmeasurable = checks.filter((c) => c.meets === null);

  return {
    objectType: opts.objectType,
    checks,
    breaches,
    unmeasurable,
    summary: summarise(checks, breaches, unmeasurable),
  };
}

async function measure(
  client: SqlClient,
  dialect: SqlDialect,
  opts: LogQueryOptions,
  target: DeclaredTarget,
): Promise<TargetCheck> {
  const metric = target.metric;
  const { observed, cases } = await observe(client, dialect, opts, metric);

  const declared = metric.kind === 'cycle-time' ? metric.seconds : metric.rate;
  const meets =
    observed === null
      ? null
      : metric.comparator === 'at-most'
        ? observed <= declared
        : observed >= declared;

  return {
    id: target.id,
    name: target.name,
    metric,
    target: declared,
    observed,
    meets,
    gap: observed === null ? null : observed - declared,
    casesEvaluated: cases,
    finding: phrase(target, observed, declared, meets, cases),
  };
}

async function observe(
  client: SqlClient,
  dialect: SqlDialect,
  opts: LogQueryOptions,
  metric: TargetMetric,
): Promise<{ observed: number | null; cases: number }> {
  if (metric.kind === 'rework-rate') {
    const report = await analyseRework(client, dialect, opts);
    if (report.totalCases === 0) return { observed: null, cases: 0 };
    if (metric.activity === undefined) {
      return { observed: report.reworkRate, cases: report.totalCases };
    }
    const activity = report.activities.find((a) => a.activity === metric.activity);
    // No entry means the step was never repeated — a real zero, not a gap.
    return {
      observed: (activity?.casesWithRepeat ?? 0) / report.totalCases,
      cases: report.totalCases,
    };
  }

  const params: unknown[] = [];
  const log = buildLog(dialect, params, opts).sql;
  const perCase = perCaseSql(log, dialect);

  if (metric.kind === 'completion-rate') {
    params.push(metric.activity);
    const activityHole = dialect.placeholder(params.length);
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cases,
              SUM(CASE WHEN reached > 0 THEN 1 ELSE 0 END) AS reached
       FROM (SELECT case_id,
                    SUM(CASE WHEN activity = ${activityHole} THEN 1 ELSE 0 END) AS reached
             FROM (${log}) l GROUP BY case_id) c`,
      params,
    );
    const cases = countOf(rows[0]?.['cases']);
    return {
      observed: cases === 0 ? null : countOf(rows[0]?.['reached']) / cases,
      cases,
    };
  }

  if (metric.kind === 'on-time-rate') {
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cases,
              SUM(CASE WHEN cycle_s <= ${Number(metric.withinSeconds)} THEN 1 ELSE 0 END) AS on_time
       FROM (${perCase}) c`,
      params,
    );
    const cases = countOf(rows[0]?.['cases']);
    return { observed: cases === 0 ? null : countOf(rows[0]?.['on_time']) / cases, cases };
  }

  const expression =
    metric.statistic === 'mean'
      ? 'AVG(cycle_s)'
      : metric.statistic === 'median'
        ? dialect.medianOf('cycle_s')
        : dialect.quantileOf('cycle_s', metric.statistic === 'p90' ? 0.9 : 0.95);

  const { rows } = await client.query(
    `SELECT COUNT(*) AS cases, ${expression} AS value FROM (${perCase}) c`,
    params,
  );
  const cases = countOf(rows[0]?.['cases']);
  return { observed: cases === 0 ? null : numberOrNull(rows[0]?.['value']), cases };
}

function phrase(
  target: DeclaredTarget,
  observed: number | null,
  declared: number,
  meets: boolean | null,
  cases: number,
): string {
  if (observed === null || meets === null) {
    return `${target.name}: nothing to measure in this selection — the target neither holds nor fails`;
  }
  const metric = target.metric;
  const fmt = metric.kind === 'cycle-time' ? duration : percent;
  const verb = meets ? 'meets' : 'misses';
  const direction = metric.comparator === 'at-most' ? 'at most' : 'at least';
  return (
    `${target.name} ${verb} its target: ${fmt(observed)} against ${direction} ` +
    `${fmt(declared)}, over ${cases.toLocaleString()} cases`
  );
}

function summarise(
  checks: readonly TargetCheck[],
  breaches: readonly TargetCheck[],
  unmeasurable: readonly TargetCheck[],
): string {
  if (checks.length === 0) return 'no targets supplied';
  const met = checks.filter((c) => c.meets === true).length;
  const parts = [`${met} of ${checks.length} targets met`];
  if (breaches.length > 0) parts.push(`${breaches.length} breached`);
  // Reported separately, always: silence here would read as "all fine".
  if (unmeasurable.length > 0) parts.push(`${unmeasurable.length} not measurable from this log`);
  return parts.join(', ');
}

function duration(seconds: number): string {
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
