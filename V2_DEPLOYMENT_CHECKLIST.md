# V2 Deployment Checklist

1. Upload this repository to GitHub.
2. In Supabase SQL Editor, apply `migrations/v2-admin-workdefinitions.sql` after the existing migrations.
3. In Vercel set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ATLAS_ADMIN_EMAILS`.
4. Ensure the Admin email exists as a Supabase Auth user. No default password is committed in the repository.
5. Keep `V2_ADMIN_PRIVATE_WORKDEFINITION_SEED.json` outside GitHub.
6. Seed it locally with `npm run seed:workdefinitions -- /secure/path/V2_ADMIN_PRIVATE_WORKDEFINITION_SEED.json`.
7. Deploy to Lab.
8. Validate `/` as an anonymous visitor: public Execution Intelligence only.
9. Validate `/admin`: Admin sign-in appears; non-admin user is rejected; authorized Admin sees full WorkDefinition tabs.
10. Re-run `npm run check` and `/api/release-integrity` before promotion to production.
