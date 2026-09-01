import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import {
  createBriskAiTesting,
  defineConfig,
} from '../dist/index.js';
import { createEventMessagingServer } from '../reference-apps/event-messaging/server.mjs';

const server = createEventMessagingServer();
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Semantic workflow proof app did not expose a TCP port.');

try {
  const provider = {
    name: 'semantic-workflow-fixture-provider',
    requests: [],
    async complete(request) {
      this.requests.push(request);
      return {
        content: JSON.stringify({
          scenarios: [{
            id: 'message_delivery',
            name: 'A published message reaches its subscription',
            objective: 'Prove the complete channel, topic, subscription, publish, and consume workflow.',
            actions: [
              { id: 'create_channel', verb: 'create', resource: 'channel', capability: 'api.http', expectedOutcomes: [] },
              { id: 'create_topic', verb: 'create', resource: 'topic', capability: 'api.http', expectedOutcomes: [] },
              { id: 'create_subscription', verb: 'create', resource: 'subscription', capability: 'api.http', expectedOutcomes: [] },
              { id: 'publish_message', verb: 'publish', resource: 'message', capability: 'api.http', expectedOutcomes: [] },
              { id: 'consume_message', verb: 'consume', resource: 'message', capability: 'api.http', expectedOutcomes: [] },
            ],
            invariants: ['the consumed message belongs to the published topic'],
            evidenceRequired: ['created resource identities', 'published message', 'subscription delivery'],
            cleanup: 'isolated',
          }],
          warnings: [],
        }),
      };
    },
  };
  const tester = createBriskAiTesting(defineConfig({
    app: {
      name: 'Semantic event workflow proof',
      baseUrl: `http://127.0.0.1:${address.port}`,
      repoPath: resolve('reference-apps/event-messaging'),
      env: 'local',
    },
    auth: { type: 'none' },
    contracts: {
      openApiPath: resolve('reference-apps/event-messaging/openapi.json'),
      asyncApiPath: resolve('reference-apps/event-messaging/asyncapi.json'),
    },
    runtime: {
      artifactsDir: join('.brisk-aitesting-semantic-workflow', 'artifacts'),
      timeoutMs: 30_000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: false,
      includeUi: false,
      includeApi: true,
      includeContracts: true,
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1', '::1'],
      redactSecrets: true,
      strictMode: true,
      allowFallbackTargets: false,
      allowAiTargets: false,
      allowHeuristicWorkflowCapture: false,
      uiHealing: 'off',
    },
    aiProvider: provider,
  }));

  const result = await tester.run({
    goal: 'Create a messaging path and prove a published message reaches its subscription.',
    scenarios: 1,
    scenarioCountPolicy: 'exact',
    mode: 'automatic',
    requiredTypes: ['api'],
  });

  assert.equal(provider.requests.length, 1);
  assert.equal(provider.requests[0]?.jsonSchemaName, 'brisk-aitesting.intent.v1');
  assert.equal(result.verdict, 'passed', JSON.stringify(result.outcome.issues));
  assert.equal(result.summary.total, 1, 'five engine operations must aggregate into one requested test scenario');
  assert.equal(result.summary.passed, 1);
  assert.equal(result.tests[0]?.engine, 'universal-semantic-workflow');
  assert.equal(result.operations.length, 5);
  assert.equal(result.operations.every((operation) => operation.status === 'passed'), true, JSON.stringify(result.operations));

  const targets = result.plan.scenarios.map((scenario) => `${scenario.target?.method} ${scenario.target?.path}`);
  // Placeholders and captures are scoped to their producing step, so two
  // same-typed values (for example two channel ids) can never be confused.
  assert.deepEqual(targets, [
    'POST /api/channels',
    'POST /api/channels/<step_message_delivery_create_channel_1.channelId>/topics',
    'POST /api/topics/<step_message_delivery_create_topic_2.topicId>/subscriptions',
    'POST /api/topics/<step_message_delivery_create_topic_2.topicId>/messages',
    'GET /api/subscriptions/<step_message_delivery_create_subscription_3.subscriptionId>/messages',
  ]);
  assert.deepEqual(result.plan.scenarios.map((scenario) => scenario.expect?.status), [201, 201, 201, 202, 200]);
  assert.equal(result.plan.scenarios[0]?.capture?.some((capture) => capture.name === 'step_message_delivery_create_channel_1.channelId' && capture.path.startsWith('$')), true);
  assert.equal(result.plan.scenarios[1]?.capture?.some((capture) => capture.name === 'step_message_delivery_create_topic_2.topicId' && capture.path.startsWith('$')), true);
  assert.equal(result.plan.scenarios[2]?.capture?.some((capture) => capture.name === 'step_message_delivery_create_subscription_3.subscriptionId' && capture.path.startsWith('$')), true);
  assert.equal(result.plan.scenarios.every((scenario) => scenario.metadata?.generatedBy === 'universal-semantic-compiler'), true);

  const widgets = new Set();
  let deleteCalls = 0;
  const cleanupServer = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/api/widgets') {
      const id = `widget-${widgets.size + 1}`;
      widgets.add(id);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id, name: 'generated-widget' }));
      return;
    }
    const match = request.url?.match(/^\/api\/widgets\/([^/]+)$/);
    if (request.method === 'DELETE' && match !== undefined && match !== null) {
      deleteCalls += 1;
      const existed = widgets.delete(decodeURIComponent(match[1]));
      response.writeHead(existed ? 204 : 404);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolveListen) => cleanupServer.listen(0, '127.0.0.1', resolveListen));
  try {
    const cleanupAddress = cleanupServer.address();
    if (cleanupAddress === null || typeof cleanupAddress === 'string') throw new Error('Cleanup proof server did not expose a TCP port.');
    const cleanupProvider = {
      name: 'semantic-cleanup-fixture-provider',
      async complete() {
        return {
          content: JSON.stringify({
            scenarios: [{
              id: 'widget_lifecycle',
              name: 'A temporary widget can be created',
              objective: 'Prove widget creation without leaving test data behind.',
              actions: [
                { id: 'create_widget', verb: 'create', resource: 'widget', capability: 'api.http', expectedOutcomes: [] },
              ],
              invariants: ['the test leaves no widget behind'],
              evidenceRequired: ['created widget identity'],
              cleanup: 'automatic',
            }],
            warnings: [],
          }),
        };
      },
    };
    const cleanupTester = createBriskAiTesting(defineConfig({
      app: {
        name: 'Semantic cleanup proof',
        baseUrl: `http://127.0.0.1:${cleanupAddress.port}`,
        env: 'local',
      },
      auth: { type: 'none' },
      contracts: { openApiPath: resolve('fixtures/compiler/openapi-cleanup.json') },
      runtime: {
        artifactsDir: join('.brisk-aitesting-semantic-workflow', 'cleanup-artifacts'),
        timeoutMs: 30_000,
        retries: 0,
        headless: true,
        dryRun: false,
      },
      discovery: {
        includeRepo: false,
        includeUi: false,
        includeApi: true,
        includeContracts: true,
      },
      security: {
        networkPolicy: 'localhost-only',
        allowedHosts: ['localhost', '127.0.0.1', '::1'],
        redactSecrets: true,
        strictMode: true,
        allowFallbackTargets: false,
        allowAiTargets: false,
        allowHeuristicWorkflowCapture: false,
        uiHealing: 'off',
      },
      aiProvider: cleanupProvider,
    }));
    const cleanupResult = await cleanupTester.run({
      goal: 'Create a temporary widget and clean it up.',
      scenarios: 1,
      scenarioCountPolicy: 'exact',
      mode: 'automatic',
      requiredTypes: ['api'],
    });
    assert.equal(cleanupResult.verdict, 'passed', JSON.stringify(cleanupResult.outcome.issues));
    assert.equal(cleanupResult.summary.total, 1);
    assert.equal(cleanupResult.operations.length, 2, 'create execution and compensation cleanup must both be retained');
    assert.equal(deleteCalls, 1, 'automatic cleanup must execute exactly once');
    assert.equal(widgets.size, 0, 'automatic cleanup must remove the created resource');
  } finally {
    await new Promise((resolveClose) => cleanupServer.close(resolveClose));
  }

  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.semantic-workflow-smoke.v1',
    status: 'passed',
    requestedScenarios: 1,
    logicalTests: result.tests.length,
    compiledOperations: result.operations.length,
    automaticCleanup: {
      deleteCalls,
      resourcesRemaining: widgets.size,
    },
    targets,
    verdict: result.verdict,
  }, null, 2));
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
