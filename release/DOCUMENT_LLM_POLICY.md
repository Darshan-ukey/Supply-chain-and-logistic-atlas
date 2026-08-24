# Stage 22.1 — Ephemeral LLM Document Structuring Policy

## Corrected document flow

`Upload -> request-memory text extraction -> approved LLM structuring -> deterministic Atlas ID/rule validation -> candidate facts -> consultant review`

The LLM is intentionally used for the part deterministic keyword matching is weakest at: interpreting unstructured RFP/SOP language and turning it into candidate structured facts.

The LLM does **not** become the authority for Atlas validity. Any process ID returned by the model is accepted only if it exists in the currently published domain/module runtime. Candidate facts remain unconfirmed until a consultant explicitly confirms them.

## Application retention boundary

For `ATLAS_EPHEMERAL_DOCUMENTS=true`:

- raw uploaded bytes are request scoped;
- parsed text is request scoped;
- chunks are request scoped;
- no vector store is created;
- no private document object is written;
- no `atlas_client_documents` row is written;
- no `atlas_document_chunks` row is written;
- no unconfirmed `atlas_candidate_facts` row is written;
- the response is marked `Cache-Control: no-store`;
- browser session candidates are cleared on `pagehide`.

An explicitly consultant-confirmed normalized fact may be persisted into the Client Twin, but its original file, filename, excerpt and document locator are intentionally omitted.

## LLM policy

Pilot defaults:

- `ATLAS_EPHEMERAL_DOCUMENT_LLM=true`
- `ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM=true`
- `ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS=gemini`
- `ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED=false` until an administrator explicitly reviews the chosen provider/account.

When LLM structuring is required, the API **fails closed** if the provider is missing, unapproved or outside the allow-list. It does not silently fall back to keyword matching.

For Gemini, the gateway uses the stateless `generateContent` API, sends the API key in the `x-goog-api-key` header rather than the URL, and sets request-level `store=false`.

Application-side non-retention does not claim that the external provider has zero internal abuse/security retention. Provider contractual/data-use settings remain a separate deployment approval item.
