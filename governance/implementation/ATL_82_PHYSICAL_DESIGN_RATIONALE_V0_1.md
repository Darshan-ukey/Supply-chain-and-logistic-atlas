# ATL-82 — Physical DDL/Migration Design Rationale V0.1

**Status:** CANDIDATE — DESIGN ONLY; NOT APPLIED
**Date:** 2026-09-22
**Parent:** ATL-60
**Supabase project inspected:** `aaoyesktlzhaunqqjhdq`

## 1. Design boundary

This physical design implements the ATL-60 stable semantic kernel + governed extension model after ATL-79 proved four materially different LTL-03 facts can traverse the model and ATL-80 supplied governed type/version identities.

It does not materialize LTL-03 knowledge, activate seed contracts, mutate Supabase, or authorize canonical promotion.

## 2. Physical structures

Nine candidate tables are introduced:
1. `atlas_knowledge_entity_types` — governed/versioned entity-type contracts.
2. `atlas_knowledge_relationship_types` — governed/versioned relationship-type contracts.
3. `atlas_knowledge_generation_runs` — immutable run identity and consumed-knowledge manifest for Z1→Z5 lineage.
4. `atlas_knowledge_entities` — versioned knowledge kernel.
5. `atlas_knowledge_relationships` — versioned typed semantic graph.
6. `atlas_knowledge_evidence_links` — claim-level provenance with mechanically explicit source class.
7. `atlas_readiness_runs` — Z6 readiness run/result envelope.
8. `atlas_readiness_evidence` — evidence attached to a readiness run.
9. `atlas_generation_z5_outputs` — explicit run→Z5 output identity bridge.

Existing `atlas_client_states`, `atlas_knowledge_gaps`, `atlas_foundation_change_proposals`, `atlas_review_requests`, `atlas_work_decompositions`, and `atlas_work_definitions` remain reused rather than duplicated.

## 3. Key integrity decisions

- Composite foreign keys preserve exact `(type_id,type_version)` and `(knowledge_id,knowledge_version)` identity.
- Z0–Z7 is constrained at the knowledge/relationship kernel.
- Readiness states are limited to the Product Constitution ladder; blocker states remain separate in `run_status` / blocker manifest.
- Evidence `source_class` distinguishes authoritative research from client evidence and runtime observation.
- Evidence links target exactly one entity or relationship.
- Type/lifecycle/support vocabularies are constrained.
- No LTL/BOL-specific physical columns or enums are introduced.
- No foreign key is created directly from generic Z5 output IDs to existing protected tables because their physical identity/version columns must be verified as compatible before imposing a cross-table FK. The bridge preserves output identity/hash without changing protected P6.1/P6.2 tables.

## 4. RLS/access boundary

Every new public table has RLS enabled. This candidate intentionally creates no `anon` or `authenticated` grants/policies. The new knowledge/readiness substrate therefore remains closed through the Data API until the existing Atlas capability model is explicitly mapped and independently QA'd.

This follows the protected-IP requirement rather than inventing a permissive policy.

## 5. Append-only enforcement boundary

Governance requires semantic/type rows to be append-only/versioned. The candidate DDL does not yet add UPDATE/DELETE-blocking triggers because doing so without mapping the existing privileged write/capability pattern could conflict with governed promotion and audit workflows.

This is an explicit independent-QA question, not a silent omission. Before application, QA must decide whether append-only is enforced by:
- database trigger/policy;
- capability-gated stored procedure;
- application/generator plus database privilege model;
or a governed combination.

## 6. JSON contract validation boundary

The logical model requires write-time validation of `applicability` and `semantic_payload` against the pinned type contract. Candidate DDL provides the physical registry and exact composite FK. It does not invent a PostgreSQL JSON-Schema validator extension/function.

The Transformer/Generator remains the mandatory minimum validator. Independent QA/implementation freeze must decide whether DB-level validation is added.

## 7. Rollback/rebuild

The SQL artifact is wrapped in `BEGIN ... ROLLBACK` as a non-application design artifact. When an executable migration is later authorized, rollback/rebuild proof must demonstrate:
- pre-migration schema identity;
- deterministic creation order;
- no change to protected existing rows;
- drop/rebuild order for only the new structures;
- re-materialization from frozen Generation Registry inputs rather than ad hoc reconstruction.

## 8. Known open physical-design questions for independent QA

1. Should append-only semantic immutability be database-enforced before first materialization?
2. What existing Atlas capability/RLS pattern should govern admin/super-user read and governed writer access?
3. Should evidence source class be added to an existing Z0 evidence table as well as the link table, or is link-level classification sufficient?
4. Should `atlas_generation_z5_outputs` gain physical FKs after exact P6.1/P6.2 identity columns are confirmed?
5. Is a DB-level JSON-Schema validation mechanism justified, or is governed Generator validation + proof sufficient?
6. Should FR-02 relationship types be seeded before the first materialized Z2/gap edge? They remain non-blocking for this design but cannot be silently invented.

## 9. Mutation status

**No Supabase mutation performed. No DDL applied. No data written.**
