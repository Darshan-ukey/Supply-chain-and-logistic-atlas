# Stage 18 — Ask Atlas Production Orchestration

## Boundary

`User text/click → retrieval → evidence bundle → LLM interpretation (optional) → citation validation → command validation → user-approved/automatic deterministic CanvasCommand → canvas`

The LLM never mutates Atlas data and never directly manipulates the DOM.

## Retrieval
- Canonical Page 0 / module data is loaded server-side.
- Active canvas state boosts relevant A5/process evidence.
- Coverage Registry evidence is retrieved for unpublished modes.
- Client evidence is retrieved only when an authenticated workspace ID is supplied and Supabase RLS returns that tenant's state.
- Reference and client evidence classes remain distinct.

## Generation
The provider gateway is server-only and supports Gemini, OpenAI-compatible/OpenAI, or Anthropic through environment configuration. If no provider credential exists, Ask Atlas remains usable through a deterministic evidence + command fallback.

## Evidence contract
The model receives numbered evidence IDs. Returned citation IDs are intersected with the retrieved evidence set before the response reaches the browser. Unrecognized citation IDs are discarded.

## Command contract
The model may propose only commands defined in `governance/canvas-command-contract-v1.json`. The API validates structural IDs and publication depth. The browser executes through deterministic Stage 1–16 functions; unsupported commands are rejected.

## Client boundary
Client-specific facts are never sent to the model unless the request includes an authenticated workspace and RLS authorizes that workspace. No browser-side service key or LLM key exists.
