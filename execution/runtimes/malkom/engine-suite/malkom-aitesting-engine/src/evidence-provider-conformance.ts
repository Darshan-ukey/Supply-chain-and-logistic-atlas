import type { EvidenceGraph, IntentPlan } from './compiler-types.js';
import { containsObviousSecretLikeValue } from './secret-safety.js';
import {
  acquireEvidenceForCompilation,
  InMemoryEvidenceAcquisitionCache,
  type EvidenceProviderResourceLimits,
} from './evidence-acquisition.js';
import type {
  EvidenceAcquisitionInputV1,
  EvidenceProviderContextV1,
  EvidenceProviderContextV2,
  EvidenceProviderV1,
  EvidenceProviderV2,
  MissingEvidenceRequirementV1,
} from './pipeline-stage-contracts.js';
import type { PlannerContext } from './types.js';

export type EvidenceProviderFreshnessProbe = 'not-required' | 'fresh-cache' | 'stale-refresh' | 'unknown-reacquire';

export interface EvidenceProviderConformanceCaseV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-provider-conformance-case.v1';
  readonly provider: EvidenceProviderV1 | EvidenceProviderV2;
  readonly plannerContext: PlannerContext;
  readonly intent: IntentPlan;
  readonly currentEvidence: EvidenceGraph;
  readonly requirements: readonly MissingEvidenceRequirementV1[];
  readonly timeoutMs: number;
  readonly resourceLimits: EvidenceProviderResourceLimits;
  readonly freshnessProbe?: EvidenceProviderFreshnessProbe;
  readonly cancellationProbe?: boolean;
  readonly disposalRequired?: boolean;
}

export interface EvidenceProviderConformanceCheckV1 {
  readonly name: string;
  readonly status: 'passed' | 'failed' | 'not-applicable';
  readonly detail?: string;
}

export interface EvidenceProviderConformanceReportV1 {
  readonly schemaVersion: 'brisk-aitesting.evidence-provider-conformance-report.v1';
  readonly providerId: string;
  readonly status: 'passed' | 'failed';
  readonly checks: readonly EvidenceProviderConformanceCheckV1[];
  readonly errors: readonly string[];
}

export async function runEvidenceProviderConformance(
  testCase: EvidenceProviderConformanceCaseV1,
): Promise<EvidenceProviderConformanceReportV1> {
  const checks: EvidenceProviderConformanceCheckV1[] = [];
  const errors: string[] = [];
  const provider = testCase.provider;
  const record = (name: string, passed: boolean, detail?: string): void => {
    const check = detail === undefined
      ? { name, status: passed ? 'passed' as const : 'failed' as const }
      : { name, status: passed ? 'passed' as const : 'failed' as const, detail };
    checks.push(check);
    if (!passed) errors.push(detail === undefined ? name : `${name}: ${detail}`);
  };
  const notApplicable = (name: string, detail: string): void => {
    checks.push({ name, status: 'not-applicable', detail });
  };

  record('conformance case version is supported', testCase.schemaVersion === 'brisk-aitesting.evidence-provider-conformance-case.v1');
  record('provider id is non-empty', typeof provider.id === 'string' && provider.id.trim().length > 0);
  record('provider contract version is supported', ['brisk-aitesting.evidence-provider.v1', 'brisk-aitesting.evidence-provider.v2'].includes(provider.schemaVersion));
  if (provider.schemaVersion === 'brisk-aitesting.evidence-provider.v2') {
    record('provider declares trusted in-process execution', provider.execution === 'trusted-in-process');
  } else {
    record('legacy full-context provider is explicitly enabled', testCase.plannerContext.config.security.allowLegacyFullContextEvidenceProviders === true);
  }
  record('provider revision is non-empty', typeof provider.revision === 'string' && provider.revision.trim().length > 0);
  record('at least one requirement is supplied', testCase.requirements.length > 0);
  record('timeout is a positive finite number', Number.isFinite(testCase.timeoutMs) && testCase.timeoutMs > 0);

  let supported: readonly MissingEvidenceRequirementV1[] = [];
  try {
    supported = testCase.requirements.filter((requirement) => provider.supports(requirement));
    record('requirement selection completes', true);
    record('provider accepts at least one supplied requirement', supported.length > 0);
  } catch (error) {
    record('requirement selection completes', false, safeError(error));
  }

  if (supported.length > 0 && Number.isFinite(testCase.timeoutMs) && testCase.timeoutMs > 0) {
    const cycle = await acquireEvidenceForCompilation({
      plannerContext: testCase.plannerContext,
      intent: testCase.intent,
      currentEvidence: testCase.currentEvidence,
      requirements: supported,
      providers: [provider],
      timeoutMs: testCase.timeoutMs,
      resourceLimits: testCase.resourceLimits,
    });
    record('acquisition finishes within the configured bound', !cycle.diagnostics.some((entry) => entry.code === 'EVIDENCE_PROVIDER_TIMEOUT'));
    record('acquisition output passes contract and consistency checks', cycle.diagnostics.length === 0, cycle.diagnostics.map((entry) => entry.code).join(', ') || undefined);
    record('acquisition satisfies every supported requirement', supported.every((requirement) => cycle.satisfiedRequirementIds.includes(requirement.id)));
    record('acquisition returns evidence for satisfied requirements', cycle.graphs.length > 0);
    record('acquisition result has no obvious secret-shaped value', !containsObviousSecretLikeValue(cycle));

    await checkFreshnessLifecycle(testCase, supported, record, notApplicable);
    if (testCase.cancellationProbe === true) {
      await checkCancellation(testCase, supported, record);
    } else {
      notApplicable('provider cancellation probe', 'The conformance case did not supply a cancellation-safe probe.');
    }
  }

  if (provider.dispose === undefined) {
    if (testCase.disposalRequired === true) record('provider disposal completes', false, 'Disposal was declared required but the provider has no dispose method.');
    else notApplicable('provider disposal', 'The provider declares no disposable resources.');
  } else {
    const disposal = await bounded(() => provider.dispose?.(), testCase.timeoutMs);
    record('provider disposal completes', disposal.status === 'completed', disposal.status === 'completed' ? undefined : disposal.reason);
  }

  return {
    schemaVersion: 'brisk-aitesting.evidence-provider-conformance-report.v1',
    providerId: provider.id,
    status: errors.length === 0 ? 'passed' : 'failed',
    checks,
    errors,
  };
}

async function checkFreshnessLifecycle(
  testCase: EvidenceProviderConformanceCaseV1,
  requirements: readonly MissingEvidenceRequirementV1[],
  record: (name: string, passed: boolean, detail?: string) => void,
  notApplicable: (name: string, detail: string) => void,
): Promise<void> {
  const expectation = testCase.freshnessProbe ?? 'not-required';
  if (expectation === 'not-required') {
    notApplicable('freshness and refresh lifecycle', 'The provider does not claim freshness or refresh support for this case.');
    return;
  }
  if (testCase.provider.checkFreshness === undefined) {
    record('freshness check runs', false, 'The case requires freshness support but the provider has no checkFreshness method.');
    return;
  }
  if (expectation === 'stale-refresh' && testCase.provider.refresh === undefined) {
    record('stale evidence refreshes', false, 'The case requires refresh support but the provider has no refresh method.');
    return;
  }

  const cache = new InMemoryEvidenceAcquisitionCache();
  const base = {
    plannerContext: testCase.plannerContext,
    intent: testCase.intent,
    currentEvidence: testCase.currentEvidence,
    requirements,
    providers: [testCase.provider],
    timeoutMs: testCase.timeoutMs,
    cache,
    cacheTtlMs: 60_000,
    cacheMaxEntries: 2,
    resourceLimits: testCase.resourceLimits,
  } as const;
  const first = await acquireEvidenceForCompilation(base);
  const second = await acquireEvidenceForCompilation(base);
  record('freshness setup acquisition is valid', first.diagnostics.length === 0, first.diagnostics.map((entry) => entry.code).join(', ') || undefined);
  record('freshness check runs', second.freshnessCheckedProviderIds.includes(testCase.provider.id));
  record('freshness decision remains contract-valid', second.diagnostics.length === 0, second.diagnostics.map((entry) => entry.code).join(', ') || undefined);
  if (expectation === 'fresh-cache') {
    record('fresh evidence is reused', second.cacheHitProviderIds.includes(testCase.provider.id));
  } else if (expectation === 'stale-refresh') {
    record('stale evidence refreshes', second.refreshedProviderIds.includes(testCase.provider.id));
  } else {
    record('unknown freshness reacquires evidence', second.attemptedProviderIds.includes(testCase.provider.id) && !second.refreshedProviderIds.includes(testCase.provider.id));
  }
  record('freshness lifecycle result has no obvious secret-shaped value', !containsObviousSecretLikeValue({ first, second }));
}

async function checkCancellation(
  testCase: EvidenceProviderConformanceCaseV1,
  requirements: readonly MissingEvidenceRequirementV1[],
  record: (name: string, passed: boolean, detail?: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const input: EvidenceAcquisitionInputV1 = {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-input.v1',
    currentEvidenceRevision: testCase.currentEvidence.revision,
    requirements,
    eligibleProviderIds: [testCase.provider.id],
    scope: {
      appName: testCase.plannerContext.config.app.name,
      ...(testCase.plannerContext.config.app.repoPath === undefined ? {} : { repoPath: testCase.plannerContext.config.app.repoPath }),
      allowedHosts: testCase.plannerContext.config.security.allowedHosts,
    },
    cachePolicy: 'bypass',
  };
  const work = Promise.resolve().then(() => {
    if (testCase.provider.schemaVersion === 'brisk-aitesting.evidence-provider.v2') {
      const config = testCase.plannerContext.config;
      const context: EvidenceProviderContextV2 = {
        config: {
          app: config.app,
          ...(config.planning === undefined ? {} : { planning: config.planning }),
          ...(config.contracts === undefined ? {} : { contracts: config.contracts }),
          runtime: { artifactsDir: config.runtime.artifactsDir, timeoutMs: config.runtime.timeoutMs, dryRun: config.runtime.dryRun },
          discovery: config.discovery,
          security: { networkPolicy: config.security.networkPolicy, allowedHosts: config.security.allowedHosts, redactSecrets: config.security.redactSecrets, ...(config.security.strictMode === undefined ? {} : { strictMode: config.security.strictMode }) },
          authType: config.auth.type,
        },
        input: { goal: testCase.plannerContext.input.goal, ...(testCase.plannerContext.input.tenantId === undefined ? {} : { tenantId: testCase.plannerContext.input.tenantId }) },
        discovery: testCase.plannerContext.discovery,
        runId: `${testCase.plannerContext.runId}_cancellation_probe`,
        intent: testCase.intent,
        currentEvidence: testCase.currentEvidence,
        ...(testCase.plannerContext.input.tenantId === undefined ? {} : { tenantId: testCase.plannerContext.input.tenantId }),
        secretReferences: [],
        signal: controller.signal,
      };
      return testCase.provider.acquire(input, context);
    }
    const context: EvidenceProviderContextV1 = {
      config: testCase.plannerContext.config,
      input: testCase.plannerContext.input,
      discovery: testCase.plannerContext.discovery,
      runId: `${testCase.plannerContext.runId}_cancellation_probe`,
      intent: testCase.intent,
      currentEvidence: testCase.currentEvidence,
      signal: controller.signal,
    };
    return testCase.provider.acquire(input, context);
  });
  controller.abort(new Error('Provider conformance cancellation probe.'));
  const outcome = await bounded(() => work, testCase.timeoutMs);
  record(
    'provider cancellation probe stops without successful output',
    outcome.status === 'failed' && outcome.reason !== 'timeout',
    outcome.status === 'completed' ? 'Provider returned successful output after cancellation.' : outcome.reason,
  );
}

async function bounded<T>(work: () => Promise<T> | T, timeoutMs: number): Promise<
  | { readonly status: 'completed'; readonly value: T }
  | { readonly status: 'failed'; readonly reason: string }
> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(work).then((value) => ({ status: 'completed' as const, value })).catch((error) => ({ status: 'failed' as const, reason: safeError(error) })),
      new Promise<{ readonly status: 'failed'; readonly reason: string }>((resolve) => {
        timer = setTimeout(() => resolve({ status: 'failed', reason: 'timeout' }), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
