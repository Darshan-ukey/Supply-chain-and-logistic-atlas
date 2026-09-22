# ATL-60 — Read-Only Supabase Schema Mapping V0.1

**Status:** CANDIDATE — READ-ONLY INSPECTION COMPLETE; NO DATABASE MUTATION  
**Date:** 2026-09-22  
**Task:** ATL-60  
**Supabase project:** `aaoyesktlzhaunqqjhdq`  
**Observed database:** PostgreSQL 17.6.1.155 (engine 17)  
**Last observed migration:** `20260908015858_p6_2_canonical_work_definitions`

## 1. Purpose

Map the existing Atlas structured store to the Research-to-Execution-Readiness Transformer Contract before any schema extension or canonical materialization. This artifact records observed implementation facts only. It does not authorize writes.

## 2. Observed relevant schema

| Existing table | Current role | Zone / transformer relevance | Decision |
|---|---|---|---|
| `atlas_evidence_files` | evidence-file metadata, hash, evidence type, process reference | Z0 evidence/provenance support | **REUSE**, but insufficient alone for claim-level provenance |
| `atlas_client_documents` | client document custody/ingestion metadata | Z0 evidence + Z2 enterprise evidence input | **REUSE**; do not treat client evidence as reusable Z1 truth |
| `atlas_document_chunks` | document text chunks/locators | Z0 evidence locator/retrieval support | **REUSE** as evidence substrate, not canonical semantics |
| `atlas_candidate_facts` | extracted candidate statements, quote/locator, mapping/review state | Z0→candidate semantic staging | **REUSE WITH BOUNDARY**; candidate facts cannot directly become canonical Z1 |
| `atlas_knowledge_gaps` | explicit gaps with kind/status/context/details | cross-zone gap/control state | **REUSE/EXTEND SEMANTIC CONVENTION**; suitable for Mechanism-1 return requests if exact governed keys are added to payload/convention |
| `atlas_client_states` | workspace/client as-is state by module/version | Z2 Client Binding / enterprise context | **REUSE**; must never repair absent Z1 domain semantics |
| `atlas_findings` | generic workspace findings JSON | Operations/Transformation candidate analysis | **DO NOT REPURPOSE as canonical Z1 OK**; semantics too generic and workspace-scoped |
| `atlas_foundation_change_proposals` | governed proposal/review path | proposal path for foundation changes | **REUSE** for proposed changes, not direct truth mutation |
| `atlas_review_requests` | validation/evidence/review workflow | QA/human decision support | **REUSE** where human validation is required |
| `atlas_audit_events` | before/after audit records | governance/audit support | **REUSE** for governed mutations once authorized |
| `atlas_work_decompositions` | protected P6.1 decomposition payload | Z5 canonical/candidate execution semantics | **REUSE**; current row remains untouched; lineage contract must be satisfied |
| `atlas_work_definitions` | protected P6.2 Canonical WorkDefinition payload | Z5 canonical execution semantics | **REUSE**; currently 0 rows; no ATL-60 write authorized |
| `atlas_saved_views` | UI/view state | G5/presentation support | **NOT AUTHORITY** |
| `atlas_usage_events` / `atlas_pilot_evaluations` | telemetry/evaluation | observed evidence / product evaluation | **EVIDENCE ONLY**, not automatic canonical truth |

## 3. Material structural gaps

The existing schema does **not** presently provide a dedicated canonical structured store for the reusable Z1 Operational Knowledge required by ATL-60. In particular, no observed table explicitly owns a normalized/versioned domain-knowledge record carrying the complete common evidence envelope required by the Transformer Contract:

- stable knowledge ID/version;
- mandatory ownership zone Z0–Z7;
- governing contract/layer;
- source/evidence references;
- upstream asset IDs/versions/hashes;
- support/knowledge state;
- domain/client/master-data requirement classification;
- relationships needed to preserve work node → object/information → rule/decision → condition → evidence/authority → exception → output/state → binding/gap;
- generator/run identity and downstream derivation links.

There is also no observed dedicated Z6 readiness-proof/run table. Readiness certification therefore cannot be inferred from the existence of Work Decomposition/WorkDefinition rows.

## 4. Reuse versus extension conclusion

**Reuse existing tables for what they already own. Do not overload them to avoid a migration.**

The candidate implementation should preserve:
- Z0 evidence substrate: existing evidence/document/chunk/candidate-fact structures;
- Z2 client context: `atlas_client_states`;
- gap workflow: `atlas_knowledge_gaps`;
- proposal/review/audit controls: existing governance tables;
- Z5 protected execution artifacts: `atlas_work_decompositions`, `atlas_work_definitions`.

A schema extension is required for:
1. reusable, versioned **Z1 Operational Knowledge** and its typed relationships/lineage; and
2. **Z6 execution-readiness proof/run state** tying exact inputs, blockers and readiness result to a governed resolver/contract identity.

Whether these are implemented as one envelope table plus typed relationship tables, or a small normalized family, remains a **candidate design decision**. It must be specified and independently QA'd before migration.

## 5. Existing-state safety findings

- `atlas_work_decompositions`: 1 row observed.
- `atlas_work_definitions`: 0 rows observed.
- No migration newer than `20260908015858` was observed.
- This inspection made **no schema or data mutation**.
- The protected P6.1 row must not be treated as the source from which ATL-60 reconstructs missing research/OK; prior recovery governance already classifies it as a derived artifact with unresolved reproducibility/readability history.

## 6. Implementation dependencies now known

For ATL-60 Mechanism-2 implementation design:
- structured store: Supabase project `aaoyesktlzhaunqqjhdq`;
- database: PostgreSQL 17.6.1.155 / engine 17 as observed on 2026-09-22;
- target canonical schema currently: `public`;
- existing protected execution tables: `atlas_work_decompositions`, `atlas_work_definitions`;
- existing evidence/client/gap/governance tables listed above;
- canonical mutation remains prohibited until migration/contract QA and Owner freeze.

No Supabase SDK/runtime package dependency is required merely to define the storage contract; application-library versions must be bound only if/when implementation code depends on them.

## 7. Candidate configuration bindings

The following are implementation constraints, not business-semantic defaults:

- `target_store_project = aaoyesktlzhaunqqjhdq`
- `target_schema = public`
- `materialization_mode = CANDIDATE_ONLY` until promotion gate clears
- `ownership_zone_required = true`
- `provenance_required_for_material_assertions = true`
- `client_binding_cannot_fill_domain_gap = true`
- `unknown_gap_conflict_must_remain_explicit = true`
- `html_is_projection_only = true`
- `canonical_write_authorized = false`
- `readiness_states = DOMAIN_EXECUTION_READY | ENTERPRISE_EXECUTION_READY | RUNTIME_IMPLEMENTATION_READY`

No confidence threshold, source-precedence threshold, auto-promotion rule, or semantic fill default is authorized by this mapping.

## 8. Next design step

Produce a **candidate schema extension/migration design without applying it**, covering:
- Z1 Operational Knowledge envelope/entity storage;
- typed semantic relationships;
- evidence/provenance linkage;
- explicit knowledge/support/gap states;
- Z6 readiness proof/run records;
- immutable/versioned lineage into Z5 decomposition and WorkDefinition;
- RLS/access boundary consistent with protected execution IP.

Then independently QA that design and the now-bound Transformer Contract before any database mutation.
