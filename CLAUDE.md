# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select work from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order
1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from `atlas-governance-registry-v2.1`.
3. Resolve work using canonical `stageId` and `currentStageId`; `id` is backward-compatible alias only.
4. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`.
5. Read `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.
6. Read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` while recovery remains active.
7. When the architecture-refinement gate is active, read `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md` and `governance/architecture-refinement/ARCHITECTURE_DECISION_LEDGER_V1.md`.
8. Read frozen architecture/contracts referenced by any authorized implementation stage.
9. Verify the intended baseline branch/SHA before editing.

## Claude task-selection rule
- Claude may implement only the exact stage/sub-stage whose queue status is exactly `AUTHORIZED`.
- `OWNER_AUTHORIZED_CHATGPT_ONLY` is NOT Claude authorization.
- Never execute a stage whose `authorizedExecutor` is `CHATGPT` or whose `claudeExecutionAuthorized` is false.
- Do not start `BLOCKED_*`, `SUSPENDED_*`, `TO_BE_RESCOPED_*`, `AWAITING_INDEPENDENT_QA` or equivalent work.
- Never self-authorize a next stage, architecture change or production promotion.

## Current control state
- R0.1A-R, R0.1B, R0.1C and R0.2 are COMPLETE / independent QA PASS.
- **R0.3 is COMPLETE / independent QA PASS.** Final closure: `governance/recovery/R0.3/POST_QA_GOVERNED_STATE_FINAL_CLOSURE.json`.
- R0.3 implementation ending SHA: `abfc12a675107555177dfaf2113b7833a7ded644`; remediation CI run `34438976431` passed all 14 steps.
- R0.3 evidence was merged into the governance branch at `c45c5b443b3a9b19b43fd670d7412fa1144fd026`.
- R0.3 Drive evidence bundle is round-trip verified at SHA-256 `f643ba016a0f6f75c630fb74d603ec3bd9de7aea70734b62274e2027e096dc8b`.
- Effective Road LTL 1.5 remains exactly 22 tasks = 21 inherited 1.4 + direct LTL-03 1.5 override.
- Production `CURRENT/LATEST` pointers remain unchanged.

## Architecture-refinement gate — Claude must stop
The current queue stage is `AR0.1 — V1.1 / WorkDefinition Sufficiency Audit` with status `OWNER_AUTHORIZED_CHATGPT_ONLY`.

The Owner has reserved architecture-refinement work to ChatGPT. Claude is NOT authorized to:
- redesign Work Decomposition V1.1;
- redesign Canonical WorkDefinition V1;
- define or implement an Execution Readiness contract/layer;
- define an Execution Requirements layer;
- define a Solution Synthesis / Solution Selection layer;
- modify runtime-adapter boundaries for this review;
- start R0.4 recursive-decomposition recovery, reconstruction, rematerialization or compiler work;
- implement AR0.0–AR0.6;
- infer that R0.3 completion automatically authorizes R0.4.

If asked in chat to do any of the above while the queue remains in the architecture-refinement gate, stop and report the governance conflict.

## Clarified architecture-refinement North Star
The Owner-approved primary objective for this refinement program is:

> **Atlas turns reusable domain knowledge into execution-ready enterprise specifications.**

Primary objective: execution / implementation readiness.

Governance is a required trust/control property, not the end product. Execution intelligence is the structured semantic capability used to achieve readiness. Runtime execution remains outside Atlas. Autonomous solution generation, candidate solution comparison and runtime architecture selection are secondary/downstream capabilities.

Readiness must fail closed when implementation-critical operational or client knowledge is absent, conflicting, inferred beyond authority or unresolved.

AR0.1 is an audit only. It tests the frozen/current architecture against implementation readiness using concrete agent/workflow, BOL information-resolution, digital-twin/BPM, ERP/TMS handoff and adversarial control-flow scenarios. It must not freeze a successor architecture.

## Frozen architecture treatment
Frozen V1 architecture is an immutable reference baseline during the challenge. Any possible addition/refinement of readiness, enterprise-specification or downstream design semantics is a hypothesis only until the Owner approves a versioned successor.

Historical decomposition counts, including 603 work units / 444 leaves and any remembered 572/605 figures, are forensic evidence only and must never be used as rebuild targets.

## Asset custody rule
Before an authorized implementation mutation, create/commit `PRE_CHANGE_BASELINE`; required inputs must be in governed custody. Chat/local/upload-only material cannot silently become a dependency.

After implementation, create/commit `POST_IMPLEMENTATION_PRE_QA` with outputs, hashes, tooling, lineage, tests and Drive candidate evidence, then stop at `AWAITING_INDEPENDENT_QA`.

After independent QA, create/synchronize `POST_QA_GOVERNED_STATE`, relevant registers/pointers/classifications and durable Drive evidence before any next implementation stage is authorized.

By Checkpoint C, every machine-readable input required by a subsequent stage must be present and deterministically resolvable on the governance branch.

## Permanent architecture and source-integrity rules
Do not:
- work directly on `main`;
- redesign frozen Canvas without Owner approval;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition/Operational Knowledge;
- fabricate business/domain knowledge or executability/readiness;
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

Canonical work remains technology/runtime-neutral unless a later Owner-approved successor architecture explicitly changes the boundary. Client-specific field names, thresholds, SLAs, routing values and SOP-local rules remain client bindings/enterprise context.

## Governance synchronization rule
Chat instructions do not supersede GitHub governance. Architecture, recovery path, sequencing, authorization, certification or agent-rule changes must be synchronized to GitHub before implementation proceeds. If chat and GitHub disagree, stop and report the conflict.

## Recovery certification dimensions
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

## Completion rule for any future Claude-authorized implementation stage
Return: `stageId`; objective; starting branch/SHA; authoritative inputs + hashes/lineage; PRE_CHANGE_BASELINE; files/migrations changed; architecture decisions/conflicts; certification results; exact tests/CI; derived evidence/counts; ending branch/SHA; POST_IMPLEMENTATION_PRE_QA; Drive evidence references; governance/pointer changes; limitations/debt; recommended next action. Then stop at `AWAITING_INDEPENDENT_QA`.
