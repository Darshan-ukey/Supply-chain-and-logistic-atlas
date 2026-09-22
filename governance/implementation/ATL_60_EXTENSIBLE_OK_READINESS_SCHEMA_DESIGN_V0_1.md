# ATL-60 — Extensible Operational Knowledge & Readiness Schema Design V0.1

**Status:** CANDIDATE — DESIGN ONLY; NOT APPLIED  
**Date:** 2026-09-22  
**Task:** ATL-60  
**Owner requirement:** The model must accept material knowledge structures discovered by future research on other processes/domains without destructive redesign or loss of governance.

## 1. Design objective

Add the missing Z1 Operational Knowledge and Z6 readiness-proof capabilities while reusing Atlas's existing Z0, Z2, Z5 and governance stores.

The design deliberately avoids both failure modes:
1. a rigid LTL-03/BOL-specific schema that becomes obsolete when a different process exposes new knowledge structures; and
2. an ungoverned generic JSON/document store that is flexible but destroys semantic validation, lineage and queryability.

The solution is a **stable semantic kernel + governed extension model**.

## 2. Stable semantic kernel

Every material knowledge element is represented as a versioned entity with a stable identity. Domain-specific meaning is expressed by governed types and typed relationships, not by creating a new physical table for every newly discovered concept.

### 2.1 Candidate table: `atlas_knowledge_entities`

Purpose: canonical/versioned Z1 semantic records and candidate records before promotion.

Core columns:
- `knowledge_id text` — stable semantic identity, independent of row/version;
- `knowledge_version text`;
- `module_id text`;
- `module_version text`;
- `ownership_zone text` — required Z0–Z7;
- `entity_type text` — references governed type registry;
- `canonical_name text`;
- `definition text`;
- `operational_purpose text null`;
- `lifecycle_status text` — CANDIDATE / VALIDATED / APPROVED / ACTIVE / DEPRECATED;
- `support_state text` — explicit evidence/knowledge support state, separate from readiness;
- `applicability jsonb`;
- `semantic_payload jsonb` — extension attributes only; must validate against the entity-type contract;
- `governing_contract_id text`;
- `governing_contract_version text`;
- `generator_run_id text null`;
- `content_hash text`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Primary key candidate: `(knowledge_id, knowledge_version)`.

**Rule:** `semantic_payload` is an extension surface, not a substitute for the stable kernel. Material semantics that become cross-domain/common should graduate into the governed type/relationship model rather than remain opaque ad hoc JSON.

### 2.2 Candidate table: `atlas_knowledge_relationships`

Purpose: preserve a graph of operational meaning without hard-coding one process structure.

Core columns:
- `relationship_id text`;
- `relationship_version text`;
- `module_id text`;
- `ownership_zone text`;
- `relationship_type text` — references governed relationship-type registry;
- `from_knowledge_id text`;
- `from_knowledge_version text`;
- `to_knowledge_id text`;
- `to_knowledge_version text`;
- `applicability jsonb`;
- `semantic_payload jsonb`;
- `support_state text`;
- `governing_contract_id text`;
- `governing_contract_version text`;
- `generator_run_id text null`;
- `content_hash text`;
- timestamps.

This supports current ATL-60 traces such as:
`work node → object/information → rule/decision → condition → exception → output/state`
without asserting that this is the only future relationship pattern.

## 3. Governed extensibility registries

### 3.1 Candidate table: `atlas_knowledge_entity_types`

Defines allowed semantic types and their validation contract.

Fields:
- `type_id text`;
- `type_version text`;
- `name text`;
- `description text`;
- `default_ownership_zone text null`;
- `schema_contract jsonb` — machine-validatable allowed/required extension attributes;
- `status text`;
- `governing_contract_id text`;
- `content_hash text`;
- timestamps.

Initial candidate types may include PROCESS, WORK_NODE, BUSINESS_OBJECT, DOCUMENT, INFORMATION_CONCEPT, FIELD, ACTOR_ROLE, SYSTEM_INTERFACE, EVENT, STATE, RULE, DECISION, VALIDATION, EXCEPTION, CONTROL, INPUT, OUTPUT, DEPENDENCY, HANDOFF, AUTHORITY, NORMALIZATION, TRANSFORMATION and OUTCOME.

These are **seed candidates**, not a permanently closed enumeration.

### 3.2 Candidate table: `atlas_knowledge_relationship_types`

Defines allowed relationship semantics and endpoint constraints.

Fields:
- `type_id text`;
- `type_version text`;
- `name text`;
- `description text`;
- `from_type_constraints jsonb`;
- `to_type_constraints jsonb`;
- `schema_contract jsonb`;
- `status text`;
- `governing_contract_id text`;
- `content_hash text`;
- timestamps.

Future research can propose a new entity or relationship type through governance rather than forcing a database redesign.

## 4. Provenance and evidence linkage

### Candidate table: `atlas_knowledge_evidence_links`

Purpose: many-to-many claim/entity/relationship linkage to existing evidence substrate.

Fields:
- `link_id text`;
- `knowledge_id text null`;
- `knowledge_version text null`;
- `relationship_id text null`;
- `relationship_version text null`;
- `evidence_source_kind text`;
- `evidence_ref text`;
- `evidence_locator text null`;
- `authority_class text null`;
- `support_role text` — e.g. SUPPORTS / QUALIFIES / CONFLICTS / SUPERSEDES;
- `claim_scope jsonb`;
- `created_at timestamptz`.

The link references existing Z0 evidence/document/chunk/candidate-fact assets where applicable. It does not duplicate source files.

**Constraint:** each link targets either a knowledge entity or relationship. Material ACTIVE/APPROVED Z1 assertions require governed evidence linkage unless the governing contract explicitly allows a different provenance mechanism.

## 5. Applicability, bindings and gaps

Do not duplicate Z2 values into Z1.

- reusable semantics live in the Z1 kernel;
- enterprise/client values remain in `atlas_client_states` or successor governed Z2 structures;
- unresolved semantics remain explicit and can create/reference `atlas_knowledge_gaps`;
- a Z1 record may declare a binding requirement but may not contain the enterprise-specific value as reusable truth.

Candidate cross-reference fields can be carried through typed relationships such as `REQUIRES_CLIENT_BINDING`, `REQUIRES_MASTER_DATA`, `HAS_KNOWLEDGE_GAP`.

## 6. Z6 readiness proof

### 6.1 Candidate table: `atlas_readiness_runs`

Purpose: immutable identity for a readiness assessment.

Fields:
- `readiness_run_id text`;
- `module_id text`;
- `module_version text`;
- `scope_ref jsonb`;
- `resolver_id text`;
- `resolver_version text`;
- `generator_contract_id text`;
- `generator_contract_version text`;
- `input_manifest_hash text`;
- `requested_level text`;
- `result_state text null`;
- `run_status text` — CANDIDATE / VALIDATED / FAILED / SUPERSEDED;
- `created_at timestamptz`.

Allowed readiness results remain exactly:
- DOMAIN_EXECUTION_READY
- ENTERPRISE_EXECUTION_READY
- RUNTIME_IMPLEMENTATION_READY

### 6.2 Candidate table: `atlas_readiness_evidence`

Purpose: explain why a readiness result was or was not reached.

Fields:
- `readiness_run_id text`;
- `requirement_key text`;
- `requirement_type text`;
- `status text`;
- `knowledge_ref jsonb null`;
- `binding_ref jsonb null`;
- `work_decomposition_ref jsonb null`;
- `work_definition_ref jsonb null`;
- `evidence_refs jsonb`;
- `blocker_class text null`;
- `details jsonb`;
- `content_hash text`.

Blocker/dependency states remain separate from readiness result.

## 7. Lineage into Z5

Z5 artifacts remain in the existing protected stores.

The transformer must produce an immutable input manifest identifying the exact Z1 knowledge versions, relationships, Z2 bindings where applicable, governing contracts and source/evidence state consumed to create a Work Decomposition.

Candidate extension to Z5 should be minimal. Prefer storing the manifest/hash in a dedicated generation/readiness record and retaining the existing `semantic_source_version`, `content_hash` and `governed_input_content_hash` controls rather than duplicating the Z1 model inside Z5.

No existing P6.1/P6.2 row is changed by this design.

## 8. Extension protocol for future research

When research discovers a genuinely new structure:

1. Determine whether it is merely a new instance of an existing type/relationship.
2. If not, create a **candidate type extension** with definition, ownership zone, validation schema, relationship constraints and evidence.
3. Test whether the extension preserves existing invariants and queryability.
4. Run independent semantic/schema QA.
5. Owner/governance promotion activates the new type/version.
6. Existing knowledge remains valid against its original type version; no destructive rewrite is required.
7. If the discovery changes the stable kernel itself, create a successor schema/contract version and perform dependency-impact analysis rather than silently adding columns.

This creates **forward extensibility with controlled ontology evolution**.

## 9. Stable invariants that extensions cannot bypass

Regardless of future process/domain:
- every material semantic record has stable ID + version;
- every record has Z0–Z7 ownership;
- provenance/lineage is resolvable;
- unknown/conflict/gap remains explicit;
- Z1, Z2, Z5 and Z6 are mechanically distinguishable;
- Client Binding cannot repair missing reusable domain semantics;
- runtime evidence cannot silently overwrite canonical truth;
- HTML/UI is projection only;
- candidate generation cannot self-promote;
- semantic types/relationships are versioned;
- readiness vocabulary remains Constitution-controlled.

## 10. Candidate migration sequence — NOT AUTHORIZED TO APPLY

A future migration should, after QA/freeze:
1. create type registries;
2. create knowledge entity kernel;
3. create relationship kernel;
4. create evidence-link table;
5. create readiness run/evidence tables;
6. add indexes and integrity constraints;
7. add RLS policies/capability gates;
8. add validators for ownership zone, type contract, endpoint constraints and readiness vocabulary;
9. prove rollback/rebuild;
10. seed only frozen/approved base type contracts;
11. materialize ATL-60 candidate knowledge only through the governed Generator/Generation Registry.

## 11. Candidate physical migration sketch

This document intentionally does **not** yet contain executable DDL. Physical DDL should be generated only after independent QA confirms the logical model, naming, RLS boundary, version semantics, evidence reference strategy and compatibility with existing P6.1/P6.2 contracts.

## 12. QA questions before DDL

Independent QA must specifically challenge:
1. Is the stable kernel too generic to enforce useful semantics?
2. Is any LTL/BOL-specific assumption embedded as a universal rule?
3. Can a new process introduce a new semantic type without destructive migration?
4. Can type evolution invalidate existing records silently?
5. Can generic JSON bypass governed type validation?
6. Are Z1/Z2/Z5/Z6 boundaries mechanically enforceable?
7. Is provenance claim-level enough for conflicting sources?
8. Can the model reconstruct exact inputs to any Z5/Z6 derivation?
9. Are protected execution semantics still capability-gated?
10. Can schema recovery/rebuild be proven before canonical materialization?

## 13. Current disposition

**DESIGN CANDIDATE.** No DDL generated or applied. No Supabase mutation. Next gate is independent QA of this logical design together with the implementation-bound Transformer Contract.
