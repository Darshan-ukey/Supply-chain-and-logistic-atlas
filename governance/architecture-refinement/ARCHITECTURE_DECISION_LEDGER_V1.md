# Atlas Architecture Decision Ledger V1

Status: ACTIVE  
Effective: 11 September 2026

## Decision AR-D001 — Architecture refinement precedes R0.4
Decision: APPROVED BY OWNER.

R0.3 may complete, but no generic recursive-decomposition recovery/rebuild/rematerialization work begins until the Work Decomposition / WorkDefinition architecture has been critically revalidated.

## Decision AR-D002 — R0.3 completion does not authorize R0.4
Decision: APPROVED BY OWNER.

R0.3 QA PASS closes the current recovery stage only. R0.4 remains suspended behind the architecture-refinement gate.

## Decision AR-D003 — Architecture refinement ownership
Decision: APPROVED BY OWNER.

ChatGPT owns the architecture-refinement analysis, governance artifacts and independent validation. Claude is not authorized to design, modify or implement the architecture-refinement stages unless a later Owner-authorized governance update explicitly changes this.

## Decision AR-D004 — Proposed Execution Requirements / Solution Synthesis layer
Decision: HYPOTHESIS ONLY — NOT APPROVED ARCHITECTURE.

Current concern: Work Decomposition V1.1 and Canonical WorkDefinition V1 appear strong at describing what work exists and what correct execution requires, but may not contain enough governed context to select among human, workflow, RPA, API, document-AI, agentic or hybrid solution patterns.

Potential missing concerns include workload/volume, SLA/latency, ambiguity, determinism, interface availability, technical constraints, security, transaction/idempotency, concurrency, economics, human capacity, non-functional requirements and cross-runtime trade-off selection.

AR0.0–AR0.4 must determine whether these concerns belong in a new layer, existing client/runtime contracts, or a refined WorkDefinition grammar.

## Decision AR-D005 — Frozen V1 remains immutable during challenge
Decision: APPROVED.

`governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md`, Work Decomposition V1.1 and Canonical WorkDefinition V1 are reference baselines. Architecture refinement creates additive analysis and, if approved later, a versioned successor. It does not overwrite historical frozen architecture.

## Decision AR-D006 — Executor-neutral canonical boundary remains the default
Decision: PRESUMED VALID, TO BE CHALLENGED.

Canonical work should describe the work, rules, state, information, decisions, human boundary, transitions, exceptions and evidence independent of a chosen execution technology. Runtime-specific implementation belongs downstream unless evidence shows an additional canonical execution characteristic is required.

## Decision AR-D007 — Historical decomposition counts are not design targets
Decision: APPROVED.

Historical 603 work units / 444 leaves and remembered 572/605 figures are forensic evidence only. They must not constrain the refined architecture or a later deterministic materialization.

## Decision AR-D008 — Success criterion for architecture refinement
Decision: APPROVED FOR VALIDATION.

The target architecture must support, once sufficient client binding exists, both:
- deterministic derivation of executable semantic work; and
- governed ideation/comparison of one or more executable solution architectures, including hybrid patterns, with traceability from canonical rule to client constraint to solution choice to runtime projection.

## Open decisions
- Whether `Execution Requirements` is a distinct canonical-adjacent layer or part of an expanded WorkDefinition/client-binding contract.
- Whether `Solution Synthesis` is a persisted governed layer, a governed reasoning service over contracts, or a combination.
- Which execution characteristics must be first-class and which remain runtime-specific.
- Whether Work Decomposition V1.1 requires grammar changes for parallelism, joins, correlation, idempotency, compensation, state persistence and related executable-control semantics.
- What evidence threshold is required before a successor architecture can be frozen.
