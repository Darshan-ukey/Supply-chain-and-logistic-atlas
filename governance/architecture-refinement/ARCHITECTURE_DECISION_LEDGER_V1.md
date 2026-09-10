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
Decision: APPROVED FOR VALIDATION.

The target architecture must support, once sufficient client binding exists, both deterministic derivation of executable semantic work and governed ideation/comparison of executable solution architectures, including hybrid patterns, with traceability from canonical rule to client constraint to solution choice to runtime projection.

## Decision AR-D009 — Pending contracts are design opportunity, not recovery target
Decision: AR0.0 FINDING — ACCEPTED FOR NEXT AUDIT.

`CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_PENDING.md` and `CANONICAL_WORKDEFINITION_CONTRACT_VNEXT_PENDING.md` are explicitly `IMPLEMENTATION_PENDING`. The machine-readable canonical contracts were therefore not completed/frozen as implementation. AR0.1 may critically test and refine their proposed grammar before implementation without pretending that a lost implemented contract must be reconstructed.

## Decision AR-D010 — One authoritative owner per fact
Decision: GOVERNANCE GUARDRAIL.

Any future execution-design layer must reference/assemble existing governed truth rather than duplicate domain rules, client-specific values, interface definitions, temporal constraints, measurements or runtime capability declarations. A monolithic Execution Requirements dumping ground is prohibited.

## Open decisions for AR0.1–AR0.2
- Whether a distinct design-context projection is required between Client Binding and solution selection.
- Whether solution synthesis/selection is a persisted governed artifact, a governed reasoning service, or both.
- Whether target runtime selection is intentionally human/external or an omitted Atlas capability.
- Which workload, capacity, economics and NFR facts are mandatory to make a defensible solution recommendation.
- Whether WorkDefinition requires first-class parallelism, joins, correlation, multi-instance, idempotency, compensation/transaction boundaries, durable-state and timeout semantics.
- How `executorEligibility` differs formally from executor/solution selection.
- What evidence threshold is required before a successor architecture can be frozen.
