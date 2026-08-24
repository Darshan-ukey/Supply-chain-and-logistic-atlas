# Stage 19 API Contract

## POST `/api/document-ingest`
Requires authenticated workspace membership.

Input:
- `workspaceId`
- `fileName`
- `mimeType`
- `base64`
- `documentType` (optional)
- `note` (optional)

Output contains document validation state and candidate count. It never returns a confirmed Client Twin mutation.

## GET `/api/documents?workspaceId=...`
Lists workspace-scoped client documents and their validation/ingestion states.

## PATCH `/api/documents`
Explicit relevance review:
- `ACCEPT_RELEVANCE`
- `REJECT_IRRELEVANT`

Accepting relevance may trigger candidate extraction from quarantined chunks but does **not** confirm any candidate fact.

## GET `/api/document-facts?workspaceId=...&documentId=...`
Returns extracted candidate facts for consultant review.

## PATCH `/api/document-facts`
Actions:
- `CONFIRM`
- `REJECT`

`CONFIRM` is the only Stage-19 operation permitted to promote an extracted candidate into client evidence / confirmed document facts. Where the candidate explicitly represents a process fact, the corresponding Client AS-IS mapping may be updated. The action is audit logged.
