# Building a Front End for the Malkom Work Allocation Engine

**Audience:** developers — human or AI — building an admin/operations UI (or any host application) on top of the engine's control plane. Follow this document and your front end will drive every capability the engine has, without ever hardcoding a table name, a strategy name, or a state value.

**What the engine is:** a metadata-driven allocator. It applies the allocation rules *you* configure — which table is the queue, who is eligible, what strategy, what schedule — and writes exactly two things per assignment (`allocatedTo`, `allocatedOn`) through guarded, race-safe updates, auditing every decision.

**What the engine is not:** it never creates work, never interprets business states, never installs anything in the host schema beyond the optional `workEvents` table you ask it to provision. Work admission (creating queue items / workEvents rows) belongs to the host or a rules engine.

---

## 0. The golden path (build your UI in this order)

1. **Discover** — `GET /v1` → capabilities and links. Render nothing hardcoded; this document is your menu.
2. **Connect** — register the host database connection; probe it for tables/columns.
3. **Define allocation rules** — create queue definitions from schema-driven forms.
4. **Validate → dry-run → enable** — never enable a queue the user hasn't seen a dry-run for.
5. **Operate** — schedules, pause/resume, manual trigger, release.
6. **Monitor** — runs, run summaries, allocations audit, coverage alerts, metrics.

---

## 1. Protocol basics

**Base URL:** the engine server (default `http://127.0.0.1:7070`). All routes live under `/v1`.

**Auth:** `Authorization: Bearer <key>`. Two scopes: `admin` (mutate config, trigger, delete) and `read` (view everything). A dashboard that only displays data must hold a read key, never an admin key. `401` = missing/bad key; `403` = read key on an admin route.

**Errors:** every error is
```json
{ "error": { "code": "CONFIG_INVALID", "message": "…", "details": ["field: problem", "…"] } }
```
| Status | Meaning | UI reaction |
|---|---|---|
| 400 | malformed request/params | fix the request |
| 401 / 403 | auth | prompt for key / hide admin controls |
| 404 | unknown queue/run/connection | refresh lists |
| 409 | version conflict (concurrent edit) | re-fetch, re-apply user's changes, retry |
| 422 | config failed validation | render `details[]` next to the offending fields |

**Discovery:** `GET /v1` returns engine name/version, `capabilities` (registered `strategies`, supported `dialects`, `features`), and `links`. **Populate every dropdown of strategies/dialects from here** — custom strategies registered in the engine appear automatically.

**Schemas:** `GET /v1/schema` lists exported JSON Schemas; `GET /v1/schema/queue-definition` (also `connection-profile`, `config-bundle`) are generated from the engine's own zod validators — generate your forms from them and client-side validation can never drift from the server. TypeScript front ends can instead `import type { QueueDefinitionInput } from '@malkom/alloc-core'`.

---

## 2. Connections screen

| Action | Call |
|---|---|
| Register | `POST /v1/connections` `{ "id": "crm", "dialect": "postgres", "env": "CRM_DB_URL" }` — secrets are **never** sent; only env-var names or secret refs |
| List | `GET /v1/connections` → `[{ id, dialect }]` (never credentials) |
| Probe | `GET /v1/connections/crm/probe?table=claims` → `{ ok, dialect, columns: [{ name, dataType }] }` |
| Provision workEvents | `POST /v1/connections/crm/provision-work-events` (optional body `{ "table": "...", "schema": "..." }`) — idempotent |

**Use probe aggressively:** every column-name field in your rule forms should be a dropdown populated from probe results, not free text. This kills the typo class of misconfiguration entirely.

---

## 3. Allocation rules (queue definitions) — set / view / edit / delete

A queue definition **is** the allocation rules for one allocation stream. CRUD:

| Action | Call |
|---|---|
| Set (create/update) | `PUT /v1/queues/{id}` — full document, id in the path wins |
| View all | `GET /v1/queues` |
| View one + live status | `GET /v1/queues/{id}` → `{ definition, paused, scheduled, nextRunAt, lastRun }` |
| Delete | `DELETE /v1/queues/{id}` (run history is retained) |

**Concurrency (critical):** every stored definition carries a `version`. Editing flow: `GET` → user edits → `PUT` with the fetched `version` → on `409`, re-fetch, merge, retry. Omitting `version` force-writes (fine for scripted setup, not for multi-user UIs).

**UI vocabulary → schema fields** (the host tells the engine everything; the engine assumes nothing):

| Your UI concept | Schema field |
|---|---|
| "Which table is the queue" (exact name) | `work.table` = `{ "schema": "app", "name": "claims" }` |
| "Which table holds users" (exact name) | `workers.table` |
| Item primary key / assignee / state columns | `work.fields.id` / `.assignee` / `.state` |
| Which states are allocatable | `work.allocatableWhen` (filter tree, e.g. `{ "op": "in", "column": "status", "values": ["NEW"] }`) |
| Sub-queue | `work.fields.subQueue` = `{ "column": "region", "value": "MW" }` |
| Timestamp to stamp + timezone | `work.fields.assignedAt` = `{ "column": "assigned_at", "mode": "db-now" }` (UTC; `timezone` only for legacy naive columns — surface the validation warning) |
| Work order (FIFO source of truth) | `work.ordering` = `[{ "column": "created_at", "dir": "asc" }]` |
| Extra writes on assign / on release | `work.onAssign.set` / `work.onRelease.set` |
| Who is available | `workers.fields.eligibleWhen` (filter tree over user columns: active, presence…) |
| Per-user capacity | `workers.fields.capacity` = `{ "column": "max_open" }` or `{ "default": 25 }` |
| Skill matching | `matching` = `[{ "itemField": "line", "workerAttr": "skills", "op": "contains" }]` (fields must be listed in `attributes`) |
| Methodology | `strategy` = `{ "kind": "least_active" }` — kinds from `GET /v1` capabilities |
| Schedule | `schedule.trigger` = `{ "kind": "cron", "expr": "*/5 * * * *", "tz": "Asia/Kolkata" }` or `{ "kind": "interval", "everyMs": 30000 }` |
| Reclaim stale work | `staleAfter` = `{ "minutes": 240 }` |

**Filter builder:** filters are a bounded AST — operators `eq neq gt gte lt lte in notIn isNull isNotNull and or not` over column names. Build a visual predicate builder over exactly these; there is deliberately no raw-SQL input anywhere.

**workEvents shortcut:** for queues over the default `workEvents` table, the binding is formulaic — table `workEvents`, id `id`, assignee `allocatedTo`, state `transactionStateId`, `allocatableWhen` pinning `queueId` (and optionally `subqueueId`), ordering `id asc`. Offer it as a template in your UI.

---

## 4. Validate → dry-run → enable (the trust checkpoint)

Never let a user enable a queue blind:

1. `POST /v1/queues/{id}/validate` → three tiers: static rules, **live schema check** (columns exist), and a **sample query** (`sample`: real rows the filter matched). Render `errors[]` blocking, `warnings[]` advisory, `sample` as "this is what your filter catches".
2. `POST /v1/queues/{id}/dry-run` → the full pipeline with writes suppressed. The response is a run record: `counts.planned`, per-item `assignments` with the strategy's `reason`, and `notes` containing the **exact SQL** that would execute. Render as a "who would get what, and why" table.
3. Only then `PUT` with `"enabled": true`.

---

## 5. Operate

| Action | Call |
|---|---|
| Pause / resume | `POST /v1/queues/{id}/pause` · `/resume` (pause survives restarts; resume also clears the schema-failure counter) |
| Run now | `POST /v1/queues/{id}/trigger` → returns the full run record |
| Release items to the pool | `POST /v1/queues/{id}/release` `{ "itemIds": ["42"] }` |
| Schedules board | `GET /v1/schedules` → per queue: trigger, timezone, `enabled`, `paused`, `nextRunAt`, `lastRunAt`, `lastStatus` |

Watch for `status: "error"`-ish signals: a queue that repeatedly fails on schema drift **auto-pauses** — surface `paused: true` with the last run's notes so the operator knows why.

---

## 6. Monitor: query & summarize run logs, audit, alerts

### 6.1 Raw run log
`GET /v1/runs?queueId=&status=&since=&until=&limit=&offset=` → `{ runs, total }`, newest first, paginated. Each record: status (`succeeded | partial | failed | skipped | running | abandoned`), `skipReason` when skipped (`paused`, `lease_held`, `already_running`, `disabled`), `counts` (candidates, eligibleWorkers, matched, planned, assigned, lost, errors, skippedNoWorker, released), per-item `assignments` with reasons and outcomes, `notes`, `leaseToken`, and the config `queueVersion` it ran under. `GET /v1/runs/{id}` for detail views.

### 6.2 Summaries (dashboards without paging)
`GET /v1/runs/summary?queueId=&since=&until=` →
```json
{ "totalRuns": 128,
  "byStatus": { "succeeded": 120, "skipped": 6, "partial": 2 },
  "byQueue": [ { "queueId": "q-claims", "runs": 64, "assigned": 512, "lost": 3,
                 "errors": 0, "released": 8, "skipped": 2,
                 "lastRunAt": "…", "lastStatus": "succeeded", "avgDurationMs": 240 } ] }
```
Build your throughput tiles, per-queue health rows, and "assigned today/this week" charts from this endpoint — the engine aggregates server-side.

### 6.3 Allocations audit ("who got what, and why")
`GET /v1/allocations?queueId=&workerId=&itemId=&outcome=&limit=` — flattened per-assignment audit across runs (dry-runs excluded by default). This answers "show me everything Priya received this week" and "why did item 1042 go to Marco".

### 6.4 Coverage alerts — what we did NOT run
`GET /v1/coverage?connectionRef=crm[&table=…]` →
```json
{ "uncovered": [ { "queueId": "1", "subqueueId": "11", "unallocated": 3 } ], "covered": 2 }
```
Anything in `uncovered` is **work sitting in the database that no enabled allocation rule covers** — the engine also warn-logs it and sets the `malkom_unconfigured_items` gauge (and can self-scan on an interval via the `coverage` engine option). **Your UI should poll this and render a prominent alert badge**: "3 items waiting in queue 1 / sub-queue 11 — no allocation rules configured → Create rules". This is the front end's contract for "alert us when rules are missing".

### 6.5 Metrics & retention
`GET /v1/metrics` (Prometheus — includes `malkom_oldest_unassigned_seconds`, the starvation alarm) · `GET /v1/metrics.json` · `POST /v1/metrics/reset` (admin). Run-log cleanup/extraction: `DELETE /v1/runs?queueId=&status=&before=` (unfiltered deletion is refused) — pair it with an export (`GET /v1/runs` page-through) for archive-then-delete UX. Retention also runs automatically per engine config.

---

## 7. Checklist: everything the front end must supply

The engine knows nothing until told. A complete queue setup supplies: connection ref → **exact work table name** → id/assignee/state column names → allocatable states → ordering column(s) → (optional) sub-queue column+value, timestamp column+mode, onAssign/onRelease writes, staleAfter → **exact user table name** → user id column → eligibility filter → capacity → attribute columns for matching → strategy kind (+params) → schedule (+timezone) → matching rules. Every one of these is a field in `queue-definition` JSON Schema — a form generated from the schema collects precisely this list.

## 8. Rules for AI agents building on this API

1. `GET /v1` first; treat `capabilities` as the only source of valid strategy kinds and dialects. Never invent values.
2. Generate forms/payloads from `GET /v1/schema/queue-definition`; validate locally against it before PUT.
3. Column names must come from `probe`; never guess.
4. Sequence strictly: register connection → probe → `PUT` queue (`enabled: false`) → `validate` (stop on errors, show warnings) → `dry-run` (require human confirmation of `wouldAssign`) → `PUT` `enabled: true` with `version`.
5. On `409` re-fetch and merge; on `422` map `details[]` to fields; never retry an identical failed payload.
6. Poll `GET /v1/coverage` and `GET /v1/runs/summary` for health; alert on `uncovered` items, `partial`/`failed` runs, and a climbing `malkom_oldest_unassigned_seconds`.
7. Use a `read`-scope key for anything that only displays; require `admin` scope only in flows that mutate.

---

*Generated for engine v0.1.0 — the API surface above is exercised end-to-end by the repo's test suite (`packages/core/test/`).*
