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

By Checkpoint C, every machine-readable input required by a subsequent stage must be present and deterministically resolvable on the governance branch. An implementation-branch-only dependency is not closed custody.

## Completed recovery chain through R0.2
- `R0.1A` is historical **COMPLETE / QA PASS AT TIME OF CERTIFICATION**, superseded for canonical promotion by R0.1A-R. Its artifacts remain immutable evidence.
- `R0.1A-R` is **COMPLETE / INDEPENDENT QA PASS**. Corrected semantic structures SHA-256: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- `R0.1B` is **COMPLETE / INDEPENDENT QA PASS**. It finalized `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` as separate governed identities and bound semantic authority to `data/universe/r0-1a-r/universe-semantic-payload.json`.
- `R0.1C` is **COMPLETE / INDEPENDENT QA PASS**. `a5-*` is Daughter-local; 82/82 references are derived from daughter module/process identity. `scp-*` is owned by the pre-existing cross-module process-concept layer at `data/crosswalks/process-concept-crosswalk-v1.json`; 22 definitions/mappings, zero orphans, zero true reference defects.
- The certified Universe payload remains byte-identical; do not edit its historical `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` field merely to reflect the later R0.1C governance outcome.
- The process-concept crosswalk is registered in `ASSET_REGISTER.json` by current repository path/hash. Registration did not mutate its semantics.
- Ocean process-concept mappings remain an R0.5 coverage gap, not a reference defect.
- `R0.2` is **COMPLETE / INDEPENDENT QA PASS**. Exact Road LTL 1.4 package/module/Operational Knowledge custody is closed; effective Road LTL 1.5 is proven as 21 inherited 1.4 tasks plus direct governed LTL-03 1.5 override; P6.0 is re-certified at 502/502 gates using its own generation tooling.
- Exact frozen Road LTL/Ocean package custody is SHA-256 `b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289` at `release/packages/frozen/atlas-daughter-release-ltl-v1.4-ocean-v0.6.zip`; Road LTL 1.4 module and OK repository paths are registered without production promotion.
- R0.2 Checkpoint C is `governance/recovery/R0.2/POST_QA_GOVERNED_STATE.json`.

## Current authorized stage: R0.3
`R0.3` is the **only currently AUTHORIZED stage**.

Name: **Road LTL Operational Knowledge + Canonical Information Hardening**.

Governed purpose from the recovery roadmap: certify 22-task Operational Knowledge coverage; close/classify object/document gaps; complete canonical BOL/information semantics; preserve unresolved evidence and knowledge gaps.

R0.3 must:
- consume only governed inputs resolvable from `atlas-governance-registry-v2.1`;
- preserve the R0.2-certified Road LTL 1.4/effective 1.5 lineage and hashes unless the governed stage explicitly requires a new derived artifact;
- distinguish evidenced Operational Knowledge from unresolved knowledge gaps;
- preserve canonical versus client-specific boundaries under the frozen Knowledge-to-Execution architecture;
- treat documents/objects/information semantics as governed canonical contracts where evidenced, not as incidental task attachments;
- create `PRE_CHANGE_BASELINE` before mutation;
- create `POST_IMPLEMENTATION_PRE_QA` after implementation and stop at `AWAITING_INDEPENDENT_QA`.

R0.3 must not:
- fabricate operational knowledge to reach 22-task coverage;
- reinterpret or mutate R0.1B Universe authority or R0.1C identifier ownership;
- mutate recovered Road LTL 1.4 source bytes;
- invent Ocean mappings or perform R0.5 work;
- begin R0.4 recursive-decomposition implementation;
- resume P6.1/P6.2;
- promote `CURRENT`, `LATEST`, Road LTL production status, or Atlas V2 go-live state;
- move client-specific field names, thresholds, SLAs, routing values or SOP-local values into global canonical truth.

If the R0.3 evidence exposes an upstream contradiction rather than a knowledge gap, stop and report it rather than silently correcting upstream certified artifacts.

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

R0.5 must verify Ocean FCL/LCL 0.6 canonical source/package closure before OK uplift and may then extend process-concept mappings using evidence and the existing crosswalk model.

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
