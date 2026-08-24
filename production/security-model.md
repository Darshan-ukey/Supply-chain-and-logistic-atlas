# Pilot security model

## Public/read-only foundation
Canonical Atlas reference data is shipped as application content. Pilot users cannot mutate it through a browser API.

## Authenticated client work
Supabase Auth establishes identity. Row-Level Security constrains workspace rows to authorized members. Access is enforced before any persistence operation.

## Pilot roles
- OWNER / ADMIN — workspace management and governance review.
- PILOT_USER — full functional work surface, no canonical publication authority.
- VIEWER — read-oriented collaboration where configured.

## Documents
Pilot document sources are ephemeral. Do not test real client-confidential information until the deployed environment, provider data-handling configuration, tenant controls and organizational security approvals are confirmed.
