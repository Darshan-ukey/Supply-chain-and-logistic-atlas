-- P6.2 protected Atlas Canonical WorkDefinition store.
-- Derived from CANONICAL_WORKDEFINITION_CONTRACT_V1_FROZEN.md.
-- This is NOT the historical V2 admin prototype store and NOT the full 001 warehouse candidate.
-- Full WorkDefinition payloads are execution IP and MUST NOT be committed to the public web/GitHub bundle.

create table if not exists public.atlas_work_definitions (
  work_definition_id text primary key,
  module_id text not null,
  module_version text not null,
  source_task_id text not null,
  contract_version text not null,
  definition_version text not null,
  semantic_source_version text not null,
  status text not null check (status in ('DRAFT','VALIDATED_REFERENCE_DEFINITION','APPROVED','ACTIVE','DEPRECATED')),

  -- Canonical payload. Exactly one representation is present (see check constraint).
  payload jsonb,
  payload_encoding text not null default 'JSONB',
  payload_compressed_base64 text,

  -- Canonical content hash of the payload, excluding volatile persistence metadata.
  content_hash text not null,

  -- Lineage anchor back to the certified P6.1 Work Decomposition that produced this definition.
  governed_input_content_hash text not null,
  compiler_version text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.atlas_work_definitions
  drop constraint if exists atlas_work_definitions_payload_present_ck;
alter table public.atlas_work_definitions
  add constraint atlas_work_definitions_payload_present_ck
  check (
    (payload_encoding='JSONB' and payload is not null)
    or
    (payload_encoding in ('GZIP_BASE64','BROTLI_BASE64') and payload_compressed_base64 is not null)
  );

create unique index if not exists atlas_work_definitions_module_task_contract_uq
  on public.atlas_work_definitions(module_id,module_version,source_task_id,contract_version,definition_version);
create index if not exists atlas_work_definitions_lookup_idx
  on public.atlas_work_definitions(module_id,module_version,status,source_task_id);

alter table public.atlas_work_definitions enable row level security;

-- Defense in depth: browser roles have no table privilege and no RLS policy.
-- Reads are served only through the capability-gated server API using the service role.
revoke all on table public.atlas_work_definitions from anon, authenticated;
grant select, insert, update, delete on table public.atlas_work_definitions to service_role;

comment on table public.atlas_work_definitions is
  'P6.2 protected Canonical WorkDefinition instances compiled from certified P6.1 Work Decomposition. Executor-neutral; server-side capability-gated execution IP; never public/preloaded.';
comment on column public.atlas_work_definitions.governed_input_content_hash is
  'Certified P6.1 protected Work Decomposition content hash this definition was compiled from. Lineage anchor; must match the governed upstream input.';
comment on column public.atlas_work_definitions.payload_compressed_base64 is
  'Lossless compressed protected WorkDefinition payload. Decompressed only server-side after Atlas capability authorization.';
