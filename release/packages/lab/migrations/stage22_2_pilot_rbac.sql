create or replace function atlas_private.can_write_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.atlas_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('OWNER','ADMIN','EDITOR')
  );
$$;
revoke all on function atlas_private.can_write_workspace(uuid) from public;
grant execute on function atlas_private.can_write_workspace(uuid) to authenticated;

create table if not exists public.atlas_foundation_change_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  proposal_key text not null,
  proposal_type text not null check (proposal_type in ('COMPONENT','OVERLAY','RELATIONSHIP','RULE','SOURCE','MODULE','OTHER')),
  target_id text,
  summary text not null check (char_length(summary) between 3 and 1200),
  rationale text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING_ADMIN_REVIEW' check (status in ('PENDING_ADMIN_REVIEW','APPROVED_FOR_RESEARCH','APPROVED_FOR_PUBLICATION_GATE','REJECTED','WITHDRAWN')),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,proposal_key)
);
create index if not exists atlas_foundation_proposals_workspace_status_idx on public.atlas_foundation_change_proposals(workspace_id,status,created_at desc);
create index if not exists atlas_foundation_proposals_proposed_by_idx on public.atlas_foundation_change_proposals(proposed_by);
create index if not exists atlas_foundation_proposals_reviewed_by_idx on public.atlas_foundation_change_proposals(reviewed_by);

drop trigger if exists atlas_foundation_change_proposals_touch on public.atlas_foundation_change_proposals;
create trigger atlas_foundation_change_proposals_touch before update on public.atlas_foundation_change_proposals for each row execute function public.atlas_touch_updated_at();
drop trigger if exists atlas_foundation_change_proposals_audit on public.atlas_foundation_change_proposals;
create trigger atlas_foundation_change_proposals_audit after insert or update or delete on public.atlas_foundation_change_proposals for each row execute function public.atlas_record_change();

alter table public.atlas_foundation_change_proposals enable row level security;
drop policy if exists atlas_foundation_proposals_select on public.atlas_foundation_change_proposals;
create policy atlas_foundation_proposals_select on public.atlas_foundation_change_proposals for select using (atlas_private.is_workspace_member(workspace_id));
drop policy if exists atlas_foundation_proposals_insert on public.atlas_foundation_change_proposals;
create policy atlas_foundation_proposals_insert on public.atlas_foundation_change_proposals for insert with check (atlas_private.can_write_workspace(workspace_id) and proposed_by=(select auth.uid()) and status='PENDING_ADMIN_REVIEW');
drop policy if exists atlas_foundation_proposals_update_admin on public.atlas_foundation_change_proposals;
create policy atlas_foundation_proposals_update_admin on public.atlas_foundation_change_proposals for update using (atlas_private.can_manage_workspace(workspace_id)) with check (atlas_private.can_manage_workspace(workspace_id));
drop policy if exists atlas_foundation_proposals_delete_admin on public.atlas_foundation_change_proposals;
create policy atlas_foundation_proposals_delete_admin on public.atlas_foundation_change_proposals for delete using (atlas_private.can_manage_workspace(workspace_id));

-- Tighten client-work writes: VIEWER remains read-only; EDITOR is the pilot-user role.
do $$
declare t text;
begin
  foreach t in array array['atlas_client_states','atlas_saved_views','atlas_evidence_files','atlas_findings','atlas_opportunities','atlas_future_states','atlas_client_documents','atlas_document_chunks','atlas_candidate_facts']
  loop
    execute format('drop policy if exists %I_insert on public.%I',t,t);
    execute format('create policy %I_insert on public.%I for insert with check (atlas_private.can_write_workspace(workspace_id))',t,t);
    execute format('drop policy if exists %I_update on public.%I',t,t);
    execute format('create policy %I_update on public.%I for update using (atlas_private.can_write_workspace(workspace_id)) with check (atlas_private.can_write_workspace(workspace_id))',t,t);
    execute format('drop policy if exists %I_delete on public.%I',t,t);
    execute format('create policy %I_delete on public.%I for delete using (atlas_private.can_write_workspace(workspace_id))',t,t);
  end loop;
end $$;

-- Stage-21 collaboration policy names are shorter; tighten those explicitly.
drop policy if exists atlas_comments_insert on public.atlas_collaboration_comments;
create policy atlas_comments_insert on public.atlas_collaboration_comments for insert with check (atlas_private.can_write_workspace(workspace_id));
drop policy if exists atlas_comments_update on public.atlas_collaboration_comments;
create policy atlas_comments_update on public.atlas_collaboration_comments for update using (atlas_private.can_write_workspace(workspace_id)) with check (atlas_private.can_write_workspace(workspace_id));
drop policy if exists atlas_comments_delete on public.atlas_collaboration_comments;
create policy atlas_comments_delete on public.atlas_collaboration_comments for delete using (atlas_private.can_write_workspace(workspace_id));

drop policy if exists atlas_reviews_insert on public.atlas_review_requests;
create policy atlas_reviews_insert on public.atlas_review_requests for insert with check (atlas_private.can_write_workspace(workspace_id));
drop policy if exists atlas_reviews_update on public.atlas_review_requests;
create policy atlas_reviews_update on public.atlas_review_requests for update using (atlas_private.can_write_workspace(workspace_id)) with check (atlas_private.can_write_workspace(workspace_id));
drop policy if exists atlas_reviews_delete on public.atlas_review_requests;
create policy atlas_reviews_delete on public.atlas_review_requests for delete using (atlas_private.can_write_workspace(workspace_id));

-- Knowledge gaps may be created/updated by pilot editors but not viewers.
drop policy if exists atlas_gaps_insert on public.atlas_knowledge_gaps;
create policy atlas_gaps_insert on public.atlas_knowledge_gaps for insert with check (workspace_id is not null and atlas_private.can_write_workspace(workspace_id));
drop policy if exists atlas_gaps_update on public.atlas_knowledge_gaps;
create policy atlas_gaps_update on public.atlas_knowledge_gaps for update using (workspace_id is not null and atlas_private.can_write_workspace(workspace_id)) with check (workspace_id is not null and atlas_private.can_write_workspace(workspace_id));

-- Storage: members can read; only OWNER/ADMIN/EDITOR may create/update/delete private objects.
drop policy if exists atlas_evidence_storage_insert on storage.objects;
create policy atlas_evidence_storage_insert on storage.objects for insert with check (bucket_id='atlas-client-evidence' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));
drop policy if exists atlas_evidence_storage_update on storage.objects;
create policy atlas_evidence_storage_update on storage.objects for update using (bucket_id='atlas-client-evidence' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name))) with check (bucket_id='atlas-client-evidence' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));
drop policy if exists atlas_evidence_storage_delete on storage.objects;
create policy atlas_evidence_storage_delete on storage.objects for delete using (bucket_id='atlas-client-evidence' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));

drop policy if exists atlas_documents_storage_insert on storage.objects;
create policy atlas_documents_storage_insert on storage.objects for insert with check (bucket_id='atlas-client-documents' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));
drop policy if exists atlas_documents_storage_update on storage.objects;
create policy atlas_documents_storage_update on storage.objects for update using (bucket_id='atlas-client-documents' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name))) with check (bucket_id='atlas-client-documents' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));
drop policy if exists atlas_documents_storage_delete on storage.objects;
create policy atlas_documents_storage_delete on storage.objects for delete using (bucket_id='atlas-client-documents' and atlas_private.can_write_workspace(public.atlas_storage_workspace_id(name)));
