import type { OrderingTerm, WorkSourceBinding, WorkerSourceBinding } from '../config/schemas.js';
import { isAdapterRef } from '../config/schemas.js';
import { AdapterError } from '../domain/errors.js';
import { evaluateFilter } from '../domain/filter.js';
import type { Assignment, AssignResult, WorkItem, Worker } from '../domain/types.js';
import type { BackendAdapter, QueueRuntimeRef } from '../ports/adapter.js';
import type { Clock } from '../ports/clock.js';
import { systemClock } from '../ports/clock.js';

type Row = Record<string, unknown>;

function isUnassigned(row: Row, b: WorkSourceBinding): boolean {
  const v = row[b.fields.assignee];
  if (b.unassignedValue === undefined || b.unassignedValue === null) return v === null || v === undefined;
  return v === b.unassignedValue;
}

function inSubQueue(row: Row, b: WorkSourceBinding): boolean {
  const sq = b.fields.subQueue;
  if (!sq) return true;
  if (sq.value === null) return row[sq.column] === null || row[sq.column] === undefined;
  return row[sq.column] === sq.value;
}

function claimable(row: Row, b: WorkSourceBinding): boolean {
  return isUnassigned(row, b) && inSubQueue(row, b) && evaluateFilter(b.allocatableWhen, row);
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1;
  return String(a) < String(b) ? -1 : 1;
}

function orderComparator(terms: readonly OrderingTerm[]): (a: Row, b: Row) => number {
  return (ra, rb) => {
    for (const t of terms) {
      const va = ra[t.column] ?? null;
      const vb = rb[t.column] ?? null;
      if (va === null || vb === null) {
        if (va === vb) continue;
        // Default NULL placement mirrors SQLite: NULLs sort smallest.
        const nullsFirst = t.nulls ? t.nulls === 'first' : t.dir === 'asc';
        return (va === null ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const c = compareValues(va, vb);
      if (c !== 0) return t.dir === 'asc' ? c : -c;
    }
    return 0;
  };
}

/**
 * In-memory backend adapter with the SAME binding semantics as the SQL
 * adapter (guarded claims, onAssign.set, release). Useful for host
 * prototyping without a database, and as the reference implementation the
 * pipeline tests run against.
 *
 * Bindings come from the queue definition when present; a queue that selects
 * this adapter via `{ adapterRef }` uses the constructor-supplied bindings.
 */
export class MemoryBackendAdapter implements BackendAdapter {
  readonly workRows: Row[];
  readonly workerRows: Row[];
  private readonly clock: Clock;
  private readonly defaultWork: WorkSourceBinding | undefined;
  private readonly defaultWorkers: WorkerSourceBinding | undefined;

  constructor(
    opts: {
      workRows?: Row[];
      workerRows?: Row[];
      clock?: Clock;
      work?: WorkSourceBinding;
      workers?: WorkerSourceBinding;
    } = {},
  ) {
    this.workRows = opts.workRows ?? [];
    this.workerRows = opts.workerRows ?? [];
    this.clock = opts.clock ?? systemClock;
    this.defaultWork = opts.work;
    this.defaultWorkers = opts.workers;
  }

  private workBindingFor(queue: QueueRuntimeRef): WorkSourceBinding {
    const w = queue.definition.work;
    if (!isAdapterRef(w)) return w;
    if (this.defaultWork) return this.defaultWork;
    throw new AdapterError(
      'MemoryBackendAdapter: queue uses adapterRef but no work binding was supplied to the constructor',
    );
  }

  private workerBindingFor(queue: QueueRuntimeRef): WorkerSourceBinding {
    const w = queue.definition.workers;
    if (!isAdapterRef(w)) return w;
    if (this.defaultWorkers) return this.defaultWorkers;
    throw new AdapterError(
      'MemoryBackendAdapter: queue uses adapterRef but no workers binding was supplied to the constructor',
    );
  }

  readonly work = {
    fetchAllocatable: async (queue: QueueRuntimeRef, limit: number): Promise<WorkItem[]> => {
      const b = this.workBindingFor(queue);
      const rows = this.workRows.filter((r) => claimable(r, b)).sort(orderComparator(b.ordering));
      return rows.slice(0, limit).map((r) => {
        const attrs: Record<string, unknown> = {};
        for (const a of b.fields.attributes) attrs[a] = r[a];
        const item: WorkItem = { id: String(r[b.fields.id]), attrs };
        if (b.fields.createdAt) {
          const v = r[b.fields.createdAt];
          if (v instanceof Date) item.createdAt = v;
          else if (typeof v === 'string' || typeof v === 'number') {
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) item.createdAt = d;
          }
        }
        if (b.fields.priority) {
          const v = r[b.fields.priority];
          if (v !== null && v !== undefined && !Number.isNaN(Number(v))) item.priority = Number(v);
        }
        return item;
      });
    },
  };

  readonly workers = {
    fetchEligible: async (queue: QueueRuntimeRef): Promise<Worker[]> => {
      const wb = this.workerBindingFor(queue);
      const b = this.workBindingFor(queue);
      const rows = this.workerRows.filter(
        (r) => !wb.fields.eligibleWhen || evaluateFilter(wb.fields.eligibleWhen, r),
      );
      return rows.map((r) => {
        const attrs: Record<string, unknown> = {};
        for (const a of wb.fields.attributes) attrs[a] = r[a];
        const id = String(r[wb.fields.id]);
        let capacity: number | null = null;
        if (wb.fields.capacity) {
          const v = wb.fields.capacity.column !== undefined ? r[wb.fields.capacity.column] : undefined;
          if (v !== null && v !== undefined && !Number.isNaN(Number(v))) capacity = Number(v);
          else if (wb.fields.capacity.default !== undefined) capacity = wb.fields.capacity.default;
        }
        let currentLoad = 0;
        if (wb.load.kind === 'column') {
          currentLoad = Number(r[wb.load.column] ?? 0);
        } else {
          const countWhere = wb.load.countWhere;
          currentLoad = this.workRows.filter(
            (wr) =>
              !isUnassigned(wr, b) &&
              inSubQueue(wr, b) &&
              String(wr[b.fields.assignee]) === id &&
              (!countWhere || evaluateFilter(countWhere, wr)),
          ).length;
        }
        return { id, capacity, currentLoad, attrs };
      });
    },
  };

  readonly assigner = {
    assign: async (queue: QueueRuntimeRef, plan: Assignment[]): Promise<AssignResult[]> => {
      const b = this.workBindingFor(queue);
      const now = this.clock.now();
      return plan.map((a) => {
        const row = this.workRows.find((r) => String(r[b.fields.id]) === a.itemId);
        // Re-check the full guard on the live row — compare-and-swap semantics.
        if (!row || !claimable(row, b)) return { itemId: a.itemId, status: 'lost' as const };
        row[b.fields.assignee] = a.workerId;
        if (b.fields.assignedAt) {
          row[b.fields.assignedAt.column] = now.toISOString();
        }
        if (b.onAssign?.set) for (const [col, val] of Object.entries(b.onAssign.set)) row[col] = val;
        return { itemId: a.itemId, status: 'assigned' as const, workerId: a.workerId };
      });
    },

    explain: async (_queue: QueueRuntimeRef, plan: Assignment[]): Promise<string[]> =>
      plan.map((a) => `memory: set assignee=${JSON.stringify(a.workerId)} where id=${JSON.stringify(a.itemId)} if still claimable`),

    release: async (queue: QueueRuntimeRef, itemIds: string[]): Promise<number> => {
      const b = this.workBindingFor(queue);
      let n = 0;
      for (const id of itemIds) {
        const row = this.workRows.find((r) => String(r[b.fields.id]) === id);
        if (!row || isUnassigned(row, b)) continue;
        this.releaseRow(row, b);
        n++;
      }
      return n;
    },

    releaseStale: async (queue: QueueRuntimeRef, cutoff: Date): Promise<number> => {
      const b = this.workBindingFor(queue);
      if (!b.fields.assignedAt) return 0;
      const col = b.fields.assignedAt.column;
      let n = 0;
      for (const row of this.workRows) {
        if (isUnassigned(row, b) || !inSubQueue(row, b)) continue;
        const v = row[col];
        const at = v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
        if (at && !Number.isNaN(at.getTime()) && at < cutoff) {
          this.releaseRow(row, b);
          n++;
        }
      }
      return n;
    },
  };

  private releaseRow(row: Row, b: WorkSourceBinding): void {
    row[b.fields.assignee] = b.unassignedValue === undefined ? null : b.unassignedValue;
    if (b.onRelease?.set) for (const [col, val] of Object.entries(b.onRelease.set)) row[col] = val;
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
