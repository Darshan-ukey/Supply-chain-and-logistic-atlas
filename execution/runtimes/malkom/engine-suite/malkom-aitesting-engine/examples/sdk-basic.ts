import { createBriskAiTesting, defineConfig } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Example SaaS',
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    repoPath: process.env.APP_REPO_ROOT ?? '.',
  },
  ai: {
    provider: 'openai-compatible',
    endpoint: requiredEnv('AI_ENDPOINT'),
    model: requiredEnv('AI_MODEL'),
    apiKeyEnv: 'AI_API_KEY',
  },
  contracts: {
    openApiPath: process.env.OPENAPI_PATH ?? './openapi.json',
  },
}));

const result = await brisk.run({
  goal: 'Check login, dashboard loading, and the health API.',
  mode: 'automatic',
  scenarios: 5,
});

console.log(result.schemaVersion);
console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

