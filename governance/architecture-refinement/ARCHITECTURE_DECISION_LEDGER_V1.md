# Atlas Architecture Decision Ledger V1

Status: ACTIVE  
Effective: 11 September 2026

## Decision AR-D001 — Architecture refinement precedes R0.4
Decision: APPROVED BY OWNER.

R0.3 is complete. No generic recursive-decomposition recovery/rebuild/rematerialization work begins until the Work Decomposition / WorkDefinition architecture has been critically revalidated.

## Decision AR-D002 — R0.3 completion does not authorize R0.4
Decision: APPROVED BY OWNER.

R0.3 QA PASS closes the recovery stage only. R0.4 remains suspended behind the architecture-refinement gate.

## Decision AR-D003 — Architecture refinement ownership
Decision: APPROVED BY OWNER.

ChatGPT owns architecture-refinement analysis, governance artifacts and independent validation. Claude is not authorized to design, modify or implement architecture-refinement stages unless a later Owner-authorized governance update explicitly changes this.

## Decision AR-D004 — Proposed Execution Requirements / Solution Synthesis layer
Decision: HYPOTHESIS ONLY — NARROWED BY AR0.0 — NOT APPROVED ARCHITECTURE.

AR0.0 shows that Atlas already has substantial executor-aware semantics. The frozen executability standard recognizes HUMAN, DETERMINISTIC_RULES, WORKFLOW, RPA, API_SYSTEM, DOCUMENT_AI, LLM_AGENT and HYBRID_HITL and defines executor-specific decomposition stopping criteria. Client Binding already owns systems/interfaces, fields/mappings, master data, SLA/thresholds, policy variants, authority, exception routing, evidence/audit, security/credentials and environment. System Exchange, Temporal Constraint and Measurement contracts already cover additional design-relevant facts.

The remaining hypothesis is narrower: Atlas may lack a governed bridge that assembles canonical work + client/environment constraints + runtime capabilities to generate, compose, compare and select executable solution architectures before runtime-adapter projection.

## Decision AR-D005 — Frozen V1 remains immutable during challenge
Decision: APPROVED.

`governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md`, Work Decomposition V1.1 and Canonical WorkDefinition V1 are reference baselines. Architecture refinement creates additive analysis and, if approved later, a versioned successor. It does not overwrite historical frozen architecture.

## Decision AR-D006 — Executor-neutral canonical boundary remains the default
Decision: AR0.0 SUPPORTS PRESUMPTION; FINAL DECISION DEFERRED.

Current evidence supports keeping domain/canonical work executor-neutral. Runtime-specific implementation should remain downstream. AR0.1 must test whether selected execution characteristics need first-class representation without turning canonical business truth into technology design.

## Decision AR-D007 — Historical decomposition counts are not design targets
Decision: APPROVED.

Historical 603 work units / 444 leaves and remembered 572/605 figures are forensic evidence only. They must not constrain refined architecture or later deterministic materialization.

## Decision AR-D008 — Success criterion for architecture refinement
Decision: HISTORICAL VALIDATION CRITERION — SUPERSEDED AS PRIMARY OBJECTIVE BY AR-D011.

The earlier criterion tested whether Atlas could support both deterministic derivation of executable semantic work and governed ideation/comparison of executable solution architectures. Owner discussion after AR0.0 clarified that autonomous solution generation is secondary and should not define the primary product architecture.

## Decision AR-D009 — Pending contracts are design opportunity, not recovery target
Decision: AR0.0 FINDING — ACCEPTED FOR NEXT AUDIT.

`CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_PENDING.md` and `CANONICAL_WORKDEFINITION_CONTRACT_VNEXT_PENDING.md` are explicitly `IMPLEMENTATION_PENDING`. The machine-readable canonical contracts were therefore not completed/frozen as implementation. AR0.1 may critically test and refine their proposed grammar before implementation without pretending that a lost implemented contract must be reconstructed.

## Decision AR-D010 — One authoritative owner per fact
Decision: GOVERNANCE GUARDRAIL.

Any future execution-readiness or downstream design layer must reference/assemble existing governed truth rather than duplicate domain rules, client-specific values, interface definitions, temporal constraints, measurements or runtime capability declarations. A monolithic Execution Requirements dumping ground is prohibited.

## Decision AR-D011 — Atlas product North Star
Decision: APPROVED BY OWNER FOR ARCHITECTURE REFINEMENT.

Atlas's primary objective is **execution / implementation readiness**.

Canonical statement:

> Atlas turns reusable domain knowledge into execution-ready enterprise specifications.

Atlas should maintain reusable domain execution-reference knowledge, expose unresolved knowledge, bind the reference model to enterprise/client reality, determine whether implementation-critical semantics are sufficiently resolved, and produce/assemble a technology-neutral implementation-ready specification for downstream use.

Governance is a required trust/control property, not the end product. Execution intelligence is the structured semantic capability used to achieve readiness. Runtime execution remains outside Atlas. Autonomous solution generation, solution selection and runtime architecture recommendation are secondary/downstream capabilities and must not be allowed to distort the primary architecture.

The architecture must support fail-closed readiness: where mandatory operational or client knowledge is absent, conflicting, inferred beyond authority or unresolved, Atlas must expose the gap rather than fabricate executable certainty.

## Decision AR-D012 — AR0.1 authorization and acceptance basis
Decision: APPROVED BY OWNER.

AR0.0 is Owner-reviewed and closed as the reference baseline. AR0.1 is authorized to ChatGPT only.

AR0.1 must test whether the frozen architecture can support implementation readiness using concrete scenarios, including:
- Road LTL customer-service pickup request for agentic/workflow implementation;
- BOL/document information-resolution with deliberate unresolved knowledge and fail-closed behavior;
- digital-twin/BPM implementation handoff;
- ERP/TMS fit-gap / implementation handoff;
- adversarial workflow semantics including waits/timeouts, retry/recovery and, where applicable, parallelism/join, correlation and idempotency.

For every required semantic, AR0.1 must classify it as:
1. fully governed by existing contract;
2. governed but enterprise/client binding required;
3. inferable but ungoverned;
4. absent and readiness-blocking;
5. legitimately downstream/runtime-specific and outside Atlas.

AR0.1 is an audit, not a redesign stage. Any contract or layer changes are deferred to AR0.2+.

## Open decisions for AR0.1–AR0.2
- Whether the current contracts can deterministically assemble an implementation-ready enterprise specification without a new persisted contract.
- Whether a first-class readiness assessment/status contract is required or existing resolution/status semantics are sufficient.
- Whether the canonical WorkDefinition grammar sufficiently represents control-flow semantics needed for implementation handoff, including parallelism, joins, event correlation, multi-instance work, idempotency, compensation/transaction boundaries, durable state and timeout ownership.
- Whether workload/arrival/concurrency, human capacity/skills and non-functional requirements are implementation-readiness requirements, downstream design concerns, or context contracts with another authoritative owner.
- How to represent unresolved/conflicting/inferred knowledge and prevent false `READY` status deterministically.
- How the same resolved enterprise semantics map to agent/workflow, BPM/digital twin, Malkom and ERP/TMS implementation without redefining canonical business meaning.
- What evidence threshold is required before a successor architecture can be frozen.
- Secondary only: whether a distinct design-context projection or solution-synthesis/selection capability is eventually valuable after execution readiness is solved.
