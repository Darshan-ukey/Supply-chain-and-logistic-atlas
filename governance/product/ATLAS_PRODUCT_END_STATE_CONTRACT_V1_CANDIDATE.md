# Atlas Product End-State Contract V1 — CANDIDATE

**Status:** OWNER-DIRECTED CANDIDATE — NOT YET FROZEN  
**Owner/Governor:** Darshan Ukey  
**Linear parent:** ATL-103  
**Milestone:** Atlas Live v1.0 — End-State Product

## 1. Purpose

Define the complete observable end-state for **Atlas Live v1.0** so Linear execution, GitHub implementation, UI/product work, backend/data work and runtime projections all converge on one product outcome.

Completion of backend architecture tasks, schema tasks, QA tasks or adapter tasks alone does **not** mean Atlas is live.

Atlas is live only when a fresh reviewer can reproduce the end-to-end product journey and verify the acceptance conditions in this contract.

## 2. Product identity

This contract inherits the frozen Product Constitution.

Atlas is a governed operational intelligence platform with three products on one governed semantic foundation:

1. Operations Intelligence — understand how work actually operates.
2. Transformation Intelligence — decide what should change and why.
3. Execution Intelligence — define approved work in implementation-ready form.

Atlas itself does **not** own runtime business execution.

Downstream systems/people execute. Atlas owns governed understanding, transformation intelligence and implementation-ready specification/projection.

## 3. Atlas Live v1.0 — observable product outcome

Atlas Live v1.0 MUST demonstrably support all of the following.

### 3.1 Generated product surfaces

Atlas can generate and render governed:
- domain pages;
- daughter/sub-domain pages;
- process pages;
- task pages;
- deeper knowledge views;
- execution/readiness/projection views;

from canonical governed data.

Pages must not be hand-authored substitutes for canonical generation.

Presentation/UI state cannot become competing canonical business truth.

### 3.2 On-demand knowledge depth

Atlas can:
- detect/accept a need for additional depth;
- determine target depth;
- acquire/generate candidate knowledge;
- validate/source/provenance-control that knowledge;
- fail closed where knowledge is unresolved;
- persist/promote reusable knowledge;
- preserve client-specific knowledge in the correct enterprise/binding layer;
- reuse promoted knowledge in future work.

### 3.3 Canonical execution semantics

Atlas can generate governed Work Decomposition and Canonical WorkDefinitions containing the semantics needed to implement work, including where material:
- applicability and lineage;
- objects, fields and documents;
- states/events/transitions;
- decisions and business rules;
- validations and controls;
- actors, roles and authorities;
- actions and outcomes;
- systems/interfaces;
- clocks, waits and time constraints;
- exceptions, retries, escalations and recovery;
- evidence requirements;
- execution characteristics;
- enterprise/client binding requirements.

### 3.4 Enterprise binding and readiness

Atlas can:
- declare enterprise/client binding requirements;
- distinguish reusable domain gaps from client-specific bindings;
- capture/validate supplied enterprise values;
- preserve authority/source/system-of-record/mapping constraints;
- deterministically compute DOMAIN_EXECUTION_READY;
- deterministically compute ENTERPRISE_EXECUTION_READY;
- deterministically compute RUNTIME_IMPLEMENTATION_READY;
- expose blocker chains and fail closed when mandatory knowledge/binding/runtime capability is unresolved.

### 3.5 Multi-consumer execution packages

From the **same canonical governed WorkDefinition**, Atlas can generate implementation-ready packages/projections for materially different consumers, including at minimum:
- Malkom;
- an agentic-AI/task-runtime consumer;
- an RPA/BPM/workflow-style consumer.

Additional consumers may include ERP/TMS/WMS, ServiceNow, digital-twin/BPMN or custom applications.

Each projection must:
- preserve canonical meaning;
- identify SUPPORTED / MAPPED / TRANSFORMED / CLIENT_BINDING_REQUIRED / PARTIAL / UNSUPPORTED_RUNTIME / DEFERRED_RUNTIME_ENHANCEMENT semantics;
- fail closed for mandatory unsupported semantics;
- avoid moving runtime-specific structures into canonical Atlas truth.

Atlas generates the implementation-ready package/specification/projection. The downstream platform executes.

### 3.6 Governance/business-logic usability

A downstream implementer should not need to rediscover the business process.

For a governed scope, Atlas should expose enough information to configure/build execution, including:
- rules;
- decisions;
- controls;
- validations;
- exceptions;
- escalation;
- roles/authority;
- evidence;
- object/document/field semantics;
- client-specific binding needs;
- unresolved gaps;
- projection limitations.

### 3.7 Product UX / admin-public experience

The product must offer a coherent journey across:
- Atlas/Canvas entry;
- domain;
- daughter/process/task navigation;
- knowledge depth;
- inspectors;
- WorkDefinition;
- binding;
- readiness;
- projection;
- provenance/source;
- unresolved gaps;
- Ask Atlas over governed knowledge.

Admin-authorized users may inspect protected execution intelligence, detailed sources, WorkDefinitions and machine-readable projections according to permissions.

Public experience must be a deliberately sanitized projection that prevents exposure of protected execution IP, detailed machine-readable contracts and sensitive source details.

UI claims must never outrun governed backend state.

### 3.8 Operations Intelligence

Using sufficiently governed operational evidence, Atlas can explain where material:
- process/operating variants;
- friction/rework/exception drivers;
- cycle/performance patterns;
- risk/control gaps;
- standardisation/complexity opportunities;
- limitations of the evidence population/window.

Observed behavior remains evidence, not automatic canonical truth.

### 3.9 Transformation Intelligence

Using the same governed semantic foundation, Atlas can:
- identify and prioritise transformation opportunities;
- distinguish root cause from symptom;
- compare future-state options;
- classify solution patterns;
- record assumptions, dependencies and expected impacts;
- preserve proposal/approval state separately from canonical current/reference truth.

### 3.10 Backend, API and upgradeability

Atlas Live v1.0 must have a production-manageable technical foundation covering:
- persistent object boundaries;
- API/query contracts;
- frontend/backend contract versioning;
- schema evolution;
- migrations;
- compatibility rules;
- version negotiation where applicable;
- indexing/search/retrieval;
- permissions;
- provenance/audit retrieval;
- release manifests;
- dependency identity;
- upgrade path;
- rollback/recovery.

Current technology choices such as Supabase/Postgres and Vercel do not become permanent semantic truth.

### 3.11 Provenance, custody and recovery

Decision-significant/canonical outputs must retain sufficient identity to recover:
source/evidence
→ canonical semantic object
→ Work Decomposition
→ WorkDefinition
→ Client Binding
→ readiness proof
→ runtime projection.

Applicable frozen assets retain exact versions/hashes, QA disposition, custody location and restore/rebuild proof.

Chat/session memory is never required to recover governed product state.

## 4. Product acceptance journey

The final Atlas Live v1.0 acceptance proof must demonstrate, on governed real data:

1. Open/navigate a generated domain/daughter/process/task product surface.
2. Trigger a depth need for a scope whose baseline is insufficient.
3. Acquire/generate/verify depth and persist/reuse it correctly.
4. Generate Work Decomposition and Canonical WorkDefinition.
5. Inspect business rules, decisions, controls, exceptions and binding requirements.
6. Demonstrate unresolved knowledge/binding preventing readiness.
7. Resolve an authorized binding and show deterministic readiness change.
8. Generate Malkom, agentic-AI and RPA/BPM/workflow execution packages from the same canonical truth.
9. Show projection loss/capability disposition explicitly.
10. Traverse the admin experience and verify public-safe sanitisation.
11. Demonstrate an Operations Intelligence → Transformation Intelligence → Execution Intelligence journey on the same governed semantic foundation.
12. Trace provenance end-to-end.
13. Demonstrate required backup/restore/recovery for decision-significant/frozen assets.
14. Verify upgrade/regression/security/public-protected boundaries.
15. Release/deploy only after explicit Owner go-live authorization, then verify the live runtime.

## 5. Linear execution coverage

Linear is the execution decomposition of this product contract, not the definition of the product itself.

Primary product-level workstreams:
- ATL-103 — Product End-State Contract & Coverage Reconciliation
- ATL-104 — Product Surface Generation
- ATL-105 — Product UX/UI
- ATL-106 — Backend, API & Upgrade Architecture
- ATL-107 — Multi-Consumer Execution Package
- ATL-108 — Operations & Transformation Intelligence
- ATL-109 — End-to-End Product Acceptance / Go-Live Proof
- ATL-40 workstream — On-Demand Knowledge Depth
- ATL-95 — Canonical intelligence → WorkDefinition → Binding → Readiness → Runtime gap closure

All supporting implementation/QA tasks must map to one or more live-product capabilities and must define how their completion contributes to observable acceptance.

## 6. Coverage reconciliation rule

Before Atlas Live v1.0 implementation is considered directionally complete, maintain a machine-readable coverage matrix:

PRODUCT CAPABILITY
→ governing contract
→ GitHub implementation/artifact
→ Linear issue(s)
→ current status
→ validation method
→ acceptance evidence
→ unresolved gap.

The matrix must reveal:
- implemented but untracked product capabilities;
- tracked tasks that do not contribute to the current product;
- product capabilities with no implementation task;
- product capabilities with implementation but no validation;
- stale/superseded demo/recovery tasks.

## 7. Product coherence gate

Individual issue PASS does not imply product PASS.

At major stage boundaries, reconcile the aggregate build against this contract across:
- product intent;
- usability/UI;
- architecture;
- contracts;
- backend/data;
- API;
- upgradeability;
- security;
- admin/public boundaries;
- recoverability;
- three-product model;
- end-to-end user journeys.

A locally correct implementation cannot close the stage if the aggregate product drifts from the end-state contract.

## 8. Change control

This file is currently a **candidate** created from Owner direction captured in ATL-103.

Before freeze:
- reconcile against existing Product Constitution and certified artifacts;
- independently challenge for missing product dimensions or contradictions;
- create the product coverage matrix;
- record any supersession explicitly.

Once Owner-frozen, material product-end-state changes require an explicit successor version and impact analysis.
