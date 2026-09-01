import type { QueueDefinition } from '../config/schemas.js';
import type { Assignment, AssignResult, WorkItem, Worker } from '../domain/types.js';

/** Passed to every port call so shared/custom adapters can serve many queues. */
export interface QueueRuntimeRef {
  queueId: string;
  queueVersion: number;
  definition: QueueDefinition;
}

export interface WorkSourcePort {
  /** Unassigned, allocatable items in the binding's deterministic order; `limit` caps the batch. */
  fetchAllocatable(queue: QueueRuntimeRef, limit: number): Promise<WorkItem[]>;
}

export interface WorkerSourcePort {
  /** Eligible workers with capacity and freshly-resolved current load. */
  fetchEligible(queue: QueueRuntimeRef): Promise<Worker[]>;
}

export interface AssignerPort {
  /**
   * Apply a plan. MUST be conditional: assign only if the item is still
   * unassigned and allocatable (compare-and-swap semantics). Implementations
   * MUST NOT throw on lost races — return { status: 'lost' } per item.
   */
  assign(queue: QueueRuntimeRef, plan: Assignment[]): Promise<AssignResult[]>;
  /** What WOULD be executed for this plan — powers dry-run transparency. */
  explain?(queue: QueueRuntimeRef, plan: Assignment[]): Promise<string[]>;
  /** Unassign specific items back to the pool. Returns rows affected. */
  release?(queue: QueueRuntimeRef, itemIds: string[]): Promise<number>;
  /** Release items assigned before `cutoff` and still untouched. Returns rows affected. */
  releaseStale?(queue: QueueRuntimeRef, cutoff: Date): Promise<number>;
}

export interface BackendAdapter {
  work: WorkSourcePort;
  workers: WorkerSourcePort;
  assigner: AssignerPort;
  health?(): Promise<{ ok: boolean; detail?: string }>;
}
