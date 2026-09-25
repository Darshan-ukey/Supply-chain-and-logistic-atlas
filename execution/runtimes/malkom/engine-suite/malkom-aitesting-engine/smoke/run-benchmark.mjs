import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BuiltinPlanValidator,
  BuiltinDiscoverer,
  createInvalidSchemaExample,
  createBriskAiTesting,
  createSchemaExample,
  defineConfig,
  defineConfigFromHost,
  loadOpenApiSummary,
  mergeConfig,
  normalizeConfig,
  parseAiPlanForTesting,
  validateJsonSchema,
  validatePlanJsonContract,
} from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const workDir = join(packageDir, '.brisk-aitesting-benchmark');
const reportPath = join(workDir, 'benchmark-report.json');
const minimumBenchmarkCases = 50;

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });
await mkdir(join(workDir, 'src'), { recursive: true });
await writeFile(join(workDir, 'malformed-openapi.yaml'), 'openapi: 3.0.3\npaths:\n  /broken:\n    get: [', 'utf8');
await writeFile(join(workDir, 'empty-openapi.json'), JSON.stringify({ openapi: '3.0.3', info: { title: 'Empty', version: '1.0.0' }, paths: {} }, null, 2), 'utf8');
await writeFile(join(workDir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }, null, 2), 'utf8');
await writeFile(join(workDir, 'src', 'routes.ts'), [
  "import express from 'express';",
  'const app = express();',
  'const apiRouter = express.Router();',
  'const channelRouter = express.Router();',
  "app.get('/api/implemented', (_request, response) => response.json({ ok: true }));",
  "app.get('/api/users/:id', (_request, response) => response.json({ ok: true }));",
  "app.post('/api/undocumented', (_request, response) => response.json({ ok: true }));",
  "apiRouter.use('/channels', channelRouter);",
  "channelRouter.get('/:channelId/topics', (_request, response) => response.json({ ok: true }));",
  "channelRouter.post('/undocumented-nested', (_request, response) => response.json({ ok: true }));",
  "apiRouter.route('/subscriptions').get((_request, response) => response.json({ ok: true }));",
  "app.use('/api', apiRouter);",
  "request('/api/generic-request-helper');",
  "app.get('/internal/ignored', (_request, response) => response.json({ ok: true }));",
].join('\n'), 'utf8');
await writeFile(join(workDir, 'src', 'nest-controller.ts'), [
  "import { Controller, Delete, Get, Post } from '@nestjs/common';",
  "@Controller('/api/audit')",
  'export class AuditController {',
  "  @Get('/:eventId')",
  '  readEvent() { return { ok: true }; }',
  '  @Post()',
  '  createEvent() { return { ok: true }; }',
  "  @Delete('/undocumented-nest')",
  '  deleteUndocumentedEvent() { return { ok: true }; }',
  '}',
].join('\n'), 'utf8');

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/wrong-schema') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: 'not-a-boolean' }));
    return;
  }
  if (url.pathname === '/api/undocumented-status') {
    response.writeHead(418, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/api/query') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ mode: url.searchParams.get('mode') ?? 'missing' }));
    return;
  }
  if (url.pathname === '/api/echo' && request.method === 'POST') {
    const body = await readJson(request);
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ received: body }));
    return;
  }
  if (url.pathname === '/api/text') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('hello brisk');
    return;
  }
  if (url.pathname === '/api/state') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ count: 3 }));
    return;
  }
  if (url.pathname === '/api/rejected-action' && request.method === 'POST') {
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'LOCKED' } }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('Benchmark server did not expose a TCP port');

const cases = [];
try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const contractPath = join(workDir, 'benchmark-openapi.json');
  await writeFile(contractPath, JSON.stringify(benchmarkOpenApi(), null, 2), 'utf8');

  await benchmark(cases, {
    id: 'config.rejects-secret-looking-api-key-env',
    area: 'config',
    expected: 'normalizeConfig rejects apiKeyEnv values that look like secrets',
    run: async () => {
      let passed = false;
      try {
        normalizeConfig(defineConfig({
          app: { name: 'bad config', baseUrl },
          ai: { provider: 'openai-compatible', model: 'model', apiKeyEnv: 'sk-secret-value' },
        }));
      } catch (error) {
        passed = error instanceof Error && error.message.includes('ai.apiKeyEnv must be an environment variable name');
      }
      return { passed, observed: passed ? 'rejected secret-looking apiKeyEnv' : 'config was accepted' };
    },
  });

  await runBenchmarkGroup(cases, configBenchmarkCases(baseUrl));

  await benchmark(cases, {
    id: 'openapi.malformed-yaml-fails',
    area: 'openapi',
    expected: 'malformed YAML OpenAPI throws a parser error',
    run: async () => {
      try {
        await loadOpenApiSummary(join(workDir, 'malformed-openapi.yaml'));
        return { passed: false, observed: 'malformed YAML parsed successfully' };
      } catch (error) {
        return { passed: error instanceof Error, observed: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  await benchmark(cases, {
    id: 'openapi.empty-paths-diagnosed',
    area: 'openapi',
    expected: 'OpenAPI with no paths returns diagnostics and zero operations',
    run: async () => {
      const summary = await loadOpenApiSummary(join(workDir, 'empty-openapi.json'));
      const passed = summary.operations.length === 0 && summary.diagnostics.some((entry) => /did not expose any HTTP operations/i.test(entry));
      return { passed, observed: JSON.stringify({ operations: summary.operations.length, diagnostics: summary.diagnostics }) };
    },
  });

  await runBenchmarkGroup(cases, openApiBenchmarkCases(baseUrl, contractPath));

  await benchmark(cases, {
    id: 'discovery.missing-openapi-reported',
    area: 'discovery',
    expected: 'missing OpenAPI contract is reported in discovery warnings',
    run: async () => {
      const config = defineConfig({
        app: { name: 'missing contract app', baseUrl },
        contracts: { openApiPath: join(workDir, 'missing-openapi.yaml') },
        discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: true },
      });
      const normalized = normalizeConfig(config);
      const discovery = await new BuiltinDiscoverer().discover({ config: normalized, input: { goal: 'missing contract' }, runId: `bench_${randomUUID()}` });
      const passed = discovery.contracts[0]?.exists === false && discovery.warnings.some((warning) => /does not exist/i.test(warning));
      return { passed, observed: JSON.stringify({ contracts: discovery.contracts, warnings: discovery.warnings }) };
    },
  });

  await benchmark(cases, {
    id: 'discovery.contract-drift-reports-route-mismatches',
    area: 'discovery',
    expected: 'discovery reports implemented-but-undocumented and documented-but-not-implemented API routes',
    run: async () => {
      const driftContractPath = join(workDir, 'drift-openapi.json');
      await writeFile(driftContractPath, JSON.stringify(driftOpenApi(), null, 2), 'utf8');
      const config = defineConfig({
        app: { name: 'drift benchmark app', baseUrl, repoPath: workDir },
        contracts: { openApiPath: driftContractPath },
        discovery: { includeRepo: true, includeUi: false, includeApi: false, includeContracts: true },
      });
      const normalized = normalizeConfig(config);
      const discovery = await new BuiltinDiscoverer().discover({ config: normalized, input: { goal: 'contract drift' }, runId: `bench_${randomUUID()}` });
      const drift = discovery.contractDrift;
      const passed = drift?.schemaVersion === 'brisk-aitesting.contract-drift.v1'
        && drift.implementedButUndocumented.some((route) => route.method === 'POST' && route.path === '/api/undocumented')
        && drift.implementedButUndocumented.some((route) => route.method === 'POST' && route.path === '/api/channels/undocumented-nested')
        && drift.implementedButUndocumented.some((route) => route.method === 'DELETE' && route.path === '/api/audit/undocumented-nest')
        && drift.documentedButNotImplemented.some((route) => route.method === 'GET' && route.path === '/api/documented-only')
        && drift.matchedRoutes.some((route) => route.method === 'GET' && route.path === '/api/implemented')
        && drift.matchedRoutes.some((route) => route.method === 'GET' && route.implementation.path === '/api/users/:id' && route.contract.path === '/api/users/{userId}')
        && drift.matchedRoutes.some((route) => route.method === 'GET' && route.implementation.path === '/api/channels/:channelId/topics' && route.contract.path === '/api/channels/{channelId}/topics')
        && drift.matchedRoutes.some((route) => route.method === 'GET' && route.path === '/api/subscriptions')
        && drift.matchedRoutes.some((route) => route.method === 'GET' && route.implementation.path === '/api/audit/:eventId' && route.contract.path === '/api/audit/{eventId}')
        && drift.matchedRoutes.some((route) => route.method === 'POST' && route.path === '/api/audit')
        && !discovery.apiRoutes.some((route) => route.method === 'REQUEST')
        && !discovery.apiRoutes.some((route) => route.path === '/api/generic-request-helper')
        && !drift.implementedButUndocumented.some((route) => route.path === '/api/health');
      return {
        passed,
        observed: JSON.stringify({
          implementedButUndocumented: drift?.implementedButUndocumented,
          documentedButNotImplemented: drift?.documentedButNotImplemented,
          matchedRoutes: drift?.matchedRoutes.map((route) => ({ method: route.method, path: route.path })),
          apiRouteMethods: discovery.apiRoutes.map((route) => route.method),
          diagnostics: drift?.diagnostics,
        }),
      };
    },
  });

  await benchmark(cases, {
    id: 'ai-parser.ignores-irrelevant-object-before-plan',
    area: 'ai',
    expected: 'AI parser selects the real plan instead of an earlier irrelevant object',
    run: async () => {
      const context = await plannerContext(baseUrl);
      let rejected = false;
      try {
        parseAiPlanForTesting('Ignore this object { route: "/" }\nActual plan:\n{ scenarios: [{ name: "Health", type: "backend", target: { method: "GET", path: "/api/wrong-schema" }, assertions: ["runs"], evidenceRequired: ["api"] }] }', context);
      } catch {
        rejected = true;
      }
      return { passed: rejected, observed: rejected ? 'rejected non-JSON AI output' : 'accepted non-JSON AI output' };
    },
  });

  await runBenchmarkGroup(cases, aiParserBenchmarkCases(baseUrl));
  await runBenchmarkGroup(cases, validationBenchmarkCases(baseUrl));

  await benchmark(cases, {
    id: 'api.response-schema-mismatch-fails',
    area: 'api',
    expected: 'API engine fails when response body violates OpenAPI schema',
    run: async () => {
      const result = await runApiScenario(baseUrl, contractPath, {
        id: 'wrong_schema',
        name: 'Wrong schema fails',
        type: 'api',
        objective: 'Response schema mismatch should fail.',
        target: { method: 'GET', path: '/api/wrong-schema', sourceOfTruth: 'contract' },
        expect: { status: 200 },
        assertions: ['response body matches schema'],
        evidenceRequired: ['api', 'schema'],
      });
      const test = result.tests[0];
      const passed = result.status === 'failed' && test?.assertions.some((assertion) => /response body matches OpenAPI schema/.test(assertion.name) && assertion.status === 'failed');
      return { passed, observed: JSON.stringify({ status: result.status, assertions: test?.assertions, diagnosis: result.diagnosis }) };
    },
  });

  await benchmark(cases, {
    id: 'api.undocumented-status-fails',
    area: 'api',
    expected: 'API engine fails when status is not documented by OpenAPI',
    run: async () => {
      const result = await runApiScenario(baseUrl, contractPath, {
        id: 'undocumented_status',
        name: 'Undocumented status fails',
        type: 'api',
        objective: 'Undocumented status should fail.',
        target: { method: 'GET', path: '/api/undocumented-status', sourceOfTruth: 'contract' },
        assertions: ['status is documented'],
        evidenceRequired: ['api', 'schema'],
      });
      const test = result.tests[0];
      const passed = result.status === 'failed' && test?.assertions.some((assertion) => /documented in contract/.test(assertion.name) && assertion.status === 'failed');
      return { passed, observed: JSON.stringify({ status: result.status, assertions: test?.assertions, diagnosis: result.diagnosis }) };
    },
  });

  await runBenchmarkGroup(cases, apiRuntimeBenchmarkCases(baseUrl, contractPath));

  await benchmark(cases, {
    id: 'security.network-policy-blocks-disallowed-host',
    area: 'security',
    expected: 'network policy blocks hosts outside allowlist without crashing',
    run: async () => {
      const result = await runApiScenario('http://example.com', undefined, {
        id: 'blocked_network',
        name: 'Blocked network policy',
        type: 'api',
        objective: 'Network policy should skip disallowed host.',
        target: { method: 'GET', path: '/api/health', sourceOfTruth: 'user' },
        assertions: ['network policy blocks request'],
        evidenceRequired: ['api'],
      }, { allowedHosts: ['127.0.0.1'] }, { explicitUserTargets: ['GET /api/health'] });
      const test = result.tests[0];
      const passed = result.status === 'failed'
        && test?.status === 'failed'
        && test?.failureCategory === 'network'
        && result.outcome.issues.some((entry) => entry.category === 'network')
        && test?.diagnostics.some((diagnostic) => /Network policy blocked host/i.test(diagnostic));
      return { passed, observed: JSON.stringify({ status: result.status, diagnostics: test?.diagnostics }) };
    },
  });

  await benchmark(cases, {
    id: 'cli.invalid-scenarios-exits-2',
    area: 'cli',
    expected: 'CLI invalid --scenarios exits with code 2 and clear message',
    run: async () => {
      const configPath = join(workDir, 'cli-benchmark.config.mjs');
      await writeFile(configPath, `export default { app: { name: 'CLI benchmark', baseUrl: ${JSON.stringify(baseUrl)} } };\n`, 'utf8');
      const cli = await runCli(['run', '--config', configPath, '--goal', 'bad scenarios', '--scenarios', '0']);
      const passed = cli.code === 2 && cli.stderr.includes('--scenarios must be a positive integer');
      return { passed, observed: JSON.stringify(cli) };
    },
  });

  await runBenchmarkGroup(cases, cliBenchmarkCases(baseUrl, contractPath));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (cases.length < minimumBenchmarkCases) {
  cases.push({
    id: 'benchmark.minimum-case-count',
    area: 'benchmark',
    status: 'failed',
    expected: `benchmark suite has at least ${minimumBenchmarkCases} meaningful cases`,
    observed: `only ${cases.length} cases were registered`,
    durationMs: 0,
  });
}
const passed = cases.filter((entry) => entry.status === 'passed').length;
const failed = cases.filter((entry) => entry.status === 'failed').length;
const report = {
  schemaVersion: 'brisk-aitesting.benchmark.v1',
  generatedAt: new Date().toISOString(),
  summary: {
    total: cases.length,
    passed,
    failed,
    passRate: cases.length === 0 ? 0 : Math.round((passed / cases.length) * 10000) / 100,
  },
  cases,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (failed > 0) process.exitCode = 1;

async function benchmark(cases, testCase) {
  const started = Date.now();
  try {
    const output = await testCase.run();
    cases.push({
      id: testCase.id,
      area: testCase.area,
      status: output.passed ? 'passed' : 'failed',
      expected: testCase.expected,
      observed: output.observed,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    cases.push({
      id: testCase.id,
      area: testCase.area,
      status: 'failed',
      expected: testCase.expected,
      observed: error instanceof Error ? error.stack ?? error.message : String(error),
      durationMs: Date.now() - started,
    });
  }
}

async function runBenchmarkGroup(cases, testCases) {
  for (const testCase of testCases) {
    await benchmark(cases, testCase);
  }
}

async function plannerContext(baseUrl) {
  const config = normalizeConfig(defineConfig({
    app: { name: 'planner context', baseUrl },
    discovery: { includeRepo: false, includeUi: false, includeApi: true, includeContracts: false },
  }));
  const runId = `bench_${randomUUID()}`;
  const discovery = await new BuiltinDiscoverer().discover({ config, input: { goal: 'planner context' }, runId });
  return { config, input: { goal: 'planner context', scenarios: 1, mode: 'automatic' }, runId, discovery };
}

function configBenchmarkCases(baseUrl) {
  return [
    {
      id: 'config.normalizes-trailing-base-url-slashes',
      area: 'config',
      expected: 'baseUrl is normalized without trailing slashes',
      run: async () => {
        const config = normalizeConfig(defineConfig({ app: { name: 'slash app', baseUrl: `${baseUrl}///` } }));
        return { passed: config.app.baseUrl === baseUrl, observed: config.app.baseUrl };
      },
    },
    {
      id: 'config.defaults-runtime-security-discovery',
      area: 'config',
      expected: 'runtime, discovery, auth, and security defaults are filled',
      run: async () => {
        const config = normalizeConfig(defineConfig({ app: { name: 'defaults app', baseUrl } }));
        const passed = config.auth.type === 'none'
          && config.runtime.timeoutMs === 120000
          && config.runtime.retries === 1
          && config.discovery.includeRepo === true
          && config.security.networkPolicy === 'localhost-only';
        return { passed, observed: JSON.stringify({ auth: config.auth, runtime: config.runtime, discovery: config.discovery, security: config.security }) };
      },
    },
    {
      id: 'config.rejects-empty-app-name',
      area: 'config',
      expected: 'empty app.name is rejected',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: ' ', baseUrl } })));
        return { passed: /app\.name is required/.test(error), observed: error };
      },
    },
    {
      id: 'config.rejects-empty-base-url',
      area: 'config',
      expected: 'empty app.baseUrl is rejected',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: 'bad url', baseUrl: ' ' } })));
        return { passed: /app\.baseUrl is required/.test(error), observed: error };
      },
    },
    {
      id: 'config.rejects-empty-ai-model',
      area: 'config',
      expected: 'AI config requires a non-empty model',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: 'bad model', baseUrl }, ai: { provider: 'openai-compatible', model: ' ' } })));
        return { passed: /ai\.model is required/.test(error), observed: error };
      },
    },
    {
      id: 'config.rejects-negative-repair-attempts',
      area: 'config',
      expected: 'negative repairAttempts are rejected',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: 'bad repair', baseUrl }, ai: { provider: 'openai-compatible', model: 'm', repairAttempts: -1 } })));
        return { passed: /repairAttempts/.test(error), observed: error };
      },
    },
    {
      id: 'config.rejects-too-many-repair-attempts',
      area: 'config',
      expected: 'repairAttempts above the allowed limit are rejected',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: 'bad repair high', baseUrl }, ai: { provider: 'openai-compatible', model: 'm', repairAttempts: 99 } })));
        return { passed: /repairAttempts/.test(error), observed: error };
      },
    },
    {
      id: 'config.accepts-planning-repair-attempts',
      area: 'config',
      expected: 'planning.repairAttempts is accepted without SDK-owned AI provider config',
      run: async () => {
        const config = normalizeConfig(defineConfig({ app: { name: 'planning repair', baseUrl }, planning: { repairAttempts: 2 } }));
        return { passed: config.planning?.repairAttempts === 2 && config.ai === undefined, observed: JSON.stringify({ planning: config.planning, ai: config.ai }) };
      },
    },
    {
      id: 'config.rejects-invalid-planning-repair-attempts',
      area: 'config',
      expected: 'invalid planning.repairAttempts values are rejected',
      run: async () => {
        const error = captureError(() => normalizeConfig(defineConfig({ app: { name: 'bad planning repair', baseUrl }, planning: { repairAttempts: 99 } })));
        return { passed: /planning\.repairAttempts/.test(error), observed: error };
      },
    },
    {
      id: 'config.merge-preserves-nested-values',
      area: 'config',
      expected: 'mergeConfig preserves nested values while applying overrides',
      run: async () => {
        const merged = mergeConfig(
          defineConfig({ app: { name: 'base', baseUrl }, ai: { provider: 'openai-compatible', model: 'old', endpoint: 'http://ai.local' } }),
          { app: { name: 'override', baseUrl }, ai: { model: 'new' } },
        );
        const passed = merged.app.name === 'override' && merged.ai?.provider === 'openai-compatible' && merged.ai.endpoint === 'http://ai.local' && merged.ai.model === 'new';
        return { passed, observed: JSON.stringify(merged.ai) };
      },
    },
    {
      id: 'config.host-bridge-maps-source-config',
      area: 'config',
      expected: 'defineConfigFromHost maps host config without duplicating setup',
      run: async () => {
        const host = { product: 'Host Product', urls: { test: baseUrl }, ai: { model: 'host-model' } };
        const config = defineConfigFromHost(host, (source) => ({ app: { name: source.product, baseUrl: source.urls.test }, ai: { provider: 'openai-compatible', model: source.ai.model } }));
        const passed = config.app.name === 'Host Product' && config.ai?.model === 'host-model';
        return { passed, observed: JSON.stringify(config) };
      },
    },
  ];
}

function openApiBenchmarkCases(baseUrl, contractPath) {
  return [
    {
      id: 'openapi.json-summary-has-title-version-and-operations',
      area: 'openapi',
      expected: 'OpenAPI JSON summary preserves title, version, and operations',
      run: async () => {
        const summary = await loadOpenApiSummary(contractPath);
        const passed = summary.title === 'Benchmark API' && summary.version === '1.0.0' && summary.operations.length >= 7;
        return { passed, observed: JSON.stringify({ title: summary.title, version: summary.version, operations: summary.operations.length }) };
      },
    },
    {
      id: 'openapi.valid-yaml-parses',
      area: 'openapi',
      expected: 'valid YAML OpenAPI files parse successfully',
      run: async () => {
        const yamlPath = join(workDir, 'valid-openapi.yaml');
        await writeFile(yamlPath, ['openapi: 3.0.3', 'info:', '  title: YAML API', '  version: 1.0.0', 'paths:', '  /api/yaml:', '    get:', '      responses:', '        "204":', '          description: ok'].join('\n'), 'utf8');
        const summary = await loadOpenApiSummary(yamlPath);
        return { passed: summary.format === 'yaml' && summary.operations[0]?.statusCodes[0] === 204, observed: JSON.stringify(summary) };
      },
    },
    {
      id: 'openapi.nested-response-refs-are-resolved',
      area: 'openapi',
      expected: 'nested response schema refs are resolved before AJV validation',
      run: async () => {
        const summary = await loadOpenApiSummary(contractPath);
        const operation = summary.operations.find((entry) => entry.path === '/api/nested-ref');
        const schema = operation?.responseSchemas[0]?.schema;
        const validation = validateJsonSchema(schema, { wrapper: { id: 'a', nested: { ok: true } } });
        return { passed: validation.valid, observed: JSON.stringify({ schema, errors: validation.errors }) };
      },
    },
    {
      id: 'openapi.request-example-created-from-required-fields',
      area: 'openapi',
      expected: 'request examples are generated from required schema fields',
      run: async () => {
        const summary = await loadOpenApiSummary(contractPath);
        const operation = summary.operations.find((entry) => entry.path === '/api/echo');
        const passed = operation?.requestExample?.name === 'example' && operation.requestBodyRequired === true;
        return { passed, observed: JSON.stringify(operation?.requestExample) };
      },
    },
    {
      id: 'openapi.invalid-request-example-created',
      area: 'openapi',
      expected: 'invalid request examples are generated for schema fuzzing',
      run: async () => {
        const summary = await loadOpenApiSummary(contractPath);
        const operation = summary.operations.find((entry) => entry.path === '/api/echo');
        const passed = operation?.invalidRequestExample !== undefined && !validateJsonSchema(operation.requestSchema, operation.invalidRequestExample).valid;
        return { passed, observed: JSON.stringify(operation?.invalidRequestExample) };
      },
    },
    {
      id: 'schema.create-object-example',
      area: 'schema',
      expected: 'schema example generation fills object properties',
      run: async () => {
        const example = createSchemaExample({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, active: { type: 'boolean' } } });
        return { passed: example.email === 'user@example.com', observed: JSON.stringify(example) };
      },
    },
    {
      id: 'schema.create-invalid-number-example',
      area: 'schema',
      expected: 'invalid example generation breaks numeric schemas',
      run: async () => {
        const invalid = createInvalidSchemaExample({ type: 'integer', minimum: 1 });
        const validation = validateJsonSchema({ type: 'integer', minimum: 1 }, invalid);
        return { passed: invalid === 'not-a-number' && !validation.valid, observed: JSON.stringify({ invalid, validation }) };
      },
    },
    {
      id: 'schema.enum-example-uses-first-value',
      area: 'schema',
      expected: 'enum examples use a valid enum member',
      run: async () => {
        const example = createSchemaExample({ type: 'string', enum: ['draft', 'sent'] });
        return { passed: example === 'draft', observed: String(example) };
      },
    },
  ];
}

function aiParserBenchmarkCases(baseUrl) {
  return [
    aiCase(baseUrl, 'ai-parser.extracts-fenced-json', 'fenced JSON is extracted', '```json\n{ "scenarios": [{ "name": "Fenced", "type": "api", "target": { "method": "GET", "path": "/api/query" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }\n```', (plan) => plan.scenarios[0]?.name === 'Fenced'),
    aiRejectCase(baseUrl, 'ai-parser.rejects-unquoted-keys', 'JSON-ish output with unquoted keys is rejected', '{ scenarios: [{ name: "Unquoted", type: "backend", target: { method: "GET", path: "/api/query" }, assertions: ["runs"], evidenceRequired: ["api"] }] }'),
    aiRejectCase(baseUrl, 'ai-parser.rejects-trailing-commas', 'JSON-ish output with trailing commas is rejected', '{ "scenarios": [{ "name": "Comma", "type": "api", "target": { "method": "GET", "path": "/api/query", }, "assertions": ["runs"], "evidenceRequired": ["api"], }, ], }'),
    aiCase(baseUrl, 'ai-parser.unwraps-plan-object', 'plan wrapper objects are unwrapped', '{ "plan": { "scenarios": [{ "name": "Wrapped", "type": "api", "target": { "method": "GET", "path": "/api/query" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] } }', (plan) => plan.scenarios[0]?.name === 'Wrapped'),
    aiCase(baseUrl, 'ai-parser.backend-alias-becomes-api', 'backend alias routes to API', '{ "scenarios": [{ "name": "Backend", "type": "backend", "target": { "method": "GET", "path": "/api/query" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }', (plan) => plan.scenarios[0]?.type === 'api'),
    aiCase(baseUrl, 'ai-parser.e2e-alias-becomes-ui', 'e2e alias routes to UI', '{ "scenarios": [{ "name": "Browser", "type": "e2e", "target": { "route": "/" }, "assertions": ["runs"], "evidenceRequired": ["ui"] }] }', (plan) => plan.scenarios[0]?.type === 'ui'),
    aiCase(baseUrl, 'ai-parser.integration-alias-becomes-ui', 'integration alias routes to UI', '{ "scenarios": [{ "name": "Integration", "type": "integration", "target": { "route": "/" }, "assertions": ["runs"], "evidenceRequired": ["ui"] }] }', (plan) => plan.scenarios[0]?.type === 'ui'),
    aiCase(baseUrl, 'ai-parser.asyncapi-alias-becomes-message', 'asyncapi alias routes to message', '{ "scenarios": [{ "name": "Message", "type": "asyncapi", "target": { "schema": "asyncapi.json", "channel": "orders.created" }, "assertions": ["runs"], "evidenceRequired": ["message"] }] }', (plan) => plan.scenarios[0]?.type === 'message'),
    aiCase(baseUrl, 'ai-parser.status-string-becomes-number', 'status strings are normalized', '{ "scenarios": [{ "name": "Status", "type": "api", "target": { "method": "GET", "path": "/api/query" }, "expect": { "status": "200" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }', (plan) => plan.scenarios[0]?.expect?.status === 200),
    aiCase(baseUrl, 'ai-parser.url-target-normalized-to-path', 'absolute URL targets become paths', `{ "scenarios": [{ "name": "URL", "type": "api", "target": { "method": "GET", "url": "${baseUrl}/api/query?mode=fast" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }`, (plan) => plan.scenarios[0]?.target?.path === '/api/query'),
    aiCase(baseUrl, 'ai-parser.ui-action-aliases-normalized', 'UI action aliases are normalized to supported actions', '{ "scenarios": [{ "name": "Actions", "type": "ui", "target": { "route": "/" }, "steps": [{ "type": "type", "elementId": "ui_el_001", "text": "hello" }, { "type": "tap", "elementId": "ui_el_002" }], "assertions": ["runs"], "evidenceRequired": ["ui"] }] }', (plan) => plan.scenarios[0]?.uiActions?.[0]?.action === 'fill' && plan.scenarios[0]?.uiActions?.[1]?.action === 'click'),
    aiCase(baseUrl, 'ai-parser.ai-user-source-known-route-is-not-user', 'AI cannot self-certify a discovered route as user supplied', '{ "scenarios": [{ "name": "Known route user claim", "type": "api", "target": { "method": "GET", "path": "/api/query", "sourceOfTruth": "user" }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }', (plan) => plan.scenarios[0]?.target?.sourceOfTruth !== 'user'),
    aiCase(baseUrl, 'ai-parser.ai-user-source-unknown-route-becomes-ai', 'AI cannot promote an invented route to user supplied', '{ "scenarios": [{ "name": "Unknown route user claim", "type": "api", "target": { "method": "POST", "path": "/api/not-a-real-route", "sourceOfTruth": "user" }, "request": { "body": { "name": "bad-<unique>" } }, "expect": { "status": 201 }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }', (plan) => plan.scenarios[0]?.target?.sourceOfTruth === 'ai'),
    {
      id: 'ai-parser.dynamic-route-placeholder-gets-observed-provenance',
      area: 'ai',
      expected: 'AI dynamic route placeholders are matched against discovered route patterns',
      run: async () => {
        const context = await plannerContext(baseUrl);
        context.discovery.apiRoutes = [{ method: 'POST', path: '/api/topics/:topicId/messages', source: 'repo', confidence: 0.9 }];
        const plan = parseAiPlanForTesting('{ "scenarios": [{ "name": "Dynamic message route", "type": "api", "target": { "method": "POST", "path": "/api/topics/<topicId>/messages" }, "request": { "body": { "text": "hello" } }, "expect": { "status": 201 }, "assertions": ["runs"], "evidenceRequired": ["api"] }] }', context);
        return { passed: plan.scenarios[0]?.target?.sourceOfTruth === 'observed', observed: JSON.stringify(plan.scenarios[0]?.target) };
      },
    },
  ];
}

function validationBenchmarkCases(baseUrl) {
  const validator = new BuiltinPlanValidator();
  return [
    validationCase(baseUrl, validator, 'validation.duplicate-scenario-id-fails', 'duplicate scenario ids are rejected', (plan) => ({ ...plan, scenarios: [apiScenario('dup'), apiScenario('dup')] }), /DUPLICATE_ID/),
    validationCase(baseUrl, validator, 'validation.api-missing-path-fails', 'API scenarios need paths', (plan) => ({ ...plan, scenarios: [{ ...apiScenario('api_missing_path'), target: { method: 'GET' } }] }), /REQUIRED_API_PATH/),
    validationCase(baseUrl, validator, 'validation.ui-route-must-start-with-slash', 'UI routes must start with slash', (plan) => ({ ...plan, scenarios: [{ ...uiScenario('bad_ui'), target: { route: 'dashboard' } }] }), /REQUIRED_UI_ROUTE/),
    validationCase(baseUrl, validator, 'validation.message-channel-required', 'message scenarios require channel', (plan) => ({ ...plan, scenarios: [{ ...messageScenario('bad_message'), target: { schema: 'asyncapi.json' } }] }), /REQUIRED_MESSAGE_CHANNEL/),
    validationCase(baseUrl, validator, 'validation.bad-ui-evidence-id-fails', 'UI actions need evidence IDs', (plan) => ({ ...plan, scenarios: [{ ...uiScenario('bad_action'), uiActions: [{ action: 'click', evidenceId: 'button1' }] }] }), /PLAN_CONTRACT_INVALID_SHAPE|INVALID_UI_EVIDENCE_ID/),
    validationCase(baseUrl, validator, 'validation.unchanged-only-api', 'unchanged state checks are API-only', (plan) => ({ ...plan, scenarios: [{ ...uiScenario('bad_unchanged'), expect: { unchanged: [{ target: { path: '/api/state' } }] } }] }), /UNCHANGED_ON_NON_API_SCENARIO/),
    validationCase(baseUrl, validator, 'validation.required-type-is-enforced', 'requiredTypes input is enforced', (plan) => ({ ...plan, scenarios: [apiScenario('only_api')] }), /MISSING_REQUIRED_TYPE/, { requiredTypes: ['message'] }),
    validationCase(baseUrl, validator, 'validation.exact-scenario-count-too-low-fails', 'exact scenario count rejects too few scenarios', (plan) => ({ ...plan, scenarios: [apiScenario('one_of_three')] }), /SCENARIO_COUNT_MISMATCH/, { scenarios: 3, scenarioCountPolicy: 'exact' }),
    validationCase(baseUrl, validator, 'validation.exact-scenario-count-too-high-fails', 'exact scenario count rejects too many scenarios', (plan) => ({ ...plan, scenarios: [apiScenario('one_of_one'), apiScenario('two_of_one')] }), /SCENARIO_COUNT_MISMATCH/, { scenarios: 1, scenarioCountPolicy: 'exact' }),
    {
      id: 'validation.exact-scenario-count-passes',
      area: 'validation',
      expected: 'exact scenario count accepts the requested number of scenarios',
      run: async () => {
        const config = normalizeConfig(defineConfig({ app: { name: 'scenario count validation', baseUrl } }));
        const plan = { ...basePlan(baseUrl), scenarios: [apiScenario('one'), apiScenario('two')] };
        const result = validator.validate({ config, input: { goal: 'exact count', scenarios: 2, scenarioCountPolicy: 'exact', mode: 'automatic' }, plan });
        return { passed: result.valid === true, observed: JSON.stringify(result.issues) };
      },
    },
    {
      id: 'validation.dynamic-route-placeholder-matches-discovery',
      area: 'validation',
      expected: 'planned workflow placeholders match discovered dynamic API routes',
      run: async () => {
        const config = normalizeConfig(defineConfig({ app: { name: 'dynamic route validation', baseUrl } }));
        const plan = {
          ...basePlan(baseUrl),
          discovery: {
            ...basePlan(baseUrl).discovery,
            apiRoutes: [
              { method: 'POST', path: '/api/topics', source: 'repo', confidence: 0.9 },
              { method: 'POST', path: '/api/topics/:topicId/messages', source: 'repo', confidence: 0.9 },
            ],
          },
          scenarios: [
            {
              ...apiScenario('create_topic_for_dynamic_route'),
              target: { method: 'POST', path: '/api/topics', sourceOfTruth: 'observed' },
              request: { body: { name: 'topic-<unique>' } },
              expect: { status: 201 },
              capture: [{ name: 'topicId', from: 'response.body', path: 'id' }],
            },
            {
              ...apiScenario('dynamic_route'),
              target: { method: 'POST', path: '/api/topics/<topicId>/messages', sourceOfTruth: 'observed' },
              request: { body: { text: 'message-<unique>' } },
              expect: { status: 201 },
            },
          ],
        };
        const result = validator.validate({
          config,
          input: {
            goal: 'planned workflow placeholders match discovered dynamic API routes',
            scenarios: 2,
            mode: 'automatic',
            authoritativeOperations: [
              { method: 'POST', path: '/api/topics', requiredBodyFields: ['name'], successStatusCodes: [201], source: 'host-adapter' },
              { method: 'POST', path: '/api/topics/:topicId/messages', requiredBodyFields: ['text'], successStatusCodes: [201], source: 'host-adapter' },
            ],
          },
          plan,
        });
        return { passed: result.valid === true, observed: JSON.stringify(result.issues) };
      },
    },
    validationCase(baseUrl, validator, 'validation.dynamic-route-wrong-suffix-fails', 'wrong dynamic route suffix is not accepted as discovered evidence', (plan) => ({
      ...plan,
      discovery: {
        ...plan.discovery,
        apiRoutes: [{ method: 'POST', path: '/api/topics/:topicId/messages', source: 'repo', confidence: 0.9 }],
      },
      scenarios: [{
        ...apiScenario('wrong_dynamic_route'),
        target: { method: 'POST', path: '/api/topics/<topicId>/publish', sourceOfTruth: 'observed' },
        request: { body: { text: 'message-<unique>' } },
        expect: { status: 201 },
        capture: [{ name: 'topicId', from: 'response.body', path: 'topicId' }],
      }],
    }), /UNPROVEN_API_ROUTE/),
    {
      id: 'validation.public-contract-blocks-extra-step-key',
      area: 'validation',
      expected: 'public plan contract rejects unrecognized scenario keys',
      run: async () => {
        const issues = validatePlanJsonContract({ ...basePlan(baseUrl), scenarios: [{ ...apiScenario('extra_key'), headers: { authorization: 'Bearer secret' } }] });
        return { passed: issues.some((issue) => issue.code === 'PLAN_CONTRACT_UNRECOGNIZED_KEY'), observed: JSON.stringify(issues) };
      },
    },
  ];
}

function apiRuntimeBenchmarkCases(baseUrl, contractPath) {
  return [
    apiRunCase(baseUrl, contractPath, 'api.query-expectation-passes', 'query params are sent and asserted', { ...apiScenario('api_query'), target: { method: 'GET', path: '/api/query', sourceOfTruth: 'contract' }, request: { query: { mode: 'fast' } }, expect: { status: 200, json: { mode: 'fast' } } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, contractPath, 'api.post-body-is-serialized', 'JSON bodies are serialized and echoed', { ...apiScenario('api_echo'), target: { method: 'POST', path: '/api/echo', sourceOfTruth: 'contract' }, request: { body: { name: 'Brisk' } }, expect: { status: 201, json: { 'received.name': 'Brisk' } } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, contractPath, 'api.contains-text-assertion-passes', 'text response contains checks work', { ...apiScenario('api_text'), target: { method: 'GET', path: '/api/text', sourceOfTruth: 'contract' }, expect: { status: 200, contains: 'hello brisk' } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, contractPath, 'api.rejected-action-state-unchanged-passes', 'before/after snapshots prove rejected actions do not mutate state', { ...apiScenario('api_rejected_state'), target: { method: 'POST', path: '/api/rejected-action', sourceOfTruth: 'contract' }, expect: { status: 409, json: { 'error.code': 'LOCKED' }, unchanged: [{ target: { method: 'GET', path: '/api/state' }, json: { count: 3 } }] } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, contractPath, 'api.expected-status-array-passes', 'status arrays are accepted', { ...apiScenario('api_status_array'), target: { method: 'GET', path: '/api/query', sourceOfTruth: 'contract' }, expect: { status: [200, 204] } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, contractPath, 'api.expected-status-range-passes', 'status ranges are accepted', { ...apiScenario('api_status_range'), target: { method: 'GET', path: '/api/query', sourceOfTruth: 'contract' }, expect: { status: { min: 200, max: 299 } } }, (result) => result.status === 'passed'),
    apiRunCase(baseUrl, undefined, 'replay.native-http-replay-passes', 'built-in replay reruns declared HTTP interactions', { id: 'replay_query', name: 'Replay query', type: 'replay', objective: 'Replay query request.', assertions: ['replay works'], evidenceRequired: ['api'], metadata: { replay: { requests: [{ method: 'GET', path: '/api/query?mode=fast', expectStatus: 200 }] } } }, (result) => result.status === 'passed' && result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.replay-evidence.v1')),
    apiRunCase(baseUrl, undefined, 'replay.empty-requests-rejected', 'replay scenarios without requests are rejected before execution', { id: 'replay_empty', name: 'Empty replay', type: 'replay', objective: 'Empty replay must not be accepted.', assertions: ['request is required'], evidenceRequired: ['api'], metadata: { replay: { requests: [] } } }, (result) => result.tests.length === 0 && result.outcome.issues.some((entry) => entry.code === 'PLAN_REJECTED')),
  ];
}

function cliBenchmarkCases(baseUrl, contractPath) {
  return [
    {
      id: 'cli.missing-config-exits-2',
      area: 'cli',
      expected: 'missing config path exits with setup code 2',
      run: async () => {
        const cli = await runCli(['run', '--config', join(workDir, 'missing.config.mjs'), '--goal', 'missing config']);
        return { passed: cli.code === 2, observed: JSON.stringify(cli) };
      },
    },
    {
      id: 'cli.empty-goal-exits-2',
      area: 'cli',
      expected: 'empty CLI goal exits with setup code 2',
      run: async () => {
        const configPath = join(workDir, 'cli-empty-goal.config.mjs');
        await writeFile(configPath, `export default { app: { name: 'CLI benchmark', baseUrl: ${JSON.stringify(baseUrl)} } };\n`, 'utf8');
        const cli = await runCli(['run', '--config', configPath, '--goal', ' ']);
        return { passed: cli.code === 2, observed: JSON.stringify(cli) };
      },
    },
    {
      id: 'cli.json-success-emits-cli-result-schema',
      area: 'cli',
      expected: 'CLI --json success emits the stable CLI result schema',
      run: async () => {
        const configPath = join(workDir, 'cli-json-success.config.mjs');
        await writeFile(configPath, `export default {
  app: { name: 'CLI benchmark', baseUrl: ${JSON.stringify(baseUrl)} },
  contracts: { openApiPath: ${JSON.stringify(contractPath)} },
  discovery: { includeUi: false, includeApi: true, includeRepo: false, includeContracts: true },
  aiProvider: {
    name: 'benchmark-provider',
    async complete() {
      return {
        content: JSON.stringify({
          warnings: [],
          scenarios: [{
            id: 'cli_json_query',
            name: 'CLI JSON query check',
            objective: 'Query endpoint responds through CLI JSON mode.',
            actions: [{
              id: 'query',
              verb: 'get',
              resource: 'query',
              capability: 'api.http',
              expectedOutcomes: []
            }],
            invariants: [],
            evidenceRequired: ['observable API response'],
            cleanup: 'isolated'
          }]
        })
      };
    }
  }
};\n`, 'utf8');
        const cli = await runCli(['run', '--config', configPath, '--goal', 'query check', '--scenarios', '1', '--json']);
        const parsed = parseJsonFromOutput(cli.stdout);
        return { passed: cli.code === 0 && parsed?.schemaVersion === 'brisk-aitesting.cli-result.v1', observed: JSON.stringify({ code: cli.code, parsed }) };
      },
    },
  ];
}

function aiCase(baseUrl, id, expected, content, predicate) {
  return {
    id,
    area: 'ai',
    expected,
    run: async () => {
      const context = await plannerContext(baseUrl);
      const plan = parseAiPlanForTesting(content, context);
      const passed = predicate(plan);
      return { passed, observed: JSON.stringify(plan.scenarios) };
    },
  };
}

function aiRejectCase(baseUrl, id, expected, content) {
  return {
    id,
    area: 'ai',
    expected,
    run: async () => {
      const context = await plannerContext(baseUrl);
      let rejected = false;
      try {
        parseAiPlanForTesting(content, context);
      } catch {
        rejected = true;
      }
      return { passed: rejected, observed: rejected ? 'rejected non-JSON AI output' : 'accepted non-JSON AI output' };
    },
  };
}

function validationCase(baseUrl, validator, id, expected, mutatePlan, pattern, inputOverride = {}) {
  return {
    id,
    area: 'validation',
    expected,
    run: async () => {
      const config = normalizeConfig(defineConfig({ app: { name: 'validation benchmark', baseUrl } }));
      const input = { goal: expected, scenarios: 1, mode: 'automatic', ...inputOverride };
      const plan = mutatePlan(basePlan(baseUrl));
      const result = validator.validate({ config, input, plan });
      const observed = JSON.stringify(result.issues);
      return { passed: result.valid === false && pattern.test(observed), observed };
    },
  };
}

function apiRunCase(baseUrl, contractPath, id, expected, scenario, predicate) {
  return {
    id,
    area: scenario.type === 'replay' ? 'replay' : 'api',
    expected,
    run: async () => {
      const result = await runApiScenario(baseUrl, contractPath, scenario);
      return { passed: predicate(result), observed: JSON.stringify({ status: result.status, tests: result.tests, artifacts: result.artifacts }) };
    },
  };
}

async function runApiScenario(baseUrl, contractPath, scenario, security = {}, metadata = {}) {
  const config = defineConfig({
    app: { name: 'benchmark app', baseUrl },
    ...(contractPath !== undefined ? { contracts: { openApiPath: contractPath } } : {}),
    runtime: {
      artifactsDir: join(workDir, 'artifacts'),
      timeoutMs: 30000,
      retries: 0,
      headless: true,
      dryRun: false,
    },
    discovery: {
      includeRepo: false,
      includeUi: false,
      includeApi: true,
      includeContracts: contractPath !== undefined,
    },
    security: {
      networkPolicy: 'localhost-only',
      allowedHosts: ['127.0.0.1', 'localhost'],
      redactSecrets: true,
      ...security,
    },
  });
  const planner = {
    name: `benchmark-planner-${scenario.id}`,
    async plan(context) {
      return {
        schemaVersion: 'brisk-aitesting.plan.v1',
        runId: context.runId,
        goal: context.input.goal,
        mode: 'automatic',
        discovery: context.discovery,
        createdAt: new Date().toISOString(),
        warnings: [],
        scenarios: [scenario],
      };
    },
  };
  return createBriskAiTesting(config, { planner }).run({
    goal: scenario.objective,
    scenarios: 1,
    mode: 'automatic',
    metadata,
  });
}

function basePlan(baseUrl) {
  return {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: `bench_${randomUUID()}`,
    goal: 'benchmark validation',
    mode: 'automatic',
    discovery: {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: { name: 'benchmark app', baseUrl },
      uiRoutes: [{ path: '/', source: 'config', confidence: 1 }],
      apiRoutes: [{ method: 'GET', path: '/api/query', source: 'runtime', confidence: 1 }],
      contracts: [],
      repoSignals: [],
      warnings: [],
      createdAt: new Date().toISOString(),
    },
    warnings: [],
    createdAt: new Date().toISOString(),
    scenarios: [apiScenario('base_api')],
  };
}

function apiScenario(id) {
  return {
    id,
    name: id.replace(/[_-]/g, ' '),
    type: 'api',
    objective: `Run ${id}.`,
    target: { method: 'GET', path: '/api/query', sourceOfTruth: 'observed' },
    expect: { status: 200 },
    assertions: ['response is valid'],
    evidenceRequired: ['api'],
  };
}

function uiScenario(id) {
  return {
    id,
    name: id.replace(/[_-]/g, ' '),
    type: 'ui',
    objective: `Run ${id}.`,
    target: { route: '/', sourceOfTruth: 'observed' },
    assertions: ['page is usable'],
    uiActions: [{ action: 'click', evidenceId: 'ui_el_001' }],
    evidenceRequired: ['ui'],
  };
}

function messageScenario(id) {
  return {
    id,
    name: id.replace(/[_-]/g, ' '),
    type: 'message',
    objective: `Run ${id}.`,
    target: { schema: 'asyncapi.json', channel: 'orders.created', sourceOfTruth: 'contract' },
    assertions: ['message contract is valid'],
    evidenceRequired: ['message'],
  };
}

function benchmarkOpenApi() {
  return {
    openapi: '3.0.3',
    info: { title: 'Benchmark API', version: '1.0.0' },
    paths: {
      '/api/query': {
        get: {
          operationId: 'getQuery',
          parameters: [{ name: 'mode', in: 'query', required: false, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Query endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['mode'],
                    properties: { mode: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/echo': {
        post: {
          operationId: 'postEcho',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Echo endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['received'],
                    properties: {
                      received: {
                        type: 'object',
                        required: ['name'],
                        properties: { name: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/text': {
        get: {
          operationId: 'getText',
          responses: {
            200: {
              description: 'Text endpoint',
              content: {
                'text/plain': { schema: { type: 'string' } },
              },
            },
          },
        },
      },
      '/api/state': {
        get: {
          operationId: 'getState',
          responses: {
            200: {
              description: 'State endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['count'],
                    properties: { count: { type: 'integer' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/rejected-action': {
        post: {
          operationId: 'postRejectedAction',
          responses: {
            409: {
              description: 'Rejected action',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['error'],
                    properties: {
                      error: {
                        type: 'object',
                        required: ['code'],
                        properties: { code: { type: 'string', enum: ['LOCKED'] } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/nested-ref': {
        get: {
          operationId: 'getNestedRef',
          responses: {
            200: {
              description: 'Nested ref endpoint',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Wrapper' },
                },
              },
            },
          },
        },
      },
      '/api/wrong-schema': {
        get: {
          operationId: 'getWrongSchema',
          responses: {
            200: {
              description: 'Wrong schema endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/undocumented-status': {
        get: {
          operationId: 'getUndocumentedStatus',
          responses: {
            200: {
              description: 'Documented success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Wrapper: {
          type: 'object',
          required: ['wrapper'],
          properties: { wrapper: { $ref: '#/components/schemas/Item' } },
        },
        Item: {
          type: 'object',
          required: ['id', 'nested'],
          properties: {
            id: { type: 'string' },
            nested: { $ref: '#/components/schemas/Nested' },
          },
        },
        Nested: {
          type: 'object',
          required: ['ok'],
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  };
}

function captureError(fn) {
  try {
    fn();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function parseJsonFromOutput(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return undefined;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return undefined;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text.length === 0) return undefined;
  return JSON.parse(text);
}

function driftOpenApi() {
  return {
    openapi: '3.0.3',
    info: { title: 'Drift Benchmark API', version: '1.0.0' },
    paths: {
      '/api/implemented': {
        get: {
          operationId: 'getImplemented',
          responses: {
            200: {
              description: 'Implemented endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/documented-only': {
        get: {
          operationId: 'getDocumentedOnly',
          responses: {
            200: {
              description: 'Documented but not implemented',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/users/{userId}': {
        get: {
          operationId: 'getUserById',
          responses: {
            200: {
              description: 'Parameterized user endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/channels/{channelId}/topics': {
        get: {
          operationId: 'listChannelTopics',
          responses: {
            200: {
              description: 'Nested router route',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/subscriptions': {
        get: {
          operationId: 'listSubscriptions',
          responses: {
            200: {
              description: 'Express router.route endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/audit/{eventId}': {
        get: {
          operationId: 'getAuditEvent',
          responses: {
            200: {
              description: 'Nest decorator endpoint',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/audit': {
        post: {
          operationId: 'createAuditEvent',
          responses: {
            201: {
              description: 'Nest decorator endpoint without method path',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(packageDir, 'dist', 'cli.js'), ...args], {
      cwd: packageDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}
