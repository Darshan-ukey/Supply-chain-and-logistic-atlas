# Changelog

All notable changes to `brisk-aitesting` are recorded here.

## Unreleased

- Closed the AI-to-compiler seam as a class, not a case list. A new fault matrix (`smoke/run-ai-fault-matrix.mjs`, TCV-0045) poisons one check in every AI-reachable way — wrong operation, ambiguous operation, impossible generate, ghost or later `fromActionId`, incompatible value, missing source, unprovable outcome — against a worst-case AI whose repairs never improve anything, and requires the same outcome every time: clean checks deliver and run, the poisoned check is dropped by name with its reasons, the AI-call budget stays bounded, and an all-poisoned run still refuses honestly. The matrix's first run found and killed one more all-or-nothing gate: a wrong `fromActionId` used to be rejected while reading the AI's answer, making one bad reference fatal to every check; that judgment now belongs solely to the semantic compiler, which refuses it per scenario with a repairable, droppable diagnostic.
- A whole generation can no longer die because one check asked to invent an identifier the application itself creates (REG-0027, production: `NO_GENERATION_RECIPE ... orgId` after 435s with zero scenarios delivered). Four layers changed. The intent writer and repair prompts now carry the selector law — `generate: true` only where the operation input shows `generatedWhenOmitted: true`; app-created identifiers must bind `fromActionId` to the action that creates or lists them (the old prompt actively instructed the opposite for "brand-new" values). A repair that asks to generate an ungeneratable value is refused at apply time, before it can compile, and the refusal reason steers the next attempt. `NO_GENERATION_RECIPE` joined the AI-repairable set so a bad first shot can be walked back. And planning now delivers partial results: checks that still cannot compile after the repair budget are dropped with their exact reasons — structured on the new optional `plan.droppedScenarios` (plan contract updated) and as plain-words warnings — while every compiled check ships; the scenario-count gate accounts delivered plus dropped against the request. `smoke/run-no-generation-recipe-recovery.mjs` (TCV-0044) proves all of it on the production shape.
- Made a sized AI call that comes back with no text a recoverable budget event instead of a dead run. `maxOutputTokensHint` pays only for the visible answer, but deployments that bill hidden reasoning against the same budget can spend a small hint entirely before writing anything — the host then sees an HTTP-success response with empty `message.content`, and one such answer on the very first planning call (the intent outline) killed the whole generation. Every planning call (outline, write, semantic repair) now retries once with the hint absent so the host's full configured budget applies; an outline that still fails falls back to writing the whole request as one piece with a warning instead of failing the run; the outline's floor rose from 1,500 to 3,000 tokens as deliberation headroom; and the built-in provider reports the response evidence (`finish_reason`, completion tokens, hidden-reasoning tokens) as `AI_PROVIDER_EMPTY_RESPONSE` instead of passing silence through. REG-0026 records the production failure; `smoke/run-empty-response-recovery.mjs` proves recovery, fallback, and evidence.
- Rebuilt UI grounding around one shared browser per run. The route grounder no longer spawns a `playwright test` subprocess with a fresh Chromium per scenario: it launches one browser (lazily, launch-raced, disposed by the orchestrator), grounds pages in parallel isolated contexts, and the `Planner` contract gained `enrichUiActionsForScenarios` so every grounded screen is enriched in a single AI call, with automatic fallback to per-scenario `enrichUiActions` for existing planners. Proven end to end against a real browser and real pages (`smoke/perf/real-browser-grounding.mjs`): three pages grounded in parallel in 839ms including the launch, 135ms per warm page, one batched enrichment call. The audit behind this also corrected the performance backtrace: no default planner implements UI-action enrichment, so this cost was latent custom-planner surface, not a default-pipeline cost.
- Added `runtime.browserExecutablePath` (`run.browserExecutablePath`, env `BRISK_AITESTING_BROWSER_EXECUTABLE_PATH`) to launch a system-installed Chromium/Chrome instead of Playwright's downloaded browser — for locked-down CI and air-gapped hosts. Honored by every browser launch in the engine (execution engine and grounder). With it, the full browser-dependent smoke set (engine conformance, reference SaaS, golden fixtures, `smoke`) runs green on a machine that cannot download browsers.
- Sized and labeled every AI call. `AiPlannerProviderRequest` now carries `purpose` (outline, write, JSON repair, semantic repair, plan, plan repair, UI actions) and `maxOutputTokensHint`, sized by the engine from the work actually requested — an outline of 15 checks hints ~1.5k output tokens instead of inheriting a host-wide ceiling, batches and repairs scale with their counts. The built-in provider caps `max_tokens` with the hint; hosts should apply min(own limit, hint). Per-call telemetry (`result.ai.records`) now records purpose, duration, and prompt/response byte sizes — on failed runs too — so "where did the minutes go" is a read-off, not an argument.
- Deduplicated and parallelized planning-time data probes. Distinct method+URL+headers are fetched once, at most four in flight, and every check evaluates its own capture path against the shared answer: fifteen checks reading one collection now cost one request (measured 15 → 1; probe stage 4,569ms → 329ms against a 300ms route).
- Capped the JSON-repair retry prompt. A retry now embeds at most ~48KB of the invalid answer (head and tail with an exact omitted-character marker) instead of up to 200KB, so a retry is no longer strictly slower than the call it replaces.
- Removed every hardcoded vendor and model name from the built-in AI provider path. The one built-in provider value is now `openai-compatible` (a wire-protocol descriptor, not a vendor): vendor-specific default endpoints, vendor API-key environment variables, and vendor-conditional helpers in the real-AI smoke drivers are gone, `ai.endpoint` (or `BRISK_AITESTING_AI_ENDPOINT`) is required, and the generic `BRISK_AITESTING_AI_*` variables are the only configuration surface. Historical engineering records keep their dated statements about which model past proof runs used — those are records of what happened, not configuration.
- Added a generation performance backtrace (`docs/GENERATION_PERFORMANCE_BACKTRACE.md`) with a reusable measurement harness (`smoke/perf/`). Measured: engine construct building is ~0.17s for 15 scenarios; wall time is dominated by serial AI provider waves (2 on the happy path, 2 + repair attempts on failures), the per-UI-scenario Playwright subprocess spawned during grounding, serial un-deduplicated planning-time data probes, and first-click repo discovery. The document ranks thirteen concrete gaps (G1–G13) across engine and host with fix directions.
- Fixed the false `AMBIGUOUS_VALUE_PRODUCER` refusals that killed whole generations when a scenario exposed the same typed value more than once (for example "list organizations" appearing twice, or a synthesized cleanup step binding after a later read echoed the id its source step had used). Three deterministic narrowings now run before refusal, none of which guesses: a synthesized cleanup step mirrors its source step's own bindings; a later same-typed input continues with the one candidate value the scenario already consumed; and repeated identical side-effect-free reads collapse to the earliest step unless a mutating step between them touches the owning resource. Two competing owner-create steps still refuse exactly as documented.
- Made the remaining `AMBIGUOUS_VALUE_PRODUCER` refusal actionable: the diagnostic now reports compilation status `ambiguous` instead of `needs-evidence` (a missing choice cannot be answered by acquiring evidence), names every candidate action (`candidateIntentActionIds` plus the message), and states the exact `values`/`fromActionId` entry that resolves it.
- Fixed the semantic-repair loop silently burning every attempt on unrepairable diagnostics. Cleanup-step diagnostics are now attributed to the source step's real intent action (previously a synthetic `cleanup_*` id no repair could ever match, so applied "repairs" changed nothing); the repair prompt now includes each affected scenario's full ordered action list so `fromActionId` can be copied instead of guessed; and diagnostics that name no existing intent action no longer trigger repair attempts.

- Added producer-fallback fixture sourcing ("ensure-exists"). Under the new opt-in `fixtures: 'provision-when-missing'` policy, a required value with no existing source compiles into a `setup`-phase fixture step from the one host/contract-authority creation operation that declares a working `cleanupOperationId`; cleanup is synthesized, registered before the mutation, and torn down last-in-first-out like every compiled create. Heuristic authority, missing cleanup, non-automatic scenario cleanup, or two eligible producers are typed refusals (`NO_CLEANUP_SAFE_PRODUCER`), never guesses. The default `require-existing` policy changes nothing and never creates business entities.
- Added planning-time emptiness awareness. Every workflow input sourced from a read/list operation's output is probed live after lowering with the exact GET and capture path the runtime would use (read-only, network-policy-bound; unverifiable conditions yield `unverified`, never a guess). An empty collection either recompiles the affected checks onto a provisioned fixture (when the host opted in) or stamps the plan with a plain-words warning before anything executes. Decisions are typed `brisk-aitesting.fixture-provisioning.v1` records on `plan.fixtureProvisioning`, validated by both plan gates.
- Replaced the bare `Missing value for step_x.orgId` runtime failure with an honest precondition diagnosis. When every producing step passed but returned nothing to capture, the failure is `failureCategory: 'precondition'` (new in the result type and result JSON contract), the assertion says what happened ("No org existed to test against: …"), and `diagnosis[]` explains the three fixes: create the data, declare a self-cleaning producer, or enable `provision-when-missing`.
- Added the `fixtures` host switch (`defineHostConfig({ fixtures })`, `BRISK_AITESTING_FIXTURES`, advanced `planning.fixtures`), defaulting to `require-existing` because some hosts must never have tests create business entities even transiently.

## 0.2.0

- Added a pinned Directus 12.2.0, Medusa 2.18.0/PostgreSQL 16, and n8n 2.32.7 real-system lab with isolated readiness, secret, source-integrity, reset-safety, and helper-owned Medusa process proof. The dated proof log records a full 66/66 pass on 2026-08-03 and a later 55/66 regression on 2026-08-05 when the lab was not running; the log's newest entry is always the current state. The change-gate guide makes all three architectures the minimum default for future product-behavior upgrades without presenting readiness as business-scenario support.
- Added a reproducible target-depth inventory and honest coverage-gap guide. The pinned sources contain 54,025 tracked files, 441 statically counted UI route records, and at least 1,261 statically counted HTTP handlers, while current executed business UI scenarios on Directus, Medusa, and n8n remain 0; the guide defines a meaningful 67-check-per-application minimum rather than treating route discovery or shallow visibility checks as behavior proof.
- Replaced the default AI-to-executable-plan path with a non-executable intent boundary (`brisk-aitesting.intent.v1`), authoritative evidence graph, protocol-neutral semantic compiler, workflow IR, and adapter lowering.
- Added deterministic typed input binding, dependency construction, ambiguity detection, mutation authority, outcome selection, capture derivation, and automatic cleanup synthesis.
- Made automatic cleanup follow reverse resource dependencies instead of one global reverse list, kept independent branches independent, and created distinct cleanup steps for multiple resources produced by the same operation.
- Added a shared pre-lowering validation gate that blocks stale, altered, or de-authorized cleanup workflows before any adapter receives them and returns structured `WORKFLOW_VALIDATION_FAILED` diagnostics.
- Added real OpenAPI and typed host HTTP capability adapters, using Swagger Parser and OpenAPI Sampler rather than a new hand-written OpenAPI parser.
- Added real semantic workflow proof for a five-operation channel/topic/subscription/message lifecycle reported as one logical test, plus executed compensation cleanup that leaves no resource behind.
- Added protocol-neutral compiler fixtures for REST, GraphQL, messaging, browser accessibility, and proprietary capabilities. Only OpenAPI and typed host HTTP currently have production evidence/lowering adapters.
- Separated operational run completion (`outcome`) from application test verdicts. Accepted tests now finish as `passed` or `failed`; invalid plans complete with diagnostics and no fabricated test.
- Added an append-only per-run journal, interrupted-run recovery on the next invocation, stage and engine timeouts, observer isolation, engine exception containment, and best-effort completion when reporting or persistence fails.
- Added atomic final result writing. The returned result and successfully persisted `result.json` now describe the same finalized artifact set.
- Moved cleanup out of the test summary, registered mutation compensation before requests execute, continued cleanup after individual cleanup errors, and exposed cleanup under `operations`.
- Added an authoritative mutation gate. Successful mutations require an OpenAPI-backed operation or a typed host/runtime operation adapter; required fields and declared success statuses are checked before execution.
- Added actual JSON Schema structured-output requests for compatible AI providers while retaining deterministic SDK validation as the authority.
- Added result-level plan redaction and structured diagnostic redaction.
- Added an adversarial reliability smoke covering engine exceptions, broken observers, discovery failure, invalid input, journaling, redaction, and saved/returned result identity.
- Removed forced CLI process termination. This fixed the reproduced Windows `UV_HANDLE_CLOSING` crash that could occur after an otherwise successful command with pending HTTP runtime cleanup.
- Removed invented default routes from discovery, added explicit route seeds, raised the configurable source inventory limit from a silent 500-file cutoff to 20,000, and report truncation instead of silently presenting an incomplete large-repository view.

This release establishes the control-plane contract but does not claim literal availability under machine loss or permanently unavailable storage. Broader external-adapter chaos coverage remains in progress.

## 0.1.10

- Added `scenarioCountPolicy` to run input so hosts can make scenario count an exact validation contract instead of a loose planning hint.
- Added validation that rejects too few or too many scenarios when `scenarioCountPolicy` is `exact`.
- Passed exact scenario count rules into AI planning and repair prompts so repaired plans must preserve the requested count.
- Added benchmark coverage for exact scenario count pass, too-low, and too-high cases.

## 0.1.9

- Fixed AI plan normalization so model output can no longer self-certify targets with `sourceOfTruth: "user"`; user provenance is now reserved for host-supplied targets only.
- Updated AI planner prompts to require `observed`, `contract`, or `ai` target provenance and explicitly forbid AI-generated `user` provenance.
- Matched dynamic workflow paths such as `/api/topics/<topicId>/messages` against discovered route patterns such as `/api/topics/:topicId/messages`, while still rejecting wrong routes such as `/api/topics/<topicId>/publish`.
- Added smoke and benchmark coverage for AI-declared user provenance, invented routes, dynamic route proof, and wrong dynamic route suffix rejection.

## 0.1.8

- Added a proven-plan execution gate so AI cannot mark routes as user-supplied unless the host explicitly provides those targets.
- Added dependency blocking: scenarios that need a failed earlier scenario or missing captured value are marked `blocked` instead of running with misleading 404/400 failures.
- Validated scenario dependency order so a test can only depend on earlier scenarios in the same plan.
- Preserved `blocked` in result, diagnosis, JUnit, and HTML reporting contracts.
- Changed config-discovered targets from `user` to `observed`, so host config does not weaken execution proof.
- Added `planning.repairAttempts` so host products can control validation repair without pretending the SDK owns their AI provider/model config.
- Added smoke coverage for fake user provenance, explicit host targets, failed producers, and blocked dependent scenarios.
- Fixed the benchmark CLI success case to use a real OpenAPI-backed route and keep the benchmark honest.
- Added benchmark coverage for host-controlled planning repair configuration.

## 0.1.7

- Blocked AI-derived executable targets by default in strict mode unless the host explicitly opts in.
- Added validation that observed and contract API/UI targets must match discovered routes, including templated contract routes such as `/api/items/{id}`.
- Added full workflow-variable validation before execution so request bodies, query values, headers, expectations, paths, and cleanup steps cannot use uncaptured variables.
- Added built-in workflow values for `<unique>`, `<uuid>`, `<timestamp>`, and `<now>`.
- Changed heuristic workflow capture to opt-in; explicit captures are now the default path.
- Added `brisk-aitesting inspect --result <path>` for readable and JSON inspection of failures, captures, cleanup actions, artifact roots, and UI healing evidence.
- Deepened `doctor` checks for app reachability, OpenAPI parsing, auth page reachability, Playwright browser launch, Java runtime, and optional Specmatic runtime presence.
- Simplified `init` output to a small starter config while keeping strict defaults inside the SDK.
- Improved failure diagnosis for workflow variables, AI-only targets, auth failures, missing routes/resources, request payload mismatches, and UI locator problems.
- Added smoke coverage for AI-only target blocking, unbound workflow variables in request bodies, CLI inspect output, strict route provenance, and discovered-route matching.

## 0.1.6

- Added strict target provenance so executable targets must say whether they are user-supplied, observed, contract-derived, AI-inferred, or fallback/default.
- Blocked fallback/default targets in strict mode unless the host explicitly allows them.
- Added explicit API workflow captures, capture provenance, and cleanup steps in the public plan contract.
- Added cleanup execution after the main scenario run.
- Hardened API artifact redaction for response headers, response bodies, primitive strings, bearer tokens, API-key-shaped strings, emails, and SSNs.
- Made UI healing policy-driven, with safe healing by default and fail-closed behavior for destructive-looking clicks.
- Changed `init` to create a runnable `.mjs` config, added `init --base-url`, and added `doctor`.
- Added JSON/YAML config loading for simpler non-TypeScript setup.
- Added public result and handover JSON schema exports and validation helpers.
- Strengthened smoke coverage for strict AI JSON, explicit workflow captures, secret redaction, and the generated `init -> doctor -> run` path.

## 0.1.5

- Tightened the AI plan gate so successful POST/PUT/PATCH API scenarios must include a request body before execution.
- Rejected low-value generated scenario names such as UUID-only or `ai-e2e-*` names so weak plans must be repaired instead of shown as meaningful tests.
- Corrected `custom` scenarios into API or UI scenarios when the target clearly points to an API path or UI route.
- Added AI fixture coverage for missing mutation bodies, generated names, and `custom` target correction.

## 0.1.4

- Added shared workflow state for engines so API scenarios can carry created IDs into later scenarios.
- Added generic placeholder resolution for API paths and request data, including `<resourceId>`, `:resourceId`, `{resourceId}`, and `<uuid>`.
- Added clear unresolved-variable failures before request execution instead of letting placeholder URLs fail later with misleading 404/400 responses.
- Tightened Playwright UI action execution so fill/select/check/click actions must target compatible page evidence.
- Added engine conformance coverage for a real multi-step API workflow that creates a parent resource and uses its captured ID in the next request.

## 0.1.3

- Fixed npm install weight for host applications by moving heavy adapter runtimes out of install-time dependencies.
- Kept Specmatic and Pact available for `brisk-aitesting` development and adapter validation without forcing every consuming app to download them.
- Clarified npm and pnpm-monorepo installation guidance for backend/runtime packages.

## 0.1.2

- Removed an unsupported replay-service adapter claim from the shipped stack.
- Added Pact message verification, live message-flow evidence, e-commerce proof app, and event/messaging proof app coverage.
- Expanded the benchmark suite to 57 meaningful checks across configuration, OpenAPI, schema generation, AI response handling, plan validation, API execution, replay, security, and CLI behavior.
- Added practical examples for SDK, CLI, OpenAPI API testing, grounded UI flows, schema checks, HTTP replay, message testing, Pact, Schemathesis, Specmatic, custom engines, custom AI providers, and GitHub Actions.
- Tightened package safety checks so examples and proof apps must ship in the npm tarball. (Superseded: the current policy is the opposite — the tarball must NOT contain examples, proof apps, fixtures, or assets; `smoke/run-pack-check.mjs` now enforces the exclusion.)
- Updated documentation status, compatibility notes, and benchmark reporting to match the built product.

## 0.1.1

- Added the local SDK and CLI foundation.
- Added structured AI planning, plan validation, repair, and safe execution boundaries.
- Added built-in Playwright, API, OpenAPI contract, schema fuzz, and replay engines.
- Added OpenAPI JSON/YAML discovery, route discovery for supported JavaScript/TypeScript patterns, and contract drift reporting.
- Added stable result/handover JSON, JUnit reports, HTML reports, and cleanup lifecycle output.
- Added engine/plugin quality gates, adapter readiness checks, serious SaaS proof app, golden fixtures, benchmark checks, and release package safety checks.
- Added optional Schemathesis OpenAPI deep API checker.
