import { z } from 'zod';

/** Scalar values allowed in filter comparisons and config-supplied column writes. */
export type Scalar = string | number | boolean | null;

export const scalarSchema: z.ZodType<Scalar> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

/**
 * Host-supplied identifiers (table/column names). The regex is defense-in-depth
 * and early feedback; the dialect quoter and information_schema verification at
 * activation are the real safety layers.
 */
export const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]{0,127}$/;
export const identifierSchema = z
  .string()
  .regex(IDENTIFIER_RE, 'must be a plain SQL identifier (letters, digits, _, $; max 128 chars)');

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * The engine-neutral filter AST — the ONLY filter language in configuration.
 * There is deliberately no raw-SQL escape hatch: config flows from admin UIs
 * and untrusted API callers. Hosts needing arbitrary logic implement a port in
 * code, where they own the risk.
 */
export type FilterExpr =
  | { op: ComparisonOp; column: string; value: Scalar }
  | { op: 'in' | 'notIn'; column: string; values: Scalar[] }
  | { op: 'isNull' | 'isNotNull'; column: string }
  | { op: 'and' | 'or'; args: FilterExpr[] }
  | { op: 'not'; arg: FilterExpr };

export const filterExprSchema: z.ZodType<FilterExpr> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      column: identifierSchema,
      value: scalarSchema,
    }),
    z.object({
      op: z.enum(['in', 'notIn']),
      column: identifierSchema,
      values: z.array(scalarSchema).min(1).max(256),
    }),
    z.object({
      op: z.enum(['isNull', 'isNotNull']),
      column: identifierSchema,
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

/** Collect every column name referenced by a filter expression. */
export function filterColumns(expr: FilterExpr, into: Set<string> = new Set()): Set<string> {
  switch (expr.op) {
    case 'and':
    case 'or':
      for (const a of expr.args) filterColumns(a, into);
      break;
    case 'not':
      filterColumns(expr.arg, into);
      break;
    default:
      into.add(expr.column);
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
 * Evaluate a filter against an in-memory row. Used by the in-memory adapter,
 * the allocations audit query, and tests. SQL backends compile the same AST
 * instead (see sql/compiler.ts) — semantics are kept aligned by shared tests.
 *
 * Null semantics follow SQL: comparisons against NULL are never true;
 * only isNull/isNotNull observe NULLs.
 */
export function evaluateFilter(expr: FilterExpr, row: Record<string, unknown>): boolean {
  switch (expr.op) {
    case 'and':
      return expr.args.every((a) => evaluateFilter(a, row));
    case 'or':
      return expr.args.some((a) => evaluateFilter(a, row));
    case 'not':
      return !evaluateFilter(expr.arg, row);
    case 'isNull':
      return row[expr.column] === null || row[expr.column] === undefined;
    case 'isNotNull':
      return row[expr.column] !== null && row[expr.column] !== undefined;
    case 'in':
      return expr.values.some((v) => scalarEquals(row[expr.column], v));
    case 'notIn': {
      const v = row[expr.column];
      if (v === null || v === undefined) return false; // SQL: NULL NOT IN (...) is not true
      return !expr.values.some((x) => scalarEquals(v, x));
    }
    case 'eq':
      return scalarEquals(row[expr.column], expr.value);
    case 'neq': {
      const v = row[expr.column];
      if (v === null || v === undefined || expr.value === null) return false;
      return !scalarEquals(v, expr.value);
    }
    case 'gt': {
      const c = compare(row[expr.column], expr.value);
      return c !== null && c > 0;
    }
    case 'gte': {
      const c = compare(row[expr.column], expr.value);
      return c !== null && c >= 0;
    }
    case 'lt': {
      const c = compare(row[expr.column], expr.value);
      return c !== null && c < 0;
    }
    case 'lte': {
      const c = compare(row[expr.column], expr.value);
      return c !== null && c <= 0;
    }
  }
}

function scalarEquals(a: unknown, b: Scalar): boolean {
  if (b === null) return a === null; // eq null matches SQL "IS NULL" intent for config ergonomics
  if (a === null || a === undefined) return false;
  if (typeof a === typeof b) return a === b;
  // Tolerate driver stringification of numbers/booleans.
  if (typeof b === 'number' && typeof a === 'string') return Number(a) === b && a.trim() !== '';
  if (typeof b === 'boolean' && typeof a === 'number') return (a !== 0) === b;
  return false;
}
