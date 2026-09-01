import { UnsupportedError } from '../domain/errors.js';
import type { FilterExpr, Roles, SourceBinding, TimestampRef } from '../config/schemas.js';
import { baseAlias, parseColumnRef, type Relation } from '../config/relation.js';
import type { SqlDialect } from './dialect.js';

/**
 * Compilation of engine configuration into parameterised SQL.
 *
 * Two invariants hold everywhere in this file:
 *  - host DATA is never interpolated; it travels as a bound parameter;
 *  - host IDENTIFIERS are never interpolated raw; they go through the
 *    dialect's quoter, having already passed the identifier regex at parse
 *    time and (at bind time) information_schema verification.
 */

/**
 * Accumulates bound parameters and hands back the dialect's placeholder for
 * each. Positional state lives here rather than being threaded through every
 * compile function, which is where off-by-one placeholder bugs come from.
 */
export class ParamBuilder {
  private readonly values: unknown[] = [];

  constructor(private readonly dialect: SqlDialect) {}

  /** Bind a value and return its placeholder. */
  add(value: unknown): string {
    this.values.push(value);
    return this.dialect.placeholder(this.values.length);
  }

  /** Bind a Date, returning a placeholder cast to a timestamp type. */
  addTimestamp(date: Date): string {
    this.values.push(this.dialect.timestampParam(date));
    return this.dialect.timestampPlaceholder(this.values.length);
  }

  get params(): unknown[] {
    return [...this.values];
  }

  get length(): number {
    return this.values.length;
  }
}

export interface CompiledSql {
  text: string;
  params: unknown[];
}

// ---------------------------------------------------------------------------
// The FROM clause
// ---------------------------------------------------------------------------

/**
 * Quote a possibly-qualified column reference.
 *
 * `"status"` becomes `"base"."status"`; `"u.fullName"` becomes
 * `"u"."fullName"`. Everything is qualified, even in the single-table case —
 * an unqualified name is ambiguous the moment a join introduces a column of
 * the same name on the other side, and that ambiguity is a runtime SQL error
 * rather than something the config layer can see.
 */
export function quoteColumn(reference: string, dialect: SqlDialect, relation: Relation): string {
  const { alias, column } = parseColumnRef(reference);
  return `${dialect.quoteIdent(alias ?? baseAlias(relation))}.${dialect.quoteIdent(column)}`;
}

/**
 * Build `FROM base AS b LEFT JOIN other AS o ON b.x = o.y`.
 *
 * The host declares the tables and the keys; the engine writes the SQL. There
 * is deliberately no way to supply a join condition as text — a binding is
 * untrusted input, and an ON clause is as good as an arbitrary predicate.
 */
export function fromClause(relation: Relation, dialect: SqlDialect): string {
  const q = (name: string) => dialect.quoteIdent(name);
  let sql = `${dialect.qualifyTable(relation.table)} AS ${q(baseAlias(relation))}`;

  for (const join of relation.joins) {
    const on = join.on
      .map(
        (k) =>
          `${q(k.leftAlias)}.${q(k.leftColumn)} = ${q(k.rightAlias)}.${q(k.rightColumn)}`,
      )
      .join(' AND ');
    sql += ` ${join.type === 'inner' ? 'INNER' : 'LEFT'} JOIN ${dialect.qualifyTable(join.table)} AS ${q(join.alias)} ON ${on}`;
  }
  return sql;
}

/**
 * Compile a filter expression to a boolean SQL predicate.
 *
 * NULL semantics follow SQL, not JavaScript: `neq` and `notIn` are false for a
 * NULL column, matching what the database itself would do, so an in-memory
 * check and a pushed-down predicate can never disagree about a row.
 */
export function compileFilter(
  expr: FilterExpr,
  dialect: SqlDialect,
  params: ParamBuilder,
  relation: Relation,
): string {
  const col = (name: string): string => quoteColumn(name, dialect, relation);
  switch (expr.op) {
    case 'and':
    case 'or': {
      const joiner = expr.op === 'and' ? ' AND ' : ' OR ';
      return `(${expr.args.map((a) => compileFilter(a, dialect, params, relation)).join(joiner)})`;
    }
    case 'not':
      return `(NOT ${compileFilter(expr.arg, dialect, params, relation)})`;
    case 'isNull':
      return `(${col(expr.column)} IS NULL)`;
    case 'isNotNull':
      return `(${col(expr.column)} IS NOT NULL)`;
    case 'in':
    case 'notIn': {
      const placeholders = expr.values.map((v) => params.add(v)).join(', ');
      const negate = expr.op === 'notIn' ? 'NOT ' : '';
      return `(${col(expr.column)} ${negate}IN (${placeholders}))`;
    }
    case 'eq':
      // `eq null` reads as IS NULL for configuration ergonomics; SQL '= NULL'
      // is never true and would silently match nothing.
      if (expr.value === null) return `(${col(expr.column)} IS NULL)`;
      return `(${col(expr.column)} = ${params.add(expr.value)})`;
    case 'neq':
      if (expr.value === null) return `(${col(expr.column)} IS NOT NULL)`;
      return `(${col(expr.column)} <> ${params.add(expr.value)})`;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (expr.value === null) {
        throw new UnsupportedError(`filter op '${expr.op}' cannot compare against null`);
      }
      const operator = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[expr.op];
      return `(${col(expr.column)} ${operator} ${params.add(expr.value)})`;
    }
  }
}

/** Combine predicates with AND, returning undefined when there are none. */
export function andAll(predicates: readonly (string | undefined)[]): string | undefined {
  const present = predicates.filter((p): p is string => p !== undefined && p.length > 0);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return `(${present.join(' AND ')})`;
}

/** `WHERE ...`, or the empty string when unfiltered. */
export function whereClause(predicate: string | undefined): string {
  return predicate === undefined ? '' : ` WHERE ${predicate}`;
}

// ---------------------------------------------------------------------------
// Role expressions
// ---------------------------------------------------------------------------

/**
 * A timestamp column as a comparable timestamptz expression.
 *
 * A naive local-time column (`tz` set) is interpreted in that zone before
 * being normalised to UTC. Without this the log would be ordered by wall-clock
 * strings across a DST boundary, which reorders events silently — an hour of
 * the process appearing to run backwards.
 */
export function timestampExpr(ref: TimestampRef, dialect: SqlDialect, relation: Relation): string {
  const column = quoteColumn(ref.column, dialect, relation);
  if (ref.tz === undefined) return dialect.castTimestamp(column);
  const zone = `'${ref.tz.replaceAll("'", "''")}'`;
  switch (dialect.name) {
    case 'postgres':
      return `(CAST(${column} AS timestamp) AT TIME ZONE ${zone})`;
    case 'duckdb':
      return `(CAST(${column} AS TIMESTAMP) AT TIME ZONE ${zone})`;
    default:
      throw new UnsupportedError(`no naive-timestamp handling for dialect ${JSON.stringify(dialect.name)}`);
  }
}

/**
 * The activity name expression. Composite classifiers are joined NULL-tolerantly
 * so a row with a null sub-queue still yields an activity rather than vanishing
 * from the log — a silently dropped event is a silently wrong process map.
 */
export function activityExpr(
  roles: Roles,
  dialect: SqlDialect,
  relation: Relation,
): string | undefined {
  const classifier = roles.activity;
  if (classifier === undefined) return undefined;
  const parts = classifier.columns.map((part) => {
    if (typeof part === 'string') {
      return `CAST(${quoteColumn(part, dialect, relation)} AS VARCHAR)`;
    }
    // A field inside a JSON column: already text, so no cast is needed and a
    // cast would only hide a null behind the string 'null'.
    return dialect.jsonFieldConst(quoteColumn(part.column, dialect, relation), part.jsonKey);
  });
  if (parts.length === 1) return parts[0]!;
  return dialect.concatWs(classifier.separator, parts);
}

/**
 * The case-key expression for a binding, given which object type the analysis
 * is pivoting on.
 *
 * Resolution order matters: an explicit `caseObject` wins, because choosing the
 * case key per analysis is the whole point of the object links. Falling back to
 * `roles.case` keeps the simple single-key configuration working with no
 * objects declared at all.
 */
export function caseKeyExpr(
  binding: SourceBinding,
  dialect: SqlDialect,
  caseObject?: string,
): string | undefined {
  if (caseObject !== undefined) {
    const link = binding.objects.find((o) => o.type === caseObject);
    return link === undefined ? undefined : quoteColumn(link.column, dialect, binding.from);
  }
  if (binding.roles.case !== undefined) {
    return quoteColumn(binding.roles.case, dialect, binding.from);
  }
  const sole = binding.objects[0];
  return sole === undefined ? undefined : quoteColumn(sole.column, dialect, binding.from);
}

/**
 * The timestamp expressions a binding contributes, in event order.
 *
 * An `event` row yields one; an `interval` row yields two, which is why an
 * interval source can distinguish waiting from handling while a bare event
 * stream cannot. A `snapshot` row yields none — it has no history to give.
 */
export function eventTimestamps(
  binding: SourceBinding,
  dialect: SqlDialect,
): { label: string; expr: string }[] {
  const { roles, grain } = binding;
  if (grain === 'event' && roles.timestamp !== undefined) {
    return [{ label: 'occurred', expr: timestampExpr(roles.timestamp, dialect, binding.from) }];
  }
  if (grain === 'interval' && roles.start !== undefined && roles.end !== undefined) {
    return [
      { label: 'start', expr: timestampExpr(roles.start, dialect, binding.from) },
      { label: 'complete', expr: timestampExpr(roles.end, dialect, binding.from) },
    ];
  }
  return [];
}
