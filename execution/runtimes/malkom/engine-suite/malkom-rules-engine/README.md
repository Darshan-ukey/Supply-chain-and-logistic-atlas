# Malkom — Rules Engine

A generic, metadata-aware, embeddable business-rules engine for queues and sub-queues — the sibling of the [Malkom work-allocation engine](../malkom-workallocation-engine). **The engine owns rules and decisions, never your data**: you declare a *registry* (which entities exist, which fields mean what), authors write *rule groups* against that vocabulary, and the engine validates, backtests, activates, and evaluates them — returning verdicts, patches, and effect descriptors that *your* application executes. Everything is available as a typed library API and mirrored 1:1 on a small REST control plane.

- **Metadata-aware** — rules are written against a registry of entities and fields, not raw columns; the registry is versioned, and every activated group version pins the registry version it was validated against.
- **Evidence before activation** — tiered validation (shape → cross-reference → live schema), pairwise consistency analysis across active groups, and read-only backtests against real host rows.
- **Auditable by construction** — a draft → pending → active → retired lifecycle with an actor-stamped transition trail, immutable version snapshots, and a decision log that supports exact point-in-time replay.
- **Small footprint** — one runtime dependency (`zod`). State lives in SQLite via Node's built-in `node:sqlite` (or in memory, or behind your own `RulesStateStore`). No broker, no framework.

## Install

```bash
npm install @malkom/rules-core        # library
npm install -g @malkom/rules-server   # standalone control plane
npm install -g @malkom/rules-cli      # ops CLI
```

Requires Node ≥ 22.5 (for built-in `node:sqlite`).

## Sixty seconds, embedded

```ts
import { RulesEngine, SqliteRulesStateStore } from '@malkom/rules-core';

const engine = new RulesEngine({ stateStore: new SqliteRulesStateStore('./rules-state.db') });
await engine.start();

// 1. The registry — the vocabulary rules are written in.
await engine.applyRegistry({
  entities: [{
    id: 'booking',
    subQueueField: 'status',
    fields: [
      { id: 'shipperParty', type: 'string' },
      { id: 'portOfDischarge', type: 'string' },
      { id: 'currency', type: 'string' },
      { id: 'status', type: 'string', values: ['new', 'confirmed'] },
    ],
  }],
  valueSets: [{ id: 'region:uswc', values: ['USLAX', 'USORE', 'USNYC'] }],
});

// 2. Author a rule group — stored as a draft.
const head = await engine.createGroup({
  name: 'Shipper A — USD corridors',
  entity: 'booking',
  scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
  rules: [{
    id: 'usd-only',
    when: { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
    then: [{
      verb: 'assert',
      field: 'currency',
      check: { op: 'eq', field: 'currency', value: 'USD' },
      message: 'USD only.',
    }],
  }],
}, { actor: 'money' });

// 3. Evidence before activation.
await engine.validateGroup(head.id);              // tiered: shape, cross-reference, live schema
await engine.backtest(head.id, { sample: 500 });  // read-only replay against real host rows
                                                  // (needs the entity bound to a table + connection)

// 4. Lifecycle: draft → pending → active. WHO may approve is the host's rule;
//    the engine enforces legality and records who did what.
await engine.submit(head.id, { actor: 'money' });
await engine.activate(head.id, { actor: 'priya' });

// 5. Evaluate.
const booking = { id: 'B-7', shipperParty: 'A', status: 'new', portOfDischarge: 'CNNGB', currency: 'EUR' };
await engine.applicable('booking', { shipperParty: 'A' });  // which groups could apply?
await engine.explain('booking', booking);                   // full trace, nothing recorded
const verdict = await engine.apply('booking', booking);     // recorded in the decision log
// verdict.assertions → [{ message: 'USD only.', … }]
// verdict.patch / verdict.effects → descriptors the HOST executes — the engine never writes.
```

## Server mode & CLI

```bash
MALKOM_RULES_ADMIN_KEYS=s3cret MALKOM_RULES_STATE_DB=./state.db malkom-rules-server
```

Server environment: `MALKOM_RULES_PORT` (7071), `MALKOM_RULES_HOST` (127.0.0.1), `MALKOM_RULES_STATE_DB` (`./malkom-rules-state.db`, `:memory:` works), `MALKOM_RULES_ADMIN_KEYS` / `MALKOM_RULES_READ_KEYS` (comma-separated bearer keys — with both empty the control plane is OPEN and the server warns loudly), `MALKOM_RULES_REGISTRY` (path to a JSON registry document applied at boot).

```bash
export MALKOM_RULES_URL=http://127.0.0.1:7071 MALKOM_RULES_API_KEY=s3cret
malkom-rules registry push -f registry.json
malkom-rules groups push -f usd-corridors.json --actor money
malkom-rules groups validate <id>
malkom-rules groups backtest <id> --sample 500
malkom-rules groups submit <id> --actor money
malkom-rules groups activate <id> --actor priya
malkom-rules eval explain --entity booking -f booking.json
malkom-rules decisions list --entity booking
malkom-rules consistency
malkom-rules metrics
```

The CLI is a pure REST client — if the CLI can do it, any app can:

```bash
curl -s http://127.0.0.1:7071/v1 -H 'authorization: Bearer s3cret'   # discovery document
curl -s -X POST http://127.0.0.1:7071/v1/eval/apply \
  -H 'authorization: Bearer s3cret' -H 'content-type: application/json' \
  -d '{"entity":"booking","row":{"id":"B-7","shipperParty":"A","portOfDischarge":"CNNGB","currency":"EUR"}}'
```

JSON Schemas for every config document live at `GET /v1/schemas`. Library hosts can mount the same control plane on their own server: `buildFetchHandler(engine)` returns a web-standard `(Request) => Promise<Response>`.

## Design decisions

- **D1 — The engine never writes host tables.** Host data is read (for backtests and tier-2 validation) but never mutated; every write the rules imply comes back to the host as data.
- **D2 — Effects are host-executed descriptors.** `apply()` returns patches and effect instances describing what should happen; executing them — transactionally, with the host's own semantics — is the host's job.
- **D3 — Lifecycle is a state machine with host-wired approvals.** draft → pending → active → retired, actor-stamped and event-hooked; the engine enforces transition legality, the host decides who may transition.
- **D4 — Single runtime dependency: zod.** One schema definition yields runtime validation, TypeScript types, and exported JSON Schema; state via built-in `node:sqlite`.
- **D5 — Single-pass evaluation.** Active groups compile into a selector-indexed ruleset; a row is evaluated in one deterministic pass with a full trace, and conflicts are reported, not hidden.
- **D6 — The engine is the exclusive query surface for rule-domain data.** Groups, versions, decisions, and consistency findings are queried through typed engine criteria (and the mirrored REST routes) — never by reaching into its tables.

## Packages

| Package | What it is |
| --- | --- |
| [`@malkom/rules-core`](packages/core) | Engine facade, registry + group schemas, evaluation core, state stores, control-plane router |
| [`@malkom/rules-server`](packages/server) | Standalone server over `node:http` — no web framework |
| [`@malkom/rules-cli`](packages/cli) | Ops CLI, a pure client of the REST API |

## Development

```bash
npm install
npm run build     # tsc -b (composite projects)
npm test          # vitest
```

Requires Node ≥ 22.5. MIT © Malkom contributors
