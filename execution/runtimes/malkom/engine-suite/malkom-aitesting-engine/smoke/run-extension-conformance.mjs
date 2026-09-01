import { runExtensionConformance } from '../dist/index.js';

const discovery = {
  schemaVersion: 'brisk-aitesting.discovery.v1',
  app: { name: 'extension conformance app', baseUrl: 'http://127.0.0.1:3000', repoPath: process.cwd() },
  uiRoutes: [{ path: '/', source: 'config', confidence: 1 }],
  apiRoutes: [{ method: 'GET', path: '/api/health', source: 'config', confidence: 1 }],
  contracts: [],
  repoSignals: [],
  warnings: [],
  createdAt: new Date().toISOString(),
};

const uiScenario = {
  id: 'extension_ui_home',
  name: 'home page loads',
  type: 'ui',
  objective: 'Home page can be grounded.',
  target: { route: '/' },
  assertions: ['body is visible'],
  evidenceRequired: ['ui'],
};

const plan = {
  schemaVersion: 'brisk-aitesting.plan.v1',
  runId: 'extension_conformance',
  goal: 'Check extension contracts',
  mode: 'automatic',
  discovery,
  scenarios: [uiScenario],
  warnings: [],
  createdAt: new Date().toISOString(),
};

const config = {
  app: { name: 'extension conformance app', baseUrl: 'http://127.0.0.1:3000', repoPath: process.cwd(), env: 'local' },
  auth: { type: 'none' },
  runtime: { artifactsDir: '.brisk-aitesting-extension-conformance', timeoutMs: 1000, retries: 0, headless: true, dryRun: false },
  discovery: { includeRepo: false, includeUi: false, includeApi: false, includeContracts: false },
  security: { networkPolicy: 'localhost-only', allowedHosts: ['127.0.0.1', 'localhost', '::1'], redactSecrets: true },
};

const goodCases = [
  {
    kind: 'discoverer',
    extension: {
      name: 'good-discoverer',
      async discover() {
        return discovery;
      },
    },
  },
  {
    kind: 'planner',
    extension: {
      name: 'good-planner',
      async plan() {
        return plan;
      },
    },
  },
  {
    kind: 'validator',
    extension: {
      name: 'good-validator',
      validate() {
        return { schemaVersion: 'brisk-aitesting.validation.v1', valid: true, issues: [] };
      },
    },
  },
  {
    kind: 'ui-grounder',
    extension: {
      name: 'good-ui-grounder',
      async ground() {
        return {
          grounding: {
            schemaVersion: 'brisk-aitesting.ui-grounding.v1',
            scenario: { id: uiScenario.id, name: uiScenario.name, objective: uiScenario.objective },
            route: '/',
            url: 'http://127.0.0.1:3000/',
            title: 'Extension Conformance',
            capturedAt: new Date().toISOString(),
            elements: [],
            summary: { total: 0, roles: {}, labels: 0, testIds: 0, actionable: 0 },
          },
          artifacts: [],
        };
      },
    },
  },
  {
    kind: 'ai-provider',
    extension: {
      name: 'good-ai-provider',
      async complete() {
        return { content: JSON.stringify(plan), usage: { inputTokens: 10, outputTokens: 50 } };
      },
    },
  },
];

const badCases = [
  {
    kind: 'discoverer',
    expectFailure: true,
    extension: {
      name: 'bad-discoverer',
      async discover() {
        return { schemaVersion: 'wrong', warnings: [] };
      },
    },
  },
  {
    kind: 'planner',
    expectFailure: true,
    extension: {
      name: 'bad-planner',
      async plan() {
        return { schemaVersion: 'brisk-aitesting.plan.v1', scenarios: [] };
      },
    },
  },
  {
    kind: 'validator',
    expectFailure: true,
    extension: {
      name: 'bad-validator',
      validate() {
        return { schemaVersion: 'brisk-aitesting.validation.v1', valid: 'yes', issues: 'none' };
      },
    },
  },
  {
    kind: 'ui-grounder',
    expectFailure: true,
    extension: {
      name: 'bad-ui-grounder',
      async ground() {
        return { grounding: { schemaVersion: 'wrong' }, artifacts: 'none' };
      },
    },
  },
  {
    kind: 'ai-provider',
    expectFailure: true,
    extension: {
      name: 'bad-ai-provider',
      async complete() {
        return { content: 'const test = () => true;' };
      },
    },
  },
];

const report = await runExtensionConformance({
  config,
  plan,
  input: { goal: 'Check extension contracts', scenarios: 1, mode: 'automatic' },
  cases: [...goodCases, ...badCases],
});

const expectedBadFailures = report.extensions
  .filter((entry) => entry.name.startsWith('bad-'))
  .map((entry) => ({ name: entry.name, status: entry.status }));

const errors = [...report.errors];
if (!report.extensions.filter((entry) => entry.name.startsWith('good-')).every((entry) => entry.status === 'passed')) {
  errors.push('a good extension failed conformance');
}
if (!expectedBadFailures.every((entry) => entry.status === 'failed')) {
  errors.push('a bad extension unexpectedly passed conformance');
}

const output = {
  schemaVersion: 'brisk-aitesting.extension-conformance-smoke.v1',
  status: errors.length === 0 ? 'passed' : 'failed',
  report,
  expectedBadFailures,
  errors,
};

console.log(JSON.stringify(output, null, 2));
if (errors.length > 0) process.exitCode = 1;
