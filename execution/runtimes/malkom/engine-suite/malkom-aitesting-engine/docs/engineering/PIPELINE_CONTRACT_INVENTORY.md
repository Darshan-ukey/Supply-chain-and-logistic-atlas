# Universal Pipeline Contract Inventory

Status: living inventory; last corrected by the completion-integrity audit on 2026-08-03  
Requirements: SUR-001, SUR-002, PIP-001, PIP-002  
Authoritative execution knowledge: versioned Evidence Graph

## Product Boundary

The universal pipeline owns the lifecycle from accepted run request through
final handover. SDK, CLI, MCP, embedded hosts, CI, and future UI surfaces call
one application service. A surface may translate transport concerns, but may
not plan, validate, heal, execute, or classify results independently.

## Current Runtime Flow

```text
BriskAiTesting.run
  -> recoverInterruptedRuns
  -> BuiltinDiscoverer.discover
  -> Planner.plan
       -> SemanticPlanner: evidence -> intent -> compile -> lower
       OR BuiltinPlanner: direct executable TestPlan
       OR injected/legacy AiPlanner: AI -> direct executable TestPlan
  -> BuiltinPlanValidator.validate
  -> optional legacy plan repair
  -> optional UI grounding and AI action enrichment
  -> engine selection and execution
  -> cleanup execution
  -> result aggregation and redaction
  -> CI reports and atomic result persistence
  -> handover
```

The semantic branch is the required target architecture. The direct-plan
branches are compatibility/legacy paths and must not remain weaker universal
pipelines.

## Boundary Inventory

| Stage | Current input | Current output | Owner | Current authority | Validation | Recovery/telemetry | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| accepted request | `BriskAiTestingRunInput` | in-memory run state and `run.meta` | orchestrator | explicit user/host input | partial config/input checks | journal start; no common envelope | no versioned run-request contract, policy snapshot, correlation envelope, or cancellation |
| interruption recovery | config and journal files | recovered final result | recovery | append-only local journal | structural parsing only | next-invocation recovery | no pluggable store contract, locking, corruption classification, or safe-operation continuation model |
| application inspection | config, run input | `discovery.v1` | discoverer | config, repo, runtime, contracts | TypeScript shape; partial downstream validation | warnings; coarse timeout | discovery duplicates facts later normalized into evidence and lacks common provenance/timing |
| evidence collection | discovery, host graph, adapters, missing-evidence requirements | `evidence-graph.v1`, acquisition decisions, conflict records | semantic planner/adapters/providers | host, contract, runtime, observed, source, heuristic | provider output limits, freshness, conflict and adapter checks | bounded timeout/cancellation and acquisition decisions; broader stage telemetry partial | real provider-family coverage, persistent cache, automatic host-shutdown disposal, direct in-process isolation, and complete common stage envelope remain open |
| semantic intent | run context and evidence vocabulary | `intent.v1` | AI intent planner or host | user business intent | closed schema and semantic checks | provider usage partial | malformed-response evidence and common retry/provenance envelope incomplete |
| compilation | intent and evidence | `compilation.v1`, optional `workflow.v1` | semantic compiler | evidence graph | deterministic internal checks | structured-but-small diagnostics | no stage envelope, diagnostic severity/category, timings, affected-scope metadata, or acquisition handoff |
| missing evidence | `needs-evidence` diagnostic | scoped provider acquisition and selective recompilation | semantic planner and acquisition service | evidence graph plus provider registry/policy | bounded provider selection, output validation, conflict handling, final workflow validation | structured acquisition/recompilation decisions and safe stop reasons | synthetic/in-memory proof only; persistent restart, large-plan, cross-scenario dependency, distributed/concurrent, real-provider, and reference-app proof remain open |
| lowering | workflow, evidence, adapter | `lowered-plan.v1` and `plan.v1` | workflow lowerer/adapters | workflow plus adapter binding | adapter binding and legacy plan validation | exceptions/timeouts contained later | lowering output split across contracts; no structured lowering diagnostics or cancellation |
| preflight | executable plan and config | `validation.v1` | plan validator | plan plus discovery/config | deterministic plan checks | event emission | preflight is plan-centric, not a versioned proof of evidence freshness, policy, dependencies, auth, cleanup, or resources |
| UI grounding | scenario and live page | `ui-grounding.v1` and artifacts | UI grounder | observed accessibility/DOM evidence | partial action compatibility | event and artifacts | evidence not normalized through provider graph; no common stage envelope/cancellation |
| execution | plan/scenario/config/run state | `ScenarioResult` and artifacts | engine | proven lowered plan, with legacy exceptions | engine-specific | timeout wrapper and event | result has no schemaVersion, correlation/operation IDs, structured observations, attempt metadata, or abort signal |
| drift/healing | engine-specific failure and fresh UI | `ui-healing.v1` evidence | Playwright engine | observed page evidence | one-retry compatibility checks | artifact evidence | no shared drift, equivalence, authorization, revalidation, rollback, or multi-level healing contracts |
| cleanup | accumulated API cleanup steps | cleanup `ScenarioResult` | orchestrator/API engine | lowered plan/runtime state | partial request validation | cleanup journal/issues | cleanup is API-shaped, not protocol-neutral; no cleanup-plan/outcome contract or residual-state model |
| aggregation | tests, operations, issues, artifacts | `result.v1`, `run-outcome.v1` | handover/orchestrator | recorded execution evidence | AJV result validation | redaction and diagnostics | operational statuses omit cancelled/interrupted-recoverable/blocked-external wording; diagnostics not fully structured |
| persistence | result/reports/artifacts | files and artifact refs | handover/journal | local filesystem | atomic final JSON path | persistence issues contained | no versioned storage interface, retention, concurrency, corruption, or partial-artifact contract |
| handover | final result and config | `handover.v1` | handover | final result | AJV | consumer hints | SDK-only shape; no shared surface response envelope or compatibility negotiation |

## Existing Versioned Contracts

| Contract | Producer | Consumer | Disposition |
| --- | --- | --- | --- |
| `brisk-aitesting.intent.v1` | AI intent planner/host | semantic compiler | retain and harden |
| `brisk-aitesting.evidence-graph.v1` | adapters/host | compiler/lowerer | retain and extend through compatible successor if fields become required |
| `brisk-aitesting.compilation.v1` | semantic compiler | planner/application service | retain status semantics; add structured diagnostics/envelope outside or via successor |
| `brisk-aitesting.workflow.v1` | semantic compiler | lowerer | retain and harden immutability/lifecycle metadata |
| `brisk-aitesting.lowered-plan.v1` | lowerer | planner | retain as lowering evidence; stop collapsing it invisibly into legacy plan-only handoff |
| `brisk-aitesting.discovery.v1` | discoverer | planners/validator/result | migrate facts into attributed evidence; retain compatibility projection |
| `brisk-aitesting.plan.v1` | lowerer/legacy planners | validator/engines | retain as engine compatibility IR, not universal planning authority |
| `brisk-aitesting.validation.v1` | plan validator | orchestrator/planner repair | replace or wrap with complete preflight contract |
| `brisk-aitesting.ui-grounding.v1` | UI grounder | UI action enrichment/engine | normalize into observed evidence while retaining artifacts |
| `brisk-aitesting.run-journal-entry.v1` | journal | recovery | retain and evolve behind storage contract |
| `brisk-aitesting.run-outcome.v1` | orchestrator/recovery | result/consumers | requires successor for mandated operational terminal outcomes |
| `brisk-aitesting.result.v1` | handover | SDK/CLI/host/CI | retain with compatibility migration when stage evidence is added |
| `brisk-aitesting.handover.v1` | handover | SDK/host | generalize through shared application-service response |

## Duplicate and Weaker Pipelines

### Direct AI executable planning

Exact path: `src/ai-planner.ts` -> `AiPlanner.plan`/`repair` ->
`brisk-aitesting.plan.v1`.

The AI schema permits executable target, request, expected status, capture, and
cleanup-shaped fields and declares scenario `additionalProperties: true`.
Validation can block unproven targets in strict mode, but this path still asks
AI for executable details and therefore violates the accepted universal
boundary. It must become a deprecated compatibility adapter that converts only
safe semantic information, or be removed in the next breaking version after a
documented migration.

### Deterministic direct executable planning

Exact path: `src/planner.ts` -> `BuiltinPlanner` -> `plan.v1`.

It can emit fallback routes such as `/login`, `/api/me`, and `/api/admin` when
discovery has no evidence. Strict validation can block these targets, but the
planner bypasses Intent IR, Evidence Graph, Workflow IR, and adapter lowering.
Useful deterministic behavior must be moved into a semantic intent provider or
evidenced fixture/provider; fallback executable facts must not survive.

### UI AI action enrichment

Exact path: `AiPlanner.enrichUiActions` after UI grounding.

This path is narrower because it uses observed evidence IDs, but its response
uses generic JSON rather than a closed, versioned enrichment schema. It must be
converted to a versioned semantic proposal and checked against current UI
evidence and expected consequence before lowering.

### Discovery/evidence split authority

`discovery.v1` and `evidence-graph.v1` independently carry route/contract facts.
Discovery must become provider output normalized into the evidence graph. A
compatibility projection may continue populating `TestPlan.discovery` and
`result.discovery` until public contract migration is complete.

## Authoritative Data Sources

| Data | Authority | Non-authoritative uses |
| --- | --- | --- |
| business goal and explicit values | versioned run input from user/host | AI may organize but not change provenance |
| executable operations and outcomes | evidence graph after declared conflict policy | prompts, fallback routes, names, and heuristic similarity may request evidence only |
| evidence authority policy | SDK safety policy plus explicit host authority configuration | adapter implementation order |
| run/task state | approved storage contracts; local append-only journal by default | transport session or in-memory listener state |
| application verdict | reconciled assertion observations | engine completion alone |
| operational outcome | application service after persistence/cleanup classification | application verdict |
| artifacts | artifact store with digest, redaction, and retention metadata | console text |
| surface response | shared application-service result | CLI/MCP-specific re-planning |

## Common Stage Envelope

Every stage input and output will be wrapped by
`brisk-aitesting.stage-envelope.v1` with these required concepts:

- `schemaVersion` and stage-contract version;
- `correlationId`, `runId`, optional logical `scenarioId`, `operationId`,
  `adapterId`, `engineId`, and parent stage ID;
- stage name and attempt number;
- `startedAt`, `completedAt`, and `durationMs` on output;
- evidence revision and immutable provenance references;
- policy/configuration digest with secrets excluded;
- bounded retry and recovery metadata;
- cancellation state and terminal classification;
- structured diagnostics;
- redaction status and artifact references;
- typed stage payload.

The envelope carries cross-cutting metadata. It does not replace the versioned
domain payload contracts.

## Diagnostic Model

Every structured diagnostic requires:

- stable `code`;
- `severity`: `info`, `warning`, or `error`;
- `category`: input, evidence, conflict, planning, compilation, preflight,
  dependency, policy, engine, timeout, cancellation, network, healing, cleanup,
  reporting, persistence, extension, or internal;
- stage and recoverability;
- redacted message and optional safe detail;
- affected scenario/action/operation/evidence references;
- retryability and explicit next action where known;
- cause chain represented without leaking credentials.

Free-form warnings remain presentation fields only and may not drive control
flow.

## Compatibility and Migration Policy

1. Add new contracts beside current public v1 contracts.
2. Adapt the current semantic path into the shared stage runner first.
3. Project new outputs into existing `plan.v1`, `result.v1`, and events during a
   documented compatibility window.
4. Route BuiltinPlanner behavior through semantic intent and evidence.
5. Deprecate direct executable `AiPlanner` input/output with actionable
   migration guidance.
6. Reject unknown fields on new public contracts.
7. Test current and immediately previous supported contract versions.
8. Never silently reinterpret an unsupported version.

## Security and Observability Impact

- The envelope stores digests and secret references, never resolved secrets.
- Diagnostic creation must use the central redaction service.
- Cancellation and maximum timeout are mandatory at every asynchronous stage.
- Observer delivery occurs after authoritative stage recording and is isolated
  from stage execution.
- Trace/metric/log exporters receive bounded, redacted attributes.
- Evidence and artifacts remain tenant/run scoped under storage policy.

## Implementation Order

1. Define shared IDs, stage names, diagnostics, timing, retry, recovery, and
   cancellation types without changing behavior.
2. Add closed schemas and validators.
3. Wrap inspection and semantic planning/compilation/lowering.
4. Add evidence acquisition and incremental recompilation.
5. Add complete preflight.
6. Wrap execution, healing, cleanup, aggregation, persistence, and handover.
7. Add compatibility projections for SDK/CLI and later MCP.
8. Migrate or deprecate weaker planner paths only after equivalent safe
   beginner behavior is proven.
