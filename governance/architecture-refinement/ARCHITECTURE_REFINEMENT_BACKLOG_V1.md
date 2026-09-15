# Atlas Architecture Refinement Backlog V1

Status: OWNER_AUTHORIZED_REFINEMENT_PROGRAM  
Effective: 11 September 2026  
Owner/Governor: Darshan Ukey  
Architecture lead / independent analyst: ChatGPT  
Claude execution authorization: NONE for this program unless explicitly granted later by the Owner through governance.

## 1. Platform objective

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

Boundary principle:

> **Atlas owns understanding and specification. Downstream platforms own execution.**

Knowledge repository, governance platform, execution/implementation readiness and solution/design support are capabilities or byproducts of the same governed semantic foundation. Runtime business execution itself remains outside Atlas.

## 2. Governing question

Can Atlas preserve one authoritative, technology-neutral representation of enterprise work, bind it to client reality, expose unresolved knowledge, assemble a trustworthy specification and project it to materially different downstream tools without redefining the underlying business meaning?

Execution readiness remains a critical certification outcome, but is not the sole product identity.

## 3. Guardrails
- Frozen Work Decomposition V1.1 and Canonical WorkDefinition V1 remain immutable historical reference baselines until a successor is Owner-frozen.
- No R0.4 reconstruction/compiler build may start while this refinement gate is active.
- Historical P6.1 counts are evidence only, never architecture acceptance targets.
- Canonical business meaning remains technology/runtime-neutral.
- Client-specific values remain enterprise/client context, not reusable domain truth.
- Missing domain/client semantics remain governed gaps; architecture work must not fabricate operational knowledge.
- Readiness must fail closed when mandatory knowledge is unresolved.
- Runtime execution remains outside Atlas execution ownership.
- One authoritative owner per fact remains mandatory.
- No monolithic Execution Requirements dumping ground.

## 4. Stages

### AR0.0 — Architecture Baseline & Challenge Register
Status: COMPLETE / OWNER_REVIEWED

Baseline inventory and challenge register remain the reference inventory.

### AR0.1 — V1.1 / WorkDefinition Sufficiency Audit
Status: COMPLETE / OWNER_DIRECTION_APPLIED / REBASED_ON_AR_D013

PR #9 merged into `atlas-governance-registry-v2.1` at merge SHA `206db2b54f40140cc372c4f70bd314934abc489e`.

The 38-class evidence remains unchanged:
- 18 fully governed by existing contracts;
- 6 governed but requiring client/enterprise binding;
- 9 inferable but insufficiently governed/formalized;
- 1 absent first-class scope-level readiness mechanism;
- 4 correctly downstream/runtime-specific.

Final disposition:
`CORE_ARCHITECTURE_DIRECTION_VALID / PARTIALLY_SUFFICIENT / TARGETED_SUCCESSOR_REFINEMENT_REQUIRED`

AR-D013 changed the interpretation, not the evidence: the successor must strengthen Atlas as a reusable enterprise-to-tool intelligence/specification layer, not merely as a readiness calculator.

### AR0.2 — Layer-Boundary Decision
Status: AWAITING_OWNER_REVIEW — CURRENT

Working branch: `atlas-architecture-ar0-2-layer-boundary`  
Review PR: #10

Candidate disposition:
`TARGETED_LAYER_BOUNDARY_REFINEMENT_REQUIRED__NO_MONOLITHIC_NEW_SEMANTIC_LAYER`

Candidate boundaries:
1. Reference Domain + Operational Knowledge — authoritative reusable business truth and epistemic state.
2. Canonical Work Decomposition — business-semantic work topology and lineage; successor stopping criterion based on business-semantic sufficiency rather than target-runtime convenience.
3. Canonical WorkDefinition — technology-neutral execution-relevant semantics with stronger formal topology/control-flow grammar.
4. Enterprise Context / Client Binding — client-specific systems, mappings, policies, thresholds, roles and optional operating/NFR context.
5. Governed Specification Assembly — non-duplicating scope selection, dependency closure/readiness proof and version-closed specification manifest.
6. Optional Design / Solution Synthesis — non-canonical candidate design capability consuming the governed specification.
7. Runtime Adapter / Projection — target-tool translation and capability/loss assessment.
8. Execution Runtime — outside Atlas execution ownership.
9. Observation / Evidence Reconciliation — optional cross-runtime observations and conformance feedback without direct canonical mutation.

The proposed Governed Specification Assembly boundary is intentionally small and non-authoritative. It references underlying governed facts rather than duplicating them.

### AR0.3 — Candidate Contract Architecture
Status: BLOCKED_UNTIL_AR0_2_OWNER_REVIEW

If AR0.2 is accepted, define the minimum machine-readable successor contracts. Expected candidate contracts include:
- Specification Scope Manifest;
- Resolution / Readiness Assessment;
- Version-Closed Specification Manifest;
- refined Canonical Work Decomposition grammar;
- refined Canonical WorkDefinition topology/control-flow grammar;
- Enterprise Context extensions/umbrella;
- optional Observation/Evidence contract.

No broad monolithic contract is authorized.

### AR0.4 — Adversarial Multi-Pattern Validation
Status: BLOCKED_UNTIL_AR0_3_REVIEW

Validate the candidate architecture across multiple task families, domains and downstream consumer patterns.

### AR0.5 — Successor Architecture Candidate
Status: BLOCKED_UNTIL_AR0_4_REVIEW

Produce a versioned successor candidate with explicit lineage to frozen V1. Do not overwrite V1.

### AR0.6 — Owner Freeze Decision & Recovery Re-baseline
Status: BLOCKED_UNTIL_AR0_5_REVIEW

Owner approves, rejects or revises the successor. Only then is R0.4/recovery sequencing re-baselined.

## 5. Current conceptual chain

`Reference Domain / Operational Knowledge`
→ `Canonical Work Decomposition`
→ `Canonical WorkDefinition`
→ `Enterprise Context / Client Binding`
→ `Governed Specification Assembly`
→ optional `Design / Solution Synthesis`
→ `Runtime Adapter / Projection`
→ `Execution Runtime outside Atlas execution ownership`
→ `Observation / Evidence Reconciliation`

## 6. Value test

Atlas must ultimately demonstrate that the reusable governed layer materially reduces discovery/rework, exposes gaps earlier, improves implementation/specification quality and supports multiple downstream tools from the same business truth.

Indicative measures remain:
- Reference Reuse Rate;
- Discovery Compression;
- Gap Exposure Rate;
- Implementation Handoff Quality;
- Cross-Runtime Reusability.

## 7. Immediate next action

Owner reviews AR0.2 candidate PR #10. AR0.3 and R0.4 remain blocked until the AR0.2 boundary decision is accepted or revised.

## 8. Demo-exposed architecture hardening requirements — mandatory successor inputs

The September 2026 demo-readiness sprint proved the conceptual chain but exposed architecture hardening requirements that must now be treated as governed successor inputs rather than UI/demo defects.

### DG-01 — Asset custody and dependency closure
**Problem exposed:** governed artifacts can exist across GitHub, Drive, Supabase, Vercel or historical release packages without one authoritative machine-readable record of location, version, parentage, hash, status and dependencies.

**Required architecture outcome:** one governed Source & Asset Registry that can answer, for every authoritative or derived asset: what it is, where it lives, which version is current, what it depends on, what depends on it, its immutable identity/hash and its lifecycle state.

**Primary mapping:** AR0.2 boundary decision → AR0.3 contracts → source/governance implementation track.

### DG-02 — Derived-output reproducibility
**Problem exposed:** historical outputs can remain available after the exact generator/rules/toolchain that created them becomes unclear or unavailable.

**Required architecture outcome:** every governed derived artifact must retain a reproducibility record linking exact governed inputs, generation rules/code/template/compiler version, parameters, output identity/hash and verification evidence.

**Primary mapping:** AR0.3 contract architecture → decomposition/WorkDefinition/materialization tracks.

### DG-03 — Production protected-data delivery path
**Problem exposed:** demo-only representative JSON and `internalDemo` routing proved the protected experience but are not a production protected-data architecture.

**Required architecture outcome:** protected store → authorization decision → protected service/API → authorized UI/consumer projection. Public projections must be generated from the same governed state but expose only approved public-safe content. Demo flags/files must never become production authorization controls.

**Primary mapping:** AR0.3 contracts → security/public-vs-protected certification track.

### DG-04 — Canonical WorkDefinition materialization and store closure
**Problem exposed:** the compiler contract and four representative WorkDefinitions proved the mechanism, but there is not yet a complete governed Canonical WorkDefinition population and lifecycle path.

**Required architecture outcome:** trusted decomposition input → deterministic Canonical WorkDefinition compile → verification → governed persistence/versioning → retrieval by downstream binding/projection. Representative demo compilation is evidence only, not production completion.

**Primary mapping:** AR0.3 grammar → WorkDefinition materialization track.

### DG-05 — Enterprise Context / Client Binding as a first-class layer
**Problem exposed:** Atlas can classify `client binding required`, but client-specific values, system ownership, overrides, authority, thresholds, mappings and unresolved client decisions do not yet operate as one mature governed layer.

**Required architecture outcome:** a first-class Enterprise Context / Client Binding store and contract that overlays reusable domain truth without copying or mutating it and can explicitly represent unresolved, conflicting and not-applicable client facts.

**Primary mapping:** AR0.2 layer boundary → AR0.3 Enterprise Context contract → client-binding implementation track.

### DG-06 — Effective governed version resolution
**Problem exposed:** legacy and current UI/projection surfaces can expose Road LTL 1.2, inherited 1.4 semantics and 1.5 overlays without one resolver presenting the effective governed state.

**Required architecture outcome:** deterministic effective-version resolution that closes inheritance/overlay dependencies and gives every consumer one version-closed effective view while retaining full lineage to inherited components.

**Primary mapping:** Governed Specification Assembly / Version-Closed Specification Manifest.

### DG-07 — Unified navigation and projection context
**Problem exposed:** Canvas, Reference Atlas, Page 0, Daughter/Execution Depth and WorkDefinition views evolved as partially independent surfaces, allowing correct governed data to be reached through stale or inconsistent routes.

**Required architecture outcome:** one shared navigation/context state and one projection contract so all authorized UI surfaces resolve the same selected domain/task/version/context and differ only in presentation and authorization scope.

**Primary mapping:** projection/UI architecture + security boundary; canonical business data remains independent of presentation.

### DG-08 — Same-lineage downstream consumer proof
**Problem exposed:** the older Malkom proof and the newer P6.1/P6.2 decomposition/WorkDefinition proof do not yet form one end-to-end lineage.

**Required architecture outcome:** demonstrate one version-closed chain from current Canonical WorkDefinition → Enterprise/Client Binding → Runtime Adapter/Projection → materially different downstream consumer, without changing underlying business semantics.

**Primary mapping:** AR0.4 adversarial validation + runtime projection/consumer certification track.

### DG-09 — Second-domain source closure before multi-domain proof
**Problem exposed:** Ocean public-safe projections exist, but the authoritative Ocean 0.6 source/dependency closure must be proven before Ocean can serve as the second-domain architecture proof.

**Required architecture outcome:** verify canonical source custody, dependency closure and reproducibility for the selected second domain before using it in AR0.4/P6.4-style multi-domain validation. Public-safe projections are not acceptable substitutes for canonical source truth.

**Primary mapping:** source-governance hardening + AR0.4 multi-pattern validation.

### DG-10 — Canonical knowledge storage and persistence
**Problem exposed:** canonical Atlas business/domain knowledge is not yet governed through one explicit storage architecture independent of UI files. Supabase currently supports authenticated client/application state, while canonical domain knowledge can still reside in repository/static assets. This creates ambiguity over which store is authoritative for domain taxonomy, operational knowledge, decomposition, WorkDefinitions, lineage, rules, versions and status.

**Required architecture outcome:** define and govern exactly where each class of Atlas knowledge lives, including what GitHub owns, what a canonical structured knowledge store owns, what Supabase owns, what Drive preserves, and what is generated/projection-only. Canonical knowledge must survive deletion/rebuild of every HTML/Canvas surface. Supabase may be part of the target persistence architecture, but the architecture decision must be explicit rather than assumed.

**Acceptance test:** if all UI files were removed, the complete governed Atlas business meaning, lineage, versions and relationships required to reconstruct the product would still exist in authoritative structured storage.

**Primary mapping:** AR0.2 physical responsibility boundary → AR0.3 storage/contracts → canonical knowledge persistence implementation track.

### DG-11 — UI decoupling and data-driven rendering
**Problem exposed:** demo readiness required repeated page-specific wiring for Page 0, Road LTL, LTL-03, Work Decomposition and WorkDefinition views. Correct knowledge could exist while a particular UI surface still showed stale, missing or separately wired content. This indicates that knowledge, relationships and presentation remain too tightly coupled.

**Required architecture outcome:** HTML, Canvas, Ask Atlas, inspectors and future user surfaces must consume the same structured governed objects and relationships through reusable rendering/projection rules. Business knowledge and navigation relationships must not be authoritative inside page-specific HTML/JS. Adding another instance of an already-governed object type should normally be a data operation, not a page rewrite.

**Acceptance tests:**
1. adding a new task such as LTL-04 using an existing governed object structure does not require creating or rewriting a custom HTML page;
2. changing one governed LTL-03 fact once propagates to every authorized view that consumes that fact;
3. the UI can be deleted and regenerated from canonical stored knowledge without loss of business meaning;
4. different surfaces may present the same object differently, but none owns a separate copy of its business truth.

**Primary mapping:** AR0.3 projection/data contracts → Single Projection Gateway → UI/projection implementation and AR0.4 validation.

## 9. Mandatory cross-cutting controls arising from the demo

The successor architecture must explicitly provide or govern the following controls. These are not new product layers by default; AR0.2/AR0.3 must place them at the minimum non-duplicating boundary.

### A. Source & Asset Registry
One authoritative record of asset identity, location, version, parentage, dependency graph, hash, lifecycle/classification and custody state.

### B. Generation Registry
One authoritative reproducibility record for every governed derived artifact: exact inputs + generation logic/version + parameters + output identity/hash + verification status.

### C. Enterprise Context / Client Binding Store
A governed store for client-specific values, systems, mappings, policies, thresholds, authorities, exceptions and unresolved decisions, with explicit links back to reusable reference semantics.

### D. Single Projection Gateway
A common governed projection path from authoritative state to public UI, protected UI and downstream consumers, with authorization and projection policy determining exposure rather than separate copies of business truth.

### E. Canonical Knowledge Persistence Boundary
A governed physical responsibility map defining the authoritative home of reusable Atlas knowledge, live client/application state, frozen preservation, generated artifacts and presentation-only projections. No HTML/Canvas surface may be the canonical authority for business/domain knowledge.

### AR0.6 freeze condition

The Owner must not freeze the successor architecture at AR0.6 unless every `DG-01` through `DG-11` requirement is either:
1. **CLOSED by the successor architecture and its planned certification path**, or
2. **explicitly OWNER-DEFERRED** with rationale, known downstream impact and a named future gate.

Demo-only shortcuts, representative JSON, special URL flags, stale version fallbacks, page-specific business knowledge, or manual custody knowledge must not silently become production architecture.
