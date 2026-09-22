# Atlas Agent-Independent Task Continuity Standard V1

**Status:** OWNER-AUTHORIZED GLOBAL GOVERNANCE — MANDATORY  
**Effective:** 2026-09-22  
**Applies to:** every substantive Atlas task executed by ChatGPT, Claude, another AI agent, or a human operator.

## 1. Governing principle

> **Chat history is disposable. Governed task state must be independently recoverable.**

An authorized operator with access to the task orchestration system and the governed repositories/stores required by that task must be able to determine:
1. what the task is;
2. what governs it;
3. what inputs were consumed;
4. what work has already been completed;
5. where every material working output resides;
6. which output is current versus superseded;
7. what QA/decisions apply;
8. the exact checkpoint where execution stopped;
9. the exact next action;
10. what remains blocked and why.

A task is not safely resumable if an operator must reconstruct material work from chat history, an agent's memory, browser state, temporary files, or undocumented local state.

## 2. Four-part task continuity model

Every substantive task must preserve four distinct layers:

**TASK → INSTRUCTIONS → WORKING OUTPUT → GOVERNED RESULT**

- **Task:** orchestration identity, status, dependencies, owner and acceptance criteria.
- **Instructions:** governing standards, contracts, Owner decisions and exact authorized scope.
- **Working Output:** material intermediate work already produced, including candidates, analyses, mappings, code, structured data, gap registers and partial results.
- **Governed Result:** QA'd/frozen/promoted output and its exact identity when the task closes.

Preserving only the task description or final artifact is insufficient.

## 3. System-of-record responsibilities

### Linear — orchestration authority
Linear records:
- task ID/title/status/priority;
- parent/dependencies/blockers;
- execution owner and decision authority;
- acceptance/exit criteria;
- current gate;
- pointer to the Task Execution Manifest;
- concise current checkpoint/next action when material.

Linear must not become the primary repository for large work products.

### GitHub — executable/control authority and Task Execution Manifest authority
GitHub records:
- governance/standards/contracts/schemas;
- code/generators/migrations/validators;
- machine-readable or version-controlled working outputs where appropriate;
- **one Task Execution Manifest for every substantive active task**;
- exact paths/commits/hashes for GitHub-hosted outputs.

### Google Drive / governed custody — source and evidence preservation
Drive records/references:
- source documents/evidence;
- research working evidence/source ledgers;
- large/non-code artifacts;
- frozen exports/custody packages;
- exact file IDs/versions where applicable.

### Canonical Structured Knowledge Store
Supabase/Postgres or its governed successor records structured Atlas knowledge/state after the applicable promotion gate. Task manifests point to exact schema/table/record/version/run identities; they do not duplicate the database.

### claude_chatGPT.md — cross-agent control chronology
The canonical shared log records:
- independent QA dispositions;
- Owner decisions;
- exceptional governance findings;
- cross-agent handoffs and material gate changes.

It is **not** the primary storage location for task work product. An operator must not be required to reconstruct ordinary task progress by reading the entire shared log.

## 4. Mandatory Task Execution Manifest

Every substantive active task must have exactly one authoritative Task Execution Manifest.

Default path:
`governance/task-manifests/<LINEAR_ID>.yaml`

The manifest must contain at minimum:

- `task_id`, `task_title`, `task_status`, `execution_owner`, `decision_authority`;
- `linear_url`;
- `manifest_status` and `last_updated`;
- `governing_inputs[]`: exact standard/contract/decision identities;
- `consumed_inputs[]`: exact GitHub paths+commits/hashes, Drive file IDs/versions, database/query/run identities, or other governed input identities;
- `working_outputs[]`: each material intermediate output, its location, identity/version, status and description;
- `current_outputs[]`: the current candidate/canonical artifacts to use;
- `superseded_outputs[]`: old artifact → successor mapping and reason;
- `qa_and_decisions[]`: QA disposition/Owner decision with exact evidence location;
- `current_checkpoint`: precise completed-through state;
- `next_action`: one exact resumable next action;
- `open_items[]`: unresolved work/gaps;
- `blocked_actions[]`: action, blocker and release condition;
- `authorized_actions[]`;
- `handoff`: what a new operator must read/do first;
- `last_execution_record`: who stopped, when, and what durable state was written.

A field may be empty only when genuinely not applicable or not yet known; use an explicit state such as `PENDING`, `NOT_APPLICABLE` or `UNKNOWN_GOVERNED`, never an ambiguous blank.

## 5. Strict execution compliance

### TC-0 — Pickup gate
Before substantive execution, the operator MUST:
1. read Linear;
2. locate and read the authoritative Task Execution Manifest;
3. read the manifest's governing inputs;
4. verify that required stores/access for the next action are available;
5. verify the manifest checkpoint is consistent with the material artifacts it points to.

If no manifest exists for an active substantive task, **create/bootstrap it before continuing substantive work**.

### TC-1 — Output persistence gate
A material intermediate output is not considered completed until it is:
- stored in the appropriate governed system;
- given a stable retrievable identity;
- added to `working_outputs` or `current_outputs`;
- linked to its consumed inputs where material.

Chat-only output does not count as completed governed work.

### TC-2 — Checkpoint gate
Before an operator pauses, hands off, changes agent, or ends a material execution session, the manifest MUST be updated with:
- completed-through checkpoint;
- current output identities;
- unresolved/open items;
- exact next action;
- blocked actions;
- last execution record.

### TC-3 — Supersession gate
No material working artifact may be silently replaced. Record old → new in `superseded_outputs`, preserving the old immutable identity where applicable.

### TC-4 — QA/promotion gate
QA and Owner decisions must be referenced in the manifest before a candidate is treated as QA'd/frozen/canonical. The manifest itself does not authorize promotion.

### TC-5 — Linear synchronization gate
When checkpoint, next action, blocker, ownership, or acceptance state materially changes, Linear must be synchronized with a concise summary and pointer to the authoritative manifest.

### TC-6 — Shared-log threshold
Update `claude_chatGPT.md` only for cross-agent QA, Owner decisions, governance exceptions, material gate changes or handoffs requiring permanent chronology. Routine progress belongs in the manifest.

## 6. Failure states and enforcement

Use these task-continuity failure states:
- `BLOCKED_TASK_MANIFEST_MISSING`
- `BLOCKED_WORK_OUTPUT_NOT_PERSISTED`
- `BLOCKED_CHECKPOINT_STALE`
- `BLOCKED_OUTPUT_IDENTITY_AMBIGUOUS`
- `BLOCKED_SUPERSESSION_UNRECORDED`
- `BLOCKED_REQUIRED_STORE_ACCESS`
- `BLOCKED_LINEAR_MANIFEST_DRIFT`

An operator encountering one of these conditions must repair the continuity state before advancing substantive work.

No agent may waive this standard for its own task. Exceptions require explicit Owner/Governor decision recorded in Linear and the canonical shared log.

## 7. Applicability and bootstrap rule

- All **new substantive tasks**: manifest required before substantive execution.
- All **currently active substantive tasks**: bootstrap a manifest before the next substantive execution step.
- **Closed historical tasks**: no retroactive manifest required unless reopened or consumed as an active dependency; then bootstrap a recovery manifest before use.
- Tiny administrative actions that create no material output may be recorded directly in Linear and need not create a manifest.

## 8. Closure requirement

A substantive task cannot be marked governed-complete until its manifest identifies:
- exact final/governed outputs;
- QA/approval state;
- superseded candidates;
- unresolved/deferred items and their real future gate;
- custody/recovery identity where applicable;
- downstream consumer/dependency;
- closure checkpoint.

This standard complements, and does not replace, the Canonical Generation & Freeze-Asset Standard V1 and Controlled Phase Execution & Recovery Gate V1.
