import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const changelog = await readFile('CHANGELOG.md', 'utf8');
const releaseDoc = await readFile(join('docs', 'RELEASE.md'), 'utf8');
const ciWorkflow = await readFile(join('.github', 'workflows', 'ci.yml'), 'utf8');

const requiredFiles = [
  'CHANGELOG.md',
  'docs/RELEASE.md',
  '.github/workflows/ci.yml',
  '.github/workflows/real-ai-smoke.yml',
  '.github/workflows/schemathesis-smoke.yml',
  '.github/workflows/specmatic-smoke.yml',
  '.github/workflows/pact-smoke.yml',
];
const requiredScripts = [
  'release:check',
  'pack:check',
  'smoke:ci',
  'benchmark',
  'smoke:real-ai',
  'smoke:schemathesis',
  'smoke:specmatic',
  'smoke:pact',
];
const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) errors.push(`missing release file ${file}`);
}

for (const script of requiredScripts) {
  if (typeof packageJson.scripts?.[script] !== 'string') errors.push(`missing package script ${script}`);
}

if (!/^0|[1-9]\d*\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
  errors.push(`package version is not semver-like: ${packageJson.version}`);
}

if (!changelog.includes(`## ${packageJson.version}`)) {
  errors.push(`CHANGELOG.md missing section for ${packageJson.version}`);
}

if (!releaseDoc.includes('npm publish --access public')) {
  errors.push('docs/RELEASE.md missing npm publish command');
}

if (!releaseDoc.includes('npm run release:check')) {
  errors.push('docs/RELEASE.md missing release:check command');
}

if (!ciWorkflow.includes('matrix') || !ciWorkflow.includes('20') || !ciWorkflow.includes('22') || !ciWorkflow.includes('24')) {
  errors.push('CI workflow must keep Node 20/22/24 matrix coverage');
}

const output = {
  schemaVersion: 'brisk-aitesting.release-readiness.v1',
  status: errors.length === 0 ? 'passed' : 'failed',
  version: packageJson.version,
  checkedFiles: requiredFiles,
  checkedScripts: requiredScripts,
  errors,
};

console.log(JSON.stringify(output, null, 2));
if (errors.length > 0) process.exitCode = 1;
