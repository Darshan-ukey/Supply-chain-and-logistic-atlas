create extension if not exists pgcrypto;
create table if not exists atlas_workspaces(id uuid primary key default gen_random_uuid(),tenant_id text not null,client_name text,workspace jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists atlas_events(id uuid primary key,created_at timestamptz not null,event_type text not null,status text,latency_ms integer,agent_path jsonb,metadata jsonb not null default '{}'::jsonb);
create table if not exists atlas_review_items(id uuid primary key,created_at timestamptz not null,status text not null default 'OPEN',type text not null,summary text not null,payload jsonb not null default '{}'::jsonb);
-- Before real multi-client data: enable Auth + RLS and bind tenant_id to authenticated tenant/user claims.
