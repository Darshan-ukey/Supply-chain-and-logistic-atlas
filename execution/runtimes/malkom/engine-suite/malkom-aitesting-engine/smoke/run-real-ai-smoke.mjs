import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BriskAiTestingProviderError, createBriskAiTesting, defineConfig, loadEnvFiles } from '../dist/index.js';

await loadEnvFiles({
  packageDir: dirname(dirname(fileURLToPath(import.meta.url))),
});

const provider = process.env.BRISK_AITESTING_AI_PROVIDER ?? inferProviderFromCompatibilityEnv();
const providerApiKeyEnv = compatibilityApiKeyEnv(provider);
const apiKeyEnv = process.env.BRISK_AITESTING_AI_API_KEY !== undefined
  ? 'BRISK_AITESTING_AI_API_KEY'
  : providerApiKeyEnv ?? 'BRISK_AITESTING_AI_API_KEY';
const apiKey = process.env[apiKeyEnv];
const caCertPath = process.env.BRISK_AITESTING_AI_CA_CERT_PATH
  ?? process.env.BRISK_AITESTING_CA_CERT_PATH
  ?? compatibilityCaCertPath(provider);
const model = process.env.BRISK_AITESTING_AI_MODEL
  ?? compatibilityModel(provider);
if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error(`BRISK_AITESTING_AI_API_KEY${providerApiKeyEnv !== undefined ? ` or ${providerApiKeyEnv}` : ''} is required for real AI smoke.`);
}
if (model === undefined || model.trim().length === 0) {
  const providerModelEnv = compatibilityModelEnv(provider);
  throw new Error(`BRISK_AITESTING_AI_MODEL${providerModelEnv !== undefined ? ` or ${providerModelEnv}` : ''} is required for real AI smoke.`);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, 'site');
const server = createServer(async (request, response) => {
  if (request.url === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, service: 'real-ai-smoke' }));
    return;
  }
  const html = await readFile(join(appRoot, 'index.html'), 'utf8');
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html.replaceAll('__PATH__', request.url ?? '/'));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Smoke server did not expose a TCP port');

try {
  const config = defineConfig({
    app: {
      name: 'real AI smoke app',
      baseUrl: `http://127.0.0.1:${address.port}`,
      repoPath: process.cwd(),
      env: 'local',
    },
    auth: { type: 'none' },
    ai: {
      provider,
      model,
      apiKeyEnv,
      ...(caCertPath !== undefined && caCertPath.trim().length > 0 ? { caCertPath } : {}),
      maxTokens: 4096,
      temperature: 0.1,
    },
    runtime: {
      artifactsDir: '.brisk-aitesting-real-ai/artifacts',
      timeoutMs: 120000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: true,
      includeUi: true,
      includeApi: true,
      includeContracts: false,
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['localhost', '127.0.0.1'],
      redactSecrets: true,
    },
  });

  const tester = createBriskAiTesting(config);
  let result;
  try {
    result = await tester.run({
      goal: 'Use AI to plan one homepage UI test and one health API test.',
      scenarios: 2,
      scenarioCountPolicy: 'exact',
      mode: 'automatic',
      requiredTypes: ['ui', 'api'],
    });
  } catch (error) {
    if (error instanceof BriskAiTestingProviderError) {
      console.error(JSON.stringify({
        provider,
        status: 'blocked',
        code: error.code,
        message: error.message,
        diagnosis: error.diagnosis,
        resolution: error.resolution,
      }, null, 2));
      process.exitCode = 1;
    } else {
      throw error;
    }
  }

  if (result !== undefined) {
    const errors = [];
    if (result.summary.total !== 2) errors.push(`expected 2 tests, got ${result.summary.total}`);
    if (result.summary.passed < 1) errors.push(`expected at least one passed test, got ${result.summary.passed}`);
    if (result.discovery.schemaVersion !== 'brisk-aitesting.discovery.v1') errors.push('wrong discovery schema');
    if (result.plan.scenarios.length !== 2) errors.push(`expected 2 planned scenarios, got ${result.plan.scenarios.length}`);
    if (!result.plan.scenarios.some((scenario) => scenario.type === 'ui')) errors.push('expected one UI scenario');
    if (!result.plan.scenarios.some((scenario) => scenario.type === 'api')) errors.push('expected one API scenario');

    if (errors.length > 0) {
      console.error(JSON.stringify({ errors, status: result.status, summary: result.summary, plan: result.plan, diagnosis: result.diagnosis }, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({
        provider,
        status: result.status,
        summary: result.summary,
        plannedTypes: result.plan.scenarios.map((scenario) => scenario.type),
        artifacts: result.artifacts.length,
      }, null, 2));
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function inferProviderFromCompatibilityEnv() {
  return 'openai-compatible';
}

// No vendor-specific environment names: the generic BRISK_AITESTING_AI_*
// variables are the only configuration surface.
function compatibilityApiKeyEnv() {
  return undefined;
}

function compatibilityModelEnv() {
  return undefined;
}

function compatibilityModel() {
  return undefined;
}

function compatibilityCaCertPath() {
  return undefined;
}
