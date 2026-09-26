# ATL-123 release-control evidence V0.1

## Source and transformation
- ATL-82 V0.3 source blob: `31e9f4ca8c3877519dda71f84b82502d7476ff86`
- ATL-123 apply artifact blob: `42cf8adf698290091f6db47ac30bed07390cc5a9`
- Transformation is bounded to wrapper/execution metadata: remove the standalone `begin;` and terminal `rollback;`; replace the design-only warning comment with ATL-123 governed-apply metadata. All DDL statements between the wrappers remain source-derived.
- Supabase DDL execution mechanism is `apply_migration`, which is the connector's governed DDL operation. The apply artifact therefore does not embed a transaction wrapper that could conflict with the migration executor.

## Recovery
- ATL-125 down-migration blob: `f0b7284a96708f7010a1a1d8176d81aa5182a2f5`
- Scope: reverse only the nine ATL-82-created tables, then `atlas_guard_append_only()`; no pre-existing Atlas table is named for deletion.

## Frozen-input rebuild proof
The physical artifact remains derived from the independently QA-passed ATL-82 V0.3 candidate, itself bound to ATL-60's governed logical design and Generation Registry controls. Rebuild identity is source blob + deterministic wrapper transformation + resulting apply blob above. No semantic DDL modification is introduced by ATL-123.

## Live pre-apply baseline
Supabase project `aaoyesktlzhaunqqjhdq` reports PostgreSQL 17.6. Read-only `to_regclass` checks returned NULL for all nine ATL-82 target tables before application, proving no target-object collision or accidental prior application. Existing migrations stop at P6.2 canonical WorkDefinitions.

## PG17 executable gate
ATL-127 changes ATL-94 disposable CI from PostgreSQL 16 to PostgreSQL 17. First attempt (run 36240171623) failed before SQL execution because Ubuntu noble default APT did not contain postgresql-17; this is environment provisioning, not schema failure. Workflow was corrected to install PostgreSQL 17 from PGDG. Final closure requires a subsequent actual PG17 PASS.

## Mutation state
No Supabase mutation was performed while producing this evidence.
