# Malkom Process Mining Engine

A configurable, fully typed process mining engine. It binds the host's own
tables, projects them into a case-centric event log, and mines the four
classical perspectives — **control flow**, **performance**, **data** and
**organizational**.

> Process Mining research is concerned with the extraction of knowledge about a
> (business) process from its process execution logs.

Headless: the engine emits data and geometry, never pixels. The host renders.

**Status — v0.1.0, in development.** Configuration (including joined sources),
validation, the profiler, reading from a host database with incremental
refresh, offline mining (CSV + XES), discovery, and the performance, variant,
organizational and conformance analyses are complete and tested. Model export,
layout and the HTTP API are next; see [Roadmap](#roadmap).

---

## The three ideas

### 1. Nothing is hardcoded

No column name is assumed anywhere in the core. The host declares where data
lives and what each column **means**:

```ts
roles: {
  case:     'queueId',        // whatever repeats per business item
  activity: ['subqueueId', 'transactionStateId'],
  resource: 'allocatedTo',
  start:    'allocatedOn',
  end:      'completedOn',
  duration: 'aht',            // handling time, distinct from waiting
}
```

A different host maps `pnr`, `document_id` or `case_ref` and nothing downstream
changes. The activity classifier is composable, so one column gives a coarse
map and several give a fine one — chosen per analysis, not baked into a schema.

**Your data can live across several tables.** Real schemas keep timestamps in
one table, the business reference on a header, and the person's name in a
lookup. The host declares the tables and the keys; building the join is the
engine's job:

```ts
from: {
  table: { name: 'steps' }, alias: 's',
  joins: [
    { table: { name: 'cases' },  alias: 'c',
      on: [{ leftAlias: 's', leftColumn: 'case_fk',   rightAlias: 'c', rightColumn: 'case_pk' }] },
    { table: { name: 'people' }, alias: 'p',
      on: [{ leftAlias: 's', leftColumn: 'person_fk', rightAlias: 'p', rightColumn: 'person_pk' }] },
  ],
},
roles: {
  case:     'c.reference',     // from the header table
  resource: 'p.full_name',     // from the lookup
  start:    's.started_at',
  end:      's.ended_at',
},
```

Joins are **declared, never written as SQL** — bindings arrive from admin UIs
and API callers, and an ON clause accepting text is an arbitrary predicate.
`left` is the default: an inner join drops every event with no matching lookup
row, which makes a process look cleaner than it is, so the engine warns when
you ask for one. A binding referencing an alias it forgot to join is rejected
at config time, not as an opaque SQL error.

A single table stays as short as it ever was — `from: { name: 'workEvents' }`.

### 2. Grain, and the honest refusal

Process mining needs to know *when each transition happened*. A column holding
a **current value** gives you the value but not the history, and no amount of
configurability recovers transitions the host never persisted. So every binding
declares its grain:

| Grain | What a row is | What it can support |
|---|---|---|
| `event` | one row per occurrence, append-only | full discovery |
| `interval` | one row per unit of work, start + end | full discovery, and separates handling from waiting |
| `snapshot` | one row per entity, updated in place | case attributes only, never steps |

Sources of mixed grain compose: event and interval sources contribute steps,
snapshot sources contribute labels on the resulting case.

If **every** bound source is snapshot grain, the engine will not draw a process
map. It would be trivially easy to string the observed states into
`Indexed → Processed → Done`, and that map would be a fabrication — convincing
enough to reach a steering committee, describing a path no case ever took.
Instead the engine reports control flow as unavailable, delivers everything the
data *does* support, and names the fix.

### 3. The case key is a per-analysis choice

Events are stored linked to **objects** rather than stamped with one permanent
`caseId`:

```ts
objects: [
  { type: 'booking', column: 'queueId' },
  { type: 'item',    column: 'itemId'  },
]
```

The extractor then projects that into a flat, ordinary case-centric log by
pivoting on whichever object type the analysis asks for. Every downstream
algorithm sees plain rows.

This is not academic. Five line items each amended once, flattened onto one
booking timeline, render as `Amend → Amend → Amend → Amend → Amend` and the map
draws a rework loop that never happened. Re-project at item level and it
disappears, because it was an artefact of the projection rather than a fact
about the process.

**OCEL 2.0 is deliberately not adopted** as an internal model. The
relationships are recorded; the formalism is not needed.

---

## Quickstart

```bash
npm install
npm run build
node examples/seed.mjs                                    # stands in for your DB
node packages/cli/dist/bin.js profile examples/booking-ops.json
```

```
binding work-events  (interval grain, "workEvents")
  case key          queueId
  rows              12
  events            24
  cases             3
  activities        6
  resources         3
  events/case       median 8, mean 8.0, longest 10
  time span         2026-03-01T09:00:00.000Z → 2026-03-04T09:58:00.000Z

  info    PROFILE_OK: 12 rows -> 3 cases, median 8 events per case, longest 10
```

Same stream, pivoted onto the finer object:

```bash
node packages/cli/dist/bin.js profile examples/booking-ops.json --case-object item
```

```
  case key          itemId  [object: item]
  cases             7
  events/case       median 2, mean 3.4, longest 8

  warning MOSTLY_SINGLE_ROW_CASES: 71% of cases have only one row, so most
          traces have no transitions to discover
```

---

## Offline mining

Mine a log from a file — no host database involved. CSV goes through DuckDB's
native reader **entirely in-database**, so a multi-gigabyte log imports in one
streaming pass rather than being marshalled row by row into Node.

```bash
malkom-mining import log.csv --store analysis.duckdb
malkom-mining discover --store analysis.duckdb
```

Column roles are inferred from the XES convention (`case:concept:name`,
`concept:name`, `time:timestamp`, `org:resource`) and from the spellings tools
actually emit (`Case ID`, `Activity`, `Timestamp`). Anything unusual is named
explicitly:

```bash
malkom-mining import orders.csv --store analysis.duckdb \
  --case booking_ref --activity step --timestamp when --resource who \
  --time-format '%d/%m/%Y %H:%M:%S' --timezone Asia/Kolkata
```

XES XML works too, gzip included:

```bash
malkom-mining import BPI_Challenge_2012.xes.gz --store analysis.duckdb
```

Once imported, an offline log is **indistinguishable** from an extracted one —
it lands in the same three tables, and the DFG and miners never learn which one
fed them.

> **Timestamps.** A timestamp with no offset is read as **UTC** unless
> `--timezone` says otherwise. Left to the database it would be read in the
> session's local zone, so the same file would import differently on a laptop
> in Mumbai and a server in Frankfurt.

> **XES size.** XES is XML and must be parsed in memory, so imports are capped
> (256 MB expanded, checked *after* decompression — XES compresses ~40:1).
> Beyond that, convert to CSV or Parquet, which DuckDB streams.

## Discovery

```bash
malkom-mining discover --store analysis.duckdb --lifecycle complete --threshold 0.05
```

The directly-follows graph is built with a window function **inside the
database** and comes back already aggregated: a 40-million-event log yields a
graph of a few hundred nodes, so what crosses into Node is small regardless of
log size.

The Inductive Miner then finds four cuts — exclusive choice, sequence,
concurrency, loop — recursively. Its guarantee is that **every model it returns
is sound**: Alpha and Heuristics miners can emit models that deadlock, which
nobody can replay or conformance-check. Where no cut can be justified it falls
back to a flower model and *says so*, rather than presenting an invented
structure.

| Flag | Purpose |
|---|---|
| `--lifecycle complete` | One transition only. Essential when some activities emit schedule/start/complete triples and others emit a single completion — mixing granularities tangles the graph |
| `--threshold 0.05` | Drop arcs rare **relative to their source**. An absolute cutoff deletes the entire tail of a quiet process; a relative one removes a rare branch from a busy activity |
| `--object-type item` | Re-project onto a different case notion — no re-import |
| `--calendar Europe/London` | Measure arc delays in working hours rather than wall-clock |
| `--json` | Full DFG plus the process tree, for a UI to render |

### Verified against a real benchmark

Run against [BPI Challenge 2012](https://doi.org/10.4121/uuid:3926db30-f712-4394-aebc-75976070e91f)
— 262,200 events, 13,087 loan applications, the canonical public log:

```bash
node examples/fetch-bpic2012.mjs      # downloads + verifies md5
node --max-old-space-size=8192 packages/cli/dist/bin.js \
  import examples/data/BPI_Challenge_2012.xes.gz --store examples/data/bpic12.duckdb
malkom-mining discover --store examples/data/bpic12.duckdb --lifecycle complete --threshold 0.05
```

Imports in ~77 s, recovering all 262,200 events, 13,087 traces, 24 activities
and both case attributes — figures that match the published dataset exactly.
Raw, it discovers a flower model and says so, which is correct: BPIC 2012 is a
famously unstructured log. Filtered, the four-phase loan process emerges.

Running it found two bugs that every synthetic fixture had passed, both now
regression-tested:

- **Lifecycle case.** XES specifies lowercase transition names; real logs ship
  `SCHEDULE`/`START`/`COMPLETE`. A case-sensitive tie-break matched none of
  them, so same-instant events kept arbitrary order.
- **Header vs. data.** BPIC 2012 declares no global `org:resource` but supplies
  one on 244k of 262k events. Trusting the header reported the organizational
  perspective as unavailable when it was fully available.


## Analysis

Four perspectives on a mined log, and a set of views over them. All read the
same event log and run as aggregate SQL — no event rows cross into Node.

Every one of the views below is reachable over HTTP; the engine serves **44
routes** and `GET /v1` lists them with their parameters.

```bash
malkom-mining performance --store log.duckdb --sla 2592000
malkom-mining variants    --store log.duckdb --top 20
malkom-mining resources   --store log.duckdb
malkom-mining conformance --store log.duckdb --model intended.json
```

### Performance — where the time goes

Splits elapsed time into **waiting** and **handling**, because total cycle time
cannot tell you what to do. Work that spends its time being handled needs
capacity or a simpler task; work that spends its time waiting needs different
routing. Bottlenecks are ranked by **total** contribution, not worst single
instance — an arc that waits ten minutes fifty thousand times costs more than
one that waits three weeks twice.

```
  cycle time   median 19.4h   p90 30.5d   max 91.5d
  SLA          1,393 of 13,087 breached (10.6%), median overshoot 23.8h

where the time goes (worst first)
   37.3%  42059.4d  W_Nabellen offertes → W_Nabellen offertes   (13,521x, median 1.9d)
          work sits idle between these two steps — look at routing, batching
          and queue length, not at headcount
```

Percentiles, not just means: cycle times are heavily right-skewed and a mean
describes almost no real case.

### Working hours — the clock the answer is measured on

Wall-clock time makes a Friday-evening handover look like a sixty-two hour
delay, which outranks a genuine bottleneck that costs four hours every day of
the week. Nobody was slow over the weekend; the office was shut.

`--calendar` measures every duration in working time instead — waiting,
cycle time, arc delay, handover cost, the case timeline, and the duration
filter, which selects on the same clock it reports on.

```bash
malkom-mining performance --store log.duckdb --calendar Europe/London
malkom-mining cases       --store log.duckdb --calendar 'Asia/Kolkata@09:30-18:00'
malkom-mining variants    --store log.duckdb --calendar 'Europe/London;2026-12-25'
```

| Form | Means |
|---|---|
| `Europe/London` | IANA zone, 09:00–17:00 Monday to Friday |
| `Europe/London@8-16` | Other hours (`@09:30-18:00` for minutes) |
| `Europe/London@9-17/mon-sat` | A six-day week |
| `Europe/London/mon,wed,fri` | Named days |
| `'Europe/London;2026-12-25'` | Closed on these dates — quote it, the `;` is a shell metacharacter |

The zone is required and has no default: a calendar with no zone is a calendar
in whichever zone the server happens to sit in, and the same log would then
measure differently in Mumbai and Frankfurt.

Off unless asked for, and **every result says which clock produced it** —
`meta.clock` over HTTP, a line above the table on the terminal. Eight working
hours and eight wall-clock hours are different measurements, and a reader who
cannot tell them apart will compare one against the other.

### Variants — which paths people actually take

```
  distinct paths   4,336
  80% of cases     covered by 1,719 paths
  one-off paths    3,727 (3,727 cases)
```

That middle number is the most telling thing about a process: 3 means
standardised, 1,719 means it is not. The tail is never dropped silently — what
is not shown is rolled up and reported.

### Resources — who does the work

Workload share, **handover network** (every handover is a wait), specialisation
scored 0–1 by normalised entropy, and key-person risk where one person handles
nearly all of an activity.

If no resource is recorded, this **refuses** rather than returning zeros — "the
team did nothing" and "the log does not say who did it" are different claims.

### Conformance — reality against intent

Token-based replay against a reference model. The process tree is converted to
a real Petri net and each trace is replayed as tokens; borrowed tokens mean a
step happened out of order, leftover tokens mean the case stopped short.

Replay runs **once per distinct path**, weighted by case count — a million
cases following forty paths is forty replays, with identical results.

Two things it always tells you, because the headline number is misleading
without them:

- **How much of the log was replayed.** Rates are over replayed cases, and it
  says so when that is not the whole log.
- **Whether the model is permissive.** A flower model accepts anything and
  scores ~100% by construction. The report gives the share of the model that is
  flower, so a meaningless perfect score cannot be mistaken for compliance.

## The profiler

The engine validates a mapping instead of asking you to be sure of it. Bind a
source and the profiler reports what is actually there — two aggregate queries,
no event rows transferred.

It catches the mistakes that otherwise become a confidently wrong map:

| Finding | Meaning |
|---|---|
| `SINGLE_ROW_CASES` **error** | every case is one row — the case key identifies rows, not business items |
| `MOSTLY_SINGLE_ROW_CASES` | over half of traces have no transitions |
| `INVERTED_INTERVALS` **error** | rows ending before they start; the pair sorts backwards and manufactures a transition |
| `NULL_CASE_KEY` | rows that correlate to nothing and are excluded from every trace |
| `NULL_TIMESTAMP` | events that cannot be placed in the trace |
| `SINGLE_ACTIVITY` | the classifier collapsed; a map would show nothing |
| `HIGH_ACTIVITY_CARDINALITY` | past a few hundred activities a map is a hairball |
| `NO_RESOURCE_ROLE` | the organizational perspective is unavailable |

Every finding carries a `remedy`. Configuration mistakes surface as data, not
as a support ticket.

```ts
import { profileBinding, profileIsUsable } from '@malkom/mining-core';

const profile = await profileBinding(client, dialect, binding, { caseObject: 'booking' });
if (!profileIsUsable(profile)) {
  for (const f of profile.findings) console.error(f.code, f.message, f.remedy);
}
```

---

## Architecture

```
Tier 1 — extraction    host DB (Postgres), read-only, filters pushed into SQL
                            ↓
Tier 2 — analytics     DuckDB + Parquet, one file per stream, persistent disk
                            ↓
Mining core            pure TypeScript over an aggregated DFG
                            ↓
                       JSON · PNML · BPMN 2.0 · XES · Parquet → host renders
```

Engine control state — stream definitions, coverage records, job history —
lives in Postgres. Analytics data lives in DuckDB. No overlap.

### Storage: built-in or bring-your-own

Both are first-class. The engine never closes a connection it did not open.

```jsonc
// built-in: the engine manages one DuckDB file per stream
{ "mode": "builtin", "directory": "/var/lib/malkom/streams",
  "duckdbOptions": { "memory_limit": "4GB" }, "maxTotalBytes": 0 }

// bring-your-own: the host already runs DuckDB
{ "mode": "host", "connectionRef": "analytics", "schema": "malkom_mining" }
```

A host holding a live connection can hand it over directly:

```ts
registry.provide('analytics', wrapDuckDBConnection(myConnection), 'duckdb');
```

The trade is worth stating: `builtin` gets per-stream file isolation for free —
deleting a stream is deleting a file, and two streams refresh in parallel. A
shared host database puts every stream in one catalog under one writer, so
refreshes serialise.

**One writer per DuckDB file.** The materialisation worker owns writes; readers
open `{ access_mode: 'READ_ONLY' }`. Two writers on one file is a corruption
path the engine cannot detect for you.

---

## Connecting — the engine borrows your connection

**Give the engine a live connection, not a connection string.** It never sees a
username, a password or a token:

```ts
import { fromPrisma, fromPgPool, fromQueryFunction } from '@malkom/mining-core';

registry.provide('ops', fromPrisma(prisma), 'postgres');   // your Prisma client
registry.provide('ops', fromPgPool(pool), 'postgres');     // your pg Pool
registry.provide('ops', fromQueryFunction(myRunner), 'postgres');  // anything else
```

Whatever you already authenticate with — a pooled connection, a rotating IAM
token, a client certificate, a unix socket, a cloud proxy — the engine inherits
it. Whatever your connection can read, the engine can read, and nothing more.
Revoke your access and the engine's is revoked in the same instant.

Where that connection points is **your** decision — production, a replica, a
restored backup, a warehouse. The engine reads what it is pointed at.

A DSN in an env var still works, for standalone use like the CLI where there is
no host process to borrow from.

## What you have to give the engine

`hostRequirements()` returns this at runtime, so nobody has to read the source:

| | Required | What |
|---|---|---|
| `connection` | ✅ | A live SQL connection (above) |
| `from` | ✅ | Which table — or which tables, and the keys that join them |
| `grain` | ✅ | `event`, `interval`, or `snapshot` |
| `roles.case` | ✅ | The column whose value **repeats** across one business item |
| `roles.activity` | ✅ | The column(s) naming what happened |
| `roles.timestamp` *or* `start`+`end` | ✅ | When it happened |
| `roles.resource` | — | Who did it. Absent → no organizational perspective |
| `roles.duration` | — | Handling time, so waiting and working stay separable |
| `objects` | — | Other objects a row relates to, for re-pivoting |
| `attributes` | — | Extra columns to carry |
| analytics store | ✅ | A directory for DuckDB files, or your own DuckDB connection |

## Refreshing a stream

A stream's DuckDB file persists, so a refresh asks your database only for what
the file does not already have — **forward** for newer data, and **backward**
when a request reaches further into the past than anything materialised.

```ts
const result = await refreshStream({
  hostClient, hostDialect, storeClient, storeDialect,
  stream, coverage, window: { from, to },
});
// result.queries === 0 when everything was already there
```

| Already have | You ask for | Queries issued |
|---|---|---|
| Jan–Jun | Feb–Apr | **none** |
| Jan–Jun | Jan–Sep | Jul–Sep only |
| Mar–Apr | Jan–Apr | Jan–Mar only |
| anything | after a role was remapped | full rebuild — old rows mean something else now |

`previewRefresh()` reports the row and event counts first, using aggregate
`COUNT` queries. Nobody should discover the size of an extraction by waiting
for it.

Two safeguards worth knowing: a re-fetched window is **deleted before it is
rewritten**, so a row deleted upstream cannot survive forever in the log; and a
slice too dense to hold in memory is **halved and retried** rather than paged
with `OFFSET`, which degrades on large tables and can skip rows if the source
shifts under a long read.

## Setup

```bash
npm install @malkom/mining-core
npm install pg                  # only if binding Postgres sources
npm install @duckdb/node-api    # only if using the analytics store
```

Both drivers are loaded through `import()` at first use, so a host that only
mines Postgres never installs DuckDB, and a missing driver produces
`npm install pg`, not a stack trace.

`pg` is declared an optional peer. **`@duckdb/node-api` deliberately is not**,
and the reason is recorded here because the omission looks like a mistake:
every version that package has published carries a prerelease tag
(`1.5.5-r.4`), and semver matches a prerelease only against a comparator
sharing its exact `major.minor.patch`. So `>=1.3.0` matches none of them — and
neither does `*`. Any range declared there is unsatisfiable, and `npm install`
ends in `ETARGET` before a line of engine code runs.

Nothing is lost by dropping it. `createDuckDBClient` checks for the API it
actually calls when it loads the driver, which is a stricter test than a
version string and one that cannot go stale. `test/packaging.test.ts` holds the
invariant that would have caught it: a peer range must admit the version this
repository itself installs.

```ts
import { ConnectionRegistry, streamDefinitionSchema, validateStream } from '@malkom/mining-core';

const registry = new ConnectionRegistry({
  profiles: [{ id: 'ops', dialect: 'postgres', env: 'OPS_DATABASE_URL', config: {} }],
});

const stream = streamDefinitionSchema.parse(definition);
const result = validateStream(stream, { knownConnections: new Set(registry.ids()) });
for (const w of result.warnings) console.warn(w.path, w.message);
```

Configuration never carries a raw secret — profiles reference an env var or a
secret-store pointer, resolved at use time.

---

## Data streams

A stream is a named, saved, reusable extraction. The engine stores the
definition, materialises the data, and mines against it — tracking not just
what a stream is *defined* as but which slice it **actually contains**, its
coverage.

| Host asks for | Against coverage | Engine does | Cost |
|---|---|---|---|
| Feb–Apr | inside Jan–Jun | serve from the stream file | zero fetch |
| Jan–Sep | extends Jan–Jun | fetch Jul–Sep, append | delta only |
| adds `queue = Booking` | narrows | filter within the file | zero fetch |

The practical effect is that exploratory use is almost entirely cache hits.

`filterFingerprint()` covers bindings, roles and filters but **excludes the time
window** — widening a window appends rather than invalidating, while remapping a
role changes what already-materialised rows mean and correctly invalidates.

---

## Host prerequisites

Third parties adopting the engine need these. The engine says so plainly when
they are absent.

| Requirement | Necessity | Without it |
|---|---|---|
| One `event` or `interval` source | mandatory for control flow | performance + organizational still work; the map is refused |
| A case key repeating across rows of one item | mandatory | every row is a one-step case — the profiler flags this at bind time |
| Trustworthy timestamps (UTC or a declared zone) | mandatory | ordering is wrong, so the map is wrong |
| A resource column | optional | organizational perspective unavailable |
| Snapshot sources for case attributes | advised | you see the paths but not what distinguishes them |
| Persistent disk for stream files | operational | every deploy forces a full re-mine |

---

## Design rules

- **TypeScript, strict, fully typed.** `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess` on. Every config type is a `z.infer` output, so no
  hand-written type can drift.
- **No raw-SQL escape hatch.** Bindings arrive from admin UIs and API callers.
  Data travels as bound parameters; identifiers pass an identifier regex and
  then the dialect's quoter.
- **The engine owns no host schema.** Read-only, no triggers, no views.
- **ORM-free core.** Prisma belongs to the runtime.
- **Honest output.** Every result declares what it is based on and what it
  could not determine.

## Tests

```bash
npm test
```

752 tests, run against a **real DuckDB** rather than mocks — the coercions being
checked only exist because the real driver behaves that way. `COUNT(*)` comes
back as a `bigint` from DuckDB and as a decimal *string* from node-postgres;
DuckDB's binder rejects a JS `Date` outright. A stub would pass while the
generated SQL was invalid, which is exactly what these tests exist to catch.

The miner's tests are **known-answer**: each fixture encodes a process decided
in advance (sequence, choice, concurrency, loop), so the assertions check a
correct answer rather than detecting change. `real-world-quirks.test.ts` holds
the regressions BPIC 2012 exposed.

Where a calculation exists twice it is checked against itself.
`calendar.test.ts` runs the working-hours arithmetic in TypeScript and the SQL
transcription of it over the same instants across four calendars, because a
transcription error there does not fail — it produces a number that looks like
a duration and is wrong one day in seven.

The Postgres suite runs against a live server when one is configured, and skips
otherwise:

```bash
MALKOM_TEST_PG_DSN=postgres://user:pass@localhost:5432/postgres npm test
```

## Roadmap

- [x] Configuration, role mapping, grain model, object links
- [x] Two-tier SQL layer, Postgres + DuckDB dialects, optional drivers
- [x] Validation, fingerprints, the profiler
- [x] Canonical event log; coverage arithmetic for reuse
- [x] Offline mining — CSV and XES (`.xes`, `.xes.gz`) import
- [x] Directly-follows graph in SQL, then the Inductive Miner
- [x] Joined sources — a binding can span several tables
- [x] Reading from the host database, with forward/backward incremental refresh
- [x] Performance — waiting vs handling, bottlenecks, SLA
- [x] Variants — ranked paths, 80% coverage, long tail
- [x] Organizational — handovers, workload, specialisation, key-person risk
- [x] Conformance — process tree to Petri net, token replay, escaping-edges precision
- [x] Comparative, with Mann–Whitney U, Cliff's delta and Benjamini–Hochberg
- [x] Interchange: PNML, BPMN 2.0, XES
- [x] elkjs layout, computed server-side and cached
- [x] Case explorer — a page of cases, and one case step by step
- [x] Dependency strength — a real ordering told apart from a coincidence
- [x] Footprint — ordering relations as a grid, and what changed between two logs
- [x] Rare-step grouping — collapse the quiet steps into openable boxes rather
      than hiding them, so a simplified map still says what it is not showing
- [x] Working-hours clock — every duration measurable in working time, with the
      clock stated on every result
- [x] Optimal alignments — a deviation has a place, not only a score
- [x] Trace clustering — a long variant tail collapsed into behaviours
- [x] When and where: weekday/hour and calendar grids, queue formation, rosters
- [x] Flow: work in progress by stage, Little's law as a check, open-case aging
- [x] Trends with process behaviour limits; conformance as a line
- [x] Grouped distributions, repeat and skill grids, performance spectrum,
      prefix tree, alluvial, trace fingerprints, delta map, risk ranking
- [ ] Predictive: Kaplan–Meier remaining time; ONNX behind a port
- [ ] Compliance rules: four-eyes, segregation of duties, precedence
- [ ] Split Miner, reported beside the Inductive Miner with both scores shown

## Licence

MIT
