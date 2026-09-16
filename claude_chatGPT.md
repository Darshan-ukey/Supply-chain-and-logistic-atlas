# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG  
**Current disposition:** `DUAL_REVIEW_PASS__GOVERNANCE_REFINEMENTS_APPLIED__AR0_2_OWNER_GATE`

Read this file first. The immediately preceding detailed Claude review/control state is preserved in Git blob `09a54dfdf440679d188bf3842d0623386b62bf7a`; do not reread it unless this packet explicitly requires the full review evidence.

## Coordination protocol
1. Read only the ACTIVE TASK mandatory review set below, in order.
2. Supporting logs not named here are not mandatory.
3. Do not create a new coordination/control log; update this file only.
4. ChatGPT, Prod/production execution agents, Claude when authorized, and future Atlas execution agents must follow the same phase-control and infrastructure-control standards.
5. Demo-only workarounds are historical evidence, not production architecture.

---

# CLOSED / PRESERVED EVIDENCE

- P6.1 CR1–CR11 frozen reconstruction baseline `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`.
- P6.1 repeatability freeze `fd86c71dd44a6e8e22c3281d6e779947c1e98223`.
- LTL-03 R2 independent closure `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`.
- LTL-01 R1 independent closure `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`.
- Four representative non-persisted P6.2 Canonical WorkDefinitions in `data/demo-internal/p6-2-representative-workdefinitions.json` @ `383de3b1ea897856cc381a517287c1b5095ea6f9`.
- Demo sprint is complete. Remaining Road LTL reconstruction stays deferred pending architecture re-baseline.

---

# ARCHITECTURE HARDENING STATUS

Architecture backlog: `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md` @ `f645b8b3db5e1d01c32c744bd5cba9868d51c4d2`.

Mandatory demo-exposed gaps remain:
- DG-01 Asset custody and dependency closure
- DG-02 Derived-output reproducibility
- DG-03 Production protected-data delivery path
- DG-04 Canonical WorkDefinition materialization/store closure
- DG-05 Enterprise Context / Client Binding as a first-class layer
- DG-06 Effective governed version resolution
- DG-07 Unified navigation and projection context
- DG-08 Same-lineage downstream consumer proof
- DG-09 Second-domain/Ocean source closure
- DG-10 Canonical knowledge storage and persistence
- DG-11 UI decoupling and data-driven rendering

Cross-cutting controls remain A–E: Source & Asset Registry; Generation Registry; Enterprise Context / Client Binding Store; Single Projection Gateway; Canonical Knowledge Persistence Boundary.

Claude independently reviewed DG-01…DG-11, controls A–E, the AR0.2 layer candidate and the phase-control standard and returned:

`PASS__DG_REQUIREMENTS_AND_PHASE_CONTROL_COMPLETE`

Detailed Claude evidence is preserved in prior control-log blob `09a54dfdf440679d188bf3842d0623386b62bf7a`.

---

# GLOBAL EXECUTION GOVERNANCE — REFINED

## 1. Controlled Phase Execution & Recovery Gate V1

Canonical file: `governance/standards/CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md`  
Refinement commit: **`b39c4f8ece88cb599c91c019d8f2db5c2130dc62`**

Mandatory sequence remains:

`BUILD → QA → FREEZE → CUSTODY/BACKUP → RECOVERY/REBUILD PROOF → DEPENDENCY CLOSURE → ROLLBACK POINT → NEXT-PHASE AUTHORIZATION`

Claude's bounded refinement has been applied to PC-5. HIGH-RISK is now explicitly defined. Actual recovery/rebuild proof is mandatory when a phase/sub-phase changes canonical knowledge, governed database/protected state, security/auth, production configuration/deployment, schemas/contracts, compiler/generation/version-resolution/lineage logic, creates a downstream-consumed baseline, has non-trivial rollback, crosses governed system boundaries, or is a production/release/migration/destructive/bulk-materialization/major-phase transition.

LOWER-RISK treatment is allowed only when all stated criteria are satisfied and recorded. An executing agent may not self-downgrade risk merely to avoid a recovery drill; ambiguity defaults to HIGH-RISK or `OWNER_DECISION_REQUIRED`.

Phase closure records must now include risk classification and rationale. Deferred controls must point to a real, trackable future governance gate/stage with defined closure condition; an indefinite “later” is invalid.

## 2. Deployment & Infrastructure Operational Control V1

Canonical file: `governance/standards/DEPLOYMENT_INFRASTRUCTURE_OPERATIONAL_CONTROL_V1.md`  
Creation commit: **`0493d5a23c0ac11b68ec91092a5017f76abe53ee`**

This is a separate operational-control standard, not DG-12 and not a new Atlas semantic layer.

It governs:
- explicit deployment intent;
- GitHub as canonical deployable source;
- explicit production promotion;
- deployment-storage/retention control;
- suppression/remediation of governance-only deployment churn where technically feasible;
- runtime-configuration custody;
- rollback readiness;
- truthful deployment-state claims.

The previously observed Vercel condition — auto-deployment on repository pushes plus deployment storage materially above the included allowance — remains an infrastructure remediation item until either unnecessary deployments are prevented or a documented retention/cleanup/monitoring control makes the behavior operationally acceptable.

All material deployment/runtime changes must also satisfy the Controlled Phase Execution & Recovery Gate. Material deployment, storage, security, migration and runtime-boundary changes are HIGH-RISK by default.

---

# CURRENT OWNER GATE

**AR0.2 — Layer-Boundary Decision** remains the next substantive Owner decision.

Working branch: `atlas-architecture-ar0-2-layer-boundary`  
Review PR: `#10`

Current candidate boundaries:
1. Reference Domain + Operational Knowledge
2. Canonical Work Decomposition
3. Canonical WorkDefinition
4. Enterprise Context / Client Binding
5. Governed Specification Assembly
6. optional Design / Solution Synthesis
7. Runtime Adapter / Projection
8. Execution Runtime outside Atlas
9. Observation / Evidence Reconciliation

Dual review has converged on the DG requirements and governance controls. No architecture implementation is authorized before the Owner accepts or revises AR0.2.

If AR0.2 is accepted/revised, proceed to AR0.3 Candidate Contract Architecture. AR0.3 itself must satisfy the Controlled Phase Execution & Recovery Gate before AR0.4 begins.

---

# HARD STOPS

- no architecture implementation before AR0.2 Owner decision;
- no phase advancement from an unbacked, unrecoverable, floating or ambiguously identified baseline;
- no agent self-downgrade from HIGH-RISK to avoid recovery proof;
- no production deployment/promotion merely because a Git push or preview build succeeds;
- no production-relevant code/configuration living only in Vercel/runtime infrastructure;
- no new canonical semantic layer merely to house demo findings;
- no assumption that Supabase must own all canonical knowledge until AR0.2/AR0.3 resolves the physical responsibility model;
- no authoritative business/domain knowledge stored only in HTML/Canvas;
- no use of demo JSON/URL flags as production authorization architecture;
- no fabrication of Ocean/source truth;
- no reconstruction of remaining Road LTL tasks;
- no bulk/persisted Canonical WorkDefinition generation;
- no Supabase production mutation arising from the architecture review;
- no main/production promotion arising from the architecture review.
