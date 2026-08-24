-- Pilot V1.0 intentionally does not persist raw source documents, parsed text, chunks or embeddings.
-- This table stores only an explicitly confirmed normalized client fact. No evidence quote/locator/raw reference is retained.
create table if not exists public.atlas_confirmed_client_facts(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
 process_id text not null, fact_type text not null default 'OTHER', statement text not null, confidence numeric, evidence_class text not null default 'CLIENT_CONFIRMED',
 confirmed_by uuid not null default auth.uid() references auth.users(id), confirmed_at timestamptz not null default now()
);
alter table public.atlas_confirmed_client_facts enable row level security;
create policy atlas_confirmed_facts_member on public.atlas_confirmed_client_facts for select using(public.atlas_is_workspace_member(workspace_id));
create policy atlas_confirmed_facts_write on public.atlas_confirmed_client_facts for insert with check(public.atlas_is_workspace_member(workspace_id) and confirmed_by=auth.uid());
create policy atlas_confirmed_facts_update on public.atlas_confirmed_client_facts for update using(public.atlas_is_workspace_member(workspace_id));
