# Stage 19 — Client Document / RFP / SOP Ingestion

## Objective
Turn client-provided material into reviewable, provenance-preserving candidate knowledge without allowing documents or the LLM to redefine the Atlas or silently become Client Twin truth.

## Pipeline

```text
Authenticated client workspace
        ↓
Private document upload
        ↓
Technical validation / readable-text extraction
        ↓
Garbage / unsupported / low-relevance classification
        ↓
Accepted content → workspace-scoped chunks
        ↓
Candidate fact extraction
  deterministic Atlas match
  + optional provider-assisted extraction
        ↓
Canonical mapping candidate
        ↓
CONSULTANT REVIEW GATE
   Confirm | Reject
        ↓ only after Confirm
Client Twin evidence + confirmed document fact
```

## Epistemic states
- **Document**: client-provided evidence artifact.
- **Candidate fact**: extracted assertion; never considered true merely because it appears in a document.
- **Confirmed document fact**: candidate explicitly confirmed by an authenticated consultant.
- **Atlas reference**: governed global knowledge; documents cannot mutate it.

## Rejection / quarantine rules
- Empty or structurally unreadable extraction → `REJECTED / GARBAGE`.
- Unsupported extraction (for example image-only content in this stage) → `REVIEW_REQUIRED / UNSUPPORTED_EXTRACTION`.
- Readable content with weak Atlas/domain relevance → `REVIEW_REQUIRED / LOW_RELEVANCE` and no candidate extraction until a consultant accepts relevance.
- Consultant may explicitly reject low-relevance material as `IRRELEVANT`.
- Technical/security rejection cannot be manually promoted.

## Extraction support
- UTF-8 text, Markdown, CSV, JSON: native.
- PDF: `pdf-parse` runtime dependency.
- DOCX / PPTX: OOXML text extraction through `jszip`.
- XLSX: workbook-to-text extraction through `xlsx`.
- PNG / JPEG / WebP: stored privately but not OCR'd in Stage 19; manual review/evidence annotation is required.

## LLM boundary
Provider-assisted extraction is optional. If configured, the model receives only document excerpts and a bounded list of canonical Atlas process IDs. It must return exact evidence quotes and candidate mappings. Invalid process IDs are discarded. If no provider is configured or the call fails, deterministic Atlas phrase matching is used.

Unconfirmed candidate facts are never included in Ask Atlas retrieval. Only explicitly confirmed document facts are eligible for client-grounded retrieval.

## Current upload limit
The inline serverless ingestion endpoint is capped at 3 MB to avoid serverless request-body limits. The private Storage bucket supports up to 25 MB. Larger production documents should use a signed/direct-upload worker while preserving the same tables and review gate.
