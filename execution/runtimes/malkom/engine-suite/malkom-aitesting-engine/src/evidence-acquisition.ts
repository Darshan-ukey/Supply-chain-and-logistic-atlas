import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import type {
  CompilationDiagnostic,
  CompilationResult,
  EvidenceGraph,
  IntentAction,
  IntentPlan,
} from './compiler-types.js';
import type {
  EvidenceAcquisitionInputV1,
  EvidenceAcquisitionOutputV1,
  EvidenceFreshnessAssessmentV1,
  EvidenceProvider,
  EvidenceProviderContextV1,
  EvidenceProviderContextV2,
  EvidenceWorkerProviderV1,
  MissingEvidenceRequirementV1,
} from './pipeline-stage-contracts.js';
import { evidenceGraphDigest } from './evidence-graph.js';
import { validatePipelineStagePayloadJsonContract } from './pipeline-stage-contract-validation.js';
import type { PlannerContext } from './types.js';
import { isHostAllowed } from './engines/shared.js';
import { runEvidenceWorker, type EvidenceWorkerExecution } from './evidence-worker.js';

const ACQUIRABLE_DIAGNOSTICS = new Set([
  'NO_OPERATION_FOR_INTENT',
  'MISSING_REQUIRED_VALUE',
  'UNBOUND_REQUIRED_INPUT',
  'MISSING_AUTOMATIC_CLEANUP',
  'OPERATION_NOT_EXECUTABLE',
]);

export interface EvidenceAcquisitionCycle {
  readonly graphs: readonly EvidenceGraph[];
  readonly diagnostics: readonly CompilationDiagnostic[];
  readonly satisfiedRequirementIds: readonly string[];
  readonly attemptedProviderIds: readonly string[];
  readonly cacheHitProviderIds: readonly string[];
  readonly refreshedProviderIds: readonly string[];
  readonly freshnessCheckedProviderIds: readonly string[];
  readonly workerExecutions: readonly EvidenceWorkerExecution[];
}

export interface EvidenceProviderResourceLimits {
  readonly maxResponseBytes: number;
  readonly maxGraphs: number;
  readonly maxOperations: number;
  readonly maxArtifacts: number;
}

interface EvidenceCacheEntry {
  readonly output: EvidenceAcquisitionOutputV1;
  readonly expiresAt: number;
}

export class InMemoryEvidenceAcquisitionCache {
  private readonly entries = new Map<string, EvidenceCacheEntry>();

  get(key: string, now = Date.now()): EvidenceAcquisitionOutputV1 | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return structuredClone(entry.output);
  }

  set(key: string, output: EvidenceAcquisitionOutputV1, ttlMs: number, maxEntries: number, now = Date.now()): void {
    if (ttlMs <= 0 || maxEntries <= 0) return;
    this.pruneExpired(now);
    this.entries.delete(key);
    this.entries.set(key, { output: structuredClone(output), expiresAt: now + ttlMs });
    while (this.entries.size > maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    this.pruneExpired(Date.now());
    return this.entries.size;
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

export function requirementsFromCompilation(
  compilation: CompilationResult,
  intent: IntentPlan,
): readonly MissingEvidenceRequirementV1[] {
  return compilation.diagnostics.flatMap((diagnostic, index) => {
    if (!ACQUIRABLE_DIAGNOSTICS.has(diagnostic.code)) return [];
    const action = findAction(intent, diagnostic.actionId);
    const semanticType = diagnostic.missingSemanticType
      ?? (action === undefined ? 'operation.unknown' : `operation.${action.capability ?? 'unknown'}.${action.resource}`);
    return [{
      id: requirementId(diagnostic, index),
      semanticType,
      reasonCode: diagnostic.code,
      reason: diagnostic.message,
      requiredAuthority: requiredAuthority(diagnostic.code),
      ...(action?.capability === undefined ? {} : { capability: action.capability }),
      ...(diagnostic.scenarioId === undefined ? {} : { scenarioId: diagnostic.scenarioId }),
      ...(diagnostic.actionId === undefined ? {} : { actionId: diagnostic.actionId }),
      ...(diagnostic.operationIds?.[0] === undefined ? {} : { operationId: diagnostic.operationIds[0] }),
    }];
  });
}

export async function acquireEvidenceForCompilation(params: {
  readonly plannerContext: PlannerContext;
  readonly intent: IntentPlan;
  readonly currentEvidence: EvidenceGraph;
  readonly requirements: readonly MissingEvidenceRequirementV1[];
  readonly providers: readonly EvidenceProvider[];
  readonly timeoutMs: number;
  readonly cache?: InMemoryEvidenceAcquisitionCache;
  readonly cacheTtlMs?: number;
  readonly cacheMaxEntries?: number;
  readonly resourceLimits?: EvidenceProviderResourceLimits;
}): Promise<EvidenceAcquisitionCycle> {
  const graphs: EvidenceGraph[] = [];
  const diagnostics: CompilationDiagnostic[] = [];
  const satisfied = new Set<string>();
  const attemptedProviderIds: string[] = [];
  const cacheHitProviderIds: string[] = [];
  const refreshedProviderIds: string[] = [];
  const freshnessCheckedProviderIds: string[] = [];
  const workerExecutions: EvidenceWorkerExecution[] = [];

  const tenantId = params.plannerContext.input.tenantId;
  if (tenantId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(tenantId)) {
    diagnostics.push(acquisitionDiagnostic('EVIDENCE_TENANT_SCOPE_INVALID', 'Evidence acquisition received an invalid tenant scope.'));
    return emptyCycle(diagnostics);
  }
  if (params.plannerContext.config.security.requireEvidenceProviderTenantId === true && tenantId === undefined) {
    diagnostics.push(acquisitionDiagnostic('EVIDENCE_TENANT_SCOPE_REQUIRED', 'Evidence acquisition requires an explicit tenant scope for this host.'));
    return emptyCycle(diagnostics);
  }

  for (const provider of params.providers) {
    if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v1'
      && params.plannerContext.config.security.allowLegacyFullContextEvidenceProviders !== true) {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_PROVIDER_LEGACY_CONTEXT_BLOCKED', `Evidence source ${provider.id} requires the legacy full-information context and is not enabled by this host.`));
      continue;
    }
    if (provider.schemaVersion === 'brisk-aitesting.evidence-worker-provider.v1'
      && params.plannerContext.config.security.requireEvidenceWorkerHostIsolation === true
      && (provider.hostIsolation.filesystem !== 'host-enforced' || provider.hostIsolation.network !== 'host-enforced')) {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_WORKER_HOST_ISOLATION_REQUIRED', `Evidence worker ${provider.id} is blocked because this host requires declared filesystem and network isolation.`));
      continue;
    }
    if (params.plannerContext.signal?.aborted === true) {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_ACQUISITION_CANCELLED', 'Evidence acquisition was cancelled before all eligible sources completed.'));
      break;
    }

    let supported: readonly MissingEvidenceRequirementV1[];
    try {
      supported = params.requirements.filter((requirement) => providerSupports(provider, requirement));
    } catch {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_PROVIDER_SELECTION_FAILED', `Evidence source ${provider.id} could not evaluate the missing requirements.`));
      continue;
    }
    if (supported.length === 0) continue;

    const cacheEnabled = (params.cacheTtlMs ?? 0) > 0 && (params.cacheMaxEntries ?? 0) > 0;
    const input = acquisitionInput(params.plannerContext, params.currentEvidence, supported, provider.id, cacheEnabled);
    const contractIssues = validatePipelineStagePayloadJsonContract(input);
    if (contractIssues.length > 0) {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_ACQUISITION_INPUT_INVALID', `Evidence request for ${provider.id} failed its contract check.`));
      continue;
    }

    const cacheKey = acquisitionCacheKey(provider, input, params.currentEvidence);
    const cached = params.cache?.get(cacheKey);
    let refreshStaleEvidence = false;
    if (cached !== undefined && validateProviderOutput(cached, provider.id, supported, params.resourceLimits, params.plannerContext.config).length === 0) {
      if (!providerHasFreshness(provider)) {
        cacheHitProviderIds.push(provider.id);
        graphs.push(...cached.graphs);
        for (const id of cached.satisfiedRequirementIds) satisfied.add(id);
        continue;
      }
      freshnessCheckedProviderIds.push(provider.id);
      const freshness = await runFreshnessCheck(provider, input, cached, providerContextFor(params, provider), params.timeoutMs, params.plannerContext.signal);
      if (freshness.status === 'completed') {
        const freshnessIssues = validateFreshnessAssessment(freshness.assessment);
        const freshUntilValid = freshness.assessment.validUntil === undefined || Date.parse(freshness.assessment.validUntil) > Date.now();
        if (freshnessIssues.length === 0 && freshness.assessment.status === 'fresh' && freshUntilValid) {
          cacheHitProviderIds.push(provider.id);
          graphs.push(...cached.graphs);
          for (const id of cached.satisfiedRequirementIds) satisfied.add(id);
          continue;
        }
        if (freshnessIssues.length > 0) {
          diagnostics.push(acquisitionDiagnostic('EVIDENCE_FRESHNESS_RESPONSE_INVALID', `Evidence source ${provider.id} returned an invalid freshness assessment.`));
        }
        refreshStaleEvidence = freshnessIssues.length === 0 && (freshness.assessment.status === 'stale' || !freshUntilValid);
      } else {
        diagnostics.push(acquisitionDiagnostic(freshness.code, freshness.message));
        if (freshness.code === 'EVIDENCE_ACQUISITION_CANCELLED') {
          params.cache?.delete(cacheKey);
          break;
        }
      }
      params.cache?.delete(cacheKey);
    }

    attemptedProviderIds.push(provider.id);
    const mode = refreshStaleEvidence && providerHasRefresh(provider) ? 'refresh' : 'acquire';
    const outcome = await runProvider(provider, input, providerContextFor(params, provider), params.timeoutMs, params.plannerContext.signal, mode);
    if (outcome.workerExecution !== undefined) workerExecutions.push(outcome.workerExecution);
    if (outcome.status !== 'completed') {
      diagnostics.push(acquisitionDiagnostic(outcome.code, outcome.message));
      continue;
    }

    const outputIssues = validateProviderOutput(outcome.output, provider.id, supported, params.resourceLimits, params.plannerContext.config);
    if (outputIssues.length > 0) {
      diagnostics.push(acquisitionDiagnostic('EVIDENCE_PROVIDER_RESPONSE_INVALID', `Evidence source ${provider.id} returned data that failed its contract or consistency checks.`));
      continue;
    }
    graphs.push(...outcome.output.graphs);
    if (mode === 'refresh') refreshedProviderIds.push(provider.id);
    for (const id of outcome.output.satisfiedRequirementIds) satisfied.add(id);
    params.cache?.set(cacheKey, outcome.output, params.cacheTtlMs ?? 0, params.cacheMaxEntries ?? 0);
  }

  return {
    graphs,
    diagnostics,
    satisfiedRequirementIds: [...satisfied].sort(),
    attemptedProviderIds,
    cacheHitProviderIds,
    refreshedProviderIds,
    freshnessCheckedProviderIds,
    workerExecutions,
  };
}

function acquisitionInput(
  context: PlannerContext,
  evidence: EvidenceGraph,
  requirements: readonly MissingEvidenceRequirementV1[],
  providerId: string,
  cacheEnabled: boolean,
): EvidenceAcquisitionInputV1 {
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-input.v1',
    currentEvidenceRevision: evidence.revision,
    requirements,
    eligibleProviderIds: [providerId],
    scope: {
      appName: context.config.app.name,
      ...(context.config.app.repoPath === undefined ? {} : { repoPath: context.config.app.repoPath }),
      ...(context.input.tenantId === undefined ? {} : { tenantId: context.input.tenantId }),
      allowedHosts: context.config.security.allowedHosts,
    },
    cachePolicy: cacheEnabled ? 'use-fresh' : 'bypass',
  };
}

function acquisitionCacheKey(
  provider: EvidenceProvider,
  input: EvidenceAcquisitionInputV1,
  currentEvidence: EvidenceGraph,
): string {
  const value = {
    providerId: provider.id,
    providerRevision: provider.revision,
    currentEvidenceDigest: evidenceGraphDigest(currentEvidence),
    requirements: [...input.requirements].sort((left, right) => left.id.localeCompare(right.id)),
    scope: input.scope,
  };
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

function providerContextFor(params: {
  readonly plannerContext: PlannerContext;
  readonly intent: IntentPlan;
  readonly currentEvidence: EvidenceGraph;
}, provider: EvidenceProvider): EvidenceProviderContextV1 | EvidenceProviderContextV2 {
  if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v1') {
    return {
      config: params.plannerContext.config,
      input: params.plannerContext.input,
      discovery: params.plannerContext.discovery,
      runId: params.plannerContext.runId,
      intent: params.intent,
      currentEvidence: params.currentEvidence,
      signal: params.plannerContext.signal ?? new AbortController().signal,
    };
  }
  const config = params.plannerContext.config;
  const secretValues = configuredSecretValues(config);
  return {
    config: {
      app: config.app,
      ...(config.planning === undefined ? {} : { planning: config.planning }),
      ...(config.contracts === undefined ? {} : { contracts: config.contracts }),
      runtime: { artifactsDir: config.runtime.artifactsDir, timeoutMs: config.runtime.timeoutMs, dryRun: config.runtime.dryRun },
      discovery: config.discovery,
      security: {
        networkPolicy: config.security.networkPolicy,
        allowedHosts: config.security.allowedHosts,
        redactSecrets: config.security.redactSecrets,
        ...(config.security.strictMode === undefined ? {} : { strictMode: config.security.strictMode }),
      },
      ...(config.ai === undefined ? {} : { ai: {
        provider: config.ai.provider,
        model: config.ai.model,
        ...(config.ai.endpoint === undefined ? {} : { endpoint: config.ai.endpoint }),
        ...(config.ai.apiKeyEnv === undefined ? {} : { apiKeyEnv: config.ai.apiKeyEnv }),
      } }),
      authType: config.auth.type,
    },
    input: {
      goal: params.plannerContext.input.goal,
      ...(params.plannerContext.input.scenarios === undefined ? {} : { scenarios: params.plannerContext.input.scenarios }),
      ...(params.plannerContext.input.scenarioCountPolicy === undefined ? {} : { scenarioCountPolicy: params.plannerContext.input.scenarioCountPolicy }),
      ...(params.plannerContext.input.mode === undefined ? {} : { mode: params.plannerContext.input.mode }),
      ...(params.plannerContext.input.requiredTypes === undefined ? {} : { requiredTypes: params.plannerContext.input.requiredTypes }),
      ...(params.plannerContext.input.tags === undefined ? {} : { tags: params.plannerContext.input.tags }),
      ...(params.plannerContext.input.tenantId === undefined ? {} : { tenantId: params.plannerContext.input.tenantId }),
    },
    discovery: redactProviderValue(params.plannerContext.discovery, secretValues) as typeof params.plannerContext.discovery,
    runId: params.plannerContext.runId,
    intent: redactProviderValue(params.intent, secretValues) as IntentPlan,
    currentEvidence: redactProviderValue(params.currentEvidence, secretValues) as EvidenceGraph,
    ...(params.plannerContext.input.tenantId === undefined ? {} : { tenantId: params.plannerContext.input.tenantId }),
    secretReferences: config.ai?.apiKeyEnv === undefined ? [] : [{ id: 'ai-api-key', source: 'environment', name: config.ai.apiKeyEnv }],
    signal: params.plannerContext.signal ?? new AbortController().signal,
  };
}

async function runProvider(
  provider: EvidenceProvider,
  input: EvidenceAcquisitionInputV1,
  context: EvidenceProviderContextV1 | EvidenceProviderContextV2,
  timeoutMs: number,
  parentSignal?: AbortSignal,
  mode: 'acquire' | 'refresh' = 'acquire',
): Promise<
  | { readonly status: 'completed'; readonly output: EvidenceAcquisitionOutputV1; readonly workerExecution?: EvidenceWorkerExecution }
  | { readonly status: 'failed'; readonly code: string; readonly message: string; readonly workerExecution?: EvidenceWorkerExecution }
> {
  if (provider.schemaVersion === 'brisk-aitesting.evidence-worker-provider.v1') {
    const worker = await runEvidenceWorker({
      provider,
      input,
      context: context as EvidenceProviderContextV2,
      timeoutMs,
      ...(parentSignal === undefined ? {} : { parentSignal }),
    });
    if (worker.status === 'completed') return { status: 'completed', output: worker.output, workerExecution: worker.execution };
    if (worker.cancelled) return { status: 'failed', code: 'EVIDENCE_ACQUISITION_CANCELLED', message: `Evidence worker ${provider.id} was cancelled.`, workerExecution: worker.execution };
    if (worker.timedOut) return { status: 'failed', code: 'EVIDENCE_PROVIDER_TIMEOUT', message: `Evidence worker ${provider.id} exceeded its acquire time limit.`, workerExecution: worker.execution };
    return { status: 'failed', code: worker.crashed ? 'EVIDENCE_PROVIDER_WORKER_CRASHED' : 'EVIDENCE_PROVIDER_FAILED', message: `Evidence worker ${provider.id} failed while gathering required information.`, workerExecution: worker.execution };
  }
  const bounded = await runBoundedWork(
    (signal) => {
      const providerContext = { ...context, signal };
      if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v2') {
        const safeContext = providerContext as EvidenceProviderContextV2;
        return mode === 'refresh' && provider.refresh !== undefined
          ? provider.refresh(input, safeContext)
          : provider.acquire(input, safeContext);
      }
      const legacyContext = providerContext as EvidenceProviderContextV1;
      return mode === 'refresh' && provider.refresh !== undefined
        ? provider.refresh(input, legacyContext)
        : provider.acquire(input, legacyContext);
    },
    timeoutMs,
    parentSignal,
  );
  if (bounded.status === 'completed') return { status: 'completed', output: bounded.value };
  if (bounded.cancelled) {
    return { status: 'failed', code: 'EVIDENCE_ACQUISITION_CANCELLED', message: `Evidence source ${provider.id} was cancelled.` };
  }
  if (bounded.timedOut) {
    const code = mode === 'refresh' ? 'EVIDENCE_PROVIDER_REFRESH_TIMEOUT' : 'EVIDENCE_PROVIDER_TIMEOUT';
    return { status: 'failed', code, message: `Evidence source ${provider.id} exceeded its ${mode} time limit.` };
  }
  const code = mode === 'refresh' ? 'EVIDENCE_PROVIDER_REFRESH_FAILED' : 'EVIDENCE_PROVIDER_FAILED';
  return { status: 'failed', code, message: `Evidence source ${provider.id} failed while gathering required information.` };
}

async function runFreshnessCheck(
  provider: Exclude<EvidenceProvider, EvidenceWorkerProviderV1>,
  input: EvidenceAcquisitionInputV1,
  cached: EvidenceAcquisitionOutputV1,
  context: EvidenceProviderContextV1 | EvidenceProviderContextV2,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<
  | { readonly status: 'completed'; readonly assessment: EvidenceFreshnessAssessmentV1 }
  | { readonly status: 'failed'; readonly code: string; readonly message: string }
> {
  if (provider.checkFreshness === undefined) {
    return { status: 'failed', code: 'EVIDENCE_FRESHNESS_UNAVAILABLE', message: `Evidence source ${provider.id} cannot check source freshness.` };
  }
  const bounded = await runBoundedWork(
    (signal) => {
      if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v2') {
        return provider.checkFreshness?.(input, cached, { ...context, signal } as EvidenceProviderContextV2) as Promise<EvidenceFreshnessAssessmentV1> | EvidenceFreshnessAssessmentV1;
      }
      return provider.checkFreshness?.(input, cached, { ...context, signal } as EvidenceProviderContextV1) as Promise<EvidenceFreshnessAssessmentV1> | EvidenceFreshnessAssessmentV1;
    },
    timeoutMs,
    parentSignal,
  );
  if (bounded.status === 'completed') return { status: 'completed', assessment: bounded.value };
  if (bounded.cancelled) {
    return { status: 'failed', code: 'EVIDENCE_ACQUISITION_CANCELLED', message: `Freshness check for ${provider.id} was cancelled.` };
  }
  if (bounded.timedOut) {
    return { status: 'failed', code: 'EVIDENCE_FRESHNESS_TIMEOUT', message: `Freshness check for ${provider.id} exceeded its time limit.` };
  }
  return { status: 'failed', code: 'EVIDENCE_FRESHNESS_FAILED', message: `Freshness check for ${provider.id} failed.` };
}

async function runBoundedWork<T>(
  work: (signal: AbortSignal) => Promise<T> | T,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<
  | { readonly status: 'completed'; readonly value: T }
  | { readonly status: 'failed'; readonly timedOut: boolean; readonly cancelled: boolean }
> {
  if (isSignalAborted(parentSignal)) return { status: 'failed', timedOut: false, cancelled: true };
  const controller = new AbortController();
  const onParentAbort = (): void => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('Evidence source time limit exceeded.'));
      reject(new Error('Evidence source time limit exceeded.'));
    }, timeoutMs);
  });
  try {
    const value = await Promise.race([Promise.resolve(work(controller.signal)), timeout]);
    if (isSignalAborted(parentSignal)) return { status: 'failed', timedOut: false, cancelled: true };
    return { status: 'completed', value };
  } catch {
    return { status: 'failed', timedOut, cancelled: isSignalAborted(parentSignal) };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function validateProviderOutput(
  output: EvidenceAcquisitionOutputV1,
  providerId: string,
  requirements: readonly MissingEvidenceRequirementV1[],
  limits?: EvidenceProviderResourceLimits,
  config?: PlannerContext['config'],
): readonly unknown[] {
  const issues: unknown[] = [...validatePipelineStagePayloadJsonContract(output)];
  if (!isProviderOutputShape(output)) {
    if (issues.length === 0) issues.push('provider output shape invalid');
    return issues;
  }
  const requested = new Set(requirements.map((requirement) => requirement.id));
  const satisfied = new Set(output.satisfiedRequirementIds);
  const unsatisfied = new Set(output.unsatisfiedRequirementIds);
  if (output.attempts.some((attempt) => attempt.providerId !== providerId)) issues.push('attempt provider mismatch');
  if ([...satisfied, ...unsatisfied].some((id) => !requested.has(id))) issues.push('unknown requirement id');
  if ([...satisfied].some((id) => unsatisfied.has(id))) issues.push('requirement both satisfied and unsatisfied');
  if ([...requested].some((id) => !satisfied.has(id) && !unsatisfied.has(id))) issues.push('requirement outcome omitted');
  if (satisfied.size > 0 && output.graphs.length === 0) issues.push('satisfied requirement without evidence graph');
  if (limits !== undefined) {
    if (output.graphs.length > limits.maxGraphs) issues.push('graph limit exceeded');
    const operationCount = output.graphs.reduce((total, graph) => total + graph.operations.length, 0);
    if (operationCount > limits.maxOperations) issues.push('operation limit exceeded');
    if (output.artifacts.length > limits.maxArtifacts) issues.push('artifact limit exceeded');
    try {
      if (Buffer.byteLength(JSON.stringify(output), 'utf8') > limits.maxResponseBytes) issues.push('response byte limit exceeded');
    } catch {
      issues.push('response is not serializable');
    }
  }
  if (config !== undefined) {
    if (containsConfiguredSecret(output, configuredSecretValues(config))) issues.push('configured secret exposed');
    for (const graph of output.graphs) {
      for (const operation of graph.operations) {
        for (const destination of absoluteNetworkDestinations(operation.binding)) {
          if (!isHostAllowed(destination, config.security.allowedHosts, config.security.networkPolicy)) issues.push('network destination blocked by policy');
        }
      }
    }
    for (const artifact of output.artifacts) {
      if (artifact.path !== undefined && !isSafeArtifactPath(artifact.path, config.runtime.artifactsDir)) issues.push('artifact path outside configured boundary');
    }
  }
  return issues;
}

function isProviderOutputShape(value: unknown): value is EvidenceAcquisitionOutputV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.graphs)
    && Array.isArray(record.attempts)
    && Array.isArray(record.satisfiedRequirementIds)
    && Array.isArray(record.unsatisfiedRequirementIds)
    && Array.isArray(record.artifacts);
}

function emptyCycle(diagnostics: readonly CompilationDiagnostic[]): EvidenceAcquisitionCycle {
  return { graphs: [], diagnostics, satisfiedRequirementIds: [], attemptedProviderIds: [], cacheHitProviderIds: [], refreshedProviderIds: [], freshnessCheckedProviderIds: [], workerExecutions: [] };
}

function providerSupports(provider: EvidenceProvider, requirement: MissingEvidenceRequirementV1): boolean {
  if (provider.schemaVersion !== 'brisk-aitesting.evidence-worker-provider.v1') return provider.supports(requirement);
  return provider.supports.reasonCodes?.includes(requirement.reasonCode) === true
    || provider.supports.semanticTypes?.includes(requirement.semanticType) === true
    || (requirement.capability !== undefined && provider.supports.capabilities?.includes(requirement.capability) === true);
}

function providerHasFreshness(provider: EvidenceProvider): provider is Exclude<EvidenceProvider, EvidenceWorkerProviderV1> & { checkFreshness: NonNullable<Exclude<EvidenceProvider, EvidenceWorkerProviderV1>['checkFreshness']> } {
  return provider.schemaVersion !== 'brisk-aitesting.evidence-worker-provider.v1' && provider.checkFreshness !== undefined;
}

function providerHasRefresh(provider: EvidenceProvider): provider is Exclude<EvidenceProvider, EvidenceWorkerProviderV1> & { refresh: NonNullable<Exclude<EvidenceProvider, EvidenceWorkerProviderV1>['refresh']> } {
  return provider.schemaVersion !== 'brisk-aitesting.evidence-worker-provider.v1' && provider.refresh !== undefined;
}

function configuredSecretValues(config: PlannerContext['config']): readonly string[] {
  const values: string[] = [];
  if (config.auth.type === 'credentials') values.push(config.auth.username, config.auth.password);
  if (config.auth.type === 'bearer') values.push(config.auth.token);
  if (config.ai?.apiKey !== undefined) values.push(config.ai.apiKey);
  return values.filter((value) => value.length > 0);
}

function redactProviderValue(value: unknown, secrets: readonly string[], key = ''): unknown {
  if (/token|secret|password|authorization|api.?key/i.test(key)) return '[redacted]';
  if (typeof value === 'string') {
    if (secrets.includes(value)) return '[redacted]';
    return secrets.filter((secret) => secret.length >= 6).reduce((result, secret) => result.replaceAll(secret, '[redacted]'), value)
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, 'Bearer [redacted]')
      .replace(/\b(sk|pk|rk|npm)_[A-Za-z0-9]{12,}\b/g, '[redacted]');
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => redactProviderValue(entry, secrets));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entry]) => [entryKey, redactProviderValue(entry, secrets, entryKey)]));
}

function containsConfiguredSecret(value: unknown, secrets: readonly string[]): boolean {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return true; }
  return secrets.some((secret) => secret.length > 0 && serialized.includes(secret));
}

function absoluteNetworkDestinations(value: unknown): readonly URL[] {
  const destinations: URL[] = [];
  const visit = (entry: unknown): void => {
    if (typeof entry === 'string' && /^(https?|wss?):\/\//i.test(entry)) {
      try { destinations.push(new URL(entry)); } catch { /* the contract validator handles malformed values where typed */ }
    } else if (Array.isArray(entry)) {
      entry.forEach(visit);
    } else if (entry !== null && typeof entry === 'object') {
      Object.values(entry as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return destinations;
}

function isSafeArtifactPath(path: string, artifactsDir: string): boolean {
  const root = resolve(artifactsDir);
  const candidate = resolve(path);
  const child = relative(root, candidate);
  return child.length > 0 && !child.startsWith('..') && !isAbsolute(child);
}

function validateFreshnessAssessment(assessment: EvidenceFreshnessAssessmentV1): readonly unknown[] {
  const issues: unknown[] = [...validatePipelineStagePayloadJsonContract(assessment)];
  if (assessment.validUntil !== undefined && Date.parse(assessment.validUntil) <= Date.parse(assessment.checkedAt)) {
    issues.push('freshness validity window is not forward-moving');
  }
  return issues;
}

function findAction(intent: IntentPlan, actionId: string | undefined): IntentAction | undefined {
  if (actionId === undefined) return undefined;
  return intent.scenarios.flatMap((scenario) => scenario.actions).find((action) => action.id === actionId);
}

function requirementId(diagnostic: CompilationDiagnostic, index: number): string {
  const parts = ['evidence', diagnostic.scenarioId, diagnostic.actionId, diagnostic.code.toLowerCase(), String(index + 1)]
    .filter((part): part is string => part !== undefined)
    .map((part) => part.replace(/[^a-z0-9._-]+/gi, '-'));
  return parts.join('_');
}

function requiredAuthority(code: string): MissingEvidenceRequirementV1['requiredAuthority'] {
  return ['MISSING_AUTOMATIC_CLEANUP', 'OPERATION_NOT_EXECUTABLE'].includes(code) ? 'contract' : 'source';
}

function acquisitionDiagnostic(code: string, message: string): CompilationDiagnostic {
  return { code, message };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}
