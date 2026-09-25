-- Stage 21 · Lightweight collaboration + product telemetry
-- Collaboration is client-workspace state; telemetry contains only sanitized product-usage metadata.

create table if not exists public.atlas_collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROCESS','FINDING','OPPORTUNITY','FUTURE_STATE','COLLECTION','DOCUMENT','CANDIDATE_FACT','WORKSPACE')),
  entity_key text not null check (char_length(entity_key) between 1 and 240),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  evidence_ref text,
  created_by uuid not null references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_review_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('PROCESS','FINDING','OPPORTUNITY','FUTURE_STATE','COLLECTION','DOCUMENT','CANDIDATE_FACT','WORKSPACE')),
  entity_key text not null check (char_length(entity_key) between 1 and 240),
  request_type text not null default 'VALIDATION' check (request_type in ('VALIDATION','EVIDENCE','REVIEW')),
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','CANCELLED')),
  message text not null check (char_length(message) between 1 and 4000),
  requested_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 4000),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_usage_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique,
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 120),
  event_name text not null check (char_length(event_name) between 1 and 100),
  domain_pack_id text,
  module_id text,
  entity_type text,
  entity_key text,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists atlas_comments_entity_idx on public.atlas_collaboration_comments(workspace_id, entity_type, entity_key, created_at desc);
create index if not exists atlas_comments_created_by_idx on public.atlas_collaboration_comments(created_by);
create index if not exists atlas_comments_resolved_by_idx on public.atlas_collaboration_comments(resolved_by) where resolved_by is not null;
create index if not exists atlas_reviews_entity_idx on public.atlas_review_requests(workspace_id, entity_type, entity_key, created_at desc);
create index if not exists atlas_reviews_status_idx on public.atlas_review_requests(workspace_id, status, created_at desc);
create index if not exists atlas_reviews_requested_by_idx on public.atlas_review_requests(requested_by);
create index if not exists atlas_reviews_assigned_to_idx on public.atlas_review_requests(assigned_to) where assigned_to is not null;
create index if not exists atlas_reviews_completed_by_idx on public.atlas_review_requests(completed_by) where completed_by is not null;
create index if not exists atlas_usage_workspace_time_idx on public.atlas_usage_events(workspace_id, occurred_at desc);
create index if not exists atlas_usage_event_time_idx on public.atlas_usage_events(workspace_id, event_name, occurred_at desc);
create index if not exists atlas_usage_user_idx on public.atlas_usage_events(user_id, occurred_at desc);
create index if not exists atlas_usage_module_idx on public.atlas_usage_events(workspace_id, module_id, occurred_at desc) where module_id is not null;

alter table public.atlas_collaboration_comments enable row level security;
alter table public.atlas_review_requests enable row level security;
alter table public.atlas_usage_events enable row level security;

drop trigger if exists atlas_collaboration_comments_touch on public.atlas_collaboration_comments;
create trigger atlas_collaboration_comments_touch before update on public.atlas_collaboration_comments
for each row execute function public.atlas_touch_updated_at();
drop trigger if exists atlas_collaboration_comments_audit on public.atlas_collaboration_comments;
create trigger atlas_collaboration_comments_audit after insert or update or delete on public.atlas_collaboration_comments
for each row execute function public.atlas_record_change();

drop trigger if exists atlas_review_requests_touch on public.atlas_review_requests;
create trigger atlas_review_requests_touch before update on public.atlas_review_requests
for each row execute function public.atlas_touch_updated_at();
drop trigger if exists atlas_review_requests_audit on public.atlas_review_requests;
create trigger atlas_review_requests_audit after insert or update or delete on public.atlas_review_requests
for each row execute function public.atlas_record_change();

drop policy if exists atlas_comments_select on public.atlas_collaboration_comments;
create policy atlas_comments_select on public.atlas_collaboration_comments for select
using (atlas_private.is_workspace_member(workspace_id));
drop policy if exists atlas_comments_insert on public.atlas_collaboration_comments;
create policy atlas_comments_insert on public.atlas_collaboration_comments for insert
with check (atlas_private.is_workspace_member(workspace_id) and created_by=(select auth.uid()));
drop policy if exists atlas_comments_update on public.atlas_collaboration_comments;
create policy atlas_comments_update on public.atlas_collaboration_comments for update
using (atlas_private.is_workspace_member(workspace_id) and (created_by=(select auth.uid()) or atlas_private.can_manage_workspace(workspace_id)))
with check (atlas_private.is_workspace_member(workspace_id));
drop policy if exists atlas_comments_delete on public.atlas_collaboration_comments;
create policy atlas_comments_delete on public.atlas_collaboration_comments for delete
using (atlas_private.is_workspace_member(workspace_id) and (created_by=(select auth.uid()) or atlas_private.can_manage_workspace(workspace_id)));

drop policy if exists atlas_reviews_select on public.atlas_review_requests;
create policy atlas_reviews_select on public.atlas_review_requests for select
using (atlas_private.is_workspace_member(workspace_id));
drop policy if exists atlas_reviews_insert on public.atlas_review_requests;
create policy atlas_reviews_insert on public.atlas_review_requests for insert
with check (atlas_private.is_workspace_member(workspace_id) and requested_by=(select auth.uid()));
drop policy if exists atlas_reviews_update on public.atlas_review_requests;
create policy atlas_reviews_update on public.atlas_review_requests for update
using (atlas_private.is_workspace_member(workspace_id) and (requested_by=(select auth.uid()) or assigned_to=(select auth.uid()) or atlas_private.can_manage_workspace(workspace_id)))
with check (atlas_private.is_workspace_member(workspace_id));
drop policy if exists atlas_reviews_delete on public.atlas_review_requests;
create policy atlas_reviews_delete on public.atlas_review_requests for delete
using (atlas_private.is_workspace_member(workspace_id) and (requested_by=(select auth.uid()) or atlas_private.can_manage_workspace(workspace_id)));

drop policy if exists atlas_usage_insert on public.atlas_usage_events;
create policy atlas_usage_insert on public.atlas_usage_events for insert
with check (atlas_private.is_workspace_member(workspace_id) and user_id=(select auth.uid()));
drop policy if exists atlas_usage_select on public.atlas_usage_events;
create policy atlas_usage_select on public.atlas_usage_events for select
using (atlas_private.can_manage_workspace(workspace_id));

comment on table public.atlas_usage_events is 'Stage 21 sanitized product telemetry. Do not store question text, document content, client evidence, comments, names, or other free text in context.';
