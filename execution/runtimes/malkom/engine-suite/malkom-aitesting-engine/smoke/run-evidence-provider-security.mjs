import assert from 'node:assert/strict';
import {
  acquireEvidenceForCompilation,
  createEvidenceGraph,
  InMemoryEvidenceAcquisitionCache,
  normalizeConfig,
} from '../dist/index.js';

const secretToken = 'Bearer provider-security-secret-token';
const aiKey = 'sk_providersecurityfixture123456';
const requirement = {
  id: 'evidence_customer_profile', semanticType: 'operation.api.http.customer-profile',
  reasonCode: 'NO_OPERATION_FOR_INTENT', reason: 'Customer profile operation is missing.',
  requiredAuthority: 'contract', capability: 'api.http', scenarioId: 'profile', actionId: 'read-profile',
};
const baseOperation = {
  id: 'fixture.read-profile', adapterId: 'fixture-http', capability: 'api.http', name: 'Read profile',
  action: 'read', resource: 'customer profile', sideEffect: 'read', inputs: [], outputs: [],
  outcomes: [{ id: 'returned', meaning: 'profile returned', successful: true, binding: { status: 200 } }],
  provenance: [{ authority: 'contract', source: 'fixture-contract', confidence: 1, observedAt: '2026-08-02T00:00:00.000Z', revision: 'fixture-v1' }],
  binding: { method: 'GET', url: 'http://127.0.0.1:3000/api/customer-profile' },
};
const intent = {
  schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Read profile.',
  scenarios: [{ id: 'profile', name: 'Profile', objective: 'Read profile.', actions: [{ id: 'read-profile', verb: 'read', resource: 'customer profile', capability: 'api.http', expectedOutcomes: [] }], invariants: [], evidenceRequired: [], cleanup: 'isolated' }],
  warnings: [`do not expose ${secretToken}`],
};
const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1', app: { name: 'Provider security fixture', baseUrl: 'http://127.0.0.1:3000' },
  uiRoutes: [], apiRoutes: [], contracts: [], repoSignals: [{ kind: 'fixture', value: aiKey }], warnings: [], createdAt: '2026-08-02T00:00:00.000Z',
};
const evidence = { ...createEvidenceGraph([]), diagnostics: [`hidden ${aiKey}`] };

function provider(id, acquire) {
  return {
    id, schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process',
    supports: () => true, acquire,
  };
}

function outputFor(providerId, input, options = {}) {
  const graphs = options.graphs ?? [{ schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: `graph-${providerId}`, operations: [options.operation ?? baseOperation], diagnostics: [] }];
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1', graphs,
    attempts: [{ providerId, status: 'succeeded', requirementIds: input.requirements.map((entry) => entry.id), graphRevisions: graphs.map((graph) => graph.revision), cache: 'miss' }],
    satisfiedRequirementIds: input.requirements.map((entry) => entry.id), unsatisfiedRequirementIds: [], artifacts: options.artifacts ?? [],
  };
}

function config(evidenceProvider, overrides = {}) {
  return normalizeConfig({
    app: { name: 'Provider security fixture', baseUrl: 'http://127.0.0.1:3000', repoPath: '.' },
    auth: { type: 'bearer', token: secretToken },
    ai: { provider: 'openai-compatible', model: 'fixture-model', apiKey: aiKey, apiKeyEnv: 'BRISK_AITESTING_AI_API_KEY' },
    aiProvider: { name: 'unused-fixture-ai', complete: async () => ({ content: '{}' }) },
    runtime: { artifactsDir: '.provider-security-artifacts', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
    discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false, maxSourceFiles: 10, uiRoutes: [], apiRoutes: [] },
    security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1'], redactSecrets: true, ...overrides.security },
    evidenceProviders: [evidenceProvider],
  });
}

function plannerContext(configValue, tenantId, metadata = { unrelatedPassword: secretToken }) {
  return {
    config: configValue,
    input: { goal: intent.goal, metadata, evidenceGraph: evidence, ...(tenantId === undefined ? {} : { tenantId }) },
    runId: 'provider-security', discovery,
  };
}

function acquire(configValue, evidenceProvider, tenantId, options = {}) {
  return acquireEvidenceForCompilation({
    plannerContext: plannerContext(configValue, tenantId), intent, currentEvidence: evidence, requirements: [requirement],
    providers: [evidenceProvider], timeoutMs: 50, resourceLimits: { maxResponseBytes: 64_000, maxGraphs: 2, maxOperations: 10, maxArtifacts: 2 },
    ...options,
  });
}

const legacy = { id: 'legacy-source', schemaVersion: 'brisk-aitesting.evidence-provider.v1', revision: 'fixture-v1', supports: () => true, acquire: (input) => outputFor('legacy-source', input) };
assert.throws(() => config(legacy), /legacy full-context contract/);
assert.doesNotThrow(() => config(legacy, { security: { allowLegacyFullContextEvidenceProviders: true } }));

let receivedContext;
const safeProvider = provider('safe-context-source', (input, context) => {
  receivedContext = context;
  return outputFor('safe-context-source', input);
});
const safeCycle = await acquire(config(safeProvider), safeProvider, 'tenant-a');
assert.equal(safeCycle.diagnostics.length, 0);
const contextJson = JSON.stringify(receivedContext);
assert.ok(!contextJson.includes(secretToken), 'configured authentication token must not reach the safe helper context');
assert.ok(!contextJson.includes(aiKey), 'configured AI key and matching discovered values must not reach the safe helper context');
assert.ok(!contextJson.includes('unrelatedPassword'), 'unrelated run metadata must not reach the safe helper context');
assert.equal(receivedContext.config.authType, 'bearer');
assert.equal(receivedContext.config.auth, undefined);
assert.equal(receivedContext.input.metadata, undefined);
assert.deepEqual(receivedContext.secretReferences, [{ id: 'ai-api-key', source: 'environment', name: 'BRISK_AITESTING_AI_API_KEY' }]);
assert.equal(receivedContext.tenantId, 'tenant-a');

const secretOutputProvider = provider('secret-output-source', (input) => outputFor('secret-output-source', input, {
  operation: { ...baseOperation, binding: { method: 'GET', url: 'http://127.0.0.1:3000/profile', credential: secretToken } },
}));
const secretOutput = await acquire(config(secretOutputProvider), secretOutputProvider, 'tenant-a');
assert.deepEqual(secretOutput.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_RESPONSE_INVALID']);
assert.equal(secretOutput.graphs.length, 0);

const tenantProvider = provider('tenant-source', function tenantAcquire(input, context) {
  this.calls = (this.calls ?? 0) + 1;
  assert.equal(input.scope.tenantId, context.tenantId);
  return outputFor(this.id, input);
});
const tenantConfig = config(tenantProvider, { security: { requireEvidenceProviderTenantId: true } });
const missingTenant = await acquire(tenantConfig, tenantProvider, undefined);
assert.deepEqual(missingTenant.diagnostics.map((entry) => entry.code), ['EVIDENCE_TENANT_SCOPE_REQUIRED']);
const invalidTenant = await acquire(tenantConfig, tenantProvider, '../tenant-b');
assert.deepEqual(invalidTenant.diagnostics.map((entry) => entry.code), ['EVIDENCE_TENANT_SCOPE_INVALID']);
const tenantCache = new InMemoryEvidenceAcquisitionCache();
const cacheOptions = { cache: tenantCache, cacheTtlMs: 60_000, cacheMaxEntries: 4 };
await acquire(tenantConfig, tenantProvider, 'tenant-a', cacheOptions);
await acquire(tenantConfig, tenantProvider, 'tenant-b', cacheOptions);
const tenantARepeat = await acquire(tenantConfig, tenantProvider, 'tenant-a', cacheOptions);
assert.equal(tenantProvider.calls, 2, 'different tenants must not share a cache entry; the same tenant may reuse its own entry');
assert.deepEqual(tenantARepeat.cacheHitProviderIds, ['tenant-source']);

const blockedNetworkProvider = provider('blocked-network-source', (input) => outputFor('blocked-network-source', input, {
  operation: { ...baseOperation, binding: { method: 'GET', url: 'https://forbidden.example.test/profile' } },
}));
const blockedNetwork = await acquire(config(blockedNetworkProvider), blockedNetworkProvider, 'tenant-a');
assert.deepEqual(blockedNetwork.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_RESPONSE_INVALID']);
const allowedNetworkProvider = provider('allowed-network-source', (input) => outputFor('allowed-network-source', input));
assert.equal((await acquire(config(allowedNetworkProvider), allowedNetworkProvider, 'tenant-a')).diagnostics.length, 0);

const unsafePathProvider = provider('unsafe-path-source', (input) => outputFor('unsafe-path-source', input, {
  artifacts: [{ kind: 'json', label: 'Unsafe fixture', path: '../outside-provider-boundary.json' }],
}));
const unsafePath = await acquire(config(unsafePathProvider), unsafePathProvider, 'tenant-a');
assert.deepEqual(unsafePath.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_RESPONSE_INVALID']);
const safePathProvider = provider('safe-path-source', (input) => outputFor('safe-path-source', input, {
  artifacts: [{ kind: 'json', label: 'Safe fixture', path: '.provider-security-artifacts/safe.json' }],
}));
assert.equal((await acquire(config(safePathProvider), safePathProvider, 'tenant-a')).diagnostics.length, 0);

console.log(JSON.stringify({
  suite: 'evidence-provider-security', proofClass: 'synthetic',
  legacyOptInChecks: 2, contextMinimizationChecks: 9, configuredSecretOutputChecks: 2,
  tenantIsolationChecks: 6, networkDestinationChecks: 2, artifactPathChecks: 2,
  failures: 0, skips: 0,
  exclusions: ['trusted in-process helpers can still call Node.js APIs directly', 'isolated workers are covered by the separate worker-security suite', 'no OS/container enforcement in this suite', 'no real multi-tenant host'],
}, null, 2));
