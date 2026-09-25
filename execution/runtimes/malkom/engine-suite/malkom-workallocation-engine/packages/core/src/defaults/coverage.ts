import { isAdapterRef, type QueueDefinition } from '../config/schemas.js';
import type { FilterExpr } from '../domain/filter.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { WORK_EVENTS_TABLE } from './work-events.js';

/**
 * Coverage watchdog — the engine's answer to "what were we supposed to run
 * but had no rules for?". It scans a workEvents-convention table for distinct
 * (queueId, subqueueId) combinations that have unallocated rows, and reports
 * every combination not covered by any ENABLED queue definition.
 *
 * This respects the allocation boundary: it creates nothing and validates no
 * business rules — it only observes the allocation surface the engine already
 * reads, and makes silence visible.
 */

export interface CoverageOptions {
  table?: string | undefined;
  schema?: string | undefined;
  /** Column names, for hosts that renamed the convention columns. */
  columns?:
    | { queueId?: string | undefined; subqueueId?: string | undefined; assignee?: string | undefined }
    | undefined;
}

export interface UncoveredCombo {
  queueId: unknown;
  subqueueId: unknown;
  /** Unallocated rows waiting with no allocation rules configured. */
  unallocated: number;
}

export interface CoverageReport {
  connectionRef: string;
  table: string;
  checkedAt: string;
  /** Combos with waiting work and NO enabled queue definition — the alert payload. */
  uncovered: UncoveredCombo[];
  /** Combos with waiting work that ARE covered by an enabled definition. */
  covered: number;
}

/** Collect the values a filter pins `column` to via eq/in under top-level ANDs. */
function pinnedValues(expr: FilterExpr, column: string, into: unknown[] = []): unknown[] {
  if (expr.op === 'and') {
    for (const a of expr.args) pinnedValues(a, column, into);
  } else if (expr.op === 'eq' && expr.column === column) {
    into.push(expr.value);
  } else if (expr.op === 'in' && expr.column === column) {
    into.push(...expr.values);
  }
  return into;
}

function sameScalar(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return String(a) === String(b);
}

interface QueueScope {
  queueValues: unknown[];
  subqueueValue: unknown | undefined; // undefined = covers every sub-queue
}

/** Extract the (queueId, subqueueId) scope of a definition bound to `table`. */
function scopeOf(
  def: QueueDefinition,
  table: string,
  cols: { queueId: string; subqueueId: string },
): QueueScope | null {
  if (!def.enabled || isAdapterRef(def.work)) return null;
  if (def.work.table.name !== table) return null;
  const queueValues = pinnedValues(def.work.allocatableWhen, cols.queueId);
  if (queueValues.length === 0) return null; // definition not scoped by queueId — cannot reason about it
  const sq = def.work.fields.subQueue;
  const subqueueValue = sq !== undefined && sq.column === cols.subqueueId ? sq.value : undefined;
  return { queueValues, subqueueValue };
}

export async function checkWorkEventsCoverage(
  conn: { client: SqlClient; dialect: SqlDialect },
  connectionRef: string,
  definitions: QueueDefinition[],
  opts: CoverageOptions = {},
): Promise<CoverageReport> {
  const table = opts.table ?? WORK_EVENTS_TABLE;
  const cols = {
    queueId: opts.columns?.queueId ?? 'queueId',
    subqueueId: opts.columns?.subqueueId ?? 'subqueueId',
    assignee: opts.columns?.assignee ?? 'allocatedTo',
  };
  const d = conn.dialect;
  const t = d.qualifyTable(opts.schema !== undefined ? { schema: opts.schema, name: table } : { name: table });
  // Cheap by construction: the provisioned partial index covers allocatedTo IS NULL.
  const sql = `SELECT ${d.quoteIdent(cols.queueId)} AS __q, ${d.quoteIdent(cols.subqueueId)} AS __sq, COUNT(*) AS __n FROM ${t} WHERE ${d.quoteIdent(cols.assignee)} IS NULL GROUP BY ${d.quoteIdent(cols.queueId)}, ${d.quoteIdent(cols.subqueueId)}`;
  const { rows } = await conn.client.query(sql, []);

  const scopes = definitions
    .map((def) => scopeOf(def, table, cols))
    .filter((s): s is QueueScope => s !== null);

  const uncovered: UncoveredCombo[] = [];
  let covered = 0;
  for (const row of rows) {
    const q = row['__q'];
    const sq = row['__sq'] ?? null;
    const isCovered = scopes.some(
      (s) =>
        s.queueValues.some((v) => sameScalar(v, q)) &&
        (s.subqueueValue === undefined || sameScalar(s.subqueueValue, sq)),
    );
    if (isCovered) covered++;
    else uncovered.push({ queueId: q, subqueueId: sq, unallocated: Number(row['__n'] ?? 0) });
  }
  uncovered.sort((a, b) => b.unallocated - a.unallocated);

  return { connectionRef, table, checkedAt: new Date().toISOString(), uncovered, covered };
}
