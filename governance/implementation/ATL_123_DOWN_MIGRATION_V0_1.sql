-- ATL-123 / ATL-125 governed down-migration
-- Reverses only objects introduced by ATL-82 V0.3. Execute only under governed recovery authorization.
begin;
drop table if exists public.atlas_generation_z5_outputs cascade;
drop table if exists public.atlas_knowledge_gap_links cascade;
drop table if exists public.atlas_knowledge_evidence_links cascade;
drop table if exists public.atlas_evidence_sources cascade;
drop table if exists public.atlas_knowledge_relationships cascade;
drop table if exists public.atlas_knowledge_entities cascade;
drop table if exists public.atlas_knowledge_generation_runs cascade;
drop table if exists public.atlas_knowledge_relationship_types cascade;
drop table if exists public.atlas_knowledge_entity_types cascade;
drop function if exists public.atlas_guard_append_only() cascade;
commit;
