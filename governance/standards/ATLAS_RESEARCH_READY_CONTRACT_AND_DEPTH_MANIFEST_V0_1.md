# Atlas Research-Ready Contract & Depth Manifest v0.1

Status: ATL-40 WORKING CANDIDATE — NOT FINAL  
Date: 2026-09-20  
Depends on: ATLAS_RESEARCH_READY_AND_DEPTH_ORCHESTRATION_METHOD_V0_1

## 1. Purpose

Define the minimum governed contract a process/task must satisfy before Atlas may launch autonomous exhaustive depth research, and define the machine-readable state record used to determine current vs requested depth.

This is the first operationalization of the current-state ATL-40 mechanism.

## 2. Research-Ready principle

A task is Research-Ready only when Atlas knows enough to formulate a bounded research problem and can test whether the resulting research is materially complete.

Research-Ready does **not** mean:
- execution-ready;
- field-complete;
- rule-complete;
- regulatory-complete;
- client-bound;
- fully decomposed into atomic WorkDefinitions.

## 3. Candidate Research-Ready Contract

### RR-1 Canonical identity
Required:
- domain;
- process / subprocess placement where known;
- canonical task/process identifier;
- canonical name;
- version/provenance of the task definition.

Fail if Atlas cannot distinguish the requested work from adjacent work.

### RR-2 Purpose and outcome
Required:
- why the work exists;
- expected business outcome;
- explicit boundary of what the work does not own where known.

Fail if the research engine cannot distinguish core responsibility from neighboring tasks.

### RR-3 Activation context
Required at coarse level:
- trigger/event or initiating condition;
- major upstream input/state;
- major downstream output/state.

Exact lifecycle rules may remain unresolved for depth research.

### RR-4 Coarse work-intent skeleton
Required:
- major activities or work intents sufficient to generate research questions;
- no requirement for executor-ready atomic decomposition.

The skeleton may be hierarchical and incomplete, but known incompleteness must be explicit.

### RR-5 Principal operational objects
Required:
- major business/information/document objects already known to participate;
- object list may be incomplete;
- ambiguity must be recorded rather than guessed.

Examples of object classes: Shipment, Consignment, Document, Party, Location, Invoice, Claim, Equipment.

### RR-6 Dependency context
Required:
- known upstream/downstream tasks/processes or state dependencies;
- known cross-task objects/references;
- unresolved dependencies explicitly marked.

### RR-7 Authority orientation
Required:
- at least one plausible governed source-authority class or source-discovery strategy;
- jurisdiction/mode/industry context when materially relevant.

Atlas need not already possess the source documents. It must know how to begin authoritative-source discovery.

### RR-8 Research questions / known unknowns
Required:
- explicit unresolved knowledge classes;
- research questions must be derivable from RR-1 through RR-7.

Examples:
- what identifiers govern this transition?
- what fields/objects are required?
- what regulation/industry standard applies?
- what lifecycle states exist?
- what client-specific binding remains?

### RR-9 Completeness testability
Required:
Atlas must be able to state what evidence would indicate adequate depth for the requested maturity target.

At minimum:
- source hierarchy;
- expected semantic dimensions;
- unresolved-gap recording;
- conflict handling;
- provenance requirements.

### RR-10 Fail-closed state
Required:
If source coverage, applicability, conflicts or semantics cannot be resolved, Atlas must be able to preserve explicit Knowledge Gaps / Client Binding requirements instead of synthesizing unsupported truth.

## 4. Candidate gate disposition

Research-Ready disposition:
- PASS — all mandatory RR dimensions sufficiently populated;
- CONDITIONAL — bounded research may start, but named prerequisites must be resolved first;
- FAIL — task foundation insufficient; additional foundation/daughter-page population is required.

No score or percentage is used at v0.1. A dimension is satisfied only when its required evidence is present.

## 5. Knowledge maturity states

### M0 — DISCOVERED
Entity/task exists in Atlas but may be little more than name/placement.

### M1 — MAPPED
Domain/E2E/process placement and coarse relationship to adjacent work known.

### M2 — STRUCTURED
Purpose, trigger/outcome, coarse work skeleton and principal known objects/dependencies represented.

### M3 — RESEARCH_READY
RR-1 through RR-10 gate passed or conditionally passed with resolved start prerequisites.

### M4 — DEEP_RESEARCHED
Exhaustive authoritative research completed to the requested scope with provenance, explicit gaps/conflicts and governed materialization.

### M5 — EXECUTION_READY
Technology-neutral Domain Execution Contract meets the governed readiness criteria for the requested scope, with client bindings/gaps either resolved or explicitly blocking readiness.

### M6 — PROJECTABLE
Execution-ready contract has valid projection(s) for one or more downstream executor classes.

Maturity is scoped. A task can be M5 for one lifecycle slice/client binding and lower for another.

## 6. Depth Manifest — conceptual schema

Each governed entity that can accept a depth request should expose a manifest with:

### Identity
- entity_id
- entity_type
- domain_id
- parent_id / process path
- canonical_version

### Maturity
- current_maturity
- requested_maturity
- maturity_scope
- last_gate_disposition
- last_validated_at

### Foundation coverage
- purpose_status
- trigger_status
- outcome_status
- work_skeleton_status
- principal_object_status
- upstream_dependency_status
- downstream_dependency_status
- actor_role_status
- source_orientation_status

### Depth coverage
- authoritative_research_status
- source_inventory_status
- information_object_status
- relationship_cardinality_status
- lifecycle_state_status
- rule_validation_status
- exception_queue_status
- evidence_provenance_status
- workdefinition_status
- domain_execution_contract_status

### Enterprise delta
- client_binding_status
- master_reference_status
- local_system_mapping_status
- unresolved_client_requirements

### Projection
- available_projection_types
- projection_status_by_type

### Gaps / conflicts
- knowledge_gap_ids
- source_conflict_ids
- blocked_dimensions
- unsafe_inference_guards

### Reuse
- reused_primitive_ids
- reused_rule_family_ids
- reused_pattern_ids
- reused_domain_fact_ids
- newly_materialized_knowledge_ids

### Provenance / freshness
- source_authority_classes
- source_versions
- effective_date_context
- freshness_state
- revalidation_required

### UI/materialization
- daughter_views_available
- daughter_views_recommended
- inspector_only_knowledge_classes
- next_admissible_depth_actions

## 7. Depth delta calculation

Given:
- current maturity;
- requested maturity;
- manifest coverage;
- reusable governed knowledge;

Atlas should derive a Depth Delta:

**Required depth work = target maturity requirements − currently satisfied governed requirements**

The system should not repeat research that remains authoritative/current unless:
- applicability differs;
- source changed;
- conflict exists;
- downstream task needs a distinct semantic specialization.

## 8. Daughter-page generation trigger

A daughter view should be considered when newly materialized knowledge creates a user-meaningful operational unit that:
1. has distinct purpose/meaning;
2. has multiple governed relationships or lifecycle/rule structures worth navigating;
3. is likely to be independently explored by a user;
4. cannot be adequately represented as a small inspector section.

Candidate materializable view classes:
- subprocess/task;
- major Work Decomposition branch;
- major business/information object;
- lifecycle/state model;
- decision/control family;
- exception family;
- execution contract;
- client-binding view.

Do not create daughter pages for individual facts, evidence nodes or generated rules by default.

## 9. Research request contract

A future Depth Orchestrator should accept at minimum:
- target entity;
- target maturity;
- scope/jurisdiction/client context;
- current Depth Manifest;
- existing applicable governed knowledge;
- user intent (learn / deep-dive / make research-ready / make execution-ready / project to tool).

It should return:
- admissibility/gate result;
- missing foundation if blocked;
- research plan;
- source discovery plan;
- expected evidence dimensions;
- existing reusable knowledge;
- requested new knowledge classes;
- completeness tests;
- resulting materialization plan.

## 10. Validation requirement

This candidate must be tested against:
1. LTL-03 retrospectively — could the gate have launched the research safely?
2. one structurally different Road-LTL task — does the same gate work outside BOL/document semantics?
3. later, one Ocean task — does the foundation/generalization survive a different operating model?

## 11. Current limitation

The contract is inferred from LTL-03 and the existing Atlas domain-neutral ontology. It is not yet proven universal. It must remain versioned and evolvable.

