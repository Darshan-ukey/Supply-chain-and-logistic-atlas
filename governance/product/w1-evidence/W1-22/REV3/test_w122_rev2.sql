-- W1-22 REV2 guard tests for F4. Run on a THROWAWAY local PostgreSQL 16 only (never on Supabase). Each test records PASS/FAIL in tst.results.
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
\i normalization_interface_REV2_DESIGN_ONLY.sql

insert into atlas_stg_v73.stg_release values ('Universe V7.3','FROZEN_CANONICAL_FOUNDATION','2026-08-30',repeat('a',64),'e5f5029','FROZEN_RELEASE_MANIFEST.json','x','stale',default,default);
insert into atlas_stg_v73.stg_import_run values ('RUN1','Universe V7.3',repeat('b',64),'STAGE','STARTED','{}',null,'W1-24-TEST-FIXTURE',default,null);
insert into atlas_stg_v73.stg_admin_role values ('OWNER_ADMIN','Owner acts as admin',true);

-- helpers (fixture only)
create function tst.mk(p_id text, p_class text, p_scope text, p_table text, p_key text, p_after jsonb) returns void language sql as $$
  insert into atlas_stg_v73.stg_change_request(change_id,change_class,scope,target_table,target_key,proposed_by,rationale,after_state,evidence_pointer,rollback_pointer,consequential)
  values (p_id,p_class,p_scope,p_table,p_key,'claude-executor','fixture',p_after,'ev','rb',true) $$;
create function tst.approve(p_id text) returns void language sql as $$
  insert into atlas_stg_v73.stg_approval(approval_id,change_id,approver,approver_role,decision,change_hash)
  values ('AP-'||p_id,p_id,'owner','OWNER_ADMIN','APPROVE',atlas_stg_v73.stg_change_hash(p_id)) $$;
create function tst.reject(p_id text) returns void language sql as $$
  insert into atlas_stg_v73.stg_approval(approval_id,change_id,approver,approver_role,decision,change_hash)
  values ('AP-'||p_id,p_id,'owner','OWNER_ADMIN','REJECT',atlas_stg_v73.stg_change_hash(p_id)) $$;
create function tst.approve_apply(p_id text) returns void language plpgsql as $$
begin perform tst.approve(p_id); update atlas_stg_v73.stg_change_request set applied_state='APPLIED' where change_id=p_id; end $$;
create function tst.seed(p_id text, p_kind text, p_name text) returns void language plpgsql as $$
begin
  insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values (p_id,p_kind,'SEED');
  insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,run_id) values (p_id,p_kind,p_name,'RUN1');
end $$;
create function tst.alias(p_id text, p_kind text, p_raw text, p_state text default 'PROPOSED', p_role text default 'ALIAS') returns text language sql as $$
  select format($f$insert into atlas_stg_v73.stg_alias(alias_norm,construct_kind,construct_id,alias_raw,alias_role,alias_state) values (%L,%L,%L,%L,%L,%L)$f$, lower(btrim(p_raw)), p_kind, p_id, p_raw, p_role, p_state) $$;

-- change_class extension is additive
select tst.expect_ok('F4-00a','F4','AMBIGUITY_RESOLUTION is an accepted change_class',
 $q$select tst.mk('CR-CLS','AMBIGUITY_RESOLUTION','UNIVERSE','stg_ambiguity','x','{}')$q$);
select tst.expect_error('F4-00b','F4','an unknown change_class is still refused',
 $q$select tst.mk('CR-CLS2','FREESTYLE','UNIVERSE','stg_ambiguity','x','{}')$q$,'check');

-- ================= F4 part 3 (first, because everything else needs ids): append-only, approved ID ledger =================
select tst.seed('obj-a','object','Alpha'); select tst.seed('obj-b','object','Beta');
select tst.seed('doc-ocean-bl','document','Ocean bill of lading'); select tst.seed('doc-ocean-sea-waybill','document','Sea waybill');
select tst.seed('obj-dispatch','object','Dispatch'); select tst.seed('evt-dispatched','event','Pickup dispatched');
select tst.seed('rel-x','relationship','Relationship X');
select tst.expect_eq('F4-L01','F4','7 seed ids logged, hash-chained, chain verifies',
 $q$select (select count(*) from atlas_stg_v73.stg_id_ledger)::text||'/'||(select count(*) from atlas_stg_v73.stg_id_ledger_verify())$q$,'7/0');
select tst.expect_error('F4-L02','F4','ledger row cannot be updated',$q$update atlas_stg_v73.stg_id_ledger set construct_id='obj-zzz' where ledger_seq=1$q$,'append-only');
select tst.expect_error('F4-L03','F4','ledger row cannot be deleted',$q$delete from atlas_stg_v73.stg_id_ledger where ledger_seq=1$q$,'append-only');
select tst.expect_error('F4-L04','F4','ledger cannot be truncated',$q$truncate atlas_stg_v73.stg_id_ledger$q$,'truncate refused');
select tst.expect_error('F4-L05','F4','a seed id cannot be seeded twice',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('obj-a','object','SEED')$q$,'M3_ID_EXISTS');
select tst.expect_error('F4-L06','F4','seed id with bad grammar refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('OBJ-Bad','object','SEED')$q$,'M1_ID_GRAMMAR');
select tst.expect_error('F4-L07','F4','seed id with the wrong prefix for its kind refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('doc-wrong','object','SEED')$q$,'M2_PREFIX_KIND_MISMATCH');
select tst.expect_error('F4-L08','F4','an entity-kind construct cannot exist without a ledger birth event',
 $q$insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,run_id) values ('obj-ghost','object','Ghost','RUN1')$q$,'no ledger birth event');
select tst.expect_ok('F4-L09','F4','a non-entity construct kind (domain) needs no ledger event',
 $q$insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,run_id) values ('d1','domain','Domain 1','RUN1')$q$);
select tst.expect_error('F4-L10','F4','a construct cannot be deleted',$q$delete from atlas_stg_v73.stg_construct where construct_id='obj-a'$q$,'never deleted');
select tst.expect_error('F4-L11','F4','a construct id cannot be edited',$q$update atlas_stg_v73.stg_construct set construct_id='obj-a2' where construct_id='obj-a'$q$,'immutable');

-- minting
select tst.mk('CR-M1','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','actor|actor-freight-broker','{"event":"MINT","canonical_name":"Freight broker","gate_result":"REVIEW","gate_disposition":"KEEP_DISTINCT"}');
select tst.expect_error('F4-L12','F4','MINTED with no request is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event) values ('actor-freight-broker','actor','MINTED')$q$,'needs a request');
select tst.expect_error('F4-L13','F4','MINTED with a PENDING request is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('actor-freight-broker','actor','MINTED','CR-M1')$q$,'validly applied');
select tst.approve_apply('CR-M1');
select tst.expect_error('F4-L14','F4','a request for another key does not authorize this id',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('actor-retailer','actor','MINTED','CR-M1')$q$,'needs a request targeting');
select tst.mk('CR-M2','DAUGHTER_CANDIDATE','DAUGHTER','stg_construct','actor|actor-retailer','{"event":"MINT","canonical_name":"Retailer","gate_result":"PASS"}'); select tst.approve_apply('CR-M2');
select tst.expect_error('F4-L15','F4','a daughter candidate never mints a Universe id',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('actor-retailer','actor','MINTED','CR-M2')$q$,'daughters never mint');
select tst.mk('CR-M3','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-nogate','{"event":"MINT","canonical_name":"No gate"}'); select tst.approve_apply('CR-M3');
select tst.expect_error('F4-L16','F4','mint without a duplicate-gate result is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-nogate','object','MINTED','CR-M3')$q$,'duplicate-gate result');
select tst.mk('CR-M4','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-block','{"event":"MINT","canonical_name":"Blocked","gate_result":"BLOCK"}'); select tst.approve_apply('CR-M4');
select tst.expect_error('F4-L17','F4','mint with gate_result BLOCK is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-block','object','MINTED','CR-M4')$q$,'duplicate-gate result');
select tst.mk('CR-M5','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-rev','{"event":"MINT","canonical_name":"Rev","gate_result":"REVIEW"}'); select tst.approve_apply('CR-M5');
select tst.expect_error('F4-L18','F4','mint with REVIEW and no recorded disposition is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-rev','object','MINTED','CR-M5')$q$,'recorded disposition');
select tst.mk('CR-M6','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-foo','{"event":"MINT","canonical_name":"Recall notice or withdrawal","gate_result":"PASS"}'); select tst.approve_apply('CR-M6');
select tst.expect_error('F4-L19','F4','mint of a non-atomic Business Object name is refused (M5)',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-foo','object','MINTED','CR-M6')$q$,'M5_NON_ATOMIC');
select tst.mk('CR-M7','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-a','{"event":"MINT","canonical_name":"Alpha","gate_result":"PASS"}'); select tst.approve_apply('CR-M7');
select tst.expect_error('F4-L20','F4','mint of an id that already exists is refused (M3)',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-a','object','MINTED','CR-M7')$q$,'M3_ID_EXISTS');
select tst.expect_error('F4-L21','F4','a construct with origin GOVERNED_ADDITION and no MINTED event is refused',
 $q$insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,origin,run_id) values ('actor-freight-broker','actor','Freight broker','GOVERNED_ADDITION','RUN1')$q$,'no ledger birth event');
select tst.expect_ok('F4-L22','F4','mint accepted with a validly applied request, a gate result and a recorded disposition',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('actor-freight-broker','actor','MINTED','CR-M1')$q$);
select tst.expect_ok('F4-L23','F4','the construct is created after its ledger event',
 $q$insert into atlas_stg_v73.stg_construct(construct_id,construct_kind,name,origin,run_id) values ('actor-freight-broker','actor','Freight broker','GOVERNED_ADDITION','RUN1')$q$);
select tst.expect_error('F4-L24','F4','the same id cannot be minted twice',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('actor-freight-broker','actor','MINTED','CR-M1')$q$,'M3_ID_EXISTS');

-- tombstone and restore
select tst.mk('CR-T1','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-b','{"event":"TOMBSTONE"}');
select tst.expect_error('F4-L25','F4','lifecycle cannot be set to TOMBSTONE without a ledger event',
 $q$update atlas_stg_v73.stg_construct set lifecycle_state='TOMBSTONE' where construct_id='obj-b'$q$,'needs a TOMBSTONED ledger event');
select tst.expect_error('F4-L26','F4','TOMBSTONED event with a pending request is refused',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-b','object','TOMBSTONED','CR-T1')$q$,'validly applied');
select tst.approve_apply('CR-T1');
select tst.expect_ok('F4-L27','F4','TOMBSTONED accepted with a validly applied request',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-b','object','TOMBSTONED','CR-T1')$q$);
select tst.expect_ok('F4-L28','F4','lifecycle follows the ledger',$q$update atlas_stg_v73.stg_construct set lifecycle_state='TOMBSTONE', superseded_by='{obj-a}' where construct_id='obj-b'$q$);
select tst.mk('CR-M8','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-b','{"event":"MINT","canonical_name":"Beta","gate_result":"PASS"}'); select tst.approve_apply('CR-M8');
select tst.expect_error('F4-L29','F4','a tombstoned id cannot be minted again (M3/M4)',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-b','object','MINTED','CR-M8')$q$,'M3_ID_EXISTS');
select tst.expect_eq('F4-L30','F4','validate_mint reports M3 and M4 for the tombstoned id',
 $q$select array_to_string(atlas_stg_v73.stg_validate_mint('obj-b','object','Beta'),',')$q$,'M3_ID_EXISTS,M4_TOMBSTONED_ID_REUSE');
select tst.expect_error('F4-L31','F4','lifecycle cannot return to ACTIVE without a RESTORED event',
 $q$update atlas_stg_v73.stg_construct set lifecycle_state='ACTIVE' where construct_id='obj-b'$q$,'needs a RESTORED');
select tst.mk('CR-R1','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-b','{"event":"RESTORE"}'); select tst.approve_apply('CR-R1');
select tst.expect_ok('F4-L32','F4','RESTORED accepted for a tombstoned construct (rollback of a merge)',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-b','object','RESTORED','CR-R1')$q$);
select tst.expect_ok('F4-L33','F4','lifecycle back to ACTIVE after the RESTORED event',$q$update atlas_stg_v73.stg_construct set lifecycle_state='ACTIVE' where construct_id='obj-b'$q$);
select tst.mk('CR-X1','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-rej','{"event":"MINT","canonical_name":"Rej","gate_result":"PASS"}');
select tst.expect_error('F4-L34','F4','REJECTED_PROPOSAL needs a REJECTED request',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-rej','object','REJECTED_PROPOSAL','CR-X1')$q$,'REJECTED request');
select tst.reject('CR-X1');
select tst.expect_ok('F4-L35','F4','REJECTED_PROPOSAL accepted after a recorded rejection',
 $q$insert into atlas_stg_v73.stg_id_ledger(construct_id,construct_kind,event,change_id) values ('obj-rej','object','REJECTED_PROPOSAL','CR-X1')$q$);
select tst.expect_eq('F4-L36','F4','chain verifies after all legitimate events',$q$select count(*)::text from atlas_stg_v73.stg_id_ledger_verify()$q$,'0');

-- ================= F4 part 1: same-kind alias owner uniqueness =================
select tst.expect_ok('F4-A01','F4','first owner of a term is accepted',(select tst.alias('obj-a','object','Shipment record')));
select tst.expect_error('F4-A02','F4','a second owner of the same term in the same kind is refused',(select tst.alias('obj-b','object','Shipment record')),'owner conflict');
select tst.expect_error('F4-A03','F4','case and whitespace do not create a second owner',(select tst.alias('obj-b','object','  SHIPMENT RECORD ')),'owner conflict');
select tst.expect_error('F4-A04','F4','strict-key variants (punctuation, ampersand) do not create a second owner',(select tst.alias('obj-b','object','shipment-record')),'owner conflict');
select tst.expect_ok('F4-A05','F4','the same term in a different kind is allowed (cross-kind overlap stays AMBIGUOUS_KIND)',(select tst.alias('obj-dispatch','object','dispatch')));
select tst.expect_ok('F4-A05b','F4','cross-kind overlap: second kind accepted',(select tst.alias('evt-dispatched','event','dispatch')));
select tst.expect_eq('F4-A06','F4','lookup without a kind hint returns AMBIGUOUS_KIND, never a pick',$q$select status from atlas_stg_v73.stg_resolve_term('dispatch')$q$,'AMBIGUOUS_KIND');
select tst.expect_eq('F4-A07','F4','lookup with a kind hint resolves to one id',$q$select status||':'||array_to_string(ids,',') from atlas_stg_v73.stg_resolve_term('dispatch','event')$q$,'RESOLVED:evt-dispatched');
select tst.expect_error('F4-A08','F4','relationship-type code is not an alias key',(select tst.alias('rel-x','relationship','ENABLES','PROPOSED','CODE')),'labels, not alias keys');
select tst.expect_error('F4-A09','F4','an alias cannot be inserted already CONFIRMED',(select tst.alias('obj-b','object','beta term','CONFIRMED')),'reached by approved transition');
select tst.expect_error('F4-A10','F4','CONFIRMED_SEED is refused on a governed addition',(select tst.alias('actor-freight-broker','actor','property broker','CONFIRMED_SEED')),'only for constructs imported');
select tst.expect_error('F4-A11','F4','an alias row cannot be deleted',$q$delete from atlas_stg_v73.stg_alias where alias_norm='shipment record'$q$,'never deleted');
select tst.expect_error('F4-A12','F4','alias identity cannot be edited',$q$update atlas_stg_v73.stg_alias set construct_id='obj-b' where alias_norm='shipment record'$q$,'immutable');

-- same-kind collision of two seed holders (V7.3 silently last-wins) is closed
select tst.seed('doc-s1','document','Seller bill'); select tst.seed('doc-s2','document','Sale note');
select tst.expect_ok('F4-S01','F4','first holder of a term loads CONFIRMED_SEED',(select tst.alias('doc-s1','document','Bill of sale','CONFIRMED_SEED')));
select tst.expect_error('F4-S02','F4','V7.3 last-wins is closed: a second CONFIRMED_SEED holder is refused',(select tst.alias('doc-s2','document','Bill of sale','CONFIRMED_SEED','NAME')),'owner conflict');
select tst.expect_error('F4-S03','F4','AMBIGUOUS cannot be used to sneak in a second holder without an open register row',(select tst.alias('doc-s2','document','Bill of sale','AMBIGUOUS','NAME')),'owner conflict');
-- the real frozen collision: Document "sea waybill" is an alias of doc-ocean-bl and the name of doc-ocean-sea-waybill.
-- Loader path: register first, then BOTH holders load as AMBIGUOUS.
insert into atlas_stg_v73.stg_ambiguity(ambiguity_id,term_norm,scope,construct_kind) values ('AMB-SW','sea waybill','WITHIN_KIND','document');
insert into atlas_stg_v73.stg_ambiguity_member values ('AMB-SW','document','doc-ocean-bl','alias of the Ocean bill of lading record in V7.3'),('AMB-SW','document','doc-ocean-sea-waybill','canonical name of the Sea waybill record in V7.3');
select tst.expect_ok('F4-S04','F4','with an open register row the first holder loads AMBIGUOUS',(select tst.alias('doc-ocean-bl','document','Sea waybill','AMBIGUOUS')));
select tst.expect_ok('F4-S04b','F4','the second holder loads AMBIGUOUS',(select tst.alias('doc-ocean-sea-waybill','document','Sea waybill','AMBIGUOUS','NAME')));
select tst.expect_eq('F4-S05','F4','lookup returns AMBIGUOUS_ENTITY listing both, never the later record',
 $q$select status||':'||array_to_string(ids,',') from atlas_stg_v73.stg_resolve_term('sea waybill','document')$q$,'AMBIGUOUS_ENTITY:doc-ocean-bl,doc-ocean-sea-waybill');
select tst.seed('doc-third','document','Third');
select tst.expect_error('F4-S06','F4','a third construct cannot take the term as exclusive owner while it is AMBIGUOUS',(select tst.alias('doc-third','document','Sea waybill','PROPOSED')),'is AMBIGUOUS');

-- ================= F4 part 2: approved ambiguity resolution =================
select tst.expect_error('F4-B01','F4','an ambiguity cannot be registered already decided',
 $q$insert into atlas_stg_v73.stg_ambiguity(ambiguity_id,term_norm,scope,construct_kind,status,change_id) values ('AMB-X','x','WITHIN_KIND','document','HITL_RESOLVED','CR-M1')$q$,'registered as OPEN');
select tst.expect_error('F4-B02','F4','status change with no request is refused',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_KEEP_AMBIGUOUS' where ambiguity_id='AMB-SW'$q$,'validly applied');
select tst.mk('CR-AMB1','AMBIGUITY_RESOLUTION','UNIVERSE','stg_ambiguity','AMB-SW','{"status":"HITL_KEEP_AMBIGUOUS"}');
select tst.expect_error('F4-B03','F4','a PENDING request does not authorize the decision',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_KEEP_AMBIGUOUS', change_id='CR-AMB1' where ambiguity_id='AMB-SW'$q$,'validly applied');
select tst.mk('CR-AMB2','UNIVERSE_CANDIDATE','UNIVERSE','stg_ambiguity','AMB-SW','{"status":"HITL_KEEP_AMBIGUOUS"}'); select tst.approve_apply('CR-AMB2');
select tst.expect_error('F4-B04','F4','an applied request of the wrong class is refused',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_KEEP_AMBIGUOUS', change_id='CR-AMB2' where ambiguity_id='AMB-SW'$q$,'validly applied AMBIGUITY_RESOLUTION');
select tst.mk('CR-AMB3','AMBIGUITY_RESOLUTION','UNIVERSE','stg_ambiguity','AMB-OTHER','{"status":"HITL_KEEP_AMBIGUOUS"}'); select tst.approve_apply('CR-AMB3');
select tst.expect_error('F4-B05','F4','an applied request on another ambiguity is refused',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_KEEP_AMBIGUOUS', change_id='CR-AMB3' where ambiguity_id='AMB-SW'$q$,'validly applied AMBIGUITY_RESOLUTION');
select tst.approve_apply('CR-AMB1');
select tst.expect_ok('F4-B06','F4','keep-ambiguous accepted with a validly applied request on exactly this ambiguity',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_KEEP_AMBIGUOUS', change_id='CR-AMB1' where ambiguity_id='AMB-SW'$q$);
select tst.expect_error('F4-B07','F4','members cannot be added after the decision',
 $q$insert into atlas_stg_v73.stg_ambiguity_member values ('AMB-SW','document','doc-third','late')$q$,'only while the ambiguity is OPEN');
select tst.expect_error('F4-B08','F4','members are immutable',$q$delete from atlas_stg_v73.stg_ambiguity_member where ambiguity_id='AMB-SW'$q$,'immutable');
select tst.expect_error('F4-B09','F4','an ambiguity row cannot be deleted',$q$delete from atlas_stg_v73.stg_ambiguity where ambiguity_id='AMB-SW'$q$,'not deleted');
select tst.expect_error('F4-B10','F4','a kept-ambiguous term stays AMBIGUOUS: alias state cannot change on a keep decision',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AMB1' where alias_norm='sea waybill' and construct_id='doc-ocean-bl'$q$,'leaves AMBIGUOUS only after');
-- resolution: owner doc-ocean-sea-waybill
select tst.mk('CR-AMB4','AMBIGUITY_RESOLUTION','UNIVERSE','stg_ambiguity','AMB-SW','{"status":"HITL_RESOLVED","owner_id":"doc-ocean-sea-waybill"}');
select tst.approve_apply('CR-AMB4');
select tst.expect_error('F4-B11','F4','resolved owner must be the owner_id of the request',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_RESOLVED', resolved_owner_id='doc-ocean-bl', change_id='CR-AMB4' where ambiguity_id='AMB-SW'$q$,'owner');
select tst.expect_ok('F4-B12','F4','resolution accepted with an approved request and a registered owner',
 $q$update atlas_stg_v73.stg_ambiguity set status='HITL_RESOLVED', resolved_owner_id='doc-ocean-sea-waybill', change_id='CR-AMB4' where ambiguity_id='AMB-SW'$q$);
select tst.expect_error('F4-B13','F4','a resolved ambiguity is final',$q$update atlas_stg_v73.stg_ambiguity set status='OPEN', change_id=null, resolved_owner_id=null where ambiguity_id='AMB-SW'$q$,'final');
select tst.expect_error('F4-B14','F4','the loser cannot be CONFIRMED',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AMB4' where alias_norm='sea waybill' and construct_id='doc-ocean-bl'$q$,'owner is CONFIRMED and every other member RETIRED');
select tst.expect_error('F4-B15','F4','leaving AMBIGUOUS with no new request reference is refused',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED' where alias_norm='sea waybill' and construct_id='doc-ocean-sea-waybill'$q$,'new approved request');
select tst.expect_ok('F4-B16','F4','the approved owner becomes CONFIRMED',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AMB4' where alias_norm='sea waybill' and construct_id='doc-ocean-sea-waybill'$q$);
select tst.expect_ok('F4-B17','F4','the other member becomes RETIRED',
 $q$update atlas_stg_v73.stg_alias set alias_state='RETIRED', state_change_id='CR-AMB4' where alias_norm='sea waybill' and construct_id='doc-ocean-bl'$q$);
select tst.expect_eq('F4-B18','F4','lookup now resolves to the approved owner only',
 $q$select status||':'||array_to_string(ids,',') from atlas_stg_v73.stg_resolve_term('sea waybill','document')$q$,'RESOLVED:doc-ocean-sea-waybill');
select tst.expect_error('F4-B19','F4','RETIRED is final',$q$update atlas_stg_v73.stg_alias set alias_state='PROPOSED' where alias_norm='sea waybill' and construct_id='doc-ocean-bl'$q$,'final');

-- ordinary alias transition: PROPOSED -> CONFIRMED needs a request on exactly this alias
select tst.mk('CR-AL1','UNIVERSE_CANDIDATE','UNIVERSE','stg_alias','object|obj-a|shipment record','{"state":"CONFIRMED"}');
select tst.expect_error('F4-B20','F4','PROPOSED -> CONFIRMED with a pending request is refused',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AL1' where alias_norm='shipment record' and construct_id='obj-a'$q$,'validly applied request');
select tst.mk('CR-AL2','UNIVERSE_CANDIDATE','UNIVERSE','stg_alias','object|obj-b|other term','{"state":"CONFIRMED"}'); select tst.approve_apply('CR-AL2');
select tst.expect_error('F4-B21','F4','an applied request on another alias does not authorize this one',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AL2' where alias_norm='shipment record' and construct_id='obj-a'$q$,'validly applied request');
select tst.approve_apply('CR-AL1');
select tst.expect_ok('F4-B22','F4','PROPOSED -> CONFIRMED accepted with an applied request on exactly this alias',
 $q$update atlas_stg_v73.stg_alias set alias_state='CONFIRMED', state_change_id='CR-AL1' where alias_norm='shipment record' and construct_id='obj-a'$q$);

-- ================= family key uncitral (G-053, Owner direction): AMBIGUOUS, never CONFIRMED without approval =================
insert into atlas_stg_v73.stg_source(source_id,title,admission_state,seed_origin,authority_class,run_id) values
 ('src-hague-visby','Hague-Visby','SEED_GOVERNED','V73','SEED_BASELINE_DEC059','RUN1'),('src-rotterdam','Rotterdam Rules','SEED_GOVERNED','V73','SEED_BASELINE_DEC059','RUN1'),
 ('src-mletr','MLETR','SEED_GOVERNED','V73','SEED_BASELINE_DEC059','RUN1'),('src-ncd','NCD','SEED_GOVERNED','V73','SEED_BASELINE_DEC059','RUN1');
select tst.expect_error('F4-U01','F4','a family key cannot enter CONFIRMED',
 $q$insert into atlas_stg_v73.stg_family_alias(frozen_key,source_id,resolution_status,legacy_name,legacy_url) values ('uncitral','src-mletr','OWNER_DECIDED','UNCITRAL · transport of goods instruments','https://uncitral.un.org/en/texts/transportgoods')$q$,'enters PROPOSED or AMBIGUOUS');
select tst.expect_error('F4-U02','F4','AMBIGUOUS family key needs a register row',
 $q$insert into atlas_stg_v73.stg_family_alias(frozen_key,source_id,resolution_status,legacy_name,legacy_url) values ('uncitral','src-mletr','AMBIGUOUS','UNCITRAL · transport of goods instruments','https://uncitral.un.org/en/texts/transportgoods')$q$,'needs an open ambiguity-register row');
insert into atlas_stg_v73.stg_ambiguity(ambiguity_id,term_norm,scope) values ('AMB-UNCITRAL','uncitral','SOURCE_FAMILY');
insert into atlas_stg_v73.stg_ambiguity_member values
 ('AMB-UNCITRAL','source','src-hague-visby','sea-carriage convention candidate'),('AMB-UNCITRAL','source','src-rotterdam','sea-carriage convention candidate (UNCITRAL issuer)'),
 ('AMB-UNCITRAL','source','src-mletr','electronic transport record candidate (UNCITRAL issuer)'),('AMB-UNCITRAL','source','src-ncd','electronic-trade-document candidate'),
 ('AMB-UNCITRAL','placement','hamburg-rules-placement','sea-carriage placement without a governed src- id');
select tst.expect_ok('F4-U03','F4','uncitral candidates load AMBIGUOUS with original name and URL preserved',
 $q$insert into atlas_stg_v73.stg_family_alias(frozen_key,source_id,resolution_status,legacy_name,legacy_url) select 'uncitral', s, 'AMBIGUOUS','UNCITRAL · transport of goods instruments','https://uncitral.un.org/en/texts/transportgoods' from unnest(array['src-hague-visby','src-rotterdam','src-mletr','src-ncd']) s$q$);
select tst.expect_error('F4-U04','F4','confirming a candidate without a request is refused',
 $q$update atlas_stg_v73.stg_family_alias set resolution_status='OWNER_DECIDED' where frozen_key='uncitral' and source_id='src-hague-visby'$q$,'needs a validly applied AMBIGUITY_RESOLUTION');
select tst.mk('CR-U1','AMBIGUITY_RESOLUTION','UNIVERSE','stg_family_alias','uncitral|src-hague-visby','{"status":"OWNER_DECIDED"}'); select tst.approve_apply('CR-U1');
select tst.expect_error('F4-U05','F4','even with an approved request on the member, confirmation is refused while the register row is unresolved',
 $q$update atlas_stg_v73.stg_family_alias set resolution_status='OWNER_DECIDED', state_change_id='CR-U1' where frozen_key='uncitral' and source_id='src-hague-visby'$q$,'not resolved to');
select tst.expect_error('F4-U06','F4','original name and URL cannot be rewritten',
 $q$update atlas_stg_v73.stg_family_alias set legacy_url='https://example.org' where frozen_key='uncitral' and source_id='src-ncd'$q$,'preserved verbatim');
select tst.expect_eq('F4-U07','F4','no uncitral member is confirmed',$q$select count(*) filter (where resolution_status <> 'AMBIGUOUS')::text from atlas_stg_v73.stg_family_alias where frozen_key='uncitral'$q$,'0');

-- ================= regression of unchanged W1-21 guards + security of new tables =================
select tst.mk('CR-X1b','UNIVERSE_CANDIDATE','UNIVERSE','stg_construct','object|obj-q','{}');
select tst.expect_error('F4-R01b','REG','approval with a wrong hash is refused',
 format($q$insert into atlas_stg_v73.stg_approval(approval_id,change_id,approver,approver_role,decision,change_hash) values ('AX','CR-X1b','owner','OWNER_ADMIN','APPROVE',%L)$q$, repeat('0',64)),'does not match');
insert into atlas_stg_v73.stg_lineage(construct_id,construct_kind,lineage_kind,run_id) values ('obj-a','object','SEED_IMPORT','RUN1');
select tst.expect_error('F4-R02','REG','stg_lineage remains append-only',$q$delete from atlas_stg_v73.stg_lineage$q$,'append-only');
select tst.expect_eq('F4-R03','REG','RLS enabled on the three new tables',
 $q$select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='atlas_stg_v73' and c.relname in ('stg_ambiguity','stg_ambiguity_member','stg_id_ledger') and c.relrowsecurity$q$,'3');
select tst.expect_eq('F4-R04','REG','chain still verifies after the whole suite of legitimate events',$q$select count(*)::text from atlas_stg_v73.stg_id_ledger_verify()$q$,'0');

-- ================= defence in depth: tampering with triggers disabled is detected by the hash chain =================
alter table atlas_stg_v73.stg_id_ledger disable trigger stg_id_ledger_guard_t;
update atlas_stg_v73.stg_id_ledger set construct_id='obj-tampered' where ledger_seq=3;
alter table atlas_stg_v73.stg_id_ledger enable trigger stg_id_ledger_guard_t;
select tst.expect_eq('F4-L37','F4','an edit made with the guard disabled is detected at the edited row',$q$select first_bad_seq::text||' '||reason from atlas_stg_v73.stg_id_ledger_verify()$q$,'3 row content does not match row_hash');
alter table atlas_stg_v73.stg_id_ledger disable trigger stg_id_ledger_guard_t;
update atlas_stg_v73.stg_id_ledger set construct_id='doc-ocean-bl' where ledger_seq=3;            -- restore the fixture row
alter table atlas_stg_v73.stg_id_ledger enable trigger stg_id_ledger_guard_t;
select tst.expect_eq('F4-L38','F4','restoring the original content restores a valid chain',$q$select count(*)::text from atlas_stg_v73.stg_id_ledger_verify()$q$,'0');
alter table atlas_stg_v73.stg_id_ledger disable trigger stg_id_ledger_guard_t;
delete from atlas_stg_v73.stg_id_ledger where ledger_seq=4;
alter table atlas_stg_v73.stg_id_ledger enable trigger stg_id_ledger_guard_t;
select tst.expect_eq('F4-L39','F4','a removed middle row is detected at the next row',$q$select first_bad_seq::text||' '||reason from atlas_stg_v73.stg_id_ledger_verify()$q$,'5 prev_hash does not match the preceding row');

select tst.expect_ok('F4-R05','REG','schema drop cascade (rollback) succeeds',$q$drop schema atlas_stg_v73 cascade$q$);
select tst.expect_eq('F4-R06','REG','no object remains',$q$select count(*)::text from pg_namespace where nspname='atlas_stg_v73'$q$,'0');

\o
\echo ===== RESULTS =====
select test_id, finding, outcome, name, left(detail, 100) as detail from tst.results order by n;
select outcome, count(*) from tst.results group by outcome order by outcome;
