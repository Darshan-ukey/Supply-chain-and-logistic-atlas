import type {
  CapabilityAdapter,
  CompilationDiagnostic,
  EvidenceGraph,
  LoweredPlan,
  WorkflowPlan,
} from './compiler-types.js';
import { validateWorkflowInvariants } from './semantic-compiler.js';
import type { ApiCleanupStep, DiscoveryResult, ScenarioPlan, TestPlan } from './types.js';

export class WorkflowLoweringValidationError extends Error {
  readonly code = 'WORKFLOW_VALIDATION_FAILED' as const;
  readonly diagnostics: readonly CompilationDiagnostic[];

  constructor(diagnostics: readonly CompilationDiagnostic[]) {
    super(`Workflow validation failed before lowering: ${diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('; ')}`);
    this.name = 'WorkflowLoweringValidationError';
    this.diagnostics = diagnostics;
  }
}

export class WorkflowLowerer {
  private readonly adapters: ReadonlyMap<string, CapabilityAdapter>;

  constructor(adapters: readonly CapabilityAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  async lower(params: {
    readonly workflow: WorkflowPlan;
    readonly evidence: EvidenceGraph;
  }): Promise<LoweredPlan> {
    const validationDiagnostics = validateWorkflowInvariants(params.workflow, params.evidence);
    if (validationDiagnostics.length > 0) {
      throw new WorkflowLoweringValidationError(validationDiagnostics);
    }
    const operations = new Map(params.evidence.operations.map((operation) => [operation.id, operation]));
    const scenarios: ScenarioPlan[] = [];
    const loweredByStep = new Map<string, readonly string[]>();

    for (const workflowScenario of params.workflow.scenarios) {
      const cleanupBySourceStep = await this.lowerCleanupBySourceStep(workflowScenario, params.workflow, operations);
      for (const step of workflowScenario.steps) {
        const operation = operations.get(step.operationId);
        if (operation === undefined) throw new Error(`Workflow references unknown evidence operation "${step.operationId}".`);
        const adapter = this.adapters.get(step.adapterId);
        if (adapter === undefined) throw new Error(`No capability adapter "${step.adapterId}" is registered.`);
        if (!adapter.capabilities.includes(step.capability)) {
          throw new Error(`Capability adapter "${adapter.id}" does not declare capability "${step.capability}".`);
        }
        const bindingIssues = adapter.validateBinding?.(operation) ?? [];
        if (bindingIssues.length > 0) {
          throw new Error(`Capability adapter "${adapter.id}" rejected operation "${operation.id}": ${bindingIssues.join('; ')}`);
        }
        if (workflowScenario.cleanupStepIds.includes(step.id) && adapter.lowerCleanup !== undefined) {
          continue;
        }
        const lowered = await adapter.lower({
          workflow: params.workflow,
          scenario: workflowScenario,
          step,
          operation,
        });
        if (lowered.length === 0) throw new Error(`Capability adapter "${adapter.id}" lowered step "${step.id}" to no executable scenarios.`);

        const scenarioIds: string[] = [];
        for (const [index, scenario] of lowered.entries()) {
          const id = `compiled_${safeId(workflowScenario.id)}_${safeId(step.id)}_${index + 1}`;
          const dependencyScenarioIds = step.dependsOn.flatMap((dependency) => loweredByStep.get(dependency) ?? []);
          const priorScenarioId = scenarioIds.at(-1);
          const dependsOn = [...new Set([
            ...dependencyScenarioIds,
            ...(priorScenarioId === undefined ? [] : [priorScenarioId]),
            ...(scenario.dependsOn ?? []),
          ])];
          const cleanup = cleanupBySourceStep.get(step.id) ?? [];
          scenarios.push({
            ...scenario,
            id,
            ...(cleanup.length > 0 ? { cleanup: [...(scenario.cleanup ?? []), ...cleanup] } : {}),
            ...(dependsOn.length > 0 ? { dependsOn } : {}),
            metadata: {
              ...scenario.metadata,
              generatedBy: 'universal-semantic-compiler',
              intentScenarioId: workflowScenario.intentScenarioId,
              intentScenarioName: workflowScenario.name,
              intentScenarioObjective: workflowScenario.objective,
              workflowScenarioId: workflowScenario.id,
              workflowStepId: step.id,
              operationId: operation.id,
              evidenceRevision: params.workflow.evidenceRevision,
              workflowPhase: step.phase,
            },
          });
          scenarioIds.push(id);
        }
        loweredByStep.set(step.id, scenarioIds);
      }
    }

    return {
      schemaVersion: 'brisk-aitesting.lowered-plan.v1',
      scenarios,
      engineTypes: [...new Set(scenarios.map((scenario) => scenario.type))],
    };
  }

  private async lowerCleanupBySourceStep(
    scenario: WorkflowPlan['scenarios'][number],
    workflow: WorkflowPlan,
    operations: ReadonlyMap<string, EvidenceGraph['operations'][number]>,
  ): Promise<ReadonlyMap<string, readonly ApiCleanupStep[]>> {
    const cleanupBySource = new Map<string, ApiCleanupStep[]>();
    for (const cleanupStepId of scenario.cleanupStepIds) {
      const step = scenario.steps.find((candidate) => candidate.id === cleanupStepId);
      if (step === undefined) throw new Error(`Workflow cleanup step "${cleanupStepId}" does not exist.`);
      const operation = operations.get(step.operationId);
      if (operation === undefined) throw new Error(`Workflow cleanup step "${cleanupStepId}" references unknown operation "${step.operationId}".`);
      const adapter = this.adapters.get(step.adapterId);
      if (adapter?.lowerCleanup === undefined) continue;
      const sourceStep = scenario.steps.find((candidate) => (
        candidate.id !== step.id
        && operations.get(candidate.operationId)?.cleanupOperationId === operation.id
        && step.dependsOn.includes(candidate.id)
      ));
      if (sourceStep === undefined) throw new Error(`Workflow cleanup step "${cleanupStepId}" has no matching resource-producing source step.`);
      const lowered = await adapter.lowerCleanup({ workflow, scenario, step, operation });
      const existing = cleanupBySource.get(sourceStep.id) ?? [];
      cleanupBySource.set(sourceStep.id, [...existing, lowered]);
    }
    return cleanupBySource;
  }
}

export function loweredWorkflowToTestPlan(params: {
  readonly runId: string;
  readonly goal: string;
  readonly workflow: WorkflowPlan;
  readonly lowered: LoweredPlan;
  readonly discovery: DiscoveryResult;
  readonly warnings?: readonly string[];
  readonly droppedScenarios?: TestPlan['droppedScenarios'];
  readonly evidenceDecisions?: TestPlan['evidenceDecisions'];
  readonly fixtureProvisioning?: TestPlan['fixtureProvisioning'];
  readonly requested?: number;
}): TestPlan {
  // One requested check compiles into several executable steps. Both numbers
  // are reported so a host shows the user's count, not the machinery's count.
  const checkIds = new Set(params.lowered.scenarios
    .map((scenario) => scenario.metadata?.intentScenarioId)
    .filter((id): id is string => typeof id === 'string'));
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: params.runId,
    goal: params.goal,
    mode: 'automatic',
    scenarios: params.lowered.scenarios,
    discovery: params.discovery,
    warnings: params.warnings ?? [],
    ...(params.droppedScenarios === undefined || params.droppedScenarios.length === 0 ? {} : { droppedScenarios: params.droppedScenarios }),
    ...(params.evidenceDecisions === undefined ? {} : { evidenceDecisions: params.evidenceDecisions }),
    ...(params.fixtureProvisioning === undefined || params.fixtureProvisioning.length === 0 ? {} : { fixtureProvisioning: params.fixtureProvisioning }),
    createdAt: params.workflow.createdAt,
    counts: {
      ...(params.requested === undefined ? {} : { requested: params.requested }),
      checks: checkIds.size > 0 ? checkIds.size : params.lowered.scenarios.length,
      executableSteps: params.lowered.scenarios.length,
    },
  };
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}
