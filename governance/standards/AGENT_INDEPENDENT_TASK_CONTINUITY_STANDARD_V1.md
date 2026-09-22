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


## 9. Universal governed execution protocol — BUILD → VERIFY → PROVE → ADVANCE

**Owner-authorized hard rule:** the same execution mechanism applies regardless of operator, interface, session, or tool. ChatGPT, Claude, another AI agent, automation, developer tool, and human operators are all subject to the same gates. No operator may substitute memory, chat context, claimed intent, or self-reported completion for governed task state and verification evidence.

### 9.1 Mandatory entry sequence — LINEAR → MANIFEST → GOVERNANCE → ARTIFACT STATE → EXECUTE

Before performing any substantive Atlas work, every operator MUST execute this sequence in order:

1. **LINEAR — determine what must be done.**
   - Open the exact Linear task.
   - Confirm task identity, status, priority, parent/dependencies/blockers, execution owner, acceptance/exit criteria and current gate.
   - Do not infer the next task from chat history.

2. **MANIFEST — determine where execution actually stopped.**
   - Open the authoritative Task Execution Manifest referenced by the task.
   - Confirm current checkpoint, current/superseded outputs, exact next action, authorized actions, blocked actions, required inputs and expected outputs.
   - If Linear and the manifest disagree materially, stop with `BLOCKED_LINEAR_MANIFEST_DRIFT` and reconcile before substantive execution.

3. **GOVERNANCE — determine how the work must be performed.**
   - Read the exact standards, contracts, Owner decisions and QA dispositions referenced by the manifest for the next action.
   - Acceptance criteria MUST be known before execution. They may not be rewritten after seeing the result merely to obtain a pass.

4. **ARTIFACT STATE — verify the starting state.**
   - Read/query the actual governed artifacts and stores that the task says are current.
   - Verify cited identities/commits/versions/hashes where material.
   - Never treat a prior operator's summary, chat statement, correction log or intended edit as proof of actual state.

5. **EXECUTE — perform only the authorized next action.**
   - Stay within the task's scope and blocked-action boundary.
   - If execution exposes a material new dependency or architecture decision, persist it and return to the applicable governance gate rather than silently expanding scope.

This sequence is mandatory on a fresh session, resumed session, cross-agent handoff, manual intervention and tool-driven execution.

### 9.2 BUILD

BUILD creates or changes the authorized work product.

A BUILD result is only `IMPLEMENTED_UNVERIFIED` until VERIFY completes. The operator MUST NOT describe it as complete, closed, frozen, promoted, canonical or passed merely because a write/tool call succeeded.

Material BUILD outputs must be persisted with stable identity before VERIFY.

### 9.3 VERIFY

VERIFY inspects the **resulting state after the write**, not the intended change or the command used to create it.

The verification method must fit the artifact:

- code: tests, lint/build/type checks and direct inspection where material;
- governance/Markdown/YAML/JSON: re-fetch/read the committed object, parse/structural checks where available, and sanity checks for malformed escapes, broken syntax, missing sections/claims and unintended changes;
- database/schema: read/query the resulting schema/data/constraints/migrations and compare with the authorized design;
- generated knowledge: validate IDs, versions, ownership zones, provenance, evidence links, lineage, contracts, hashes, unresolved gaps and required relationships;
- generated artifacts: compare exact output against predetermined acceptance criteria and consumed-input identities.

The same operator MAY perform first-party VERIFY, but verification evidence must be derived from the resulting artifact/state. Intention is not evidence.

If VERIFY fails, status remains unadvanced. Repair returns to BUILD and then repeats VERIFY.

### 9.4 PROVE

PROVE records sufficient durable evidence that VERIFY actually passed.

At minimum the proof record must identify:
- exact artifact/output identity;
- exact verification method/checks;
- result of each material acceptance check;
- test/query/validator evidence or governed inspection result;
- unresolved limitations;
- operator;
- time/run/commit identity where applicable.

Where independent QA is required by the governing task/contract, first-party verification is necessary but not sufficient. Independent QA must inspect the actual resulting state and its evidence before the applicable promotion/advance gate.

A statement such as “done”, “fixed”, “verified” or “tests passed” without retrievable proof does not satisfy PROVE.

### 9.5 ADVANCE

Only after required BUILD + VERIFY + PROVE gates pass may the operator:
- update the task checkpoint as completed-through;
- change a candidate's QA/promotion state;
- change Linear status/gate;
- authorize the next dependent action;
- describe the governed step as complete.

ADVANCE must synchronize:
1. Task Execution Manifest;
2. Linear, when checkpoint/gate/status materially changes;
3. canonical shared log when TC-6 threshold is met;
4. any generation/promotion registry required by the governing contract.

**No evidence → no completion.  
No post-write verification → no proof.  
No predetermined acceptance criteria → no pass decision.  
No required independent QA → no promotion.  
No silent correction → preserve correction/supersession history.**

### 9.6 Mandatory execution-state vocabulary

Use these states when material:
- `AUTHORIZED_NOT_STARTED`
- `IMPLEMENTED_UNVERIFIED`
- `VERIFICATION_FAILED`
- `VERIFIED_FIRST_PARTY`
- `PROOF_RECORDED`
- `INDEPENDENT_QA_REQUIRED`
- `INDEPENDENT_QA_PASSED`
- `OWNER_AUTHORIZATION_REQUIRED`
- `GOVERNED_COMPLETE`

A tool/API success response alone can move work only to `IMPLEMENTED_UNVERIFIED`.

### 9.7 Additional failure states

In addition to §6:
- `BLOCKED_ACCEPTANCE_CRITERIA_UNDEFINED`
- `BLOCKED_POST_WRITE_VERIFICATION_MISSING`
- `BLOCKED_VERIFICATION_EVIDENCE_MISSING`
- `BLOCKED_INDEPENDENT_QA_REQUIRED`
- `BLOCKED_EXECUTION_SCOPE_DRIFT`
- `BLOCKED_RESULT_STATE_MISMATCH`

These cannot be self-waived by the executing operator.

### 9.8 Manual work and external tools

Manual edits, local scripts, IDE changes, database consoles, browser actions, CI/CD, agent tools and third-party execution systems are not exceptions. The operator performing or directing the change must ensure the resulting governed state passes the same BUILD → VERIFY → PROVE → ADVANCE sequence and is reflected in the authoritative task records.

If a tool cannot produce durable verification evidence, its output cannot by itself satisfy PROVE.

## 10. Atlas execution-integrity objective

Atlas's product thesis depends on reliable transformation of governed domain knowledge into execution-ready specifications and projections/adapters consumable by downstream executors.

Accordingly, Atlas development itself must demonstrate the same discipline expected from Atlas-generated execution:

**governed instruction → deterministic/bounded build → resulting-state verification → durable proof → controlled state transition.**

Governance artifacts are controls, not substitutes for empirical execution. Architecture refinement must terminate when its governed acceptance criteria are satisfied and move to the next empirical proof. For the current LTL-03 path, real domain facts must be dry-run through the candidate knowledge/readiness model before physical DDL is frozen, and the workstream must continue toward the predetermined ATL-70 benchmark/ground-truth gate and ATL-71 execution experiment rather than accumulating unbounded schema refinement.


## 11. Linear-first task creation and discovered-prerequisite rule

### 11.1 Every substantive new task must exist in Linear before execution

Every newly identified substantive unit of Atlas work MUST be created as its own Linear task **before substantive execution begins**.

This applies whether the task is identified:
- during planning;
- during BUILD, VERIFY, PROVE or independent QA;
- by ChatGPT, Claude, another AI agent, automation, developer tooling or a human;
- as a prerequisite, defect correction, experiment, dry-run, research action, migration, validator, recovery action or newly discovered dependency.

A material task may not exist only in chat, a shared log, a local to-do list, a GitHub note or an agent's internal plan.

Tiny administrative actions that create no independent material output remain covered by §7 and need not become separate issues.

### 11.2 Every new Linear task must carry the execution mechanism

At creation, every substantive Linear task must state or inherit, in a mechanically discoverable way:

1. **Purpose / decision being enabled** — why the task exists.
2. **Scope** — exact work authorized and explicit exclusions.
3. **Inputs / governing references** — authoritative standards, contracts, prior outputs, evidence and upstream task identities.
4. **Execution owner and decision authority.**
5. **Dependencies / blockers** — including the task it blocks or is blocked by.
6. **Required output(s)** — exact durable artifact/evidence expected and target governed store.
7. **Predetermined acceptance / exit criteria** — what must be true before the task can pass.
8. **Verification / proof requirement** — how resulting state will be checked and what durable evidence must be recorded.
9. **Independent QA / Owner gate** where required.
10. **Explicit execution protocol:** `LINEAR → MANIFEST → GOVERNANCE → ARTIFACT STATE → EXECUTE`, then `BUILD → VERIFY → PROVE → ADVANCE`.
11. **Blocked actions / non-authorizations** relevant to the task.
12. **Task Execution Manifest pointer/status.**

If these are not defined sufficiently to execute deterministically, the task is not execution-ready and substantive BUILD must not begin.

### 11.3 Discovered prerequisite / emergent-task gate

If, while executing a current task, an operator discovers that another substantive task must be completed before the current task can be correctly verified, proven, executed or advanced:

1. **STOP advancement of the current task at the exact discovered dependency.**
2. **Create the prerequisite as a separate Linear task before doing its substantive work.**
3. Give the new task the full §11.2 execution contract and bootstrap its Task Execution Manifest.
4. Add explicit Linear dependency relations:
   - prerequisite **blocks** the current task where it is a true gate;
   - current task is **blocked by** the prerequisite.
5. Update the current task's manifest with:
   - discovery;
   - new prerequisite Linear ID;
   - reason it is required;
   - exact blocked action;
   - release condition.
6. Synchronize the current Linear task and, when TC-6 applies, the canonical shared log.
7. Execute the prerequisite through the same `LINEAR → MANIFEST → GOVERNANCE → ARTIFACT STATE → EXECUTE` and `BUILD → VERIFY → PROVE → ADVANCE` gates.
8. Resume the original task only after the prerequisite's required proof/QA/authorization has cleared its release condition.

A discovered prerequisite may not be executed informally inside the parent task merely because it is small or convenient if it produces a material output or changes the proof basis.

### 11.4 No hidden work decomposition

Agents may decompose work internally for trivial steps, but any newly discovered step that has its own material output, acceptance decision, dependency effect, independent QA need, or resumable checkpoint becomes a governed Linear task.

This rule prevents the governed execution path from diverging from the actual work path.
