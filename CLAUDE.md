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

## Completed R0.1 Universe and reference-ownership chain
- `R0.1A` is historical **COMPLETE / QA PASS AT TIME OF CERTIFICATION**, superseded for canonical promotion by R0.1A-R. Its artifacts remain immutable evidence.
- `R0.1A-R` is **COMPLETE / INDEPENDENT QA PASS**. Corrected semantic structures SHA-256: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- `R0.1B` is **COMPLETE / INDEPENDENT QA PASS**. It finalized `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` as separate governed identities and bound semantic authority to `data/universe/r0-1a-r/universe-semantic-payload.json`.
- `R0.1C` is **COMPLETE / INDEPENDENT QA PASS**. `a5-*` is Daughter-local; 82/82 references are derived from daughter module/process identity. `scp-*` is owned by the pre-existing cross-module process-concept layer at `data/crosswalks/process-concept-crosswalk-v1.json`; 22 definitions/mappings, zero orphans, zero true reference defects.
- R0.1C Checkpoint C is `governance/recovery/R0.1C/POST_QA_GOVERNED_STATE.json`.
- The certified Universe payload remains byte-identical; do not edit its historical `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` field merely to reflect the later R0.1C governance outcome.
- The process-concept crosswalk is registered in `ASSET_REGISTER.json` by current repository path/hash. Registration did not mutate its semantics.
- Ocean process-concept mappings remain an R0.5 coverage gap, not a reference defect.

## Current authorized stage: R0.2
`R0.2` is the **only currently AUTHORIZED stage**.

Objective: close governed custody and reproducibility for the Road LTL 1.4 → effective Road LTL 1.5 → P6.0 dependency chain without semantic reconstruction.

Required scope:
- place the recovered Road LTL 1.4 release package/module/Operational Knowledge into governed GitHub and Drive custody with exact hashes;
- preserve each recovered original byte identity and reconcile historical hash discrepancies without assumption;
- normalize `taskId`/`id` overlay handling only in derived tooling, never by rewriting historical source bytes;
- deterministically materialize effective `road-ltl@1.5`;
- prove 21 unchanged 1.4 tasks + direct governed LTL-03 1.5 override;
- rerun referential-integrity checks using the R0.1C ownership model;
- reproduce and re-certify P6.0 from retained governed inputs/tooling;
- produce `PRE_CHANGE_BASELINE` before any mutation and `POST_IMPLEMENTATION_PRE_QA` after implementation, then stop at `AWAITING_INDEPENDENT_QA`.

R0.2 must not:
- reconstruct Road LTL 1.4 from Road LTL 1.3, Atlas Warehouse, PUBLIC_SAFE projections, old HTML, chat memory, or inferred logistics knowledge unless an extracted candidate exactly matches governed identity and is explicitly custodied as such;
- choose among conflicting historical hashes by filename/date alone;
- mutate recovered Road LTL 1.4 or frozen Road LTL 1.5 historical source bytes;
- alter the R0.1C `a5-*` / `scp-*` ownership determinations;
- invent Ocean process-concept mappings;
- perform R0.3 OK hardening beyond dependency closure required to reproduce P6.0;
- perform R0.4 decomposition rebuild/P6.1 repair;
- resume P6.2;
- promote `CURRENT` or `LATEST`.

Minimum governed inputs:
- `governance/recovery/R0.1C/POST_QA_GOVERNED_STATE.json`
- `governance/recovery/R0.1C/REFERENCE_OWNERSHIP_DETERMINATION.json`
- `data/crosswalks/process-concept-crosswalk-v1.json`
- `governance/frozen-assets/ASSET_REGISTER.json`
- `data/modules/road-ltl-v1.5.json`
- `data/operational-knowledge/road-ltl-v1.5-operational.json`

Recovered external Road LTL 1.4 package/module/Operational Knowledge may be used semantically only after their original bytes, hashes and provenance are placed in governed custody and any identity conflict is explicitly recorded.

## Historical-test lifecycle rule
A completed stage's immutable pre-QA test may contain assertions whose lifecycle preconditions expire after independent QA creates Checkpoint C. Do not edit historical tests merely to make them pass later. Later stages must run only assertions whose preconditions are still valid, preserve the historical test byte-for-byte, and record superseded lifecycle assertions as governed technical debt.

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

Road LTL 1.4 package/module/Operational Knowledge are treated as recovered-but-pending-governed-custody until R0.2 closes them. R0.2 must also re-certify P6.0 materialization reproducibility. R0.5 must verify Ocean FCL/LCL 0.6 canonical source/package closure before OK uplift and may then extend process-concept mappings using evidence and the existing crosswalk model.

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
