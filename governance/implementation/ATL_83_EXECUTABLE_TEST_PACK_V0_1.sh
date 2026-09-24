#!/usr/bin/env bash
# ATL-83 — Executable test pack for the ATL-82 candidate physical design (V0.1)
# Author: Claude (independent QA), 2026-09-23. Reproduces every behavioural finding in
# governance/implementation/ATL_83_INDEPENDENT_QA_ATL_82_PHYSICAL_DESIGN_V0_1.md.
#
# SAFETY: runs ONLY against a disposable local PostgreSQL (>=15). It never connects to Supabase.
#   Required: ATL83_DISPOSABLE=1, PGHOST is a local socket dir or localhost/127.0.0.1, superuser PGUSER.
#   Usage:    ATL83_DISPOSABLE=1 PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres \
#             ./ATL_83_EXECUTABLE_TEST_PACK_V0_1.sh <path-to-ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_1.sql>
# The harness mirrors live Supabase default privileges (GRANT ALL on new public tables to anon,
# authenticated, service_role). On PostgreSQL 16 that is arwdDxt; PostgreSQL 17 adds MAINTAIN (m).
# Phases (each in its own fresh database):
#   PHASE-1 candidate as written (BEGIN..ROLLBACK) compiles and leaves nothing behind
#   PHASE-2 defect probes against a committed copy of the unmodified candidate
#   PHASE-3 candidate + ATL-83 reference corrections: post-correction behaviour + regression
#   PHASE-4 candidate + corrections: drop every new structure (protected stub rows survive), then rebuild
set -euo pipefail
CAND="${1:?path to ATL-82 candidate SQL required}"
[ "${ATL83_DISPOSABLE:-}" = "1" ] || { echo "refusing: set ATL83_DISPOSABLE=1 for a disposable local PostgreSQL" >&2; exit 2; }
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refusing: PGHOST must be a local socket dir or localhost" >&2; exit 2;; esac
case "${PGHOST:-}${PGDATABASE:-}" in *supabase*|*pooler*) echo "refusing: Supabase target detected" >&2; exit 2;; esac
EXPECT_BLOB=b16a4bd9b16763287a76574e7231695b2c271f2e
if command -v git >/dev/null; then GOT=$(git hash-object "$CAND"); [ "$GOT" = "$EXPECT_BLOB" ] || { echo "candidate blob $GOT != pinned $EXPECT_BLOB" >&2; exit 3; }; echo "candidate blob pinned: $GOT"; fi
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
PSQL="psql -X -q"
cat > "$W/harness.sql" <<'SQL'
-- Supabase-like role/privilege harness, mirrored from live pg_default_acl (read 2026-09-23)
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end$$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- stubs of existing tables with live PK/column shapes (for FK tests of proposed corrections)
create table public.atlas_work_decompositions (decomposition_id text primary key, module_id text not null, module_version text not null, content_hash text not null);
create table public.atlas_work_definitions (work_definition_id text primary key, module_id text not null, module_version text not null, definition_version text not null, content_hash text not null);
create table public.atlas_knowledge_gaps (id uuid primary key default gen_random_uuid(), workspace_id uuid, gap_key text not null, status text not null, kind text not null, context jsonb not null default '{}', details jsonb not null default '{}');
create table public.atlas_workspaces (id uuid primary key default gen_random_uuid());
revoke all on public.atlas_work_decompositions, public.atlas_work_definitions from anon, authenticated;
SQL
cat > "$W/probes.sql" <<'SQL'
\pset footer off
\echo '== T2a grants to anon and authenticated on the 9 ATL-82 tables (expect none if the protected pattern were followed)'
select table_name, grantee, string_agg(distinct privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name like any (array['atlas_knowledge_%','atlas_readiness_%','atlas_generation_%']) and table_name <> 'atlas_knowledge_gaps' /* harness stub, not ATL-82 */ group by 1,2 order by 1,2;
\echo '== T2b HARNESS REFERENCE ONLY (not evidence): the P6 stubs carry the P6.1/P6.2 migration revoke, reproduced by the harness'
select count(*) as p6_anon_auth_grants from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('atlas_work_decompositions','atlas_work_definitions');
-- seed minimal rows as owner (test DB only)
insert into atlas_knowledge_entity_types values ('ET-TEST','1.0.0','Test','t',null,'{"type":"object"}','CANDIDATE','C1','h1');
insert into atlas_knowledge_relationship_types values ('RT-TEST','1.0.0','Rel','r','{}','{}','{"type":"object"}','CANDIDATE','C1','h2');
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K1','1','M','Z1','ET-TEST','1.0.0','A','def','SUPPORTED','C1','1','hk1'),('K2','1','M','Z1','ET-TEST','1.0.0','B','def','SUPPORTED','C1','1','hk2');
insert into atlas_knowledge_relationships (relationship_id,relationship_version,module_id,ownership_zone,relationship_type,relationship_type_version,from_knowledge_id,from_knowledge_version,to_knowledge_id,to_knowledge_version,support_state,governing_contract_id,governing_contract_version,content_hash) values ('R1','1','M','Z1','RT-TEST','1.0.0','K1','1','K2','1','SUPPORTED','C1','1','hr1');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,source_class,evidence_source_kind,evidence_ref,support_role) values ('L1','K1','1','AUTHORITATIVE_RESEARCH','doc','DOC-123','SUPPORTS');
\echo '== T3a exact-pin FK: entity pinned to non-existent type version (expect ERROR)'
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K9','1','M','Z1','ET-TEST','9.9.9','X','d','SUPPORTED','C1','1','h');
\echo '== T3b evidence link targets both entity and relationship (expect ERROR)'
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,relationship_id,relationship_version,source_class,evidence_source_kind,evidence_ref,support_role) values ('L2','K1','1','R1','1','CLIENT_PROVIDED','doc','x','SUPPORTS');
\echo '== T3c evidence link half-key (knowledge_id without version) (expect ERROR)'
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,source_class,evidence_source_kind,evidence_ref,support_role) values ('L3','K1','CLIENT_PROVIDED','doc','x','SUPPORTS');
\echo '== T3d invalid readiness vocabulary (expect ERROR)'
insert into atlas_knowledge_generation_runs (run_id,generator_contract_id,generator_contract_version,generator_implementation_identity,consumed_knowledge_manifest,consumed_knowledge_manifest_hash) values ('G1','GC','1','impl','{}','mh');
insert into atlas_readiness_runs (readiness_run_id,module_id,resolver_contract_id,resolver_contract_version,knowledge_generation_run_id,input_manifest,input_manifest_hash,readiness_state) values ('RR0','M','RC','1','G1','{}','ih','MOSTLY_READY');
\echo '== T4a type contract edited IN PLACE while a knowledge row pins it (expect ERROR if immutability enforced)'
update atlas_knowledge_entity_types set schema_contract='{"type":"object","required":["new_field"]}' where type_id='ET-TEST' and type_version='1.0.0';
select type_id, type_version, schema_contract as schema_contract_after_in_place_edit from atlas_knowledge_entity_types where type_id='ET-TEST';
\echo '== T4b knowledge semantic content edited in place (expect ERROR if append-only enforced)'
update atlas_knowledge_entities set definition='silently rewritten' where knowledge_id='K1' and knowledge_version='1';
select knowledge_id, knowledge_version, definition as definition_after_in_place_edit from atlas_knowledge_entities where knowledge_id='K1';
\echo '== T4c same source classified two different ways by two links (expect ERROR if source class is a property of the source)'
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,source_class,evidence_source_kind,evidence_ref,support_role) values ('L4','K2','1','CLIENT_PROVIDED','doc','DOC-123','SUPPORTS');
select evidence_ref, string_agg(source_class, ' + ') as classes_for_same_source from atlas_knowledge_evidence_links where evidence_ref='DOC-123' group by 1;
\echo '== T4d relationship lifecycle: can R1 be marked CANDIDATE? (column exists?)'
select count(*) as relationship_lifecycle_columns from information_schema.columns where table_name='atlas_knowledge_relationships' and column_name in ('lifecycle_status','status');
\echo '== T4e ENTERPRISE readiness run with no client/workspace scope and no requested level (expect ERROR if scope required)'
insert into atlas_readiness_runs (readiness_run_id,module_id,resolver_contract_id,resolver_contract_version,knowledge_generation_run_id,input_manifest,input_manifest_hash,readiness_state,run_status) values ('RR1','M','RC','1','G1','{}','ih','ENTERPRISE_EXECUTION_READY','VALIDATED');
select readiness_run_id, readiness_state from atlas_readiness_runs;
\echo '== T4f Z5 bridge: output with NULL hash pointing at non-existent WorkDefinition (expect ERROR if lineage integrity enforced)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash) values ('G1','WORK_DEFINITION','WD-DOES-NOT-EXIST','1',null);
select output_id, output_hash is null as hash_is_null, (select count(*) from atlas_work_definitions where work_definition_id=output_id) as target_rows from atlas_generation_z5_outputs;
\echo '== T4g knowledge gap linkage: any FK-bearing path from atlas_knowledge_gaps to a knowledge record?'
select count(*) as fks_touching_gaps from information_schema.referential_constraints rc join information_schema.table_constraints tc on tc.constraint_name=rc.constraint_name where tc.table_schema='public' and (tc.table_name='atlas_knowledge_gaps' or rc.unique_constraint_name like 'atlas_knowledge_gaps%');
\echo '== T5 RLS as authenticated: SELECT (expect 0 rows) then TRUNCATE a leaf table (RLS does not govern TRUNCATE)'
select count(*) as evidence_links_before_truncate_as_owner from atlas_knowledge_evidence_links;
set role authenticated;
select count(*) as visible_rows_to_authenticated from atlas_knowledge_evidence_links;
truncate atlas_knowledge_evidence_links;
reset role;
select count(*) as evidence_links_after_authenticated_truncate from atlas_knowledge_evidence_links;
\echo '== T6 DELETE of a type row that knowledge pins (FK should block) and DELETE of an unpinned type row'
delete from atlas_knowledge_entity_types where type_id='ET-TEST';
insert into atlas_knowledge_entity_types values ('ET-UNUSED','1.0.0','U','u',null,'{}','ACTIVE','C1','h9');
delete from atlas_knowledge_entity_types where type_id='ET-UNUSED';
select 'unpinned ACTIVE type row deleted: ' || (count(*)=0)::text from atlas_knowledge_entity_types where type_id='ET-UNUSED';
SQL
cat > "$W/corrections.sql" <<'SQL'
-- ATL-83 — Reference correction delta for ATL-82 candidate (QA reference, NOT a builder artifact)
-- Author: Claude (independent QA). Purpose: prove that binding corrections C1–C4, C7, C8 and
-- recommendation R1 are valid, additive PostgreSQL that closes the defects demonstrated in the
-- ATL-83 test suite. The builder (ChatGPT, ATL-82) owns the corrected candidate SQL and may
-- implement differently if the same behaviour is achieved.
-- Applied ONLY to a disposable local PostgreSQL 16 test cluster, after the unmodified candidate.
-- NOT AUTHORIZED TO APPLY TO SUPABASE. C5/C6 (Z6 readiness) are intentionally absent: their form
-- depends on Owner decision D1 (AR0.3 resolver alignment vs split).

begin;

-- C3 — relationship lifecycle (Transformer Contract §3: all generated output starts CANDIDATE)
alter table public.atlas_knowledge_relationships
  add column lifecycle_status text not null default 'CANDIDATE',
  add constraint atlas_knowledge_relationships_lifecycle_chk
    check (lifecycle_status in ('CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED'));

-- C4 — source class is a property of the source, not of each link
create table public.atlas_evidence_sources (
  source_id text primary key,
  source_class text not null,
  evidence_source_kind text not null,
  evidence_ref text not null,
  workspace_id uuid references public.atlas_workspaces(id),
  authority_class text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (evidence_source_kind, evidence_ref),
  constraint atlas_evidence_sources_class_chk check (source_class in ('AUTHORITATIVE_RESEARCH','CLIENT_PROVIDED','RUNTIME_OBSERVATION','GOVERNED_INTERNAL')),
  constraint atlas_evidence_sources_client_scope_chk check (source_class <> 'CLIENT_PROVIDED' or workspace_id is not null),
  constraint atlas_evidence_sources_research_scope_chk check (source_class <> 'AUTHORITATIVE_RESEARCH' or workspace_id is null)
);
alter table public.atlas_knowledge_evidence_links
  add column source_id text references public.atlas_evidence_sources(source_id);
-- (in the corrected candidate: source_id NOT NULL; source_class / evidence_source_kind /
--  evidence_ref / authority_class move to atlas_evidence_sources; evidence_locator and
--  claim_scope stay on the link because they are per-claim)
alter table public.atlas_knowledge_evidence_links
  drop constraint atlas_knowledge_evidence_links_source_class_chk,
  drop column source_class, drop column evidence_source_kind, drop column evidence_ref, drop column authority_class,
  alter column source_id set not null;
-- (the candidate's atlas_knowledge_evidence_links_evidence_idx is dropped automatically with its columns)
create index atlas_knowledge_evidence_links_source_idx on public.atlas_knowledge_evidence_links(source_id);

-- C7 — FK-bearing gap linkage (ATL-60 §5: an unlinked free-text gap cannot block/promote)
create table public.atlas_knowledge_gap_links (
  gap_id uuid not null references public.atlas_knowledge_gaps(id),
  knowledge_id text,
  knowledge_version text,
  relationship_id text,
  relationship_version text,
  created_at timestamptz not null default now(),
  foreign key (knowledge_id, knowledge_version) references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (relationship_id, relationship_version) references public.atlas_knowledge_relationships(relationship_id, relationship_version),
  constraint atlas_knowledge_gap_links_target_chk check (
    ((knowledge_id is not null and knowledge_version is not null) and relationship_id is null and relationship_version is null)
    or
    ((relationship_id is not null and relationship_version is not null) and knowledge_id is null and knowledge_version is null)
  ),
  unique nulls not distinct (gap_id, knowledge_id, knowledge_version, relationship_id, relationship_version)
);

-- C8 — Z1→Z5 output identity must carry its hash
alter table public.atlas_generation_z5_outputs alter column output_hash set not null;

-- R1 (recommended, non-binding) — type-specific FKs to protected Z5 stores (live PKs are single text ids)
alter table public.atlas_generation_z5_outputs
  add column work_decomposition_id text references public.atlas_work_decompositions(decomposition_id),
  add column work_definition_id text references public.atlas_work_definitions(work_definition_id),
  add constraint atlas_generation_z5_outputs_target_chk check (
    (output_kind = 'WORK_DECOMPOSITION' and work_decomposition_id = output_id and work_definition_id is null)
    or
    (output_kind = 'WORK_DEFINITION' and work_definition_id = output_id and work_decomposition_id is null)
  );

-- C2 — database-enforced append-only semantics (QA decision on ATL-82 open question 1)
create or replace function public.atlas_guard_append_only() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  col text;
  o jsonb;
  n jsonb;
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'append-only: TRUNCATE on % is not permitted', tg_table_name using errcode = 'P0001';
  elsif tg_op = 'DELETE' then
    raise exception 'append-only: DELETE on % is not permitted; supersede with a successor version', tg_table_name using errcode = 'P0001';
  end if;
  o := to_jsonb(old);
  n := to_jsonb(new);
  for col in select jsonb_object_keys(n) loop
    if not (col = any (tg_argv)) and (o -> col) is distinct from (n -> col) then
      raise exception 'append-only: %.% is immutable; create a successor version', tg_table_name, col using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

create trigger atlas_entity_types_append_only before update or delete on public.atlas_knowledge_entity_types for each row execute function public.atlas_guard_append_only('status');
create trigger atlas_relationship_types_append_only before update or delete on public.atlas_knowledge_relationship_types for each row execute function public.atlas_guard_append_only('status');
create trigger atlas_entities_append_only before update or delete on public.atlas_knowledge_entities for each row execute function public.atlas_guard_append_only('lifecycle_status','updated_at');
create trigger atlas_relationships_append_only before update or delete on public.atlas_knowledge_relationships for each row execute function public.atlas_guard_append_only('lifecycle_status');
create trigger atlas_evidence_links_append_only before update or delete on public.atlas_knowledge_evidence_links for each row execute function public.atlas_guard_append_only();
create trigger atlas_evidence_sources_append_only before update or delete on public.atlas_evidence_sources for each row execute function public.atlas_guard_append_only();
create trigger atlas_gap_links_append_only before update or delete on public.atlas_knowledge_gap_links for each row execute function public.atlas_guard_append_only();
create trigger atlas_generation_runs_append_only before update or delete on public.atlas_knowledge_generation_runs for each row execute function public.atlas_guard_append_only('run_status');
create trigger atlas_z5_outputs_append_only before update or delete on public.atlas_generation_z5_outputs for each row execute function public.atlas_guard_append_only();
-- statement-level TRUNCATE guard on every protected new table (RLS does not govern TRUNCATE)
create trigger atlas_entity_types_no_truncate before truncate on public.atlas_knowledge_entity_types for each statement execute function public.atlas_guard_append_only();
create trigger atlas_relationship_types_no_truncate before truncate on public.atlas_knowledge_relationship_types for each statement execute function public.atlas_guard_append_only();
create trigger atlas_entities_no_truncate before truncate on public.atlas_knowledge_entities for each statement execute function public.atlas_guard_append_only();
create trigger atlas_relationships_no_truncate before truncate on public.atlas_knowledge_relationships for each statement execute function public.atlas_guard_append_only();
create trigger atlas_evidence_links_no_truncate before truncate on public.atlas_knowledge_evidence_links for each statement execute function public.atlas_guard_append_only();
create trigger atlas_evidence_sources_no_truncate before truncate on public.atlas_evidence_sources for each statement execute function public.atlas_guard_append_only();
create trigger atlas_gap_links_no_truncate before truncate on public.atlas_knowledge_gap_links for each statement execute function public.atlas_guard_append_only();
create trigger atlas_generation_runs_no_truncate before truncate on public.atlas_knowledge_generation_runs for each statement execute function public.atlas_guard_append_only();
create trigger atlas_z5_outputs_no_truncate before truncate on public.atlas_generation_z5_outputs for each statement execute function public.atlas_guard_append_only();

-- C1 — mirror the established P6.2 protected-IP pattern (and go one step further: no TRUNCATE for service_role)
revoke all on table
  public.atlas_knowledge_entity_types, public.atlas_knowledge_relationship_types,
  public.atlas_knowledge_generation_runs, public.atlas_knowledge_entities,
  public.atlas_knowledge_relationships, public.atlas_knowledge_evidence_links,
  public.atlas_readiness_runs, public.atlas_readiness_evidence, public.atlas_generation_z5_outputs,
  public.atlas_evidence_sources, public.atlas_knowledge_gap_links
from anon, authenticated, service_role;
grant select, insert, update, delete on table
  public.atlas_knowledge_entity_types, public.atlas_knowledge_relationship_types,
  public.atlas_knowledge_generation_runs, public.atlas_knowledge_entities,
  public.atlas_knowledge_relationships, public.atlas_knowledge_evidence_links,
  public.atlas_readiness_runs, public.atlas_readiness_evidence, public.atlas_generation_z5_outputs,
  public.atlas_evidence_sources, public.atlas_knowledge_gap_links
to service_role;
alter table public.atlas_evidence_sources enable row level security;
alter table public.atlas_knowledge_gap_links enable row level security;
revoke execute on function public.atlas_guard_append_only() from public, anon, authenticated;

commit;
SQL
cat > "$W/post.sql" <<'SQL'
\pset footer off
\set ON_ERROR_STOP 0
-- fixtures (owner, disposable test DB only)
insert into atlas_workspaces(id) values ('00000000-0000-0000-0000-00000000000a');
insert into atlas_knowledge_gaps(id,gap_key,status,kind) values ('00000000-0000-0000-0000-0000000000b1','G-1','OPEN','KNOWLEDGE_GAP');
insert into atlas_knowledge_entity_types values ('ET-TEST','1.0.0','Test','t',null,'{"type":"object"}','CANDIDATE','C1','h1');
insert into atlas_knowledge_relationship_types values ('RT-TEST','1.0.0','Rel','r','{}','{}','{"type":"object"}','CANDIDATE','C1','h2');
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K1','1','M','Z1','ET-TEST','1.0.0','A','def','SUPPORTED','C1','1','hk1'),('K2','1','M','Z1','ET-TEST','1.0.0','B','def','SUPPORTED','C1','1','hk2');
insert into atlas_knowledge_relationships (relationship_id,relationship_version,module_id,ownership_zone,relationship_type,relationship_type_version,from_knowledge_id,from_knowledge_version,to_knowledge_id,to_knowledge_version,support_state,governing_contract_id,governing_contract_version,content_hash) values ('R1','1','M','Z1','RT-TEST','1.0.0','K1','1','K2','1','SUPPORTED','C1','1','hr1');
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref) values ('S-CFR','AUTHORITATIVE_RESEARCH','regulation','49 CFR 172.202');
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-BOL','CLIENT_PROVIDED','client_document','doc-uuid-1','00000000-0000-0000-0000-00000000000a');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,source_id,support_role) values ('L1','K1','1','S-CFR','SUPPORTS');
insert into atlas_knowledge_generation_runs (run_id,generator_contract_id,generator_contract_version,generator_implementation_identity,consumed_knowledge_manifest,consumed_knowledge_manifest_hash) values ('G1','GC','1','impl','{}','mh');
insert into atlas_work_definitions values ('WD-1','M','1','1','hwd');

\echo '== P-C3 relationship defaults to CANDIDATE (expect CANDIDATE)'
select relationship_id, lifecycle_status from atlas_knowledge_relationships;
\echo '== P-C2a legitimate lifecycle promotion of entity + type status (expect success, 2 rows)'
update atlas_knowledge_entities set lifecycle_status='VALIDATED', updated_at=now() where knowledge_id='K1';
update atlas_knowledge_entity_types set status='VALIDATED' where type_id='ET-TEST';
select 'entity '||lifecycle_status from atlas_knowledge_entities where knowledge_id='K1' union all select 'type '||status from atlas_knowledge_entity_types where type_id='ET-TEST';
\echo '== P-C2b pinned type contract edited in place (expect ERROR append-only)'
update atlas_knowledge_entity_types set schema_contract='{"type":"object","required":["new_field"]}' where type_id='ET-TEST';
\echo '== P-C2c knowledge definition rewritten in place (expect ERROR append-only)'
update atlas_knowledge_entities set definition='silently rewritten' where knowledge_id='K1';
\echo '== P-C2d DELETE semantic row (expect ERROR append-only)'
delete from atlas_knowledge_relationships where relationship_id='R1';
\echo '== P-C2e TRUNCATE as table owner (expect ERROR append-only)'
truncate atlas_knowledge_evidence_links;
\echo '== P-C2f generation run manifest rewritten (expect ERROR); status transition (expect success)'
update atlas_knowledge_generation_runs set consumed_knowledge_manifest='{"forged":true}' where run_id='G1';
update atlas_knowledge_generation_runs set run_status='VALIDATED' where run_id='G1';
select run_id, run_status from atlas_knowledge_generation_runs;
\echo '== P-C1a authenticated: SELECT (expect permission denied) and TRUNCATE (expect permission denied)'
set role authenticated;
select count(*) from atlas_knowledge_entities;
truncate atlas_knowledge_evidence_links;
reset role;
\echo '== P-C1b service_role: SELECT allowed (expect count), TRUNCATE denied (expect permission denied)'
set role service_role;
select count(*) as service_role_visible_entities from atlas_knowledge_entities;
truncate atlas_knowledge_evidence_links;
reset role;
\echo '== P-C1c grants to anon/authenticated on new tables (expect no rows)'
select table_name, grantee from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name like any (array['atlas_knowledge_entit%','atlas_knowledge_rel%','atlas_knowledge_evidence%','atlas_knowledge_gen%','atlas_knowledge_gap_links','atlas_readiness_%','atlas_generation_%','atlas_evidence_sources']);
\echo '== P-C1d guard function not executable by anon/authenticated (expect f,f)'
select has_function_privilege('anon','public.atlas_guard_append_only()','EXECUTE') as anon_exec, has_function_privilege('authenticated','public.atlas_guard_append_only()','EXECUTE') as authenticated_exec;
\echo '== P-C4a same source registered twice under a different class (expect ERROR unique)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-CFR-2','CLIENT_PROVIDED','regulation','49 CFR 172.202','00000000-0000-0000-0000-00000000000a');
\echo '== P-C4b client evidence without workspace (expect ERROR client_scope)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref) values ('S-X','CLIENT_PROVIDED','client_document','doc-uuid-9');
\echo '== P-C4c authoritative research scoped to a client workspace (expect ERROR research_scope)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-Y','AUTHORITATIVE_RESEARCH','regulation','49 CFR 373.101','00000000-0000-0000-0000-00000000000a');
\echo '== P-C4d link class is derived from its source (expect K1 <- AUTHORITATIVE_RESEARCH)'
select l.knowledge_id, s.source_class from atlas_knowledge_evidence_links l join atlas_evidence_sources s using (source_id);
\echo '== P-C7a valid gap link to entity (expect success) then half-key and nonexistent gap (expect 2 ERRORs)'
insert into atlas_knowledge_gap_links (gap_id,knowledge_id,knowledge_version) values ('00000000-0000-0000-0000-0000000000b1','K2','1');
insert into atlas_knowledge_gap_links (gap_id,knowledge_id) values ('00000000-0000-0000-0000-0000000000b1','K2');
insert into atlas_knowledge_gap_links (gap_id,relationship_id,relationship_version) values ('00000000-0000-0000-0000-0000000000ff','R1','1');
select count(*) as gap_links from atlas_knowledge_gap_links;
\echo '== P-C8 Z5 output with NULL hash (expect ERROR not-null)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash,work_definition_id) values ('G1','WORK_DEFINITION','WD-1','1',null,'WD-1');
\echo '== P-R1a Z5 output pointing at nonexistent WorkDefinition (expect ERROR fk)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash,work_definition_id) values ('G1','WORK_DEFINITION','WD-NOPE','1','h','WD-NOPE');
\echo '== P-R1b valid Z5 output (expect success) and kind/target mismatch (expect ERROR target_chk)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash,work_definition_id) values ('G1','WORK_DEFINITION','WD-1','1','hwd','WD-1');
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash,work_definition_id) values ('G1','WORK_DECOMPOSITION','WD-1','2','hwd','WD-1');
select run_id, output_kind, output_id from atlas_generation_z5_outputs;
\echo '== REGRESSION: original passing controls still hold (expect 3 ERRORs: FK pin, target_chk, readiness vocab)'
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K9','1','M','Z1','ET-TEST','9.9.9','X','d','SUPPORTED','C1','1','h');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,relationship_id,relationship_version,source_id,support_role) values ('L2','K1','1','R1','1','S-CFR','SUPPORTS');
insert into atlas_readiness_runs (readiness_run_id,module_id,resolver_contract_id,resolver_contract_version,knowledge_generation_run_id,input_manifest,input_manifest_hash,readiness_state) values ('RR0','M','RC','1','G1','{}','ih','MOSTLY_READY');
SQL
cat > "$W/down.sql" <<'SQL'
\set ON_ERROR_STOP 1
-- seed protected-stub rows that must survive the drop
insert into atlas_work_definitions values ('WD-KEEP','M','1','1','hkeep');
insert into atlas_knowledge_gaps(id,gap_key,status,kind) values ('00000000-0000-0000-0000-0000000000c1','G-KEEP','OPEN','KNOWLEDGE_GAP');
\echo '== PHASE-4a drop corrected structures (reverse dependency order, one statement per table)'
drop table public.atlas_knowledge_gap_links;
drop table public.atlas_generation_z5_outputs;
drop table public.atlas_readiness_evidence;
drop table public.atlas_readiness_runs;
drop table public.atlas_knowledge_evidence_links;
drop table public.atlas_evidence_sources;
drop table public.atlas_knowledge_relationships;
drop table public.atlas_knowledge_entities;
drop table public.atlas_knowledge_generation_runs;
drop table public.atlas_knowledge_relationship_types;
drop table public.atlas_knowledge_entity_types;
drop function public.atlas_guard_append_only();
select count(*) as new_structures_remaining from pg_tables where schemaname='public' and tablename in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_knowledge_evidence_links','atlas_readiness_runs','atlas_readiness_evidence','atlas_generation_z5_outputs','atlas_evidence_sources','atlas_knowledge_gap_links');
select (select count(*) from atlas_work_definitions where work_definition_id='WD-KEEP') as protected_stub_row_intact, (select count(*) from atlas_knowledge_gaps where gap_key='G-KEEP') as gap_row_intact;
SQL
cat > "$W/rebuild.sql" <<'SQL'
\echo '== PHASE-4b rebuild verification (after re-applying candidate + corrections)'
select count(*) as rebuilt_structures from pg_tables where schemaname='public' and tablename in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_knowledge_evidence_links','atlas_readiness_runs','atlas_readiness_evidence','atlas_generation_z5_outputs','atlas_evidence_sources','atlas_knowledge_gap_links');
select count(*) as append_only_triggers from pg_trigger where tgname like 'atlas_%append_only' or tgname like 'atlas_%no_truncate';
select (select count(*) from atlas_work_definitions where work_definition_id='WD-KEEP') as protected_stub_row_still_intact;
SQL
sed 's/^rollback;$/commit;/' "$CAND" > "$W/candidate_commit.sql"
fresh() { $PSQL -d postgres -c "drop database if exists $1" -c "create database $1"; $PSQL -v ON_ERROR_STOP=1 -d "$1" -f "$W/harness.sql"; }
echo "== PHASE-1 candidate as written"; fresh atl83_p1; $PSQL -v ON_ERROR_STOP=1 -d atl83_p1 -f "$CAND"
$PSQL -At -d atl83_p1 -c "select 'PHASE-1 ATL-82 tables remaining after ROLLBACK: '||count(*) from pg_tables where schemaname='public' and tablename in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_knowledge_evidence_links','atlas_readiness_runs','atlas_readiness_evidence','atlas_generation_z5_outputs')"
echo "== PHASE-2 defect probes (unmodified candidate, committed copy)"; fresh atl83_p2; $PSQL -v ON_ERROR_STOP=1 -d atl83_p2 -f "$W/candidate_commit.sql"; $PSQL -d atl83_p2 -f "$W/probes.sql" 2>&1 || true
echo "== PHASE-3 reference corrections + post-correction tests"; fresh atl83_p3; $PSQL -v ON_ERROR_STOP=1 -d atl83_p3 -f "$W/candidate_commit.sql"; $PSQL -v ON_ERROR_STOP=1 -d atl83_p3 -f "$W/corrections.sql"; $PSQL -d atl83_p3 -f "$W/post.sql" 2>&1 || true
echo "== PHASE-4 drop and rebuild"; fresh atl83_p4; $PSQL -v ON_ERROR_STOP=1 -d atl83_p4 -f "$W/candidate_commit.sql"; $PSQL -v ON_ERROR_STOP=1 -d atl83_p4 -f "$W/corrections.sql"; $PSQL -d atl83_p4 -f "$W/down.sql"; $PSQL -v ON_ERROR_STOP=1 -d atl83_p4 -f "$W/candidate_commit.sql"; $PSQL -v ON_ERROR_STOP=1 -d atl83_p4 -f "$W/corrections.sql"; $PSQL -d atl83_p4 -f "$W/rebuild.sql"
for d in atl83_p1 atl83_p2 atl83_p3 atl83_p4; do $PSQL -d postgres -c "drop database if exists $d"; done
echo "== ATL-83 test pack complete"
