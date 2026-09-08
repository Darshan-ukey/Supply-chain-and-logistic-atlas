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

- `R0.1A` is historical **COMPLETE / QA PASS AT TIME OF CERTIFICATION**, superseded for canonical promotion by R0.1A-R. Its artifacts remain immutable evidence.
- `R0.1A-R` is **COMPLETE / INDEPENDENT QA PASS**. Corrected semantic structures SHA-256: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- `R0.1B` is **COMPLETE / INDEPENDENT QA PASS**. Final authority closure is recorded at `governance/recovery/R0.1B/UNIVERSE_FINAL_AUTHORITY_CLOSURE.json` and `governance/recovery/R0.1B/POST_QA_GOVERNED_STATE_FINAL_CLOSURE.json`.
- R0.1B finalized two distinct governed identities: `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0`. Semantic authority is bound to `data/universe/r0-1a-r/universe-semantic-payload.json` with semantic structures SHA-256 `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- Release-shell authority is the documented V7.3 copy SHA-256 `31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd`; later repackage SHA-256 `d674a8f775dfd2f6997ec2ca9cbc7cf799aeae73016d2b5b9676de87c0c0d9ef` remains governed evidence, not authoritative shell.
- Production `CURRENT/LATEST/ASSET_REGISTER` pointers were **not promoted** by R0.1B closure. Do not infer production promotion from authority certification.
- `R0.1C` is the **only currently AUTHORIZED stage**.

## Current R0.1C ownership-audit rule
R0.1C is an evidence/classification stage, not a repair stage.

Required scope:
- inventory unresolved references from governed Road LTL and Universe evidence;
- classify each reference as Universe canonical, Daughter-local, Operational Knowledge, Canonical Information/Object, cross-layer contract, or orphan;
- determine `a5-ltl-*` ownership using evidence;
- determine `scp-*` ownership using evidence;
- distinguish actual defects from valid Daughter-local or cross-layer identifiers;
- recommend repair type without mutation;
- retain `canonicalReferenceResolution=UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` until evidence supports a governed classification;
- create `PRE_CHANGE_BASELINE`, then `POST_IMPLEMENTATION_PRE_QA`, and stop at `AWAITING_INDEPENDENT_QA`.

R0.1C may not:
- invent crosswalks or identifiers;
- create Universe 7.4;
- mutate Universe, Daughter, Road LTL, Operational Knowledge or canonical-reference semantics;
- modify `CURRENT/LATEST/ASSET_REGISTER`;
- begin R0.2 work;
- resume P6.

Minimum governed inputs:
- `governance/recovery/R0.1B/POST_QA_GOVERNED_STATE_FINAL_CLOSURE.json`
- `governance/recovery/R0.1B/UNIVERSE_FINAL_AUTHORITY_CLOSURE.json`
- `data/universe/r0-1a-r/universe-semantic-payload.json`
- `governance/registry/UNIVERSE_MACHINE_READABLE_INPUT_REGISTRY.json`

If required Road LTL evidence needed for ownership classification is not in governed custody, stop and report the dependency gap rather than importing an adjacent version or making an ownership assumption.

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
