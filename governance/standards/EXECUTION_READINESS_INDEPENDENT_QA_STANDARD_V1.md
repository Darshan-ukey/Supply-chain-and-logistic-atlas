# Execution-Readiness Independent QA Standard V1

Status: OWNER-AUTHORIZED INDEPENDENT QA METHODOLOGY  
Effective: 2026-09-27  
Origin: Atlas QA Process Shift from Compliance-Verification to Execution-Readiness Validation  
Governance Head: TBD (to be pinned when QA cycle completes)

## Purpose

Shift Atlas QA from compliance-verification ("Did you follow the rules? Is the process correct?") to **execution-readiness validation** ("Can downstream execution actually happen with what was delivered?").

This standard defines the questions, acceptance criteria, and evidence requirements for independent QA of Atlas critical-path tasks.

## Core Principle

> The governing QA question is not "Does this pass compliance checks?" but **"Can downstream executors actually use this without rediscovering material information?"**

QA is not about validating that builders did their work correctly. QA is about ensuring that the **product of the work is actually usable by the next executor or downstream phase**.

## Execution-Readiness QA Framework

Every independent QA assessment must answer these core questions:

### 1. **Deliverable Completeness and Accessibility**

**Question:** Can a downstream executor or next phase actually locate, access and use what this task claims to deliver?

Specific QA checks:
- [ ] All declared outputs are explicitly enumerated with exact location/identity (GitHub path, Linear link, database record, etc.)
- [ ] Outputs are not claimed to exist in memory, chat history, temporary deployments, or untracked files
- [ ] Where output is generated/derived (code, schema, config), the Generation Registry entry or Canonical Asset entry is linked and accessible
- [ ] If output points to external source (API, third-party doc, archived artifact), the link is verified as accessible and not ephemeral
- [ ] For knowledge/evidence outputs (research findings, decision records, proofs), the evidence is traceable to primary sources with exact citations

**Failure modes to detect:**
- Output exists only in chat or a builder's local working directory
- Output is claimed as "in progress" but marked task complete
- Evidence points to a temporary environment or a session that no longer exists
- Output is described generically ("the research," "the design") without specific artifact identity

### 2. **Hidden Execution Blockers**

**Question:** Does the current deliverable actually enable downstream work, or are there material gaps or blockers hidden beneath a "Done" or "Pass" status?

Specific QA checks:
- [ ] If task claims evidence is "recovered" or "frozen," verify it is actually accessible (read: do the files exist and are they the right ones?)
- [ ] If task marks something "Done" but explicitly states "No mutation authorized" or equivalent, identify WHERE that deliverable is supposed to be used and confirm it is actually accessible there
- [ ] For migration/schema/data tasks marked "Done," verify the change is actually applied to the target system, not merely "designed" or "tested locally"
- [ ] For QA-upstream tasks (design, requirements, evidence gathering), ask: "Is this sufficiently detailed that a builder can execute without asking clarifying questions?"
- [ ] For QA-downstream tasks (build, apply, deploy), ask: "Does the upstream material actually support this work, or are there material gaps?"
- [ ] Check whether the task's acceptance criteria are tied to **execution reality** ("downstream can execute") or merely **process compliance** ("we followed the standard")

**Failure modes to detect:**
- Task marked DONE shows governance compliance but hides that actual system change was not applied
- Task shows design approval but design lacks sufficient detail for execution
- Task marks schema/DDL "verified" but the DDL was never run against actual database
- Task shows evidence "recovered" but that evidence is not accessible to downstream work
- Task requires follow-on work to be "unblocked" but no follow-on task clearly owns resolution

### 3. **Dependency and Prerequisite Closure**

**Question:** Are all upstream dependencies actually closed, or will the next phase discover unmet prerequisites?

Specific QA checks:
- [ ] For tasks that consume prior outputs, verify the prior outputs have stable identity and are actually accessible
- [ ] If task depends on a prior task's "proof" (recovery drill, executable gate, validation), verify that proof actually exists and is accessible
- [ ] If task claims to have "resolved" a dependency, follow the chain: Is the resolution recorded in the target system (not just in Linear description)?
- [ ] If task explicitly defers a blocker to a future task, verify that future task exists, has an owner, and is scheduled before any task that would be blocked
- [ ] For cascading dependencies (A blocks B blocks C), verify the chain is explicit and each phase knows what it depends on

**Failure modes to detect:**
- Task marked complete but depends on a prior task that is still "In Progress"
- Task shows a blocker deferred to "future work" with no explicit task or owner
- Next phase will discover it cannot execute because prior phase's proof never materialized
- Dependency closure recorded only in Linear, not in actual artifact/system state

### 4. **Information Sufficiency for Execution**

**Question:** Does the deliverable contain all the information a downstream executor needs, or will they have to rediscover material business logic, rules, or evidence?

Specific QA checks:
- [ ] For domain/process work (ATL-60, ATL-119, CDS), check whether the work includes:
  - [ ] All relevant information objects, fields, and relationships identified
  - [ ] Source authority and precedence documented (where does each piece come from?)
  - [ ] Business rules, conditions, and exceptions explicitly catalogued (not implied)
  - [ ] Lifecycle/state transitions and permitted transitions documented
  - [ ] Identity and relationships clearly modeled
  - [ ] Gaps and unknowns explicitly listed (not hidden)
- [ ] For schema/physical design work (ATL-82, ATL-123), check whether the work includes:
  - [ ] All tables, columns, constraints, and indexes explicitly justified
  - [ ] Migration/rollback logic executable and tested (not merely "designed")
  - [ ] Application assumptions documented (what must the app do to use this schema correctly?)
  - [ ] Known limitations and edge cases documented
- [ ] For QA/validation work, check whether QA is tied to **real execution scenarios**, not just theoretical verification

**Failure modes to detect:**
- Design approved but lacks sufficient detail for a builder to implement without rework
- Schema designed but application usage patterns are not documented
- Evidence gathered but gaps/unknowns are not explicitly listed
- Rules documented as "inferred from evidence" without explicit source citation

### 5. **Verification and Proof Reality**

**Question:** If the task claims something is "verified," "proven," or "tested," is that verification actually repeatable and traceable, or is it dependent on a builder's actions in a now-lost environment?

Specific QA checks:
- [ ] For executable proofs (SQL gates, build tests, verification harness):
  - [ ] Proof is recorded in an immutable artifact (CI log, GitHub commit, committed test output) with exact identity
  - [ ] Proof can be re-run from committed inputs/code without the original working environment
  - [ ] If proof depends on external service (database, API), verify the service state was recorded or proven deterministically reproducible
- [ ] For design/research QA:
  - [ ] QA is recorded in a traceable artifact, not just "signed off" in Linear
  - [ ] QA evidence is proportional to risk (high-risk work gets detailed QA; low-risk gets lighter scrutiny, but scrutiny is still recorded)
- [ ] For recovery/rebuild proofs:
  - [ ] Proof actually exercises the recovery path (not merely a code review of recovery logic)
  - [ ] Proof is recorded with exact inputs, outputs, and environment state

**Failure modes to detect:**
- Task claims "tested" but test output is not recorded or accessible
- Task shows "QA passed" but QA work exists only in a Linear comment, not in traceable evidence
- Task claims "recovery proven" but recovery drill never actually ran
- Proof depends on "expert manual verification" that is not documented

### 6. **Governance Closure State**

**Question:** Is the task's closure state actually recorded in the governance system with sufficient detail that a future team could understand what was approved, what was deferred, and what the next phase should expect?

Specific QA checks (per CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1):
- [ ] All outputs are enumerated with identity and location (PC-1)
- [ ] Authoritative source-of-truth is frozen and recorded (PC-2)
- [ ] Control mechanism is preserved (PC-3)
- [ ] Working system state is backed up where applicable (PC-4)
- [ ] Recovery/rebuild proof is actual and recorded (PC-5)
- [ ] Dependencies are closed or explicitly deferred (PC-6)
- [ ] Rollback point and next-phase authorization are recorded (PC-7)

For tasks that use generation/derivation logic:
- [ ] Generator Contract is recorded with exact version/identity
- [ ] Generation Registry entry exists and is linked
- [ ] Frozen-input snapshot is recorded and immutable
- [ ] Output hash/identity can be reproduced from recorded inputs

**Failure modes to detect:**
- Task marked complete but PC-1–PC-7 are not fully recorded
- Task creates a frozen baseline that next phase is supposed to consume, but baseline has no stable identity
- Generated output is approved but Generator Contract or Generation Registry entry is missing
- Task defers a blocker to "future governance" with no explicit tracking mechanism

## Per-Task Execution-Readiness Assessment

For each critical-path task under QA, produce a structured assessment:

```
## [TASK ID] — [Title]

### Deliverable Completeness
- [ ] Outputs enumerated with location/identity
- [ ] All outputs accessible (not in memory/temp environments)
- [ ] Evidence is primary or clearly sourced

**Finding:** [What is complete; what is missing or unclear]

### Hidden Blockers
- [ ] No hidden gaps between "claimed complete" and "ready for next phase"
- [ ] System-state changes (schema, data, config) actually applied
- [ ] Design/requirements sufficiently detailed for execution

**Finding:** [What blockers exist; what is ready to proceed]

### Dependency Closure
- [ ] All upstream dependencies closed or explicitly deferred
- [ ] Deferral targets are explicit (task, owner, closure condition)
- [ ] Downstream task has clear understanding of prerequisites

**Finding:** [What dependencies are clear; what must be resolved before proceeding]

### Information Sufficiency
- [ ] Downstream executor has all required business logic, rules, evidence
- [ ] Gaps and unknowns are explicitly listed
- [ ] Sources and authorities are documented

**Finding:** [What information suffices; what gaps or unknowns remain]

### Verification Reality
- [ ] Proofs/verifications are repeatable from recorded artifacts
- [ ] Proof does not depend on builder's now-lost working environment
- [ ] Governance closure state is fully recorded

**Finding:** [What proofs are solid; what was claimed but not proven]

### Governance Closure
- [ ] PC-1–PC-7 from CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1 are satisfied
- [ ] For generated work, Generation Contract/Registry/Frozen-Input are recorded
- [ ] Rollback point and next-phase authorization are explicit

**Finding:** [What closure is complete; what must be resolved]

### QA Verdict
- **Ready for Next Phase:** All categories show "OK" or explicitly deferred with clear target
- **Blocked Pending:** [Specific blockers with resolution paths]
- **Ready with Cautions:** [Acknowledged risks that downstream must manage]

### Owner Recommendation
[Specific guidance for next phase, unresolved risks, recommended pre-execution checks]
```

## When to Apply This QA

Apply this execution-readiness lens to:
- Any critical-path task (Urgent priority in Linear)
- Any task that creates a frozen/canonical baseline for downstream consumption
- Any task that claims evidence is "recovered," "proven," "verified" or "complete"
- Any task whose "Done" status hides blockers or gaps

Do **not** apply heavy execution-readiness QA to:
- Tasks still in "In Progress" or early research phases (lighter scrutiny is appropriate)
- Administrative/housekeeping tasks with no downstream dependencies
- But **always record** what gaps exist even in incomplete work, so downstream team knows what to expect

## Escalation States

Record QA findings in one of these states:

- **READY_FOR_NEXT_PHASE** — All checks pass; downstream may proceed
- **READY_WITH_CAUTIONS** — Passes with acknowledged risks; document what downstream must manage
- **BLOCKED_PENDING_[SPECIFIC]** — Cannot proceed until specific blocker is resolved
  - Examples: `BLOCKED_PENDING_UPSTREAM_PROOF`, `BLOCKED_PENDING_GOVERNANCE_CLOSURE`, `BLOCKED_PENDING_SYSTEM_STATE_VERIFICATION`
- **OWNER_DECISION_REQUIRED** — QA has identified ambiguity that only Owner can resolve (e.g., "Is this acceptable risk?" or "Should we accept this gap?")

## QA Record Custodian

Execution-readiness QA findings are recorded in:
- Linear issue for the task (add `Execution-Readiness QA` label and link to detailed assessment)
- Governance artifact (GitHub governance standard or shared log) if work spans multiple tasks
- Shared baton/coordination log if handoff to next phase requires context

Do not let QA findings exist only in agent working sessions or Linear comments without a durable governance record.

## Cross-Agent QA Protocol

When independent QA is performed by a different agent than the builder:
- [ ] QA agent has access to all builder output and governance records
- [ ] QA assessment is recorded with QA agent identity and date
- [ ] Builder is given opportunity to respond to blocking findings
- [ ] Closure decision includes how builder's response was handled
- [ ] If QA and builder disagree, escalate to Owner for decision

## Relationship to Other Standards

This standard applies the execution-readiness philosophy from `ATLAS_EXECUTION_READINESS_DERIVATION_METHOD_V1.md` specifically to QA activities.

It operationalizes the phase-closure requirements from `CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` by asking: "Are the PC-1–PC-7 requirements actually satisfied, or are we claiming closure without evidence?"

It complements `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` for work that produces governed/generated/frozen outputs.

## Revision History

- **2026-09-27** — Created. Owner-authorized methodology shift from compliance QA to execution-readiness QA.
