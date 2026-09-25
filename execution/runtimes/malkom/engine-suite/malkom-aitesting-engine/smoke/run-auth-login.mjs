// Proves the real sign-in flow:
// 1. With right credentials, the run logs in once, calls the API with the
//    returned token, cleans up with the same token, and passes.
// 2. With wrong credentials, the run stops with AUTH_LOGIN_FAILED and no
//    test request is ever sent signed out.
// 3. With credentials but no login address, the run stops with a plain error.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBriskAiTesting } from '../dist/index.js';

const TOKEN = 'login-test-token-12345678';
let loginCalls = 0;
const seenAuthHeaders = [];
const items = new Set();

const server = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    if (request.method === 'POST' && request.url === '/auth/login') {
      loginCalls += 1;
      if (body?.email === 'tester@example.com' && body?.password === 'right-password') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: { access_token: TOKEN } }));
      } else {
        response.writeHead(401, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'bad credentials' }));
      }
      return;
    }
    seenAuthHeaders.push(request.headers.authorization ?? null);
    if (request.headers.authorization !== `Bearer ${TOKEN}`) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'signed out' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/items') {
      const id = `item-${items.size + 1}`;
      items.add(id);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id }));
      return;
    }
    const match = request.url?.match(/^\/api\/items\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const existed = items.delete(match[1]);
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
const artifactsDir = mkdtempSync(join(tmpdir(), 'brisk-auth-login-'));

const baseConfig = (auth) => ({
  app: { name: 'auth-login-smoke', baseUrl: `http://127.0.0.1:${port}` },
  auth,
  runtime: { artifactsDir, timeoutMs: 15_000 },
  security: { allowedHosts: ['127.0.0.1'] },
});

const loginPlanner = {
  name: 'auth-login-smoke-planner',
  async plan(context) {
    return {
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode: 'automatic',
      discovery: context.discovery,
      createdAt: new Date().toISOString(),
      warnings: [],
      scenarios: [{
        id: 'create_item_signed_in',
        name: 'Create an item while signed in',
        type: 'api',
        objective: 'Prove the run signs in first and sends the token on every request.',
        target: { method: 'POST', path: '/api/items', sourceOfTruth: 'user' },
        request: { body: { name: 'login-smoke-<unique>' } },
        expect: { status: 201 },
        assertions: ['create succeeds only with the login token'],
        capture: [{ name: 'itemId', from: 'response.body', path: 'id' }],
        cleanup: [{ type: 'api', target: { method: 'DELETE', path: '/api/items/<itemId>' } }],
        evidenceRequired: ['api'],
      }],
    };
  },
};

const runInput = {
  scenarios: 1,
  mode: 'automatic',
  metadata: { explicitUserTargets: ['POST /api/items'] },
  authoritativeOperations: [
    { method: 'POST', path: '/api/items', requiredBodyFields: ['name'], successStatusCodes: [201], source: 'host-adapter' },
  ],
};

// 1. Right credentials: login once, token on test and cleanup, all pass.
const okResult = await createBriskAiTesting(baseConfig({
  type: 'credentials',
  loginUrl: '/auth/login',
  username: 'tester@example.com',
  password: 'right-password',
  tokenPath: 'data.access_token',
}), { planner: loginPlanner }).run({ ...runInput, goal: 'Create and clean an item behind a login' });

assert.equal(okResult.verdict, 'passed', JSON.stringify(okResult.outcome.issues));
assert.deepEqual(okResult.checks, {
  schemaVersion: 'brisk-aitesting.check-accounting.v1',
  requested: 1,
  understood: 1,
  ready: 1,
  notReady: [],
}, 'the result must count requested, understood, and ready checks');
assert.equal(loginCalls, 1, 'the run must sign in exactly once');
assert.equal(seenAuthHeaders.length >= 2, true, 'test and cleanup requests must both reach the server');
assert.equal(seenAuthHeaders.every((header) => header === `Bearer ${TOKEN}`), true, 'every request must carry the login token');
assert.equal(items.size, 0, 'cleanup must remove the created item using the same session');

// 2. Wrong password: the run stops before any test request.
const requestsBefore = seenAuthHeaders.length;
const badResult = await createBriskAiTesting(baseConfig({
  type: 'credentials',
  loginUrl: '/auth/login',
  username: 'tester@example.com',
  password: 'wrong-password',
}), { planner: loginPlanner }).run({ ...runInput, goal: 'Fail to sign in' });

assert.equal(badResult.verdict, 'failed', 'a refused sign-in is a run-level error, never a pass');
assert.equal(badResult.summary.total, 0, 'no test may be counted when sign-in was refused');
assert.equal(badResult.outcome.issues.some((issue) => issue.code === 'AUTH_LOGIN_FAILED'), true, JSON.stringify(badResult.outcome.issues));
assert.equal(seenAuthHeaders.length, requestsBefore, 'no test request may be sent after a refused sign-in');
assert.equal(JSON.stringify(badResult.outcome.issues).includes('wrong-password'), false, 'the password must never appear in issues');

// 3. Credentials without a login address: plain, actionable stop.
const noUrlResult = await createBriskAiTesting(baseConfig({
  type: 'credentials',
  username: 'tester@example.com',
  password: 'right-password',
}), { planner: loginPlanner }).run({ ...runInput, goal: 'Missing login address' });
assert.equal(noUrlResult.verdict, 'failed');
assert.equal(noUrlResult.summary.total, 0);
assert.equal(noUrlResult.outcome.issues.some((issue) => issue.code === 'AUTH_LOGIN_FAILED' && issue.message.includes('auth.loginUrl')), true, JSON.stringify(noUrlResult.outcome.issues));

server.close();
rmSync(artifactsDir, { recursive: true, force: true });

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.auth-login-smoke.v1',
  checks: 9,
  loginCalls,
  authenticatedRequests: requestsBefore,
  residualItems: items.size,
  failures: 0,
  skips: 0,
}, null, 2));
