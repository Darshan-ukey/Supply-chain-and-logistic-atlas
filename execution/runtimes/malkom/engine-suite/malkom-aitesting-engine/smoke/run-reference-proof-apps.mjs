import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBriskAiTesting, defineConfig } from '../dist/index.js';
import { createApiOnlyServer } from '../reference-apps/api-only/server.mjs';
import { createTodoServer } from '../reference-apps/todo/server.mjs';
import { createMultiTenantServer } from '../reference-apps/multi-tenant/server.mjs';
import { createEcommerceServer } from '../reference-apps/e-commerce/server.mjs';
import { createEventMessagingServer } from '../reference-apps/event-messaging/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);

const apps = [
  {
    id: 'api-only',
    name: 'API-only reference app',
    createServer: createApiOnlyServer,
    openApiPath: join(packageDir, 'reference-apps', 'api-only', 'openapi.json'),
    scenarios: apiOnlyScenarios,
    expected: { total: 6, types: ['api', 'contract', 'schema', 'replay'] },
  },
  {
    id: 'todo',
    name: 'Todo reference app',
    createServer: createTodoServer,
    openApiPath: join(packageDir, 'reference-apps', 'todo', 'openapi.json'),
    scenarios: todoScenarios,
    expected: { total: 7, types: ['ui', 'api', 'contract', 'schema'] },
  },
  {
    id: 'multi-tenant',
    name: 'Multi-tenant reference app',
    createServer: createMultiTenantServer,
    openApiPath: join(packageDir, 'reference-apps', 'multi-tenant', 'openapi.json'),
    scenarios: multiTenantScenarios,
    expected: { total: 7, types: ['ui', 'api', 'contract', 'schema'] },
  },
  {
    id: 'e-commerce',
    name: 'E-commerce reference app',
    createServer: createEcommerceServer,
    openApiPath: join(packageDir, 'reference-apps', 'e-commerce', 'openapi.json'),
    scenarios: ecommerceScenarios,
    expected: { total: 8, types: ['ui', 'api', 'contract', 'schema'] },
  },
  {
    id: 'event-messaging',
    name: 'Event/messaging reference app',
    createServer: createEventMessagingServer,
    openApiPath: join(packageDir, 'reference-apps', 'event-messaging', 'openapi.json'),
    asyncApiPath: join(packageDir, 'reference-apps', 'event-messaging', 'asyncapi.json'),
    scenarios: eventMessagingScenarios,
    expected: { total: 10, types: ['ui', 'api', 'contract', 'schema', 'message'] },
  },
];

const appReports = [];
const errors = [];

for (const app of apps) {
  const server = app.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error(`${app.id} did not expose a TCP port`);

  try {
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const result = await runApp(app, baseUrl);
    const appErrors = validateAppResult(app, result);
    errors.push(...appErrors.map((error) => `${app.id}: ${error}`));
    appReports.push({
      id: app.id,
      status: appErrors.length === 0 ? 'passed' : 'failed',
      summary: result.summary,
      scenarioTypes: [...new Set(result.tests.map((test) => test.type))],
      artifacts: result.artifacts.length,
      errors: appErrors,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const output = {
  schemaVersion: 'brisk-aitesting.reference-proof-apps.v1',
  status: errors.length === 0 ? 'passed' : 'failed',
  apps: appReports,
  errors,
};

console.log(JSON.stringify(output, null, 2));
if (errors.length > 0) process.exitCode = 1;

async function runApp(app, baseUrl) {
  const config = defineConfig({
    app: { name: app.name, baseUrl, repoPath: packageDir, env: 'local' },
    auth: { type: 'none' },
    contracts: { openApiPath: app.openApiPath, ...(app.asyncApiPath !== undefined ? { asyncApiPath: app.asyncApiPath } : {}) },
    runtime: { artifactsDir: `.brisk-aitesting-reference-${app.id}/artifacts`, timeoutMs: 30000, retries: 0, headless: true, dryRun: false },
    discovery: { includeRepo: false, includeUi: true, includeApi: false, includeContracts: true },
    security: { networkPolicy: 'localhost-only', allowedHosts: ['localhost', '127.0.0.1', '::1'], redactSecrets: true },
  });
  const planner = {
    name: `${app.id}-reference-planner`,
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        scenarios: app.scenarios(app.openApiPath, app.asyncApiPath),
        warnings: [],
        createdAt: new Date().toISOString(),
      };
    },
  };
  const tester = createBriskAiTesting(config, { planner });
  return tester.run({
    goal: `Verify ${app.name}`,
    scenarios: app.expected.total,
    mode: 'automatic',
    metadata: { explicitUserTargets: explicitUserTargetsFor(app.scenarios(app.openApiPath, app.asyncApiPath)) },
  });
}

function explicitUserTargetsFor(scenarios) {
  return scenarios
    .filter((scenario) => scenario.target?.sourceOfTruth === 'user')
    .flatMap((scenario) => {
      if (scenario.type === 'ui' && scenario.target?.route !== undefined) return [`ui ${scenario.target.route}`];
      if (scenario.type === 'api' && scenario.target?.method !== undefined && scenario.target?.path !== undefined) return [`${scenario.target.method} ${scenario.target.path}`];
      return [];
    });
}

function validateAppResult(app, result) {
  const appErrors = [];
  if (result.schemaVersion !== 'brisk-aitesting.result.v1') appErrors.push('wrong result schema');
  if (result.status !== 'passed') appErrors.push(`run did not pass: ${result.status}`);
  if (result.summary.total !== app.expected.total) appErrors.push(`expected ${app.expected.total} tests, got ${result.summary.total}`);
  if (result.summary.passRate !== 100) appErrors.push(`expected 100 pass rate, got ${result.summary.passRate}`);
  for (const type of app.expected.types) {
    if (!result.tests.some((test) => test.type === type)) appErrors.push(`missing ${type} scenario result`);
  }
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.api-evidence.v1')) appErrors.push('missing API evidence');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.openapi-summary.v1')) appErrors.push('missing OpenAPI evidence');
  if (app.expected.types.includes('ui') && !result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.playwright-evidence.v1')) appErrors.push('missing Playwright evidence');
  if (app.expected.types.includes('schema') && !result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.schema-fuzz-evidence.v1')) appErrors.push('missing schema fuzz evidence');
  if (app.expected.types.includes('replay') && !result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.replay-evidence.v1')) appErrors.push('missing replay evidence');
  if (app.expected.types.includes('message') && !result.artifacts.some((artifact) => ['brisk-aitesting.message-contract-evidence.v1', 'brisk-aitesting.live-message-evidence.v1'].includes(artifact.metadata?.schemaVersion))) appErrors.push('missing message evidence');
  return appErrors;
}

function apiOnlyScenarios(openApiPath) {
  return [
    api('api_health', 'health endpoint works', 'GET', '/api/health', undefined, { status: 200, json: { ok: true, service: 'api-only' } }),
    api('api_list_items', 'items can be listed', 'GET', '/api/items', undefined, { status: 200, json: { total: 1 } }),
    api('api_create_item', 'item can be created', 'POST', '/api/items', { body: { name: 'Beta' } }, { status: 201, json: { 'item.name': 'Beta' } }),
    contract('api_contract', 'API-only OpenAPI parses', openApiPath),
    schema('api_schema_fuzz', 'API-only schema rejects malformed requests', openApiPath),
    replay('api_replay_health', 'health interaction can replay', [{ method: 'GET', path: '/api/health', expectStatus: 200 }]),
  ];
}

function todoScenarios(openApiPath) {
  return [
    ui('todo_ui_home', 'todo homepage loads', '/'),
    api('todo_list', 'todos can be listed', 'GET', '/api/todos', undefined, { status: 200, json: { total: 1 } }),
    api('todo_create', 'todo can be created', 'POST', '/api/todos', { body: { title: 'Write docs' } }, { status: 201, json: { 'todo.title': 'Write docs' } }),
    api('todo_missing_title', 'missing todo title is rejected', 'POST', '/api/todos', { body: {} }, { status: 400, json: { 'error.code': 'TITLE_REQUIRED' } }),
    api('todo_complete_missing', 'missing todo cannot be completed', 'PATCH', '/api/todos/missing', undefined, { status: 404, json: { 'error.code': 'TODO_NOT_FOUND' } }),
    contract('todo_contract', 'Todo OpenAPI parses', openApiPath),
    schema('todo_schema_fuzz', 'Todo schema rejects malformed requests', openApiPath),
  ];
}

function multiTenantScenarios(openApiPath) {
  return [
    ui('tenant_ui_home', 'tenant homepage loads', '/'),
    api('tenant_alpha_projects', 'alpha can list alpha projects', 'GET', '/api/tenants/alpha/projects', { headers: { authorization: 'Bearer alpha-token' } }, { status: 200, json: { tenantId: 'alpha', total: 1 } }),
    api('tenant_cross_blocked', 'beta token cannot access alpha projects', 'GET', '/api/tenants/alpha/projects', { headers: { authorization: 'Bearer beta-token' } }, { status: 403, json: { 'error.code': 'TENANT_FORBIDDEN' } }),
    api('tenant_create_project', 'alpha can create project', 'POST', '/api/tenants/alpha/projects', { headers: { authorization: 'Bearer alpha-token' }, body: { name: 'Alpha Scale' } }, { status: 201, json: { tenantId: 'alpha', 'project.name': 'Alpha Scale' } }),
    api('tenant_missing_auth', 'tenant projects require auth', 'GET', '/api/tenants/beta/projects', undefined, { status: 401, json: { 'error.code': 'UNAUTHORIZED' } }),
    contract('tenant_contract', 'Multi-tenant OpenAPI parses', openApiPath),
    schema('tenant_schema_fuzz', 'Multi-tenant schema rejects malformed requests', openApiPath),
  ];
}

function ecommerceScenarios(openApiPath) {
  return [
    ui('commerce_ui_home', 'commerce homepage loads', '/'),
    api('commerce_health', 'commerce health works', 'GET', '/api/health', undefined, { status: 200, json: { service: 'e-commerce' } }),
    api('commerce_products', 'products can be listed', 'GET', '/api/products', undefined, { status: 200, json: { total: 2 } }),
    api('commerce_add_item', 'available item can be added to cart', 'POST', '/api/carts/cart_main/items', { body: { productId: 'prod_keyboard', quantity: 2 } }, { status: 201, json: { totalItems: 2, total: 258 } }),
    api('commerce_out_of_stock', 'out of stock product is rejected and cart stays unchanged', 'POST', '/api/carts/cart_main/items', { body: { productId: 'prod_monitor', quantity: 1 } }, { status: 409, json: { 'error.code': 'OUT_OF_STOCK' }, unchanged: [{ name: 'cart_main', target: { method: 'GET', path: '/api/carts/cart_main' }, json: { totalItems: 2, total: 258 } }] }),
    api('commerce_checkout', 'cart can be checked out', 'POST', '/api/carts/cart_main/checkout', { body: {} }, { status: 201, json: { 'order.status': 'confirmed', 'order.total': 258 } }),
    contract('commerce_contract', 'E-commerce OpenAPI parses', openApiPath),
    schema('commerce_schema_fuzz', 'E-commerce schema rejects malformed requests', openApiPath),
  ];
}

function eventMessagingScenarios(openApiPath, asyncApiPath) {
  return [
    ui('event_ui_home', 'event messaging homepage loads', '/'),
    ui('event_ui_playground', 'messaging playground loads', '/playground'),
    api('event_channels', 'channels can be listed', 'GET', '/api/channels', undefined, { status: 200, json: { total: 1 } }),
    api('event_create_channel', 'channel can be created', 'POST', '/api/channels', { body: { name: 'Payments' } }, { status: 201, json: { 'channel.name': 'Payments' } }),
    api('event_create_topic', 'topic can be created under default channel', 'POST', '/api/channels/channel_default/topics', { body: { name: 'payments.received' } }, { status: 201, json: { 'topic.name': 'payments.received' } }),
    messageContract('event_asyncapi_contract', 'AsyncAPI contract exposes order event channel', asyncApiPath, 'orders.created'),
    liveMessage('event_publish_delivery', 'published message reaches subscribers', asyncApiPath),
    api('event_metrics', 'metrics show publish and delivery activity', 'GET', '/api/metrics', undefined, { status: 200, json: { published: 1, delivered: 1 } }),
    contract('event_contract', 'Event messaging OpenAPI parses', openApiPath),
    schema('event_schema_fuzz', 'Event messaging schema rejects malformed requests', openApiPath),
  ];
}

function ui(id, name, route) {
  return { id, name, type: 'ui', objective: name, target: { route, sourceOfTruth: 'user' }, assertions: ['body is visible'], evidenceRequired: ['ui'] };
}

function api(id, name, method, path, request, expect) {
  return { id, name, type: 'api', objective: name, target: { method, path, sourceOfTruth: 'contract' }, ...(request !== undefined ? { request } : {}), expect, assertions: [`${method} ${path} behaves as expected`], evidenceRequired: ['api'] };
}

function contract(id, name, schema) {
  return { id, name, type: 'contract', objective: name, target: { schema, sourceOfTruth: 'contract' }, assertions: ['contract parses'], evidenceRequired: ['schema'] };
}

function schema(id, name, schemaPath) {
  return { id, name, type: 'schema', objective: name, target: { schema: schemaPath, sourceOfTruth: 'contract' }, assertions: ['malformed requests are rejected'], evidenceRequired: ['schema', 'api'] };
}

function replay(id, name, requests) {
  return { id, name, type: 'replay', objective: name, assertions: ['recorded HTTP interaction replays'], evidenceRequired: ['api'], metadata: { replay: { requests } } };
}

function liveMessage(id, name, schemaPath) {
  return {
    id,
    name,
    type: 'message',
    objective: name,
    target: { schema: schemaPath, channel: 'orders.created', sourceOfTruth: 'contract' },
    assertions: ['message is published and delivered'],
    evidenceRequired: ['message', 'api'],
    metadata: {
      adapter: 'live-message',
      liveMessage: {
        publish: {
          method: 'POST',
          path: '/api/topics/topic_default/messages',
          body: { payload: { orderId: 'order_1', amount: 42 } },
          expect: { status: 202, json: { delivered: 1 } },
        },
        verify: {
          method: 'GET',
          path: '/api/subscriptions/sub_default/messages',
          expect: { status: 200, json: { total: 1 } },
        },
        poll: { attempts: 5, intervalMs: 25 },
      },
    },
  };
}

function messageContract(id, name, schemaPath, channel) {
  return {
    id,
    name,
    type: 'message',
    objective: name,
    target: { schema: schemaPath, channel, sourceOfTruth: 'contract' },
    assertions: ['message contract exposes expected channel and payload'],
    evidenceRequired: ['message', 'schema'],
  };
}
