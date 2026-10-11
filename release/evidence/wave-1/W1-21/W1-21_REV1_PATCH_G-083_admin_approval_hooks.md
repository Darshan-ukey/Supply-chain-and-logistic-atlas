# W1-21 REV1 PATCH (same run, 2026-10-11): G-083 admin approval hooks. READ THIS WITH THE R0 FILES IN THIS FOLDER.

Why: the first pass read the W1-20 Drive register only to row 80 and missed G-083 and G-084 (rows 81-82, added by the W1-20 R4 Owner decisions, ledger EVT-W120-R4). The register has 81 entries (not 74). G-083 names W1-21 (schema). This patch supersedes the parts of the R0 files listed below; everything else in R0 stands. A complete REV1 set (README, schema, matrix incl. G-083/G-084) is in the Claude Project doc claude/W1-21-IMPORT-DESIGN-BUNDLE-2026-10-11.md; ChatGPT cannot read Project docs, so the replacement text is reproduced here.

## 1. What changes
- README 1: "All 51 entries (38 named directly + 13 via RESP-PC)" becomes "All 52 entries (39 named directly, including G-083, plus the 13 via RESP-PC); G-084 is a deferred pointer (build is a future backlog item, not W1-21)". Schema size: 26 tables, 6 views, 5 functions, 5 triggers (R0 said 25/6/3).
- README 1 and 11: the statement that G-083/G-084 do not exist in the register (OQ-1) is WITHDRAWN (error of this run). Remaining open questions: OQ-2 (uncitral alias), OQ-3 (promotion mapping into atl_123 kernel), OQ-4..OQ-7 unchanged.
- README 2/4.9/8: register is 81 entries (not 74). DDL parse count now 42 + 6 statements.
- README 7.3 is REPLACED by the text in section 3 below. In R0 the proposer-approver rule exempted the OWNER role; G-083 says the proposer is never the approver, so NO role is exempt.
- README 9 row (e): evidence = stg_admin_role, stg_change_request, stg_approval (hash-bound), guard triggers; tests T-16, T-28.
- README 10: T-16 negative check reads "proposer approving own change refused (any role)"; NEW T-28 (section 4 below).
- Schema file: section 9 (change control) is REPLACED by the SQL in section 2; in stg_source the authority_class column gets a CHECK (section 2, item B). Table count 26.
- Matrix: add rows G-083 and G-084 (section 5).

## 2. SQL replacement (design only, not executed; parsed OK with a PostgreSQL parser, whole REV1 schema 42 statements)
### A. Replace section 9 of staging_schema_DESIGN_ONLY.sql with:
```sql
-- 9. Human-in-the-loop approval + change control  [DEC-058 e; G-083 admin approval hooks; G-084 build deferred]
create table atlas_stg_v73.stg_admin_role (               -- role is a field so more admin roles can be added later (G-083)
  role_code text primary key, description text not null, active boolean not null default true
);   -- seed row at import: ('OWNER_ADMIN','Owner acts as admin until other roles are defined', true)
create table atlas_stg_v73.stg_change_request (
  change_id text primary key,
  change_class text not null check (change_class in
    ('SOURCE_ADMISSION','SOURCE_CHANGE','URL_OVERRIDE','UNIVERSE_CANDIDATE','DAUGHTER_CANDIDATE','PACK_RESOLUTION',
     'ROLE_PROFILE_CHANGE','ROUTE_ASSIGNMENT','PROMOTION')),
  scope text not null check (scope in ('UNIVERSE','DAUGHTER')),      -- daughter changes are candidates only
  target_table text not null, target_key text not null,
  proposed_by text not null, proposed_at timestamptz not null default now(),
  gap_ref text, rationale text not null,
  before_state jsonb, after_state jsonb,
  evidence_pointer text not null,
  rollback_pointer text not null,
  consequential boolean not null,
  approval_state text not null default 'PENDING' check (approval_state in ('PENDING','APPROVED','REJECTED','SUPERSEDED')),
  admin_notified_at timestamptz,                           -- hook for the later notification build (G-084); null until built
  applied_state text not null default 'NOT_APPLIED' check (applied_state in ('NOT_APPLIED','APPLIED','ROLLED_BACK'))
);
create table atlas_stg_v73.stg_approval (
  approval_id text primary key,
  change_id text not null references atlas_stg_v73.stg_change_request,
  approver text not null,                                  -- approver identity
  approver_role text not null references atlas_stg_v73.stg_admin_role,
  decision text not null check (decision in ('APPROVE','REJECT')),
  change_hash char(64) not null,                           -- sha256 of before/after at approval; apply refuses on mismatch
  decided_at timestamptz not null default now(), note text
);
-- The proposer is NEVER the approver (G-083); no role is exempt. The decision also sets the request's approval_state.
create function atlas_stg_v73.stg_approval_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype;
begin
  select * into cr from atlas_stg_v73.stg_change_request where change_id = new.change_id;
  if new.approver = cr.proposed_by then
    raise exception 'proposer cannot approve own change (G-083)';
  end if;
  if not exists (select 1 from atlas_stg_v73.stg_admin_role r where r.role_code = new.approver_role and r.active) then
    raise exception 'approver role not active';
  end if;
  update atlas_stg_v73.stg_change_request
     set approval_state = case when new.decision = 'APPROVE' then 'APPROVED' else 'REJECTED' end
   where change_id = new.change_id;
  return new;
end $$;
create trigger stg_approval_guard_t before insert on atlas_stg_v73.stg_approval
  for each row execute function atlas_stg_v73.stg_approval_guard();
-- A change can be marked APPLIED only when APPROVED (a candidate stays non-operative while PENDING)
create function atlas_stg_v73.stg_apply_guard() returns trigger language plpgsql as $$
begin
  if new.applied_state = 'APPLIED' and new.approval_state <> 'APPROVED' then
    raise exception 'change % is % and cannot be applied', new.change_id, new.approval_state;
  end if;
  return new;
end $$;
create trigger stg_apply_guard_t before update of applied_state on atlas_stg_v73.stg_change_request
  for each row execute function atlas_stg_v73.stg_apply_guard();
-- Operative gates for sources and packs: authority/RESOLVED only with an APPROVED request on the same key
create function atlas_stg_v73.stg_operative_guard() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'stg_source' and new.authority_class = 'AUTHORITATIVE_ADMIN_APPROVED' then
    if not exists (select 1 from atlas_stg_v73.stg_change_request c
                   where c.target_table = 'stg_source' and c.target_key = new.source_id
                     and c.change_class = 'SOURCE_ADMISSION' and c.approval_state = 'APPROVED') then
      raise exception 'source % has no approved admission request', new.source_id;
    end if;
  elsif tg_table_name = 'stg_reg_pack' and new.pack_state = 'RESOLVED' then
    if not exists (select 1 from atlas_stg_v73.stg_change_request c
                   where c.target_table = 'stg_reg_pack' and c.target_key = new.pack_id
                     and c.change_class = 'PACK_RESOLUTION' and c.approval_state = 'APPROVED') then
      raise exception 'pack % has no approved resolution request', new.pack_id;
    end if;
  end if;
  return new;
end $$;
create trigger stg_source_operative_t before insert or update on atlas_stg_v73.stg_source
  for each row execute function atlas_stg_v73.stg_operative_guard();
create trigger stg_pack_operative_t before insert or update on atlas_stg_v73.stg_reg_pack
  for each row execute function atlas_stg_v73.stg_operative_guard();
```
### B. In stg_source replace the authority_class line with:
```sql
  authority_class text not null default 'NOT_AUTHORITATIVE_UNTIL_ADMIN_APPROVED'
     check (authority_class in ('NOT_AUTHORITATIVE_UNTIL_ADMIN_APPROVED','SEED_BASELINE_DEC059','AUTHORITATIVE_ADMIN_APPROVED')),  -- V7.3 seeds load as SEED_BASELINE_DEC059
```

## 3. README 7.3 replacement text
Human-in-the-loop approval and admin approval hooks (DEC-058 e; G-083; G-084 build deferred). Every change-candidate (source admission or change, URL override, Universe candidate, daughter candidate, pack resolution, role/profile change, route assignment, promotion; change_class) is a stg_change_request carrying change class, scope (UNIVERSE or DAUGHTER; daughter changes are candidates only), before and after state, rationale, evidence pointer, rollback pointer, proposer, timestamps and approval_state PENDING / APPROVED / REJECTED / SUPERSEDED. A stg_approval row records approver identity, approver role (a field referencing stg_admin_role; seed role OWNER_ADMIN = the Owner until other roles are defined), decision, timestamp and a change_hash; apply refuses on a hash mismatch (stale approval). The proposer is NEVER the approver, with no exempt role (trigger stg_approval_guard). A candidate is not operative while PENDING: stg_apply_guard refuses APPLIED unless APPROVED, and stg_operative_guard refuses source authority AUTHORITATIVE_ADMIN_APPROVED and pack state RESOLVED without an APPROVED request on the same key. V7.3 seed sources load as SEED_BASELINE_DEC059 (authority by DEC-059, not by this pipeline); the 15 repo-only ids and any found source load as CANDIDATE / NOT_AUTHORITATIVE. Everything consequential in this design goes through this table. admin_notified_at is a nullable hook for the later notification build; the queue UI, dashboard, notifications and extra admin roles (G-084) are NOT built and no task is created. The Product Definition and Architecture Registry tabs were not edited and were not read in this run (Owner flag in G-083).

## 4. New test T-28 (G-083 admin approval hooks)
Expected: change-candidate rows carry change class, approval state, approver identity and role, timestamps, before/after, rationale, evidence pointer, rollback pointer; a test candidate stays non-operative while PENDING and becomes operative only with an APPROVED record by an active admin role. Negative: proposer = approver refused; APPLIED while PENDING refused; source set AUTHORITATIVE_ADMIN_APPROVED or pack RESOLVED without an approved request refused. Closes G-083 at W1-26 together with T-16.

## 5. Matrix rows to add (compact form)
G-083 | Admin approval hooks in the backend design (Owner = admin for now; roles later) | stg_admin_role, stg_change_request, stg_approval, triggers stg_approval_guard / stg_apply_guard / stg_operative_guard | Change-candidate objects carry the G-083 fields; candidate not operative while PENDING; proposer never approver (no exempt role); source authority and pack RESOLVED require an APPROVED request; role is a field so more admin roles can be added; Product Definition/Architecture Registry wording is an Owner flag, not edited | T-16,T-28 | OPEN
G-084 | Admin approval pipeline, dashboard and notifications (build later) | none (G-083 hooks only; admin_notified_at is the notification hook) | NOT W1-21 work: pointer only; future Owner-approved backlog; no task created | none (carried in stg_gap, DEFERRED) | DEFERRED

## 6. REV1 local file hashes (bundle in the Claude Project doc)
ee6afbf8b66deefa835402111cd44e0a43737ca6af61684d0363c33ca9680a47  README.md (REV1)
508d84cdbcef998c315702325e54e18f871f09b178b0ad6fda3426ba6582cd14  staging_schema_DESIGN_ONLY.sql (REV1)
ba4edfb0e6e18763cee3f9b5f1a8b20ec64a5b0fdbc3b3d2d894b00e32c3e823  staging_queries_DESIGN_ONLY.sql (unchanged)
9629842dcb6c35056d1f61d3c996883fa365aa51c7b97f003309427330e09859  gap_closure_matrix.tsv (REV1, 52 rows + G-084 pointer)
