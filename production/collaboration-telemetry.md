# Stage 21 — Collaboration + Product Telemetry

## Purpose

Stage 21 closes two product-operability gaps without changing the Atlas knowledge model or spatial canvas:

1. lightweight client-workspace collaboration;
2. privacy-bounded product telemetry for Atlas usage analytics.

## Collaboration boundary

Collaboration is **client work-state**, not Atlas knowledge.

Supported entity references:

- PROCESS
- FINDING
- OPPORTUNITY
- FUTURE_STATE
- COLLECTION
- DOCUMENT
- CANDIDATE_FACT
- WORKSPACE

Supported actions are intentionally narrow:

- comment;
- resolve comment;
- request validation/evidence/review;
- optional assignment to an existing workspace member;
- complete/cancel review with resolution note.

Stage 21 does not add sprints, tasks, dependencies, due dates, boards or project planning. It is not intended to become Jira.

In production, collaboration records are stored separately from the serialized client-state document to avoid last-write-wins overwrites between concurrent consultants. RLS uses the existing Stage-17 tenant membership predicates. Comment/review mutations are included in the existing audit-event trail.

In standalone/Lab preview, the same UI stores temporary/local review state under the client workspace and clearly labels it **LOCAL REVIEW MODE**.

## Telemetry privacy contract

Telemetry is product metadata, not an evidence store.

The server accepts only a fixed event vocabulary and a strict allow-list of scalar context keys. It explicitly excludes:

- Ask Atlas question text;
- LLM answer text;
- uploaded document text;
- client evidence;
- client/system names;
- collaboration comment text;
- review-request text;
- arbitrary free-form payloads.

Canonical process/object IDs may be recorded as entity keys because they describe product usage rather than client content.

Telemetry is recorded only for authenticated production workspaces. Local/Lab usage remains in an ephemeral browser/session queue and is not uploaded.

## Analytics

Workspace OWNER/ADMIN users can see an aggregate view inside the existing **Atlas Governance & Version Health** drawer. Normal consultant/user chrome does not expose telemetry administration.

The aggregate currently supports:

- event count;
- unique sessions/users;
- Ask Atlas use;
- Trace use;
- Transform entry;
- top event types;
- top modules/views/source classes/commands when populated.

## Database

New Stage-21 tables:

- `atlas_collaboration_comments`
- `atlas_review_requests`
- `atlas_usage_events`

All three have RLS enabled. Collaboration objects are auditable. Telemetry is append-only from the application perspective and is readable only to workspace managers through RLS.

## Non-goals

Stage 21 does not change:

- Enterprise Core Ontology;
- Domain Extension Contract;
- Supply Chain Domain Pack;
- Road LTL V1.2;
- Accounts Payable architecture fixture;
- Stage-19 document ingestion;
- Stage-20 consultant deliverables;
- canvas rendering/semantic zoom/playback/trace logic.
