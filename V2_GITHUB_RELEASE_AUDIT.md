# V2 GitHub Release Audit

## Scope

Build the accepted V2 UI into a complete GitHub/Vercel repository with:

1. Public Atlas layer that demonstrates Execution Intelligence without publishing execution-detail IP.
2. Admin-only layer with authenticated sign-in and full WorkDefinition access.
3. No regression to protected canonical Atlas knowledge.
4. No increase beyond the existing eight consolidated Vercel functions.

## Pre-build audit

The donor repository was extracted from the certified `v1.1.7-final-github` package and the accepted V2 public/admin standalone UI was used as the UI donor.

Protected assets were hashed before changes. The canonical anchors included:

- Page 0 V6.2.3 legacy reference HTML;
- Road LTL V1.2 legacy reference HTML;
- machine-readable Page 0 JSON;
- machine-readable Road LTL JSON;
- Enterprise Core Ontology;
- Supply Chain Domain Pack;
- Atlas Data Contract v1.1;
- relationship / rule / overlay registries.

No canonical content change was in V2 scope.

## During-build audit

### Public layer

- `index.html` replaced with the accepted UI-audited V2 PUBLIC standalone.
- Admin entry added without adding protected execution payload.
- Public V2 payload retains capability/automation-fit summaries only.

### Admin layer

- `admin.html` derives from the accepted UI-audited V2 ADMIN standalone.
- The embedded full WorkDefinition registry was removed.
- The Admin renderer loads full definitions only from `/api/atlas?action=admin-workdefinitions` after Admin authorization.
- Unauthenticated Admin page presents sign-in.
- Non-admin authenticated accounts receive 403.

### Authentication / authorization

- Existing Supabase password authentication retained.
- Added Admin-specific login/session/logout handlers inside the existing consolidated `api/auth.js` function.
- Admin authorization accepts `ATLAS_ADMIN_EMAILS` and/or Supabase app metadata Admin role.
- Secure HttpOnly cookies remain the session mechanism.

### Protected data

- Added `atlas_work_definitions` database migration with RLS and no browser-readable policy.
- Protected API reads only after `requireAdmin()` succeeds.
- API then uses server-side `SUPABASE_SERVICE_ROLE_KEY` to read the protected table.
- Full WorkDefinition seed is deliberately excluded from GitHub.
- Private seed loader added for controlled one-time/upsert population.

### Serverless architecture

No new top-level API function was added. Admin routes were added as actions under existing `auth.js` and `atlas.js` routers.

Top-level Vercel function count remains: **8**.

## Post-build validation

### Canonical integrity

Passed the existing canonical/reference integrity gate:

- Page 0 reference hash unchanged;
- Road LTL reference hash unchanged;
- Page 0 machine-readable hash unchanged;
- Road LTL machine-readable hash unchanged;
- 22 Road LTL processes;
- 13 A3 parents;
- 39 flow edges;
- 22 execution transitions;
- 29 sources;
- 27 lenses;
- 15 child actors;
- 176 ontology edges.

### Public IP boundary

Passed:

- public bundle excludes known detailed queue/field/outcome/transition/client-binding tokens;
- Admin shell also excludes embedded protected payload;
- private WorkDefinition seed absent from GitHub repository;
- migration + private seed loader present.

### Admin auth boundary

Passed:

- authorized Admin login succeeds;
- secure HttpOnly cookies issued;
- non-admin user rejected with 403;
- Admin session confirms role;
- protected WorkDefinition endpoint rejects non-admin;
- protected endpoint returns definitions to Admin;
- protected database read uses server-only service role;
- protected responses are `no-store`.

### UI/browser regression

Real Chromium checks passed at:

- Public desktop 1440×900;
- Public mobile 390×844;
- Admin desktop 1440×900;
- Admin mobile 390×844.

For all four:

- zero runtime errors;
- zero horizontal overflow;
- Explore / Execute / Compare / Transform visible;
- expected V2 tabs visible.

Admin browser test additionally confirmed protected UI loads only after an authenticated Admin session.

### Existing non-regression checks retained

Individually passed after V2 changes:

- 71-destination / 2,130-process scale smoke;
- Stage 22.2 pilot security smoke;
- session-ephemeral LLM smoke;
- Stage 23 pilot evaluation smoke;
- offline pilot evaluation corpus.

The historical `v1.1.7-api-router-smoke.mjs` is intentionally no longer a V2 release gate because it hard-codes the old release ID and old 28-route count. V2 adds four protected/admin routes while preserving the eight-function architecture. The V2 router test replaces that release-specific assertion.

## Release verdict

**PASS — repository-ready V2 build.**

External configuration still required before Admin use:

- Supabase migration applied;
- private WorkDefinition seed loaded;
- `SUPABASE_SERVICE_ROLE_KEY` configured;
- `ATLAS_ADMIN_EMAILS` and/or Admin app metadata configured;
- deployed Lab sign-in tested against the real Supabase project.


## Atlas 2.0 Universal Ask additive certification

V2.0.1 adds one governed Ask Atlas intelligence boundary across Universe, Daughter, Canvas and Admin without changing protected canonical assets.

Validated:

- Universe reference retrieval indexes 334 Page-0 records in the current donor;
- system-intent retrieval returns system evidence rather than generic domain noise;
- daughter requests are module-scoped;
- unpublished Road FTL A5 remains blocked;
- legacy `canvasState` remains API-compatible;
- Universe → Daughter and Daughter → Canvas handoffs are command-contract validated;
- Public Reference Atlas exposes an Ask Atlas control;
- Ask Atlas scopes to Universe when Page 0 is open and to Daughter when Road LTL is open;
- standalone reference pages can use the Universal Ask wrapper without modifying frozen reference HTML;
- Public/Admin IP and authorization gates continue to pass;
- desktop/mobile browser regression remains clean.

The new cross-surface command contract is `governance/ask-atlas-surface-contract-v1.json`; the reusable reference/daughter client is `runtime/universal-ask-atlas.js`.
