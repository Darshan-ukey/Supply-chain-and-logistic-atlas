# Atlas Pre-P6 Foundation Recovery Standard V1

Status: OWNER_AUTHORIZED_RECOVERY_STANDARD  
Effective: 8 September 2026  
Applies before any further P6.2/P6.3/P6.4/P6.5 execution.

## 1. Purpose

Atlas development is temporarily moved out of the Phase 6 implementation sequence to repair and re-certify the governed foundation discovered during the Frozen Stack Completeness & Reproducibility Audit.

This is a recovery of the existing architecture, not a redesign. The frozen Knowledge-to-Execution architecture remains authoritative:

`Authoritative Sources → Universe → Daughter Domain Model → Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition → Client Binding → Runtime Projection / Compiler → Execution → Evidence / Feedback`

The recovery objective is to make each applicable layer semantically complete, dependency-closed, reproducible, referentially coherent, live-readable and independently certifiable before Phase 6 resumes.

## 2. Current disposition

The following findings govern recovery sequencing:

- Governance architecture/standards remain valid and are not to be redesigned.
- Road LTL 1.4 source package has been recovered and hash-verified, but must be placed into governed repository/vault custody.
- Effective Road LTL 1.5 resolves as 21 unchanged tasks inherited from 1.4 plus the direct governed LTL-03 1.5 override; key-name drift (`taskId` vs `id`) must be normalized by governed merge logic.
- Road LTL Operational Knowledge is materially deep and task-specific; it should be hardened rather than rewritten.
- Canonical information/object semantics, especially BOL, remain partial and require completion of sections/cardinality/provenance-lineage/applicability/client-binding mapping requirements.
- P6.1 certification cannot currently support reproducibility claims: generator is not retained, live protected payload is unreadable by retained tooling, and repo/live encoding constraints diverge.
- Ocean FCL/LCL 0.6 do not yet have Road-LTL-equivalent Operational Knowledge depth or recursive decomposition and therefore cannot be treated as execution-depth parity go-live assets.
- Some registered frozen assets are references/build artifacts without machine-verifiable dependency closure. Certification must become asset-type aware rather than assuming one evidence form for every asset.

## 3. Recovery principles

### 3.1 Preserve before repair

Historical frozen/certified artifacts are immutable evidence. Never overwrite, relabel or silently reinterpret them. Corrections are new governed materializations/supersessions with explicit lineage.

### 3.2 No count-target reconstruction

Historical P6.1 counts such as 603/444/185/163/96 are evidence of the old run, not targets for a new compiler. A rebuilt recursive decomposition must derive its own counts from governed knowledge and the frozen executability criterion.

### 3.3 No business-knowledge fabrication

Missing domain knowledge must be resolved from governed sources/research or remain an explicit knowledge gap. Implementation agents must not invent operational rules to make coverage or executability appear complete.

### 3.4 Dependency closure is mandatory

An execution asset cannot be classified complete if a required base, overlay, source payload, schema, generator, resolver or live representation is absent or unverifiable.

### 3.5 Machine-readable canonical sources

Where a layer is intended to be canonical structural or operational truth, its governed content must be available in a machine-readable form suitable for deterministic resolution/compilation. Human HTML/doc views may remain generated/reference views.

### 3.6 Generic before multi-mode scale

Reusable compilers/renderers must remain module-neutral. Ocean-specific logic may live in governed Ocean knowledge, never inside generic decomposition/WorkDefinition compilers.

### 3.7 Public/protected boundary remains frozen

Recovery must not weaken execution-IP protection. Protected Operational Knowledge, decomposition and WorkDefinition details remain server-side/capability-gated. PUBLIC_SAFE views must remain non-reconstructive.

## 4. Certification dimensions

Going forward, an asset is not considered `FROZEN_COMPLETE` merely because a hash or CI run exists. Each applicable asset must be evaluated on:

1. SEMANTICS — intended meaning is governed and internally coherent.
2. COVERAGE — required scope/depth is complete or explicitly gap-classified.
3. EVIDENCE — material knowledge/claims have governed provenance appropriate to asset type.
4. DEPENDENCY_CLOSURE — every required base/overlay/reference/tool can be resolved.
5. REPRODUCIBILITY — retained tooling can deterministically regenerate/materialize the asset where applicable.
6. REFERENTIAL_INTEGRITY — canonical IDs/relationships resolve against their governing layer.
7. LIVE_READABILITY — deployed/persisted representation can actually be read by the retained runtime/API where applicable.
8. SECURITY_BOUNDARY — protected/public classification and authorization are enforced.
9. REGRESSION — prior certified semantics/boundaries remain intact unless explicitly superseded.
10. DEPLOYMENT_PARITY — deployed branch/commit/schema match the certified release where applicable.

Allowed interim classifications include `FROZEN_REFERENCE`, `FROZEN_DELTA`, `FROZEN_PARTIAL`, `SEMANTICALLY_VALID_REPRODUCIBILITY_BLOCKED`, and `RECERTIFICATION_REQUIRED`.

## 5. Recovery stages

### R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE_BY_OWNER_GOVERNANCE_UPDATE

Purpose: preserve the discovered state and stop Phase 6 from progressing on incomplete assumptions.

Exit evidence:
- P6.2 paused; no WorkDefinitions persisted;
- current defects/findings recorded;
- recovery standard + staged backlog + machine queue committed;
- no historical frozen artifact mutated.

### R0.1 — Canonical Universe 7.3 Materialization & Referential Integrity
Status: FIRST RECOVERY IMPLEMENTATION STAGE

Purpose: establish the canonical machine-readable Universe layer required by all Daughter references.

Required work:
- inspect the authoritative Universe 7.3 HTML/reference and any retained upstream source;
- determine whether the authoritative representation contains sufficient nodes/IDs/relationships for lossless deterministic materialization;
- create a governed machine-readable Universe 7.3 payload without semantic redesign;
- establish explicit ID/relationship schema and deterministic materializer/validator;
- reconcile all Road LTL canonical references (including `a5-ltl-*` / `scp-*` references) against the machine-readable Universe;
- classify any genuinely absent canonical IDs as semantic defects rather than inventing replacements;
- add referential-integrity CI tests;
- preserve/hash-register authoritative input and generated canonical output.

Exit gate:
- Universe canonical payload retained in GitHub/governed vault;
- 100% of valid Road LTL canonical references resolve or explicit governed defects are reported and owner-approved;
- materialization is deterministic and independently reproducible;
- no downstream LTL semantics changed silently.

### R0.2 — Road LTL Source Closure & Effective 1.5 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA

Purpose: make Road LTL 1.5 dependency-closed and deterministically resolvable.

Required work:
- place recovered Road LTL 1.4 package/module/Operational Knowledge into governed repository/vault locations with verified hashes;
- normalize the version overlay contract (`taskId`/`id` drift) without mutating source payloads;
- materialize effective `road-ltl@1.5` deterministically as 21 inherited 1.4 tasks + direct LTL-03 1.5 override;
- prove no task is silently dropped/duplicated;
- preserve per-task semantic source lineage;
- re-run Universe referential-integrity checks against effective 1.5.

Exit gate:
- complete source dependency closure for road-ltl@1.5;
- exact 22-task effective module reproduced deterministically;
- lineage 21×1.4 + 1×1.5 independently certified.

### R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA

Purpose: retain the strong existing LTL knowledge while closing execution-relevant depth gaps before decomposition.

Required work:
- create a 22-task OK coverage matrix against the governed knowledge dimensions;
- preserve task-specific existing knowledge; do not rewrite strong areas;
- close or explicitly classify objects/documents gaps;
- distinguish legitimately global recovery/jurisdiction rules from missing task-specific knowledge;
- complete first-class canonical information/object semantics, prioritizing BOL: sections, fields/data elements, semantics, cardinality, validation, relationships, provenance/lineage, applicability and client-binding mapping requirements;
- retain unresolved semantics and evidence gaps explicitly;
- verify no client-specific values are embedded in canonical knowledge.

Exit gate:
- Road LTL OK coverage certified at the required execution standard;
- canonical BOL/object contract satisfies the frozen first-class information semantics principle;
- all remaining gaps are explicitly governed and block decomposition/executability where appropriate.

### R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA

Purpose: restore the missing reproducible bridge from governed Operational Knowledge to Recursive Work Decomposition.

Required work:
- retain the old P6.1 payload/certification as immutable historical evidence;
- attempt decoder/tool recovery only if it can reproduce the exact old content without invention;
- regardless of old decoder recovery, retain a deterministic module-neutral recursive decomposition compiler conforming to the frozen Work Decomposition contract and executability standard;
- run governed effective Road LTL 1.5 through the compiler;
- stop recursion based on executability criterion, not hierarchy depth;
- preserve blockers, evidence, controls, exceptions, transitions and source lineage;
- certify the new graph on its own derived counts; do not tune to historical counts;
- persist using a retained, governed codec/schema and prove live protected readback against production-like data, not only synthetic fixtures;
- reconcile repo migrations with live schema.

Exit gate:
- Road LTL decomposition is reproducible from governed sources/tooling;
- live protected row/package is readable by retained API;
- schema/migration/live state agree;
- historical P6.1 remains preserved with explicit supersession/recertification lineage.

### R0.5 — Ocean FCL/LCL 0.6 Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA

Purpose: bring Ocean FCL/LCL to the same governed Operational Knowledge standard required for Atlas execution depth.

Required work:
- audit all 30 FCL + 30 LCL A5 tasks against the same OK coverage dimensions used for Road LTL;
- research/curate genuine Ocean-specific triggers, inputs, rules, exceptions, recovery, jurisdiction/applicability, evidence, systems/actors, controls and knowledge gaps;
- do not copy LTL baseline knowledge into Ocean merely to satisfy coverage;
- build/extend relevant canonical object/information contracts for Ocean documents/data;
- preserve evidence provenance and unresolved gaps.

Exit gate:
- Ocean FCL/LCL each meet the governed OK depth threshold or have explicit owner-approved exclusions/risks;
- no false parity claim remains.

### R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

Purpose: prove the repaired architecture works generically across Road LTL and Ocean before returning to Phase 6.

Required work:
- run the same generic recursive decomposition compiler on Ocean FCL 0.6 and Ocean LCL 0.6;
- validate blockers/executability without manual WorkDefinition authoring;
- certify module-neutral behavior and no hidden mode-specific compiler logic;
- run the complete certification matrix across Universe → Daughter → OK → Decomposition for all three modules;
- update frozen classifications/registries truthfully.

Exit gate:
- Road LTL, Ocean FCL and Ocean LCL traverse a dependency-closed, reproducible governed chain through Recursive Work Decomposition;
- all applicable certification dimensions pass or explicit owner-accepted risks are recorded;
- independent QA explicitly authorizes return to P6.2.

## 6. Phase 6 resumption rule

P6.2, P6.3, P6.4 and P6.5 are suspended while recovery is active.

After R0.6 independent QA:
- resume P6.2 Canonical WorkDefinition compilation using the newly certified generic/dependency-closed decomposition inputs;
- P6.4's former generic-decomposition/Ocean scope is considered absorbed by R0.4–R0.6 and must be re-scoped before execution;
- do not use historical unreadable P6.1 output as the sole authority for new WorkDefinitions.

## 7. Agent behavior

Claude/implementation agents must:
- read the recovery queue before selecting work;
- implement only the recovery stage marked `AUTHORIZED`;
- stop at `AWAITING_INDEPENDENT_QA` after each stage;
- never self-authorize the next stage;
- never repair a downstream symptom while an upstream recovery gate is unresolved;
- never mutate historical evidence to make a gate pass.

Independent QA/owner advances each stage.
