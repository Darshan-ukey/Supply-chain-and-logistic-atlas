import { createBriskAiTesting, defineConfig, type TestPlan } from 'brisk-aitesting';

const replayScenario = {
  id: 'replay_health_and_metrics',
  name: 'Replay health and metrics',
  type: 'replay',
  objective: 'Replay known healthy HTTP calls.',
  assertions: ['known calls still return expected statuses'],
  evidenceRequired: ['api'],
  metadata: {
    replay: {
      requests: [
        { method: 'GET', path: '/health', expectStatus: 200 },
        { method: 'GET', path: '/metrics', expectStatus: 200 },
      ],
    },
  },
} satisfies TestPlan['scenarios'][number];

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Replay app',
    baseUrl: requiredEnv('APP_BASE_URL'),
  },
}), {
  planner: {
    name: 'known-replay-planner',
    plan: (context) => ({
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode: 'replay',
      discovery: context.discovery,
      scenarios: [replayScenario],
      warnings: [],
      createdAt: new Date().toISOString(),
    }),
  },
});

const result = await brisk.run({ goal: 'Replay known HTTP traffic.', mode: 'replay', scenarios: 1 });
console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

