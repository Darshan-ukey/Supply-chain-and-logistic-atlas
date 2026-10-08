-- INT-014 database integration smoke. Run in disposable/staging PostgreSQL AFTER migration.
-- Test uses privileged fixture writes; production writers must be restricted to coordinator API.
begin;
insert into public.atlas_governance_transactions(id,required_dependencies,evidence)
values ('int014-test', '[{"id":"dep1","status":"PENDING"}]'::jsonb,'["baseline"]'::jsonb);
do $$
declare result jsonb; failed boolean;
begin
  result:=public.atlas_governance_transition('int014-test',0,'agent-a','CLAIMED');
  if (result->>'revision')::int<>1 then raise exception 'CLAIM_FAILED'; end if;
  failed:=false;
  begin perform public.atlas_governance_transition('int014-test',0,'agent-b','CLAIMED');
  exception when others then failed:=sqlerrm='STALE_REVISION'; end;
  if not failed then raise exception 'STALE_REVISION_NOT_REJECTED'; end if;
  failed:=false;
  begin perform public.atlas_governance_transition('int014-test',1,'agent-b','CLAIMED');
  exception when others then failed:=sqlerrm='OWNER_LEASE_ACTIVE'; end;
  if not failed then raise exception 'ACTIVE_OWNER_NOT_REJECTED'; end if;
  perform public.atlas_governance_transition('int014-test',1,'agent-a','APPLYING');
  perform public.atlas_governance_transition('int014-test',2,'agent-a','VERIFYING');
  failed:=false;
  begin perform public.atlas_governance_transition('int014-test',3,'agent-a','COMPLETE');
  exception when others then failed:=sqlerrm='DEPENDENCY_NOT_CLOSED'; end;
  if not failed then raise exception 'INCOMPLETE_DEPENDENCY_NOT_REJECTED'; end if;
  update public.atlas_governance_transactions
  set required_dependencies='[{"id":"dep1","status":"VERIFIED","evidence":"fixture"}]'::jsonb
  where id='int014-test';
  insert into public.atlas_governance_outbox(operation_key,transaction_id,target_system,operation)
  values ('int014-write','int014-test','WORKBOOK','{"action":"readback"}'::jsonb);
  failed:=false;
  begin perform public.atlas_governance_transition('int014-test',3,'agent-a','COMPLETE');
  exception when others then failed:=sqlerrm='READBACK_NOT_VERIFIED'; end;
  if not failed then raise exception 'UNVERIFIED_WRITE_NOT_REJECTED'; end if;
  update public.atlas_governance_outbox set verified_at=now(),evidence_uri='test://readback' where operation_key='int014-write';
  result:=public.atlas_governance_transition('int014-test',3,'agent-a','COMPLETE');
  if result->>'state'<>'COMPLETE' then raise exception 'COMPLETE_FAILED'; end if;
  if (select count(*) from public.atlas_governance_events where transaction_id='int014-test')<>4 then raise exception 'EVENT_AUDIT_FAILED'; end if;
  raise notice 'PASS: stale revision, owner lease, dependency, readback, event audit';
end $$;
rollback;
