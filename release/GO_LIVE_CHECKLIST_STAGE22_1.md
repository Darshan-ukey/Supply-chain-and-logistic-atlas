# Stage 22.1 Go-Live / Pilot Checklist

## Complete
- [x] Node engine pinned to 24.x.
- [x] Stable/Lab target names reserved.
- [x] Ephemeral client-document source persistence disabled.
- [x] LLM structuring is the default/required pilot document path.
- [x] Deterministic keyword fallback is disabled when the pilot requires LLM structuring.
- [x] Gemini `generateContent` calls set request-level `store=false`.
- [x] Gemini API key is transmitted by header rather than URL query string.
- [x] Candidate Atlas mappings are checked against published canonical IDs.
- [x] Candidate facts remain unconfirmed until consultant confirmation.
- [x] Browser response is `no-store` and session candidates clear on page exit.
- [x] Isolated Supabase branch explicitly classified as optional for runtime and required only for recovery rehearsal.

## Still external / promotion gates
- [ ] Configure the Gemini server-side API key/model.
- [ ] Set `ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=true` only after reviewing the paid project/account settings.
- [ ] Deploy the exact Stage-22.1 Lab artifact.
- [ ] Run deployed Node-24 readiness/integrity/browser/API E2E.
- [ ] Produce dependency lockfile in a network-enabled build environment.
- [ ] Run isolated Supabase restore/PITR rehearsal when cost approval is granted.
