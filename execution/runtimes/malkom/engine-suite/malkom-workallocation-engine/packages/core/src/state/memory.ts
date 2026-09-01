import type { Clock } from '../ports/clock.js';
import { systemClock } from '../ports/clock.js';
import type {
  LeaseGrant,
  QueueRunsSummary,
  RetentionPolicy,
  RunDeleteFilter,
  RunListFilter,
  RunsSummary,
  RunsSummaryFilter,
  StateStore,
} from '../ports/statestore.js';
import type { AllocationRunRecord } from '../domain/types.js';

interface LeaseRow {
  holder: string;
  token: number;
  expiresAt: number;
}

/**
 * In-memory state store — tests and ephemeral embedding only. Leases work
 * within the process; nothing survives a restart. NOT valid multi-instance.
 */
export class InMemoryStateStore implements StateStore {
  private readonly leases = new Map<string, LeaseRow>();
  private readonly kv = new Map<string, string>();
  private runs: AllocationRunRecord[] = [];
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  async init(): Promise<void> {}

  async acquireLease(key: string, holder: string, ttlMs: number): Promise<LeaseGrant | null> {
    const now = this.clock.now().getTime();
    const row = this.leases.get(key);
    if (row && row.expiresAt > now && row.holder !== holder) return null;
    const token = (row?.token ?? 0) + 1;
    this.leases.set(key, { holder, token, expiresAt: now + ttlMs });
    return { token };
  }

  async renewLease(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const now = this.clock.now().getTime();
    const row = this.leases.get(key);
    if (!row || row.holder !== holder || row.expiresAt <= now) return false;
    row.expiresAt = now + ttlMs;
    return true;
  }

  async releaseLease(key: string, holder: string): Promise<void> {
    const row = this.leases.get(key);
    if (row && row.holder === holder) row.expiresAt = 0;
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.kv.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key);
  }

  async compareAndSet(key: string, expect: string | null, value: string): Promise<boolean> {
    const current = this.kv.get(key) ?? null;
    if (current !== expect) return false;
    this.kv.set(key, value);
    return true;
  }

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.kv.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  async appendRun(record: AllocationRunRecord): Promise<void> {
    this.runs.push(structuredClone(record));
  }

  async updateRun(id: string, patch: Partial<AllocationRunRecord>): Promise<void> {
    const i = this.runs.findIndex((r) => r.id === id);
    if (i >= 0) this.runs[i] = { ...this.runs[i]!, ...structuredClone(patch) };
  }

  async getRun(id: string): Promise<AllocationRunRecord | null> {
    const r = this.runs.find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  async listRuns(filter: RunListFilter): Promise<{ runs: AllocationRunRecord[]; total: number }> {
    const matched = this.runs
      .filter((r) => this.matches(r, filter))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const offset = filter.offset ?? 0;
    const limit = Math.min(filter.limit ?? 50, 500);
    return { runs: structuredClone(matched.slice(offset, offset + limit)), total: matched.length };
  }

  private matches(r: AllocationRunRecord, f: RunListFilter): boolean {
    if (f.queueId !== undefined && r.queueId !== f.queueId) return false;
    if (f.status !== undefined && r.status !== f.status) return false;
    if (f.since !== undefined && r.startedAt < f.since.toISOString()) return false;
    if (f.until !== undefined && r.startedAt > f.until.toISOString()) return false;
    return true;
  }

  async summarizeRuns(filter: RunsSummaryFilter): Promise<RunsSummary> {
    const matched = this.runs.filter((r) =>
      this.matches(r, { queueId: filter.queueId, since: filter.since, until: filter.until }),
    );
    const byStatus: Record<string, number> = {};
    const byQueue = new Map<string, QueueRunsSummary & { durSum: number; durN: number }>();
    for (const r of matched) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      let q = byQueue.get(r.queueId);
      if (!q) {
        q = {
          queueId: r.queueId, runs: 0, assigned: 0, lost: 0, errors: 0, released: 0, skipped: 0,
          lastRunAt: null, lastStatus: null, avgDurationMs: null, durSum: 0, durN: 0,
        };
        byQueue.set(r.queueId, q);
      }
      q.runs++;
      q.assigned += r.counts.assigned;
      q.lost += r.counts.lost;
      q.errors += r.counts.errors;
      q.released += r.counts.released;
      if (r.status === 'skipped') q.skipped++;
      if (q.lastRunAt === null || r.startedAt > q.lastRunAt) {
        q.lastRunAt = r.startedAt;
        q.lastStatus = r.status;
      }
      if (r.finishedAt !== undefined) {
        q.durSum += new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
        q.durN++;
      }
    }
    return {
      totalRuns: matched.length,
      byStatus,
      byQueue: [...byQueue.values()]
        .map(({ durSum, durN, ...q }) => ({ ...q, avgDurationMs: durN > 0 ? Math.round(durSum / durN) : null }))
        .sort((a, b) => a.queueId.localeCompare(b.queueId)),
    };
  }

  async deleteRuns(filter: RunDeleteFilter): Promise<number> {
    const before = this.runs.length;
    const ids = filter.ids ? new Set(filter.ids) : null;
    this.runs = this.runs.filter((r) => {
      if (ids) return !ids.has(r.id);
      if (filter.queueId !== undefined && r.queueId !== filter.queueId) return true;
      if (filter.status !== undefined && r.status !== filter.status) return true;
      if (filter.before !== undefined && r.startedAt >= filter.before.toISOString()) return true;
      // No criteria at all → delete nothing (the API layer requires at least one).
      if (filter.queueId === undefined && filter.status === undefined && filter.before === undefined) return true;
      return false;
    });
    return before - this.runs.length;
  }

  async pruneRuns(policy: RetentionPolicy): Promise<number> {
    const before = this.runs.length;
    if (policy.maxAgeMs !== undefined) {
      const cutoff = new Date(this.clock.now().getTime() - policy.maxAgeMs).toISOString();
      this.runs = this.runs.filter((r) => r.status === 'running' || r.startedAt >= cutoff);
    }
    if (policy.maxCountPerQueue !== undefined) {
      const byQueue = new Map<string, AllocationRunRecord[]>();
      for (const r of this.runs) {
        const list = byQueue.get(r.queueId) ?? [];
        list.push(r);
        byQueue.set(r.queueId, list);
      }
      const keep = new Set<string>();
      for (const list of byQueue.values()) {
        list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
        for (const r of list.slice(0, policy.maxCountPerQueue)) keep.add(r.id);
        for (const r of list) if (r.status === 'running') keep.add(r.id);
      }
      this.runs = this.runs.filter((r) => keep.has(r.id));
    }
    return before - this.runs.length;
  }

  async markAbandonedRuns(olderThan: Date): Promise<number> {
    let n = 0;
    const cutoff = olderThan.toISOString();
    for (const r of this.runs) {
      if (r.status === 'running' && r.startedAt < cutoff) {
        r.status = 'abandoned';
        n++;
      }
    }
    return n;
  }

  async close(): Promise<void> {}
}
