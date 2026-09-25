import { createHash } from 'node:crypto';
import { AiIntentPlanner } from './ai-intent-planner.js';
import type {
  CapabilityAdapter,
  CompilationResult,
  EvidenceGraph,
  FixtureProvisioningRecordV1,
  FixtureSourcingPolicy,
  IntentPlan,
  SemanticCompileOptions,
  WorkflowPlan,
} from './compiler-types.js';
import { listSourcedValues, probeListSources, type ListSourceProbeResult } from './fixture-sourcing.js';
import {
  acquireEvidenceForCompilation,
  InMemoryEvidenceAcquisitionCache,
  requirementsFromCompilation,
} from './evidence-acquisition.js';
import {
  DEFAULT_EVIDENCE_AUTHORITY_POLICY,
  evidenceAuthorityPolicyDigest,
  evidenceGraphDigest,
  mergeEvidenceGraphs,
  resolveEvidenceConflicts,
} from './evidence-graph.js';
import {
  affectedScenarioIdsForEvidenceChange,
  compileIntentIncrementally,
} from './incremental-compilation.js';
import { OpenApiCapabilityAdapter } from './openapi-capability-adapter.js';
import { resolveRepairAttempts } from './config.js';
import { DiscoveredUiCapabilityAdapter } from './discovered-ui-capability-adapter.js';
import { UniversalSemanticCompiler, evidenceOperationMatchesIntentAction, findCleanupSafeProducer, fixtureProvisioningRecordId } from './semantic-compiler.js';
import { loweredWorkflowToTestPlan, WorkflowLowerer } from './workflow-lowering.js';
import type {
  AcquisitionRecompilationDecisionV1,
  AiPlannerProvider,
  Planner,
  PlannerContext,
  TestPlan,
} from './types.js';

export class SemanticCompilationError extends Error {
  readonly compilation: CompilationResult;
  readonly evidenceDecisions: readonly AcquisitionRecompilationDecisionV1[];
  /** The checks the request was divided into, so a refusal can still show honest totals. */
  readonly intentScenarios: readonly { readonly id: string; readonly name: string }[];

  constructor(
    compilation: CompilationResult,
    evidenceDecisions: readonly AcquisitionRecompilationDecisionV1[] = [],
    intentScenarios: readonly { readonly id: string; readonly name: string }[] = [],
  ) {
    super(formatCompilationDiagnostics(compilation));
    this.name = 'SemanticCompilationError';
    this.compilation = compilation;
    this.evidenceDecisions = evidenceDecisions;
    this.intentScenarios = intentScenarios;
  }
}

export class SemanticPlanner implements Planner {
  readonly name = 'universal-semantic-planner';
  private readonly intentPlanner: AiIntentPlanner;
  private readonly adapters: readonly CapabilityAdapter[];
  private readonly compiler = new UniversalSemanticCompiler();
  private readonly evidenceCache = new InMemoryEvidenceAcquisitionCache();

  constructor(provider: AiPlannerProvider, adapters: readonly CapabilityAdapter[] = []) {
    this.intentPlanner = new AiIntentPlanner(provider);
    const withOpenApi = adapters.some((adapter) => adapter.id === 'openapi')
      ? adapters
      : [new OpenApiCapabilityAdapter(), ...adapters];
    const configured = withOpenApi.some((adapter) => adapter.id === 'discovered-ui')
      ? withOpenApi
      : [new DiscoveredUiCapabilityAdapter(), ...withOpenApi];
    this.adapters = uniqueAdapters(configured);
  }

  async plan(context: PlannerContext): Promise<TestPlan> {
    const phase = async <T>(stage: string, detail: string, work: () => Promise<T> | T): Promise<T> => {
      const startedAtMs = Date.now();
      context.onPhase?.(stage, detail);
      try {
        return await work();
      } finally {
        context.onTiming?.(stage, Date.now() - startedAtMs, detail);
      }
    };
    const fixturesPolicy: FixtureSourcingPolicy = context.config.planning?.fixtures ?? 'require-existing';
    const compileOptions: SemanticCompileOptions = { fixtures: fixturesPolicy };
    let evidence = await phase('planning.evidence', 'Listing what your app can actually do', () => this.collectEvidence(context));
    let intent = await phase('planning.ai-intent', 'AI is writing the test cases from your description', () => this.intentPlanner.plan(context, evidence));
    let incremental = await phase('planning.compile', 'Turning each test case into exact safe steps', () => compileIntentIncrementally({ intent, evidence, compiler: this.compiler, options: compileOptions }));
    let compilation = incremental.result;
    let compilationState = incremental.state;
    const acquisitionDiagnostics: CompilationResult['diagnostics'][number][] = [];
    let droppedScenarioRecords: { readonly id: string; readonly name: string; readonly reasons: readonly string[] }[] = [];
    const evidenceDecisions: AcquisitionRecompilationDecisionV1[] = [];
    const semanticRepairAttempts = resolveRepairAttempts(context.config.planning?.repairAttempts ?? context.config.ai?.repairAttempts);
    let lastRepairError: string | undefined;
    for (let attempt = 1; compilation.status !== 'compiled' && attempt <= semanticRepairAttempts && hasAiRepairableDiagnostics(intent, compilation); attempt += 1) {
      try {
        // The previous attempt's failure is fed back so a retry is a real
        // correction, never a byte-identical repeat of the same prompt.
        intent = await phase(`planning.ai-repair-${attempt}`, 'AI is fixing only the test cases that had a mistake', () => this.intentPlanner.repairSemantic(context, evidence, intent, compilation.diagnostics, attempt, semanticRepairAttempts, lastRepairError));
        lastRepairError = undefined;
      } catch (error) {
        lastRepairError = error instanceof Error ? error.message : String(error);
        acquisitionDiagnostics.push({
          code: 'AI_SEMANTIC_REPAIR_INVALID',
          message: lastRepairError,
        });
        continue;
      }
      incremental = await phase(`planning.recompile-${attempt}`, 'Re-checking the fixed test cases', () => compileIntentIncrementally({ intent, evidence, compiler: this.compiler, options: compileOptions }));
      compilation = incremental.result;
      compilationState = incremental.state;
    }
    const providers = context.config.evidenceProviders ?? [];
    const maxRounds = context.config.planning?.evidenceAcquisitionRounds ?? 2;
    const providerTimeoutMs = context.config.planning?.evidenceProviderTimeoutMs ?? Math.min(context.config.runtime.timeoutMs, 30_000);
    const cacheTtlMs = context.config.planning?.evidenceCacheTtlMs ?? 300_000;
    const cacheMaxEntries = context.config.planning?.evidenceCacheMaxEntries ?? 64;
    const resourceLimits = {
      maxResponseBytes: context.config.planning?.evidenceMaxResponseBytes ?? 10_485_760,
      maxGraphs: context.config.planning?.evidenceMaxGraphsPerResponse ?? 16,
      maxOperations: context.config.planning?.evidenceMaxOperationsPerResponse ?? 10_000,
      maxArtifacts: context.config.planning?.evidenceMaxArtifactsPerResponse ?? 1_000,
    };

    for (let round = 0; round < maxRounds && compilation.status !== 'compiled'; round += 1) {
      const requirements = requirementsFromCompilation(compilation, intent);
      if (requirements.length === 0) {
        evidenceDecisions.push(decisionRecord({
          round: round + 1, outcome: 'stopped', reasonCode: 'NO_ACQUIRABLE_REQUIREMENT',
          explanation: 'Compilation is incomplete, but none of its diagnostics can be answered by an evidence provider.',
          requirements, affectedScenarioIds: [], recompiledScenarioIds: [],
          preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition: emptyAcquisition(),
          before: evidence, after: evidence, conflictIds: [], compilation,
        }));
        break;
      }
      if (providers.length === 0) {
        evidenceDecisions.push(decisionRecord({
          round: round + 1, outcome: 'stopped', reasonCode: 'NO_ELIGIBLE_PROVIDER',
          explanation: 'No evidence source is configured for the current missing information; Brisk stopped without inventing an answer.',
          requirements, affectedScenarioIds: scenarioIdsFromRequirements(requirements), recompiledScenarioIds: [],
          preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition: emptyAcquisition(),
          before: evidence, after: evidence, conflictIds: [], compilation,
        }));
        break;
      }
      const acquisition = await acquireEvidenceForCompilation({
        plannerContext: context,
        intent,
        currentEvidence: evidence,
        requirements,
        providers,
        timeoutMs: providerTimeoutMs,
        cache: this.evidenceCache,
        cacheTtlMs,
        cacheMaxEntries,
        resourceLimits,
      });
      acquisitionDiagnostics.push(...acquisition.diagnostics);
      if (acquisition.graphs.length === 0) {
        const eligible = acquisition.attemptedProviderIds.length > 0 || acquisition.cacheHitProviderIds.length > 0;
        evidenceDecisions.push(decisionRecord({
          round: round + 1, outcome: 'stopped', reasonCode: eligible ? 'NO_USABLE_EVIDENCE' : 'NO_ELIGIBLE_PROVIDER',
          explanation: eligible
            ? 'Evidence sources were tried, but none returned usable information; the existing compilation result was preserved.'
            : 'No configured evidence source accepted the current missing information; Brisk stopped without inventing an answer.',
          requirements, affectedScenarioIds: scenarioIdsFromRequirements(requirements), recompiledScenarioIds: [],
          preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition,
          before: evidence, after: evidence, conflictIds: [], compilation,
        }));
        break;
      }

      const before = evidence;
      const resolution = resolveEvidenceConflicts({
        schemaVersion: 'brisk-aitesting.evidence-conflict-input.v2',
        graphs: [before, ...acquisition.graphs],
        policy: DEFAULT_EVIDENCE_AUTHORITY_POLICY,
      });
      const after = resolution.graph;
      const affectedScenarioIds = affectedScenarioIdsForEvidenceChange({
        intent, requirements, before, after, previous: compilationState,
      });
      if (affectedScenarioIds.length === 0) {
        evidence = after;
        evidenceDecisions.push(decisionRecord({
          round: round + 1, outcome: 'stopped', reasonCode: 'IRRELEVANT_EVIDENCE',
          explanation: 'The acquired information cannot change any current scenario, so Brisk preserved every scenario and stopped the loop.',
          requirements, affectedScenarioIds, recompiledScenarioIds: [],
          preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition,
          before, after, conflictIds: resolution.conflicts.filter((conflict) => conflict.status === 'unresolved').map((conflict) => conflict.id), compilation,
        }));
        break;
      }

      incremental = compileIntentIncrementally({
        intent, evidence: after, previous: compilationState, affectedScenarioIds, compiler: this.compiler, options: compileOptions,
      });
      evidence = after;
      compilationState = incremental.state;
      compilation = incremental.result;
      const conflictIds = relevantUnresolvedConflictIds(after, intent, affectedScenarioIds);
      const contradictory = conflictIds.length > 0;
      evidenceDecisions.push(decisionRecord({
        round: round + 1,
        outcome: contradictory ? 'stopped' : compilation.status === 'compiled' ? 'completed' : 'recompiled',
        reasonCode: contradictory ? 'CONTRADICTORY_EVIDENCE' : 'EVIDENCE_ACQUIRED',
        explanation: contradictory
          ? 'Acquired information conflicts on an affected operation; Brisk rechecked the affected scenarios, kept the conflict visible, and stopped unsafe compilation.'
          : `New evidence affected ${affectedScenarioIds.length} scenario(s); only those scenarios were recompiled.`,
        requirements, affectedScenarioIds,
        recompiledScenarioIds: incremental.recompiledScenarioIds,
        preservedScenarioIds: incremental.preservedScenarioIds,
        acquisition, before, after, conflictIds, compilation,
      }));
      if (contradictory) break;
    }
    if (compilation.status !== 'compiled' && maxRounds === 0) {
      evidenceDecisions.push(decisionRecord({
        round: 0, outcome: 'stopped', reasonCode: 'MAX_ROUNDS_REACHED',
        explanation: 'Evidence acquisition is disabled because the configured round limit is zero.',
        requirements: requirementsFromCompilation(compilation, intent), affectedScenarioIds: [], recompiledScenarioIds: [],
        preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition: emptyAcquisition(),
        before: evidence, after: evidence, conflictIds: [], compilation,
      }));
    } else if (compilation.status !== 'compiled'
      && evidenceDecisions.length === maxRounds
      && evidenceDecisions.at(-1)?.outcome !== 'stopped') {
      evidenceDecisions.push(decisionRecord({
        round: maxRounds, outcome: 'stopped', reasonCode: 'MAX_ROUNDS_REACHED',
        explanation: 'The bounded evidence-acquisition rounds finished before every scenario could compile.',
        requirements: requirementsFromCompilation(compilation, intent), affectedScenarioIds: [], recompiledScenarioIds: [],
        preservedScenarioIds: intent.scenarios.map((scenario) => scenario.id), acquisition: emptyAcquisition(),
        before: evidence, after: evidence, conflictIds: [], compilation,
      }));
    }
    if (compilation.status !== 'compiled' || compilation.workflow === undefined) {
      // Deliver what compiled. Twelve sound test cases with three named
      // refusals beat zero test cases after minutes of work, so scenarios the
      // repairs could not save are dropped with their exact reasons and the
      // rest ship. Only when every diagnostic names its scenario is dropping
      // safe; an unattributed diagnostic means the whole compilation is in
      // doubt and the honest answer stays a refusal.
      const blockedScenarioIds = new Set(
        compilation.diagnostics.map((diagnostic) => diagnostic.scenarioId).filter((id): id is string => id !== undefined),
      );
      const attributable = compilation.diagnostics.length > 0
        && compilation.diagnostics.every((diagnostic) => diagnostic.scenarioId !== undefined);
      const keptScenarios = intent.scenarios.filter((scenario) => !blockedScenarioIds.has(scenario.id));
      if (attributable && keptScenarios.length > 0) {
        const dropped = intent.scenarios
          .filter((scenario) => blockedScenarioIds.has(scenario.id))
          .map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            reasons: compilation.diagnostics
              .filter((diagnostic) => diagnostic.scenarioId === scenario.id)
              .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
          }));
        const salvagedIntent: IntentPlan = {
          ...intent,
          scenarios: keptScenarios,
          warnings: [
            ...intent.warnings,
            ...dropped.map((record) => `Dropped "${record.name}": it could not be compiled into safe steps (${record.reasons.join('; ')}).`),
          ],
        };
        const salvage = await phase(
          'planning.salvage',
          `Delivering the ${keptScenarios.length} test case(s) that compiled; ${dropped.length} could not be fixed`,
          () => compileIntentIncrementally({ intent: salvagedIntent, evidence, compiler: this.compiler, options: compileOptions }),
        );
        if (salvage.result.status === 'compiled' && salvage.result.workflow !== undefined) {
          intent = salvagedIntent;
          compilation = salvage.result;
          compilationState = salvage.state;
          droppedScenarioRecords = dropped;
        }
      }
    }
    if (compilation.status !== 'compiled' || compilation.workflow === undefined) {
      throw new SemanticCompilationError({
        ...compilation,
        diagnostics: [...compilation.diagnostics, ...acquisitionDiagnostics],
      }, evidenceDecisions, intent.scenarios.map((scenario) => ({ id: scenario.id, name: scenario.name })));
    }
    let compiledWorkflow: WorkflowPlan = compilation.workflow;
    const initialWorkflow = compiledWorkflow;
    let lowered = await phase('planning.lower', 'Writing the exact request or page for each step', () => new WorkflowLowerer(this.adapters).lower({
      workflow: initialWorkflow,
      evidence,
    }));

    // Planning-time emptiness awareness: every value the tests read from a
    // list/read operation is probed live before the run, so an empty
    // collection either provisions a self-cleaning fixture (when the host
    // opted in) or is called out in the plan before anything executes.
    let compilerFixtureRecords: readonly FixtureProvisioningRecordV1[] = compilation.fixtureProvisioning ?? [];
    const probeRecords: FixtureProvisioningRecordV1[] = [];
    const sources = listSourcedValues(compiledWorkflow, evidence);
    if (sources.length > 0) {
      const loweredForProbe = lowered;
      const probeResults = await phase('planning.data-probe', 'Checking that live data exists for every value the tests read', () => probeListSources({
        sources,
        lowered: loweredForProbe,
        config: context.config,
        timeoutMs: providerTimeoutMs,
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      }));
      const emptyResults = probeResults.filter((result) => result.probe.status === 'empty');
      const provisionedScenarioIds = new Set<string>();
      let provisionRefusals: readonly FixtureProvisioningRecordV1[] = [];
      if (emptyResults.length > 0 && fixturesPolicy === 'provision-when-missing') {
        const affectedScenarioIds = [...new Set(emptyResults.map((result) => result.source.intentScenarioId))];
        const reincremental = compileIntentIncrementally({
          intent,
          evidence,
          previous: compilationState,
          affectedScenarioIds,
          compiler: this.compiler,
          options: {
            fixtures: fixturesPolicy,
            forceProvisionSemanticTypes: new Set(emptyResults.map((result) => result.source.semanticType)),
          },
        });
        const provisionedWorkflow = reincremental.result.workflow;
        if (reincremental.result.status === 'compiled' && provisionedWorkflow !== undefined) {
          compilationState = reincremental.state;
          compilation = reincremental.result;
          compiledWorkflow = provisionedWorkflow;
          compilerFixtureRecords = reincremental.result.fixtureProvisioning ?? [];
          lowered = await phase('planning.lower-fixtures', 'Writing the provisioning steps for missing data', () => new WorkflowLowerer(this.adapters).lower({
            workflow: provisionedWorkflow,
            evidence,
          }));
          for (const id of affectedScenarioIds) provisionedScenarioIds.add(id);
        } else {
          provisionRefusals = (reincremental.result.fixtureProvisioning ?? []).filter((record) => record.outcome === 'no-cleanup-safe-producer');
        }
      }
      for (const result of probeResults) {
        probeRecords.push(probeAnnotatedRecord({
          result,
          policy: fixturesPolicy,
          provisionedScenarioIds,
          compilerFixtureRecords,
          provisionRefusals,
          evidence,
        }));
      }
    }
    // Probe-annotated records win over probe-less compiler records for the
    // same (check, value type); everything else is kept.
    const probeKeys = new Set(probeRecords.map((record) => `${record.scenarioId}:${record.semanticType}`));
    const fixtureProvisioning = [
      ...probeRecords,
      ...compilerFixtureRecords.filter((record) => !probeKeys.has(`${record.scenarioId}:${record.semanticType}`)),
    ].sort((left, right) => left.id.localeCompare(right.id));
    const fixtureWarnings = fixtureProvisioning
      .filter((record) => record.outcome !== 'existing-data' && record.outcome !== 'unverified')
      .map((record) => record.explanation);

    return loweredWorkflowToTestPlan({
      runId: context.runId,
      goal: context.input.goal,
      workflow: compiledWorkflow,
      lowered,
      discovery: context.discovery,
      ...(context.input.scenarios === undefined ? {} : { requested: context.input.scenarios }),
      warnings: [
        ...intent.warnings,
        ...evidence.diagnostics,
        ...acquisitionDiagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
        ...fixtureWarnings,
      ],
      ...(droppedScenarioRecords.length > 0 ? { droppedScenarios: droppedScenarioRecords } : {}),
      evidenceDecisions,
      ...(fixtureProvisioning.length > 0 ? { fixtureProvisioning } : {}),
    });
  }

  private async collectEvidence(context: PlannerContext): Promise<EvidenceGraph> {
    const graphs: EvidenceGraph[] = [];
    if (context.input.evidenceGraph !== undefined) graphs.push(context.input.evidenceGraph);
    for (const adapter of this.adapters) {
      const graph = await adapter.collect?.({
        config: context.config,
        input: context.input,
        discovery: context.discovery,
        runId: context.runId,
      });
      if (graph !== undefined) graphs.push(graph);
    }
    return mergeEvidenceGraphs(graphs);
  }
}

type DecisionReason = AcquisitionRecompilationDecisionV1['reasonCode'];
type AcquisitionSummary = Pick<Awaited<ReturnType<typeof acquireEvidenceForCompilation>>,
  'attemptedProviderIds' | 'cacheHitProviderIds' | 'graphs' | 'diagnostics'>;

function decisionRecord(params: {
  readonly round: number;
  readonly outcome: AcquisitionRecompilationDecisionV1['outcome'];
  readonly reasonCode: DecisionReason;
  readonly explanation: string;
  readonly requirements: readonly { readonly id: string; readonly scenarioId?: string }[];
  readonly affectedScenarioIds: readonly string[];
  readonly recompiledScenarioIds: readonly string[];
  readonly preservedScenarioIds: readonly string[];
  readonly acquisition: AcquisitionSummary;
  readonly before: EvidenceGraph;
  readonly after: EvidenceGraph;
  readonly conflictIds: readonly string[];
  readonly compilation: CompilationResult;
}): AcquisitionRecompilationDecisionV1 {
  const content = {
    schemaVersion: 'brisk-aitesting.acquisition-recompilation-decision.v1' as const,
    round: params.round,
    outcome: params.outcome,
    reasonCode: params.reasonCode,
    explanation: params.explanation,
    requirementIds: params.requirements.map((entry) => entry.id).sort(),
    affectedScenarioIds: [...params.affectedScenarioIds].sort(),
    recompiledScenarioIds: [...params.recompiledScenarioIds].sort(),
    preservedScenarioIds: [...params.preservedScenarioIds].sort(),
    attemptedProviderIds: [...params.acquisition.attemptedProviderIds].sort(),
    cacheHitProviderIds: [...params.acquisition.cacheHitProviderIds].sort(),
    acquiredGraphRevisions: params.acquisition.graphs.map((graph) => graph.revision).sort(),
    conflictIds: [...params.conflictIds].sort(),
    diagnosticCodes: [...new Set(params.acquisition.diagnostics.map((entry) => entry.code))].sort(),
    beforeEvidenceRevision: params.before.revision,
    afterEvidenceRevision: params.after.revision,
    beforeEvidenceDigest: evidenceGraphDigest(params.before),
    afterEvidenceDigest: evidenceGraphDigest(params.after),
    authorityPolicyDigest: evidenceAuthorityPolicyDigest(DEFAULT_EVIDENCE_AUTHORITY_POLICY),
    compilationStatus: params.compilation.status,
  };
  const id = `decision_${createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 24)}`;
  return { ...content, id };
}

/**
 * Turns one live-probe result into the plan's typed fixture-provisioning
 * record: existing data confirmed, fixture provisioned, empty with an honest
 * "this will fail without data" verdict, or unverifiable — never a guess.
 */
function probeAnnotatedRecord(params: {
  readonly result: ListSourceProbeResult;
  readonly policy: FixtureSourcingPolicy;
  readonly provisionedScenarioIds: ReadonlySet<string>;
  readonly compilerFixtureRecords: readonly FixtureProvisioningRecordV1[];
  readonly provisionRefusals: readonly FixtureProvisioningRecordV1[];
  readonly evidence: EvidenceGraph;
}): FixtureProvisioningRecordV1 {
  const { result, policy } = params;
  const source = result.source;
  const base = {
    schemaVersion: 'brisk-aitesting.fixture-provisioning.v1' as const,
    scenarioId: source.intentScenarioId,
    semanticType: source.semanticType,
    policy,
    sourceOperationId: source.sourceOperationId,
    probe: result.probe,
  };
  const withId = (content: Omit<FixtureProvisioningRecordV1, 'id'>): FixtureProvisioningRecordV1 => (
    { ...content, id: fixtureProvisioningRecordId(content) }
  );
  const matching = (records: readonly FixtureProvisioningRecordV1[]): FixtureProvisioningRecordV1 | undefined => records.find((record) => (
    record.scenarioId === source.intentScenarioId && record.semanticType === source.semanticType
  ));
  if (result.probe.status === 'populated') {
    return withId({ ...base, outcome: 'existing-data', explanation: result.explanation });
  }
  if (result.probe.status === 'unknown') {
    return withId({ ...base, outcome: 'unverified', explanation: result.explanation });
  }
  if (params.provisionedScenarioIds.has(source.intentScenarioId)) {
    const provisioned = matching(params.compilerFixtureRecords.filter((record) => record.outcome === 'provisioned'));
    return withId({
      ...base,
      outcome: 'provisioned',
      explanation: `${result.explanation} ${provisioned?.explanation ?? 'A self-cleaning fixture will be provisioned for this run and removed afterwards.'}`,
      ...(provisioned?.producerOperationId !== undefined ? { producerOperationId: provisioned.producerOperationId } : {}),
      ...(provisioned?.cleanupOperationId !== undefined ? { cleanupOperationId: provisioned.cleanupOperationId } : {}),
    });
  }
  const refusal = matching(params.provisionRefusals);
  if (refusal !== undefined) {
    return withId({
      ...base,
      outcome: 'no-cleanup-safe-producer',
      explanation: `${result.explanation} ${refusal.explanation}`,
      ...(refusal.producerOperationId !== undefined ? { producerOperationId: refusal.producerOperationId } : {}),
      ...(refusal.cleanupOperationId !== undefined ? { cleanupOperationId: refusal.cleanupOperationId } : {}),
    });
  }
  if (policy === 'provision-when-missing') {
    return withId({
      ...base,
      outcome: 'empty-requires-existing-data',
      explanation: `${result.explanation} Provisioning was attempted, but the affected check could not be recompiled safely; without data this check will fail with a precondition diagnosis.`,
    });
  }
  const search = findCleanupSafeProducer(source.semanticType, params.evidence);
  if (search.kind === 'found') {
    return withId({
      ...base,
      outcome: 'empty-requires-existing-data',
      explanation: `${result.explanation} This check will fail without data. Create one ${source.semanticType.split('.')[0] ?? source.semanticType}, or set fixtures: 'provision-when-missing' so Brisk provisions a self-cleaning fixture via ${search.producer.id}.`,
      producerOperationId: search.producer.id,
      cleanupOperationId: search.cleanupOperation.id,
    });
  }
  return withId({
    ...base,
    outcome: 'no-cleanup-safe-producer',
    explanation: `${result.explanation} No self-cleaning creation capability is declared for ${source.semanticType} (${search.explanation}) Create the data, or declare a host/contract producer operation with a cleanupOperationId.`,
    ...(search.producerOperationId !== undefined ? { producerOperationId: search.producerOperationId } : {}),
  });
}

function emptyAcquisition(): AcquisitionSummary {
  return { attemptedProviderIds: [], cacheHitProviderIds: [], graphs: [], diagnostics: [] };
}

function scenarioIdsFromRequirements(requirements: readonly { readonly scenarioId?: string }[]): readonly string[] {
  return [...new Set(requirements.flatMap((requirement) => requirement.scenarioId === undefined ? [] : [requirement.scenarioId]))].sort();
}

function relevantUnresolvedConflictIds(
  evidence: EvidenceGraph,
  intent: IntentPlan,
  affectedScenarioIds: readonly string[],
): readonly string[] {
  const affected = new Set(affectedScenarioIds);
  const relevantOperationIds = new Set(intent.scenarios
    .filter((scenario) => affected.has(scenario.id))
    .flatMap((scenario) => scenario.actions.flatMap((action) => evidence.operations
      .filter((operation) => evidenceOperationMatchesIntentAction(action, operation))
      .map((operation) => operation.id))));
  return (evidence.conflicts ?? [])
    .filter((conflict) => conflict.status === 'unresolved' && relevantOperationIds.has(conflict.operationId))
    .map((conflict) => conflict.id)
    .sort();
}

function uniqueAdapters(adapters: readonly CapabilityAdapter[]): readonly CapabilityAdapter[] {
  const byId = new Map<string, CapabilityAdapter>();
  for (const adapter of adapters) {
    if (byId.has(adapter.id)) throw new Error(`Capability adapter id "${adapter.id}" is registered more than once.`);
    byId.set(adapter.id, adapter);
  }
  return [...byId.values()];
}

function hasAiRepairableDiagnostics(intent: IntentPlan, compilation: CompilationResult): boolean {
  const repairable = new Set([
    'AMBIGUOUS_OPERATION',
    'NO_OPERATION_FOR_INTENT',
    'MISSING_REQUIRED_VALUE',
    'AMBIGUOUS_VALUE_PRODUCER',
    'UNKNOWN_INTENT_VALUE_PRODUCER',
    'AMBIGUOUS_INTENT_VALUE_PRODUCER',
    'INCOMPATIBLE_VALUE_BINDING',
    'UNPROVEN_EXPECTED_OUTCOME',
    // A generate request with no recipe is a wrong selector choice, and the
    // correct fix (fromActionId to the real producer) is exactly what the
    // repair round exists for. Leaving it out let one bad repair strand the
    // whole run with no way back.
    'NO_GENERATION_RECIPE',
  ]);
  // A repair replaces one intent action, so the diagnostic must name an action
  // the intent actually contains. Diagnostics attributed to compiler-made
  // steps would send the loop chasing replacements that can never be applied.
  const intentActionKeys = new Set(intent.scenarios.flatMap((scenario) => (
    scenario.actions.map((action) => `${scenario.id}:${action.id}`)
  )));
  return compilation.diagnostics.some((diagnostic) => (
    repairable.has(diagnostic.code)
    && diagnostic.scenarioId !== undefined
    && diagnostic.actionId !== undefined
    && intentActionKeys.has(`${diagnostic.scenarioId}:${diagnostic.actionId}`)
  ));
}

function formatCompilationDiagnostics(compilation: CompilationResult): string {
  const detail = compilation.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join('; ');
  return `Semantic compilation ${compilation.status}${detail.length > 0 ? `: ${detail}` : '.'}`;
}
