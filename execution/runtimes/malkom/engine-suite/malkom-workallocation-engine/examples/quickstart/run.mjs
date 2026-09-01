/**
 * Quickstart: a host application with its own tables (tasks + agents) hands
 * the engine declarative bindings and lets it allocate.
 *
 *   npm run build && npm run demo
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AllocationEngine,
  SqliteSqlClient,
  SqliteStateStore,
  noopLogger,
} from '../../packages/core/dist/index.js';

const dir = mkdtempSync(join(tmpdir(), 'malkom-demo-'));

// ── The HOST's database — the engine knows nothing about this schema ──────
const host = new SqliteSqlClient(join(dir, 'host.db'));
host.exec(`
  CREATE TABLE claims (
    claim_id   INTEGER PRIMARY KEY,
    status     TEXT NOT NULL,
    owner_id   TEXT,
    assigned_at TEXT,
    created_at TEXT NOT NULL,
    line       TEXT NOT NULL
  );
  CREATE TABLE agents (
    agent_id TEXT PRIMARY KEY,
    presence TEXT NOT NULL,
    max_open INTEGER NOT NULL,
    skills   TEXT NOT NULL
  );
  INSERT INTO claims (status, owner_id, created_at, line) VALUES
    ('NEW', NULL, '2026-08-12T08:01:00Z', 'motor'),
    ('NEW', NULL, '2026-08-12T08:02:00Z', 'motor'),
    ('NEW', NULL, '2026-08-12T08:03:00Z', 'property'),
    ('NEW', NULL, '2026-08-12T08:04:00Z', 'motor'),
    ('NEW', NULL, '2026-08-12T08:05:00Z', 'marine');
  INSERT INTO agents VALUES
    ('priya', 'AVAILABLE', 3, 'motor,property'),
    ('marco', 'AVAILABLE', 2, 'motor'),
    ('lena',  'OFFLINE',   9, 'marine');
`);

// ── The engine — configured entirely with metadata ────────────────────────
const engine = new AllocationEngine({
  stateStore: new SqliteStateStore(join(dir, 'engine-state.db')),
  logger: noopLogger,
  hooks: {
    onAssigned: (a) => console.log(`  → ${a.itemId} assigned to ${a.workerId} (${a.reason})`),
  },
});
engine.connections.registerClient('crm', 'sqlite', host);
await engine.start();

await engine.upsertQueue({
  id: 'q-claims',
  name: 'Insurance claims',
  work: {
    connectionRef: 'crm',
    table: { name: 'claims' },
    fields: {
      id: 'claim_id',
      assignee: 'owner_id',
      state: 'status',
      assignedAt: { column: 'assigned_at' },
      createdAt: 'created_at',
      attributes: ['line'],
    },
    allocatableWhen: { op: 'in', column: 'status', values: ['NEW'] },
    ordering: [{ column: 'created_at', dir: 'asc' }],
    onAssign: { set: { status: 'ASSIGNED' } },
    onRelease: { set: { status: 'NEW' } },
  },
  workers: {
    connectionRef: 'crm',
    table: { name: 'agents' },
    fields: {
      id: 'agent_id',
      eligibleWhen: { op: 'eq', column: 'presence', value: 'AVAILABLE' },
      capacity: { column: 'max_open' },
      attributes: ['skills'],
    },
  },
  matching: [{ itemField: 'line', workerAttr: 'skills', op: 'contains' }],
  strategy: { kind: 'least_active' },
  schedule: { trigger: { kind: 'interval', everyMs: 30_000 } },
});

console.log('\nDry run (no writes, exact SQL shown):');
const dry = await engine.runQueue('q-claims', 'manual', true);
for (const n of dry.notes ?? []) console.log(`  ${n}`);

console.log('\nLive run:');
const run = await engine.runQueue('q-claims', 'manual', false);
console.log(`  status=${run.status} assigned=${run.counts.assigned} skipped(no worker)=${run.counts.skippedNoWorker}`);

const { rows } = await host.query('SELECT claim_id, status, owner_id, line FROM claims ORDER BY claim_id', []);
console.log('\nHost table after allocation:');
for (const r of rows) console.log(`  claim ${r.claim_id} [${r.line}] → ${r.owner_id ?? '(unassigned)'} (${r.status})`);

console.log('\nSchedules view:');
console.log(JSON.stringify(await engine.listSchedules(), null, 2));

await engine.stop();
