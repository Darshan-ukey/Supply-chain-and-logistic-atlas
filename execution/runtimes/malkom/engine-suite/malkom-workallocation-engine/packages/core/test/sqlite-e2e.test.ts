import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AllocationEngine,
  noopLogger,
  SqliteSqlClient,
  SqliteStateStore,
} from '../src/index.js';
import { queueInput } from './helpers.js';

/**
 * End-to-end over a REAL host database (SQLite via node:sqlite): host tables,
 * declarative bindings, guarded claims, audit trail, dry-run, release.
 */
describe('sqlite end-to-end', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'malkom-e2e-'));
  const hostDb = join(tmp, 'host.db');
  let engine: AllocationEngine;
  let client: SqliteSqlClient;

  beforeAll(async () => {
    client = new SqliteSqlClient(hostDb);
    client.exec(`
      CREATE TABLE tasks (
        task_id     INTEGER PRIMARY KEY,
        status      TEXT NOT NULL,
        owner       TEXT,
        assigned_at TEXT,
        created_at  TEXT NOT NULL,
        skill       TEXT NOT NULL
      );
      CREATE TABLE agents (
        agent_id TEXT PRIMARY KEY,
        active   INTEGER NOT NULL,
        cap      INTEGER NOT NULL,
        skills   TEXT NOT NULL
      );
      INSERT INTO tasks (task_id, status, owner, created_at, skill) VALUES
        (1, 'NEW', NULL, '2026-08-12T01:00:00Z', 'claims'),
        (2, 'NEW', NULL, '2026-08-12T02:00:00Z', 'claims'),
        (3, 'NEW', NULL, '2026-08-12T03:00:00Z', 'billing'),
        (4, 'NEW', NULL, '2026-08-12T04:00:00Z', 'claims'),
        (5, 'CLOSED', NULL, '2026-08-12T05:00:00Z', 'claims');
      INSERT INTO agents (agent_id, active, cap, skills) VALUES
        ('priya', 1, 2, 'claims,billing'),
        ('marco', 1, 2, 'claims'),
        ('idle',  0, 9, 'claims');
    `);

    engine = new AllocationEngine({
      stateStore: new SqliteStateStore(join(tmp, 'state.db')),
      logger: noopLogger,
    });
    engine.connections.registerClient('db', 'sqlite', client);
    await engine.start();
    await engine.upsertQueue(
      queueInput((d) => {
        d.strategy = { kind: 'least_active' };
        d.matching = [{ itemField: 'skill', workerAttr: 'skills', op: 'contains' }];
      }),
    );
  });

  afterAll(async () => {
    await engine.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('validates against the live schema and returns a sample', async () => {
    const v = await engine.validateQueue('q-test');
    expect(v.ok).toBe(true);
    expect(v.columns?.work?.map((c) => c.name)).toContain('owner');
    expect(v.sample?.length).toBeGreaterThan(0);
  });

  it('rejects a binding whose column does not exist', async () => {
    const v = await engine.validateQueue(
      queueInput((d) => {
        if ('fields' in d.work!) d.work.fields.assignee = 'owner_renamed';
      }),
    );
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('owner_renamed'))).toBe(true);
  });

  it('dry-run shows the exact SQL and writes nothing', async () => {
    const record = await engine.runQueue('q-test', 'manual', true);
    expect(record.status).toBe('succeeded');
    expect(record.counts.planned).toBe(4);
    expect(record.notes?.some((n) => n.includes('UPDATE "tasks" SET "owner"'))).toBe(true);
    const { rows } = await client.query('SELECT COUNT(*) AS n FROM tasks WHERE owner IS NOT NULL', []);
    expect(rows[0]!['n']).toBe(0);
  });

  it('allocates through guarded UPDATEs, stamping timestamp and state', async () => {
    const record = await engine.runQueue('q-test', 'manual', false);
    expect(record.status).toBe('succeeded');
    expect(record.counts.assigned).toBe(4);

    const { rows } = await client.query('SELECT task_id, status, owner, assigned_at FROM tasks ORDER BY task_id', []);
    const assigned = rows.filter((r) => r['owner'] !== null);
    expect(assigned).toHaveLength(4);
    for (const r of assigned) {
      expect(r['status']).toBe('ASSIGNED');
      expect(String(r['assigned_at'])).toMatch(/^\d{4}-\d{2}-\d{2}T/); // db-now, ISO UTC shape
    }
    // Capacity 2+2 honored; inactive agent got nothing; CLOSED row untouched.
    expect(rows.find((r) => r['task_id'] === 5)!['owner']).toBeNull();
    const byOwner = new Map<string, number>();
    for (const r of assigned) byOwner.set(String(r['owner']), (byOwner.get(String(r['owner'])) ?? 0) + 1);
    expect(byOwner.get('priya')).toBe(2);
    expect(byOwner.get('marco')).toBe(2);
    expect(byOwner.has('idle')).toBe(false);
  });

  it('is idempotent: a second run finds nothing to do', async () => {
    const record = await engine.runQueue('q-test', 'manual', false);
    expect(record.status).toBe('succeeded');
    expect(record.counts.candidates).toBe(0);
  });

  it('exposes run history, allocations audit, schedules and metrics', async () => {
    const { runs, total } = await engine.listRuns({ queueId: 'q-test' });
    expect(total).toBeGreaterThanOrEqual(3);
    expect(runs[0]!.queueId).toBe('q-test');

    const allocations = await engine.listAllocations({ queueId: 'q-test', workerId: 'priya' });
    expect(allocations.length).toBe(2);
    expect(allocations.every((a) => a.outcome === 'assigned')).toBe(true);

    const schedules = await engine.listSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({ queueId: 'q-test', enabled: true, paused: false });
    expect(schedules[0]!.nextRunAt).toBeTruthy();
    expect(schedules[0]!.lastStatus).toBe('succeeded');

    const prom = engine.metrics.toPrometheus();
    expect(prom).toContain('malkom_runs_total{queue="q-test",status="succeeded"}');
    expect(prom).toContain('malkom_assignments_total{outcome="assigned",queue="q-test"} 4');
  });

  it('releases items back to the pool and re-allocates them', async () => {
    const released = await engine.releaseItems('q-test', ['1']);
    expect(released).toBe(1);
    const { rows } = await client.query('SELECT status, owner FROM tasks WHERE task_id = 1', []);
    expect(rows[0]!['owner']).toBeNull();
    expect(rows[0]!['status']).toBe('NEW'); // onRelease.set restored it

    const record = await engine.runQueue('q-test', 'manual', false);
    expect(record.counts.assigned).toBe(1);
  });

  it('supports config bundles with version CAS', async () => {
    const first = await engine.applyConfig({ queues: [] });
    const second = await engine.applyConfig({ queues: [] }, { expectedVersion: first.configVersion });
    expect(second.configVersion).toBe(first.configVersion + 1);
    await expect(engine.applyConfig({ queues: [] }, { expectedVersion: 0 })).rejects.toThrow(/version mismatch/);
  });
});
