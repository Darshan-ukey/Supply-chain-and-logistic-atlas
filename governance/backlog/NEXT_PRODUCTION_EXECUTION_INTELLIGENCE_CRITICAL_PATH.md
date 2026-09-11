# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / ARCHITECTURE REFINEMENT GATE  
Updated: 11 September 2026 — AR0.1 closed; AR0.2 candidate awaiting Owner review  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas recovery/rebuild execution does not continue directly from R0.3 to R0.4. Architecture refinement must be completed and Owner-frozen first.

Claude remains an implementation agent and may act only on an exact queue stage whose status is `AUTHORIZED`. Architecture-refinement stages are reserved to ChatGPT unless the Owner explicitly changes governance. Frozen V1 architecture remains immutable until a versioned successor is approved.

## Current position
- R0.1A-R, R0.1B and R0.1C: COMPLETE — independent QA PASS.
- R0.2: COMPLETE — independent QA PASS. Effective Road LTL 1.5 remains 21 inherited 1.4 tasks + direct LTL-03 1.5 override; P6.0 remains 502/502 re-certified.
- R0.3: COMPLETE — independent QA PASS.
- AR0.1: COMPLETE — Owner direction applied and rebased on AR-D013. PR #9 merged at `206db2b54f40140cc372c4f70bd314934abc489e`.
- AR0.2: CANDIDATE COMPLETE / AWAITING OWNER REVIEW in PR #10.
- R0.4 remains suspended.
- Production `CURRENT/LATEST` pointers remain unchanged.

# Product / platform North Star

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

Boundary principle:

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Atlas sits between enterprise/client reality and downstream platforms such as Malkom, agents/workflow engines, SAP/ERP, TMS/WMS, ServiceNow, RPA, BPM/digital-twin platforms and custom applications.

Knowledge repository, governance platform, execution/implementation readiness and solution-architecture capability are legitimate capabilities/byproducts. None is the exclusive product identity. Runtime business execution remains outside Atlas.

# Architecture Refinement Program

## AR0.0 — Architecture Baseline & Challenge Register
Status: COMPLETE / OWNER_REVIEWED

## AR0.1 — V1.1 / WorkDefinition Sufficiency Audit
Status: COMPLETE

Final disposition:
`CORE_ARCHITECTURE_DIRECTION_VALID / PARTIALLY_SUFFICIENT / TARGETED_SUCCESSOR_REFINEMENT_REQUIRED`

The 38-class evidence remains unchanged: 18 fully governed, 6 client/enterprise binding, 9 inferable but insufficiently formalized, 1 absent first-class scope-level readiness mechanism and 4 correctly downstream/runtime-specific.

AR-D013 broadened the interpretation from readiness-only to the enterprise-to-tool intelligence/specification boundary.

## AR0.2 — Layer-Boundary Decision
Status: AWAITING_OWNER_REVIEW — CURRENT

Review PR: #10  
Candidate disposition:
`TARGETED_LAYER_BOUNDARY_REFINEMENT_REQUIRED__NO_MONOLITHIC_NEW_SEMANTIC_LAYER`

Candidate successor boundaries:
1. Reference Domain + Operational Knowledge — authoritative reusable business truth and epistemic state.
2. Canonical Work Decomposition — business-semantic work topology and lineage; stopping criterion based on business-semantic sufficiency rather than target-runtime convenience.
3. Canonical WorkDefinition — technology-neutral execution-relevant semantics with stronger formal topology/control-flow grammar.
4. Enterprise Context / Client Binding — enterprise-specific values, mappings, variants, operating context and optional enterprise NFRs.
5. Governed Specification Assembly — non-duplicating scope manifest, resolution/readiness proof and version-closed specification manifest.
6. Optional Design / Solution Synthesis — non-canonical candidate design capability.
7. Runtime Adapter / Projection — target-tool translation, capability/loss assessment and native structures.
8. Execution Runtime — outside Atlas execution ownership.
9. Observation / Evidence Reconciliation — cross-runtime observations, conformance and feedback without automatic canonical mutation.

## AR0.3 — Candidate Contract Architecture
Status: BLOCKED_UNTIL_AR0_2_OWNER_REVIEW

If AR0.2 is accepted, define only the minimum machine-readable successor contracts required by the approved boundaries. Avoid duplicated truth and monolithic contracts.

## AR0.4 — Adversarial Multi-Pattern Validation
Status: BLOCKED_UNTIL_AR0_3_REVIEW

Validate the candidate architecture across multiple domains/task families and downstream consumer patterns.

## AR0.5 — Successor Architecture Candidate
Status: BLOCKED_UNTIL_AR0_4_REVIEW

Produce a versioned successor candidate with explicit lineage to frozen V1. Do not overwrite V1.

## AR0.6 — Owner Freeze Decision & Recovery Re-baseline
Status: BLOCKED_UNTIL_AR0_5_REVIEW

Owner approves, rejects or revises the successor and only then re-baselines R0.4/recovery sequencing.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: COMPLETE

## R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: COMPLETE — INDEPENDENT QA PASS

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: COMPLETE — INDEPENDENT QA PASS

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: SUSPENDED_BY_ARCHITECTURE_REFINEMENT_GATE

Future decomposition must be deterministically materialized from certified authoritative inputs and the Owner-frozen successor rules. Historical counts remain evidence only.

## R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_ARCHITECTURE_AND_R0_4_QA

## R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

# Phase 6 — Productionization

## P6.2 — Canonical WorkDefinition Compilation
Status: SUSPENDED_BY_RECOVERY_AND_ARCHITECTURE_GATE

## P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

## P6.4 — Multi-mode Execution Depth / Projection Proof
Status: TO_BE_RESCOPED_AFTER_ARCHITECTURE_AND_RECOVERY

## P6.5 — Atlas V2 Integration & Production Certification
Status: BLOCKED_UNTIL_PRIOR_QA

## Atlas V2.0 — GO LIVE
Status: BLOCKED

Owner-approved production promotion only after P6.5 certification.

# Roadmap to make Atlas live

Current critical path:

`AR0.2 Owner review -> AR0.3 candidate contracts -> AR0.4 adversarial validation -> AR0.5 successor candidate -> AR0.6 Owner freeze -> R0.4 deterministic Road LTL decomposition -> R0.5 Ocean source/OK closure -> R0.6 multi-mode proof -> P6.2 canonical WD materialization -> P6.3 identity/security/public-protected certification -> P6.4 projection proof -> P6.5 integrated production certification -> Owner GO LIVE`

This roadmap makes the complete governed Atlas architecture live; it does not attempt to recreate historical derived artifacts merely to preserve old counts.

## Permanent completeness standard
Every applicable asset/stage must be evaluated on PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

## Source-of-truth hierarchy
1. Frozen architecture/contracts for the version currently under assessment.
2. Owner-authorized architecture-refinement backlog/decision ledger while the refinement gate is active.
3. Recovery and custody standards.
4. Machine queue for execution authorization.
5. This roadmap for human-readable intent.
6. GitHub implementation/evidence.
7. Drive durable governed copies/evidence.

If sources conflict, stop and report the conflict.
