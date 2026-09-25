# AR0.0 — Architecture Challenge Register

Status: AWAITING_OWNER_REVIEW  
Date: 11 September 2026  
No frozen architecture mutation performed.

## Sufficiency test
The existing architecture will be considered sufficient without an additional design-selection capability only if it can prove all of the following from governed contracts:
1. Canonical work can be lowered deterministically without hidden semantic assumptions.
2. Client-specific facts remain bindings rather than contaminating domain truth.
3. Given the same canonical work and client context, Atlas can identify all materially feasible executor/runtime patterns rather than requiring a human to choose an adapter first.
4. Atlas can represent a hybrid solution spanning multiple executor/runtime classes.
5. Atlas can evaluate competing patterns against explicit requirements such as SLA, volume, interface capability, ambiguity, risk, security, resilience, economics and human constraints.
6. Atlas can retain the reason a design was selected and why alternatives were rejected.
7. Runtime adapters receive an already-governed execution design and do not invent business semantics or silently perform ungoverned architecture selection.
8. End-to-end lineage can trace source/domain semantics -> WorkDefinition -> client binding -> design decision -> runtime projection -> execution evidence.

## Challenges to frozen V1 / pending contracts

### AR-C01 — Runtime selection is procedural but not governed
Severity: HIGH

The frozen client-binding flow instructs the system to select a target runtime adapter before collecting/validating runtime-specific bindings and producing a projection. Runtime adapters declare capability and assess compatibility after selection. No first-class governed contract was found that explains how the target adapter is selected.

Test in AR0.1: determine whether this is intentionally external human design authority or an omitted Atlas capability. If external by design, Atlas cannot independently ideate executable solutions without a new governed mechanism.

### AR-C02 — Cross-runtime candidate generation is absent
Severity: HIGH

No governed artifact was found that takes a WorkDefinition plus client/environment constraints and emits multiple feasible solution candidates such as API-only, workflow+human, document-AI+rules+HITL, RPA+workflow or agent+API+human.

Test in AR0.1: attempt solution generation using current contracts only and record every assumption that cannot be sourced.

### AR-C03 — Hybrid composition is recognized but underspecified
Severity: HIGH

`HYBRID_HITL` exists as an executor class and requires transfer points/ownership/evidence/state transition to be explicit. However, no governed synthesis/composition model was found for assembling multiple executor/runtime components into one solution architecture.

Test: distinguish hybrid executable leaf classification from hybrid solution topology across multiple leaves/services/adapters.

### AR-C04 — Solution-selection requirements are distributed but not assembled
Severity: HIGH

Several inputs already exist in legitimate layers: client systems/interfaces, fields/mappings, SLA/thresholds, policy variants, security/credentials, system-exchange mechanisms, temporal constraints, cost/service/risk measurements, ambiguity and HITL controls. What is missing may be an explicit design-context projection that assembles these facts without duplicating their source ownership.

Test: determine whether a new layer should own new truth or merely reference/normalize existing governed truth for design decisions.

### AR-C05 — Workload and operating-volume characteristics lack clear ownership
Severity: MEDIUM-HIGH

No first-class governed selection semantics were found for transaction volume, arrival pattern, peaks/seasonality, burstiness, concurrency demand or batch size. These can materially change whether a solution should use manual work, RPA, synchronous API, event processing, batch automation or another pattern.

Test: decide whether these belong in client binding, execution requirements, measurement/profile contracts or runtime capacity planning.

### AR-C06 — Human capacity/skill constraints lack clear ownership
Severity: MEDIUM-HIGH

Human boundary and authority are modeled, but staffing capacity, coverage windows, skills, handling time/cost and availability are not clearly first-class design-selection inputs.

Test: determine whether these are optional transformation-design facts or mandatory executable architecture requirements.

### AR-C07 — Non-functional requirements are incomplete for solution selection
Severity: MEDIUM-HIGH

Current contracts do not expose a coherent selection model for availability, resilience, recoverability, RTO/RPO, observability, auditability at runtime, throughput and related NFRs.

Test: separate universally required execution semantics from architecture-option scoring criteria and runtime deployment configuration.

### AR-C08 — WorkDefinition control-flow grammar remains pending
Severity: HIGH

The Work Decomposition and WorkDefinition machine-readable contracts are still `IMPLEMENTATION_PENDING`. Before implementation, they must be tested for explicit representation of parallelism, joins, correlation, multi-instance work, ordering, idempotency, compensation/transaction boundaries, durable state and timeout ownership.

Test: create adversarial work patterns that cannot be safely compiled if these semantics are implicit.

### AR-C09 — Executor eligibility versus executor selection must be separated
Severity: HIGH

The frozen executability standard defines when a leaf is sufficiently specified for an intended executor class. This should not be mistaken for a method that selects the best executor class or runtime architecture.

Test: prove whether `executorEligibility` can remain a property of canonical WorkDefinition while actual solution selection occurs downstream.

### AR-C10 — Economics exist as measurements, not decision logic
Severity: MEDIUM

Measurement contracts support COST/REVENUE/QUALITY/SERVICE/RISK, but no governed selection rule uses implementation/run cost, expected benefit, exception cost, operating leverage or transition cost to compare solution candidates.

Test: determine the minimum economics contract needed for recommendation versus what remains advisory analytics.

### AR-C11 — Design decision provenance is absent
Severity: HIGH

Current lineage can trace canonical work, client binding and runtime projection, but there is no explicit artifact for candidate designs, rejected alternatives, trade-offs and selected solution rationale.

Test: determine whether solution-design decisions must be persisted as governed evidence for reproducibility and audit.

### AR-C12 — Do not create a monolithic “Execution Requirements” dumping ground
Severity: GOVERNANCE GUARDRAIL

A new layer would be harmful if it duplicated domain rules, client values, interface definitions, measurements or runtime capability declarations already governed elsewhere.

AR0.1/AR0.2 must prefer references/composition over semantic duplication and must preserve one authoritative owner per fact.

## AR0.0 disposition
The challenge is VALID and materially narrower than the initial hypothesis.

Current evidence does **not** justify saying “V1.1 is insufficient because it lacks executor-aware semantics.” Executor-aware executability already exists.

Current evidence **does** justify rigorously testing whether Atlas lacks a governed bridge for **solution synthesis, hybrid composition, cross-runtime comparison and selection**, and whether the pending canonical WorkDefinition grammar is complete enough for deterministic execution.

No successor architecture or new layer is approved at AR0.0.
