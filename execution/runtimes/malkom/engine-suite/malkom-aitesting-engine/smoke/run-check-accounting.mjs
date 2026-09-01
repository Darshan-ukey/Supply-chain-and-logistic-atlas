// Proves the honest check counts (the total must never be hidden):
// 1. A check the product cannot support is dropped with its reasons while
//    the supported check still runs - and the result counts every requested
//    check, naming the unsupported one.
// 2. Nothing is silently dropped: understood = ready + notReady.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostHttpCapabilityAdapter, createBriskAiTesting, createHttpEvidenceGraph } from '../dist/index.js';

const artifactsDir = mkdtempSync(join(tmpdir(), 'brisk-check-accounting-'));
const app = createServer((request, response) => {
  response.writeHead(request.url === '/api/channels' ? 200 : 404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ channels: [] }));
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const appAddress = app.address();
if (appAddress === null || typeof appAddress === 'string') throw new Error('Fixture app did not expose a TCP port');

// The app truly supports only "read channel". The AI divides the request into
// two checks: one supported, one (delete topic) that no operation can serve.
const evidenceGraph = createHttpEvidenceGraph([{
  operationId: 'channel.read',
  name: 'Read channels',
  action: 'read',
  resource: 'channel',
  sideEffect: 'read',
  method: 'GET',
  path: '/api/channels',
  successStatuses: [200],
  authority: 'host',
  source: 'fixture',
}]);

const intentResponse = JSON.stringify({
  scenarios: [
    {
      id: 'read_channels', name: 'Read channels', objective: 'List channels.',
      actions: [{ id: 'a1', verb: 'read', resource: 'channel', capability: 'api.http', expectedOutcomes: [] }],
      invariants: [], evidenceRequired: ['api'], cleanup: 'automatic',
    },
    {
      id: 'delete_topic', name: 'Delete a topic', objective: 'Remove a topic.',
      actions: [{ id: 'a2', verb: 'delete', resource: 'topic', capability: 'api.http', expectedOutcomes: [] }],
      invariants: [], evidenceRequired: ['api'], cleanup: 'automatic',
    },
  ],
  warnings: [],
});

let providerCalls = 0;
const provider = {
  name: 'accounting-fixture-provider',
  async complete() {
    providerCalls += 1;
    return { content: intentResponse, usage: { inputTokens: 120, outputTokens: 45 } };
  },
};

const tester = createBriskAiTesting({
  app: { name: 'accounting-smoke', baseUrl: `http://127.0.0.1:${appAddress.port}` },
  ai: { provider: 'openai-compatible', model: 'fixture-model', apiKey: 'unused' },
  aiProvider: provider,
  runtime: { artifactsDir, timeoutMs: 15_000 },
  discovery: { includeRepo: false, includeUi: false, includeApi: true, includeContracts: false, uiRoutes: [], apiRoutes: [{ method: 'GET', path: '/api/channels' }] },
  security: { allowedHosts: ['127.0.0.1'] },
  // The delivered check now reaches lowering, which compiles the evidence
  // graph through the same default adapter every real host registers.
  capabilityAdapters: [new HostHttpCapabilityAdapter()],
});

const result = await tester.run({
  goal: 'Read the channels and delete a topic',
  scenarios: 2,
  mode: 'automatic',
  evidenceGraph,
});

assert.equal(result.summary.total, 1, 'the supported check must still run');
assert.equal(providerCalls >= 1, true);
assert.ok(result.checks, 'a partially delivered run must still carry the check counts');
assert.equal(result.checks.requested, 2);
assert.equal(result.checks.understood, 2, 'both requested checks must be counted');
assert.equal(result.checks.ready, 1, 'the supported check must be counted as ready');
assert.equal(result.checks.notReady.length, 1, 'the unsupported check must be listed, not hidden');
assert.equal(result.checks.notReady[0].checkId, 'delete_topic');
assert.equal(result.checks.notReady[0].status, 'unsupported');
assert.equal(result.checks.notReady[0].reasons.length >= 1, true, 'the unsupported check must say why');
assert.equal(result.checks.understood, result.checks.ready + result.checks.notReady.length, 'no check may be silently dropped');
assert.equal(result.plan.droppedScenarios?.length, 1, 'the plan must carry the dropped check as a record');
assert.equal(result.plan.droppedScenarios?.[0]?.id, 'delete_topic');

// AI spending is reported honestly: calls, tokens, and fingerprints - and a
// redacted record file is kept with the run's evidence.
assert.ok(result.ai, 'the result must report AI usage');
assert.equal(result.ai.calls >= 1, true);
assert.equal(result.ai.model, 'fixture-model');
assert.equal(result.ai.inputTokens, 120 * result.ai.calls);
assert.equal(result.ai.outputTokens, 45 * result.ai.calls);
assert.equal(result.ai.records.every((record) => /^[0-9a-f]{64}$/.test(record.requestDigest)), true, 'every AI call must carry a request fingerprint');
const { readFileSync, existsSync } = await import('node:fs');
const aiArtifact = result.artifacts.find((artifact) => artifact.label === 'AI usage and redacted responses');
assert.ok(aiArtifact, 'the run must keep an AI record file');
assert.equal(existsSync(aiArtifact.path), true);
const aiRecordFile = JSON.parse(readFileSync(aiArtifact.path, 'utf8'));
assert.equal(aiRecordFile.usage.calls, result.ai.calls);
assert.equal(aiRecordFile.responses.length >= 1, true, 'redacted response text must be retained');

rmSync(artifactsDir, { recursive: true, force: true });
await new Promise((resolve) => app.close(resolve));

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.check-accounting-smoke.v1',
  checks: 22,
  accounting: result.checks,
  failures: 0,
  skips: 0,
}, null, 2));
