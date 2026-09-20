# Atlas Research-Ready & Depth-Orchestration Method v0.1

Status: CURRENT-STATE WORKING METHOD — FROZEN AS REFERENCE, NOT FINAL ARCHITECTURE  
Date: 2026-09-20  
Workstream: ATL-40  
Basis: empirical post-analysis of the LTL-03 research mechanism

## 1. Purpose

This document freezes the current best-known mechanism for scaling Atlas domain depth without requiring exhaustive execution-grade research for every task/domain upfront.

This is a **current-state reference method**. It is deliberately versioned and may evolve as Atlas is validated on additional LTL and non-LTL tasks. Future evidence may refine, split or replace parts of this method through governed revision.

## 2. Core operating principle

Atlas should pre-build enough breadth and operational structure to make a task **Research-Ready**, then perform exhaustive authoritative depth research on demand when a user requests deeper understanding or execution readiness.

The research itself remains exhaustive. Scalability comes from **deferring depth**, not reducing research rigor.

Canonical current-state flow:

**Domain / E2E Foundation  
→ Task / Process Skeleton  
→ Research-Ready Gate  
→ Depth Request  
→ Depth Orchestrator  
→ Exhaustive Authoritative Research  
→ Governed Knowledge Materialization  
→ Recursive P6.1 Work Decomposition  
→ Domain Execution Contract  
→ Daughter-Page / Semantic-Zoom Materialization  
→ Tool Projection  
→ External Executor**

Atlas remains the execution-readiness/specification layer. It does not execute.

## 3. Empirical finding from LTL-03

LTL-03 showed that the mechanism is not a simple linear sequence where Work Decomposition is fully completed before deep research.

The actual pattern was:

**Canonical task / E2E context  
→ authoritative-source discovery  
→ information/business-object discovery  
→ relationships and lifecycle semantics  
→ deterministic rule derivation  
→ recursive P6.1 Work Decomposition / WorkDefinition expansion  
→ Domain Execution Contract  
→ Client Binding / Knowledge Gap separation  
→ runtime projections**

Therefore detailed Work Decomposition and detailed Operational Knowledge are both partly **products of deep research**.

The Research-Ready boundary should therefore not be assumed to be exactly after full Work Decomposition or exactly after full Operational Knowledge.

## 4. Pre-built foundation

Atlas should establish enough domain/process breadth to orient research reliably.

Candidate pre-built foundation includes:

- domain and E2E process placement;
- process/subprocess/task inventory;
- canonical task identity;
- task purpose and expected outcome;
- coarse trigger / input / output context;
- coarse work-intent or decomposition skeleton;
- principal known business/information objects at orientation level;
- upstream/downstream dependency context;
- known actors/roles where available;
- likely authoritative source classes / issuer families;
- explicit known unknowns and research gaps;
- reusable domain-neutral ontology;
- reusable semantic primitives/rule families already proven elsewhere.

This foundation is intended to make the task **researchable**, not execution-ready.

## 5. Research-Ready Gate

A task is Research-Ready when Atlas has enough governed operational context to launch a bounded, systematic and completeness-testable exhaustive research process without requiring a human to reconstruct the domain first.

Current candidate gate dimensions:

1. Domain/E2E placement known.
2. Task/process purpose known.
3. Expected outcome known.
4. Coarse trigger/input/output understood.
5. Coarse work/decomposition intent exists.
6. Major operational objects/document families are identifiable.
7. Upstream/downstream context is visible.
8. Applicable source-authority classes can be hypothesized/governed.
9. Known unknowns are explicit.
10. Research scope can be bounded and completeness can be tested.

These are current-state candidate dimensions, not yet final universal pass/fail rules. ATL-40 must refine them empirically.

## 6. Depth Orchestrator

The Depth Orchestrator is the proposed mechanism that converts a user request for more depth into a governed research plan.

Input:
- current page/task/process;
- current knowledge maturity;
- requested depth;
- existing reusable knowledge;
- current source/provenance state;
- client context where applicable.

The orchestrator should:

1. determine current maturity;
2. determine target maturity;
3. identify already-governed reusable knowledge;
4. identify missing knowledge classes;
5. construct the exhaustive research plan;
6. identify source-authority families;
7. launch bounded authoritative research;
8. test evidence sufficiency/completeness;
9. materialize reusable knowledge;
10. isolate Client Binding and unresolved gaps;
11. trigger the correct downstream knowledge/page generation.

## 7. Knowledge maturity vs navigation hierarchy

Atlas must treat these as separate dimensions.

### Navigation hierarchy

**Domain → Process → Subprocess → Task → Work Unit**

### Knowledge maturity

Current candidate maturity states:

**Mapped → Structured → Research-Ready → Deep-Researched → Execution-Ready**

A daughter page can exist while only being Research-Ready. Page existence must not imply execution depth.

## 8. Depth Manifest

Each process/task/page should carry a machine-readable Depth Manifest recording at minimum:

- domain/E2E placement status;
- task definition status;
- work-skeleton status;
- principal-object coverage status;
- source-map status;
- deep-research status;
- semantic/rule coverage status;
- Domain Execution Contract status;
- Client Binding status;
- tool-projection status;
- unresolved knowledge gaps;
- source/provenance version;
- last validation/research timestamp;
- current maturity state;
- next admissible depth transition.

The Depth Manifest allows Atlas to calculate the delta between current and requested depth.

## 9. Daughter-page / semantic-zoom materialization

The knowledge graph and UI page hierarchy are not the same thing.

LTL-03 produced many evidence nodes, facts, primitives, generated rule instances, exceptions and client-binding requirements. Atlas must not create a page for every graph node.

Create/materialize daughter views only for user-meaningful units of operational understanding, such as:

- process;
- subprocess;
- task;
- major Work Decomposition branch;
- business/information object;
- lifecycle/state view;
- decision/control family;
- exception family;
- execution contract;
- client-binding view.

Lower-level facts/rules/evidence remain available through inspector, relationship graph, trace and evidence panels.

Current product principle:

> **Knowledge graph ≠ page hierarchy.**

## 10. User depth journey

A user should be able to navigate to a domain/process/task and see:

- what Atlas currently knows;
- current maturity/depth;
- major dependencies;
- known gaps;
- provenance/authority status;
- whether deeper research is available.

A user request such as **Deep Dive** or **Make Execution-Ready** should invoke the Depth Orchestrator rather than require a developer-built page or a new Atlas release.

## 11. Progressive materialization

When exhaustive research completes:

- reusable domain knowledge is promoted to the Domain Warehouse at the correct scope;
- task-specific knowledge remains task-scoped;
- cross-task/E2E dependencies are promoted to shared process scope;
- client-specific requirements remain Client Binding;
- source/provenance/version state is retained;
- daughter views/pages are materialized only where user-meaningful;
- the Depth Manifest is advanced.

Future tasks should reuse previously governed knowledge where semantically applicable and current.

## 12. Domain Warehouse role

The Domain Warehouse is not required to be a complete encyclopedia before Atlas is useful.

Current-state role:

- persistent semantic memory;
- reusable domain facts/primitives/patterns;
- cross-task and E2E relationships;
- source intelligence / authority map;
- provenance and version state;
- previously validated materialized knowledge;
- research-ready operational skeleton;
- reusable rule families/patterns.

Detailed execution knowledge can accumulate progressively through demand.

## 13. Versioning and evolution rule

This method is frozen only as **v0.1 current state**.

It may evolve when:
- ATL-37 identifies defects in the LTL-03 reference package;
- another LTL task exposes missing Research-Ready dimensions;
- a structurally different domain such as Ocean requires additional foundation;
- daughter-page generation proves too coarse/fine;
- the Depth Manifest does not predict research completeness reliably;
- reusable-rule transfer rates are materially lower than expected.

Changes require a versioned governance update with explicit rationale and evidence.

## 14. Immediate ATL-40 work

ATL-40 should now:

1. reconstruct the LTL-03 research sequence in enough detail to derive a candidate Research-Ready Contract;
2. define a first Depth Manifest schema;
3. define Depth Orchestrator inputs/outputs and admissible state transitions;
4. define Daughter-Page Materialization rules;
5. distinguish foundation, reusable materialized knowledge, on-demand depth and Client Binding;
6. validate the mechanism against a structurally different Road-LTL task after ATL-37 stabilizes the LTL-03 reference package.

## 15. Governing statement

> **Build breadth and research-readiness upfront; generate exhaustive execution depth on demand; retain reusable knowledge progressively; expose depth through governed semantic zoom/daughter-page materialization; evolve the method only through evidence-backed versioning.**
