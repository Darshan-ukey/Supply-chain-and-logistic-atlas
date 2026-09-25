/**
 * Runtime domain objects — normalized, backend-free snapshots materialized per
 * run and discarded after. Strategies never see a column name; the binding
 * layer translates host rows into these shapes.
 */

/** A work item candidate, projected from a host row. */
export interface WorkItem {
  /** Stringified primary key — the engine never parses it. */
  id: string;
  /** Enqueue time, when the binding maps a createdAt column. Drives FIFO/wait metrics. */
  createdAt?: Date | undefined;
  /** Numeric priority, when mapped. Higher values are NOT assumed better — ordering config decides. */
  priority?: number | undefined;
  /** Columns surfaced via fields.attributes, keyed by column name. */
  attrs: Record<string, unknown>;
}

/** An eligible worker, projected from the host's user table. */
export interface Worker {
  /** The value that will be written into the assignee column. */
  id: string;
  /** Max concurrent open items; null = unbounded. */
  capacity: number | null;
  /** Open-item count resolved fresh this run (never accumulated engine-side). */
  currentLoad: number;
  attrs: Record<string, unknown>;
}

/** Remaining capacity of a worker; Infinity when unbounded. */
export function freeCapacity(w: Worker): number {
  return w.capacity === null ? Number.POSITIVE_INFINITY : Math.max(0, w.capacity - w.currentLoad);
}

/** One planned pairing produced by a strategy. */
export interface Assignment {
  itemId: string;
  workerId: string;
  /** Human-readable strategy rationale, persisted into the audit trail. */
  reason: string;
}

/** Per-item outcome of applying a plan through an Assigner port. */
export type AssignResult =
  | { itemId: string; status: 'assigned'; workerId: string }
  /** Another actor claimed the item first — a NORMAL outcome, never an error. */
  | { itemId: string; status: 'lost' }
  | { itemId: string; status: 'error'; message: string };

export type RunTrigger = 'schedule' | 'manual';

export type RunStatus =
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'skipped'
  /** A 'running' record found on a later run — the process died mid-run. */
  | 'abandoned';

export type AssignmentOutcome = 'planned' | 'assigned' | 'lost' | 'error' | 'dry-run';

export interface RunAssignmentRecord {
  itemId: string;
  workerId: string;
  reason: string;
  outcome: AssignmentOutcome;
  error?: string | undefined;
}

export interface RunCounts {
  /** Rows matched by the allocatable filter (bounded by batchLimit × overscanFactor). */
  candidates: number;
  eligibleWorkers: number;
  /** Items with at least one eligible worker after matching rules. */
  matched: number;
  planned: number;
  assigned: number;
  lost: number;
  errors: number;
  /** Items skipped because no worker passed the matching rules. */
  skippedNoWorker: number;
  /** Stale assignments released by the staleAfter sweep this run. */
  released: number;
}

/**
 * The audit record — one per scheduler firing (or manual/dry run). This is the
 * engine's contract with operators: why did item X go to worker Y at time T
 * under config version V. Timestamps are ISO-8601 UTC strings for portability.
 */
export interface AllocationRunRecord {
  id: string;
  queueId: string;
  queueVersion: number;
  tenantId?: string | undefined;
  trigger: RunTrigger;
  dryRun: boolean;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string | undefined;
  /** Populated when status is 'skipped'. */
  skipReason?: 'lease_held' | 'paused' | 'disabled' | 'already_running' | undefined;
  /** Fencing token of the lease held for this run — detects zombie writers. */
  leaseToken?: number | undefined;
  strategy: string;
  counts: RunCounts;
  assignments: RunAssignmentRecord[];
  /** Free-form diagnostics (e.g. 'no_capacity', per-phase timings). */
  notes?: string[] | undefined;
  error?: string | undefined;
}

export function emptyCounts(): RunCounts {
  return {
    candidates: 0,
    eligibleWorkers: 0,
    matched: 0,
    planned: 0,
    assigned: 0,
    lost: 0,
    errors: 0,
    skippedNoWorker: 0,
    released: 0,
  };
}
