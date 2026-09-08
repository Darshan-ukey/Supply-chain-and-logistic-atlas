# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / RECOVERY MODE  
Updated: 8 September 2026 — R0.1B final authority closure independent QA PASS; R0.1C ownership audit AUTHORIZED  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule
Atlas Phase 6 is suspended while Pre-P6 Foundation Recovery is active. Implementation agents must read `CLAUDE.md`, the machine queue, this roadmap, the Asset Custody Standard, the Recovery Standard and referenced frozen contracts. Only exact `AUTHORIZED` `stageId` work may mutate assets. Completion stops at `AWAITING_INDEPENDENT_QA`.

## Current recovery position
- **R0.1A remains immutable historical QA evidence**, superseded for canonical promotion by R0.1A-R.
- **R0.1A-R is COMPLETE — independent QA PASS.** Certified semantic structures SHA `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- **R0.1B is COMPLETE — independent QA PASS.** Zero contradictions were found against corrected R0.1A-R evidence.
- Semantic authority is now certified to `data/universe/r0-1a-r/universe-semantic-payload.json`; `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` remain separate governed identities.
- Release-shell authority is SHA `31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd`; later repackage SHA `d674a8f775dfd2f6997ec2ca9cbc7cf799aeae73016d2b5b9676de87c0c0d9ef` remains governed evidence, not authoritative shell.
- R0.1B Drive custody is exact and round-trip verified at bundle SHA `ac6e937cd480f12b828bc586ef0b514f472ab72c553ab00b7829e9d8ea5e7601`.
- **R0.1C is now the only authorized current stage.** It may classify ownership but may not mutate references or invent IDs/crosswalks.
- Production `CURRENT/LATEST/ASSET_REGISTER` pointers remain unchanged.
- Phase 6 remains suspended through R0.6 independent QA.

## Permanent completeness standard
Every applicable asset must be evaluated on: PHYSICAL_EXISTENCE, SEMANTICS, COVERAGE, EVIDENCE, DEPENDENCY_CLOSURE, REPRODUCIBILITY, REFERENTIAL_INTEGRITY, LIVE_READABILITY, REGISTRY_COHERENCE, CLASSIFICATION_ACCURACY, SECURITY_BOUNDARY, REGRESSION and DEPLOYMENT_PARITY.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

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
Authority is certified; production pointers were not promoted.

### R0.1C — Canonical Reference Ownership Audit
Status: AUTHORIZED
Required work:
- inventory unresolved references from governed Universe/Road LTL evidence;
- classify each reference as Universe canonical, Daughter-local, Operational Knowledge, Canonical Information/Object, cross-layer contract, or orphan;
- determine `a5-ltl-*` and `scp-*` ownership using evidence;
- distinguish true defects from valid local/cross-layer IDs;
- recommend repair type without mutation;
- retain `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` until the audit supports a governed classification;
- create `PRE_CHANGE_BASELINE` and `POST_IMPLEMENTATION_PRE_QA`; stop at `AWAITING_INDEPENDENT_QA`.

Do not invent identifiers/crosswalks, create Universe 7.4, mutate Daughter/Road LTL/canonical references, promote production pointers, start R0.2, or resume P6.

## R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered 1.4 package/module/OK into governed GitHub/Drive custody with verified hashes; reconcile historical hash identity discrepancies without assumption; normalize overlay handling; deterministically materialize effective 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware integrity checks; reproduce and re-certify P6.0 from retained governed inputs/tooling.

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Certify 22-task OK coverage; close/classify objects/documents gaps; complete canonical BOL/information semantics; preserve unresolved evidence/knowledge gaps.

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence; recover original readable bundle/decoder/generator/CI artifacts where available; retain deterministic generation capability; run governed Road LTL through module-neutral recursive decomposition; derive counts honestly; prove actual protected readback.

## R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
First verify canonical Ocean FCL/LCL 0.6 source/package/module custody, identity and dependency closure. PUBLIC_SAFE materializations are evidence only. Then audit all 30 FCL + 30 LCL tasks using the LTL OK standard.

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
