# Stage 22.2 Go-Live / Controlled-Pilot Checklist

## Complete
- [x] Node engine pinned to 24.x.
- [x] Stable/Lab release contracts defined and target names reserved.
- [x] Canonical Core/SCM hashes frozen and unchanged.
- [x] Full source regression chain retained.
- [x] Supabase RLS on all current Atlas client-work tables.
- [x] Pilot `EDITOR` write role separated from read-only `VIEWER`.
- [x] Foundation proposal queue added; only OWNER/ADMIN may review toward publication gates.
- [x] Ephemeral document mode stores no uploaded source, parsed chunks, vectors or unconfirmed candidate rows.
- [x] Ephemeral document mode **requires approved LLM structuring** by default.
- [x] Required LLM path fails closed instead of silently falling back to keyword matching.
- [x] Gemini `generateContent` requests set `store=false` and use the API-key header.
- [x] LLM-returned process IDs are validated against the published module before candidate mapping is accepted.
- [x] Explicit client-fact confirmation omits original file/reference/quote/locator.
- [x] Isolated Supabase branch classified as a recovery-certification gate, not a runtime dependency.
- [x] Stable target has not been production-promoted.

## External / promotion gates still open
- [ ] Configure Gemini server-side API key/model in Lab.
- [ ] Verify paid-project/data-sharing/logging settings and then set `ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=true`.
- [ ] Deploy **exact** Stage-22.2 Lab artifact.
- [ ] Configure/audit Lab environment variables.
- [ ] Run deployed Node-24 readiness/integrity/browser/API E2E.
- [ ] Produce deterministic dependency lockfile in a network-enabled build environment.
- [ ] Isolated Supabase branch/PITR rehearsal — optional for normal pilot runtime, still required before recovery certification for confidential production data.
- [ ] Promote exact tested artifact to Stable only after promotion gates pass.
