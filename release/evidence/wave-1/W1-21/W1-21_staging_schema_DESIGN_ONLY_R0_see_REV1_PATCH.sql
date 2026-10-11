-- W1-21 DESIGN ONLY. NOT EXECUTED. No DDL has been run against any database.
-- Target (future, after W1-23 QA PASS + W1-24 Owner authorization): Supabase project aaoyesktlzhaunqqjhdq,
-- NEW schema atlas_stg_v73. No existing public.atlas_* table is created, altered, read-for-write or dropped.
-- Frozen seed: Universe V7.3, SHA-256 31503394e84d01b4b50831e82cbcd674c5cf77ea83021d95cf2a0ba07e42debd, commit e5f5029.

create schema atlas_stg_v73;

-- 1. Release identity (from FROZEN_RELEASE_MANIFEST.json only; never from the embedded identity block) [G-050, IC-1]
create table atlas_stg_v73.stg_release (
  release_id        text primary key,                 -- 'Universe V7.3'
  release_status    text not null,                    -- FROZEN_CANONICAL_FOUNDATION
  release_date      date not null,                    -- 2026-08-30
  html_sha256       char(64) not null,
  source_commit     text not null,                    -- e5f5029...
  identity_source   text not null check (identity_source = 'FROZEN_RELEASE_MANIFEST.json'),
  embedded_block_id text,                             -- stale 'supply-chain-logistics-universe-v7.2' kept as evidence only
  embedded_block_note text,
  seed_role         text not null default 'SEED_BASELINE',  -- DEC-059
  created_at        timestamptz not null default now()
);

create table atlas_stg_v73.stg_import_run (
  run_id        text primary key,                     -- operation identity, e.g. W125-<yyyymmdd>-<hhmm>
  release_id    text not null references atlas_stg_v73.stg_release,
  extractor_sha256 char(64) not null,
  mode          text not null check (mode in ('DRY_RUN','STAGE','READBACK','ROLLBACK')),
  status        text not null check (status in ('STARTED','LOADED','READBACK_PASS','READBACK_FAIL','ROLLED_BACK')),
  expected_counts jsonb not null,
  observed_counts jsonb,
  authorization_ref text not null,                    -- W1-24 Owner record id; load refuses empty
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

-- 2. Constructs: every V7.3 registry record, one typed table (domains, lenses, cycles, rules, modes, roles, nodes, entities...)
create table atlas_stg_v73.stg_construct (
  construct_id   text not null,                       -- V7.3 id as frozen (e.g. obj-arrival-notice)
  construct_kind text not null check (construct_kind in
    ('domain','lens','cycle','authority_rule','model','mode','role','node','movement','contract_ctx','context_rule',
     'system','object','actor','event','document','relationship','exchange','destination')),
  code           text,
  name           text not null,
  description    text,
  domain_ids     text[] not null default '{}',
  readiness_state text,                               -- lens states carried AS DECLARED (G-055)
  readiness_declared boolean not null default true,   -- self-declared, never upgraded
  claim_basis_class text check (claim_basis_class in
    ('STANDARD_DEFINED','PROCESS_FRAMEWORK_ONLY','SPECIALIZATION','FUNCTION_LEVEL_SUPPORT','NO_BASIS','NOT_ASSESSED')), -- G-058
  origin         text not null default 'V73_SEED' check (origin in ('V73_SEED','GOVERNED_ADDITION')),
  gap_ref        text,                                -- G-nnn for GOVERNED_ADDITION rows
  seed_hash      char(64),                            -- sha256 of canonical JSON of the frozen record; null for additions
  run_id         text not null references atlas_stg_v73.stg_import_run,
  primary key (construct_id, construct_kind)
);
create index stg_construct_kind_idx on atlas_stg_v73.stg_construct (construct_kind);

create table atlas_stg_v73.stg_alias (
  alias_norm     text not null,                       -- lower-cased, trimmed
  construct_kind text not null,                       -- aliases are TYPE-SCOPED (G-062: dispatch, rma)
  construct_id   text not null,
  alias_raw      text not null,
  alias_source   text not null default 'V73_SEED',
  primary key (alias_norm, construct_kind, construct_id),
  foreign key (construct_id, construct_kind) references atlas_stg_v73.stg_construct
);

-- 3. Relationships (30 types; 20 process relationships; additive-only vocabulary)
create table atlas_stg_v73.stg_relationship_type (
  type_id text primary key,
  from_kinds text[] not null,
  to_kinds text[] not null,
  vocabulary_version text not null default 'v1.1'
);
create table atlas_stg_v73.stg_edge (
  edge_id       text primary key,
  type_id       text not null references atlas_stg_v73.stg_relationship_type,
  from_id       text not null, from_kind text not null,
  to_id         text not null, to_kind   text not null,
  edge_class    text not null check (edge_class in ('V73_SEED','GOVERNED_ADDITION','DEPENDENCY_IMPACT')),
  criticality   text check (criticality in ('LOW','MEDIUM','HIGH','CRITICAL')),   -- drives high-risk traversal (DEC-058 d)
  gap_ref       text,
  run_id        text not null references atlas_stg_v73.stg_import_run,
  foreign key (from_id, from_kind) references atlas_stg_v73.stg_construct,
  foreign key (to_id, to_kind)     references atlas_stg_v73.stg_construct
);
create index stg_edge_from_idx on atlas_stg_v73.stg_edge (from_id, from_kind);
create index stg_edge_to_idx   on atlas_stg_v73.stg_edge (to_id, to_kind);

-- 4. Sources, versions, routes, aliases, overrides  [G-051..G-057, G-063, G-078]
create table atlas_stg_v73.stg_source (
  source_id      text primary key,                    -- src-*
  family_key     text,
  title          text not null,
  issuer         text,
  tier           smallint check (tier between 1 and 4),            -- G-078 admission tiers
  admission_state text not null check (admission_state in ('SEED_GOVERNED','CANDIDATE','ADMITTED','REJECTED')),
  seed_origin    text not null check (seed_origin in ('V73','REPO_V6_ONLY','NEW_FOUND')),
  authority_class text not null default 'NOT_AUTHORITATIVE_UNTIL_ADMIN_APPROVED',
  url_original   text,
  url_effective  text,                                -- via stg_source_override only
  verification_status text not null default 'NOT_CHECKED'
     check (verification_status in ('RETRIEVED','PASS_WITH_NOTE','UNRESOLVED_URL','NOT_CHECKED')),   -- G-057
  record_version text,
  access_date    date,
  seed_hash      char(64),
  run_id         text not null references atlas_stg_v73.stg_import_run,
  check (seed_origin <> 'REPO_V6_ONLY' or admission_state = 'CANDIDATE')   -- 15 repo-only ids are CANDIDATE only
);
create table atlas_stg_v73.stg_source_override (
  source_id text not null references atlas_stg_v73.stg_source,
  field_name text not null,
  original_value text not null, replacement_value text not null,
  authority text not null,                             -- e.g. 'Owner confirmation 2026-10-10 (W1-07-QA AK43)'
  readback_required boolean not null default true,
  readback_result text,
  primary key (source_id, field_name)
);
create table atlas_stg_v73.stg_family_alias (            -- otif, apqcFinance, uncitral [G-053]
  frozen_key text not null,
  source_id  text not null references atlas_stg_v73.stg_source,
  resolution_status text not null check (resolution_status in ('PROPOSED','CONFIRMED_BY_W1_23','OWNER_DECIDED')),
  note text,
  primary key (frozen_key, source_id)
);
create table atlas_stg_v73.stg_source_version (          -- source provision / version  [DEC-058 c]
  source_version_id text primary key,
  source_id   text not null references atlas_stg_v73.stg_source,
  provision   text,                                    -- article / section / table locator, null = whole instrument
  version_label text not null, effective_date date, retrieved_at timestamptz, content_hash char(64),
  status text not null check (status in ('CURRENT','SUPERSEDED','CANDIDATE_DELTA'))
);
create table atlas_stg_v73.stg_source_route (            -- construct-level source link table [G-051, G-054]
  source_id  text not null references atlas_stg_v73.stg_source,
  target_id  text not null, target_kind text not null,  -- domain | lens | cycle | placement_group | regime | condition
  route_basis text not null check (route_basis in
     ('DOMAIN_SOURCES','FAMILY_KEY','EVIDENCE_PROFILE','LENS_CYCLE_DIRECT','PLACEMENT_GROUP','ALIAS_TABLE','OWNER_ASSIGNED','ASSESSOR_PROPOSED_UNCONFIRMED')),
  primary key (source_id, target_id, target_kind, route_basis)
);
create table atlas_stg_v73.stg_placement (                -- 192 reference placements; 82 without resolved source id
  placement_id text primary key, group_id text not null, anchor_label text not null,
  source_id text references atlas_stg_v73.stg_source,
  route_class text not null check (route_class in ('SOURCE_RESOLVED','NONE')),
  check ((source_id is null) = (route_class = 'NONE'))
);
-- Derived entity review scope: a VIEW, labelled derived, never a source claim [G-051]
create view atlas_stg_v73.v_source_entity_scope as
select r.source_id, c.construct_id, c.construct_kind, 'DERIVED_FROM_CONSTRUCT'::text as provenance_class
from atlas_stg_v73.stg_source_route r
join atlas_stg_v73.stg_construct c on r.target_kind = 'domain' and r.target_id = any (c.domain_ids)
where r.route_basis <> 'ASSESSOR_PROPOSED_UNCONFIRMED';

-- 5. Lineage (append-only): source provision/version -> Atlas component  [DEC-058 c, G-058]
create table atlas_stg_v73.stg_lineage (
  lineage_id bigint generated always as identity primary key,
  source_version_id text references atlas_stg_v73.stg_source_version,
  construct_id text not null, construct_kind text not null,
  lineage_kind text not null check (lineage_kind in
    ('SEED_IMPORT','DERIVED_ROUTE','ALIAS_RESOLUTION','URL_OVERRIDE','OWNER_DECISION','GOVERNED_ADDITION','PROFILE_CORRECTION','SPLIT','MERGE','PROMOTION','ROLLBACK')),
  decision_ref text,                                   -- DEC-0nn / Owner message ref / approval_id
  approval_id text,                                    -- required for kinds other than SEED_IMPORT/DERIVED_ROUTE
  detail jsonb,
  run_id text not null references atlas_stg_v73.stg_import_run,
  created_at timestamptz not null default now(),
  check (lineage_kind in ('SEED_IMPORT','DERIVED_ROUTE') or approval_id is not null)
);
create function atlas_stg_v73.stg_lineage_append_only() returns trigger language plpgsql as $$
begin raise exception 'stg_lineage is append-only'; end $$;
create trigger stg_lineage_no_mod before update or delete on atlas_stg_v73.stg_lineage
  for each row execute function atlas_stg_v73.stg_lineage_append_only();

-- 6. Roles (broker/agent family; retailer; marketplace operator), context options, compatibility profile  [G-010, G-011, G-079, G-080, G-046, G-047]
create table atlas_stg_v73.stg_role_family (
  role_id text primary key, family text not null,       -- 'BROKER_AGENT' | 'SELLER' | existing V7.3 roles
  represents text, takes_custody text check (takes_custody in ('NONE','CONDITIONAL','FULL')),
  liability_class text, licensing_authority text[],
  sells_or_facilitates_sale boolean, takes_title boolean, seller_of_record text,
  origin text not null check (origin in ('V73_SEED','GOVERNED_ADDITION')), gap_ref text,
  distinct_from text[] default '{}'                      -- customs broker 'broker' must stay distinct from freight broker
);
create table atlas_stg_v73.stg_context_option (
  option_id text primary key, option_group text not null,       -- carriage_regime etc.
  label text not null,
  default_selected boolean not null default false check (default_selected = false),   -- never defaulted (S02)
  governing_mode text[] not null,                          -- RULE_NOT_GOVERNING outside these modes
  origin text not null check (origin in ('V73_SEED','GOVERNED_ADDITION')), gap_ref text
);
create table atlas_stg_v73.stg_profile (                  -- 780 seed + 65 additions = 845 (13 x (60+3+2))
  mode_id text not null, dimension text not null,           -- role | node | movement | contract | context
  item_id text not null,
  seed_status text check (seed_status in ('ENABLED','CONDITIONAL','INCOMPATIBLE')),  -- null for additions
  status text not null check (status in ('ENABLED','CONDITIONAL','INCOMPATIBLE')),
  basis text not null,                                      -- PROFILE_ENABLED_LIST | PROFILE_INCOMPATIBLE_LIST | DEFAULT_BY_OMISSION | RULE_*
  engine_wording text not null,                             -- carried unchanged
  change_ref text,                                          -- PC-nn or G-nnn; null = unchanged from seed
  primary key (mode_id, dimension, item_id),
  check ((seed_status is null and change_ref is not null) or seed_status is not null),
  check (status = seed_status or change_ref is not null)    -- no silent reclassification
);

-- 7. Regulatory source packs: place and mechanism  [G-006, G-007, G-008, G-082, DEC-058 C]
create table atlas_stg_v73.stg_reg_pack (
  pack_id text primary key, label text not null,            -- e.g. 'FDA', 'DSCSA', 'UNECE vehicle regulations'
  jurisdiction text not null, domain_scope text[] not null, industry_scope text[],
  pack_state text not null default 'CANDIDATE' check (pack_state in ('CANDIDATE','RESOLVED','RETIRED')),
  operative boolean not null default false check (operative = false or pack_state = 'RESOLVED'),
  verified_at timestamptz, gap_ref text
);
create table atlas_stg_v73.stg_reg_pack_member (
  pack_id text not null references atlas_stg_v73.stg_reg_pack,
  source_id text not null references atlas_stg_v73.stg_source,
  primary key (pack_id, source_id)
);
create table atlas_stg_v73.stg_reg_pack_route (            -- jurisdiction / condition axis; goods, lane, legal scope resolve packs
  pack_id text not null references atlas_stg_v73.stg_reg_pack,
  target_id text not null, target_kind text not null,       -- condition (cond-dangerous-goods, cold-chain), construct, mode, role
  route_kind text not null check (route_kind in ('JURISDICTION','CONDITION','CONSTRUCT','MODE','ROLE')),
  primary key (pack_id, target_id, target_kind, route_kind)
);

-- 8. Recall / regulatory-audit process construct (APQC 6.4) and APQC anchors  [G-001..G-005, DEC-058 a, b]
create table atlas_stg_v73.stg_pcf_anchor (
  anchor_id text primary key, framework text not null, pcf_code text not null, label text not null,
  construct_id text not null, construct_kind text not null,
  anchor_class text not null check (anchor_class in ('V73_SEED_PLACEMENT','GOVERNED_ADDITION')),
  gap_ref text,
  foreign key (construct_id, construct_kind) references atlas_stg_v73.stg_construct
);
create table atlas_stg_v73.stg_subcapability (
  subcap_id text primary key, parent_construct_id text not null, parent_construct_kind text not null,
  subcap_kind text not null check (subcap_kind in
   ('RECALL_INITIATION','AFFECTED_TRACEABILITY','CONTAINMENT_HOLD','NOTIFICATION','DISPOSITION','REGULATORY_AUDIT_SUPPORT',
    'DESTROY_AND_EVIDENCE','AUTHORITY_FILING','HAZARD_CLASS_ATTRIBUTE','REGULATOR_NOTIFICATION','EHS_EMERGENCY_ANCHOR')),
  fail_closed_rule text, gap_ref text not null,
  foreign key (parent_construct_id, parent_construct_kind) references atlas_stg_v73.stg_construct
);

-- 9. Human-in-the-loop approval + change control  [DEC-058 e]
create table atlas_stg_v73.stg_change_request (
  change_id text primary key, change_kind text not null, target_table text not null, target_key text not null,
  proposed_by text not null, proposed_at timestamptz not null default now(),
  gap_ref text, rationale text not null, before_state jsonb, after_state jsonb,
  consequential boolean not null,                          -- true for promotions, canonical lineage, role/profile/pack changes
  state text not null check (state in ('PROPOSED','APPROVED','REJECTED','APPLIED','ROLLED_BACK'))
);
create table atlas_stg_v73.stg_approval (
  approval_id text primary key,
  change_id text not null references atlas_stg_v73.stg_change_request,
  approver text not null, approver_role text not null check (approver_role in ('OWNER','ADMIN_DELEGATE')),
  decision text not null check (decision in ('APPROVE','REJECT')),
  change_hash char(64) not null,                           -- sha256 of before/after at approval; apply refuses on mismatch
  decided_at timestamptz not null default now(), note text
);
-- Separation of duties (proposer cannot approve own consequential change unless OWNER) is enforced by trigger, not CHECK
create function atlas_stg_v73.stg_approval_guard() returns trigger language plpgsql as $$
declare cr atlas_stg_v73.stg_change_request%rowtype;
begin
  select * into cr from atlas_stg_v73.stg_change_request where change_id = new.change_id;
  if cr.consequential and new.approver_role <> 'OWNER' and new.approver = cr.proposed_by then
    raise exception 'proposer cannot approve own consequential change';
  end if;
  return new;
end $$;
create trigger stg_approval_guard_t before insert on atlas_stg_v73.stg_approval
  for each row execute function atlas_stg_v73.stg_approval_guard();

-- 10. Gap register carry-in and closure evidence  [W1-20 register; SEQ-STD step 7]
create table atlas_stg_v73.stg_gap (
  gap_id text primary key, title text not null, gap_class smallint, destination_layer text,
  status text not null check (status in ('OPEN','CLOSED_AT_BACKEND','ACCEPTED_RESIDUAL','DEFERRED')),
  closure_test_id text
);
create table atlas_stg_v73.stg_closure_evidence (
  gap_id text not null references atlas_stg_v73.stg_gap, test_id text not null,
  run_id text not null references atlas_stg_v73.stg_import_run,
  result text not null check (result in ('PASS','FAIL','NOT_RUN')),
  query_hash char(64), result_digest jsonb, recorded_at timestamptz not null default now(),
  primary key (gap_id, test_id, run_id)
);

-- 11. Security: staging is service-role only
alter table atlas_stg_v73.stg_construct enable row level security;
-- (same statement for every stg_* table; no policies = no anon/authenticated access)
revoke all on schema atlas_stg_v73 from anon, authenticated;
