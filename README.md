# Supply Chain Atlas — V2

**Execution Intelligence · Public Atlas + Authenticated Admin WorkDefinition Layer**

V2 is an additive evolution of the certified spatial Atlas foundation. It preserves the governed Page 0 / Road LTL knowledge and existing canvas/runtime capabilities while introducing a two-layer execution-intelligence experience.

## Access model

### Public Atlas — `/`

No login is required. The public product demonstrates what the platform can do without publishing reusable execution-design IP.

Public users can see:

- the existing spatial Atlas and Reference Atlas;
- A3 → A4 → A5 governed execution context;
- WorkDefinition availability/status;
- execution-intelligence capability summary;
- automation / execution-pattern fit;
- aggregate handling/information/outcome coverage;
- the existing Explore / Execute / Compare / Transform experience.

The public browser bundle does **not** contain full WorkDefinitions, detailed Malkom projections, canonical field definitions, exact outcome mappings, transition graphs or client-binding details.

### Admin — `/admin`

Admin sign-in is authenticated through Supabase Auth and authorized server-side. An Admin account is accepted when either:

- its email is listed in `ATLAS_ADMIN_EMAILS`; or
- Supabase `app_metadata.atlas_role` is `admin`; or
- `app_metadata.roles[]` contains `admin`.

Only an authorized Admin can retrieve the protected execution-definition payload.

Admin sees the full V2 execution layer:

- Work Decomposition;
- canonical WorkDefinition;
- full fields/schema;
- outcomes and transitions;
- Malkom projection;
- automation fit;
- raw machine-readable definition;
- Domain Warehouse metadata.


## Universal Ask Atlas

Atlas 2.0 uses one Ask Atlas intelligence layer across **Universe, Daughter, Canvas and Admin**. The browser sends a generic `surfaceState`; the server scopes retrieval to the current view and validates every proposed UI action deterministically.

- Universe: domains, navigator entries, systems, objects, documents, events, relationships and coverage.
- Daughter: current ACTIVE + A5_VERIFIED module and its governed evidence.
- Canvas: active execution/context/playback/trace state.
- Admin: the above plus protected WorkDefinition evidence after server-side Admin authorization.

Legacy `canvasState` requests remain supported. Frozen reference files are not modified: the host/wrapper supplies Ask Atlas around them. See `production/ask-atlas-architecture.md` and `UNIVERSAL_ASK_ATLAS_INTEGRATION.md`.

## Protected execution data

The GitHub repository intentionally does **not** include the private 22-definition Road LTL WorkDefinition seed. This matters if the GitHub repository is ever public: website authentication cannot protect data that has already been committed to GitHub.

The protected definitions live in Supabase table `atlas_work_definitions` and are returned only by the authenticated Admin API.

See `ADMIN_AUTH_SETUP.md`.

## Deployment setup

1. Apply existing migrations plus `migrations/v2-admin-workdefinitions.sql`.
2. Configure Vercel environment variables from `.env.example`.
3. Set `ATLAS_ADMIN_EMAILS` to the authorized Admin email(s).
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
5. Seed the private WorkDefinition JSON with:

```bash
npm run seed:workdefinitions -- /secure/path/V2_ADMIN_PRIVATE_WORKDEFINITION_SEED.json
```

6. Deploy to Vercel Lab first.
7. Validate `/` public access and `/admin` Admin sign-in before production promotion.

## Architecture constraints preserved

- Canonical Page 0 and Road LTL assets remain unchanged.
- WorkDefinition is derived from Atlas knowledge; it does not rewrite the Atlas.
- Public and Admin are two authorization projections of the same product, not divergent products.
- Full execution data is not hidden with CSS; it is withheld server-side until Admin authorization succeeds.
- Vercel remains at **8 top-level serverless functions**, below the 12-function limit.
- Existing document privacy / ephemeral LLM guardrails remain unchanged.

## Validation

```bash
npm run check
```

V2 checks include:

- canonical/reference hash integrity;
- Universal Ask surface/retrieval/coverage/command validation;
- public-IP boundary validation;
- Admin authentication/authorization tests;
- consolidated API/router test;
- real Chromium desktop/mobile UI checks for Public and Admin layers.

See `audits/v2/` and `V2_GITHUB_RELEASE_AUDIT.md`.

<!-- Governance Branch V2.1 Write Verification: 2026-09-26 09:04 Asia/Kolkata UTC+05:30 Claude Haiku 4.5 -->
