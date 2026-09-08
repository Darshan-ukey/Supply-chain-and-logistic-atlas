# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / RECOVERY MODE  
Updated: 8 September 2026 — R0.1A-R independent QA PASS; R0.1B final authority closure AUTHORIZED  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas Phase 6 is suspended while Pre-P6 Foundation Recovery is active. Implementation agents must read `CLAUDE.md`, the machine queue, this roadmap, the Asset Custody Standard, the Recovery Standard and referenced frozen contracts. Only exact `AUTHORIZED` `stageId` work may mutate assets. Completion stops at `AWAITING_INDEPENDENT_QA`.

## Current recovery position
- **R0.1A remains immutable historical QA evidence**, superseded for canonical promotion by the corrected R0.1A-R materialization.
- **R0.1A-R is COMPLETE — independent QA PASS.** Corrected result: 60 canonical materialized structures + one governed runtime/UI exclusion (`state`), 1,327 records, zero unresolved extraction targets, semantic SHA `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- R0.1A-R is mirrored in governed Drive custody with exact round-trip bundle hash `38851f7b43ba1890a3944fc9a303d4f8cad9f6b6d270290a90eeec35d2219fb8`.
- **R0.1B is now the only authorized current stage, for final authority closure only.** Its original determination remains immutable evidence; it must consume the corrected R0.1A-R candidate and may not rerun remediation.
- **R0.1C remains blocked until R0.1B final independent QA.** `a5-*`/`scp-*` ownership remains unclassified.
- Phase 6 remains suspended through R0.6 independent QA.

## Why R0.1A-R was required
R0.1B established that:
- the three retained source-copy differences are presentation/navigation build-state, not Universe semantic differences;
- release shell `7.3` over semantic payload `7.2.0` is intentional two-axis versioning;
- the canonical construction boundary is the end of the full declaration expression, including chained transforms and excluding later separate mutations;
- R0.1A omitted declaration-level `description` fields from `systemRecords` and `businessObjectRecords`;
- two prior divergence findings were heterogeneous-ID detector artifacts;
- materialized `state` is runtime/UI state and must not be canonical Universe semantics.

R0.1A-R corrected these mechanically, preserved historical evidence, and passed independent QA.

## Permanent completeness standard
Every applicable asset must be evaluated on: PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

### R0.1A — Universe Semantic Materialization
Status: COMPLETE — HISTORICAL QA PASS / SUPERSEDED FOR CANONICAL PROMOTION

Historical certified outcome: 61 materialized structures, 1,330 records, zero unresolved extraction targets. Historical evidence remains immutable.

### R0.1A-R — Universe Semantic Re-materialization Correction
Status: COMPLETE — INDEPENDENT QA PASS

Checkpoint C: `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`.

Certified outcome:
- 3 physical retained Universe copies / 2 distinct source hashes;
- 113 module-scope declarations;
- 61 must-materialize declarations;
- 60 canonical structures + 1 governed runtime/UI exclusion (`state`);
- 1,327 records / 0 unresolved extraction targets;
- semantic structures SHA `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`;
- extractor `atlas-universe-semantic-extractor-1.1.0`;
- exact Drive custody round-trip verified.

### R0.1B — Universe Release Identity & Authority Reconciliation
Status: AUTHORIZED — FINAL_AUTHORITY_CLOSURE_ONLY

Use the corrected R0.1A-R candidate and Checkpoint C. Required closure:
- confirm D1-D3 remain valid;
- record D4-D6 as remediated by R0.1A-R;
- bind semantic authority to the corrected normalized payload if evidence stays consistent;
- finalize `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` as separate governed identities;
- finalize documented release-shell authority and retained later-repackage treatment;
- finalize supersession treatment for the defective R0.1A payload;
- produce a distinct final-authority-closure evidence record and `POST_IMPLEMENTATION_PRE_QA`;
- stop at `AWAITING_INDEPENDENT_QA`.

Do not modify historical R0.1B determination evidence, rerun R0.1A-R extraction, promote CURRENT/LATEST/ASSET_REGISTER before independent QA, or perform R0.1C ownership work.

### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_FINAL_QA
Classify unresolved references by governing layer; determine `a5-ltl-*` and `scp-*` ownership; distinguish true defects from valid local/cross-layer IDs; recommend repair without mutation. Until QA use `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

## R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered 1.4 package/module/OK into governed GitHub/Drive custody with verified hashes; reconcile historical hash identity discrepancies without assumption; normalize overlay handling; deterministically materialize effective 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware integrity checks; reproduce and re-certify P6.0 from retained governed inputs/tooling.

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Certify 22-task OK coverage; close/classify objects/documents gaps; complete canonical BOL/information semantics; preserve unresolved evidence/knowledge gaps.

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence; recover original readable bundle/decoder/generator/CI artifacts where available; retain deterministic generation capability; run governed Road LTL through module-neutral recursive decomposition; use executability stop criterion; derive counts honestly; persist with governed codec/schema; prove actual protected readback. Never target historical counts.

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
