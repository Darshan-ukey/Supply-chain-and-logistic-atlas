import type {
  CompilationDiagnostic,
  CompilationResult,
  EvidenceGraph,
  FixtureProvisioningRecordV1,
  IntentPlan,
  SemanticCompileOptions,
  WorkflowPlan,
} from './compiler-types.js';
import type { MissingEvidenceRequirementV1 } from './pipeline-stage-contracts.js';
import {
  UniversalSemanticCompiler,
  deterministicWorkflowId,
  evidenceOperationMatchesIntentAction,
  selectionDecisionsForWorkflow,
  cleanupSafetyRecordsForWorkflow,
  validateWorkflowInvariants,
} from './semantic-compiler.js';

export interface ScenarioCompilationEntry {
  readonly scenarioId: string;
  readonly result: CompilationResult;
}

export interface IncrementalCompilationState {
  readonly schemaVersion: 'brisk-aitesting.incremental-compilation-state.v1';
  readonly createdAt: string;
  readonly scenarioCompilations: readonly ScenarioCompilationEntry[];
}

export interface IncrementalCompilationUpdate {
  readonly state: IncrementalCompilationState;
  readonly result: CompilationResult;
  readonly recompiledScenarioIds: readonly string[];
  readonly preservedScenarioIds: readonly string[];
}

export function compileIntentIncrementally(params: {
  readonly intent: IntentPlan;
  readonly evidence: EvidenceGraph;
  readonly previous?: IncrementalCompilationState;
  readonly affectedScenarioIds?: readonly string[];
  readonly compiler?: UniversalSemanticCompiler;
  readonly options?: SemanticCompileOptions;
}): IncrementalCompilationUpdate {
  const compiler = params.compiler ?? new UniversalSemanticCompiler();
  const validIds = new Set(params.intent.scenarios.map((scenario) => scenario.id));
  const requested = params.previous === undefined
    ? validIds
    : new Set(params.affectedScenarioIds ?? validIds);
  for (const id of requested) {
    if (!validIds.has(id)) throw new Error(`Affected scenario "${id}" does not exist in the intent.`);
  }

  const previousById = new Map(params.previous?.scenarioCompilations.map((entry) => [entry.scenarioId, entry.result]) ?? []);
  const scenarioCompilations: ScenarioCompilationEntry[] = [];
  const recompiledScenarioIds: string[] = [];
  const preservedScenarioIds: string[] = [];
  for (const scenario of params.intent.scenarios) {
    const previous = previousById.get(scenario.id);
    if (previous === undefined || requested.has(scenario.id)) {
      const scenarioIntent: IntentPlan = { ...params.intent, scenarios: [scenario] };
      scenarioCompilations.push({ scenarioId: scenario.id, result: compiler.compile(scenarioIntent, params.evidence, params.options) });
      recompiledScenarioIds.push(scenario.id);
    } else {
      scenarioCompilations.push({ scenarioId: scenario.id, result: previous });
      preservedScenarioIds.push(scenario.id);
    }
  }

  const state: IncrementalCompilationState = {
    schemaVersion: 'brisk-aitesting.incremental-compilation-state.v1',
    createdAt: params.previous?.createdAt ?? new Date().toISOString(),
    scenarioCompilations,
  };
  return {
    state,
    result: combineScenarioCompilations(params.intent, params.evidence, state),
    recompiledScenarioIds,
    preservedScenarioIds,
  };
}

export function affectedScenarioIdsForEvidenceChange(params: {
  readonly intent: IntentPlan;
  readonly requirements: readonly MissingEvidenceRequirementV1[];
  readonly before: EvidenceGraph;
  readonly after: EvidenceGraph;
  readonly previous: IncrementalCompilationState;
}): readonly string[] {
  const affected = new Set<string>();
  const beforeById = new Map(params.before.operations.map((operation) => [operation.id, stableJson(operation)]));
  const afterById = new Map(params.after.operations.map((operation) => [operation.id, stableJson(operation)]));
  const operationIds = new Set([...beforeById.keys(), ...afterById.keys()]);
  const changedOperationIds = new Set([...operationIds].filter((id) => beforeById.get(id) !== afterById.get(id)));

  for (const requirement of params.requirements) {
    if (requirement.scenarioId !== undefined
      && requirement.operationId !== undefined
      && changedOperationIds.has(requirement.operationId)) {
      affected.add(requirement.scenarioId);
    }
  }

  for (const entry of params.previous.scenarioCompilations) {
    const referencedIds = new Set([
      ...(entry.result.workflow?.scenarios.flatMap((scenario) => scenario.steps.map((step) => step.operationId)) ?? []),
      ...entry.result.diagnostics.flatMap((diagnostic) => diagnostic.operationIds ?? []),
    ]);
    if ([...referencedIds].some((id) => changedOperationIds.has(id))) affected.add(entry.scenarioId);
  }

  const changedOperations = params.after.operations.filter((operation) => changedOperationIds.has(operation.id));
  for (const scenario of params.intent.scenarios) {
    if (scenario.actions.some((action) => changedOperations.some((operation) => evidenceOperationMatchesIntentAction(action, operation)))) {
      affected.add(scenario.id);
    }
  }

  const unresolvedOperationIds = new Set((params.after.conflicts ?? [])
    .filter((conflict) => conflict.status === 'unresolved')
    .map((conflict) => conflict.operationId));
  for (const entry of params.previous.scenarioCompilations) {
    if (entry.result.workflow?.scenarios.some((scenario) => scenario.steps.some((step) => unresolvedOperationIds.has(step.operationId))) === true) {
      affected.add(entry.scenarioId);
    }
  }
  return params.intent.scenarios.map((scenario) => scenario.id).filter((id) => affected.has(id));
}

function combineScenarioCompilations(
  intent: IntentPlan,
  evidence: EvidenceGraph,
  state: IncrementalCompilationState,
): CompilationResult {
  const diagnostics = state.scenarioCompilations.flatMap((entry) => entry.result.diagnostics);
  const fixtureProvisioning: readonly FixtureProvisioningRecordV1[] = state.scenarioCompilations
    .flatMap((entry) => entry.result.fixtureProvisioning ?? []);
  const withFixtures = fixtureProvisioning.length > 0 ? { fixtureProvisioning } : {};
  const status = combinedStatus(state.scenarioCompilations.map((entry) => entry.result), diagnostics);
  if (status !== 'compiled') return { schemaVersion: 'brisk-aitesting.compilation.v1', status, diagnostics, ...withFixtures };

  const scenarios = state.scenarioCompilations.flatMap((entry) => entry.result.workflow?.scenarios ?? []);
  const workflowContent = {
    schemaVersion: 'brisk-aitesting.workflow.v1',
    evidenceRevision: evidence.revision,
    goal: intent.goal,
    scenarios,
    selectionDecisions: selectionDecisionsForWorkflow(intent, evidence, scenarios),
    cleanupSafetyRecords: cleanupSafetyRecordsForWorkflow(evidence, scenarios),
    createdAt: state.createdAt,
  } as const;
  const workflow: WorkflowPlan = { ...workflowContent, id: deterministicWorkflowId(workflowContent) };
  const invariantDiagnostics = validateWorkflowInvariants(workflow, evidence);
  if (invariantDiagnostics.length > 0) {
    return { schemaVersion: 'brisk-aitesting.compilation.v1', status: 'needs-evidence', diagnostics: invariantDiagnostics, ...withFixtures };
  }
  return { schemaVersion: 'brisk-aitesting.compilation.v1', status: 'compiled', workflow, diagnostics: [], ...withFixtures };
}

function combinedStatus(
  results: readonly CompilationResult[],
  diagnostics: readonly CompilationDiagnostic[],
): CompilationResult['status'] {
  if (diagnostics.length === 0 && results.every((result) => result.status === 'compiled')) return 'compiled';
  if (results.some((result) => result.status === 'ambiguous')) return 'ambiguous';
  if (results.filter((result) => result.status !== 'compiled').every((result) => result.status === 'unsupported')) return 'unsupported';
  return 'needs-evidence';
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}
