# ATL-82 — Physical DDL/Migration Design Rationale V0.2

**Status:** CANDIDATE — DESIGN ONLY; NOT APPLIED
**Date:** 2026-09-23
**Supersedes:** `ATL_82_PHYSICAL_DESIGN_RATIONALE_V0_1.md` for architecture-lineage interpretation only; V0.1 remains immutable evidence of the original build.
**Correction authority:** ATL-86 reconciliation.

## 1. Corrected governing persistence lineage

ATL-82's nine-table extension is downstream of and additive to the protected P6.1/P6.2 execution substrate.

The governing P6.2 persistence/compilation lineage is the Sep-7 implementation on `atlas-presentation-architecture-v1-p6-2`, commit `c72b50025d38c6ba103a98e6b698ac2181d5017b`:
- `CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md`;
- `CANONICAL_WORKDEFINITION_CONTRACT_SUPERSESSION_V1.json`;
- `migrations/p6-2-canonical-work-definitions.sql`;
- deterministic compiler/verifier.

The frozen P6.2 contract names `CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md` as its upstream P6.1 contract.

Live Supabase confirms the later protected persistence state: migration `20260908015858 p6_2_canonical_work_definitions`, one protected Work Decomposition aggregate row, zero Canonical WorkDefinition rows at the ATL-86 inspection point.

## 2. Historical same-name DDL — non-runnable against current live schema

Two older repository artifacts target `public.atlas_work_definitions` with incompatible physical shapes:

1. Sep-1 prototype at commit `659177be263df24728f31a8e342a5e8ac0f51b7e`, `migrations/v2-admin-workdefinitions.sql` plus `scripts/seed-v2-workdefinitions.mjs`. This is Malkom/V2-era prototype evidence and its seed is explicitly 22-definition Road LTL/V1.2 oriented.
2. Sep-2 warehouse candidate at `fdfdb666d3360b1e9e4589dc0f2b49e5db32fb44`, `backend/supabase/001_knowledge_execution_warehouse.sql`. This is a NOT_APPLIED historical schema candidate.

Neither is an executable current migration. They MUST NOT be applied to the live P6.2 database and MUST NOT be used to infer the current WorkDefinition column contract.

## 3. ATL-82 physical-design compatibility

The ATL-82 SQL creates nine new tables and does not create, alter, drop, rename, or backfill `atlas_work_definitions` or `atlas_work_decompositions`.

`atlas_generation_z5_outputs` is intentionally a lineage bridge. It records `output_kind/output_id/output_version/output_hash` without a direct generic FK to the two protected Z5 stores. This remains the safe V0.1 physical choice because P6.1 and P6.2 use different identity shapes. A stronger type-specific FK may be proposed later but is not required to establish non-collision.

No ATL-82 SQL redesign is required by ATL-86's recovered P6.2 evidence.

## 4. Runtime adapter boundary

The Sep-12 Malkom adapter/reference projection remains a downstream reference pattern only. Its useful reusable pattern is `assess → required bindings → project → verify → compile`.

Its Road LTL V1.2 → Domain Warehouse v2.3 → Malkom 3.0 reference lineage is not a source of Z1 canonical truth and is not an input to the ATL-82 schema. Any future Malkom projection from current Atlas truth must consume governed current WorkDefinitions plus separately governed bindings.

## 5. Corrected interpretation of original acceptance criterion #9

V0.1 stated existing-schema compatibility had passed against live read-only inspection. That statement was too broad because the pickup omitted recovered Sep-7 P6.2 contract/compiler/supersession evidence and did not disposition the incompatible Sep-1/Sep-2 same-name DDL.

The corrected criterion is:

> **PASS, superseding V0.1 basis:** ATL-82's nine additive tables do not collide with or alter the deployed P6.2 protected WorkDefinition/decomposition structures. Sep-1 and Sep-2 same-name WorkDefinition DDL are historical/non-runnable and are excluded from current migration lineage.

This correction changes the proof basis, not the ATL-82 SQL.

## 6. Unchanged design boundaries

All V0.1 boundaries remain:
- no Supabase mutation;
- no LTL/BOL-specific physical schema;
- append-only enforcement mechanism remains a pre-application independent-QA decision;
- capability/RLS mapping remains a pre-application independent-QA decision;
- DB-level JSON-schema enforcement remains a pre-application decision;
- FR-02 timing remains governed;
- ATL-83 cannot resume until ATL-86 closes its reconciliation gate.

## 7. Mutation statement

No Supabase mutation, migration application, historical artifact deletion, frozen-contract rewrite, or runtime-reference promotion was performed.
