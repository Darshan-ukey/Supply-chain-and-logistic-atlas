# Stage 17 Security Model

## Controls implemented
1. Authentication via Supabase Auth behind same-origin API functions.
2. Secure/HttpOnly/SameSite cookies; no browser token localStorage.
3. Row Level Security enabled on every Atlas client-work table.
4. Private RLS helper functions live outside the exposed public API schema.
5. Private Storage bucket with workspace-prefix authorization.
6. Allow-listed evidence MIME types and bucket size limit.
7. Proxy upload size cap in reference API.
8. SHA-256 recorded for uploaded evidence.
9. Database audit triggers for mutable client-work objects.
10. Canonical Atlas content has no mutation API in this stage.
11. Node 24 engine pinned for the Vercel deployment target.
12. API/server secrets supplied only by environment variables.

## Supabase advisor result
Security advisor after hardening: **0 findings**.

Performance advisor after hardening: only `unused_index` informational notices remain, expected because the schema is newly created and has no production traffic yet.

## Not yet claimed
- enterprise SSO/SAML configuration
- legal retention policy
- DLP/malware scanning
- customer-managed encryption keys
- private networking
- signed direct upload for >4 MB documents
- formal disaster-recovery/SLA controls

Those belong to enterprise production hardening, not the Stage-17 boundary proof.
