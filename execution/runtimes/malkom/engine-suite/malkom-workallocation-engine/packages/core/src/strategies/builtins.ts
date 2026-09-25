import { freeCapacity, type Assignment, type Worker } from '../domain/types.js';
import type { AllocationStrategy, StrategyInput, StrategyResult } from './types.js';

/** Deterministic worker order shared by all built-ins: by id, ascending. */
function sortedWorkers(workers: readonly Worker[]): Worker[] {
  return [...workers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Tracks tentative load as a plan is built, so capacity holds within a single run. */
class CapacityLedger {
  private readonly free = new Map<string, number>();
  constructor(workers: readonly Worker[]) {
    for (const w of workers) this.free.set(w.id, freeCapacity(w));
  }
  has(workerId: string): boolean {
    return (this.free.get(workerId) ?? 0) > 0;
  }
  take(workerId: string): void {
    const f = this.free.get(workerId) ?? 0;
    this.free.set(workerId, f - 1);
  }
  remaining(workerId: string): number {
    return this.free.get(workerId) ?? 0;
  }
}

/**
 * fifo — oldest item first (binding order IS the queue order); each item goes
 * to the eligible worker with the most remaining capacity, tie-broken by id.
 * Stateless.
 */
export const fifoStrategy: AllocationStrategy<never> = {
  kind: 'fifo',
  allocate(input: StrategyInput<never>): StrategyResult<never> {
    const workers = sortedWorkers(input.workers);
    const ledger = new CapacityLedger(workers);
    const assignments: Assignment[] = [];
    for (const item of input.items) {
      const eligible = input.eligibility.get(item.id);
      if (!eligible || eligible.size === 0) continue;
      let best: Worker | null = null;
      for (const w of workers) {
        if (!eligible.has(w.id) || !ledger.has(w.id)) continue;
        if (best === null || ledger.remaining(w.id) > ledger.remaining(best.id)) best = w;
      }
      if (best) {
        ledger.take(best.id);
        assignments.push({ itemId: item.id, workerId: best.id, reason: `fifo: most free capacity (${ledger.remaining(best.id) + 1})` });
      }
    }
    return { assignments };
  },
};

export interface RoundRobinState {
  /** Id of the last worker that received an APPLIED assignment. Never an index — survives pool changes. */
  lastWorkerId: string | null;
}

/**
 * round_robin — rotate through eligible workers in id order, resuming after the
 * cursor. The cursor advances only past assignments that actually committed.
 */
export const roundRobinStrategy: AllocationStrategy<RoundRobinState> = {
  kind: 'round_robin',
  allocate(input: StrategyInput<RoundRobinState>): StrategyResult<RoundRobinState> {
    const workers = sortedWorkers(input.workers);
    const ledger = new CapacityLedger(workers);
    const assignments: Assignment[] = [];
    const prior = input.state?.lastWorkerId ?? null;

    // Start position: strictly after the cursor worker (or 0 if it left the pool).
    let start = 0;
    if (prior !== null) {
      const idx = workers.findIndex((w) => w.id > prior);
      start = idx === -1 ? 0 : idx;
    }

    let cursor = start;
    for (const item of input.items) {
      const eligible = input.eligibility.get(item.id);
      if (!eligible || eligible.size === 0 || workers.length === 0) continue;
      let chosen: Worker | null = null;
      for (let step = 0; step < workers.length; step++) {
        const w = workers[(cursor + step) % workers.length]!;
        if (eligible.has(w.id) && ledger.has(w.id)) {
          chosen = w;
          cursor = (cursor + step + 1) % workers.length;
          break;
        }
      }
      if (chosen) {
        ledger.take(chosen.id);
        assignments.push({ itemId: item.id, workerId: chosen.id, reason: 'round_robin: next in rotation' });
      }
    }

    return {
      assignments,
      stateAfter: (applied) => {
        // Walk the plan in order; the cursor rests on the last worker whose write committed.
        let last: string | null = prior;
        for (const a of assignments) {
          if (applied.has(a.itemId)) last = a.workerId;
        }
        return { lastWorkerId: last };
      },
    };
  },
};

/**
 * least_active — each item goes to the eligible worker with the fewest open
 * items (current load + tentative assignments this run), tie-broken by id.
 * Stateless; load is re-derived from the host's data every run.
 */
export const leastActiveStrategy: AllocationStrategy<never> = {
  kind: 'least_active',
  allocate(input: StrategyInput<never>): StrategyResult<never> {
    const workers = sortedWorkers(input.workers);
    const ledger = new CapacityLedger(workers);
    const tentativeLoad = new Map<string, number>(workers.map((w) => [w.id, w.currentLoad]));
    const assignments: Assignment[] = [];
    for (const item of input.items) {
      const eligible = input.eligibility.get(item.id);
      if (!eligible || eligible.size === 0) continue;
      let best: Worker | null = null;
      let bestLoad = Number.POSITIVE_INFINITY;
      for (const w of workers) {
        if (!eligible.has(w.id) || !ledger.has(w.id)) continue;
        const load = tentativeLoad.get(w.id) ?? 0;
        if (load < bestLoad) {
          best = w;
          bestLoad = load;
        }
      }
      if (best) {
        ledger.take(best.id);
        tentativeLoad.set(best.id, bestLoad + 1);
        assignments.push({ itemId: item.id, workerId: best.id, reason: `least_active: lowest open items (${bestLoad})` });
      }
    }
    return { assignments };
  },
};
