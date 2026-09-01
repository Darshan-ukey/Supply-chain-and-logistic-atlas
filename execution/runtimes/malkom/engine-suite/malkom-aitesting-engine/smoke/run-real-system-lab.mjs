import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const labDir = resolve(projectDir, 'reference-apps', 'real-systems');
const labPath = resolve(labDir, 'lab.mjs');
const envPath = resolve(labDir, '.env.local');
const composePath = resolve(labDir, 'compose.yaml');
const applicationsPath = resolve(labDir, 'applications.json');

const checks = [];
const expectedApplicationIds = ['directus', 'medusa', 'n8n'];

function check(category, name, condition, observed) {
  checks.push({ category, name, passed: Boolean(condition), observed });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectDir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'pipe',
  });
  if (result.error) throw result.error;
  return result;
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} did not return JSON. Exit ${result.status}; stderr: ${result.stderr.trim()}`);
  }
}

const manifest = JSON.parse(readFileSync(applicationsPath, 'utf8'));
check('common-manifest', 'common application description uses the recorded format', manifest.schemaVersion === 'brisk-aitesting.application-under-test-manifest.v1', manifest.schemaVersion);
check('common-manifest', 'common application description contains exactly three applications', manifest.applications?.length === 3, manifest.applications?.length);
check('common-manifest', 'common application description uses the expected application identities', JSON.stringify(manifest.applications?.map(({ id }) => id)) === JSON.stringify(expectedApplicationIds), manifest.applications?.map(({ id }) => id));
for (const application of manifest.applications ?? []) {
  let baseAddress;
  try {
    baseAddress = new URL(application.baseAddress);
  } catch {
    baseAddress = undefined;
  }
  check('common-manifest', `${application.id} has one valid loopback base address`, baseAddress?.protocol === 'http:' && baseAddress.hostname === '127.0.0.1', application.baseAddress);
  check('common-manifest', `${application.id} limits requests to its declared loopback host`, JSON.stringify(application.allowedHosts) === JSON.stringify(['127.0.0.1']), application.allowedHosts);
  check('common-manifest', `${application.id} stores authentication references rather than values`, Array.isArray(application.authentication?.secretReferences) && application.authentication.secretReferences.every((name) => /^BRISK_TEST_[A-Z0-9_]+$/.test(name)), application.authentication?.state);
  check('common-manifest', `${application.id} declares an isolated service and data store`, application.isolationBoundary?.project === 'brisk-aitesting-real-systems' && typeof application.isolationBoundary?.service === 'string' && application.isolationBoundary?.dataStores?.length > 0, application.isolationBoundary?.service);
  check('common-manifest', `${application.id} cleanup is limited to receipted test-created data`, application.cleanupPolicy?.scope === 'test-created-only' && application.cleanupPolicy?.receiptRequired === true && application.cleanupPolicy?.unknownMutationReplay === 'forbidden' && application.cleanupPolicy?.residualState === 'report', application.cleanupPolicy);
  check('common-manifest', `${application.id} readiness has an exact path and accepted response`, application.readiness?.method === 'GET' && application.readiness?.path?.startsWith('/') && application.readiness?.acceptedHttpStatuses?.includes(200), application.readiness?.path);
  check('common-manifest', `${application.id} declares authoritative information sources`, application.authoritativeEvidenceSources?.length >= 3 && application.authoritativeEvidenceSources.every(({ kind, location }) => ['source', 'runtime-metadata', 'runtime-observation'].includes(kind) && typeof location === 'string' && location.length > 0), application.authoritativeEvidenceSources?.length);
  check('common-manifest', `${application.id} declares foundation-level capability labels`, application.capabilityLabels?.length >= 3 && application.capabilityLabels.every((label) => /^[a-z][a-z0-9-]+$/.test(label)), application.capabilityLabels?.length);
}

const doctorResult = run(process.execPath, [labPath, 'doctor', '--json']);
const doctor = parseJson(doctorResult, 'Lab diagnosis');
check('diagnosis', 'diagnosis command succeeds', doctorResult.status === 0, doctorResult.status);
check('diagnosis', 'diagnosis uses the recorded format', doctor.schemaVersion === 'brisk-aitesting.real-system-doctor.v1', doctor.schemaVersion);
check('diagnosis', 'diagnosis reports its combined result honestly', doctor.ok === true, doctor.ok);
check('secret-safety', 'local secret file exists', doctor.secretFile?.exists === true, doctor.secretFile?.exists);
check('secret-safety', 'local secret file is excluded from Git', doctor.secretFile?.ignoredByGit === true, doctor.secretFile?.ignoredByGit);
check('clone-integrity', 'exactly three applications are checked', doctor.applications?.length === 3, doctor.applications?.length);
check(
  'clone-integrity',
  'the expected application names are checked',
  JSON.stringify(doctor.applications?.map(({ id }) => id)) === JSON.stringify(expectedApplicationIds),
  doctor.applications?.map(({ id }) => id),
);
for (const application of doctor.applications ?? []) {
  check('clone-integrity', `${application.id} clone exists`, application.cloneExists === true, application.cloneExists);
  check('clone-integrity', `${application.id} recorded application path exists when one is required`, application.applicationPathExists === true, application.applicationPathExists);
  check('clone-integrity', `${application.id} clone matches the recorded official source`, application.matchesRecord === true, application.matchesRecord);
  check('clone-integrity', `${application.id} clone has no local changes`, application.dirtyCount === 0, application.dirtyCount);
}

const statusResult = run(process.execPath, [labPath, 'status', '--json']);
const status = parseJson(statusResult, 'Lab readiness');
const { directus, medusa, n8n } = status.applications ?? {};
const expectedOverall = Boolean(directus?.ready && medusa?.databaseReady && medusa?.applicationReady && n8n?.ready);
check('readiness-reporting', 'readiness command succeeds', statusResult.status === 0, statusResult.status);
check('readiness-reporting', 'readiness uses the recorded format', status.schemaVersion === 'brisk-aitesting.real-system-readiness.v1', status.schemaVersion);
check('readiness-reporting', 'combined readiness requires all three applications, including the Medusa app', status.ok === expectedOverall, { reported: status.ok, expected: expectedOverall });
check('directus-readiness', 'Directus is ready', directus?.ready === true, directus?.ready);
check('directus-readiness', 'Directus refuses anonymous health details as expected', directus?.publicHttpStatus === 403 && directus?.publicRefusalExpected === true, directus?.publicHttpStatus);
check('directus-readiness', 'Directus accepts the isolated administrator login', directus?.loginHttpStatus === 200, directus?.loginHttpStatus);
check('directus-readiness', 'Directus returns authenticated health', directus?.authenticatedHealthHttpStatus === 200, directus?.authenticatedHealthHttpStatus);
check('directus-readiness', 'Directus reports ready or ready-with-warning', ['ok', 'warn'].includes(directus?.reportedStatus), directus?.reportedStatus);
check('directus-readiness', 'Directus warning details remain visible', Array.isArray(directus?.problemChecks), directus?.problemChecks);
check('directus-readiness', 'Directus release is pinned', directus?.releaseId === '12.2.0', directus?.releaseId);
check('secret-safety', 'Directus login token is not printed', directus?.tokenPrinted === false, directus?.tokenPrinted);
check('medusa-readiness', 'Medusa database is healthy', medusa?.databaseReady === true && medusa?.databaseContainerStatus === 'healthy', medusa?.databaseContainerStatus);
check('medusa-readiness', 'Medusa app readiness is reported separately', typeof medusa?.applicationReady === 'boolean', medusa?.applicationReady);
check('n8n-readiness', 'n8n is ready', n8n?.ready === true, n8n?.ready);
check('n8n-readiness', 'n8n readiness address returns HTTP 200', n8n?.httpStatus === 200, n8n?.httpStatus);
check('n8n-readiness', 'n8n reports ok', n8n?.reportedStatus === 'ok', n8n?.reportedStatus);
check('limits', 'three readiness limits are stated', status.limits?.length === 3, status.limits?.length);

const refusedResetResult = run(process.execPath, [labPath, 'reset', '--json']);
const refusedReset = parseJson(refusedResetResult, 'Unconfirmed reset');
check('reset-safety', 'reset without explicit confirmation is refused', refusedResetResult.status === 1 && refusedReset.ok === false, refusedResetResult.status);
check('reset-safety', 'reset refusal explains the required confirmation', refusedReset.error?.includes('--confirm-disposable-data'), refusedReset.error);

const composeResult = run('docker', [
  'compose', '--env-file', envPath, '-f', composePath,
  '--profile', 'directus', '--profile', 'medusa', '--profile', 'n8n',
  'config', '--quiet',
]);
check('configuration', 'the three-application setup file is valid', composeResult.status === 0, composeResult.status);

const failures = checks.filter(({ passed }) => !passed);
const counts = Object.fromEntries(
  [...new Set(checks.map(({ category }) => category))]
    .map((category) => [category, checks.filter((item) => item.category === category).length]),
);
const report = {
  schemaVersion: 'brisk-aitesting.real-system-lab-proof.v1',
  proofClass: 'real-system-readiness',
  applications: expectedApplicationIds,
  counts: {
    checks: checks.length,
    passed: checks.length - failures.length,
    failures: failures.length,
    skips: 0,
    categories: counts,
  },
  observedReadiness: {
    overall: status.ok,
    directus: directus?.ready,
    medusaDatabase: medusa?.databaseReady,
    medusaApplication: medusa?.applicationReady,
    n8n: n8n?.ready,
  },
  failures,
  limits: [
    'This proves local clone integrity, setup safety, and current readiness reporting only.',
    'A healthy database is not counted as a ready Medusa application.',
    'It does not prove discovery, compilation, business scenarios, cleanup execution, security, or packed-product support.',
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
