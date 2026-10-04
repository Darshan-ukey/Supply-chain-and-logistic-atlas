-- Atlas V2 protected execution-definition store.
-- IMPORTANT: canonical/reference Atlas files remain unchanged.
-- Full WorkDefinitions are intentionally NOT committed to the public web bundle.
-- Populate this table with the private seed artifact using scripts/seed-v2-workdefinitions.mjs.

create table if not exists public.atlas_work_definitions (
  definition_id text primary key,
  domain text not null,
  source_task_id text not null,
  source_version text not null,
  definition_version text not null,
  status text not null check (status in ('DRAFT','VALIDATED','APPROVED','ACTIVE','DEPRECATED')),
  payload jsonb not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_work_definitions_domain_task_version_uq
  on public.atlas_work_definitions(domain, source_task_id, definition_version);
create index if not exists atlas_work_definitions_domain_status_idx
  on public.atlas_work_definitions(domain, status, source_task_id);

alter table public.atlas_work_definitions enable row level security;

-- No anon/authenticated policies are created intentionally.
-- Browser clients cannot read this table directly. The V2 Admin API first
-- authenticates/authorizes the user and then reads through the server-side
-- Supabase service role. Keep SUPABASE_SERVICE_ROLE_KEY server-side only.

comment on table public.atlas_work_definitions is
  'Protected Atlas V2 canonical WorkDefinitions. Not public Atlas content; read only through authenticated Admin API.';
