# Atlas Execution Readiness & On-Demand Depth Governance — Decision Record

**Status:** GOVERNANCE CANDIDATE — Owner discussion captured; contract must be frozen before ATL-59 assessment  
**Date:** 2026-09-21  
**Owner/Governor:** Darshan Ukey  
**Independent assessment owner:** ChatGPT  
**Related Linear:** ATL-60 (research recovery/reconciliation) → ATL-59 (LTL-03 execution-readiness validation) → ATL-40A onward (on-demand depth)

## 1. Product boundary

Atlas does **not** execute operational work. Atlas sits between client/domain reality and downstream execution technologies.

Atlas converts reusable domain knowledge into governed, execution-ready enterprise specifications. Downstream consumers may include Malkom, agents, SAP/TMS/WMS, ServiceNow/BPM/workflow platforms, RPA/rules engines, custom applications, or human implementation teams.

Execution readiness is therefore not defined as “can Atlas execute?” and must not be defined around one vendor or product.

## 2. Why the definition must be contextual

Whether a knowledge package is sufficiently deep depends on the intended executor. A human implementation team, configurable enterprise workflow, deterministic automation and bounded AI agent do not require identical semantic resolution.

Therefore a universal “detailed enough” or percentage-complete test is not acceptable.

Governing relation:

**Knowledge state × execution target × binding state → readiness outcome**

## 3. Execution Readiness Contract v1

### Governing definition

**Atlas Domain Execution Readiness:** A governed domain specification is execution-ready when a competent downstream executor can implement the intended operational behavior without rediscovering material domain semantics or making unsupported business-semantic decisions. Client-specific and technology-specific facts may remain unresolved only when explicitly classified as binding requirements.

### Required readiness dimensions

1. **Operational** — required work, sequence and intended outcome.
2. **Information/Object** — required business objects, attributes and relationships.
3. **Decision/Rule** — conditions, validations, decisions and branching logic.
4. **State/Lifecycle** — states and transition logic.
5. **Exception** — failures, deviations, conflicts, recovery and escalation.
6. **Control/Evidence** — authority, provenance and evidence supporting actions/decisions.
7. **Dependency/Interface** — upstream/downstream dependencies and exchanges.
8. **Authority** — who/what may decide, approve, change or override.
9. **Uncertainty** — unknown, ambiguous or unsupported knowledge.
10. **Binding** — facts legitimately requiring client/runtime context.

Readiness is multidimensional. High information depth cannot compensate for unresolved material decision, exception, authority or lifecycle semantics.

### Canonical readiness states — corrected to frozen Product Constitution

This record does **not** create a successor readiness vocabulary. The frozen readiness ladder remains:

- **DOMAIN_EXECUTION_READY** — all reusable, tool-neutral execution semantics required for the governed scope are present, version-closed, internally consistent and source/provenance controlled; only declared enterprise-specific binding values may remain unresolved.
- **ENTERPRISE_EXECUTION_READY** — all mandatory enterprise/client bindings, mappings, authorities, policies, thresholds and operating constraints required for the scope are resolved or explicitly governed as not applicable.
- **RUNTIME_IMPLEMENTATION_READY** — the chosen downstream runtime has a version-closed specification/projection with capability gaps and implementation/configuration/integration requirements explicitly resolved or governed.

BINDING_REQUIRED, CLIENT_BINDING_REQUIRED, MASTER_DATA_REQUIRED, SOURCE_CONTEXT_PENDING, KNOWLEDGE_GAP and BLOCKED are **blocker / dependency / knowledge-state classifications**, not replacement readiness states. They explain why promotion to a canonical readiness state is permitted or blocked.

Client Binding must not be treated automatically as an Atlas knowledge deficiency. Conversely, a material reusable-domain knowledge gap must not be reclassified as Client Binding merely to obtain a readiness pass.

## 4. Executor Capability Contract v1

Atlas readiness must be evaluated against executor classes rather than hard-coded to one product.

### HUMAN_IMPLEMENTATION
A competent implementation/configuration team consumes the specification. Atlas must make process logic, business objects, rules, decisions, exceptions, dependencies and evidence sufficiently explicit to avoid material domain rediscovery.

### ENTERPRISE_WORKFLOW
A TMS/WMS/SAP/ServiceNow/BPM-style application or workflow is configured. In addition to domain semantics, required states, validations, transitions, ownership and interfaces must be projectable.

### DETERMINISTIC_AUTOMATION
A rules engine, RPA or deterministic workflow executes prescribed behavior. Conditions, branches, inputs/outputs and failure paths must be machine-resolvable to the required level.

### AGENTIC_EXECUTION
A bounded AI/agent executor interprets state and takes permitted actions. Decision authority, allowed actions, constraints, tool contracts, escalation conditions and uncertainty handling must be explicit.

### SPECIFIC_CLIENT_RUNTIME
A named runtime such as Malkom executes for a particular client. This requires Client Binding, including applicable SOP variations, systems, field mappings, thresholds, policies, local exceptions, authority assignments and other runtime-specific facts.

A named technology should map to an executor capability profile plus an adapter/projection. Atlas's canonical domain model must not be designed around that product.

## 5. Domain readiness vs bound readiness

Two concepts must remain separate:

**Domain Execution Readiness** asks whether Atlas contains enough reusable domain execution intelligence for downstream implementation without rediscovering material business semantics.

**Bound Execution Readiness** asks whether the domain model, Client Binding and executor-specific projection together are sufficient for a particular implementation.

Conceptually:

**Domain Execution Model + Client Binding → ENTERPRISE_EXECUTION_READY; + version-closed Executor Projection → RUNTIME_IMPLEMENTATION_READY**

## 6. LTL-03 proof sequence

LTL-03 is the empirical reference case, not automatically the correct universal depth model.

### ATL-60 — evidence recovery and reconciliation
Recover and reconcile the retained LTL-03 research corpus across Google Drive and GitHub. Verify provenance from authoritative sources/evidence through derived semantics and resulting execution artifacts. Re-research only explicit material gaps.

### ATL-59 — execution-readiness validation
Using the frozen/reconciled LTL-03 baseline, test whether LTL-03 satisfies the Execution Readiness Contract and relevant Executor Capability profiles.

Primary output: **Domain Execution Readiness**.

Secondary output: **executor portability/projection readiness** across relevant executor classes.

The assessment criteria must be frozen before inspecting the LTL-03 result. Criteria must not be relaxed after inspection merely to obtain a pass. Required contract amendments discovered during assessment must be surfaced to the Owner/Governor.

## 7. On-demand knowledge depth

Atlas should not pre-build maximum execution depth across the entire logistics universe.

It should maintain governed baseline domain knowledge and deepen a selected operation/use case on demand.

The eventual mechanism is expected to follow:

**Trigger → scope → inspect existing Atlas depth → identify missing execution semantics → research authoritative sources → extract evidence-backed knowledge → generate candidate depth → verify → classify unresolved knowledge → persist reusable knowledge → recompute readiness**

The detailed mechanism is intentionally not frozen yet. First establish:
1. what knowledge depth means;
2. the minimum Atlas knowledge boundary;
3. what qualifies as in-depth;
4. target executor requirements;
5. only then acquisition/generation/verification/persistence mechanisms.

## 8. Stopping rule for on-demand depth

The Execution Readiness Contract and Executor Capability Contract provide the stopping condition:

**Research/decompose until the execution-readiness dimensions required for the selected executor class are satisfied. Stop when remaining unresolved information is legitimately Client Binding or an explicitly governed Knowledge Gap.**

This prevents both under-research and unbounded research.

## 9. Governance implications

- Evidence and provenance are part of readiness, not optional documentation.
- Unsupported semantic inference is prohibited.
- Unknowns must remain explicit.
- Reusable domain truth and client-specific facts must remain separated.
- LTL-03 must be proven execution-ready before its observed depth is generalized into the on-demand-depth architecture.
- Generator design must follow the empirical proof; it must not define the target by assumption.
- Atlas remains execution-platform-neutral at the canonical knowledge layer.


## 10. Governed Data Transformation Mechanism — Operational Knowledge & Work Decomposition

This section governs how Atlas transforms retained research/evidence into reusable Operational Knowledge (OK), Work Decomposition and later executor-specific projections. It is intended to be agent-reproducible; implementation must not depend on chat history.

### 10.1 Architectural source-of-truth rule

**Research/evidence is the input. Supabase is the governed structured knowledge store. HTML is a UI/projection only.**

The HTML experience must not become the canonical store for Operational Knowledge, Work Decomposition, fields, rules, provenance, gaps or binding requirements. It reads/project structured Atlas knowledge.

Before changing the database, inspect the existing Atlas Supabase schema and extend/reuse canonical structures where appropriate. Do not create a parallel LTL-03 schema merely for convenience.

### 10.2 Universe-before-use-case rule

For any selected Atlas task/node, first establish the full operational universe at the required baseline depth before narrowing to a proof use case.

For LTL-03 specifically:
- LTL-03 is the operational/documentation/identity universe under study.
- BOL is one document/object family within that universe.
- BOL digitisation is one execution use case/projection involving that family.
- The research must first determine the actual documentation work, document/object families, lifecycle activities, handoffs, purpose and dependencies. Examples such as creation/amendment/cancellation/digitisation are hypotheses until supported by evidence.

BOL digitisation must not redefine the canonical scope of LTL-03.

### 10.3 Evidence-to-knowledge normalization

Retained evidence must be transformed into linked governed entities, including as applicable:
- work nodes / operational activities;
- business and document objects and relationships;
- lifecycle events, states and transitions;
- actors, roles and authority;
- systems and interfaces;
- inputs, outputs and dependencies;
- information concepts, fields, sections, cardinality, aliases and representations;
- business rules, decisions and validation logic;
- conditional applicability and jurisdiction;
- exceptions, recovery and HITL requirements;
- handoffs and exchanges;
- controls and evidence requirements;
- source authority / precedence and conflict handling;
- normalization / transformation semantics;
- client-binding and master-data requirements;
- explicit knowledge gaps and uncertainty;
- WorkDefinition / Domain Execution Contract relationships.

### 10.4 Common governance/evidence envelope

Each material knowledge element must carry sufficient metadata to make it traceable and governable. At minimum, where applicable:
- stable knowledge ID;
- **ownership zone (Z0–Z7)** and governing layer/contract;
- task/work-node applicability;
- knowledge type;
- canonical name and definition;
- operational purpose;
- applicability / conditions;
- required inputs;
- logic / semantics;
- expected output or state;
- exception behavior;
- related objects;
- actor/system;
- source/evidence reference;
- authority level;
- support/confidence status;
- client-binding requirement;
- master-data requirement;
- executor relevance;
- knowledge-gap state;
- version / governance identity.

Entity-specific schemas may add specialist attributes; the common envelope is not intended to flatten all knowledge into one table.

### 10.5 Operational Knowledge to Work Decomposition

Work Decomposition is derived from the structured Operational Knowledge, not directly from prose, research notes or HTML.

Required traceability pattern:

**work node → required information/object → rule/decision → condition → evidence/authority → exception → output/state → binding/gap**

A decomposition leaf is not execution-ready merely because it has an action label. The relevant readiness dimensions in the Execution Readiness Contract must be resolvable or explicitly blocked/bound.

### 10.6 Gap states and targeted mini-research

Missing information is first-class governed data. Do not infer values merely to fill a UI or achieve apparent completeness.

Permitted states include:
- SUPPORTED
- PARTIALLY_SUPPORTED
- KNOWLEDGE_GAP
- SOURCE_CONTEXT_PENDING
- CLIENT_BINDING_REQUIRED
- MASTER_DATA_REQUIRED

After the first structuring pass, query the structured model for missing material semantics and generate a targeted mini-research backlog. Prefer the same authoritative source universe already used for the task. Research only unresolved material gaps, attach the resulting evidence, then enrich the affected knowledge records.

This cycle is:

**research → structured ingestion → gap detection → targeted mini-research → evidence → enrichment → readiness reassessment**

This is also the candidate reusable transformation mechanism supporting Atlas on-demand knowledge depth.

### 10.7 Executor projection

Executor-specific implementation artifacts are generated only after canonical OK and Work Decomposition are established.

For the current proof:
1. establish wider LTL-03 operational/documentation knowledge;
2. freeze the independent BOL universe;
3. identify the BOL-digitisation subset;
4. project only the applicable canonical knowledge, plus explicit Client Binding/master requirements, into the experimental executor.

The executor projection must not mutate canonical domain meaning.

### 10.8 Supabase and HTML roles

**Supabase:** governed structured knowledge persistence and relationships.

**HTML:** interactive human projection of the Supabase-backed model, expected to expose:
LTL-03 universe → Work Decomposition → documents/objects → lifecycle → information requirements → rules/decisions → exceptions → handoffs/dependencies → evidence/provenance → gaps/bindings → executor projection.

A UI representation is replaceable. The governed structured knowledge is not.

### 10.9 Agent continuity / failure recovery

This mechanism is deliberately recorded in GitHub and Linear so another authorized implementation agent, including Claude, can continue the work if the current agent fails or the conversation context is lost.

An agent must:
1. read this governance record and the active Linear gate;
2. consume governed evidence rather than chat recollection;
3. preserve source-to-knowledge traceability;
4. materialize structured OK before deriving Work Decomposition;
5. preserve explicit gaps/bindings rather than hallucinating closure;
6. use Supabase as the structured persistence layer and HTML only as a projection;
7. stop at the applicable QA/Owner gate and never self-authorize architectural exceptions.


## 11. Correction — two distinct mechanisms

Atlas must keep two mechanisms separate.

### Mechanism 1 — In-Depth Knowledge Research
Purpose: acquire sufficient authoritative operational/domain knowledge for a selected scope.

**scope operational universe → identify knowledge dimensions → research authoritative sources → capture evidence/provenance → derive domain facts → resolve semantics → identify rules/exceptions/lifecycle/dependencies → classify reusable vs client-specific knowledge → identify gaps → targeted mini-research → freeze evidence-backed knowledge candidate**

Output: evidence-backed Operational Knowledge candidate and explicit gaps. This mechanism answers **“Do we know enough?”**

### Mechanism 2 — Research-to-Execution-Readiness Transformation
Purpose: transform sufficiently deep researched knowledge into governed implementation-ready specifications without rediscovering material domain semantics.

**frozen/reconciled research → structured Z0/Z1 knowledge → canonical operational/work hierarchy → Z5 Work Decomposition → Canonical WorkDefinitions → Z2 binding requirements/resolution → Z6 readiness proof → executor projection**

Output: governed execution semantics, readiness proof and executor-specific projection. This mechanism answers **“Can what we know be transformed into an implementation-ready specification?”**

A gap discovered by Mechanism 2 is returned to Mechanism 1 as a bounded research request. It is not silently inferred by the transformation engine.

## 12. Promotion gate for ATL-60

ATL-60 research recovery, reconciliation, evidence analysis, operational-universe mapping and **candidate** structuring are authorized to continue.

Canonical Supabase mutation/promotion of newly generated OK, Work Decomposition or WorkDefinitions is **blocked** until:
1. the existing Atlas Supabase schema is inspected and mapped to Z0–Z7;
2. the Research-to-Execution-Readiness Transformation Generator Contract is independently QA'd and Owner-authorized/frozen for use;
3. the applicable Generation Registry run record can be populated from frozen inputs and actual implementation identity;
4. validator/QA and rollback/recovery controls required by the global generation/freeze standard are available.

HTML remains G5 projection only and may not become canonical business truth.

## 13. Governance correction disposition — 22 Sep 2026

The Owner directed the bounded corrections in this record after independent validation. The earlier readiness-vocabulary divergence is corrected without superseding the frozen Product Constitution. The missing Z0–Z7 ownership tag is corrected. The two mechanisms are explicitly separated. ATL-60 may continue non-promotional research/candidate structuring; canonical Supabase writes remain gated.

The earlier ATL-40 freeze-window sequencing finding is acknowledged as a process violation rather than erased. It did not mutate the independently frozen LTL-03 ATL-37 graph/manifest. Subsequent ATL-40/ATL-60 governance work is treated as candidate governance until it passes the applicable QA/Owner gate; ancestry alone does not promote or invalidate it.
