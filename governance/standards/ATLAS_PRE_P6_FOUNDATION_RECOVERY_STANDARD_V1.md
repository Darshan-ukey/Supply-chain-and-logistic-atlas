# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Current revision: synchronized with R0.1A/B/C and Asset Custody Standard  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose

Atlas development is temporarily moved out of the Phase 6 implementation sequence to repair and re-certify the governed foundation discovered during the Frozen Stack Completeness & Reproducibility Audit.

This is recovery of the existing architecture, not redesign. The frozen Knowledge-to-Execution architecture remains authoritative:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

The recovery objective is to make each applicable layer semantically complete, dependency-closed, reproducible, referentially coherent, live-readable and independently certifiable before Phase 6 resumes.

This standard operates together with `governance/standards/ATLAS_ASSET_CUSTODY_AND_GOVERNANCE_SYNC_STANDARD_V1.md`. Every recovery stage must follow its three custody checkpoints.

## 2. Current disposition

- Governance architecture/standards remain valid and are not to be redesigned.
- Universe release 7.3 contains substantial embedded structured data, while embedded release metadata self-declares semantic payload 7.2.0. Two retained HTML copies differ in source hash and require controlled materialization plus identity/authority reconciliation.
- Unresolved Road LTL `a5-*` and `scp-*` identifiers must not be presumed missing Universe identifiers until reference ownership is established.
- Road LTL 1.4 source package has been recovered and hash-verified, but must be placed into governed repository/vault custody.
- Effective Road LTL 1.5 resolves as 21 unchanged tasks inherited from 1.4 plus direct governed LTL-03 1.5 override; `taskId`/`id` drift must be normalized by governed merge logic.
- Road LTL Operational Knowledge is materially deep and task-specific; it should be hardened rather than rewritten.
- Canonical information/object semantics, especially BOL, remain partial and require completion.
- P6.1 certification cannot currently support reproducibility claims: generator is not retained, live protected payload is unreadable by retained tooling, and repo/live encoding constraints diverge.
- Ocean FCL/LCL 0.6 do not yet have Road-LTL-equivalent Operational Knowledge depth or recursive decomposition and therefore cannot be treated as execution-depth parity go-live assets.

## 3. Recovery principles

### 3.1 Preserve before repair
Historical frozen/certified artifacts are immutable evidence. Corrections are new governed materializations/supersessions with explicit lineage.

### 3.2 No count-target reconstruction
Historical P6.1 counts such as 603/444/185/163/96 are evidence of the old run, not rebuild targets.

### 3.3 No business-knowledge fabrication
Missing domain knowledge must be resolved from governed sources/research or remain an explicit knowledge gap.

### 3.4 Dependency closure is mandatory
An execution asset cannot be complete if a required base, overlay, source payload, schema, generator, resolver or live representation is absent/unverifiable.

### 3.5 Machine-readable canonical sources
Canonical structural/operational truth must be available in machine-readable form suitable for deterministic resolution/compilation where applicable.

### 3.6 Generic before multi-mode scale
Reusable compilers/renderers remain module-neutral. Mode-specific semantics belong in governed mode knowledge.

### 3.7 Public/protected boundary remains frozen
Recovery must not weaken execution-IP protection.

### 3.8 Asset custody and governance synchronization are mandatory
Before each mutation, create `PRE_CHANGE_BASELINE`. After implementation and before QA, create `POST_IMPLEMENTATION_PRE_QA` and stop. After independent QA, create `POST_QA_GOVERNED_STATE`, synchronize GitHub/Drive/applicable live evidence, and only then authorize the next stage.

Any architecture, governance, recovery-path, authorization or certification-rule change must be committed to the governance branch before Claude/implementation agents act on it. Chat alone is not execution authority.

## 4. Certification dimensions

An asset is not `FROZEN_COMPLETE` merely because a hash or CI run exists. Assess all applicable dimensions:
1. SEMANTICS
2. COVERAGE
3. EVIDENCE
4. DEPENDENCY_CLOSURE
5. REPRODUCIBILITY
6. REFERENTIAL_INTEGRITY
7. LIVE_READABILITY
8. SECURITY_BOUNDARY
9. REGRESSION
10. DEPLOYMENT_PARITY

Allowed interim classifications include `FROZEN_REFERENCE`, `FROZEN_DELTA`, `FROZEN_PARTIAL`, `SEMANTICALLY_VALID_REPRODUCIBILITY_BLOCKED`, and `RECERTIFICATION_REQUIRED`.

## 5. Recovery stages

### R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

Purpose: pause P6.2, preserve discovered state, establish recovery architecture/queue and protect historical evidence.

### R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

R0.1 must not be executed as one broad task. Only the sub-stage whose queue status is exactly `AUTHORIZED` may mutate assets.

#### R0.1A — Universe Semantic Materialization
Status: AUTHORIZED

Purpose: mechanically materialize existing governed Universe semantic content without semantic invention.

Required work:
- inspect both retained Universe HTML copies and record SHA-256 for each;
- retain deterministic extractor/materializer in GitHub;
- mechanically extract embedded structured data;
- perform deterministic seeded-context/second-pass extraction for dependent structures where possible without inference;
- normalize into stable machine-readable semantic payload;
- preserve dual lineage unless contrary evidence is proven: release shell `7.3`, embedded semantic payload `7.2.0`;
- compare normalized semantic outputs from both source copies;
- record extraction completeness/unresolved structures;
- add reproducibility tests/hashes;
- complete `PRE_CHANGE_BASELINE` and `POST_IMPLEMENTATION_PRE_QA` custody checkpoints and Drive candidate evidence.

Prohibited:
- no Universe redesign or 7.4 creation;
- no invention of `a5-*`/`scp-*` IDs;
- no crosswalk;
- no Road LTL reference mutation;
- no Road LTL OK/P6.1/WorkDefinition/Ocean/Canvas work.

Completion: stop at `AWAITING_INDEPENDENT_QA`; do not start R0.1B.

#### R0.1B — Universe Release Identity & Authority Reconciliation
Status: BLOCKED_UNTIL_R0_1A_QA

Purpose: establish governed relationship between release 7.3, embedded semantic 7.2.0 and the two differing HTML source copies.

Required after authorization:
- classify HTML differences as semantic/presentation/build-state/noise;
- determine source authority or normalized-payload authority;
- verify release-note evidence for 7.3 UX/foundation-over-7.2 semantics;
- define governed `releaseVersion` and `semanticPayloadVersion`;
- recommend canonical/frozen hashes/assets.

No semantic rewrite, 7.4, or reference-model mutation.

#### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_QA

Purpose: classify every unresolved Road LTL reference by intended governing layer before selecting a repair.

Classifications:
- Universe canonical ID;
- Daughter-local structural ID;
- Operational Knowledge ID;
- Canonical Information/Object ID;
- cross-layer concept ID;
- invalid/orphaned reference.

Required after authorization:
- determine whether `a5-ltl-*` is Daughter-local;
- determine intended ownership of `scp-*` from frozen evidence;
- distinguish true referential defects from valid local/cross-layer identifiers;
- recommend Universe extension, governed crosswalk, reference-contract correction or orphan cleanup without mutating the model.

Until independent approval use:
`canonicalReferenceResolution = UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`

Do not describe `0/22` as 22 proven Universe defects before ownership is established.

R0.1 exit requires machine-readable reproducible Universe semantics, governed identity/authority, reference ownership classification, completed `POST_QA_GOVERNED_STATE`, and independent QA approval of the repair path.

### R0.2 — Road LTL Source Closure & Effective 1.5 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA

Place recovered 1.4 source/package/OK in governed GitHub/Drive custody, normalize overlay handling without mutating source payloads, deterministically materialize 22-task effective 1.5, preserve 21×1.4 + LTL-03×1.5 lineage, and rerun ownership-aware integrity checks.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA

Retain strong LTL OK, complete/explicitly classify objects/documents gaps, distinguish reusable recovery/jurisdiction rules from missing task knowledge, and complete first-class canonical BOL/information semantics including sections, fields, semantics, cardinality, validation, relationships, provenance/lineage, applicability and Client Binding mapping requirements.

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA

Preserve old P6.1 as immutable evidence; optionally recover exact decoder; retain a deterministic module-neutral recursive compiler; run governed effective Road LTL 1.5; stop by executability criterion; derive new counts honestly; persist with retained codec/schema; prove real live protected readback; reconcile repo/live migrations.

### R0.5 — Ocean FCL/LCL 0.6 Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA

Audit 30 FCL + 30 LCL tasks against the same OK standard, curate genuine Ocean-specific knowledge/provenance, extend canonical objects/documents as required, and preserve unresolved gaps. Do not copy LTL semantics simply to satisfy coverage.

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

Run the same generic recursive compiler on Ocean FCL/LCL, prove module-neutral behavior, certify Universe → Daughter → OK → Decomposition across LTL/FCL/LCL, truthfully reclassify frozen assets, complete custody checkpoints and obtain independent QA authorization to return to P6.2.

## 6. Phase 6 resumption rule

P6.2/P6.3/P6.4/P6.5 remain suspended/blocked while recovery is active. After R0.6 independent QA, resume P6.2 with re-certified decomposition inputs. Former P6.4 generic-decomposition/Ocean scope is absorbed by R0.4–R0.6 and must be re-scoped before execution.

## 7. Queue identifier rule

Canonical queue identifier field is `stageId`; `currentStageId` selects current work. `id` is a backward-compatible alias only. `stageId` and `status` are separate fields and must never be inferred from concatenated rendering.

## 8. Agent behavior

Implementation agents must:
- read the machine queue, this recovery standard and Asset Custody Standard before work;
- implement only `stageId` whose status is exactly `AUTHORIZED`;
- produce custody checkpoints required for the stage;
- stop at `AWAITING_INDEPENDENT_QA`;
- never self-authorize the next stage;
- never repair downstream symptoms while upstream recovery gates remain unresolved;
- never mutate historical evidence to make a gate pass.

Independent QA/owner advances each stage only after `POST_QA_GOVERNED_STATE` is synchronized.