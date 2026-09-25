import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const labDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(labDir, '..', '..');
const composePath = resolve(labDir, 'compose.yaml');
const envPath = resolve(labDir, '.env.local');
const envPathFromProject = relative(projectDir, envPath).replaceAll('\\', '/');
const versionsPath = resolve(labDir, 'versions.json');
const runtimeDir = resolve(projectDir, '.brisk-aitesting', 'real-system-lab');
const medusaPidPath = resolve(runtimeDir, 'medusa-process.json');
const medusaStdoutPath = resolve(runtimeDir, 'medusa.stdout.log');
const medusaStderrPath = resolve(runtimeDir, 'medusa.stderr.log');
const projectName = 'brisk-aitesting-real-systems';
const requestedCommand = process.argv[2] ?? 'status';
const requestedTarget = process.argv[3] ?? 'all';
const jsonOutput = process.argv.includes('--json');

const serviceMap = {
  directus: 'directus',
  medusa: 'medusa-postgres',
  n8n: 'n8n',
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ ok: false, command: requestedCommand, error: message }, null, 2)}\n`);
  } else {
    process.stderr.write(`Real-system lab failed: ${message}\n`);
  }
  process.exitCode = 1;
});

async function main() {
  if (requestedCommand === 'doctor') return print(await doctor());
  if (requestedCommand === 'status') return print(await status());
  if (requestedCommand === 'pull') return runComposeAction('pull');
  if (requestedCommand === 'start') return runComposeAction('start');
  if (requestedCommand === 'stop') return runComposeAction('stop');
  if (requestedCommand === 'reset') return reset();
  if (requestedCommand === 'help' || requestedCommand === '--help') return help();
  throw new Error(`Unknown command "${requestedCommand}". Use help, doctor, pull, start, status, stop, or reset.`);
}

async function doctor() {
  const versions = readJson(versionsPath);
  const dockerVersion = run('docker', ['version', '--format', '{{.Server.Version}}'], { capture: true }).trim();
  const composeVersion = run('docker', ['compose', 'version', '--short'], { capture: true }).trim();
  const secretFile = {
    exists: existsSync(envPath),
    ignoredByGit: existsSync(envPath)
      ? run('git', ['check-ignore', '--quiet', '--', envPathFromProject], { cwd: projectDir, allowFailure: true }).status === 0
      : false,
  };

  const applications = versions.applications.map((application) => {
    const cloneExists = existsSync(application.clonePath);
    if (!cloneExists) return { id: application.id, cloneExists: false, matchesRecord: false };
    const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: application.clonePath, capture: true }).trim();
    const commit = run('git', ['rev-parse', 'HEAD'], { cwd: application.clonePath, capture: true }).trim();
    const dirtyCount = run('git', ['status', '--porcelain'], { cwd: application.clonePath, capture: true })
      .split(/\r?\n/u)
      .filter(Boolean).length;
    const applicationPathExists = application.applicationPath === undefined || existsSync(application.applicationPath);
    return {
      id: application.id,
      cloneExists: true,
      remote,
      commit,
      dirtyCount,
      applicationPathExists,
      matchesRecord: remote === application.officialRemote && commit === application.sourceCommit && dirtyCount === 0 && applicationPathExists,
    };
  });

  return {
    schemaVersion: 'brisk-aitesting.real-system-doctor.v1',
    ok: secretFile.exists && secretFile.ignoredByGit && applications.every((item) => item.matchesRecord),
    dockerVersion,
    composeVersion,
    secretFile,
    applications,
    limits: [
      'Doctor verifies local prerequisites and exact clean clones only.',
      'It does not prove that any application is ready or supported by brisk-aitesting.',
    ],
  };
}

async function status() {
  const [directus, medusa, n8n] = await Promise.all([
    directusStatus(),
    medusaStatus(),
    simpleHttpStatus('n8n', 'http://127.0.0.1:15678/healthz/readiness', { expectedStatus: 200 }),
  ]);
  return {
    schemaVersion: 'brisk-aitesting.real-system-readiness.v1',
    ok: directus.ready && medusa.databaseReady && medusa.applicationReady && n8n.ready,
    applications: { directus, medusa, n8n },
    limits: [
      'Ready proves only that the documented runtime readiness request succeeded.',
      'Medusa database readiness is separate from Medusa application readiness.',
      'This does not prove discovery, compilation, business scenarios, cleanup, drift, security, or packed-product support.',
    ],
  };
}

async function directusStatus() {
  const publicResult = await safeFetch('http://127.0.0.1:18055/server/health');
  if (!existsSync(envPath)) {
    return { ready: false, publicHttpStatus: publicResult.status, reason: 'Ignored .env.local is absent.' };
  }
  const environment = readEnv(envPath);
  const login = await safeFetch('http://127.0.0.1:18055/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: environment.BRISK_TEST_DIRECTUS_ADMIN_EMAIL,
      password: environment.BRISK_TEST_DIRECTUS_ADMIN_PASSWORD,
      mode: 'json',
    }),
  });
  const accessToken = login.json?.data?.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return {
      ready: false,
      publicHttpStatus: publicResult.status,
      loginHttpStatus: login.status,
      tokenPrinted: false,
      reason: login.error ?? 'Login did not return an access token.',
    };
  }
  const health = await safeFetch('http://127.0.0.1:18055/server/health', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const problemChecks = Object.entries(health.json?.checks ?? {})
    .flatMap(([name, checks]) => Array.isArray(checks) ? checks.map((check) => ({ name, status: check?.status })) : [])
    .filter((check) => check.status !== 'ok');
  const reportedStatus = health.json?.status;
  return {
    ready: health.status === 200 && (reportedStatus === 'ok' || reportedStatus === 'warn'),
    degraded: reportedStatus === 'warn',
    publicHttpStatus: publicResult.status,
    publicRefusalExpected: publicResult.status === 403,
    loginHttpStatus: login.status,
    authenticatedHealthHttpStatus: health.status,
    reportedStatus,
    problemChecks,
    releaseId: health.json?.releaseId,
    tokenPrinted: false,
    reason: health.error,
  };
}

async function medusaStatus() {
  const database = run(
    'docker',
    ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', `${projectName}-medusa-postgres-1`],
    { allowFailure: true },
  );
  const application = await simpleHttpStatus('medusa', 'http://127.0.0.1:19000/health', { expectedStatus: 200 });
  return {
    databaseReady: database.status === 0 && database.stdout.trim() === 'healthy',
    databaseContainerStatus: database.status === 0 ? database.stdout.trim() : 'not-running',
    applicationReady: application.ready,
    applicationHttpStatus: application.httpStatus,
    applicationReason: application.reason,
  };
}

async function simpleHttpStatus(id, url, { expectedStatus }) {
  const result = await safeFetch(url);
  return {
    id,
    ready: result.status === expectedStatus,
    httpStatus: result.status,
    reportedStatus: result.json?.status,
    reason: result.error,
  };
}

async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    let json;
    try {
      json = text.length > 0 ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: response.status, json };
  } catch (error) {
    return { status: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runComposeAction(action) {
  requireSecretFile();
  const services = selectedServices();
  const profiles = selectedProfiles();
  const common = ['compose', '--env-file', envPath, '-f', composePath, ...profiles];
  if (action === 'pull') run('docker', [...common, 'pull', ...services]);
  if (action === 'start') {
    run('docker', [...common, 'up', '-d', '--no-build', '--pull', 'never', ...services]);
    if (requestedTarget === 'all' || requestedTarget === 'medusa') await startMedusaApplication();
  }
  if (action === 'stop') {
    if (requestedTarget === 'all' || requestedTarget === 'medusa') await stopMedusaApplication();
    run('docker', [...common, 'stop', ...services]);
  }
  print({
    ok: true,
    command: action,
    target: requestedTarget,
    services,
    medusaApplicationManaged: requestedTarget === 'all' || requestedTarget === 'medusa',
  });
}

async function startMedusaApplication() {
  const current = await simpleHttpStatus('medusa', 'http://127.0.0.1:19000/health', { expectedStatus: 200 });
  if (current.ready) {
    if (!existsSync(medusaPidPath)) {
      throw new Error('Medusa is already ready on port 19000 but was not started by this helper. Stop that exact process before helper-owned startup.');
    }
    return;
  }
  if (existsSync(medusaPidPath)) unlinkSync(medusaPidPath);
  const versions = readJson(versionsPath);
  const applicationPath = versions.applications.find(({ id }) => id === 'medusa')?.applicationPath;
  if (typeof applicationPath !== 'string' || !existsSync(applicationPath)) {
    throw new Error('The recorded Medusa application path is absent. Complete the official application setup before starting it.');
  }
  mkdirSync(runtimeDir, { recursive: true });
  const stdout = openSync(medusaStdoutPath, 'a');
  const stderr = openSync(medusaStderrPath, 'a');
  const child = spawn('pnpm exec medusa develop', {
    cwd: applicationPath,
    env: { ...process.env, PORT: '19000' },
    detached: true,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', stdout, stderr],
  });
  closeSync(stdout);
  closeSync(stderr);
  if (child.pid === undefined) throw new Error('Medusa process did not return a process identity.');
  writeFileSync(medusaPidPath, `${JSON.stringify({ pid: child.pid, applicationPath, port: 19000 }, null, 2)}\n`, { mode: 0o600 });
  child.unref();
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await delay(2000);
    const result = await simpleHttpStatus('medusa', 'http://127.0.0.1:19000/health', { expectedStatus: 200 });
    if (result.ready) return;
  }
  await stopMedusaApplication();
  throw new Error(`Medusa did not become ready within 120 seconds. Inspect ${medusaStderrPath} without copying secrets.`);
}

async function stopMedusaApplication() {
  if (!existsSync(medusaPidPath)) {
    const current = await simpleHttpStatus('medusa', 'http://127.0.0.1:19000/health', { expectedStatus: 200 });
    if (current.ready) throw new Error('Medusa is ready but is not owned by this helper, so it was not stopped.');
    return;
  }
  const record = readJson(medusaPidPath);
  if (!Number.isInteger(record.pid) || record.pid < 1 || record.port !== 19000) {
    throw new Error('Medusa process record is malformed; no process was stopped.');
  }
  if (process.platform === 'win32') {
    run('taskkill', ['/PID', String(record.pid), '/T', '/F'], { allowFailure: true });
  } else {
    try {
      process.kill(-record.pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
  unlinkSync(medusaPidPath);
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const result = await simpleHttpStatus('medusa', 'http://127.0.0.1:19000/health', { expectedStatus: 200 });
    if (!result.ready) return;
    await delay(500);
  }
  throw new Error('Helper-owned Medusa process did not stop within 10 seconds.');
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function reset() {
  if (!process.argv.includes('--confirm-disposable-data')) {
    throw new Error('Reset deletes all three disposable lab data volumes. Add --confirm-disposable-data to confirm the exact lab scope.');
  }
  requireSecretFile();
  if (existsSync(medusaPidPath)) {
    throw new Error('Stop the helper-owned Medusa application before reset so process and database state cannot diverge.');
  }
  run('docker', [
    'compose', '--env-file', envPath, '-f', composePath,
    '--profile', 'directus', '--profile', 'medusa', '--profile', 'n8n',
    'down', '--volumes', '--remove-orphans',
  ]);
  print({ ok: true, command: 'reset', project: projectName, deleted: 'disposable lab containers, network, and named data volumes' });
}

function selectedServices() {
  if (requestedTarget === 'all') return Object.values(serviceMap);
  const service = serviceMap[requestedTarget];
  if (!service) throw new Error(`Unknown target "${requestedTarget}". Use directus, medusa, n8n, or all.`);
  return [service];
}

function selectedProfiles() {
  const profiles = requestedTarget === 'all' ? Object.keys(serviceMap) : [requestedTarget];
  return profiles.flatMap((profile) => ['--profile', profile]);
}

function requireSecretFile() {
  if (!existsSync(envPath)) throw new Error(`Missing ignored local secret file: ${envPath}`);
}

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator <= 0) throw new Error(`Malformed local environment line for key prefix "${line.slice(0, 12)}".`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function run(command, args, { cwd = labDir, capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: capture || allowFailure ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  if (capture) return result.stdout ?? '';
  return result;
}

function print(value) {
  writeFileSync(1, `${JSON.stringify(value, null, 2)}\n`);
}

function help() {
  process.stdout.write(`Real-system lab\n\n`);
  process.stdout.write(`  node lab.mjs doctor --json\n`);
  process.stdout.write(`  node lab.mjs pull [directus|medusa|n8n|all]\n`);
  process.stdout.write(`  node lab.mjs start [directus|medusa|n8n|all]\n`);
  process.stdout.write(`  node lab.mjs status --json\n`);
  process.stdout.write(`  node lab.mjs stop [directus|medusa|n8n|all]\n`);
  process.stdout.write(`  node lab.mjs reset --confirm-disposable-data\n`);
}
