import assert from 'node:assert/strict';
import {
  validatePipelineDiagnosticJsonContract,
  validatePipelineStagePayloadJsonContract,
  validatePipelineStageEnvelopeJsonContract,
} from '../dist/index.js';

const diagnostic = {
  schemaVersion: 'brisk-aitesting.diagnostic.v1', code: 'EVIDENCE_MISSING',
  severity: 'error', category: 'evidence', stage: 'compilation',
  message: 'An authoritative account identifier is required.', recoverable: true,
  retryable: false, nextAction: 'Acquire the account contract or provide an explicit fixture.',
  references: [{ kind: 'action', id: 'action_create_account' }], causes: [],
};

const input = {
  schemaVersion: 'brisk-aitesting.stage-envelope.v1', direction: 'input',
  stageId: 'stage_1', stage: 'compilation',
  contract: { name: 'brisk-aitesting.compilation', version: 'v1' },
  correlationId: 'correlation_1', runId: 'run_1', evidenceRevision: 'evidence_1',
  policyDigest: 'sha256:12345678', retry: { attempt: 1, maxAttempts: 2 },
  recovery: { mode: 'fresh' }, cancellation: { requested: false },
  provenance: [{ kind: 'evidence', id: 'evidence_1', digest: '12345678' }],
  createdAt: '2026-08-02T00:00:00.000Z', payload: { intentId: 'intent_1' },
};

const { createdAt: _createdAt, ...outputBase } = input;
const output = {
  ...outputBase, direction: 'output', status: 'completed-with-diagnostics',
  startedAt: '2026-08-02T00:00:00.000Z', completedAt: '2026-08-02T00:00:00.010Z',
  durationMs: 10, diagnostics: [diagnostic], artifacts: [],
  redaction: { applied: true, policyId: 'default-redaction-v1' },
};

assert.deepEqual(validatePipelineDiagnosticJsonContract(diagnostic), []);
assert.deepEqual(validatePipelineStageEnvelopeJsonContract(input), []);
assert.deepEqual(validatePipelineStageEnvelopeJsonContract(output), []);

const evidence = { schemaVersion: 'brisk-aitesting.evidence-graph.v1' };
const freshness = {
  schemaVersion: 'brisk-aitesting.evidence-freshness.v1', status: 'fresh',
  checkedAt: '2026-08-02T00:00:00.000Z', validUntil: '2026-08-02T00:05:00.000Z',
  reasonCode: 'SOURCE_REVISION_UNCHANGED', sourceRevision: 'contract-v1',
};
const upstreamPayloads = [
  {
    schemaVersion: 'brisk-aitesting.inspection-input.v1',
    app: { name: 'Example', baseUrl: 'http://127.0.0.1:3000', repoPath: 'C:/repo' },
    scope: { repository: true, ui: true, api: true, contracts: true },
    contractPaths: [{ kind: 'openapi', path: 'openapi.json' }],
    limits: { maxSourceFiles: 1000, maxContractBytes: 1048576 },
  },
  {
    schemaVersion: 'brisk-aitesting.evidence-acquisition-input.v1',
    requirements: [{ id: 'missing_1', semanticType: 'account.id', reasonCode: 'INPUT_MISSING', reason: 'Account identity is required.', requiredAuthority: 'contract' }],
    eligibleProviderIds: ['openapi'], scope: { appName: 'Example', allowedHosts: ['127.0.0.1'] }, cachePolicy: 'refresh-stale',
  },
  {
    schemaVersion: 'brisk-aitesting.evidence-conflict-input.v1',
    graphs: [evidence], authorityOrder: ['host', 'contract', 'runtime', 'observed', 'source', 'heuristic'], hostOverrides: [],
  },
  {
    schemaVersion: 'brisk-aitesting.semantic-planning-input.v1',
    goal: 'Test account creation', scenarioCountPolicy: 'exact', mode: 'automatic', requiredTypes: ['api'], tags: [], evidence,
  },
  {
    schemaVersion: 'brisk-aitesting.compilation-input.v1',
    intent: { schemaVersion: 'brisk-aitesting.intent.v1' }, evidence,
  },
  {
    schemaVersion: 'brisk-aitesting.missing-evidence-input.v1',
    compilation: { schemaVersion: 'brisk-aitesting.compilation-output.v1' }, currentEvidence: evidence,
    requirements: [{ id: 'missing_1', semanticType: 'account.id', reasonCode: 'INPUT_MISSING', reason: 'Account identity is required.', requiredAuthority: 'contract' }],
  },
  freshness,
];
for (const payload of upstreamPayloads) assert.deepEqual(validatePipelineStagePayloadJsonContract(payload), []);

const invalid = [
  { name: 'unknown diagnostic field', value: { ...diagnostic, executablePath: '/admin/delete' }, validate: validatePipelineDiagnosticJsonContract },
  { name: 'unknown envelope field', value: { ...input, secret: 'do-not-store' }, validate: validatePipelineStageEnvelopeJsonContract },
  { name: 'invalid attempt', value: { ...input, retry: { attempt: 0, maxAttempts: 2 } }, validate: validatePipelineStageEnvelopeJsonContract },
  { name: 'invalid stage', value: { ...input, stage: 'arbitrary-code' }, validate: validatePipelineStageEnvelopeJsonContract },
  // REG-0001 guards a subtle AJV configuration failure: registering
  // `date-time` as an always-valid annotation accepts ordinary prose.
  { name: 'invalid cancellation timestamp', value: { ...input, cancellation: { requested: true, requestedAt: 'yesterday' } }, validate: validatePipelineStageEnvelopeJsonContract },
  { name: 'invalid diagnostic code', value: { ...diagnostic, code: 'free form' }, validate: validatePipelineDiagnosticJsonContract },
  { name: 'invalid output duration', value: { ...output, durationMs: -1 }, validate: validatePipelineStageEnvelopeJsonContract },
];

for (const fixture of invalid) assert.ok(fixture.validate(fixture.value).length > 0, `${fixture.name} should be blocked as malformed control-plane data`);

const invalidStagePayloads = [
  { name: 'unsupported payload version', value: { schemaVersion: 'brisk-aitesting.unknown.v1' } },
  { name: 'inspection unknown field', value: { ...upstreamPayloads[0], executableCommand: 'delete everything' } },
  { name: 'inspection invalid base URL', value: { ...upstreamPayloads[0], app: { name: 'Example', baseUrl: 'not a URI' } } },
  { name: 'evidence request without requirements', value: { ...upstreamPayloads[1], requirements: [] } },
  { name: 'duplicate authority precedence', value: { ...upstreamPayloads[2], authorityOrder: ['host', 'host'] } },
  { name: 'semantic planning unknown engine', value: { ...upstreamPayloads[3], requiredTypes: ['shell-script'] } },
  { name: 'freshness invalid timestamp', value: { ...freshness, checkedAt: 'recently' } },
  { name: 'freshness unknown field', value: { ...freshness, trustMe: true } },
];
for (const fixture of invalidStagePayloads) assert.ok(validatePipelineStagePayloadJsonContract(fixture.value).length > 0, `${fixture.name} should be blocked as malformed control-plane data`);

const malformedControlPlaneFixtures = invalid.length + invalidStagePayloads.length;

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.pipeline-contract-smoke.v1', positiveChecks: 3 + upstreamPayloads.length,
  malformedControlPlaneFixtures,
  blockedMalformedControlPlaneFixtures: malformedControlPlaneFixtures,
  failures: 0, skips: 0,
}, null, 2));
