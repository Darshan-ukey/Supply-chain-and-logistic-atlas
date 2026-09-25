import { z } from 'zod';

/** Scalar values allowed in filter comparisons and rule-action payloads. */
export type Scalar = string | number | boolean | null;

export const scalarSchema: z.ZodType<Scalar> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Host-supplied identifiers (table/column/field names). The regex is
 * defense-in-depth and early feedback; the dialect quoter and
 * information_schema verification at activation are the real safety layers.
 */
export const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]{0,127}$/;
export const identifierSchema = z
  .string()
  .regex(IDENTIFIER_RE, 'must be a plain SQL identifier (letters, digits, _, $; max 128 chars)');

/**
 * Value-set references ("region:transpacific-uswc", "iso4217") are registry
 * ids, not SQL identifiers — they allow ':', '-' and '.' as namespacing.
 */
export const VALUE_SET_REF_RE = /^[A-Za-z0-9][A-Za-z0-9:_.\-]{0,127}$/;
export const valueSetRefSchema = z
  .string()
  .regex(VALUE_SET_REF_RE, 'must be a value-set id (letters, digits, :, _, ., -; max 128 chars)');

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * The engine-neutral condition AST — the ONLY condition language in rule
 * definitions. There is deliberately no raw-SQL escape hatch: rules flow from
 * admin UIs and untrusted API callers.
 *
 * Ported from the allocation engine with two deliberate changes:
 *  - terms reference a `field` (a registry field id, resolved to its physical
 *    column through the registry binding) rather than a raw `column`;
 *  - `inSet` tests membership in a named registry value-set, resolved through
 *    the FilterContext at evaluation time (or pre-expanded at compile time).
 */
export type FilterExpr =
  | { op: ComparisonOp; field: string; value: Scalar }
  | { op: 'in' | 'notIn'; field: string; values: Scalar[] }
  | { op: 'inSet'; field: string; set: string }
  | { op: 'matches'; field: string; pattern: string }
  | { op: 'isNull' | 'isNotNull'; field: string }
  | { op: 'and' | 'or'; args: FilterExpr[] }
  | { op: 'not'; arg: FilterExpr };

/**
 * `matches` patterns are ECMAScript regexes, capped at 256 chars and
 * compile-checked at validation time. They execute only after a rule passes
 * the lifecycle (draft → approval → active), so patterns are reviewed
 * content, not anonymous input — hosts exposing rule authoring to untrusted
 * users should keep that gate in place.
 */
export const REGEX_PATTERN_MAX = 256;

export function compileRegex(pattern: string): RegExp | null {
  if (pattern.length === 0 || pattern.length > REGEX_PATTERN_MAX) return null;
  try {
    return new RegExp(pattern, 'u');
  } catch {
    return null;
  }
}

export const filterExprSchema: z.ZodType<FilterExpr> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      field: identifierSchema,
      value: scalarSchema,
    }),
    z.object({
      op: z.enum(['in', 'notIn']),
      field: identifierSchema,
      values: z.array(scalarSchema).min(1).max(256),
    }),
    z.object({
      op: z.literal('inSet'),
      field: identifierSchema,
      set: valueSetRefSchema,
    }),
    z.object({
      op: z.literal('matches'),
      field: identifierSchema,
      pattern: z
        .string()
        .min(1)
        .max(REGEX_PATTERN_MAX)
        .refine((p) => compileRegex(p) !== null, 'must be a valid ECMAScript regex'),
    }),
    z.object({
      op: z.enum(['isNull', 'isNotNull']),
      field: identifierSchema,
    }),
    z.object({
      op: z.enum(['and', 'or']),
      args: z.array(filterExprSchema).min(1).max(32),
    }),
    z.object({
      op: z.literal('not'),
      arg: filterExprSchema,
    }),
  ]),
);

/** Resolution services the interpreter may need; today only value-set lookup. */
export interface FilterContext {
  /** Resolve a value-set id to its members; undefined = unknown set. */
  valueSet?: (id: string) => readonly Scalar[] | undefined;
}

/** Collect every field id referenced by a filter expression. */
export function filterFields(expr: FilterExpr, into: Set<string> = new Set()): Set<string> {
  switch (expr.op) {
    case 'and':
    case 'or':
      for (const a of expr.args) filterFields(a, into);
      break;
    case 'not':
      filterFields(expr.arg, into);
      break;
    default:
      into.add(expr.field);
  }
  return into;
}

/** Collect every value-set id referenced by a filter expression. */
export function filterValueSets(expr: FilterExpr, into: Set<string> = new Set()): Set<string> {
  switch (expr.op) {
    case 'and':
    case 'or':
      for (const a of expr.args) filterValueSets(a, into);
      break;
    case 'not':
      filterValueSets(expr.arg, into);
      break;
    case 'inSet':
      into.add(expr.set);
      break;
    default:
      break;
  }
  return into;
}

function compare(a: unknown, b: Scalar): number | null {
  if (a === null || a === undefined || b === null) return null;
  if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  // Cross-type comparison: numbers stored as strings by some drivers.
  if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a))) {
    const n = Number(a);
    return n === b ? 0 : n < b ? -1 : 1;
  }
  return null;
}

/**
 * Evaluate a condition against an in-memory row. This is the engine's ONLY
 * execution path for rule conditions — rows are materialized before rules run,
 * so unlike the allocation engine there is no SQL compilation twin to drift
 * from.
 *
 * Null semantics follow SQL: comparisons against NULL are never true;
 * only isNull/isNotNull observe NULLs. A missing row key is a NULL.
 *
 * `inSet` with an unresolvable set throws: an unknown value-set is a
 * configuration defect the validation tiers exist to prevent, never a data
 * condition to be silently false about.
 */
export function evaluateFilter(
  expr: FilterExpr,
  row: Record<string, unknown>,
  ctx?: FilterContext,
): boolean {
  switch (expr.op) {
    case 'and':
      return expr.args.every((a) => evaluateFilter(a, row, ctx));
    case 'or':
      return expr.args.some((a) => evaluateFilter(a, row, ctx));
    case 'not':
      return !evaluateFilter(expr.arg, row, ctx);
    case 'isNull':
      return row[expr.field] === null || row[expr.field] === undefined;
    case 'isNotNull':
      return row[expr.field] !== null && row[expr.field] !== undefined;
    case 'in':
      return expr.values.some((v) => scalarEquals(row[expr.field], v));
    case 'notIn': {
      const v = row[expr.field];
      if (v === null || v === undefined) return false; // SQL: NULL NOT IN (...) is not true
      return !expr.values.some((x) => scalarEquals(v, x));
    }
    case 'inSet': {
      const members = ctx?.valueSet?.(expr.set);
      if (members === undefined) {
        throw new Error(`evaluateFilter: unknown value-set "${expr.set}" (no resolver or unresolved id)`);
      }
      return members.some((v) => scalarEquals(row[expr.field], v));
    }
    case 'matches': {
      const v = row[expr.field];
      if (v === null || v === undefined) return false; // SQL: NULL never matches
      const re = compileRegex(expr.pattern);
      if (re === null) return false; // validation prevents this; fail closed
      // Driver tolerance: numbers/booleans match against their string form.
      const text =
        typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
      return text !== null && re.test(text);
    }
    case 'eq':
      return scalarEquals(row[expr.field], expr.value);
    case 'neq': {
      const v = row[expr.field];
      if (v === null || v === undefined || expr.value === null) return false;
      return !scalarEquals(v, expr.value);
    }
    case 'gt': {
      const c = compare(row[expr.field], expr.value);
      return c !== null && c > 0;
    }
    case 'gte': {
      const c = compare(row[expr.field], expr.value);
      return c !== null && c >= 0;
    }
    case 'lt': {
      const c = compare(row[expr.field], expr.value);
      return c !== null && c < 0;
    }
    case 'lte': {
      const c = compare(row[expr.field], expr.value);
      return c !== null && c <= 0;
    }
  }
}

export function scalarEquals(a: unknown, b: Scalar): boolean {
  if (b === null) return a === null; // eq null matches SQL "IS NULL" intent for config ergonomics
  if (a === null || a === undefined) return false;
  if (typeof a === typeof b) return a === b;
  // Tolerate driver stringification of numbers/booleans.
  if (typeof b === 'number' && typeof a === 'string') return Number(a) === b && a.trim() !== '';
  if (typeof b === 'boolean' && typeof a === 'number') return (a !== 0) === b;
  return false;
}
