# AR0.2 — Layer-Boundary Decision Candidate

Status: CANDIDATE / AWAITING OWNER REVIEW  
Stage: AR0.2 — Layer-Boundary Decision  
Basis: AR0.1 evidence + AR-D013  
Frozen V1 mutated: NO  
R0.4 status: SUSPENDED

## 1. Governing platform boundary

> **Atlas is the governed intelligence and specification layer between enterprise/client operations and the technologies used to transform or execute them.**

> **Atlas owns understanding and specification. Downstream platforms own execution.**

The architecture must therefore preserve one technology-neutral business meaning while allowing multiple governed specifications/projections for Malkom, agents/workflows, ERP/TMS/WMS, BPM/digital twins, RPA, ServiceNow, custom applications and future tools.

## 2. AR0.2 decision summary

AR0.2 recommends **targeted boundary refinement, not a new monolithic layer**.

The successor architecture should contain these distinct ownership zones:

1. **Reference Domain + Operational Knowledge** — owns reusable business truth and epistemic state.
2. **Canonical Work Decomposition** — owns business-semantic work topology and decomposition lineage.
3. **Canonical WorkDefinition** — owns technology-neutral execution-relevant semantics for a canonical work unit.
4. **Enterprise Context / Client Binding** — owns enterprise-specific values, mappings, variants and operating constraints.
5. **Governed Specification Assembly** — a non-duplicating assembly/proof boundary that selects scope, resolves dependency closure, computes readiness/resolution and creates a version-closed specification manifest.
6. **Optional Design / Solution Synthesis** — may generate candidate solution designs from the governed specification; never becomes canonical business truth.
7. **Runtime Adapter / Projection** — owns target-tool translation, capability/loss assessment and runtime-specific structures.
8. **Execution Runtime** — outside Atlas execution ownership.
9. **Observation / Evidence Reconciliation** — receives runtime evidence and observations back into Atlas without directly mutating canonical knowledge.

## 3. Layer-by-layer ownership decision

### L1 — Reference Domain + Operational Knowledge

**Owns**
- domain/process/task identity and applicability;
- business meaning, purpose and expected outcomes;
- required information, canonical object/field meaning and information-resolution requirements;
- rules, decisions, validations and controls;
- business authority semantics;
- business-significant states/events;
- exceptions and required recovery semantics at operational-knowledge level;
- evidence expectations;
- provenance, epistemic classification and explicit UNKNOWN/conflict state;
- reusable client-binding requirements: what value must exist, when, why and acceptable constraints.

**Does not own**
- actual client system/field names;
- local SLA/threshold values unless universally authoritative domain truth;
- runtime queues/nodes/prompts/models;
- credentials or deployment configuration;
- vendor-product configuration.

**Decision:** Preserve current boundary. R0.3 content maturity gaps are research/content gaps, not justification to move truth downstream.

### L2 — Canonical Work Decomposition

**Owns**
- parent-to-child work lineage;
- decomposition of composite business work into canonical work units;
- business-significant dependency/topology relationships among work units;
- decomposition rationale and evidence;
- canonical work-unit type and semantic role.

**Boundary refinement required**
The frozen V1.1 rule uses the intended executor class as a decomposition stopping criterion. That is useful for executability analysis but can make canonical granularity depend on a chosen runtime.

**AR0.2 candidate decision:**
Canonical decomposition must stop on **business-semantic sufficiency**, not target-runtime convenience. A canonical unit is sufficiently decomposed when all business-significant trigger, information, decision/control, authority, action, state/outcome, exception/recovery and evidence semantics are explicit and further decomposition would primarily describe implementation mechanics rather than additional business meaning.

Executor classes remain valid **sufficiency lenses** and may identify that a target implementation requires further runtime decomposition, but they must not redefine canonical business identity or meaning.

Any runtime-specific further split/aggregation belongs to the adapter/projection layer and retains lineage to the canonical unit.

### L3 — Canonical WorkDefinition

**Owns**
- identity, lineage and version;
- applicability and prerequisites;
- inputs, objects and fields by reference to authoritative semantics;
- business decisions/rules/validations/controls;
- permitted actions and system exchanges at technology-neutral level;
- actors/authority/HITL boundaries;
- outcomes, states and transitions;
- waits, clocks and temporal constraints;
- exceptions, escalation, business retry and recovery;
- evidence/completion criteria;
- client-binding requirement references;
- execution characteristics that describe business behavior rather than tool implementation.

**Grammar refinement required**
WorkDefinition/decomposition VNext must formally represent business-significant:
- ordered dependencies;
- parallel branches and AND/OR joins;
- multi-instance completion semantics;
- event/wait correlation and stale/duplicate-event policy;
- idempotency where business correctness depends on duplicate suppression;
- atomicity/commit boundaries where they are business-significant;
- compensation/reversal obligations;
- business retry versus technical retry;
- timeout ownership and timeout outcome.

**Does not own**
- queue/subqueue/node topology;
- prompts/models;
- connector implementation;
- vendor configuration;
- technical retry/backoff mechanics unless they express a governed business policy.

### L4 — Enterprise Context / Client Binding

Existing Client Binding remains correct but is too narrow as the complete enterprise-context concept.

**Owns**
- actual enterprise systems/applications and systems of record;
- client field/API mappings;
- master/network/serviceability configuration;
- client SLA, cut-off, threshold and policy values;
- enterprise role/authority mappings;
- exception routing and communication channels;
- client-specific rule/policy variants with explicit scope and precedence;
- local regulatory/contractual constraints;
- environment/security requirements and access constraints, but not secret credential values;
- when required for design/simulation/sizing: workload, arrival/seasonality, concurrency, capacity and human-skill/capacity context;
- enterprise non-functional requirements such as availability, resilience, observability and freshness when they express a client requirement rather than a runtime implementation choice.

**AR0.2 candidate decision:**
Create an **Enterprise Context umbrella** in the successor architecture. Client Binding remains a governed sub-contract within it rather than being stretched into a dumping ground. Optional operating-profile/NFR facts are only required when the selected specification purpose requires them.

### L5 — Governed Specification Assembly

AR0.1's clearest gap belongs here.

This is **not a new source-of-truth semantic layer**. It owns references, closure, proof and packaging; underlying facts remain owned by L1-L4.

It should provide three small, separable capabilities:

#### A. Specification Scope Manifest
Selects the exact canonical tasks/work units/objects/dependencies and enterprise context included in the transformation or implementation scope.

It owns scope membership and scope intent, not the referenced business facts.

#### B. Resolution / Readiness Assessment
Computes deterministic dependency closure across the selected scope.

It must expose at minimum:
- resolved authoritative facts;
- client-binding-required facts;
- unresolved/unknown facts;
- conflicts;
- inferred but ungoverned facts;
- unsupported or outside-Atlas requirements;
- blockers and dependency chain;
- purpose-specific disposition such as READY / NOT_READY / CONDITIONALLY_READY where the readiness policy permits it.

This is a **derived proof**, not an authoritative owner of business truth.

#### C. Version-Closed Specification Manifest
Produces the immutable/version-closed handoff identity for a selected scope by referencing exact versions/hashes of canonical work, enterprise context, knowledge state and readiness proof.

It may materialize a human/machine-consumable specification package but must not copy facts in ways that create competing sources of truth.

**Decision:** This assembly boundary is required in the successor architecture. It should be implemented as a small set of contracts/manifests rather than a monolithic `Execution Requirements` object.

### L6 — Optional Design / Solution Synthesis

AR-D013 permits solution-architecture capability as a legitimate Atlas capability/byproduct but not as canonical truth.

**Owns, when invoked**
- candidate implementation patterns;
- candidate division of work across human/system/agent/workflow components;
- candidate tool/runtime mappings;
- design alternatives, assumptions, trade-offs and capability gaps;
- comparison against the governed specification.

**Rules**
- consumes L5 governed specification;
- every design claim must trace to governed requirements or explicit assumptions;
- may not mutate L1-L4 truth;
- may not mark missing knowledge as resolved;
- candidate designs remain proposals until separately approved/bound.

**Decision:** Optional Atlas capability, not mandatory for specification readiness and not a new canonical business layer.

### L7 — Runtime Adapter / Projection

**Owns**
- target tool/runtime identification and capability profile;
- mapping from canonical semantics/specification to native structures;
- semantic-loss/capability-gap assessment;
- queue/subqueue/node/work-type projection;
- BPMN/tool model projection;
- agent roles/prompts/tool permissions/guardrails as runtime implementation structures;
- ERP/TMS configuration/fit mapping;
- technical connector configuration;
- technical retry/backoff and deployment mechanics;
- target-specific verification.

**Atlas product note:** Adapters/projections may be built and operated as Atlas product capabilities, but their content is derived/tool-specific and is not canonical business truth.

### L8 — Execution Runtime

**Outside Atlas execution ownership.**

Malkom, agents/workflow runtimes, SAP/ERP, TMS/WMS, ServiceNow, RPA, BPM engines and custom applications execute the operation.

Atlas may initiate/export/deploy/connect where an authorized adapter supports it, but the runtime remains the execution authority. Atlas must not become the system that performs the business transaction merely because it can orchestrate a deployment or call a runtime API.

### L9 — Observation / Evidence Reconciliation

**Owns**
- generic references to canonical work/specification identity;
- execution-instance identity where observed;
- state/event/evidence observations received from runtimes;
- conformance/deviation classification;
- feedback/knowledge-gap proposals.

**Does not own**
- mutation of canonical knowledge from observed behavior;
- runtime-native event model as canonical truth.

**Decision:** Generalize the existing transport-leg-specific execution-instance concept into an optional cross-runtime observation/evidence contract in the successor architecture. This enables live process/twin/conformance use cases without making live-runtime state mandatory for every WorkDefinition.

## 4. Resolution of AR0.1 weak/absent requirement classes

| AR0.1 requirement | AR0.2 owner / decision |
|---|---|
| R25 aggregate readiness / blocker closure | L5B Resolution/Readiness Assessment |
| R26 version-closed handoff | L5C Version-Closed Specification Manifest |
| R27 implementation-scope composition | L5A Specification Scope Manifest |
| R28 ordered dependency graph | L2/L3 canonical topology grammar |
| R29 parallel/join/multi-instance | L2/L3 canonical topology grammar |
| R30 event correlation / stale-duplicate handling | L3 where business-significant; L7 for technical transport mechanics |
| R31 idempotency/atomicity/compensation | L3 where business-significant; L7 for technical implementation mechanics |
| R32 generic work-instance/live observation | L9 optional Observation/Evidence contract |
| R33 workload/arrival/concurrency/capacity | L4 Enterprise Context when required by purpose |
| R34 NFRs | L4 when enterprise requirement; L7 when target implementation choice |

R35-R38 remain downstream/runtime-specific as classified by AR0.1.

## 5. Canonical chain proposed for AR0.3 contract design

```text
AUTHORITATIVE SOURCES
  -> UNIVERSE / DOMAIN REFERENCE
  -> OPERATIONAL KNOWLEDGE
  -> CANONICAL WORK DECOMPOSITION
  -> CANONICAL WORKDEFINITION
  -> ENTERPRISE CONTEXT / CLIENT BINDING
  -> GOVERNED SPECIFICATION ASSEMBLY
       - Scope Manifest
       - Resolution / Readiness Proof
       - Version-Closed Specification Manifest
  -> optional DESIGN / SOLUTION SYNTHESIS
  -> RUNTIME ADAPTER / PROJECTION
  -> EXECUTION RUNTIME [outside Atlas execution ownership]
  -> OBSERVATION / EVIDENCE RECONCILIATION
  -> governed feedback / knowledge-gap process
```

## 6. What must not happen in AR0.3

AR0.3 must not:
- create a monolithic Execution Requirements contract;
- duplicate source/domain/OK/WorkDefinition/client-binding facts inside the specification manifest;
- place runtime queues, prompts, vendor configuration or credentials into canonical WorkDefinition;
- make every workload/NFR/simulation fact mandatory for every operation;
- allow a target tool to determine canonical business decomposition;
- allow observed runtime behavior to silently overwrite governed reference truth;
- redesign Canvas or public/protected access boundaries as part of contract work.

## 7. Candidate disposition

`TARGETED_LAYER_BOUNDARY_REFINEMENT_REQUIRED__NO_MONOLITHIC_NEW_SEMANTIC_LAYER`

The frozen architecture direction remains valid. The successor primarily needs:
1. technology-neutral canonical decomposition stopping rules;
2. stronger canonical topology/control-flow grammar;
3. Enterprise Context as the explicit owner for client operating context beyond simple field/system binding;
4. governed specification assembly as reference/closure/proof/manifest capability;
5. optional cross-runtime observation/evidence semantics;
6. optional design/solution-synthesis capability kept downstream of governed specification;
7. the existing runtime-adapter boundary preserved.

## 8. AR0.2 exit gate

AR0.2 is complete as an architecture-analysis candidate and awaits Owner review.

If accepted, AR0.3 should define only the minimum machine-readable successor contracts required to implement these decisions, with explicit lineage to frozen V1 and without overwriting historical assets.

R0.4 remains suspended until AR0.6 Owner freeze.
