# Atlas v2 Product End-State Contract — V1 FROZEN

**Status:** FROZEN — RECONCILIATION COMPLETE, READY FOR ATL-110 INDEPENDENT QA  
**Product release:** Atlas v2  
**Contract version:** V1  
**Owner/Governor:** Darshan Ukey  
**Linear parent:** ATL-103  
**Milestone:** Atlas v2 — Product Live  
**Supersedes as active:** `ATLAS_V2_PRODUCT_END_STATE_CONTRACT_V1_CANDIDATE.md`  
**Frozen Product Constitution changed:** NO  
**Frozen date:** 2026-09-26T17:45:00Z  
**Frozen by:** Claude (ATL-103 execution, Agent Ready)  
**Reconciliation evidence:** governance/ATL_103_RECONCILIATION_EVIDENCE.md

## 1. Definition of Atlas v2 Product Live

Atlas v2 is the complete next product state after the currently live Atlas v1.

Atlas v2 is **Product Live** only when a fresh reviewer can reproducibly demonstrate the entire governed product, not merely when backend/architecture tasks are individually complete.

Atlas v2 must convert authoritative, versioned domain knowledge plus enterprise reality into usable operational/transformation intelligence and implementation-ready specifications for downstream execution platforms, while preserving provenance, gaps, versions, security, recovery and runtime neutrality.

Atlas itself does not become the business-transaction/runtime execution authority.

## 2. Product identity inherited from the frozen Product Constitution

Atlas remains three products on one governed semantic foundation:

1. **Operations Intelligence — UNDERSTAND** how work actually operates.
2. **Transformation Intelligence — DECIDE** what should change and why.
3. **Execution Intelligence — DEFINE** how approved work should operate and make it implementation-ready.

External platforms/people execute.

## 3. End-to-end governed architecture

```text
AUTHORITATIVE SOURCES
    ↓
Source Registry / Refresh / Provenance
    ↓
Structured Canonical Universe / Domain Reference
    ↓
Inside-out + Outside-in Daughter Knowledge Generation
    ↓
Baseline Daughter / Process / Task Knowledge (~A5)
    ↓
On-Demand Depth Trigger
    ↓
Targeted Research / Operational Knowledge / Knowledge-State Resolution
    ↓
Canonical Work Decomposition
    ↓
Canonical WorkDefinition
    ↓
Enterprise Discovery / Client Context / Client Binding
    ↓
Readiness / Version-Closed Specification
    ↓
Runtime-Neutral Projection Boundary
    ├─ Malkom
    ├─ Agentic AI / agent-task runtime
    ├─ RPA / BPM / workflow
    ├─ ERP / TMS / WMS / ServiceNow / custom
    └─ approved future consumers
    ↓
EXTERNAL EXECUTION
    ↓
Operational Observation / Evidence / Reconciliation
    ↓
Operations Intelligence / Transformation Intelligence
    ↓
Approved Target-State Delta
    ↺ back into governed execution definition
```

Across all layers: identity, versioning, provenance, epistemic state, contracts, authorization, QA, custody, security, recovery and change control.

Presentation surfaces (HTML/web UI, Canvas, Ask Atlas, inspectors) are projections over governed structured state. They are never canonical business truth.

## 4. Layer A — Authoritative Source Foundation

Atlas v2 must maintain a governed source registry containing, where material:
- source identity;
- authority class;
- publisher/owner;
- canonical location;
- version/effective date;
- content hash;
- applicability;
- provenance;
- refresh cadence / last checked / next review;
- supersession/deprecation;
- custody identity.

Default periodic re-check may be approximately six months where no stronger source-specific cadence exists.

A source refresh follows:

`source check → old/new diff → semantic change classification → impacted canonical objects → selective downstream impact`.

A source change does not directly mutate downstream truth.

## 5. Layer B — Structured Canonical Universe

The Universe is canonical structured/versioned data, not an HTML file.

Current target physical implementation may use Supabase/Postgres where appropriate, but storage technology is replaceable.

The Universe owns reusable domain reference identity/relationships and the governed baseline semantics required to generate daughter knowledge.

Required chain:

`Frozen source inputs → Source/Universe Generation Contract → extraction/normalisation → semantic mapping → conflict/gap handling → validation → versioned Universe materialization`.

HTML/Canvas render the Universe through presentation/API contracts.

## 6. Layer C — Daughter / Baseline Knowledge Generation

Atlas v2 must generate daughter/domain/process/task knowledge using two complementary directions.

### 6.1 Inside-out
Start from what the current governed Universe already contains:
- domain/subdomain taxonomy;
- process/task relationships;
- objects/documents/fields;
- known semantics;
- existing provenance;
- known gaps/conflicts.

### 6.2 Outside-in
Independently research what a sufficiently complete representation of the daughter/process/task should contain using authoritative/high-quality sources.

### 6.3 Reconciliation
`inside-out candidate + outside-in research → coverage/conflict/gap analysis → validated daughter knowledge model`.

The daughter **knowledge model** is structured governed data.
The daughter **page** is a generated presentation.

The baseline is approximately the governed A5/task level. Deeper execution knowledge is handled by the on-demand-depth mechanism.

## 7. Layer D — On-Demand Depth and Operational Knowledge

Atlas must not pre-research every task in every domain to execution depth.

When baseline knowledge is insufficient for a user, transformation or downstream implementation use case:

`depth demand → target-depth decision → targeted research/acquisition → candidate knowledge → verification → gap/conflict resolution → persistence/promotion/reuse`.

The ATL-40–48 workstream is the existing governed mechanism to reconcile and complete.

Operational Knowledge must exist before execution semantics are generated; WorkDefinitions may not become a hidden place to invent missing domain knowledge.

## 8. Layer E — Explicit Knowledge-State Model

Atlas must express why knowledge is or is not resolved.

At minimum, governed states equivalent to:
- KNOWN_AUTHORITATIVE;
- CLIENT_BINDING_REQUIRED;
- INFERRED;
- CONFLICTING;
- UNKNOWN;
- RESEARCH_REQUIRED;
- SME_DECISION_REQUIRED;
- HISTORICAL_DATA_ANALYSIS_REQUIRED;
- NOT_APPLICABLE;
- DEPRECATED/SUPERSEDED.

These states must drive:
- UI;
- Universal Ask Atlas;
- research/depth triggers;
- readiness;
- governance;
- impact analysis.

## 9. Layer F — Canonical Execution Semantics

Sufficient Operational Knowledge produces:

`Operational Knowledge → Recursive Work Decomposition → Canonical WorkDefinition`.

Canonical WorkDefinition must carry, where material:
- identity/lineage/applicability;
- triggers/prerequisites;
- objects/fields/documents;
- inputs/outputs;
- states/events/transitions;
- decisions/business rules;
- validations/controls;
- actors/roles/authorities;
- actions/outcomes;
- systems/interfaces;
- clocks/waits/time constraints;
- exceptions/retries/escalations/recovery;
- evidence/completion criteria;
- execution characteristics;
- enterprise/client binding requirements.

If the implementation team must rediscover governed business logic, the scope is not execution-ready.

## 9A. Detailed Execution-Readiness Mechanism — inherited, not replaced

Atlas v2 MUST preserve the more detailed governed mechanism already defined through the Linear/AR/P6 execution-readiness work. The product-level architecture in this contract is an umbrella; it does not simplify or supersede those lower-level semantics.

### Mechanism 1 — In-Depth Knowledge Research

Purpose: determine whether Atlas knows enough.

Required behavior:
- establish the operational universe before selecting a narrow execution use case;
- research authoritative sources/evidence;
- normalize findings into governed knowledge entities;
- attach provenance/evidence, applicability, authority, confidence/support and explicit gap state;
- identify contradictions and missing semantics;
- perform bounded targeted re-research;
- freeze/reconcile an evidence-backed knowledge candidate.

### Mechanism 2 — Research-to-Execution-Readiness Transformation

Purpose: determine whether researched knowledge can be transformed into implementation-ready specifications without rediscovering material business semantics.

Required behavior:
- consume frozen/reconciled research rather than prose/HTML as authority;
- preserve Z0–Z7 ownership and governing layer on material structured knowledge;
- derive Canonical Work Decomposition from structured Operational Knowledge;
- derive Canonical WorkDefinition from the governed decomposition/knowledge substrate;
- expose enterprise/client binding requirements separately from reusable domain knowledge;
- produce Z6 readiness proof and version-closed specification;
- only then produce runtime-specific projections.

A material semantic gap discovered during transformation returns to Mechanism 1 as a bounded research request. It is never silently inferred merely to complete a WorkDefinition or projection.

### Common evidence/governance envelope

Material knowledge elements should retain, where applicable:
- stable identity and version;
- work-node/scope applicability;
- knowledge type;
- canonical name/definition and operational purpose;
- conditions/applicability;
- required inputs;
- rule/decision/validation logic;
- expected output/state;
- exception behavior;
- related objects/relationships;
- actor/system;
- source/evidence reference and authority;
- confidence/support/epistemic status;
- client-binding/master-data requirement;
- executor relevance;
- knowledge-gap state;
- Z0–Z7 ownership.

### Execution-semantic depth that must survive compilation

The detailed Linear work remains binding for material scopes, including:
- lifecycle/state-transition semantics;
- identity and relationship/cardinality model;
- information contract per transition;
- decisions and rule catalogue;
- validation and control model;
- exception taxonomy;
- authority/action rights;
- evidence/audit contract;
- retry/idempotency/recovery;
- source precedence at the semantic/field level where required;
- temporal/effective-date logic;
- confidence/gap handling;
- downstream-tool projection.

Queues/work states must be derived from governed lifecycle states, unmet prerequisites, rules, exceptions or evidence requirements; they must not be manually invented as canonical process truth.

The canonical execution chain therefore remains:

`authoritative evidence → governed knowledge → recursive Work Decomposition → Canonical WorkDefinition → binding requirements → enterprise binding → readiness → runtime projection`.

ATL-60/87/95 and their governed successor contracts/evidence are implementation-detail sources for this mechanism and must be reconciled into the v2 coverage matrix rather than replaced by new generic tasks.

## 9B. Business Logic & Rule Ontology — extensible, runtime-neutral

Atlas v2 must treat business logic/rules as first-class governed structured semantics rather than burying them in prose, prompts, spreadsheets or runtime-specific code.

The governing candidate contract is:
`governance/product/ATLAS_V2_BUSINESS_RULE_ONTOLOGY_RUNTIME_CONSUMPTION_CONTRACT_V0_1_CANDIDATE.md` (ATL-119).

### Three independent classification dimensions

Each material rule may be classified by:

1. **rule family/type** — the business purpose of the rule;
2. **evaluation mode** — how the rule is enforced;
3. **distribution mode** — how the downstream executor receives/accesses it.

These dimensions must remain separate.

### Extensible taxonomy principle

The current rule-family taxonomy is a **seed taxonomy, not a closed/exhaustive universal ontology**.

As Atlas gains Operational Knowledge from new domains/processes, new rule families/subtypes may be discovered. Atlas must not force novel semantics into an inaccurate existing category merely to preserve the current vocabulary.

Governed extension follows:

`new Operational Knowledge → candidate semantic pattern → differentiation review → taxonomy extension/version → selective mapping of prior rules where valid`.

Historical frozen rule identities are not rewritten solely to fit a later taxonomy.

### Seed rule-family scope

The initial taxonomy covers, at minimum:
- applicability / eligibility / prerequisites;
- mandatory / conditional information;
- format / datatype / allowed-value / reference/master-data;
- classification / derivation / calculation / transformation / normalization;
- relationship / cardinality / consistency / duplicate detection / reconciliation;
- source authority / precedence / conflict / override;
- decision / routing / sequencing / state transition / completion;
- timing / SLA / cutoff / effective-date / temporal precedence;
- jurisdiction / policy / compliance / regulatory / contractual;
- role / authority / approval / segregation-of-duty / controls / automation permission / security / privacy / retention;
- evidence / audit / traceability;
- exception / retry / escalation / fallback / recovery / idempotency;
- confidence / ambiguity / human-in-loop;
- client binding / client override / system-of-record / client master;
- mapping / integration / runtime capability / projection / unsupported semantic;
- observation/reconciliation / knowledge promotion.

This list may grow when governed evidence justifies additional categories.

### Evaluation modes

Seed evaluation modes include deterministic expressions, decision tables, reference/master-data lookups, retrieve-and-reason, bounded LLM classification/extraction-with-validation, external APIs, client binding, human decision and composite mechanisms.

Where deterministic evaluation is sufficient, an LLM is not required merely because the consuming runtime is agentic.

### Distribution modes and runtime dependency

Seed distribution modes include:
- EMBED;
- SNAPSHOT;
- DYNAMIC_LOOKUP;
- EXTERNAL_AUTHORITY;
- CLIENT_SYSTEM_LOOKUP;
- HUMAN_RESOLUTION.

Atlas is the design-time/governance authority for execution semantics. It is **not required to be an always-on runtime dependency for every transaction**.

Preferred default is HYBRID:
- stable/critical rules are embedded or snapshotted into a version-closed runtime package;
- dynamic Atlas/reference/client-system retrieval is used only where declared by the rule/runtime contract.

A runtime projection must therefore specify the applicable rule/rule-set, version, evaluation mode, distribution mode, required service/tool, binding need, failure behavior, evidence capture and refresh/revalidation policy.

### BOL example principle

For BOL digitization, dozens of authoritative/universal field rules should not be copied blindly into one large agent prompt.

The WorkDefinition identifies the semantic obligations and applicable rule sets; the runtime projection tells the agent/workflow which rules are embedded, deterministic, dynamically looked up, resolved through client binding or escalated to human review.

The same canonical rule may project differently to Malkom, agentic AI, RPA/BPM/workflow or a human operating model without changing its business meaning.

## 10. Layer G — Enterprise Discovery and Client Binding

Atlas v2 needs a practical mechanism to ingest enterprise/client reality, not merely a schema for Client Binding.

Inputs may include:
- SOPs/process documents;
- policies;
- system/configuration information;
- field/API mappings;
- authorities/roles;
- thresholds/SLAs/cut-offs;
- operating variants;
- historical/operational evidence;
- structured client inputs.

Flow:

`client material/evidence → extraction candidate → mapping to declared binding requirements → validation/gap/conflict classification → authorized confirmation where required → governed Enterprise Context / Client Binding`.

LLM extraction may create candidates but may not directly promote canonical enterprise/domain truth.

Client Binding resolves declared enterprise-specific slots. It must not compensate for missing reusable domain knowledge.

## 11. Layer H — Readiness and Version-Closed Specification

Atlas must deterministically distinguish:
- DOMAIN_EXECUTION_READY;
- ENTERPRISE_EXECUTION_READY;
- RUNTIME_IMPLEMENTATION_READY.

Readiness must expose blocker chains rather than hiding unresolved semantics.

Z6/specification is a composition/proof boundary and must not become a competing business-truth store.

## 12. Layer I — Multi-Consumer Runtime Projection

From the **same canonical governed WorkDefinition**, Atlas must produce implementation-ready packages/projections for materially different downstream consumers.

Minimum v2 proof:
- Malkom;
- agentic-AI / agent-task runtime;
- RPA/BPM/workflow.

Additional supported consumers may include ERP/TMS/WMS, ServiceNow, BPM/digital twin and custom applications.

Each projection must classify semantics such as:
- SUPPORTED;
- MAPPED;
- TRANSFORMED;
- CLIENT_BINDING_REQUIRED;
- PARTIAL;
- UNSUPPORTED_RUNTIME;
- DEFERRED_RUNTIME_ENHANCEMENT.

Mandatory unsupported semantics fail closed.

Runtime-specific structures cannot mutate canonical Atlas truth.

## 13. Layer J — Operational Evidence and Observation

Atlas can store/reference governed actual-state evidence:
- transactions/events;
- cycle/performance observations;
- process/decision variants;
- exceptions/rework/corrections;
- control evidence;
- outcomes;
- time-window/scope/extraction identity.

Observed behavior is evidence, not automatic canonical truth.

External execution observations return through a governed reconciliation loop, not through silent upstream mutation.

## 14. Layer K — Operations Intelligence

From governed Z1/Z2/Z3 semantics/evidence, Atlas should be able to explain, where evidence is sufficient:
- actual/reference/client variants;
- cycle/performance patterns;
- friction/rework/exception drivers;
- risk/control gaps;
- standardisation/complexity opportunities;
- evidence-window and confidence limitations.

## 15. Layer L — Transformation Intelligence

Atlas should be able to:
- identify and prioritise transformation opportunities;
- distinguish symptoms from root causes;
- compare future-state options;
- assess assumptions, impacts and dependencies;
- classify candidate solution patterns including process/policy change, standardisation, workflow, RPA, rules, AI/agent, enterprise-system change, human-work redesign or mixed patterns.

Transformation outputs remain proposals until governed approval.

Approved target-state semantics are versioned separately from current/reference truth and become inputs to Execution Intelligence.

## 16. Interaction and Product Experience

### 16.1 Consumption-first
Normal users first see understandable domain/process/task meaning. Governance/provenance complexity is progressively disclosed.

### 16.2 Universal Ask Atlas
One context-aware natural-language interaction layer across Universe, daughter/process/task pages, Canvas, deep knowledge, WorkDefinitions, bindings, readiness and projections.

Ask Atlas must:
- answer from governed knowledge;
- cite/expose provenance as appropriate;
- respect knowledge-state uncertainty;
- navigate/highlight/trace product objects;
- respect authorization and public/protected boundaries.

### 16.3 Canvas
Visual navigation/relationship surface over governed structured state.

### 16.4 Inspector
Inspect semantics, sources, rules, decisions, controls, actors, evidence, gaps, bindings, readiness and projection disposition.

### 16.5 Trace
- Operational Trace — follow object/document/information flow through work.
- Dependency Trace — show what assets, WorkDefinitions, clients and projections depend on a source/rule/object.

### 16.6 Compare
Where governed, compare:
- reference vs enterprise/client;
- current vs approved target;
- version vs version;
- projection vs canonical semantics;
- operating variants.

### 16.7 Admin/Public split
Admin-authorized product exposes protected execution intelligence according to permissions.
Public product is deliberately sanitized and must not expose replicable execution IP, protected source detail, machine-readable execution contracts or other governed protected content.

## 17. Versioned Cross-Layer Contracts and Change Propagation

Atlas v2 architecture is a versioned dependency graph, not a blind rebuild pipeline.

Every material object/artifact should record, where applicable:
- object identity/version/status/hash;
- source dependencies;
- data dependencies;
- contract/schema dependencies;
- generator dependencies;
- client dependencies;
- runtime/adapter dependencies;
- supersession;
- downstream dependents.

Versioned interfaces are required between:
- Source → Universe;
- Universe → Daughter;
- Daughter/Baseline → Depth;
- Operational Knowledge → Work Decomposition;
- Decomposition → WorkDefinition;
- WorkDefinition → Client Binding;
- Binding/WD → Readiness;
- Specification → Runtime Adapter;
- Runtime Observation → Evidence/Reconciliation;
- governed data/API → UI projections.

Change classes include at minimum:
- metadata/non-semantic;
- additive semantic;
- breaking semantic;
- client-only;
- runtime/adapter-only;
- schema/contract;
- generator implementation.

Downstream states include at minimum:
- CURRENT;
- REVALIDATION_REQUIRED;
- REGENERATION_REQUIRED;
- BLOCKED_BY_UPSTREAM;
- SUPERSEDED.

Required mechanism:

`change → diff/classification → dependency traversal → minimal impact set → staleness state → selective revalidate/regenerate → proof → successor identity → readiness/projection recompute where required`.

## 18. Knowledge Promotion and Compounding

Atlas must convert validated reusable learning into compounding domain intellectual capital.

`client/project observation → candidate reusable knowledge → evidence/source validation → domain-vs-client classification → governed promotion decision → successor reusable-domain version → available to later engagements`.

Repeated client observations do not automatically become domain truth.

## 19. Backend, API, Upgrade and Release Architecture

Atlas v2 must be production-manageable across:
- canonical persistent object boundaries;
- API/query contracts;
- frontend/backend contract versioning;
- schema evolution/migrations;
- backward/forward compatibility;
- version negotiation where required;
- indexing/search/retrieval;
- permissions/public-protected enforcement;
- provenance/audit retrieval;
- release manifests/dependency identities;
- upgrade path;
- rollback/recovery.

Technology choices such as Supabase/Postgres and Vercel are replaceable implementation choices, not semantic truth.

## 20. Governance, Provenance, Custody and Recovery

All material generation follows the governing generation/freeze discipline:

`frozen inputs → versioned generator contract → implementation → verification/QA → governed output → hash/identity → custody/recovery`.

High-risk/canonical outputs require the applicable GitHub/Drive/custody/recovery proofs.

Chat/session memory is never required to recover governed product state.

## 21. Atlas v2 Value / Kill Test

Product success is not measured primarily by record/page/WorkDefinition counts.

At minimum Atlas should measure:
- Reference Reuse Rate;
- Discovery Compression;
- Gap Exposure Rate;
- Implementation Handoff Quality;
- Cross-Runtime Reusability.

Representative kill test:

A. normal discovery using SMEs/documents/general AI/consulting tools;
B. Atlas governed reference → validate delta → enrich unknowns → bind client → certify readiness.

Atlas must materially improve agreed value dimensions. Otherwise it may be technically impressive but has not proven its product purpose.

## 22. Preserved prior concepts

The following prior directions remain part of Atlas v2 and must be reconciled rather than discarded:
- Canvas as governed visual presentation/navigation;
- Daughter V2 renderer/generation direction;
- Universal Ask Atlas;
- Inspector;
- Trace;
- Compare;
- public-safe vs protected/admin projection;
- Operational Knowledge Contract direction;
- Canonical Information Resolution;
- runtime-neutral adapters;
- client/context binding;
- on-demand depth;
- knowledge reuse/promotion;
- source/provenance/version governance;
- queue/flow views where they are projections of downstream execution design rather than Atlas becoming the executor;
- future extensibility beyond logistics, without making non-logistics breadth a v2 delivery requirement.

## 23. Explicitly not preserved as Atlas v2 product identity

Do not restore Atlas as:
- autonomous solution architect;
- operational workflow/execution engine;
- Malkom replacement;
- governance portal as the primary product identity;
- HTML-centric truth store;
- LLM-direct canonical writer;
- runtime-specific warehouse/configuration as canonical Atlas semantics.

Playback/process simulation may remain a later visualization enhancement unless separately promoted into v2 acceptance.

## 24. Linear product coverage

Linear is the execution decomposition of this contract; Linear cannot silently redefine the product.

Primary v2 workstreams currently include:
- ATL-103 — Product End-State Contract & Coverage Reconciliation;
- ATL-104 — generated Product Surfaces;
- ATL-105 — Product UX/UI;
- ATL-106 — Backend/API/Upgrade Architecture;
- ATL-107 — Multi-Consumer Execution Packages;
- ATL-108 — Operations + Transformation Intelligence;
- ATL-109 — final Product Acceptance/Release/Go-Live Proof;
- ATL-110 — independent QA/freeze of this end-state contract;
- ATL-111 — Source Foundation & Universe;
- ATL-112 — Daughter Knowledge Generation;
- ATL-113 — Cross-Layer Contracts & Impact Graph;
- ATL-114 — Enterprise Discovery & Client Context Ingestion;
- ATL-115 — Interaction Layer;
- ATL-116 — Knowledge-State, Promotion & Compounding;
- ATL-117 — Value/Kill Test;
- ATL-40–48 — On-Demand Knowledge Depth;
- ATL-95 — Canonical Intelligence → WorkDefinition → Binding → Readiness → Runtime gap closure.

Existing certified/recovery/architecture tasks must be mapped into the coverage matrix rather than duplicated.

## 25. Product Coverage Matrix requirement

Maintain a machine-readable matrix linking:

`PRODUCT CAPABILITY → governing contract → current GitHub artifact → Linear issue(s) → current state → validation method → acceptance evidence → unresolved gap`.

The matrix must reveal:
- product implemented but absent from Linear;
- Linear work not contributing to the current product;
- product capability with no implementation issue;
- implementation with no executable validation;
- stale/superseded demo/recovery work;
- architecture or UI that contradicts the current product contract.

## 26. Product Coherence Gate

At major stage boundaries, review the aggregate product—not merely individual task PASS—across:
- product intent;
- source/domain knowledge;
- daughter/depth generation;
- operational/transformation/execution intelligence;
- UI/usability/interactions;
- architecture/contracts/data/API;
- upgradeability;
- security/public-protected boundaries;
- readiness/runtime projections;
- recoverability;
- economic value;
- end-to-end user journeys.

Locally correct tasks cannot close a stage if Atlas v2 as a product has drifted.

## 27. Final Atlas v2 Live Acceptance

The final gate must reproducibly demonstrate:
1. governed source registry/refresh and a semantic-delta path;
2. structured canonical Universe materialization;
3. inside-out + outside-in daughter generation to baseline task/A5 depth;
4. generated domain/daughter/process/task UI surfaces;
5. on-demand knowledge-depth trigger and verified/persisted/reused enrichment;
6. explicit knowledge-state/gap handling;
7. canonical Work Decomposition + WorkDefinition;
8. enterprise/client discovery ingestion → validated binding;
9. unresolved binding/knowledge blocking readiness, followed by authorized resolution and deterministic readiness change;
10. Malkom + agentic-AI + RPA/BPM/workflow packages from the same canonical truth;
11. projection loss/capability disposition;
12. Operations → Transformation → approved target → Execution Intelligence on one governed scope;
13. solution-pattern classification;
14. Universal Ask Atlas + Canvas + Inspector + Operational Trace + Dependency Trace + Compare;
15. admin/protected and public-safe boundary;
16. provenance from source → semantics → WD → binding → readiness → projection;
17. cross-layer selective change propagation;
18. reusable-knowledge promotion/compounding proof;
19. upgrade/regression/security/recovery proof;
20. agreed Execution Readiness Leverage / kill test;
21. Owner-authorized deployment/promotion followed by live-runtime verification.

All implementation issues being Done is insufficient by itself.

## 28. Frozen governance

This document is frozen as of 2026-09-26T17:45:00Z following complete Linear issue inventory reconciliation (52 issues mapped to 15 product capabilities), GitHub artifact inventory, independent QA verification (ATL-118 PASS, ATL-119 PASS), and gap analysis documented in governance/ATL_103_RECONCILIATION_EVIDENCE.md.

Freeze status: READY FOR ATL-110 INDEPENDENT QA VERIFICATION.

Material changes after this freeze require:
- successor contract/version with full impact analysis;
- re-reconciliation against Linear/GitHub;
- re-submission to independent QA (ATL-110);
- binding Owner re-freeze authorization.

Change control for frozen state is enforced through GitHub branch protection and Linear issue ceremony.
