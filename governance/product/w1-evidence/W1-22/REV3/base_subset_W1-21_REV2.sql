-- BASE FOR W1-22 REV2 TESTS ONLY. Verbatim excerpt of the W1-21 REV2 schema (Drive 1w_txxhNhHQpgjib9rRR-GADalnIdx6N9, Project doc
-- claude/W1-21-REV2-REWORK-BUNDLE-2026-10-11.md): only the tables and guards that the W1-22 interface depends on.
-- Not a Supabase object. Executed on a throwaway local PostgreSQL 16 only.
create schema atlas_stg_v73;
create table atlas_stg_v73.stg_release (
  release_id text primary key, release_status text not null, release_date date not null, html_sha256 char(64) not null,
  source_commit text not null, identity_source text not null check (identity_source = 'FROZEN_RELEASE_MANIFEST.json'),
  embedded_block_id text, embedded_block_note text, seed_role text not null default 'SEED_BASELINE', created_at timestamptz not null default now());
create table atlas_stg_v73.stg_import_run (
  run_id text primary key, release_id text not null references atlas_stg_v73.stg_release, extractor_sha256 char(64) not null,
  mode text not null check (mode in ('DRY_RUN','STAGE','READBACK','ROLLBACK')),
  status text not null check (status in ('STARTED','LOADED','READBACK_PASS','READBACK_FAIL','ROLLED_BACK')),
  expected_counts jsonb not null, observed_counts jsonb,
  authorization_ref text not null check (length(authorization_ref) > 0),
  started_at timestamptz not null default now(), finished_at timestamptz);
create table atlas_stg_v73.stg_construct (
  construct_id text not null,
  construct_kind text not null check (construct_kind in
    ('domain','lens','cycle','authority_rule','model','mode','role','node','movement','contract_ctx','context_rule',
     'system','object','actor','event','document','relationship','exchange','destination')),
  code text, name text not null, description text, domain_ids text[] not null default '{}',
  readiness_state text, readiness_declared boolean not null default true,
  claim_basis_class text check (claim_basis_class in
    ('STANDARD_DEFINED','PROCESS_FRAMEWORK_ONLY','SPECIALIZATION','FUNCTION_LEVEL_SUPPORT','NO_BASIS','NOT_ASSESSED')),
  origin text not null default 'V73_SEED' check (origin in ('V73_SEED','GOVERNED_ADDITION')),
  gap_ref text, seed_hash char(64), run_id text not null references atlas_stg_v73.stg_import_run,
  primary key (construct_id, construct_kind));
create index stg_construct_kind_idx on atlas_stg_v73.stg_construct (construct_kind);
create table atlas_stg_v73.stg_alias (
  alias_norm text not null, construct_kind text not null, construct_id text not null, alias_raw text not null,
  alias_source text not null default 'V73_SEED',
  primary key (alias_norm, construct_kind, construct_id),
  foreign key (construct_id, construct_kind) references atlas_stg_v73.stg_construct);
create table atlas_stg_v73.stg_source (
  source_id text primary key, family_key text, title text not null, issuer text, tier smallint check (tier between 1 and 4),
  admission_state text not null check (admission_state in ('SEED_GOVERNED','CANDIDATE','ADMITTED','REJECTED')),
  seed_origin text not null check (seed_origin in ('V73','REPO_V6_ONLY','NEW_FOUND')),
  authority_class text not null default 'NOT_AUTHORITATIVE_UNTIL_ADMIN_APPROVED'
     check (authority_class in ('NOT_AUTHORITATIVE_UNTIL_ADMIN_APPROVED','SEED_BASELINE_DEC059','AUTHORITATIVE_ADMIN_APPROVED')),
  url_original text, url_effective text,
  verification_status text not null default 'NOT_CHECKED' check (verification_status in ('RETRIEVED','PASS_WITH_NOTE','UNRESOLVED_URL','NOT_CHECKED')),
  record_version text, access_date date, seed_hash char(64), run_id text not null references atlas_stg_v73.stg_import_run,
  check (seed_origin <> 'REPO_V6_ONLY' or admission_state = 'CANDIDATE'));
create table atlas_stg_v73.stg_family_alias (
  frozen_key text not null, source_id text not null references atlas_stg_v73.stg_source,
  resolution_status text not null check (resolution_status in ('PROPOSED','CONFIRMED_BY_W1_23','OWNER_DECIDED')),
  note text, primary key (frozen_key, source_id));
create table atlas_stg_v73.stg_lineage (
  lineage_id bigint generated always as identity primary key, source_version_id text,
  construct_id text not null, construct_kind text not null,
  lineage_kind text not null check (lineage_kind in
    ('SEED_IMPORT','DERIVED_ROUTE','ALIAS_RESOLUTION','URL_OVERRIDE','OWNER_DECISION','GOVERNED_ADDITION','PROFILE_CORRECTION','SPLIT','MERGE','PROMOTION','ROLLBACK')),
  decision_ref text, approval_id text, detail jsonb, run_id text not null references atlas_stg_v73.stg_import_run,
  created_at timestamptz not null default now(),
  check (lineage_kind in ('SEED_IMPORT','DERIVED_ROUTE') or approval_id is not null));
create function atlas_stg_v73.stg_lineage_append_only() returns trigger language plpgsql as $$
begin raise exception 'stg_lineage is append-only'; end $$;
create trigger stg_lineage_no_mod before update or delete on atlas_stg_v73.stg_lineage
  for each row execute function atlas_stg_v73.stg_lineage_append_only();
create table atlas_stg_v73.stg_admin_role (role_code text primary key, description text not null, active boolean not null default true);
create table atlas_stg_v73.stg_change_request (
  change_id text primary key,
  change_class text not null check (change_class in
    ('SOURCE_ADMISSION','SOURCE_CHANGE','URL_OVERRIDE','UNIVERSE_CANDIDATE','DAUGHTER_CANDIDATE','PACK_RESOLUTION',
     'ROLE_PROFILE_CHANGE','ROUTE_ASSIGNMENT','PROMOTION')),
  scope text not null check (scope in ('UNIVERSE','DAUGHTER')),
  target_table text not null, target_key text not null,
  proposed_by text not null, proposed_at timestamptz not null default now(),
  gap_ref text, rationale text not null, before_state jsonb, after_state jsonb,
  evidence_pointer text not null, rollback_pointer text not null, consequential boolean not null,
  approval_state text not null default 'PENDING' check (approval_state in ('PENDING','APPROVED','REJECTED','SUPERSEDED')),
  admin_notified_at timestamptz,
  applied_state text not null default 'NOT_APPLIED' check (applied_state in ('NOT_APPLIED','APPLIED','ROLLED_BACK')));
create table atlas_stg_v73.stg_approval (
  approval_id text primary key, change_id text not null unique references atlas_stg_v73.stg_change_request,
  approver text not null, approver_role text not null references atlas_stg_v73.stg_admin_role,
  decision text not null check (decision in ('APPROVE','REJECT')), change_hash char(64) not null,
  decided_at timestamptz not null default now(), note text);
create function atlas_stg_v73.stg_change_hash(p_change_id text) returns char(64) language sql stable as $$
  select encode(sha256(convert_to(jsonb_build_object(
           'change_id', c.change_id, 'change_class', c.change_class, 'scope', c.scope,
           'target_table', c.target_table, 'target_key', c.target_key,
           'before', c.before_state, 'after', c.after_state, 'rationale', c.rationale,
           'evidence', c.evidence_pointer, 'rollback', c.rollback_pointer)::text, 'UTF8')), 'hex')::char(64)
  from atlas_stg_v73.stg_change_request c where c.change_id = p_change_id
$$;
create function atlas_stg_v73.stg_change_valid_applied(p_change_id text) returns boolean language sql stable as $$
  select exists (
    select 1 from atlas_stg_v73.stg_change_request c
    join atlas_stg_v73.stg_approval a on a.change_id = c.change_id
    where c.change_id = p_change_id and c.approval_state = 'APPROVED' and c.applied_state = 'APPLIED'
      and a.decision = 'APPROVE' and a.change_hash = atlas_stg_v73.stg_change_hash(c.change_id))
$$;
create function atlas_stg_v73.stg_approval_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype;
begin
  select * into cr from atlas_stg_v73.stg_change_request where change_id = new.change_id;
  if cr.approval_state <> 'PENDING' then raise exception 'change % is % and cannot be decided again', cr.change_id, cr.approval_state; end if;
  if new.approver = cr.proposed_by then raise exception 'proposer cannot approve own change (G-083)'; end if;
  if not exists (select 1 from atlas_stg_v73.stg_admin_role r where r.role_code = new.approver_role and r.active) then raise exception 'approver role not active'; end if;
  if new.change_hash is distinct from atlas_stg_v73.stg_change_hash(new.change_id) then raise exception 'approval hash does not match the content of change % (F1)', new.change_id; end if;
  update atlas_stg_v73.stg_change_request set approval_state = case when new.decision = 'APPROVE' then 'APPROVED' else 'REJECTED' end where change_id = new.change_id;
  return new;
end $$;
create trigger stg_approval_guard_t before insert on atlas_stg_v73.stg_approval for each row execute function atlas_stg_v73.stg_approval_guard();
create function atlas_stg_v73.stg_approval_immutable() returns trigger language plpgsql as $$
begin raise exception 'stg_approval rows are immutable'; end $$;
create trigger stg_approval_immutable_t before update or delete on atlas_stg_v73.stg_approval for each row execute function atlas_stg_v73.stg_approval_immutable();
create function atlas_stg_v73.stg_change_freeze() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'stg_change_request rows are not deleted'; end if;
  if old.approval_state <> 'PENDING' and (
       new.change_class, new.scope, new.target_table, new.target_key, new.before_state, new.after_state,
       new.rationale, new.evidence_pointer, new.rollback_pointer, new.proposed_by, new.change_id)
     is distinct from
      (old.change_class, old.scope, old.target_table, old.target_key, old.before_state, old.after_state,
       old.rationale, old.evidence_pointer, old.rollback_pointer, old.proposed_by, old.change_id) then
    raise exception 'content of decided change % is frozen (F1)', old.change_id;
  end if;
  if new.approval_state is distinct from old.approval_state and new.approval_state <> 'SUPERSEDED' and pg_trigger_depth() < 2 then
    raise exception 'approval_state can only be set by a recorded approval (F1)';
  end if;
  return new;
end $$;
create trigger stg_change_freeze_t before update or delete on atlas_stg_v73.stg_change_request for each row execute function atlas_stg_v73.stg_change_freeze();
create function atlas_stg_v73.stg_apply_guard() returns trigger language plpgsql as $$
begin
  if new.applied_state = 'APPLIED' then
    if new.approval_state <> 'APPROVED' then raise exception 'change % is % and cannot be applied', new.change_id, new.approval_state; end if;
    if not exists (select 1 from atlas_stg_v73.stg_approval a where a.change_id = new.change_id and a.decision = 'APPROVE'
                     and a.change_hash = atlas_stg_v73.stg_change_hash(new.change_id)) then
      raise exception 'change % has no approval whose hash matches its current content (stale approval, F1)', new.change_id;
    end if;
  end if;
  return new;
end $$;
create trigger stg_apply_guard_t before insert or update of applied_state on atlas_stg_v73.stg_change_request for each row execute function atlas_stg_v73.stg_apply_guard();

