import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AllocationEngine,
  buildFetchHandler,
  noopLogger,
  SqliteSqlClient,
  SqliteStateStore,
  workEventsBinding,
} from '../src/index.js';

/**
 * Coverage watchdog + run-log summary — the "intelligent engine" surface:
 * work waiting with no rules gets flagged, and hosts can aggregate the run
 * log without paging raw records.
 */
describe('coverage watchdog and runs summary', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'malkom-cov-'));
  let engine: AllocationEngine;
  let client: SqliteSqlClient;

  beforeAll(async () => {
    client = new SqliteSqlClient(join(tmp, 'host.db'));
    engine = new AllocationEngine({
      stateStore: new SqliteStateStore(join(tmp, 'state.db')),
      logger: noopLogger,
    });
    engine.connections.registerClient('db', 'sqlite', client);
    await engine.start();
    await engine.provisionWorkEvents('db');

    // Waiting work across four combos; only (1,10) will have rules.
    const rows: Array<[string, string | null, string]> = [
      ['1', '10', 'Indexed'],
      ['1', '10', 'Indexed'],
      ['1', '11', 'Indexed'],
      ['1', '11', 'Indexed'],
      ['1', '11', 'Indexed'],
      ['2', null, 'Indexed'],
    ];
    for (const [qid, sq, state] of rows) {
      await client.execute(
        'INSERT INTO "workEvents" ("queueId", "subqueueId", "transactionStateId") VALUES (?, ?, ?)',
        [qid, sq, state],
      );
    }

    await engine.upsertQueue({
      id: 'q-one-ten',
      name: 'Queue 1 / Sub 10',
      work: workEventsBinding({ connectionRef: 'db', queueId: '1', subqueueId: '10' }),
      workers: {
        connectionRef: 'db',
        table: { name: 'agents' },
        fields: { id: 'agent_id' },
      },
      strategy: { kind: 'fifo' },
      schedule: { trigger: { kind: 'interval', everyMs: 60_000 } },
    });
  });

  afterAll(async () => {
    await engine.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('flags combos with waiting work and no enabled queue definition', async () => {
    const report = await engine.coverage('db');
    expect(report.covered).toBe(1); // (1,10)
    expect(report.uncovered).toEqual([
      { queueId: '1', subqueueId: '11', unallocated: 3 },
      { queueId: '2', subqueueId: null, unallocated: 1 },
    ]);
    // The silence is now measurable.
    expect(engine.metrics.toPrometheus()).toContain('malkom_unconfigured_items{queue="1",subqueue="11"} 3');
  });

  it('a definition without a sub-queue covers every sub-queue of its queueId', async () => {
    await engine.upsertQueue({
      id: 'q-two-all',
      name: 'Queue 2 / all subs',
      work: workEventsBinding({ connectionRef: 'db', queueId: '2' }),
      workers: { connectionRef: 'db', table: { name: 'agents' }, fields: { id: 'agent_id' } },
      strategy: { kind: 'fifo' },
      schedule: { trigger: { kind: 'interval', everyMs: 60_000 } },
    });
    const report = await engine.coverage('db');
    expect(report.uncovered).toEqual([{ queueId: '1', subqueueId: '11', unallocated: 3 }]);
    expect(report.covered).toBe(2);
  });

  it('serves the report over GET /v1/coverage', async () => {
    const handler = buildFetchHandler(engine);
    const res = await handler(new Request('http://localhost/v1/coverage?connectionRef=db'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { uncovered: unknown[] };
    expect(body.uncovered).toHaveLength(1);

    const missing = await handler(new Request('http://localhost/v1/coverage'));
    expect(missing.status).toBe(400);
  });

  it('summarizes the run log per status and per queue', async () => {
    // Agents table only needed now — create it and run the covered queue twice.
    client.exec(`CREATE TABLE agents (agent_id TEXT PRIMARY KEY); INSERT INTO agents VALUES ('a1'), ('a2');`);
    await engine.runQueue('q-one-ten', 'manual', false);
    await engine.runQueue('q-one-ten', 'manual', false); // second run: nothing left

    const summary = await engine.summarizeRuns({});
    expect(summary.totalRuns).toBeGreaterThanOrEqual(2);
    expect(summary.byStatus['succeeded']).toBeGreaterThanOrEqual(2);
    const q = summary.byQueue.find((x) => x.queueId === 'q-one-ten');
    expect(q).toBeDefined();
    expect(q!.assigned).toBe(2); // the two (1,10) items, allocated once
    expect(q!.lastStatus).toBe('succeeded');
    expect(q!.avgDurationMs).not.toBeNull();

    // Time-window + queue filters flow through.
    const windowed = await engine.summarizeRuns({ queueId: 'q-one-ten', since: new Date(Date.now() - 60_000) });
    expect(windowed.byQueue).toHaveLength(1);

    // And over HTTP:
    const handler = buildFetchHandler(engine);
    const res = await handler(new Request('http://localhost/v1/runs/summary?queueId=q-one-ten'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { byQueue: Array<{ queueId: string; assigned: number }> };
    expect(body.byQueue[0]!.assigned).toBe(2);
  });
});
