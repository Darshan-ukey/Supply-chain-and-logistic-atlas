-- INT-014 isolated governance transaction coordinator. Not an operational execution runtime.
create table if not exists public.atlas_governance_transactions (
  id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  state text not null default 'READY' check (state in ('READY','CLAIMED','APPLYING','VERIFYING','COMPLETE','PARTIAL_COMMIT','STALE_CLAIM','BLOCKED_ACCESS','BLOCKED_DEPENDENCY')),
  owner_id text, lease_until timestamptz,
  required_dependencies jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.atlas_governance_events (
  event_id bigint generated always as identity primary key,
  transaction_id text not null references public.atlas_governance_transactions(id),
  revision bigint not null,
  actor text not null,
  from_state text not null,
  to_state text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique(transaction_id,revision)
);
create table if not exists public.atlas_governance_outbox (
  operation_key text primary key,
  transaction_id text not null references public.atlas_governance_transactions(id),
  target_system text not null check(target_system in ('WORKBOOK','GITHUB','LINEAR')),
  operation jsonb not null,
  verified_at timestamptz,
  evidence_uri text,
  created_at timestamptz not null default now()
);
alter table public.atlas_governance_transactions enable row level security;
alter table public.atlas_governance_events enable row level security;
alter table public.atlas_governance_outbox enable row level security;
revoke all on public.atlas_governance_transactions,public.atlas_governance_events,public.atlas_governance_outbox from anon,authenticated;
create or replace function public.atlas_governance_transition(
  p_id text,p_expected_revision bigint,p_actor text,p_next_state text,
  p_lease_seconds integer default 300,p_details jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare t public.atlas_governance_transactions%rowtype; d jsonb; pending integer;
begin
  if p_actor is null or length(trim(p_actor))=0 then raise exception 'ACTOR_REQUIRED'; end if;
  if p_lease_seconds < 1 or p_lease_seconds > 3600 then raise exception 'INVALID_LEASE'; end if;
  select * into t from public.atlas_governance_transactions where id=p_id for update;
  if not found then raise exception 'UNKNOWN_TRANSACTION'; end if;
  if t.revision <> p_expected_revision then raise exception 'STALE_REVISION'; end if;
  if p_next_state not in ('CLAIMED','APPLYING','VERIFYING','COMPLETE','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY') then raise exception 'INVALID_TRANSITION'; end if;
  if p_next_state='CLAIMED' then
    if t.state not in ('READY','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY','CLAIMED') then raise exception 'INVALID_CLAIM_STATE'; end if;
    if t.owner_id is not null and t.owner_id<>p_actor and t.lease_until>now() then raise exception 'OWNER_LEASE_ACTIVE'; end if;
  else
    if t.owner_id is distinct from p_actor or t.lease_until is null or t.lease_until<=now() then raise exception 'OWNER_OR_LEASE_INVALID'; end if;
    if not ((t.state='CLAIMED' and p_next_state in ('APPLYING','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY'))
      or (t.state='APPLYING' and p_next_state in ('VERIFYING','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY'))
      or (t.state='VERIFYING' and p_next_state in ('COMPLETE','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY'))
      or (t.state in ('PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY') and p_next_state in ('APPLYING','PARTIAL_COMMIT','BLOCKED_ACCESS','BLOCKED_DEPENDENCY'))) then
      raise exception 'INVALID_STATE_EDGE';
    end if;
  end if;
  if p_next_state='COMPLETE' then
    if jsonb_typeof(t.required_dependencies)<>'array' or jsonb_array_length(t.required_dependencies)=0 then raise exception 'DEPENDENCIES_NOT_DECLARED'; end if;
    for d in select value from jsonb_array_elements(t.required_dependencies) loop
      if d->>'status' not in ('VERIFIED','NA') or (d->>'status'='NA' and nullif(d->>'reason','') is null)
         or (d->>'status'='VERIFIED' and nullif(d->>'evidence','') is null) then raise exception 'DEPENDENCY_NOT_CLOSED'; end if;
    end loop;
    select count(*) into pending from public.atlas_governance_outbox where transaction_id=p_id and (verified_at is null or evidence_uri is null);
    if pending>0 or jsonb_typeof(t.evidence)<>'array' or jsonb_array_length(t.evidence)=0 then raise exception 'READBACK_NOT_VERIFIED'; end if;
  end if;
  update public.atlas_governance_transactions set revision=t.revision+1,state=p_next_state,
    owner_id=case when p_next_state='COMPLETE' then null else p_actor end,
    lease_until=case when p_next_state='COMPLETE' then null else now()+make_interval(secs=>p_lease_seconds) end,
    updated_at=now() where id=p_id;
  insert into public.atlas_governance_events(transaction_id,revision,actor,from_state,to_state,details)
    values(p_id,t.revision+1,p_actor,t.state,p_next_state,p_details);
  return jsonb_build_object('id',p_id,'revision',t.revision+1,'state',p_next_state);
end $$;
revoke all on function public.atlas_governance_transition(text,bigint,text,text,integer,jsonb) from public,anon,authenticated;
-- Only a trusted service role should invoke this function. Caller identity must be established by its service boundary.
grant execute on function public.atlas_governance_transition(text,bigint,text,text,integer,jsonb) to service_role;
