-- Stage 19 reference migration.
-- The live connected Supabase project has already received the equivalent migration.
-- Client documents remain workspace-scoped, RLS protected and separate from canonical Atlas data.

create table if not exists public.atlas_client_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  object_name text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  sha256 text not null,
  document_type text,
  ingestion_status text not null default 'UPLOADED',
  validation_class text,
  validation_reason text,
  extraction_method text,
  extraction_version text,
  extracted_chars integer not null default 0,
  relevance_score numeric(5,4),
  relevance_terms jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,object_name),
  unique(workspace_id,sha256)
);

create table if not exists public.atlas_document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  document_id uuid not null references public.atlas_client_documents(id) on delete cascade,
  chunk_index integer not null,
  locator text,
  content text not null,
  char_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(document_id,chunk_index)
);

create table if not exists public.atlas_candidate_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  document_id uuid not null references public.atlas_client_documents(id) on delete cascade,
  fact_key text not null,
  fact_type text not null,
  statement text not null,
  process_id text,
  canonical_type text,
  canonical_id text,
  canonical_label text,
  evidence_quote text not null,
  evidence_locator text,
  confidence numeric(5,4) not null default 0,
  extraction_method text not null,
  mapping_status text not null default 'CANDIDATE',
  review_status text not null default 'NEEDS_REVIEW',
  proposed_patch jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,document_id,fact_key)
);

alter table public.atlas_client_documents enable row level security;
alter table public.atlas_document_chunks enable row level security;
alter table public.atlas_candidate_facts enable row level security;

-- Production policies use atlas_private.is_workspace_member(workspace_id).
-- The private `atlas-client-documents` Storage bucket uses the workspace UUID
-- as its first path segment and enforces the same tenant boundary.
