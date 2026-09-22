-- ATL-82 / ATL-60B
-- Candidate physical DDL design only. NOT AUTHORIZED TO APPLY.
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
  constraint atlas_knowledge_relationships_support_chk check (support_state in ('SUPPORTED','PARTIALLY_SUPPORTED','KNOWLEDGE_GAP','SOURCE_CONTEXT_PENDING','CLIENT_BINDING_REQUIRED','MASTER_DATA_REQUIRED','CONFLICTING'))
);

create table public.atlas_knowledge_evidence_links (
  link_id text primary key,
  knowledge_id text,
  knowledge_version text,
  relationship_id text,
  relationship_version text,
  source_class text not null,
  evidence_source_kind text not null,
  evidence_ref text not null,
  evidence_locator text,
  authority_class text,
  support_role text not null,
  claim_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (knowledge_id, knowledge_version)
    references public.atlas_knowledge_entities(knowledge_id, knowledge_version),
  foreign key (relationship_id, relationship_version)
    references public.atlas_knowledge_relationships(relationship_id, relationship_version),
  constraint atlas_knowledge_evidence_links_target_chk check (
    ((knowledge_id is not null and knowledge_version is not null) and relationship_id is null and relationship_version is null)
    or
    ((relationship_id is not null and relationship_version is not null) and knowledge_id is null and knowledge_version is null)
  ),
  constraint atlas_knowledge_evidence_links_source_class_chk check (source_class in ('AUTHORITATIVE_RESEARCH','CLIENT_PROVIDED','RUNTIME_OBSERVATION','GOVERNED_INTERNAL')),
  constraint atlas_knowledge_evidence_links_support_role_chk check (support_role in ('SUPPORTS','QUALIFIES','CONFLICTS','SUPERSEDES'))
);

create table public.atlas_readiness_runs (
  readiness_run_id text primary key,
  module_id text not null,
  module_version text,
  target_executor_class text,
  readiness_state text,
  run_status text not null default 'CANDIDATE',
  resolver_contract_id text not null,
  resolver_contract_version text not null,
  knowledge_generation_run_id text not null,
  input_manifest jsonb not null,
  input_manifest_hash text not null,
  blocker_manifest jsonb not null default '[]'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (knowledge_generation_run_id)
    references public.atlas_knowledge_generation_runs(run_id),
  constraint atlas_readiness_runs_state_chk check (readiness_state is null or readiness_state in ('DOMAIN_EXECUTION_READY','ENTERPRISE_EXECUTION_READY','RUNTIME_IMPLEMENTATION_READY')),
  constraint atlas_readiness_runs_status_chk check (run_status in ('CANDIDATE','VALIDATED','APPROVED','FAILED','BLOCKED','SUPERSEDED'))
);

create table public.atlas_readiness_evidence (
  readiness_run_id text not null,
  evidence_seq bigint generated always as identity,
  evidence_kind text not null,
  evidence_ref text not null,
  evidence_locator text,
  evidence_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (readiness_run_id, evidence_seq),
  foreign key (readiness_run_id) references public.atlas_readiness_runs(readiness_run_id)
);

create table public.atlas_generation_z5_outputs (
  run_id text not null,
  output_kind text not null,
  output_id text not null,
  output_version text not null,
  output_hash text,
  created_at timestamptz not null default now(),
  primary key (run_id, output_kind, output_id, output_version),
  foreign key (run_id) references public.atlas_knowledge_generation_runs(run_id),
  constraint atlas_generation_z5_outputs_kind_chk check (output_kind in ('WORK_DECOMPOSITION','WORK_DEFINITION'))
);

create index atlas_knowledge_entities_module_idx on public.atlas_knowledge_entities(module_id, module_version);
create index atlas_knowledge_entities_type_idx on public.atlas_knowledge_entities(entity_type, entity_type_version);
create index atlas_knowledge_relationships_from_idx on public.atlas_knowledge_relationships(from_knowledge_id, from_knowledge_version);
create index atlas_knowledge_relationships_to_idx on public.atlas_knowledge_relationships(to_knowledge_id, to_knowledge_version);
create index atlas_knowledge_evidence_links_evidence_idx on public.atlas_knowledge_evidence_links(source_class, evidence_source_kind, evidence_ref);
create index atlas_readiness_runs_module_idx on public.atlas_readiness_runs(module_id, module_version);

-- Defense-in-depth: all new public-schema tables are RLS-enabled.
alter table public.atlas_knowledge_entity_types enable row level security;
alter table public.atlas_knowledge_relationship_types enable row level security;
alter table public.atlas_knowledge_generation_runs enable row level security;
alter table public.atlas_knowledge_entities enable row level security;
alter table public.atlas_knowledge_relationships enable row level security;
alter table public.atlas_knowledge_evidence_links enable row level security;
alter table public.atlas_readiness_runs enable row level security;
alter table public.atlas_readiness_evidence enable row level security;
alter table public.atlas_generation_z5_outputs enable row level security;

-- No anon/authenticated grants or policies are created in this candidate.
-- Protected execution knowledge remains inaccessible through Data API until a
-- separately governed capability/access model is approved.

-- Semantic rows and type contracts are append-only by governance.
-- Physical prevention of UPDATE/DELETE is deliberately deferred to independent
-- QA because existing Atlas privileged write/capability patterns must be reused,
-- not invented here.

rollback;
