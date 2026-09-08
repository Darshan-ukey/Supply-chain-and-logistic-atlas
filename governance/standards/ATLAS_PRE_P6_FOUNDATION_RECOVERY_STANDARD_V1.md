# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Current revision: R0.1A-R independently QA-certified; R0.1B re-authorized for final authority closure only.  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose
Atlas is in recovery mode to repair and re-certify the existing Knowledge-to-Execution chain, not redesign it:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

Every recovery stage also follows `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.

## 2. Current disposition
- Governance architecture, contracts, Canvas/Daughter/Ask/Trace projection architecture remain intact.
- R0.1A remains immutable historical evidence. Its original 61-structure/1,330-record candidate is superseded for canonical promotion because R0.1B discovered a declaration-boundary defect and runtime-state classification defect.
- R0.1A-R independently corrected those defects without changing underlying Universe source semantics: 113 independently inventoried module-scope declarations, 61 must-materialize declarations, 60 canonical materialized structures, one governed runtime/UI exclusion (`state`), 1,327 records and zero unresolved extraction targets.
- Corrected semantic structures SHA-256 is `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`; extractor version is `atlas-universe-semantic-extractor-1.1.0`.
- R0.1A-R Drive custody is complete and round-trip hash verified. Custody bundle SHA-256 is `38851f7b43ba1890a3944fc9a303d4f8cad9f6b6d270290a90eeec35d2219fb8`.
- R0.1B's source-copy classification and two-axis release/semantic version determinations remain governed evidence. R0.1B is now re-authorized only to finalize authority against the corrected R0.1A-R payload; it must not rerun materialization or rewrite prior determination evidence.
- Universe release shell 7.3 and semantic payload 7.2.0 remain separate governed identities; unsupported relabeling remains prohibited.
- Road LTL `a5-*` and `scp-*` references remain `UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT` until R0.1C.
- Road LTL 1.4 package/module/Operational Knowledge were recovered and hash-verified outside final governed repo custody. R0.2 must close custody and re-certify dependent materialization.
- Effective Road LTL 1.5 is 21 unchanged tasks inherited from 1.4 plus direct governed LTL-03 1.5 override; `taskId`/`id` drift requires governed normalization.
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
10. Classification accuracy is mandatory: `FROZEN`, `COMPLETE`, `REFERENCE`, `DELTA`, `CANDIDATE`, etc. must reflect actual evidence and dependency state.
11. Asset custody checkpoints are mandatory: `PRE_CHANGE_BASELINE` → `POST_IMPLEMENTATION_PRE_QA` → `POST_QA_GOVERNED_STATE`.
12. Any architecture/governance/recovery-path/authorization/certification-rule change must be committed to the governance branch before implementation agents act. Chat alone is not execution authority.
13. Discovery of a new governed defect after certification does not permit rewriting historical evidence. A discrete remediation stage must supersede the affected candidate with explicit lineage.

## 4. Certification dimensions
An asset is not `FROZEN_COMPLETE` because a hash or CI run exists. Assess all applicable dimensions:
1. PHYSICAL_EXISTENCE
2. SEMANTICS
3. COVERAGE
4. EVIDENCE
5. DEPENDENCY_CLOSURE
6. REPRODUCIBILITY
7. REFERENTIAL_INTEGRITY
8. LIVE_READABILITY
9. REGISTRY_COHERENCE
10. CLASSIFICATION_ACCURACY
11. SECURITY_BOUNDARY
12. REGRESSION
13. DEPLOYMENT_PARITY

## 5. Recovery stages

### R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

### R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

#### R0.1A — Universe Semantic Materialization
Status: COMPLETE — HISTORICAL QA PASS / SUPERSEDED FOR CANONICAL PROMOTION

Original certified result: 61 materialized structures, 1,330 records, zero unresolved extraction targets. R0.1B later discovered D5/D6 defects affecting canonical-promotion eligibility. R0.1A artifacts remain immutable historical evidence and must not be overwritten, relabeled or silently replaced.

#### R0.1A-R — Universe Semantic Re-materialization Correction
Status: COMPLETE — INDEPENDENT QA PASS

Checkpoint C: `governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json`.

Certified result:
- 3 retained physical Universe copies evaluated;
- 2 distinct source hashes;
- 113 independent module-scope declarations;
- 61 must-materialize declarations;
- 60 canonical materialized structures;
- 1 governed runtime/UI exclusion (`state`);
- 1,327 records;
- 0 unresolved extraction targets;
- semantic structures SHA-256 `82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d`;
- extractor `atlas-universe-semantic-extractor-1.1.0`;
- Drive custody mirrored and round-trip hash verified.

R0.1A-R implements the R0.1B D4/D5/D6 remediation and corrected heterogeneous-ID divergence handling. The historical R0.1A payload remains immutable and not eligible for canonical promotion.

#### R0.1B — Universe Release Identity & Authority Reconciliation
Status: AUTHORIZED — FINAL_AUTHORITY_CLOSURE_ONLY

R0.1B must now use the corrected R0.1A-R candidate and Checkpoint C to finalize authority. It may:
- confirm D1-D3 remain valid against the corrected candidate;
- record D4-D6 as remediated by R0.1A-R rather than re-running extraction;
- bind semantic authority to the corrected normalized payload if evidence remains consistent;
- finalize `releaseVersion=7.3` and `semanticPayloadVersion=7.2.0` as separate governed identities;
- finalize documented release-shell authority and retained later-repackage treatment;
- finalize supersession treatment for the defective R0.1A payload;
- produce a distinct final-authority-closure evidence record and `POST_IMPLEMENTATION_PRE_QA`;
- stop at `AWAITING_INDEPENDENT_QA`.

R0.1B may not modify historical R0.1B determination evidence, rerun or rewrite R0.1A-R materialization, promote CURRENT/LATEST/ASSET_REGISTER before independent QA, or perform R0.1C ownership decisions.

#### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_FINAL_QA
Classify unresolved Road LTL references as Universe canonical, Daughter-local, OK, Canonical Information/Object, cross-layer or orphan. Determine `a5-ltl-*` and `scp-*` ownership. Recommend repair without mutation. Until QA use `canonicalReferenceResolution=UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

### R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered Road LTL 1.4 package/module/Operational Knowledge into governed GitHub/Drive custody with verified hashes; reconcile any historical-vs-current identity discrepancy without assumption; normalize `taskId`/`id` overlay handling without mutating source assets; deterministically materialize effective Road LTL 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware reference checks; reproduce and re-certify P6.0 effective materialization from retained governed inputs/tooling.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Retain strong LTL OK; complete/classify objects/documents gaps; distinguish reusable recovery/jurisdiction rules from missing task knowledge; complete canonical BOL/information semantics.

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence; recover original readable bundle/decoder/generator/CI artifacts where available; run governed effective Road LTL through a module-neutral recursive compiler; derive counts honestly; prove protected persistence/readback. Never tune to historical totals.

### R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
Verify canonical Ocean FCL/LCL 0.6 source/package/module custody and identity before knowledge uplift. PUBLIC_SAFE materializations are evidence, not canonical private source.

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA
Run the same generic recursive compiler on Ocean FCL/LCL; prove module neutrality; certify Universe → Daughter → OK → Decomposition across Road LTL/FCL/LCL; reconcile GitHub/Drive/Supabase; complete independent pre-P6 QA.

## 6. Phase 6 resumption rule
P6.2/P6.3/P6.4/P6.5 remain suspended/blocked while recovery is active. P6.2 may resume only after R0.6 independent QA using re-certified decomposition inputs.

## 7. Queue identifier rule
Canonical queue identifier is `stageId`; `currentStageId` selects current work. `id` is backward-compatible alias only. `stageId` and `status` are separate fields.

## 8. Agent behavior
Implementation agents read the machine queue, this standard and Asset Custody Standard; implement only exact `AUTHORIZED` `stageId`; produce custody checkpoints; stop at `AWAITING_INDEPENDENT_QA`; never self-authorize; never mutate historical evidence or repair downstream symptoms while upstream gates remain unresolved.
