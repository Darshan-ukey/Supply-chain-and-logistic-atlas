import type { WorkSourceBinding, WorkerSourceBinding } from '../config/schemas.js';
import { isAdapterRef } from '../config/schemas.js';
import { AdapterError, looksLikeSchemaError } from '../domain/errors.js';
import type { Assignment, AssignResult, WorkItem, Worker } from '../domain/types.js';
import type { BackendAdapter, QueueRuntimeRef } from '../ports/adapter.js';
import type { Clock } from '../ports/clock.js';
import { systemClock } from '../ports/clock.js';
import {
  buildCandidateSelect,
  buildClaimUpdate,
  buildLoadSelect,
  buildReleaseUpdate,
  buildWorkersSelect,
} from './compiler.js';
import type { ResolvedConnection } from './connections.js';

export interface ConnectionResolverPort {
  resolve(connectionRef: string): Promise<ResolvedConnection>;
}

function workBinding(queue: QueueRuntimeRef): WorkSourceBinding {
  const w = queue.definition.work;
  if (isAdapterRef(w)) throw new AdapterError(`queue ${queue.queueId}: work uses a custom adapterRef, not a SQL binding`);
  return w;
}

function workerBinding(queue: QueueRuntimeRef): WorkerSourceBinding {
  const w = queue.definition.workers;
  if (isAdapterRef(w)) throw new AdapterError(`queue ${queue.queueId}: workers uses a custom adapterRef, not a SQL binding`);
  return w;
}

/** Parse a driver-returned timestamp; naive strings are assumed UTC (metrics-only use). */
function parseTimestamp(v: unknown): Date | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === 'string') {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.replace(' ', 'T')}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function wrap(err: unknown, context: string): AdapterError {
  const msg = err instanceof Error ? err.message : String(err);
  return new AdapterError(`${context}: ${msg}`, { schemaClass: looksLikeSchemaError(err) });
}

/**
 * The shipped first-party adapter: implements the ports from declarative
 * bindings. One instance serves every binding-configured queue — it reads the
 * binding from the QueueRuntimeRef on each call, so config updates apply on
 * the next run with no re-wiring.
 */
export class SqlBindingAdapter implements BackendAdapter {
  private readonly connections: ConnectionResolverPort;
  private readonly clock: Clock;

  constructor(connections: ConnectionResolverPort, clock: Clock = systemClock) {
    this.connections = connections;
    this.clock = clock;
  }

  readonly work = {
    fetchAllocatable: async (queue: QueueRuntimeRef, limit: number): Promise<WorkItem[]> => {
      const b = workBinding(queue);
      const { client, dialect } = await this.connections.resolve(b.connectionRef);
      const sql = buildCandidateSelect(b, dialect, limit);
      let rows: Record<string, unknown>[];
      try {
        rows = (await client.query(sql.text, sql.params)).rows;
      } catch (err) {
        throw wrap(err, `fetchAllocatable(${queue.queueId})`);
      }
      return rows.map((r) => {
        const attrs: Record<string, unknown> = {};
        for (const a of b.fields.attributes) attrs[a] = r[a];
        const item: WorkItem = { id: String(r['__id']), attrs };
        const created = parseTimestamp(r['__created_at']);
        if (created) item.createdAt = created;
        const pr = r['__priority'];
        if (pr !== null && pr !== undefined && !Number.isNaN(Number(pr))) item.priority = Number(pr);
        return item;
      });
    },
  };

  readonly workers = {
    fetchEligible: async (queue: QueueRuntimeRef): Promise<Worker[]> => {
      const wb = workerBinding(queue);
      const { client, dialect } = await this.connections.resolve(wb.connectionRef);
      const sql = buildWorkersSelect(wb, dialect);
      let rows: Record<string, unknown>[];
      try {
        rows = (await client.query(sql.text, sql.params)).rows;
      } catch (err) {
        throw wrap(err, `fetchEligible(${queue.queueId})`);
      }

      let loadByWorker: Map<string, number> | null = null;
      if (wb.load.kind === 'count-open-items') {
        // Load lives in the WORK table — possibly a different connection.
        const b = workBinding(queue);
        const wc = await this.connections.resolve(b.connectionRef);
        const loadSql = buildLoadSelect(b, wc.dialect, wb.load.countWhere);
        try {
          const { rows: loadRows } = await wc.client.query(loadSql.text, loadSql.params);
          loadByWorker = new Map(loadRows.map((r) => [String(r['__worker']), Number(r['__n'] ?? 0)]));
        } catch (err) {
          throw wrap(err, `loadQuery(${queue.queueId})`);
        }
      }

      return rows.map((r) => {
        const attrs: Record<string, unknown> = {};
        for (const a of wb.fields.attributes) attrs[a] = r[a];
        const id = String(r['__id']);
        let capacity: number | null = null;
        if (wb.fields.capacity) {
          const col = r['__capacity'];
          if (col !== null && col !== undefined && !Number.isNaN(Number(col))) capacity = Number(col);
          else if (wb.fields.capacity.default !== undefined) capacity = wb.fields.capacity.default;
        }
        const currentLoad =
          wb.load.kind === 'column' ? Number(r['__load'] ?? 0) : (loadByWorker?.get(id) ?? 0);
        return { id, capacity, currentLoad, attrs };
      });
    },
  };

  readonly assigner = {
    assign: async (queue: QueueRuntimeRef, plan: Assignment[]): Promise<AssignResult[]> => {
      const b = workBinding(queue);
      const { client, dialect } = await this.connections.resolve(b.connectionRef);
      const now = this.clock.now();
      const results: AssignResult[] = [];
      for (const a of plan) {
        const sql = buildClaimUpdate(b, dialect, a.itemId, a.workerId, now);
        try {
          const { rowCount } = await client.execute(sql.text, sql.params);
          results.push(
            rowCount >= 1
              ? { itemId: a.itemId, status: 'assigned', workerId: a.workerId }
              : { itemId: a.itemId, status: 'lost' },
          );
        } catch (err) {
          results.push({
            itemId: a.itemId,
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return results;
    },

    explain: async (queue: QueueRuntimeRef, plan: Assignment[]): Promise<string[]> => {
      const b = workBinding(queue);
      const { dialect } = await this.connections.resolve(b.connectionRef);
      const now = this.clock.now();
      return plan.map((a) => {
        const sql = buildClaimUpdate(b, dialect, a.itemId, a.workerId, now);
        return `${sql.text} -- params: ${JSON.stringify(sql.params)}`;
      });
    },

    release: async (queue: QueueRuntimeRef, itemIds: string[]): Promise<number> => {
      if (itemIds.length === 0) return 0;
      const b = workBinding(queue);
      const { client, dialect } = await this.connections.resolve(b.connectionRef);
      const sql = buildReleaseUpdate(b, dialect, { itemIds });
      try {
        return (await client.execute(sql.text, sql.params)).rowCount;
      } catch (err) {
        throw wrap(err, `release(${queue.queueId})`);
      }
    },

    releaseStale: async (queue: QueueRuntimeRef, cutoff: Date): Promise<number> => {
      const b = workBinding(queue);
      if (!b.fields.assignedAt) return 0;
      const { client, dialect } = await this.connections.resolve(b.connectionRef);
      const assignedBefore = dialect.formatTimestamp(cutoff, b.fields.assignedAt.timezone);
      const sql = buildReleaseUpdate(b, dialect, { assignedBefore });
      try {
        return (await client.execute(sql.text, sql.params)).rowCount;
      } catch (err) {
        throw wrap(err, `releaseStale(${queue.queueId})`);
      }
    },
  };
}
