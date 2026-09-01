import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBriskAiTesting } from '../dist/index.js';
import { createSeriousSaasServer } from '../reference-apps/serious-saas/server.mjs';
import { seriousSaasConfig } from '../reference-apps/serious-saas/brisk-aitesting.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const openApiPath = join(packageDir, 'reference-apps', 'serious-saas', 'openapi.json');

const server = createSeriousSaasServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('serious-saas reference app did not expose a TCP port');

try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = seriousSaasConfig(baseUrl);
  const planner = {
    name: 'serious-saas-reference-planner',
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: seriousSaasScenarios(),
      };
    },
  };

  const tester = createBriskAiTesting(config, { planner });
  const result = await tester.run({
    goal: 'Verify serious SaaS reference app: auth, roles, users, audit, UI, API, and OpenAPI contracts',
    scenarios: 13,
    mode: 'automatic',
    metadata: { explicitUserTargets: ['ui /users'] },
  });

  const errors = [];
  if (result.schemaVersion !== 'brisk-aitesting.result.v1') errors.push('wrong result schema');
  if (result.summary.total < 10) errors.push(`expected at least 10 scenarios, got ${result.summary.total}`);
  if (result.summary.passRate !== 100) errors.push(`expected 100 pass rate, got ${result.summary.passRate}`);
  if (!result.tests.some((test) => test.type === 'ui')) errors.push('missing UI scenario result');
  if (!result.tests.some((test) => test.type === 'api')) errors.push('missing API scenario result');
  if (!result.tests.some((test) => test.type === 'contract')) errors.push('missing contract scenario result');
  if (!result.plan.scenarios.some((scenario) => scenario.metadata?.polarity === 'negative')) errors.push('missing negative scenario in plan');
  if (!result.plan.scenarios.some((scenario) => scenario.name.includes('viewer cannot create user'))) errors.push('missing role negative scenario');
  if (!result.plan.scenarios.some((scenario) => scenario.name.includes('audit event'))) errors.push('missing audit scenario');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.api-evidence.v1')) errors.push('missing API evidence artifact');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.openapi-summary.v1')) errors.push('missing OpenAPI summary artifact');
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.playwright-evidence.v1')) errors.push('missing Playwright evidence artifact');
  if (containsSecretLikeValue(result)) errors.push('result contains secret-looking value');

  const createUserResult = result.tests.find((test) => test.scenarioId === 'serious_api_create_user');
  if (createUserResult?.status !== 'passed') errors.push('admin create user scenario did not pass');
  const auditResult = result.tests.find((test) => test.scenarioId === 'serious_api_audit_events');
  if (auditResult?.status !== 'passed') errors.push('audit event scenario did not pass');
  if (!auditResult?.assertions.some((assertion) => assertion.name.includes('json.total equals 4') && assertion.status === 'passed')) {
    errors.push('audit event scenario did not prove state change');
  }
  const blockedCreateResult = result.tests.find((test) => test.scenarioId === 'serious_api_viewer_cannot_create_user');
  if (!blockedCreateResult?.assertions.some((assertion) => assertion.name.includes('users collection json.total remains 3') && assertion.status === 'passed')) {
    errors.push('viewer rejected action did not prove unchanged user state');
  }

  const apiArtifacts = result.artifacts.filter((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.api-evidence.v1' && artifact.path !== undefined);
  for (const artifact of apiArtifacts) {
    const evidence = JSON.parse(await readFile(artifact.path, 'utf8'));
    if (!Array.isArray(evidence.assertions) || evidence.assertions.length === 0) errors.push(`API evidence missing assertions for ${artifact.path}`);
    if (evidence.contract?.operationId === undefined) errors.push(`API evidence missing contract operation for ${artifact.path}`);
    if (evidence.scenario?.id === 'serious_api_viewer_cannot_create_user' && !Array.isArray(evidence.stateSnapshots)) {
      errors.push('viewer rejected action evidence missing stateSnapshots');
    }
  }

  if (errors.length > 0) {
    console.error(JSON.stringify({
      status: result.status,
      summary: result.summary,
      errors,
      tests: result.tests.map((test) => ({ id: test.scenarioId, name: test.name, type: test.type, status: test.status, assertions: test.assertions })),
      diagnosis: result.diagnosis,
      outcome: result.outcome,
    }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      schemaVersion: 'brisk-aitesting.reference-serious-saas.v1',
      status: 'passed',
      summary: result.summary,
      scenarioTypes: [...new Set(result.tests.map((test) => test.type))],
      negativeScenarios: result.plan.scenarios.filter((scenario) => scenario.metadata?.polarity === 'negative').length,
      artifacts: result.artifacts.length,
    }, null, 2));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function seriousSaasScenarios() {
  return [
    {
      id: 'serious_ui_login',
      name: 'login page loads',
      type: 'ui',
      objective: 'The login page is reachable and visible.',
      target: { route: '/login', sourceOfTruth: 'observed' },
      assertions: ['body is visible'],
      evidenceRequired: ['ui'],
    },
    {
      id: 'serious_ui_dashboard',
      name: 'dashboard page loads',
      type: 'ui',
      objective: 'The dashboard page is reachable and visible.',
      target: { route: '/dashboard', sourceOfTruth: 'observed' },
      assertions: ['body is visible'],
      evidenceRequired: ['ui'],
    },
    {
      id: 'serious_ui_users',
      name: 'users page loads',
      type: 'ui',
      objective: 'The users page and create-user form are reachable.',
      target: { route: '/users', sourceOfTruth: 'user' },
      assertions: ['body is visible'],
      evidenceRequired: ['ui'],
    },
    {
      id: 'serious_api_health',
      name: 'health endpoint works',
      type: 'api',
      objective: 'Health API confirms the service is alive.',
      target: { method: 'GET', path: '/api/health', sourceOfTruth: 'contract' },
      expect: { status: 200, json: { ok: true, service: 'serious-saas' } },
      assertions: ['status is 200', 'json.ok is true'],
      evidenceRequired: ['api'],
      metadata: { polarity: 'positive' },
    },
    {
      id: 'serious_api_login_success',
      name: 'admin login returns token',
      type: 'api',
      objective: 'Valid admin credentials produce an admin token.',
      target: { method: 'POST', path: '/api/login', sourceOfTruth: 'contract' },
      request: { body: { email: 'admin@example.com', password: 'admin-password' } },
      expect: { status: 200, json: { token: 'admin-token', 'user.role': 'admin' } },
      assertions: ['status is 200', 'token is admin-token'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'positive' },
    },
    {
      id: 'serious_api_login_invalid',
      name: 'invalid login fails',
      type: 'api',
      objective: 'Invalid credentials are rejected.',
      target: { method: 'POST', path: '/api/login', sourceOfTruth: 'contract' },
      request: { body: { email: 'admin@example.com', password: 'wrong-password' } },
      expect: { status: 401, json: { 'error.code': 'INVALID_CREDENTIALS' } },
      assertions: ['status is 401', 'error code is INVALID_CREDENTIALS'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'negative' },
    },
    {
      id: 'serious_api_list_users',
      name: 'admin can list users',
      type: 'api',
      objective: 'Admin token can list users.',
      target: { method: 'GET', path: '/api/users', sourceOfTruth: 'contract' },
      request: { headers: { authorization: 'Bearer admin-token' } },
      expect: { status: 200, json: { total: 2 } },
      assertions: ['status is 200', 'total is 2'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'positive' },
    },
    {
      id: 'serious_api_create_user',
      name: 'admin can create user',
      type: 'api',
      objective: 'Admin can create a new viewer user.',
      target: { method: 'POST', path: '/api/users', sourceOfTruth: 'contract' },
      request: {
        headers: { authorization: 'Bearer admin-token' },
        body: { name: 'Casey Customer', email: 'casey@example.com', role: 'viewer' },
      },
      expect: { status: 201, json: { 'user.email': 'casey@example.com', 'user.role': 'viewer' } },
      assertions: ['status is 201', 'created user email matches'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'positive' },
    },
    {
      id: 'serious_api_viewer_cannot_create_user',
      name: 'viewer cannot create user',
      type: 'api',
      objective: 'Viewer role cannot create users.',
      target: { method: 'POST', path: '/api/users', sourceOfTruth: 'contract' },
      request: {
        headers: { authorization: 'Bearer viewer-token' },
        body: { name: 'Blocked User', email: 'blocked@example.com', role: 'viewer' },
      },
      expect: {
        status: 403,
        json: { 'error.code': 'FORBIDDEN' },
        unchanged: [
          {
            name: 'users collection',
            target: { method: 'GET', path: '/api/users' },
            request: { headers: { authorization: 'Bearer admin-token' } },
            json: { total: 3 },
          },
        ],
      },
      assertions: ['status is 403', 'error code is FORBIDDEN', 'user total remains unchanged'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'negative' },
    },
    {
      id: 'serious_api_missing_name',
      name: 'missing name returns validation error',
      type: 'api',
      objective: 'Create-user request without name is rejected.',
      target: { method: 'POST', path: '/api/users', sourceOfTruth: 'contract' },
      request: {
        headers: { authorization: 'Bearer admin-token' },
        body: { email: 'missing-name@example.com', role: 'viewer' },
      },
      expect: { status: 400, json: { 'error.code': 'NAME_REQUIRED' } },
      assertions: ['status is 400', 'error code is NAME_REQUIRED'],
      evidenceRequired: ['api'],
      metadata: { polarity: 'negative' },
    },
    {
      id: 'serious_api_unauthorized_users',
      name: 'users endpoint requires auth',
      type: 'api',
      objective: 'Users API rejects anonymous access.',
      target: { method: 'GET', path: '/api/users', sourceOfTruth: 'contract' },
      expect: { status: 401, json: { 'error.code': 'UNAUTHORIZED' } },
      assertions: ['status is 401', 'error code is UNAUTHORIZED'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'negative' },
    },
    {
      id: 'serious_api_audit_events',
      name: 'audit event records user creation',
      type: 'api',
      objective: 'Creating a user adds an audit event.',
      target: { method: 'GET', path: '/api/audit-events', sourceOfTruth: 'contract' },
      request: { headers: { authorization: 'Bearer admin-token' } },
      expect: { status: 200, json: { total: 4 } },
      assertions: ['status is 200', 'audit total is 4 after login attempts and user creation'],
      evidenceRequired: ['api', 'auth'],
      metadata: { polarity: 'positive' },
    },
    {
      id: 'serious_contract_openapi',
      name: 'OpenAPI contract exposes serious SaaS routes',
      type: 'contract',
      objective: 'Contract engine can parse the reference app contract.',
      target: { schema: openApiPath, sourceOfTruth: 'contract' },
      assertions: ['contract parses', 'operations are discovered'],
      evidenceRequired: ['schema', 'api'],
      metadata: { polarity: 'positive' },
    },
  ];
}

function containsSecretLikeValue(value) {
  const text = JSON.stringify(value);
  return /sk-[A-Za-z0-9]{12,}|npm_[A-Za-z0-9]{12,}|Bearer\s+(?!admin-token|viewer-token)[A-Za-z0-9._-]{12,}|AKIA[A-Z0-9]{12,}/i.test(text);
}
