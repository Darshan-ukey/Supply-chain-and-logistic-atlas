# v0.6.4 Vercel deployment checklist

1. Deploy this folder as the Vercel project root. `package.json`, `app/`, `public/`, `lib/` must be at root.
2. Framework: Next.js. Node: 20.x.
3. Install: `npm install`. Test: `npm test`. Build: `npm run build`.
4. Next.js is pinned to 15.5.23; React/ReactDOM to 19.1.5.
5. Add server-side environment variables from `.env.example` in Vercel. Never place secrets in HTML/browser code.
6. Apply `supabase/schema.sql` to the Supabase project before enabling persistence.
7. Verify `/api/integrity` and `/api/capabilities` after deployment.
8. Browser-test Page 0, native Road LTL child, chat highlighting/reset, evidence intake/review, client mapping, analysis, transform/simulate, admin/review.
9. Do not use real multi-client confidential data until authentication and tenant-bound Supabase RLS are configured.
