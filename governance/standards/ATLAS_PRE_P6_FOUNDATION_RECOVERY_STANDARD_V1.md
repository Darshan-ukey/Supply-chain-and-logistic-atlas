# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Current revision: R0.1B discovered a governed R0.1A materialization defect; R0.1A-R authorized for deterministic remediation.  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose
Atlas is in recovery mode to repair and re-certify the existing Knowledge-to-Execution chain, not redesign it:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

Every recovery stage also follows `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.

## 2. Current disposition
- Governance architecture, contracts, Canvas/Daughter/Ask/Trace projection architecture remain intact.
- R0.1A independently certified a reproducible mechanical Universe materialization under governed GitHub and Drive custody: three retained physical HTML copies, two distinct source hashes, 113 independently inventoried module-scope declarations, 61 data-bearing structures materialized, 1,330 records, and 0 unresolved extraction targets.
- R0.1B subsequently identified a governed defect in that certified materialization: `systemRecords` and `businessObjectRecords` were captured before completion of declaration-level chained transforms, omitting source-declared `description` fields from 187 records. This does not indicate lost Universe source semantics; it is a deterministic extraction-boundary defect.
- R0.1B also determined that `state` is `RUNTIME_UI_STATE` and should be excluded from the canonical semantic payload, and that two of the 189 prior divergence findings were detector artifacts caused by heterogeneous records sharing an `id`.
- The R0.1A payload and all R0.1A/R0.1B evidence remain immutable historical evidence. The R0.1A payload is not eligible for canonical promotion pending R0.1A-R remediation and independent QA.
- R0.1B's D1-D4/D6 determinations remain governed evidence. R0.1B is suspended pending remediation and will return for final authority closure only after R0.1A-R independent QA passes.
- Universe release shell 7.3 and semantic payload 7.2.0 remain separate governed identities; unsupported relabeling is prohibited.
- Road LTL `a5-*` and `scp-*` references must not be presumed missing Universe identifiers until governing-layer ownership is established in R0.1C.
- Road LTL 1.4 package/module/Operational Knowledge were subsequently recovered and hash-verified outside final governed repo custody. They are no longer treated as unrecoverable; R0.2 must place them in governed custody and re-certify dependent materialization.
- Effective Road LTL 1.5 is 21 unchanged tasks inherited from 1.4 plus direct governed LTL-03 1.5 override; `taskId`/`id` drift requires governed normalization.
- Road LTL Operational Knowledge is materially deep and task-specific; harden rather than rewrite.
- Canonical information/object semantics, especially BOL, remain partial and require completion.
- Historical P6.0 evidence remains valid evidence, but current reproducibility must be re-certified from retained governed inputs/tooling after source closure.
- Historical P6.1 cannot currently support reproducibility/live-readability claims: generator is not retained, protected payload is unreadable by retained tooling, and repo/live codec constraints diverge.
- Ocean FCL/LCL 0.6 require both canonical source/package closure and Road-LTL-equivalent OK/decomposition depth before execution-depth parity claims.

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

Certified result at the time of QA: 61/61 data-bearing structures materialized, 1,330 records, 0 unresolved extraction targets; exact candidate custody mirrored and hash-verified in Drive. Checkpoint C: `governance/recovery/R0.1A/POST_QA_GOVERNED_STATE.json`.

R0.1B later discovered D5/D6 defects affecting canonical-promotion eligibility. R0.1A artifacts remain immutable evidence and must not be overwritten, relabeled or silently replaced.

#### R0.1A-R — Universe Semantic Re-materialization Correction
Status: AUTHORIZED

Objective: correct the R0.1A materialization mechanically using the R0.1B construction-boundary and runtime-state determinations without changing Universe source semantics.

Required treatment:
- create `PRE_CHANGE_BASELINE` before implementation;
- preserve all R0.1A/R0.1B artifacts byte-for-byte;
- canonical capture boundary is the end of the full declaration expression, including chained transforms inside that expression, excluding later separate mutation statements;
- correct `systemRecords` and `businessObjectRecords` generically so source-declared `description` is included while later-added `domainIds` remain excluded where applicable;
- classify `state` as `RUNTIME_UI_STATE`, exclude it from canonical semantic payload, and retain explicit inventory evidence of that classification;
- correct divergence detection so heterogeneous entity types are not compared by `id` alone;
- re-run the independent declaration inventory and all retained-copy materialization without targeting 61 structures, 1,330 records or any historical result;
- generate new corrected hashes and explicit old→new supersession lineage;
- prove no source field is invented and no historical evidence is mutated;
- establish governed repository-path/hash/lineage dependency closure for certified machine-readable Universe inputs required by subsequent stages;
- close R0.1A governed-state metadata gaps using supplemental evidence, not by rewriting historical Checkpoint C;
- create `POST_IMPLEMENTATION_PRE_QA` and stop at `AWAITING_INDEPENDENT_QA`.

Excluded: semantic redesign, unsupported relabeling, Universe 7.4, hard-coded special-case field insertion, invented fields/IDs, Road LTL/reference mutation, crosswalk creation, R0.1C ownership decisions, P6 work, canonical pointer promotion.

#### R0.1B — Universe Release Identity & Authority Reconciliation
Status: SUSPENDED_PENDING_R0_1A_R_QA

R0.1B implementation evidence remains valid and records: source-copy differences as presentation/navigation build state; release shell 7.3 over semantic payload 7.2.0 as intentional two-axis versioning; the full-declaration-expression construction boundary; D5 extraction-boundary defect; D6 runtime/UI `state` classification.

After R0.1A-R independent QA, R0.1B returns only for final authority/canonical-asset closure against the corrected payload. It may not bypass remediation or self-authorize R0.1C.

#### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_FINAL_QA
Classify unresolved Road LTL references as Universe canonical, Daughter-local, OK, Canonical Information/Object, cross-layer or orphan. Determine `a5-ltl-*` and `scp-*` ownership. Recommend repair without mutation. Until QA use `canonicalReferenceResolution=UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

### R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered Road LTL 1.4 package/module/Operational Knowledge into governed GitHub/Drive custody with verified hashes; reconcile any historical-vs-current identity discrepancy without assumption; normalize `taskId`/`id` overlay handling without mutating source assets; deterministically materialize effective Road LTL 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware reference checks; reproduce and re-certify P6.0 effective materialization from retained governed inputs/tooling.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Retain strong LTL OK; complete/classify objects/documents gaps; distinguish reusable recovery/jurisdiction rules from missing task knowledge; complete canonical BOL/information semantics including sections, fields, semantics, cardinality, validation, relationships, provenance/lineage, applicability and Client Binding mapping requirements.

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence. Search for/recover original readable bundle/decoder/generator and CI artifacts where available. Exact decoder recovery is preferred if it proves the original content without invention, but reproducibility still requires retained deterministic generation capability or a newly governed compiler. Never tune to historical node/count totals.

### R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
Before knowledge uplift, verify canonical Ocean FCL/LCL 0.6 source/package/module custody, exact identity and dependency closure. PUBLIC_SAFE materializations are evidence, not canonical private source. Then audit all 30 FCL + 30 LCL tasks against the LTL OK standard and preserve unresolved gaps.

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA
Run the same generic recursive compiler on Ocean FCL/LCL; prove module neutrality; certify Universe → Daughter → OK → Decomposition across Road LTL/FCL/LCL; reconcile GitHub/Drive/Supabase hashes/codecs/pointers/classifications; complete independent pre-P6 QA.

## 6. Phase 6 resumption rule
P6.2/P6.3/P6.4/P6.5 remain suspended/blocked while recovery is active. P6.2 may resume only after R0.6 independent QA using re-certified decomposition inputs.

## 7. Queue identifier rule
Canonical queue identifier is `stageId`; `currentStageId` selects current work. `id` is backward-compatible alias only. `stageId` and `status` are separate fields.

## 8. Agent behavior
Implementation agents read the machine queue, this standard and Asset Custody Standard; implement only exact `AUTHORIZED` `stageId`; produce custody checkpoints; stop at `AWAITING_INDEPENDENT_QA`; never self-authorize; never mutate historical evidence or repair downstream symptoms while upstream gates remain unresolved.
