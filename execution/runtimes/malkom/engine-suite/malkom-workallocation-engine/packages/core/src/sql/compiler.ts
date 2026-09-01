import type { WorkSourceBinding, WorkerSourceBinding } from '../config/schemas.js';
import type { FilterExpr } from '../domain/filter.js';
import type { SqlDialect } from './dialect.js';

export interface CompiledSql {
  text: string;
  params: unknown[];
}

/** Ordered parameter sink — placeholder text is emitted at push time, so $n indices stay correct. */
class Params {
  readonly values: unknown[] = [];
  constructor(private readonly dialect: SqlDialect) {}
  add(v: unknown): string {
    this.values.push(v);
    return this.dialect.placeholder(this.values.length);
  }
}

/**
 * Compile the FilterExpr AST to a parenthesized SQL predicate. Identifiers go
 * through the dialect quoter (they were regex-validated at config-write time);
 * every value is a bound parameter — including expanded IN lists. There is no
 * string interpolation of host data anywhere in this file.
 */
function compileFilter(expr: FilterExpr, d: SqlDialect, p: Params): string {
  switch (expr.op) {
    case 'and':
      return `(${expr.args.map((a) => compileFilter(a, d, p)).join(' AND ')})`;
    case 'or':
      return `(${expr.args.map((a) => compileFilter(a, d, p)).join(' OR ')})`;
    case 'not':
      return `(NOT ${compileFilter(expr.arg, d, p)})`;
    case 'isNull':
      return `(${d.quoteIdent(expr.column)} IS NULL)`;
    case 'isNotNull':
      return `(${d.quoteIdent(expr.column)} IS NOT NULL)`;
    case 'in':
      return `(${d.quoteIdent(expr.column)} IN (${expr.values.map((v) => p.add(v)).join(', ')}))`;
    case 'notIn':
      return `(${d.quoteIdent(expr.column)} NOT IN (${expr.values.map((v) => p.add(v)).join(', ')}))`;
    case 'eq':
      if (expr.value === null) return `(${d.quoteIdent(expr.column)} IS NULL)`;
      return `(${d.quoteIdent(expr.column)} = ${p.add(expr.value)})`;
    case 'neq':
      if (expr.value === null) return `(${d.quoteIdent(expr.column)} IS NOT NULL)`;
      return `(${d.quoteIdent(expr.column)} <> ${p.add(expr.value)})`;
    case 'gt':
      return `(${d.quoteIdent(expr.column)} > ${p.add(expr.value)})`;
    case 'gte':
      return `(${d.quoteIdent(expr.column)} >= ${p.add(expr.value)})`;
    case 'lt':
      return `(${d.quoteIdent(expr.column)} < ${p.add(expr.value)})`;
    case 'lte':
      return `(${d.quoteIdent(expr.column)} <= ${p.add(expr.value)})`;
  }
}

/** assignee IS NULL, or equals the configured sentinel for schemas that can't store NULL. */
function unassignedPredicate(b: WorkSourceBinding, d: SqlDialect, p: Params): string {
  const col = d.quoteIdent(b.fields.assignee);
  if (b.unassignedValue === undefined || b.unassignedValue === null) return `(${col} IS NULL)`;
  return `(${col} = ${p.add(b.unassignedValue)})`;
}

function assignedPredicate(b: WorkSourceBinding, d: SqlDialect, p: Params): string {
  const col = d.quoteIdent(b.fields.assignee);
  if (b.unassignedValue === undefined || b.unassignedValue === null) return `(${col} IS NOT NULL)`;
  return `(${col} IS NOT NULL AND ${col} <> ${p.add(b.unassignedValue)})`;
}

function subQueuePredicate(b: WorkSourceBinding, d: SqlDialect, p: Params): string | null {
  const sq = b.fields.subQueue;
  if (!sq) return null;
  if (sq.value === null) return `(${d.quoteIdent(sq.column)} IS NULL)`;
  return `(${d.quoteIdent(sq.column)} = ${p.add(sq.value)})`;
}

/** The full "this row is claimable" guard: unassigned AND allocatable AND right sub-queue. */
function claimGuard(b: WorkSourceBinding, d: SqlDialect, p: Params): string {
  const parts = [unassignedPredicate(b, d, p), compileFilter(b.allocatableWhen, d, p)];
  const sq = subQueuePredicate(b, d, p);
  if (sq) parts.push(sq);
  return parts.join(' AND ');
}

export function buildCandidateSelect(
  b: WorkSourceBinding,
  d: SqlDialect,
  limit: number,
  opts: { skipLocked?: boolean } = {},
): CompiledSql {
  const p = new Params(d);
  const cols = [
    `${d.quoteIdent(b.fields.id)} AS __id`,
    `${d.quoteIdent(b.fields.state)} AS __state`,
  ];
  if (b.fields.createdAt) cols.push(`${d.quoteIdent(b.fields.createdAt)} AS __created_at`);
  if (b.fields.priority) cols.push(`${d.quoteIdent(b.fields.priority)} AS __priority`);
  for (const a of b.fields.attributes) cols.push(d.quoteIdent(a));

  const where = claimGuard(b, d, p);
  const order = b.ordering.map((t) => d.orderTerm(d.quoteIdent(t.column), t.dir, t.nulls)).join(', ');
  const lock = opts.skipLocked && d.supportsSkipLocked ? ' FOR UPDATE SKIP LOCKED' : '';
  const text = `SELECT ${cols.join(', ')} FROM ${d.qualifyTable(b.table)} WHERE ${where} ORDER BY ${order} LIMIT ${p.add(limit)}${lock}`;
  return { text, params: p.values };
}

/**
 * The guarded claim — the engine's one correctness invariant. Zero rows
 * affected means another actor won the race: a normal outcome.
 */
export function buildClaimUpdate(
  b: WorkSourceBinding,
  d: SqlDialect,
  itemId: string,
  workerId: string,
  engineNow: Date,
): CompiledSql {
  const p = new Params(d);
  const sets = [`${d.quoteIdent(b.fields.assignee)} = ${p.add(workerId)}`];
  const at = b.fields.assignedAt;
  if (at) {
    if (at.timezone !== undefined) {
      // Legacy naive local-time column: engine renders the wall time in that zone.
      sets.push(`${d.quoteIdent(at.column)} = ${p.add(d.formatTimestamp(engineNow, at.timezone))}`);
    } else if (at.mode === 'engine-now') {
      sets.push(`${d.quoteIdent(at.column)} = ${p.add(d.formatTimestamp(engineNow))}`);
    } else {
      sets.push(`${d.quoteIdent(at.column)} = ${d.nowUtcExpr()}`);
    }
  }
  if (b.onAssign?.set) {
    for (const [col, val] of Object.entries(b.onAssign.set)) {
      sets.push(`${d.quoteIdent(col)} = ${p.add(val)}`);
    }
  }
  // Push the id parameter BEFORE compiling the guard: parameters must be
  // emitted in text order for '?'-placeholder dialects to bind correctly.
  const idPlaceholder = p.add(itemId);
  const guard = claimGuard(b, d, p);
  const text = `UPDATE ${d.qualifyTable(b.table)} SET ${sets.join(', ')} WHERE ${d.quoteIdent(b.fields.id)} = ${idPlaceholder} AND ${guard}`;
  return { text, params: p.values };
}

/** Release items back to the pool: clear assignee, apply onRelease.set. */
export function buildReleaseUpdate(
  b: WorkSourceBinding,
  d: SqlDialect,
  filter: { itemIds?: string[]; assignedBefore?: string },
): CompiledSql {
  const p = new Params(d);
  const clearValue = b.unassignedValue === undefined ? null : b.unassignedValue;
  const sets = [
    clearValue === null
      ? `${d.quoteIdent(b.fields.assignee)} = NULL`
      : `${d.quoteIdent(b.fields.assignee)} = ${p.add(clearValue)}`,
  ];
  if (b.onRelease?.set) {
    for (const [col, val] of Object.entries(b.onRelease.set)) {
      sets.push(`${d.quoteIdent(col)} = ${p.add(val)}`);
    }
  }
  const where: string[] = [assignedPredicate(b, d, p)];
  const sq = subQueuePredicate(b, d, p);
  if (sq) where.push(sq);
  if (filter.itemIds && filter.itemIds.length > 0) {
    where.push(`${d.quoteIdent(b.fields.id)} IN (${filter.itemIds.map((id) => p.add(id)).join(', ')})`);
  }
  if (filter.assignedBefore !== undefined) {
    if (!b.fields.assignedAt) throw new Error('releaseStale requires an assignedAt binding');
    where.push(`${d.quoteIdent(b.fields.assignedAt.column)} < ${p.add(filter.assignedBefore)}`);
  }
  const text = `UPDATE ${d.qualifyTable(b.table)} SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;
  return { text, params: p.values };
}

export function buildWorkersSelect(b: WorkerSourceBinding, d: SqlDialect): CompiledSql {
  const p = new Params(d);
  const cols = [`${d.quoteIdent(b.fields.id)} AS __id`];
  if (b.fields.capacity?.column) cols.push(`${d.quoteIdent(b.fields.capacity.column)} AS __capacity`);
  if (b.load.kind === 'column') cols.push(`${d.quoteIdent(b.load.column)} AS __load`);
  for (const a of b.fields.attributes) cols.push(d.quoteIdent(a));
  const where = b.fields.eligibleWhen ? ` WHERE ${compileFilter(b.fields.eligibleWhen, d, p)}` : '';
  const text = `SELECT ${cols.join(', ')} FROM ${d.qualifyTable(b.table)}${where}`;
  return { text, params: p.values };
}

/**
 * count-open-items: per-worker open counts derived from the WORK table — the
 * zero-config load source that stays correct when humans reassign work manually.
 */
export function buildLoadSelect(
  work: WorkSourceBinding,
  d: SqlDialect,
  countWhere: FilterExpr | undefined,
): CompiledSql {
  const p = new Params(d);
  const assignee = d.quoteIdent(work.fields.assignee);
  const where: string[] = [assignedPredicate(work, d, p)];
  const sq = subQueuePredicate(work, d, p);
  if (sq) where.push(sq);
  if (countWhere) where.push(compileFilter(countWhere, d, p));
  const text = `SELECT ${assignee} AS __worker, COUNT(*) AS __n FROM ${d.qualifyTable(work.table)} WHERE ${where.join(' AND ')} GROUP BY ${assignee}`;
  return { text, params: p.values };
}

/** Sample query for /validate tier 3 — shows operators what their filter matches. */
export function buildSampleSelect(b: WorkSourceBinding, d: SqlDialect, limit: number): CompiledSql {
  return buildCandidateSelect(b, d, limit);
}
