import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { defineConfigFromHost, defineHostConfig, loadEnvFiles } from '../dist/index.js';

let checks = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
};
const rejects = async (work, pattern, message) => {
  await assert.rejects(work, pattern, message);
  checks += 1;
};

const baseEnvironment = {
  BRISK_AITESTING_APP_NAME: 'Environment host',
  BRISK_AITESTING_BASE_URL: 'http://127.0.0.1:4100',
};

const environmentOnly = await defineHostConfig({}, { environment: baseEnvironment });
check(environmentOnly.app.name, 'Environment host', 'environment-only app name');
check(environmentOnly.app.baseUrl, 'http://127.0.0.1:4100', 'environment-only base URL');
check(environmentOnly.app.repoPath, '.', 'safe repository default');
check(environmentOnly.runtime.dryRun, true, 'preview is the safe default');
check(environmentOnly.runtime.timeoutMs, 120000, 'timeout default');
check(environmentOnly.runtime.retries, 1, 'retry default');
check(environmentOnly.runtime.headless, true, 'headless default');
check(environmentOnly.discovery.includeRepo, true, 'repository discovery default');
check(environmentOnly.discovery.includeUi, true, 'UI discovery default');
check(environmentOnly.discovery.includeApi, true, 'API discovery default');
check(environmentOnly.security.networkPolicy, 'localhost-only', 'loopback network default');
check(environmentOnly.security.redactSecrets, true, 'secret redaction default');
check(environmentOnly.security.strictMode, true, 'strict validation default');
check(environmentOnly.security.allowFallbackTargets, false, 'invented targets blocked by default');
check(environmentOnly.capabilityAdapters?.length, 1, 'host HTTP adapter is automatic');

const explicitWins = await defineHostConfig({
  app: { name: 'Object host', baseUrl: 'https://testing.example.com', repoPath: './service' },
  run: { execution: 'enabled', timeoutMs: 90000, retries: 2, headless: false },
}, { environment: baseEnvironment });
check(explicitWins.app.name, 'Object host', 'object app name overrides environment');
check(explicitWins.app.baseUrl, 'https://testing.example.com', 'object URL overrides environment');
check(explicitWins.runtime.dryRun, false, 'execution requires explicit enabled value');
check(explicitWins.runtime.timeoutMs, 90000, 'object timeout');
check(explicitWins.runtime.retries, 2, 'object retries');
check(explicitWins.runtime.headless, false, 'object browser mode');
check(explicitWins.security.networkPolicy, 'allowlist', 'remote target uses allowlist');
check(explicitWins.security.allowedHosts, ['testing.example.com'], 'only explicit remote target is allowed');

const aiEnvironment = {
  ...baseEnvironment,
  BRISK_AITESTING_AI_PROVIDER: 'openai-compatible',
  BRISK_AITESTING_AI_MODEL: 'host-model',
  BRISK_AITESTING_AI_ENDPOINT: 'https://ai.example.com/v1',
  BRISK_AITESTING_AI_API_KEY: 'not-printed-test-secret',
};
const builtInAi = await defineHostConfig({}, { environment: aiEnvironment });
check(builtInAi.ai?.provider, 'openai-compatible', 'AI provider from product environment');
check(builtInAi.ai?.model, 'host-model', 'AI model from product environment');
check(builtInAi.ai?.endpoint, 'https://ai.example.com/v1', 'AI endpoint from product environment');
check(builtInAi.ai?.apiKeyEnv, 'BRISK_AITESTING_AI_API_KEY', 'config keeps the key reference name');
check(builtInAi.ai?.apiKey, undefined, 'config does not copy the environment key value');

const customProvider = { name: 'existing-host-ai', complete: async () => ({ content: '{}' }) };
const callbackAi = await defineHostConfig({ app: { name: 'Callback host', baseUrl: 'http://localhost:4100' }, ai: customProvider }, { environment: {} });
check(callbackAi.ai, undefined, 'callback provider does not create built-in provider config');
check(callbackAi.aiProvider, customProvider, 'existing host AI provider is passed through');

let sessionCalls = 0;
const previewSession = await defineHostConfig({
  app: { name: 'Preview session', baseUrl: 'http://localhost:4100' },
  auth: { createSession: async () => { sessionCalls += 1; return { type: 'bearer', token: 'preview-must-not-request-this' }; } },
}, { environment: {} });
check(sessionCalls, 0, 'preview does not request an execution session');
check(previewSession.auth, { type: 'none' }, 'preview does not retain execution authentication');

const executionSession = await defineHostConfig({
  app: { name: 'Execution session', baseUrl: 'http://localhost:4100' },
  run: { execution: 'enabled' },
  auth: { createSession: async () => { sessionCalls += 1; return { type: 'bearer', token: 'short-lived-token' }; } },
}, { environment: {} });
check(sessionCalls, 1, 'enabled execution requests one session');
check(executionSession.auth, { type: 'bearer', token: 'short-lived-token' }, 'enabled execution gets short-lived session');

const bearerEnvironment = await defineHostConfig({}, { environment: {
  ...baseEnvironment,
  BRISK_AITESTING_EXECUTION: 'enabled',
  BRISK_AITESTING_AUTH_TYPE: 'bearer',
  BRISK_AITESTING_AUTH_TOKEN: 'environment-token',
} });
check(bearerEnvironment.auth.type, 'bearer', 'bearer environment auth selected');

const credentialEnvironment = await defineHostConfig({}, { environment: {
  ...baseEnvironment,
  BRISK_AITESTING_AUTH_TYPE: 'credentials',
  BRISK_AITESTING_AUTH_LOGIN_URL: '/login',
  BRISK_AITESTING_AUTH_USERNAME: 'test@example.com',
  BRISK_AITESTING_AUTH_PASSWORD: 'password-value',
} });
check(credentialEnvironment.auth.type, 'credentials', 'credentials environment auth selected');
check(credentialEnvironment.auth.loginUrl, '/login', 'login URL retained');

const contracts = await defineHostConfig({ app: { name: 'Contracts', baseUrl: 'http://localhost:4100' } }, { environment: {
  BRISK_AITESTING_OPENAPI_PATH: './openapi.json',
  BRISK_AITESTING_ASYNCAPI_PATH: './asyncapi.yaml',
} });
check(contracts.contracts, { openApiPath: './openapi.json', asyncApiPath: './asyncapi.yaml' }, 'contract paths use product environment');

await rejects(() => defineHostConfig({}, { environment: {} }), /app\.name or BRISK_AITESTING_APP_NAME is required/, 'missing app name');
await rejects(() => defineHostConfig({ app: { name: 'Missing URL' } }, { environment: {} }), /app\.baseUrl or BRISK_AITESTING_BASE_URL is required/, 'missing app URL');
await rejects(() => defineHostConfig({ app: { name: 'Bad URL', baseUrl: 'not-a-url' } }, { environment: {} }), /complete http:\/\/ or https:\/\/ URL/, 'invalid app URL');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_AI_PROVIDER: 'openai-compatible' } }), /ai\.model or BRISK_AITESTING_AI_MODEL is required/, 'partial AI settings');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_AI_PROVIDER: 'unknown', BRISK_AITESTING_AI_MODEL: 'm', BRISK_AITESTING_AI_API_KEY: 'k' } }), /must be one of/, 'unknown built-in provider');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_AI_PROVIDER: 'openai-compatible', BRISK_AITESTING_AI_MODEL: 'm' } }), /BRISK_AITESTING_AI_API_KEY is missing/, 'missing AI key');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_AUTH_TYPE: 'bearer' } }), /BRISK_AITESTING_AUTH_TOKEN is required/, 'missing bearer token');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_EXECUTION: 'yes' } }), /must be one of: preview, enabled/, 'invalid execution mode');
await rejects(() => defineHostConfig({}, { environment: { ...baseEnvironment, BRISK_AITESTING_TIMEOUT_MS: 'fast' } }), /must be an integer/, 'invalid timeout');
await rejects(() => defineHostConfig({ app: { name: 'Bad session', baseUrl: 'http://localhost:4100' }, run: { execution: 'enabled' }, auth: { createSession: async () => ({ type: 'bearer', token: '' }) } }, { environment: {} }), /empty bearer token/, 'empty callback session');

const noArbitraryScan = await defineHostConfig({}, { environment: { ...baseEnvironment, OPENAI_API_KEY: 'unrelated' } });
check(noArbitraryScan.ai, undefined, 'unrelated provider environment is not scanned');

const legacyHost = { product: 'Legacy host', url: 'http://localhost:4200' };
const legacyConfig = defineConfigFromHost(legacyHost, (host) => ({ app: { name: host.product, baseUrl: host.url } }));
check(legacyConfig.app.name, 'Legacy host', 'advanced mapper remains compatible');

const envDir = await mkdtemp(join(tmpdir(), 'brisk-host-env-'));
const priorName = process.env.BRISK_AITESTING_APP_NAME;
const priorUrl = process.env.BRISK_AITESTING_BASE_URL;
try {
  delete process.env.BRISK_AITESTING_APP_NAME;
  process.env.BRISK_AITESTING_BASE_URL = 'http://process-wins.example';
  await writeFile(join(envDir, '.env.brisk-aitesting'), 'BRISK_AITESTING_APP_NAME=Named env file\nBRISK_AITESTING_BASE_URL=http://file-must-not-win.example\n', 'utf8');
  const loaded = await loadEnvFiles({ cwd: envDir, packageDir: join(envDir, 'absent-package') });
  check(loaded, [join(envDir, '.env.brisk-aitesting')], 'named environment file is loaded');
  check(process.env.BRISK_AITESTING_APP_NAME, 'Named env file', 'missing process value comes from named file');
  check(process.env.BRISK_AITESTING_BASE_URL, 'http://process-wins.example', 'existing process environment wins');
  check((await readFile(join(envDir, '.env.brisk-aitesting'), 'utf8')).includes('Named env file'), true, 'environment file remains unchanged');
} finally {
  if (priorName === undefined) delete process.env.BRISK_AITESTING_APP_NAME; else process.env.BRISK_AITESTING_APP_NAME = priorName;
  if (priorUrl === undefined) delete process.env.BRISK_AITESTING_BASE_URL; else process.env.BRISK_AITESTING_BASE_URL = priorUrl;
  await rm(envDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.host-config-smoke.v1',
  checks,
  failures: 0,
  skips: 0,
  categories: ['environment-only', 'host-object', 'precedence', 'safe-defaults', 'AI-environment', 'AI-callback', 'auth-environment', 'auth-session', 'validation', 'secret-reference', 'backwards-compatibility', 'environment-file'],
}, null, 2));
