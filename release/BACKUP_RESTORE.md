# Backup / Restore and Migration Rehearsal

## Assets requiring protection

1. Supabase PostgreSQL client-work tables (`atlas_*`).
2. Private Storage bucket `atlas-client-evidence`.
3. Private Storage bucket `atlas-client-documents`.
4. Canonical Atlas content in source control/release artifacts.
5. Release manifests and migration history.

## Recovery objectives for this stage

Stage 22 defines the procedure but does not invent an RPO/RTO. Those targets must be set by the eventual enterprise owner based on client-data classification.

## Restore order

1. Restore database/schema and workspace membership.
2. Restore private Storage objects.
3. Verify evidence/document metadata ↔ object-path references.
4. Verify audit history and confirmed-document-fact references.
5. Deploy the application version compatible with the restored schema.
6. Run tenant-isolation and retrieval smoke tests.

## Migration discipline

- additive/backward-compatible migrations first;
- old Stable must remain functional during Lab validation of the new application;
- destructive changes require a two-release deprecation cycle where practical;
- migration version is recorded in the release evidence.

## Stage-22 rehearsal status

Schema/RLS/storage state was re-read from the connected Supabase project and matched the expected Stage 17/19/21 model. A full point-in-time restore rehearsal was **not** performed against production because that requires an isolated database/branch or destructive restore target. It remains a go-live infrastructure gate rather than being falsely marked PASS.
