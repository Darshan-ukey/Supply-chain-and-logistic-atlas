# Stage 23 — Pilot Go-Live Checklist

## Already closed by code/build
- [x] Canonical Enterprise Core and Supply Chain content unchanged.
- [x] Ephemeral document source persistence = none in Atlas-controlled storage.
- [x] Gemini request contract sets `store=false`.
- [x] LLM document text is treated as untrusted evidence, never as instructions.
- [x] Deterministic canonical-ID validation runs after LLM extraction.
- [x] Invalid/unpublished process IDs cannot become mapped Atlas facts.
- [x] Pilot evaluation table uses RLS.
- [x] Synthetic 10-case test corpus created.
- [x] Stable package excludes synthetic pilot corpus.
- [x] Isolated Supabase restore branch is not a runtime dependency.

## Complete during Vercel/Gemini deployment walkthrough
- [ ] Configure Lab `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- [ ] Configure Lab `ATLAS_LLM_PROVIDER=gemini`.
- [ ] Add Gemini API key as a server-only Vercel secret.
- [ ] Select/freeze `ATLAS_LLM_MODEL`.
- [ ] Confirm AI Studio paid-project/data/log settings.
- [ ] Set `ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=true` only after review.
- [ ] Run `npm run pilot:eval:live` on the synthetic corpus.
- [ ] Verify all hard gates and mapping precision/recall thresholds.
- [ ] Set `ATLAS_PILOT_LIVE_EVAL_PASSED=true` only after the run passes.
- [ ] Verify `/api/pilot-readiness` returns 200 in Lab.
- [ ] Run deployed desktop/mobile E2E.
- [ ] Only then begin confidential RFP/SOP pilot testing.

## Deferred production-recovery certification
- [ ] True isolated database restore/PITR rehearsal on a temporary Supabase branch. This is not required to run the controlled pilot; it remains a recovery-certification gate before stricter production use.
