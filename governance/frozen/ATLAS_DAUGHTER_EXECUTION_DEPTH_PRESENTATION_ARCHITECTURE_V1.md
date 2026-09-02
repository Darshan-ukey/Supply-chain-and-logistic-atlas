# ATLAS Daughter Execution-Depth Presentation Architecture V1

**Status:** FROZEN  
**Freeze date:** 2026-09-02  
**Architecture ID:** `ATLAS-DAUGHTER-EXECUTION-DEPTH-PRESENTATION-ARCHITECTURE-V1`  
**Implementation status:** Architecture frozen; phased implementation not yet started beyond P0 baseline work.

## Canonical presentation sequence

**Overview → Operational Knowledge → Execution Readiness → [Protected] Work Decomposition → [Protected] WorkDefinition**

## Frozen principles

1. **Overview** remains the concise A5 task orientation surface.
2. **Operational Knowledge** is a first-class, human-readable daughter-page depth.
3. Visible Operational Knowledge is a governed **presentation projection**, not a wholesale browser copy of the canonical operational record.
4. **Execution Readiness** is visible and explains whether the A5 knowledge is sufficiently complete to proceed downstream.
5. Full **Recursive Work Decomposition** is protected execution IP. Unauthorized views may expose only an approved summary.
6. Full **Canonical WorkDefinition** is protected execution IP. Unauthorized views may expose only availability/readiness/status summaries.
7. Authorization is enforced at the **data/API projection boundary**. Protected information must not be delivered to an unauthorized browser and merely hidden with UI/CSS/JavaScript.
8. Daughter semantic versions do **not** change for presentation-only renderer improvements.
9. Daughter, Canvas and Ask Atlas consume the same governed canonical records through authorization-aware projections.
10. Renderer, Canvas, Ask Atlas and downstream runtimes must never become a second source of operational truth.
11. Work Decomposition and WorkDefinition remain derived governed assets with lineage to the exact daughter A5 knowledge that produced them.
12. Client Binding remains separate from canonical operational truth and remains separately permissioned.

## Layer intent

### 1. Overview
Answers: **What is this work?**

Typical content: task purpose, A3/A4 lineage, trigger, pre/post state, principal outcome, major actors/systems/objects, applicability and high-level evidence status.

### 2. Operational Knowledge
Answers: **How does this operation actually work?**

Human-readable projection may include: required information, `requiredWhen`, why/value origin, validation criteria, decision gates, business rules, controls, actions, branches/outcomes, exceptions/recovery/escalation, timing, actors/authority, systems/exchanges, objects/documents, evidence, applicability, provenance class and unresolved/client-dependent categories.

### 3. Execution Readiness
Answers: **Can this knowledge safely become executable work?**

Typical status dimensions: decomposition required/status, executor readiness, independent executor proof, information/decision/branch/evidence coverage, unresolved operational knowledge, unresolved client binding, HITL dependency, deterministic/system-action dependency, exception/recovery completeness and WorkDefinition status.

### 4. Protected Work Decomposition
Answers: **What exact executable units were derived?**

Full recursive work tree/graph is authorized-only. Public/normal views may show approved aggregate counts or execution-profile summaries.

### 5. Protected WorkDefinition
Answers: **What is the canonical machine-consumable execution contract?**

Full inputs, schemas, validations, rules, controls, transitions, clocks, retries, escalation, evidence, systems, authority and client-binding hooks are authorized-only.

## Projection model

```text
Canonical A5
│
├── Overview Projection
├── Operational Knowledge Presentation Projection
├── Execution Readiness Projection
├── Work Decomposition Summary
│
└── AUTHORIZATION BOUNDARY
    ├── Full Work Decomposition
    └── Full Canonical WorkDefinition
```

## Non-regression rule

This freeze is a **presentation/access architecture freeze**, not permission to mutate canonical daughter semantics. Existing frozen/candidate knowledge assets remain read-only unless a separate governed semantic correction is explicitly approved.

## Planned implementation sequence

P0 Freeze & inventory → P1 Presentation/access contracts → P2 Backend projection boundary → P3 Universal Daughter Renderer V2 → P4 Canvas V2.0.1 integration → P5 Ask Atlas/Trace/governance → P6 Operational Layer compilation and Atlas V2 integration.
