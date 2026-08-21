# Deployment — Atlas V6.2.3 + Intelligence v0.6.5

Use this entire folder as the existing GitHub/Vercel project root.

## GitHub replacement
Replace/update the repository root with all files/folders from this package. Do not upload the ZIP as a single file and do not nest this project under another directory.

Expected root includes:
`app/ data/ docs/ frozen/ lib/ public/ supabase/ tests/ package.json vercel.json README.md`

Commit to `main`. The existing Vercel Git integration will trigger a new deployment automatically.

## Vercel environment variables
Keep/add server-side only:
- `LLM_PROVIDER=gemini`
- `LLM_MODEL=gemini-2.5-flash`
- `GEMINI_API_KEY=<secret>`
- optional `CLIENT_RESEARCH_PROVIDER` / `TAVILY_API_KEY`
- optional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ATLAS_TENANT_ID`

## Required release checks
1. Git deployment becomes Ready.
2. `/api/integrity` -> `ok: true` and every check true.
3. `/api/capabilities` -> version `0.6.5`, atlasRelease `V6.2.3`, frozenFoundation `V6.2.2`.
4. Atlas header shows `How to read Atlas` and the full-screen guide opens.
5. Intelligence badge shows LLM ON when Gemini variables are present.
6. Ask `what does OTHER signify on the page?` with no exact context -> clarification, not a guessed answer.
7. Click/inspect `OTHER_LTL_KNOWLEDGE`, then ask `what does OTHER mean?` -> trace-relevance explanation.
8. Ask `how was the Atlas built?` -> methodology explanation sourced from the V6.2.3 Constitution.
9. Ask `what is LTL-08?` -> simple real-world explanation plus Atlas-child-synthesis provenance/source relationship.
10. Trace POD/invoice/claim/BOL/rate and verify visual trace actions.

## Frozen foundation rule
Never edit files under `frozen/`. Any future process/source/applicability correction is a separately governed Atlas release.
