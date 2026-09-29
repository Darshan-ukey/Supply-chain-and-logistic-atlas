# ATL-146 — Independent BOL-002 Promotion QA

## Scope and evidence

QA was performed against `darshanukey/atl-146-bol-002-freeze-promotion` at
`4ac2581e3dba606aafb51f31a6fb560f05348258`, including the four promotion
commits identified by ATL-146. The governing
`governance/product/ATLAS_V1_5_QA_OUTCOME_ARCHITECTURE_STANDARD_V1.md` was read
from `atlas-governance-registry-v2.1` (blob
`9dd7c3ebf6956a8477cc0bcb6ee06a7a1256a2ed`). QA did not change the promotion
branch or any domain/FIRI rule content.

## Reproducible checks

- `npm run validate:bol002-firi` in
  `apps/atlas-bol-intelligence-explorer/`: **PASS** —
  `ATL-134 BOL-002 FIRI regression guard: PASS`.
- Bun is unavailable in the QA environment. After installing the existing app
  dependencies into a temporary worktree with `npm install --no-package-lock`,
  `npm run build`: **PASS** (Vite client, SSR, and Nitro Cloudflare-module
  builds completed).
- The hash utility
  `apps/atlas-bol-intelligence-explorer/scripts/hash-bol-intelligence.ts` was
  independently invoked with Node 24's TypeScript stripping. A temporary copy
  changed only the extensionless data-module import to its explicit `.ts`
  path; the utility body and package input were unchanged. Running
  `node --experimental-strip-types /tmp/hash-bol-intelligence.ts` twice
  produced the same result:

  `sha256:a11b6090baab7a02c6ec2e151d09276f664ec131a08e6fcf868ed9a6f39b27bc`

  The utility recursively sorts object keys, preserves array order, blanks
  `package_hash`, serializes JSON as UTF-8, and computes SHA-256
  (`scripts/hash-bol-intelligence.ts:1-21`). The current in-memory/package
  value remains `PENDING_DETERMINISTIC_REHASH`; the independently computed
  digest was not written into the package or a freeze record.
- Direct runtime inspection of the imported data module returned BOL-002 as
  `EXECUTION_SUFFICIENT`, `SUPPORTED`, `gap_flag: false`, version
  `firi-v1.0-approved-2026.09.28`. The governed classifier at
  `src/data/bol-intelligence.ts:763-769` applies dependency, unsupported,
  partial-field and canonical-domain rules; BOL-002's crosswalk row
  (`:40-45`) is `Canonical BOL/domain`. There is no BOL-002 force in
  `classify`; ATL-146 removed the temporary partial override. The field-2
  rationale at `:777` documents the result but does not set the classification.
- A dev-server smoke check returned `200 application/json` for
  `/api/bol/intelligence-package`, `/api/bol/fields/`, and
  `/api/bol/fields/BOL-002/intelligence`; the last response contained
  `EXECUTION_SUFFICIENT`. An unknown field returned
  `404 application/json` with `FIELD_NOT_FOUND`. The UI's field overview,
  detail, and package routes are in `src/routes/index.tsx`,
  `src/routes/fields.$fieldId.tsx`, and `src/routes/package.tsx`.

## Architecture and outcome assessment

- The governed FIRI contract is field-level semantics for identification,
  separation, association, validation and escalation. Its rules
  `FIRI-BOL002-R01..R08`, validations, provenance, consumer projections and
  unresolved questions are represented in
  `apps/atlas-bol-intelligence-explorer/src/data/bol-intelligence.ts:670-727`.
  The 13 ATL-134 adversarial vectors and ambiguity/fail-closed boundaries are
  documented in `governance/operational-knowledge/firi/ATL_134_BOL_002_FIRI_V1_VALIDATION.md:15-37`.
- Atlas remains a pre-execution knowledge/semantics layer: the package states
  that classification sufficiency is not runtime accuracy or whole-BOL work
  readiness (`src/data/bol-intelligence.ts:777,820`). The application exposes
  a read-only human inspection journey and machine-readable JSON. The
  cross-layer boundary here is source claims/crosswalk → governed FIRI
  semantics → versioned package/API. On-Demand Depth, WorkDefinition, client
  binding, readiness and transaction execution are outside this bounded
  field-intelligence POC; consumers own those runtime steps.
- Reusable canonical rules are kept separate from the named Malkom projection.
  The same contract declares a non-Malkom VLM/agent/document-digitization
  projection (`src/data/bol-intelligence.ts:723-725`; candidate contract
  `governance/operational-knowledge/firi/BOL_002_LINE_ITEM_DESCRIPTION_FIRI_V1_CANDIDATE.json:179-207`).
  Malkom queues, APIs and runtime schemas are not embedded as canonical
  semantics. These are contract-level utility and independence findings, not
  evidence that a production Malkom or non-Malkom runtime has been deployed.
- The canonical coordination log on `atlas-governance-registry-v2.1` routes
  this separate owner-run track through
  `ATL-146 → ATL-147 → ATL-148 → ATL-149 → ATL-150 → ATL-151 → ATL-133` and
  explicitly keeps it outside the ATL-177 Shared Baton
  (`claude_chatGPT.md:554-559`). The field-neutral contract and fail-closed
  unresolved questions preserve that continuation boundary; no later ticket
  semantics are claimed as implemented here.
- The governed candidate JSON remains the source/custody artifact and is
  correctly still marked `CANDIDATE_PENDING_INDEPENDENT_QA`
  (`BOL_002_LINE_ITEM_DESCRIPTION_FIRI_V1_CANDIDATE.json:1-8,209-212`).
  The Explorer's versioned `EXPERIMENTAL_POC` package is a reachable,
  machine-readable projection with provenance and an intentionally pending
  hash (`src/data/bol-intelligence.ts:796-822`). ATL-146 retains source
  identities and versions, and the earlier candidate and current promotion
  remain recoverable from Git history. Final custody/freeze and hash
  persistence are explicitly deferred to the post-QA handoff; no frozen
  history was overwritten.
- Negative controls: unresolved Handling Unit Line No and continuation/
  attachment semantics remain explicit and fail-closed (`src/data/bol-intelligence.ts:719-721`);
  unsupported and dependency-bound field classes retain their governed
  handling (`:765-768`); unknown API field IDs return 404; the previous
  ATL-73 hash is not reused and the package hash is still pending
  (`:820`). The regression guard checks important content and override
  absence; its textual assertions are supplemented here by direct runtime
  classification and retrieval checks.
- The tested API is anonymous read-only GET, not an authenticated
  private/admin/client execution surface. Its payload contains governed
  semantics and no client transaction values. The app describes the UI as
  internal review (`src/routes/index.tsx:13-16`); deployment access policy is
  outside this repository-level QA and must not be inferred from that copy.

## Required dispositions

| Dimension | Disposition | Evidence/rationale |
|---|---|---|
| `BUILD_CORRECTNESS` | **PASS** | Regression guard and full production build passed; target diff and promotion history inspected. |
| `OUTCOME_FITNESS` | **PASS** | Approved field-level package is available in UI and API; 13 adversarial cases and explicit unresolved states are present. This is not a claim of runtime accuracy or whole-BOL readiness. |
| `ARCHITECTURE_FITNESS` | **PASS** | Atlas provides reusable, pre-execution semantics and consumer-neutral projections; no downstream executor/runtime semantics were added. |
| `FUTURE_SCOPE_COMPATIBILITY` | **PASS** | Generic input/output and unresolved, fail-closed questions preserve extension points rather than fixing temporary consumer behavior as canonical truth. |
| `DATA_STORAGE_OWNERSHIP` | **PASS** | Governed JSON remains the candidate source; Explorer package is an experimental projection with identity/provenance. Final freeze/hash custody remains pending by design. |
| `RETRIEVAL_CONSUMPTION` | **PASS** | Versioned package and field GET routes return the governed representation; unknown field lookup fails closed with 404. |
| `INTERACTION_MODEL` | **PASS** | Overview, detail, and package inspection journeys plus callable API routes are reachable. Observed access boundary is anonymous read-only GET; deployment policy is not assessed. |
| `LINEAGE_RECOVERY` | **PASS** | Source IDs/locators are retained; hash independently recomputed twice; prior state is preserved in Git history; no hash/freeze was persisted. |
| `MALKOM_UTILITY` | **PASS** | The contract supplies field rules, validation and a Malkom projection usable without rediscovering the field semantics; no production integration is claimed. |
| `CONSUMER_INDEPENDENCE` | **PASS** | A separate runtime-neutral non-Malkom projection and generic contract are present; no Malkom runtime dependency is canonical. |
| `PROMOTION_QA` | **PASS** | BOL-002 is derived as `EXECUTION_SUFFICIENT` through governed classification, with its temporary override removed and its approved field version visible. |
| `HASH_RECOMPUTE` | **PASS** | Repeated independent SHA-256 recomputation matched exactly; the package still reports `PENDING_DETERMINISTIC_REHASH`. |
| `FINAL` | **PASS** | All required dimensions are supported for the bounded field-level POC. This does not authorize hash persistence, package freeze, deployment, or promotion beyond ATL-146. |

**Independent digest (not persisted):**
`sha256:a11b6090baab7a02c6ec2e151d09276f664ec131a08e6fcf868ed9a6f39b27bc`
