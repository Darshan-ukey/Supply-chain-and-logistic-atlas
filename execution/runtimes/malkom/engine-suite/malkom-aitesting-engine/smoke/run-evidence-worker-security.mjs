import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  acquireEvidenceForCompilation,
  createEvidenceGraph,
  normalizeConfig,
} from '../dist/index.js';

const modulePath = fileURLToPath(new URL('./fixtures/evidence-worker-fixture.mjs', import.meta.url));
const requirement = {
  id: 'worker_requirement', semanticType: 'operation.api.http.customer-profile', reasonCode: 'NO_OPERATION_FOR_INTENT',
  reason: 'Profile operation missing.', requiredAuthority: 'contract', capability: 'api.http', scenarioId: 'profile', actionId: 'read-profile',
};
const intent = {
  schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Read profile.',
  scenarios: [{ id: 'profile', name: 'Profile', objective: 'Read profile.', actions: [{ id: 'read-profile', verb: 'read', resource: 'customer profile', capability: 'api.http', expectedOutcomes: [] }], invariants: [], evidenceRequired: [], cleanup: 'isolated' }], warnings: [],
};
const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1', app: { name: 'Worker fixture', baseUrl: 'http://127.0.0.1:3000' },
  uiRoutes: [], apiRoutes: [], contracts: [], repoSignals: [], warnings: [], createdAt: '2026-08-02T00:00:00.000Z',
};
const evidence = createEvidenceGraph([]);

function worker(id, exportName, overrides = {}) {
  return {
    id, schemaVersion: 'brisk-aitesting.evidence-worker-provider.v1', revision: 'fixture-v1', execution: 'isolated-worker',
    modulePath, exportName, supports: { capabilities: ['api.http'] }, limits: { memoryMb: 32 },
    hostIsolation: { filesystem: 'not-enforced', network: 'not-enforced' }, ...overrides,
  };
}

function config(provider, security = {}) {
  return normalizeConfig({
    app: { name: 'Worker fixture', baseUrl: 'http://127.0.0.1:3000' }, auth: { type: 'none' },
    runtime: { artifactsDir: '.worker-fixture-artifacts', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
    discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false, maxSourceFiles: 10, uiRoutes: [], apiRoutes: [] },
    security: { networkPolicy: 'allowlist', allowedHosts: [], redactSecrets: true, ...security }, evidenceProviders: [provider],
  });
}

function acquire(provider, options = {}) {
  const configValue = config(provider, options.security);
  return acquireEvidenceForCompilation({
    plannerContext: { config: configValue, input: { goal: intent.goal, tenantId: 'tenant-a' }, runId: `worker-${provider.id}`, discovery, ...(options.signal === undefined ? {} : { signal: options.signal }) },
    intent, currentEvidence: evidence, requirements: [requirement], providers: [provider], timeoutMs: options.timeoutMs ?? 500,
    resourceLimits: { maxResponseBytes: 64_000, maxGraphs: 2, maxOperations: 10, maxArtifacts: 2 },
  });
}

assert.throws(() => config(worker('bad-memory', 'good', { limits: { memoryMb: 8 } })), /memoryMb/);
assert.throws(() => config(worker('bad-support', 'good', { supports: {} })), /supported requirement selector/);
assert.throws(() => config(worker('bad-environment', 'good', { allowedEnvironmentVariables: ['bad-name'] })), /environment-variable name/);

const goodCycle = await acquire(worker('good-worker', 'good'));
assert.equal(goodCycle.diagnostics.length, 0);
assert.equal(goodCycle.graphs.length, 1);
assert.deepEqual(goodCycle.workerExecutions.map((entry) => ({ status: entry.status, memory: entry.memoryLimitMb, file: entry.filesystemIsolation, network: entry.networkIsolation })), [
  { status: 'completed', memory: 32, file: 'not-enforced', network: 'not-enforced' },
]);

const malformedCycle = await acquire(worker('malformed-worker', 'malformed'));
assert.deepEqual(malformedCycle.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_RESPONSE_INVALID']);
assert.equal(malformedCycle.graphs.length, 0);

const crashCycle = await acquire(worker('crash-worker', 'crash'));
assert.deepEqual(crashCycle.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_WORKER_CRASHED']);
assert.equal(crashCycle.workerExecutions[0]?.status, 'crashed');

const hangCycle = await acquire(worker('hang-worker', 'hang'), { timeoutMs: 80 });
assert.deepEqual(hangCycle.diagnostics.map((entry) => entry.code), ['EVIDENCE_PROVIDER_TIMEOUT']);
assert.equal(hangCycle.workerExecutions[0]?.forcedTermination, true);
assert.equal(hangCycle.workerExecutions[0]?.status, 'timed-out');

const controller = new AbortController();
setTimeout(() => controller.abort(new Error('worker cancellation fixture')), 80);
const cancelledCycle = await acquire(worker('cancelled-worker', 'hang'), { timeoutMs: 1000, signal: controller.signal });
assert.deepEqual(cancelledCycle.diagnostics.map((entry) => entry.code), ['EVIDENCE_ACQUISITION_CANCELLED']);
assert.equal(cancelledCycle.workerExecutions[0]?.forcedTermination, true);
assert.equal(cancelledCycle.workerExecutions[0]?.status, 'cancelled');

const memoryCycle = await acquire(worker('memory-worker', 'memory', { limits: { memoryMb: 16 } }), { timeoutMs: 2000 });
assert.equal(memoryCycle.diagnostics[0]?.code, 'EVIDENCE_PROVIDER_WORKER_CRASHED');
assert.equal(memoryCycle.workerExecutions[0]?.memoryLimitMb, 16);
assert.equal(memoryCycle.workerExecutions[0]?.status, 'crashed');

process.env.BRISK_WORKER_ALLOWED = 'allowed-value';
process.env.BRISK_WORKER_SECRET = 'must-not-cross-worker-boundary';
const environmentCycle = await acquire(worker('environment-worker', 'environment', { allowedEnvironmentVariables: ['BRISK_WORKER_ALLOWED'] }));
assert.equal(environmentCycle.diagnostics.length, 0);
const environmentBinding = environmentCycle.graphs[0]?.operations[0]?.binding;
assert.equal(environmentBinding.allowedEnvironmentVisible, true);
assert.equal(environmentBinding.unlistedSecretVisible, false);
delete process.env.BRISK_WORKER_ALLOWED;
delete process.env.BRISK_WORKER_SECRET;

const blockedByHostPolicy = await acquire(worker('unisolated-worker', 'accessProbe'), { security: { requireEvidenceWorkerHostIsolation: true } });
assert.deepEqual(blockedByHostPolicy.diagnostics.map((entry) => entry.code), ['EVIDENCE_WORKER_HOST_ISOLATION_REQUIRED']);
assert.equal(blockedByHostPolicy.workerExecutions.length, 0);

const server = createServer((_request, response) => { response.writeHead(204); response.end(); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
try {
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  process.env.WORKER_PROBE_URL = `http://127.0.0.1:${address.port}/probe`;
  const accessCycle = await acquire(worker('access-probe-worker', 'accessProbe', { allowedEnvironmentVariables: ['WORKER_PROBE_URL'] }));
  assert.equal(accessCycle.diagnostics.length, 0);
  const accessBinding = accessCycle.graphs[0]?.operations[0]?.binding;
  assert.equal(accessBinding.directFileReadSucceeded, true);
  assert.equal(accessBinding.directNetworkCallSucceeded, true);
  assert.equal(accessCycle.workerExecutions[0]?.filesystemIsolation, 'not-enforced');
  assert.equal(accessCycle.workerExecutions[0]?.networkIsolation, 'not-enforced');
} finally {
  delete process.env.WORKER_PROBE_URL;
  await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify({
  suite: 'evidence-worker-security', proofClass: 'synthetic', configurationChecks: 3, successChecks: 3,
  malformedChecks: 2, crashChecks: 2, forcedTimeoutChecks: 3, cancellationChecks: 3,
  memoryBoundaryChecks: 3, environmentChecks: 3, requiredHostIsolationChecks: 2, honestGapChecks: 4,
  memoryOutcome: memoryCycle.workerExecutions[0]?.status,
  failures: 0, skips: 0,
  exclusions: ['filesystem and network access are demonstrated as not enforced without a host sandbox', 'no container or cross-platform host sandbox proof'],
}, null, 2));
