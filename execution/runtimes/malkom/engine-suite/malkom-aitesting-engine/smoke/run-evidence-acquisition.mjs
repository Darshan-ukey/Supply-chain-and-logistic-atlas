import assert from 'node:assert/strict';
import {
  acquireEvidenceForCompilation,
  createEvidenceGraph,
  evidenceGraphDigest,
  InMemoryEvidenceAcquisitionCache,
  normalizeConfig,
  requirementsFromCompilation,
  SemanticCompilationError,
  SemanticPlanner,
  UniversalSemanticCompiler,
} from '../dist/index.js';

const intent = {
  schemaVersion: 'brisk-aitesting.intent.v1',
  goal: 'Read the customer profile.',
  scenarios: [{
    id: 'customer-profile',
    name: 'Customer profile is available',
    objective: 'Read a customer profile.',
    actions: [{ id: 'read-profile', verb: 'read', resource: 'customer profile', capability: 'api.http', expectedOutcomes: [] }],
    invariants: [],
    evidenceRequired: ['authoritative profile operation'],
    cleanup: 'isolated',
  }],
  warnings: [],
};

const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1',
  app: { name: 'Evidence acquisition fixture', baseUrl: 'http://127.0.0.1:3000' },
  uiRoutes: [], apiRoutes: [], contracts: [], repoSignals: [], warnings: [], createdAt: '2026-08-02T00:00:00.000Z',
};

const emptyEvidence = createEvidenceGraph([]);
const initialCompilation = new UniversalSemanticCompiler().compile(intent, emptyEvidence);
assert.equal(initialCompilation.status, 'unsupported', 'an operation missing from current evidence is not proof that the product can never test it');
const requirements = requirementsFromCompilation(initialCompilation, intent);
assert.equal(requirements.length, 1);
assert.equal(requirements[0]?.reasonCode, 'NO_OPERATION_FOR_INTENT');

const operation = {
  id: 'fixture.read-customer-profile',
  adapterId: 'fixture-http',
  capability: 'api.http',
  name: 'Read customer profile',
  action: 'read',
  resource: 'customer profile',
  sideEffect: 'read',
  inputs: [], outputs: [],
  outcomes: [{ id: 'profile-returned', meaning: 'customer profile is returned', successful: true, binding: { status: 200 } }],
  provenance: [{ authority: 'contract', source: 'fixture-contract', confidence: 1, observedAt: '2026-08-02T00:00:00.000Z', revision: 'fixture-v1' }],
  binding: { method: 'GET', path: '/api/customer-profile' },
};

const valueMissingOperation = {
  ...operation,
  id: 'fixture.read-customer-profile-with-id',
  inputs: [{ id: 'customer-id', name: 'customerId', semanticType: 'customer.id', required: true }],
};
const valueMissingCompilation = new UniversalSemanticCompiler().compile(intent, createEvidenceGraph([valueMissingOperation]));
assert.equal(valueMissingCompilation.status, 'needs-evidence');
assert.equal(requirementsFromCompilation(valueMissingCompilation, intent)[0]?.reasonCode, 'MISSING_REQUIRED_VALUE');

function outputFor(providerId, input, options = {}) {
  const satisfied = options.satisfied ?? input.requirements.map((requirement) => requirement.id);
  const unsatisfied = options.unsatisfied ?? input.requirements.filter((requirement) => !satisfied.includes(requirement.id)).map((requirement) => requirement.id);
  const graphs = options.graphs ?? [{
    schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: `graph-${providerId}`, operations: [operation], diagnostics: [],
  }];
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1',
    graphs,
    attempts: [{
      providerId, status: satisfied.length === input.requirements.length ? 'succeeded' : 'completed-with-diagnostics',
      requirementIds: input.requirements.map((requirement) => requirement.id),
      graphRevisions: graphs.map((graph) => graph.revision), cache: 'miss',
    }],
    satisfiedRequirementIds: satisfied,
    unsatisfiedRequirementIds: unsatisfied,
    artifacts: [],
  };
}

const cacheFixtureOutput = outputFor('cache-fixture', { requirements });
const cacheFixture = new InMemoryEvidenceAcquisitionCache();
cacheFixture.set('first', cacheFixtureOutput, 10, 2, 100);
assert.notEqual(cacheFixture.get('first', 109), undefined, 'fresh cache data should be reusable before its deadline');
assert.equal(cacheFixture.get('first', 110), undefined, 'cache data must expire exactly at its deadline');
cacheFixture.set('first', cacheFixtureOutput, 100, 2, 200);
cacheFixture.set('second', cacheFixtureOutput, 100, 2, 200);
assert.notEqual(cacheFixture.get('first', 201), undefined, 'a cache hit should refresh in-memory eviction order');
cacheFixture.set('third', cacheFixtureOutput, 100, 2, 201);
assert.equal(cacheFixture.get('second', 202), undefined, 'the least recently used entry must be evicted at the configured bound');
assert.notEqual(cacheFixture.get('first', 202), undefined);
assert.notEqual(cacheFixture.get('third', 202), undefined);
cacheFixture.clear();
assert.equal(cacheFixture.get('first', 202), undefined, 'cache disposal must remove retained evidence');

const acquiringProvider = {
  id: 'fixture-contract-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0,
  supports: (requirement) => requirement.reasonCode === 'NO_OPERATION_FOR_INTENT',
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
};

const aiProvider = {
  name: 'intent-fixture',
  async complete() {
    return { content: JSON.stringify({ scenarios: intent.scenarios, warnings: [] }) };
  },
};

const adapter = {
  id: 'fixture-http', capabilities: ['api.http'],
  lower() {
    return [{ name: 'Read profile', type: 'api', objective: 'Read a customer profile.', target: { method: 'GET', path: '/api/customer-profile', sourceOfTruth: 'contract' }, assertions: [], evidenceRequired: ['api'] }];
  },
};

function config(overrides = {}) {
  return normalizeConfig({
    app: { name: 'Evidence acquisition fixture', baseUrl: 'http://127.0.0.1:3000' },
    auth: { type: 'none' },
    runtime: { artifactsDir: '.evidence-acquisition-fixture', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
    discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false, maxSourceFiles: 10, uiRoutes: [], apiRoutes: [] },
    security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1'], redactSecrets: true, allowLegacyFullContextEvidenceProviders: true },
    aiProvider,
    capabilityAdapters: [adapter],
    evidenceProviders: [acquiringProvider],
    planning: { evidenceAcquisitionRounds: 2, evidenceProviderTimeoutMs: 50 },
    ...overrides,
  });
}

function plannerContext(configValue, signal) {
  return {
    config: configValue,
    input: { goal: intent.goal, evidenceGraph: emptyEvidence },
    runId: 'run-evidence-acquisition', discovery,
    ...(signal === undefined ? {} : { signal }),
  };
}

assert.throws(() => config({ planning: { evidenceCacheTtlMs: 86_400_001 } }), /evidenceCacheTtlMs/);
assert.throws(() => config({ planning: { evidenceCacheMaxEntries: 1025 } }), /evidenceCacheMaxEntries/);
assert.throws(() => config({ planning: { evidenceMaxResponseBytes: 1023 } }), /evidenceMaxResponseBytes/);
assert.throws(() => config({ planning: { evidenceMaxGraphsPerResponse: 0 } }), /evidenceMaxGraphsPerResponse/);
assert.throws(() => config({ planning: { evidenceMaxOperationsPerResponse: 100_001 } }), /evidenceMaxOperationsPerResponse/);
assert.throws(() => config({ planning: { evidenceMaxArtifactsPerResponse: 10_001 } }), /evidenceMaxArtifactsPerResponse/);
assert.throws(() => config({ evidenceProviders: [{ ...acquiringProvider, revision: '' }] }), /revision/);

const semanticPlanner = new SemanticPlanner(aiProvider, [adapter]);
const plan = await semanticPlanner.plan(plannerContext(config()));
assert.equal(plan.scenarios.length, 1);
assert.equal(plan.scenarios[0]?.target?.path, '/api/customer-profile');
assert.equal(acquiringProvider.calls, 1, 'new evidence should trigger one successful recompilation, not repeated acquisition');
const cachedPlan = await semanticPlanner.plan(plannerContext(config()));
assert.equal(cachedPlan.scenarios.length, 1);
assert.equal(acquiringProvider.calls, 1, 'the same fresh request and provider revision should reuse validated in-memory evidence');
const revisedProvider = { ...acquiringProvider, revision: 'fixture-v2', calls: 0 };
await semanticPlanner.plan(plannerContext(config({ evidenceProviders: [revisedProvider] })));
assert.equal(revisedProvider.calls, 1, 'changing the source revision must invalidate an otherwise matching cache entry');

const reorderedEvidence = { ...createEvidenceGraph([operation]), revision: 'ignored-revision' };
const sameContentEvidence = { ...reorderedEvidence, revision: 'different-ignored-revision' };
assert.equal(evidenceGraphDigest(reorderedEvidence), evidenceGraphDigest(sameContentEvidence), 'graph identity must not depend on a random revision');
assert.notEqual(evidenceGraphDigest(reorderedEvidence), evidenceGraphDigest({ ...sameContentEvidence, diagnostics: ['changed'] }), 'content changes must change the digest');

const noMatch = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
  providers: [{ id: 'unrelated-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => false, acquire: () => { throw new Error('must not run'); } }],
  timeoutMs: 50,
});
assert.equal(noMatch.attemptedProviderIds.length, 0);
assert.equal(noMatch.graphs.length, 0);

const defaultResourceLimits = { maxResponseBytes: 10_485_760, maxGraphs: 16, maxOperations: 10_000, maxArtifacts: 1_000 };
async function cachedCycle(provider, cache) {
  return acquireEvidenceForCompilation({
    plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
    providers: [provider], timeoutMs: 50, cache, cacheTtlMs: 60_000, cacheMaxEntries: 4,
    resourceLimits: defaultResourceLimits,
  });
}

const freshCache = new InMemoryEvidenceAcquisitionCache();
const freshProvider = {
  id: 'fresh-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0, checks: 0,
  supports: () => true,
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
  checkFreshness() {
    this.checks += 1;
    return { schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'fresh', checkedAt: '2099-01-01T00:00:00.000Z', validUntil: '2099-01-01T00:05:00.000Z', reasonCode: 'SOURCE_UNCHANGED', sourceRevision: 'source-v1' };
  },
};
await cachedCycle(freshProvider, freshCache);
const freshResult = await cachedCycle(freshProvider, freshCache);
assert.equal(freshProvider.calls, 1);
assert.equal(freshProvider.checks, 1);
assert.deepEqual(freshResult.cacheHitProviderIds, ['fresh-source']);

const staleCache = new InMemoryEvidenceAcquisitionCache();
const staleProvider = {
  id: 'stale-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', acquireCalls: 0, refreshCalls: 0,
  supports: () => true,
  acquire(input) { this.acquireCalls += 1; return outputFor(this.id, input); },
  checkFreshness: () => ({ schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'stale', checkedAt: '2026-08-02T00:00:00.000Z', reasonCode: 'SOURCE_REVISION_CHANGED', sourceRevision: 'source-v2' }),
  refresh(input) { this.refreshCalls += 1; return outputFor(this.id, input); },
};
await cachedCycle(staleProvider, staleCache);
const refreshed = await cachedCycle(staleProvider, staleCache);
assert.equal(staleProvider.acquireCalls, 1);
assert.equal(staleProvider.refreshCalls, 1);
assert.deepEqual(refreshed.refreshedProviderIds, ['stale-source']);

const unknownCache = new InMemoryEvidenceAcquisitionCache();
const unknownProvider = {
  id: 'unknown-freshness-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0,
  supports: () => true,
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
  checkFreshness: () => ({ schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'unknown', checkedAt: '2026-08-02T00:00:00.000Z', reasonCode: 'SOURCE_UNREACHABLE' }),
};
await cachedCycle(unknownProvider, unknownCache);
const unknownResult = await cachedCycle(unknownProvider, unknownCache);
assert.equal(unknownProvider.calls, 2, 'unknown source freshness must reacquire instead of trusting cached evidence');
assert.deepEqual(unknownResult.cacheHitProviderIds, []);

const invalidFreshnessCache = new InMemoryEvidenceAcquisitionCache();
const invalidFreshnessProvider = {
  id: 'invalid-freshness-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0,
  supports: () => true,
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
  checkFreshness: () => ({ schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'fresh', checkedAt: '2026-08-02T00:05:00.000Z', validUntil: '2026-08-02T00:00:00.000Z', reasonCode: 'INVALID_WINDOW' }),
};
await cachedCycle(invalidFreshnessProvider, invalidFreshnessCache);
const invalidFreshness = await cachedCycle(invalidFreshnessProvider, invalidFreshnessCache);
assert.equal(invalidFreshnessProvider.calls, 2);
assert.equal(invalidFreshness.diagnostics.some((entry) => entry.code === 'EVIDENCE_FRESHNESS_RESPONSE_INVALID'), true);

const freshnessTimeoutCache = new InMemoryEvidenceAcquisitionCache();
const freshnessTimeoutProvider = {
  id: 'freshness-timeout-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0,
  supports: () => true,
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
  checkFreshness: () => new Promise(() => {}),
};
await cachedCycle(freshnessTimeoutProvider, freshnessTimeoutCache);
const freshnessTimedOut = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
  providers: [freshnessTimeoutProvider], timeoutMs: 10, cache: freshnessTimeoutCache, cacheTtlMs: 60_000, cacheMaxEntries: 4,
  resourceLimits: defaultResourceLimits,
});
assert.equal(freshnessTimeoutProvider.calls, 2, 'a timed-out freshness check must reacquire instead of using cached evidence');
assert.equal(freshnessTimedOut.diagnostics.some((entry) => entry.code === 'EVIDENCE_FRESHNESS_TIMEOUT'), true);

const freshnessCancelCache = new InMemoryEvidenceAcquisitionCache();
const freshnessCancelProvider = {
  id: 'freshness-cancel-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', calls: 0,
  supports: () => true,
  acquire(input) { this.calls += 1; return outputFor(this.id, input); },
  checkFreshness(_input, _cached, context) {
    return new Promise((_resolve, reject) => context.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  },
};
await cachedCycle(freshnessCancelProvider, freshnessCancelCache);
const freshnessCancelController = new AbortController();
const freshnessCancelledPromise = acquireEvidenceForCompilation({
  plannerContext: plannerContext(config(), freshnessCancelController.signal), intent, currentEvidence: emptyEvidence, requirements,
  providers: [freshnessCancelProvider], timeoutMs: 1_000, cache: freshnessCancelCache, cacheTtlMs: 60_000, cacheMaxEntries: 4,
  resourceLimits: defaultResourceLimits,
});
freshnessCancelController.abort();
const freshnessCancelled = await freshnessCancelledPromise;
assert.equal(freshnessCancelProvider.calls, 1, 'cancellation during freshness checking must not start reacquisition');
assert.equal(freshnessCancelled.graphs.length, 0);
assert.equal(freshnessCancelled.diagnostics.some((entry) => entry.code === 'EVIDENCE_ACQUISITION_CANCELLED'), true);

async function resourceBlocked(providerId, output, limits) {
  const result = await acquireEvidenceForCompilation({
    plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
    providers: [{ id: providerId, schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true, acquire: () => output }],
    timeoutMs: 50, resourceLimits: limits,
  });
  assert.equal(result.graphs.length, 0);
  assert.equal(result.diagnostics.some((entry) => entry.code === 'EVIDENCE_PROVIDER_RESPONSE_INVALID'), true);
}
const resourceInput = { requirements };
await resourceBlocked('too-many-graphs', outputFor('too-many-graphs', resourceInput, {
  graphs: [
    { schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'graph-one', operations: [operation], diagnostics: [] },
    { schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'graph-two', operations: [], diagnostics: [] },
  ],
}), { ...defaultResourceLimits, maxGraphs: 1 });
await resourceBlocked('too-many-operations', outputFor('too-many-operations', resourceInput, {
  graphs: [{ schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'graph-operations', operations: [operation, { ...operation, id: 'fixture.second-operation' }], diagnostics: [] }],
}), { ...defaultResourceLimits, maxOperations: 1 });
await resourceBlocked('too-many-artifacts', {
  ...outputFor('too-many-artifacts', resourceInput), artifacts: [{ kind: 'log', label: 'provider log' }],
}, { ...defaultResourceLimits, maxArtifacts: 0 });
await resourceBlocked('response-too-large', {
  ...outputFor('response-too-large', resourceInput), artifacts: [{ kind: 'log', label: 'x'.repeat(2_000) }],
}, { ...defaultResourceLimits, maxResponseBytes: 1_024 });

const secondRequirement = { ...requirements[0], id: 'evidence-second-gap', semanticType: 'operation.api.http.customer-settings' };
let partialInputCount = 0;
const partial = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements: [...requirements, secondRequirement],
  providers: [{
    id: 'partial-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true,
    acquire(input) {
      partialInputCount = input.requirements.length;
      return outputFor(this.id, input, { satisfied: [input.requirements[0].id], unsatisfied: [input.requirements[1].id] });
    },
  }],
  timeoutMs: 50,
});
assert.equal(partialInputCount, 2);
assert.deepEqual(partial.satisfiedRequirementIds, [requirements[0].id]);
assert.equal(partial.graphs.length, 1, 'usable partial evidence must be preserved for the next bounded round');

let scopedInputCount = 0;
await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements: [...requirements, secondRequirement],
  providers: [{
    id: 'scoped-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1',
    supports: (requirement) => requirement.id === requirements[0].id,
    acquire(input) { scopedInputCount = input.requirements.length; return outputFor(this.id, input); },
  }],
  timeoutMs: 50,
});
assert.equal(scopedInputCount, 1, 'a source must receive only the missing requirements it declared support for');

const timeout = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
  providers: [{ id: 'ignores-stop-signal', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true, acquire: () => new Promise(() => {}) }],
  timeoutMs: 10,
});
assert.equal(timeout.diagnostics.some((entry) => entry.code === 'EVIDENCE_PROVIDER_TIMEOUT'), true);

const controller = new AbortController();
const cancellationProvider = {
  id: 'cancellable-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true,
  acquire(_input, context) {
    return new Promise((_resolve, reject) => context.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  },
};
const cancellationPromise = acquireEvidenceForCompilation({
  plannerContext: plannerContext(config(), controller.signal), intent, currentEvidence: emptyEvidence, requirements,
  providers: [cancellationProvider], timeoutMs: 1000,
});
controller.abort();
const cancelled = await cancellationPromise;
assert.equal(cancelled.diagnostics.some((entry) => entry.code === 'EVIDENCE_ACQUISITION_CANCELLED'), true);

const failed = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
  providers: [{ id: 'failing-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true, acquire: () => { throw new Error('secret-looking-provider-detail'); } }],
  timeoutMs: 50,
});
assert.equal(failed.diagnostics.some((entry) => entry.code === 'EVIDENCE_PROVIDER_FAILED'), true);
assert.equal(failed.diagnostics.some((entry) => entry.message.includes('secret-looking-provider-detail')), false, 'provider exception details must not leak into planning diagnostics');

const malformed = await acquireEvidenceForCompilation({
  plannerContext: plannerContext(config()), intent, currentEvidence: emptyEvidence, requirements,
  providers: [{
    id: 'malformed-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true,
    acquire: (input) => ({ ...outputFor('malformed-source', input), satisfiedRequirementIds: ['not-requested'] }),
  }],
  timeoutMs: 50,
});
assert.equal(malformed.graphs.length, 0);
assert.equal(malformed.diagnostics.some((entry) => entry.code === 'EVIDENCE_PROVIDER_RESPONSE_INVALID'), true);

let boundedCalls = 0;
const irrelevantProvider = {
  id: 'irrelevant-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true,
  acquire(input) {
    boundedCalls += 1;
    return outputFor(this.id, input, { graphs: [{ schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: `irrelevant-${boundedCalls}`, operations: [], diagnostics: [] }] });
  },
};
await assert.rejects(
  () => new SemanticPlanner(aiProvider, [adapter]).plan(plannerContext(config({ evidenceProviders: [irrelevantProvider] }))),
  SemanticCompilationError,
);
assert.equal(boundedCalls, 1, 'an unchanged unresolved request must reuse its bounded cache entry instead of repeatedly calling the same source');

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.evidence-acquisition-smoke.v1',
  positiveChecks: 8,
  cacheChecks: 9,
  digestChecks: 2,
  configurationBoundaryChecks: 7,
  sourceFreshnessChecks: 16,
  resourceLimitChecks: 8,
  partialResultChecks: 3,
  missingSourceChecks: 1,
  timeoutChecks: 1,
  cancellationChecks: 1,
  providerFailureChecks: 2,
  malformedResponseChecks: 2,
  boundedRetryChecks: 2,
  failures: 0,
  skips: 0,
}, null, 2));
