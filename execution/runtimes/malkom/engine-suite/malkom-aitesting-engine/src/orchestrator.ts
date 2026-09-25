import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeConfig, resolveRepairAttempts, type UserConfig } from './config.js';
import { BuiltinDiscoverer } from './discovery.js';
import { BuiltinApiEngine, BuiltinContractEngine, BuiltinLiveMessageEngine, BuiltinMessageContractEngine, BuiltinPlaywrightEngine, BuiltinPlaywrightRouteGrounder, BuiltinReplayEngine, BuiltinSchemaFuzzEngine } from './engines.js';
import { buildResult, persistCiReports, persistResult } from './handover.js';
import { BuiltinPlanner } from './planner.js';
import { SemanticCompilationError, SemanticPlanner } from './semantic-planner.js';
import { RunJournal } from './run-journal.js';
import { recoverInterruptedRuns } from './recovery.js';
import { BuiltinPlanValidator } from './validation.js';
import { validateResultJsonContract } from './result-contract.js';
import { collectWorkflowReferences, isBuiltinWorkflowVariable } from './workflow-values.js';
import { resolveAuthSession } from './auth-session.js';
import { AiUsageTracker, type AiUsage } from './ai-usage.js';
import { redactText } from './redaction.js';
import type {
  BriskAiTestingConfig,
  BriskAiTestingEvent,
  BriskAiTestingResult,
  BriskAiTestingRunInput,
  Discoverer,
  Engine,
  EngineRunState,
  ApiCleanupStep,
  Planner,
  PlanValidator,
  ScenarioResult,
  TestPlan,
  ArtifactRef,
  UiRouteGrounder,
  ValidationResult,
  DiscoveryResult,
  OperationalIssue,
  RunOutcome,
  CheckAccounting,
  UiActionPlan,
  UiGroundingEvidence,
} from './types.js';

/** How many screens are grounded (and, on the fallback path, enriched) at once. */
const GROUNDING_CONCURRENCY = 3;

/** Run one task per item with bounded concurrency; the first failure rejects. */
async function inPool<T>(limit: number, items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await work(items[index]!);
    }
  });
  await Promise.all(workers);
}

export class BriskAiTesting {
  private readonly config: BriskAiTestingConfig;
  private readonly discoverer: Discoverer;
  private readonly planner: Planner;
  private readonly validator: PlanValidator;
  private readonly engines: readonly Engine[];
  private readonly uiRouteGrounder: UiRouteGrounder;
  private readonly listeners = new Set<(event: BriskAiTestingEvent) => void>();
  private readonly aiUsageTracker?: AiUsageTracker;

  constructor(configInput: BriskAiTestingConfig | UserConfig, params?: {
    readonly discoverer?: Discoverer;
    readonly planner?: Planner;
    readonly validator?: PlanValidator;
    readonly engines?: readonly Engine[];
    readonly uiRouteGrounder?: UiRouteGrounder;
  }) {
    this.config = normalizeConfig(configInput);
    this.discoverer = params?.discoverer ?? this.config.discoverer ?? new BuiltinDiscoverer();
    if (this.config.aiProvider !== undefined) {
      this.aiUsageTracker = new AiUsageTracker(this.config.ai?.model);
    }
    this.planner = params?.planner ?? (this.config.aiProvider !== undefined
      ? new SemanticPlanner(this.aiUsageTracker?.wrap(this.config.aiProvider) ?? this.config.aiProvider, this.config.capabilityAdapters ?? [])
      : new BuiltinPlanner());
    this.validator = params?.validator ?? this.config.validator ?? new BuiltinPlanValidator();
    this.engines = params?.engines ?? this.config.engines ?? [
      new BuiltinApiEngine(),
      new BuiltinPlaywrightEngine(),
      new BuiltinSchemaFuzzEngine(),
      new BuiltinReplayEngine(),
      new BuiltinLiveMessageEngine(),
      new BuiltinMessageContractEngine(),
      new BuiltinContractEngine(),
    ];
    this.uiRouteGrounder = params?.uiRouteGrounder ?? new BuiltinPlaywrightRouteGrounder();
  }

  onEvent(listener: (event: BriskAiTestingEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async run(input: BriskAiTestingRunInput): Promise<BriskAiTestingResult> {
    const runId = `run_${randomUUID()}`;
    const startedAt = Date.now();
    const goal = typeof input.goal === 'string' ? input.goal : '';
    const journal = new RunJournal(this.config.runtime.artifactsDir, runId);
    const issues: OperationalIssue[] = [];
    const tests: ScenarioResult[] = [];
    const operations: ScenarioResult[] = [];
    const compiledWorkflowSteps: { readonly scenario: TestPlan['scenarios'][number]; readonly result: ScenarioResult }[] = [];
    const artifacts: ArtifactRef[] = [];
    const runState: EngineRunState = { variables: {}, captures: {}, cleanup: [], scenarioStatus: {} };
    let discovery = emptyDiscovery(this.config, 'Discovery did not complete.');
    let plan = emptyPlan(runId, goal, discovery);
    let checkAccounting: CheckAccounting | undefined;
    this.aiUsageTracker?.reset();
    const timings: { stage: string; ms: number; detail?: string }[] = [];
    const timed = async <T>(stage: string, work: () => Promise<T>, detail?: string): Promise<T> => {
      const startedAtMs = Date.now();
      this.emit({ type: 'planning.phase', runId, phase: stage, ...(detail !== undefined ? { detail } : {}) });
      try {
        return await work();
      } finally {
        timings.push({ stage, ms: Date.now() - startedAtMs, ...(detail !== undefined ? { detail } : {}) });
      }
    };

    await recoverInterruptedRuns(this.config).catch(() => []);
    try {
      await journal.initialize(goal, {
        name: this.config.app.name,
        baseUrl: this.config.app.baseUrl,
        ...(this.config.app.env !== undefined ? { env: this.config.app.env } : {}),
      });
    } catch (error) {
      issues.push(issue('persistence', 'persistence', 'RUN_META_WRITE_FAILED', safeErrorMessage(error), true));
    }
    this.emit({ type: 'run.started', runId, goal });
    await this.recordJournal(journal, 'accepted', 'started', issues);

    try {
      if (goal.trim().length === 0) {
        throw stageError('input', 'accepted', 'RUN_GOAL_REQUIRED', 'run.goal is required and must be non-empty.');
      }

      await this.recordJournal(journal, 'discovery', 'started', issues);
      discovery = await timed('discovery', () => withTimeout(
        this.discoverer.discover({ config: this.config, input, runId }),
        this.config.runtime.timeoutMs,
        'Discovery timed out.',
      ), 'Reading your app: pages, routes and contracts');
      this.emit({ type: 'discovery.completed', runId, discovery });
      await this.recordJournal(journal, 'discovery', 'completed', issues);

      await this.recordJournal(journal, 'planning', 'started', issues);
      const rawPlan = await timed('planning', () => withTimeout(
        this.planner.plan({ config: this.config, input, runId, discovery, onPhase: (phase, detail) => {
          this.emit({ type: 'planning.phase', runId, phase, ...(detail !== undefined ? { detail } : {}) });
        }, onTiming: (stage, ms, detail) => {
          timings.push({ stage, ms, ...(detail !== undefined ? { detail } : {}) });
        } }),
        this.config.runtime.timeoutMs,
        'Planning timed out.',
      ), 'Planning');
      const initialPlan = { ...rawPlan, discovery };
      this.emit({ type: 'plan.created', runId, plan: initialPlan });
      plan = await timed('validation', () => this.validateAndRepairPlan({ input, runId, discovery, plan: initialPlan }), 'Checking every test against your real app');
      assertEnginesAvailable(plan, this.engines);
      checkAccounting = accountingFromPlan(plan, input.scenarios);
      await this.recordJournal(journal, 'planning', 'completed', issues);

      await this.recordJournal(journal, 'grounding', 'started', issues);
      const enriched = await timed('grounding', () => this.enrichUiActionsFromGrounding({ input, runId, discovery, plan }), 'Matching screen actions to real pages');
      plan = enriched.plan;
      artifacts.push(...enriched.artifacts);
      await this.recordJournal(journal, 'grounding', 'completed', issues);

      await this.recordJournal(journal, 'execution', 'started', issues);
      if (!this.config.runtime.dryRun && plan.scenarios.length > 0 && this.config.auth.type !== 'none') {
        // Sign in once for the whole run. A failed sign-in stops the run with
        // a clear reason; tests are never silently executed signed out.
        try {
          const session = await withTimeout(
            resolveAuthSession(this.config),
            this.config.runtime.timeoutMs,
            'Signing in timed out.',
          );
          if (session !== undefined) runState.authSession = session;
        } catch (error) {
          throw stageError('input', 'execution', 'AUTH_LOGIN_FAILED', safeErrorMessage(error));
        }
      }
      const executionStartedAtMs = Date.now();
      for (const scenario of this.config.runtime.dryRun ? [] : plan.scenarios) {
        this.emit({ type: 'scenario.started', runId, scenario });
        const blockedBy = blockingReasons(scenario, plan, runState);
        const engine = this.engines.find((candidate) => candidate.canRun(scenario));
        let result: ScenarioResult;
        if (blockedBy.length > 0) {
          result = blockedScenario(scenario, blockedBy);
        } else if (engine === undefined) {
          result = failedScenario(scenario, 'none', 'engine_internal', [`No engine registered for scenario type "${scenario.type}".`]);
        } else {
          try {
            const output = await withTimeout(
              engine.run({ config: this.config, runId, plan, scenario, runState }),
              this.config.runtime.timeoutMs,
              `Engine ${engine.name} timed out.`,
            );
            if (output.artifacts !== undefined) artifacts.push(...output.artifacts);
            result = normalizeExecutableResult(output.result);
          } catch (error) {
            const category = isTimeoutError(error) ? 'timeout' : 'engine_internal';
            result = failedScenario(scenario, engine.name, category, [safeErrorMessage(error)]);
            issues.push(issue(category, 'execution', category === 'timeout' ? 'ENGINE_TIMEOUT' : 'ENGINE_EXCEPTION', safeErrorMessage(error), true, scenario.id));
          }
        }
        if (result.failureCategory !== undefined && result.failureCategory !== 'application_assertion' && !issues.some((entry) => entry.scenarioId === scenario.id)) {
          issues.push(issue(
            result.failureCategory === 'network' ? 'network' : result.failureCategory === 'timeout' ? 'timeout' : result.failureCategory,
            'execution',
            'NON_APPLICATION_TEST_FAILURE',
            result.diagnostics.join('; ') || `${scenario.name} could not execute normally.`,
            true,
            scenario.id,
          ));
        }
        runState.scenarioStatus[scenario.id] = result.status;
        if (isCompiledWorkflowScenario(scenario)) {
          operations.push(result);
          compiledWorkflowSteps.push({ scenario, result });
          if (scenario.metadata?.workflowPhase === 'cleanup' && result.status === 'failed') {
            issues.push(issue('cleanup', 'cleanup', 'COMPILED_CLEANUP_STEP_FAILED', result.diagnostics.join('; ') || scenario.name, true, scenario.id));
          }
        } else {
          tests.push(result);
        }
        this.emit({ type: 'scenario.completed', runId, result });
      }
      for (const result of aggregateCompiledWorkflowResults(compiledWorkflowSteps)) {
        tests.push(result);
        this.emit({ type: 'scenario.completed', runId, result });
      }
      timings.push({ stage: 'execution', ms: Date.now() - executionStartedAtMs, detail: 'Running the tests' });
      await this.recordJournal(journal, 'execution', 'completed', issues);
    } catch (error) {
      if (error instanceof SemanticCompilationError) {
        // The request was understood but could not be fully prepared. Keep
        // the honest totals so the refusal still shows every requested check.
        checkAccounting = accountingFromCompilationError(error, input.scenarios);
      }
      const operationalIssue = error instanceof StageFailure
        ? error.operationalIssue
        : issue(isTimeoutError(error) ? 'timeout' : 'planning', 'planning', isTimeoutError(error) ? 'STAGE_TIMEOUT' : 'CONTROL_PLANE_EXCEPTION', safeErrorMessage(error), true);
      issues.push(operationalIssue);
      await this.recordJournal(journal, operationalIssue.stage, 'diagnostic', issues, operationalIssue);
    } finally {
      await this.recordJournal(journal, 'cleanup', 'started', issues);
      try {
        const cleanupOutput = await this.runCleanup({ runId, plan, runState });
        const cleanupResults = cleanupOutput.results.map(normalizeOperationResult);
        operations.push(...cleanupResults);
        for (const cleanupResult of cleanupResults.filter((entry) => entry.status === 'failed')) {
          issues.push(issue('cleanup', 'cleanup', 'CLEANUP_STEP_FAILED', cleanupResult.diagnostics.join('; ') || cleanupResult.name, true, cleanupResult.scenarioId));
        }
        artifacts.push(...cleanupOutput.artifacts);
      } catch (error) {
        issues.push(issue('cleanup', 'cleanup', 'CLEANUP_EXCEPTION', safeErrorMessage(error), true));
      }
      // Release anything an engine kept for the whole run, such as the shared
      // browser. Always attempted, even when the run failed earlier.
      for (const engine of this.engines) {
        if (engine.dispose === undefined) continue;
        try {
          await engine.dispose();
        } catch (error) {
          issues.push(issue('engine_internal', 'cleanup', 'ENGINE_DISPOSE_FAILED', safeErrorMessage(error), true));
        }
      }
      try {
        await this.uiRouteGrounder.dispose?.();
      } catch (error) {
        issues.push(issue('engine_internal', 'cleanup', 'ENGINE_DISPOSE_FAILED', safeErrorMessage(error), true));
      }
      await this.recordJournal(journal, 'cleanup', 'completed', issues);
    }

    await this.recordJournal(journal, 'reporting', 'started', issues);
    let aiUsage: AiUsage | undefined;
    if (this.aiUsageTracker !== undefined) {
      aiUsage = this.aiUsageTracker.snapshot();
      if (aiUsage.calls > 0) {
        // Keep a per-run record of every AI call with fingerprints and the
        // redacted response text, so real-AI proof can be retained safely.
        try {
          const aiDir = join(this.config.runtime.artifactsDir, runId, 'ai');
          await mkdir(aiDir, { recursive: true });
          const aiRecordPath = join(aiDir, 'ai-usage.json');
          await writeFile(aiRecordPath, `${JSON.stringify({ usage: aiUsage, prompts: this.aiUsageTracker.retainedRequests(), responses: this.aiUsageTracker.retainedResponses() }, null, 2)}
`, 'utf8');
          artifacts.push({ kind: 'json', path: aiRecordPath, label: 'AI usage and redacted responses' });
        } catch (error) {
          issues.push(issue('reporting', 'reporting', 'AI_RECORD_WRITE_FAILED', safeErrorMessage(error), true));
        }
      }
    }
    let outcome = buildOutcome(tests.length, issues, journal.path);
    let result = buildResult({
      config: this.config,
      goal: goal.trim().length > 0 ? goal : '(invalid empty goal)',
      runId,
      plan,
      discovery,
      startedAt,
      tests,
      operations,
      artifacts,
      outcome,
      ...(checkAccounting !== undefined ? { checks: checkAccounting } : {}),
      ...(aiUsage !== undefined ? { ai: aiUsage } : {}),
      timings,
    });
    try {
      artifacts.push(...await persistCiReports(this.config, result));
    } catch (error) {
      issues.push(issue('reporting', 'reporting', 'REPORT_WRITE_FAILED', safeErrorMessage(error), true));
    }
    await this.recordJournal(journal, 'reporting', 'completed', issues);
    await this.recordJournal(journal, 'completed', 'completed', issues);

    outcome = buildOutcome(tests.length, issues, journal.path);
    const resultArtifact: ArtifactRef = {
      kind: 'json',
      path: join(this.config.runtime.artifactsDir, runId, 'result.json'),
      label: 'Result JSON',
    };
    result = buildResult({
      config: this.config,
      goal: goal.trim().length > 0 ? goal : '(invalid empty goal)',
      runId,
      plan,
      discovery,
      startedAt,
      tests,
      operations,
      artifacts: [...artifacts, resultArtifact],
      outcome,
      ...(checkAccounting !== undefined ? { checks: checkAccounting } : {}),
      ...(aiUsage !== undefined ? { ai: aiUsage } : {}),
      timings,
    });
    const contractIssues = validateResultJsonContract(result);
    if (contractIssues.some((entry) => entry.severity === 'error')) {
      issues.push(issue('persistence', 'persistence', 'RESULT_CONTRACT_INVALID', contractIssues.map((entry) => `${entry.path}: ${entry.message}`).join('; '), false));
      result = { ...result, outcome: buildOutcome(tests.length, issues, journal.path) };
    }
    try {
      await persistResult(this.config, result);
    } catch (error) {
      issues.push(issue('persistence', 'persistence', 'RESULT_WRITE_FAILED', safeErrorMessage(error), true));
      result = {
        ...result,
        outcome: buildOutcome(tests.length, issues),
        artifacts: result.artifacts.filter((artifact) => artifact !== resultArtifact),
      };
    }
    this.emit({ type: 'run.completed', runId, result });
    return result;
  }

  private emit(event: BriskAiTestingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observers cannot break the run control plane.
      }
    }
  }

  private async recordJournal(
    journal: RunJournal,
    stage: Parameters<RunJournal['record']>[0],
    status: Parameters<RunJournal['record']>[1],
    issues: OperationalIssue[],
    diagnostic?: OperationalIssue,
  ): Promise<void> {
    try {
      await journal.record(stage, status, diagnostic);
    } catch (error) {
      if (!issues.some((entry) => entry.code === 'JOURNAL_WRITE_FAILED')) {
        issues.push(issue('persistence', 'persistence', 'JOURNAL_WRITE_FAILED', safeErrorMessage(error), true));
      }
    }
  }

  private async runCleanup(params: {
    readonly runId: string;
    readonly plan: TestPlan;
    readonly runState: EngineRunState;
  }): Promise<{ readonly results: readonly ScenarioResult[]; readonly artifacts: readonly ArtifactRef[] }> {
    if (params.runState.cleanup.length === 0) return { results: [], artifacts: [] };
    const apiEngine = this.engines.find((engine) => engine.type === 'api');
    if (apiEngine === undefined) return { results: [], artifacts: [] };
    const results: ScenarioResult[] = [];
    const artifacts: ArtifactRef[] = [];
    const cleanupSteps = [...params.runState.cleanup].reverse();
    for (const [index, cleanup] of cleanupSteps.entries()) {
      const scenario = cleanupScenario(cleanup, index);
      this.emit({ type: 'scenario.started', runId: params.runId, scenario });
      try {
        const output = await withTimeout(apiEngine.run({
          config: this.config,
          runId: params.runId,
          plan: params.plan,
          scenario,
          runState: params.runState,
        }), this.config.runtime.timeoutMs, `Cleanup ${cleanup.target.method} ${cleanup.target.path} timed out.`);
        if (output.artifacts !== undefined) artifacts.push(...output.artifacts);
        results.push(output.result);
        this.emit({ type: 'scenario.completed', runId: params.runId, result: output.result });
      } catch (error) {
        const result = failedScenario(scenario, apiEngine.name, isTimeoutError(error) ? 'timeout' : 'engine_internal', [safeErrorMessage(error)]);
        results.push(result);
        this.emit({ type: 'scenario.completed', runId: params.runId, result });
      }
    }
    return { results, artifacts };
  }

  private async validateAndRepairPlan(params: {
    readonly input: BriskAiTestingRunInput;
    readonly runId: string;
    readonly discovery: TestPlan['discovery'];
    readonly plan: TestPlan;
  }): Promise<TestPlan> {
    let plan = params.plan;
    let validation = await this.validator.validate({ config: this.config, input: params.input, plan });
    this.emit({ type: 'plan.validated', runId: params.runId, validation });

    const maxAttempts = resolveRepairAttempts(this.config.planning?.repairAttempts ?? this.config.ai?.repairAttempts);
    for (let attempt = 1; !validation.valid && attempt <= maxAttempts && this.planner.repair !== undefined; attempt += 1) {
      this.emit({ type: 'plan.repair.started', runId: params.runId, attempt, validation });
      const repaired = await this.planner.repair({
        config: this.config,
        input: params.input,
        runId: params.runId,
        discovery: params.discovery,
        attempt,
        maxAttempts,
        invalidPlan: plan,
        validation,
      });
      plan = { ...repaired, discovery: params.discovery };
      this.emit({ type: 'plan.repaired', runId: params.runId, attempt, plan });
      validation = await this.validator.validate({ config: this.config, input: params.input, plan });
      this.emit({ type: 'plan.validated', runId: params.runId, validation });
    }

    if (!validation.valid) {
      throw stageError('validation', 'validation', 'PLAN_REJECTED', formatValidationFailure(validation));
    }
    return plan;
  }

  private async enrichUiActionsFromGrounding(params: {
    readonly input: BriskAiTestingRunInput;
    readonly runId: string;
    readonly discovery: TestPlan['discovery'];
    readonly plan: TestPlan;
  }): Promise<{ readonly plan: TestPlan; readonly artifacts: readonly ArtifactRef[] }> {
    const mode = params.input.uiActionFeedback ?? 'off';
    const canEnrich = this.planner.enrichUiActionsForScenarios !== undefined || this.planner.enrichUiActions !== undefined;
    if (mode === 'off' || !canEnrich) return { plan: params.plan, artifacts: [] };

    const pending = params.plan.scenarios.filter((scenario) => (
      scenario.type === 'ui'
      && !(mode === 'when-missing' && scenario.uiActions !== undefined && scenario.uiActions.length > 0)
    ));
    if (pending.length === 0) return { plan: params.plan, artifacts: [] };

    // One shared browser, several pages at a time: grounding K screens costs
    // one browser start plus roughly the slowest page, not K starts in a row.
    const artifacts: ArtifactRef[] = [];
    const groundings = new Map<string, UiGroundingEvidence>();
    await inPool(GROUNDING_CONCURRENCY, pending, async (scenario) => {
      const grounded = await this.uiRouteGrounder.ground({ config: this.config, runId: params.runId, scenario });
      artifacts.push(...grounded.artifacts);
      groundings.set(scenario.id, grounded.grounding);
      this.emit({ type: 'ui.grounding.completed', runId: params.runId, scenario, grounding: grounded.grounding });
    });
    // Concurrent grounding finishes in arbitrary order; the recorded artifact
    // list stays deterministic.
    artifacts.sort((left, right) => (left.path ?? '').localeCompare(right.path ?? ''));

    const actionsByScenario = await this.enrichGroundedScenarios(params, pending, groundings);
    let changed = false;
    const scenarios = params.plan.scenarios.map((scenario) => {
      const actions = actionsByScenario.get(scenario.id);
      if (actions === undefined) return scenario;
      const grounding = groundings.get(scenario.id);
      const incompatible = grounding === undefined ? [] : incompatibleUiActions(actions, grounding);
      if (incompatible.length > 0) {
        throw stageError('validation', 'grounding', 'UI_ACTION_NOT_COMPATIBLE', incompatible.join('; '));
      }
      this.emit({ type: 'ui.actions.enriched', runId: params.runId, scenario, actions });
      if (actions.length === 0) return scenario;
      changed = true;
      return { ...scenario, uiActions: actions };
    });
    if (!changed) return { plan: params.plan, artifacts };
    const plan = { ...params.plan, scenarios };
    const validation = await this.validator.validate({ config: this.config, input: params.input, plan });
    this.emit({ type: 'plan.validated', runId: params.runId, validation });
    if (!validation.valid) throw new Error(formatValidationFailure(validation));
    this.emit({ type: 'plan.enriched', runId: params.runId, plan });
    return { plan, artifacts };
  }

  /** One AI call for every grounded screen when the planner supports it; per-scenario calls otherwise. */
  private async enrichGroundedScenarios(
    params: {
      readonly input: BriskAiTestingRunInput;
      readonly runId: string;
      readonly discovery: TestPlan['discovery'];
    },
    pending: readonly TestPlan['scenarios'][number][],
    groundings: ReadonlyMap<string, UiGroundingEvidence>,
  ): Promise<ReadonlyMap<string, readonly UiActionPlan[]>> {
    const base = {
      config: this.config,
      input: params.input,
      runId: params.runId,
      discovery: params.discovery,
    };
    const items = pending.flatMap((scenario) => {
      const grounding = groundings.get(scenario.id);
      return grounding === undefined ? [] : [{ scenario, grounding }];
    });
    const actionsByScenario = new Map<string, readonly UiActionPlan[]>();
    if (this.planner.enrichUiActionsForScenarios !== undefined) {
      const results = await this.planner.enrichUiActionsForScenarios({ ...base, items });
      for (const result of results) {
        if (!items.some((item) => item.scenario.id === result.scenarioId)) {
          throw stageError('validation', 'grounding', 'UI_ACTION_NOT_COMPATIBLE', `Planner returned actions for unknown scenario ${result.scenarioId}.`);
        }
        actionsByScenario.set(result.scenarioId, result.actions);
      }
      const missing = items.filter((item) => !actionsByScenario.has(item.scenario.id));
      if (missing.length > 0) {
        throw stageError('validation', 'grounding', 'UI_ACTION_NOT_COMPATIBLE', `Planner returned no actions entry for scenario(s): ${missing.map((item) => item.scenario.id).join(', ')}.`);
      }
      return actionsByScenario;
    }
    const enrichOne = this.planner.enrichUiActions;
    if (enrichOne === undefined) return actionsByScenario;
    await inPool(GROUNDING_CONCURRENCY, items, async (item) => {
      const actions = await enrichOne.call(this.planner, { ...base, scenario: item.scenario, grounding: item.grounding });
      actionsByScenario.set(item.scenario.id, actions);
    });
    return actionsByScenario;
  }
}

function blockingReasons(
  scenario: TestPlan['scenarios'][number],
  plan: TestPlan,
  runState: EngineRunState,
): readonly string[] {
  const reasons: string[] = [];
  for (const dependencyId of scenario.dependsOn ?? []) {
    const dependencyStatus = runState.scenarioStatus[dependencyId];
    if (dependencyStatus === undefined) {
      reasons.push(`Dependency ${dependencyId} has not completed before ${scenario.id}.`);
    } else if (dependencyStatus !== 'passed') {
      reasons.push(`Dependency ${dependencyId} finished with status ${dependencyStatus}.`);
    }
  }

  const producers = captureProducers(plan);
  for (const reference of collectScenarioReferences(scenario)) {
    if (isBuiltinWorkflowVariable(reference)) continue;
    const producerId = producers.get(reference);
    if (producerId === undefined) continue;
    const producerStatus = runState.scenarioStatus[producerId];
    if (producerStatus === undefined) {
      reasons.push(`Required value ${reference} is produced by ${producerId}, but that scenario has not completed.`);
    } else if (producerStatus !== 'passed') {
      reasons.push(`Required value ${reference} depends on ${producerId}, which finished with status ${producerStatus}.`);
    }
  }
  return [...new Set(reasons)];
}

function captureProducers(plan: TestPlan): ReadonlyMap<string, string> {
  const producers = new Map<string, string>();
  for (const scenario of plan.scenarios) {
    for (const capture of scenario.capture ?? []) producers.set(capture.name, scenario.id);
  }
  return producers;
}

function collectScenarioReferences(scenario: TestPlan['scenarios'][number]): readonly string[] {
  return collectWorkflowReferences({
    path: scenario.target?.path,
    request: scenario.request,
    expect: scenario.expect,
  });
}

function cleanupScenario(cleanup: ApiCleanupStep, index: number): TestPlan['scenarios'][number] {
  return {
    id: `cleanup_${index + 1}`,
    name: `Cleanup ${cleanup.target.method} ${cleanup.target.path}`,
    type: 'api',
    objective: 'Remove data created by earlier test scenarios.',
    target: {
      method: cleanup.target.method,
      path: cleanup.target.path,
      sourceOfTruth: 'user',
    },
    ...(cleanup.request !== undefined ? { request: cleanup.request } : {}),
    ...(cleanup.expect !== undefined ? { expect: cleanup.expect } : { expect: { status: { min: 200, max: 404 } } }),
    assertions: ['cleanup request completes with an accepted status'],
    evidenceRequired: ['api'],
  };
}

function formatValidationFailure(validation: ValidationResult): string {
  return `Plan validation failed: ${validation.issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`;
}

class StageFailure extends Error {
  constructor(readonly operationalIssue: OperationalIssue) {
    super(operationalIssue.message);
    this.name = 'StageFailure';
  }
}

function stageError(
  category: OperationalIssue['category'],
  stage: OperationalIssue['stage'],
  code: string,
  message: string,
): StageFailure {
  return new StageFailure(issue(category, stage, code, message, false));
}

function issue(
  category: OperationalIssue['category'],
  stage: OperationalIssue['stage'],
  code: string,
  message: string,
  recoverable: boolean,
  scenarioId?: string,
): OperationalIssue {
  return {
    category,
    stage,
    code,
    message: redactDiagnostic(message),
    recoverable,
    ...(scenarioId !== undefined ? { scenarioId } : {}),
  };
}

function buildOutcome(acceptedTests: number, issues: readonly OperationalIssue[], journalPath?: string): RunOutcome {
  return {
    schemaVersion: 'brisk-aitesting.run-outcome.v1',
    status: issues.length > 0 ? 'completed_with_diagnostics' : 'completed',
    terminalStage: 'completed',
    acceptedTests,
    issues,
    ...(journalPath !== undefined ? { journalPath } : {}),
  };
}

function emptyDiscovery(config: BriskAiTestingConfig, warning: string): DiscoveryResult {
  return {
    schemaVersion: 'brisk-aitesting.discovery.v1',
    app: {
      name: config.app.name,
      baseUrl: config.app.baseUrl,
      ...(config.app.repoPath !== undefined ? { repoPath: config.app.repoPath } : {}),
    },
    uiRoutes: [],
    apiRoutes: [],
    contracts: [],
    repoSignals: [],
    warnings: [warning],
    createdAt: new Date().toISOString(),
  };
}

function emptyPlan(runId: string, goal: string, discovery: DiscoveryResult): TestPlan {
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId,
    goal: goal.trim().length > 0 ? goal : '(invalid empty goal)',
    mode: 'automatic',
    scenarios: [],
    discovery,
    warnings: ['No executable plan was accepted.'],
    createdAt: new Date().toISOString(),
  };
}

function assertEnginesAvailable(plan: TestPlan, engines: readonly Engine[]): void {
  const unsupported = plan.scenarios.filter((scenario) => !engines.some((engine) => engine.canRun(scenario)));
  if (unsupported.length > 0) {
    throw stageError(
      'validation',
      'validation',
      'NO_EXECUTION_ENGINE',
      `Plan contains scenarios without an execution engine: ${unsupported.map((scenario) => `${scenario.id} (${scenario.type})`).join(', ')}.`,
    );
  }
}

function failedScenario(
  scenario: TestPlan['scenarios'][number],
  engine: string,
  category: NonNullable<ScenarioResult['failureCategory']>,
  diagnostics: readonly string[],
): ScenarioResult {
  const message = diagnostics.map(redactDiagnostic).join('; ');
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    type: scenario.type,
    engine,
    status: 'failed',
    durationMs: 0,
    assertions: scenario.assertions.map((name) => ({ name, status: 'failed', message })),
    artifacts: [],
    diagnostics: diagnostics.map(redactDiagnostic),
    failureCategory: category,
  };
}

/**
 * A scenario that never ran because something it depends on did not pass.
 * It is reported as blocked, not failed: nothing was proven either way.
 */
function blockedScenario(
  scenario: TestPlan['scenarios'][number],
  blockedBy: readonly string[],
): ScenarioResult {
  const message = blockedBy.map(redactDiagnostic).join('; ');
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    type: scenario.type,
    engine: 'dependency-gate',
    status: 'blocked',
    durationMs: 0,
    assertions: scenario.assertions.map((name) => ({ name, status: 'skipped', message })),
    artifacts: [],
    diagnostics: blockedBy.map(redactDiagnostic),
    failureCategory: 'dependency',
  };
}

function normalizeExecutableResult(result: ScenarioResult): ScenarioResult {
  if (result.status === 'passed' || result.status === 'failed') return result;
  // Prefer the category the engine assigned from structured knowledge.
  // Text matching is only the last resort for engines that assigned nothing.
  const diagnosticText = result.diagnostics.join(' ').toLowerCase();
  const category: NonNullable<ScenarioResult['failureCategory']> = result.failureCategory
    ?? (diagnosticText.includes('network policy')
      ? 'network'
      : result.status === 'blocked'
        ? 'dependency'
        : 'engine_internal');
  return {
    ...result,
    status: 'failed',
    assertions: result.assertions.map((assertion) => ({
      ...assertion,
      status: assertion.status === 'passed' ? 'passed' : 'failed',
    })),
    diagnostics: [...result.diagnostics, `Engine returned non-verdict status "${result.status}" for an accepted test.`],
    failureCategory: category,
  };
}

function normalizeOperationResult(result: ScenarioResult): ScenarioResult {
  if (result.status === 'passed' || result.status === 'failed') return result;
  return {
    ...result,
    status: 'failed',
    assertions: result.assertions.map((assertion) => ({ ...assertion, status: assertion.status === 'passed' ? 'passed' : 'failed' })),
    failureCategory: 'engine_internal',
  };
}

function isCompiledWorkflowScenario(scenario: TestPlan['scenarios'][number]): boolean {
  return scenario.metadata?.generatedBy === 'universal-semantic-compiler'
    && typeof scenario.metadata.intentScenarioId === 'string';
}

function aggregateCompiledWorkflowResults(
  entries: readonly { readonly scenario: TestPlan['scenarios'][number]; readonly result: ScenarioResult }[],
): readonly ScenarioResult[] {
  const groups = new Map<string, { readonly scenario: TestPlan['scenarios'][number]; readonly entries: {
    readonly scenario: TestPlan['scenarios'][number];
    readonly result: ScenarioResult;
  }[] }>();
  for (const entry of entries) {
    if (entry.scenario.metadata?.workflowPhase === 'cleanup') continue;
    const id = entry.scenario.metadata?.intentScenarioId;
    if (typeof id !== 'string') continue;
    const existing = groups.get(id);
    if (existing === undefined) {
      groups.set(id, { scenario: entry.scenario, entries: [entry] });
    } else {
      existing.entries.push(entry);
    }
  }
  return [...groups.entries()].map(([intentScenarioId, group]) => {
    const failed = group.entries.filter((entry) => entry.result.status !== 'passed' && entry.result.status !== 'blocked');
    const blocked = group.entries.filter((entry) => entry.result.status === 'blocked');
    const types = [...new Set(group.entries.map((entry) => entry.result.type))];
    const name = typeof group.scenario.metadata?.intentScenarioName === 'string'
      ? group.scenario.metadata.intentScenarioName
      : group.scenario.name;
    return {
      scenarioId: intentScenarioId,
      name,
      type: types.length === 1 ? types[0]! : 'custom',
      engine: 'universal-semantic-workflow',
      // A workflow with a real failure is failed; one that only has blocked
      // steps (its dependency failed elsewhere) is blocked, not failed.
      status: failed.length > 0 ? 'failed' : blocked.length > 0 ? 'blocked' : 'passed',
      durationMs: group.entries.reduce((total, entry) => total + entry.result.durationMs, 0),
      assertions: group.entries.flatMap((entry) => entry.result.assertions.map((assertion) => ({
        ...assertion,
        name: `[${entry.scenario.name}] ${assertion.name}`,
      }))),
      artifacts: group.entries.flatMap((entry) => entry.result.artifacts),
      diagnostics: group.entries.flatMap((entry) => entry.result.diagnostics.map((diagnostic) => `[${entry.scenario.name}] ${diagnostic}`)),
      ...((failed[0] ?? blocked[0])?.result.failureCategory !== undefined ? { failureCategory: (failed[0] ?? blocked[0])!.result.failureCategory } : {}),
      ...(failureReasonForGroup(failed[0] ?? blocked[0]) !== undefined
        ? { failureReason: failureReasonForGroup(failed[0] ?? blocked[0])! }
        : {}),
    };
  });
}

/**
 * The single line that explains a failed check: the failing step's own reason,
 * never the whole step-by-step record (which also contains successful steps).
 */
function failureReasonForGroup(entry: { readonly scenario: TestPlan['scenarios'][number]; readonly result: ScenarioResult } | undefined): string | undefined {
  if (entry === undefined) return undefined;
  const failedAssertion = entry.result.assertions.find((assertion) => assertion.status === 'failed');
  const detail = entry.result.failureReason
    ?? failedAssertion?.message
    ?? failedAssertion?.name
    ?? entry.result.diagnostics.at(-1);
  return detail === undefined ? undefined : `[${entry.scenario.name}] ${detail}`;
}

/** One plain status for a set of diagnostic codes, shared by both accountings. */
function checkStatusFromCodes(codes: readonly string[]): CheckAccounting['notReady'][number]['status'] {
  return codes.some((code) => code === 'NO_OPERATION_FOR_INTENT')
    ? 'unsupported'
    : codes.some((code) => code.startsWith('AMBIGUOUS'))
      ? 'ambiguous'
      : codes.some((code) => code.startsWith('MISSING') || code.includes('EVIDENCE'))
        ? 'needs-evidence'
        : 'not-ready';
}

/**
 * Count the checks in a plan that made it through planning. Delivered checks
 * are ready; checks planning had to drop ride plan.droppedScenarios and are
 * counted notReady with their reasons — the total is never hidden.
 */
function accountingFromPlan(plan: TestPlan, requested: number | undefined): CheckAccounting {
  const intentIds = new Set(plan.scenarios
    .map((scenario) => scenario.metadata?.intentScenarioId)
    .filter((id): id is string => typeof id === 'string'));
  const delivered = intentIds.size > 0 ? intentIds.size : plan.scenarios.length;
  const notReady = (plan.droppedScenarios ?? []).map((record) => ({
    checkId: record.id,
    name: record.name,
    status: checkStatusFromCodes(record.reasons.map((reason) => reason.split(':')[0] ?? '')),
    reasons: record.reasons,
  }));
  return {
    schemaVersion: 'brisk-aitesting.check-accounting.v1',
    ...(requested !== undefined ? { requested } : {}),
    understood: delivered + notReady.length,
    ready: delivered,
    notReady,
  };
}

/**
 * Count the checks when planning refused: which checks were understood, which
 * could not be prepared, and the plain reasons why. Nothing is hidden.
 */
function accountingFromCompilationError(error: SemanticCompilationError, requested: number | undefined): CheckAccounting {
  const notReady = error.intentScenarios.flatMap((scenario) => {
    const reasons = error.compilation.diagnostics
      .filter((diagnostic) => diagnostic.scenarioId === scenario.id)
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
    if (reasons.length === 0) return [];
    const codes = error.compilation.diagnostics
      .filter((diagnostic) => diagnostic.scenarioId === scenario.id)
      .map((diagnostic) => diagnostic.code);
    return [{ checkId: scenario.id, name: scenario.name, status: checkStatusFromCodes(codes), reasons }];
  });
  const understood = error.intentScenarios.length;
  return {
    schemaVersion: 'brisk-aitesting.check-accounting.v1',
    ...(requested !== undefined ? { requested } : {}),
    understood,
    ready: Math.max(0, understood - notReady.length),
    notReady,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutFailure(message)), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

class TimeoutFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutFailure';
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof TimeoutFailure || (error instanceof Error && /timed?\s*out|timeout/i.test(error.message));
}

function safeErrorMessage(error: unknown): string {
  return redactDiagnostic(error instanceof Error ? error.message : String(error));
}

function redactDiagnostic(value: string): string {
  return redactText(value);
}

function incompatibleUiActions(
  actions: readonly import('./types.js').UiActionPlan[],
  grounding: import('./types.js').UiGroundingEvidence,
): readonly string[] {
  const issues: string[] = [];
  for (const action of actions) {
    const element = grounding.elements.find((candidate) => candidate.id === action.evidenceId);
    if (element === undefined) {
      issues.push(`${action.action} references missing UI evidence ${action.evidenceId}`);
      continue;
    }
    const tag = element.tagName.toLowerCase();
    const role = element.role?.toLowerCase();
    if (action.action === 'fill' && !['input', 'textarea', 'select'].includes(tag) && !['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(role ?? '')) {
      issues.push(`fill cannot target ${tag}${role !== undefined ? ` role=${role}` : ''} (${action.evidenceId})`);
    }
    if (action.action === 'select' && tag !== 'select' && role !== 'combobox') {
      issues.push(`select cannot target ${tag}${role !== undefined ? ` role=${role}` : ''} (${action.evidenceId})`);
    }
    if (action.action === 'check' && element.inputType !== 'checkbox' && element.inputType !== 'radio' && !['checkbox', 'radio', 'switch'].includes(role ?? '')) {
      issues.push(`check cannot target ${tag}${role !== undefined ? ` role=${role}` : ''} (${action.evidenceId})`);
    }
  }
  return issues;
}

export function createBriskAiTesting(config: BriskAiTestingConfig | UserConfig, params?: {
  readonly discoverer?: Discoverer;
  readonly planner?: Planner;
  readonly validator?: PlanValidator;
  readonly engines?: readonly Engine[];
  readonly uiRouteGrounder?: UiRouteGrounder;
}): BriskAiTesting {
  return new BriskAiTesting(config, params);
}
