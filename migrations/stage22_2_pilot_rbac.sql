create table if not exists public.atlas_foundation_proposals(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade, process_id text,
 proposal text not null, status text not null default 'PENDING_ADMIN_APPROVAL' check(status in ('PENDING_ADMIN_APPROVAL','APPROVED','REJECTED','RESEARCH_REQUIRED')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, resolution_note text
);
alter table public.atlas_foundation_proposals enable row level security;
create policy atlas_proposals_member_read on public.atlas_foundation_proposals for select using(public.atlas_is_workspace_member(workspace_id));
create policy atlas_proposals_member_insert on public.atlas_foundation_proposals for insert with check(public.atlas_is_workspace_member(workspace_id) and created_by=auth.uid());
create policy atlas_proposals_admin_update on public.atlas_foundation_proposals for update using(public.atlas_is_workspace_manager(workspace_id));
-- Canonical Atlas content is intentionally not represented by mutable user tables. Publishing remains a deployment/governance action outside Pilot User permissions.
