import { createBriskAiTesting, defineConfig, type TestPlan } from 'brisk-aitesting';

const messageScenario = {
  id: 'publish_order_event',
  name: 'Publish order event',
  type: 'message',
  objective: 'Publish a message and verify the subscriber can read it.',
  target: { schema: './asyncapi.json', channel: 'orders.created' },
  assertions: ['message is published', 'subscriber receives the message'],
  evidenceRequired: ['message', 'api'],
  metadata: {
    liveMessage: {
      publish: {
        method: 'POST',
        path: '/test-hooks/messages/orders.created',
        body: { orderId: 'order-123', status: 'created' },
        expectStatus: 202,
      },
      verify: {
        method: 'GET',
        path: '/test-hooks/subscribers/orders.created/order-123',
        expectStatus: 200,
        expectJson: { status: 'created' },
      },
      poll: { attempts: 5, intervalMs: 500 },
    },
  },
} satisfies TestPlan['scenarios'][number];

const brisk = createBriskAiTesting(defineConfig({
  app: { name: 'Message app', baseUrl: requiredEnv('APP_BASE_URL') },
  contracts: { asyncApiPath: process.env.ASYNCAPI_PATH ?? './asyncapi.json' },
}), {
  planner: fixedScenarioPlanner(messageScenario),
});

const result = await brisk.run({ goal: 'Publish and verify an order message.', mode: 'message', scenarios: 1 });
console.log(result.status);

function fixedScenarioPlanner(scenario: TestPlan['scenarios'][number]) {
  return {
    name: 'fixed-message-planner',
    plan: (context: Parameters<NonNullable<Parameters<typeof createBriskAiTesting>[1]>['planner']['plan']>[0]) => ({
      schemaVersion: 'brisk-aitesting.plan.v1',
      runId: context.runId,
      goal: context.input.goal,
      mode: 'message',
      discovery: context.discovery,
      scenarios: [scenario],
      warnings: [],
      createdAt: new Date().toISOString(),
    }),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

