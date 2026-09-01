import { createBriskAiTesting, defineConfig } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Schema checks',
    baseUrl: requiredEnv('APP_BASE_URL'),
  },
  contracts: {
    openApiPath: requiredEnv('OPENAPI_PATH'),
  },
}));

const result = await brisk.run({
  goal: 'Create schema checks for required fields, invalid types, enums, and undocumented statuses.',
  mode: 'schema',
  scenarios: 10,
});

console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

