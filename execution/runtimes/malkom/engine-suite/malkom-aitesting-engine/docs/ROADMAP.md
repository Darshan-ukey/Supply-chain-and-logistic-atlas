# brisk-aitesting Roadmap

This roadmap keeps us honest. It separates what works today, what is partly there, and what we still need to build.

## What We Are Building

`brisk-aitesting` is a local AI testing layer that teams can embed into their own products:

```text
discovery -> structured planning -> deterministic validation -> specialised engines -> unified evidence
```

The point is not "AI writes Playwright tests." The point is better than that:

Teams should be able to give Brisk a testing goal, let it inspect the app, get a checked test plan, run the right engines, and receive clean evidence they can use in their own dashboard, CI, or database.

## Rules That Keep It Reliable

- AI output is never directly executed.
- AI returns structured plan JSON.
- Every plan is normalized and validated before execution.
- Engines generate or run the executable work.
- UI actions use observed evidence IDs, not invented selectors.
- Results always follow versioned handover contracts.
- Host apps own storage, dashboards, CI, and observability.
- Custom engines must pass quality checks before we trust them in normal runs.

## Built Today

- Core SDK and CLI.
- Provider-agnostic AI planner adapter.
- Deterministic fallback planner.
- Plan normalization, validation, and repair.
- Repo, UI route, API route, and OpenAPI discovery.
- OpenAPI JSON/YAML parsing.
- Positive and negative API scenario generation from common OpenAPI schemas.
- Runtime API response validation with AJV.
- Built-in Playwright UI engine.
- Built-in API engine.
- Built-in OpenAPI contract engine.
- Built-in lightweight schema fuzz engine.
- Built-in replay engine for declared HTTP interactions.
- Built-in AsyncAPI message-contract inspection engine.
- Built-in live message-flow engine.
- Optional Pact message adapter with smoke gate.
- External engine quality API and automated health gate.
- Non-engine extension quality API and automated health gate.
- Optional Schemathesis OpenAPI deep API checker with readiness manifest and coverage gate.
- Optional Specmatic contract adapter with readiness manifest and smoke gate.
- UI grounding and evidence-ID action execution.
- UI healing with fresh page evidence, one retry, and visible replacement evidence.
- Rejected-action state proof with before/after API snapshots.
- Versioned result and handover JSON.
- Event stream callbacks.
- Artifact collection.
- Deterministic release, bad-input, package, and real-AI gates.
- Adapter readiness gate for built adapters.
- Release readiness automation and versioned changelog.
- Serious SaaS, API-only, Todo, multi-tenant, e-commerce, and event/messaging proof apps.

## Gaps

- Specmatic mock/service virtualization needs broader proof-app coverage.
- No shared business rule catalog yet.

## How We Finish It Properly

### 1. Proof Apps

Create real sample applications that every product change must pass. Think of these as proving grounds: if Brisk works here, users can trust that it handles real product shapes, not only small demos.

- Auth SaaS app
- E-commerce app
- Event/messaging app

Each app should provide:

- source routes
- UI routes
- OpenAPI/AsyncAPI/Pact contracts where relevant
- seed data
- safe test users
- expected result fixtures

### 2. Golden Expected Outputs

For stable inputs, store expected plans and result summaries. In simple words: keep a known-good answer, then compare future answers against it.

When a plan changes, the suite should report:

- scenarios added
- scenarios removed
- assertion strength changed
- engine routing changed
- expected status/body/schema changed

This catches quiet degradation after AI repair or planner changes.

### 3. Extension Quality Checks

Engine and non-engine extension checks are now built. The next work is to add deeper behavior cases as new extension types appear.

Every engine plugin must prove:

- it declares which scenario types it can run
- it rejects unsupported scenarios
- it produces `ScenarioResult`
- it emits artifacts consistently
- it respects runtime timeout/retry/security config
- it never leaks secrets
- it maps failures into diagnostics

Every adapter marked as built must also appear in `adapters/manifest.json` and pass the adapter readiness gate. That means automation checks the shipping basics: code exists, exports exist, docs mention it, the npm package includes it, CI can run it, proof-app coverage exists, quality checks pass, evidence is saved, and minimum coverage is met.

Future non-engine quality checks should define the stable output contract for each extension type.

### 4. Replay Depth

The built-in replay engine can run declared HTTP interactions today. It intentionally stays local, lightweight, and independent of external replay runtimes.

Remaining depth:

- richer response diff artifacts
- multi-step traffic session replay
- captured traffic privacy controls

### 5. Message And Contract Engines

AsyncAPI inspection, local live message-flow checks, and Pact message verification are built. Next depth should be broker-specific adapters only when a real runtime is selected.

- deeper Specmatic mock behavior checks
- Kafka/RabbitMQ/cloud-queue adapters when their local or CI runtime is available

These should remain optional dependencies or separate packages if they add heavy runtime requirements.

### 6. Deeper UI Resilience

The first healing stage is built: stale grounded evidence can trigger fresh page grounding, one retry, and visible replacement evidence.

Next depth: repeated flake analysis, multi-page healing, stricter confidence scoring, and richer before/after reports.

### 7. Business Intent And Rule Governance

Stage 1: scenario carries the business rule.

```text
Given X, when Y, expect Z.
```

Stage 2: AI proposes candidate scenarios from source, docs, existing tests, and copy.

Stage 3: host teams approve reusable rule IDs.

Stage 4: Brisk reports rule coverage and apparent contradictions when rules/scenarios are structured enough to compare.

The product should not claim it can know every critical rule unless the host supplies criteria.

## Early Useful Use Cases

- OpenAPI regression generation.
- Pull-request health checks.
- Internal SaaS testing feature.
- AI-generated application verification.
- Domain-specific testing layers.
- Unified test evidence for analytics.

## Release Quality Target

Before calling the product production-ready, require:

- proof app collection passing on Windows and Linux
- plugin quality suite passing
- golden expected-output diffs reviewed
- real provider check passing
- npm pack check passing
- security tests passing
- failure recovery tests passing
- release notes generated
