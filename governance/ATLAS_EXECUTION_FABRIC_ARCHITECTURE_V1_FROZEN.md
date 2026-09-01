# Atlas Execution Fabric Architecture V1 — FROZEN

**Status:** FROZEN  
**Frozen:** 2026-09-01  
**Parent product:** Supply Chain Atlas / Atlas Platform  
**Build line:** V2.1 execution-fabric line  

## 1. Governing decision

Atlas is the product and governance boundary.

The complete execution stack is part of Atlas, including:

- governed operational knowledge;
- Work Decomposition;
- canonical WorkDefinition;
- Atlas Warehouse;
- runtime adapters;
- runtime-specific domain/configuration warehouses;
- compilers/verifiers;
- runtime connectors;
- flow/BPMN generators;
- client bindings and permitted client extensions;
- runtime evidence/outcome reconciliation.

These capabilities are **access-controlled product surfaces**, not separate ownership domains.

A user with ordinary Atlas access may see only safe execution summaries. A user granted a runtime capability such as Malkom may inspect, configure, compile, materialize, connect to and, where permitted, operate that runtime from Atlas.

## 2. Canonical dependency chain

```text
AUTHORITATIVE SOURCES
        ↓
SOURCE FOUNDATION
        ↓
UNIVERSE
        ↓
VERIFIED DAUGHTER MODULES
A3 / A4 / A5
        ↓
WORK DECOMPOSITION V1.1
executor-neutral executable-work topology
        ↓
CANONICAL WORKDEFINITION V1
        ↓
ATLAS WAREHOUSE
canonical governed execution intelligence
        ↓
ATLAS EXECUTION FABRIC
        ├─ Runtime Adapter Standard
        ├─ Capability negotiation
        ├─ Runtime-specific projection stores
        ├─ Client bindings / extensions
        ├─ Compiler / verifier
        ├─ Flow Generator / BPMN
        ├─ Runtime connector
        └─ Evidence / outcome reconciliation
              ↓
        AUTHORIZED RUNTIMES
        Malkom / Workflow / RPA / Agent / API / future tools
```

Everything through **Atlas Warehouse** is canonical and executor-neutral.
Everything below it may be runtime-specific.

## 3. Non-negotiable semantic ownership

### Atlas owns

- canonical task identity and lineage;
- source/provenance linkage;
- applicability and context;
- state/event/decision/rule/control/action/evidence/outcome semantics;
- work decomposition;
- canonical transitions, waits, retries, escalations and recovery semantics;
- actors, systems, objects/documents, inputs/outputs;
- client-binding points;
- canonical execution-flow semantics;
- canonical versioning and impact lineage.

### A runtime adapter owns

- translation into its runtime architecture;
- runtime capability declarations;
- runtime-specific validation;
- compilation/materialization logic;
- runtime-specific flow projection;
- runtime connection/deployment operations;
- runtime-specific evidence mapping.

A runtime must never become the canonical source of operational truth.

## 4. Work Decomposition V1.1

Work Decomposition is the bridge between domain knowledge and executable architecture.

One A5 task does **not** automatically equal one queue, bot, agent, workflow task or API call.

The standard work-unit types are:

- `MANAGED_WORK`
- `DETERMINISTIC_VALIDATION`
- `DECISION`
- `SYSTEM_ACTION`
- `HUMAN_REVIEW`
- `DOCUMENT_INTERPRETATION`
- `WAIT_EVENT`
- `EXCEPTION_HANDLING`
- `ESCALATION`
- `RETRY`
- `RECOVERY`
- `EVIDENCE_PRODUCTION`

Each decomposition element must preserve:

- parent A5 lineage;
- purpose;
- entry/trigger;
- inputs;
- decision/rule/control where applicable;
- action/system interaction;
- human boundary;
- possible outcomes;
- next semantic transition;
- exception/escalation/recovery behavior;
- evidence requirement;
- provenance class and confidence.

Runtime terms such as **Queue, Subqueue, Work Type, Bot, Agent Node, BPMN Service Task** are prohibited from the canonical decomposition contract.

## 5. Canonical WorkDefinition V1

A WorkDefinition describes **what must be true for the work to execute correctly**, not how a particular technology implements it.

Required semantic groups:

```text
identity + lineage + version
applicability
work object / work units
entry event / prerequisites
inputs / canonical fields / objects
states before and after
decisions / rules / validations / controls
actions / system interactions
actors / authority / HITL boundaries
outcomes / transitions
waits / timers / clocks
retry / escalation / exception / recovery
evidence / audit requirements
execution characteristics
client-binding points
runtime projection references
```

No canonical meaning may be removed because a current runtime cannot represent it.

## 6. Atlas Warehouse

Atlas Warehouse is the governed reusable store for approved WorkDefinitions and dependent execution-definition assets.

It stores or references:

- WorkDefinitions;
- Work Decompositions;
- lineage to Universe/module/A5/source foundation;
- versions/hashes/status;
- dependency/impact links;
- client-binding templates;
- runtime-projection references;
- runtime capability assessments;
- governance/audit metadata.

Runtime-specific stores must reference Atlas Warehouse IDs/versions rather than becoming independent copies of canonical truth.

## 7. Atlas Runtime Adapter Standard

The standard is deliberately small. It does **not** impose a common internal runtime architecture.

Every adapter implementation must be able to:

1. identify the runtime/tool/version;
2. declare supported capabilities;
3. assess a canonical WorkDefinition;
4. declare required client bindings;
5. project/translate supported semantics into native runtime structures;
6. verify the projection;
7. return a disposition for every canonical capability that affects execution;
8. expose semantic loss or runtime gaps explicitly;
9. where supported, compile/materialize/deploy/connect;
10. reconcile runtime outcome/evidence back to the canonical WorkDefinition.

Optional operations remain optional. An exporter, rules engine, workflow runtime, RPA platform and Malkom do not need to expose identical lifecycle functions.

### Required disposition vocabulary

- `SUPPORTED`
- `MAPPED`
- `TRANSFORMED`
- `CLIENT_BINDING_REQUIRED`
- `PARTIAL`
- `UNSUPPORTED_RUNTIME`
- `DEFERRED_RUNTIME_ENHANCEMENT`

A runtime gap must never be solved by deleting or flattening the canonical meaning silently.

## 8. Runtime architectures may be completely different

Examples are intentionally non-isomorphic.

### Malkom

```text
Atlas WorkDefinition
  ↓
Malkom Adapter
  ↓
Malkom projection store / Domain Warehouse
  ↓
Queue / Subqueue / Work Type / Fields / Outcomes
  ↓
Rules / Validation / Workflow / Allocation / Integration /
Exception / Agentic engines
  ↓
Client binding / Command / materialization / runtime
```

### Workflow/BPM

```text
Atlas WorkDefinition
  ↓
Workflow Adapter
  ↓
Process Definition / User Task / Service Task / Gateway /
Event / Timer / Message / Boundary Event / Compensation
```

### RPA

```text
Atlas WorkDefinition
  ↓
RPA Adapter
  ↓
Automation unit / application / selector / screen/API action /
validation / credential / retry / human handoff
```

### Agent runtime

```text
Atlas WorkDefinition
  ↓
Agent Adapter
  ↓
Agent role / objective / tools / permissions / planning policy /
guardrails / approval boundary / memory policy / termination / evidence
```

The commonality is **semantic input/output**, not the runtime structure.

## 9. Flow Generator architecture

Flow generation is a first-class Atlas capability.

There are two levels.

### 9.1 Canonical Execution Flow Generator

Generated from Work Decomposition + WorkDefinition only.

It visualizes:

- entry/start;
- executable work units;
- states/events;
- decisions/gateways;
- rules/controls;
- actions;
- outcomes;
- waits/timers;
- loops/retries;
- exceptions/escalations/recovery;
- HITL boundaries;
- evidence and state completion.

It must exist even when no runtime adapter exists.

### 9.2 Runtime Projection Flow Generator

Generated only from the runtime projection actually produced by an adapter.

For Malkom, the proven model is:

```text
Subqueue → Outcome → Route/Status/Next Step
```

Requirements inherited from the Hasmukh/Malkom design:

- graph is generated from compiled projection data, never separately authored;
- every outcome branch retains outcome, route, status and next step;
- `STAY_IN_QUEUE` is a return edge;
- finite paths use loop guards (`maxVisitsPerNode`, `maxDepth`, `maxPaths`);
- runtime capability gaps remain visible;
- canonical cross-runtime/cross-queue escalation remains visible even if the current runtime cannot materialize it;
- BPMN view and simplified Flow view use the same graph;
- BPMN 2.0 XML and image/SVG exports are generated from that same graph;
- path selection/playback is a representation of the same generated graph.

### 9.3 Canonical vs projection vs actual

Authorized users should eventually be able to compare:

```text
ATLAS CANONICAL
      ↓
RUNTIME PROJECTION
      ↓
RUNTIME MATERIALIZED / ACTUAL
```

Classifications include:

- MATCHES
- LEGITIMATE_CLIENT_VARIANT
- CLIENT_EXTENSION
- RUNTIME_LIMITATION
- UNEXPLAINED_DEVIATION
- MISSING_RUNTIME_ELEMENT

## 10. Malkom ownership inside Atlas

The existing Malkom 3.0 engine suite and Domain Warehouse implementation are now treated as the **first rich runtime family inside Atlas Execution Fabric**.

They remain modular code packages so Malkom can evolve without destabilizing Atlas Core.

Atlas product ownership does not require a monolithic codebase.

The rule is:

> **Unified product and governance; modular runtime implementation.**

## 11. Access-control architecture

Access is capability-based.

Indicative capabilities:

- `ATLAS_EXPLORE`
- `ATLAS_A5_INSPECT`
- `EXECUTION_SUMMARY_VIEW`
- `WORKDEFINITION_VIEW`
- `CANONICAL_FLOW_VIEW`
- `RUNTIME_MALKOM_VIEW`
- `RUNTIME_MALKOM_CONFIGURE`
- `RUNTIME_MALKOM_COMPILE`
- `RUNTIME_MALKOM_MATERIALIZE`
- `RUNTIME_MALKOM_OPERATE`
- `ATLAS_CANONICAL_GOVERN`

Public/sanitized Atlas must not expose detailed WorkDefinitions, exact transition mechanics, runtime projections, client bindings or materialization details.

Authorization must be enforced server-side; hiding controls in HTML/CSS is not a security boundary.

## 12. Dependency / change governance

Every downstream execution asset must retain explicit lineage to the source module/A5/version/hash.

When a daughter changes:

1. calculate affected downstream assets;
2. selectively regenerate affected Work Decomposition/WorkDefinition/runtime projections;
3. run full module regression;
4. mark stale runtime projections/materializations until revalidated;
5. never mutate a published canonical WorkDefinition silently.

## 13. Build boundaries

### Canonical protected assets

No execution-fabric build may modify source truth merely to make a runtime projection easier.

### Canvas

The spatial Canvas remains the operational navigation surface.
Detailed Work Decomposition, WorkDefinition and runtime flow are expandable/Inspector/Admin experiences and must not permanently clutter the Canvas.

### LLM

The LLM may interpret intent and explain execution semantics. It does not invent canonical work units, transitions, runtime capabilities or flow edges.

## 14. Acceptance criteria for this frozen architecture

A release cannot claim conformance unless:

- canonical Atlas assets remain byte-identical unless separately approved;
- Work Decomposition contains no runtime-specific mandatory concepts;
- WorkDefinition retains all governed A5 execution semantics;
- each runtime adapter reports capability gaps explicitly;
- Malkom remains one adapter/runtime family, not the canonical model;
- flow diagrams are generated from canonical/projection data, not maintained separately;
- STAY/retry/loop semantics cannot create infinite path enumeration;
- BPMN/Flow exports originate from the same graph model;
- runtime-specific data is capability-gated;
- client binding/extension does not mutate reference WorkDefinition;
- every runtime projection identifies the exact Atlas WorkDefinition/version it derives from;
- runtime evidence can be reconciled to the originating WorkDefinition or is explicitly marked unsupported.

## 15. Frozen rule

> **One canonical Atlas execution language. Many independent runtime architectures. Atlas owns the adapters and authorized runtime surfaces, but no runtime is permitted to redefine the canonical work. Flow is generated from governed data at both the canonical and runtime-projection levels.**

Any future proposal that violates this rule requires an explicit architecture version change rather than an implementation shortcut.
