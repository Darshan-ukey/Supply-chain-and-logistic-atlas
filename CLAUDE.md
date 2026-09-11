# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select work from chat history, assumptions or perceived convenience.

## Mandatory start-of-work read order
1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from `atlas-governance-registry-v2.1`.
3. If `currentPhase == ATLAS_V2_DEMO_SPRINT`, read in this order:
   - `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_PROTOCOL.md`
   - `governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md`
   - `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md`
4. Resolve work using canonical `stageId` and `currentStageId`; `id` is backward-compatible alias only.
5. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`.
6. Read `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.
7. Read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` while recovery remains active.
8. When architecture refinement remains open, read `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md` and `governance/architecture-refinement/ARCHITECTURE_DECISION_LEDGER_V1.md`.
9. Read frozen architecture/contracts referenced by the authorized implementation stage.
10. Verify the intended baseline branch/SHA before editing.

## Executor rule
### Normal / architecture work
- Claude may implement only an exact stage whose queue explicitly authorizes Claude.
- Claude may not execute AR0 architecture-refinement stages unless governance is explicitly changed.
- Never self-authorize a next stage, architecture change or production promotion.

### Atlas V2 Demo Sprint hot-backup exception
The Owner has designated ChatGPT as primary demo executor and Claude as hot backup.

Claude MAY resume the exact current `D2.0.x` demo stage when any of these is true:
- ChatGPT is unavailable;
- ChatGPT has failed/crashed;
- the Owner explicitly directs Claude to take over.

This standing backup authorization applies only when the queue records:
- `claudeDemoBackupAuthorized = true`; and
- the current demo stage identifies Claude as backup executor.

Claude must resume from `ATLAS_V2_DEMO_HANDOVER.md`, not from remembered chat context.

Claude may NOT under backup authority:
- advance to the next D2.0 stage before current-stage PASS/authorization;
- change the demo scope;
- resolve or overwrite AR0.2+ architecture decisions;
- start R0.4 recovery;
- redefine canonical Atlas semantics to fit Malkom or another runtime;
- promote `ATLAS_V2_DEMO_GO_LIVE` without the required gate/Owner approval.

If handover and repository state disagree, reconcile and report before editing.

## Current control state
- R0.1A-R, R0.1B, R0.1C, R0.2 and R0.3 are COMPLETE / independently QA-certified as recorded in the queue.
- AR0.1 is COMPLETE.
- AR0.2 candidate exists and remains `AWAITING_OWNER_REVIEW__TEMPORARILY_NOT_CURRENT_DURING_DEMO_SPRINT`; architecture refinement is preserved, not cancelled.
- R0.4 remains suspended.
- Production `CURRENT/LATEST` pointers remain unchanged unless a later governed stage explicitly updates them.
- Current active work is the separate Atlas V2 Demo Sprint.
- `ATLAS_V2_DEMO_GO_LIVE` is a functional-concept/demo promotion and is NOT equivalent to full `ATLAS_V2_GO_LIVE` production certification.

## Demo sprint build discipline
For every D2.0 build stage:
1. PRE_BUILD_AUDIT before mutation.
2. Build only the authorized narrow stage.
3. MID_BUILD_AUDIT after each meaningful feature slice / before scope expansion.
4. POST_BUILD_AUDIT covering the complete resulting application, not only changed files.
5. Regression/integration check.
6. Record exact full-repository commit SHA.
7. Create/preserve an immutable stage freeze point/ref when practical.
8. Update the frozen-state manifest and hot-backup handover.
9. Only then may the next stage be authorized.

A delta-only PASS is invalid.

## Full-state freeze rule
- Never overwrite historical frozen states.
- Each passed demo stage creates a newer immutable complete repository freeze point.
- Downstream work starts from the latest certified freeze point.
- A freeze record must include full repository SHA, authoritative source inputs, tests/audits, known limitations and next authorized stage.

## Architecture / product boundary
> **Atlas owns understanding and specification. Downstream platforms own execution.**

Atlas is the governed intelligence/specification layer between enterprise/client operations and downstream technologies.

Canonical business semantics remain technology/runtime-neutral. Client-specific values remain enterprise/client bindings. Runtime queues, subqueues, agent nodes, BPMN implementation nodes, credentials and target-platform internals remain downstream projections unless an Owner-approved successor architecture explicitly changes the boundary.

Malkom is a downstream execution consumer/projection, not canonical Atlas truth.

## Demo scope guardrails
The demo may show:
- Supply Chain Universe / Page 0 / Canvas;
- Road LTL execution-depth reference;
- Ocean FCL/LCL 0.6 as a live domain surface under the Owner-authorized demo assumption;
- Operational Knowledge, Work Decomposition, WorkDefinition;
- client/execution-context and readiness/gap concepts where supported;
- Malkom adapter/projection;
- the stakeholder-facing `Domain Knowledge -> Execution Readiness -> Adapters / Downstream Tools` page.

Do not claim:
- full production certification;
- Ocean execution-depth parity with Road LTL unless verified;
- autonomous solution generation;
- Atlas runtime execution;
- full ERP program readiness;
- closure of unresolved BOL/Road LTL knowledge gaps.

## Asset custody rule
Before an authorized implementation mutation, create/commit `PRE_BUILD_AUDIT` / baseline evidence for the demo stage. Required inputs must be in governed custody.

During build, retain `MID_BUILD_AUDIT` evidence for material slices.

After implementation, create `POST_BUILD_AUDIT` / candidate full-state evidence with outputs, hashes/SHAs, tooling, lineage, tests and limitations. Update `ATLAS_V2_DEMO_HANDOVER.md` immediately after meaningful work.

No required source/tool/generator may exist only transiently in chat/local state.

## Permanent source-integrity rules
Do not:
- work directly on `main`;
- treat Vercel as source of truth;
- redesign frozen Canvas without Owner approval;
- make Malkom/runtime structures canonical Atlas truth;
- move client-specific values into canonical WorkDefinition/Operational Knowledge;
- fabricate business/domain knowledge or executability/readiness;
- target historical node/count totals during rebuild;
- hide blockers/gaps;
- overwrite/relabel historical evidence;
- treat hash/CI success alone as completeness;
- treat historical deployment success as current health;
- invent Universe IDs/cross-layer mappings to make tests pass;
- use PUBLIC_SAFE projections as canonical private source;
- substitute a historical adjacent version for a missing governed base without exact governed evidence.

## Governance synchronization rule
Chat instructions do not supersede GitHub governance. Architecture, demo/recovery sequencing, authorization, certification criteria, source-of-truth hierarchy or agent-rule changes must be synchronized to GitHub before implementation proceeds.

## Certification dimensions
Assess applicable assets/stages on:
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

## Completion / handover return
For any Claude-resumed demo stage, report:
- stageId and objective;
- why backup takeover activated;
- starting full-state branch/SHA/freeze point;
- PRE/MID/POST audit artifacts;
- files/components changed;
- tests and regressions;
- current full-state commit SHA;
- full-state freeze reference;
- handover update;
- limitations/debt;
- exact next action;
then stop unless the queue separately authorizes the next stage.
