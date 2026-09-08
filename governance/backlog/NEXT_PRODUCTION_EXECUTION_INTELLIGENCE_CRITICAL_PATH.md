# Atlas V2 — Governed Execution Roadmap and Production Critical Path

Status: ACTIVE BACKLOG / RECOVERY MODE  
Updated: 8 September 2026  
Canonical technical backlog: this file + `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` on branch `atlas-governance-registry-v2.1`.

## Operating rule

Atlas Phase 6 implementation is suspended while the Pre-P6 Foundation Recovery program is active.

Before any work, implementation agents must read:
1. `CLAUDE.md`;
2. `governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json`;
3. this roadmap;
4. `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md`;
5. the frozen architecture/contracts referenced by the authorized recovery stage.

Only a stage or sub-stage whose queue status is exactly `AUTHORIZED` may be implemented. Completion stops at `AWAITING_INDEPENDENT_QA`. No agent may self-authorize the next stage or sub-stage.

## Why recovery was inserted

The Frozen Stack Completeness & Reproducibility Audit identified cross-layer issues that must be repaired before Canonical WorkDefinition compilation resumes:

- Universe release 7.3 is not yet retained as a governed machine-readable semantic payload. Inspection shows substantial structured data embedded in the HTML and embedded release metadata declaring semantic payload 7.2.0.
- Two retained Universe HTML copies have different source hashes and therefore require authority/identity reconciliation before any one copy is treated as the sole canonical source.
- Previously unresolved Road LTL `a5-*` and `scp-*` references must not automatically be classified as missing Universe identifiers; their intended governing-layer ownership has to be established first.
- Road LTL 1.4 has been recovered and hash-verified, closing a prior dependency gap, but it must be placed into governed custody.
- Effective Road LTL 1.5 is valid as 21 inherited 1.4 tasks + direct LTL-03 1.5 override, with merge-key drift requiring explicit normalization.
- Road LTL Operational Knowledge is materially strong and task-specific, but objects/documents and canonical information semantics require hardening.
- P6.1 is not currently reproducible/live-readable with retained tooling; historical counts/certification are evidence, not rebuild targets.
- Ocean FCL/LCL 0.6 do not yet have Road-LTL-equivalent OK/decomposition depth and cannot be treated as execution-depth parity go-live assets.
- certification must now evaluate semantics, coverage, evidence, dependency closure, reproducibility, referential integrity, live readability, security, regression and deployment parity as applicable.

The recovery architecture is governed in `governance/standards/ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md`.

# Pre-P6 Recovery Program

## R0.0 — Forensic Baseline & Recovery Governance
Status: COMPLETE

Outcome:
- P6.2 paused before WorkDefinition persistence;
- recovery findings recorded;
- recovery architecture and staged backlog established;
- historical frozen/certified assets remain immutable evidence.

## R0.1 — Universe Materialization, Identity Reconciliation & Reference Ownership
Status: IN_PROGRESS_VIA_SUBSTAGES

R0.1 is deliberately split. It must not be executed as one broad task. The queue controls which sub-stage is mutable.

### R0.1A — Universe Semantic Materialization
Status: AUTHORIZED

Objective:
Mechanically materialize the existing governed Universe semantic content without changing its meaning or inventing missing identifiers.

Required work:
- inspect both retained Universe HTML copies;
- record SHA-256 of each source copy;
- retain a deterministic extractor/materializer in GitHub;
- mechanically extract embedded structured data;
- run a deterministic second pass for structures that depend on previously declared variables where this can be done without semantic inference;
- normalize the extracted semantic payload into a stable machine-readable form;
- preserve dual lineage unless contrary evidence is found:
  - release shell: Universe 7.3;
  - embedded semantic payload: Universe 7.2.0;
- compare the normalized semantic payload from the two source HTML copies;
- report all unresolved structures explicitly;
- add reproducibility tests and hashes.

Prohibited during R0.1A:
- no Universe semantic redesign;
- no Universe 7.4 creation;
- no invention of `a5-*` or `scp-*` identifiers;
- no crosswalk creation;
- no Road LTL reference mutation;
- no Road LTL OK rewrite;
- no P6.1 regeneration;
- no WorkDefinition compilation;
- no Ocean uplift;
- no Canvas redesign.

R0.1A exit evidence:
- source HTML hashes;
- extractor source and reproducibility test;
- normalized semantic-payload hash;
- structure and record counts;
- unresolved extraction list;
- proof whether the two source copies yield identical or different normalized semantic payloads.

Completion rule:
Return evidence and stop at `AWAITING_INDEPENDENT_QA`. Do not start R0.1B.

### R0.1B — Universe Release Identity & Authority Reconciliation
Status: BLOCKED_UNTIL_R0_1A_QA

Objective:
Determine the governed relationship between Universe 7.3 release identity, embedded 7.2.0 semantic identity and the two differing HTML source copies.

Required work after authorization:
- determine whether source-copy differences are semantic, presentation-only, build-state or other non-semantic variation;
- establish which source copy is authoritative, or whether authority should attach to a normalized semantic payload rather than one HTML binary;
- verify retained release-note/evidence support for the interpretation that 7.3 is a UX/foundation release over 7.2 semantics;
- define explicit governed identity fields such as `releaseVersion` and `semanticPayloadVersion`;
- recommend exactly which source and normalized hashes/assets belong in the frozen registry.

Prohibited during R0.1B:
- no semantic rewrite;
- no relabeling 7.2.0 semantics as 7.3 without evidence;
- no Universe 7.4;
- no reference-model mutation.

Completion rule:
Return identity/authority recommendation and stop at `AWAITING_INDEPENDENT_QA`. Do not start R0.1C.

### R0.1C — Canonical Reference Ownership Audit
Status: BLOCKED_UNTIL_R0_1B_QA

Objective:
Classify every unresolved Road LTL reference by its intended governing layer before deciding whether an extension, crosswalk or reference-contract correction is required.

Required work after authorization:
- inventory every Road LTL reference previously treated as an unresolved Universe canonical reference;
- classify each as one of:
  - Universe canonical ID;
  - Daughter-local structural ID;
  - Operational Knowledge ID;
  - Canonical Information/Object ID;
  - cross-layer concept ID;
  - invalid/orphaned reference;
- determine whether `a5-ltl-*` identifiers are Daughter-local rather than Universe-canonical;
- determine intended ownership of `scp-*` identifiers using frozen architecture/contracts and retained evidence;
- distinguish true referential defects from valid cross-layer/local identifiers;
- recommend the appropriate repair path: Universe extension, governed crosswalk, reference-contract correction or orphan cleanup.

Prohibited during R0.1C:
- no crosswalk invention;
- no new canonical IDs;
- no Universe 7.4 creation;
- no Daughter-ID mutation;
- no Road LTL semantic changes;
- no canonical-reference mutation.

Required interim status language:
`canonicalReferenceResolution = UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT`

Do not describe `0/22` as 22 proven Universe defects before ownership has been established.

R0.1 overall exit gate:
- machine-readable Universe semantic materialization retained and reproducible;
- release/semantic identity and authority explicitly governed;
- unresolved references classified by intended layer;
- actual referential defects distinguished from Daughter-local/cross-layer identifiers;
- independent QA approves the repair path before R0.2 begins.

## R0.2 — Road LTL Source Closure & Effective 1.5 Re-certification
Status: BLOCKED_UNTIL_R0_1_QA

Objective:
Make `road-ltl@1.5` dependency-closed and deterministically resolvable.

Required deliverables:
- place recovered Road LTL 1.4 package/module/Operational Knowledge into governed GitHub/Drive custody with verified hashes;
- normalize `taskId`/`id` overlay handling without mutating source assets;
- deterministically materialize 22-task effective 1.5: 21 inherited 1.4 + LTL-03 direct 1.5 override;
- preserve per-task lineage and prove no silent drop/duplication;
- rerun reference-integrity checks using the ownership rules established in R0.1C.

Exit gate:
- complete Road LTL source dependency closure;
- exact deterministic 22-task effective module;
- 21×1.4 + 1×1.5 lineage independently certified.

## R0.3 — Road LTL Operational Knowledge + Canonical Information Hardening
Status: BLOCKED_UNTIL_R0_2_QA

Objective:
Preserve the strong LTL OK while closing execution-critical knowledge/object gaps.

Required deliverables:
- governed 22-task OK coverage matrix;
- close or explicitly classify objects/documents gaps;
- distinguish global reusable recovery/jurisdiction rules from missing task-specific knowledge;
- complete canonical BOL/information semantics: sections, fields/data elements, semantics, cardinality, validation, relationships, provenance/lineage, applicability and Client Binding mapping requirements;
- preserve unresolved semantics/evidence gaps explicitly;
- prevent client-specific values from entering canonical knowledge.

Exit gate:
- Road LTL OK meets governed execution-depth standard;
- canonical BOL/object contract is first-class and dependency-closed;
- remaining knowledge gaps are explicit blockers, not inferred away.

## R0.4 — Generic Recursive Decomposition Compiler & Road LTL Re-certification
Status: BLOCKED_UNTIL_R0_3_QA

Objective:
Restore the reproducible OK → Recursive Work Decomposition bridge.

Required deliverables:
- preserve historical P6.1 certification/payload as immutable evidence;
- recover decoder only if exact old content can be proven without invention;
- retain a deterministic module-neutral recursive decomposition compiler conforming to frozen contracts;
- run governed effective Road LTL 1.5 through it;
- stop by executability criterion, not fixed hierarchy depth;
- certify new graph on derived counts, never historical-count targeting;
- persist through retained governed codec/schema;
- prove live protected readback on real persisted data;
- reconcile repo migrations with live schema.

Exit gate:
- Road LTL decomposition is reproducible from governed sources/tooling;
- live protected payload/API is readable;
- schema/repo/live state agree;
- explicit supersession/recertification lineage recorded.

## R0.5 — Ocean FCL/LCL 0.6 Operational Knowledge Depth Uplift
Status: BLOCKED_UNTIL_R0_4_QA

Objective:
Bring Ocean FCL/LCL to the same governed OK standard required for execution depth.

Required deliverables:
- audit all 30 FCL + 30 LCL tasks against the same OK dimensions as LTL;
- research/curate genuine Ocean-specific triggers, inputs, rules, exceptions, recovery, jurisdiction/applicability, evidence, actors/systems, controls and gaps;
- extend canonical document/object contracts where required;
- preserve evidence provenance and unresolved gaps;
- no copied LTL logic merely to satisfy coverage.

Exit gate:
- Ocean FCL and LCL meet governed OK threshold or carry explicit owner-approved exclusions/risks;
- no false execution-depth parity claim remains.

## R0.6 — Multi-Mode Decomposition Proof & Pre-P6 Readiness Certification
Status: BLOCKED_UNTIL_R0_5_QA

Objective:
Prove repaired Atlas architecture generically across Road LTL + Ocean before returning to Phase 6.

Required deliverables:
- run the same generic recursive decomposition compiler on Ocean FCL 0.6 and Ocean LCL 0.6;
- validate blockers/executability without manual WorkDefinition authoring;
- prove no hidden mode-specific compiler logic;
- run certification matrix across Universe → Daughter → OK → Decomposition for all three modules;
- update frozen classifications/registers truthfully.

Exit gate:
- Road LTL/FCL/LCL have dependency-closed reproducible paths through Recursive Work Decomposition;
- applicable certification dimensions pass or explicit owner-accepted risk is recorded;
- independent QA explicitly authorizes return to P6.2.

# Phase 6 — SUSPENDED UNTIL R0.6 QA

## P6.2 — Canonical WorkDefinition Compilation
Status: SUSPENDED_BY_RECOVERY_GATE

Existing P6.2 code may be retained as implementation work-in-progress, but no canonical WorkDefinition persistence/certification may proceed until R0.6 QA passes. New WorkDefinitions must consume the re-certified decomposition chain, not rely solely on the historical unreadable P6.1 package.

## P6.3 — Identity, Authorization & Public/Protected Certification
Status: BLOCKED_UNTIL_P6_2_QA

## P6.4 — Generic Recursive Decomposition Compiler + Ocean 0.6 Execution Depth
Status: TO_BE_RESCOPED_AFTER_RECOVERY

The former P6.4 generic-decomposition/Ocean scope is absorbed by R0.4–R0.6. Do not execute old P6.4 as written after recovery; governance must re-scope/remove it.

## P6.5 — Atlas V2 Integration & Production Certification
Status: BLOCKED_UNTIL_PRIOR_QA

## Atlas V2.0 — GO LIVE
Status: BLOCKED

No implementation agent may declare production go-live. Promotion requires explicit independent QA / owner authorization.

# Permanent governance rules introduced by recovery

A frozen hash/certification alone does not equal completeness. Each asset must be evaluated against applicable dimensions:
- SEMANTICS
- COVERAGE
- EVIDENCE
- DEPENDENCY_CLOSURE
- REPRODUCIBILITY
- REFERENTIAL_INTEGRITY
- LIVE_READABILITY
- SECURITY_BOUNDARY
- REGRESSION
- DEPLOYMENT_PARITY

Historical assets are immutable. Corrections are new governed supersessions/materializations with explicit lineage.

# Source-of-truth hierarchy

1. Frozen Knowledge-to-Execution architecture/contracts.
2. `ATLAS_PRE_P6_FOUNDATION_RECOVERY_STANDARD_V1.md` while recovery is active.
3. `ATLAS_V2_AGENT_EXECUTION_QUEUE.json` for machine-readable authorization.
4. This roadmap for human-readable intent/scope/acceptance gates.
5. GitHub implementation/evidence for actual code/technical lineage.
6. Drive for durable governed copies/evidence; it is not a competing mutable execution queue.

If sources conflict, stop and report the conflict rather than selecting the easiest interpretation.
