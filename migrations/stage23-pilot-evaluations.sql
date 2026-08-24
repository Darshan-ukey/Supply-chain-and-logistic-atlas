create table if not exists public.atlas_pilot_evaluations(
 id uuid primary key default gen_random_uuid(), workspace_id uuid references public.atlas_workspaces(id) on delete cascade, user_id uuid not null references auth.users(id),
 contract_version text not null, result text not null default 'PENDING', scores jsonb not null default '{}'::jsonb, synthetic_only boolean not null default true, notes text, created_at timestamptz not null default now()
);
alter table public.atlas_pilot_evaluations enable row level security;
create policy atlas_eval_insert on public.atlas_pilot_evaluations for insert with check(user_id=auth.uid() and (workspace_id is null or public.atlas_is_workspace_member(workspace_id)));
create policy atlas_eval_read on public.atlas_pilot_evaluations for select using(user_id=auth.uid() or (workspace_id is not null and public.atlas_is_workspace_manager(workspace_id)));
