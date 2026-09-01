# brisk-aitesting Status

This package is an alpha release. It already runs real checks, but we are still building toward the larger vision.

**Update 2026-08-11.** The core-engine repair pass landed. New since the last
status: created IDs are scoped to the step that created them end to end (the
"never guess between two channel IDs" rule now has a standing regression
proof); blocked tests are reported as blocked, never as failed or skipped;
credentials sign in for real (a run can never silently execute signed out);
every result carries honest check counts (asked / understood / ready / not
ready) and AI usage (calls, tokens, fingerprints, retained redacted answer
records — the evidence the validation gate below requires, which nothing
previously computed). Two fully-instrumented real-AI journeys are kept in
`docs/proofs/`: Directus 12.2.0 (7/7 operations, 0 residue) and the first
Brisk pub-sub journey (8 operations, connected channel→topic→message
workflow, 0 residue), each with dated first-attempt failures recorded.

The current accepted real-AI application baseline against the 300-scenario
gate is still effectively at the start: the two 2026-08-11 journeys above are
the first candidates that carry the required digest/token records, and the
gate's own counting run has not yet been performed over them. Medusa and n8n
remain 0. Real UI, database-behaviour, contract-drift, load, stress, and soak
proof is still 0. See the
[world-class real validation gate](engineering/WORLD_CLASS_REAL_VALIDATION_GATE.md).

The rule is simple: AI can suggest what to test, but Brisk checks the plan before anything runs. Engines do the execution. Evidence records what happened.

## Built

- Strict non-executable AI intent contract: `brisk-aitesting.intent.v1`.
- Evidence graph contract with authority and provenance: `brisk-aitesting.evidence-graph.v1`.
- Protocol-neutral semantic compiler with typed input binding, dependency ordering, mutation authority, ambiguity detection, and cleanup synthesis: `brisk-aitesting.compilation.v1` and `brisk-aitesting.workflow.v1`.
- Adapter lowering with compiler provenance: `brisk-aitesting.lowered-plan.v1`.
- Real OpenAPI capability adapter backed by Swagger Parser and OpenAPI Sampler.
- Typed host HTTP capability adapter for product-specific operations without product-specific compiler rules.
- Logical user scenarios remain one reported test while compiled engine operations are retained as operation evidence.
- Provider-agnostic AI planner adapter.
- AJV-backed public plan contract gate: `brisk-aitesting.plan.v1`.
- Validation and repair loop for AI-generated plans after the public contract gate.
- CLI run workflow with stable exit codes and `brisk-aitesting.cli-result.v1`.
- Cleanup workflow with dry-run/json output: `brisk-aitesting.clean-result.v1`.
- SDK entry point with stable result and handover objects.
- JUnit and HTML report artifacts for every run: `brisk-aitesting.junit-report.v1` and `brisk-aitesting.html-report.v1`.
- OpenAPI JSON/YAML parsing.
- Built-in lightweight OpenAPI schema fuzz engine: `brisk-aitesting.schema-fuzz-evidence.v1`.
- Built-in replay engine for declared HTTP interactions: `brisk-aitesting.replay-evidence.v1`.
- Built-in AsyncAPI message-contract inspection engine: `brisk-aitesting.message-contract-evidence.v1`.
- Built-in live message-flow engine: `brisk-aitesting.live-message-evidence.v1`.
- Optional Pact message adapter: `brisk-aitesting.pact-message-smoke.v1` and `brisk-aitesting.pact-message-evidence.v1`.
- OpenAPI route discovery, schema extraction, generated API scenarios, and response schema validation.
- Implementation-vs-OpenAPI drift report: `brisk-aitesting.contract-drift.v1`.
- Playwright UI execution with grounded locator evidence.
- UI route grounding feedback loop.
- UI healing with fresh page evidence, one retry, and `brisk-aitesting.ui-healing.v1` evidence.
- API rejected-action state proof with before/after snapshots through `expect.unchanged`.
- API, OpenAPI, contract drift, Playwright, UI grounding, UI action, result, handover, CLI, and benchmark schemas.
- Deterministic release check: one command proves the main product paths still work.
- Manual real AI provider check: proves the configured AI provider works in this environment.
- Benchmark report with bad-input, contract drift, schema mismatch, network policy, and CLI failure checks: `brisk-aitesting.benchmark.v1`.
- Release pack check: `brisk-aitesting.pack-check.v1`.
- Adapter manifest: `brisk-aitesting.adapter-manifest.v1`.
- Adapter readiness gate: `brisk-aitesting.adapter-readiness.v1`.
- Built-in engine quality report: `brisk-aitesting.engine-conformance.v1`.
- External engine quality API and health-check report: `brisk-aitesting.plugin-conformance.v1`.
- Non-engine extension quality API and health-check report: `brisk-aitesting.extension-conformance.v1`.
- Optional Schemathesis OpenAPI deep API checker and run report: `brisk-aitesting.schemathesis-smoke.v1`.
- Schemathesis adapter readiness now requires real event evidence, selected operations, successful scenarios, saved artifacts, CI workflow wiring, docs, package inclusion, and plugin quality proof.
- Optional Specmatic contract adapter and run report: `brisk-aitesting.specmatic-smoke.v1` and `brisk-aitesting.specmatic-evidence.v1`.
- Serious SaaS proof app report: `brisk-aitesting.reference-serious-saas.v1`.
- API-only, Todo, multi-tenant, e-commerce, and event/messaging proof app report: `brisk-aitesting.reference-proof-apps.v1`.
- Golden expected-output report: `brisk-aitesting.golden-fixtures.v1`.
- Release readiness check and versioned changelog: `brisk-aitesting.release-readiness.v1`.
- npm package publication path.
- Operational run outcomes separated from application test verdicts through `brisk-aitesting.run-outcome.v1`.
- Append-only run journal, next-invocation recovery of interrupted runs, contained engine failures, observer isolation, cleanup operation reporting, and atomic final result writes.
- Authoritative mutation validation through OpenAPI operations or typed host/runtime operation adapters.
- JSON Schema structured-output requests for compatible AI providers, followed by deterministic contract and semantic validation.

## Partly Built

- The semantic compiler core has deterministic fixtures for REST, GraphQL, messaging, browser accessibility, and a proprietary capability. Only OpenAPI and typed host HTTP currently have real evidence/lowering adapters.
- Automatic cleanup is synthesized and lowered for HTTP workflows. The compiler has focused synthetic proof for reverse dependency chains, independent branches, and two same-type resources; runtime interruption, exactly-once cleanup, every mutation shape, and failure-point proof remain open.
- A `needs-evidence` compilation outcome is stable and non-crashing. Automatic evidence acquisition and affected-scenario recompilation are implemented with synthetic provider proof; real-provider, persisted restart, and broad reference proof remain open.
- Semantic action matching is deterministic but intentionally small; richer adapter-owned vocabularies and ontology matching need broader real-repository proof.
- UI workflow generation is grounded and executable, but complex multi-page journeys still need broader proof coverage.
- OpenAPI scenario generation handles common request/response schemas, but deeper OpenAPI and JSON Schema coverage will keep expanding.
- Contract drift detection compares OpenAPI operations with repo/runtime API routes discovered from supported JavaScript/TypeScript patterns. It now covers direct Express-style routes, nested router prefixes, `router.route(...).get(...)` chains, Nest-style controller/method decorators, and common `:id` versus `{id}` parameter route shapes. Coverage still needs expansion for dynamic route composition, generated routes, and non-JS/TS backend source discovery.
- Analytics exist as structured summaries and benchmark reports, but richer trend analytics are future work.
- Business-intent scenarios can be expressed in goals/objectives/assertions, but reusable rule IDs, rule coverage, and contradiction checks are future work.
- Scenario routing already understands `schema`, `replay`, and `custom` types. Schemathesis covers optional deep OpenAPI checking now. Built-in replay covers declared HTTP interactions.
- Message/event testing can inspect AsyncAPI channel/message contracts, run local live message publish/verify flows, and verify Pact message contracts. Broker-specific adapters are future expansion.
- Interrupted runs are finalized as recovered outcomes on the next invocation. Mid-scenario continuation is intentionally not attempted because repeating an unknown mutation would be unsafe.
- Control-plane errors are contained in the main SDK run path, but exhaustive fault injection across every optional external adapter is still being expanded.

## Not Built Yet

- AI does not execute code.
- AI-generated Playwright code is not accepted.
- AI-generated selectors are not trusted.
- Real provider quality is not compared across multiple AI models yet.
- Broader proof coverage for Specmatic service virtualization across larger apps.
- More enterprise proof apps beyond the current serious-saas, API-only, Todo, multi-tenant, e-commerce, and event/messaging set.
- Guaranteed operation when the process cannot write anywhere or the machine is permanently lost.
- Production GraphQL, browser-accessibility, broker/message, and arbitrary proprietary lowering adapters.
- A truthful guarantee that every possible application can always produce a runnable test. Unsupported or ambiguous intent is returned as a product outcome rather than guessed.

## Next Work

- Add more golden expected outputs for stable plan/result comparison.
- Add source-route discovery adapters for Python, .NET, Go, Java, and generated-route systems.
- Add deeper Specmatic stub/service-virtualization proof cases.
- Add broker-specific message adapters for Kafka, RabbitMQ, and cloud queues when those runtimes are selected.
- Add multi-provider benchmark scoring.
- Add npm publish workflow automation when release governance is ready.
