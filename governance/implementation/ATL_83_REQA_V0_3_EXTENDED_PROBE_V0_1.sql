-- ATL-83 — Extended independent probe (X-series) for ATL-82 candidate V0.3 (probe V0.1)
-- Author: Claude (independent QA), 2026-09-24. Companion to
-- governance/implementation/ATL_83_BOUNDED_REQA_ATL_82_V0_3_V0_1.md (section 6).
-- Goes beyond ATL_83_CORRECTED_CANDIDATE_GATE_V0_1.sh: changes EVERY column of all 9 tables in place, deletes and
-- truncates (CASCADE) each table, checks that nothing changed, and checks the guard under service_role.
-- DISPOSABLE LOCAL DATABASE ONLY. Order of use, in one fresh database:
--   1. harness.sql   (extracted from ATL_83_EXECUTABLE_TEST_PACK_V0_2.sh, as the gate does)
--   2. the candidate with only its final ROLLBACK changed to COMMIT (the gate's commit copy)
--   3. closure.sql   (extracted from the same pack; loads the fixtures this probe needs)
--   4. this file:    psql -X -q -d <db> -f ATL_83_REQA_V0_3_EXTENDED_PROBE_V0_1.sql
-- Every probe statement is rolled back or blocked, except X7's single allowed lifecycle promotion (R2 CANDIDATE -> VALIDATED).
-- Named dollar-quote tags ($x$) are used on purpose instead of the empty tag.
\set ON_ERROR_STOP 1
do $x$ begin
  if exists (select 1 from pg_namespace where nspname in ('auth', 'storage', 'realtime', 'supabase_migrations')) then
    raise exception 'refusing: Supabase schemas present; run this probe only in a disposable local database';
  end if;
end $x$;
\pset footer off
\set ON_ERROR_STOP 0
create temp table x9(t text primary key, allow text[]);
insert into x9 values
 ('atlas_knowledge_entity_types','{status}'),('atlas_knowledge_relationship_types','{status}'),
 ('atlas_knowledge_generation_runs','{run_status}'),('atlas_knowledge_entities','{lifecycle_status,updated_at}'),
 ('atlas_knowledge_relationships','{lifecycle_status}'),('atlas_evidence_sources','{}'),
 ('atlas_knowledge_evidence_links','{}'),('atlas_knowledge_gap_links','{}'),('atlas_generation_z5_outputs','{}');

\echo '== X0 rows present in each of the 9 tables (every table needs >=1 row for the probes)'
create temp table xrows(t text, n bigint);
do $x$ declare r record; k bigint; begin for r in select t from x9 loop execute format('select count(*) from public.%I', r.t) into k; insert into xrows values (r.t, k); end loop; end $x$;
select t as table_name, n as rows from xrows order by 1;

\echo '== X1 guard triggers on the 9 tables, as PostgreSQL reports them (pg_get_triggerdef; expect 9 row triggers BEFORE UPDATE OR DELETE with the allowlist as arguments, 9 BEFORE TRUNCATE statement triggers, all enabled)'
select c.relname as table_name, tg.tgenabled as enabled, regexp_replace(pg_get_triggerdef(tg.oid), '^CREATE TRIGGER \S+ ', '') as definition
from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join x9 on x9.t = c.relname
where not tg.tgisinternal order by 1, 3;
\echo '== X1b counts (expect 18 guard triggers, 9 row, 9 truncate, 0 disabled, 0 non-guard user triggers)'
select count(*) filter (where tg.tgfoid = 'public.atlas_guard_append_only()'::regprocedure) as guard_triggers,
  count(*) filter (where tg.tgtype & 1 = 1) as row_triggers,
  count(*) filter (where tg.tgtype & 32 = 32) as truncate_triggers,
  count(*) filter (where tg.tgenabled <> 'O') as disabled,
  count(*) filter (where tg.tgfoid <> 'public.atlas_guard_append_only()'::regprocedure) as other_user_triggers
from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join x9 on x9.t = c.relname where not tg.tgisinternal;

\echo '== X3 snapshot of all 9 tables before the X2, X4 and X5 attempts'
create temp table xsnap(phase text, t text, h text);
do $x$ declare r record; hh text; begin for r in select t from x9 loop execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.t) into hh; insert into xsnap values ('before', r.t, hh); end loop; end $x$;

\echo '== X2 exhaustive column-level UPDATE matrix: every column of every table changed on one row (outcome per column)'
create temp table xres(t text, col text, dtype text, allowlisted bool, outcome text);
do $x$
declare r record; c record; v text; ok boolean;
begin
  for r in select t, allow from x9 loop
    for c in select column_name, data_type, udt_name from information_schema.columns
             where table_schema = 'public' and table_name = r.t order by ordinal_position loop
      v := case
        when c.data_type in ('text','character varying') then format('coalesce(%I, '''') || ''~x''', c.column_name)
        when c.data_type in ('integer','bigint','smallint','numeric') then format('coalesce(%I, 0) + 1', c.column_name)
        when c.data_type = 'uuid' then 'gen_random_uuid()'
        when c.data_type = 'jsonb' then format('coalesce(%I, ''{}''::jsonb) || ''{"x_probe": 1}''', c.column_name)
        when c.data_type like 'timestamp%' then format('coalesce(%I, now()) + interval ''1 day''', c.column_name)
        when c.data_type = 'date' then format('coalesce(%I, current_date) + 1', c.column_name)
        when c.data_type = 'boolean' then format('not coalesce(%I, false)', c.column_name)
        when c.data_type = 'ARRAY' then format('coalesce(%I, ''{}'') || array[''x'']::%s', c.column_name, substr(c.udt_name, 2) || '[]')
        else null end;
      if v is null then insert into xres values (r.t, c.column_name, c.data_type, c.column_name = any (r.allow), 'NOT PROBED (type)'); continue; end if;
      begin
        execute format('update public.%I set %I = %s where ctid = (select ctid from public.%I limit 1)', r.t, c.column_name, v, r.t);
        ok := true;
        raise exception using errcode = 'XP001', message = 'probe-rollback';
      exception
        when sqlstate 'XP001' then insert into xres values (r.t, c.column_name, c.data_type, c.column_name = any (r.allow), 'ALLOWED (rolled back)');
        when others then insert into xres values (r.t, c.column_name, c.data_type, c.column_name = any (r.allow),
          case when sqlerrm like 'append-only:%' then 'BLOCKED append-only' else 'OTHER: ' || left(sqlerrm, 90) end);
      end;
    end loop;
  end loop;
end $x$;
select t as table_name, col, allowlisted, outcome from xres order by t, allowlisted desc, col;
\echo '== X2 summary: non-allowlisted columns not blocked by the guard (expect 0 rows)'
select t, col, outcome from xres where not allowlisted and outcome <> 'BLOCKED append-only' order by 1, 2;
\echo '== X2 summary: allowlisted columns blocked by the guard (expect 0 rows)'
select t, col, outcome from xres where allowlisted and outcome = 'BLOCKED append-only' order by 1, 2;
\echo '== X2 totals'
select count(*) as columns_probed, count(*) filter (where not allowlisted) as immutable_columns,
  count(*) filter (where not allowlisted and outcome = 'BLOCKED append-only') as immutable_blocked,
  count(*) filter (where allowlisted) as allowlisted_columns,
  count(*) filter (where allowlisted and outcome <> 'BLOCKED append-only') as allowlisted_not_blocked,
  count(*) filter (where outcome like 'NOT PROBED%') as not_probed
from xres;

\echo '== X4 DELETE of one row on each of the 9 tables (expect 9 x BLOCKED append-only)'
create temp table xdel(t text, outcome text);
do $x$ declare r record; begin for r in select t from x9 loop
  begin execute format('delete from public.%I where ctid = (select ctid from public.%I limit 1)', r.t, r.t);
        raise exception using errcode = 'XP001', message = 'probe-rollback';
  exception when sqlstate 'XP001' then insert into xdel values (r.t, 'ALLOWED (rolled back)');
            when others then insert into xdel values (r.t, case when sqlerrm like 'append-only: DELETE%' then 'BLOCKED append-only' else 'OTHER: ' || left(sqlerrm, 90) end);
  end; end loop; end $x$;
select t as table_name, outcome from xdel order by 1;

\echo '== X5 TRUNCATE ... CASCADE on each of the 9 tables as table owner (expect 9 x BLOCKED append-only)'
create temp table xtr(t text, outcome text);
do $x$ declare r record; begin for r in select t from x9 loop
  begin execute format('truncate public.%I cascade', r.t);
        raise exception using errcode = 'XP001', message = 'probe-rollback';
  exception when sqlstate 'XP001' then insert into xtr values (r.t, 'ALLOWED (rolled back)');
            when others then insert into xtr values (r.t, case when sqlerrm like 'append-only: TRUNCATE%' then 'BLOCKED append-only' else 'OTHER: ' || left(sqlerrm, 90) end);
  end; end loop; end $x$;
select t as table_name, outcome from xtr order by 1;

\echo '== X6 all 9 tables unchanged by X2/X4/X5 (expect 9 rows, all unchanged)'
do $x$ declare r record; hh text; begin for r in select t from x9 loop execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x', r.t) into hh; insert into xsnap values ('after', r.t, hh); end loop; end $x$;
select b.t as table_name, case when b.h = a.h then 'unchanged' else 'CHANGED' end as state from xsnap b join xsnap a on a.t = b.t and a.phase = 'after' where b.phase = 'before' order by 1;

\echo '== X7 as service_role (the only writer role): allowed promotion R2 CANDIDATE -> VALIDATED succeeds, immutable edit and DELETE are blocked'
select relationship_id, lifecycle_status as before_x7 from atlas_knowledge_relationships where relationship_id = 'R2';
set role service_role;
update atlas_knowledge_relationships set lifecycle_status = 'VALIDATED' where relationship_id = 'R2' returning relationship_id, lifecycle_status as after_x7;
update atlas_evidence_sources set evidence_ref = evidence_ref || '~svc' where source_id = 'S-BOL';
update atlas_generation_z5_outputs set output_hash = 'svc-forged' where output_id = 'WD-1';
delete from atlas_knowledge_gap_links;
reset role;
select (select evidence_ref from atlas_evidence_sources where source_id = 'S-BOL') as s_bol_ref,
       (select output_hash from atlas_generation_z5_outputs where output_id = 'WD-1') as wd1_hash,
       (select count(*) from atlas_knowledge_gap_links) as gap_links;

\echo '== X8 guard function properties (expect security invoker, fixed search_path, no EXECUTE for PUBLIC/anon/authenticated)'
select p.prosecdef as security_definer, p.proconfig as config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
  exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_exec
from pg_proc p where p.oid = 'public.atlas_guard_append_only()'::regprocedure;

\echo '== X9 service_role cannot bypass the guard: replica mode, disabling a trigger, dropping a trigger (expect 3 x permission/ownership errors), then guard still blocks'
set role service_role;
set session_replication_role = replica;
alter table public.atlas_evidence_sources disable trigger atlas_evidence_sources_append_only;
drop trigger atlas_evidence_sources_append_only on public.atlas_evidence_sources;
update public.atlas_evidence_sources set source_class = 'GOVERNED_INTERNAL' where source_id = 'S-CFR';
reset role;
select source_class from public.atlas_evidence_sources where source_id = 'S-CFR';
