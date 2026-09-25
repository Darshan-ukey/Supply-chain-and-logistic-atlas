import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createBriskAiTesting,
  defineConfig,
} from '../dist/index.js';

const artifactsDir = resolve('.brisk-aitesting-reliability');
await rm(artifactsDir, { recursive: true, force: true });

const discovery = (runId) => ({
  schemaVersion: 'brisk-aitesting.discovery.v1',
  app: { name: 'Reliability fixture', baseUrl: 'http://127.0.0.1:1' },
  uiRoutes: [],
  apiRoutes: [{ method: 'GET', path: '/api/health', source: 'runtime', confidence: 1 }],
  contracts: [],
  repoSignals: [],
  warnings: [],
  createdAt: new Date().toISOString(),
});

const scenario = {
  id: 'engine_boundary',
  name: 'Engine exception is contained',
  type: 'api',
  objective: 'Prove an engine exception becomes a failed test verdict.',
  target: { method: 'GET', path: '/api/health', sourceOfTruth: 'observed' },
  assertions: ['engine boundary completes'],
  evidenceRequired: ['api'],
};

const planner = {
  name: 'reliability-planner',
  async plan(context) {
    return {
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode: 'automatic',
      scenarios: [scenario],
      discovery: context.discovery,
      warnings: [],
      createdAt: new Date().toISOString(),
    };
  },
};

const config = defineConfig({
  app: { name: 'Reliability fixture', baseUrl: 'http://127.0.0.1:1' },
  runtime: { artifactsDir, timeoutMs: 1000, retries: 0, headless: true, dryRun: false },
});

const throwingEngine = {
  name: 'throwing-engine',
  type: 'api',
  canRun(candidate) {
    return candidate.type === 'api';
  },
  async run() {
    throw new Error('synthetic engine crash secret=should-not-leak');
  },
};

const tester = createBriskAiTesting(config, {
  discoverer: { name: 'fixture-discoverer', async discover(context) { return discovery(context.runId); } },
  planner,
  engines: [throwingEngine],
});
tester.onEvent(() => {
  throw new Error('observer must not break run');
});

const interruptedRunId = 'run_interrupted_fixture';
const interruptedDir = resolve(artifactsDir, interruptedRunId);
await mkdir(interruptedDir, { recursive: true });
await writeFile(resolve(interruptedDir, 'run.meta.json'), JSON.stringify({
  schemaVersion: 'brisk-aitesting.run-meta.v1',
  runId: interruptedRunId,
  goal: 'Recover interrupted fixture',
  app: { name: 'Reliability fixture', baseUrl: 'http://127.0.0.1:1' },
  startedAt: new Date().toISOString(),
}));
await writeFile(resolve(interruptedDir, 'run.journal.jsonl'), `${JSON.stringify({
  schemaVersion: 'brisk-aitesting.run-journal-entry.v1',
  runId: interruptedRunId,
  sequence: 1,
  stage: 'execution',
  status: 'started',
  createdAt: new Date().toISOString(),
})}\n`);

const result = await tester.run({ goal: 'Contain engine failure', scenarios: 1, scenarioCountPolicy: 'exact' });
const failures = [];
if (result.outcome.status !== 'completed_with_diagnostics') failures.push('run outcome did not contain diagnostics');
if (result.tests.length !== 1 || result.tests[0]?.status !== 'failed') failures.push('accepted test did not end failed');
if (result.tests[0]?.failureCategory !== 'engine_internal') failures.push('engine failure category is missing');
if (!result.outcome.issues.some((entry) => entry.code === 'ENGINE_EXCEPTION')) failures.push('engine exception issue is missing');
if (JSON.stringify(result).includes('should-not-leak')) failures.push('diagnostic secret was not redacted');

const saved = JSON.parse(await readFile(resolve(artifactsDir, result.runId, 'result.json'), 'utf8'));
if (JSON.stringify(saved) !== JSON.stringify(result)) failures.push('returned result differs from atomically saved result');
const journal = await readFile(resolve(artifactsDir, result.runId, 'run.journal.jsonl'), 'utf8');
if (!journal.includes('"stage":"completed"')) failures.push('journal has no completed transition');
const recovered = JSON.parse(await readFile(resolve(interruptedDir, 'result.json'), 'utf8'));
if (recovered.outcome?.status !== 'recovered' || !recovered.outcome?.issues?.some((entry) => entry.code === 'INTERRUPTED_RUN_RECOVERED')) {
  failures.push('interrupted run was not recovered on the next invocation');
}

const discoveryFailureTester = createBriskAiTesting(config, {
  discoverer: { name: 'broken-discoverer', async discover() { throw new Error('discovery exploded'); } },
  planner,
  engines: [throwingEngine],
});
const discoveryFailure = await discoveryFailureTester.run({ goal: 'Contain discovery failure' });
if (discoveryFailure.tests.length !== 0) failures.push('discovery failure fabricated a test');
if (discoveryFailure.outcome.status !== 'completed_with_diagnostics') failures.push('discovery failure did not complete with diagnostics');

const invalidInput = await tester.run({ goal: '' });
if (invalidInput.tests.length !== 0 || !invalidInput.outcome.issues.some((entry) => entry.code === 'RUN_GOAL_REQUIRED')) {
  failures.push('invalid input did not return a structured completed outcome');
}

const timeoutConfig = defineConfig({
  app: { name: 'Planner timeout fixture', baseUrl: 'http://127.0.0.1:1' },
  runtime: { artifactsDir, timeoutMs: 20, retries: 0, headless: true, dryRun: false },
});
const planningTimeoutTester = createBriskAiTesting(timeoutConfig, {
  discoverer: { name: 'fixture-discoverer', async discover(context) { return discovery(context.runId); } },
  planner: { name: 'slow-planner', async plan() { await new Promise((resolveDelay) => setTimeout(resolveDelay, 100)); return undefined; } },
  engines: [throwingEngine],
});
const planningTimeout = await planningTimeoutTester.run({ goal: 'Expose a planning timeout honestly' });
if (planningTimeout.status !== 'error') failures.push(`planning timeout status was ${planningTimeout.status}, expected error`);
if (planningTimeout.verdict !== 'failed') failures.push(`planning timeout verdict was ${planningTimeout.verdict}, expected failed`);
if (planningTimeout.summary.total !== 0 || planningTimeout.summary.errors !== 1) failures.push('planning timeout summary did not retain zero tests plus one run-level error');
if (!planningTimeout.outcome.issues.some((entry) => entry.code === 'STAGE_TIMEOUT' && entry.stage === 'planning')) failures.push('planning timeout issue is missing');
if (!planningTimeout.diagnosis.some((entry) => entry.reason.includes('Planning timed out.'))) failures.push('planning timeout diagnosis is missing');
if (planningTimeout.tests.length !== 0) failures.push('planning timeout fabricated an executed test');
if (planningTimeout.status === 'skipped') failures.push('planning timeout was incorrectly reported as skipped');

console.log(JSON.stringify({
  status: failures.length === 0 ? 'passed' : 'failed',
  checks: 20,
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
