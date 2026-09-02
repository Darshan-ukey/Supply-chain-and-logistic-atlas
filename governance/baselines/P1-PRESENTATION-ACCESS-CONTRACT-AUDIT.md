# P1 Presentation & Access Contract Audit

**Phase:** P1 — Presentation and access contracts  
**Status:** COMPLETE — EXIT GATE PASS  
**Branch:** `atlas-presentation-architecture-v1-p1`  
**Parent baseline:** `atlas-presentation-architecture-v1-p0`

## 1. Delivered contracts

1. `governance/presentation/OPERATIONAL_KNOWLEDGE_PRESENTATION_CONTRACT_V1_FROZEN.md`
2. `governance/presentation/EXECUTION_READINESS_PRESENTATION_CONTRACT_V1_FROZEN.md`
3. `governance/presentation/AUTHORIZATION_PROJECTION_MATRIX_V1_FROZEN.md`
4. `governance/presentation/authorization-projection-matrix-v1.json`
5. `governance/presentation/EXECUTION_DEPTH_FIELD_CLASSIFICATION_V1_FROZEN.md`
6. `governance/presentation/execution-depth-field-classification-v1.json`

## 2. Candidate-field coverage audit

The P1 classification was checked against the frozen Daughter Production Standard V2 and the observed Road LTL V1.4 / Ocean FCL V0.6 / Ocean LCL V0.6 execution-reference candidate families.

Covered current task families:
- task identity and A3/A5 lineage;
- baseline/reference operating summaries where present;
- applicability;
- required information;
- decision gates;
- constraints;
- controls;
- atomic actions;
- states;
- branch transitions;
- temporal constraints;
- responsibility;
- system exchanges;
- documents/objects;
- evidence contracts;
- expected outcomes;
- client-binding requirements including nested basis/system-of-record/field-mapping/authority fields;
- provenance claims;
- executability;
- WorkDefinition-readiness.

Covered next-layer protected families:
- recursive Work Decomposition;
- canonical WorkDefinition;
- runtime-specific projections.

Schema evolution is covered by a deny-by-default rule: every path not explicitly matched is `PRIVATE_DEFAULT` and omitted until a superseding classification approves it.

## 3. Consumer coverage

Explicit projection classes exist for:
- Public / Anonymous;
- Authenticated Atlas;
- Pilot;
- Client Workspace;
- Admin / Governor;
- Owner.

P1 deliberately distinguishes these projection classes from existing workspace database roles. Current `OWNER`, `ADMIN`, `PILOT_USER`, `VIEWER` roles are not changed by P1. Workspace `ADMIN` is not automatically global Atlas Admin/Governor, and workspace `OWNER` is not automatically global Atlas Owner.

## 4. Frozen public/private boundary

### Public/normal-safe
- A5 Overview;
- allowlisted human-readable Operational Knowledge;
- Execution Readiness status and approved aggregates;
- canonical binding need/category/status;
- safe evidence/provenance class;
- Work Decomposition / WorkDefinition availability and approved summary only.

### Own-workspace only
- client local values;
- applications/environments;
- field/API mappings;
- code crosswalks;
- client contract/policy parameters;
- named client roles/teams/persons/authority limits;
- collection questions where needed for binding.

### Governance / protected execution
- exact source-to-claim lineage and restricted provenance;
- full recursive Work Decomposition;
- full WorkDefinition;
- machine rules/compiler payloads;
- runtime-specific projections.

## 5. Readiness interpretation frozen

P1 explicitly prevents a recurring semantic error:

> An unresolved client binding is not automatically an operational knowledge gap.

If Atlas already knows the canonical requirement, applicability, validation and authority/value-origin class, the Daughter can be ready for decomposition while client-specific mappings/values remain unresolved for deployment.

## 6. Security invariants

- Authorization is resolved before projection/retrieval.
- RLS remains authoritative for workspace isolation.
- Projection allowlists are an additional boundary, not a replacement for RLS.
- Browser hiding/collapsed tabs are not security controls.
- Raw canonical records are not public payloads.
- New fields are private by default.
- Ask Atlas, Trace, Daughter and Canvas must eventually consume the same authorization/projection contracts.
- Full Work Decomposition/WorkDefinition requires explicit protected-execution capability.

## 7. Semantic/regression scope

P1 is governance-contract work only. It does not:
- modify Road LTL V1.4 or Ocean V0.6 semantics;
- promote any candidate;
- compile Work Decomposition;
- compile WorkDefinition;
- alter Canvas;
- alter runtime execution;
- alter API behavior;
- alter Supabase/RLS;
- alter production UI.

P2 is the first implementation phase that will materialize these contracts as server/build-side projections.

## 8. Integrity identifiers

GitHub blob identities for the principal P1 assets at audit time:
- Operational Knowledge Presentation Contract: `0bd62a446a7516b5a7d718dfe91d46b8bdc91e8c`
- Execution Readiness Presentation Contract: `5dfa066c19d494d09e7c1480314735989a3874ae`
- Authorization Projection Matrix: `58ab959cce4c69471bdbde1bb3ab7b04835679d9`
- Authorization Matrix JSON: `bc7a0aa7e1d6821912c807009b3ba51ba7ba89fe`
- Execution-Depth Field Classification: `3b8651ecb6e3851449ee81dec5276ad769ef3c0f`
- Field Classification JSON: `37c0520a42f967d6cd902361c0a6dc906b6348c5`

These branch blob identities make P1 changes diff-verifiable. Central frozen-asset registration records them as repository integrity identities without changing existing semantic candidate hashes.

## Exit gate

**PASS.** Every current execution-depth field family has an explicit presentation/access classification, and unmatched future fields are explicitly private by default. P2 can therefore implement projections without renderer-side authorization judgement.
