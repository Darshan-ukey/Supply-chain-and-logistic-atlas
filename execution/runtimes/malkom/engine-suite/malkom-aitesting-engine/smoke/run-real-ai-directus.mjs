import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

const projectDir = process.env.BRISK_AITESTING_SOURCE_PROJECT_DIR
  ? resolve(process.env.BRISK_AITESTING_SOURCE_PROJECT_DIR)
  : dirname(dirname(fileURLToPath(import.meta.url)));
await loadEnvFiles({ packageDir: projectDir });
const labEnv = await readLocalEnv(resolve(projectDir, 'reference-apps/real-systems/.env.local'));
const baseUrl = 'http://127.0.0.1:18055';
const suffix = Date.now().toString(36);
const names = {
  collection: `brisk_aitesting_ai_${suffix}`,
  role: `Brisk AI Role ${suffix}`,
  policy: `Brisk AI Policy ${suffix}`,
};
const created = {};
const setup = [];
let adminToken;
let result;
let finalState;

try {
  const adminLogin = await request('POST', '/auth/login', undefined, {
    email: required(labEnv.BRISK_TEST_DIRECTUS_ADMIN_EMAIL, 'BRISK_TEST_DIRECTUS_ADMIN_EMAIL'),
    password: required(labEnv.BRISK_TEST_DIRECTUS_ADMIN_PASSWORD, 'BRISK_TEST_DIRECTUS_ADMIN_PASSWORD'),
  });
  adminToken = adminLogin.body?.data?.access_token;
  record('admin login', adminLogin.status, 200);
  if (typeof adminToken !== 'string') throw new Error('Directus administrator login returned no access token.');

  const collection = await request('POST', '/collections', adminToken, {
    collection: names.collection,
    meta: { note: 'Disposable complex real-AI proof created by brisk-aitesting' },
    schema: {},
  });
  record('create disposable collection', collection.status, 200);
  created.collection = collection.status === 200;

  for (const field of [
    { field: 'title', type: 'string', schema: { is_nullable: false, max_length: 120 }, meta: { required: true } },
    { field: 'status', type: 'string', schema: { is_nullable: false, default_value: 'draft', max_length: 32 } },
    { field: 'secret_note', type: 'text', schema: { is_nullable: true } },
  ]) {
    const response = await request('POST', `/fields/${names.collection}`, adminToken, field);
    record(`create field ${field.field}`, response.status, 200);
  }

  const role = await request('POST', '/roles', adminToken, { name: names.role, description: 'Disposable least-privilege real-AI role' });
  created.role = role.body?.data?.id;
  record('create role', role.status, 200);

  const policy = await request('POST', '/policies', adminToken, {
    name: names.policy,
    description: 'Disposable create/read/update policy; delete deliberately absent',
    app_access: true,
    admin_access: false,
  });
  created.policy = policy.body?.data?.id;
  record('create policy', policy.status, 200);

  const access = await request('POST', '/access', adminToken, { role: created.role, policy: created.policy });
  created.access = access.body?.data?.id;
  record('connect role to policy', access.status, 200);

  for (const action of ['create', 'read', 'update']) {
    const permission = await request('POST', '/permissions', adminToken, {
      policy: created.policy,
      collection: names.collection,
      action,
      permissions: null,
      validation: null,
      presets: null,
      fields: ['*'],
    });
    created[`permission_${action}`] = permission.body?.data?.id;
    record(`allow ${action}`, permission.status, 200);
  }

  const userPassword = randomBytes(24).toString('base64url');
  const userEmail = `brisk-ai-${suffix}@example.com`;
  const user = await request('POST', '/users', adminToken, {
    email: userEmail,
    password: userPassword,
    provider: 'default',
    role: created.role,
    status: 'active',
    first_name: 'Brisk',
    last_name: 'AI Proof',
  });
  created.user = user.body?.data?.id;
  record('create least-privilege user', user.status, 200);

  const userLogin = await request('POST', '/auth/login', undefined, { email: userEmail, password: userPassword });
  const userToken = userLogin.body?.data?.access_token;
  record('least-privilege user login', userLogin.status, 200);
  if (typeof userToken !== 'string') throw new Error('Directus least-privilege login returned no access token.');
  process.env.BRISK_TEST_DIRECTUS_CLEANUP_AUTHORIZATION = `Bearer ${adminToken}`;

  const operationContracts = [
    {
      operationId: 'directus.article.create', method: 'POST', path: `/items/${names.collection}`,
      name: 'Create a valid article', action: 'create', resource: 'article', sideEffect: 'create',
      outputs: [{ id: 'response.data.id', name: 'article id', semanticType: 'article.id', from: 'response.body', path: 'data.id' }],
      successStatuses: [200], requestExample: { title: `AI connected journey ${suffix}`, status: 'draft' },
      cleanupOperationId: 'directus.article.cleanup',
      authority: 'runtime', source: 'Directus live collection and observed create permission',
    },
    {
      operationId: 'directus.article.read', method: 'GET', path: `/items/${names.collection}/{id}`,
      name: 'Read the created article', action: 'read', resource: 'article', sideEffect: 'read',
      inputs: [{ id: 'path.id', name: 'id', location: 'path', semanticType: 'article.id', required: true }],
      successStatuses: [200], authority: 'runtime', source: 'Directus live item route and observed read permission',
    },
    {
      operationId: 'directus.article.update', method: 'PATCH', path: `/items/${names.collection}/{id}`,
      name: 'Publish the created article', action: 'update', resource: 'article', sideEffect: 'update',
      inputs: [{ id: 'path.id', name: 'id', location: 'path', semanticType: 'article.id', required: true }],
      successStatuses: [200], requestExample: { status: 'published' },
      authority: 'runtime', source: 'Directus live item route and observed update permission',
    },
    {
      operationId: 'directus.article.verify-published', method: 'GET', path: `/items/${names.collection}/{id}`,
      name: 'Verify the article is published', action: 'verify', resource: 'published article', sideEffect: 'read',
      inputs: [{ id: 'path.id', name: 'id', location: 'path', semanticType: 'article.id', required: true }],
      successStatuses: [200], expectedJson: { 'data.status': 'published' },
      authority: 'runtime', source: 'Directus live item response observed after update',
    },
    {
      operationId: 'directus.article.invalid-create', method: 'POST', path: `/items/${names.collection}`,
      name: 'Reject an article missing its required title', action: 'attempt-invalid-create', resource: 'invalid article', sideEffect: 'none',
      successStatuses: [400], requestExample: { status: 'draft' },
      authority: 'runtime', source: 'Directus live required-field schema and runtime validation',
    },
    {
      operationId: 'directus.article.forbidden-delete', method: 'DELETE', path: `/items/${names.collection}/{id}`,
      name: 'Refuse deletion by the least-privilege user', action: 'attempt-delete', resource: 'protected article', sideEffect: 'none',
      inputs: [{ id: 'path.id', name: 'id', location: 'path', semanticType: 'article.id', required: true }],
      successStatuses: [403], authority: 'runtime', source: 'Directus live policy deliberately omits delete permission',
    },
    {
      operationId: 'directus.article.cleanup', method: 'DELETE', path: `/items/${names.collection}/{id}`,
      name: 'Clean the created article with the isolated cleanup identity', action: 'cleanup', resource: 'article', sideEffect: 'delete',
      inputs: [
        { id: 'path.id', name: 'id', location: 'path', semanticType: 'article.id', required: true },
        { id: 'header.authorization', name: 'authorization', location: 'header', semanticType: 'auth.bearer', required: true, secretRef: 'BRISK_TEST_DIRECTUS_CLEANUP_AUTHORIZATION' },
      ],
      successStatuses: [204, 404], authority: 'host', source: 'Isolated host cleanup identity held only in process memory',
    },
  ];
  const evidenceGraph = createHttpEvidenceGraph(operationContracts);

  const config = defineConfig({
    app: { name: 'Directus complex real-AI proof', baseUrl, env: 'local' },
    auth: { type: 'bearer', token: userToken },
    ai: aiConfig(),
    capabilityAdapters: [new HostHttpCapabilityAdapter()],
    runtime: { artifactsDir: '.brisk-aitesting-real-ai-directus/artifacts', timeoutMs: 120_000, retries: 0, headless: true, dryRun: false },
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
      'Plan exactly one complex connected Directus article journey using all six evidenced business actions in this exact order:',
      'create article, read article, update article, verify published article, attempt-invalid-create invalid article, attempt-delete protected article.',
      'The same created article id must flow into read, update, published verification, and protected delete refusal.',
      'Prove successful state change, required-field rejection, permission refusal, and final recoverability.',
    ].join(' '),
    scenarios: 1,
    scenarioCountPolicy: 'exact',
    requiredTypes: ['api'],
    evidenceGraph,
    authoritativeOperations: operationContracts.map((operation) => ({
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      ...(operation.operationId === 'directus.article.create' ? { requiredBodyFields: ['title', 'status'] } : {}),
      ...(operation.operationId === 'directus.article.update' ? { requiredBodyFields: ['status'] } : {}),
      successStatusCodes: operation.successStatuses,
      source: operation.authority === 'contract' ? 'contract' : operation.authority === 'runtime' ? 'runtime' : 'host-adapter',
    })),
  });

  const items = await request('GET', `/items/${names.collection}?filter[title][_eq]=${encodeURIComponent(`AI connected journey ${suffix}`)}`, adminToken);
  const matching = Array.isArray(items.body?.data) ? items.body.data : [];
  finalState = {
    matchingItems: matching.length,
    publishedItems: matching.filter((entry) => entry.status === 'published').length,
  };
} finally {
  if (adminToken !== undefined) await cleanup();
  delete process.env.BRISK_TEST_DIRECTUS_CLEANUP_AUTHORIZATION;
}

const output = {
  schemaVersion: 'brisk-aitesting.real-ai-directus.v1',
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
  cleanup: setup.filter((entry) => entry.name.startsWith('cleanup') || entry.name.startsWith('residual')),
  credentialsPrinted: false,
};
console.log(JSON.stringify(output, null, 2));

const requiredOperations = ['Create a valid article', 'Read the created article', 'Publish the created article', 'Verify the article is published', 'Reject an article missing its required title', 'Refuse deletion by the least-privilege user'];
const passedOperations = new Set((result?.operations ?? []).filter((entry) => entry.status === 'passed').map((entry) => entry.name));
const cleanupPassed = (result?.operations ?? []).some((entry) => entry.name.startsWith('Cleanup DELETE ') && entry.status === 'passed');
const failures = [
  ...(result?.status === 'passed' ? [] : [`run status was ${result?.status ?? 'missing'}`]),
  ...requiredOperations.filter((name) => !passedOperations.has(name)).map((name) => `operation did not pass: ${name}`),
  ...(cleanupPassed ? [] : ['isolated cleanup operation did not pass']),
  ...(finalState?.matchingItems === 0 ? [] : ['final Directus state retained a test-created article after cleanup']),
  ...(setup.some((entry) => entry.ok === false) ? ['setup or cleanup contained an unexpected HTTP status'] : []),
];
if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
  process.exitCode = 1;
}

async function cleanup() {
  for (const [key, endpoint] of [
    ['user', 'users'], ['permission_update', 'permissions'], ['permission_read', 'permissions'],
    ['permission_create', 'permissions'], ['access', 'access'], ['policy', 'policies'], ['role', 'roles'],
  ]) {
    if (created[key] === undefined) continue;
    const response = await request('DELETE', `/${endpoint}/${created[key]}`, adminToken);
    setup.push({ name: `cleanup ${key}`, status: response.status, expected: 204, ok: response.status === 204 });
  }
  if (created.collection) {
    const response = await request('DELETE', `/collections/${names.collection}`, adminToken);
    setup.push({ name: 'cleanup collection', status: response.status, expected: 204, ok: response.status === 204 });
  }
  for (const [name, path] of [
    ['residual role', `/roles?filter[name][_eq]=${encodeURIComponent(names.role)}`],
    ['residual policy', `/policies?filter[name][_eq]=${encodeURIComponent(names.policy)}`],
  ]) {
    const response = await request('GET', path, adminToken);
    const count = Array.isArray(response.body?.data) ? response.body.data.length : -1;
    setup.push({ name, status: response.status, expected: 200, ok: response.status === 200 && count === 0, count });
  }
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

async function readLocalEnv(path) {
  return Object.fromEntries((await readFile(path, 'utf8')).split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    return separator <= 0 ? [] : [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim()]];
  }));
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
