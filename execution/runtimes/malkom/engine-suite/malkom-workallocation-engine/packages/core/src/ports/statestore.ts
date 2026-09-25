import type { AllocationRunRecord, RunStatus } from '../domain/types.js';

/** Monotonic per-key fencing token — stamped into audit rows to expose zombie writers. */
export interface LeaseGrant {
  token: number;
}

export interface RunListFilter {
  queueId?: string | undefined;
  status?: RunStatus | undefined;
  since?: Date | undefined;
  until?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface RunDeleteFilter {
  queueId?: string | undefined;
  status?: RunStatus | undefined;
  before?: Date | undefined;
  ids?: string[] | undefined;
}

export interface RetentionPolicy {
  /** Delete finished runs older than this. */
  maxAgeMs?: number | undefined;
  /** Keep at most this many runs per queue (newest win). */
  maxCountPerQueue?: number | undefined;
}

export interface RunsSummaryFilter {
  queueId?: string | undefined;
  since?: Date | undefined;
  until?: Date | undefined;
}

export interface QueueRunsSummary {
  queueId: string;
  runs: number;
  assigned: number;
  lost: number;
  errors: number;
  released: number;
  skipped: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  avgDurationMs: number | null;
}

export interface RunsSummary {
  totalRuns: number;
  byStatus: Record<string, number>;
  byQueue: QueueRunsSummary[];
}

/**
 * The engine's own tiny persistence: leases, KV (cursors, pause flags, queue
 * configs), and the run/audit log. Single-writer-per-queue is enforced through
 * acquireLease; KV writes for cursors happen only under a held lease.
 */
export interface StateStore {
  init(): Promise<void>;

  /** Grant iff the key is free, expired, or already held by `holder` (re-entrant renew+bump). */
  acquireLease(key: string, holder: string, ttlMs: number): Promise<LeaseGrant | null>;
  /** Extend the lease iff still held by `holder`. */
  renewLease(key: string, holder: string, ttlMs: number): Promise<boolean>;
  releaseLease(key: string, holder: string): Promise<void>;

  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomic compare-and-set; expect null = "must not exist". */
  compareAndSet(key: string, expect: string | null, value: string): Promise<boolean>;
  listKeys(prefix: string): Promise<string[]>;

  appendRun(record: AllocationRunRecord): Promise<void>;
  updateRun(id: string, patch: Partial<AllocationRunRecord>): Promise<void>;
  getRun(id: string): Promise<AllocationRunRecord | null>;
  listRuns(filter: RunListFilter): Promise<{ runs: AllocationRunRecord[]; total: number }>;
  /** Aggregated view over the run log — powers host dashboards without paging raw records. */
  summarizeRuns(filter: RunsSummaryFilter): Promise<RunsSummary>;
  deleteRuns(filter: RunDeleteFilter): Promise<number>;
  /** Apply retention; returns rows deleted. Called opportunistically after runs. */
  pruneRuns(policy: RetentionPolicy): Promise<number>;
  /** Mark 'running' records older than ttl as 'abandoned' (crashed process). */
  markAbandonedRuns(olderThan: Date): Promise<number>;

  close(): Promise<void>;
}
