# S8-3F — Governed Release Manifest Regeneration

**Status of this document:** implementation record. S8-3F PASS means **manifest/regeneration correctness only**. It does **not** mean release readiness, rollback readiness or runtime readiness. The canonical workbook is not modified by this stage; ChatGPT reconciles and records the stage outcome.

## Authority
`S7-IMP-013`, `S6-LIN-020`, PA-5 `REGENERATE_DERIVATIVE`, sequence `SEQ-08`. Branch base is the exact S8-4 final evidence head `3ead8bd108c349ba2149063d39376c8d2a04c2f3` (SEQ-08: the manifest is regenerated after corrected generated outputs and presentation/interaction assets).

## What this stage is
A **regeneration**, not a transplant. `lib/release/s8-release-manifest.js` is a deterministic generator/verifier: the manifest is a pure function of the pinned registry in that module and the repository tree. `scripts/s8-3f-release-manifest.mjs` writes (`--write`), verifies (`--check`) and reproduces protected identities (`--reproduce`). Nothing is copied from the historical ATL-175/ATL-141 manifest.

Output: `release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json`, schema `atlas-v1.5-release-manifest-v2.0-s8`.

## Lineage closure
source/frozen donor → generator → corrected output → presentation/interaction → release, every entry checked **exact** (expected vs observed, `MATCH`/`MISMATCH`/`MISSING`):

* governed Road LTL source (`662c7847…`, `data/modules/road-ltl-v1.4.json` blob `d06974e9…`, task hash `b0bee64f…`), corrected operational semantics (`d642c1d5…`), corrected client binding (`2f532fad…`);
* frozen contracts/schemas/standards and frozen S8-2E compiler/verifier donors (blob pins);
* S8-3B–3E generators and the eight accepted derivatives (full SHA-256: WorkDefinition, package, readiness, projection, graph, Flow, BPMN, SVG);
* the S8-3B–3E and S8-4 public QA evidence files (tested commit, tested tree, evidence SHA-256);
* the S8-4 successor identity (final head, tested commit, tested tree, QA SHA-256) and the certified Canvas V2.0, bridge V2.0.1 and Universal Ask 2.0.1 donor assets plus the ATL-140 behavioural delta, each by git blob.

## Protected artifacts
The eight corrected derivatives are `EXECUTION_PROTECTED`. The manifest pins **identity/hash, classification, lineage and custody/reproduction mechanism only**; no bytes, no path, no reconstructed content. The test suite reproduces each hash from the governed lineage (`reproduceProtectedIdentities`) and scans the tracked tree for protected bytes.

## Historical / stale identities
ATL-140 root index (`9cf88a86…`), ATL-142 root index (`379f988c…`), ATL-142 commit (`dba6968b…`), the superseded ATL-142 Ask API (`cb2bcfea…`), the stale generated/presentation blobs from the historical manifest, and the stale WorkDefinition id marker are recorded in `exclusions` as `currentAuthority:false` and must be absent from the tree (the superseded Ask blob is allowed only at the two inherited release-package paths, see residuals).

## Release controls (retained ATL-175 mechanism; historical content is evidence only)
* `ownerGateRequired = true`; `productionPromotionAuthorized = false`; release **DO NOT MERGE**.
* Exact identity verification; mismatch fails closed; no implicit multi-generation negotiation; no frozen-asset mutation.
* Verification endpoints `/api/version`, `/api/readiness`, `/api/release-integrity`.
* Runtime state is unchanged and not promoted: `universalExecutionReady=false`, `materializable=false`, `NOT_INDEPENDENTLY_PROVEN`, client binding `CLIENT_BINDING_REQUIRED`, knowledge gaps `BLOCKED`.

## Rollback representation (per the authority resolution)
Five things are kept distinct:
1. rollback **mechanism** — `ESTABLISHED` and retained (`release/RELEASE_CONTRACT.md`, `release/ROLLBACK_RUNBOOK.md`, identity-pinned);
2. **historical** rollback evidence — ATL-175 `v1.1.8-critical-hashes.json` (blob `98296aa2…`) retained as `HISTORICAL_ROLLBACK_CONTROL_EVIDENCE`, **not imported**, not current authority;
3. current successor rollback **target** — `NOT_ESTABLISHED` (`currentSuccessorRollbackTarget: null`);
4. **deployment** rollback identity — `NOT_ESTABLISHED` (none inferred or fabricated);
5. production promotion — prohibited while 3/4 are unresolved or the Owner gate is unexercised.

A missing rollback identity is explicitly *not* "rollback not required", *not* "the candidate is its own rollback", *not* "ATL-175 automatically governs", *not* "the latest baseline is acceptable", and *not* readiness. ATL-141 blob `02a3e9e2…`, `v1.1.7`, `v2-critical-hashes.json` and any deployment are not nominated.

Recovery evidence is the set of git-content-addressed artifacts (`rollback.recoveryEvidence`), each re-verified against the tree.

## Release-integrity side finding (residual, not repaired)
`/api/release-integrity` verifies `release/baselines/v2-critical-hashes.json` (blob `1c4e7f34…`, 44 files). 12 files drift: 11 already at the S8-3E base `fe17ebb5` (and at RC1) and `lib/api/admin-workdefinitions.js`, introduced by the S8-4 donor import. The endpoint therefore fails closed (HTTP 500). S8-3F neither repairs the baseline nor weakens the verifier; the manifest records `FAILS_VERIFICATION`, `certified:false`, and never certifies the baseline.

## Residuals
* **Inherited superseded Ask copies** at `release/packages/{lab,stable}/lib/api/ask-atlas.js` (blob `cb2bcfea…`) — detected and recorded as `UNRESOLVED_SUCCESSOR_ASSEMBLY_CLEANUP`, `representsCurrentCertifiedAsk:false`; cleanup belongs to S8-6. Release packages are not modified (the suite asserts no diff against the S8-4 base).
* Release-integrity baseline drift (above); rollback and deployment identities `NOT_ESTABLISHED`.
* S8-3B QA evidence hash recording discrepancy (workbook row `36d18ec3…` vs committed file hash) — the committed file identity is pinned; reconcile in the workbook.
* DEF-DAU-007 remains open (out of scope); Node v22 used for QA vs repository engines 24.x.
* The ATL-175 release-status UI and release-contract JSON are not ported; their mechanism content is embedded in the manifest `controls`/`rollback` sections, and the historical files are retained as evidence blobs.
* A PR to `main` carries stacked, unmerged S8 predecessors (S8-3A…S8-4) and is **not** standalone merge authority.

## Not done (by design)
No successor RC (S8-6), no S8-5, no deployment, no merge, no workbook edits.
