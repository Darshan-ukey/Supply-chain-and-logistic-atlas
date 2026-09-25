# Malkom — Process Metrics & KPI Engine

A generic, metadata-aware, embeddable process-metrics and KPI engine for queues and sub-queues — the sibling of the [Malkom work-allocation engine](../malkom-workallocation-engine) and the [Malkom rules engine](../malkom-rules-engine). **The engine owns metric definitions and computed points, never your data**: you declare a *registry* (which entities exist, which fields mean what), authors write *metric definitions* against that vocabulary, and the engine validates, backtests, activates, schedules and computes them — returning values, statuses and full replay traces. Your tables are read with plain SELECTs and never written. Everything is available as a typed library API and mirrored 1:1 on a small REST control plane.

- **Metadata-aware** — metrics are written against a registry of entities and fields, not raw columns; the registry is versioned, and every activated definition version pins the registry version (and the calendar version) it was validated against.
- **Evidence before activation** — tiered validation (shape → cross-reference → live schema) and read-only backtests over real history, per window, before a definition ever goes live.
- **Auditable by construction** — a draft → pending → active → retired lifecycle with an actor-stamped transition trail, immutable version snapshots, and a runs log recording every computation (ok, error, or lease-skipped) with its replay trace.
- **Business time is first-class** — versioned calendars (timezone, workweek, working hours, holidays, DST policy) drive week/month windows and derived fields like `businessMinutesBetween`.
- **Deterministic & replayable** — the calculation core is pure: same definition, facts and instant reproduce the same value forever, and the trace shows every pipeline stage (facts in → scope → derived fields → exclusions → aggregates → status).
- **Small footprint** — two runtime dependencies (`zod`, `croner`). State lives in SQLite via Node's built-in `node:sqlite` (or in memory, or behind your own `MetricsStateStore`). No broker, no framework.

## Install

```bash
npm install @malkom/metrics-core         # library
npm install -g @malkom/metrics-server    # standalone control plane
npm install -g @malkom/metrics-cli       # ops CLI
```

Requires Node ≥ 22.5 (for built-in `node:sqlite`).

## Sixty seconds, embedded

```ts
import { MemoryFactSource, MetricsEngine } from '@malkom/metrics-core';

// Host rows — the engine reads them, never writes them. Swap the
// MemoryFactSource for registry table bindings + a connection to read
// straight from SQLite/Postgres/MySQL.
const engine = new MetricsEngine({
  state: { kind: 'memory' }, // or { kind: 'sqlite', path: './metrics-state.db' }
  factSource: new MemoryFactSource(bookings),
});
await engine.start();

// 1. The registry — the vocabulary metrics are written in.
await engine.applyRegistry({
  entities: [{
    id: 'booking',
    fields: [
      { id: 'region', type: 'string', valueSet: 'regions' },
      { id: 'status', type: 'string', values: ['new', 'confirmed'] },
      { id: 'createdAt', type: 'date' },
      { id: 'confirmedAt', type: 'date' },
    ],
  }],
  valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
});

// 2. A calendar — business time, versioned.
await engine.upsertCalendar({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
});

// 3. The Booking-TAT SLA: % of bookings confirmed within 240 BUSINESS minutes.
await engine.createMetric({
  name: 'booking-tat-sla',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'week' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
  calendarRef: 'india-ops',
  derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] } },
  formula: {
    kind: 'ratio',
    numerator: { agg: 'count', source: 'booking', where: { op: 'and', args: [
      { op: 'eq', field: 'status', value: 'confirmed' },
      { op: 'lte', field: 'tatMinutes', value: 240 },
    ] } },
    denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
  },
}, { actor: 'money' });

// 4. Evidence, then lifecycle. WHO may approve is the host's rule; the
//    engine enforces legality and records who did what.
await engine.validateMetric('booking-tat-sla');           // tier-1; { live: true } adds tier-2
await engine.submit('booking-tat-sla', { actor: 'money' });
await engine.activate('booking-tat-sla', { actor: 'priya' });
await engine.assign({ metric: 'booking-tat-sla', scope: { region: 'APAC' } });

// 5. Compute.
const result = await engine.calculate({ metric: 'booking-tat-sla', scope: { region: 'APAC' } });
// result.value → 66.67, result.status → 'breach', result.trace → the full receipt
const board = await engine.snapshot();  // every active definition's current value, point-or-live
```

Run the complete version against the built core: `npm run build && npm run demo` ([examples/quickstart.mjs](examples/quickstart.mjs)).

## Server mode & CLI

```bash
MALKOM_METRICS_ADMIN_KEYS=s3cret MALKOM_METRICS_STATE_DB=./state.db malkom-metrics-server
```

Server configuration — a flag beats its env var, the env var beats the documented default: `--port` / `MALKOM_METRICS_PORT` (7072), `--host` / `MALKOM_METRICS_HOST` (127.0.0.1), `--state-db` / `MALKOM_METRICS_STATE_DB` (`./malkom-metrics-state.db`, `:memory:` works), `--registry` / `MALKOM_METRICS_REGISTRY` (path to a JSON registry document applied at boot), `--scheduler` / `MALKOM_METRICS_SCHEDULER` (`true` starts the rollup scheduler), `--max-body-bytes` / `MALKOM_METRICS_MAX_BODY_BYTES` (request-body budget, default `1048576` = 1 MiB — an over-budget body is refused 413 *before* auth or JSON parsing, and a chunked upload is cut off the moment it crosses the budget), `MALKOM_METRICS_ADMIN_KEYS` / `MALKOM_METRICS_READ_KEYS` (comma-separated bearer keys — with both empty the control plane is OPEN and the server warns loudly).

Shutdown: the first `SIGINT`/`SIGTERM` drains — the listener closes, in-flight requests finish, then the engine stops (scheduler drained, state store closed) — and the process exits 0. A second signal during the drain forces immediate exit (130).

```bash
export MALKOM_METRICS_URL=http://127.0.0.1:7072 MALKOM_METRICS_KEY=s3cret
malkom-metrics registry apply -f registry.json
malkom-metrics calendar apply -f india-ops.json
malkom-metrics metric create -f booking-tat.json --actor money
malkom-metrics metric validate booking-tat-sla --live
malkom-metrics metric backtest booking-tat-sla --from 2026-07-01T00:00:00Z --to 2026-08-01T00:00:00Z
malkom-metrics metric submit booking-tat-sla --actor money
malkom-metrics metric activate booking-tat-sla --actor priya
malkom-metrics assignment create -f apac.json
malkom-metrics eval calculate --metric booking-tat-sla --scope '{"region":"APAC"}'
malkom-metrics eval snapshot
malkom-metrics eval backfill --metric booking-tat-sla --from 2026-07-01T00:00:00Z --to 2026-08-01T00:00:00Z
malkom-metrics points query --metric booking-tat-sla
malkom-metrics runs query --metric booking-tat-sla
malkom-metrics telemetry
```

The CLI is a pure REST client — if the CLI can do it, any app can:

```bash
curl -s http://127.0.0.1:7072/v1 -H 'authorization: Bearer s3cret'   # discovery document
curl -s -X POST http://127.0.0.1:7072/v1/eval/snapshot \
  -H 'authorization: Bearer s3cret' -H 'content-type: application/json' -d '{}'
```

JSON Schemas for every config document live at `GET /v1/schemas`; an OpenAPI path skeleton at `GET /v1/openapi.json`. Library hosts can mount the same control plane on their own server: `buildFetchHandler(engine)` returns a web-standard `(Request) => Promise<Response>`.

## The anatomy of a definition

A metric definition is one JSON document with six load-bearing parts:

| Part | What it declares |
| --- | --- |
| `kind` + `metricType` + `unit` | `sla` or `kpi`; count / percent / ratio / duration / currency / number (unit defaults per type) |
| `scope.dimensions` | Registry fields the metric is broken down by; `[]` = whole entity. *Assignments* later bind concrete values |
| `window` | `{ kind: 'periodic', grain: day\|week\|month\|quarter }` or `{ kind: 'rolling', length, unit }`, calendar- or business-aligned |
| `anchor` | How facts attach to a window: an `event` timestamp field, or `snapshot` (as-of-now, the window merely labels the point) |
| `formula` | One `aggregate` (count/countDistinct/sum/avg/min/max/p50–p99 over a field + `where` filter) or a `ratio` of two |
| `derive` / `exclusions` / `target` | Business-time fields per row; audited row exclusions with effective windows; the target + warn/breach thresholds |

Filters are a bounded condition AST (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `inSet`, `matches`, `isNull`, `isNotNull`, `and`, `or`, `not`) — the same vocabulary as the sibling engines, with `matches` (an ECMAScript regex, compile-checked, string fields only) evaluated in memory.

## Design decisions

- **D1 — The engine never writes host tables.** Facts are read with parameterized SELECTs (projection, scope equality, anchor range — nothing richer is pushed down); every write lands in the engine's own `malkom_metrics_*` tables.
- **D2 — Definition and assignment are split.** A definition declares *meaning* (formula, window, target); an assignment binds it to a concrete scope slice with an optional target override. One definition, many slices, no copy-paste drift.
- **D3 — The formula language is a bounded AST.** Declared aggregations over a declared condition language — no raw SQL, no expression strings. Definitions flow from admin UIs and untrusted API callers; the grammar is the security boundary.
- **D4 — Calendars are first-class and versioned.** Timezones, workweeks, working hours, holidays and DST policy are authored documents; activated definitions pin the calendar version, so "business minutes" is auditable per point.
- **D5 — The lifecycle is the rules engine's, verbatim.** draft → pending → active → retired, actor-stamped transitions, immutable activation snapshots; activation re-runs tier-1 against the CURRENT registry — stored verdicts are dashboard hints, never authorization.
- **D6 — The calculation core is pure.** No I/O, no clocks, no randomness inside evaluation; identical inputs reproduce identical values forever, which is what makes backtests honest and audits meaningful.
- **D7 — Points are rebuildable derivations.** A stored point is a cache of a deterministic computation, keyed (metric, scope, window) with a revision counter — backfills and recomputes replace it, never fork it. Losing the points table loses no truth.
- **D8 — Scope dimensions are generic.** There is no team/org/queue concept baked in — dimensions are registry fields, and a "team's metrics" is just an assignment slice. The engine never invents scope values.

## Configuration reference

Everything below is an `EngineDefaults` knob (pass overrides via the `defaults` engine option; author data always wins over these):

| Knob | Default | What it does |
| --- | --- | --- |
| `weekStart` | `mon` | Week-start day for week windows resolved without a calendar |
| `defaultTimezone` | `UTC` | Window-resolution timezone when no calendar supplies one |
| `maxBusinessSpanDays` | `4000` | Business-time spans beyond this many days throw (config accidents) |
| `percentileMethod` | `nearest_rank` | `nearest_rank` or `linear` (R-7), unless the definition's options say otherwise |
| `maxFactRows` | `100000` | Max rows one source fetch may return; exceeding it THROWS — silent truncation is forbidden |
| `backtestStep` | `1` | Days between window ends when backtesting/backfilling a ROLLING definition |
| `rollupCrons.day` | `5 0 * * *` | Daily rollup, shortly after the day closes (cron fires in the definition's calendar timezone) |
| `rollupCrons.week` | `10 0 * * 1` | Weekly rollup, 00:10 local; the day-of-week field is overridden per definition with its calendar’s `weekStart` |
| `rollupCrons.month` | `15 0 1 * *` | Monthly rollup, the 1st 00:15 local |
| `rollupCrons.quarter` | `20 0 1 1,4,7,10 *` | Quarterly rollup |
| `scheduler.leaseTtlMs` | `60000` | Cross-instance rollup lease TTL (kv compare-and-set, fencing tokens) |
| `retention.runsMaxAgeDays` | `90` | Runs older than this are pruned first |
| `retention.runsMaxRows` | `100000` | Then the oldest overflow beyond this cap |
| `retention.keepTraces` | `true` | `false` also strips replay traces from surviving runs |
| `backfillEmitsBreaches` | `false` | Whether historical backfill windows emit breach/recover events (alerts belong to the present) |

Engine constructor options (all optional, zod-validated): `state` (store instance \| `{kind:'memory'}` \| `{kind:'sqlite', path}`; default memory), `connections` (ConnectionRegistry \| profile list), `defaults` (above), `hooks` (`onEvent`/`onError` — never fatal), `clock`, `logger`, `auth` (`{adminKeys, readKeys}`; both empty = OPEN), `scheduler` (`{enabled: false, autoRefresh: true}`), `closeStateStoreOnStop` (default `true`), `instanceId` (lease identity; default uuidv7), `factSource` (a `FactSourcePort`; default = SQL through `connections`).

## API

Every route is a thin transport over one facade method. `read` = read-key scope; `admin` = admin-key scope (an open plane grants everyone admin).

| Route | Method(s) | Scope | Facade method |
| --- | --- | --- | --- |
| `/v1` | GET | read | `describe()` |
| `/v1/openapi.json` | GET | read | — (path skeleton) |
| `/v1/schemas` | GET | read | `jsonSchemas()` |
| `/v1/registry` | GET / PUT | read / admin | `getRegistry(version?)` / `applyRegistry(doc)` |
| `/v1/calendars` | GET / PUT | read / admin | `listCalendars()` / `upsertCalendar(doc)` |
| `/v1/calendars/:name` | GET / PUT | read / admin | `getCalendar(name)` / `upsertCalendar(doc)` |
| `/v1/metrics` | GET / POST | read / admin | `listMetrics()` / `createMetric(def, {actor})` |
| `/v1/metrics/:name` | GET / PATCH | read / admin | `getMetric(name)` / `updateMetric(name, def, {actor})` |
| `/v1/metrics/:name/versions` | GET | read | `listMetricVersions(name)` |
| `/v1/metrics/:name/validate` | POST | read | `validateMetric(nameOrDef, {live?})` |
| `/v1/metrics/:name/submit` \| `reject` | POST | admin | `submit(name, {actor})` / `reject(...)` |
| `/v1/metrics/:name/activate` \| `retire` | POST | admin | `activate(name, {actor})` / `retire(...)` |
| `/v1/metrics/:name/backtest` | POST | admin | `backtest({metric, range, scope?})` |
| `/v1/assignments` | GET / POST | read / admin | `listAssignments({metric?})` / `assign(input)` |
| `/v1/assignments/:id` | DELETE | admin | `unassign(id)` |
| `/v1/eval/calculate` | POST | read | `calculate({metric, scope?, at?})` |
| `/v1/eval/snapshot` | POST | read | `snapshot({scope?, at?, mode?})` |
| `/v1/eval/series` | POST | read | `series({metric, scope?, grain?, fromIso, toIso})` |
| `/v1/eval/backfill` | POST | admin | `backfill({metric, range, scope?})` |
| `/v1/points` | GET / DELETE | read / admin | `queryPoints(query)` / `deletePoints(filter)` |
| `/v1/runs` | GET / DELETE | read / admin | `queryRuns(query)` / `pruneRuns()` |
| `/v1/telemetry`(`.json`) | GET / DELETE | read / admin | `telemetry.toPrometheus()` / `.toJSON()` / `.reset()` |

Validation failures are `422 { error, issues: [{ path, code, message }] }` — the `path` points at the exact AST node, so a metric-builder UI can red-underline the widget. Lifecycle conflicts are `409`; missing things are `404`; a known path with a wrong method is `405` with an `Allow` header.

`snapshot` modes: `auto` (default) serves the stored point when its `windowKey` equals the current window's key and computes live otherwise; `live` always computes; `points` serves only what the store has. Each entry is a MetricResult plus `{ source: 'point'|'live', assignment }` — dimensionless definitions are always included, dimensioned ones contribute one entry per matching active assignment.

**Draft execution is admin-gated over HTTP.** `calculate` and `snapshot` under a *read* key execute only ACTIVE versions — a metric with no active version answers `409 CONFLICT` to a read-scoped `calculate` (snapshot never included it), because running an unreviewed draft formula against live data is exactly the capability `backtest` admin-gates. Admin keys (and the open plane) keep the draft fallback. In library mode the switch is explicit: `engine.calculate({ …, allowDraft: false })` (default `true` — in-process callers are trusted).

## SQL table bindings

Registry entities bound to `table` + `connectionRef` are read with one parameterized SELECT per formula source (projection, scope equality, anchor range — see D1/D3). Three things to know before binding real tables:

- **Event-anchor columns MUST hold ISO-8601 UTC text** (e.g. `2026-08-12T06:00:00.000Z`) or a native timestamp type the driver compares correctly against it. The window bounds are pushed down as ISO-8601 UTC *text* bound parameters, so on SQLite (and any text-affinity column) the comparison is lexical:
  - an **epoch-encoded INTEGER/REAL column never falls inside any window** — the metric silently computes `no_data` forever;
  - a **naive local `YYYY-MM-DD HH:MM:SS` text column** sorts differently from the UTC bounds — rows near window edges silently leak into the wrong window.
  Note the trap: `MemoryFactSource` *tolerates* epoch numbers (it parses per row), so a definition that works in port mode can break silently when moved onto SQL bindings. Tier-2 validation (`POST /v1/metrics/{name}/validate` with `{"live": true}`) flags clearly numeric anchor columns with the advisory issue `anchor_encoding_suspect` (severity `warning` — it informs the verdict without failing it). If the host schema cannot store ISO text, read that entity through a `FactSourcePort` instead.
- **Connection ownership**: clients a host hands over with `connections.registerClient(id, dialect, client)` remain the HOST's — `closeAll()` (run by `engine.stop()`) releases them from the registry but never closes them; re-register after a `closeAll()` to use them again. Clients the registry *creates* (profiles, factories) are closed by `closeAll()`.
- **Driver-level failures are logged, not fatal, not leaked**: the lazily-created `pg` pool always carries an `'error'` listener (an idle connection dropping is logged to the engine logger and the pool recovers — it must never crash the process), and when a fact fetch fails, the full driver message goes to the engine log while HTTP callers see only `upstream data source error (entity "…")` — driver text carries table/column/connection intel that read-scoped callers must not see.

## Table inventory

Everything the engine owns lives in eight tables (prefix `malkom_metrics_`), written ONLY through the state-store port — hosts never touch them directly:

| Table | Holds |
| --- | --- |
| `malkom_metrics_registry` | Registry document versions (append-only) |
| `malkom_metrics_calendars` | Calendars, content-hash versioned |
| `malkom_metrics_definitions` | Definition heads: state, working draft, transition trail |
| `malkom_metrics_versions` | Immutable activation snapshots (registry + calendar pinned) |
| `malkom_metrics_assignments` | Scope bindings with target overrides |
| `malkom_metrics_points` | Computed points, keyed (metric, scopeHash, windowKey), revisioned |
| `malkom_metrics_runs` | The computation audit log (ok / error / skipped, with traces) |
| `malkom_metrics_kv` | Version counters and rollup leases (compare-and-set) |

## Why `/v1/telemetry`, not `/v1/metrics`

In this engine **"metrics" is the business domain** — the KPIs and SLAs the engine computes for you, served under `/v1/metrics`. The engine's OWN operational counters (runs, points, activations, breaches, gauges, durations) are therefore called **telemetry** and served at `/v1/telemetry` (Prometheus text) and `/v1/telemetry.json`. The sibling engines use `/v1/metrics` for the same thing; here that name was taken by the product itself.

## Packages

| Package | What it is |
| --- | --- |
| [`@malkom/metrics-core`](packages/core) | Engine facade, registry + definition schemas, pure calculation core, calendars, scheduler, state stores, control-plane router |
| [`@malkom/metrics-server`](packages/server) | Standalone server over `node:http` — no web framework |
| [`@malkom/metrics-cli`](packages/cli) | Ops CLI, a pure client of the REST API |

## Development

```bash
npm install
npm run build     # tsc -b (composite projects: core, server, cli)
npm test          # vitest
npm run demo      # examples/quickstart.mjs against the built core
```

Requires Node ≥ 22.5. MIT © Malkom contributors
