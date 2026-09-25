import { createBriskAiTesting, defineConfig } from 'brisk-aitesting';

const brisk = createBriskAiTesting(defineConfig({
  app: {
    name: 'Grounded UI app',
    baseUrl: requiredEnv('APP_BASE_URL'),
    repoPath: process.env.APP_REPO_ROOT ?? '.',
  },
  auth: {
    type: 'credentials',
    loginUrl: process.env.LOGIN_URL ?? '/login',
    username: requiredEnv('TEST_USER'),
    password: requiredEnv('TEST_PASSWORD'),
  },
  runtime: {
    artifactsDir: '.brisk-aitesting/artifacts',
    timeoutMs: 120000,
    retries: 1,
    headless: true,
    dryRun: false,
  },
}));

const result = await brisk.run({
  goal: 'Login, create a project, reject an empty project name, and confirm the project list still loads.',
  mode: 'ui',
  scenarios: 4,
  uiActionFeedback: 'when-missing',
});

console.log(result.status);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value;
}

