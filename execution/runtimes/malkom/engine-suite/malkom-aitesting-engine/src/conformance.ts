import type {
  AiPlannerProvider,
  ArtifactRef,
  BriskAiTestingConfig,
  BriskAiTestingRunInput,
  Discoverer,
  DiscoveryResult,
  Engine,
  EngineRunResult,
  Planner,
  PlanValidator,
  ScenarioPlan,
  TestPlan,
  UiRouteGrounder,
  ValidationResult,
} from './types.js';
import { containsObviousSecretLikeValue } from './secret-safety.js';

export interface EnginePluginConformanceCase {
  readonly engine: Engine;
  readonly validScenario: ScenarioPlan;
  readonly unrelatedScenario: ScenarioPlan;
}

export interface EnginePluginConformanceCheck {
  readonly name: string;
  readonly status: 'passed' | 'failed';
  readonly detail?: string;
}

export interface EnginePluginConformanceEngineReport {
  readonly name: string;
  readonly type: string;
  readonly status: 'passed' | 'failed';
  readonly checks: readonly EnginePluginConformanceCheck[];
  readonly errors: readonly string[];
}

export interface EnginePluginConformanceReport {
  readonly schemaVersion: 'brisk-aitesting.plugin-conformance.v1';
  readonly status: 'passed' | 'failed';
  readonly engines: readonly EnginePluginConformanceEngineReport[];
  readonly errors: readonly string[];
}

export interface ExtensionConformanceCase {
  readonly kind: 'discoverer' | 'planner' | 'validator' | 'ui-grounder' | 'ai-provider';
  readonly extension: Discoverer | Planner | PlanValidator | UiRouteGrounder | AiPlannerProvider;
  readonly expectFailure?: boolean;
}

export interface ExtensionConformanceExtensionReport {
  readonly name: string;
  readonly kind: ExtensionConformanceCase['kind'];
  readonly status: 'passed' | 'failed';
  readonly checks: readonly EnginePluginConformanceCheck[];
  readonly errors: readonly string[];
}

export interface ExtensionConformanceReport {
  readonly schemaVersion: 'brisk-aitesting.extension-conformance.v1';
  readonly status: 'passed' | 'failed';
  readonly extensions: readonly ExtensionConformanceExtensionReport[];
  readonly errors: readonly string[];
}

export async function runEnginePluginConformance(params: {
  readonly config: BriskAiTestingConfig;
  readonly plan: TestPlan;
  readonly cases: readonly EnginePluginConformanceCase[];
  readonly runId?: string;
}): Promise<EnginePluginConformanceReport> {
  const engines = [];
  const errors = [];

  for (const engineCase of params.cases) {
    const report = await checkEngine({
      config: params.config,
      plan: params.plan,
      runId: params.runId ?? 'plugin_conformance',
      engine: engineCase.engine,
      validScenario: engineCase.validScenario,
      unrelatedScenario: engineCase.unrelatedScenario,
    });
    engines.push(report);
    errors.push(...report.errors.map((error) => `${engineCase.engine.name}: ${error}`));
  }

  return {
    schemaVersion: 'brisk-aitesting.plugin-conformance.v1',
    status: errors.length === 0 ? 'passed' : 'failed',
    engines,
    errors,
  };
}

export async function runExtensionConformance(params: {
  readonly config: BriskAiTestingConfig;
  readonly plan: TestPlan;
  readonly input: BriskAiTestingRunInput;
  readonly cases: readonly ExtensionConformanceCase[];
  readonly runId?: string;
}): Promise<ExtensionConformanceReport> {
  const extensions = [];
  const errors = [];

  for (const extensionCase of params.cases) {
    const report = await checkExtension({
      ...params,
      runId: params.runId ?? 'extension_conformance',
      extensionCase,
    });
    extensions.push(report);
    if (extensionCase.expectFailure === true) {
      if (report.status !== 'failed') errors.push(`${report.name}: expected failure but passed`);
    } else {
      errors.push(...report.errors.map((error) => `${report.name}: ${error}`));
    }
  }

  return {
    schemaVersion: 'brisk-aitesting.extension-conformance.v1',
    status: errors.length === 0 ? 'passed' : 'failed',
    extensions,
    errors,
  };
}

async function checkExtension(params: {
  readonly config: BriskAiTestingConfig;
  readonly plan: TestPlan;
  readonly input: BriskAiTestingRunInput;
  readonly runId: string;
  readonly extensionCase: ExtensionConformanceCase;
}): Promise<ExtensionConformanceExtensionReport> {
  const checks: EnginePluginConformanceCheck[] = [];
  const errors: string[] = [];
  const extension = params.extensionCase.extension;
  const record = (name: string, passed: boolean, detail?: string): void => {
    const check = detail === undefined
      ? { name, status: passed ? 'passed' as const : 'failed' as const }
      : { name, status: passed ? 'passed' as const : 'failed' as const, detail };
    checks.push(check);
    if (!passed) errors.push(detail === undefined ? name : `${name}: ${detail}`);
  };

  record('name is non-empty', typeof extension.name === 'string' && extension.name.trim().length > 0);

  try {
    if (params.extensionCase.kind === 'discoverer') {
      const output = await (extension as Discoverer).discover({ config: params.config, input: params.input, runId: params.runId });
      validateDiscoveryOutput(output, record);
    } else if (params.extensionCase.kind === 'planner') {
      const output = await (extension as Planner).plan({ config: params.config, input: params.input, runId: params.runId, discovery: params.plan.discovery });
      validatePlanOutput(output, record);
    } else if (params.extensionCase.kind === 'validator') {
      const output = await (extension as PlanValidator).validate({ config: params.config, input: params.input, plan: params.plan });
      validateValidationOutput(output, record);
    } else if (params.extensionCase.kind === 'ui-grounder') {
      const scenario = params.plan.scenarios.find((entry) => entry.type === 'ui') ?? params.plan.scenarios[0];
      if (scenario === undefined) {
        record('ui scenario exists for grounder check', false);
      } else {
        const output = await (extension as UiRouteGrounder).ground({ config: params.config, runId: params.runId, scenario });
        validateUiGrounderOutput(output, record);
      }
    } else {
      const output = await (extension as AiPlannerProvider).complete({
        system: 'Return a valid brisk-aitesting plan JSON object.',
        user: params.input.goal,
        jsonSchemaName: 'brisk-aitesting.plan.v1',
      });
      validateAiProviderOutput(output, record);
    }
  } catch (error) {
    record('extension call completes', false, error instanceof Error ? error.message : String(error));
  }

  record('extension output has no obvious secret leakage', !containsObviousSecretLikeValue(checks));

  return {
    name: extension.name,
    kind: params.extensionCase.kind,
    status: errors.length === 0 ? 'passed' : 'failed',
    checks,
    errors,
  };
}

function validateDiscoveryOutput(output: DiscoveryResult, record: (name: string, passed: boolean, detail?: string) => void): void {
  record('discoverer returns discovery object', isRecord(output));
  if (!isRecord(output)) return;
  record('discovery schema version is valid', output.schemaVersion === 'brisk-aitesting.discovery.v1');
  record('discovery uiRoutes is an array', Array.isArray(output.uiRoutes));
  record('discovery apiRoutes is an array', Array.isArray(output.apiRoutes));
  record('discovery contracts is an array', Array.isArray(output.contracts));
  record('discovery warnings is an array', Array.isArray(output.warnings));
}

function validatePlanOutput(output: TestPlan, record: (name: string, passed: boolean, detail?: string) => void): void {
  record('planner returns plan object', isRecord(output));
  if (!isRecord(output)) return;
  record('plan schema version is valid', output.schemaVersion === 'brisk-aitesting.plan.v1');
  record('plan scenarios is a non-empty array', Array.isArray(output.scenarios) && output.scenarios.length > 0);
  record('plan warnings is an array', Array.isArray(output.warnings));
}

function validateValidationOutput(output: ValidationResult, record: (name: string, passed: boolean, detail?: string) => void): void {
  record('validator returns validation object', isRecord(output));
  if (!isRecord(output)) return;
  record('validation schema version is valid', output.schemaVersion === 'brisk-aitesting.validation.v1');
  record('validation valid is boolean', typeof output.valid === 'boolean');
  record('validation issues is an array', Array.isArray(output.issues));
}

function validateUiGrounderOutput(output: Awaited<ReturnType<UiRouteGrounder['ground']>>, record: (name: string, passed: boolean, detail?: string) => void): void {
  record('ui grounder returns output object', isRecord(output));
  if (!isRecord(output)) return;
  record('ui grounding schema version is valid', output.grounding?.schemaVersion === 'brisk-aitesting.ui-grounding.v1');
  record('ui grounding elements is an array', Array.isArray(output.grounding?.elements));
  record('ui grounder artifacts is an array', Array.isArray(output.artifacts));
}

function validateAiProviderOutput(output: Awaited<ReturnType<AiPlannerProvider['complete']>>, record: (name: string, passed: boolean, detail?: string) => void): void {
  record('ai provider returns output object', isRecord(output));
  if (!isRecord(output)) return;
  record('ai provider content is non-empty', typeof output.content === 'string' && output.content.trim().length > 0);
  record('ai provider content is not executable code only', !/^\s*(import|const|let|var|function)\s/m.test(output.content));
}

async function checkEngine(params: {
  readonly config: BriskAiTestingConfig;
  readonly plan: TestPlan;
  readonly runId: string;
  readonly engine: Engine;
  readonly validScenario: ScenarioPlan;
  readonly unrelatedScenario: ScenarioPlan;
}): Promise<EnginePluginConformanceEngineReport> {
  const checks: EnginePluginConformanceCheck[] = [];
  const errors: string[] = [];
  const record = (name: string, passed: boolean, detail?: string): void => {
    const check = detail === undefined
      ? { name, status: passed ? 'passed' as const : 'failed' as const }
      : { name, status: passed ? 'passed' as const : 'failed' as const, detail };
    checks.push(check);
    if (!passed) errors.push(detail === undefined ? name : `${name}: ${detail}`);
  };

  record('name is non-empty', typeof params.engine.name === 'string' && params.engine.name.trim().length > 0);
  record('type is valid', ['ui', 'api', 'contract', 'schema', 'replay', 'message', 'custom'].includes(params.engine.type));
  record('canRun accepts own scenario', params.engine.canRun(params.validScenario) === true);
  record('canRun rejects unrelated scenario', params.engine.canRun(params.unrelatedScenario) === false);

  let output: EngineRunResult | undefined;
  try {
    output = await runWithTimeout(params.engine.run({
      config: params.config,
      runId: params.runId,
      plan: params.plan,
      scenario: params.validScenario,
      runState: { variables: {}, captures: {}, cleanup: [], scenarioStatus: {} },
    }), params.config.runtime.timeoutMs);
    record('run returns output object', isRecord(output));
  } catch (error) {
    record('run returns output object', false, error instanceof Error ? error.message : String(error));
  }

  if (output !== undefined) validateEngineOutput(output, params.validScenario, record);

  return {
    name: params.engine.name,
    type: params.engine.type,
    status: errors.length === 0 ? 'passed' : 'failed',
    checks,
    errors,
  };
}

async function runWithTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Engine exceeded runtime timeout of ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function validateEngineOutput(
  output: EngineRunResult,
  scenario: ScenarioPlan,
  record: (name: string, passed: boolean, detail?: string) => void,
): void {
  const result = output.result;
  record('result exists', isRecord(result));
  if (!isRecord(result)) return;

  record('result.scenarioId matches scenario', result.scenarioId === scenario.id);
  record('result.name is non-empty', typeof result.name === 'string' && result.name.trim().length > 0);
  record('result.type matches scenario', result.type === scenario.type);
  record('result.engine is non-empty', typeof result.engine === 'string' && result.engine.trim().length > 0);
  record('result.status is valid', ['passed', 'failed', 'error', 'skipped', 'blocked'].includes(result.status as string));
  record('valid scenario passes', result.status === 'passed', String(result.status));
  record('result.durationMs is a finite number', typeof result.durationMs === 'number' && Number.isFinite(result.durationMs));
  record('result.assertions is an array', Array.isArray(result.assertions));
  record('result.artifacts is an array', Array.isArray(result.artifacts));
  record('result.diagnostics is an array', Array.isArray(result.diagnostics));
  record('result has no obvious secret leakage', !containsObviousSecretLikeValue(result));

  if (Array.isArray(result.assertions)) {
    for (const [index, assertion] of result.assertions.entries()) {
      record(`assertion ${index + 1} shape is valid`, isValidAssertion(assertion), JSON.stringify(assertion));
    }
  }

  if (Array.isArray(result.artifacts)) {
    for (const [index, artifact] of result.artifacts.entries()) {
      record(`artifact ${index + 1} shape is valid`, isValidArtifact(artifact), JSON.stringify(artifact));
    }
  }

  if (output.artifacts !== undefined) {
    record('output.artifacts is an array when provided', Array.isArray(output.artifacts));
    if (Array.isArray(output.artifacts)) {
      record('output artifacts have no obvious secret leakage', !containsObviousSecretLikeValue(output.artifacts));
      for (const [index, artifact] of output.artifacts.entries()) {
        record(`output artifact ${index + 1} shape is valid`, isValidArtifact(artifact), JSON.stringify(artifact));
      }
    }
  }
}

function isValidAssertion(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string'
    && ['passed', 'failed', 'error', 'skipped', 'blocked'].includes(String(value.status))
    && (value.message === undefined || typeof value.message === 'string');
}

function isValidArtifact(value: unknown): value is ArtifactRef {
  if (!isRecord(value)) return false;
  return ['json', 'junit', 'html', 'trace', 'screenshot', 'video', 'test-file', 'log', 'other'].includes(String(value.kind))
    && (value.path === undefined || typeof value.path === 'string')
    && (value.url === undefined || typeof value.url === 'string')
    && typeof value.label === 'string'
    && value.label.trim().length > 0
    && (value.metadata === undefined || isRecord(value.metadata));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
