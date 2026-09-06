-- P6.1 storage refinement: keep protected canonical JSON losslessly compressed at rest/transport.
alter table public.atlas_work_decompositions
  add column if not exists payload_encoding text not null default 'JSONB',
  add column if not exists payload_compressed_base64 text;

alter table public.atlas_work_decompositions alter column payload drop not null;

alter table public.atlas_work_decompositions
  drop constraint if exists atlas_work_decompositions_payload_present_ck;
alter table public.atlas_work_decompositions
  add constraint atlas_work_decompositions_payload_present_ck
  check (
    (payload_encoding='JSONB' and payload is not null)
    or
    (payload_encoding='GZIP_BASE64' and payload_compressed_base64 is not null)
  );

comment on column public.atlas_work_decompositions.payload_compressed_base64 is
  'Lossless GZIP+Base64 protected decomposition payload. Decompressed only server-side after Atlas capability authorization.';
