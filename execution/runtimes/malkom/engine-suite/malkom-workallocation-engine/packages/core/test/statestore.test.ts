import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { InMemoryStateStore, SqliteStateStore, emptyCounts, type AllocationRunRecord, type StateStore } from '../src/index.js';
import { FakeClock } from './helpers.js';

const tmp = mkdtempSync(join(tmpdir(), 'malkom-store-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function runRecord(id: string, queueId: string, startedAt: string, status: AllocationRunRecord['status'] = 'succeeded'): AllocationRunRecord {
  return {
    id,
    queueId,
    queueVersion: 1,
    trigger: 'manual',
    dryRun: false,
    status,
    startedAt,
    strategy: 'fifo',
    counts: emptyCounts(),
    assignments: [],
  };
}

const factories: Array<[string, (clock: FakeClock) => Promise<StateStore>]> = [
  ['memory', async (clock) => new InMemoryStateStore(clock)],
  [
    'sqlite',
    async (clock) => {
      const store = new SqliteStateStore(join(tmp, `s-${Math.random().toString(36).slice(2)}.db`), clock);
      await store.init();
      return store;
    },
  ],
];

describe.each(factories)('%s state store', (_name, make) => {
  it('grants exclusive leases with monotonic fencing tokens', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();

    const g1 = await store.acquireLease('lease:q', 'i1', 10_000);
    expect(g1?.token).toBe(1);
    expect(await store.acquireLease('lease:q', 'i2', 10_000)).toBeNull();
    expect(await store.renewLease('lease:q', 'i1', 10_000)).toBe(true);
    expect(await store.renewLease('lease:q', 'i2', 10_000)).toBe(false);

    clock.advance(11_000); // expiry: i2 may take over, token bumps
    const g2 = await store.acquireLease('lease:q', 'i2', 10_000);
    expect(g2?.token).toBe(2);
    expect(await store.renewLease('lease:q', 'i1', 10_000)).toBe(false); // zombie fenced out

    await store.releaseLease('lease:q', 'i2');
    const g3 = await store.acquireLease('lease:q', 'i3', 10_000);
    expect(g3?.token).toBe(3);
    await store.close();
  });

  it('compare-and-set is atomic against the current value', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();
    expect(await store.compareAndSet('k', null, 'v1')).toBe(true);
    expect(await store.compareAndSet('k', null, 'v2')).toBe(false);
    expect(await store.compareAndSet('k', 'v1', 'v2')).toBe(true);
    expect(await store.get('k')).toBe('v2');
    await store.close();
  });

  it('lists keys by prefix', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();
    await store.set('queue:a', '1');
    await store.set('queue:b', '1');
    await store.set('other:c', '1');
    expect(await store.listKeys('queue:')).toEqual(['queue:a', 'queue:b']);
    await store.close();
  });

  it('filters, pages, refuses unfiltered deletes, and prunes runs', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();
    for (let i = 1; i <= 5; i++) {
      await store.appendRun(runRecord(`r${i}`, i <= 3 ? 'q1' : 'q2', new Date(clock.t - i * 60_000).toISOString()));
    }
    const q1 = await store.listRuns({ queueId: 'q1' });
    expect(q1.total).toBe(3);
    expect(q1.runs.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']); // newest first

    const page = await store.listRuns({ queueId: 'q1', limit: 1, offset: 1 });
    expect(page.runs.map((r) => r.id)).toEqual(['r2']);

    expect(await store.deleteRuns({})).toBe(0); // refused
    expect(await store.deleteRuns({ queueId: 'q2' })).toBe(2);

    expect(await store.pruneRuns({ maxCountPerQueue: 1 })).toBe(2);
    const left = await store.listRuns({ queueId: 'q1' });
    expect(left.runs.map((r) => r.id)).toEqual(['r1']);
    await store.close();
  });

  it('marks crashed running records as abandoned', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();
    await store.appendRun(runRecord('old', 'q1', new Date(clock.t - 3600_000).toISOString(), 'running'));
    await store.appendRun(runRecord('fresh', 'q1', new Date(clock.t).toISOString(), 'running'));
    expect(await store.markAbandonedRuns(new Date(clock.t - 60_000))).toBe(1);
    expect((await store.getRun('old'))?.status).toBe('abandoned');
    expect((await store.getRun('fresh'))?.status).toBe('running');
    await store.close();
  });

  it('updateRun merges patches into the stored record', async () => {
    const clock = new FakeClock();
    const store = await make(clock);
    await store.init();
    await store.appendRun(runRecord('r1', 'q1', new Date(clock.t).toISOString(), 'running'));
    await store.updateRun('r1', { status: 'succeeded', finishedAt: new Date(clock.t + 1000).toISOString() });
    const r = await store.getRun('r1');
    expect(r?.status).toBe('succeeded');
    expect(r?.finishedAt).toBeTruthy();
    await store.close();
  });
});
