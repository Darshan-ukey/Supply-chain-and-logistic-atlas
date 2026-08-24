# Stage 22 Release Runbook

## 1. Freeze

- Freeze the candidate commit/artifact.
- Run `npm run release:all`.
- Generate `release/stage22-release-manifest.json`.
- Archive the exact candidate ZIP and manifest checksum.

## 2. Database preflight

- Confirm expected Supabase migrations are applied.
- Confirm every `atlas_*` client-work table has RLS enabled.
- Confirm `atlas-client-evidence` and `atlas-client-documents` remain private.
- Run Supabase security advisor; zero security findings required.
- Database migrations are applied before application promotion only when backward-compatible with both old and new application versions.

## 3. Lab deployment

- Deploy the candidate to the Lab/Preview target.
- Configure Lab environment variables independently from Stable.
- Verify `/api/health`, `/api/readiness`, `/api/version`, `/api/release-integrity`.
- Run browser E2E and API smoke checks.
- Verify Road LTL A5, Ask Atlas deterministic fallback, Transform, document ingestion gate, collaboration and exports.
- If a live LLM provider is configured, run the grounded-citation acceptance set before promotion.

## 4. Promotion decision

Promotion requires all gates in `RELEASE_CONTRACT.md` to pass. Do not rebuild Stable from source after Lab approval. Promote the tested deployment/artifact.

## 5. Stable deployment

- Promote tested Lab artifact to Stable/Production.
- Confirm release ID and commit SHA at `/api/version`.
- Confirm readiness against production Supabase.
- Confirm no AP standalone fixture is present in the Stable package.
- Execute a short production smoke test with non-client synthetic/test workspace data only.

## 6. Post-release

- Observe 4xx/5xx rate, readiness, serverless errors and Supabase advisor state.
- Review product telemetry only at aggregate metadata level.
- Keep previous Stable deployment address/ID available for rollback.
