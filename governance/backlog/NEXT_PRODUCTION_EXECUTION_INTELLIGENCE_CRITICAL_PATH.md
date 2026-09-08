# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / RECOVERY MODE  
Updated: 8 September 2026 — R0.1B discovered a governed R0.1A materialization defect; R0.1A-R AUTHORIZED  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas Phase 6 is suspended while Pre-P6 Foundation Recovery is active. Implementation agents must read `CLAUDE.md`, the machine queue, this roadmap, the Asset Custody Standard, the Recovery Standard and referenced frozen contracts. Only exact `AUTHORIZED` `stageId` work may mutate assets. Completion stops at `AWAITING_INDEPENDENT_QA`.

## Current recovery position
- **R0.1A remains immutable historical QA evidence**, but its payload is no longer eligible for canonical promotion because R0.1B discovered a deterministic construction-boundary defect and runtime-state inclusion issue.
- **R0.1A-R is the only authorized current implementation stage.** It corrects the materialization mechanically under the R0.1B D4/D5/D6 determinations, without changing source semantics or historical evidence.
- **R0.1B is suspended pending R0.1A-R independent QA.** Its investigation/determination evidence is preserved; it returns after remediation only for final authority/canonical-asset closure.
- **R0.1C remains blocked until R0.1B final QA.** `a5-*`/`scp-*` ownership must remain unclassified until then.
- Phase 6 remains suspended through R0.6 independent QA.

## Why the R0.1A-R remediation was inserted
R0.1B established that:
- the three retained source-copy differences are presentation/navigation build-state, not Universe semantic differences;
- release shell `7.3` over semantic payload `7.2.0` is intentional two-axis versioning, not a labeling defect;
- the canonical construction boundary is the end of the full declaration expression, including chained transforms and excluding later separate mutations;
- R0.1A captured `systemRecords` and `businessObjectRecords` before completion of their declaration-level chained transforms, omitting source-declared `description` fields from 187 records;
- two of the prior 189 divergence findings are detector artifacts caused by heterogeneous entities sharing an `id`;
- materialized `state` is runtime/UI state and should not be part of canonical Universe semantics.

The source is intact. The correct response is a governed deterministic re-materialization, not semantic redesign and not silent modification of R0.1A evidence.

## Permanent completeness standard
Every applicable asset must be evaluated on: PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

### R0.1A — Universe Semantic Materialization
Status: COMPLETE — HISTORICAL QA PASS / SUPERSEDED FOR CANONICAL PROMOTION

Historical certified outcome: 61/61 data-bearing structures, 1,330 records, 0 unresolved extraction targets; exact custody bundle mirrored and SHA-verified in Drive. Checkpoint C remains immutable at `governance/recovery/R0.1A/POST_QA_GOVERNED_STATE.json`.

### R0.1A-R — Universe Semantic Re-materialization Correction
Status: AUTHORIZED

Correct the R0.1A materialization only. Required outcomes:
- preserve all R0.1A/R0.1B evidence byte-for-byte;
- use end-of-full-declaration-expression as the canonical capture boundary;
- include declaration-level chained transforms and exclude later separate mutations;
- correct `systemRecords` and `businessObjectRecords` generically, retaining source-declared `description` and excluding later-derived `domainIds` where applicable;
- classify/exclude `state` as `RUNTIME_UI_STATE` while retaining auditable inventory evidence;
- correct heterogeneous-ID divergence detection;
- rerun independent declaration inventory and all retained source copies without targeting historical counts;
- produce new payload/report/inventory/comparison hashes and explicit supersession lineage;
- establish governed dependency closure for certified Universe inputs used by later stages;
- supplement historical R0.1A metadata gaps without rewriting its Checkpoint C;
- create `POST_IMPLEMENTATION_PRE_QA` and stop at `AWAITING_INDEPENDENT_QA`.

No semantic redesign, unsupported relabeling, Universe 7.4, hard-coded field insertion, invented IDs, crosswalk/reference ownership work, Road LTL changes, P6 work or canonical pointer promotion.

### R0.1B — Universe Release Identity & Authority Reconciliation
Status: SUSPENDED_PENDING_R0_1A_R_QA

R0.1B determination evidence remains governed. After R0.1A-R independent QA, return to R0.1B for final canonical payload authority, exact asset/hash registration and closure. Do not repeat investigation unless corrected extraction yields contradictory evidence.

### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_FINAL_QA
Classify unresolved references by governing layer; determine `a5-ltl-*` and `scp-*` ownership; distinguish true defects from valid local/cross-layer IDs; recommend repair without mutation. Until QA use `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

## R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered 1.4 package/module/OK into governed GitHub/Drive custody with verified hashes; reconcile historical hash identity discrepancies without assumption; normalize overlay handling; deterministically materialize effective 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware integrity checks; reproduce and re-certify P6.0 from retained governed inputs/tooling.

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Certify 22-task OK coverage; close/classify objects/documents gaps; distinguish reusable recovery/jurisdiction rules from missing knowledge; complete canonical BOL/information semantics; preserve unresolved evidence/knowledge gaps.

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence; search/recover original readable bundle/decoder/generator/CI artifacts; retain deterministic generation capability; run governed Road LTL through module-neutral recursive decomposition; use executability stop criterion; derive counts honestly; persist with governed codec/schema; prove actual protected readback. Never target historical counts.

## R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
First verify canonical Ocean FCL/LCL 0.6 source/package/module custody, identity and dependency closure. PUBLIC_SAFE materializations are evidence only. Then audit all 30 FCL + 30 LCL tasks using the LTL OK standard; curate genuine Ocean-specific knowledge/provenance; extend canonical object/document contracts; preserve gaps.

## R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA
Run the same generic compiler on Ocean FCL/LCL; prove module neutrality; certify Universe → Daughter → OK → Decomposition across Road LTL/FCL/LCL; reconcile GitHub/Drive/Supabase hashes, codecs, pointers and classifications; truthfully update registers; complete custody checkpoints; independent QA explicitly authorizes return to P6.2.

# Phase 6 — SUSPENDED UNTIL R0.6 QA

## P6.2 — Canonical WorkDefinition Compilation
Status: SUSPENDED_BY_RECOVERY_GATE
Retain existing implementation WIP; no canonical persistence/certification until R0.6 QA passes using re-certified decomposition inputs.

## P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

## P6.4 — Former Generic Recursive Decomposition + Ocean Execution Depth
Status: TO_BE_RESCOPED_AFTER_RECOVERY
Former scope is absorbed by R0.4–R0.6.

## P6.5 — Atlas V2 Integration & Production Certification
Status: BLOCKED_UNTIL_PRIOR_QA

## Atlas V2.0 — GO LIVE
Status: BLOCKED

## Source-of-truth hierarchy
1. Frozen Knowledge-to-Execution architecture/contracts.
2. Recovery Standard while recovery is active.
3. Machine queue for authorization.
4. This roadmap for human-readable intent.
5. GitHub implementation/evidence.
6. Drive durable governed copies/evidence.

If sources conflict, stop and report the conflict.
