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
- `entity_type text` — governed type identity;\n- `entity_type_version text` — immutable pin to the exact governed type-contract version used when this record was written; the registry reference is `(entity_type, entity_type_version)`, never `entity_type` alone;
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

**Rules:**\n- `semantic_payload` is an extension surface, not a substitute for the stable kernel. Material semantics that become cross-domain/common should graduate into the governed type/relationship model rather than remain opaque ad hoc JSON.\n- A persisted `(knowledge_id, knowledge_version)` row is append-only for semantic content. A semantic change creates a new version row; it never mutates the prior semantic record in place. `updated_at` may record non-semantic operational bookkeeping only.\n- At write time, `applicability` and `semantic_payload` MUST be validated by the governed Transformer/Generator implementation against the exact `(entity_type, entity_type_version)` `schema_contract` before insert. Postgres-level JSON-schema enforcement is an explicit physical-design decision; application/generator write-time validation is the minimum mandatory enforcement layer and cannot be omitted.

### 2.2 Candidate table: `atlas_knowledge_relationships`

Purpose: preserve a graph of operational meaning without hard-coding one process structure.

Core columns:
- `relationship_id text`;
- `relationship_version text`;
- `module_id text`;
- `ownership_zone text`;
- `relationship_type text` — governed relationship-type identity;\n- `relationship_type_version text` — immutable pin to the exact governed relationship-type contract used when this record was written; the registry reference is `(relationship_type, relationship_type_version)`, never `relationship_type` alone;
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

**Relationship immutability and validation:** a persisted `(relationship_id, relationship_version)` row is append-only for semantic content; semantic change creates a successor version. `applicability` and `semantic_payload` MUST be validated at write time by the governed Transformer/Generator implementation against the exact `(relationship_type, relationship_type_version)` contract.\n\nThis supports current ATL-60 traces such as:
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

The link references governed evidence assets where applicable. It does not duplicate source files. Evidence reuse MUST preserve source class. `AUTHORITATIVE_RESEARCH` / Mechanism-1 evidence is Z0 provenance and MUST NOT be represented as client evidence merely because an existing client-document pipeline is convenient; `CLIENT_PROVIDED` evidence remains client-context evidence. Physical design must either (a) add a mechanically queryable `source_class` to the evidence/document substrate consumed by this table, including at least `AUTHORITATIVE_RESEARCH` and `CLIENT_PROVIDED`, or (b) provide a separate governed Mechanism-1 authoritative-source ingestion path. Until one is selected and QA'd, authoritative research evidence must not be loaded through `atlas_client_documents`/`atlas_document_chunks` as though those tables were neutral Z0 substrate.

**Constraint:** each link targets either a knowledge entity or relationship. Material ACTIVE/APPROVED Z1 assertions require governed evidence linkage unless the governing contract explicitly allows a different provenance mechanism.

## 5. Applicability, bindings and gaps

Do not duplicate Z2 values into Z1.

- reusable semantics live in the Z1 kernel;
- enterprise/client values remain in `atlas_client_states` or successor governed Z2 structures;
- unresolved semantics remain explicit and can create/reference `atlas_knowledge_gaps`;
- a Z1 record may declare a binding requirement but may not contain the enterprise-specific value as reusable truth.

Candidate cross-reference fields can be carried through typed relationships such as `REQUIRES_CLIENT_BINDING`, `REQUIRES_MASTER_DATA`, `HAS_KNOWLEDGE_GAP`.\n\n**Gap linkage convention:** a Mechanism-1 return request in existing `atlas_knowledge_gaps` MUST identify the governed semantic target it concerns. The logical convention is `context.knowledge_ref = { knowledge_id, knowledge_version }` for entity gaps or `context.relationship_ref = { relationship_id, relationship_version }` for relationship gaps. Physical design must validate this documented shape (or replace it with an FK-bearing junction before DDL is frozen); an unlinked free-text gap is not sufficient to block/promote a governed knowledge record.

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

Candidate extension to Z5 should be minimal. **This design selects a dedicated `atlas_knowledge_generation_runs` record rather than overloading readiness assessment.** Its minimum logical identity is: `generation_run_id`, `decomposition_id` (and version/hash where applicable), `consumed_knowledge_manifest_hash`, `generator_contract_id`, `generator_contract_version`, `generator_implementation_identity`, `run_status`, `created_at`, and immutable output identity/hash. The consumed manifest enumerates exact Z1 entity/relationship versions plus applicable Z2 bindings and evidence state. This is the concrete Z1→Z5 lineage anchor. Retain the existing `semantic_source_version`, `content_hash` and `governed_input_content_hash` controls in Z5 rather than duplicating the Z1 model there.

No existing P6.1/P6.2 row is changed by this design.

## 8. Extension protocol for future research

When research discovers a genuinely new structure:

1. Determine whether it is merely a new instance of an existing type/relationship.
2. If not, create a **candidate type extension** with definition, ownership zone, validation schema, relationship constraints and evidence through the existing `atlas_foundation_change_proposals` governance path.
3. Test whether the extension preserves existing invariants and queryability.
4. Run independent semantic/schema QA through the existing `atlas_review_requests` governance path; the review must reference the exact candidate type/version and proposal identity.
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
- semantic types/relationships are versioned, and every entity/relationship record pins the exact type version under which it was validated;\n- persisted knowledge/relationship semantic rows are append-only; semantic change creates a successor version;\n- JSON extension surfaces are validated at governed write time against the pinned type contract;\n- Z1→Z5 derivation is anchored by an immutable knowledge-generation run and consumed-knowledge manifest;\n- research-vs-client evidence source class remains mechanically distinguishable;
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

**CANDIDATE LOGICAL DESIGN — QA PASSED WITH BINDING CORRECTIONS APPLIED.** Claude independent QA disposition was `PASS_WITH_BINDING_CORRECTIONS`. F1–F6 have been applied to this logical design: pinned type versions; concrete `atlas_knowledge_generation_runs` Z1→Z5 lineage; explicit gap linkage and reuse of `atlas_foundation_change_proposals` / `atlas_review_requests`; mandatory generator write-time JSON validation with database enforcement decided at physical design; research-vs-client evidence source-class separation; and append-only semantic versioning. No DDL has been generated or applied and no Supabase mutation is authorized by this correction. The next gate is physical DDL/migration **design only**, including the non-blocking physical-design constraints identified by QA, followed by independent QA/Owner authorization before any canonical mutation.
