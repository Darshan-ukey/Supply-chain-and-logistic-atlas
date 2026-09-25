# Daughter ↔ WorkDefinition Knowledge Boundary — V0.1 CANDIDATE

**Status:** OWNER-ALIGNED CONCEPTUAL FREEZE — PROVISIONAL UNTIL DAUGHTER GENERATOR EMPIRICAL VALIDATION
**Date:** 25 September 2026
**Owner/Governor:** Darshan Ukey
**Related:** ATL-112; ATL-40–48; Atlas v2 Product End-State Contract V1 Candidate

## Decision

Atlas separates baseline Daughter knowledge from on-demand execution depth.

### Daughter Generator boundary

The Daughter Generator creates the domain-specific operational landscape.

`Universe → Daughter Generator → governed Daughter knowledge model → generated Daughter/process/task surfaces`

The Daughter must contain enough reusable knowledge to answer:

> What exists in this domain, how does it operate, and where are the meaningful areas of work?

It includes the meaningful process/task hierarchy approximately through A5/task depth plus the major objects/document types, actors, systems, events, relationships, dependencies, controls, exceptions and other semantics required to understand and navigate the domain.

It does **not** exhaustively research the execution mechanics beneath every task.

Example: Road LTL Documentation and BOL/eBOL as meaningful document types and their operational role should be discoverable in the Daughter. Exhaustive eBOL validation rules, field-level requirements, decision logic, exception paths, evidence requirements, state transitions and system actions are not mandatory baseline Daughter depth.

### WorkDefinition / on-demand-depth boundary

Execution depth begins when a specific part of the Daughter landscape must become implementation-ready.

`Daughter → task → bounded Execution Scope → targeted Operational Knowledge research → recursive Work Decomposition until executable → Canonical WorkDefinition`

The governing question is:

> Exactly what must be known to perform, automate, configure or implement this scoped operation correctly?

A5/task identity is an entry point, not necessarily the atomic research scope. Heterogeneous tasks must first resolve a bounded Execution Scope, such as:

`Road LTL → Documentation → BOL/eBOL → Validate → WorkDefinition-ready depth`

Research must be bounded by the requested execution intent and the semantics required by the Canonical WorkDefinition/readiness contracts. It must not continue as unbounded research across an entire task family merely because related knowledge exists.

## Research stopping principle

On-demand depth researches until the requested bounded execution scope can either:

1. satisfy the governed Operational Knowledge / WorkDefinition / readiness requirements; or
2. fail closed with explicit unresolved knowledge, evidence, SME, client-binding or other blockers.

The objective is not exhaustive knowledge of the parent task.

## Reverse feedback / knowledge destination rule

Depth research may expose weaknesses in upstream knowledge. New findings must be classified rather than silently buried inside a WorkDefinition:

- reusable domain-specific truth missing from the Daughter → **Daughter Enrichment Candidate**;
- generic/cross-domain reusable truth → **Universe / reusable-knowledge candidate**;
- execution-specific truth for the bounded scope → **Operational Knowledge / WorkDefinition substrate**;
- enterprise-specific truth → **Client Binding**.

No depth job automatically mutates a frozen Universe or Daughter. Promotion follows normal governance/versioning.

WorkDefinition must not become a hidden second source of richer domain truth.

## Conceptual architecture

`Universe`
→ `Daughter Generator` — understand the domain landscape
→ `Daughter`
→ `Execution Scope Resolver` — bound the implementation intent
→ `On-Demand Depth / WD Generator` — acquire only required execution depth
→ `Operational Knowledge`
→ `Recursive Work Decomposition until executable`
→ `Canonical WorkDefinition`
→ `Client Binding`
→ `Execution Readiness`
→ `Runtime-Neutral Projection`
→ external consumer/execution.

## Change-control note

This is a V0.1 conceptual boundary, not an immutable depth taxonomy. Actual Daughter Generator development and empirical testing may demonstrate that specific knowledge classes belong on the other side of the boundary. Any material change requires an explicit successor/revision and impact analysis; it must not occur through silent scope drift.
