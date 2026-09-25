# brisk-aitesting examples

These examples show the normal ways teams embed brisk-aitesting.

The rule is simple: your app gives Brisk configuration and a goal, Brisk returns one stable result object. You decide where to store it, how to show it, and how strict your release gates should be.

## Start here

1. `brisk-aitesting.config.ts` shows the normal minimal host object with inferred types and safe defaults.
2. `host-config-bridge.ts` shows the advanced compatibility mapper for an existing SaaS that intentionally needs full control.
3. `sdk-basic.ts` shows the local SDK path.
4. `cli-basic.md` shows the CLI path.

## What each example proves

| Example | What it demonstrates |
| --- | --- |
| `sdk-basic.ts` | Run Brisk from application code and consume the stable result. |
| `cli-basic.md` | Run Brisk from a shell or CI job. |
| `openapi-api-generation.ts` | Ask for API tests with an OpenAPI contract in the loop. |
| `ui-grounded-flow.ts` | Ask for a UI flow while requiring observed UI evidence. |
| `schema-fuzzing.ts` | Generate schema checks from contracts without opening a browser. |
| `replay-http.ts` | Replay known HTTP calls as fast regression checks. |
| `live-message-flow.ts` | Publish and verify a message through HTTP-backed test hooks. |
| `pact-message.ts` | Verify Pact message contracts when Pact files are available. |
| `schemathesis-adapter.ts` | Route OpenAPI fuzzing to Schemathesis when Python tooling is installed. |
| `specmatic-adapter.ts` | Route contract checks to Specmatic when Java tooling is installed. |
| `custom-engine.ts` | Add a private engine and prove it returns the Brisk result shape. |
| `custom-ai-provider.ts` | Plug in any AI provider behind the planning interface. |
| `ci-github-actions.yml` | Run Brisk in GitHub Actions. |
