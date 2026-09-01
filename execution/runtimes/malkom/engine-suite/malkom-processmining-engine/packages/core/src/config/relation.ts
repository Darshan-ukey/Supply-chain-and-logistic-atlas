import { z } from 'zod';
import { identifierSchema } from '../domain/identifiers.js';
import { tableRefSchema } from './connection.js';

/**
 * Where a binding's rows come from.
 *
 * A single table is the common case, but real host schemas rarely put
 * everything in one place: the timestamps are in a work table, the business
 * reference is on a header table, the resource name is in a users table. The
 * engine's rule is that the HOST says where the data lives — so it has to be
 * able to say "these tables, joined like this", not just "this table".
 *
 * Joins are DECLARED, never written as SQL. Bindings arrive from admin UIs and
 * API callers, so there is no raw-SQL escape hatch anywhere in this file; the
 * engine builds the FROM clause from the structure below and every identifier
 * passes the identifier regex before it reaches the dialect's quoter.
 */

/** How to combine a joined table with what precedes it. */
export const joinTypeSchema = z.enum(['inner', 'left']);
export type JoinType = z.infer<typeof joinTypeSchema>;

/** One equality between two aliased columns: `a.x = b.y`. */
export const joinKeySchema = z.object({
  /** Alias of a table already in the relation. */
  leftAlias: identifierSchema,
  leftColumn: identifierSchema,
  /** Alias of the table being joined. */
  rightAlias: identifierSchema,
  rightColumn: identifierSchema,
});
export type JoinKey = z.infer<typeof joinKeySchema>;

export const joinedTableSchema = z.object({
  table: tableRefSchema,
  /** Alias used to reference this table's columns, e.g. 'u' then 'u.fullName'. */
  alias: identifierSchema,
  type: joinTypeSchema.default('left'),
  /** At least one equality. A join with no keys is a cross product. */
  on: z.array(joinKeySchema).min(1).max(8),
});
export type JoinedTable = z.infer<typeof joinedTableSchema>;

/**
 * The full FROM clause, declaratively.
 *
 * `left` is the default join type on purpose: an inner join silently DROPS
 * events whose lookup row is missing, which quietly shrinks the log and makes
 * a process look cleaner than it is. Losing events must be something the host
 * asks for, not something it gets by accident.
 */
export const relationSchema = z.object({
  table: tableRefSchema,
  /** Alias for the base table. Defaults to the table name. */
  alias: identifierSchema.optional(),
  joins: z.array(joinedTableSchema).max(8).default([]),
});
export type Relation = z.infer<typeof relationSchema>;

/** Accept a bare table reference as shorthand for a single-table relation. */
export const relationInputSchema = z.union([
  tableRefSchema.transform((table): Relation => ({ table, joins: [] })),
  relationSchema,
]);

/** The alias the base table is referenced by. */
export function baseAlias(relation: Relation): string {
  return relation.alias ?? relation.table.name;
}

/** Every alias in the relation, base first. */
export function relationAliases(relation: Relation): string[] {
  return [baseAlias(relation), ...relation.joins.map((j) => j.alias)];
}

/** True when the relation is a single table with no joins. */
export function isSingleTable(relation: Relation): boolean {
  return relation.joins.length === 0;
}

/**
 * A reference to a column, optionally qualified by a table alias.
 *
 * Hosts write `"allocatedOn"` for the base table and `"u.fullName"` for a
 * joined one, so the common single-table case stays exactly as short as it was
 * before joins existed.
 */
export interface ColumnRef {
  alias: string | undefined;
  column: string;
}

/** Split `"alias.column"` into its parts; a bare name has no alias. */
export function parseColumnRef(reference: string): ColumnRef {
  const dot = reference.indexOf('.');
  if (dot === -1) return { alias: undefined, column: reference };
  return { alias: reference.slice(0, dot), column: reference.slice(dot + 1) };
}

/**
 * Column references allow ONE optional `alias.` prefix. Both halves are
 * validated as plain identifiers, so the dotted form widens what a host can
 * say without widening what can reach SQL.
 */
export const COLUMN_REF_RE = /^[A-Za-z_][A-Za-z0-9_$]{0,127}(\.[A-Za-z_][A-Za-z0-9_$]{0,127})?$/;
export const columnRefSchema = z
  .string()
  .regex(
    COLUMN_REF_RE,
    'must be a column name, optionally qualified by a table alias (e.g. "status" or "u.fullName")',
  );
