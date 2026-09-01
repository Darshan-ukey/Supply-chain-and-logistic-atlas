import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBriskAiTesting,
  runEnginePluginConformance,
  SchemathesisOpenApiFuzzEngine,
} from '../dist/index.js';
import { createSeriousSaasServer } from '../reference-apps/serious-saas/server.mjs';
import { seriousSaasConfig } from '../reference-apps/serious-saas/brisk-aitesting.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const openApiPath = join(packageDir, 'reference-apps', 'serious-saas', 'openapi.json');
const schemathesisCommand = resolveSchemathesisCommand();

const server = createSeriousSaasServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('serious-saas reference app did not expose a TCP port');

try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = seriousSaasConfig(baseUrl);
  const scenario = {
    id: 'schemathesis_serious_saas_get_routes_fuzz',
    name: 'Schemathesis fuzzes serious SaaS GET contracts',
    type: 'schema',
    objective: 'Run real Schemathesis OpenAPI fuzzing against the serious SaaS reference API.',
    target: { schema: openApiPath, method: 'GET' },
    assertions: ['Schemathesis finds no OpenAPI contract failures'],
    evidenceRequired: ['schema', 'api'],
    metadata: { adapter: 'schemathesis', polarity: 'positive' },
  };
  const unrelatedScenario = {
    id: 'schemathesis_unrelated_ui',
    name: 'unrelated UI scenario',
    type: 'ui',
    objective: 'Schemathesis must reject unrelated UI scenarios.',
    target: { route: '/' },
    assertions: ['ui runs'],
    evidenceRequired: ['ui'],
  };
  const plan = {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: 'schemathesis_smoke',
    goal: 'Run real Schemathesis adapter smoke',
    mode: 'automatic',
    scenarios: [scenario],
    discovery: {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: { name: config.app.name, baseUrl: config.app.baseUrl, repoPath: config.app.repoPath },
      uiRoutes: [],
      apiRoutes: [],
      contracts: [{ kind: 'openapi', path: openApiPath, exists: true, operations: 6 }],
      repoSignals: [],
      warnings: [],
      createdAt: new Date().toISOString(),
    },
    warnings: [],
    createdAt: new Date().toISOString(),
  };
  const engine = new SchemathesisOpenApiFuzzEngine({
    command: schemathesisCommand.command,
    commandArgs: schemathesisCommand.args,
    mode: 'all',
    phases: ['examples', 'fuzzing'],
    checks: [
      'not_a_server_error',
      'status_code_conformance',
      'content_type_conformance',
      'response_schema_conformance',
      'negative_data_rejection',
      'positive_data_acceptance',
    ],
    maxExamples: 3,
    seed: 20260727,
    workers: 1,
    requestTimeoutMs: 3000,
  });

  const conformance = await runEnginePluginConformance({
    config,
    plan,
    cases: [{ engine, validScenario: scenario, unrelatedScenario }],
    runId: 'schemathesis_conformance',
  });

  const tester = createBriskAiTesting(config, {
    planner: {
      name: 'schemathesis-smoke-planner',
      async plan(context) {
        return { ...plan, runId: context.runId, goal: context.input.goal, discovery: context.discovery };
      },
    },
    engines: [engine],
  });
  const result = await tester.run({
    goal: 'Run real Schemathesis OpenAPI fuzz adapter against serious SaaS',
    scenarios: 1,
    mode: 'schema',
  });

  const errors = [];
  if (conformance.status !== 'passed') errors.push(`Schemathesis engine conformance failed: ${conformance.errors.join('; ')}`);
  if (result.status !== 'passed') errors.push(`Schemathesis run should pass, got ${result.status}`);
  if (result.summary.total !== 1 || result.summary.passed !== 1) errors.push(`expected one passing scenario, got ${JSON.stringify(result.summary)}`);
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.schemathesis-evidence.v1')) errors.push('missing Schemathesis evidence artifact');
  if (!result.tests[0]?.assertions.some((assertion) => assertion.name.includes('Schemathesis found no contract failures') && assertion.status === 'passed')) {
    errors.push('missing passing Schemathesis contract assertion');
  }
  const evidenceArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.schemathesis-evidence.v1' && artifact.path !== undefined);
  const evidence = evidenceArtifact?.path === undefined ? undefined : JSON.parse(await readFile(evidenceArtifact.path, 'utf8'));
  if (evidence?.schemaVersion !== 'brisk-aitesting.schemathesis-evidence.v1') errors.push('wrong Schemathesis evidence schema');
  if (typeof evidence?.events?.eventCount !== 'number') errors.push('Schemathesis evidence missing event count');
  if ((evidence?.events?.eventCount ?? 0) < 20) errors.push(`expected at least 20 Schemathesis events, got ${evidence?.events?.eventCount ?? 0}`);
  if ((evidence?.events?.operations?.selected ?? 0) < 4) errors.push(`expected at least 4 selected operations, got ${evidence?.events?.operations?.selected ?? 0}`);
  for (const label of ['GET /api/health', 'GET /api/me', 'GET /api/users', 'GET /api/audit-events']) {
    if (!evidence?.events?.scenarioLabels?.includes(label)) errors.push(`Schemathesis coverage missing ${label}`);
  }
  if (!evidence?.events?.phaseNames?.includes('Fuzzing')) errors.push('Schemathesis coverage missing Fuzzing phase');
  if ((evidence?.events?.statusCounts?.success ?? 0) < 4) errors.push(`expected at least 4 successful Schemathesis scenarios, got ${evidence?.events?.statusCounts?.success ?? 0}`);
  if (!evidence?.events?.generationModes?.includes('positive')) errors.push('Schemathesis coverage missing positive generation mode');
  for (const expectedLabel of ['Schemathesis execution log', 'Schemathesis JUnit report', 'Schemathesis NDJSON events', 'Schemathesis HAR report', 'Schemathesis evidence']) {
    const artifact = result.artifacts.find((entry) => entry.label === expectedLabel && entry.path !== undefined);
    if (artifact?.path === undefined || !existsSync(artifact.path)) errors.push(`missing artifact file: ${expectedLabel}`);
  }

  const status = errors.length === 0 ? 'passed' : 'failed';
  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.schemathesis-smoke.v1',
    status,
    command: [schemathesisCommand.command, ...schemathesisCommand.args].join(' '),
    conformance: {
      status: conformance.status,
      engines: conformance.engines.map((entry) => ({ name: entry.name, status: entry.status })),
    },
    summary: result.summary,
    evidence: evidence === undefined ? undefined : {
      schemaVersion: evidence.schemaVersion,
      status: evidence.status,
      eventCount: evidence.events?.eventCount,
      eventTypes: evidence.events?.eventTypes,
      operations: evidence.events?.operations,
      scenarioLabels: evidence.events?.scenarioLabels,
      phaseNames: evidence.events?.phaseNames,
      statusCounts: evidence.events?.statusCounts,
      generationModes: evidence.events?.generationModes,
    },
    errors,
  }, null, 2));
  if (status !== 'passed') process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function resolveSchemathesisCommand() {
  if (process.env.BRISK_AITESTING_SCHEMATHESIS_COMMAND !== undefined) {
    return {
      command: process.env.BRISK_AITESTING_SCHEMATHESIS_COMMAND,
      args: parseArgs(process.env.BRISK_AITESTING_SCHEMATHESIS_ARGS ?? ''),
    };
  }
  const windowsUserScript = process.env.APPDATA === undefined ? undefined : join(process.env.APPDATA, 'Python', 'Python311', 'Scripts', 'st.exe');
  if (windowsUserScript !== undefined && existsSync(windowsUserScript)) return { command: windowsUserScript, args: [] };
  return { command: 'st', args: [] };
}

function parseArgs(value) {
  return value.split(/\s+/).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
