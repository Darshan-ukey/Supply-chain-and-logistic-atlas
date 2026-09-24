-- ATL-82 / ATL-60B
-- Corrected candidate physical DDL design only. NOT AUTHORIZED TO APPLY.
-- ATL-83 C1-C4/C7/C8 incorporated. Z6 readiness persistence split to ATL-92 by Owner decision D1=A.
-- Target: Supabase project aaoyesktlzhaunqqjhdq / public schema.
-- No data materialization or seed activation is included.

begin;

create table public.atlas_knowledge_entity_types (
  type_id text not null,
  type_version text not null,
  name text not null,
  description text not null,
  default_ownership_zone text,
  schema_contract jsonb not null default '{}'::jsonb,
  status text not null default 'CANDIDATE',
  governing_contract_id text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (type_id, type_version),
  constraint atlas_knowledge_entity_types_zone_chk check (default_ownership_zone is null or default_ownership_zone in ('Z0','Z1','Z2','Z3','Z4','Z5','Z6','Z7')),
  constraint atlas_knowledge_entity_types_status_chk check (status in ('CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED'))
);

create table public.atlas_knowledge_relationship_types (
  type_id text not null,
  type_version text not null,
  name text not null,
  description text not null,
  from_type_constraints jsonb not null default '{}'::jsonb,
  to_type_constraints jsonb not null default '{}'::jsonb,
  schema_contract jsonb not null default '{}'::jsonb,
  status text not null default 'CANDIDATE',
  governing_contract_id text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (type_id, type_version),
  constraint atlas_knowledge_relationship_types_status_chk check (status in ('CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED'))
);

create table public.atlas_knowledge_generation_runs (
  run_id text primary key,
  generator_contract_id text not null,
  generator_contract_version text not null,
  generator_implementation_identity text not null,
  run_status text not null default 'CANDIDATE',
  consumed_knowledge_manifest jsonb not null,
  consumed_knowledge_manifest_hash text not null,
  parameters_hash text,
  output_manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint atlas_knowledge_generation_runs_status_chk check (run_status in ('CANDIDATE','VALIDATED','APPROVED','FAILED','SUPERSEDED'))
);

create table public.atlas_knowledge_entities (
  knowledge_id text not null,
  knowledge_version text not null,
  module_id text not null,
  module_version text,
  ownership_zone text not null,
  entity_type text not null,
  entity_type_version text not null,
  canonical_name text not null,
  definition text not null,
  operational_purpose text,
  lifecycle_status text not null default 'CANDIDATE',
  support_state text not null,
  applicability jsonb not null default '{}'::jsonb,
  semantic_payload jsonb not null default '{}'::jsonb,
  governing_contract_id text not null,
  governing_contract_version text not null,
  generator_run_id text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (knowledge_id, knowledge_version),
  foreign key (entity_type, entity_type_version)
    references public.atlas_knowledge_entity_types(type_id, type_version),
  foreign key (generator_run_id)
    references public.atlas_knowledge_generation_runs(run_id),
  constraint atlas_knowledge_entities_zone_chk check (ownership_zone in ('Z0','Z1','Z2','Z3','Z4','Z5','Z6','Z7')),
  constraint atlas_knowledge_entities_lifecycle_chk check (lifecycle_status in ('CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED')),
  constraint atlas_knowledge_entities_support_chk check (support_state in ('SUPPORTED','PARTIALLY_SUPPORTED','KNOWLEDGE_GAP','SOURCE_CONTEXT_PENDING','CLIENT_BINDING_REQUIRED','MASTER_DATA_REQUIRED','CONFLICTING'))
);

create table public.atlas_knowledge_relationships (
  relationship_id text not null,
  relationship_version text not null,
  module_id text not null,
  ownership_zone text not null,
  relationship_type text not null,
  relationship_type_version text not null,
  from_knowledge_id text not null,
  from_knowledge_version text not null,
  to_knowledge_id text not null,
  to_knowledge_version text not null,
  applicability jsonb not null default '{}'::jsonb,
  semantic_payload jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'CANDIDATE',
  support_state text not null,
  governing_contract_id text not null,
  governing_contract_version text not null,
  generator_run_id text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (relationship_id, relationship_version),
  foreign key (relationship_type, relationship_type_version)
    references public.atlas_knowledge_relationship_types(type_id, type_version),
  foreign key (from_knowledge_id, from_knowledge_version)
    references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (to_knowledge_id, to_knowledge_version)
    references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (generator_run_id)
    references public.atlas_knowledge_generation_runs(run_id),
  constraint atlas_knowledge_relationships_zone_chk check (ownership_zone in ('Z0','Z1','Z2','Z3','Z4','Z5','Z6','Z7')),
  constraint atlas_knowledge_relationships_lifecycle_chk check (lifecycle_status in ('CANDIDATE','VALIDATED','APPROVED','ACTIVE','DEPRECATED')),
  constraint atlas_knowledge_relationships_support_chk check (support_state in ('SUPPORTED','PARTIALLY_SUPPORTED','KNOWLEDGE_GAP','SOURCE_CONTEXT_PENDING','CLIENT_BINDING_REQUIRED','MASTER_DATA_REQUIRED','CONFLICTING'))
);

create table public.atlas_evidence_sources (
  source_id text primary key,
  source_class text not null,
  evidence_source_kind text not null,
  evidence_ref text not null,
  workspace_id uuid references public.atlas_workspaces(id),
  authority_class text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (evidence_source_kind, evidence_ref),
  constraint atlas_evidence_sources_class_chk check (source_class in ('AUTHORITATIVE_RESEARCH','CLIENT_PROVIDED','RUNTIME_OBSERVATION','GOVERNED_INTERNAL')),
  constraint atlas_evidence_sources_client_scope_chk check (source_class <> 'CLIENT_PROVIDED' or workspace_id is not null),
  constraint atlas_evidence_sources_research_scope_chk check (source_class <> 'AUTHORITATIVE_RESEARCH' or workspace_id is null)
);

create table public.atlas_knowledge_evidence_links (
  link_id text primary key,
  knowledge_id text,
  knowledge_version text,
  relationship_id text,
  relationship_version text,
  source_id text not null references public.atlas_evidence_sources(source_id),
  evidence_locator text,
  support_role text not null,
  claim_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (knowledge_id, knowledge_version) references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (relationship_id, relationship_version) references public.atlas_knowledge_relationships(relationship_id, relationship_version),
  constraint atlas_knowledge_evidence_links_target_chk check (
    ((knowledge_id is not null and knowledge_version is not null) and relationship_id is null and relationship_version is null)
    or ((relationship_id is not null and relationship_version is not null) and knowledge_id is null and knowledge_version is null)
  ),
  constraint atlas_knowledge_evidence_links_support_role_chk check (support_role in ('SUPPORTS','QUALIFIES','CONFLICTS','SUPERSEDES'))
);

create table public.atlas_knowledge_gap_links (
  gap_id uuid not null references public.atlas_knowledge_gaps(id),
  knowledge_id text,
  knowledge_version text,
  relationship_id text,
  relationship_version text,
  created_at timestamptz not null default now(),
  foreign key (knowledge_id, knowledge_version) references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (relationship_id, relationship_version) references public.atlas_knowledge_relationships(relationship_id, relationship_version),
  constraint atlas_knowledge_gap_links_target_chk check (
    ((knowledge_id is not null and knowledge_version is not null) and relationship_id is null and relationship_version is null)
    or ((relationship_id is not null and relationship_version is not null) and knowledge_id is null and knowledge_version is null)
  ),
  unique nulls not distinct (gap_id, knowledge_id, knowledge_version, relationship_id, relationship_version)
);

create table public.atlas_generation_z5_outputs (
  run_id text not null,
  output_kind text not null,
  output_id text not null,
  output_version text not null,
  output_hash text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, output_kind, output_id, output_version),
  foreign key (run_id) references public.atlas_knowledge_generation_runs(run_id),
  constraint atlas_generation_z5_outputs_kind_chk check (output_kind in ('WORK_DECOMPOSITION','WORK_DEFINITION'))
);

create index atlas_knowledge_entities_module_idx on public.atlas_knowledge_entities(module_id, module_version);
create index atlas_knowledge_entities_type_idx on public.atlas_knowledge_entities(entity_type, entity_type_version);
create index atlas_knowledge_relationships_from_idx on public.atlas_knowledge_relationships(from_knowledge_id, from_knowledge_version);
create index atlas_knowledge_relationships_to_idx on public.atlas_knowledge_relationships(to_knowledge_id, to_knowledge_version);
create index atlas_evidence_sources_ref_idx on public.atlas_evidence_sources(evidence_source_kind, evidence_ref);
create index atlas_knowledge_evidence_links_source_idx on public.atlas_knowledge_evidence_links(source_id);

-- Defense-in-depth: all new public-schema tables are RLS-enabled.
alter table public.atlas_knowledge_entity_types enable row level security;
alter table public.atlas_knowledge_relationship_types enable row level security;
alter table public.atlas_knowledge_generation_runs enable row level security;
alter table public.atlas_knowledge_entities enable row level security;
alter table public.atlas_knowledge_relationships enable row level security;
alter table public.atlas_evidence_sources enable row level security;
alter table public.atlas_knowledge_evidence_links enable row level security;
alter table public.atlas_knowledge_gap_links enable row level security;
alter table public.atlas_generation_z5_outputs enable row level security;

-- Protected execution knowledge follows the P6.1/P6.2 server-role pattern.
revoke all on public.atlas_knowledge_entity_types, public.atlas_knowledge_relationship_types,
  public.atlas_knowledge_generation_runs, public.atlas_knowledge_entities,
  public.atlas_knowledge_relationships, public.atlas_evidence_sources,
  public.atlas_knowledge_evidence_links, public.atlas_knowledge_gap_links,
  public.atlas_generation_z5_outputs from anon, authenticated, service_role;
grant select, insert, update, delete on public.atlas_knowledge_entity_types,
  public.atlas_knowledge_relationship_types, public.atlas_knowledge_generation_runs,
  public.atlas_knowledge_entities, public.atlas_knowledge_relationships,
  public.atlas_evidence_sources, public.atlas_knowledge_evidence_links,
  public.atlas_knowledge_gap_links, public.atlas_generation_z5_outputs to service_role;

create or replace function public.atlas_guard_append_only() returns trigger
language plpgsql set search_path = pg_catalog, public as $
declare col text; o jsonb; n jsonb;
begin
  if tg_op = 'TRUNCATE' then raise exception 'append-only: TRUNCATE on % is not permitted', tg_table_name using errcode='P0001'; end if;
  if tg_op = 'DELETE' then raise exception 'append-only: DELETE on % is not permitted; supersede with a successor version', tg_table_name using errcode='P0001'; end if;
  o := to_jsonb(old); n := to_jsonb(new);
  for col in select jsonb_object_keys(n) loop
    if not (col = any (coalesce(tg_argv, '{}'::text[]))) and (o -> col) is distinct from (n -> col) then
      raise exception 'append-only: %.% is immutable; create a successor version', tg_table_name, col using errcode='P0001';
    end if;
  end loop;
  return new;
end $;
revoke all on function public.atlas_guard_append_only() from public, anon, authenticated;

create trigger atlas_entity_types_append_only before update or delete on public.atlas_knowledge_entity_types for each row execute function public.atlas_guard_append_only('status');
create trigger atlas_relationship_types_append_only before update or delete on public.atlas_knowledge_relationship_types for each row execute function public.atlas_guard_append_only('status');
create trigger atlas_generation_runs_append_only before update or delete on public.atlas_knowledge_generation_runs for each row execute function public.atlas_guard_append_only('run_status');
create trigger atlas_entities_append_only before update or delete on public.atlas_knowledge_entities for each row execute function public.atlas_guard_append_only('lifecycle_status','updated_at');
create trigger atlas_relationships_append_only before update or delete on public.atlas_knowledge_relationships for each row execute function public.atlas_guard_append_only('lifecycle_status');
create trigger atlas_evidence_sources_append_only before update or delete on public.atlas_evidence_sources for each row execute function public.atlas_guard_append_only();
create trigger atlas_evidence_links_append_only before update or delete on public.atlas_knowledge_evidence_links for each row execute function public.atlas_guard_append_only();
create trigger atlas_gap_links_append_only before update or delete on public.atlas_knowledge_gap_links for each row execute function public.atlas_guard_append_only();
create trigger atlas_z5_outputs_append_only before update or delete on public.atlas_generation_z5_outputs for each row execute function public.atlas_guard_append_only();

create trigger atlas_entity_types_no_truncate before truncate on public.atlas_knowledge_entity_types for each statement execute function public.atlas_guard_append_only();
create trigger atlas_relationship_types_no_truncate before truncate on public.atlas_knowledge_relationship_types for each statement execute function public.atlas_guard_append_only();
create trigger atlas_generation_runs_no_truncate before truncate on public.atlas_knowledge_generation_runs for each statement execute function public.atlas_guard_append_only();
create trigger atlas_entities_no_truncate before truncate on public.atlas_knowledge_entities for each statement execute function public.atlas_guard_append_only();
create trigger atlas_relationships_no_truncate before truncate on public.atlas_knowledge_relationships for each statement execute function public.atlas_guard_append_only();
create trigger atlas_evidence_sources_no_truncate before truncate on public.atlas_evidence_sources for each statement execute function public.atlas_guard_append_only();
create trigger atlas_evidence_links_no_truncate before truncate on public.atlas_knowledge_evidence_links for each statement execute function public.atlas_guard_append_only();
create trigger atlas_gap_links_no_truncate before truncate on public.atlas_knowledge_gap_links for each statement execute function public.atlas_guard_append_only();
create trigger atlas_z5_outputs_no_truncate before truncate on public.atlas_generation_z5_outputs for each statement execute function public.atlas_guard_append_only();

rollback;
