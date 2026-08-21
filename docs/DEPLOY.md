# Deployment — Atlas V6.2.3 + Intelligence v0.6.6

## Repository root
Upload/commit the **contents** of this folder to the existing GitHub repository root. Do not nest the package inside another folder.

Expected root includes:
`app/`, `data/`, `docs/`, `frozen/`, `lib/`, `public/`, `supabase/`, `tests/`, `.env.example`, `package.json`, `README.md`, `vercel.json`.

## Existing Vercel project
Use the existing Vercel project connected to the GitHub `main` branch. A commit to `main` should trigger a Git-based deployment.

Root Directory: repository root / blank (`./`).
Framework: Next.js.
Install: default npm install.
Build: `npm run build`.

## Environment variables
Server-side only:
- `LLM_PROVIDER=gemini`
- `LLM_MODEL=gemini-2.5-flash`
- `GEMINI_API_KEY=<secret>`

Optional runtime services:
- `CLIENT_RESEARCH_PROVIDER=tavily`
- `TAVILY_API_KEY=<secret>`
- `SUPABASE_URL=<url>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-side secret>`
- `ATLAS_TENANT_ID=<prototype tenant only>`

Do not commit `.env` or expose service-role/API secrets in browser code.

## Production acceptance
A Vercel deployment is accepted only when all conditions in `V0.6.6_VERCEL_ACCEPTANCE.md` pass. A successful upload is not the same as a successful release.
