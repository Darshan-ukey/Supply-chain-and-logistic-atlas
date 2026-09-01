import type { Assignment, WorkItem, Worker } from '../domain/types.js';

/**
 * Item → eligible worker ids, computed by the ENGINE from matching rules before
 * any strategy runs. Strategies select only within this map; the pipeline
 * enforces it again defensively for custom strategies.
 */
export type EligibilityMap = ReadonlyMap<string, ReadonlySet<string>>;

export interface StrategyInput<S> {
  /** Candidates in binding order (already capped to batchLimit), only items with ≥1 eligible worker. */
  items: readonly WorkItem[];
  /** Eligible workers with capacity and fresh load. */
  workers: readonly Worker[];
  eligibility: EligibilityMap;
  /** Persisted opaque state from the previous run (e.g. a round-robin cursor). */
  state: S | null;
  params: Record<string, unknown>;
}

export interface StrategyResult<S> {
  assignments: Assignment[];
  /**
   * Recompute persistent state given the item ids whose writes actually
   * committed. Called AFTER apply — a partial failure never corrupts the
   * cursor. Omit for stateless strategies.
   */
  stateAfter?: (appliedItemIds: ReadonlySet<string>) => S;
}

/**
 * A strategy is a PURE decision function: no I/O, no clocks, no randomness.
 * That is what makes strategies unit-testable and the engine's write path
 * uniform across every backend.
 */
export interface AllocationStrategy<S = unknown> {
  readonly kind: string;
  allocate(input: StrategyInput<S>): StrategyResult<S>;
}
