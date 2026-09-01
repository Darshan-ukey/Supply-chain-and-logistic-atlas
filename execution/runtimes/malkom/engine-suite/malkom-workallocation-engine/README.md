# Malkom — Work Allocation Engine

A generic, metadata-driven work allocation engine. **The engine owns decisions, never data**: work items and users live in *your* tables under *your* schema; the engine is told — through declarative, validated configuration — which database to read and update, which tables and columns mean what, who is eligible for what, and when each queue runs. It then assigns work safely, audits every decision, and exposes the whole thing over a typed library API and a small REST control plane.

- **Backend-agnostic** — a hexagonal core behind three small ports (`WorkSource`, `WorkerSource`, `Assigner`); a shipped SQL binding adapter covers SQLite/Postgres/MySQL with pure JSON config, and anything else plugs in as a ~60-line custom adapter.
- **Fully typed** — zod schemas are the single source of truth: runtime validation, TypeScript types, and exported JSON Schema (`GET /v1/schema/*`) for non-TS clients, all from one definition.
- **Small footprint** — two runtime dependencies (`zod`, `croner`). State lives in SQLite via Node's built-in `node:sqlite` — zero native modules, no broker, no Redis.
- **Correct under concurrency** — every assignment is a guarded conditional `UPDATE … WHERE assignee IS NULL AND <allocatable>`; losing a race is a normal outcome. Leases with fencing tokens keep multi-instance deployments single-writer per queue.
- **Observable by default** — every run persists a full audit record (who got what, why, under which config version); Prometheus metrics include the starvation alarm `malkom_oldest_unassigned_seconds`; runs are queryable, extractable, and deletable over the API with retention policies.

## Install

```bash
npm install @malkom/alloc-core        # library
npm install -g @malkom/alloc-server   # standalone control plane
npm install -g @malkom/alloc-cli      # ops CLI
```

Requires Node ≥ 22.5 (for built-in `node:sqlite`).

## Sixty seconds, embedded

```ts
import { AllocationEngine, SqliteStateStore, SqliteSqlClient } from '@malkom/alloc-core';

const engine = new AllocationEngine({ stateStore: new SqliteStateStore('./engine-state.db') });
engine.connections.registerClient('crm', 'sqlite', new SqliteSqlClient('./crm.db'));
await engine.start();

await engine.upsertQueue({
  id: 'q-claims',
  name: 'Insurance claims',
  work: {
    connectionRef: 'crm',
    table: { name: 'claims' },
    fields: {
      id: 'claim_id', assignee: 'owner_id', state: 'status',
      assignedAt: { column: 'assigned_at' },            // stamped by the DB clock (UTC)
      createdAt: 'created_at', attributes: ['line'],
    },
    allocatableWhen: { op: 'in', column: 'status', values: ['NEW'] },
    ordering: [{ column: 'created_at', dir: 'asc' }],    // FIFO's source of truth
    onAssign: { set: { status: 'ASSIGNED' } },           // same statement as the claim
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
  strategy: { kind: 'least_active' },                    // or fifo | round_robin | custom
  schedule: { trigger: { kind: 'cron', expr: '*/5 * * * *', tz: 'America/Chicago' } },
});
// The scheduler now runs the queue; or: await engine.runQueue('q-claims', 'manual', false)
```

Try it live: `npm run build && npm run demo` (see [examples/quickstart](examples/quickstart/run.mjs)).

## How the engine knows things

Every "how will it know…" question has exactly one home in configuration:

| The engine needs to know… | Declared in… |
| --- | --- |
| Which DB to connect to (read + update) | `ConnectionProfile` / `connections.registerClient` — referenced by name; secrets via env or secret refs, never inline |
| Which table is the queue | `work.table` |
| Which table holds users + their rules | `workers.table` + `eligibleWhen` + `capacity` + `attributes` |
| Which field gets the user id | `work.fields.assignee` (+ extra writes via `onAssign.set`) |
| Which timestamp, which timezone | `work.fields.assignedAt { column, timezone?, mode }` — `db-now` UTC by default; `timezone` only for legacy naive columns |
| State / sub-queue / task states | `work.fields.state` + `allocatableWhen` + `fields.subQueue` discriminator |
| Who may receive an item | `matching` rules (item field ↔ worker attribute), enforced before any strategy |
| The methodology | `strategy: { kind, params }` — `fifo`, `round_robin`, `least_active`, or a registered custom strategy |
| When each queue runs | `schedule` — cron (per-queue IANA timezone) or interval, with optional jitter |

## Batteries included: the `workEvents` table (optional)

Hosts that already have a work table bind it directly — that's the core design. Hosts that **don't** can provision the engine's default work table and get a ready-made queue surface:

```ts
await engine.provisionWorkEvents('crm');   // idempotent; or: malkom-alloc provision crm

await engine.upsertQueue({
  id: 'q-ops-inv',
  name: 'Ops / Invoices',
  work: workEventsBinding({ connectionRef: 'crm', queueId: 'q-ops', subqueueId: 'INV' }),
  workers: { /* your users table */ load: workEventsOpenLoad },
  strategy: { kind: 'least_active' },
  schedule: { trigger: { kind: 'interval', everyMs: 30_000 } },
});
```

`workEvents(id, queueId, subqueueId, transactionStateId, allocatedTo, allocatedOn, completedOn, taskStartTime, taskEndTime)` — one physical table serves many queues/sub-queues. Division of labor:

- **Producer** (your intake API, indexer, upstream system) INSERTs work rows. `workEvents` is the **system of record, never a mirror** — "item created" and "row inserted" are the same event, so there is nothing to synchronize and no database trigger to install. (The engine deliberately never creates triggers in your database: that would put engine logic inside your schema's behavior. If you want to dual-write from an existing table, that trigger is yours to own.)
- **Engine** writes exactly two columns — `allocatedTo` + `allocatedOn` (DB clock, UTC) — through the same guarded claim as any binding (`allocatedTo IS NULL AND queueId = ? AND transactionStateId IN (…)`, FIFO by the incremental `id`).
- **Front end** fills `completedOn`, `taskStartTime`, `taskEndTime`. Stamping `completedOn` automatically frees the worker's capacity on the next run (`workEventsOpenLoad` counts open = allocated ∧ not completed).

`transactionStateId` holds **your** vocabulary (Indexed, Processed, Parked, Queried…); the default allocates `'Indexed'` rows and is overridable (`allocatableStates`, `onAssignSet`, `onReleaseSet`, table name — everything). The factory output is validated by the same schema as any host binding — it has no privileged path into the engine.

## Server mode & CLI

```bash
MALKOM_ADMIN_KEYS=s3cret MALKOM_STATE_DB=./state.db malkom-alloc-server
# then, from anywhere:
MALKOM_URL=http://127.0.0.1:7070 MALKOM_API_KEY=s3cret \
  malkom-alloc queues apply -f q-claims.json
malkom-alloc validate q-claims      # live schema check + sample rows
malkom-alloc dry-run q-claims       # full pipeline, writes suppressed, exact SQL shown
malkom-alloc trigger q-claims
malkom-alloc schedules              # nextRunAt / lastStatus per queue
malkom-alloc runs --queue q-claims
malkom-alloc metrics
```

The CLI is a pure REST client — if the CLI can do it, any app can. The discovery document (`GET /v1`) lists capabilities (registered strategies, dialects, features) and links; JSON Schemas live under `/v1/schema/*`. Library hosts can mount the same control plane on their own server: `buildFetchHandler(engine)` returns a web-standard `(Request) => Response`.

## Metrics, runs, and retention

- `GET /v1/runs` (+ filters), `GET /v1/runs/:id` — full audit: counts, per-item outcomes (`assigned` / `lost` / `error`), strategy reasons, config version, fencing token.
- `GET /v1/runs/summary?queueId=&since=&until=` — server-side aggregation for dashboards: totals by status, per-queue assigned/lost/errors/released, last run, average duration.
- `GET /v1/coverage?connectionRef=…` — the **coverage watchdog**: unallocated work whose (queueId, subqueueId) has *no enabled allocation rules* — what the engine was supposed to run but couldn't. Also warn-logged and exposed as the `malkom_unconfigured_items` gauge; can self-scan on an interval via the `coverage` engine option.
- `GET /v1/allocations?workerId=…` — flattened assignment audit across runs.
- `DELETE /v1/runs?queueId=…&before=…` — extraction/cleanup (unfiltered deletion is refused).
- `GET /v1/metrics` (Prometheus) / `metrics.json` / `POST /v1/metrics/reset`.
- Retention (`maxAgeMs`, `maxCountPerQueue`) prunes automatically after runs.

## Packages

| Package | What it is |
| --- | --- |
| [`@malkom/alloc-core`](packages/core) | Engine, ports, strategies, SQL binding adapter, state stores, control-plane router |
| [`@malkom/alloc-server`](packages/server) | Standalone server over `node:http` — no web framework |
| [`@malkom/alloc-cli`](packages/cli) | Ops CLI, a pure client of the REST API |

## Architecture & guides

The full design — first-class objects, the ports contract, the run pipeline, concurrency model, and the risk register — lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Building an admin UI or integrating a host app? [docs/FRONTEND-GUIDE.md](docs/FRONTEND-GUIDE.md) is the screen-by-screen integration spec, written for developers and AI agents alike.

## Development

```bash
npm install
npm run build     # tsc -b (composite projects)
npm test          # vitest: unit + sqlite end-to-end
npm run demo      # runnable quickstart
```

MIT © Malkom contributors
