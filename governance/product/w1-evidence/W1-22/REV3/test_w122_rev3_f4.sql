-- W1-22 REV3 constraint-level tests for F4 (round 3). Run on a THROWAWAY local PostgreSQL 16 only (never on Supabase). Each test records PASS/FAIL in tst.results.
\set ON_ERROR_STOP on
\o /dev/null
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema tst;
create table tst.results (n serial, test_id text, finding text, name text, outcome text, detail text);
create function tst.expect_error(p_test text, p_find text, p_name text, p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql;
    insert into tst.results(test_id, finding, name, outcome, detail) values (p_test, p_find, p_name, 'FAIL', 'statement succeeded but a refusal was expected');
  exception when others then
    if sqlerrm ilike '%' || p_pattern || '%' then
      insert into tst.results(test_id, finding, name, outcome, detail) values (p_test, p_find, p_name, 'PASS', sqlerrm);
    else
      insert into tst.results(test_id, finding, name, outcome, detail) values (p_test, p_find, p_name, 'FAIL', 'wrong error: ' || sqlerrm);
    end if;
  end;
end $$;
create function tst.expect_ok(p_test text, p_find text, p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql;
    insert into tst.results(test_id, finding, name, outcome, detail) values (p_test, p_find, p_name, 'PASS', 'ok');
  exception when others then
    insert into tst.results(test_id, finding, name, outcome, detail) values (p_test, p_find, p_name, 'FAIL', 'unexpected error: ' || sqlerrm);
  end;
end $$;
create function tst.expect_eq(p_test text, p_find text, p_name text, p_sql text, p_expected text) returns void language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  insert into tst.results(test_id, finding, name, outcome, detail)
  values (p_test, p_find, p_name, case when v = p_expected then 'PASS' else 'FAIL' end, 'got [' || coalesce(v,'NULL') || '] expected [' || p_expected || ']');
end $$;


\i base_subset_W1-21_REV2.sql
\i normalization_interface_REV3_DESIGN_ONLY.sql
insert into atlas_stg_v73.stg_release values ('Universe V7.3','FROZEN_CANONICAL_FOUNDATION','2026-08-30',repeat('a',64),'e5f5029','FROZEN_RELEASE_MANIFEST.json','x','stale',default,default);
insert into atlas_stg_v73.stg_import_run values ('RUN1','Universe V7.3',repeat('b',64),'STAGE','STARTED','{}',null,'FIXTURE',default,null);
insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('obj-a','object','SEED'),('obj-b','object','SEED'),('obj-c','object','SEED'),('evt-a','event','SEED');
insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,run_id) values ('obj-a','object','A','RUN1'),('obj-b','object','B','RUN1'),('obj-c','object','C','RUN1'),('evt-a','event','E','RUN1');
create function tst.mk(p_id text, p_class text, p_scope text, p_table text, p_key text, p_after jsonb) returns void language sql as $$
  insert into atlas_stg_v73.stg_change_request(change_id,change_class,scope,target_table,target_key,proposed_by,rationale,after_state,evidence_pointer,rollback_pointer,consequential)
  values (p_id,p_class,p_scope,p_table,p_key,'claude-executor','fixture',p_after,'ev','rb',true) $$;
create function tst.raw_ins(p_id text, p_kind text, p_raw text, p_state text) returns text language sql as $$
  select format($f$insert into atlas_stg_v73.stg_alias(alias_norm,construct_kind,construct_id,alias_raw,alias_state) values (%L,%L,%L,%L,%L)$f$, lower(btrim(p_raw)), p_kind, p_id, p_raw, p_state) $$;
-- (the trigger is disabled in sections marked so: it models a writer whose SELECT cannot see a concurrent uncommitted row)
select tst.expect_ok('F4R3-01','F4','first live owner accepted (trigger on)',(select tst.raw_ins('obj-a','object','Shipment record','PROPOSED')));
alter table atlas_stg_v73.stg_alias disable trigger stg_alias_guard_t;
select tst.expect_error('F4R3-02','F4','TRIGGER OFF: punctuation variant by another construct refused by the exclusion constraint',(select tst.raw_ins('obj-b','object','shipment-record','PROPOSED')),'exclusion constraint');
select tst.expect_error('F4R3-03','F4','TRIGGER OFF: whitespace-run variant refused (unique index on the plain term would not see it)',(select tst.raw_ins('obj-b','object','Shipment   record','PROPOSED')),'exclusion constraint');
select tst.expect_ok('F4R3-04','F4','TRIGGER OFF: Bill & Lading by obj-a accepted',(select tst.raw_ins('obj-a','object','Bill & Lading','PROPOSED')));
select tst.expect_error('F4R3-05','F4','TRIGGER OFF: bill and lading by obj-b refused (strict key equal)',(select tst.raw_ins('obj-b','object','bill and lading','CONFIRMED_SEED')),'exclusion constraint');
select tst.expect_error('F4R3-06','F4','TRIGGER OFF: identical term by another construct refused (unique index or exclusion)',(select tst.raw_ins('obj-b','object','shipment record','PROPOSED')),'violates');
select tst.expect_ok('F4R3-07','F4','TRIGGER OFF: the SAME construct may hold two spellings of one key',(select tst.raw_ins('obj-a','object','shipment-record','PROPOSED')));
select tst.expect_ok('F4R3-08','F4','TRIGGER OFF: same key in another kind accepted (cross-kind stays AMBIGUOUS_KIND at lookup)',(select tst.raw_ins('evt-a','event','shipment record','PROPOSED')));
select tst.expect_error('F4R3-09','F4','TRIGGER OFF: AMBIGUOUS holder of another construct beside a live owner refused',(select tst.raw_ins('obj-c','object','Shipment-Record','AMBIGUOUS')),'stg_alias_no_live_beside_ambiguous');
select tst.expect_ok('F4R3-10','F4','TRIGGER OFF: two constructs may both hold a term as AMBIGUOUS (register case)',(select tst.raw_ins('obj-b','object','Sea waybill','AMBIGUOUS')));
select tst.expect_ok('F4R3-11','F4','TRIGGER OFF: second AMBIGUOUS holder',(select tst.raw_ins('obj-c','object','sea-waybill','AMBIGUOUS')));
select tst.expect_error('F4R3-12','F4','TRIGGER OFF: a live owner of that key beside the AMBIGUOUS holders refused',(select tst.raw_ins('obj-a','object','sea waybill','PROPOSED')),'stg_alias_no_live_beside_ambiguous');
select tst.mk('CR-RET','UNIVERSE_CANDIDATE','UNIVERSE','stg_alias','object|obj-a|old spelling','{"state":"RETIRED"}');
select tst.expect_ok('F4R3-13','F4','TRIGGER OFF: RETIRED rows are outside the constraints',$q$insert into atlas_stg_v73.stg_alias(alias_norm,construct_kind,construct_id,alias_raw,alias_state,state_change_id) values ('shipment record','object','obj-c','Shipment Record','RETIRED','CR-RET')$q$);
select tst.expect_error('F4R3-14','F4','TRIGGER OFF: moving a row into the live class against another live owner is refused (update path)',
  $q$update atlas_stg_v73.stg_alias set alias_state='PROPOSED' where construct_id='obj-b' and alias_raw='Sea waybill'$q$||'; insert into atlas_stg_v73.stg_alias(alias_norm,construct_kind,construct_id,alias_raw,alias_state) values (''sea waybill'',''object'',''obj-a'',''Sea waybill'',''PROPOSED'')','exclusion constraint');
alter table atlas_stg_v73.stg_alias enable trigger stg_alias_guard_t;
select tst.expect_error('F4R3-15','F4','alias_key cannot be written directly (generated)',$q$update atlas_stg_v73.stg_alias set alias_key='x' where construct_id='obj-a'$q$,'only be updated to DEFAULT');
select tst.expect_eq('F4R3-16','F4','alias_key equals the strict key of the raw text',$q$select alias_key from atlas_stg_v73.stg_alias where alias_raw='Bill & Lading'$q$,'bill and lading');
select tst.expect_eq('F4R3-17','F4','alias_class: retired=null, ambiguous=2, live=1',$q$select (select bool_and(alias_class is null) from atlas_stg_v73.stg_alias where alias_state='RETIRED')::text||','||(select min(alias_class) from atlas_stg_v73.stg_alias where alias_state='AMBIGUOUS')::text||','||(select min(alias_class) from atlas_stg_v73.stg_alias where alias_state='PROPOSED')::text$q$,'true,2,1');
-- trigger back on: the readable messages of REV2 still apply
select tst.expect_error('F4R3-18','F4','TRIGGER ON: readable owner-conflict message still returned first',(select tst.raw_ins('obj-b','object','bill-and-lading','PROPOSED')),'owner conflict');
select tst.expect_eq('F4R3-19','F4','two exclusion constraints exist on stg_alias',$q$select count(*)::text from pg_constraint where conrelid='atlas_stg_v73.stg_alias'::regclass and contype='x'$q$,'2');
select tst.expect_ok('F4R3-20','F4','rollback: schema drop cascade',$q$drop schema atlas_stg_v73 cascade$q$);
\o
\echo ===== RESULTS =====
select test_id, finding, outcome, name, left(detail, 110) as detail from tst.results order by n;
select outcome, count(*) from tst.results group by outcome order by outcome;
