# Go-Live Checklist — Pilot V1.0

- [x] Node engine pinned to 24.x.
- [x] Frozen source hashes protected.
- [x] Road LTL V1.2 counts validated.
- [x] Domain-neutral core + AP fixture present.
- [x] Health/readiness/version/integrity APIs present.
- [x] Session-ephemeral document path has no persistence writes.
- [x] Supabase RLS migration set included.
- [x] Admin/Pilot governance boundary defined.
- [x] Collaboration/telemetry privacy boundaries defined.
- [x] Offline Stage-23 evaluation harness included.
- [ ] Dependency lockfile generated with npm registry access.
- [ ] Vercel Lab target connected and environment variables audited.
- [ ] Deployed HTTP/browser E2E passed.
- [ ] Live LLM synthetic certification passed if provider is enabled.
- [ ] Exact tested Lab artifact promoted to Stable.
- [ ] Isolated database restore/PITR rehearsal completed before persistent confidential production retention (not required for current session-ephemeral source mode unless policy requires it).
