# Rollback Runbook

## Application rollback

Trigger rollback for any of:
- readiness failure after promotion;
- elevated 5xx/runtime-error cluster;
- authentication/session regression;
- cross-tenant/RLS concern;
- canonical release-integrity mismatch;
- Ask Atlas command validation bypass;
- document candidate facts appearing as confirmed without consultant action.

Procedure:
1. Stop further promotion/change activity.
2. Roll Stable back to the last known-good Vercel deployment.
3. Verify `/api/version`, `/api/readiness`, and `/api/release-integrity` on the restored deployment.
4. Keep the database at the newer schema if the migration was forward/backward compatible.
5. Open a release incident record and reproduce in Lab.

## Database rollback

Database rollback is exceptional. Prefer forward-compatible additive migrations and corrective forward migrations. Never drop client evidence or audit history as part of an application rollback.

Before any destructive database rollback:
- take/verify a database backup;
- verify Storage objects separately;
- document affected client workspaces;
- obtain explicit approval.
