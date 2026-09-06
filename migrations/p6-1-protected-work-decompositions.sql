-- P6.1 protected Atlas Canonical Work Decomposition store.
-- Full decomposition payloads are execution IP and MUST NOT be committed to the public web/GitHub bundle.

create table if not exists public.atlas_work_decompositions (
  decomposition_id text primary key,
  module_id text not null,
  module_version text not null,
  source_task_id text not null,
  contract_version text not null,
  semantic_source_version text not null,
  status text not null check (status in ('DRAFT','VALIDATED_REFERENCE_DECOMPOSITION','APPROVED','ACTIVE','DEPRECATED')),
  payload jsonb not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists atlas_work_decompositions_module_task_contract_uq
  on public.atlas_work_decompositions(module_id,module_version,source_task_id,contract_version);
create index if not exists atlas_work_decompositions_lookup_idx
  on public.atlas_work_decompositions(module_id,module_version,status,source_task_id);

alter table public.atlas_work_decompositions enable row level security;

-- Defense in depth: browser roles have no table privilege and no RLS policy.
revoke all on table public.atlas_work_decompositions from anon, authenticated;
grant select, insert, update, delete on table public.atlas_work_decompositions to service_role;

comment on table public.atlas_work_decompositions is
  'P6.1 protected canonical Work Decomposition instances. Server-side capability-gated execution IP; never public/preloaded.';
