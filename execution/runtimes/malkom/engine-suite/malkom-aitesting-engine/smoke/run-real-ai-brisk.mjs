import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const product = await import(process.env.BRISK_AITESTING_INSTALLED_PACKAGE === '1'
  ? 'brisk-aitesting'
  : '../dist/index.js');
const {
  HostHttpCapabilityAdapter,
  createBriskAiTesting,
  createHttpEvidenceGraph,
  defineConfig,
  loadEnvFiles,
} = product;

// This is a diagnostic run, not a full cross-architecture proof. It answers one
// question honestly: can brisk-aitesting discover an unfamiliar real product
// (the sibling "brisk" pub-sub platform), get a real AI response, and execute a
// connected create -> publish -> read -> refuse -> clean-up journey against it?
// It does not attempt permission-boundary, UI, healing, drift, or load proof.

const projectDir = process.env.BRISK_AITESTING_SOURCE_PROJECT_DIR
  ? resolve(process.env.BRISK_AITESTING_SOURCE_PROJECT_DIR)
  : dirname(dirname(fileURLToPath(import.meta.url)));
await loadEnvFiles({ packageDir: projectDir });

const baseUrl = process.env.BRISK_TEST_BRISK_BASE_URL ?? 'http://127.0.0.1:3000';
const adminEmail = process.env.BRISK_TEST_BRISK_ADMIN_EMAIL ?? 'admin@brisk.local';
const adminPassword = required(process.env.BRISK_TEST_BRISK_ADMIN_PASSWORD ?? 'admin123', 'BRISK_TEST_BRISK_ADMIN_PASSWORD');
const suffix = Date.now().toString(36);
const names = {
  channel: `brisk_aitesting_ai_channel_${suffix}`,
  topic: `brisk_aitesting_ai_topic_${suffix}`,
};
let adminToken;
let result;
let finalState;
const setup = [];

try {
  const login = await request('POST', '/api/auth/login', undefined, { email: adminEmail, password: adminPassword });
  adminToken = login.body?.token;
  record('admin login', login.status, 200);
  if (typeof adminToken !== 'string') throw new Error('Brisk admin login returned no token.');
  process.env.BRISK_TEST_BRISK_CLEANUP_AUTHORIZATION = `Bearer ${adminToken}`;

  // Known limitation, stated up front rather than hidden: this diagnostic uses
  // the single seeded administrator identity for both setup and the AI-planned
  // journey. It does not prove a least-privilege identity or permission
  // boundary the way the Directus real-AI proof does.
  const operationContracts = [
    {
      operationId: 'brisk.channel.create', method: 'POST', path: '/api/channels',
      name: 'Create a pub-sub channel', action: 'create', resource: 'channel', sideEffect: 'create',
      outputs: [{ id: 'response.data.id', name: 'channel id', semanticType: 'brisk.channel.id', from: 'response.body', path: 'id' }],
      successStatuses: [201], requestExample: { name: names.channel, type: 'standard' },
      cleanupOperationId: 'brisk.channel.cleanup',
      authority: 'runtime', source: 'Brisk live channel route and observed administrator permission',
    },
    {
      operationId: 'brisk.topic.create', method: 'POST', path: '/api/topics',
      name: 'Create a topic on the channel', action: 'create', resource: 'topic', sideEffect: 'create',
      inputs: [{ id: 'body.channelId', name: 'channelId', location: 'body', semanticType: 'brisk.channel.id', required: true }],
      outputs: [{ id: 'response.data.id', name: 'topic id', semanticType: 'brisk.topic.id', from: 'response.body', path: 'id' }],
      successStatuses: [201], requestExample: { name: names.topic },
      cleanupOperationId: 'brisk.topic.cleanup',
      authority: 'runtime', source: 'Brisk live topic route and observed administrator permission',
    },
    {
      operationId: 'brisk.message.publish', method: 'POST', path: '/api/topics/{topicId}/messages',
      name: 'Publish a message onto the topic', action: 'create', resource: 'message', sideEffect: 'create',
      inputs: [
        { id: 'path.topicId', name: 'topicId', location: 'path', semanticType: 'brisk.topic.id', required: true },
      ],
      successStatuses: [201], requestExample: { value: `AI connected journey ${suffix}` },
      // Brisk exposes no per-message delete endpoint; a published message's
      // only real lifecycle boundary is its parent topic. Deleting the topic
      // is therefore its true, honest cleanup path, not a stand-in.
      cleanupOperationId: 'brisk.topic.cleanup',
      authority: 'runtime', source: 'Brisk live message-publish route and observed administrator permission',
    },
    {
      operationId: 'brisk.message.read', method: 'GET', path: '/api/topics/{topicId}/messages',
      name: 'Read the published messages back', action: 'read', resource: 'message list', sideEffect: 'read',
      inputs: [{ id: 'path.topicId', name: 'topicId', location: 'path', semanticType: 'brisk.topic.id', required: true }],
      successStatuses: [200], authority: 'runtime', source: 'Brisk live message-read route observed after publish',
    },
    {
      operationId: 'brisk.topic.invalid-create', method: 'POST', path: '/api/topics',
      name: 'Reject a topic missing its required name', action: 'attempt-invalid-create', resource: 'invalid topic', sideEffect: 'none',
      inputs: [{ id: 'body.channelId', name: 'channelId', location: 'body', semanticType: 'brisk.channel.id', required: true }],
      successStatuses: [400], authority: 'runtime', source: 'Brisk live required-field validation observed on topic creation',
    },
    {
      operationId: 'brisk.topic.cleanup', method: 'DELETE', path: '/api/topics/{topicId}',
      name: 'Clean up the created topic', action: 'cleanup', resource: 'topic', sideEffect: 'delete',
      inputs: [
        { id: 'path.topicId', name: 'topicId', location: 'path', semanticType: 'brisk.topic.id', required: true },
        { id: 'header.authorization', name: 'authorization', location: 'header', semanticType: 'auth.bearer', required: true, secretRef: 'BRISK_TEST_BRISK_CLEANUP_AUTHORIZATION' },
      ],
      successStatuses: [204], authority: 'host', source: 'Isolated host cleanup identity held only in process memory',
    },
    {
      operationId: 'brisk.channel.cleanup', method: 'DELETE', path: '/api/channels/{channelId}',
      name: 'Clean up the created channel', action: 'cleanup', resource: 'channel', sideEffect: 'delete',
      inputs: [
        { id: 'path.channelId', name: 'channelId', location: 'path', semanticType: 'brisk.channel.id', required: true },
        { id: 'header.authorization', name: 'authorization', location: 'header', semanticType: 'auth.bearer', required: true, secretRef: 'BRISK_TEST_BRISK_CLEANUP_AUTHORIZATION' },
      ],
      successStatuses: [204], authority: 'host', source: 'Isolated host cleanup identity held only in process memory',
    },
  ];
  const evidenceGraph = createHttpEvidenceGraph(operationContracts);

  const config = defineConfig({
    app: { name: 'Brisk pub-sub complex real-AI diagnostic', baseUrl, env: 'local' },
    auth: { type: 'bearer', token: adminToken },
    ai: aiConfig(),
    capabilityAdapters: [new HostHttpCapabilityAdapter()],
    runtime: { artifactsDir: '.brisk-aitesting-real-ai-brisk/artifacts', timeoutMs: 120_000, retries: 0, headless: true, dryRun: false },
    discovery: {
      includeRepo: false,
      includeUi: false,
      includeApi: true,
      includeContracts: false,
      apiRoutes: operationContracts.map((operation) => ({ method: operation.method, path: operation.path })),
    },
    security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1'], redactSecrets: true },
  });

  const tester = createBriskAiTesting(config);
  result = await tester.run({
    goal: [
      'Plan exactly one complex connected Brisk pub-sub journey using all five evidenced business actions in this exact order:',
      'create channel, create topic, publish message, read message, attempt-invalid-create invalid topic.',
      'The same created channel id must flow into topic creation. The same created topic id must flow into publish, read, and the invalid-create refusal attempt uses the same channel id without a topic name.',
      'Prove successful state creation, a real published message becoming readable, and required-field rejection.',
    ].join(' '),
    scenarios: 1,
    scenarioCountPolicy: 'exact',
    requiredTypes: ['api'],
    evidenceGraph,
    authoritativeOperations: operationContracts.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      ...(operation.operationId === 'brisk.channel.create' ? { requiredBodyFields: ['name'] } : {}),
      ...(operation.operationId === 'brisk.topic.create' ? { requiredBodyFields: ['channelId', 'name'] } : {}),
      successStatusCodes: operation.successStatuses,
      source: operation.authority === 'contract' ? 'contract' : operation.authority === 'runtime' ? 'runtime' : 'host-adapter',
    })),
  });

  const channels = await request('GET', `/api/channels`, adminToken);
  const matching = Array.isArray(channels.body) ? channels.body.filter((entry) => entry.name === names.channel) : [];
  finalState = { matchingChannels: matching.length };
} finally {
  if (adminToken !== undefined) {
    // best-effort residual cleanup in case the run failed before its own cleanup stage
    const channels = await request('GET', '/api/channels', adminToken);
    const leftover = Array.isArray(channels.body) ? channels.body.filter((entry) => entry.name === names.channel) : [];
    for (const channel of leftover) {
      const response = await request('DELETE', `/api/channels/${channel.id}`, adminToken);
      setup.push({ name: 'residual cleanup channel', status: response.status, expected: 204, ok: response.status === 204 });
    }
  }
  delete process.env.BRISK_TEST_BRISK_CLEANUP_AUTHORIZATION;
}

const output = {
  schemaVersion: 'brisk-aitesting.real-ai-brisk-diagnostic.v1',
  productLoad: process.env.BRISK_AITESTING_INSTALLED_PACKAGE === '1' ? 'clean-installed-package' : 'working-tree-build',
  status: result?.status ?? 'error',
  setup,
  ai: {
    provider: process.env.BRISK_AITESTING_AI_PROVIDER ?? inferredProvider(),
    modelConfigured: Boolean(process.env.BRISK_AITESTING_AI_MODEL ?? compatibilityModel(inferredProvider())),
    scenariosPlanned: result?.plan.scenarios.length ?? 0,
    actionOperations: result?.plan.scenarios.map((scenario) => scenario.metadata?.operationId).filter(Boolean) ?? [],
  },
  execution: result?.summary ?? { total: 0, passed: 0, failed: 0, skipped: 0, errors: 1 },
  operationResults: result?.operations.map((entry) => ({ name: entry.name, status: entry.status })) ?? [],
  diagnosis: result?.diagnosis ?? [],
  finalState,
  credentialsPrinted: false,
};
console.log(JSON.stringify(output, null, 2));

const requiredOperations = ['Create a pub-sub channel', 'Create a topic on the channel', 'Publish a message onto the topic', 'Read the published messages back', 'Reject a topic missing its required name'];
const passedOperations = new Set((result?.operations ?? []).filter((entry) => entry.status === 'passed').map((entry) => entry.name));
const cleanupPassed = (result?.operations ?? []).some((entry) => entry.name.toLowerCase().startsWith('cleanup') && entry.status === 'passed');
const failures = [
  ...(result?.status === 'passed' ? [] : [`run status was ${result?.status ?? 'missing'}`]),
  ...requiredOperations.filter((name) => !passedOperations.has(name)).map((name) => `operation did not pass: ${name}`),
  ...(cleanupPassed ? [] : ['no cleanup operation was observed passing']),
  ...(finalState?.matchingChannels === 0 ? [] : ['final Brisk state retained a test-created channel after cleanup']),
  ...(setup.some((entry) => entry.ok === false) ? ['setup or residual-cleanup contained an unexpected HTTP status'] : []),
];
if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
  process.exitCode = 1;
}

function record(name, status, expected) {
  setup.push({ name, status, expected, ok: status === expected });
  if (status !== expected) throw new Error(`${name} returned HTTP ${status}; expected ${expected}.`);
}

async function request(method, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token === undefined ? {} : { authorization: `Bearer ${token}` }), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text.length === 0 ? undefined : JSON.parse(text); } catch { parsed = undefined; }
  return { status: response.status, body: parsed };
}

function aiConfig() {
  const provider = process.env.BRISK_AITESTING_AI_PROVIDER ?? inferredProvider();
  const model = process.env.BRISK_AITESTING_AI_MODEL ?? compatibilityModel(provider);
  const apiKeyEnv = process.env.BRISK_AITESTING_AI_API_KEY !== undefined ? 'BRISK_AITESTING_AI_API_KEY' : compatibilityApiKeyEnv(provider);
  const caCertPath = process.env.BRISK_AITESTING_AI_CA_CERT_PATH
    ?? process.env.BRISK_AITESTING_CA_CERT_PATH
    ?? compatibilityCaCertPath(provider);
  return {
    provider,
    model: required(model, 'AI model'),
    apiKeyEnv: required(apiKeyEnv, 'AI API key environment name'),
    ...(typeof caCertPath === 'string' && caCertPath.trim().length > 0 ? { caCertPath } : {}),
    maxTokens: 4096,
    temperature: 0.1,
  };
}

// The generic BRISK_AITESTING_AI_* variables are the only configuration
// surface; no vendor-specific names are recognized.
function inferredProvider() {
  return process.env.BRISK_AITESTING_AI_PROVIDER ?? 'openai-compatible';
}
function compatibilityApiKeyEnv() { return 'BRISK_AITESTING_AI_API_KEY'; }
function compatibilityModel() { return undefined; }
function compatibilityCaCertPath() { return undefined; }
function required(value, name) { if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required.`); return value; }
