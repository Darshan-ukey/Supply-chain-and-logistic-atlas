# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / ARCHITECTURE REFINEMENT GATE  
Updated: 11 September 2026 — Owner platform-boundary decision incorporated; AR0.1 requires re-baseline before AR0.2  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas recovery/rebuild execution does not continue directly from R0.3 to R0.4. The Owner inserted a governed architecture-refinement gate to challenge Work Decomposition V1.1 / Canonical WorkDefinition V1 before any recursive-decomposition recovery, rematerialization or rebuild.

Claude remains an implementation agent and may act only on an exact queue stage whose status is `AUTHORIZED`. Architecture-refinement stages are reserved to ChatGPT; Claude must not execute them. Frozen V1 architecture remains immutable unless the Owner later approves a versioned successor.

## Current position
- R0.1A-R, R0.1B and R0.1C: COMPLETE — independent QA PASS.
- R0.2: COMPLETE — independent QA PASS. Effective Road LTL 1.5 remains 21 inherited 1.4 tasks + direct LTL-03 1.5 override; P6.0 remains 502/502 re-certified.
- R0.3: COMPLETE — independent QA PASS.
- R0.3 certified 22 tasks against Operational Knowledge Contract v2 on both composed and OK-only surfaces. Gaps were classified, not fabricated closed.
- R0.3 retains 66 referenced canonical objects with 0 canonical object contracts, 76 BOL fields with 0 conformant Information Resolution contracts and 24 OPEN knowledge gaps.
- Production `CURRENT/LATEST` pointers remain unchanged.

# Architecture Refinement Program — CURRENT

Governing backlog: `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md`  
Decision ledger: `governance/architecture-refinement/ARCHITECTURE_DECISION_LEDGER_V1.md`  
Activity log: `governance/architecture-refinement/ARCHITECTURE_REFINEMENT_LOG.md`

## Product / platform North Star

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

Boundary principle:

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Atlas sits between enterprise/client reality and downstream platforms such as Malkom, agents/workflow engines, SAP/ERP, TMS/WMS, ServiceNow, RPA, BPM/digital-twin platforms and custom applications.

Knowledge repository, governance platform, execution/implementation readiness and solution-architecture capability are legitimate capabilities/byproducts of a sufficiently capable Atlas. None is the exclusive product identity. Runtime business execution itself remains outside Atlas.

The canonical business/domain layer must remain technology-neutral. Downstream tools consume governed Atlas specifications/projections; they must not redefine canonical business truth.

Execution readiness remains a critical certification outcome: Atlas must be able to determine whether implementation-critical semantics are sufficiently resolved and fail closed when mandatory knowledge is missing, conflicting, ungoverned or client-specific and unresolved.

## Governing challenge
Determine whether the current frozen chain:

`Governed Domain Knowledge -> Operational Knowledge -> Work Decomposition -> Canonical WorkDefinition -> Enterprise/Client Binding -> Gap Resolution / Readiness -> Governed Specification / Projection -> Downstream Tool`

can preserve one authoritative business meaning while supporting multiple downstream uses: implementation handoff, solution/design specification, agent/workflow projection, Malkom, BPM/digital twin, ERP/TMS fit-gap and future technologies.

The architectural test is not whether Atlas itself can execute. The test is whether Atlas can understand, govern, contextualize and specify the operation sufficiently that downstream technologies can consume its outputs without reconstructing the business domain.

## AR0.0 — Architecture Baseline & Challenge Register
Status: COMPLETE / OWNER_REVIEWED

## AR0.1 — V1.1 / WorkDefinition Sufficiency Audit
Status: OWNER_DIRECTION_RECEIVED — REBASE REQUIRED BEFORE CLOSURE

The prior candidate audit remains useful evidence but its earlier North-Star framing was too narrow. Its findings must be reinterpreted against AR-D013: execution readiness is a critical outcome, while Atlas itself is the broader governed enterprise-to-tool intelligence/specification layer.

The existing audit scenarios remain valid because they test different downstream consumers:
1. Road LTL customer-service pickup request -> agentic/workflow implementation handoff;
2. BOL/document information resolution -> fail-closed readiness with real gaps;
3. digital-twin/BPM implementation handoff;
4. ERP/TMS fit-gap / implementation handoff;
5. adversarial control-flow semantics.

No successor architecture is approved at AR0.1.

## AR0.2 — Layer-Boundary Decision
Status: BLOCKED_UNTIL_AR0_1_REBASE_AND_OWNER_REVIEW

Determine authoritative boundaries across Domain/Operational Knowledge, Work Decomposition, Canonical WorkDefinition, Enterprise/Client Binding, knowledge-gap resolution, readiness assessment, governed specification/handoff and downstream adapters/projections. Preserve technology neutrality and prohibit runtime execution from moving into Atlas.

## AR0.3 — Candidate Contract Architecture
Status: BLOCKED_UNTIL_AR0_2_REVIEW

Only if evidence supports a change, define candidate machine-readable contracts and ownership boundaries. Avoid monolithic duplication of governed truth.

## AR0.4 — Adversarial Multi-Pattern Validation
Status: BLOCKED_UNTIL_AR0_3_REVIEW

Validate the candidate architecture across multiple domains/task families and multiple downstream consumer patterns. Do not use Road LTL/BOL as the only test family.

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

Do not target historical decomposition counts. Once the successor/frozen generation architecture is authorized, derived decomposition should be deterministically materialized from authoritative inputs and certified on semantics, lineage and reproducibility.

## R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_ARCHITECTURE_AND_R0_4_QA

## R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

# Phase 6 — Productionization

## P6.2 — Canonical WorkDefinition Compilation
Status: SUSPENDED_BY_RECOVERY_AND_ARCHITECTURE_GATE

Materialize governed canonical WorkDefinitions from certified decomposition. Preserve technology-neutral business meaning.

## P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

Certify Owner/Governor, protected super-user access, public-safe projection boundaries and non-disclosure of execution IP/source details.

## P6.4 — Multi-mode Execution Depth / Projection Proof
Status: TO_BE_RESCOPED_AFTER_ARCHITECTURE_AND_RECOVERY

Prove that the same governed semantics can support multiple downstream consumer types without redefining the underlying operation.

## P6.5 — Atlas V2 Integration & Production Certification
Status: BLOCKED_UNTIL_PRIOR_QA

Integrate governed data, intelligence/specification services, protected/admin experience, public-safe experience and downstream projection/adapter boundaries. Certify deployment parity, regression, live readability and security boundary.

## Atlas V2.0 — GO LIVE
Status: BLOCKED

Owner-approved production promotion only after P6.5 certification.

# Roadmap to make Atlas live

The critical path is now explicit:

`AR0.1 rebase -> AR0.2 boundary decision -> AR0.3 candidate contracts -> AR0.4 adversarial validation -> AR0.5 successor candidate -> AR0.6 Owner freeze -> R0.4 deterministic Road LTL decomposition -> R0.5 Ocean source/OK closure -> R0.6 multi-mode proof -> P6.2 canonical WD materialization -> P6.3 identity/security/public-protected certification -> P6.4 projection proof -> P6.5 integrated production certification -> Owner GO LIVE`

This roadmap is intended to make the complete governed architecture live, not merely restore historical artifacts. Derived artifacts may be regenerated from certified authoritative inputs and frozen generation rules; historical counts are evidence only, never reconstruction targets.

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
