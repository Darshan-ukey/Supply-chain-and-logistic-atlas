import type { AggFn, AggSpec, Assignment, DeriveSpec, MetricDefinition, MetricTarget } from '../config/schemas.js';
import { validateMetricDefinition } from '../config/validate.js';
import { ConfigInvalidError } from '../domain/errors.js';
import { evaluateFilter, instantMsOf, scalarEquals, type FilterContext, type Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { AggregateRole } from '../domain/types.js';
import type { CompiledCalendar } from './calendar.js';

/**
 * Metric compilation: a tier-1-clean definition + registry (+ calendar) →
 * the precompiled evaluators the pure evaluation core consumes. Compilation
 * is the trust boundary — evaluateMetric never re-validates, so compileMetric
 * REFUSES definitions that are not tier-1 clean rather than computing
 * plausible-looking numbers from broken references.
 *
 * Row predicates reuse the family's pure in-memory FilterExpr matcher
 * (domain/filter.ts, ported from the rules engine) with the registry's
 * value-set resolver bound in; scope matching and null semantics ride on the
 * same scalarEquals the filter language uses, so "equal" means one thing
 * everywhere.
 */

/** Half-open effective-window containment: from <= at < to (epoch-compared). */
function instantInWindow(atIso: string, from?: string, to?: string): boolean {
  const at = Date.parse(atIso);
  if (from !== undefined && at < Date.parse(from)) return false;
  if (to !== undefined && at >= Date.parse(to)) return false;
  return true;
}

/** A per-row derived-field evaluator, calendar already bound. */
export interface CompiledDerivedField {
  readonly name: string;
  /** null when any argument value is missing/null/unparseable. */
  readonly compute: (row: Record<string, unknown>, nowMs: number) => number | null;
}

/** One exclusion, precompiled: row matcher + effective-dating test. */
export interface CompiledExclusion {
  readonly id: string;
  readonly reason: string;
  readonly matches: (row: Record<string, unknown>) => boolean;
  /** Does the exclusion's effective window (if any) contain this instant? */
  readonly activeAt: (atIso: string) => boolean;
}

/** One aggregation, precompiled: its `where` is already a row predicate. */
export interface CompiledAggregate {
  readonly role: AggregateRole;
  readonly agg: AggFn;
  /** Aggregated field id (registry or derived); null for bare `count`. */
  readonly field: string | null;
  readonly matches: (row: Record<string, unknown>) => boolean;
}

/** A metric ready to evaluate: definition + every precompiled evaluator. */
export interface CompiledMetric {
  readonly definition: MetricDefinition;
  readonly registryVersion: number;
  readonly calendar: CompiledCalendar | undefined;
  readonly dimensions: readonly string[];
  readonly derived: readonly CompiledDerivedField[];
  readonly exclusions: readonly CompiledExclusion[];
  /** One entry for `aggregate` formulas, numerator + denominator for ratios. */
  readonly aggregates: readonly CompiledAggregate[];
  /** Scope equality on dimension fields (scalarEquals semantics). */
  readonly scopeMatches: (row: Record<string, unknown>, scope: Record<string, Scalar>) => boolean;
  /** Definition effective-dating: half-open [effectiveFrom, effectiveTo). */
  readonly activeAt: (atIso: string) => boolean;
}

function compileDerived(name: string, spec: DeriveSpec, calendar: CompiledCalendar): CompiledDerivedField {
  switch (spec.fn) {
    case 'businessMinutesBetween':
    case 'businessDaysBetween': {
      const [fromField, toField] = spec.args as [string, string];
      const fn = spec.fn;
      return {
        name,
        compute: (row) => {
          const from = instantMsOf(row[fromField]);
          const to = instantMsOf(row[toField]);
          if (from === null || to === null) return null;
          return fn === 'businessMinutesBetween'
            ? calendar.businessMinutesBetween(from, to)
            : calendar.businessDaysBetween(from, to);
        },
      };
    }
    case 'ageBusinessMinutes': {
      const [field] = spec.args as [string];
      return {
        name,
        compute: (row, nowMs) => {
          const from = instantMsOf(row[field]);
          return from === null ? null : calendar.ageBusinessMinutes(from, nowMs);
        },
      };
    }
  }
}

function compileAggregate(role: AggregateRole, spec: AggSpec, ctx: FilterContext): CompiledAggregate {
  const where = spec.where;
  return {
    role,
    agg: spec.agg,
    field: spec.field ?? null,
    matches: where === undefined ? () => true : (row) => evaluateFilter(where, row, ctx),
  };
}

/**
 * Compile a metric definition against a registry and (when the definition
 * uses business time) its calendar. Throws ConfigInvalidError listing every
 * tier-1 issue when the definition is not clean — the calendar argument
 * doubles as the "known calendars" universe for that validation, so a
 * definition whose calendarRef does not match the provided calendar fails
 * here too.
 */
export function compileMetric(
  def: MetricDefinition,
  registry: CompiledRegistry,
  calendar?: CompiledCalendar,
): CompiledMetric {
  const issues = validateMetricDefinition(def, registry, calendar === undefined ? [] : [{ name: calendar.name }]);
  if (issues.length > 0) {
    throw new ConfigInvalidError(
      `metric "${def.name}" is not tier-1 clean (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
      issues.map((i) => `${i.path}: ${i.message}`),
    );
  }

  const filterCtx = registry.filterContext();

  const deriveSpecs = Object.entries(def.derive ?? {});
  let derived: CompiledDerivedField[] = [];
  if (deriveSpecs.length > 0) {
    // Tier-1 cleanliness guarantees the calendar is present here.
    if (calendar === undefined) throw new ConfigInvalidError(`metric "${def.name}" derives business time without a calendar`);
    derived = deriveSpecs.map(([name, spec]) => compileDerived(name, spec, calendar));
  }

  const exclusions: CompiledExclusion[] = (def.exclusions ?? []).map((ex) => ({
    id: ex.id,
    reason: ex.reason,
    matches: (row) => evaluateFilter(ex.when, row, filterCtx),
    activeAt: (atIso) => instantInWindow(atIso, ex.effectiveFrom, ex.effectiveTo),
  }));

  const aggregates: CompiledAggregate[] =
    def.formula.kind === 'aggregate'
      ? [compileAggregate('over', def.formula.over, filterCtx)]
      : [
          compileAggregate('numerator', def.formula.numerator, filterCtx),
          compileAggregate('denominator', def.formula.denominator, filterCtx),
        ];

  return {
    definition: def,
    registryVersion: registry.version,
    calendar,
    dimensions: [...def.scope.dimensions],
    derived,
    exclusions,
    aggregates,
    scopeMatches: (row, scope) => Object.entries(scope).every(([field, value]) => scalarEquals(row[field], value)),
    activeAt: (atIso) => instantInWindow(atIso, def.effectiveFrom, def.effectiveTo),
  };
}

/**
 * The target an evaluation should judge against: the definition's target
 * with the assignment's override merged in. `value` and `thresholds`
 * override individually — an override may replace either or both; a provided
 * `thresholds` block replaces the definition's block wholesale (warn/breach
 * are validated together, so they travel together). Direction is never
 * overridable — flipping "better" per team would make one metric mean two
 * things.
 */
export function effectiveTarget(def: MetricDefinition, assignment?: Assignment): MetricTarget {
  const base = def.target;
  const override = assignment?.targetOverride;
  if (override === undefined) return base;
  const merged: MetricTarget = { value: override.value ?? base.value, direction: base.direction };
  const thresholds = override.thresholds ?? base.thresholds;
  if (thresholds !== undefined) merged.thresholds = thresholds;
  return merged;
}
