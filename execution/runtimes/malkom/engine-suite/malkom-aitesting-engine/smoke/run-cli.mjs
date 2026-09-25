import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const workDir = join(packageDir, '.brisk-aitesting-cli-smoke');

const server = createServer((request, response) => {
  if (request.url === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('CLI smoke server did not expose a port');

try {
  const configPath = join(workDir, 'brisk-aitesting.config.mjs');
  const outputPath = join(workDir, 'cli-output-result.json');
  const contractPath = join(workDir, 'openapi.json');
  await writeFile(contractPath, JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'CLI smoke API', version: '1.0.0' },
    paths: {
      '/api/health': {
        get: {
          operationId: 'getHealth',
          responses: {
            200: {
              description: 'Healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok'],
                    properties: { ok: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, null, 2), 'utf8');
  await writeFile(configPath, cliSmokeConfig(address.port, workDir, contractPath), 'utf8');

  const success = await runCli([
    'run',
    '--config',
    configPath,
    '--goal',
    'CLI smoke health API',
    '--scenarios',
    '1',
    '--json',
    '--output',
    outputPath,
  ]);

  const errors = [];
  const starterDir = join(workDir, 'starter');
  await mkdir(starterDir, { recursive: true });
  await mkdir(join(starterDir, 'node_modules'), { recursive: true });
  await symlink(packageDir, join(starterDir, 'node_modules', 'brisk-aitesting'), 'junction');
  const starterInit = await runCli(['init', '--base-url', `http://127.0.0.1:${address.port}`, '--app-name', 'CLI starter app'], starterDir);
  if (starterInit.code !== 0) errors.push(`expected starter init exit 0, got ${starterInit.code}: ${starterInit.stderr}`);
  const starterConfigPath = join(starterDir, 'brisk-aitesting.config.mjs');
  const starterEnvironmentPath = join(starterDir, '.env.brisk-aitesting.example');
  const starterConfigText = await readFile(starterConfigPath, 'utf8');
  const starterEnvironmentText = await readFile(starterEnvironmentPath, 'utf8');
  if (!starterConfigText.includes('defineHostConfig')) errors.push('starter config did not use the minimal host API');
  if (!starterEnvironmentText.includes('BRISK_AITESTING_APP_NAME=CLI starter app')) errors.push('starter environment example did not include the application name');
  if (!starterEnvironmentText.includes('BRISK_AITESTING_EXECUTION=preview')) errors.push('starter environment example did not default to preview');
  if (/^(?!#).*API_KEY=.*replace-me/m.test(starterEnvironmentText)) errors.push('starter environment example activated a placeholder AI key');
  await writeFile(starterEnvironmentPath, `${starterEnvironmentText}\n# user-owned-line\n`, 'utf8');
  const secondInit = await runCli(['init', '--base-url', 'http://should-not-overwrite.example', '--app-name', 'Must not overwrite'], starterDir);
  if (secondInit.code !== 0) errors.push(`expected repeated init exit 0, got ${secondInit.code}: ${secondInit.stderr}`);
  if ((await readFile(starterConfigPath, 'utf8')) !== starterConfigText) errors.push('repeated init overwrote the existing host config');
  if (!(await readFile(starterEnvironmentPath, 'utf8')).includes('# user-owned-line')) errors.push('repeated init overwrote the existing environment example');
  const starterDoctor = await runCli(['doctor', '--json'], starterDir);
  if (starterDoctor.code !== 0) errors.push(`expected starter doctor exit 0, got ${starterDoctor.code}: ${starterDoctor.stderr}`);
  const starterPreview = await runCli(['run', '--goal', 'API health endpoint', '--scenarios', '1', '--mode', 'api', '--json'], starterDir);
  if (starterPreview.code !== 1) errors.push(`expected safe starter preview exit 1 because nothing executed, got ${starterPreview.code}: ${starterPreview.stderr}`);
  if (starterPreview.stdout.trim().length > 0) {
    const starterPreviewParsed = parseStdoutJson(starterPreview.stdout);
    if (starterPreviewParsed.schemaVersion !== 'brisk-aitesting.cli-result.v1' || starterPreviewParsed.status !== 'skipped') errors.push('starter preview did not report an honest non-executed result');
  } else {
    errors.push(`starter preview did not print JSON stdout: ${starterPreview.stderr}`);
  }
  await writeFile(join(starterDir, '.env.brisk-aitesting'), [
    'BRISK_AITESTING_EXECUTION=enabled',
  ].join('\n'), 'utf8');
  const starterRun = await runCli(['run', '--goal', 'API health endpoint', '--scenarios', '1', '--mode', 'api', '--json'], starterDir);
  if (starterRun.code !== 0) errors.push(`expected explicitly enabled starter run exit 0, got ${starterRun.code}: ${starterRun.stderr}\n${starterRun.stdout}`);
  if (starterRun.stdout.trim().length > 0) {
    const starterParsed = parseStdoutJson(starterRun.stdout);
    if (starterParsed.schemaVersion !== 'brisk-aitesting.cli-result.v1' || starterParsed.status !== 'passed') errors.push('enabled starter run did not return a passed CLI result');
  }

  const environmentOnlyDir = join(workDir, 'environment-only');
  await mkdir(join(environmentOnlyDir, 'node_modules'), { recursive: true });
  await symlink(packageDir, join(environmentOnlyDir, 'node_modules', 'brisk-aitesting'), 'junction');
  await writeFile(join(environmentOnlyDir, '.env.brisk-aitesting'), [
    'BRISK_AITESTING_APP_NAME=Environment-only CLI host',
    `BRISK_AITESTING_BASE_URL=http://127.0.0.1:${address.port}`,
    'BRISK_AITESTING_EXECUTION=enabled',
    `BRISK_AITESTING_OPENAPI_PATH=${contractPath}`,
  ].join('\n'), 'utf8');
  const environmentDoctor = await runCli(['doctor', '--json'], environmentOnlyDir);
  if (environmentDoctor.code !== 0) errors.push(`expected environment-only doctor exit 0, got ${environmentDoctor.code}: ${environmentDoctor.stderr}`);
  const environmentRun = await runCli(['run', '--goal', 'API health endpoint', '--scenarios', '1', '--mode', 'api', '--json'], environmentOnlyDir);
  if (environmentRun.code !== 0) errors.push(`expected environment-only run exit 0, got ${environmentRun.code}: ${environmentRun.stderr}\n${environmentRun.stdout}`);

  if (success.code !== 0) errors.push(`expected success exit 0, got ${success.code}: ${success.stderr}`);
  const parsed = parseStdoutJson(success.stdout);
  if (parsed.schemaVersion !== 'brisk-aitesting.cli-result.v1') errors.push('wrong CLI JSON schema');
  if (parsed.status !== 'passed') errors.push(`expected CLI status passed, got ${parsed.status}`);
  if (parsed.summary?.total !== 1 || parsed.summary?.passed !== 1) errors.push('CLI summary did not report 1/1 passed');
  if (parsed.resultPath !== outputPath) errors.push('CLI JSON did not report custom output path');
  const written = JSON.parse(await readFile(outputPath, 'utf8'));
  if (written.schemaVersion !== 'brisk-aitesting.result.v1') errors.push('CLI output file missing result schema');
  const inspected = await runCli(['inspect', '--result', outputPath, '--json']);
  if (inspected.code !== 0) errors.push(`expected inspect exit 0, got ${inspected.code}: ${inspected.stderr}`);
  const inspectedParsed = parseStdoutJson(inspected.stdout);
  if (inspectedParsed.schemaVersion !== 'brisk-aitesting.inspect-result.v1') errors.push('wrong inspect JSON schema');
  if (inspectedParsed.runId !== written.runId) errors.push('inspect output did not report the inspected run id');

  const usage = await runCli(['run', '--config', configPath, '--scenarios', '0']);
  if (usage.code !== 2) errors.push(`expected usage exit 2, got ${usage.code}`);
  if (!usage.stderr.includes('--scenarios must be a positive integer')) errors.push('usage error did not explain invalid scenarios');

  const cleanTarget = join(workDir, 'custom-artifacts');
  await mkdir(cleanTarget, { recursive: true });
  const cleanDryRun = await runCli(['clean', '--artifacts-dir', cleanTarget, '--dry-run', '--json']);
  if (cleanDryRun.code !== 0) errors.push(`expected clean dry-run exit 0, got ${cleanDryRun.code}: ${cleanDryRun.stderr}`);
  const cleanParsed = parseStdoutJson(cleanDryRun.stdout);
  if (cleanParsed.schemaVersion !== 'brisk-aitesting.clean-result.v1') errors.push('wrong clean JSON schema');
  if (cleanParsed.dryRun !== true || cleanParsed.removed !== 0) errors.push('clean dry-run did not report dryRun true and removed 0');
  if (!Array.isArray(cleanParsed.targets) || !cleanParsed.targets.some((target) => target.path === cleanTarget && target.existed === true && target.action === 'would-remove')) {
    errors.push('clean dry-run did not include custom artifact target');
  }

  if (errors.length > 0) {
    console.error(JSON.stringify({ status: 'failed', errors, success, usage }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status: 'passed',
      cliSchema: parsed.schemaVersion,
      inspectSchema: inspectedParsed.schemaVersion,
      cleanSchema: cleanParsed.schemaVersion,
      exitCode: success.code,
      usageExitCode: usage.code,
      resultPath: outputPath,
    }, null, 2));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function cliSmokeConfig(port, artifactsRoot, contractPath) {
  return `import { defineConfig } from '../dist/index.js';

export default defineConfig({
  app: {
    name: 'CLI smoke app',
    baseUrl: 'http://127.0.0.1:${port}',
    env: 'local',
  },
  contracts: { openApiPath: ${JSON.stringify(contractPath)} },
  aiProvider: {
    name: 'cli-smoke-provider',
    async complete() {
      return {
        content: JSON.stringify({
          warnings: [],
          scenarios: [{
            id: 'cli_smoke_health_api',
            name: 'CLI smoke health API',
            objective: 'Health endpoint responds through the CLI.',
            actions: [{
              id: 'health',
              verb: 'get',
              resource: 'health',
              capability: 'api.http',
              expectedOutcomes: []
            }],
            invariants: [],
            evidenceRequired: ['observable health response'],
            cleanup: 'isolated'
          }]
        })
      };
    }
  },
  runtime: {
    artifactsDir: ${JSON.stringify(join(artifactsRoot, 'artifacts'))},
    timeoutMs: 30000,
    retries: 0,
    headless: true,
    dryRun: false,
  },
  discovery: {
    includeRepo: false,
    includeUi: false,
    includeApi: true,
    includeContracts: true,
    apiRoutes: [{ method: 'GET', path: '/api/health' }],
  },
  security: {
    networkPolicy: 'localhost-only',
    allowedHosts: ['127.0.0.1', 'localhost'],
    redactSecrets: true,
  },
});
`;
}

function runCli(args, cwd = packageDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(packageDir, 'dist', 'cli.js'), ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseStdoutJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`CLI stdout did not contain JSON: ${stdout}`);
  return JSON.parse(stdout.slice(start, end + 1));
}
