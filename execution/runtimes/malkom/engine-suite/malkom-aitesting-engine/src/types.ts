import type { CapabilityAdapter, EvidenceGraph, FixtureProvisioningRecordV1, FixtureSourcingPolicy } from './compiler-types.js';
import type { EvidenceProvider } from './pipeline-stage-contracts.js';

export type EngineType = 'ui' | 'api' | 'contract' | 'schema' | 'replay' | 'message' | 'custom';
export type BriskAiTestingStatus = 'passed' | 'failed' | 'error' | 'skipped' | 'blocked';
export type RunStage = 'accepted' | 'discovery' | 'planning' | 'validation' | 'grounding' | 'execution' | 'cleanup' | 'reporting' | 'persistence' | 'completed';
export type OperationalIssueCategory = 'input' | 'discovery' | 'planning' | 'validation' | 'dependency' | 'precondition' | 'engine_internal' | 'timeout' | 'network' | 'cleanup' | 'reporting' | 'persistence' | 'interrupted';

export interface OperationalIssue {
  readonly category: OperationalIssueCategory;
  readonly stage: RunStage;
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly scenarioId?: string;
}

export interface RunOutcome {
  readonly schemaVersion: 'brisk-aitesting.run-outcome.v1';
  readonly status: 'completed' | 'completed_with_diagnostics' | 'recovered';
  readonly terminalStage: 'completed';
  readonly acceptedTests: number;
  readonly issues: readonly OperationalIssue[];
  readonly journalPath?: string;
}

export interface AppConfig {
  readonly name: string;
  readonly baseUrl: string;
  /** Where the app's PAGES live when that differs from the API address (common in development, e.g. API :3000, web :5173). UI tests use this; API tests use baseUrl. */
  readonly uiBaseUrl?: string;
  readonly repoPath?: string;
  readonly env?: 'local' | 'ci' | 'staging' | 'production-like';
}

export type AuthConfig =
  | {
      readonly type: 'none';
    }
  | {
      readonly type: 'credentials';
      readonly loginUrl?: string;
      readonly username: string;
      readonly password: string;
      /** Field name for the username in the login request body. Default: "username", or "email" when the username looks like an email address. */
      readonly usernameField?: string;
      /** Field name for the password in the login request body. Default: "password". */
      readonly passwordField?: string;
      /** Where the token lives in the login answer, for example "data.access_token". Without it, common places are tried. */
      readonly tokenPath?: string;
    }
  | {
      readonly type: 'bearer';
      readonly token: string;
    }
  | {
      readonly type: 'custom';
      readonly description: string;
      readonly metadata?: Record<string, unknown>;
    };

export interface AiProviderConfig {
  /** One neutral built-in path: any chat-completions-compatible endpoint. No vendor or model names are hardcoded; the host supplies endpoint, model, and key. */
  readonly provider: 'openai-compatible';
  readonly model: string;
  readonly apiKey?: string;
  readonly apiKeyEnv?: string;
  readonly endpoint?: string;
  readonly caCertPath?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly repairAttempts?: number;
}

export interface ContractConfig {
  readonly openApiPath?: string;
  readonly asyncApiPath?: string;
  readonly pactDir?: string;
}

export interface RuntimeConfig {
  readonly artifactsDir: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly headless: boolean;
  readonly dryRun: boolean;
  /**
   * Absolute path to a Chromium/Chrome executable to launch instead of
   * Playwright's downloaded browser. For hosts where downloading a browser
   * is impossible or forbidden (locked-down CI, air-gapped machines, system
   * packages). Env: BRISK_AITESTING_BROWSER_EXECUTABLE_PATH.
   */
  readonly browserExecutablePath?: string;
}

export interface DiscoveryConfig {
  readonly includeRepo: boolean;
  readonly includeUi: boolean;
  readonly includeApi: boolean;
  readonly includeContracts: boolean;
  readonly maxSourceFiles: number;
  readonly uiRoutes: readonly string[];
  readonly apiRoutes: readonly { readonly method: string; readonly path: string }[];
}

export interface SecurityConfig {
  readonly networkPolicy: 'localhost-only' | 'allowlist' | 'open';
  readonly allowedHosts: readonly string[];
  readonly redactSecrets: boolean;
  readonly strictMode?: boolean;
  readonly allowFallbackTargets?: boolean;
  readonly allowAiTargets?: boolean;
  readonly allowHeuristicWorkflowCapture?: boolean;
  readonly uiHealing?: 'off' | 'safe' | 'aggressive';
  readonly allowLegacyFullContextEvidenceProviders?: boolean;
  readonly requireEvidenceProviderTenantId?: boolean;
  readonly requireEvidenceWorkerHostIsolation?: boolean;
}

export interface PlanningConfig {
  readonly repairAttempts?: number;
  /**
   * How missing test data is sourced. 'require-existing' (default) never
   * creates business entities: a scenario whose required value has no existing
   * data fails honestly with a precondition diagnosis. 'provision-when-missing'
   * lets the compiler provision a fixture from a declared host/contract
   * creation operation, but only when that operation declares a working
   * cleanupOperationId so the fixture never leaves residue.
   */
  readonly fixtures?: FixtureSourcingPolicy;
  readonly evidenceAcquisitionRounds?: number;
  readonly evidenceProviderTimeoutMs?: number;
  readonly evidenceCacheTtlMs?: number;
  readonly evidenceCacheMaxEntries?: number;
  readonly evidenceMaxResponseBytes?: number;
  readonly evidenceMaxGraphsPerResponse?: number;
  readonly evidenceMaxOperationsPerResponse?: number;
  readonly evidenceMaxArtifactsPerResponse?: number;
}

export interface BriskAiTestingConfig {
  readonly app: AppConfig;
  readonly auth: AuthConfig;
  readonly ai?: AiProviderConfig;
  readonly planning?: PlanningConfig;
  readonly contracts?: ContractConfig;
  readonly runtime: RuntimeConfig;
  readonly discovery: DiscoveryConfig;
  readonly security: SecurityConfig;
  readonly engines?: readonly Engine[];
  readonly discoverer?: Discoverer;
  readonly validator?: PlanValidator;
  readonly aiProvider?: AiPlannerProvider;
  readonly capabilityAdapters?: readonly CapabilityAdapter[];
  readonly evidenceProviders?: readonly EvidenceProvider[];
}

export interface BriskAiTestingRunInput {
  readonly goal: string;
  readonly scenarios?: number;
  readonly scenarioCountPolicy?: 'exact' | 'at-least' | 'at-most' | 'flexible';
  readonly mode?: 'automatic' | EngineType;
  readonly requiredTypes?: readonly EngineType[];
  readonly uiActionFeedback?: 'off' | 'when-missing' | 'always';
  readonly tags?: readonly string[];
  readonly tenantId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly authoritativeOperations?: readonly AuthoritativeOperation[];
  readonly evidenceGraph?: EvidenceGraph;
}

export interface AuthoritativeOperation {
  readonly operationId?: string;
  readonly method: string;
  readonly path: string;
  readonly requiredBodyFields?: readonly string[];
  readonly successStatusCodes?: readonly number[];
  readonly source: 'contract' | 'host-adapter' | 'runtime';
}

export interface ScenarioPlan {
  readonly id: string;
  readonly name: string;
  readonly type: EngineType;
  readonly objective: string;
  readonly target?: {
    readonly method?: string;
    readonly path?: string;
    readonly route?: string;
    readonly schema?: string;
    readonly channel?: string;
    readonly sourceOfTruth?: 'user' | 'observed' | 'contract' | 'ai' | 'fallback';
  };
  readonly request?: {
    readonly headers?: Record<string, string>;
    readonly query?: Record<string, string | number | boolean>;
    readonly body?: unknown;
  };
  readonly expect?: {
    readonly status?: number | readonly number[] | {
      readonly min?: number;
      readonly max?: number;
    };
    readonly json?: Record<string, unknown>;
    readonly contains?: string;
    readonly unchanged?: readonly ApiStateSnapshotExpectation[];
  };
  readonly assertions: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly capture?: readonly WorkflowCapture[];
  readonly cleanup?: readonly ApiCleanupStep[];
  readonly uiActions?: readonly UiActionPlan[];
  readonly evidenceRequired: readonly ('repo' | 'ui' | 'api' | 'schema' | 'auth' | 'message')[];
  readonly metadata?: Record<string, unknown>;
}

export interface WorkflowCapture {
  readonly name: string;
  readonly from: 'response.body' | 'response.header';
  readonly path: string;
}

export interface ApiCleanupStep {
  readonly type: 'api';
  readonly target: {
    readonly method: 'DELETE' | 'POST';
    readonly path: string;
  };
  readonly request?: {
    readonly headers?: Record<string, string>;
    readonly query?: Record<string, string | number | boolean>;
    readonly body?: unknown;
  };
  readonly expect?: {
    readonly status?: number | readonly number[] | {
      readonly min?: number;
      readonly max?: number;
    };
  };
}

export interface ApiStateSnapshotExpectation {
  readonly name?: string;
  readonly target: {
    readonly method?: string;
    readonly path: string;
  };
  readonly request?: {
    readonly headers?: Record<string, string>;
    readonly query?: Record<string, string | number | boolean>;
    readonly body?: unknown;
  };
  readonly json?: Record<string, unknown>;
}

export type UiActionPlan =
  | {
      readonly action: 'fill';
      readonly evidenceId: string;
      readonly value: string;
      readonly description?: string;
    }
  | {
      readonly action: 'click' | 'check';
      readonly evidenceId: string;
      readonly description?: string;
    }
  | {
      readonly action: 'select';
      readonly evidenceId: string;
      readonly value: string;
      readonly description?: string;
    }
  | {
      readonly action: 'press';
      readonly evidenceId: string;
      readonly key: string;
      readonly description?: string;
    }
  | {
      readonly action: 'assertText';
      readonly evidenceId: string;
      readonly text: string;
      readonly description?: string;
    };

export interface AcquisitionRecompilationDecisionV1 {
  readonly schemaVersion: 'brisk-aitesting.acquisition-recompilation-decision.v1';
  readonly id: string;
  readonly round: number;
  readonly outcome: 'recompiled' | 'completed' | 'stopped';
  readonly reasonCode: 'EVIDENCE_ACQUIRED' | 'NO_ACQUIRABLE_REQUIREMENT' | 'NO_ELIGIBLE_PROVIDER' | 'NO_USABLE_EVIDENCE' | 'IRRELEVANT_EVIDENCE' | 'CONTRADICTORY_EVIDENCE' | 'MAX_ROUNDS_REACHED';
  readonly explanation: string;
  readonly requirementIds: readonly string[];
  readonly affectedScenarioIds: readonly string[];
  readonly recompiledScenarioIds: readonly string[];
  readonly preservedScenarioIds: readonly string[];
  readonly attemptedProviderIds: readonly string[];
  readonly cacheHitProviderIds: readonly string[];
  readonly acquiredGraphRevisions: readonly string[];
  readonly conflictIds: readonly string[];
  readonly diagnosticCodes: readonly string[];
  readonly beforeEvidenceRevision: string;
  readonly afterEvidenceRevision: string;
  readonly beforeEvidenceDigest: string;
  readonly afterEvidenceDigest: string;
  readonly authorityPolicyDigest: string;
  readonly compilationStatus: 'compiled' | 'needs-evidence' | 'ambiguous' | 'unsupported';
}

/** A check planning had to drop, named with the exact reasons it could not compile. */
export interface DroppedScenarioRecordV1 {
  readonly id: string;
  readonly name: string;
  readonly reasons: readonly string[];
}

export interface TestPlan {
  readonly schemaVersion: 'brisk-aitesting.plan.v1';
  readonly runId: string;
  readonly goal: string;
  readonly mode: 'automatic' | EngineType;
  readonly scenarios: readonly ScenarioPlan[];
  readonly discovery: DiscoveryResult;
  readonly warnings: readonly string[];
  /**
   * Checks that could not be compiled into safe steps even after the repair
   * rounds. The rest of the plan ships without them: requested minus these
   * records is what the plan delivers, and the count gate accounts for them.
   */
  readonly droppedScenarios?: readonly DroppedScenarioRecordV1[];
  readonly evidenceDecisions?: readonly AcquisitionRecompilationDecisionV1[];
  /**
   * How each data-dependent value was sourced: provisioned as a self-cleaning
   * fixture, confirmed to exist live, found empty, or impossible to provision
   * safely. Present whenever fixture sourcing had a decision to record, so the
   * user knows before running whether a check depends on data that is not there.
   */
  readonly fixtureProvisioning?: readonly FixtureProvisioningRecordV1[];
  readonly createdAt: string;
  /**
   * What the user actually asked for versus what it takes to run it.
   * `checks` is the number the user sees and requested (one business journey
   * each). `executableSteps` is how many individual requests or page opens
   * those checks compile into. A host must show `checks`, never the steps.
   */
  readonly counts?: {
    readonly requested?: number;
    readonly checks: number;
    readonly executableSteps: number;
  };
}

/** Plain words for each engine type, so a host never has to show a bare code. */
export const engineTypeLabels: Readonly<Record<EngineType, string>> = {
  ui: 'Screen',
  api: 'API',
  contract: 'Contract',
  schema: 'Data shape',
  replay: 'Replay',
  message: 'Message',
  custom: 'Mixed journey',
};

export interface DiscoveryRoute {
  readonly path: string;
  readonly source: 'config' | 'repo' | 'runtime' | 'contract';
  readonly confidence: number;
}

export interface DiscoveryApiRoute {
  readonly method: string;
  readonly path: string;
  readonly source: 'repo' | 'runtime' | 'contract' | 'config';
  readonly confidence: number;
  readonly operationId?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly contractPath?: string;
  readonly statusCodes?: readonly number[];
  readonly requestBodyRequired?: boolean;
}

export interface DiscoveryContract {
  readonly kind: 'openapi' | 'asyncapi' | 'pact' | 'unknown';
  readonly path: string;
  readonly exists: boolean;
  readonly operations?: number;
  readonly errors?: readonly string[];
}

export interface ContractDriftRoute {
  readonly method: string;
  readonly path: string;
  readonly source?: DiscoveryApiRoute['source'];
  readonly confidence?: number;
  readonly operationId?: string;
  readonly contractPath?: string;
}

export interface ContractDriftReport {
  readonly schemaVersion: 'brisk-aitesting.contract-drift.v1';
  readonly kind: 'openapi';
  readonly contractPath?: string;
  readonly implementedRoutes: readonly ContractDriftRoute[];
  readonly documentedRoutes: readonly ContractDriftRoute[];
  readonly matchedRoutes: readonly {
    readonly method: string;
    readonly path: string;
    readonly implementation: ContractDriftRoute;
    readonly contract: ContractDriftRoute;
  }[];
  readonly implementedButUndocumented: readonly ContractDriftRoute[];
  readonly documentedButNotImplemented: readonly ContractDriftRoute[];
  readonly diagnostics: readonly string[];
}

export interface OpenApiOperationSummary {
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly summary?: string;
  readonly tags: readonly string[];
  readonly statusCodes: readonly number[];
  readonly requestBodyRequired: boolean;
  readonly requestContentTypes: readonly string[];
  readonly requestSchema?: unknown;
  readonly requestExample?: unknown;
  readonly invalidRequestExample?: unknown;
  readonly responseContentTypes: readonly string[];
  readonly responseSchemas: readonly OpenApiResponseSummary[];
}

export interface OpenApiResponseSummary {
  readonly statusCode: number;
  readonly contentType?: string;
  readonly schema?: unknown;
}

export interface OpenApiDocumentSummary {
  readonly schemaVersion: 'brisk-aitesting.openapi-summary.v1';
  readonly path: string;
  readonly format: 'json' | 'yaml';
  readonly title?: string;
  readonly version?: string;
  readonly openapiVersion?: string;
  readonly operations: readonly OpenApiOperationSummary[];
  readonly diagnostics: readonly string[];
}

export interface DiscoveryResult {
  readonly schemaVersion: 'brisk-aitesting.discovery.v1';
  readonly app: Pick<AppConfig, 'name' | 'baseUrl' | 'repoPath'>;
  readonly uiRoutes: readonly DiscoveryRoute[];
  readonly apiRoutes: readonly DiscoveryApiRoute[];
  readonly contracts: readonly DiscoveryContract[];
  readonly contractDrift?: ContractDriftReport;
  readonly repoSignals: readonly {
    readonly kind: 'framework' | 'package' | 'test-runner' | 'source-file';
    readonly value: string;
    readonly source: string;
  }[];
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface ArtifactRef {
  readonly kind: 'json' | 'junit' | 'html' | 'trace' | 'screenshot' | 'video' | 'test-file' | 'log' | 'other';
  readonly path?: string;
  readonly url?: string;
  readonly label: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UiElementEvidence {
  readonly id: string;
  readonly kind: 'role' | 'label' | 'text' | 'testId' | 'css';
  readonly role?: string;
  readonly label?: string;
  readonly text?: string;
  readonly testId?: string;
  readonly css?: string;
  readonly tagName: string;
  readonly inputType?: string;
  readonly locator: {
    readonly strategy: 'role' | 'label' | 'text' | 'testId' | 'css';
    readonly value: string;
  };
  readonly confidence: number;
}

export interface UiGroundingEvidence {
  readonly schemaVersion: 'brisk-aitesting.ui-grounding.v1';
  readonly scenario: {
    readonly id: string;
    readonly name: string;
    readonly objective: string;
  };
  readonly route: string;
  readonly url: string;
  readonly title: string;
  readonly capturedAt: string;
  readonly elements: readonly UiElementEvidence[];
  readonly summary: {
    readonly total: number;
    readonly roles: Record<string, number>;
    readonly labels: number;
    readonly testIds: number;
    readonly actionable: number;
  };
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly name: string;
  readonly type: EngineType;
  readonly engine: string;
  readonly status: BriskAiTestingStatus;
  readonly durationMs: number;
  readonly assertions: readonly {
    readonly name: string;
    readonly status: BriskAiTestingStatus;
    readonly message?: string;
  }[];
  readonly artifacts: readonly ArtifactRef[];
  readonly diagnostics: readonly string[];
  /**
   * 'precondition' means the app had no data to test against: every earlier
   * producing step succeeded, but returned nothing to capture. That is neither
   * an application defect nor a harness defect — the environment lacked data.
   */
  readonly failureCategory?: 'application_assertion' | 'dependency' | 'precondition' | 'engine_internal' | 'timeout' | 'network';
  /**
   * The one thing that went wrong, in a single line. `diagnostics` keeps the
   * full step-by-step record for evidence, including successful steps, so a
   * host must show this line as the failure and never the whole record.
   */
  readonly failureReason?: string;
}

/**
 * Honest bookkeeping of the user's requested checks (vision: the total must
 * never be hidden). "requested" is the number the user asked for when they
 * gave one; "understood" is how many separate checks the request was divided
 * into; "ready" is how many were fully prepared and safe to execute;
 * "notReady" lists every check that could not be prepared, with reasons.
 */
export interface CheckAccounting {
  readonly schemaVersion: 'brisk-aitesting.check-accounting.v1';
  readonly requested?: number;
  readonly understood: number;
  readonly ready: number;
  readonly notReady: readonly {
    readonly checkId: string;
    readonly name?: string;
    readonly status: 'ambiguous' | 'unsupported' | 'needs-evidence' | 'not-ready';
    readonly reasons: readonly string[];
  }[];
}

export interface BriskAiTestingResult {
  readonly schemaVersion: 'brisk-aitesting.result.v1';
  readonly runId: string;
  readonly status: BriskAiTestingStatus;
  readonly verdict: 'passed' | 'failed' | 'not_run';
  readonly outcome: RunOutcome;
  readonly app: Pick<AppConfig, 'name' | 'baseUrl' | 'env'>;
  readonly goal: string;
  readonly discovery: DiscoveryResult;
  readonly plan: TestPlan;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    /** Tests that never ran because a dependency did not pass. Not failures, not passes. */
    readonly blocked: number;
    readonly errors: number;
    readonly passRate: number;
    readonly durationMs: number;
  };
  /** Present whenever the run knows how the request divided into checks. */
  readonly checks?: CheckAccounting;
  /** What the run spent on AI: calls, tokens, fingerprints. No prompts, no secrets. */
  readonly ai?: import('./ai-usage.js').AiUsage;
  /** Where the time went, stage by stage. Always present; empty only on very early failures. */
  readonly timings?: readonly StageTiming[];
  readonly tests: readonly ScenarioResult[];
  readonly operations: readonly ScenarioResult[];
  readonly artifacts: readonly ArtifactRef[];
  readonly diagnosis: readonly {
    readonly scenarioId?: string;
    readonly reason: string;
    readonly suggestedFixes: readonly string[];
  }[];
  readonly handover: HandoverEnvelope;
}

export interface HandoverEnvelope {
  readonly schemaVersion: 'brisk-aitesting.handover.v1';
  readonly generatedAt: string;
  readonly resultSchema: 'brisk-aitesting.result.v1';
  readonly storage: {
    readonly required: false;
    readonly recommendedKeys: readonly string[];
    readonly artifactRoot: string;
  };
  readonly consumers: {
    readonly database: 'store result JSON as-is or split summary/tests/artifacts';
    readonly ci: 'use status, summary, artifacts, and junit/html outputs';
    readonly dashboard: 'render summary, tests, artifacts, and diagnosis';
  };
}

export interface PlannerContext {
  readonly config: BriskAiTestingConfig;
  readonly input: BriskAiTestingRunInput;
  readonly runId: string;
  readonly discovery: DiscoveryResult;
  /** Optional live progress report: phase name + plain-words detail. */
  readonly onPhase?: (phase: string, detail?: string) => void;
  /** Optional stopwatch report: stage name + how long it took. */
  readonly onTiming?: (stage: string, ms: number, detail?: string) => void;
  readonly signal?: AbortSignal;
}

export interface PlannerRepairContext extends PlannerContext {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly invalidPlan: TestPlan;
  readonly validation: ValidationResult;
}

export interface UiActionEnrichmentContext extends PlannerContext {
  readonly scenario: ScenarioPlan;
  readonly grounding: UiGroundingEvidence;
}

export interface UiActionBatchEnrichmentContext extends PlannerContext {
  readonly items: readonly {
    readonly scenario: ScenarioPlan;
    readonly grounding: UiGroundingEvidence;
  }[];
}

export interface UiActionBatchEnrichmentResult {
  readonly scenarioId: string;
  readonly actions: readonly UiActionPlan[];
}

export interface DiscovererContext {
  readonly config: BriskAiTestingConfig;
  readonly input: BriskAiTestingRunInput;
  readonly runId: string;
}

export interface Discoverer {
  readonly name: string;
  discover(context: DiscovererContext): Promise<DiscoveryResult>;
}

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly schemaVersion: 'brisk-aitesting.validation.v1';
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface PlanValidatorContext {
  readonly config: BriskAiTestingConfig;
  readonly input: BriskAiTestingRunInput;
  readonly plan: TestPlan;
}

export interface PlanValidator {
  readonly name: string;
  validate(context: PlanValidatorContext): Promise<ValidationResult> | ValidationResult;
}

export interface Planner {
  readonly name: string;
  plan(context: PlannerContext): Promise<TestPlan>;
  repair?(context: PlannerRepairContext): Promise<TestPlan>;
  enrichUiActions?(context: UiActionEnrichmentContext): Promise<readonly UiActionPlan[]>;
  /**
   * Enrich every grounded UI scenario in one call. When present, the
   * orchestrator prefers this over per-scenario enrichUiActions: one AI
   * round-trip instead of one per scenario.
   */
  enrichUiActionsForScenarios?(context: UiActionBatchEnrichmentContext): Promise<readonly UiActionBatchEnrichmentResult[]>;
}

export interface UiRouteGrounderContext {
  readonly config: BriskAiTestingConfig;
  readonly runId: string;
  readonly scenario: ScenarioPlan;
}

export interface UiRouteGrounderResult {
  readonly grounding: UiGroundingEvidence;
  readonly artifacts: readonly ArtifactRef[];
}

export interface UiRouteGrounder {
  readonly name: string;
  ground(context: UiRouteGrounderContext): Promise<UiRouteGrounderResult>;
  /** Release anything kept across ground() calls, such as a shared browser. */
  dispose?(): Promise<void>;
}

export interface AiPlannerProviderRequest {
  readonly system: string;
  readonly user: string;
  readonly jsonSchemaName: 'brisk-aitesting.plan.v1' | 'brisk-aitesting.intent.v1' | 'brisk-aitesting.intent-outline.v1' | 'brisk-aitesting.intent-semantic-repair.v1';
  readonly jsonSchema?: Record<string, unknown>;
  readonly structuredOutput?: 'json-schema' | 'json' | 'text';
  /**
   * Which pipeline step is asking. Hosts can use it for routing (a cheaper
   * model for the outline), per-purpose limits, and telemetry.
   */
  readonly purpose?: 'plan' | 'plan-repair' | 'intent-outline' | 'intent-write' | 'intent-json-repair' | 'intent-semantic-repair' | 'ui-actions';
  /**
   * Upper bound on how large the visible answer can usefully be, in output
   * tokens. The engine sizes it from the work actually requested (an outline
   * of 15 checks never needs a 32k budget). Hosts should cap their provider's
   * output budget with min(own limit, hint); the built-in provider does.
   *
   * The hint pays only for visible text. On deployments that bill hidden
   * reasoning against the same budget, a sized call can come back with no
   * text at all — the engine retries such a call once with the hint absent,
   * so a host honoring the hint must grant its full configured budget
   * whenever the hint is missing.
   */
  readonly maxOutputTokensHint?: number;
}

export interface AiPlannerProviderResponse {
  readonly content: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

export interface AiPlannerProvider {
  readonly name: string;
  complete(request: AiPlannerProviderRequest): Promise<AiPlannerProviderResponse>;
}

export interface EngineContext {
  readonly config: BriskAiTestingConfig;
  readonly runId: string;
  readonly plan: TestPlan;
  readonly scenario: ScenarioPlan;
  readonly runState?: EngineRunState;
}

export interface EngineRunState {
  readonly variables: Record<string, string>;
  readonly captures: Record<string, {
    readonly scenarioId: string;
    readonly source: 'explicit' | 'heuristic';
    readonly path: string;
  }>;
  readonly cleanup: ApiCleanupStep[];
  readonly scenarioStatus: Record<string, BriskAiTestingStatus>;
  /** The signed-in session for this run, created once before execution. */
  authSession?: import('./auth-session.js').AuthSession;
}

export interface EngineRunResult {
  readonly result: ScenarioResult;
  readonly artifacts?: readonly ArtifactRef[];
}

export interface Engine {
  readonly name: string;
  readonly type: EngineType;
  canRun(scenario: ScenarioPlan): boolean;
  run(context: EngineContext): Promise<EngineRunResult>;
  /** Release anything held for the whole run, such as a shared browser. */
  dispose?(): Promise<void>;
}

export type BriskAiTestingEvent =
  | { readonly type: 'run.started'; readonly runId: string; readonly goal: string }
  | { readonly type: 'discovery.completed'; readonly runId: string; readonly discovery: DiscoveryResult }
  | { readonly type: 'plan.created'; readonly runId: string; readonly plan: TestPlan }
  | { readonly type: 'plan.validated'; readonly runId: string; readonly validation: ValidationResult }
  | { readonly type: 'plan.repair.started'; readonly runId: string; readonly attempt: number; readonly validation: ValidationResult }
  | { readonly type: 'plan.repaired'; readonly runId: string; readonly attempt: number; readonly plan: TestPlan }
  | { readonly type: 'plan.enriched'; readonly runId: string; readonly plan: TestPlan }
  | { readonly type: 'ui.grounding.completed'; readonly runId: string; readonly scenario: ScenarioPlan; readonly grounding: UiGroundingEvidence }
  | { readonly type: 'ui.actions.enriched'; readonly runId: string; readonly scenario: ScenarioPlan; readonly actions: readonly UiActionPlan[] }
  | { readonly type: 'scenario.started'; readonly runId: string; readonly scenario: ScenarioPlan }
  | { readonly type: 'scenario.completed'; readonly runId: string; readonly result: ScenarioResult }
  | { readonly type: 'planning.phase'; readonly runId: string; readonly phase: string; readonly detail?: string }
  | { readonly type: 'run.completed'; readonly runId: string; readonly result: BriskAiTestingResult };

/** One measured step of the pipeline: what ran and how long it took. */
export interface StageTiming {
  readonly stage: string;
  readonly ms: number;
  readonly detail?: string;
}
