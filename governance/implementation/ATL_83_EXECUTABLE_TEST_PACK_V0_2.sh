#!/usr/bin/env bash
# ATL-83 — Executable bounded re-QA test pack for ATL-82 candidate V0.2 (pack V0.2)
# Author: Claude (independent QA), 2026-09-23. Reproduces every result in
# governance/implementation/ATL_83_BOUNDED_REQA_ATL_82_V0_2_V0_1.md.
#
# SAFETY: runs ONLY against a disposable local PostgreSQL (>=15). It never connects to Supabase.
#   Required: ATL83_DISPOSABLE=1, PGHOST is a local socket dir or localhost/127.0.0.1, superuser PGUSER.
#   Usage:    ATL83_DISPOSABLE=1 PGHOST=/var/tmp PGPORT=55433 PGUSER=postgres \
#             ./ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh <path-to-ATL_82_CANDIDATE_PHYSICAL_MIGRATION_V0_2.sql>
# The harness mirrors live Supabase default privileges (GRANT ALL on new public tables to anon,
# authenticated, service_role). On PostgreSQL 16 that is arwdDxt; PostgreSQL 17 adds MAINTAIN (m).
# Phases (each in its own fresh database):
#   PHASE-0 identity and static checks on the pinned V0.2 file
#   PHASE-1 V0.2 exactly as written, one transaction with ON_ERROR_STOP (as a migration would run)
#   PHASE-2 DIAGNOSTIC-A: V0.2 with only the two dollar-quote tokens repaired (diff asserted = lines 214, 226)
#           -> full correction-closure suite; shows every correction except the zero-argument guard gap
#   PHASE-3 DIAGNOSTIC-B: DIAGNOSTIC-A plus a one-line guard repair on line 221
#           (tg_argv -> coalesce(tg_argv, '{}'::text[])) -> the same suite, expected all-closed
#   PHASE-4 DIAGNOSTIC-B drop every structure (protected stub rows survive), then rebuild
# The diagnostic diffs are asserted: the pack exits 4 if either copy changes any other line.
# Diagnostic copies are NOT the artifact under QA and are not builder artifacts; the builder owns V0.3.
set -uo pipefail
CAND="${1:?path to ATL-82 candidate V0.2 SQL required}"
[ "${ATL83_DISPOSABLE:-}" = "1" ] || { echo "refusing: set ATL83_DISPOSABLE=1 for a disposable local PostgreSQL" >&2; exit 2; }
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refusing: PGHOST must be a local socket dir or localhost" >&2; exit 2;; esac
case "${PGHOST:-}${PGDATABASE:-}" in *supabase*|*pooler*) echo "refusing: Supabase target detected" >&2; exit 2;; esac
EXPECT_BLOB=344d0d4fed7fd5ae7d271764ba1f10e0d7552d63
command -v git >/dev/null || { echo "git required for blob pin" >&2; exit 3; }
GOT=$(git hash-object "$CAND"); [ "$GOT" = "$EXPECT_BLOB" ] || { echo "candidate blob $GOT != pinned $EXPECT_BLOB" >&2; exit 3; }
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
cat > "$W/argv.sql" <<'SQL'
\pset footer off
create temp table argv_probe(v text);
create or replace function pg_temp.show_argv() returns trigger language plpgsql as $$ begin insert into argv_probe values (tg_nargs::text||' args; tg_argv is '||case when tg_argv is null then 'NULL' else 'array '||tg_argv::text end); return new; end $$;
create temp table t_noarg(x int); create temp table t_arg(x int);
create trigger a before insert on t_noarg for each row execute function pg_temp.show_argv();
create trigger b before insert on t_arg for each row execute function pg_temp.show_argv('status');
insert into t_noarg values (1); insert into t_arg values (1);
\echo '== B2-MECHANISM value of TG_ARGV inside a PL/pgSQL trigger (zero-argument vs one-argument trigger)'
select v from argv_probe;
SQL
cat > "$W/closure.sql" <<'SQL'
\pset footer off
\set ON_ERROR_STOP 0
-- fixtures (table owner, disposable test DB only)
insert into atlas_workspaces(id) values ('00000000-0000-0000-0000-00000000000a');
insert into atlas_knowledge_gaps(id,gap_key,status,kind) values ('00000000-0000-0000-0000-0000000000b1','G-1','OPEN','KNOWLEDGE_GAP');
insert into atlas_knowledge_entity_types values ('ET-TEST','1.0.0','Test','t',null,'{"type":"object"}','CANDIDATE','C1','h1');
insert into atlas_knowledge_relationship_types values ('RT-TEST','1.0.0','Rel','r','{}','{}','{"type":"object"}','CANDIDATE','C1','h2');
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K1','1','M','Z1','ET-TEST','1.0.0','A','def','SUPPORTED','C1','1','hk1'),('K2','1','M','Z1','ET-TEST','1.0.0','B','def','SUPPORTED','C1','1','hk2');
insert into atlas_knowledge_relationships (relationship_id,relationship_version,module_id,ownership_zone,relationship_type,relationship_type_version,from_knowledge_id,from_knowledge_version,to_knowledge_id,to_knowledge_version,support_state,governing_contract_id,governing_contract_version,content_hash) values ('R1','1','M','Z1','RT-TEST','1.0.0','K1','1','K2','1','SUPPORTED','C1','1','hr1');
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref) values ('S-CFR','AUTHORITATIVE_RESEARCH','regulation','49 CFR 172.202');
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-BOL','CLIENT_PROVIDED','client_document','doc-uuid-1','00000000-0000-0000-0000-00000000000a');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,source_id,support_role) values ('L1','K1','1','S-CFR','SUPPORTS'),('L2','K2','1','S-BOL','SUPPORTS');
insert into atlas_knowledge_generation_runs (run_id,generator_contract_id,generator_contract_version,generator_implementation_identity,consumed_knowledge_manifest,consumed_knowledge_manifest_hash) values ('G1','GC','1','impl','{}','mh');
insert into atlas_work_definitions values ('WD-1','M','1','1','hwd');
select 'fixtures loaded: entities='||(select count(*) from atlas_knowledge_entities)||' links='||(select count(*) from atlas_knowledge_evidence_links) as fixtures;

\echo '== C1a grants to anon/authenticated on the 9 V0.2 tables (expect no rows)'
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs') group by 1,2 order by 1,2;
\echo '== C1b service_role privileges per table (expect DELETE,INSERT,SELECT,UPDATE on each of the 9; no TRUNCATE/REFERENCES/TRIGGER)'
select table_name, string_agg(privilege_type, ',' order by privilege_type) as service_role_privs from information_schema.role_table_grants where table_schema='public' and grantee='service_role' and table_name in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs') group by 1 order by 1;
\echo '== C1c authenticated: SELECT and TRUNCATE (expect 2x permission denied)'
set role authenticated;
select count(*) from atlas_knowledge_entities;
truncate atlas_knowledge_evidence_links;
reset role;
\echo '== C1d anon: SELECT (expect permission denied)'
set role anon;
select count(*) from atlas_evidence_sources;
reset role;
\echo '== C1e service_role: SELECT allowed (expect 2), TRUNCATE (expect permission denied)'
set role service_role;
select count(*) as service_role_visible_entities from atlas_knowledge_entities;
truncate atlas_knowledge_evidence_links;
reset role;
\echo '== C1f guard function EXECUTE for anon/authenticated (expect f,f) and RLS on all 9 tables (expect 9)'
select has_function_privilege('anon','public.atlas_guard_append_only()','EXECUTE') as anon_exec, has_function_privilege('authenticated','public.atlas_guard_append_only()','EXECUTE') as authenticated_exec, (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity and c.relname in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs')) as rls_tables;

\echo '== C2a legitimate lifecycle/status promotion on entity, type and relationship (expect success, 3 rows)'
update atlas_knowledge_entities set lifecycle_status='VALIDATED', updated_at=now() where knowledge_id='K1';
update atlas_knowledge_entity_types set status='VALIDATED' where type_id='ET-TEST';
update atlas_knowledge_relationships set lifecycle_status='VALIDATED' where relationship_id='R1';
select 'entity '||lifecycle_status from atlas_knowledge_entities where knowledge_id='K1' union all select 'type '||status from atlas_knowledge_entity_types where type_id='ET-TEST' union all select 'relationship '||lifecycle_status from atlas_knowledge_relationships where relationship_id='R1';
\echo '== C2b pinned type contract edited in place (expect ERROR append-only)'
update atlas_knowledge_entity_types set schema_contract='{"type":"object","required":["new_field"]}' where type_id='ET-TEST';
\echo '== C2n relationship-type contract edited in place (expect ERROR append-only); relationship-type status promotion (expect success)'
update atlas_knowledge_relationship_types set schema_contract='{"type":"object","required":["new_field"]}' where type_id='RT-TEST';
update atlas_knowledge_relationship_types set status='VALIDATED' where type_id='RT-TEST';
select type_id, status, schema_contract from atlas_knowledge_relationship_types where type_id='RT-TEST';
\echo '== C2p DELETE of a relationship-type row (expect ERROR append-only)'
delete from atlas_knowledge_relationship_types where type_id='RT-TEST';
\echo '== C2c knowledge definition rewritten in place (expect ERROR append-only)'
update atlas_knowledge_entities set definition='silently rewritten' where knowledge_id='K1';
\echo '== C2d relationship semantic payload rewritten in place (expect ERROR append-only)'
update atlas_knowledge_relationships set semantic_payload='{"x":1}' where relationship_id='R1';
\echo '== C2e evidence source reclassified in place (expect ERROR append-only)'
update atlas_evidence_sources set source_class='GOVERNED_INTERNAL' where source_id='S-CFR';
\echo '== C2j evidence link support role flipped in place (expect ERROR append-only)'
update atlas_knowledge_evidence_links set support_role='CONFLICTS' where link_id='L1';
\echo '== C2f DELETE semantic row (expect ERROR append-only)'
delete from atlas_knowledge_relationships where relationship_id='R1';
\echo '== C2g TRUNCATE as table owner (expect ERROR append-only)'
truncate atlas_knowledge_evidence_links;
\echo '== C2h generation run manifest rewritten (expect ERROR); run_status transition (expect success)'
update atlas_knowledge_generation_runs set consumed_knowledge_manifest='{"forged":true}' where run_id='G1';
update atlas_knowledge_generation_runs set run_status='VALIDATED' where run_id='G1';
select run_id, run_status from atlas_knowledge_generation_runs;
\echo '== C2i guard triggers present (expect 18: 9 row-level + 9 TRUNCATE)'
select count(*) as guard_triggers from pg_trigger where not tgisinternal and tgfoid='public.atlas_guard_append_only'::regproc;

\echo '== C3a relationship lifecycle column exists and defaults to CANDIDATE (expect 1 and CANDIDATE for a fresh row)'
insert into atlas_knowledge_relationships (relationship_id,relationship_version,module_id,ownership_zone,relationship_type,relationship_type_version,from_knowledge_id,from_knowledge_version,to_knowledge_id,to_knowledge_version,support_state,governing_contract_id,governing_contract_version,content_hash) values ('R2','1','M','Z1','RT-TEST','1.0.0','K2','1','K1','1','SUPPORTED','C1','1','hr2');
select (select count(*) from information_schema.columns where table_name='atlas_knowledge_relationships' and column_name='lifecycle_status') as lifecycle_column, lifecycle_status from atlas_knowledge_relationships where relationship_id='R2';
\echo '== C3b invalid relationship lifecycle value (expect ERROR check)'
insert into atlas_knowledge_relationships (relationship_id,relationship_version,module_id,ownership_zone,relationship_type,relationship_type_version,from_knowledge_id,from_knowledge_version,to_knowledge_id,to_knowledge_version,support_state,governing_contract_id,governing_contract_version,content_hash,lifecycle_status) values ('R3','1','M','Z1','RT-TEST','1.0.0','K2','1','K1','1','SUPPORTED','C1','1','hr3','LIVE');

\echo '== C4a same source registered twice under a different class (expect ERROR unique)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-CFR-2','CLIENT_PROVIDED','regulation','49 CFR 172.202','00000000-0000-0000-0000-00000000000a');
\echo '== C4b client evidence without workspace (expect ERROR client_scope)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref) values ('S-X','CLIENT_PROVIDED','client_document','doc-uuid-9');
\echo '== C4c authoritative research scoped to a client workspace (expect ERROR research_scope)'
insert into atlas_evidence_sources (source_id,source_class,evidence_source_kind,evidence_ref,workspace_id) values ('S-Y','AUTHORITATIVE_RESEARCH','regulation','49 CFR 373.101','00000000-0000-0000-0000-00000000000a');
\echo '== C4d link class derived from its source (expect K1 AUTHORITATIVE_RESEARCH, K2 CLIENT_PROVIDED)'
select l.knowledge_id, s.source_class from atlas_knowledge_evidence_links l join atlas_evidence_sources s using (source_id) order by 1;
\echo '== C4e source-level columns absent from the link table (expect 0)'
select count(*) as source_level_columns_on_link from information_schema.columns where table_name='atlas_knowledge_evidence_links' and column_name in ('source_class','evidence_source_kind','evidence_ref','authority_class');
\echo '== C4f link without a source (expect ERROR not-null)'
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,support_role) values ('L9','K1','1','SUPPORTS');

\echo '== C7a valid gap link to entity (expect success), then half-key, nonexistent gap and duplicate (expect 3 ERRORs)'
insert into atlas_knowledge_gap_links (gap_id,knowledge_id,knowledge_version) values ('00000000-0000-0000-0000-0000000000b1','K2','1');
insert into atlas_knowledge_gap_links (gap_id,knowledge_id) values ('00000000-0000-0000-0000-0000000000b1','K2');
insert into atlas_knowledge_gap_links (gap_id,relationship_id,relationship_version) values ('00000000-0000-0000-0000-0000000000ff','R1','1');
insert into atlas_knowledge_gap_links (gap_id,knowledge_id,knowledge_version) values ('00000000-0000-0000-0000-0000000000b1','K2','1');
select count(*) as gap_links from atlas_knowledge_gap_links;
\echo '== C2k gap link retargeted in place (expect ERROR append-only)'
update atlas_knowledge_gap_links set knowledge_id='K1' where knowledge_id='K2';

\echo '== C8a Z5 output with NULL hash (expect ERROR not-null)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash) values ('G1','WORK_DEFINITION','WD-1','1',null);
\echo '== C8b valid Z5 output with hash (expect success)'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash) values ('G1','WORK_DEFINITION','WD-1','1','hwd');
\echo '== C2m Z5 lineage hash overwritten in place (expect ERROR append-only)'
update atlas_generation_z5_outputs set output_hash='hash-forged' where output_id='WD-1';
\echo '== C2-READBACK values after the in-place attempts (expect originals: AUTHORITATIVE_RESEARCH / SUPPORTS / K2 / hwd)'
select (select source_class from atlas_evidence_sources where source_id='S-CFR') as s_cfr_class, (select support_role from atlas_knowledge_evidence_links where link_id='L1') as l1_role, (select knowledge_id from atlas_knowledge_gap_links) as gap_target, (select output_hash from atlas_generation_z5_outputs where output_id='WD-1') as wd1_hash;
\echo '== R1-INFO (non-binding, not adopted in V0.2): output naming a nonexistent WorkDefinition is still accepted'
insert into atlas_generation_z5_outputs (run_id,output_kind,output_id,output_version,output_hash) values ('G1','WORK_DEFINITION','WD-DOES-NOT-EXIST','1','hx');
select output_id, (select count(*) from atlas_work_definitions w where w.work_definition_id=o.output_id) as target_rows from atlas_generation_z5_outputs o order by 1;

\echo '== D1A Z6 readiness tables absent from V0.2 (expect 0)'
select count(*) as readiness_tables from pg_tables where schemaname='public' and tablename like 'atlas_readiness%';

\echo '== REGRESSION (controls that passed on V0.1; expect 5 ERRORs then the pinned-type delete blocked)'
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K9','1','M','Z1','ET-TEST','9.9.9','X','d','SUPPORTED','C1','1','h');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,knowledge_version,relationship_id,relationship_version,source_id,support_role) values ('L3','K1','1','R1','1','S-CFR','SUPPORTS');
insert into atlas_knowledge_evidence_links (link_id,knowledge_id,source_id,support_role) values ('L4','K1','S-CFR','SUPPORTS');
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K8','1','M','Z9','ET-TEST','1.0.0','X','d','SUPPORTED','C1','1','h');
insert into atlas_knowledge_entities (knowledge_id,knowledge_version,module_id,ownership_zone,entity_type,entity_type_version,canonical_name,definition,support_state,governing_contract_id,governing_contract_version,content_hash) values ('K7','1','M','Z1','ET-TEST','1.0.0','X','d','PROBABLY_TRUE','C1','1','h');
delete from atlas_knowledge_entity_types where type_id='ET-TEST';
select count(*) as pinned_type_rows_after_delete_attempt from atlas_knowledge_entity_types where type_id='ET-TEST';
SQL
cat > "$W/down.sql" <<'SQL'
\set ON_ERROR_STOP 1
insert into atlas_work_definitions values ('WD-KEEP','M','1','1','hkeep');
insert into atlas_knowledge_gaps(id,gap_key,status,kind) values ('00000000-0000-0000-0000-0000000000c1','G-KEEP','OPEN','KNOWLEDGE_GAP');
\echo '== DOWN drop V0.2 structures (reverse dependency order, one statement per table)'
drop table public.atlas_knowledge_gap_links;
drop table public.atlas_generation_z5_outputs;
drop table public.atlas_knowledge_evidence_links;
drop table public.atlas_evidence_sources;
drop table public.atlas_knowledge_relationships;
drop table public.atlas_knowledge_entities;
drop table public.atlas_knowledge_generation_runs;
drop table public.atlas_knowledge_relationship_types;
drop table public.atlas_knowledge_entity_types;
drop function public.atlas_guard_append_only();
select count(*) as v02_structures_remaining from pg_tables where schemaname='public' and tablename in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs');
select (select count(*) from atlas_work_definitions where work_definition_id='WD-KEEP') as protected_stub_row_intact, (select count(*) from atlas_knowledge_gaps where gap_key='G-KEEP') as gap_row_intact;
SQL
cat > "$W/rebuild.sql" <<'SQL'
\echo '== REBUILD verification (after re-applying the repaired V0.2 diagnostic copy)'
select count(*) as rebuilt_structures from pg_tables where schemaname='public' and tablename in ('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs');
select count(*) as guard_triggers from pg_trigger where not tgisinternal and tgfoid='public.atlas_guard_append_only'::regproc;
select (select count(*) from atlas_work_definitions where work_definition_id='WD-KEEP') as protected_stub_row_still_intact, (select count(*) from atlas_knowledge_gaps where gap_key='G-KEEP') as gap_row_still_intact;
SQL
fresh() { $PSQL -d postgres -c "drop database if exists $1" -c "create database $1" 2>&1 | grep -v 'does not exist, skipping'; $PSQL -v ON_ERROR_STOP=1 -d "$1" -f "$W/harness.sql"; }
V9="('atlas_knowledge_entity_types','atlas_knowledge_relationship_types','atlas_knowledge_generation_runs','atlas_knowledge_entities','atlas_knowledge_relationships','atlas_evidence_sources','atlas_knowledge_evidence_links','atlas_knowledge_gap_links','atlas_generation_z5_outputs')"

echo "== PHASE-0 identity and static checks"
echo "candidate blob pinned: $GOT"
echo "lines containing a double-dollar quote: $(grep -c '[$][$]' "$CAND")"
echo "lines ending in a lone dollar quote:"; grep -n -E '(as [$]$|end [$];$)' "$CAND"
echo "guard argument test (line 221):"; sed -n '221p' "$CAND"
echo "readiness tables created by V0.2: $(grep -c -i 'create table public.atlas_readiness' "$CAND")"
echo "V0.2 ends in: $(tail -n1 "$CAND")"

echo "== PHASE-1 V0.2 exactly as written (single transaction, ON_ERROR_STOP=1)"
fresh atl83r_p1
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p1 -f "$CAND" 2>&1; echo "PHASE-1 psql exit code: $?"
$PSQL -At -d atl83r_p1 -c "select 'PHASE-1 V0.2 tables present after the aborted transaction: '||count(*) from pg_tables where schemaname='public' and tablename in $V9"

echo "== PHASE-2 DIAGNOSTIC-A: dollar-quote repair only (not the artifact under QA)"
sed -e '214s/ as [$]$/ as $$/' -e '226s/^end [$];$/end $$;/' "$CAND" > "$W/diag_a.sql"
echo "diff V0.2 -> DIAGNOSTIC-A:"; diff "$CAND" "$W/diag_a.sql"; NA=$(diff "$CAND" "$W/diag_a.sql" | grep -c '^<'); echo "DIAGNOSTIC-A changed lines: $NA"; [ "$(diff "$CAND" "$W/diag_a.sql" | grep -E '^[0-9]' | tr '\n' ' ')" = "214c214 226c226 " ] || { echo "ASSERTION FAILED: DIAGNOSTIC-A must change exactly lines 214 and 226" >&2; exit 4; }; echo "assertion passed: DIAGNOSTIC-A changes exactly lines 214 and 226"
fresh atl83r_p2
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p2 -f "$W/diag_a.sql"; echo "DIAGNOSTIC-A as written (BEGIN..ROLLBACK) psql exit code: $?"
$PSQL -At -d atl83r_p2 -c "select 'DIAGNOSTIC-A tables remaining after ROLLBACK: '||count(*) from pg_tables where schemaname='public' and tablename in $V9"
sed 's/^rollback;$/commit;/' "$W/diag_a.sql" > "$W/diag_a_commit.sql"
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p2 -f "$W/diag_a_commit.sql"; echo "DIAGNOSTIC-A committed psql exit code: $?"
$PSQL -d atl83r_p2 -f "$W/argv.sql" 2>&1
$PSQL -d atl83r_p2 -f "$W/closure.sql" 2>&1

echo "== PHASE-3 DIAGNOSTIC-B: dollar-quote repair + zero-argument guard repair (not the artifact under QA)"
sed -e '221s/col = any (tg_argv)/col = any (coalesce(tg_argv, '"'"'{}'"'"'::text[]))/' "$W/diag_a.sql" > "$W/diag_b.sql"
echo "diff V0.2 -> DIAGNOSTIC-B:"; diff "$CAND" "$W/diag_b.sql"; NB=$(diff "$CAND" "$W/diag_b.sql" | grep -c '^<'); echo "DIAGNOSTIC-B changed lines: $NB"; [ "$(diff "$CAND" "$W/diag_b.sql" | grep -E '^[0-9]' | tr '\n' ' ')" = "214c214 221c221 226c226 " ] || { echo "ASSERTION FAILED: DIAGNOSTIC-B must change exactly lines 214, 221 and 226" >&2; exit 4; }; echo "assertion passed: DIAGNOSTIC-B changes exactly lines 214, 221 and 226"
fresh atl83r_p3
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p3 -f "$W/diag_b.sql"; echo "DIAGNOSTIC-B as written (BEGIN..ROLLBACK) psql exit code: $?"
sed 's/^rollback;$/commit;/' "$W/diag_b.sql" > "$W/diag_b_commit.sql"
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p3 -f "$W/diag_b_commit.sql"; echo "DIAGNOSTIC-B committed psql exit code: $?"
$PSQL -d atl83r_p3 -f "$W/closure.sql" 2>&1

echo "== PHASE-4 DIAGNOSTIC-B drop and rebuild"
fresh atl83r_p4
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p4 -f "$W/diag_b_commit.sql"
$PSQL -d atl83r_p4 -f "$W/down.sql"
$PSQL -v ON_ERROR_STOP=1 -d atl83r_p4 -f "$W/diag_b_commit.sql"
$PSQL -d atl83r_p4 -f "$W/rebuild.sql"
for d in atl83r_p1 atl83r_p2 atl83r_p3 atl83r_p4; do $PSQL -d postgres -c "drop database if exists $d"; done
echo "== ATL-83 re-QA test pack V0.2 complete"
