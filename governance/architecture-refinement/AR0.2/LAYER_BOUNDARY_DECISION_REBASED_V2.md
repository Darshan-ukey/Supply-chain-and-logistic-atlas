# AR0.2 — Three-Product Architecture Rebase V2

Status: OWNER-DIRECTED REBASE CANDIDATE / AWAITING INDEPENDENT REVIEW  
Effective direction: 16 September 2026  
Stage: AR0.2 — Layer/Ownership Boundary Decision  
Supersedes as active candidate: `LAYER_BOUNDARY_DECISION_CANDIDATE.md`  
Frozen historical V1 mutated: NO  
R0.4 status: SUSPENDED

## 1. Governing product baseline

This rebase is governed by `governance/standards/ATLAS_PRODUCT_CONSTITUTION_V1.md` @ commit `c126f07fcbf405356a8312377ee934fe0c724b36`.

North Star:

> **Atlas is a governed operational intelligence platform that builds a reusable, source-backed model of how work operates, binds it to enterprise reality, and uses that model to understand operations, design transformation, and produce execution-ready specifications.**

Atlas is **three products on one governed foundation**:
1. **Operations Intelligence** — understand how the client actually operates.
2. **Transformation Intelligence** — decide what should change and why.
3. **Execution Intelligence** — define how approved work should operate and make it implementation-ready.

Execution itself remains outside Atlas.

## 2. Architectural correction from the prior AR0.2 candidate

The prior AR0.2 candidate was structurally strong for Execution Intelligence but too close to treating `Reference Domain → Work Decomposition → WorkDefinition → Client Binding → Specification → Projection` as the whole product architecture.

That chain is retained as important machinery inside Execution Intelligence, but it is no longer the top-level Atlas product architecture.

The rebased architecture separates:
- **governed canonical assets/state** — what Atlas knows and owns;
- **intelligence/generation engines** — how Atlas derives analysis, proposals, execution structures and projections;
- **presentation/projection** — how consumers see/use governed state;
- **runtime execution** — outside Atlas.

This distinction is mandatory. An engine is not automatically a source of truth, and a UI/projection is never canonical merely because it displays the result.

## 3. Top-level architecture

```text
AUTHORITATIVE SOURCES / ENTERPRISE EVIDENCE
        |
        v
+--------------------------------------------------------------+
|                 COMMON GOVERNED ATLAS FOUNDATION             |
|                                                              |
| Z0 Source / Provenance / Knowledge State                      |
| Z1 Domain Reference & Operational Semantics                  |
| Z2 Enterprise Context / Client Binding                       |
| Z3 Operational Evidence / Actual-State                       |
| Z4 Transformation Decision / Approved Target-State           |
| Z5 Canonical Execution Semantics                             |
| Z6 Governed Specification / Readiness / Projection Identity  |
+--------------------------------------------------------------+
        |                         |                         |
        v                         v                         v
 Operations Intelligence   Transformation Intelligence   Execution Intelligence
   UNDERSTAND                  DECIDE                     DEFINE
        \_________________________|_________________________/
                                  |
                                  v
                    RUNTIME ADAPTER / PROJECTION
                                  |
                                  v
                    EXTERNAL EXECUTION RUNTIMES
                                  |
                                  v
                    Z7 Observation / Reconciliation
                                  |
                                  +----> governed improve/change loop
```

Cross-cutting across all zones: governance, provenance, versioning, identity, source/asset registry, generation registry, authorization, custody, recovery and change control.

## 4. Canonical ownership zones

### Z0 — Source, Provenance & Knowledge State

**Owns**
- authoritative source identity/version/hash/location;
- source applicability and classification;
- provenance lineage;
- epistemic state such as KNOWN / UNKNOWN / CONFLICTING / INFERRED / DEPRECATED;
- source-refresh status and custody references.

**Does not own** derived process/business semantics merely because it points to their sources.

**Typical engines**
- source ingestion/source-registry materializer;
- source change monitor;
- source extraction/normalization helpers.

### Z1 — Domain Reference & Operational Semantics

This is the reusable, client-independent semantic foundation.

**Owns**
- domain/process/task identity and relationships;
- purpose and expected outcomes;
- information/object/field/document meaning;
- state/event/rule/clock/decision/action semantics where material;
- validations, controls, authorities and evidence expectations;
- exceptions/recovery semantics at reusable-domain level;
- operational knowledge;
- reusable binding-requirement templates: what enterprise-specific value must later be supplied, why, scope and constraints;
- explicit semantic gaps and conflicts.

**Hard rule**
Client Binding must not repair missing reusable domain knowledge. If reusable semantics required to understand/execute the work are missing, the state is `DOMAIN_KNOWLEDGE_GAP`, not merely `CLIENT_BINDING_REQUIRED`.

**Readiness gate**
`DOMAIN_EXECUTION_READY` means the governed reusable scope contains the tool-neutral business semantics necessary for enterprise binding and downstream execution design; only declared enterprise-specific binding values may remain unresolved.

**Typical engines**
- domain semantic materializer;
- knowledge-resolution engine;
- effective-version/overlay resolver.

### Z2 — Enterprise Context / Client Binding

**Owns** enterprise-specific reality that overlays Z1 without copying/mutating reusable domain truth:
- systems/applications and systems of record;
- field/API/data mappings;
- local roles/authorities;
- client policy/threshold/SLA/cut-off values;
- master/network/serviceability configuration;
- local variants and precedence;
- regulatory/contractual constraints;
- operating profile/NFR context when required;
- binding decisions, unresolved binding gaps and not-applicable states.

**Hard rule**
Binding resolves **declared slots/requirements** generated or defined from Z1/Z4/Z5. It is not an open-ended discovery layer for missing reusable business logic.

**Typical engine**
- Enterprise Context / Client Binding resolver.

### Z3 — Operational Evidence / Actual-State

This zone was materially underrepresented in the prior AR0.2 candidate and is required for Operations Intelligence.

**Owns/references**
- normalized transactional/event/process evidence;
- cycle-time and performance observations;
- process/route/decision variants observed in practice;
- exceptions, rework, correction and failure evidence;
- control/evidence observations;
- outcome evidence;
- evidence time window, client scope and extraction identity;
- links to Z1/Z2 semantic objects.

Raw source systems remain execution/systems-of-record; Atlas stores or references governed evidence required for analysis, not uncontrolled copies of everything.

**Typical engines**
- operational evidence ingestion/normalization pipeline;
- event/object correlation resolver.

### Z4 — Transformation Decision & Approved Target-State

This zone is required for Transformation Intelligence and separates **proposed change** from **approved target semantics**.

**Owns**
- opportunity/problem statements linked to evidence;
- prioritisation/assessment outputs;
- candidate future-state designs and alternatives;
- assumptions, expected impact and dependencies;
- solution-pattern classifications;
- decision/approval state;
- approved target-state semantic delta relative to current/reference state.

**Hard rule**
Candidate future-state outputs are non-canonical proposals. Only an explicitly approved target-state version becomes governed input to Execution Intelligence. Approval must preserve lineage to the evidence and decision that justified the change.

**Typical engines**
- transformation opportunity/prioritisation engine;
- future-state option generator;
- target-state materializer after approval.

### Z5 — Canonical Execution Semantics

This is the main internal semantic machinery of Execution Intelligence.

**Owns**
- Canonical Work Decomposition and lineage;
- Canonical WorkDefinition;
- business-significant topology/control flow;
- triggers, prerequisites, inputs and outputs;
- rules/decisions/validations/controls;
- actions and technology-neutral exchanges;
- actors/authority/HITL boundaries;
- states/transitions/outcomes;
- waits/clocks/time constraints;
- exceptions/escalation/business retry/recovery;
- evidence/completion criteria;
- client-binding requirement references;
- approved target-state lineage.

**Boundary rule**
Work Decomposition and WorkDefinition remain distinct contracts where useful, but they are one **execution-semantics continuum**, not separate Atlas products. Decomposition stops on business-semantic sufficiency, not target-runtime convenience.

**Implementation-completeness test**
If the downstream implementation team must rediscover a governed business rule from Operations because the Canonical WorkDefinition is semantically incomplete, the relevant execution scope is not ready.

**Typical engines**
- Canonical Work Decomposition generator/materializer;
- Canonical WorkDefinition compiler.

### Z6 — Governed Specification / Readiness / Projection Identity

This zone is deliberately non-duplicating. It references Z1–Z5 rather than becoming another business-truth store.

**Owns**
- Specification Scope Manifest;
- dependency/resolution/readiness proof;
- `DOMAIN_EXECUTION_READY`, `ENTERPRISE_EXECUTION_READY`, `RUNTIME_IMPLEMENTATION_READY` assessment identities;
- Version-Closed Specification Manifest;
- target-consumer capability/loss assessment identity;
- projection/package identity and hashes.

**Hard rule**
Z6 is a manifest/proof/composition boundary. It must not duplicate business rules, client values or execution semantics in a way that creates a competing source of truth.

**Typical engines**
- readiness/resolution engine;
- specification-manifest generator;
- purpose/consumer-specific package assembler.

### Z7 — Observation / Evidence Reconciliation

**Owns**
- runtime/operational observations linked to exact governed specification/execution identity;
- conformance/deviation classifications;
- outcome/evidence references;
- proposed knowledge gaps or improvement signals.

**Hard rule**
Observed behavior is evidence, not automatic canonical truth. It may drive Operations/Transformation Intelligence and governed change, but cannot silently mutate Z1/Z2/Z4/Z5.

**Typical engines**
- conformance/reconciliation engine;
- evidence-to-improvement proposal engine.

## 5. Three product engines

The three products are not three copies of the data. They are governed engine families operating over common assets.

### P1 — Operations Intelligence Engine
Consumes primarily Z1 + Z2 + Z3.

Produces governed derived analysis such as:
- actual-vs-reference/current-state comparison;
- variants and performance patterns;
- friction/rework/exception drivers;
- control/risk gaps;
- standardisation/complexity insights.

Its findings remain derived evidence/analysis and do not silently rewrite Z1/Z2.

### P2 — Transformation Intelligence Engine
Consumes primarily Z1 + Z2 + Z3 + approved/validated P1 findings.

Produces:
- opportunity identification and prioritisation;
- future-state alternatives;
- impact/assumption/dependency assessments;
- solution-pattern recommendations/candidates.

Outputs remain proposals until approval. Approved target-state semantics are materialized into Z4.

### P3 — Execution Intelligence Engine
Consumes Z1 + Z2 + approved Z4 target-state semantics.

Produces/materializes Z5 and Z6:
- Work Decomposition;
- Canonical WorkDefinitions;
- readiness/blocker proof;
- version-closed implementation specification;
- downstream projection requirements.

Execution Intelligence must not use adapters to repair missing semantics. Missing reusable semantics return to Z1; missing enterprise values return to Z2; unresolved transformation decisions return to Z4.

## 6. Runtime Adapter / Projection boundary

Runtime Adapter/Projection remains an Atlas capability downstream of Z6.

It owns target-specific translation such as:
- Malkom structures;
- workflow/RPA configuration models;
- agent roles/prompts/tool permissions/guardrails;
- ERP/TMS/WMS fit/configuration/integration mappings;
- BPM/digital-twin projections;
- human-work instructions/interfaces where appropriate;
- capability and semantic-loss assessment.

It does **not** own canonical business truth.

Tool-specific warehouses/configurations are derived projections/configuration stores, not independent sources of Atlas semantics.

## 7. External execution boundary

Malkom, workflow engines, RPA, agents, ERP/TMS/WMS, BPM engines, custom applications and people execute the work.

Atlas may publish/export/deploy through an authorized adapter, but downstream runtime remains the transaction/execution authority.

## 8. Generator and reproducibility architecture

All engines/materializers/compilers/resolvers/adapters in this architecture are governed by:

`governance/standards/CANONICAL_GENERATION_AND_FREEZE_ASSET_STANDARD_V1.md` @ commit `58d6d0572636ad40f86943a39350b7237bb48f76`.

Mandatory pattern:

`FROZEN INPUTS → VERSIONED GENERATOR CONTRACT → GENERATOR IMPLEMENTATION → VALIDATOR/QA → GOVERNED OUTPUT → HASH/IDENTITY → CUSTODY/RECOVERY RECORD`

Key architecture decisions:
- prefer deterministic engines/compilers/resolvers where feasible;
- LLM/generative engines may create candidates, but canonical promotion requires governed validation/approval;
- approved generative output is preserved exactly; recovery may never depend solely on reproducing an identical future LLM response;
- every generated governed artifact requires a Generation Registry record;
- every high-risk baseline requires recovery/rebuild proof under the Controlled Phase Execution & Recovery Gate.

## 9. Frozen asset classes required for the successor

Before a layer/engine is considered production-ready, the applicable frozen set must include:

1. **Product/architecture baseline** — Product Constitution, layer/zone ownership, readiness definitions and invariants.
2. **Schemas/contracts** — canonical object, evidence, transformation, execution, binding, readiness and projection schemas.
3. **Generator package** — Generator Contract, code, prompts/templates if any, rules/mappings, dependencies, parameters, validator and golden fixtures.
4. **Authoritative input baseline** — exact source/model/client/evidence/decision inputs and hashes/identities.
5. **Canonical output baseline** — exact versioned structured output after QA/approval.
6. **Decision-significant derived outputs** — frozen when used for Owner/client decisions or implementation handoff.
7. **Physical recovery assets** — DB schema/migrations, release/environment manifest, deployment/rollback references, adapter capability profiles.
8. **Proof/custody assets** — QA, hashes, registries, backup location and recovery proof.

A UI file is not a required canonical freeze asset if it can be regenerated from governed data and contains no unique business information.

## 10. Physical responsibility direction

Logical roles are authoritative; current target technologies remain replaceable through governed migration.

- **GitHub** — governance, schemas/contracts, generator/compiler/resolver code, prompts/rules, migrations, adapter/projection code, release manifests and technical registries.
- **Canonical Structured Knowledge Store** — queryable/versioned structured Atlas knowledge/state. Current target implementation is Supabase/Postgres where appropriate, subject to AR0.3 schema/security design.
- **Google Drive / immutable custody** — original source files where appropriate, frozen release/export packages, independent recovery copies and evidence bundles.
- **Vercel** — presentation/API runtime hosting only; never canonical knowledge or generator authority.

## 11. Product proof / architecture kill test

AR0.4 must take at least one representative enterprise scope and prove that the **same governed foundation** supports all three products without creating competing business truth:

1. Operations Intelligence explains actual behavior/friction using Z1–Z3.
2. Transformation Intelligence creates evidence-linked future-state options using the same foundation.
3. Execution Intelligence turns an approved target state into execution-ready semantics/specification without rediscovering the business logic.

The same underlying governed execution semantics should then be consumable by materially different downstream patterns (for example agent/workflow, BPM/digital twin, ERP/TMS/Malkom) without redefining the business meaning.

Failure of this test means Atlas has either narrowed into an execution-specification engine or fragmented into separate product data models.

## 12. Mapping of prior AR0.2 boundaries

| Prior AR0.2 boundary | Rebased disposition |
|---|---|
| Reference Domain + Operational Knowledge | Retained and strengthened as Z1 |
| Canonical Work Decomposition | Retained inside Z5 Execution Semantics |
| Canonical WorkDefinition | Retained inside Z5 Execution Semantics |
| Enterprise Context / Client Binding | Retained as Z2; binding explicitly resolves declared slots |
| Governed Specification Assembly | Retained as Z6; strictly non-semantic manifest/proof boundary |
| Optional Design / Solution Synthesis | Reframed as core Transformation Intelligence engine family; outputs non-canonical until approved into Z4 |
| Runtime Adapter / Projection | Retained downstream of Z6 |
| Execution Runtime | Retained outside Atlas |
| Observation / Evidence Reconciliation | Retained as Z7 and connected back to Z3/P1/P2 |

New material ownership zones introduced by the rebase:
- **Z3 Operational Evidence / Actual-State**;
- **Z4 Transformation Decision / Approved Target-State**.

These are not arbitrary new semantic layers: they are required to support the already-agreed Operations Intelligence and Transformation Intelligence products on the same foundation as Execution Intelligence.

## 13. AR0.3 contract priorities if this rebase passes review

AR0.3 should define the minimum machine-readable contracts in this order:
1. common identity/version/provenance envelope;
2. Z1 domain/reference semantic contracts and Binding Requirement contract;
3. Z2 Enterprise Context/Binding contracts;
4. Z3 Operational Evidence contract;
5. Z4 Transformation Proposal/Decision/Approved Target-State contract;
6. Z5 Work Decomposition/WorkDefinition successor grammar;
7. Z6 readiness/resolution/scope/version-closed manifest contracts;
8. Z7 observation/conformance contract;
9. Generator Contract + Generation Registry schema;
10. projection/adapter contract family.

AR0.3 must separately define the physical schema/storage mapping without changing these semantic ownership boundaries.

## 14. Hard stops

Until this rebase is independently reviewed and Owner-frozen:
- do not restart R0.4/P6.2/P6.3/P6.4;
- do not bulk materialize WorkDefinitions;
- do not mutate Supabase production state to implement this candidate;
- do not build Operations/Transformation engines against ad-hoc schemas;
- do not treat existing HTML/demo JSON as canonical input;
- do not treat an LLM response or one-off script as a reproducible generator;
- do not merge the earlier AR0.2 candidate as if it were still the active architecture decision.

## 15. Candidate disposition

`THREE_PRODUCT_COMMON_FOUNDATION_REBASE_REQUIRED__ASSET_ENGINE_PROJECTION_SEPARATION__AWAITING_INDEPENDENT_REVIEW`

The architecture direction is now re-anchored to the agreed product identity rather than to the most recently built execution artifacts.
