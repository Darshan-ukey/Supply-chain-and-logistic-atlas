import { describe, expect, it } from 'vitest';
import { buildFetchHandler, WorkflowEngine } from '../src/index.js';

const lifecycle = {
  id: 'booking-task',
  name: 'Booking task',
  initialState: 'INDEXED',
  slaMinutes: 60,
  states: [
    { key: 'INDEXED', label: 'Indexed', to: ['PROCESSED', 'PARKED', 'QUERY'] },
    { key: 'PARKED', label: 'Parked', to: ['PROCESSED', 'QUERY'], holdsClock: true },
    { key: 'QUERY', label: 'Query raised', to: ['PROCESSED', 'PARKED'], holdsClock: true },
    { key: 'PROCESSED', label: 'Processed', terminal: true },
  ],
};

/** Controllable clock so elapsed time is asserted, never slept for. */
const fakeClock = (startIso: string) => {
  let now = Date.parse(startIso);
  return {
    clock: () => new Date(now),
    advanceMinutes: (minutes: number) => {
      now += minutes * 60_000;
    },
  };
};

describe('workflow engine', () => {
  it('rejects a lifecycle whose moves point at unknown states', () => {
    const engine = new WorkflowEngine();
    expect(() => engine.upsertLifecycle({
      ...lifecycle,
      states: [{ key: 'A', label: 'A', to: ['NOWHERE'] }, { key: 'B', label: 'B', terminal: true }],
      initialState: 'A',
    })).toThrowError(/unknown state NOWHERE/);
    expect(() => engine.upsertLifecycle({
      ...lifecycle,
      states: [{ key: 'A', label: 'A', to: ['B'] }, { key: 'B', label: 'B' }],
      initialState: 'A',
    })).toThrowError(/at least one terminal state/);
  });

  it('reports illegal moves without applying them', () => {
    const engine = new WorkflowEngine();
    engine.applyConfig({ lifecycles: [lifecycle] });
    engine.start('booking-task', { itemId: 'task-1' });
    const illegal = engine.move('booking-task', { itemId: 'task-1', to: 'NOWHERE' });
    expect(illegal.legal).toBe(false);
    expect(illegal.state).toBe('INDEXED'); // unchanged
    const legal = engine.move('booking-task', { itemId: 'task-1', to: 'PROCESSED', actor: 'agent1' });
    expect(legal.legal).toBe(true);
    expect(legal.terminal).toBe(true);
    const after = engine.move('booking-task', { itemId: 'task-1', to: 'PARKED' });
    expect(after.legal).toBe(false);
    expect(after.reason).toMatch(/terminal/);
  });

  it('holds the clock in waiting states so the SLA only counts our time', () => {
    const time = fakeClock('2026-08-13T09:00:00.000Z');
    const engine = new WorkflowEngine({ clock: time.clock });
    engine.upsertLifecycle(lifecycle);
    engine.start('booking-task', { itemId: 'task-2' });
    time.advanceMinutes(20);                                    // 20 running
    engine.move('booking-task', { itemId: 'task-2', to: 'QUERY' });
    time.advanceMinutes(500);                                   // held — does not count
    const back = engine.move('booking-task', { itemId: 'task-2', to: 'PROCESSED' });
    expect(back.elapsedMinutes).toBe(20);
    expect(back.slaBreached).toBe(false);
  });

  it('flags open items past the target as breaches', () => {
    const time = fakeClock('2026-08-13T09:00:00.000Z');
    const engine = new WorkflowEngine({ clock: time.clock });
    engine.upsertLifecycle(lifecycle);
    engine.start('booking-task', { itemId: 'slow' });
    engine.start('booking-task', { itemId: 'held' });
    engine.move('booking-task', { itemId: 'held', to: 'PARKED' });
    time.advanceMinutes(90);
    const breaches = engine.breaches('booking-task', 50);
    expect(breaches.map((b) => b.itemId)).toEqual(['slow']);
    expect(breaches[0]?.elapsedMinutes).toBe(90);
  });

  it('serves /v1 routes with scoped keys and logs transitions', async () => {
    const engine = new WorkflowEngine();
    engine.upsertLifecycle(lifecycle);
    const handler = buildFetchHandler(engine, { adminKeys: ['adm'], readKeys: ['rdr'] });
    expect((await handler(new Request('http://x/v1/lifecycles'))).status).toBe(401);
    const readStart = await handler(new Request('http://x/v1/lifecycles/booking-task/start', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'task-3' }),
    }));
    expect(readStart.status).toBe(403);
    const started = await handler(new Request('http://x/v1/lifecycles/booking-task/start', {
      method: 'POST',
      headers: { authorization: 'Bearer adm', 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'task-3' }),
    }));
    expect(started.status).toBe(200);
    engine.move('booking-task', { itemId: 'task-3', to: 'PROCESSED', actor: 'agent2' });
    expect(engine.transitions('booking-task', 'task-3', 10, 0)[0]?.actor).toBe('agent2');
    expect((await handler(new Request('http://x/v1/health'))).status).toBe(200);
  });
});
