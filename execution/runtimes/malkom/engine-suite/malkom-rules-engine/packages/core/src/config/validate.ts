import { z } from 'zod';
import {
  filterFields,
  filterValueSets,
  type FilterExpr,
  type Scalar,
} from '../domain/filter.js';
import { CompiledRegistry } from '../domain/registry.js';
import {
  groupDefinitionSchema,
  registryDocSchema,
  ROW_REF_RE,
  scopeFields,
  scopeValueSets,
  type Action,
  type GroupDefinition,
  type GroupDefinitionInput,
  type RegistryDoc,
  type RegistryDocInput,
} from './schemas.js';

/**
 * Tier-1 static validation (§5.2): shape via zod, then the cross-references
 * zod cannot express — field existence, value-set resolution, enum and type
 * compatibility, window sanity. Errors block; warnings inform.
 *
 * Every issue is keyed to an AST node path ("rules[0].then[1].field") so a
 * rule-builder UI can red-underline the exact widget.
 *
 * Tier-2 (live schema introspection) and backtests live in the engine — they
 * need a connection. The consistency tier (cross-rule analysis) is separate
 * and new to this engine (M4).
 */

export interface ValidationIssue {
  path: string;
  message: string;
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
      warnings.push({ path: `${base}.table`, message: 'table declared without connectionRef — tier-2 validation and backtests need a connection' });
    }
  });

  return { result: result(errors, warnings), doc };
}

// ---------------------------------------------------------------------------
// Group-definition validation against a compiled registry
// ---------------------------------------------------------------------------

function scalarTypeName(v: Scalar): 'string' | 'number' | 'boolean' | 'null' {
  if (v === null) return 'null';
  return typeof v as 'string' | 'number' | 'boolean';
}

/** Warn when a literal's type cannot match the declared field type. */
function typeCompatible(fieldType: string, v: Scalar): boolean {
  const t = scalarTypeName(v);
  if (t === 'null') return true;
  if (fieldType === 'date') return t === 'string' || t === 'number';
  // Driver-tolerance coercions (filter.ts) make string↔number workable, but a
  // declared-type mismatch is almost always an authoring mistake — warn.
  return fieldType === t;
}

function checkFilterExpr(
  expr: FilterExpr,
  entityId: string,
  registry: CompiledRegistry,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  for (const fieldId of filterFields(expr)) {
    if (!registry.field(entityId, fieldId)) {
      errors.push({ path, message: `field "${fieldId}" is not declared on entity "${entityId}"` });
    }
  }
  for (const setId of filterValueSets(expr)) {
    if (registry.valueSet(setId) === undefined) {
      errors.push({ path, message: `unknown value-set "${setId}"` });
    }
  }
  walkLiterals(expr, path, (fieldId, value, at) => {
    const field = registry.field(entityId, fieldId);
    if (!field) return;
    if (!typeCompatible(field.type, value)) {
      warnings.push({ path: at, message: `literal ${JSON.stringify(value)} does not match declared type "${field.type}" of field "${fieldId}"` });
    }
    const legal = registry.fieldValues(entityId, fieldId);
    if (legal && value !== null && !legal.some((x) => x === value)) {
      warnings.push({ path: at, message: `value ${JSON.stringify(value)} is not among the legal values of field "${fieldId}"` });
    }
  });
}

function walkLiterals(
  expr: FilterExpr,
  path: string,
  visit: (fieldId: string, value: Scalar, path: string) => void,
): void {
  switch (expr.op) {
    case 'and':
    case 'or':
      expr.args.forEach((a, i) => walkLiterals(a, `${path}.args[${i}]`, visit));
      return;
    case 'not':
      walkLiterals(expr.arg, `${path}.arg`, visit);
      return;
    case 'in':
    case 'notIn':
      expr.values.forEach((v, i) => visit(expr.field, v, `${path}.values[${i}]`));
      return;
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      visit(expr.field, expr.value, `${path}.value`);
      return;
    default:
      return; // isNull / isNotNull / inSet carry no literals
  }
}

function checkAction(
  action: Action,
  entityId: string,
  registry: CompiledRegistry,
  path: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  if (action.verb === 'effect') {
    const target = registry.entity(action.target.entity);
    if (!target) {
      errors.push({ path: `${path}.target.entity`, message: `entity "${action.target.entity}" is not registered` });
      return;
    }
    for (const [k] of Object.entries(action.target.key)) {
      if (!registry.field(action.target.entity, k)) {
        errors.push({ path: `${path}.target.key.${k}`, message: `field "${k}" is not declared on entity "${action.target.entity}"` });
      }
    }
    for (const [k] of Object.entries(action.target.set)) {
      if (!registry.field(action.target.entity, k)) {
        errors.push({ path: `${path}.target.set.${k}`, message: `field "${k}" is not declared on entity "${action.target.entity}"` });
      }
    }
    for (const [k, v] of [...Object.entries(action.target.key), ...Object.entries(action.target.set)]) {
      if (typeof v === 'string' && v.startsWith('$row.')) {
        if (!ROW_REF_RE.test(v)) {
          errors.push({ path: `${path}.target`, message: `malformed row reference "${v}" (expected $row.<fieldId>)` });
        } else {
          const ref = v.slice('$row.'.length);
          if (!registry.field(entityId, ref)) {
            errors.push({ path: `${path}.target`, message: `row reference "${v}": field "${ref}" is not declared on entity "${entityId}"` });
          }
        }
        void k;
      }
    }
    return;
  }

  if (!registry.field(entityId, action.field)) {
    errors.push({ path: `${path}.field`, message: `field "${action.field}" is not declared on entity "${entityId}"` });
  }
  if (action.verb === 'assert') {
    checkFilterExpr(action.check, entityId, registry, `${path}.check`, errors, warnings);
  } else {
    const field = registry.field(entityId, action.field);
    if (field) {
      if (!typeCompatible(field.type, action.value)) {
        warnings.push({ path: `${path}.value`, message: `literal ${JSON.stringify(action.value)} does not match declared type "${field.type}" of field "${action.field}"` });
      }
      const legal = registry.fieldValues(entityId, action.field);
      if (legal && action.value !== null && !legal.some((x) => x === action.value)) {
        warnings.push({ path: `${path}.value`, message: `value ${JSON.stringify(action.value)} is not among the legal values of field "${action.field}"` });
      }
    }
  }
}

export interface ValidateGroupOptions {
  /** Activation gate: additionally require what a live version must have. */
  forActivation?: boolean;
}

export function validateGroupDefinition(
  input: GroupDefinitionInput,
  registry: CompiledRegistry,
  opts: ValidateGroupOptions = {},
): { result: ValidationResult; definition?: GroupDefinition } {
  const parsed = groupDefinitionSchema.safeParse(input);
  if (!parsed.success) return { result: result(zodIssues(parsed.error), []) };

  const def = parsed.data;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const entity = registry.entity(def.entity);
  if (!entity) {
    errors.push({ path: 'entity', message: `entity "${def.entity}" is not registered` });
    return { result: result(errors, warnings), definition: def };
  }

  // Scope: declared fields, resolvable sets, enum/type compatibility.
  for (const fieldId of scopeFields(def.scope)) {
    if (!registry.field(def.entity, fieldId)) {
      errors.push({ path: 'scope', message: `field "${fieldId}" is not declared on entity "${def.entity}"` });
    }
  }
  for (const setId of scopeValueSets(def.scope)) {
    if (registry.valueSet(setId) === undefined) {
      errors.push({ path: 'scope', message: `unknown value-set "${setId}"` });
    }
  }
  def.scope.all.forEach((term, i) => {
    const field = registry.field(def.entity, term.field);
    if (!field) return;
    const legal = registry.fieldValues(def.entity, term.field);
    const literals: Scalar[] = term.op === 'eq' ? [term.value] : term.op === 'in' ? term.values : [];
    literals.forEach((v) => {
      if (!typeCompatible(field.type, v)) {
        warnings.push({ path: `scope.all[${i}]`, message: `literal ${JSON.stringify(v)} does not match declared type "${field.type}" of field "${term.field}"` });
      }
      if (legal && v !== null && !legal.some((x) => x === v)) {
        warnings.push({ path: `scope.all[${i}]`, message: `value ${JSON.stringify(v)} is not among the legal values of field "${term.field}"` });
      }
    });
  });

  // Group filters.
  def.filters.forEach((f, i) =>
    checkFilterExpr(f, def.entity, registry, `filters[${i}]`, errors, warnings),
  );

  // Windows.
  if (def.effectiveFrom !== undefined && def.effectiveTo !== undefined &&
      Date.parse(def.effectiveFrom) >= Date.parse(def.effectiveTo)) {
    errors.push({ path: 'effectiveTo', message: 'effectiveTo must be after effectiveFrom (half-open [from, to))' });
  }

  // Rules.
  const ruleIds = new Set<string>();
  def.rules.forEach((rule, i) => {
    const base = `rules[${i}]`;
    if (rule.id !== undefined) {
      if (ruleIds.has(rule.id)) errors.push({ path: `${base}.id`, message: `duplicate rule id "${rule.id}"` });
      ruleIds.add(rule.id);
    }
    checkFilterExpr(rule.when, def.entity, registry, `${base}.when`, errors, warnings);
    rule.then.forEach((action, j) =>
      checkAction(action, def.entity, registry, `${base}.then[${j}]`, errors, warnings),
    );
    if (rule.effectiveFrom !== undefined && rule.effectiveTo !== undefined &&
        Date.parse(rule.effectiveFrom) >= Date.parse(rule.effectiveTo)) {
      errors.push({ path: `${base}.effectiveTo`, message: 'effectiveTo must be after effectiveFrom (half-open [from, to))' });
    }
    // A rule window entirely outside the group window can never fire.
    if (def.effectiveTo !== undefined && rule.effectiveFrom !== undefined &&
        Date.parse(rule.effectiveFrom) >= Date.parse(def.effectiveTo)) {
      warnings.push({ path: `${base}.effectiveFrom`, message: 'rule window starts after the group window ends — the rule can never fire' });
    }
    if (def.effectiveFrom !== undefined && rule.effectiveTo !== undefined &&
        Date.parse(rule.effectiveTo) <= Date.parse(def.effectiveFrom)) {
      warnings.push({ path: `${base}.effectiveTo`, message: 'rule window ends before the group window starts — the rule can never fire' });
    }
  });

  if (def.hitPolicy === 'unique' && def.rules.length === 1) {
    warnings.push({ path: 'hitPolicy', message: 'hitPolicy "unique" with a single rule never detects overlaps' });
  }

  if (opts.forActivation && def.rules.length === 0) {
    errors.push({ path: 'rules', message: 'an active group must contain at least one rule' });
  }

  return { result: result(errors, warnings), definition: def };
}
