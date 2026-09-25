import { beforeEach, describe, expect, it } from 'vitest';
import {
  AdapterError,
  InMemoryStateStore,
  MemoryBackendAdapter,
  MetricsRegistry,
  noopLogger,
  StrategyRegistry,
  type Assignment,
  type QueueDefinition,
} from '../src/index.js';
import { executeRun, pausedKey, strategyStateKey } from '../src/runtime/pipeline.js';
import type { QueueRuntimeRef } from '../src/index.js';
import { agentRow, FakeClock, parseQueue, taskRow } from './helpers.js';

function ref(def: QueueDefinition): QueueRuntimeRef {
  return { queueId: def.id, queueVersion: def.version ?? 1, definition: def };
}

describe('executeRun', () => {
  let store: InMemoryStateStore;
  let clock: FakeClock;
  let strategies: StrategyRegistry;
  let metrics: MetricsRegistry;

  beforeEach(() => {
    clock = new FakeClock();
    store = new InMemoryStateStore(clock);
    strategies = new StrategyRegistry();
    metrics = new MetricsRegistry();
  });

  const runOpts = (def: QueueDefinition, adapter: MemoryBackendAdapter, over: Partial<Parameters<typeof executeRun>[0]> = {}) => ({
    queue: ref(def),
    adapter,
    store,
    strategies,
    metrics,
    clock,
    logger: noopLogger,
    instanceId: 'test-1',
    trigger: 'manual' as const,
    dryRun: false,
    ...over,
  });

  it('assigns FIFO with intents persisted and audit reconciled', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1), taskRow(2), taskRow(3)],
      workerRows: [agentRow('A'), agentRow('B')],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter));

    expect(record.status).toBe('succeeded');
    expect(record.counts).toMatchObject({ candidates: 3, eligibleWorkers: 2, matched: 3, planned: 3, assigned: 3, lost: 0, errors: 0 });
    expect(record.assignments.every((a) => a.outcome === 'assigned')).toBe(true);
    for (const row of adapter.workRows) {
      expect(row['owner']).toBeTruthy();
      expect(row['status']).toBe('ASSIGNED');
      expect(row['assigned_at']).toBeTruthy();
    }
    const persisted = await store.getRun(record.id);
    expect(persisted?.status).toBe('succeeded');
    expect(persisted?.assignments).toHaveLength(3);
  });

  it('treats lost races as normal outcomes, never errors', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1), taskRow(2)],
      workerRows: [agentRow('A')],
      clock,
    });
    // A human grabs task 1 between fetch and apply.
    const original = adapter.assigner.assign.bind(adapter.assigner);
    (adapter.assigner as { assign: typeof adapter.assigner.assign }).assign = async (queue, plan: Assignment[]) => {
      const row = adapter.workRows.find((r) => r['task_id'] === 1)!;
      row['owner'] = 'human';
      return original(queue, plan);
    };
    const record = await executeRun(runOpts(def, adapter));
    expect(record.status).toBe('succeeded');
    expect(record.counts.lost).toBe(1);
    expect(record.counts.assigned).toBe(1);
    expect(adapter.workRows.find((r) => r['task_id'] === 1)!['owner']).toBe('human');
  });

  it('enforces per-worker capacity across the whole plan', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1), taskRow(2), taskRow(3), taskRow(4)],
      workerRows: [agentRow('A', { cap: 1 }), agentRow('B', { cap: 1 })],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter));
    expect(record.counts.assigned).toBe(2);
    expect(adapter.workRows.filter((r) => r['owner'] !== null)).toHaveLength(2);
  });

  it('persists and resumes the round-robin cursor', async () => {
    const def = parseQueue((d) => {
      d.strategy = { kind: 'round_robin' };
    });
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1), taskRow(2), taskRow(3)],
      workerRows: [agentRow('A'), agentRow('B'), agentRow('C')],
      clock,
    });
    await executeRun(runOpts(def, adapter));
    const state = JSON.parse((await store.get(strategyStateKey(def.id, 'round_robin')))!) as { lastWorkerId: string };
    expect(state.lastWorkerId).toBe('C');

    adapter.workRows.push(taskRow(5, { created_at: '2026-08-12T09:00:00Z' }));
    await executeRun(runOpts(def, adapter));
    expect(adapter.workRows.find((r) => r['task_id'] === 5)!['owner']).toBe('A'); // rotation resumed after C
  });

  it('skips paused queues and records why', async () => {
    const def = parseQueue();
    await store.set(pausedKey(def.id), '1');
    const adapter = new MemoryBackendAdapter({ workRows: [taskRow(1)], workerRows: [agentRow('A')], clock });
    const record = await executeRun(runOpts(def, adapter));
    expect(record.status).toBe('skipped');
    expect(record.skipReason).toBe('paused');
    expect(adapter.workRows[0]!['owner']).toBeNull();
  });

  it('short-circuits when no worker has free capacity', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1)],
      workerRows: [agentRow('A', { cap: 0 })],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter));
    expect(record.status).toBe('succeeded');
    expect(record.counts.candidates).toBe(0); // fetch skipped entirely
    expect(record.notes).toContain('no free capacity');
  });

  it('auto-pauses after repeated schema-class failures', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({ workRows: [], workerRows: [agentRow('A')], clock });
    (adapter.work as { fetchAllocatable: unknown }).fetchAllocatable = async () => {
      throw new AdapterError('no such column: owner', { schemaClass: true });
    };
    for (let i = 0; i < 3; i++) {
      const record = await executeRun(runOpts(def, adapter));
      expect(record.status).toBe('failed');
    }
    expect(await store.get(pausedKey(def.id))).toBe('1');
  });

  it('runs the stale sweep before allocating', async () => {
    const def = parseQueue((d) => {
      d.staleAfter = { minutes: 60 };
    });
    const staleAt = new Date(clock.t - 2 * 3600_000).toISOString();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1, { owner: 'ghost', status: 'ASSIGNED', assigned_at: staleAt })],
      workerRows: [agentRow('A')],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter));
    expect(record.counts.released).toBe(1);
    // Released, restored to NEW by onRelease, then re-assigned this same run.
    expect(record.counts.assigned).toBe(1);
    expect(adapter.workRows[0]!['owner']).toBe('A');
  });

  it('applies matching rules before the strategy and reports unmatchable items', async () => {
    const def = parseQueue((d) => {
      d.matching = [{ itemField: 'skill', workerAttr: 'skills', op: 'contains' }];
    });
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1, { skill: 'claims' }), taskRow(2, { skill: 'marine' })],
      workerRows: [agentRow('A', { skills: ['claims'] })],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter));
    expect(record.counts.assigned).toBe(1);
    expect(record.counts.skippedNoWorker).toBe(1);
    expect(adapter.workRows.find((r) => r['task_id'] === 2)!['owner']).toBeNull();
  });

  it('dry-run walks the full pipeline but writes nothing', async () => {
    const def = parseQueue();
    const adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1)],
      workerRows: [agentRow('A')],
      clock,
    });
    const record = await executeRun(runOpts(def, adapter, { dryRun: true }));
    expect(record.status).toBe('succeeded');
    expect(record.counts.planned).toBe(1);
    expect(record.assignments[0]!.outcome).toBe('dry-run');
    expect(record.notes?.some((n) => n.includes('memory: set assignee'))).toBe(true);
    expect(adapter.workRows[0]!['owner']).toBeNull();
    expect(adapter.workRows[0]!['status']).toBe('NEW');
  });

  it('drops strategy output that violates eligibility or capacity', async () => {
    const def = parseQueue((d) => {
      d.strategy = { kind: 'rogue' };
    });
    strategies.register({
      kind: 'rogue',
      allocate: ({ items }) => ({
        assignments: [
          { itemId: items[0]!.id, workerId: 'nobody', reason: 'rogue' },
          { itemId: items[0]!.id, workerId: 'A', reason: 'duplicate' },
        ],
      }),
    });
    const adapter = new MemoryBackendAdapter({ workRows: [taskRow(1)], workerRows: [agentRow('A')], clock });
    const record = await executeRun(runOpts(def, adapter));
    // The ineligible pairing is dropped; the valid one for the same item survives.
    expect(record.counts.planned).toBe(1);
    expect(record.notes?.some((n) => n.includes('not eligible'))).toBe(true);
    expect(adapter.workRows[0]!['owner']).toBe('A');
  });
});
