import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageConsumerPact, asynchronousBodyHandler } from '@pact-foundation/pact';
import {
  createBriskAiTesting,
  defineConfig,
  PactMessageEngine,
  runEnginePluginConformance,
} from '../dist/index.js';
import { createEventMessagingServer } from '../reference-apps/event-messaging/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const pactDir = join(packageDir, '.brisk-aitesting-pact-smoke', 'pacts');
await rm(join(packageDir, '.brisk-aitesting-pact-smoke'), { recursive: true, force: true });
await mkdir(pactDir, { recursive: true });

const providerName = 'Event Messaging Proof App';
const consumerName = 'Order Dashboard';
const messageDescription = 'an order created event';
const message = { orderId: 'order_1', amount: 42 };

const consumerPact = new MessageConsumerPact({
  consumer: consumerName,
  provider: providerName,
  dir: pactDir,
  logLevel: 'error',
});
await consumerPact
  .given('an order has been created')
  .expectsToReceive(messageDescription)
  .withContent(message)
  .withMetadata({ 'content-type': 'application/json' })
  .verify(asynchronousBodyHandler(async (body) => {
    if (body.orderId !== message.orderId || body.amount !== message.amount) {
      throw new Error('consumer handler received the wrong order message');
    }
  }));

const pactFiles = (await readdir(pactDir)).filter((entry) => entry.endsWith('.json'));
if (pactFiles.length !== 1) throw new Error(`Expected exactly one generated pact file, found ${pactFiles.length}.`);
const pactUrl = join(pactDir, pactFiles[0]);
const server = createEventMessagingServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('event/messaging reference app did not expose a TCP port');

try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = defineConfig({
    app: {
      name: providerName,
      baseUrl,
      repoPath: join(packageDir, 'reference-apps', 'event-messaging'),
      env: 'local',
    },
    auth: { type: 'none' },
    contracts: {
      openApiPath: join(packageDir, 'reference-apps', 'event-messaging', 'openapi.json'),
      asyncApiPath: join(packageDir, 'reference-apps', 'event-messaging', 'asyncapi.json'),
      pactDir,
    },
    runtime: {
      artifactsDir: join(packageDir, '.brisk-aitesting-pact-smoke', 'artifacts'),
      timeoutMs: 120_000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['127.0.0.1', 'localhost'],
      redactSecrets: true,
    },
  });
  const scenario = {
    id: 'pact_order_created_message',
    name: 'Pact verifies order created event',
    type: 'message',
    objective: 'Run real Pact message provider verification against a local pact file.',
    target: { schema: config.contracts.asyncApiPath, channel: 'orders.created', sourceOfTruth: 'contract' },
    assertions: ['Pact message provider verification passes'],
    evidenceRequired: ['message', 'schema'],
    metadata: {
      adapter: 'pact',
      pact: {
        provider: providerName,
        pactUrls: [pactUrl],
        messageDescription,
        message,
        metadata: { 'content-type': 'application/json', contentType: 'application/json' },
      },
    },
  };
  const unrelatedScenario = {
    id: 'pact_unrelated_api',
    name: 'unrelated API scenario',
    type: 'api',
    objective: 'Pact must reject unrelated API scenarios.',
    target: { method: 'GET', path: '/api/health', sourceOfTruth: 'contract' },
    assertions: ['api runs'],
    evidenceRequired: ['api'],
  };
  const plan = {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: 'pact_smoke',
    goal: 'Run real Pact adapter smoke',
    mode: 'message',
    scenarios: [scenario],
    discovery: {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: { name: config.app.name, baseUrl: config.app.baseUrl, repoPath: config.app.repoPath },
      uiRoutes: [],
      apiRoutes: [],
      contracts: [],
      repoSignals: [],
      warnings: [],
      createdAt: new Date().toISOString(),
    },
    warnings: [],
    createdAt: new Date().toISOString(),
  };
  const engine = new PactMessageEngine();
  const conformance = await runEnginePluginConformance({
    config,
    plan,
    cases: [{ engine, validScenario: scenario, unrelatedScenario }],
    runId: 'pact_conformance',
  });
  const tester = createBriskAiTesting(config, {
    planner: {
      name: 'pact-smoke-planner',
      async plan(context) {
        return { ...plan, runId: context.runId, goal: context.input.goal, discovery: context.discovery };
      },
    },
    engines: [engine],
  });
  const result = await tester.run({ goal: 'Run real Pact message adapter against event/messaging proof app', scenarios: 1, mode: 'message' });
  const errors = [];
  if (conformance.status !== 'passed') errors.push(`Pact engine conformance failed: ${conformance.errors.join('; ')}`);
  if (result.status !== 'passed') errors.push(`Pact run did not pass: ${result.status}`);
  const evidenceArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.pact-message-evidence.v1' && artifact.path !== undefined);
  const evidence = evidenceArtifact?.path === undefined ? undefined : JSON.parse(await readFile(evidenceArtifact.path, 'utf8'));
  if (evidence?.schemaVersion !== 'brisk-aitesting.pact-message-evidence.v1') errors.push('wrong Pact evidence schema');
  if ((evidence?.messageProviderNames?.length ?? 0) < 1) errors.push('Pact coverage missing message provider evidence');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.pact-message-evidence.v1')) errors.push('coverage missing Pact evidence artifact');

  const status = errors.length === 0 ? 'passed' : 'failed';
  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.pact-message-smoke.v1',
    status,
    conformance: {
      status: conformance.status,
      engines: conformance.engines.map((entry) => ({ name: entry.name, status: entry.status })),
    },
    summary: result.summary,
    evidence: evidence === undefined ? undefined : {
      schemaVersion: evidence.schemaVersion,
      status: evidence.status,
      provider: evidence.provider,
      messageProviderNames: evidence.messageProviderNames,
    },
    errors,
  }, null, 2));
  if (status !== 'passed') process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// coverage missing guard for adapter readiness.
