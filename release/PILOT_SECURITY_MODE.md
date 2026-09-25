# Stage 22.2 — Controlled Pilot Security Mode

## Access boundary

- `OWNER` / `ADMIN`: client-work write access, membership administration and foundation-proposal review.
- `EDITOR`: **Pilot User**. Full working-layer write access (Client Twin, findings, opportunities, future state, collaboration, saved work), but no direct canonical-foundation mutation.
- `VIEWER`: read-only workspace access.
- Canonical Atlas/Core/domain-pack content remains release-published static knowledge; there is no client API that writes it.

## Foundation change boundary

Pilot discoveries can enter `atlas_foundation_change_proposals` only as `PENDING_ADMIN_REVIEW`.
Only OWNER/ADMIN may move a proposal to research/publication-gate approval or reject it.
Even `APPROVED_FOR_PUBLICATION_GATE` does **not** modify Atlas knowledge; the existing schema/source/regression/human publication gates still apply.

## Corrected ephemeral document architecture

Pilot defaults:

- `ATLAS_EPHEMERAL_DOCUMENTS=true`
- `ATLAS_EPHEMERAL_DOCUMENT_LLM=true`
- `ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM=true`
- `ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS=gemini`
- `ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=false` until an administrator explicitly verifies the provider/account posture.

The flow is:

`Upload -> request-memory extraction -> approved LLM structuring -> deterministic Atlas ID/rule validation -> candidate facts -> consultant review`

This deliberately uses the LLM where it is valuable: unstructured client language. Deterministic logic remains responsible for validating whether model-returned Atlas IDs actually exist and whether later canvas/configuration actions are valid.

When LLM structuring is required, the endpoint fails closed if the provider is missing, unapproved, or outside the allow-list. **There is no silent keyword-matching fallback.**

## Application non-retention

The session ingestion endpoint deliberately performs:

- no private Storage write;
- no `atlas_client_documents` row;
- no `atlas_document_chunks` row;
- no `atlas_candidate_facts` row;
- no embedding/vector write;
- no document-derived server cache;
- `Cache-Control: no-store` on the response.

The browser holds candidate facts only in memory and clears them on `pagehide`.

### Explicit confirmation

A consultant may explicitly confirm one normalized candidate into the Client Twin. The persisted record contains the normalized statement and a `CONSULTANT_CONFIRMATION` evidence marker only. It does **not** persist the original file, filename, evidence quote, document locator or document reference.

This distinguishes **source retention** from **consultant-confirmed work product**.

## Gemini request boundary

For the approved Gemini pilot path, the gateway uses the stateless `generateContent` API, sends the API key in the `x-goog-api-key` header rather than the URL, and sets request-level `store=false`.

Application-side non-retention does not claim that Google or any other provider has zero internal abuse/security retention. Provider data-use, abuse-monitoring and contractual posture remain a separate approval item before confidential production use.
