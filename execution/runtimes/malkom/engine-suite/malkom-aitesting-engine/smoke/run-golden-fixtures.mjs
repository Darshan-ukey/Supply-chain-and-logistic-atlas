import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(here);
const planFixturePath = join(packageDir, 'fixtures', 'golden', 'serious-saas-plan.json');
const resultFixturePath = join(packageDir, 'fixtures', 'golden', 'serious-saas-result-summary.json');
const referenceSmokePath = join(here, 'run-reference-serious-saas.mjs');

const planFixture = JSON.parse(await readFile(planFixturePath, 'utf8'));
const resultFixture = JSON.parse(await readFile(resultFixturePath, 'utf8'));
const referenceSmokeSource = await readFile(referenceSmokePath, 'utf8');

const errors = [];

if (planFixture.schemaVersion !== 'brisk-aitesting.golden-plan.v1') errors.push('wrong golden plan schema');
if (resultFixture.schemaVersion !== 'brisk-aitesting.golden-result-summary.v1') errors.push('wrong golden result summary schema');
if (!Array.isArray(planFixture.scenarios)) errors.push('golden plan scenarios must be an array');
if (planFixture.scenarioCount !== planFixture.scenarios.length) errors.push('golden plan scenarioCount does not match scenarios length');

for (const scenario of planFixture.scenarios ?? []) {
  if (!referenceSmokeSource.includes(scenario.id)) errors.push(`reference smoke missing scenario id ${scenario.id}`);
  if (scenario.type !== undefined && !referenceSmokeSource.includes(`type: '${scenario.type}'`)) errors.push(`reference smoke missing type ${scenario.type} for ${scenario.id}`);
  if (scenario.target?.path !== undefined && !referenceSmokeSource.includes(`path: '${scenario.target.path}'`)) errors.push(`reference smoke missing target path ${scenario.target.path} for ${scenario.id}`);
  if (scenario.target?.route !== undefined && !referenceSmokeSource.includes(`route: '${scenario.target.route}'`)) errors.push(`reference smoke missing target route ${scenario.target.route} for ${scenario.id}`);
}

let referenceOutput;
try {
  const { stdout } = await execFileAsync(process.execPath, [referenceSmokePath], {
    cwd: packageDir,
    timeout: 180_000,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  });
  referenceOutput = parseLastJsonObject(stdout);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (referenceOutput !== undefined) {
  const expected = resultFixture.summary;
  for (const key of ['total', 'passed', 'failed', 'skipped', 'errors', 'passRate']) {
    if (referenceOutput.summary?.[key] !== expected[key]) {
      errors.push(`summary.${key} expected ${expected[key]}, got ${referenceOutput.summary?.[key]}`);
    }
  }
  const actualTypes = [...(referenceOutput.scenarioTypes ?? [])].sort();
  const expectedTypes = [...(resultFixture.scenarioTypes ?? [])].sort();
  if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
    errors.push(`scenarioTypes expected ${expectedTypes.join(',')}, got ${actualTypes.join(',')}`);
  }
  if (referenceOutput.negativeScenarios !== resultFixture.negativeScenarios) {
    errors.push(`negativeScenarios expected ${resultFixture.negativeScenarios}, got ${referenceOutput.negativeScenarios}`);
  }
  if (referenceOutput.artifacts < resultFixture.requiredArtifactSchemas.length) {
    errors.push(`expected at least ${resultFixture.requiredArtifactSchemas.length} artifacts, got ${referenceOutput.artifacts}`);
  }
}

const status = errors.length === 0 ? 'passed' : 'failed';
console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.golden-fixtures.v1',
  status,
  fixtures: [
    planFixturePath,
    resultFixturePath,
  ],
  checkedScenarios: planFixture.scenarios?.length ?? 0,
  referenceSummary: referenceOutput?.summary,
  errors,
}, null, 2));

if (status !== 'passed') process.exitCode = 1;

function parseLastJsonObject(stdout) {
  const start = stdout.lastIndexOf('\n{');
  const jsonText = (start >= 0 ? stdout.slice(start + 1) : stdout).trim();
  return JSON.parse(jsonText);
}
