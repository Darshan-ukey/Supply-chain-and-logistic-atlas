# Contributing

## Setup

```bash
npm install
npm run build   # tsc -b composite projects (core → server/cli)
npm test        # vitest
```

Node ≥ 22.5 is required (built-in `node:sqlite`).

## Ground rules

- **No hardcoding of host schemas.** Everything the engine knows about a backend arrives via declarative config or a port implementation. If a change needs a host-specific assumption, it belongs in an adapter, not the core.
- **Strategies are pure functions.** No I/O, no clocks, no randomness inside `allocate()`. Persistent state goes through `stateAfter(appliedItemIds)`.
- **Every write is guarded.** New write paths must be conditional (compare-and-swap) and treat lost races as normal outcomes.
- **zod schemas are the single source of truth.** Never hand-write a type that duplicates a schema; export new config surface through `config/schemas.ts` and it appears in `/v1/schema/*` automatically.
- **Keep the footprint small.** New runtime dependencies need a strong justification; prefer Node built-ins.
- Strict TypeScript (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) — fix types, don't cast around them.

## Tests

`packages/core/test/` — unit tests plus a real SQLite end-to-end (`sqlite-e2e.test.ts`) that exercises bindings, guarded claims, audit, dry-run, and release against actual host tables. New behavior needs a test at the same level of realism.
