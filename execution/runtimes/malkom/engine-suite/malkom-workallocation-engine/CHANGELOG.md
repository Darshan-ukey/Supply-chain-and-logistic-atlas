# Changelog

## 0.1.0 — 2026-08-12

Initial release.

- `@malkom/alloc-core`: metadata-driven allocation engine — declarative queue/worker bindings (zod-validated, JSON Schema exported), FilterExpr AST (no raw SQL in config), guarded conditional claims, per-queue croner scheduling (cron + interval, IANA timezones, jitter), lease-based single-writer runs with fencing tokens, intents-before-apply audit trail, strategies `fifo` / `round_robin` / `least_active` + custom registry, eligibility matching rules, capacity + count-open-items load, stale-work sweep + release verb, schema-drift auto-pause, three-tier validation, dry-run with exact SQL, Prometheus + JSON metrics with retention/delete endpoints, SQLite (`node:sqlite`) + in-memory state stores, SQLite/Postgres/MySQL dialects (pg/mysql2 optional), in-memory reference adapter, web-standard control-plane router.
- `@malkom/alloc-core` (workEvents): optional batteries-included default work table — idempotent provisioner (`engine.provisionWorkEvents`, `POST /v1/connections/:id/provision-work-events`, `malkom-alloc provision`), `workEventsBinding` factory, `workEventsOpenLoad` load spec (completion frees capacity). System-of-record convention: never a mirror, no engine-installed triggers.
- `@malkom/alloc-core` (observability): `GET /v1/runs/summary` server-side run-log aggregation (by status + per queue, avg duration); coverage watchdog — `engine.coverage()` / `GET /v1/coverage` / `malkom-alloc coverage` report unallocated work with no enabled queue definition (`malkom_unconfigured_items` gauge, optional periodic self-scan).
- Docs: `docs/FRONTEND-GUIDE.md` — screen-by-screen front-end integration spec for developers and AI agents.
- `@malkom/alloc-server`: standalone control plane over `node:http`, env-configured, API-key scopes.
- `@malkom/alloc-cli`: ops CLI as a pure REST client.
