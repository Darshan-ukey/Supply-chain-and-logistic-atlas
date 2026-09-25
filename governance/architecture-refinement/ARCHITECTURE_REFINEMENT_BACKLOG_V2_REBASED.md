# Atlas Architecture Refinement Backlog V2 — Three-Product Rebase

Status: OWNER-DIRECTED ACTIVE ARCHITECTURE PROGRAM  
Effective: 16 September 2026  
Owner/Governor: Darshan Ukey  
Supersedes as active backlog: `ARCHITECTURE_REFINEMENT_BACKLOG_V1.md`

## 1. Governing product baseline

Canonical product baseline:
`governance/standards/ATLAS_PRODUCT_CONSTITUTION_V1.md` @ `c126f07fcbf405356a8312377ee934fe0c724b36`

North Star:

> **Atlas is a governed operational intelligence platform that builds a reusable, source-backed model of how work operates, binds it to enterprise reality, and uses that model to understand operations, design transformation, and produce execution-ready specifications.**

Three products on one governed foundation:
1. Operations Intelligence — understand actual operations.
2. Transformation Intelligence — decide what should change and why.
3. Execution Intelligence — define how approved work should operate and make it implementation-ready.

Runtime execution remains outside Atlas.

## 2. Governing architecture principles

- One governed semantic foundation; no competing product-specific copies of business truth.
- Asset, engine, projection and runtime are separate architectural concepts.
- Client Binding resolves declared enterprise-specific requirements; it does not repair missing reusable domain semantics.
- Runtime adapters translate; they do not invent missing business logic.
- Operations/Transformation outputs are derived/proposed until promoted through explicit governance.
- Presentation is never canonical business authority.
- Observed behavior is evidence, not automatic truth.
- Every generated governed asset must comply with `CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md`.
- Every major/high-risk stage must comply with `CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md`.

## 3. Active stage — AR0.2 three-product rebase

Active candidate:
`governance/architecture-refinement/AR0.2/LAYER_BOUNDARY_DECISION_REBASED_V2.md`

Working branch: `atlas-architecture-ar0-2-layer-boundary`

Active disposition:
`THREE_PRODUCT_COMMON_FOUNDATION_REBASE_REQUIRED__ASSET_ENGINE_PROJECTION_SEPARATION__AWAITING_INDEPENDENT_REVIEW`

The original AR0.2 candidate is superseded as the active architecture candidate but retained in Git history.

### Rebased ownership zones
- Z0 Source / Provenance / Knowledge State
- Z1 Domain Reference & Operational Semantics
- Z2 Enterprise Context / Client Binding
- Z3 Operational Evidence / Actual-State
- Z4 Transformation Decision / Approved Target-State
- Z5 Canonical Execution Semantics
- Z6 Governed Specification / Readiness / Projection Identity
- Z7 Observation / Evidence Reconciliation

Runtime Adapter/Projection follows Z6; business execution remains external.

### Product-engine families
- P1 Operations Intelligence Engine
- P2 Transformation Intelligence Engine
- P3 Execution Intelligence Engine

These are engine families over common governed assets, not separate sources of truth.

## 4. Rebase-specific mandatory requirements

### RB-01 — Actual-state evidence must be first-class
Operations Intelligence cannot be implemented from reference semantics alone. Z3 must define governed evidence identity, normalization, time window/scope, linkage to semantic objects and actual-vs-expected comparison inputs.

### RB-02 — Transformation proposals and approved target state must be distinct
Transformation Intelligence may generate candidate future states, but proposals cannot silently overwrite current/reference semantics. Z4 must preserve proposal → decision → approval → target-state lineage.

### RB-03 — Execution semantics remain complete but subordinate to the product model
Work Decomposition and WorkDefinition remain required execution machinery inside Z5. They are not the Atlas product identity.

### RB-04 — Binding is a slot-resolution mechanism
Z1/Z4/Z5 must declare enterprise-specific binding requirements before Z2 resolves them. Client Binding may not be used as a catch-all discovery layer.

### RB-05 — Three readiness states must remain distinct
- `DOMAIN_EXECUTION_READY`
- `ENTERPRISE_EXECUTION_READY`
- `RUNTIME_IMPLEMENTATION_READY`

A later state cannot hide an earlier semantic gap.

### RB-06 — Same-foundation three-product proof is mandatory
AR0.4 must prove one representative enterprise scope can support Operations Intelligence, Transformation Intelligence and Execution Intelligence from the same governed foundation without competing business truth.

### RB-07 — Multi-consumer execution proof remains mandatory
The same governed execution semantics must support materially different downstream consumer patterns without redefining the business meaning.

## 5. Existing DG requirements remain mandatory

DG-01 through DG-11 remain active. Their meaning is unchanged, but their mapping is rebased:

| DG | Rebased primary owner/control |
|---|---|
| DG-01 Asset custody/dependency closure | Cross-cutting Source & Asset Registry across Z0–Z7 |
| DG-02 Derived-output reproducibility | Generation Registry + Canonical Generation Standard |
| DG-03 Protected-data delivery | Z2/Z3/Z4/Z5 protected structured state → authorized service/projection |
| DG-04 WorkDefinition materialization/store closure | Z5 Canonical Execution Semantics |
| DG-05 Enterprise Context/Client Binding | Z2 |
| DG-06 Effective governed version resolution | Z0/Z1 + Z6 version-closed manifest |
| DG-07 Unified navigation/projection context | Projection/UI layer consuming common asset IDs |
| DG-08 Same-lineage downstream proof | Z5→Z6→Adapter→external runtime, AR0.4 |
| DG-09 Second-domain source closure | Z0/Z1 + AR0.4 multi-domain proof |
| DG-10 Canonical knowledge storage/persistence | Physical mapping across Z0–Z7 |
| DG-11 UI decoupling/data-driven rendering | Renderer/projection boundary; no page-owned business truth |

## 6. Frozen generation/recovery governance

Canonical generation standard:
`governance/standards/CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` @ `58d6d0572636ad40f86943a39350b7237bb48f76`

Controlled phase/recovery standard:
`governance/standards/CONTROLLED_PHASE_EXECUTION_AND_RECOVERY_GATE_V1.md` refined @ `a523ad3ac1288e68a6dfc764d8c2aa5ea77a2644`

Every governed engine must have a Generator Contract. Every generated governed baseline must retain frozen inputs, engine version, parameters/dependencies, validator/QA, output identity/hash, Generation Registry entry and custody/recovery evidence.

Generative/LLM assistance may create candidates; canonical recovery must not depend on reproducing a future identical LLM response. Approved canonical output is preserved exactly.

## 7. AR0.3 — Candidate Contract & Physical Architecture

Status: BLOCKED_UNTIL_AR0_2_REBASE_REVIEW_AND_OWNER_FREEZE

Once AR0.2 V2 passes independent review and Owner freeze, AR0.3 must define minimum machine-readable contracts in this order:
1. common identity/version/provenance envelope;
2. Z1 domain/reference semantic + Binding Requirement contract;
3. Z2 Enterprise Context/Binding contract;
4. Z3 Operational Evidence contract;
5. Z4 Transformation Proposal/Decision/Approved Target-State contract;
6. Z5 Work Decomposition/WorkDefinition successor grammar;
7. Z6 readiness/resolution/scope/version-closed manifest contracts;
8. Z7 observation/conformance contract;
9. Generator Contract + Generation Registry schema;
10. adapter/projection contract family;
11. physical storage/schema/security mapping.

AR0.3 must resolve the logical-to-physical authority model:
- GitHub = governed executable/control authority;
- Canonical Structured Knowledge Store = queryable/versioned structured knowledge/state; current target Supabase/Postgres where appropriate;
- Drive/immutable custody = source/release/evidence preservation;
- Vercel = presentation/API runtime only.

## 8. AR0.4 — Adversarial product and multi-pattern proof

Status: BLOCKED_UNTIL_AR0_3_CLOSURE

Must validate:
- same-foundation three-product proof;
- current vs reference vs target-state separation;
- binding-slot resolution;
- readiness-state integrity;
- multi-consumer downstream projection;
- second-domain proof with source closure;
- recovery/regeneration of all high-risk generated baselines.

## 9. AR0.5 — Successor Architecture Candidate

Status: BLOCKED_UNTIL_AR0_4_CLOSURE

Produce the versioned successor architecture and implementation plan with explicit lineage to frozen historical V1. Do not overwrite historical assets.

## 10. AR0.6 — Owner Freeze & Recovery Re-baseline

Status: BLOCKED_UNTIL_AR0_5_REVIEW

Owner freeze requires:
- RB-01…RB-07 closed or explicitly Owner-deferred to a real named gate;
- DG-01…DG-11 closed or explicitly Owner-deferred to a real named gate;
- physical authority model closed;
- generator/freeze-asset coverage closed for production-bound engines;
- recovery proof plan accepted;
- no silent product drift from the Product Constitution.

Only then may R0.4/P6.x recovery and production sequencing be re-baselined.

## 11. Current hard stops

- no AR0.3 build until AR0.2 V2 independent review + Owner freeze;
- no R0.4/P6.x restart;
- no bulk WorkDefinition materialization;
- no ad-hoc Operations/Transformation engine build against temporary schemas;
- no production Supabase mutation from this architecture rebase;
- no use of HTML/demo JSON/LLM chat output as canonical business truth;
- no generated governed asset without a Generator Contract and freeze/recovery path;
- no production promotion from architecture-only commits.
