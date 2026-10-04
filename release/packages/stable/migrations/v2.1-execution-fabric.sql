-- Atlas V2.1 Execution Fabric — protected runtime architecture.
-- This migration is additive. It does not modify canonical Page 0 / daughter-module data.
-- Browser clients receive no direct policies for protected runtime payload tables.

create table if not exists public.atlas_runtime_adapters (
  adapter_id text primary key,
  runtime text not null,
  adapter_version text not null,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','DEPRECATED','DISABLED')),
  capabilities jsonb not null default '[]'::jsonb,
  operations jsonb not null default '{}'::jsonb,
  manifest_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_runtime_projections (
  projection_id text primary key,
  definition_id text not null references public.atlas_work_definitions(definition_id) on delete restrict,
  definition_version text not null,
  adapter_id text not null references public.atlas_runtime_adapters(adapter_id) on delete restrict,
  runtime text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDATED','ACTIVE','STALE','DEPRECATED','BLOCKED')),
  capability_dispositions jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  content_hash text not null,
  generated_at timestamptz not null default now(),
  validated_at timestamptz,
  unique(definition_id, definition_version, adapter_id, content_hash)
);
create index if not exists atlas_runtime_projections_definition_idx on public.atlas_runtime_projections(definition_id, adapter_id, status);

create table if not exists public.atlas_runtime_client_bindings (
  binding_id text primary key,
  workspace_id uuid,
  client_ref text not null,
  definition_id text not null references public.atlas_work_definitions(definition_id) on delete restrict,
  adapter_id text not null references public.atlas_runtime_adapters(adapter_id) on delete restrict,
  reference_version text not null,
  binding_payload jsonb not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDATED','ACTIVE','STALE','DEPRECATED')),
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_runtime_client_bindings_lookup_idx on public.atlas_runtime_client_bindings(client_ref, definition_id, adapter_id, status);

create table if not exists public.atlas_runtime_client_extensions (
  extension_id text primary key,
  binding_id text not null references public.atlas_runtime_client_bindings(binding_id) on delete cascade,
  definition_id text not null references public.atlas_work_definitions(definition_id) on delete restrict,
  extension_payload jsonb not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDATED','ACTIVE','DEPRECATED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_runtime_materializations (
  materialization_id text primary key,
  projection_id text not null references public.atlas_runtime_projections(projection_id) on delete restrict,
  binding_id text references public.atlas_runtime_client_bindings(binding_id) on delete restrict,
  runtime_ref text,
  runtime_version text,
  state text not null default 'NOT_MATERIALIZED' check (state in ('NOT_MATERIALIZED','VALIDATING','READY','MATERIALIZED','DEPLOYED','SUSPENDED','FAILED','STALE')),
  materialization_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_runtime_evidence (
  evidence_id text primary key,
  materialization_id text references public.atlas_runtime_materializations(materialization_id) on delete restrict,
  definition_id text not null references public.atlas_work_definitions(definition_id) on delete restrict,
  runtime text not null,
  execution_ref text,
  outcome_code text,
  state_after text,
  evidence_payload jsonb not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now()
);
create index if not exists atlas_runtime_evidence_definition_idx on public.atlas_runtime_evidence(definition_id, runtime, received_at desc);

create table if not exists public.atlas_user_capabilities (
  user_id uuid not null,
  capability text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key(user_id, capability)
);

alter table public.atlas_runtime_adapters enable row level security;
alter table public.atlas_runtime_projections enable row level security;
alter table public.atlas_runtime_client_bindings enable row level security;
alter table public.atlas_runtime_client_extensions enable row level security;
alter table public.atlas_runtime_materializations enable row level security;
alter table public.atlas_runtime_evidence enable row level security;
alter table public.atlas_user_capabilities enable row level security;

-- No browser-readable policies are created here. Protected execution APIs must
-- authenticate the caller, resolve capability grants server-side, and only then
-- use service-role access. Public Atlas remains a sanitized projection.

comment on table public.atlas_runtime_projections is 'Protected Atlas runtime projections. Canonical WorkDefinition remains in atlas_work_definitions.';
comment on table public.atlas_user_capabilities is 'Server-resolved Atlas capability grants such as RUNTIME_MALKOM_VIEW / CONFIGURE / COMPILE / MATERIALIZE.';
