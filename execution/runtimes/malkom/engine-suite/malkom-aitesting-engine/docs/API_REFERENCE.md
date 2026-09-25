# API Reference

This is the public SDK surface most host apps need.

## defineHostConfig

This is the recommended host entry point. It supplies safe defaults and reads
missing optional values from documented `BRISK_AITESTING_*` settings.

```ts
import { createBriskAiTesting, defineHostConfig } from 'brisk-aitesting';

const config = await defineHostConfig({
  app: {
    name: 'My application',
    baseUrl: 'http://localhost:3000',
  },
});

const tester = createBriskAiTesting(config);
```

Calling `await defineHostConfig()` with no object is the environment-only SDK
path. Config files may export the returned promise directly because
`loadConfig` and the CLI await it.

## createBriskAiTesting

```ts
import { createBriskAiTesting } from 'brisk-aitesting';

const tester = createBriskAiTesting(config);
const result = await tester.run({
  goal: 'Test login, dashboard, API contracts, and permissions',
  scenarios: 10,
  scenarioCountPolicy: 'exact',
  mode: 'automatic',
});
```

## defineConfigFromHost (Advanced)

Use this only when an existing product intentionally needs a custom type and
full mapping control. Normal hosts should use `defineHostConfig`.

```ts
import { createBriskAiTesting, defineConfigFromHost } from 'brisk-aitesting';

const config = defineConfigFromHost(hostDefinition, (host) => ({
  app: {
    name: host.app.name,
    baseUrl: host.app.baseUrl,
    repoPath: host.app.repoPath,
  },
  auth: host.accessToken !== undefined
    ? { type: 'bearer', token: host.accessToken }
    : { type: 'none' },
  aiProvider: host.aiProvider,
  runtime: {
    artifactsDir: '.brisk-aitesting/artifacts',
    timeoutMs: host.run.timeoutMs,
    retries: 0,
    headless: true,
    dryRun: host.run.previewOnly,
  },
}));

const tester = createBriskAiTesting(config);
```

The function calls the supplied mapper and returns its result. It does not
discover host configuration or operations, obtain authentication, select an AI
provider, or authorize execution automatically. `createBriskAiTesting`
normalizes and validates the returned configuration.

The host owns the input type. Keep provider choice dynamic, pass only the
information testing needs, and provide authoritative operation evidence before
allowing AI-planned actions to execute. See the complete
[Host Integration Guide](HOST_INTEGRATION.md).

## Run Input

| Field | Type | Meaning |
|:------|:-----|:--------|
| `goal` | `string` | What should be tested |
| `scenarios` | `number` | Scenario count requested by the host app |
| `scenarioCountPolicy` | `exact`, `at-least`, `at-most`, `flexible` | Whether the requested count is a hard contract or guidance |
| `mode` | `automatic`, `ui`, `api`, `contract`, `schema`, `replay`, `message`, `custom` | How scenarios should be routed |
| `requiredTypes` | array | Force at least one scenario of a type |
| `uiActionFeedback` | `off`, `when-missing`, `always` | Whether UI actions should be grounded before execution |
| `evidenceGraph` | `EvidenceGraph` | Optional host-owned authoritative capabilities for this run |
| `metadata` | object | Host-owned metadata |

## Result

Every run returns `brisk-aitesting.result.v1`.

Important fields:

| Field | Meaning |
|:------|:--------|
| `runId` | Unique run id |
| `status` | Overall status |
| `summary` | Totals, pass rate, duration |
| `discovery` | What Brisk found |
| `plan` | The checked scenario plan |
| `tests` | Scenario-level results |
| `operations` | Engine and cleanup operations retained beneath logical compiled tests |
| `artifacts` | Evidence files |
| `diagnosis` | Failure reasons and next checks |
| `handover` | How host apps can store or consume the result |

## Plan Contract Gate

Every executable plan must match `brisk-aitesting.plan.v1`.

```ts
import { planJsonSchema, validatePlanJsonContract } from 'brisk-aitesting';

const issues = validatePlanJsonContract(candidatePlan);
if (issues.length > 0) {
  // Show these issues to the user or send them back to the planner for repair.
}
```

Use `planJsonSchema` when a host app wants to validate plans with its own JSON Schema tooling. Use `validatePlanJsonContract` when it wants the same issue shape Brisk uses internally.

## Semantic Compiler

When `aiProvider` is configured, `createBriskAiTesting` uses `SemanticPlanner` by default. The provider returns `brisk-aitesting.intent.v1`; executable details are selected from capability evidence.

```ts
import {
  createBriskAiTesting,
  createHttpEvidenceGraph,
  HostHttpCapabilityAdapter,
} from 'brisk-aitesting';

const evidenceGraph = createHttpEvidenceGraph([{
  operationId: 'createProject',
  method: 'POST',
  path: '/api/projects',
  name: 'Create project',
  action: 'create',
  resource: 'project',
  sideEffect: 'create',
  authority: 'host',
  source: 'host project route registry',
  inputs: [
    { id: 'name', name: 'name', semanticType: 'project.name', required: true, location: 'body' },
  ],
  outputs: [
    { id: 'projectId', name: 'projectId', semanticType: 'project.id', from: 'response.body', path: '$.id' },
  ],
  successStatuses: [201],
}]);

const tester = createBriskAiTesting({
  ...config,
  capabilityAdapters: [new HostHttpCapabilityAdapter()],
});

await tester.run({ goal: 'Create a project', evidenceGraph });
```

OpenAPI evidence is collected automatically when `contracts.openApiPath` is configured. Host contracts are appropriate when executable operations are authoritative in host code rather than OpenAPI.

Lower-level exports include `AiIntentPlanner`, `SemanticPlanner`, `UniversalSemanticCompiler`, `WorkflowLowerer`, `OpenApiCapabilityAdapter`, `HostHttpCapabilityAdapter`, `createEvidenceGraph`, `mergeEvidenceGraphs`, `resolveEvidenceConflicts`, `evidenceConflictScope`, and `createHttpEvidenceGraph`.

Compiler-produced `WorkflowScenario.valueFlow` uses
`brisk-aitesting.value-flow.v1`. Public types include `WorkflowValueFlowV1`,
`WorkflowValueRecordV1`, `WorkflowValueConsumer`, `WorkflowValueConversion`, and
`EvidenceValueConversion`. The record is metadata-only: inspect it to explain
where a value came from and where it is used, but never use it as runtime value
storage. See [TYPED_VALUE_FLOW.md](TYPED_VALUE_FLOW.md).

Compiler workflows also expose a deterministic `id` and one
`WorkflowSelectionDecisionV1` per step. `WorkflowStep.phase` is `setup`, `test`,
`verification`, or `cleanup`; unspecified intent actions become `test`.
`deterministicWorkflowId` and `selectionDecisionsForWorkflow` are public for
hosts that combine compiler-produced scenarios. See
[OPERATION_LIFECYCLE.md](OPERATION_LIFECYCLE.md).

Compiler workflows expose one `WorkflowCleanupSafetyRecordV1` for each cleanup.
It ties the cleanup to the exact resource-producing step, required captured
values, cleanup dependencies, accepted outcomes, evidence revision, provenance,
and cleanup-only recovery rule. `cleanupSafetyRecordsForWorkflow` is public for
hosts that combine compiler-produced scenarios. See
[CLEANUP_AND_RECOVERY.md](CLEANUP_AND_RECOVERY.md).

For automatic cleanup, `WorkflowScenario.cleanupStepIds` is ordered so children
are removed before the resources they depend on. `WorkflowStep.dependsOn` and
`WorkflowCleanupSafetyRecordV1.dependsOnCleanupStepIds` expose the exact reverse
dependency. Independent branches have no invented dependency, and repeated
resources keep separate cleanup records tied to their own producer steps.

`WorkflowLowerer.lower` always calls the shared workflow invariant validator
before any adapter. Invalid or stale workflow/evidence combinations throw
`WorkflowLoweringValidationError`, whose stable `code` is
`WORKFLOW_VALIDATION_FAILED` and whose `diagnostics` explain the rejected facts.
Treat this as a controlled product stop; do not convert it into a failed or
passed application test.

`mergeEvidenceGraphs` uses the default declared authority order. Hosts that need
a different complete order or a reasoned exact-scope override use
`resolveEvidenceConflicts`. A resolved disagreement stays visible in the
returned conflict list. An unresolved disagreement marks the operation as
unavailable to the compiler; risky operations are also listed separately in
`mutationBlockedOperationIds`. See
[EVIDENCE_AUTHORITY.md](EVIDENCE_AUTHORITY.md) for plain definitions, decision
rules, examples, and proof limits.

`compileIntentIncrementally` compiles each logical scenario through
`UniversalSemanticCompiler` and can reuse previous scenario results when given
an affected-scenario list. `affectedScenarioIdsForEvidenceChange` calculates
that list from requirements and changed evidence using the compiler's actual
candidate rule. Normal applications should continue using `SemanticPlanner`,
which performs this loop automatically.

Successful semantic plans expose optional `evidenceDecisions`. An unsuccessful
plan exposes the same versioned records on `SemanticCompilationError`. Each
record explains what information was requested, which scenarios were rebuilt
or preserved, which providers were tried, evidence before/after, conflicts, and
why the loop continued or stopped. See
[INCREMENTAL_RECOMPILATION.md](INCREMENTAL_RECOMPILATION.md).

## Evidence providers

`EvidenceProviderV2` lets a host obtain authoritative information after the
compiler identifies a specific gap. Providers declare what they understand;
they do not decide whether an application test passed.

```ts
const provider = {
  id: 'host-contract-source',
  schemaVersion: 'brisk-aitesting.evidence-provider.v2',
  revision: 'host-contract-source-v1',
  execution: 'trusted-in-process',
  supports: (requirement) => requirement.capability === 'api.http',
  async checkFreshness(request, cached, context) {
    return {
      schemaVersion: 'brisk-aitesting.evidence-freshness.v1',
      status: 'fresh',
      checkedAt: new Date().toISOString(),
      reasonCode: 'SOURCE_REVISION_UNCHANGED',
      sourceRevision: 'host-routes-v42',
    };
  },
  async acquire(request, context) {
    // Inspect only approved sources and return the versioned acquisition result.
    // context.signal must stop long-running work when requested.
  },
  async refresh(request, context) {
    // Re-read the authoritative source and return the standard acquisition result.
  },
};

const tester = createBriskAiTesting({
  ...config,
  evidenceProviders: [provider],
});
```

Version 2 receives a reduced context without raw configured passwords, bearer
tokens, AI keys, unrelated run metadata, or custom host functions. A secret is
represented only by an approved reference such as an environment-variable
name. The helper is still reviewed code running inside the Brisk process; this
information reduction is not an operating-system sandbox.

The older `EvidenceProviderV1` full-context contract requires
`security.allowLegacyFullContextEvidenceProviders: true`. It is an explicit
migration path for reviewed code, not the secure default.

For a separately running helper, register `EvidenceWorkerProviderV1` with a
module path, export name, declarative requirement selectors, memory limit,
environment-variable allowlist, and honest host file/network isolation state.
The module implements `EvidenceWorkerModuleV1.acquire`. Brisk contains crashes,
memory exhaustion, cancellation, and infinite-loop timeouts in the child
process. File and network isolation still require the host or container.

Public helpers include `requirementsFromCompilation`,
`acquireEvidenceForCompilation`, `evidenceGraphDigest`, and
`InMemoryEvidenceAcquisitionCache`. Most applications should register providers
through configuration and let `SemanticPlanner` run this flow. See
[EVIDENCE_PROVIDERS.md](EVIDENCE_PROVIDERS.md) for recognition rules, outcome
definitions, safety behaviour, caching, and current limits.

Before enabling a provider, call `runEvidenceProviderConformance` with a safe,
deterministic requirement that the provider must answer. The returned
`brisk-aitesting.evidence-provider-conformance-report.v1` report separates
`passed`, `failed`, and `not-applicable` checks. Optional freshness, refresh,
cancellation, and disposal behavior must be explicitly requested in the case;
an omitted optional probe is never represented as a pass. The full check
definitions, fixture requirements, and proof limits are documented in
[EVIDENCE_PROVIDERS.md](EVIDENCE_PROVIDERS.md#provider-conformance-gate).

## Events

```ts
const unsubscribe = tester.onEvent((event) => {
  console.log(event.type);
});
```

Useful event types:

- `run.started`
- `discovery.completed`
- `plan.created`
- `plan.validated`
- `plan.repair.started`
- `scenario.started`
- `scenario.completed`
- `run.completed`

## Custom Engines

Engines let host teams add coverage outside the built-in UI/API/contract scope.

```ts
const engine = {
  name: 'custom-engine',
  type: 'custom',
  canRun: (scenario) => scenario.type === 'custom',
  run: async (context) => ({
    result: {
      scenarioId: context.scenario.id,
      name: context.scenario.name,
      type: context.scenario.type,
      engine: 'custom-engine',
      status: 'passed',
      durationMs: 1,
      assertions: [{ name: 'custom check passed', status: 'passed' }],
      artifacts: [],
      diagnostics: [],
    },
  }),
};
```

Before trusting a custom engine, run it through `runEnginePluginConformance`.
