create table if not exists public.atlas_pilot_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  evaluator_id uuid not null references auth.users(id) on delete restrict,
  session_id text not null,
  artifact_type text not null check (artifact_type in ('DOCUMENT_INGEST','CLIENT_TWIN','ASK_ATLAS','TRANSFORMATION','EXPORT','UX','PRIVACY')),
  case_id text,
  entity_key text,
  dimensions jsonb not null default '{}'::jsonb,
  passed boolean not null,
  notes text,
  created_at timestamptz not null default now(),
  check (char_length(session_id) between 8 and 160),
  check (notes is null or char_length(notes) <= 2000)
);
create index if not exists atlas_pilot_evaluations_workspace_created_idx on public.atlas_pilot_evaluations(workspace_id,created_at desc);
create index if not exists atlas_pilot_evaluations_evaluator_idx on public.atlas_pilot_evaluations(evaluator_id,created_at desc);
create index if not exists atlas_pilot_evaluations_case_idx on public.atlas_pilot_evaluations(case_id);
alter table public.atlas_pilot_evaluations enable row level security;
drop policy if exists atlas_pilot_evaluations_select on public.atlas_pilot_evaluations;
create policy atlas_pilot_evaluations_select on public.atlas_pilot_evaluations for select using (atlas_private.can_manage_workspace(workspace_id) or evaluator_id=(select auth.uid()));
drop policy if exists atlas_pilot_evaluations_insert on public.atlas_pilot_evaluations;
create policy atlas_pilot_evaluations_insert on public.atlas_pilot_evaluations for insert with check (atlas_private.can_write_workspace(workspace_id) and evaluator_id=(select auth.uid()));
drop policy if exists atlas_pilot_evaluations_delete_admin on public.atlas_pilot_evaluations;
create policy atlas_pilot_evaluations_delete_admin on public.atlas_pilot_evaluations for delete using (atlas_private.can_manage_workspace(workspace_id));
drop trigger if exists atlas_pilot_evaluations_audit on public.atlas_pilot_evaluations;
create trigger atlas_pilot_evaluations_audit after insert or delete on public.atlas_pilot_evaluations for each row execute function public.atlas_record_change();
