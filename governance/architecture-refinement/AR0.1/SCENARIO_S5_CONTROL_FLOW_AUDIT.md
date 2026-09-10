# AR0.1 Scenario S5 — Adversarial Control-Flow Sufficiency Audit

Status: AUDIT EVIDENCE CANDIDATE  
Stage: AR0.1  
Scenario: `S5_ADVERSARIAL_CONTROL_FLOW`

## 1. Test question
Are the current frozen Work Decomposition / WorkDefinition semantics formal enough to hand a non-trivial business workflow to an independent implementation platform without that platform having to invent business-significant topology?

This is a grammar stress test, not a new Road LTL business claim. It tests generic patterns that can occur in enterprise work: dependent validations, parallel work, joins, waits for external events, timeouts, retries, duplicate/stale events, recovery and compensation.

## 2. What the frozen architecture already owns
The frozen architecture explicitly assigns Atlas ownership of:
- canonical states/events;
- decisions/rules/controls/actions;
- canonical transitions;
- waits/timers;
- retries/escalations/recovery;
- work decomposition;
- evidence/outcomes;
- HITL boundaries.

The Canonical Execution Flow Generator is expected to visualize gateways, waits/timers, loops/retries and exceptions/recovery from Work Decomposition + WorkDefinition alone. Therefore any business-significant topology required to generate those paths cannot be dismissed as merely runtime-specific.

## 3. Existing positive evidence
LTL-04 demonstrates several relevant semantics already exist in current content:
- pickup request identifier correlates request/response/update/cancel lifecycle;
- explicit pass/fail branch transitions;
- controlled failure state;
- recovery reference;
- request/response correlation control;
- idempotency requirement;
- stale-version rejection;
- acknowledgement expectation;
- controlled retry without duplicate business effects;
- temporal constraint for pickup response SLA/local cut-off.

This is strong evidence that Atlas already recognizes these business-correctness concerns.

## 4. Adversarial patterns

### P1 — Ordered dependent gates
Pattern: Gate B is valid only after Gate A has passed, and Action C is permitted only after both are satisfied.

Current state: tasks such as LTL-04 carry multiple gate-specific pass/fail transitions, but the records do not provide a generic machine grammar proving ordering/dependency among all gates and actions.

Classification: `INFERABLE_BUT_UNGOVERNED`.

Why it matters: a runtime must not be forced to guess whether gates are sequential, independent, repeated or conjunctive when that changes business correctness.

### P2 — Parallel branches and join
Pattern: two independent business checks may proceed concurrently, but a downstream action requires both results; alternatively, one branch may cancel the other.

Current state: the architecture conceptually supports a graph/gateways, but no explicit machine-readable parallel/join/multi-instance grammar has been found in the pending Work Decomposition/WorkDefinition descriptions.

Classification: `INFERABLE_BUT_UNGOVERNED`.

Why it matters: parallelism is a runtime optimization only when ordering does not affect business semantics. A required `AND`/`OR` join or cancellation dependency is canonical business topology.

### P3 — External wait and timeout
Pattern: work pauses for an external event; if it arrives before a governed deadline, continue; otherwise a different business path begins.

Current state: `WAIT_EVENT`, temporal constraints, clocks, transitions and escalation/recovery are explicit canonical concepts.

Classification: `FULLY_GOVERNED_EXISTING_CONTRACT` at semantic ownership level; `INFERABLE_BUT_UNGOVERNED` for complete generic machine linkage among wait, correlated event, timeout and alternate transition.

### P4 — Correlated event / duplicate / stale response
Pattern: a response must be matched to the exact open request/version. Duplicate or stale responses cannot create a second business effect.

Current state: LTL-04 explicitly carries pickupRequestId, correlation, idempotency and stale-version rejection. However, the generic System Exchange schema does not define correlation keys, idempotency keys, deduplication semantics or stale-event policy as first-class properties.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### P5 — Retry versus business re-execution
Pattern: a technical retry may repeat an API call without repeating the underlying business action; a business retry may intentionally re-enter the work after prerequisites are restored.

Current state: frozen architecture distinguishes retry/recovery concepts and LTL-04 says retry is controlled and must not duplicate effects. The generic contract does not yet formalize retry scope/idempotency boundary sufficiently to prove a safe projection.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### P6 — Compensation / reversal
Pattern: a previously committed action must be reversed or compensated because a later business condition fails.

Current state: recovery exists as a canonical concept, but no explicit generic compensation/transaction-boundary semantic has been found in current machine contracts.

Classification: `INFERABLE_BUT_UNGOVERNED` when compensation is part of business correctness; runtime-specific transaction implementation remains `DOWNSTREAM_RUNTIME_SPECIFIC_OUTSIDE_ATLAS`.

### P7 — Multi-instance work
Pattern: one parent work item creates N governed child instances (for example per object/line/item), with a defined completion rule such as all/any/quorum.

Current state: object cardinality exists, but no generic multi-instance execution/topology contract has been found.

Classification: `INFERABLE_BUT_UNGOVERNED`.

## 5. Executor-neutrality stress test
The frozen Execution Fabric describes Work Decomposition as **executor-neutral executable-work topology**, while the frozen executability standard says decomposition continues until each work unit is unambiguous enough for the **intended executor class**.

These statements are not necessarily incompatible, but the boundary is not sufficiently formalized.

Two interpretations are possible:
1. canonical decomposition is stable and executor-neutral; executor-specific stopping criteria are only a validation lens applied after canonical decomposition; or
2. decomposition depth changes depending on whether the intended executor is human, RPA, API, agent, etc.

If interpretation 2 is intended, the canonical decomposition itself becomes partly executor-dependent, which weakens cross-runtime reusability and conflicts with the stated goal of one canonical Atlas execution language.

AR0.1 does not decide this. AR0.2 must make the rule explicit.

Classification: `INFERABLE_BUT_UNGOVERNED` boundary ambiguity.

## 6. Canonical versus runtime-specific control flow
AR0.1 supports this boundary:

### Canonical when business correctness depends on it
- required predecessor/successor dependency;
- business-significant branch condition;
- required AND/OR completion rule;
- state transition;
- event correlation identity where wrong correlation changes business outcome;
- deadline/timeout and its business consequence;
- business retry/re-entry rule;
- duplicate/stale-event rejection requirement;
- compensation/reversal obligation;
- evidence/completion condition.

### Runtime-specific when implementation can vary without changing business meaning
- thread/process implementation;
- worker pool size;
- queue technology;
- exact orchestration framework;
- transaction-manager implementation;
- polling versus subscription where business semantics are preserved;
- vendor-specific gateway/node representation;
- technical retry library/backoff implementation within canonical constraints.

## 7. Defects exposed by the scenario

### S5-D01 — Pending canonical grammar lacks formal topology constructs
The current pending contract descriptions enumerate semantics but do not define a machine grammar for ordering, dependency, parallel/join, multi-instance and correlated wait/event behavior.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S5-D02 — System Exchange contract is too small for business-critical interaction semantics
The schema models producer, consumer, payload, interface type and acknowledgement, but not first-class correlation/idempotency/duplicate/stale/atomicity semantics. Current daughter content can carry these as free-form properties, but that is not equivalent to a validated reusable contract.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S5-D03 — Retry/recovery/compensation boundaries need formal distinction
The architecture recognizes retry and recovery, but a deterministic implementation handoff needs enough structure to distinguish technical retry, business re-entry, recovery and compensation where these change business effects.

Classification: `INFERABLE_BUT_UNGOVERNED`.

### S5-D04 — Executor-neutral stopping rule is ambiguous
The canonical decomposition must not change simply because a target runtime changes unless Atlas explicitly intends executor-specific projections/decompositions below a stable canonical level.

Classification: `INFERABLE_BUT_UNGOVERNED` boundary decision for AR0.2.

## 8. Scenario disposition
**PARTIAL FAIL — SEMANTIC VOCABULARY IS STRONG; FORMAL CONTROL-FLOW GRAMMAR IS NOT YET SUFFICIENT FOR DETERMINISTIC COMPLEX HANDOFF.**

This is one of the clearest architecture refinements surfaced by AR0.1. It does not justify runtime-specific queues/nodes in canonical Atlas. It does justify testing a more explicit canonical topology grammar before the pending Work Decomposition and WorkDefinition contracts are implemented.
