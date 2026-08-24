create extension if not exists pgcrypto;
create or replace function public.atlas_is_workspace_member(w uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.atlas_workspace_members m where m.workspace_id=w and m.user_id=auth.uid() and m.status='ACTIVE');
$$;
create or replace function public.atlas_is_workspace_manager(w uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.atlas_workspace_members m where m.workspace_id=w and m.user_id=auth.uid() and m.status='ACTIVE' and m.role in ('OWNER','ADMIN'));
$$;
revoke all on function public.atlas_is_workspace_member(uuid) from public;
revoke all on function public.atlas_is_workspace_manager(uuid) from public;
grant execute on function public.atlas_is_workspace_member(uuid) to authenticated;
grant execute on function public.atlas_is_workspace_manager(uuid) to authenticated;
