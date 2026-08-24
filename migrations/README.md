# Supabase migrations — Pilot V1.0

Apply in filename order in a dedicated Supabase project. The current pilot uses **session-ephemeral source documents**: raw uploaded files, parsed text, chunks and vectors are not persisted by the application. The Stage-19 migration is retained only to document the earlier private-document architecture; do not enable persistent raw-document flows for the pilot unless security policy changes explicitly.

Recommended pilot sequence:
1. `schema-contract.sql`
2. `stage17-workspaces.sql`
3. `stage19-document-ingestion.sql` (confirmed normalized facts only; source persistence tables remain unused)
4. `stage21-collaboration-telemetry.sql`
5. `stage22_2_pilot_rbac.sql`
6. `stage23-pilot-evaluations.sql`

After applying, run Supabase security advisor and verify every `atlas_*` table has RLS enabled.
