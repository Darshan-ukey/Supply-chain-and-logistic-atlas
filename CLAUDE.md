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

- `R0.1A` is historical **COMPLETE / INDEPENDENT QA PASS AT TIME OF CERTIFICATION**. Its artifacts and Checkpoints A/B/C remain immutable governed evidence. R0.1B subsequently discovered a deterministic materialization defect; therefore the R0.1A payload is not eligible for canonical promotion and must not be overwritten or silently replaced.
- `R0.1A-R` is the **only currently AUTHORIZED implementation stage**. Its sole purpose is deterministic Universe semantic re-materialization correction under R0.1B D4/D5/D6.
- R0.1A-R must capture the full declaration expression including chained transforms and exclude later separate mutation statements; correct `systemRecords` and `businessObjectRecords` generically; retain source-declared `description`; exclude later-derived `domainIds` where applicable; classify/exclude `state` as `RUNTIME_UI_STATE`; correct heterogeneous-ID divergence detection; rerun independent inventory/materialization without targeting historical counts; generate new hashes/supersession lineage; establish governed dependency closure; and stop at `AWAITING_INDEPENDENT_QA`.
- R0.1A-R may not redesign Universe semantics, relabel semantic 7.2.0 as 7.3, create Universe 7.4, hard-code fields merely to satisfy tests, invent fields/IDs, mutate Road LTL/reference models, create crosswalks, perform R0.1C ownership work, promote CURRENT/LATEST, or resume P6 work.
- `R0.1B` is **SUSPENDED_PENDING_R0_1A_R_QA**. Its implementation and determination evidence remains governed. After R0.1A-R independent QA passes, R0.1B may return only when governance explicitly re-authorizes it for final authority/canonical-asset closure.
- `R0.1C` remains **BLOCKED_UNTIL_R0_1B_FINAL_QA**. Until R0.1C approval use `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` for unresolved daughter references.

## R0.1A-R implementation invariants
- Preserve R0.1A and R0.1B evidence byte-for-byte.
- Create a fresh `PRE_CHANGE_BASELINE` before any remediation mutation.
- Do not target 61 structures, 1,330 records or any historical count. Derive corrected counts from source and classification rules.
- Do not special-case `description` as a manual patch; fix the declaration-expression capture mechanism generically.
- `state` must remain visible in audit/inventory evidence as runtime/UI state even though it is excluded from canonical semantics.
- Correct the prior id-only divergence detector using entity-aware identity such as `(entityKind, id)` or a deterministic equivalent supported by the source structure.
- Carry certified machine-readable Universe dependencies onto governed repository paths or otherwise make them deterministically resolvable by path/hash/lineage from the governance branch. Do not create uncontrolled duplicate authority.
- If corrected extraction contradicts any R0.1B determination, stop and report the conflict; do not resolve it architecturally yourself.

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
