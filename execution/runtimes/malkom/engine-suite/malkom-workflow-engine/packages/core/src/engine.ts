import { randomUUID } from 'node:crypto';
import type { WorkflowStateStore } from './store.js';
import { InMemoryWorkflowStateStore } from './store.js';
import {
  configBundleSchema,
  lifecycleDefinitionSchema,
  moveRequestSchema,
  startRequestSchema,
  type ConfigBundle,
  type ItemRecord,
  type LifecycleDefinitionInput,
  type MoveOutcome,
  type StateDefinition,
  type TransitionRecord,
} from './schemas.js';

/**
 * Engine facade — every operation the control plane exposes, as a typed
 * library API. The engine owns legality and the timing ledger; the host
 * owns the item and who is allowed to move it.
 *
 * The SLA clock accrues only while the item sits in a state that does not
 * hold it, so time spent waiting on a third party never counts against
 * the target.
 */

export interface WorkflowEngineOptions {
  stateStore?: WorkflowStateStore;
  clock?: () => Date;
}

export class WorkflowEngine {
  private readonly store: WorkflowStateStore;
  private readonly clock: () => Date;

  constructor(options: WorkflowEngineOptions = {}) {
    this.store = options.stateStore ?? new InMemoryWorkflowStateStore();
    this.clock = options.clock ?? (() => new Date());
  }

  upsertLifecycle(input: LifecycleDefinitionInput): { id: string; version: number } {
    const definition = lifecycleDefinitionSchema.parse(input);
    const keys = new Set(definition.states.map((state) => state.key));
    if (!keys.has(definition.initialState)) {
      throw new EngineValidationError(`initialState ${definition.initialState} is not one of the lifecycle's states`);
    }
    for (const state of definition.states) {
      for (const target of state.to) {
        if (!keys.has(target)) throw new EngineValidationError(`state ${state.key} moves to unknown state ${target}`);
      }
    }
    if (!definition.states.some((state) => state.terminal)) {
      throw new EngineValidationError('a lifecycle needs at least one terminal state');
    }
    const existing = this.store.getLifecycle(definition.id);
    const record = {
      definition,
      version: (existing?.version ?? 0) + 1,
      updatedAt: this.clock().toISOString(),
    };
    this.store.putLifecycle(record);
    return { id: definition.id, version: record.version };
  }

  applyConfig(input: unknown): { applied: string[] } {
    const bundle: ConfigBundle = configBundleSchema.parse(input);
    const applied: string[] = [];
    for (const lifecycle of bundle.lifecycles) {
      this.upsertLifecycle(lifecycle);
      applied.push(lifecycle.id);
    }
    return { applied };
  }

  listLifecycles(): { id: string; name: string; states: number; slaMinutes: number; enabled: boolean; version: number; updatedAt: string }[] {
    return this.store.listLifecycles().map((record) => ({
      id: record.definition.id,
      name: record.definition.name,
      states: record.definition.states.length,
      slaMinutes: record.definition.slaMinutes,
      enabled: record.definition.enabled,
      version: record.version,
      updatedAt: record.updatedAt,
    }));
  }

  deleteLifecycle(id: string): void {
    this.store.deleteLifecycle(id);
  }

  /** Put an item into the lifecycle's initial state and start its clock. */
  start(lifecycleId: string, input: unknown): MoveOutcome {
    const request = startRequestSchema.parse(input);
    const record = this.requireLifecycle(lifecycleId);
    const existing = this.store.getItem(lifecycleId, request.itemId);
    if (existing !== null) throw new EngineConflictError(`item ${request.itemId} is already in this lifecycle`);
    const now = this.clock();
    const initial = this.stateOf(record.definition.states, record.definition.initialState);
    const item: ItemRecord = {
      itemId: request.itemId,
      lifecycleId,
      state: record.definition.initialState,
      startedAt: now.toISOString(),
      accruedMs: 0,
      runningSince: initial.holdsClock ? null : now.toISOString(),
      completedAt: null,
    };
    this.store.putItem(item);
    return this.outcome(item, record.definition.slaMinutes, record.version, initial.terminal, true, null);
  }

  /** Move an item. Illegal moves are reported, never applied. */
  move(lifecycleId: string, input: unknown): MoveOutcome {
    const request = moveRequestSchema.parse(input);
    const record = this.requireLifecycle(lifecycleId);
    const item = this.store.getItem(lifecycleId, request.itemId);
    if (item === null) throw new EngineNotFoundError(`item ${request.itemId} is not in this lifecycle`);
    const from = this.stateOf(record.definition.states, item.state);
    const now = this.clock();

    if (from.terminal) {
      return this.outcome(item, record.definition.slaMinutes, record.version, true, false, `${item.state} is terminal — the item accepts no further moves`);
    }
    if (!from.to.includes(request.to)) {
      return this.outcome(item, record.definition.slaMinutes, record.version, false, false, `illegal move ${item.state} → ${request.to}`);
    }
    const to = this.stateOf(record.definition.states, request.to);

    // close the running span before changing state
    const accruedMs = item.runningSince === null
      ? item.accruedMs
      : item.accruedMs + (now.getTime() - Date.parse(item.runningSince));
    const clockRuns = !to.terminal && !to.holdsClock;
    const next: ItemRecord = {
      ...item,
      state: request.to,
      accruedMs,
      runningSince: clockRuns ? now.toISOString() : null,
      completedAt: to.terminal ? now.toISOString() : null,
    };
    this.store.putItem(next);
    this.store.appendTransition({
      id: randomUUID(),
      lifecycleId,
      itemId: request.itemId,
      fromState: item.state,
      toState: request.to,
      actor: request.actor,
      createdAt: now.toISOString(),
    });
    return this.outcome(next, record.definition.slaMinutes, record.version, to.terminal, true, null);
  }

  status(lifecycleId: string, itemId: string): MoveOutcome {
    const record = this.requireLifecycle(lifecycleId);
    const item = this.store.getItem(lifecycleId, itemId);
    if (item === null) throw new EngineNotFoundError(`item ${itemId} is not in this lifecycle`);
    const state = this.stateOf(record.definition.states, item.state);
    return this.outcome(item, record.definition.slaMinutes, record.version, state.terminal, true, null);
  }

  items(lifecycleId: string, state: string | null, limit: number, offset: number): ItemRecord[] {
    this.requireLifecycle(lifecycleId);
    return this.store.listItems(lifecycleId, state, Math.min(limit, 500), offset);
  }

  transitions(lifecycleId: string, itemId: string | null, limit: number, offset: number): TransitionRecord[] {
    this.requireLifecycle(lifecycleId);
    return this.store.listTransitions(lifecycleId, itemId, Math.min(limit, 500), offset);
  }

  /** Open items whose running clock has passed the lifecycle's target. */
  breaches(lifecycleId: string, limit: number): { itemId: string; state: string; elapsedMinutes: number }[] {
    const record = this.requireLifecycle(lifecycleId);
    if (record.definition.slaMinutes === 0) return [];
    return this.store
      .listItems(lifecycleId, null, Math.min(limit, 500), 0)
      .filter((item) => item.completedAt === null)
      .map((item) => ({ itemId: item.itemId, state: item.state, elapsedMinutes: this.elapsedMinutes(item) }))
      .filter((entry) => entry.elapsedMinutes > record.definition.slaMinutes);
  }

  private requireLifecycle(id: string): { definition: import('./schemas.js').LifecycleDefinition; version: number } {
    const record = this.store.getLifecycle(id);
    if (record === null) throw new EngineNotFoundError(`lifecycle ${id} not found`);
    if (!record.definition.enabled) throw new EngineConflictError(`lifecycle ${id} is disabled`);
    return record;
  }

  private stateOf(states: StateDefinition[], key: string): StateDefinition {
    const state = states.find((entry) => entry.key === key);
    if (state === undefined) throw new EngineValidationError(`state ${key} is not part of this lifecycle`);
    return state;
  }

  private elapsedMinutes(item: ItemRecord): number {
    const running = item.runningSince === null ? 0 : this.clock().getTime() - Date.parse(item.runningSince);
    return Math.round(((item.accruedMs + running) / 60_000) * 10) / 10;
  }

  private outcome(
    item: ItemRecord,
    slaMinutes: number,
    version: number,
    terminal: boolean,
    legal: boolean,
    reason: string | null,
  ): MoveOutcome {
    const elapsedMinutes = this.elapsedMinutes(item);
    return {
      legal,
      reason,
      state: item.state,
      terminal,
      elapsedMinutes,
      slaBreached: slaMinutes > 0 && elapsedMinutes > slaMinutes,
      lifecycleVersion: version,
    };
  }

  stop(): void {
    this.store.close();
  }
}

export class EngineNotFoundError extends Error {}
export class EngineConflictError extends Error {}
export class EngineValidationError extends Error {}
