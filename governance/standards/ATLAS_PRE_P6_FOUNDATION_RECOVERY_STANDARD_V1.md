# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Current revision: R0.1B final authority closure independently QA-certified; R0.1C authorized for canonical reference ownership audit.  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose
Atlas is in recovery mode to repair and re-certify the existing Knowledge-to-Execution chain, not redesign it:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

Every recovery stage also follows `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.

## 2. Current disposition
- Governance architecture, contracts, Canvas/Daughter/Ask/Trace projection architecture remain intact.
- R0.1A remains immutable historical evidence and is superseded for canonical promotion by R0.1A-R.
- R0.1A-R independently corrected the declaration-boundary/runtime-state defects without changing underlying Universe source semantics: 113 module-scope declarations, 61 must-materialize declarations, 60 canonical materialized structures, one governed runtime/UI exclusion (`state`), 1,327 records and zero unresolved extraction targets.
- Corrected semantic structures SHA-256 is `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`; extractor version is `atlas-universe-semantic-extractor-1.1.0`.
- R0.1B independently finalized Universe authority with zero contradictions against the corrected R0.1A-R evidence.
- Semantic authority is bound to `data/universe/r0-1a-r/universe-semantic-payload.json` at semantic structures SHA-256 `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.
- `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` are distinct governed identities. Collapsing or relabeling them is prohibited.
- Release-shell authority is SHA-256 `31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd`; later repackage SHA-256 `d674a8f775dfd2f6997ec2ca9cbc7cf799aeae73016d2b5b9676de87c0c0d9ef` remains governed evidence, not authoritative shell.
- R0.1B custody is mirrored and round-trip hash verified. Production `CURRENT/LATEST/ASSET_REGISTER` pointers remain unchanged.
- Road LTL `a5-*` and `scp-*` references remain `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`; R0.1C is now authorized to classify governing-layer ownership without mutation.
- Road LTL 1.4 package/module/Operational Knowledge were recovered and hash-verified outside final governed repo custody. R0.2 must close custody and re-certify dependent materialization.
- Effective Road LTL 1.5 remains 21 unchanged 1.4 tasks plus direct governed LTL-03 1.5 override; `taskId`/`id` drift requires governed normalization.
- Historical P6.0 evidence remains evidence but current reproducibility must be re-certified.
- Historical P6.1 cannot currently support reproducibility/live-readability claims with retained tooling.
- Ocean FCL/LCL 0.6 require source/package closure and Road-LTL-equivalent OK/decomposition depth before execution-depth parity claims.

## 3. Permanent recovery principles
1. Preserve before repair: historical frozen/certified artifacts are immutable evidence; corrections are supersessions/materializations with explicit lineage.
2. No count-target reconstruction: historical counts are evidence, never rebuild targets.
3. No business-knowledge fabrication: missing knowledge remains a governed gap until evidenced.
4. Dependency closure is mandatory: required base/overlay/source/schema/tooling/live representation must resolve.
5. Physical existence matters: a pointer or completion note is not a substitute for the actual machine-readable payload where one is required.
6. Machine-readable canonical sources are required where deterministic resolution/compilation is expected.
7. Generic compilers/renderers remain module-neutral; mode-specific semantics live in governed knowledge.
8. Public/protected execution-IP boundaries remain frozen.
9. Registry coherence is mandatory: GitHub, Drive, hashes, versions, pointers and live backend must agree where applicable.
10. Classification accuracy is mandatory.
11. Asset custody checkpoints are mandatory: `PRE_CHANGE_BASELINE` → `POST_IMPLEMENTATION_PRE_QA` → `POST_QA_GOVERNED_STATE`.
12. Governance/recovery-path/authorization/certification-rule changes must be committed before implementation agents act.
13. Discovery of a new governed defect after certification requires explicit supersession, never historical rewrite.
14. Stage-lifecycle assertions in immutable historical tests may legitimately expire after later checkpoints; preserve those tests and record superseded assertions rather than editing history.

## 4. Certification dimensions
PHYSICAL_EXISTENCE; SEMANTICS; COVERAGE; EVIDENCE; DEPENDENCY_CLOSURE; REPRODUCIBILITY; REFERENTIAL_INTEGRITY; LIVE_READABILITY; REGISTRY_COHERENCE; CLASSIFICATION_ACCURACY; SECURITY_BOUNDARY; REGRESSION; DEPLOYMENT_PARITY.

## 5. Recovery stages

### R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

### R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

#### R0.1A — Universe Semantic Materialization
Status: COMPLETE — HISTORICAL QA PASS / SUPERSEDED FOR CANONICAL PROMOTION

#### R0.1A-R — Universe Semantic Re-materialization Correction
Status: COMPLETE — INDEPENDENT QA PASS
Checkpoint C: `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`.
Certified semantic structures SHA-256: `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`.

#### R0.1B — Universe Release Identity & Authority Reconciliation
Status: COMPLETE — INDEPENDENT QA PASS
Final closure: `governance/recovery/R0.1B/UNIVERSE_FINAL_AUTHORITY_CLOSURE.json`.
Checkpoint C: `governance/recovery/R0.1B/POST_QA_GOVERNED_STATE_FINAL_CLOSURE.json`.
Authority is certified in evidence; production pointers were not promoted.

#### R0.1C — Canonical Reference Ownership Audit
Status: AUTHORIZED
Objective: classify unresolved Road LTL references by governing layer before selecting any repair.
Required work:
- inventory unresolved references from governed evidence;
- classify each as Universe canonical, Daughter-local, Operational Knowledge, Canonical Information/Object, cross-layer contract, or orphan;
- determine `a5-ltl-*` and `scp-*` ownership using evidence;
- distinguish true defects from valid local/cross-layer identifiers;
- recommend repair type without mutation;
- retain `canonicalReferenceResolution=UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` until the audit supports a governed classification;
- create custody checkpoints and stop at `AWAITING_INDEPENDENT_QA`.

Excluded: inventing crosswalks/IDs, Universe 7.4, Daughter/Road LTL/canonical-reference mutation, production-pointer promotion, R0.2 work, P6 work.

### R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered Road LTL 1.4 package/module/Operational Knowledge into governed GitHub/Drive custody with verified hashes; reconcile identity discrepancies without assumption; normalize overlay handling; deterministically materialize effective Road LTL 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware reference checks; reproduce and re-certify P6.0.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA

### R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

## 6. Phase 6 resumption rule
P6.2/P6.3/P6.4/P6.5 remain suspended/blocked while recovery is active. P6.2 may resume only after R0.6 independent QA using re-certified decomposition inputs.

## 7. Queue identifier rule
Canonical queue identifier is `stageId`; `currentStageId` selects current work. `id` is backward-compatible alias only.

## 8. Agent behavior
Implementation agents read the machine queue, this standard and Asset Custody Standard; implement only exact `AUTHORIZED` `stageId`; produce custody checkpoints; stop at `AWAITING_INDEPENDENT_QA`; never self-authorize; never mutate historical evidence or repair downstream symptoms while upstream gates remain unresolved.
