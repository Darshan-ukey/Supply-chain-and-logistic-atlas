import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AllocationEngine,
  noopLogger,
  SqliteSqlClient,
  SqliteStateStore,
  workEventsBinding,
  workEventsOpenLoad,
} from '../src/index.js';

/**
 * The batteries-included path: provision the default workEvents table, insert
 * work rows the way an upstream producer would, and let the engine allocate —
 * no host-specific schema anywhere.
 */
describe('workEvents default table', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'malkom-we-'));
  let engine: AllocationEngine;
  let client: SqliteSqlClient;

  beforeAll(async () => {
    client = new SqliteSqlClient(join(tmp, 'host.db'));
    client.exec(`
      CREATE TABLE agents (agent_id TEXT PRIMARY KEY, active INTEGER NOT NULL, cap INTEGER NOT NULL);
      INSERT INTO agents VALUES ('asha', 1, 2), ('ben', 1, 2), ('off', 0, 9);
    `);
    engine = new AllocationEngine({
      stateStore: new SqliteStateStore(join(tmp, 'state.db')),
      logger: noopLogger,
    });
    engine.connections.registerClient('db', 'sqlite', client);
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('provisions the table idempotently', async () => {
    const first = await engine.provisionWorkEvents('db');
    expect(first).toMatchObject({ table: 'workEvents', dialect: 'sqlite', statements: 3 });
    await engine.provisionWorkEvents('db'); // second call must not throw
    const probe = await engine.connections.probe('db', { name: 'workEvents' });
    expect(probe.columns?.map((c) => c.name)).toEqual([
      'id', 'queueId', 'subqueueId', 'transactionStateId',
      'allocatedTo', 'allocatedOn', 'completedOn', 'taskStartTime', 'taskEndTime',
    ]);
  });

  it('allocates only the scoped queue/sub-queue/state rows, engine writing exactly two columns', async () => {
    for (const [q, sq, state] of [
      ['q-ops', 'INV', 'Indexed'],
      ['q-ops', 'INV', 'Indexed'],
      ['q-ops', 'INV', 'Indexed'],
      ['q-ops', 'INV', 'Parked'],   // wrong state — untouched
      ['q-ops', 'PAY', 'Indexed'],  // wrong sub-queue — untouched
      ['q-other', 'INV', 'Indexed'] // wrong queue — untouched
    ] as const) {
      await client.execute(
        'INSERT INTO "workEvents" ("queueId", "subqueueId", "transactionStateId") VALUES (?, ?, ?)',
        [q, sq, state],
      );
    }

    await engine.upsertQueue({
      id: 'q-ops-inv',
      name: 'Ops / Invoices',
      work: workEventsBinding({ connectionRef: 'db', queueId: 'q-ops', subqueueId: 'INV' }),
      workers: {
        connectionRef: 'db',
        table: { name: 'agents' },
        fields: {
          id: 'agent_id',
          eligibleWhen: { op: 'eq', column: 'active', value: true },
          capacity: { column: 'cap' },
        },
        load: workEventsOpenLoad,
      },
      strategy: { kind: 'least_active' },
      schedule: { trigger: { kind: 'interval', everyMs: 60_000 } },
    });

    const run = await engine.runQueue('q-ops-inv', 'manual', false);
    expect(run.status).toBe('succeeded');
    expect(run.counts.assigned).toBe(3);

    const { rows } = await client.query('SELECT * FROM "workEvents" ORDER BY "id"', []);
    const allocated = rows.filter((r) => r['allocatedTo'] !== null);
    expect(allocated).toHaveLength(3);
    for (const r of allocated) {
      expect(r['queueId']).toBe('q-ops');
      expect(r['subqueueId']).toBe('INV');
      expect(String(r['allocatedOn'])).toMatch(/^\d{4}-\d{2}-\d{2}T/); // db-now UTC
      // The three front-end columns are never touched by the engine.
      expect(r['completedOn']).toBeNull();
      expect(r['taskStartTime']).toBeNull();
      expect(r['taskEndTime']).toBeNull();
      // State stays host vocabulary — no transition unless onAssignSet asks.
      expect(r['transactionStateId']).toBe('Indexed');
    }
    expect(rows.find((r) => r['transactionStateId'] === 'Parked')!['allocatedTo']).toBeNull();
    expect(rows.find((r) => r['subqueueId'] === 'PAY')!['allocatedTo']).toBeNull();
    expect(rows.find((r) => r['queueId'] === 'q-other')!['allocatedTo']).toBeNull();
  });

  it('front-end completion frees capacity via workEventsOpenLoad', async () => {
    // Both agents are at 2+1 open items? asha=2, ben=1 (3 assigned, caps 2/2).
    // The front end completes one of asha's items → her open load drops.
    await client.execute(
      `UPDATE "workEvents" SET "completedOn" = '2026-08-12T12:00:00Z', "taskStartTime" = '2026-08-12T11:00:00Z', "taskEndTime" = '2026-08-12T12:00:00Z'
       WHERE "id" = (SELECT MIN("id") FROM "workEvents" WHERE "allocatedTo" IS NOT NULL)`,
      [],
    );
    await client.execute(
      'INSERT INTO "workEvents" ("queueId", "subqueueId", "transactionStateId") VALUES (?, ?, ?)',
      ['q-ops', 'INV', 'Indexed'],
    );
    const run = await engine.runQueue('q-ops-inv', 'manual', false);
    expect(run.counts.assigned).toBe(1); // capacity was freed by completedOn, not by the engine
  });

  it('FIFO order is the incremental id', async () => {
    const b = workEventsBinding({ connectionRef: 'db', queueId: 'x' });
    expect(b.ordering).toEqual([{ column: 'id', dir: 'asc' }]);
    expect(b.fields.assignee).toBe('allocatedTo');
    expect(b.fields.state).toBe('transactionStateId');
  });
});
