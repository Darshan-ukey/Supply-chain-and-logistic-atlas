# S8-5B — ATL-167 Bounded Successor Remediation (LTL-04 public-safe Deepen / Inspect)

Base: S8-5A final evidence head `f8dc6c3863bc7310d8d83addf2d6ff1b6d34e12f` (tree `b2fa339ac2ce1c6410a623978c2cfcf4dc3ce0aa`). Branch `s8-5b-atl167-ltl04-public-safe-deepen`.

This stage supersedes the earlier S8-5B premise that LTL-04 was materialized in the ATL-157 public execution-depth projection. It is not: `/api/atlas?action=execution-depth-projection` for `road-ltl / 1.5 / LTL-04` returns `404 Task is not materialized in registered projection source: LTL-04`, which is correct current behaviour and is left unchanged. LTL-03 remains the only materialized ATL-157 proof scope.

## What was built (bounded; existing-knowledge lookup only)

1. **New bounded API action `governed-depth-summary`** (`lib/projections/governed-depth-summary.js`, `lib/api/governed-depth-summary.js`, one registered route in `api/atlas.js`).
   - Read-only, fail-closed, allowlisted to the exact tuple `road-ltl / 1.5 / LTL-04`. Not a generic depth endpoint; `execution-depth-projection` semantics are not overloaded.
   - Derived deterministically from the existing public, non-reconstructive S8-3B..3E evidence summaries, reusing the S8-4 lineage validator / view-model (no duplicate truth path) plus exact identity pins (WD `fcc3e6cf…`, package `6324ff24…`, readiness `c2d2e9ee…`, projection `703f3a5b…`).
   - Never researches, enriches, compiles, resolves binding or knowledge gaps, promotes readiness or writes canonical state; never reads protected artifacts.
   - Refuses: other task (incl. LTL-03, no fallback), other version (incl. Road 1.4), other module, incomplete scope (400/404); protected-content parameters (403); unknown parameters (400); non-GET (405); unavailable/malformed evidence (503); lineage/readiness/package mismatch or any promotion claim (409).
2. **New Deepen / Inspect interaction module** `assets/atl-167-v15-deepen-inspect.mjs`: builds only the exact-tuple request, validates the response strictly (fail-closed on unavailable API, non-OK, malformed, scope/identity mismatch, protected content, promotion), renders the governed state exactly (PARTIAL, BLOCKED, CLIENT_BINDING_REQUIRED, NOT_INDEPENDENTLY_PROVEN …), and shows the fixed context `road-ltl@1.5 / LTL-04` adjacent to the certified Ask link and the Trace link.
3. **Minimal additive integration point:** `assets/atl-140-v15-journey.mjs` imports the module, appends its control to the existing journey panel, and passes the fetch implementation to the wiring. `execution/ui/runtime-access-shell.js`, the certified root `index.html`, Canvas, the bridge, Ask, Daughter and the consumer page are byte-identical to the predecessor.

## Changed-path classification (vs the exact S8-5A head)

| Category | Paths |
|---|---|
| New bounded LTL-04 public-safe API/projection | `lib/projections/governed-depth-summary.js`, `lib/api/governed-depth-summary.js` |
| Router registration (one line; top-level function count stays 8) | `api/atlas.js` (modified) |
| Minimal additive S8-5B interaction integration | `assets/atl-167-v15-deepen-inspect.mjs` (new), `assets/atl-140-v15-journey.mjs` (modified) |
| ATL-167 successor tests | `tests/s8-5b-atl167-ltl04-deepen.test.mjs`, `tests/s8-5b-support/*` |
| Evidence / governance | `governance/product/S8_5B_ATL167_LTL04_DEEPEN.md`, `governance/product/s8-5b-evidence/*` |

No other product, runtime, release, data, schema, workbook or prior-evidence path changed.

## S8-5B successor interaction identity (prior-stage identity rule)

`api/atlas.js` (donor-pinned in S8-4 provenance) and `assets/atl-140-v15-journey.mjs` (pinned in the S8-3F manifest) legitimately change identity. This is a **new S8-5B successor identity**, recorded in `s8-5b-evidence/successor-identity.json` (predecessor blob → successor blob). S8-4 remains PASS at its exact tested commit `07a41138…`; S8-3F remains PASS at `67c80d51…`; the S8-3F manifest is a **predecessor** manifest and is not regenerated or edited. S8-6 finalizes the successor manifest. No predecessor test or evidence file was edited or weakened. Expected successor-only failures of predecessor suites (stage-local exact identity/scope): S8-4 D01 (api/atlas.js donor pin) and S01–S03; S8-3F manifest regeneration / verifier / derivative-pin / recovery-identity cases and its scope guard.

## ATL-167 requirement → current surface

| Governing step | Current surface |
|---|---|
| Root/Canvas | certified root + Canvas (unchanged) → runtime shell → S8-4 journey panel |
| Governed Daughter/process/task | Daughter link built by the certified bridge for `road-ltl@1.5 / LTL-04` (LTL-04 Daughter/Ask stays fail-closed 404 by design) |
| Inspect / Ask / Trace | Deepen/Inspect panel (governed state); certified Universal Ask 2.0.1 linked with the exact context adjacent; Trace link to the corrected S8-3E public flow evidence |
| Deepen this scope | `Deepen this scope / Inspect` → `governed-depth-summary` (exact tuple) |
| Work semantics / WD, readiness / binding | summary: WD identity (protected), PARTIAL, 5/1/4 leaves, 2+2 blockers, BLOCKED, 1 unresolved binding |
| Malkom requirement coverage / package / export | summary coverage rows + package/projection identities; S8-4 Malkom consumer link |

## Historical obligation → current surface (from the S8-5A BLOCKED record)

O1 eight-step journey → distributed across the surfaces above (not one page). O2 lineage identifiers → summary lineage block (corrected identities). O3 flow link → Trace link (corrected S8-3E public evidence; stale explorer not restored). O4 root links slice → NOT restored; reachability is through the existing journey (root byte-identical). O5 in-page Ask → certified Universal Ask 2.0.1 linked with context (not re-implemented). O6 public/admin toggle → not recreated; public-safe projection with protected state failing closed (403/409). O7 binding fail-closed → `CLIENT_BINDING_REQUIRED` enforced client- and server-side. O8 accessibility → button/region/alert semantics tested.

## PASS meaning

If the QA passes: ATL-167 bounded v1.5 same-context interaction capability restored using a public-safe projection of existing LTL-04 governed depth. It does NOT mean LTL-04 ATL-157 materialization, runtime/release readiness, ATL-71 or F-130-06 closure, S8-5 completion, S8-6 readiness or deployment authorization.

## Residuals

- The Daughter and Ask surfaces still fail closed (404) for LTL-04; Ask receives the context only as an adjacent, surfaced link (no hidden persistence).
- `governed-depth-summary` reads the public evidence summaries from the function filesystem (same pattern as the existing projection); deployment bundling is not verified here.
- Predecessor exact-identity cases fail on the successor by design (listed above); the S8-3F manifest needs regeneration at S8-6.
- Inherited: `/api/release-integrity` baseline drift, rollback/deployment identities NOT_ESTABLISHED, superseded Ask copies under `release/packages`, pre-existing failures (`v2-ui-browser-smoke`, `v1.1.4-static-parity`), Node 22 vs engines 24.x, DEF-DAU-007.
- Not done: S8-6, ATL-181, ATL-71, F-130-06, merge, deploy, workbook edits.
