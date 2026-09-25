import assert from 'node:assert/strict';
import {
  createEvidenceGraph,
  normalizeConfig,
  runEvidenceProviderConformance,
} from '../dist/index.js';

const requirement = {
  id: 'evidence_customer_profile',
  semanticType: 'operation.api.http.customer-profile',
  reasonCode: 'NO_OPERATION_FOR_INTENT',
  reason: 'The customer profile operation is missing.',
  requiredAuthority: 'contract',
  capability: 'api.http',
  scenarioId: 'customer-profile',
  actionId: 'read-profile',
};
const operation = {
  id: 'fixture.read-customer-profile', adapterId: 'fixture-http', capability: 'api.http',
  name: 'Read customer profile', action: 'read', resource: 'customer profile', sideEffect: 'read',
  inputs: [], outputs: [],
  outcomes: [{ id: 'returned', meaning: 'profile returned', successful: true, binding: { status: 200 } }],
  provenance: [{ authority: 'contract', source: 'fixture-contract', confidence: 1, observedAt: '2026-08-02T00:00:00.000Z', revision: 'fixture-v1' }],
  binding: { method: 'GET', path: '/api/customer-profile' },
};
const intent = {
  schemaVersion: 'brisk-aitesting.intent.v1', goal: 'Read the customer profile.',
  scenarios: [{
    id: 'customer-profile', name: 'Customer profile', objective: 'Read the customer profile.',
    actions: [{ id: 'read-profile', verb: 'read', resource: 'customer profile', capability: 'api.http', expectedOutcomes: [] }],
    invariants: [], evidenceRequired: ['authoritative operation'], cleanup: 'isolated',
  }],
  warnings: [],
};
const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1',
  app: { name: 'Provider conformance fixture', baseUrl: 'http://127.0.0.1:3000' },
  uiRoutes: [], apiRoutes: [], contracts: [], repoSignals: [], warnings: [], createdAt: '2026-08-02T00:00:00.000Z',
};
const emptyEvidence = createEvidenceGraph([]);
const config = normalizeConfig({
  app: { name: 'Provider conformance fixture', baseUrl: 'http://127.0.0.1:3000' },
  auth: { type: 'none' },
  runtime: { artifactsDir: '.provider-conformance-fixture', timeoutMs: 1000, retries: 0, headless: true, dryRun: true },
  discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false, maxSourceFiles: 10, uiRoutes: [], apiRoutes: [] },
  security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1'], redactSecrets: true },
});
const plannerContext = {
  config, input: { goal: intent.goal, evidenceGraph: emptyEvidence }, runId: 'provider-conformance', discovery,
};
const resourceLimits = { maxResponseBytes: 64_000, maxGraphs: 1, maxOperations: 10, maxArtifacts: 2 };

function outputFor(providerId, input, graphs = [{
  schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: `graph-${providerId}`, operations: [operation], diagnostics: [],
}]) {
  return {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-output.v1', graphs,
    attempts: [{
      providerId, status: 'succeeded', requirementIds: input.requirements.map((entry) => entry.id),
      graphRevisions: graphs.map((graph) => graph.revision), cache: 'miss',
    }],
    satisfiedRequirementIds: input.requirements.map((entry) => entry.id), unsatisfiedRequirementIds: [], artifacts: [],
  };
}

function baseCase(provider, overrides = {}) {
  return {
    schemaVersion: 'brisk-aitesting.evidence-provider-conformance-case.v1',
    provider, plannerContext, intent, currentEvidence: emptyEvidence, requirements: [requirement],
    timeoutMs: 30, resourceLimits, ...overrides,
  };
}

let refreshCalls = 0;
let disposeCalls = 0;
const goodProvider = {
  id: 'good-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process',
  supports: () => true,
  acquire(input, context) {
    if (context.signal.aborted) throw new Error('cancelled');
    return outputFor(this.id, input);
  },
  checkFreshness() {
    return { schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'stale', checkedAt: '2026-08-02T00:00:00.000Z', reasonCode: 'FIXTURE_CHANGED' };
  },
  refresh(input) { refreshCalls += 1; return outputFor(this.id, input); },
  dispose() { disposeCalls += 1; },
};

const good = await runEvidenceProviderConformance(baseCase(goodProvider, {
  freshnessProbe: 'stale-refresh', cancellationProbe: true, disposalRequired: true,
}));
assert.equal(good.status, 'passed', good.errors.join('\n'));
assert.equal(refreshCalls, 1);
assert.equal(disposeCalls, 1);
assert.ok(good.checks.some((check) => check.name === 'stale evidence refreshes' && check.status === 'passed'));
assert.ok(good.checks.some((check) => check.name === 'provider cancellation probe stops without successful output' && check.status === 'passed'));

const slow = await runEvidenceProviderConformance(baseCase({
  id: 'slow-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire: () => new Promise(() => {}),
}));
assert.equal(slow.status, 'failed');
assert.ok(slow.errors.some((error) => error.includes('configured bound')));

const malformed = await runEvidenceProviderConformance(baseCase({
  id: 'malformed-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire: (input) => ({ ...outputFor('malformed-source', input), graphs: [] }),
}));
assert.equal(malformed.status, 'failed');
assert.ok(malformed.errors.some((error) => error.includes('contract and consistency')));

const oversized = await runEvidenceProviderConformance(baseCase({
  id: 'oversized-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire: (input) => outputFor('oversized-source', input, [
    { schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'graph-one', operations: [operation], diagnostics: [] },
    { schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'graph-two', operations: [operation], diagnostics: [] },
  ]),
}));
assert.equal(oversized.status, 'failed');
assert.ok(oversized.errors.some((error) => error.includes('contract and consistency')));

const leakingOperation = { ...operation, binding: { method: 'GET', path: '/api/customer-profile', authorization: 'Bearer abcdefghijklmnopqrstuvwxyz' } };
const leaking = await runEvidenceProviderConformance(baseCase({
  id: 'leaking-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire: (input) => outputFor('leaking-source', input, [{
    schemaVersion: 'brisk-aitesting.evidence-graph.v1', revision: 'leaking-graph', operations: [leakingOperation], diagnostics: [],
  }]),
}));
assert.equal(leaking.status, 'failed');
assert.ok(leaking.errors.some((error) => error.includes('secret-shaped')));

const ignoresCancellation = await runEvidenceProviderConformance(baseCase({
  id: 'cancellation-ignoring-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire(input) { return outputFor(this.id, input); },
}, { cancellationProbe: true }));
assert.equal(ignoresCancellation.status, 'failed');
assert.ok(ignoresCancellation.errors.some((error) => error.includes('after cancellation')));

const disposalFailure = await runEvidenceProviderConformance(baseCase({
  id: 'disposal-failing-source', schemaVersion: 'brisk-aitesting.evidence-provider.v2', revision: 'fixture-v1', execution: 'trusted-in-process', supports: () => true,
  acquire(input) { return outputFor(this.id, input); },
  dispose() { throw new Error('fixture disposal failure'); },
}, { disposalRequired: true }));
assert.equal(disposalFailure.status, 'failed');
assert.ok(disposalFailure.errors.some((error) => error.includes('fixture disposal failure')));

const reports = [good, slow, malformed, oversized, leaking, ignoresCancellation, disposalFailure];
const checks = reports.reduce((total, report) => total + report.checks.length, 0);
const deliberatelyRejected = reports.slice(1).filter((report) => report.status === 'failed').length;

console.log(JSON.stringify({
  suite: 'evidence-provider-conformance', proofClass: 'synthetic', providers: reports.length,
  conformingProviders: 1, deliberatelyRejectedProviders: deliberatelyRejected, checks,
  failures: 0, skips: good.checks.filter((check) => check.status === 'not-applicable').length,
  exclusions: ['no real provider', 'no OS process isolation', 'no real network/filesystem/tenant boundary'],
}, null, 2));
