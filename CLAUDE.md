# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select the next implementation task from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order
1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers, but do not assume `FROZEN` alone means complete/reproducible.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from branch `atlas-governance-registry-v2.1`.
3. Resolve work using canonical `stageId` and `currentStageId`; `id` is only a backward-compatible alias. Never infer status from rendered text.
4. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`.
5. Read `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.
6. In recovery mode, read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md`.
7. Read frozen architecture/contracts referenced by the authorized stage/sub-stage.
8. Verify the intended implementation baseline branch/SHA before editing.

## Task-selection rule
- Implement only the exact stage/sub-stage whose queue status is `AUTHORIZED`.
- A parent stage split into sub-stages does not authorize broad execution.
- Do not start `BLOCKED_*`, `SUSPENDED_*`, `TO_BE_RESCOPED_*`, `AWAITING_INDEPENDENT_QA` or equivalent work.
- While recovery mode is active, do not resume P6.2/P6.3/P6.4/P6.5.
- Never self-authorize the next stage/sub-stage or production promotion.

## Asset custody rule
Before mutation create/commit `PRE_CHANGE_BASELINE`; required inputs must be in governed custody. A chat/local/upload-only asset cannot silently become a dependency.

After implementation create/commit `POST_IMPLEMENTATION_PRE_QA` with outputs, hashes, tooling, lineage, commit/tests and Drive candidate evidence, then stop at `AWAITING_INDEPENDENT_QA`.

After independent QA create/synchronize `POST_QA_GOVERNED_STATE`, registers/pointers/classifications and durable Drive evidence before the next stage is authorized.

## R0.1 Universe rule
R0.1 is split into governed substages and must not be combined.

- `R0.1A` is historical **COMPLETE / QA PASS AT TIME OF CERTIFICATION**, but superseded for canonical promotion by R0.1A-R. Its artifacts remain immutable evidence.
- `R0.1A-R` is **COMPLETE / INDEPENDENT QA PASS**. Corrected semantic structures SHA-256: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`. Checkpoint C: `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`.
- `R0.1B` is the **only currently AUTHORIZED stage**, and only for **FINAL AUTHORITY CLOSURE** against the corrected R0.1A-R candidate.
- R0.1B must preserve its original `UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json` as immutable historical evidence. Do not rewrite it. Create distinct final-closure evidence.
- R0.1B may confirm D1-D3 against the corrected payload; record D4-D6 as remediated; bind semantic authority to the corrected normalized payload if evidence stays consistent; finalize separate `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0`; finalize release-shell/later-repackage treatment and R0.1A supersession; produce `POST_IMPLEMENTATION_PRE_QA`; then stop at `AWAITING_INDEPENDENT_QA`.
- R0.1B may **not** rerun or modify R0.1A-R extraction, modify historical R0.1B determination evidence, promote CURRENT/LATEST/ASSET_REGISTER before independent QA, invent identifiers, create Universe 7.4, mutate Road LTL/reference models, create crosswalks, or perform R0.1C ownership decisions.
- `R0.1C` remains **BLOCKED_UNTIL_R0_1B_FINAL_QA**. Until R0.1C approval use `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` for unresolved daughter references.

## Current R0.1B final-closure required inputs
All must resolve on `atlas-governance-registry-v2.1` before work:
- `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`
- `governance/recovery/R0.1B/UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json`
- `data/universe/r0-1a-r/universe-semantic-payload.json`
- `data/universe/r0-1a-r/universe-extraction-report.json`
- `data/universe/r0-1a-r/universe-copy-comparison.json`
- `data/universe/r0-1a-r/universe-declaration-inventory.json`
- `governance/registry/UNIVERSE_MACHINE_READABLE_INPUT_REGISTRY.json`

If any required input or hash does not resolve, stop and report rather than selecting another branch by assumption.

## Architecture and source-integrity rule
Frozen architecture outranks implementation convenience. The recovery standard is a certification/recovery overlay, not redesign authority.

Do not:
- work directly on `main`;
- redesign frozen Canvas;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition/Operational Knowledge;
- fabricate business/domain knowledge or executability;
- target historical node/count totals during rebuild;
- hide blockers/gaps;
- overwrite/relabel historical evidence;
- treat hash/CI success alone as completeness;
- treat historical deployment success as current health;
- repair downstream symptoms while upstream gates remain unresolved;
- invent Universe IDs/cross-layer mappings to make tests pass;
- proceed when required assets/tooling exist only transiently;
- use PUBLIC_SAFE projections as canonical private source;
- substitute a historical adjacent version for a missing governed base without exact governed evidence.

Road LTL 1.4 package/module/Operational Knowledge are treated as recovered-but-pending-governed-custody until R0.2 closes them. R0.2 must also re-certify P6.0 materialization reproducibility. R0.5 must verify Ocean FCL/LCL 0.6 canonical source/package closure before OK uplift.

## Governance synchronization rule
Chat instructions do not supersede GitHub governance. Architecture, recovery path, sequencing, authorization, certification or agent-rule changes must be synchronized to GitHub before implementation proceeds. If chat and GitHub disagree, stop and report the conflict.

## Recovery certification rule
Assess every applicable asset/stage on:
- PHYSICAL_EXISTENCE
- SEMANTICS
- COVERAGE
- EVIDENCE
- DEPENDENCY_CLOSURE
- REPRODUCIBILITY
- REFERENTIAL_INTEGRITY
- LIVE_READABILITY
- REGISTRY_COHERENCE
- CLASSIFICATION_ACCURACY
- SECURITY_BOUNDARY
- REGRESSION
- DEPLOYMENT_PARITY

Do not classify `FROZEN_COMPLETE` unless all applicable dimensions pass.

## Completion rule
Return: `stageId`; objective; starting branch/SHA; authoritative inputs + hashes/lineage; PRE_CHANGE_BASELINE; files/migrations changed; architecture decisions/conflicts; certification results; exact tests/CI; derived evidence/counts; ending branch/SHA; POST_IMPLEMENTATION_PRE_QA; Drive evidence references; governance/pointer changes; limitations/debt; recommended next action. Then stop at `AWAITING_INDEPENDENT_QA`.
