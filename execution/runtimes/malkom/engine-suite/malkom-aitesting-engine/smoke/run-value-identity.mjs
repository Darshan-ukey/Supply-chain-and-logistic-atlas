// The "never guess between two channel IDs" proof.
//
// Two checks each create their own channel, then read their own channel back.
// The server records exactly which channel each read and each cleanup hit.
// If value identity ever regresses (captures collapsing into one shared name,
// lookup guessing, cleanup deleting the wrong resource), this test fails.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBriskAiTesting, createHttpEvidenceGraph, HostHttpCapabilityAdapter } from '../dist/index.js';

const channels = new Map();
const reads = [];
const deletes = [];
let nextChannel = 0;

const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    if (request.method === 'POST' && request.url === '/api/channels') {
      nextChannel += 1;
      const id = `channel-${nextChannel}`;
      const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      channels.set(id, body.name ?? id);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id, name: body.name ?? id }));
      return;
    }
    const readMatch = request.url?.match(/^\/api\/channels\/([^/]+)$/);
    if (request.method === 'GET' && readMatch) {
      const id = decodeURIComponent(readMatch[1]);
      reads.push(id);
      if (!channels.has(id)) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id, name: channels.get(id) }));
      return;
    }
    if (request.method === 'DELETE' && readMatch) {
      const id = decodeURIComponent(readMatch[1]);
      deletes.push(id);
      const existed = channels.delete(id);
      response.writeHead(existed ? 204 : 404);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const artifactsDir = mkdtempSync(join(tmpdir(), 'brisk-value-identity-'));

const evidenceGraph = createHttpEvidenceGraph([
  {
    operationId: 'channel.create', method: 'POST', path: '/api/channels', name: 'Create channel',
    action: 'create', resource: 'channel', sideEffect: 'create',
    inputs: [{ id: 'body.name', name: 'name', location: 'body', semanticType: 'channel.name', required: true, generation: { kind: 'unique-string', prefix: 'channel' } }],
    outputs: [{ id: 'response.id', name: 'id', semanticType: 'channel.id', from: 'response.body', path: "$['id']" }],
    successStatuses: [201], authority: 'host', source: 'fixture', cleanupOperationId: 'channel.delete',
  },
  {
    operationId: 'channel.read', method: 'GET', path: '/api/channels/:channelId', name: 'Read channel',
    action: 'read', resource: 'channel', sideEffect: 'read',
    inputs: [{ id: 'path.channelId', name: 'channelId', location: 'path', semanticType: 'channel.id', required: true }],
    successStatuses: [200], authority: 'host', source: 'fixture',
  },
  {
    operationId: 'channel.delete', method: 'DELETE', path: '/api/channels/:channelId', name: 'Delete channel',
    action: 'delete', resource: 'channel', sideEffect: 'delete',
    inputs: [{ id: 'path.channelId', name: 'channelId', location: 'path', semanticType: 'channel.id', required: true }],
    successStatuses: [204], authority: 'host', source: 'fixture',
  },
]);

// Two independent checks, each: create its channel, read that exact channel.
// Explicit fromActionId names the producer, exactly as the compiler demands
// when two producers of the same type exist.
const intentResponse = JSON.stringify({
  scenarios: [
    {
      id: 'first_channel', name: 'First channel journey', objective: 'Create and read the first channel.',
      actions: [
        { id: 'create_first', verb: 'create', resource: 'channel', capability: 'api.http', expectedOutcomes: [] },
        { id: 'read_first', verb: 'read', resource: 'channel', capability: 'api.http', expectedOutcomes: [], values: {
          channelId: { semanticType: 'channel.id', fromActionId: 'create_first' },
        } },
      ],
      invariants: [], evidenceRequired: ['api'], cleanup: 'automatic',
    },
    {
      id: 'second_channel', name: 'Second channel journey', objective: 'Create and read the second channel.',
      actions: [
        { id: 'create_second', verb: 'create', resource: 'channel', capability: 'api.http', expectedOutcomes: [] },
        { id: 'read_second', verb: 'read', resource: 'channel', capability: 'api.http', expectedOutcomes: [], values: {
          channelId: { semanticType: 'channel.id', fromActionId: 'create_second' },
        } },
      ],
      invariants: [], evidenceRequired: ['api'], cleanup: 'automatic',
    },
  ],
  warnings: [],
});

const provider = { name: 'value-identity-fixture-provider', async complete() { return { content: intentResponse }; } };

const result = await createBriskAiTesting({
  app: { name: 'value-identity-smoke', baseUrl: `http://127.0.0.1:${port}` },
  ai: { provider: 'openai-compatible', model: 'fixture-model', apiKey: 'unused' },
  aiProvider: provider,
  capabilityAdapters: [new HostHttpCapabilityAdapter()],
  discovery: { apiRoutes: [
    { method: 'POST', path: '/api/channels' },
    { method: 'GET', path: '/api/channels/:channelId' },
    { method: 'DELETE', path: '/api/channels/:channelId' },
  ] },
  runtime: { artifactsDir, timeoutMs: 15_000 },
  security: { allowedHosts: ['127.0.0.1'] },
}).run({
  goal: 'Two channels stay separate end to end',
  scenarios: 2,
  mode: 'automatic',
  evidenceGraph,
  authoritativeOperations: [
    { operationId: 'channel.create', method: 'POST', path: '/api/channels', requiredBodyFields: ['name'], successStatusCodes: [201], source: 'host-adapter' },
  ],
});

assert.equal(result.verdict, 'passed', JSON.stringify({ issues: result.outcome.issues, tests: result.tests.map((test) => ({ id: test.scenarioId, status: test.status, diagnostics: test.diagnostics })) }, null, 2));
assert.equal(result.summary.passed, 2, 'both channel journeys must pass');

// The heart of the proof: each read hit its own channel, no mixing.
assert.deepEqual(reads.sort(), ['channel-1', 'channel-2'], 'each journey must read exactly its own channel');

// Cleanup deleted BOTH channels, each exactly once - not the last one twice.
assert.deepEqual([...deletes].sort(), ['channel-1', 'channel-2'], 'cleanup must delete each created channel exactly once');
assert.equal(channels.size, 0, 'no channel may remain after cleanup');

// The lowered plan itself must carry step-scoped names, not one shared name.
const paths = result.plan.scenarios.map((scenario) => scenario.target?.path).filter((path) => path?.includes('.'));
assert.equal(paths.length >= 2, true, `read paths must use step-scoped placeholders, got ${JSON.stringify(result.plan.scenarios.map((scenario) => scenario.target?.path))}`);
const captureNames = result.plan.scenarios.flatMap((scenario) => (scenario.capture ?? []).map((capture) => capture.name));
assert.equal(new Set(captureNames).size, captureNames.length, 'no two captures may share one name');

server.close();
rmSync(artifactsDir, { recursive: true, force: true });

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.value-identity-smoke.v1',
  checks: 7,
  reads,
  deletes,
  residualChannels: channels.size,
  failures: 0,
  skips: 0,
}, null, 2));
