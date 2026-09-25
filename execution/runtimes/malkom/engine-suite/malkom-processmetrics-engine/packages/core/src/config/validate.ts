import { z } from 'zod';
import { ConfigInvalidError } from '../domain/errors.js';
import { compileRegex, REGEX_PATTERN_MAX, type FilterExpr, type Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { SqlClient, SqlIntrospector } from '../ports/sql.js';
import {
  registryDocSchema,
  type AggSpec,
  type Assignment,
  type MetricDefinition,
  type RegistryDoc,
  type RegistryDocInput,
  type Thresholds,
} from './schemas.js';

/**
 * Tier-1 static validation: shape via zod, then the cross-references zod
 * cannot express — field existence, value-set resolution, binding sanity.
 * Errors block; warnings inform.
 *
 * Every issue is keyed to an AST node path ("entities[0].fields[1].id") so a
 * metric-builder UI can red-underline the exact widget.
 *
 * Tier-2 (validateMetricLive, below) checks the same references against the
 * LIVE database schema through the SqlIntrospector port — it needs a
 * connection, so it is async and never runs implicitly.
 */

export interface ValidationIssue {
  path: string;
  /** Stable machine code for tier-1 issues; registry-doc issues predate codes. */
  code?: string;
  message: string;
  /**
   * Advisory issues carry 'warning' — they inform a verdict without failing
   * it (e.g. tier-2's anchor_encoding_suspect). Absent = error.
   */
  severity?: 'warning';
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    path: i.path.map((p) => (typeof p === 'number' ? `[${p}]` : p)).join('.').replace(/\.\[/g, '['),
    message: i.message,
  }));
}

function result(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Registry validation
// ---------------------------------------------------------------------------

export function validateRegistryDoc(input: RegistryDocInput): {
  result: ValidationResult;
  doc?: RegistryDoc;
} {
  const parsed = registryDocSchema.safeParse(input);
  if (!parsed.success) return { result: result(zodIssues(parsed.error), []) };

  const doc = parsed.data;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const setIds = new Set<string>();
  doc.valueSets.forEach((vs, i) => {
    if (setIds.has(vs.id)) errors.push({ path: `valueSets[${i}].id`, message: `duplicate value-set id "${vs.id}"` });
    setIds.add(vs.id);
  });

  const entityIds = new Set<string>();
  doc.entities.forEach((e, i) => {
    const base = `entities[${i}]`;
    if (entityIds.has(e.id)) errors.push({ path: `${base}.id`, message: `duplicate entity id "${e.id}"` });
    entityIds.add(e.id);

    const fieldIds = new Set<string>();
    e.fields.forEach((f, j) => {
      const fbase = `${base}.fields[${j}]`;
      if (fieldIds.has(f.id)) errors.push({ path: `${fbase}.id`, message: `duplicate field id "${f.id}" in entity "${e.id}"` });
      fieldIds.add(f.id);
      if (f.valueSet !== undefined && f.values !== undefined) {
        errors.push({ path: fbase, message: 'declare either "valueSet" or inline "values", not both' });
      }
      if (f.valueSet !== undefined && !setIds.has(f.valueSet)) {
        errors.push({ path: `${fbase}.valueSet`, message: `unknown value-set "${f.valueSet}"` });
      }
    });

    if (e.subQueueField !== undefined && !fieldIds.has(e.subQueueField)) {
      errors.push({ path: `${base}.subQueueField`, message: `"${e.subQueueField}" is not a declared field of entity "${e.id}"` });
    }
    if (e.connectionRef !== undefined && e.table === undefined) {
      warnings.push({ path: `${base}.connectionRef`, message: 'connectionRef without a table binding has no effect' });
    }
    if (e.table !== undefined && e.connectionRef === undefined) {
      warnings.push({ path: `${base}.table`, message: 'table declared without connectionRef — tier-2 validation and computation reads need a connection' });
    }
  });

  return { result: result(errors, warnings), doc };
}

// ---------------------------------------------------------------------------
// Metric-definition validation against a compiled registry
// ---------------------------------------------------------------------------

/** Stable issue codes for tier-1 definition/assignment validation. */
export type MetricIssueCode =
  | 'unknown_source'
  | 'unknown_field'
  | 'unknown_value_set'
  | 'value_not_allowed'
  | 'type_mismatch'
  | 'bad_pattern'
  | 'derived_name_collision'
  | 'derive_arg_not_date'
  | 'anchor_not_date'
  | 'formula_kind_mismatch'
  | 'threshold_order'
  | 'window_unsupported'
  | 'calendar_required'
  | 'unknown_calendar'
  | 'bad_effective_window'
  | 'scope_key_missing'
  | 'scope_key_unexpected'
  // tier-2 (live schema) codes
  | 'missing_table'
  | 'missing_column'
  | 'anchor_encoding_suspect';

function scalarTypeName(v: Scalar): 'string' | 'number' | 'boolean' | 'null' {
  if (v === null) return 'null';
  return typeof v as 'string' | 'number' | 'boolean';
}

/** Can a literal of this runtime type legally compare against the field type? */
function typeCompatible(fieldType: string, v: Scalar): boolean {
  const t = scalarTypeName(v);
  if (t === 'null') return true;
  // Dates travel as ISO strings or epoch numbers.
  if (fieldType === 'date') return t === 'string' || t === 'number';
  return fieldType === t;
}

/** How a field reference resolved: a registry field or a derived field. */
interface ResolvedField {
  type: 'string' | 'number' | 'boolean' | 'date';
  derived: boolean;
}

/** Registry field first; derived business-time fields are always numeric. */
function resolveField(
  registry: CompiledRegistry,
  entityId: string,
  fieldId: string,
  derivedNames: ReadonlySet<string>,
): ResolvedField | undefined {
  const f = registry.field(entityId, fieldId);
  if (f) return { type: f.type, derived: false };
  if (derivedNames.has(fieldId)) return { type: 'number', derived: true };
  return undefined;
}

/**
 * Walk a FilterExpr, checking every term against the source entity (plus
 * derived names): field existence, value-set resolution, literal type
 * compatibility, and value-set membership on eq/in.
 */
function checkFilterExpr(
  expr: FilterExpr,
  entityId: string,
  derivedNames: ReadonlySet<string>,
  registry: CompiledRegistry,
  path: string,
  issues: ValidationIssue[],
): void {
  switch (expr.op) {
    case 'and':
    case 'or':
      expr.args.forEach((a, i) => checkFilterExpr(a, entityId, derivedNames, registry, `${path}.args[${i}]`, issues));
      return;
    case 'not':
      checkFilterExpr(expr.arg, entityId, derivedNames, registry, `${path}.arg`, issues);
      return;
    default:
      break;
  }

  const field = resolveField(registry, entityId, expr.field, derivedNames);
  if (!field) {
    issues.push({
      path: `${path}.field`,
      code: 'unknown_field',
      message: `field "${expr.field}" is not declared on entity "${entityId}"`,
    });
  }
  if (expr.op === 'inSet' && registry.valueSet(expr.set) === undefined) {
    issues.push({ path: `${path}.set`, code: 'unknown_value_set', message: `unknown value-set "${expr.set}"` });
  }
  // `matches` is a regex over TEXT: the pattern must compile (the schema
  // already refuses non-compiling patterns; re-checked here so a definition
  // assembled programmatically cannot smuggle one past tier 1) and the field
  // must be string-typed — regex over numbers/booleans/dates is a config
  // smell, not a computation.
  if (expr.op === 'matches') {
    if (compileRegex(expr.pattern) === null) {
      issues.push({
        path: `${path}.pattern`,
        code: 'bad_pattern',
        message: `pattern ${JSON.stringify(expr.pattern)} is not a valid ECMAScript regex (max ${REGEX_PATTERN_MAX} chars)`,
      });
    }
    if (field && field.type !== 'string') {
      issues.push({
        path: `${path}.field`,
        code: 'bad_pattern',
        message: `"matches" needs a string field; "${expr.field}" is ${field.derived ? 'a derived (numeric) field' : field.type}`,
      });
    }
    return;
  }
  if (!field) return;

  const legal = field.derived ? undefined : registry.fieldValues(entityId, expr.field);
  const checkLiteral = (v: Scalar, at: string, membership: boolean): void => {
    if (!typeCompatible(field.type, v)) {
      issues.push({
        path: at,
        code: 'type_mismatch',
        message: `literal ${JSON.stringify(v)} does not match type "${field.type}" of field "${expr.field}"`,
      });
      return;
    }
    if (membership && legal && v !== null && !legal.some((x) => x === v)) {
      issues.push({
        path: at,
        code: 'value_not_allowed',
        message: `value ${JSON.stringify(v)} is not among the legal values of field "${expr.field}"`,
      });
    }
  };

  switch (expr.op) {
    case 'eq':
      checkLiteral(expr.value, `${path}.value`, true);
      return;
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      checkLiteral(expr.value, `${path}.value`, false);
      return;
    case 'in':
      expr.values.forEach((v, i) => checkLiteral(v, `${path}.values[${i}]`, true));
      return;
    case 'notIn':
      expr.values.forEach((v, i) => checkLiteral(v, `${path}.values[${i}]`, false));
      return;
    default:
      return; // isNull / isNotNull / inSet carry no literals
  }
}

/** Aggregations whose input must be numeric. */
const NUMERIC_AGGS: ReadonlySet<string> = new Set(['sum', 'avg', 'p50', 'p90', 'p95', 'p99']);

function checkAggSpec(
  spec: AggSpec,
  derivedNames: ReadonlySet<string>,
  registry: CompiledRegistry,
  path: string,
  issues: ValidationIssue[],
): void {
  if (spec.field !== undefined) {
    const field = resolveField(registry, spec.source, spec.field, derivedNames);
    if (!field) {
      issues.push({
        path: `${path}.field`,
        code: 'unknown_field',
        message: `field "${spec.field}" is not declared on entity "${spec.source}"`,
      });
    } else if (NUMERIC_AGGS.has(spec.agg) && field.type !== 'number') {
      issues.push({
        path: `${path}.field`,
        code: 'type_mismatch',
        message: `agg "${spec.agg}" needs a numeric field; "${spec.field}" is ${field.type}`,
      });
    } else if ((spec.agg === 'min' || spec.agg === 'max') && field.type !== 'number' && field.type !== 'date') {
      issues.push({
        path: `${path}.field`,
        code: 'type_mismatch',
        message: `agg "${spec.agg}" needs a numeric or date field; "${spec.field}" is ${field.type}`,
      });
    }
  }
  if (spec.where !== undefined) {
    checkFilterExpr(spec.where, spec.source, derivedNames, registry, `${path}.where`, issues);
  }
}

function checkEffectiveWindow(
  from: string | undefined,
  to: string | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (from !== undefined && to !== undefined && Date.parse(from) >= Date.parse(to)) {
    issues.push({
      path,
      code: 'bad_effective_window',
      message: 'effectiveTo must be after effectiveFrom (half-open [from, to))',
    });
  }
}

function checkThresholdOrder(
  value: number,
  direction: 'higher_is_better' | 'lower_is_better',
  thresholds: Thresholds | undefined,
  basePath: string,
  issues: ValidationIssue[],
): void {
  if (thresholds === undefined) return;
  const { warn, breach } = thresholds;
  if (direction === 'higher_is_better') {
    if (warn !== undefined && warn > value) {
      issues.push({
        path: `${basePath}.warn`,
        code: 'threshold_order',
        message: `warn (${warn}) must be ≤ target value (${value}) when higher is better`,
      });
    }
    if (breach !== undefined && warn !== undefined && breach > warn) {
      issues.push({
        path: `${basePath}.breach`,
        code: 'threshold_order',
        message: `breach (${breach}) must be ≤ warn (${warn}) when higher is better`,
      });
    } else if (breach !== undefined && warn === undefined && breach > value) {
      issues.push({
        path: `${basePath}.breach`,
        code: 'threshold_order',
        message: `breach (${breach}) must be ≤ target value (${value}) when higher is better`,
      });
    }
  } else {
    if (warn !== undefined && warn < value) {
      issues.push({
        path: `${basePath}.warn`,
        code: 'threshold_order',
        message: `warn (${warn}) must be ≥ target value (${value}) when lower is better`,
      });
    }
    if (breach !== undefined && warn !== undefined && breach < warn) {
      issues.push({
        path: `${basePath}.breach`,
        code: 'threshold_order',
        message: `breach (${breach}) must be ≥ warn (${warn}) when lower is better`,
      });
    } else if (breach !== undefined && warn === undefined && breach < value) {
      issues.push({
        path: `${basePath}.breach`,
        code: 'threshold_order',
        message: `breach (${breach}) must be ≥ target value (${value}) when lower is better`,
      });
    }
  }
}

/** Drop exact duplicates (shared checks run per formula source). */
function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.path} ${i.code ?? ''} ${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Tier-1 cross-reference validation of a parsed metric definition against
 * the compiled registry and the known calendars. Field references resolve
 * against the formula source's fields PLUS derived field names; derived
 * fields are usable in `where` and as agg `field`, never as scope dimensions
 * or derive args.
 */
export function validateMetricDefinition(
  def: MetricDefinition,
  registry: CompiledRegistry,
  calendars: ReadonlyArray<{ name: string }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // metricType ⇄ formula kind coupling.
  const wantsRatio = def.metricType === 'percent' || def.metricType === 'ratio';
  if (wantsRatio && def.formula.kind !== 'ratio') {
    issues.push({
      path: 'formula.kind',
      code: 'formula_kind_mismatch',
      message: `metricType "${def.metricType}" requires a "ratio" formula`,
    });
  } else if (!wantsRatio && def.formula.kind !== 'aggregate') {
    issues.push({
      path: 'formula.kind',
      code: 'formula_kind_mismatch',
      message: `metricType "${def.metricType}" requires an "aggregate" formula`,
    });
  }

  // Formula sources; unknown sources suppress their dependent field checks.
  const specs: Array<{ spec: AggSpec; path: string }> =
    def.formula.kind === 'aggregate'
      ? [{ spec: def.formula.over, path: 'formula.over' }]
      : [
          { spec: def.formula.numerator, path: 'formula.numerator' },
          { spec: def.formula.denominator, path: 'formula.denominator' },
        ];
  const validSpecs = specs.filter(({ spec, path }) => {
    if (registry.entity(spec.source) !== undefined) return true;
    issues.push({
      path: `${path}.source`,
      code: 'unknown_source',
      message: `entity "${spec.source}" is not registered`,
    });
    return false;
  });
  // Shared references (dimensions, derive, exclusions) must hold on EVERY source.
  const sources = [...new Set(validSpecs.map(({ spec }) => spec.source))];

  // Derived fields: names must not shadow entity fields; args must be
  // date-typed entity fields (never other derived fields).
  const derive = def.derive ?? {};
  const derivedNames = new Set(Object.keys(derive));
  for (const [name, spec] of Object.entries(derive)) {
    for (const source of sources) {
      if (registry.field(source, name) !== undefined) {
        issues.push({
          path: `derive.${name}`,
          code: 'derived_name_collision',
          message: `derived field "${name}" collides with a field of entity "${source}"`,
        });
      }
      spec.args.forEach((arg, i) => {
        const f = registry.field(source, arg);
        if (f === undefined) {
          issues.push({
            path: `derive.${name}.args[${i}]`,
            code: 'unknown_field',
            message: `field "${arg}" is not declared on entity "${source}" (derived fields are not allowed here)`,
          });
        } else if (f.type !== 'date') {
          issues.push({
            path: `derive.${name}.args[${i}]`,
            code: 'derive_arg_not_date',
            message: `derive arg "${arg}" must be a date field of entity "${source}"; it is ${f.type}`,
          });
        }
      });
    }
  }

  // Scope dimensions: real entity fields (never derived) on EVERY source.
  def.scope.dimensions.forEach((dim, i) => {
    for (const source of sources) {
      if (registry.field(source, dim) === undefined) {
        issues.push({
          path: `scope.dimensions[${i}]`,
          code: 'unknown_field',
          message: `dimension "${dim}" is not declared on entity "${source}"`,
        });
      }
    }
  });

  // Event anchors: a real date field (never derived) on EVERY source —
  // window membership is decided by this timestamp, so every source's rows
  // must carry it. Snapshot anchors reference no field.
  if (def.anchor.kind === 'event') {
    const anchorField = def.anchor.field;
    for (const source of sources) {
      const f = registry.field(source, anchorField);
      if (f === undefined) {
        issues.push({
          path: 'anchor.field',
          code: 'unknown_field',
          message: `anchor field "${anchorField}" is not declared on entity "${source}" (derived fields are not allowed here)`,
        });
      } else if (f.type !== 'date') {
        issues.push({
          path: 'anchor.field',
          code: 'anchor_not_date',
          message: `anchor field "${anchorField}" must be a date field of entity "${source}"; it is ${f.type}`,
        });
      }
    }
  }

  // Per-aggregation checks: agg field resolution + type, where expressions.
  for (const { spec, path } of validSpecs) {
    checkAggSpec(spec, derivedNames, registry, path, issues);
  }

  // Exclusions apply to every source's rows — their conditions must resolve
  // on each.
  (def.exclusions ?? []).forEach((ex, i) => {
    for (const source of sources) {
      checkFilterExpr(ex.when, source, derivedNames, registry, `exclusions[${i}].when`, issues);
    }
    checkEffectiveWindow(ex.effectiveFrom, ex.effectiveTo, `exclusions[${i}].effectiveTo`, issues);
  });

  // Thresholds respect the direction of "better".
  checkThresholdOrder(def.target.value, def.target.direction, def.target.thresholds, 'target.thresholds', issues);

  // Window combinations the runtime refuses: business time is day-granular,
  // so a business-aligned rolling HOUR window has no meaning (mirrors the
  // MalkomError resolveWindow throws).
  if (def.window.kind === 'rolling' && def.window.unit === 'hour' && def.window.alignment === 'business') {
    issues.push({
      path: 'window.alignment',
      code: 'window_unsupported',
      message: 'rolling hour windows cannot be business-aligned — business time is day-granular',
    });
  }

  // Business time needs a calendar; a referenced calendar must exist.
  const needsCalendar = def.window.alignment === 'business' || derivedNames.size > 0;
  if (needsCalendar && def.calendarRef === undefined) {
    issues.push({
      path: 'calendarRef',
      code: 'calendar_required',
      message: 'business-aligned windows and derived business-time fields require a calendarRef',
    });
  }
  if (def.calendarRef !== undefined && !calendars.some((c) => c.name === def.calendarRef)) {
    issues.push({ path: 'calendarRef', code: 'unknown_calendar', message: `unknown calendar "${def.calendarRef}"` });
  }

  checkEffectiveWindow(def.effectiveFrom, def.effectiveTo, 'effectiveTo', issues);

  return dedupe(issues);
}

// ---------------------------------------------------------------------------
// Assignment validation against its metric definition
// ---------------------------------------------------------------------------

/**
 * Tier-1 validation of an assignment against the definition it binds (the
 * caller resolves the definition). Scope keys must equal the definition's
 * scope.dimensions exactly; values are checked against the formula source
 * entity (numerator source for ratios — dimensions were already validated to
 * exist on all sources).
 */
export function validateAssignment(
  assignment: Assignment,
  definition: MetricDefinition,
  registry: CompiledRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const dims = definition.scope.dimensions;
  for (const dim of dims) {
    if (!(dim in assignment.scope)) {
      issues.push({
        path: `scope.${dim}`,
        code: 'scope_key_missing',
        message: `scope must bind dimension "${dim}" declared by metric "${definition.name}"`,
      });
    }
  }
  for (const key of Object.keys(assignment.scope)) {
    if (!dims.includes(key)) {
      issues.push({
        path: `scope.${key}`,
        code: 'scope_key_unexpected',
        message: `"${key}" is not a scope dimension of metric "${definition.name}"`,
      });
    }
  }

  const source =
    definition.formula.kind === 'ratio' ? definition.formula.numerator.source : definition.formula.over.source;
  for (const [key, value] of Object.entries(assignment.scope)) {
    if (!dims.includes(key)) continue;
    const field = registry.field(source, key);
    if (field === undefined) continue; // the definition's problem, not the assignment's
    if (!typeCompatible(field.type, value)) {
      issues.push({
        path: `scope.${key}`,
        code: 'type_mismatch',
        message: `value ${JSON.stringify(value)} does not match type "${field.type}" of field "${key}"`,
      });
      continue;
    }
    const legal = registry.fieldValues(source, key);
    if (legal && !legal.some((x) => x === value)) {
      issues.push({
        path: `scope.${key}`,
        code: 'value_not_allowed',
        message: `value ${JSON.stringify(value)} is not among the legal values of field "${key}"`,
      });
    }
  }

  if (assignment.targetOverride !== undefined) {
    const effectiveValue = assignment.targetOverride.value ?? definition.target.value;
    checkThresholdOrder(
      effectiveValue,
      definition.target.direction,
      assignment.targetOverride.thresholds,
      'targetOverride.thresholds',
      issues,
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Referenced-field inventory — shared by tier-2 validation and fact fetching
// ---------------------------------------------------------------------------

/** One reference to a registry field, with the definition path that made it. */
interface FieldRef {
  field: string;
  path: string;
}

/** Collect every leaf term's field reference with its exact AST path. */
function collectFilterFieldRefs(expr: FilterExpr, path: string, into: FieldRef[]): void {
  switch (expr.op) {
    case 'and':
    case 'or':
      expr.args.forEach((a, i) => collectFilterFieldRefs(a, `${path}.args[${i}]`, into));
      return;
    case 'not':
      collectFilterFieldRefs(expr.arg, `${path}.arg`, into);
      return;
    default:
      into.push({ field: expr.field, path: `${path}.field` });
  }
}

/** The formula's aggregation specs with their AST paths, numerator first. */
function formulaSpecs(def: MetricDefinition): Array<{ spec: AggSpec; path: string }> {
  return def.formula.kind === 'aggregate'
    ? [{ spec: def.formula.over, path: 'formula.over' }]
    : [
        { spec: def.formula.numerator, path: 'formula.numerator' },
        { spec: def.formula.denominator, path: 'formula.denominator' },
      ];
}

/**
 * Every REGISTRY field a definition reads from each formula source, one entry
 * per reference with its exact definition path: agg fields, `where` terms,
 * exclusion conditions, derive args, scope dimensions, and the event anchor.
 * Derived field names are the definition's own vocabulary — never a column —
 * so they are filtered out here. This inventory IS the minimal fact
 * projection, which is why tier-2 validation and the fetch planner share it.
 */
function referencedFieldRefsBySource(def: MetricDefinition): Map<string, FieldRef[]> {
  const derivedNames = new Set(Object.keys(def.derive ?? {}));
  const bySource = new Map<string, FieldRef[]>();
  const refsOf = (source: string): FieldRef[] => {
    let refs = bySource.get(source);
    if (refs === undefined) {
      refs = [];
      bySource.set(source, refs);
    }
    return refs;
  };

  for (const { spec, path } of formulaSpecs(def)) {
    const refs = refsOf(spec.source);
    if (spec.field !== undefined) refs.push({ field: spec.field, path: `${path}.field` });
    if (spec.where !== undefined) collectFilterFieldRefs(spec.where, `${path}.where`, refs);
  }

  // Shared references hold on EVERY source (tier-1 enforces the same rule).
  for (const source of bySource.keys()) {
    const refs = refsOf(source);
    for (const [name, spec] of Object.entries(def.derive ?? {})) {
      spec.args.forEach((arg, i) => refs.push({ field: arg, path: `derive.${name}.args[${i}]` }));
    }
    def.scope.dimensions.forEach((dim, i) => refs.push({ field: dim, path: `scope.dimensions[${i}]` }));
    if (def.anchor.kind === 'event') refs.push({ field: def.anchor.field, path: 'anchor.field' });
    (def.exclusions ?? []).forEach((ex, i) => collectFilterFieldRefs(ex.when, `exclusions[${i}].when`, refs));
  }

  for (const [source, refs] of bySource) {
    bySource.set(
      source,
      refs.filter((r) => !derivedNames.has(r.field)),
    );
  }
  return bySource;
}

/**
 * The minimal per-source fact projection: every registry field id the
 * definition reads from that source, deduplicated and sorted. The fetch
 * paths (port and SQL) project exactly this — nothing more.
 */
export function referencedFieldsBySource(def: MetricDefinition): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [source, refs] of referencedFieldRefsBySource(def)) {
    out.set(source, [...new Set(refs.map((r) => r.field))].sort());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tier-2 live validation — the definition's bindings against the REAL schema
// ---------------------------------------------------------------------------

/** Live schema access for one connection: the client plus its introspector. */
export interface LiveSchemaAccess {
  client: SqlClient;
  introspector: SqlIntrospector;
}

/**
 * Column types that clearly cannot hold the ISO-8601 UTC TEXT the SQL anchor
 * pushdown compares against (INTEGER/REAL/NUMERIC families). An epoch-encoded
 * anchor column never matches a text-bound window — perpetual no_data — and a
 * naive local 'YYYY-MM-DD HH:MM:SS' text column silently leaks edge rows, so
 * tier-2 flags the numeric families it can see. Word-bounded so 'POINT' or
 * 'DATETIME' never match.
 */
const NUMERIC_COLUMN_TYPE_RE =
  /\b(tinyint|smallint|mediumint|bigint|int|integer|int2|int4|int8|serial|bigserial|real|float|float4|float8|double|numeric|decimal|number)\b/i;

/**
 * Tier-2 validation: check that every bound source table exists and every
 * projected column exists, via the SqlIntrospector port. Column names are the
 * registry bindings (field `column`, defaulting to the field id) compared
 * EXACTLY — the fetch path quotes identifiers, so a case drift that would
 * break a quoted query fails here too. Sources without a table +
 * connectionRef binding are library-mode and have nothing live to check.
 *
 * `introspectorByConnection` maps connectionRef → live access; a referenced
 * connection with no entry is caller plumbing gone wrong and throws.
 */
export async function validateMetricLive(
  def: MetricDefinition,
  registry: CompiledRegistry,
  introspectorByConnection: Readonly<Record<string, LiveSchemaAccess>>,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const refsBySource = referencedFieldRefsBySource(def);

  for (const { spec, path } of formulaSpecs(def)) {
    const entity = registry.entity(spec.source);
    if (entity === undefined) continue; // tier-1's problem, not tier-2's
    if (entity.table === undefined || entity.connectionRef === undefined) continue; // library mode

    const access = introspectorByConnection[entity.connectionRef];
    if (access === undefined) {
      throw new ConfigInvalidError(
        `validateMetricLive: no live schema access provided for connection "${entity.connectionRef}" (entity "${entity.id}")`,
      );
    }

    const columns = await access.introspector.tableColumns(access.client, entity.table.schema, entity.table.name);
    const tableName = entity.table.schema ? `${entity.table.schema}.${entity.table.name}` : entity.table.name;
    if (columns.length === 0) {
      issues.push({
        path: `${path}.source`,
        code: 'missing_table',
        message: `table "${tableName}" bound to entity "${entity.id}" was not found on connection "${entity.connectionRef}"`,
      });
      continue;
    }

    const live = new Set(columns.map((c) => c.name));
    for (const ref of refsBySource.get(spec.source) ?? []) {
      const column = registry.columnFor(spec.source, ref.field);
      if (column === undefined) continue; // unknown field — tier-1's problem
      if (!live.has(column)) {
        issues.push({
          path: ref.path,
          code: 'missing_column',
          message: `column "${column}" (field "${ref.field}" of entity "${entity.id}") is missing from table "${tableName}" on connection "${entity.connectionRef}"`,
        });
      }
    }

    // ADVISORY — the anchor column must hold ISO-8601 UTC text (or a native
    // timestamp type): the SQL pushdown binds the window bounds as text, so a
    // clearly numeric column (epoch seconds/millis) silently computes no_data
    // forever. MemoryFactSource tolerates epoch numbers, which makes the
    // port/SQL divergence invisible until production — flag it here.
    if (def.anchor.kind === 'event') {
      const anchorColumn = registry.columnFor(spec.source, def.anchor.field);
      const liveColumn = anchorColumn !== undefined ? columns.find((c) => c.name === anchorColumn) : undefined;
      if (liveColumn !== undefined && NUMERIC_COLUMN_TYPE_RE.test(liveColumn.dataType)) {
        issues.push({
          path: 'anchor.field',
          code: 'anchor_encoding_suspect',
          severity: 'warning',
          message:
            `anchor column "${liveColumn.name}" (field "${def.anchor.field}" of entity "${entity.id}") on table "${tableName}" ` +
            `has numeric type "${liveColumn.dataType}" — the SQL anchor pushdown compares ISO-8601 UTC text ` +
            `(e.g. '2026-08-12T06:00:00.000Z'), so epoch/numeric encodings never fall inside any window (perpetual no_data). ` +
            `Store the anchor as ISO-8601 text, or read this entity through a FactSourcePort`,
        });
      }
    }
  }

  return dedupe(issues);
}
