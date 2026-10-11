-- W1-22 REV2 normalization interface over the W1-21 REV2 staging schema atlas_stg_v73.
-- Rework round 2 after W1-23 QA R1 FAIL, finding F4: "W1-22 same-kind alias owner uniqueness, approved ambiguity resolution and
-- append-only ID ledger are not enforced."  DESIGN ONLY for the Atlas backend: NOT executed against Supabase.  Executed only on a throwaway
-- local PostgreSQL 16 (tests in test_w122_rev2.sql).  This file REPLACES normalization_interface_DESIGN_ONLY.sql (REV1, parsed only).
-- Adds to schema atlas_stg_v73 only.  No existing public.atlas_* table, no ATL-123 migration object and no frozen V7.3 asset is touched.
-- Dependency on W1-21 REV2 objects: stg_construct, stg_alias, stg_family_alias, stg_source, stg_change_request, stg_approval,
-- stg_change_valid_applied(). One additive change to W1-21 is required: the change_class value AMBIGUITY_RESOLUTION (section 0).

-- 0. one additive change_class (term-resolution decisions: ambiguity register, alias state transitions, family-key confirmation)
alter table atlas_stg_v73.stg_change_request drop constraint stg_change_request_change_class_check;
alter table atlas_stg_v73.stg_change_request add constraint stg_change_request_change_class_check check (change_class in
  ('SOURCE_ADMISSION','SOURCE_CHANGE','URL_OVERRIDE','UNIVERSE_CANDIDATE','DAUGHTER_CANDIDATE','PACK_RESOLUTION',
   'ROLE_PROFILE_CHANGE','ROUTE_ASSIGNMENT','PROMOTION','AMBIGUITY_RESOLUTION'));

create function atlas_stg_v73.stg_strict_key(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(lower(replace(normalize(t, NFKC), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'))
$$;

-- 1. ambiguity register  (R-AMB-1).  OPEN is a finding; any other status is a human decision that needs a validly applied
--    AMBIGUITY_RESOLUTION request on exactly this ambiguity_id whose after_state carries the same status (F4 part 2).
create table atlas_stg_v73.stg_ambiguity (
  ambiguity_id   text primary key,
  term_norm      text not null,
  scope          text not null check (scope in ('WITHIN_KIND','CROSS_KIND','SOURCE_FAMILY')),
  construct_kind text,
  status         text not null default 'OPEN' check (status in ('OPEN','HITL_KEEP_AMBIGUOUS','HITL_RESOLVED','RETIRED')),
  resolved_owner_id text,
  resolution_note text,
  change_id      text references atlas_stg_v73.stg_change_request,
  check ((status = 'OPEN') = (change_id is null)),
  check ((status = 'HITL_RESOLVED') = (resolved_owner_id is not null)),
  check ((scope = 'WITHIN_KIND') = (construct_kind is not null))
);
create table atlas_stg_v73.stg_ambiguity_member (
  ambiguity_id  text not null references atlas_stg_v73.stg_ambiguity,
  member_kind   text not null,
  member_id     text not null,
  member_basis  text not null,
  primary key (ambiguity_id, member_kind, member_id)
);
create function atlas_stg_v73.stg_ambiguity_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype;
begin
  if tg_op = 'DELETE' then raise exception 'stg_ambiguity rows are not deleted (F4)'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' then raise exception 'an ambiguity is registered as OPEN; a decision needs an approved request (F4)'; end if;
    return new;
  end if;
  if (new.ambiguity_id, new.term_norm, new.scope, new.construct_kind) is distinct from (old.ambiguity_id, old.term_norm, old.scope, old.construct_kind) then
    raise exception 'ambiguity identity is immutable (F4)';
  end if;
  if new.status is distinct from old.status then
    if old.status in ('HITL_RESOLVED','RETIRED') then raise exception 'ambiguity % is % and final (F4)', old.ambiguity_id, old.status; end if;
    if new.status = 'OPEN' then raise exception 'an ambiguity cannot be reopened; register a new one (F4)'; end if;
    select * into cr from atlas_stg_v73.stg_change_request where change_id = new.change_id;
    if not found
       or cr.change_class <> 'AMBIGUITY_RESOLUTION' or cr.target_table <> 'stg_ambiguity' or cr.target_key <> new.ambiguity_id
       or cr.after_state ->> 'status' is distinct from new.status
       or not atlas_stg_v73.stg_change_valid_applied(new.change_id) then
      raise exception 'ambiguity % status % needs a validly applied AMBIGUITY_RESOLUTION request on this ambiguity (F4)', new.ambiguity_id, new.status;
    end if;
    if new.status = 'HITL_RESOLVED' then
      if new.resolved_owner_id is distinct from cr.after_state ->> 'owner_id'
         or not exists (select 1 from atlas_stg_v73.stg_ambiguity_member m where m.ambiguity_id = new.ambiguity_id and m.member_id = new.resolved_owner_id) then
        raise exception 'resolved owner must be the owner_id of the approved request and a registered member (F4)';
      end if;
    end if;
  elsif (new.resolved_owner_id, new.change_id, new.resolution_note) is distinct from (old.resolved_owner_id, old.change_id, old.resolution_note) then
    raise exception 'ambiguity decision fields change only together with an approved status change (F4)';
  end if;
  return new;
end $$;
create trigger stg_ambiguity_guard_t before insert or update or delete on atlas_stg_v73.stg_ambiguity
  for each row execute function atlas_stg_v73.stg_ambiguity_guard();
create function atlas_stg_v73.stg_ambiguity_member_guard() returns trigger language plpgsql as $$
begin
  if tg_op <> 'INSERT' then raise exception 'ambiguity members are immutable (F4)'; end if;
  if (select status from atlas_stg_v73.stg_ambiguity where ambiguity_id = new.ambiguity_id) <> 'OPEN' then
    raise exception 'members can be added only while the ambiguity is OPEN (F4)';
  end if;
  return new;
end $$;
create trigger stg_ambiguity_member_guard_t before insert or update or delete on atlas_stg_v73.stg_ambiguity_member
  for each row execute function atlas_stg_v73.stg_ambiguity_member_guard();

-- 2. append-only, hash-chained ID ledger  (R-ID-3, R-ID-5, F4 part 3)
create table atlas_stg_v73.stg_id_ledger (
  ledger_seq     bigint generated always as identity primary key,
  construct_id   text not null,
  construct_kind text not null,
  event          text not null check (event in ('SEED','MINTED','TOMBSTONED','RESTORED','REJECTED_PROPOSAL')),
  change_id      text references atlas_stg_v73.stg_change_request,
  logged_at      timestamptz not null default clock_timestamp(),
  prev_hash      char(64),
  row_hash       char(64),
  check ((event = 'SEED') = (change_id is null))
);
create unique index stg_id_ledger_one_birth on atlas_stg_v73.stg_id_ledger (construct_id) where event in ('SEED','MINTED');

create function atlas_stg_v73.stg_validate_mint(p_id text, p_kind text, p_name text)
returns text[] language plpgsql stable as $$
declare r text[] := '{}';
begin
  if p_id !~ '^(sys|obj|doc|evt|actor|rel)-[a-z0-9]+(-[a-z0-9]+)*$' then r := r || 'M1_ID_GRAMMAR'::text; end if;
  if split_part(p_id,'-',1) is distinct from (case p_kind when 'system' then 'sys' when 'object' then 'obj' when 'document' then 'doc'
        when 'event' then 'evt' when 'actor' then 'actor' when 'relationship' then 'rel' end) then r := r || 'M2_PREFIX_KIND_MISMATCH'::text; end if;
  if exists (select 1 from atlas_stg_v73.stg_construct c where c.construct_id = p_id)
     or exists (select 1 from atlas_stg_v73.stg_id_ledger l where l.construct_id = p_id and l.event in ('SEED','MINTED')) then r := r || 'M3_ID_EXISTS'::text; end if;
  if exists (select 1 from atlas_stg_v73.stg_id_ledger l where l.construct_id = p_id and l.event = 'TOMBSTONED') then r := r || 'M4_TOMBSTONED_ID_REUSE'::text; end if;
  if p_kind = 'object' and p_name ~* '(/|\sor\s)' then r := r || 'M5_NON_ATOMIC_CANONICAL_NAME'::text; end if;
  return r;
end $$;

create function atlas_stg_v73.stg_ledger_hash(p_prev text, p_seq bigint, p_id text, p_kind text, p_event text, p_change text, p_at timestamptz)
returns char(64) language sql immutable as $$
  select encode(sha256(convert_to(concat_ws('|', p_prev, p_seq::text, p_id, p_kind, p_event, coalesce(p_change,''), extract(epoch from p_at)::text), 'UTF8')), 'hex')::char(64)
$$;

create function atlas_stg_v73.stg_id_ledger_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype; construct_state text; last_event text; reasons text[]; nm text; tgt text;
begin
  if tg_op in ('UPDATE','DELETE') then raise exception 'stg_id_ledger is append-only (F4)'; end if;
  perform pg_advisory_xact_lock(7322001);
  tgt := new.construct_kind || '|' || new.construct_id;
  select name into nm from atlas_stg_v73.stg_construct c where c.construct_id = new.construct_id and c.construct_kind = new.construct_kind;
  select event into last_event from atlas_stg_v73.stg_id_ledger where construct_id = new.construct_id order by ledger_seq desc limit 1;
  select lifecycle_state into construct_state from atlas_stg_v73.stg_construct c where c.construct_id = new.construct_id and c.construct_kind = new.construct_kind;
  if new.event = 'SEED' then
    reasons := atlas_stg_v73.stg_validate_mint(new.construct_id, new.construct_kind, coalesce(nm, 'seed'));
    if cardinality(reasons) > 0 then raise exception 'seed id refused: %', reasons; end if;
  else
    select * into cr from atlas_stg_v73.stg_change_request where change_id = new.change_id;
    if not found or cr.target_table <> 'stg_construct' or cr.target_key <> tgt then
      raise exception 'ledger event % for % needs a request targeting stg_construct %', new.event, new.construct_id, tgt;
    end if;
    if new.event = 'REJECTED_PROPOSAL' then
      if cr.approval_state <> 'REJECTED' then raise exception 'a rejected proposal needs a REJECTED request (F4)'; end if;
    else
      if not atlas_stg_v73.stg_change_valid_applied(new.change_id) then
        raise exception 'ledger event % for % needs a validly applied request (F4)', new.event, new.construct_id;
      end if;
      if cr.change_class <> 'UNIVERSE_CANDIDATE' or cr.scope <> 'UNIVERSE' then
        raise exception 'ledger events come only from UNIVERSE_CANDIDATE requests; daughters never mint Universe ids (R-ID-5)';
      end if;
      if cr.after_state ->> 'event' is distinct from (case new.event when 'MINTED' then 'MINT' when 'TOMBSTONED' then 'TOMBSTONE' when 'RESTORED' then 'RESTORE' end) then
        raise exception 'request after_state.event does not match ledger event %', new.event;
      end if;
      if new.event = 'MINTED' then
        reasons := atlas_stg_v73.stg_validate_mint(new.construct_id, new.construct_kind, coalesce(cr.after_state ->> 'canonical_name', ''));
        if cardinality(reasons) > 0 then raise exception 'mint refused: %', reasons; end if;
        if cr.after_state ->> 'gate_result' is null or cr.after_state ->> 'gate_result' not in ('PASS','REVIEW') then
          raise exception 'mint needs a duplicate-gate result PASS or REVIEW attached to the request; BLOCK or missing is refused (R-ID-5)';
        end if;
        if cr.after_state ->> 'gate_result' = 'REVIEW' and coalesce(cr.after_state ->> 'gate_disposition','') not in ('KEEP_DISTINCT','ALIAS','MERGE','SPLIT') then
          raise exception 'a REVIEW gate result needs a recorded disposition (R-ID-5)';
        end if;
      elsif new.event = 'TOMBSTONED' then
        if construct_state is distinct from 'ACTIVE' then raise exception 'only an ACTIVE construct can be tombstoned'; end if;
      elsif new.event = 'RESTORED' then
        if construct_state is distinct from 'TOMBSTONE' or last_event is distinct from 'TOMBSTONED' then raise exception 'only a TOMBSTONE construct can be restored'; end if;
      end if;
    end if;
  end if;
  new.logged_at := clock_timestamp();
  new.prev_hash := coalesce((select row_hash from atlas_stg_v73.stg_id_ledger order by ledger_seq desc limit 1), repeat('0', 64));
  new.row_hash  := atlas_stg_v73.stg_ledger_hash(new.prev_hash, new.ledger_seq, new.construct_id, new.construct_kind, new.event, new.change_id, new.logged_at);
  return new;
end $$;
-- the construct may not exist yet at SEED/MINTED time (ledger first), so the lookups above are null-safe
create trigger stg_id_ledger_guard_t before insert or update or delete on atlas_stg_v73.stg_id_ledger
  for each row execute function atlas_stg_v73.stg_id_ledger_guard();
create function atlas_stg_v73.stg_id_ledger_no_truncate() returns trigger language plpgsql as $$
begin raise exception 'stg_id_ledger is append-only (truncate refused, F4)'; end $$;
create trigger stg_id_ledger_no_truncate_t before truncate on atlas_stg_v73.stg_id_ledger
  for each statement execute function atlas_stg_v73.stg_id_ledger_no_truncate();

-- defence in depth: the chain detects edits made with the triggers disabled (superuser) or a missing middle row.
-- A removed LAST row is not visible to the chain alone: W1-26 readback records the head hash outside the table (stg_import_run.observed_counts).
create function atlas_stg_v73.stg_id_ledger_verify() returns table (first_bad_seq bigint, reason text) language plpgsql stable as $$
declare r record; prev text := repeat('0', 64);
begin
  for r in select * from atlas_stg_v73.stg_id_ledger order by ledger_seq loop
    if r.prev_hash is distinct from prev then first_bad_seq := r.ledger_seq; reason := 'prev_hash does not match the preceding row'; return next; return; end if;
    if r.row_hash is distinct from atlas_stg_v73.stg_ledger_hash(r.prev_hash, r.ledger_seq, r.construct_id, r.construct_kind, r.event, r.change_id, r.logged_at) then
      first_bad_seq := r.ledger_seq; reason := 'row content does not match row_hash'; return next; return;
    end if;
    prev := r.row_hash;
  end loop;
end $$;

-- 3. constructs: ids are never edited or deleted; entity-kind rows exist only after a ledger birth event; tombstones follow the ledger
alter table atlas_stg_v73.stg_construct
  add column lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','TOMBSTONE')),
  add column superseded_by   text[];
create function atlas_stg_v73.stg_construct_guard() returns trigger language plpgsql as $$
declare n_t int; n_r int;
begin
  if tg_op = 'DELETE' then raise exception 'constructs are never deleted; tombstone through the ledger (R-ID-3, F4)'; end if;
  if tg_op = 'INSERT' then
    if new.construct_kind in ('system','object','actor','event','document','relationship') then
      if not exists (select 1 from atlas_stg_v73.stg_id_ledger l where l.construct_id = new.construct_id and l.construct_kind = new.construct_kind
                       and l.event = (case new.origin when 'V73_SEED' then 'SEED' else 'MINTED' end)) then
        raise exception 'construct % has no ledger birth event (% expected) (F4)', new.construct_id, case new.origin when 'V73_SEED' then 'SEED' else 'MINTED' end;
      end if;
    end if;
    if new.lifecycle_state <> 'ACTIVE' then raise exception 'a construct is born ACTIVE'; end if;
    return new;
  end if;
  if (new.construct_id, new.construct_kind) is distinct from (old.construct_id, old.construct_kind) then raise exception 'construct id is immutable (R-ID-3, F4)'; end if;
  if new.lifecycle_state is distinct from old.lifecycle_state then
    select count(*) filter (where event = 'TOMBSTONED'), count(*) filter (where event = 'RESTORED') into n_t, n_r
      from atlas_stg_v73.stg_id_ledger where construct_id = new.construct_id;
    if new.lifecycle_state = 'TOMBSTONE' and n_t <= n_r then raise exception 'tombstone needs a TOMBSTONED ledger event first (F4)'; end if;
    if new.lifecycle_state = 'ACTIVE' and n_t <> n_r then raise exception 'restore needs a RESTORED ledger event first (F4)'; end if;
  end if;
  return new;
end $$;
create trigger stg_construct_guard_t before insert or update or delete on atlas_stg_v73.stg_construct
  for each row execute function atlas_stg_v73.stg_construct_guard();

-- 4. aliases: one active owner per (kind, term) and per (kind, strict key); state transitions need approval  (R-AL-2, R-AL-5, R-AL-8, F4 part 1)
alter table atlas_stg_v73.stg_alias
  add column alias_key   text,
  add column alias_role  text not null default 'ALIAS' check (alias_role in ('NAME','CODE','ALIAS')),
  add column alias_state text not null default 'PROPOSED'
      check (alias_state in ('CONFIRMED_SEED','PROPOSED','CONFIRMED','AMBIGUOUS','RETIRED')),
  add column state_change_id text references atlas_stg_v73.stg_change_request,
  add check (alias_norm = lower(btrim(alias_raw))),
  add check (alias_state not in ('CONFIRMED','RETIRED') or state_change_id is not null);
-- database-enforced exclusivity (also closes the race between two concurrent inserts)
create unique index stg_alias_one_active_owner on atlas_stg_v73.stg_alias (construct_kind, alias_norm)
  where alias_state in ('CONFIRMED_SEED','PROPOSED','CONFIRMED');

create function atlas_stg_v73.stg_alias_guard() returns trigger language plpgsql as $$
declare amb atlas_stg_v73.stg_ambiguity%rowtype; cr atlas_stg_v73.stg_change_request%rowtype; mykey text;
begin
  if tg_op = 'DELETE' then raise exception 'aliases are never deleted; RETIRE through an approved request (F4)'; end if;
  new.alias_key := atlas_stg_v73.stg_strict_key(new.alias_raw);
  if new.construct_kind = 'relationship' and new.alias_role = 'CODE' then
    raise exception 'relationship-type codes are labels, not alias keys (R-AL-5)';
  end if;
  mykey := new.construct_kind || '|' || new.construct_id || '|' || new.alias_norm;
  if tg_op = 'UPDATE' and (new.alias_norm, new.construct_kind, new.construct_id, new.alias_raw, new.alias_role) is distinct from
                          (old.alias_norm, old.construct_kind, old.construct_id, old.alias_raw, old.alias_role) then
    raise exception 'alias identity is immutable (F4)';
  end if;
  if tg_op = 'UPDATE' and old.alias_state = 'RETIRED' and new.alias_state <> 'RETIRED' then raise exception 'RETIRED is final (F4)'; end if;
  -- (a) owner uniqueness: another construct of the SAME kind may not hold the term or its strict key in any live state
  if new.alias_state <> 'RETIRED' then
    if exists (select 1 from atlas_stg_v73.stg_alias o
               where o.construct_kind = new.construct_kind and o.construct_id <> new.construct_id
                 and o.alias_state in ('CONFIRMED_SEED','PROPOSED','CONFIRMED')
                 and (o.alias_norm = new.alias_norm or o.alias_key = new.alias_key)) then
      raise exception 'same-kind alias owner conflict: % is already owned in kind % by another construct (R-AL-2, F4)', new.alias_norm, new.construct_kind;
    end if;
    if new.alias_state in ('CONFIRMED_SEED','PROPOSED','CONFIRMED') and not (tg_op = 'UPDATE' and old.alias_state = 'AMBIGUOUS') and exists (
               select 1 from atlas_stg_v73.stg_alias o
               where o.construct_kind = new.construct_kind and o.construct_id <> new.construct_id and o.alias_state = 'AMBIGUOUS'
                 and (o.alias_norm = new.alias_norm or o.alias_key = new.alias_key)) then
      raise exception 'term % is AMBIGUOUS in kind %: no exclusive owner until an approved resolution (R-AMB-1, F4)', new.alias_norm, new.construct_kind;
    end if;
  end if;
  -- (b) insert rules
  if tg_op = 'INSERT' then
    if new.alias_state in ('CONFIRMED','RETIRED') then raise exception 'an alias is inserted CONFIRMED_SEED, PROPOSED or AMBIGUOUS; other states are reached by approved transition (R-AL-8, F4)'; end if;
    if new.alias_state = 'CONFIRMED_SEED' and not exists (select 1 from atlas_stg_v73.stg_construct c
         where c.construct_id = new.construct_id and c.construct_kind = new.construct_kind and c.origin = 'V73_SEED') then
      raise exception 'CONFIRMED_SEED is only for constructs imported from V7.3 (R-AL-8)';
    end if;
  end if;
  -- (c) AMBIGUOUS membership: a register row must exist, be OPEN or HITL_KEEP_AMBIGUOUS, and list this construct
  if new.alias_state = 'AMBIGUOUS' and (tg_op = 'INSERT' or old.alias_state <> 'AMBIGUOUS') then
    if not exists (select 1 from atlas_stg_v73.stg_ambiguity a join atlas_stg_v73.stg_ambiguity_member m on m.ambiguity_id = a.ambiguity_id
                   where a.scope = 'WITHIN_KIND' and a.construct_kind = new.construct_kind and a.status in ('OPEN','HITL_KEEP_AMBIGUOUS')
                     and a.term_norm in (new.alias_norm, new.alias_key) and m.member_id = new.construct_id) then
      raise exception 'AMBIGUOUS alias % needs an open ambiguity-register row listing % (R-AMB-1, F4)', new.alias_norm, new.construct_id;
    end if;
  end if;
  -- (d) transitions on UPDATE
  if tg_op = 'UPDATE' and new.alias_state is distinct from old.alias_state then
    if old.alias_state = 'RETIRED' then raise exception 'RETIRED is final (F4)'; end if;
    if new.alias_state = 'CONFIRMED_SEED' then raise exception 'CONFIRMED_SEED is set only at seed import'; end if;
    if new.state_change_id is null or new.state_change_id is not distinct from old.state_change_id then
      raise exception 'alias state change needs a new approved request in state_change_id (R-AL-8, F4)';
    end if;
    select * into cr from atlas_stg_v73.stg_change_request where change_id = new.state_change_id;
    if old.alias_state = 'AMBIGUOUS' then
      -- leaving AMBIGUOUS: only through the HITL_RESOLVED decision of the matching ambiguity (owner CONFIRMED, others RETIRED)
      select a.* into amb from atlas_stg_v73.stg_ambiguity a join atlas_stg_v73.stg_ambiguity_member m on m.ambiguity_id = a.ambiguity_id
        where a.scope = 'WITHIN_KIND' and a.construct_kind = new.construct_kind and a.term_norm in (new.alias_norm, new.alias_key) and m.member_id = new.construct_id
        order by (a.status = 'HITL_RESOLVED') desc limit 1;
      if not found or amb.status <> 'HITL_RESOLVED' or amb.change_id is distinct from new.state_change_id
         or not atlas_stg_v73.stg_change_valid_applied(amb.change_id) then
        raise exception 'alias % leaves AMBIGUOUS only after an approved HITL_RESOLVED decision of its ambiguity (F4)', new.alias_norm;
      end if;
      if new.alias_state <> (case when amb.resolved_owner_id = new.construct_id then 'CONFIRMED' else 'RETIRED' end) then
        raise exception 'after resolution the owner is CONFIRMED and every other member RETIRED (F4)';
      end if;
    else
      if cr.change_class not in ('UNIVERSE_CANDIDATE','DAUGHTER_CANDIDATE','AMBIGUITY_RESOLUTION') or cr.target_table <> 'stg_alias' or cr.target_key <> mykey
         or cr.after_state ->> 'state' is distinct from new.alias_state or not atlas_stg_v73.stg_change_valid_applied(cr.change_id) then
        raise exception 'alias % state % needs a validly applied request on exactly this alias with after_state.state = % (R-AL-8, F4)', mykey, new.alias_state, new.alias_state;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger stg_alias_guard_t before insert or update or delete on atlas_stg_v73.stg_alias
  for each row execute function atlas_stg_v73.stg_alias_guard();

-- 5. legacy source family keys (39 in V7.3): provenance preserved; confirmation only by an approved request  (R-XS-2, R-XS-3)
alter table atlas_stg_v73.stg_family_alias drop constraint stg_family_alias_resolution_status_check;
alter table atlas_stg_v73.stg_family_alias add constraint stg_family_alias_resolution_status_check
  check (resolution_status in ('PROPOSED','AMBIGUOUS','CONFIRMED_BY_W1_23','OWNER_DECIDED'));
alter table atlas_stg_v73.stg_family_alias
  add column legacy_name text, add column legacy_url text, add column member_basis text not null default 'ASSESSOR_PROPOSED_UNCONFIRMED',
  add column state_change_id text references atlas_stg_v73.stg_change_request;
create function atlas_stg_v73.stg_family_alias_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype; amb atlas_stg_v73.stg_ambiguity%rowtype;
begin
  if tg_op = 'DELETE' then raise exception 'family-key rows are never deleted (F4)'; end if;
  if tg_op = 'INSERT' then
    if new.resolution_status not in ('PROPOSED','AMBIGUOUS') then raise exception 'a family key enters PROPOSED or AMBIGUOUS (R-XS-3, F4)'; end if;
  else
    if (new.frozen_key, new.source_id, new.legacy_name, new.legacy_url) is distinct from (old.frozen_key, old.source_id, old.legacy_name, old.legacy_url) then
      raise exception 'original key, name and URL are preserved verbatim (R-XS-2)';
    end if;
  end if;
  if new.resolution_status = 'AMBIGUOUS' and not exists (
       select 1 from atlas_stg_v73.stg_ambiguity a join atlas_stg_v73.stg_ambiguity_member m on m.ambiguity_id = a.ambiguity_id
       where a.scope = 'SOURCE_FAMILY' and a.term_norm = lower(new.frozen_key) and a.status in ('OPEN','HITL_KEEP_AMBIGUOUS') and m.member_id = new.source_id) then
    raise exception 'AMBIGUOUS family key % needs an open ambiguity-register row listing %', new.frozen_key, new.source_id;
  end if;
  if tg_op = 'UPDATE' and new.resolution_status is distinct from old.resolution_status
     and new.resolution_status in ('CONFIRMED_BY_W1_23','OWNER_DECIDED') then
    select * into cr from atlas_stg_v73.stg_change_request where change_id = new.state_change_id;
    if not found or cr.change_class <> 'AMBIGUITY_RESOLUTION' or cr.target_table <> 'stg_family_alias'
       or cr.target_key <> new.frozen_key || '|' || new.source_id or cr.after_state ->> 'status' is distinct from new.resolution_status
       or not atlas_stg_v73.stg_change_valid_applied(cr.change_id) then
      raise exception 'family key % -> % needs a validly applied AMBIGUITY_RESOLUTION request on exactly this key and member (R-XS-3, F4)', new.frozen_key, new.source_id;
    end if;
    if exists (select 1 from atlas_stg_v73.stg_ambiguity a where a.scope = 'SOURCE_FAMILY' and a.term_norm = lower(new.frozen_key)
               and not (a.status = 'HITL_RESOLVED' and a.resolved_owner_id = new.source_id)) then
      raise exception 'family key % has a register row not resolved to %: confirm only the approved owner (F4)', new.frozen_key, new.source_id;
    end if;
    new.member_basis := 'APPROVED';
  end if;
  return new;
end $$;
create trigger stg_family_alias_guard_t before insert or update or delete on atlas_stg_v73.stg_family_alias
  for each row execute function atlas_stg_v73.stg_family_alias_guard();

-- 6. lookup: never picks by order; AMBIGUOUS persists until an approved resolution  (R-AL-4, R-AMB-1)
create function atlas_stg_v73.stg_resolve_term(p_term text, p_kind text default null)
returns table (status text, kinds text[], ids text[]) language sql stable as $$
  with m as (select construct_kind k, construct_id i, alias_state s from atlas_stg_v73.stg_alias
             where alias_norm = lower(btrim(p_term)) and alias_state <> 'RETIRED' and (p_kind is null or construct_kind = p_kind))
  select case when not exists (select 1 from m) then 'NO_MATCH'
              when (select count(distinct k) from m) > 1 then 'AMBIGUOUS_KIND'
              when exists (select 1 from m where s = 'AMBIGUOUS') or (select count(distinct i) from m) > 1 then 'AMBIGUOUS_ENTITY'
              else 'RESOLVED' end,
         coalesce((select array_agg(distinct k order by k) from m), '{}'),
         coalesce((select array_agg(distinct i order by i) from m), '{}')
$$;

-- 7. security: same posture as W1-21 (service-role only)
do $$
declare t text;
begin
  foreach t in array array['stg_ambiguity','stg_ambiguity_member','stg_id_ledger'] loop
    execute format('alter table atlas_stg_v73.%I enable row level security', t);
  end loop;
end $$;
revoke all on atlas_stg_v73.stg_ambiguity, atlas_stg_v73.stg_ambiguity_member, atlas_stg_v73.stg_id_ledger from anon, authenticated;
revoke update, delete, truncate on atlas_stg_v73.stg_id_ledger from public;

