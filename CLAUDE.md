# Atlas — Standing Implementation Agent Protocol

This repository is governed. Do not select work from chat history, assumptions or perceived convenience.

## Mandatory shared-executor logging — NO LOG → NO ADVANCE

Read and obey:
`governance/standards/ATLAS_SHARED_EXECUTOR_LOGGING_STANDARD_V1.md`

Canonical shared log:
`claude_chatGPT.md`

This applies equally to Claude and ChatGPT.

For every material Atlas action Claude MUST:
1. **PRE-ACTION:** read the latest `claude_chatGPT.md` and log intended action, stage, branch/SHA, scope and guardrails before mutation or material execution.
2. **MATERIAL FINDING:** log any finding that changes or could change architecture, lineage, scope, version selection, implementation, risk, readiness, cleanup, deployment interpretation or next action immediately when found.
3. **POST-ACTION:** log every meaningful build slice, audit result, governance update, branch action, failed action, resolved blocker, or changed safe-resume state.
4. **STAGE CLOSURE:** log the final state before claiming PASS, COMPLETE, READY_FOR_QA, READY_FOR_MERGE, or asking/allowing the queue to advance.

A stale `claude_chatGPT.md` makes stage completion invalid. If the previous executor did not log a material action, stop, reconstruct the missing state from repository evidence, write the reconciliation to the shared log, and only then continue.

The Owner must not be required to manually copy findings between ChatGPT and Claude.

## Mandatory start-of-work read order
1. Read `governance/frozen-assets/CURRENT.json` and `governance/frozen-assets/LATEST.md` for historical/frozen pointers.
2. Read `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` from `atlas-governance-registry-v2.1`.
3. Read `claude_chatGPT.md` and `governance/standards/ATLAS_SHARED_EXECUTOR_LOGGING_STANDARD_V1.md` before any material action.
4. If `currentPhase == ATLAS_V2_DEMO_SPRINT`, read in this order:
   - `governance/demo-sprint/ATLAS_CURRENT_DEMO_TARGET_STATE_MAP.md`
   - `governance/demo-sprint/ATLAS_VERCEL_PROJECT_AND_DEPLOYMENT_DISPOSITION_AUDIT.md`
   - `governance/demo-sprint/ATLAS_GITHUB_ONLY_DEMO_RELEASE_POLICY.md`
   - `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_PROTOCOL.md`
   - `governance/demo-sprint/ATLAS_V2_DEMO_HANDOVER.md`
   - `governance/demo-sprint/ATLAS_V2_DEMO_BUILD_LOG.md`
5. Resolve work using canonical `stageId` and `currentStageId`; `id` is backward-compatible alias only.
6. Read `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md`.
7. Read `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.
8. Read `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` while recovery remains active.
9. When architecture refinement remains open, read `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md` and `governance/architecture-refinement/ARCHITECTURE_DECISION_LEDGER_V1.md`.
10. Read frozen architecture/contracts referenced by the authorized implementation stage.
11. Verify the intended baseline branch/SHA before editing.

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

Claude must resume from `ATLAS_V2_DEMO_HANDOVER.md` plus the latest `claude_chatGPT.md`, not from remembered chat context.

Claude may NOT under backup authority:
- advance to the next D2.0 stage before current-stage PASS/authorization;
- change the demo scope;
- resolve or overwrite AR0.2+ architecture decisions;
- start R0.4 recovery;
- redefine canonical Atlas semantics to fit Malkom or another runtime;
- deploy, preview, promote, or delete anything on Vercel;
- merge the demo branch to `main` without the required Owner approval and D2.0.6 certified state.

If handover, shared log, queue and repository state disagree, reconcile and log the resolution before editing.

## Current control state
- R0.1A-R, R0.1B, R0.1C, R0.2 and R0.3 are COMPLETE / independently QA-certified as recorded in the queue.
- AR0.1 is COMPLETE.
- AR0.2 candidate exists and remains `AWAITING_OWNER_REVIEW__TEMPORARILY_NOT_CURRENT_DURING_DEMO_SPRINT`; architecture refinement is preserved, not cancelled.
- R0.4 remains suspended.
- Production `CURRENT/LATEST` pointers remain unchanged unless a later governed stage explicitly updates them.
- Current active work is the separate Atlas V2 Demo Sprint.
- Demo implementation branch is `atlas-v2-demo-2026-09-14`.
- `main` is integration destination only after D2.0.6 PASS and explicit Owner approval at D2.0.7.
- No Vercel deployment, preview, promotion, live change or deletion is authorized during this sprint.

## Demo sprint build discipline
For every D2.0 build stage:
1. PRE-ACTION shared-log entry.
2. PRE_BUILD_AUDIT before mutation.
3. Build only the authorized narrow stage.
4. MID_BUILD_AUDIT after each meaningful feature slice / before scope expansion.
5. MATERIAL-FINDING / POST-ACTION shared-log update immediately after every meaningful slice or finding.
6. POST_BUILD_AUDIT covering the complete resulting application, not only changed files.
7. Regression/integration check.
8. Record exact full-repository commit SHA.
9. Create/preserve an immutable stage freeze point/ref when practical.
10. Update the frozen-state manifest, hot-backup handover and `claude_chatGPT.md`.
11. STAGE-CLOSURE shared-log entry.
12. Only then may the next stage be authorized.

A delta-only PASS is invalid. A PASS with a stale shared log is also invalid.

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
- Ocean FCL/LCL 0.6 as an Owner-authorized demo candidate surface;
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
- closure of unresolved BOL/Road LTL knowledge gaps;
- that Road LTL v1.4/v1.5 currently generates the existing Malkom proof unless a real validated bridge exists.

## Asset custody rule
Before an authorized implementation mutation, create/commit `PRE_BUILD_AUDIT` / baseline evidence for the demo stage. Required inputs must be in governed custody.

During build, retain `MID_BUILD_AUDIT` evidence for material slices and update `claude_chatGPT.md` after each meaningful slice/finding.

After implementation, create `POST_BUILD_AUDIT` / candidate full-state evidence with outputs, hashes/SHAs, tooling, lineage, tests and limitations. Update `ATLAS_V2_DEMO_HANDOVER.md` and `claude_chatGPT.md` immediately.

No required source/tool/generator may exist only transiently in chat/local state.

## Permanent source-integrity rules
Do not:
- work directly on `main`;
- treat Vercel as source of truth;
- deploy/preview/promote/delete on Vercel during the current sprint;
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
- substitute a historical adjacent version for a missing governed base without exact governed evidence;
- advance work while `claude_chatGPT.md` is stale after a material action.

## Governance synchronization rule
Chat instructions do not supersede GitHub governance. Architecture, demo/recovery sequencing, authorization, certification criteria, source-of-truth hierarchy or agent-rule changes must be synchronized to GitHub before implementation proceeds.

The shared-executor logging standard is standing governance. Failure to log is a stop condition.

## Certification dimensions
Assess applicable assets/stages on:
- PHYSICAL_EXISTENCE
- SEMANTICS
- COVERAGE
- EVIDENCE
- DEPENDENCY_CLOSURE
- REPRODUCIBILITY
- REFERENTIAL_INTEGRITY
- LIVE_READABILITY where applicable
- REGISTRY_COHERENCE
- CLASSIFICATION_ACCURACY
- SECURITY_BOUNDARY
- REGRESSION
- GITHUB_MERGE_READINESS during the current no-Vercel sprint

## Completion / handover return
For any Claude-resumed demo stage, report and log:
- stageId and objective;
- why backup takeover activated;
- starting full-state branch/SHA/freeze point;
- PRE/MID/POST audit artifacts;
- files/components changed;
- tests and regressions;
- current full-state commit SHA;
- full-state freeze reference;
- handover update;
- shared-log entries current through stage closure;
- limitations/debt;
- exact next action;
then stop unless the queue separately authorizes the next stage.
