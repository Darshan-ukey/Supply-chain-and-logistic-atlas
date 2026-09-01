import { createBriskAiTesting, defineConfig } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Contract-backed API',
    baseUrl: requiredEnv('APP_BASE_URL'),
    repoPath: process.env.APP_REPO_ROOT ?? '.',
  },
  contracts: {
    openApiPath: requiredEnv('OPENAPI_PATH'),
  },
  discovery: {
    includeRepo: true,
    includeUi: false,
    includeApi: true,
    includeContracts: true,
  },
}));

const result = await brisk.run({
  goal: 'Generate positive and negative API checks from the contract and implemented routes.',
  mode: 'api',
  scenarios: 8,
});

console.log(JSON.stringify(result.summary, null, 2));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

