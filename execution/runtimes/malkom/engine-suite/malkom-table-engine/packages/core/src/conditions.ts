/**
 * Smart-prefilter condition AST: a nested AND/OR tree of field rules.
 * Self-contained (no imports) so it stays a pure, portable logic module.
 */

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'oneOf'
  | 'empty'
  | 'notEmpty'
  | 'regex';

export interface ConditionRule {
  kind: 'rule';
  field: string;
  operator: ConditionOperator;
  /** Raw string as typed in the builder; coerced per field type at evaluation. */
  value?: string;
}

export interface ConditionGroup {
  kind: 'group';
  logic: 'and' | 'or';
  children: ConditionNode[];
}

export type ConditionNode = ConditionRule | ConditionGroup;

/** A saved, named prefilter. */
export interface SmartPrefilter {
  id: string;
  name: string;
  root: ConditionGroup;
  createdAt: string;
  updatedAt: string;
}

/** Field metadata the evaluator/validator needs (subset of MalkomColumn). */
export interface ConditionFieldInfo {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

/** Operators that never take a value input. */
export const VALUELESS_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
  'empty',
  'notEmpty'
]);

/** Operator choices per field type, in display order. */
export function operatorsForType(
  type: ConditionFieldInfo['type']
): ConditionOperator[] {
  switch (type) {
    case 'number':
    case 'date':
      return [
        'equals',
        'notEquals',
        'lessThan',
        'lessThanOrEqual',
        'greaterThan',
        'greaterThanOrEqual',
        'empty',
        'notEmpty'
      ];
    case 'boolean':
      return ['equals', 'notEquals', 'empty', 'notEmpty'];
    default:
      return [
        'contains',
        'notContains',
        'equals',
        'notEquals',
        'startsWith',
        'endsWith',
        'oneOf',
        'regex',
        'empty',
        'notEmpty'
      ];
  }
}

export function emptyGroup(logic: 'and' | 'or' = 'and'): ConditionGroup {
  return { kind: 'group', logic, children: [] };
}

export function emptyRule(field = ''): ConditionRule {
  return { kind: 'rule', field, operator: 'contains', value: '' };
}

export function cloneCondition<T extends ConditionNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ConditionValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCondition(
  root: ConditionGroup,
  fields: ConditionFieldInfo[]
): ConditionValidationResult {
  const errors: string[] = [];
  const known = new Map(fields.map((f) => [f.field, f] as const));

  const walk = (node: ConditionNode, path: string): void => {
    if (node.kind === 'group') {
      if (node.children.length === 0) {
        errors.push(`${path}: group has no conditions.`);
        return;
      }
      node.children.forEach((child, i) => walk(child, `${path} > ${i + 1}`));
      return;
    }
    if (!node.field) {
      errors.push(`${path}: pick a field.`);
      return;
    }
    const info = known.get(node.field);
    if (!info) {
      errors.push(`${path}: unknown field "${node.field}".`);
    }
    if (!node.operator) {
      errors.push(`${path}: pick an operator.`);
      return;
    }
    if (!VALUELESS_OPERATORS.has(node.operator)) {
      const value = String(node.value ?? '').trim();
      if (value === '') {
        errors.push(`${path}: a value is required.`);
      } else if (node.operator === 'regex') {
        try {
          // eslint-disable-next-line no-new
          new RegExp(value);
        } catch {
          errors.push(`${path}: invalid regular expression.`);
        }
      } else if (info) {
        // Value must be coercible to the field's type, otherwise the rule
        // can never match anything (e.g. a stale string value after a
        // field switch in the builder).
        if (info.type === 'number' && toNumber(value) === null) {
          errors.push(`${path}: "${value}" is not a valid number.`);
        } else if (info.type === 'date' && toTime(value) === null) {
          errors.push(`${path}: "${value}" is not a valid date.`);
        } else if (info.type === 'boolean' && toBool(value) === null) {
          errors.push(`${path}: "${value}" is not a valid true/false value.`);
        }
      }
    }
  };

  walk(root, 'Condition');
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function getByPath(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return row[path];
  let current: unknown = row;
  for (const part of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local-midnight timestamp for a YYYY-MM-DD string (day granularity). */
function dateOnlyBounds(value: string): { start: number; end: number } | null {
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const start = new Date(y, m - 1, d).getTime();
  const end = new Date(y, m - 1, d + 1).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { start, end };
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value ?? '').trim();
  if (s === '') return null;
  // Date-only strings parse as LOCAL midnight so they compare consistently
  // with the builder's <input type="date"> values in every timezone
  // (Date.parse would treat them as UTC midnight, unlike datetime strings).
  if (DATE_ONLY_RE.test(s)) {
    return dateOnlyBounds(s)?.start ?? null;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return null;
}

function compare(
  rowValue: unknown,
  ruleValue: string,
  type: ConditionFieldInfo['type']
): number | null {
  if (type === 'number') {
    const a = toNumber(rowValue);
    const b = toNumber(ruleValue);
    if (a === null || b === null) return null;
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (type === 'date') {
    const a = toTime(rowValue);
    if (a === null) return null;
    const trimmedRule = ruleValue.trim();
    // A date-only rule value means DAY granularity: any timestamp within
    // that local day compares equal; before the day is -1, after is 1.
    if (DATE_ONLY_RE.test(trimmedRule)) {
      const bounds = dateOnlyBounds(trimmedRule);
      if (!bounds) return null;
      return a < bounds.start ? -1 : a >= bounds.end ? 1 : 0;
    }
    const b = toTime(trimmedRule);
    if (b === null) return null;
    return a === b ? 0 : a < b ? -1 : 1;
  }
  const a = String(rowValue ?? '').trim().toLowerCase();
  const b = ruleValue.trim().toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}

function evaluateRule(
  rule: ConditionRule,
  row: Record<string, unknown>,
  typeOf: (field: string) => ConditionFieldInfo['type']
): boolean {
  const rowValue = getByPath(row, rule.field);
  const type = typeOf(rule.field);
  const ruleValue = String(rule.value ?? '');

  switch (rule.operator) {
    case 'empty':
      return isEmptyValue(rowValue);
    case 'notEmpty':
      return !isEmptyValue(rowValue);
    case 'equals': {
      if (type === 'boolean') {
        const a = toBool(rowValue);
        const b = toBool(ruleValue);
        return a !== null && b !== null && a === b;
      }
      const c = compare(rowValue, ruleValue, type);
      return c === 0;
    }
    case 'notEquals': {
      if (type === 'boolean') {
        const a = toBool(rowValue);
        const b = toBool(ruleValue);
        return a !== null && b !== null && a !== b;
      }
      const c = compare(rowValue, ruleValue, type);
      return c !== null && c !== 0;
    }
    case 'lessThan': {
      const c = compare(rowValue, ruleValue, type);
      return c !== null && c < 0;
    }
    case 'lessThanOrEqual': {
      const c = compare(rowValue, ruleValue, type);
      return c !== null && c <= 0;
    }
    case 'greaterThan': {
      const c = compare(rowValue, ruleValue, type);
      return c !== null && c > 0;
    }
    case 'greaterThanOrEqual': {
      const c = compare(rowValue, ruleValue, type);
      return c !== null && c >= 0;
    }
    case 'contains':
      return String(rowValue ?? '')
        .toLowerCase()
        .includes(ruleValue.trim().toLowerCase());
    case 'notContains':
      return !String(rowValue ?? '')
        .toLowerCase()
        .includes(ruleValue.trim().toLowerCase());
    case 'startsWith':
      return String(rowValue ?? '')
        .toLowerCase()
        .startsWith(ruleValue.trim().toLowerCase());
    case 'endsWith':
      return String(rowValue ?? '')
        .toLowerCase()
        .endsWith(ruleValue.trim().toLowerCase());
    case 'oneOf': {
      const haystack = ruleValue
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s !== '');
      return haystack.includes(String(rowValue ?? '').trim().toLowerCase());
    }
    case 'regex': {
      try {
        return new RegExp(ruleValue, 'i').test(String(rowValue ?? ''));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Compile a condition tree into a row predicate.
 * Unknown fields evaluate as type 'string'. Invalid comparisons are false.
 */
export function compileCondition(
  root: ConditionGroup,
  fields: ConditionFieldInfo[]
): (row: Record<string, unknown>) => boolean {
  const typeMap = new Map(fields.map((f) => [f.field, f.type] as const));
  const typeOf = (field: string): ConditionFieldInfo['type'] =>
    typeMap.get(field) ?? 'string';

  const evalNode = (node: ConditionNode, row: Record<string, unknown>): boolean => {
    if (node.kind === 'rule') return evaluateRule(node, row, typeOf);
    if (node.children.length === 0) return true;
    if (node.logic === 'and') {
      return node.children.every((child) => evalNode(child, row));
    }
    return node.children.some((child) => evalNode(child, row));
  };

  return (row) => evalNode(root, row);
}

// ---------------------------------------------------------------------------
// Description model (rendered by the UI layer with theme classes)
// ---------------------------------------------------------------------------

export interface RuleDescription {
  type: 'rule';
  fieldLabel: string;
  operatorLabel: string;
  value: string;
  hasValue: boolean;
}

export interface GroupDescription {
  type: 'group';
  logic: 'and' | 'or';
  children: DescriptionNode[];
}

export type DescriptionNode = RuleDescription | GroupDescription;

export const DEFAULT_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is equal to',
  notEquals: 'is not equal to',
  lessThan: 'is less than',
  lessThanOrEqual: 'is less than or equal to',
  greaterThan: 'is greater than',
  greaterThanOrEqual: 'is greater than or equal to',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  oneOf: 'is one of',
  empty: 'is empty',
  notEmpty: 'is not empty',
  regex: 'matches pattern'
};

export function describeCondition(
  node: ConditionNode,
  fields: ConditionFieldInfo[],
  operatorLabels: Record<string, string> = {}
): DescriptionNode {
  const labelMap = new Map(fields.map((f) => [f.field, f.label] as const));
  const opLabel = (op: ConditionOperator): string =>
    operatorLabels[op] ?? DEFAULT_OPERATOR_LABELS[op] ?? op;

  const walk = (n: ConditionNode): DescriptionNode => {
    if (n.kind === 'rule') {
      return {
        type: 'rule',
        fieldLabel: labelMap.get(n.field) ?? n.field,
        operatorLabel: opLabel(n.operator),
        value: String(n.value ?? '').trim(),
        hasValue: !VALUELESS_OPERATORS.has(n.operator)
      };
    }
    return {
      type: 'group',
      logic: n.logic,
      children: n.children.map(walk)
    };
  };

  return walk(node);
}
