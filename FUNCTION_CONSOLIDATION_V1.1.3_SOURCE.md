# Function Consolidation v1.1.3

## Why

Vercel's Hobby plan allows a maximum of **12 Serverless Functions per deployment**.
Every `.js` file under `/api` counts as one function. v1.1 shipped 35 files there
(28 endpoints + 7 shared libraries), so deployment failed.

This release solves that as a **packaging** problem. No endpoint, no API behaviour
and no UI capability was removed to fit the limit.

## What changed

| | v1.1 | v1.1.3 |
|---|---|---|
| Files in `/api` | 35 | **8** |
| Serverless functions deployed | 28+ | **8** |
| Endpoints available | 28 | **28** |
| Public API paths | 28 | **28** (unchanged) |
| Canonical model data | — | **byte-identical** |

### 1. Handlers moved out of `/api`

All 28 endpoint handlers and 7 shared libraries moved to **`lib/api/`**.
Vercel only treats files inside `/api` as functions, so nothing in `lib/`
is deployed as one. Handler source is unchanged apart from two relative
require paths (`../engine/…` → `../../engine/…`).

### 2. Eight routers added

| Function | Endpoints absorbed |
|---|---|
| `api/auth.js` | auth-login, auth-logout, auth-session, auth-signup |
| `api/workspace.js` | workspaces, client-state, saved-views, audit |
| `api/documents.js` | documents, document-ingest, document-facts, evidence-upload, session-document-ingest, session-fact-confirm |
| `api/system.js` | health, version, config, readiness, pilot-readiness, release-integrity, llm-status |
| `api/atlas.js` | ask-atlas, command-validate |
| `api/collab.js` | collaboration, telemetry |
| `api/transform.js` | transformation-export, foundation-proposals |
| `api/evaluation.js` | pilot-evaluation |

Each router uses the shared dispatcher in `lib/api/_router.js`, which resolves
the target handler from `?action=` and falls back to the final URL path segment.
Handlers are required lazily, so one failing endpoint cannot take down the
others in its group. Unknown actions return a 404 JSON body listing the
available actions in that group.

### 3. Backward-compatible rewrites

`vercel.json` maps all 28 original paths to their router:

```json
{ "source": "/api/auth-login", "destination": "/api/auth?action=auth-login" }
```

Rewrites are not functions and do not count against the limit. **No frontend
code changed** — `assets/app.js` and the stage17–21 client API maps keep
calling the same URLs they always did.

### 4. New regression test

`tests/function-consolidation-smoke.mjs`, wired into `npm test`, asserts:

- function count stays at or under the Hobby limit of 12
- exactly 28 legacy rewrites exist, with no duplicates
- every rewrite destination resolves to a router that declares that action
- all 28 handler modules load and export a callable function
- the dispatcher resolves actions from both query string and path
- unknown actions return 404 JSON rather than throwing

This turns "did we exceed the plan limit" into something CI catches instead of
something a failed deploy tells you.

## Verification

All suites run clean on this package:

```
npm test                  40 checks PASS (incl. 10 new consolidation checks)
npm run build             PASS · 30 required artifacts + JavaScript syntax
npm run reaudit           PASS · Foundation Hardening v1.1 release validation
npm run release:smoke     PASS · release lineage + foundation smoke
npm run pilot:eval:offline PASS · 10/10, 0 hard failures
npm run release:packages  Lab and Stable packages rebuilt with the new layout
```

Canonical integrity re-verified after restructuring:

- `page0-v6.2.2.json` → `69872e9893703c6b1ad0…` (unchanged)
- `road-ltl-v1.2.json` → `ee1feea86c800d038c0f…` (unchanged)
- frozen Page 0 and integrated Road LTL source hashes unchanged

## Deploying

1. Commit this folder to git and tag it `v1.1.3`.
2. Import the repo in Vercel. It should now report **8 functions**.
3. Set environment variables before expecting authenticated or LLM routes to work
   (Supabase URL/keys, LLM provider config). Without them, `/api/health` and
   `/api/version` still respond; auth and document routes will fail closed.
4. Smoke test after deploy:
   - `GET /api/health` → `{"ok":true,"status":"UP"}`
   - `GET /api/version` → release lineage
   - `GET /api/atlas?action=nope` → 404 listing available actions
5. If a rewrite ever misbehaves, the direct form always works:
   `/api/system?action=health` is equivalent to `/api/health`.

## Headroom

8 of 12 functions used. Four slots remain if you later want to split a busy
group back out — for example moving `documents` onto its own function if
ingestion traffic grows.

## Not addressed in this release

The five orphaned UI layers (`stage17-client.js` … `stage21-client.js`) are still
present in the repo root and still not loaded by `index.html`. Restoring them is
a separate task; the API surface they call is now deployable, which was the
blocker. Recommended order: deploy this, confirm it is live and stable, then
re-wire one stage layer at a time.
