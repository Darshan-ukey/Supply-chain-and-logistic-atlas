# Atlas V2 Admin Authentication & Protected Execution Layer

## Security model

The public `index.html` contains only the public-safe Execution Intelligence projection. It does not contain full WorkDefinition payloads, Malkom projection details, canonical field definitions, outcome mappings, transition graphs, or client-binding details.

`admin.html` contains the Admin UI renderer but no protected WorkDefinition data. On load it requires Admin authentication and fetches the full definitions through the protected server-side API.

The full 22-definition Road LTL registry is seeded into `public.atlas_work_definitions` in Supabase from a separate private seed artifact. Do not commit that seed file to a public repository.

## Environment variables

Set these in Vercel Project Settings → Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only; never expose to browser code
- `ATLAS_ADMIN_EMAILS` — comma-separated allowed Admin emails, e.g. `admin@company.com`

Admin authorization also accepts a Supabase user's `app_metadata.atlas_role = "admin"` or a `roles` array containing `admin`.

## Database setup

Run the existing migrations, then apply:

`migrations/v2-admin-workdefinitions.sql`

This table has RLS enabled and intentionally has no browser-readable policies. The Admin API performs the authorization check first and then reads through the service role.

## Seed the protected definitions

Keep the private seed JSON outside GitHub, then run locally:

```bash
SUPABASE_URL="https://...supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/seed-v2-workdefinitions.mjs /secure/path/V2_ADMIN_PRIVATE_WORKDEFINITION_SEED.json
```

Expected result: 22 ACTIVE Road LTL WorkDefinitions.

## User experience

- `/` — public Atlas; no login required.
- `/admin.html` (or `/admin`) — protected Execution Intelligence. If there is no valid Admin session, the page presents Admin sign-in.
- Admin session uses secure HttpOnly cookies issued by the existing server-side auth boundary.
- Non-admin Supabase accounts receive HTTP 403 and never receive the protected definition payload.

## Important repository rule

If the GitHub repository is public, never add the private WorkDefinition seed or a standalone Admin HTML that embeds the full registry. The repository version intentionally separates renderer from protected data.
