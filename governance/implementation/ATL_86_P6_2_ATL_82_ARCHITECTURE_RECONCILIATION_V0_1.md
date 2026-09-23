# ATL-86 — P6.2 / ATL-82 Architecture Reconciliation V0.1

**Status:** WORKING RECONCILIATION — FIRST-PARTY BUILD
**Date:** 2026-09-23
**Task:** ATL-86
**Scope:** read-only cross-branch and live-schema reconciliation; no Supabase mutation; no destructive merge.

## 1. Evidence identities verified

| Lineage point | Exact evidence | Verified observation |
|---|---|---|
| Sep-1 Malkom/V2 prototype | commit `659177be263df24728f31a8e342a5e8ac0f51b7e`; `migrations/v2-admin-workdefinitions.sql`; `scripts/seed-v2-workdefinitions.mjs` | Prototype defines `atlas_work_definitions(definition_id, domain, source_task_id, source_version, definition_version,...)` and seed expects exactly 22 Road LTL definitions, defaulting source version to Road LTL V1.2. |
| Sep-2 architecture | `9ccacee603744ce4bcf235f72e7be7b484a5b9a0` | Frozen chain explicitly makes Canonical WorkDefinition executor-neutral and runtime projections derived consumers, never canonical truth. |
| Sep-2 pending WD | `12d3301a88c31156d0468fd4a6dc832fd0adccbf` | VNext is explicitly `IMPLEMENTATION_COMPILATION_PENDING`. |
| Sep-2 pending decomposition | `260c12817ad09cf53f96f6c7ac4aecd3283a039c` | Decomposition V1 is explicitly `IMPLEMENTATION_PENDING`. |
| Sep-2 warehouse candidate | `fdfdb666d3360b1e9e4589dc0f2b49e5db32fb44`; `backend/supabase/001_knowledge_execution_warehouse.sql` | Candidate includes an older generic `atlas_work_definitions(id uuid, work_definition_id, version, module_id,...)` shape and is not the deployed P6.2 contract. |
| Sep-7 P6.2 implementation | `c72b50025d38c6ba103a98e6b698ac2181d5017b` | Freezes Canonical WorkDefinition V1, deterministic compiler/verifier, supersession record, and protected P6.2 persistence migration. |
| Sep-12 Malkom reference adapter | `f22b77d9765833c9cb15caafcab08273b00a2e54` | Adapter is runtime-specific `MALKOM_3`; commit explicitly preserves two separate lineages. |
| Sep-12 deterministic reference projection | `457003d7aad86d3114b6cff2d9a4b440a0b2c740` | Artifact declares `DEMO_REFERENCE_PROJECTION_NOT_CANONICAL_TRUTH`, V1.2→Domain Warehouse v2.3→Malkom 3.0, and explicitly excludes Road LTL 1.5/P6.1/P6.2 as generators. |
| Live Supabase | project `aaoyesktlzhaunqqjhdq` | Latest migration `20260908015858 p6_2_canonical_work_definitions`; `atlas_work_decompositions` 1 row; `atlas_work_definitions` 0 rows. Live P6.2 columns match the Sep-7 protected contract, not Sep-1 or Sep-2 candidate shapes. |

## 2. Table-by-table reconciliation

### 2.1 `atlas_work_definitions`

Three historical physical shapes exist in repository history:

1. **Sep-1 V2/Malkom-era prototype** — `definition_id/domain/source_version`; seed is 22-definition Road LTL/V1.2 oriented.
2. **Sep-2 warehouse candidate** — UUID surrogate `id`, `work_definition_id/version/module_id/module_version/task_id/derived_from/payload`.
3. **Sep-7 P6.2 protected canonical store** — `work_definition_id` PK plus `module_id/module_version/source_task_id/contract_version/definition_version/semantic_source_version/governed_input_content_hash/compiler_version`, protected payload encoding and RLS.

**Governed disposition:** #3 is the deployed/current persistence contract. #1 and #2 are historical candidates/prototypes and MUST NOT be executed as migrations against the live database.

### 2.2 ATL-82 new structures versus P6.2

ATL-82 introduces nine additive structures and does **not** recreate or alter `atlas_work_definitions` or `atlas_work_decompositions`:
- knowledge entity/relationship type registries;
- generation runs;
- versioned Z1 entities/relationships;
- evidence links;
- Z6 readiness runs/evidence;
- `atlas_generation_z5_outputs` bridge.

Therefore ATL-82 is architecturally **complementary**, not a duplicate replacement for P6.2.

The bridge deliberately stores Z5 output identity/version/hash without imposing a foreign key. This is compatible with P6.2 because the protected P6.2 table uses `work_definition_id`, `definition_version`, and `content_hash`; P6.1 has a different physical identity shape and cannot share one generic composite FK without type-specific handling.

**Correction required before ATL-83:** ATL-82 rationale/proof currently say compatibility was verified against the observed live schema, but the original ATL-82 pickup did not include the recovered Sep-7 compiler/contract/supersession lineage or the conflicting Sep-1/Sep-2 historical DDL. The physical SQL itself does not currently conflict with P6.2, but the proof basis for acceptance criterion #9 is incomplete and must be superseded by ATL-86 evidence.

## 3. Contract-by-contract reconciliation

### Canonical WorkDefinition
- Sep-2 VNext PENDING is historical.
- Sep-7 `CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md` is the governing implemented contract.
- Sep-7 supersession record explicitly preserves the VNext file byte-identically and supersedes its stale Road LTL 1.4 compile instruction.
- Current governance-branch `ASSET_REGISTER.json` is stale: it still marks `canonicalWorkDefinitionContract` VNext as `current:true` / pending despite the Sep-7 frozen successor and its own supersession record.

### Canonical Work Decomposition
- Governance-branch asset register still marks the Sep-2 PENDING contract as current.
- The Sep-7 P6.2 branch contains `CANONICAL_WORK_DECOMPOSITION_CONTRACT_V1_FROZEN.md`, and the P6.2 frozen contract names it as the upstream contract.
- Registry bookkeeping therefore requires reconciliation to the later frozen P6.1 identity before claiming current-state registry correctness.

### Knowledge Execution Warehouse candidate
- `backend/supabase/001_knowledge_execution_warehouse.sql` is a historical schema candidate.
- Its `atlas_work_definitions` shape is incompatible with the live P6.2 table.
- It MUST remain NOT_APPLIED/HISTORICAL and must not be treated as a runnable aggregate migration against the current live schema.
- Its conceptual decomposition of knowledge, client binding, runtime projection and validation remains historical architecture evidence only; current ATL-60/82 physical design governs new schema work.

## 4. Sep-1 prototype disposition and execution guard

**Disposition: HISTORICAL_PROTOTYPE_DO_NOT_APPLY.**

The Sep-1 migration and seed are not deleted because they are historical evidence. They are unsafe as current migrations because:
- the migration targets the same `public.atlas_work_definitions` name with a different column contract;
- the seed writes the Sep-1 column names;
- the seed is explicitly 22-definition Road LTL / V1.2 oriented;
- live Supabase already contains the later P6.2 table.

Required mechanical guard: current governance must record these paths as historical/non-runnable against the live P6.2 database; any future migration runner/materializer must use the governed migration registry/current migration lineage rather than indiscriminately executing repository SQL by filename.

## 5. Sep-12 Malkom reference lineage disposition

The Malkom adapter pattern is reusable **only as a downstream runtime adapter pattern**:
- assess runtime capability;
- identify client bindings;
- project;
- verify;
- compile.

It is not canonical WorkDefinition semantics. The committed reference projection is correctly classified non-canonical and explicitly states it was not generated from Road LTL 1.5, OKv2, P6.1 or P6.2.

No ATL-60/82 structure may ingest the V1.2/v2.3 Malkom reference projection as Z1 canonical truth. A future governed Malkom projection from current canonical WorkDefinitions must consume the current P6.2 lineage plus resolved bindings through a separately governed adapter/projection gate.

## 6. ATL-82 disposition

**Current decision: CORRECTION REQUIRED TO PROOF/GOVERNANCE BASIS; NO SQL REDESIGN IDENTIFIED YET.**

The recovered evidence does not presently show a table-name or column-level collision between ATL-82's nine additive tables and deployed P6.2. The main defect is that ATL-82 acceptance criterion #9 was first-party passed without the full governing P6.2 cross-branch lineage and without dispositioning two older incompatible `atlas_work_definitions` DDLs.

Required builder correction:
1. supersede ATL-82 first-party proof criterion #9 with ATL-86 reconciliation evidence;
2. update ATL-82 rationale to name Sep-7 P6.2 as the protected governing persistence contract and Sep-1/Sep-2 DDL as historical/non-runnable;
3. keep `atlas_generation_z5_outputs` as an additive lineage bridge unless independent QA identifies a stronger safe FK design;
4. do not alter the frozen P6.2 table or compiler;
5. do not apply ATL-82 SQL.

## 7. Governance bookkeeping defects

1. Governance-branch `ASSET_REGISTER.json` still exposes Canonical WorkDefinition VNext PENDING as current despite the Sep-7 explicit supersession record.
2. The same register exposes Canonical Work Decomposition PENDING as current despite the later frozen P6.1 contract used by P6.2.
3. `knowledge-execution-warehouse-schema-1` is correctly marked NOT_APPLIED but `current:true`; this is ambiguous after ATL-60/82 became the governed successor physical-design path and must be dispositioned rather than treated as current executable schema.
4. Historical Sep-1 V2 migration/seed have no current governance guard in the registry preventing accidental reuse against P6.2.

These are governance-record corrections, not reasons to rewrite historical frozen files.

## 8. ATL-83 gate

**ATL-83 remains BLOCKED.**

Release requires:
- ATL-82 rationale/proof correction and resulting-state verification;
- exact asset-register/supersession bookkeeping correction with immutable historical records retained;
- post-write verification of those corrections;
- ATL-86 proof update against all nine predetermined acceptance criteria;
- if ATL-82/P6.2 governance is materially altered, independent Claude recheck before ATL-83 resumes.

## 9. Mutation statement

No Supabase mutation, migration application, destructive branch merge, frozen-contract rewrite, or Malkom-reference promotion was performed in this reconciliation build.
