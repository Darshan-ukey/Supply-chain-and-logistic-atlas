# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / RECOVERY MODE  
Updated: 8 September 2026 — R0.1C independent QA PASS; R0.2 Road LTL source closure AUTHORIZED  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas Phase 6 is suspended while Pre-P6 Foundation Recovery is active. Implementation agents must read `CLAUDE.md`, the machine queue, this roadmap, the Asset Custody Standard, the Recovery Standard and referenced frozen contracts. Only exact `AUTHORIZED` `stageId` work may mutate assets. Completion stops at `AWAITING_INDEPENDENT_QA`.

## Current recovery position
- **R0.1A remains immutable historical QA evidence**, superseded for canonical promotion by R0.1A-R.
- **R0.1A-R is COMPLETE — independent QA PASS.** Certified semantic structures SHA `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- **R0.1B is COMPLETE — independent QA PASS.** Universe semantic/release authority is finalized without production-pointer promotion.
- **R0.1C is COMPLETE — independent QA PASS.** `a5-*` is Daughter-local; `scp-*` is owned by the existing cross-module process-concept layer; zero true reference defects and zero orphans were found.
- The process-concept crosswalk is now registered in `ASSET_REGISTER.json` by repository path/hash without semantic mutation.
- Ocean process-concept mappings remain a coverage gap owned by R0.5, not a reference defect.
- **R0.2 is now the only authorized current stage.** It must close Road LTL 1.4 package/module/Operational Knowledge custody and re-certify effective 1.5/P6.0 reproducibility without reconstructing semantics.
- Production `CURRENT/LATEST` pointers remain unchanged.
- Phase 6 remains suspended through R0.6 independent QA.

## Permanent completeness standard
Every applicable asset must be evaluated on: PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: COMPLETE

### R0.1A — Universe Semantic Materialization
Status: COMPLETE — HISTORICAL QA PASS / SUPERSEDED FOR CANONICAL PROMOTION

### R0.1A-R — Universe Semantic Re-materialization Correction
Status: COMPLETE — INDEPENDENT QA PASS
Checkpoint C: `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`.
Certified semantic structures SHA: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.

### R0.1B — Universe Release Identity & Authority Reconciliation
Status: COMPLETE — INDEPENDENT QA PASS
Final authority evidence: `governance/recovery/R0.1B/UNIVERSE_FINAL_AUTHORITY_CLOSURE.json`.
Checkpoint C: `governance/recovery/R0.1B/POST_QA_GOVERNED_STATE_FINAL_CLOSURE.json`.

### R0.1C — Canonical Reference Ownership Audit
Status: COMPLETE — INDEPENDENT QA PASS
Checkpoint C: `governance/recovery/R0.1C/POST_QA_GOVERNED_STATE.json`.
Certified result:
- 82 `a5-*` references are Daughter-local and 82/82 derive from daughter module/process identity;
- 22 `scp-*` references are defined by `data/crosswalks/process-concept-crosswalk-v1.json` as cross-module concepts;
- true reference defects = 0; orphans = 0;
- Ocean concept mapping coverage is deferred to R0.5.

## R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: AUTHORIZED
Required work:
- place recovered Road LTL 1.4 release package, module and Operational Knowledge into governed GitHub/Drive custody with exact hashes;
- preserve originals and reconcile historical hash identity discrepancies without assumption;
- normalize `taskId`/`id` handling only in derived tooling, never by mutating recovered source bytes;
- deterministically materialize effective Road LTL 1.5;
- prove 21×1.4 + LTL-03×1.5 lineage;
- rerun reference integrity under the R0.1C ownership model;
- reproduce and re-certify P6.0 from retained governed inputs/tooling;
- stop at `AWAITING_INDEPENDENT_QA`.

Do not reconstruct 1.4 from 1.3, warehouse/public-safe artifacts, memory or inferred domain knowledge. Do not choose conflicting hashes by filename/date alone. Do not start R0.3, R0.4 or P6 work.

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Certify 22-task OK coverage; close/classify objects/documents gaps; complete canonical BOL/information semantics; preserve unresolved evidence/knowledge gaps.

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence; recover original readable bundle/decoder/generator/CI artifacts where available; retain deterministic generation capability; run governed Road LTL through module-neutral recursive decomposition; derive counts honestly; prove actual protected readback.

## R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
First verify canonical Ocean FCL/LCL 0.6 source/package/module custody, identity and dependency closure. PUBLIC_SAFE materializations are evidence only. Then audit all 30 FCL + 30 LCL tasks using the LTL OK standard and extend cross-module process-concept mappings using evidence and the existing crosswalk model; do not invent mappings solely for parity.

## R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA
Run the same generic compiler on Ocean FCL/LCL; prove module neutrality; certify Universe → Daughter → OK → Decomposition across Road LTL/FCL/LCL; reconcile GitHub/Drive/Supabase; complete independent pre-P6 QA.

# Phase 6 — SUSPENDED UNTIL R0.6 QA

## P6.2 — Canonical WorkDefinition Compilation
Status: SUSPENDED_BY_RECOVERY_GATE

## P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

## P6.4 — Former Generic Recursive Decomposition + Ocean Execution Depth
Status: TO_BE_RESCOPED_AFTER_RECOVERY

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
