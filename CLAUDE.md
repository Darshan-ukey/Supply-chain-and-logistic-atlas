# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select the next implementation task from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order

Before starting any Atlas implementation/recovery work:

1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers, but do not assume `FROZEN` alone means complete/reproducible.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from branch `atlas-governance-registry-v2.1`.
3. Resolve stage identity using the canonical `stageId` field and `currentStageId`. `id` is only a backward-compatible alias. Never infer status from rendered/concatenated display text.
4. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md` from the same governance branch.
5. Read `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.
6. If queue mode is `PRE_P6_FOUNDATION_RECOVERY`, read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` before any other phase-specific implementation work.
7. Read the frozen architecture/contracts referenced by the authorized stage/sub-stage.
8. Verify the intended implementation baseline branch/SHA against GitHub before editing.

## Task-selection rule

- Implement only the stage or sub-stage whose queue status is exactly `AUTHORIZED`.
- If a parent stage is split into sub-stages, the parent status does not authorize broad execution. Only the explicitly `AUTHORIZED` sub-stage may mutate assets.
- Do not start work marked `BLOCKED_*`, `SUSPENDED_*`, `TO_BE_RESCOPED_*`, `AWAITING_INDEPENDENT_QA`, or equivalent.
- While recovery mode is active, do not resume P6.2/P6.3/P6.4/P6.5 regardless of prior authorization/history.
- If the current authorized stage/sub-stage is already complete locally, return its completion report and stop.
- Never self-authorize the next stage/sub-stage.
- Never promote production/go-live without explicit owner / independent QA authorization.

## Asset custody rule — mandatory for every stage

Before mutating governed assets, create and commit the stage's `PRE_CHANGE_BASELINE` custody manifest and ensure required authoritative inputs are in governed custody. A transient chat/local/upload-only asset cannot silently become a stage dependency.

After implementation and before QA, create and commit `POST_IMPLEMENTATION_PRE_QA`, including changed/generated assets, hashes, tooling, source lineage, exact implementation commit/test evidence and Drive candidate/evidence references. Then stop at `AWAITING_INDEPENDENT_QA`.

After independent QA, the owner/QA process creates `POST_QA_GOVERNED_STATE`, updates governed registers/pointers/classification or records FIX_REQUIRED/BLOCKED, mirrors durable final evidence to Drive, and only then may the queue authorize the next stage.

A stage is not complete until all three applicable checkpoints are synchronized under `ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.

## R0.1 Universe recovery rule

R0.1 is explicitly split into R0.1A, R0.1B and R0.1C. Do not combine them.

- `R0.1A` may mechanically materialize and test the existing Universe semantics. It may not redesign semantics, create Universe 7.4, invent `a5-*`/`scp-*` IDs, create a crosswalk, or mutate Road LTL references.
- `R0.1B` is an identity/authority reconciliation stage and remains blocked until R0.1A independent QA.
- `R0.1C` is a reference-ownership audit and remains blocked until R0.1B independent QA. Until R0.1C is approved, unresolved daughter references must not be represented as proven missing Universe identifiers. Use `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

## Architecture rule

Frozen governed architecture outranks implementation convenience. The Pre-P6 Recovery Standard is a certification/recovery overlay and does not authorize redesign of the frozen Knowledge-to-Execution architecture.

If code, old docs, prototypes, pending notes, runtime behavior or historical certification conflict with frozen architecture or the current recovery queue, report the conflict and stop rather than silently choosing.

Do not:
- work directly on `main`;
- redesign the frozen Canvas shell;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition or canonical Operational Knowledge;
- fabricate business/domain knowledge or executability;
- target historical node/count totals during a rebuild;
- hide unresolved blockers/knowledge gaps;
- overwrite, relabel or mutate frozen historical evidence to make a test pass;
- treat a hash/CI success alone as proof of completeness;
- treat historical deployment success as current production health;
- repair a downstream symptom while an upstream recovery gate remains unresolved;
- invent Universe identifiers or cross-layer mappings merely to make reference tests pass;
- proceed when required assets/tooling exist only transiently and are not in governed custody.

## Governance synchronization rule

Chat instructions do not supersede the GitHub governance branch. If the owner/QA changes architecture, recovery path, sequencing, authorization, certification rules or agent behavior, the relevant GitHub governance files must be updated before implementation proceeds. If chat and GitHub disagree, stop and report the conflict.

## Recovery certification rule

For each applicable asset/stage, assess and report the relevant dimensions:
- SEMANTICS
- COVERAGE
- EVIDENCE
- DEPENDENCY_CLOSURE
- REPRODUCIBILITY
- REFERENTIAL_INTEGRITY
- LIVE_READABILITY
- SECURITY_BOUNDARY
- REGRESSION
- DEPLOYMENT_PARITY

Do not classify an asset `FROZEN_COMPLETE` unless all applicable dimensions pass. Use truthful interim classifications such as `FROZEN_REFERENCE`, `FROZEN_DELTA`, `FROZEN_PARTIAL`, `SEMANTICALLY_VALID_REPRODUCIBILITY_BLOCKED`, or `RECERTIFICATION_REQUIRED` where appropriate.

## Completion rule

At the end of an authorized stage/sub-stage, return:
- `stageId`;
- objective;
- starting branch/SHA;
- authoritative inputs used and their hashes/lineage;
- PRE_CHANGE_BASELINE manifest path/hash;
- files changed;
- migrations/backend changes;
- architecture decisions and unresolved conflicts;
- certification-dimension results;
- tests/CI and exact results;
- evidence and counts (derived, never target-tuned);
- ending branch/SHA;
- POST_IMPLEMENTATION_PRE_QA manifest path/hash;
- Drive candidate/evidence references;
- governance/pointer changes;
- limitations/debt;
- recommended next action.

Then stop at `AWAITING_INDEPENDENT_QA`.

The next stage/sub-stage becomes executable only after independent QA writes/synchronizes the `POST_QA_GOVERNED_STATE` checkpoint and updates the machine queue.