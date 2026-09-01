import { createBriskAiTesting, defineConfig, SchemathesisEngine } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Schemathesis fuzzing app',
    baseUrl: requiredEnv('APP_BASE_URL'),
  },
  contracts: {
    openApiPath: requiredEnv('OPENAPI_PATH'),
  },
  engines: [
    new SchemathesisEngine({
      checks: ['not_a_server_error', 'status_code_conformance', 'response_schema_conformance'],
      maxExamples: 20,
    }),
  ],
}));

const result = await brisk.run({
  goal: 'Fuzz the OpenAPI contract and catch invalid status codes or response shapes.',
  mode: 'schema',
  scenarios: 1,
});

console.log(result.summary);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

