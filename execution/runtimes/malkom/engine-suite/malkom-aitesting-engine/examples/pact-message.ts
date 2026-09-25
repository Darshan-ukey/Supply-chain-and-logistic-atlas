import { createBriskAiTesting, defineConfig } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Pact message app',
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  },
  contracts: {
    pactDir: requiredEnv('PACT_DIR'),
  },
}));

const result = await brisk.run({
  goal: 'Verify message contracts from local Pact files.',
  mode: 'message',
  scenarios: 3,
  requiredTypes: ['message'],
});

console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

