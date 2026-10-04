# S8-5A — Bounded Successor Retests

Status: **S8-5A PARTIAL — EXECUTABLE RETESTS PASS; ATL-167 BLOCKED PENDING BOUNDED REMEDIATION DECISION.**

PARTIAL is not release readiness. This stage adds test harnesses, fixtures, deterministic evidence and this document only. No product path, release manifest, root page, runtime, schema, data, workbook or certified artifact was modified.

Base: S8-3F evidence head `a3e2dc1687a9dd8a290645a4ed77895fb39f97e7` (tree `c591399f47247a01227dde092761c2e0f7cb5167`). Control plane (canonical workbook) rulings A/B/C were reconciled by ChatGPT; this worker only executes them.

## Ruling A — ATL-157 (bounded-depth): AUTHORIZED, PASS = compatibility only

Historical ATL-157 (`atl-157-v15-bounded-depth` @ `770ae4ab…`) materializer, contract, request fixtures and test are carried as **blob-pinned test fixtures** under `tests/fixtures/s8-5a/atl-157-historical/` (byte-identical, hashes in `PROVENANCE.json`, classification `HISTORICAL_TEST_FIXTURE_NOT_PRODUCT`). They run in an ephemeral sandbox assembled from the corrected S8 inputs (corrected operational-semantics record reproduced from the successor generators; governed provenance and source registry blobs).

PASS means only: the historical bounded-depth mechanism remains compatible with corrected S8 semantics/input lineage. It is **not** a shipped successor component; no ATL-157 product implementation exists or was introduced in the successor tree (the suite asserts the product paths stay absent).

Result: unmodified historical test passes; 6 provenanced candidates; successor output deterministic; only difference vs the historical-semantics output is the document-level `moduleVersion` (1.5 vs 1.2); candidates identical. Fail-closed negatives (conflicts, unknown/unregistered source, missing provenance, machine trigger) and fixture tamper rejection are asserted. Evidence: `s8-5a-evidence/atl-157-retest-summary.json`.

## Ruling B — ATL-167 (coherent interaction slice): BLOCKED — NO CURRENT SUCCESSOR RETEST SURFACE

Not executed, ported, rebuilt or partially claimed. Mechanically verified reasons (see `atl-167-blocked-record.json`):

- The slice page is absent from the successor tree; S8-4 records slice/explorer as "not rebound" and asserts stale pages absent; the S8-3F manifest excludes the stale slice.
- The historical test is bound to the stale WorkDefinition id / package id / earlier hash, and requires the root index to link the slice — which conflicts with the certified root blob and would require modifying the certified root.
- S8-4's exclusion is **not** an authoritative supersession. PA-5 retains ATL-167 as v1.5 REMEDIATION / RETEST_AFTER_UPSTREAM.

Status stays BLOCKED pending a bounded remediation decision by the control plane. No partial S8-4 evidence is claimed as an ATL-167 PASS; ATL-167 is not marked superseded.

## Ruling C — ATL-173 (Malkom utility proof): AUTHORIZED with corrected successor criteria

The historical counts are **not** reproduced. The utility findings are derived deterministically from the corrected package (`6324ff24…`), readiness (`c2d2e9ee…`) and projection (`703f3a5b…`), after verifying every identity against the accepted pins. An independent verifier rejects drift, promoted readiness, overstated work semantics, historical counts presented as current, removed guards/blockers and stale identities; the derived rows cross-check against the S8-4 consumer view-model/crosswalk.

Corrected state reported (counts/enums only): work semantics PARTIAL (7 required inputs, 1 action, 0 outcomes), 4 of 5 leaves not compiled, 4 knowledge-gap entries, client binding unresolved (CLIENT_BINDING_REQUIRED), endpoint REQUIREMENT_NOT_CONFIRMED, projection BLOCKED. Delta vs the historical proof: available/projectable 2 → 1, work semantics AVAILABLE → PARTIAL, outcomes 1 → 0, required inputs 4 → 7.

PASS means only: the method is deterministically applicable and truthfully reports the corrected bounded state. It does **not** mean runtime ready, universal-execution ready, materializable, utility value achieved, gaps closed or binding resolved. Evidence: `s8-5a-evidence/atl-173-successor-utility-proof.json` (public, non-reconstructive).

## Verification

`tests/s8-5a-successor-retests.test.mjs` (47 cases) plus `tests/s8-5a-support/*` helpers. Fresh-checkout QA (`s8-5a-evidence/run-exact-qa.cjs` → `exact-qa.json`) runs the inherited S8 suites, certified donor suites and the S8-4 / S8-3F suites on a fresh clone of the tested commit, compares failures to the exact S8-3F base, runs deliberate mutation tests, and verifies the changed-path scope.

Stage-scope guards: S8-4 cases S01–S03 and the S8-3F scope case compare changed paths with their own stage base and fail on any successor commit by design; they already fail at S8-3F base for S8-4 S01–S03. Predecessors are not edited; their tested commits are re-verified green in the QA run. Failure classes used: PRODUCT REGRESSION / TEST ANCHORING / ENVIRONMENT / AUTHORITY AMBIGUITY.

## Residuals

- ATL-167 BLOCKED pending bounded remediation decision.
- ATL-157 is compatibility evidence only, not a successor product component.
- ATL-173 corrected state is a downgrade vs the historical proof; no utility-value claim.
- Inherited: `/api/release-integrity` baseline drift; rollback and deployment identities NOT_ESTABLISHED; superseded Ask copies under `release/packages`; pre-existing non-gating failures (`v2-ui-browser-smoke`, `v1.1.4-static-parity`); Node 22 vs engines 24.x.
- Not done (out of scope): S8-5B, S8-6, ATL-181, ATL-71, F-130-06/ATL-107, merge, deploy, workbook edits.
