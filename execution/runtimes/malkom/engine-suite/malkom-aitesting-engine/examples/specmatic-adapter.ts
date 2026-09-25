import { createBriskAiTesting, defineConfig, SpecmaticEngine } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Specmatic contract app',
    baseUrl: requiredEnv('APP_BASE_URL'),
  },
  contracts: {
    openApiPath: requiredEnv('OPENAPI_PATH'),
  },
  engines: [
    new SpecmaticEngine({
      strict: true,
    }),
  ],
}));

const result = await brisk.run({
  goal: 'Run contract compatibility checks against the live service.',
  mode: 'contract',
  scenarios: 1,
});

console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

