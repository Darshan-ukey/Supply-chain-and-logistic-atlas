import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const manifestPath = join(packageDir, 'adapters', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
const indexTypes = await readFile(join(packageDir, 'dist', 'index.d.ts'), 'utf8');
const indexJs = await readFile(join(packageDir, 'dist', 'index.js'), 'utf8');

const errors = [];

if (manifest.schemaVersion !== 'brisk-aitesting.adapter-manifest.v1') errors.push('wrong adapter manifest schema');
if (!Array.isArray(manifest.adapters)) errors.push('adapter manifest must contain adapters array');
if (
  !Array.isArray(packageJson.files)
  || !packageJson.files.some((entry) => entry === 'adapters' || entry === 'adapters/manifest.json')
) {
  errors.push('package.json files must include the adapter manifest');
}

for (const adapter of manifest.adapters ?? []) {
  checkString(adapter, 'id');
  checkString(adapter, 'name');
  checkString(adapter, 'status');
  if (adapter.status !== 'built') continue;

  requireFile(adapter.source, `${adapter.id} source file`);
  requireFile(adapter.smokeFile, `${adapter.id} smoke file`);
  requireFile(adapter.workflow, `${adapter.id} workflow`);
  requireFile(adapter.referenceApp, `${adapter.id} reference app`);
  requirePackageScript(adapter.smokeScript, `${adapter.id} smoke script`);
  requirePackageScript(adapter.coverageScript, `${adapter.id} coverage script`);
  if (!Array.isArray(adapter.docs) || adapter.docs.length === 0) errors.push(`${adapter.id} must declare docs`);
  for (const docPath of adapter.docs ?? []) requireFile(docPath, `${adapter.id} doc`);
  await requireText(join(packageDir, adapter.source), adapter.runtimeExport, `${adapter.id} source runtime export`);
  await requireText(join(packageDir, adapter.smokeFile), adapter.conformance, `${adapter.id} smoke conformance proof`);
  await requireText(join(packageDir, adapter.smokeFile), adapter.evidenceSchema, `${adapter.id} smoke evidence schema`);
  await requireText(join(packageDir, adapter.smokeFile), 'coverage missing', `${adapter.id} smoke coverage assertions`);
  await requireText(join(packageDir, adapter.workflow), adapter.smokeScript, `${adapter.id} workflow runs smoke`);
  await requireText(join(packageDir, 'README.md'), adapter.runtimeExport, `${adapter.id} README runtime export`);
  await requireText(join(packageDir, 'docs', 'ARCHITECTURE.md'), adapter.evidenceSchema, `${adapter.id} architecture evidence schema`);
  await requireText(join(packageDir, 'docs', 'STATUS.md'), adapter.smokeSchema, `${adapter.id} status smoke schema`);
  await requireText(join(packageDir, 'docs', 'ROADMAP.md'), adapter.name.split(' ')[0], `${adapter.id} roadmap mention`);
  if (!indexTypes.includes(adapter.typeExport)) errors.push(`${adapter.id} missing type export ${adapter.typeExport}`);
  if (!indexTypes.includes(adapter.runtimeExport) && !indexJs.includes(adapter.runtimeExport)) errors.push(`${adapter.id} missing runtime export ${adapter.runtimeExport}`);

  const minimums = adapter.coverageMinimums ?? {};
  for (const [key, value] of Object.entries(minimums)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
      errors.push(`${adapter.id} coverageMinimums.${key} must be a positive number`);
    }
  }
  for (const key of ['events', 'selectedOperations', 'successfulScenarios', 'artifacts']) {
    if (typeof minimums[key] !== 'number') errors.push(`${adapter.id} coverageMinimums.${key} is required`);
  }
}

const status = errors.length === 0 ? 'passed' : 'failed';
console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.adapter-readiness.v1',
  status,
  proofClass: 'file-presence-only',
  adapters: manifest.adapters?.length ?? 0,
  builtAdapters: manifest.adapters?.filter((adapter) => adapter.status === 'built').length ?? 0,
  executionProof: {
    'pact-message': 'executed by smoke:pact inside smoke:ci',
    'schemathesis-openapi-fuzz': 'executed only by the manual smoke:schemathesis (needs Python); NOT proven by this check',
    'specmatic-contract': 'executed only by the manual smoke:specmatic (needs Java); NOT proven by this check',
  },
  limits: [
    'This check only proves that declared files, exports, scripts, and documentation exist.',
    'It does not run any adapter. A green result here is not proof an adapter works.',
    'Working proof comes only from the execution smokes named in executionProof.',
  ],
  errors,
}, null, 2));

if (status !== 'passed') process.exitCode = 1;

function checkString(adapter, key) {
  if (typeof adapter[key] !== 'string' || adapter[key].trim().length === 0) errors.push(`adapter.${key} must be a non-empty string`);
}

function requireFile(relativePath, label) {
  if (typeof relativePath !== 'string' || !existsSync(join(packageDir, relativePath))) errors.push(`missing ${label}: ${relativePath}`);
}

function requirePackageScript(name, label) {
  if (typeof name !== 'string' || typeof packageJson.scripts?.[name] !== 'string') errors.push(`missing ${label}: ${name}`);
}

async function requireText(path, needle, label) {
  if (typeof needle !== 'string') {
    errors.push(`missing ${label}: expected text must be a string`);
    return;
  }
  try {
    const text = await readFile(path, 'utf8');
    if (!text.includes(needle)) errors.push(`missing ${label}: ${needle}`);
  } catch (error) {
    errors.push(`could not read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
