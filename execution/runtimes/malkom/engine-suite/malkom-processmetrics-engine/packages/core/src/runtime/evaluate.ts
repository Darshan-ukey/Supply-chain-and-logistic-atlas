import { ENGINE_DEFAULTS, type EngineDefaults, type PercentileMethod } from '../config/defaults.js';
import type { MetricTarget } from '../config/schemas.js';
import { ConfigInvalidError } from '../domain/errors.js';
import type { Scalar } from '../domain/filter.js';
import type {
  AggregateTrace,
  MetricResult,
  MetricStatus,
  MetricTrace,
  ResolvedWindow,
} from '../domain/types.js';
import type { CompiledAggregate, CompiledMetric } from './compile.js';

/**
 * The pure evaluation core. No I/O, no clocks, no randomness: the same
 * compiled metric, facts and context produce the same MetricResult, forever —
 * which is what makes points replayable and audits meaningful.
 *
 * Pipeline (each stage narrows the row set and is accounted in the trace):
 *   (a) scope filter — equality on dimension fields;
 *   (b) derived fields — business-time values computed per row (BEFORE the
 *       exclusions, whose conditions may reference them; derive args read
 *       raw entity date fields, so the ordering is safe);
 *   (c) exclusions — applied when their effective window contains the LAST
 *       instant inside the evaluation window (endIso − 1ms; windows are
 *       half-open, so the end instant itself belongs to the NEXT window),
 *       in declaration order, counted per exclusion id;
 *   (d) aggregation — rows matching each `where` feed that aggregate;
 *   (e) ratio + percent scaling;
 *   (f) status against the (assignment-merged) target.
 *
 * Multi-source ratios pass facts per role ({ numerator, denominator }); the
 * pipeline runs on each set and aggregate i consumes set i. A plain array is
 * the common single-source form — both aggregates share one pipeline pass.
 */

type Row = Record<string, unknown>;

/**
 * Facts for one evaluation: one array shared by every aggregate, or — for
 * ratio formulas whose numerator and denominator read DIFFERENT sources —
 * one array per role.
 */
export type MetricFacts =
  | ReadonlyArray<Row>
  | { numerator: ReadonlyArray<Row>; denominator: ReadonlyArray<Row> };

export interface EvaluateContext {
  window: ResolvedWindow;
  /** Concrete dimension bindings; omit for an unsliced evaluation. */
  scope?: Record<string, Scalar>;
  /** The caller's clock — feeds ageBusinessMinutes and the trace, nothing else. */
  nowIso: string;
  /** Judge the value against this target (see effectiveTarget); omit ⇒ status "computed". */
  target?: MetricTarget;
  /** Engine-wide fallbacks (percentile method); omit ⇒ the documented defaults. */
  defaults?: EngineDefaults;
}

const PERCENTILE: Readonly<Partial<Record<string, number>>> = { p50: 50, p90: 90, p95: 95, p99: 99 };

/**
 * Coerce a row value where a number is required. Accepts finite numbers and
 * numeric strings (drivers stringify), mirroring scalarEquals' tolerance.
 * null/undefined mean "no value" (the row simply does not contribute);
 * anything else is a skippable junk value the caller counts.
 */
function numericOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null; // 'Infinity'/'NaN' strings are junk, not values
  }
  return null;
}

/**
 * min/max additionally admit date fields (validation allows them): ISO
 * strings resolve to epoch ms, so the extremum of a date field is a number
 * like every other metric value.
 */
function comparableOf(value: unknown): number | null {
  const n = numericOf(value);
  if (n !== null) return n;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Type-aware identity key for countDistinct ("5" and 5 stay distinct). */
function distinctKey(value: unknown): string {
  return `${typeof value}:${String(value)}`;
}

/**
 * The p-th percentile of ascending-sorted values, by the requested method
 * (see percentileMethodSchema): nearest-rank reports a value that actually
 * occurred; linear interpolates between the two closest ranks (R-7).
 */
function percentileOf(sorted: readonly number[], p: number, method: PercentileMethod): number {
  if (method === 'linear') {
    const h = ((sorted.length - 1) * p) / 100;
    const lo = Math.floor(h);
    const hi = Math.min(lo + 1, sorted.length - 1);
    return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
  }
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)]!;
}

interface AggregateOutcome {
  value: number | null;
  trace: AggregateTrace;
  skipped: number;
  usedPercentile: boolean;
}

/** Run one aggregation over the surviving rows. */
function runAggregate(plan: CompiledAggregate, rows: readonly Row[], percentileMethod: PercentileMethod): AggregateOutcome {
  const matched = rows.filter(plan.matches);
  const trace: AggregateTrace = {
    role: plan.role,
    agg: plan.agg,
    field: plan.field,
    rowsIn: matched.length,
    values: matched.length,
  };
  let skipped = 0;

  if (plan.agg === 'count') {
    return { value: matched.length, trace, skipped, usedPercentile: false };
  }

  const field = plan.field!; // schema: every aggregation except bare `count` has a field

  if (plan.agg === 'countDistinct') {
    const seen = new Set<string>();
    for (const row of matched) {
      const v = row[field];
      if (v !== null && v !== undefined) seen.add(distinctKey(v));
    }
    trace.values = seen.size;
    return { value: seen.size, trace, skipped, usedPercentile: false };
  }

  // Numeric aggregations: collect non-null coercible values, count the junk.
  const coerce = plan.agg === 'min' || plan.agg === 'max' ? comparableOf : numericOf;
  const values: number[] = [];
  for (const row of matched) {
    const v = row[field];
    if (v === null || v === undefined) continue;
    const n = coerce(v);
    if (n === null) skipped += 1;
    else values.push(n);
  }
  trace.values = values.length;

  let value: number | null;
  let usedPercentile = false;
  switch (plan.agg) {
    case 'sum':
      value = values.reduce((a, b) => a + b, 0); // empty ⇒ 0 by definition
      break;
    case 'avg':
      value = values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
      break;
    case 'min':
      value = values.length === 0 ? null : Math.min(...values);
      break;
    case 'max':
      value = values.length === 0 ? null : Math.max(...values);
      break;
    default: {
      // p50/p90/p95/p99 — by the resolved percentile method.
      usedPercentile = true;
      const p = PERCENTILE[plan.agg];
      if (p === undefined || values.length === 0) {
        value = null;
        break;
      }
      const sorted = [...values].sort((a, b) => a - b);
      value = percentileOf(sorted, p, percentileMethod);
      break;
    }
  }
  return { value, trace, skipped, usedPercentile };
}

/**
 * Status of a value against a target. Follows the direction of "better":
 * meeting the target attains it; missing it is a breach when the value falls
 * past thresholds.breach (or immediately, when no thresholds were declared);
 * anything in between is a warn. The warn threshold itself is advisory
 * (UI/annotation) — status only needs the breach line.
 */
export function statusForValue(value: number | null, target?: MetricTarget): MetricStatus {
  if (value === null) return 'no_data';
  if (target === undefined) return 'computed';
  const { thresholds } = target;
  if (target.direction === 'higher_is_better') {
    if (value >= target.value) return 'attained';
    if (thresholds === undefined) return 'breach';
    return thresholds.breach !== undefined && value < thresholds.breach ? 'breach' : 'warn';
  }
  if (value <= target.value) return 'attained';
  if (thresholds === undefined) return 'breach';
  return thresholds.breach !== undefined && value > thresholds.breach ? 'breach' : 'warn';
}

/** One pipeline pass — stages (a) to (c) — over one fact set. */
interface PipelineOutcome {
  rows: Row[];
  factsIn: number;
  scopeFiltered: number;
  /** Rows removed per exclusion id (0 for inactive exclusions). */
  excluded: number[];
}

function runPipeline(
  compiled: CompiledMetric,
  facts: ReadonlyArray<Row>,
  ctx: EvaluateContext,
  nowMs: number,
): PipelineOutcome {
  // (a) scope filter — equality on dimension fields.
  let rows: Row[] = [...facts];
  if (ctx.scope !== undefined && Object.keys(ctx.scope).length > 0) {
    const scope = ctx.scope;
    rows = rows.filter((row) => compiled.scopeMatches(row, scope));
  }
  const scopeFiltered = rows.length;

  // (b) derived fields — computed from the ORIGINAL row values (derive args
  // are entity date fields, never other derived fields) BEFORE exclusions,
  // whose conditions tier-1 allows to reference derived fields.
  if (compiled.derived.length > 0) {
    rows = rows.map((row) => {
      const out: Row = { ...row };
      for (const d of compiled.derived) out[d.name] = d.compute(row, nowMs);
      return out;
    });
  }

  // (c) exclusions — active when their effective window contains the LAST
  // instant inside the evaluation window. Windows are half-open, so judging
  // at endIso itself would attribute the point to the NEXT period (a
  // month-dated [Aug 1, Sep 1) exclusion must hit August's window, whose end
  // IS Sep 1 — not July's).
  const judgedAtIso = new Date(Date.parse(ctx.window.endIso) - 1).toISOString();
  const excluded: number[] = [];
  for (const exclusion of compiled.exclusions) {
    if (!exclusion.activeAt(judgedAtIso)) {
      excluded.push(0);
      continue;
    }
    const before = rows.length;
    rows = rows.filter((row) => !exclusion.matches(row));
    excluded.push(before - rows.length);
  }

  return { rows, factsIn: facts.length, scopeFiltered, excluded };
}

/** Evaluate a compiled metric over in-memory facts. Pure. */
export function evaluateMetric(compiled: CompiledMetric, facts: MetricFacts, ctx: EvaluateContext): MetricResult {
  const def = compiled.definition;
  const nowMs = Date.parse(ctx.nowIso);
  if (Number.isNaN(nowMs)) {
    throw new ConfigInvalidError(`evaluateMetric: nowIso is not a parseable instant: ${JSON.stringify(ctx.nowIso)}`);
  }

  // Normalize facts into one pipeline pass per fact set. The plain-array form
  // shares a single pass across every aggregate; the per-role form (only
  // meaningful for ratios reading two sources) runs the pass per set.
  let passes: PipelineOutcome[];
  let rowsFor: (aggregateIndex: number) => readonly Row[];
  if (Array.isArray(facts)) {
    const pass = runPipeline(compiled, facts as ReadonlyArray<Row>, ctx, nowMs);
    passes = [pass];
    rowsFor = () => pass.rows;
  } else {
    if (def.formula.kind !== 'ratio') {
      throw new ConfigInvalidError(
        `evaluateMetric: per-role facts ({ numerator, denominator }) require a ratio formula; metric "${def.name}" is "${def.formula.kind}"`,
      );
    }
    const split = facts as { numerator: ReadonlyArray<Row>; denominator: ReadonlyArray<Row> };
    passes = [runPipeline(compiled, split.numerator, ctx, nowMs), runPipeline(compiled, split.denominator, ctx, nowMs)];
    rowsFor = (i) => passes[i]!.rows;
  }

  // (d) aggregations — resolved percentile method: definition options win,
  // then the caller's EngineDefaults, then the documented defaults.
  const percentileMethod =
    def.options?.percentileMethod ?? ctx.defaults?.percentileMethod ?? ENGINE_DEFAULTS.percentileMethod;
  const outcomes = compiled.aggregates.map((plan, i) => runAggregate(plan, rowsFor(i), percentileMethod));
  const skippedValues = outcomes.reduce((a, o) => a + o.skipped, 0);
  const usedPercentile = outcomes.some((o) => o.usedPercentile);

  // (e) combine: single aggregate, or ratio with percent scaling.
  let value: number | null;
  let numerator: number | null | undefined;
  let denominator: number | null | undefined;
  if (def.formula.kind === 'aggregate') {
    value = outcomes[0]!.value;
  } else {
    numerator = outcomes[0]!.value;
    denominator = outcomes[1]!.value;
    if (numerator === null || denominator === null || denominator === 0) {
      value = null; // zero denominator is "nothing to measure", not zero
    } else {
      value = numerator / denominator;
      if (def.metricType === 'percent') value *= 100;
    }
  }

  // (f) status vs target.
  const status = statusForValue(value, ctx.target);

  // Per-exclusion counts summed across passes, in declaration order.
  const excluded: Record<string, number> = {};
  compiled.exclusions.forEach((exclusion, i) => {
    excluded[exclusion.id] = passes.reduce((a, p) => a + p.excluded[i]!, 0);
  });

  const trace: MetricTrace = {
    factsIn: passes.reduce((a, p) => a + p.factsIn, 0),
    scopeFiltered: passes.reduce((a, p) => a + p.scopeFiltered, 0),
    excluded,
    anchor: def.anchor,
    derivedFields: compiled.derived.map((d) => d.name),
    aggregates: outcomes.map((o) => o.trace),
    skippedValues,
    evaluatedAt: ctx.nowIso,
  };
  if (usedPercentile) trace.percentileMethod = percentileMethod;
  if (compiled.calendar !== undefined) {
    trace.calendar =
      compiled.calendar.version !== undefined
        ? { name: compiled.calendar.name, version: compiled.calendar.version }
        : { name: compiled.calendar.name };
  }

  const result: MetricResult = {
    metric: def.name,
    kind: def.kind,
    metricType: def.metricType,
    unit: def.unit,
    value,
    status,
    window: ctx.window,
    trace,
  };
  if (def.formula.kind === 'ratio') {
    result.numerator = numerator ?? null;
    result.denominator = denominator ?? null;
  }
  if (ctx.target !== undefined) result.target = ctx.target;
  return result;
}
