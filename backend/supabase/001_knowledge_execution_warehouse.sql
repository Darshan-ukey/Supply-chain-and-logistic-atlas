-- Atlas Knowledge-to-Execution Warehouse · Daughter Production Standard V2
-- Additive schema; use migrations/RLS appropriate to target environment.
create extension if not exists pgcrypto;

create table if not exists atlas_module_versions (
  id uuid primary key default gen_random_uuid(), module_id text not null, version text not null,
  status text not null, depth text not null, parent_module_id text, parent_version text,
  derived_from jsonb not null default '[]'::jsonb, production_standard text not null,
  payload jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(module_id,version)
);
create table if not exists atlas_task_versions (
  id uuid primary key default gen_random_uuid(), module_id text not null, module_version text not null,
  task_id text not null, title text not null, a3_parent_id text, status text not null default 'DRAFT',
  identity jsonb not null default '{}'::jsonb, applicability jsonb not null default '{}'::jsonb,
  baseline jsonb, executability jsonb not null default '{}'::jsonb, payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(module_id,module_version,task_id)
);
create table if not exists atlas_source_registry (
  source_id text primary key, issuer text, title text not null, version text, status text,
  source_kind text, url text, supports text, not_supports text, effective_from date, effective_to date,
  metadata jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists atlas_source_claims (
  id uuid primary key default gen_random_uuid(), claim_id text not null, module_id text not null, module_version text not null,
  task_id text not null, field_name text, statement text not null, evidence_class text not null,
  source_refs jsonb not null default '[]'::jsonb, claim_boundary text, confidence text,
  status text not null default 'RESEARCHED', effective_from date, effective_to date,
  created_at timestamptz not null default now(), unique(module_id,module_version,claim_id)
);
create table if not exists atlas_operational_requirements (
  id uuid primary key default gen_random_uuid(), module_id text not null, module_version text not null, task_id text not null,
  requirement_id text not null, canonical_field_id text, name text not null, required_when text not null,
  why text not null, value_origin text not null, validation text, evidence_class text,
  source_refs jsonb not null default '[]'::jsonb, client_binding_required boolean not null default false,
  payload jsonb not null default '{}'::jsonb, unique(module_id,module_version,requirement_id)
);
create table if not exists atlas_decision_gates (
  id uuid primary key default gen_random_uuid(), module_id text not null, module_version text not null, task_id text not null,
  gate_id text not null, question text not null, pass_when text, fail_when text, pass_outcome text, fail_outcome text,
  source_refs jsonb not null default '[]'::jsonb, payload jsonb not null default '{}'::jsonb,
  unique(module_id,module_version,gate_id)
);
create table if not exists atlas_branch_transitions (
  id uuid primary key default gen_random_uuid(), module_id text not null, module_version text not null, task_id text not null,
  transition_id text not null, from_state text, event text, condition text, to_state text, branch text, next_step text,
  payload jsonb not null default '{}'::jsonb, unique(module_id,module_version,transition_id)
);
create table if not exists atlas_client_binding_requirements (
  id uuid primary key default gen_random_uuid(), binding_id text not null, module_id text not null, module_version text not null,
  task_id text not null, binding_object text not null, binding_type text not null, required_when text not null,
  why text not null, value_origin text not null, validation text, source_refs jsonb not null default '[]'::jsonb,
  basis jsonb not null default '{}'::jsonb, system_of_record jsonb not null default '{}'::jsonb,
  client_field_mapping jsonb not null default '{}'::jsonb, authority_owner jsonb not null default '{}'::jsonb,
  collection_question text not null, resolution_status text not null, payload jsonb not null default '{}'::jsonb,
  unique(module_id,module_version,binding_id)
);
create table if not exists atlas_work_decomposition_nodes (
  id uuid primary key default gen_random_uuid(), decomposition_id text not null, module_id text not null, module_version text not null,
  task_id text not null, parent_decomposition_id text, node_type text not null, status text not null default 'DRAFT',
  payload jsonb not null, created_at timestamptz not null default now(), unique(module_id,module_version,decomposition_id)
);
create table if not exists atlas_work_definitions (
  id uuid primary key default gen_random_uuid(), work_definition_id text not null, version text not null,
  module_id text not null, module_version text not null, task_id text not null, status text not null default 'DRAFT',
  derived_from jsonb not null, payload jsonb not null, created_at timestamptz not null default now(),
  unique(work_definition_id,version)
);
create table if not exists atlas_runtime_projections (
  id uuid primary key default gen_random_uuid(), work_definition_id text not null, work_definition_version text not null,
  runtime_type text not null, projection_version text not null, status text not null default 'DRAFT', payload jsonb not null,
  created_at timestamptz not null default now(), unique(work_definition_id,work_definition_version,runtime_type,projection_version)
);
create table if not exists atlas_validation_runs (
  id uuid primary key default gen_random_uuid(), module_id text not null, module_version text not null,
  validator_version text not null, status text not null, results jsonb not null, created_at timestamptz not null default now()
);
create table if not exists atlas_change_audit (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_key text not null, from_version text,
  to_version text, change_type text not null, actor_id text, rationale text, before_payload jsonb, after_payload jsonb,
  created_at timestamptz not null default now()
);
-- Canonical knowledge should be edited through governed admin/service flows, not client runtime bindings.
