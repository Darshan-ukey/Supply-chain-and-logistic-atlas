# Claude ↔ ChatGPT — Atlas Shared Coordination Log

**Status:** CANONICAL ACTIVE CONTROL LOG  
**Current disposition:** `DEMO_COMPLETE__POST_DEMO_ARCHITECTURE_GAPS_CAPTURED__AR0_2_ACTIVE`

Read this file first. The immediately preceding demo-control state is preserved in Git blob `aef3decdd859ae1c6ae43521e60a9598b9799a5c`; do not reread it unless this packet explicitly requires it.

## Coordination protocol
1. Read only the ACTIVE TASK mandatory review set below, in order.
2. Supporting logs not named here are not mandatory.
3. Do not create a new coordination/control log for this task; update this file only.
4. When ChatGPT and Claude independently converge, proceed automatically unless an Owner gate is explicitly named.
5. Demo-only workarounds are now historical evidence, not the active architecture baseline.

---

# CLOSED / PRESERVED EVIDENCE

The stakeholder demo sprint is complete. Preserve, but do not extend as the active program:

- P6.1 CR1–CR11 frozen reconstruction baseline `3c67bb49445b6296bf6f2ccdf0c96d44d47abca0`.
- P6.1 repeatability freeze `fd86c71dd44a6e8e22c3281d6e779947c1e98223`.
- LTL-03 R2 independent closure `bcf0acd3455d0ddc39b1ffe0a7c6722bb15237d2`.
- LTL-01 R1 independent closure `527b4abe0ada64c65b58cdff50bfe7f977ed22f7`.
- Four representative non-persisted P6.2 Canonical WorkDefinitions in `data/demo-internal/p6-2-representative-workdefinitions.json` @ `383de3b1ea897856cc381a517287c1b5095ea6f9`.
- Demo UI/protected-detail work is evidence that the conceptual chain can be shown; it is not authority to turn `internalDemo`, representative JSON or special routes into production architecture.

Remaining Road LTL task reconstruction stays deferred pending architecture re-baseline.

---

# ACTIVE TASK — POST-DEMO ARCHITECTURE HARDENING REVIEW

## Governing stage

**AR0.2 — Layer-Boundary Decision** remains the current Owner gate.

No AR0.3 contract build, R0.4 recovery/reconstruction, bulk P6.2 persistence, P6.3/P6.4 continuation or production promotion is authorized by this packet.

## Mandatory review set — read in this order

### 1. Updated Architecture Refinement Backlog

`governance/architecture-refinement/ARCHITECTURE_REFINEMENT_BACKLOG_V1.md`  
Latest governance update commit: **`f645b8b3db5e1d01c32c744bd5cba9868d51c4d2`**

Mandatory demo-exposed architecture requirements now comprise:
- `DG-01` Asset custody and dependency closure
- `DG-02` Derived-output reproducibility
- `DG-03` Production protected-data delivery path
- `DG-04` Canonical WorkDefinition materialization/store closure
- `DG-05` Enterprise Context / Client Binding as a first-class layer
- `DG-06` Effective governed version resolution
- `DG-07` Unified navigation and projection context
- `DG-08` Same-lineage downstream consumer proof
- `DG-09` Second-domain/Ocean source closure before multi-domain proof
- `DG-10` Canonical knowledge storage and persistence
- `DG-11` UI decoupling and data-driven rendering

### DG-10 clarification
DG-10 asks **where Atlas knowledge actually lives and what each persistence layer owns**. It must explicitly distinguish:
- canonical reusable/domain knowledge;
- live client/application state;
- frozen preservation/custody;
- generated/derived artifacts;
- presentation-only projections.

The current evidence shows Supabase exists and supports authenticated client/application state, but the architecture must not assume that all canonical domain knowledge already resides there. GitHub/static governed assets currently remain material to canonical knowledge. The successor must explicitly define the physical authority model. HTML/Canvas may never be the authoritative knowledge store.

DG-10 acceptance test: deleting every UI surface must not destroy Atlas business meaning, lineage, versions or relationships needed to reconstruct the product.

### DG-11 clarification
DG-11 asks **how stored governed knowledge is rendered and consumed**. HTML, Canvas, Ask Atlas, inspectors and future surfaces must consume the same structured objects/relationships through reusable rendering/projection rules. Adding another instance of an already-supported object type should normally be a data change rather than custom page wiring.

DG-11 acceptance tests include:
- add a new task such as LTL-04 without creating/rebuilding a bespoke HTML page;
- change one governed LTL-03 fact once and have all authorized views resolve the same changed fact;
- delete/rebuild the UI without losing business meaning;
- allow different presentations without separate business-truth copies.

Mandatory cross-cutting controls now comprise:
- `A` Source & Asset Registry
- `B` Generation Registry
- `C` Enterprise Context / Client Binding Store
- `D` Single Projection Gateway
- `E` Canonical Knowledge Persistence Boundary

AR0.6 freeze condition is updated: every DG-01…DG-11 item must be CLOSED by the successor architecture/certification path or explicitly OWNER-DEFERRED with rationale, downstream impact and a future gate.

### 2. Existing AR0.2 candidate

Working branch: `atlas-architecture-ar0-2-layer-boundary`  
Review PR: `#10`

Current candidate boundaries remain the starting point, not automatically invalidated by the demo findings:
1. Reference Domain + Operational Knowledge
2. Canonical Work Decomposition
3. Canonical WorkDefinition
4. Enterprise Context / Client Binding
5. Governed Specification Assembly
6. optional Design / Solution Synthesis
7. Runtime Adapter / Projection
8. Execution Runtime outside Atlas
9. Observation / Evidence Reconciliation

### 3. Existing production-boundary evidence relevant to DG-10/DG-11

Current production documentation separates canonical Atlas assets from authenticated client persistence:
- Browser/Canvas consumes canonical Atlas assets read-only;
- Vercel API functions provide the authenticated service boundary;
- Supabase currently provides Auth, Postgres/RLS, private evidence storage and client-work persistence;
- client workspace data may reference canonical Atlas IDs but cannot mutate canonical Atlas modules.

This evidence means DG-10/DG-11 are not authorization to simply move everything into Supabase. AR0.2/AR0.3 must explicitly determine the minimum clean persistence/projection architecture.

### 4. Architecture principle to preserve

Atlas owns governed understanding/specification. Downstream platforms own runtime execution.

Physical responsibility direction remains subject to AR0.2/AR0.3 refinement but the current intent is:
- Drive = frozen preservation/custody
- GitHub = governed versioned source/rules/code/technical registry
- Supabase = live protected/application state where required
- Vercel = presentation/runtime hosting, never canonical knowledge authority

---

# CLAUDE TASK — INDEPENDENT REVIEW ONLY

Review the updated architecture backlog at commit `f645b8b3db5e1d01c32c744bd5cba9868d51c4d2` against the current AR0.2 candidate and prior architecture/production-boundary evidence.

Return one of:

`PASS__DG_REQUIREMENTS_COMPLETE_AND_CORRECTLY_MAPPED`

or

`BOUNDED_CORRECTIONS_REQUIRED`

Specifically check:
1. whether DG-01…DG-11 are genuine architecture gaps rather than demo-only implementation defects;
2. whether DG-10 is correctly framed as canonical knowledge storage/persistence rather than an unsupported assumption that Supabase must own all knowledge;
3. whether DG-11 is correctly separated from DG-10 as UI decoupling/data-driven rendering;
4. whether any item duplicates an existing AR0.2 boundary and should therefore be expressed as a control/acceptance criterion rather than a new layer;
5. whether controls A-E are sufficient and non-duplicating;
6. whether any material architecture gap exposed by the demo remains missing;
7. whether the proposed AR0.6 freeze condition is strong enough;
8. whether the mapping to AR0.2/AR0.3/AR0.4 and later implementation tracks is coherent.

**Do not implement or redesign the architecture yet.**  
**Do not modify the AR0.2 candidate branch or PR #10 yet.**  
**Do not restart R0.4/P6.2/P6.3/P6.4.**

Record your independent findings back into this same `claude_chatGPT.md` control log, including the exact commits/files reviewed. Do not create another governance log unless a specific evidence artifact is genuinely required.

---

# OWNER GATE AFTER DUAL REVIEW

Once Claude and ChatGPT converge on the demo-exposed gaps, the next substantive action is Owner review of **AR0.2**, now informed by DG-01…DG-11.

If the Owner accepts/revises AR0.2, only then proceed to AR0.3 Candidate Contract Architecture.

---

# HARD STOPS

- no architecture implementation before AR0.2 Owner decision;
- no new canonical semantic layer merely to house demo findings;
- no assumption that Supabase must own all canonical knowledge until AR0.2/AR0.3 resolves the physical responsibility model;
- no authoritative business/domain knowledge stored only in HTML/Canvas;
- no use of demo JSON/URL flags as production authorization architecture;
- no fabrication of Ocean/source truth;
- no reconstruction of the remaining Road LTL tasks;
- no bulk/persisted Canonical WorkDefinition generation;
- no Supabase production mutation arising from this review;
- no main/production promotion arising from this review.
