# Atlas Asset Custody & Governance Synchronization Standard V1

Status: OWNER_AUTHORIZED_STANDING_STANDARD  
Effective: 8 September 2026  
Applies to all Atlas architecture, governance, recovery, implementation and certification work.

## 1. Purpose

Atlas must never again depend on an asset, generator, baseline, decision or recovery path that was used successfully but not retained in governed custody.

This standard establishes a mandatory three-checkpoint custody model for changed assets and a mandatory synchronization rule for governance/architecture changes.

GitHub remains the canonical mutable governance/implementation source. Google Drive remains the durable governed vault and human-consumable evidence store. Supabase/runtime stores may be canonical persistence for governed runtime data, but they do not replace source/tooling/evidence custody in GitHub/Drive.

## 2. Standing governance synchronization rule

Any change to Atlas architecture, governance, recovery sequencing, phase/sub-stage authorization, certification criteria, source-of-truth hierarchy, or implementation-agent rules MUST be written to the governance branch before an implementation agent is instructed to act on it.

Required synchronization for such a change:
1. update the relevant frozen/recovery/governance standard in GitHub;
2. update `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json` when authorization, stage structure or sequencing changes;
3. update `governance/backlog/NEXT_PRODUCTION_EXECUTION_INTELLIGENCE_CRITICAL_PATH.md` when roadmap intent/gates change;
4. update `CLAUDE.md` when agent behavior/read-order/stop rules change;
5. mirror durable governance/architecture copies to the appropriate Drive vault folder;
6. verify the GitHub queue and human roadmap are mutually consistent before telling Claude to execute.

This is a standing rule for the owner/independent QA as well as implementation agents. Chat discussion alone is never authoritative execution governance.

## 3. Mandatory three-checkpoint asset custody

Every authorized implementation/recovery stage that changes governed assets must produce custody evidence at three checkpoints.

### Checkpoint A — PRE_CHANGE_BASELINE
Before mutation:
- enumerate all assets in scope and their governing dependencies;
- record repository path / Drive location / live-store identifier as applicable;
- record version, status/classification, content hash where available, source lineage and dependency closure state;
- record which artifacts are missing or externally supplied;
- preserve the exact authoritative input used for the stage;
- write a machine-readable baseline manifest to GitHub;
- place/mirror durable source/evidence material in Drive where required by asset type.

No stage may begin implementation if a required input exists only transiently in chat/local workspace and is not placed in governed custody or explicitly classified as an unresolved dependency.

### Checkpoint B — POST_IMPLEMENTATION_PRE_QA
After implementation but before independent QA:
- record every created/changed/superseded asset;
- record hashes, compiler/materializer/tool version, source inputs, generated outputs and unresolved defects;
- retain generated machine-readable outputs required for reproducibility;
- preserve the exact implementation commit/SHA and test evidence;
- write a candidate post-change manifest to GitHub;
- mirror durable candidate/evidence artifacts to Drive as `CANDIDATE` / `AWAITING_INDEPENDENT_QA`, never as final production truth;
- stop the stage at `AWAITING_INDEPENDENT_QA`.

### Checkpoint C — POST_QA_GOVERNED_STATE
After independent QA:
- record QA disposition: PASS, FIX_REQUIRED, BLOCKED or REJECTED;
- if PASS, update governed asset register/current pointers/classifications and supersession lineage;
- if FIX_REQUIRED/BLOCKED, preserve the candidate and finding without promoting it;
- record final approved hashes/commit/runtime schema evidence as applicable;
- update GitHub backlog/queue authorization for the next stage only after the governed state is written;
- mirror final approved governance/evidence package to Drive;
- verify GitHub, Drive and applicable live backend/runtime references agree.

A stage is not `COMPLETE` until Checkpoint C is complete.

## 4. Required manifest convention

Each stage/sub-stage that changes governed assets must maintain machine-readable custody records using the stage identifier, for example:

`governance/recovery/<stageId>/PRE_CHANGE_BASELINE.json`  
`governance/recovery/<stageId>/POST_IMPLEMENTATION_PRE_QA.json`  
`governance/recovery/<stageId>/POST_QA_GOVERNED_STATE.json`

Equivalent phase paths may be used outside recovery, but the three checkpoint names are mandatory.

Each manifest should contain, as applicable:
- `stageId`;
- `checkpoint`;
- `timestamp`;
- `branch` / `commitSha`;
- `assets[]` with path/location, assetId, version, classification, hash, lineage and dependency state;
- `tools[]` / generator/materializer/compiler versions and paths;
- `liveState[]` references for Supabase/Vercel/runtime where applicable;
- `driveEvidence[]` durable vault references;
- `findings[]`;
- `qaDisposition` at Checkpoint C.

## 5. Asset retention rule

The following must never be left only in transient chat/session/local state when they materially contribute to a frozen or certified asset:
- canonical source payloads;
- base/overlay packages;
- schemas;
- deterministic generators/materializers/compilers;
- transformation rules;
- test fixtures required to prove real behavior;
- generated protected bundles required for reproducibility, subject to access controls;
- migration SQL actually applied to live state or an exact reconciled representation;
- certification inputs/outputs and hashes;
- recovery findings and supersession decisions.

Protected assets may be stored outside public repository paths, but their governed location, access class, hash and retrieval procedure must be recorded.

## 6. No promotion from memory or chat

No agent may promote, freeze, certify or authorize downstream work solely from:
- chat history;
- remembered counts;
- screenshots;
- an untracked local file;
- an uploaded file that has not been placed in governed custody;
- a historical CI success whose exact inputs/tooling cannot be retrieved.

Such material may be used as evidence to recover an asset, but must first be placed into governed custody and classified.

## 7. Queue identifier convention

The canonical machine-readable identifier field is `stageId` for both phases and sub-stages. `id` may remain temporarily as a backward-compatible alias, but agents and automation must resolve using `stageId`.

The queue must also expose `currentStageId`. Display/rendering concatenation must never be used to infer status; `stageId` and `status` are separate fields.

## 8. Agent completion rule

An implementation agent may not report a stage complete unless it has produced Checkpoint B custody evidence. It must then stop at `AWAITING_INDEPENDENT_QA`.

Independent QA may not authorize the next stage until Checkpoint C governance synchronization has been completed.

## 9. Independent QA / owner standing behavior

For every future Atlas governance or recovery-path decision, independent QA/owner must update GitHub governance first and keep Drive durable governance copies synchronized without waiting for a separate user request.

This rule is permanent unless explicitly superseded by a later owner-authorized governance standard.