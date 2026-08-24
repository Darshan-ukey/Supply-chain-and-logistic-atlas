# API surface

Core public/runtime:
- `GET /api/health`
- `GET /api/readiness`
- `GET /api/version`
- `GET /api/release-integrity`
- `GET /api/config`
- `GET /api/llm-status`
- `POST /api/ask-atlas`
- `POST /api/command-validate`
- `POST /api/session-document-ingest`
- `POST /api/transformation-export`

Authenticated work:
- `/api/auth-*`
- `/api/workspaces`
- `/api/client-state`
- `/api/saved-views`
- `/api/session-fact-confirm`
- `/api/collaboration`
- `/api/telemetry`
- `/api/foundation-proposals`
- `/api/pilot-evaluation`
- `/api/audit`
