# Production Observability

## Liveness
`GET /api/health`
- no external dependency;
- should return 200 if the function runtime is alive.

## Readiness
`GET /api/readiness`
- validates release configuration;
- probes Supabase Auth settings with the publishable key;
- returns 503 when the target dependency/configuration is unavailable.

## Release identity
`GET /api/version`
- release ID;
- channel;
- Vercel environment;
- commit SHA when available;
- Node runtime.

## Canonical integrity
`GET /api/release-integrity`
- compares frozen Enterprise Core / SCM critical artifacts with the Stage-21 baseline;
- any mismatch without an explicitly governed knowledge release blocks promotion.

## Application signals
Watch:
- 5xx count/rate by route;
- 401/403 spikes;
- Ask Atlas provider failures vs deterministic fallback;
- document ingestion failures/quarantines;
- export failures;
- collaboration write failures;
- Supabase latency/timeouts;
- browser runtime error clusters.

## Privacy
Product telemetry remains metadata-only under the Stage-21 allow-list. Do not send question text, document content, comments, client names or evidence to observability/analytics payloads.
