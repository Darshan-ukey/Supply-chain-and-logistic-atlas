# brisk-aitesting Architecture

This package turns a testing goal into checked plans, runnable tests, and evidence. The simple flow is:

```text
goal -> intent -> evidence graph -> semantic compilation -> workflow -> adapter lowering -> validation -> execution -> evidence -> handover
```

Host apps should not have to care about the moving parts. Developers should still be able to inspect each step when something fails.

## Rules We Do Not Bend

- AI providers do not execute code.
- AI providers do not write executable Playwright scripts for us to run blindly.
- UI selectors are not accepted directly from AI.
- UI actions execute only through `ui_el_*` evidence IDs from `brisk-aitesting.ui-grounding.v1`.
- AI describes intent; it does not choose executable routes, selectors, payload shapes, statuses, captures, or cleanup operations.
- Mutation operations require authoritative contract, host, runtime, or observed evidence.
- Engines run only after deterministic compilation, lowering, and validation succeed.
- Unsupported or ambiguous intent becomes a stable compilation outcome, never guessed execution.
- Every real run must produce evidence artifacts.
- Product configuration uses `BRISK_AITESTING_*` as the primary namespace. Provider-specific env vars are aliases only.
- Host apps own storage. This package returns stable handover JSON and artifact references.

## Pipeline

```text
1. Config
   defineConfig / defineConfigFromHost / loadConfig / loadEnvFiles

2. Discovery
   BuiltinDiscoverer finds UI routes, API routes, contracts, and repo signals.
   JavaScript/TypeScript source discovery covers direct Express-style route calls, nested router prefixes, `router.route(...).get(...)` chains, and Nest-style decorators.

3. Intent Planning
   SemanticPlanner asks an AI provider for `brisk-aitesting.intent.v1`.
   The intent contract contains semantic goals and assertions, not executable targets.
   AiPlanner remains an explicit legacy compatibility path.

4. Evidence And Semantic Compilation
   Capability adapters contribute `brisk-aitesting.evidence-graph.v1`.
   UniversalSemanticCompiler binds typed inputs, resolves dependencies, enforces mutation authority, and emits `brisk-aitesting.compilation.v1`.
   A successful compilation contains `brisk-aitesting.workflow.v1`.

5. Adapter Lowering And Validation
   Capability adapters lower proven workflow operations into `brisk-aitesting.lowered-plan.v1`, whose executable payload is the existing `brisk-aitesting.plan.v1`.
   BuiltinPlanValidator applies the public plan JSON Schema with AJV, then checks executability.
   The compiler does not use prompt repair to invent missing executable facts.

6. Route Grounding Feedback
   Optional `uiActionFeedback` pre-grounds UI routes.
   Planner.enrichUiActions receives real `brisk-aitesting.ui-grounding.v1` evidence.

7. Execution
    BuiltinApiEngine executes API scenarios.
    BuiltinApiEngine validates JSON responses against OpenAPI response schemas when available.
    BuiltinSchemaFuzzEngine sends lightweight malformed OpenAPI requests and records rejection evidence.
    BuiltinReplayEngine reruns declared HTTP interactions and records response evidence.
    BuiltinLiveMessageEngine runs configured local publish/verify message flows and records `brisk-aitesting.live-message-evidence.v1`.
    BuiltinPlaywrightEngine executes UI scenarios and grounded UI actions.
    BuiltinContractEngine parses OpenAPI JSON/YAML contracts and emits operation summaries.

8. Evidence And Handover
   Engines produce schema-versioned evidence artifacts.
   buildResult returns `brisk-aitesting.result.v1` plus `brisk-aitesting.handover.v1`.

8. CLI Boundary
   `brisk-aitesting run --json` returns `brisk-aitesting.cli-result.v1`.
   `brisk-aitesting inspect --json` returns `brisk-aitesting.inspect-result.v1`.
   `brisk-aitesting clean --json` returns `brisk-aitesting.clean-result.v1`.
   Exit codes are stable: 0 passed, 1 completed non-passed, 2 setup/usage error.

9. Benchmark
   `npm run benchmark` emits `brisk-aitesting.benchmark.v1`.
   Benchmark cases intentionally feed bad inputs, broken setups, contract drift, schema mismatches, blocked networks, and CLI errors so regressions are easier to spot.

10. Release Pack Check
   `npm run pack:check` emits `brisk-aitesting.pack-check.v1`.
   Pack check verifies distributable files and blocks secrets, local health-check fixtures, and generated artifacts from the npm tarball.

11. Engine Plugin Conformance
   `runEnginePluginConformance` emits `brisk-aitesting.plugin-conformance.v1`.
   In simple terms: external engines must prove they route correctly, return the right result shape, save evidence, respect timeouts, and avoid obvious secret leaks before Brisk trusts them.
   They must accept only their own scenarios, reject unrelated scenarios, return stable `ScenarioResult` objects, respect runtime timeout, avoid obvious secret leakage, and emit valid artifact shapes.

12. Extension Conformance
   `runExtensionConformance` emits `brisk-aitesting.extension-conformance.v1`.
   It checks custom discoverers, planners, validators, UI grounders, and AI providers before teams trust them.

13. Schemathesis OpenAPI Fuzzing
   `SchemathesisOpenApiFuzzEngine` runs the real Schemathesis CLI for schema scenarios that explicitly ask for the Schemathesis adapter.
   It writes NDJSON, JUnit, HAR, log, and `brisk-aitesting.schemathesis-evidence.v1` artifacts.

14. Specmatic Contract Testing And Mocking
   `SpecmaticContractEngine` runs the real Specmatic CLI for contract scenarios that explicitly ask for the Specmatic adapter.
   It writes command logs, report artifacts, and `brisk-aitesting.specmatic-evidence.v1`.

15. Pact Message Verification
   `PactMessageEngine` runs real Pact message provider verification for message scenarios that explicitly ask for the Pact adapter.
   It writes logs and `brisk-aitesting.pact-message-evidence.v1`.

16. Adapter Readiness
   `adapters/manifest.json` uses `brisk-aitesting.adapter-manifest.v1` to declare adapters that are truly built.
   `npm run smoke:adapter-readiness` emits `brisk-aitesting.adapter-readiness.v1` and checks the adapter like a shipping checklist: source code, exports, docs, package inclusion, CI workflow, proof-app coverage, quality proof, evidence schema, and minimum coverage.
```

## Schema Registry

Stable schema names currently used by the package:

| Schema | Owner | Purpose |
| --- | --- | --- |
| `brisk-aitesting.intent.v1` | intent planner | Non-executable semantic test intent |
| `brisk-aitesting.evidence-graph.v1` | capability adapters | Proven capabilities, typed data slots, outcomes, and provenance |
| `brisk-aitesting.workflow.v1` | semantic compiler | Protocol-neutral dependency graph of proven operations |
| `brisk-aitesting.compilation.v1` | semantic compiler | Success, unsupported, ambiguous, or needs-evidence compilation result |
| `brisk-aitesting.lowered-plan.v1` | adapter lowering | Executable plan plus compiler provenance |
| `brisk-aitesting.plan.v1` | lowering/legacy planner | Structured engine input |
| `brisk-aitesting.validation.v1` | validator | Plan validation result |
| `brisk-aitesting.discovery.v1` | discoverer | Discovered app surface |
| `brisk-aitesting.contract-drift.v1` | discoverer | Implementation-vs-OpenAPI drift report |
| `brisk-aitesting.result.v1` | handover | Full run result |
| `brisk-aitesting.handover.v1` | handover | Host consumption contract |
| `brisk-aitesting.cli-result.v1` | CLI | Machine-readable CLI run summary |
| `brisk-aitesting.inspect-result.v1` | CLI | Machine-readable explanation of a saved run result |
| `brisk-aitesting.clean-result.v1` | CLI | Machine-readable artifact cleanup summary |
| `brisk-aitesting.doctor-result.v1` | CLI | Machine-readable local setup diagnosis |
| `brisk-aitesting.benchmark.v1` | benchmark | Report for bad inputs, contract drift, schema mismatch, network policy, and CLI failure checks |
| `brisk-aitesting.pack-check.v1` | release | npm package tarball verification report |
| `brisk-aitesting.release-readiness.v1` | release | Release script, changelog, and workflow readiness report |
| `brisk-aitesting.adapter-manifest.v1` | adapters | Declares adapters that are built, packaged, documented, and tested |
| `brisk-aitesting.adapter-readiness.v1` | adapters | Machine check that built adapters meet readiness requirements |
| `brisk-aitesting.engine-conformance.v1` | quality checks | Built-in engine behavior report |
| `brisk-aitesting.plugin-conformance.v1` | quality checks | External engine plugin behavior report |
| `brisk-aitesting.plugin-conformance-smoke.v1` | quality checks | Health-check proof that good plugins pass and unsafe plugins fail |
| `brisk-aitesting.extension-conformance.v1` | quality checks | Custom non-engine extension behavior report |
| `brisk-aitesting.extension-conformance-smoke.v1` | quality checks | Health-check proof that good extensions pass and unsafe extensions fail |
| `brisk-aitesting.schemathesis-evidence.v1` | Schemathesis adapter | OpenAPI fuzz execution evidence |
| `brisk-aitesting.schemathesis-smoke.v1` | Schemathesis adapter | Real adapter health-check report |
| `brisk-aitesting.specmatic-evidence.v1` | Specmatic adapter | Contract test/mock execution evidence |
| `brisk-aitesting.specmatic-smoke.v1` | Specmatic adapter | Real adapter health-check report |
| `brisk-aitesting.pact-message-evidence.v1` | Pact adapter | Pact message verification evidence |
| `brisk-aitesting.pact-message-smoke.v1` | Pact adapter | Real Pact message health-check report |
| `brisk-aitesting.reference-serious-saas.v1` | proof app | Serious SaaS proof-app report |
| `brisk-aitesting.reference-proof-apps.v1` | proof apps | API-only, Todo, multi-tenant, e-commerce, and event/messaging proof-app report |
| `brisk-aitesting.golden-fixtures.v1` | expected outputs | Stable scenario/result baseline report |
| `brisk-aitesting.junit-report.v1` | handover | JUnit XML report artifact |
| `brisk-aitesting.html-report.v1` | handover | HTML report artifact |
| `brisk-aitesting.schema-fuzz-evidence.v1` | schema engine | Lightweight OpenAPI malformed-request evidence |
| `brisk-aitesting.replay-evidence.v1` | replay engine | Declared HTTP interaction replay evidence |
| `brisk-aitesting.api-evidence.v1` | API engine | Request/response evidence |
| `brisk-aitesting.message-contract-evidence.v1` | message engine | AsyncAPI channel and message payload evidence |
| `brisk-aitesting.live-message-evidence.v1` | message engine | Local publish/verify message-flow evidence |
| `brisk-aitesting.openapi-summary.v1` | contract engine/discoverer | OpenAPI JSON/YAML operation summary |
| `brisk-aitesting.playwright-evidence.v1` | UI engine | UI execution manifest |
| `brisk-aitesting.ui-grounding.v1` | UI grounder/engine | Real page element evidence |
| `brisk-aitesting.ui-actions.v1` | UI engine | Executed grounded action evidence |
| `brisk-aitesting.ui-healing.v1` | UI engine | Before/after replacement evidence for healed UI actions |

Any new schema must be documented here and covered by automated health checks before we call it stable.

## Extension Points

Host apps and integrators can replace these interfaces:

- `AiPlannerProvider`
- `Planner`
- `CapabilityAdapter`
- `PlanValidator`
- `Discoverer`
- `Engine`
- `UiRouteGrounder`

The orchestrator should stay small. New domain behavior should usually come in through one of these extension points.

## Engine Modules

Built-in engine code is split by responsibility:

| Module | Responsibility |
|:-------|:---------------|
| `src/engines/api.ts` | HTTP execution, response assertions, OpenAPI-backed API checks |
| `src/engines/contract.ts` | OpenAPI/contract parsing checks |
| `src/engines/playwright.ts` | Browser execution and artifact collection |
| `src/engines/playwright-grounder.ts` | Pre-execution UI evidence capture |
| `src/engines/schema-fuzz.ts` | Lightweight malformed-request checks from OpenAPI request schemas |
| `src/engines/replay.ts` | Declared HTTP interaction replay checks |
| `src/engines/live-message.ts` | Local publish/verify message-flow checks |
| `src/engines/shared.ts` | Shared result, artifact, Playwright, API, redaction, and assertion helpers |

`src/engines/builtin.ts` remains a compatibility export file so existing imports keep working.

## UI Grounding Model

The UI flow is intentionally two-step:

```text
route -> grounding evidence -> action enrichment -> grounded action execution
```

`UiElementEvidence` records real page elements with:

- `id`
- role/label/text/test id/CSS fallback
- locator strategy
- confidence

`UiActionPlan` uses only `evidenceId` plus action intent:

```json
{
  "action": "click",
  "evidenceId": "ui_el_003"
}
```

The engine resolves `evidenceId` to captured evidence. If the evidence ID is missing, execution fails without guessing.

## Stability Gates

Before we call a change ready, run:

```bash
npm run typecheck
npm run build
npm run smoke:contracts
npm run smoke:engine-conformance
npm run smoke:plugin-conformance
npm run smoke:extension-conformance
npm run smoke:adapter-readiness
npm run smoke:reference-serious-saas
npm run smoke:reference-proof-apps
npm run smoke:golden-fixtures
npm run smoke:cli
npm run smoke:ai-fixtures
npm run smoke
npm run benchmark
npm run pack:check
```

`npm run smoke:ci` runs the same deterministic release check used by GitHub Actions. It includes package checks and excludes real provider calls.

`npm run smoke:schemathesis` is an optional deep OpenAPI adapter check. It needs Python and the Schemathesis package, then sends many contract-based requests against the serious SaaS proof app.

`smoke:real-ai` needs provider credentials and enterprise CA config when applicable. It proves the configured AI provider works. It does not yet compare quality across models.

## Current Boundaries

Built:

- Provider-agnostic intent planning adapter with strict structured output.
- Protocol-neutral semantic compiler with typed data-flow, dependency, authority, ambiguity, and cleanup invariants.
- Evidence graph merger with authority precedence and conflict detection.
- Real OpenAPI capability adapter and typed host HTTP capability adapter.
- Workflow lowering into the established engine plan contract.
- Plan validation and repair.
- Public AJV-backed plan contract gate through `planJsonSchema` and `validatePlanJsonContract`.
- Route grounding feedback loop.
- Grounded UI action execution.
- OpenAPI JSON/YAML route discovery, schema extraction, generated API scenarios, and response schema validation.
- Built-in lightweight schema fuzz engine for OpenAPI malformed-request checks.
- JavaScript/TypeScript API route discovery for direct routes, nested router prefixes, chained route declarations, Nest-style decorators, and OpenAPI parameter matching.
- Evidence-rich API/UI artifacts.
- Stable result handover for host apps.
- JUnit XML and HTML report artifacts for CI and human review.
- Built-in replay engine for declared HTTP interaction checks.
- Built-in engine quality checks.
- External engine quality API and health-check gate for external `Engine` implementations.
- Non-engine extension quality API and health-check gate for `Discoverer`, `Planner`, `PlanValidator`, `UiRouteGrounder`, and `AiPlannerProvider` implementations.
- Optional Schemathesis OpenAPI deep API checker.
- Serious SaaS proof app.
- API-only, Todo, multi-tenant, e-commerce, and event/messaging proof apps.
- Release readiness automation and versioned changelog.
- Golden expected-output baseline for serious SaaS scenario/result stability.

Still missing:

- Benchmark-level multi-provider scoring.
- Public npm publishing automation.
- Metrics/analytics module.
- Source-route discovery for Python, .NET, Go, Java, generated routes, and complex dynamic route composition.
- Real GraphQL, browser-accessibility, messaging, and proprietary capability adapters. These currently have protocol-neutral compiler fixtures, not production lowering adapters.
- Automatic evidence acquisition and recompilation when compilation returns `needs-evidence`.
