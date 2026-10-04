# S8-6 — Pre-mutation matrix and changed-path classification

Generated from `exact-qa.json` (tested commit `78a3b7c87f24d20f07c8fdb24c0202c33f5de6c2`, tree `e29b608555af535a972eef4461ada3d4fc58d82d`, base S8-5B head `97e3086daa7b1ca694d019f0f30bb2c3150e7a6d`). Status of that run: **PASS**.
PASS means the successor RC is frozen as a candidate for ATL-181 independent audit. It is not ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness.

## 1. Pre-mutation matrix (RC filesystem mutations)

Control (unmutated tree accepted): **accepted**. Mutations: 41; detected 41; survived 0.

Each mutation is applied in a scratch git worktree (HEAD + overlay), staged, and the verifier must reject it with at least one expected failure code.

| ID | Mutation | Expected code(s) | Rejected | By expected code |
|---|---|---|---|---|
| R01-OLD-S8-4-JOURNEY-RESTORED | old S8-4 journey (2c97dbde) restored | OLD_JOURNEY_RESTORED, JOURNEY_IDENTITY_REPLACED, SUCCESSOR_IDENTITY_MISMATCH | true | true |
| R02-OLD-S8-5B-JOURNEY-RESTORED | S8-5B journey (6c11bf4c, no history registration) restored | OLD_JOURNEY_RESTORED, SUCCESSOR_IDENTITY_MISMATCH | true | true |
| R03-OLD-API-ATLAS-RESTORED | old S8-4 api/atlas.js (no governed-depth-summary) restored | OLD_API_ATLAS_RESTORED, SUCCESSOR_IDENTITY_MISMATCH | true | true |
| R04-STALE-ATL142-ROOT | stale ATL-142 root (379f988c) restored as index.html | STALE_ATL142_ROOT | true | true |
| R05-STALE-ATL140-ROOT | stale ATL-140 root (9cf88a86) restored as index.html | STALE_ATL140_ROOT | true | true |
| R06-STALE-ATL141-RC-ANCESTRY | stale ATL-141 RC commit (ef6e375c) becomes an ancestor of the RC | STALE_ATL141_RC_NOMINATED | true | true |
| R07-STALE-ATL142-CUSTODY-ANCESTRY | stale ATL-142 commit (dba6968b) becomes an ancestor of the RC | STALE_ATL142_ROOT | true | true |
| R08-SUPERSEDED-ASK-IN-TREE | superseded Ask API (cb2bcfea) restored as lib/api/ask-atlas.js | SUPERSEDED_ASK_INCLUDED | true | true |
| R09-SUPERSEDED-ASK-IN-LAB | superseded Ask API copied into the Lab package | SUPERSEDED_ASK_INCLUDED, PACKAGE_STALE_OR_DRIFTED_FILE | true | true |
| R10-ATL157-LTL04-MODULE | ATL-157 LTL-04 daughter source materialized as data/modules/road-ltl-v1.4.json | ATL157_LTL04_MATERIALIZED | true | true |
| R11-ATL157-MECHANISM-IN-PRODUCT | ATL-157 bounded-depth mechanism shipped in a product path | ATL157_LTL04_MATERIALIZED | true | true |
| R12-PROTECTED-BYTES-PUBLISHED | protected derivative bytes written into a tracked public path | PROTECTED_BYTES_PUBLISHED | true | true |
| R13-CUSTODY-REMOVED | source custody copy removed | SOURCE_CUSTODY_MISSING, SOURCE_CUSTODY_DRIFT | true | true |
| R14-CUSTODY-HASH-ALTERED | source custody bytes altered (one trailing space) | SOURCE_HASH_ALTERED | true | true |
| R15-CUSTODY-PINS-REMOVED | custody pin record removed | SOURCE_CUSTODY_MISSING, SOURCE_CUSTODY_DRIFT | true | true |
| R16-CUSTODY-DEPLOYED | custody no longer excluded from deployment (.vercelignore) | CUSTODY_NOT_EXCLUDED_FROM_DEPLOYMENT | true | true |
| R17-ROLLBACK-ASSET-ALTERED | rollback target asset (ocean-fcl-v0.5) altered | ROLLBACK_ASSET_DRIFT | true | true |
| R18-ROLLBACK-HASH-ALTERED | rollback manifest expected hash altered | ROLLBACK_HASH_ALTERED | true | true |
| R19-ROLLBACK-STALE-BRANCH | rollback manifest nominates a stale candidate branch | ROLLBACK_STALE_BRANCH_NOMINATED, ROLLBACK_TARGET_SET | true | true |
| R20-ROLLBACK-INJECTED | rollback manifest marked injected into active execution | ROLLBACK_INJECTED_INTO_ACTIVE_EXECUTION | true | true |
| R21-PROMOTION-TRUE-IN-ROLLBACK | production promotion authorized in the rollback manifest | PRODUCTION_PROMOTION_AUTHORIZED | true | true |
| R22-BASELINE-DRIFT | unreconciled drift of a baseline-covered file | INTEGRITY_BASELINE_FAILS_AT_RC | true | true |
| R23-BASELINE-REGENERATED-OVER-UNEXPLAINED-DRIFT | baseline regenerated over an unexplained post-base change (reconciliation must refuse) | INTEGRITY_UNEXPLAINED_DRIFT | true | true |
| R24-BASELINE-COVERAGE-REDUCED | baseline silently drops a covered file (waiver by omission) | INTEGRITY_BASELINE_COVERAGE_REDUCED | true | true |
| R25-BASELINE-FAILS-WAIVED-BY-RECON | reconciliation record falsified to hide drift | INTEGRITY_UNEXPLAINED_DRIFT | true | true |
| R26-LAB-STALE-FILE | stale README_DEPLOY.txt left in the Lab package | PACKAGE_STALE_OR_DRIFTED_FILE | true | true |
| R27-STABLE-FILE-DRIFT | Stable package file altered after build | PACKAGE_STALE_OR_DRIFTED_FILE | true | true |
| R28-STABLE-MISSING-HISTORY-MODULE | history module missing from the Stable package | PACKAGE_FILE_MISSING | true | true |
| R29-PACKAGE-MANIFEST-TAMPERED | Lab package manifest tampered | PACKAGE_STALE_OR_DRIFTED_FILE | true | true |
| R30-PROTECTED-EXECUTION-IN-PACKAGE | protected execution implementation copied into the Stable package | PACKAGE_STALE_OR_DRIFTED_FILE | true | true |
| R31-HISTORICAL-MANIFEST-REWRITTEN | predecessor S8-3F manifest rewritten | HISTORICAL_EVIDENCE_REWRITTEN | true | true |
| R32-DAU-EVIDENCE-OMITTED | DAU-007 exact-QA evidence removed | DAU_RESULT_OMITTED | true | true |
| R33-DAU-EVIDENCE-ALTERED | DAU-007 exact-QA evidence altered | DAU_RESULT_OMITTED | true | true |
| R34-HISTORY-MODULE-REMOVED | history module removed from the tree | IDENTITY_MISMATCH, SUCCESSOR_IDENTITY_MISSING, PACKAGE_BASELINE_FILE_UNTRACKED | true | true |
| R35-STALE-WD-MARKER | stale WD lineage marker introduced into a lineage asset | STALE_WD_LINEAGE_MARKER | true | true |
| R36-PREDECESSOR-GENERATOR-EDITED | predecessor S8-3F generator edited | IDENTITY_MISMATCH | true | true |
| R37-SUCCESSOR-GENERATOR-EDITED | successor generator edited after the manifest was written | IDENTITY_MISMATCH | true | true |
| R38-DEEPEN-MODULE-ALTERED | S8-5B Deepen module altered | IDENTITY_MISMATCH | true | true |
| R39-ASK-RUNTIME-ALTERED | certified Ask runtime altered | IDENTITY_MISMATCH | true | true |
| R41-STALE-WD-ID-IN-PACKAGE | stale WD id shipped in a packaged file other than the pinned governed schema | STALE_WD_LINEAGE_MARKER | true | true |
| R40-ROOT-ALTERED | certified root altered | IDENTITY_MISMATCH | true | true |

DAU mutation suite: 21/21 detected, 0 survived (see `dau-exact-qa.json`).

## 2. Changed-path classification vs the S8-5B base

Total changed paths: 282. Scope check: **OK** (no UNCLASSIFIED path; deletions only under the replaced packages; modifications only to the journey, `.vercelignore`, the integrity baseline and the replaced packages).

| Category | Paths |
|---|---|
| DAU_REMEDIATION_EVIDENCE | 5 |
| DAU_REMEDIATION_MODULE | 2 |
| DAU_REMEDIATION_TESTS | 3 |
| RC_CUSTODY | 2 |
| RC_DEPLOY_EXCLUSION | 1 |
| RC_EVIDENCE_AND_DOCS | 4 |
| RC_GENERATOR | 6 |
| RC_PACKAGES_REPLACED | 253 |
| RC_RELEASE_CONTROL | 4 |
| RC_TESTS | 2 |

### Non-package paths (complete list)

| Status | Path | Category |
|---|---|---|
| M | `.vercelignore` | RC_DEPLOY_EXCLUSION |
| M | `assets/atl-140-v15-journey.mjs` | DAU_REMEDIATION_MODULE |
| A | `assets/atl-s8-history-sync.mjs` | DAU_REMEDIATION_MODULE |
| A | `governance/product/S8_6_DAU_HISTORY_SYNC.md` | DAU_REMEDIATION_EVIDENCE |
| A | `governance/product/S8_6_SUCCESSOR_RC.md` | RC_EVIDENCE_AND_DOCS |
| A | `governance/product/s8-6-evidence/dau-exact-qa-run1-contended-FAIL.json` | DAU_REMEDIATION_EVIDENCE |
| A | `governance/product/s8-6-evidence/dau-exact-qa.json` | DAU_REMEDIATION_EVIDENCE |
| A | `governance/product/s8-6-evidence/dau-qa-run-history.md` | DAU_REMEDIATION_EVIDENCE |
| A | `governance/product/s8-6-evidence/gov-002-residual-routing.md` | RC_EVIDENCE_AND_DOCS |
| A | `governance/product/s8-6-evidence/release-integrity-drift-reconciliation.json` | RC_RELEASE_CONTROL |
| A | `governance/product/s8-6-evidence/run-dau-qa.cjs` | DAU_REMEDIATION_EVIDENCE |
| A | `governance/product/s8-6-evidence/run-exact-qa.cjs` | RC_EVIDENCE_AND_DOCS |
| A | `governance/product/s8-6-evidence/v2-preservation-handoff.md` | RC_EVIDENCE_AND_DOCS |
| A | `lib/release/s8-6-package-builder.js` | RC_GENERATOR |
| A | `lib/release/s8-6-release-control.js` | RC_GENERATOR |
| A | `lib/release/s8-6-successor-manifest.js` | RC_GENERATOR |
| M | `release/baselines/v2-critical-hashes.json` | RC_RELEASE_CONTROL |
| A | `release/custody/s8-6/custody-pins.json` | RC_CUSTODY |
| A | `release/custody/s8-6/road-ltl-v1.4.governed-source.json` | RC_CUSTODY |
| A | `release/manifests/atlas-v1.5-successor-s8-rc.json` | RC_RELEASE_CONTROL |
| A | `release/manifests/atlas-v1.5-successor-s8-rollback.json` | RC_RELEASE_CONTROL |
| A | `release/scripts/s8-6-assemble-release-control.mjs` | RC_GENERATOR |
| A | `release/scripts/s8-6-build-packages.mjs` | RC_GENERATOR |
| A | `scripts/s8-6-successor-manifest.mjs` | RC_GENERATOR |
| A | `tests/s8-6-dau-history-sync.test.mjs` | DAU_REMEDIATION_TESTS |
| A | `tests/s8-6-dau-mutations.test.mjs` | DAU_REMEDIATION_TESTS |
| A | `tests/s8-6-rc-mutations.test.mjs` | RC_TESTS |
| A | `tests/s8-6-successor-rc.test.mjs` | RC_TESTS |
| A | `tests/s8-6-support/atlas-browser.mjs` | DAU_REMEDIATION_TESTS |

### Replaced packages (`release/packages/{lab,stable}`)

Statuses: M=31, A=218, D=4. Full path list is in `exact-qa.json` (`changedPathsVsS85bHead.paths`).

## 3. Unchanged proof (identity paths vs the S8-5B base)

| Path | Blob | Unchanged |
|---|---|---|
| `index.html` | `043802523b1618c143a0e78b88bbfb2afaa7c7dd` | true |
| `execution/ui/runtime-access-shell.js` | `e65e98b9a0f57acfb9abfd7633fcada4671a9084` | true |
| `assets/canvas-daughter-bridge-v2.0.1.mjs` | `264e4ed26f112845bd4afb3d1e990138971d13fe` | true |
| `canvas-v2/canvas-v2/index.html` | `4dfa0a8410eba303ba7dad73a5cee6431dfe3258` | true |
| `canvas-v2/canvas-v2/assets/canvas-v2.css` | `860c878491479b40c1a71c8530d2f1725564341b` | true |
| `canvas-v2/canvas-v2/assets/canvas-v2.js` | `672dd1b5a1eb8c3c1698fae436fa0b3db53cd5d0` | true |
| `runtime/universal-ask-atlas.js` | `521c47a3956c81367bab942a657f998d576ff15f` | true |
| `lib/api/ask-atlas.js` | `8fa80f9dd0b733a523aed6970269f5f32d5e64da` | true |
| `lib/ask/p5-governed-retrieval.js` | `6f3c29dcbdf0ee60a694cd2f7ac7c9e521367a00` | true |
| `governance/ask-atlas-surface-contract-v1.json` | `608956d30ea89859e9e649457debb73d267e04cd` | true |
| `api/atlas.js` | `60dcb85999eed6d1bbc67e52b7ef6c3667cd5709` | true |
| `lib/api/release-integrity.js` | `7e29009871ef8b11f523c3bce158a49b17a3dd51` | true |
| `release/release-meta.js` | `ed41cf8a7a7b29c365d6308aadfb5b25ad8353df` | true |
| `assets/atl-167-v15-deepen-inspect.mjs` | `34bc9e6b4ca719823257c51b2058b19522169e9f` | true |
| `lib/api/governed-depth-summary.js` | `01a3594fd9ccd8286131c493f422f80a26e5aaf9` | true |
| `lib/projections/governed-depth-summary.js` | `9a6b07bd2141e8212d9ffbc78a1b2f3fabc92695` | true |
| `release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json` | `4bdc0873086c514e399d16972875b69716d69fde` | true |
| `lib/release/s8-release-manifest.js` | `14db0fdfd8e5dc2809f2c64051c71dc1f66c22b0` | true |
| `scripts/s8-3f-release-manifest.mjs` | `7ebe8fb7f5176c41cca58bf6fa334e117a0b5a91` | true |

Prior evidence / compile paths changed: 0. Workbook paths touched: 0.
