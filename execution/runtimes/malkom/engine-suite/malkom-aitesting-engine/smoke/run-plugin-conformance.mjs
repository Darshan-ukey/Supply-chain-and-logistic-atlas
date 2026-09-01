import {
  defineConfig,
  normalizeConfig,
  runEnginePluginConformance,
} from '../dist/index.js';

const config = normalizeConfig(defineConfig({
  app: {
    name: 'plugin conformance host',
    baseUrl: 'http://127.0.0.1:1',
    repoPath: process.cwd(),
    env: 'ci',
  },
  auth: { type: 'none' },
  runtime: {
    artifactsDir: '.brisk-aitesting-plugin-conformance/artifacts',
    timeoutMs: 100,
    retries: 0,
    headless: true,
    dryRun: false,
  },
  discovery: {
    includeRepo: false,
    includeUi: false,
    includeApi: false,
    includeContracts: false,
  },
  security: {
    networkPolicy: 'localhost-only',
    allowedHosts: ['localhost', '127.0.0.1', '::1'],
    redactSecrets: true,
  },
}));

const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1',
  app: {
    name: config.app.name,
    baseUrl: config.app.baseUrl,
    repoPath: config.app.repoPath,
  },
  uiRoutes: [],
  apiRoutes: [],
  contracts: [],
  repoSignals: [],
  warnings: [],
  createdAt: new Date().toISOString(),
};

const validScenario = {
  id: 'plugin_schema_positive',
  name: 'schema plugin positive scenario',
  type: 'schema',
  objective: 'A custom schema engine produces a stable result.',
  target: { schema: 'memory://schema' },
  assertions: ['schema engine runs'],
  evidenceRequired: ['schema'],
};

const unrelatedScenario = {
  id: 'plugin_api_unrelated',
  name: 'api scenario unrelated to schema plugin',
  type: 'api',
  objective: 'An unrelated API scenario must be rejected by schema plugins.',
  target: { method: 'GET', path: '/api/health' },
  assertions: ['api runs'],
  evidenceRequired: ['api'],
};

const plan = {
  schemaVersion: 'brisk-aitesting.plan.v1',
  runId: 'plugin_conformance',
  goal: 'Validate external engine plugin behavior',
  mode: 'automatic',
  scenarios: [validScenario, unrelatedScenario],
  discovery,
  warnings: [],
  createdAt: new Date().toISOString(),
};

class GoodSchemaPluginEngine {
  name = 'good-schema-plugin';
  type = 'schema';

  canRun(scenario) {
    return scenario.type === 'schema';
  }

  async run(context) {
    return {
      result: {
        scenarioId: context.scenario.id,
        name: context.scenario.name,
        type: context.scenario.type,
        engine: this.name,
        status: 'passed',
        durationMs: 1,
        assertions: [{ name: 'schema engine runs', status: 'passed' }],
        artifacts: [{
          kind: 'json',
          label: 'schema plugin evidence',
          metadata: {
            schemaVersion: 'example.schema-plugin-evidence.v1',
            scenarioId: context.scenario.id,
          },
        }],
        diagnostics: ['plugin completed without external side effects'],
      },
    };
  }
}

async function main() {
  const goodReport = await runEnginePluginConformance({
    config,
    plan,
    cases: [{
      engine: new GoodSchemaPluginEngine(),
      validScenario,
      unrelatedScenario,
    }],
  });

  const badReport = await runEnginePluginConformance({
    config,
    plan,
    cases: [
      {
        engine: new LeakyPluginEngine(),
        validScenario,
        unrelatedScenario,
      },
      {
        engine: new OverbroadPluginEngine(),
        validScenario,
        unrelatedScenario,
      },
      {
        engine: new TimeoutPluginEngine(),
        validScenario,
        unrelatedScenario,
      },
    ],
  });

  const errors = [];
  if (goodReport.schemaVersion !== 'brisk-aitesting.plugin-conformance.v1') errors.push('wrong plugin conformance schema');
  if (goodReport.status !== 'passed') errors.push(`good plugin should pass: ${goodReport.errors.join('; ')}`);
  if (badReport.status !== 'failed') errors.push('bad plugins should fail conformance');
  if (!badReport.errors.some((error) => error.includes('secret leakage'))) errors.push('leaky plugin was not rejected');
  if (!badReport.errors.some((error) => error.includes('rejects unrelated'))) errors.push('overbroad plugin was not rejected');
  if (!badReport.errors.some((error) => error.includes('timeout'))) errors.push('timeout plugin was not rejected');

  const status = errors.length === 0 ? 'passed' : 'failed';
  console.log(JSON.stringify({
    schemaVersion: 'brisk-aitesting.plugin-conformance-smoke.v1',
    status,
    goodReport,
    badPluginFailures: badReport.errors,
    errors,
  }, null, 2));

  if (status !== 'passed') process.exitCode = 1;
}

class LeakyPluginEngine extends GoodSchemaPluginEngine {
  name = 'leaky-schema-plugin';

  async run(context) {
    const output = await super.run(context);
    return {
      result: {
        ...output.result,
        engine: this.name,
        diagnostics: ['Bearer sk-1234567890abcdef leaked by plugin'],
      },
    };
  }
}

class OverbroadPluginEngine extends GoodSchemaPluginEngine {
  name = 'overbroad-schema-plugin';

  canRun() {
    return true;
  }
}

class TimeoutPluginEngine extends GoodSchemaPluginEngine {
  name = 'timeout-schema-plugin';

  async run() {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      result: {
        scenarioId: validScenario.id,
        name: validScenario.name,
        type: validScenario.type,
        engine: this.name,
        status: 'passed',
        durationMs: 250,
        assertions: [{ name: 'late pass', status: 'passed' }],
        artifacts: [],
        diagnostics: [],
      },
    };
  }
}

await main();
