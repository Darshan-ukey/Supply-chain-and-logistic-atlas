import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBriskAiTesting,
  runEnginePluginConformance,
  SpecmaticContractEngine,
} from '../dist/index.js';
import { createSeriousSaasServer } from '../reference-apps/serious-saas/server.mjs';
import { seriousSaasConfig } from '../reference-apps/serious-saas/brisk-aitesting.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const openApiPath = join(packageDir, 'reference-apps', 'serious-saas', 'openapi.json');
const focusedOpenApiPath = join(packageDir, '.brisk-aitesting-specmatic-smoke', 'health-openapi.json');

if (!hasJava() && process.env.BRISK_AITESTING_REQUIRE_SPECMATIC !== 'true') {
  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.specmatic-smoke.v1',
    status: 'skipped',
    reason: 'Java is not available. Specmatic npm package needs Java to execute.',
    errors: [],
  }, null, 2));
  process.exit(0);
}

const server = createSeriousSaasServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('serious-saas reference app did not expose a TCP port');

try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = seriousSaasConfig(baseUrl);
  await mkdir(dirname(focusedOpenApiPath), { recursive: true });
  await writeFile(focusedOpenApiPath, JSON.stringify(focusedHealthOpenApi(JSON.parse(await readFile(openApiPath, 'utf8'))), null, 2), 'utf8');
  const scenario = {
    id: 'specmatic_serious_saas_contract',
    name: 'Specmatic checks serious SaaS provider contract',
    type: 'contract',
    objective: 'Run real Specmatic provider contract testing against the public health contract of the serious SaaS reference API.',
    target: { schema: focusedOpenApiPath },
    assertions: ['Specmatic provider contract passes'],
    evidenceRequired: ['schema', 'api'],
    metadata: { adapter: 'specmatic' },
  };
  const unrelatedScenario = {
    id: 'specmatic_unrelated_replay',
    name: 'unrelated replay scenario',
    type: 'replay',
    objective: 'Specmatic must reject unrelated replay scenarios.',
    assertions: ['replay runs'],
    evidenceRequired: ['api'],
  };
  const plan = {
    schemaVersion: 'brisk-aitesting.plan.v1',
    runId: 'specmatic_smoke',
    goal: 'Run real Specmatic adapter smoke',
    mode: 'contract',
    scenarios: [scenario],
    discovery: {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: { name: config.app.name, baseUrl: config.app.baseUrl, repoPath: config.app.repoPath },
      uiRoutes: [],
      apiRoutes: [],
      contracts: [{ kind: 'openapi', path: focusedOpenApiPath, exists: true, operations: 1 }],
      repoSignals: [],
      warnings: [],
      createdAt: new Date().toISOString(),
    },
    warnings: [],
    createdAt: new Date().toISOString(),
  };
  const engine = new SpecmaticContractEngine({ mode: 'test' });
  const conformance = await runEnginePluginConformance({
    config,
    plan,
    cases: [{ engine, validScenario: scenario, unrelatedScenario }],
    runId: 'specmatic_conformance',
  });
  const tester = createBriskAiTesting(config, {
    planner: {
      name: 'specmatic-smoke-planner',
      async plan(context) {
        return { ...plan, runId: context.runId, goal: context.input.goal, discovery: context.discovery };
      },
    },
    engines: [engine],
  });
  const result = await tester.run({
    goal: 'Run real Specmatic contract adapter against serious SaaS',
    scenarios: 1,
    mode: 'contract',
  });

  const errors = [];
  if (conformance.status !== 'passed') errors.push(`Specmatic engine conformance failed: ${conformance.errors.join('; ')}`);
  if (result.status !== 'passed') errors.push(`Specmatic run should pass, got ${result.status}`);
  if (!result.artifacts.some((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.specmatic-evidence.v1')) errors.push('missing Specmatic evidence artifact');
  const evidenceArtifact = result.artifacts.find((artifact) => artifact.metadata?.schemaVersion === 'brisk-aitesting.specmatic-evidence.v1' && artifact.path !== undefined);
  const evidence = evidenceArtifact?.path === undefined ? undefined : JSON.parse(await readFile(evidenceArtifact.path, 'utf8'));
  if (evidence?.schemaVersion !== 'brisk-aitesting.specmatic-evidence.v1') errors.push('wrong Specmatic evidence schema');
  if ((evidence?.summary?.runs ?? 0) < 1) errors.push('Specmatic coverage missing command run');
  if ((evidence?.artifacts?.length ?? 0) < 2) errors.push('Specmatic coverage missing saved artifacts');
  if ((evidence?.summary?.failures ?? 0) > 0) errors.push(`Specmatic reported failures: ${evidence.summary.failures}`);
  if ((evidence?.summary?.errors ?? 0) > 0) errors.push(`Specmatic reported errors: ${evidence.summary.errors}`);
  if (!result.tests[0]?.assertions.some((assertion) => assertion.name.includes('Specmatic found no contract failures') && assertion.status === 'passed')) {
    errors.push('missing passing Specmatic contract assertion');
  }

  const status = errors.length === 0 ? 'passed' : 'failed';
  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.specmatic-smoke.v1',
    status,
    conformance: {
      status: conformance.status,
      engines: conformance.engines.map((entry) => ({ name: entry.name, status: entry.status })),
    },
    summary: result.summary,
    evidence: evidence === undefined ? undefined : {
      schemaVersion: evidence.schemaVersion,
      status: evidence.status,
      mode: evidence.mode,
      summary: evidence.summary,
    },
    errors,
  }, null, 2));
  if (status !== 'passed') process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function hasJava() {
  if (process.env.JAVA_HOME !== undefined) return true;
  return existsSync('C:/Program Files/Java') || existsSync('/usr/bin/java') || existsSync('/usr/local/bin/java');
}

function focusedHealthOpenApi(openApi) {
  return {
    ...openApi,
    paths: {
      '/api/health': openApi.paths['/api/health'],
    },
  };
}

// coverage missing guard for adapter readiness.
