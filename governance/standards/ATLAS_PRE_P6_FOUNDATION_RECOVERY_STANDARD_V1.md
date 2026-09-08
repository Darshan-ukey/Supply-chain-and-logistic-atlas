# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Current revision: R0.1A independently QA-certified; R0.1B authorized.  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose
Atlas is in recovery mode to repair and re-certify the existing Knowledge-to-Execution chain, not redesign it:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

Every recovery stage also follows `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`.

## 2. Current disposition
- Governance architecture, contracts, Canvas/Daughter/Ask/Trace projection architecture remain intact.
- R0.1A independently certified a reproducible mechanical Universe materialization under governed GitHub and Drive custody: three retained physical HTML copies, two distinct source hashes, 113 independently inventoried module-scope declarations, 61 data-bearing structures materialized, 1,330 records, and 0 unresolved extraction targets.
- Universe release shell 7.3 still contains embedded metadata self-declaring semantic payload 7.2.0. Release/semantic identity and authority remain unresolved and are owned by R0.1B.
- Three structures differ across the retained source copies (`defaults`, `liveModuleRoutes`, `moduleCoverageStatus`); R0.1A records those differences without classifying them. R0.1B determines whether they are semantic, presentation, build-state or noise.
- Construction-boundary field-set divergence is reproducibly observed across 189 records reachable from multiple structures. R0.1B must determine the canonical payload/construction boundary without inventing or dropping fields by assumption. The materialized `state` structure must likewise be classified as canonical semantic content or runtime/UI state in R0.1B.
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
2. No count-target reconstruction: historical P6.1 counts are evidence, never rebuild targets.
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
Status: COMPLETE — INDEPENDENT QA PASS

Certified result: 61/61 data-bearing structures materialized, 1,330 records, 0 unresolved extraction targets; exact candidate custody mirrored and hash-verified in Drive. Checkpoint C: `governance/recovery/R0.1A/POST_QA_GOVERNED_STATE.json`.

R0.1A mechanically materialized existing Universe content without semantic redesign, unsupported version relabeling, invented IDs, crosswalk creation, daughter mutation, P6.1/WorkDefinition/Ocean/Canvas work, or authority selection. The earlier 52-structure / `95d976ff...` materialization is superseded and must not be reused.

#### R0.1B — Universe Release Identity & Authority Reconciliation
Status: AUTHORIZED

Use the independently certified R0.1A evidence to:
- determine whether the three source-copy differences are semantic, presentation, build-state or noise;
- establish authoritative source-copy or normalized-payload authority;
- verify release-note/lineage evidence for release shell 7.3 versus embedded semantic 7.2.0;
- define governed `releaseVersion` and `semanticPayloadVersion` semantics;
- determine the canonical construction boundary for the 189 field-set-divergent records without fabricating fields;
- determine whether materialized `state` belongs in canonical semantic payload or runtime/UI state;
- recommend exact canonical/frozen hashes, asset identities and supersession treatment.

No semantic rewrite, unsupported relabeling, Universe 7.4, reference-model mutation, invented fields/IDs, or R0.1C ownership decisions.

#### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_QA
Classify unresolved Road LTL references as Universe canonical, Daughter-local, OK, Canonical Information/Object, cross-layer or orphan. Determine `a5-ltl-*` and `scp-*` ownership. Recommend repair without mutation. Until QA use `canonicalReferenceResolution=UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`.

### R0.2 — Road LTL Source Closure, Effective 1.5 & P6.0 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA
Place recovered Road LTL 1.4 package/module/Operational Knowledge into governed GitHub/Drive custody with verified hashes; reconcile any historical-vs-current identity discrepancy without assumption; normalize `taskId`/`id` overlay handling without mutating source assets; deterministically materialize effective Road LTL 1.5; prove 21×1.4 + LTL-03×1.5 lineage; rerun ownership-aware reference checks; reproduce and re-certify P6.0 effective materialization from retained governed inputs/tooling. The historical source-vault ZIP is high-value evidence if recovered, but exact hash-verified underlying assets can close dependency custody without making that ZIP a mandatory blocker.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA
Retain strong LTL OK; complete/classify objects/documents gaps; distinguish reusable recovery/jurisdiction rules from missing task knowledge; complete canonical BOL/information semantics including sections, fields, semantics, cardinality, validation, relationships, provenance/lineage, applicability and Client Binding mapping requirements.

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA
Preserve historical P6.1 evidence. Search for/recover original readable bundle/decoder/generator and CI artifacts where available. Exact decoder recovery is preferred if it proves the original content without invention, but reproducibility still requires retained deterministic generation capability or a newly governed compiler. Run governed effective Road LTL 1.5 through a module-neutral recursive compiler; stop by executability criterion; derive counts honestly; persist via retained codec/schema; prove real protected readback; reconcile repo/live migrations. Never tune to 603/444/185/163/96.

### R0.5 — Ocean FCL/LCL 0.6 Source Closure & Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA
Before knowledge uplift, verify canonical Ocean FCL/LCL 0.6 source/package/module custody, exact identity and dependency closure. PUBLIC_SAFE materializations are evidence, not canonical private source. Then audit all 30 FCL + 30 LCL tasks against the LTL OK standard, curate genuine Ocean-specific knowledge/provenance, extend canonical objects/documents, and preserve unresolved gaps. Do not copy LTL semantics merely to satisfy coverage.

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA
Run the same generic recursive compiler on Ocean FCL/LCL; prove module neutrality; certify Universe → Daughter → OK → Decomposition across Road LTL/FCL/LCL; reconcile GitHub/Drive/Supabase hashes/codecs/pointers/classifications; truthfully update registers; complete custody checkpoints; independent QA authorizes return to P6.2.

## 6. Phase 6 resumption rule
P6.2/P6.3/P6.4/P6.5 remain suspended/blocked while recovery is active. P6.2 may resume only after R0.6 independent QA using re-certified decomposition inputs. Former P6.4 generic-decomposition/Ocean scope is absorbed by R0.4–R0.6 and must be re-scoped before execution.

## 7. Queue identifier rule
Canonical queue identifier is `stageId`; `currentStageId` selects current work. `id` is backward-compatible alias only. `stageId` and `status` are separate fields.

## 8. Agent behavior
Implementation agents read the machine queue, this standard and Asset Custody Standard; implement only exact `AUTHORIZED` `stageId`; produce custody checkpoints; stop at `AWAITING_INDEPENDENT_QA`; never self-authorize; never mutate historical evidence or repair downstream symptoms while upstream gates remain unresolved.
