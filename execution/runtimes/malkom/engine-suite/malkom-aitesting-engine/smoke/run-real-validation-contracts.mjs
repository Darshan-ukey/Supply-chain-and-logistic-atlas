import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateRealValidationBenchmarkSample,
  validateRealValidationManifest,
} from '../dist/index.js';

const manifest = JSON.parse(await readFile(new URL('../fixtures/real-validation/corpus-v1.json', import.meta.url), 'utf8'));
const checks = [];

check('baseline manifest passes', validateRealValidationManifest(manifest).length === 0);
check('baseline requires 300 scenarios', manifest.requiredTotal === 300);
check('baseline accepts 0 scenarios', manifest.acceptedScenarioCount === 0 && manifest.scenarios.length === 0);
check('all three applications require 100', manifest.applications.length === 3 && manifest.applications.every((entry) => entry.requiredScenarios === 100));
check('historical Directus proof is explicitly excluded', manifest.excludedEvidence.some((entry) => entry.reasonCode === 'AI_CONTRIBUTION_RECORD_INCOMPLETE'));

const counted = clone(manifest);
counted.acceptedScenarioCount = 1;
counted.scenarios = [validScenario()];
check('complete counted real-AI scenario passes', validateRealValidationManifest(counted).length === 0);

rejectManifest('unknown manifest property', (value) => { value.unknown = true; }, 'JSON_CONTRACT_ADDITIONALPROPERTIES');
rejectManifest('duplicate application id', (value) => { value.applications.push(clone(value.applications[0])); }, 'DUPLICATE_APPLICATION');
rejectManifest('bucket total mismatch', (value) => { value.applications[0].buckets[0].requiredScenarios = 24; }, 'BUCKET_TOTAL_MISMATCH');
rejectManifest('corpus total mismatch', (value) => { value.requiredTotal = 301; }, 'CORPUS_TOTAL_MISMATCH');
rejectCounted('unknown application', (value) => { value.scenarios[0].applicationId = 'unknown'; }, 'UNKNOWN_APPLICATION');
rejectCounted('unknown bucket', (value) => { value.scenarios[0].bucketId = 'unknown'; }, 'UNKNOWN_BUCKET');
rejectCounted('duplicate scenario id', (value) => { value.scenarios.push(clone(value.scenarios[0])); value.acceptedScenarioCount = 2; }, 'DUPLICATE_SCENARIO');
rejectCounted('counted proof missing', (value) => { delete value.scenarios[0].proof; }, 'COUNTED_PROOF_REQUIRED');
rejectManifest('planned scenario cannot carry proof', (value) => { const scenario = validScenario(); scenario.status = 'planned'; value.scenarios = [scenario]; }, 'UNCOUNTED_PROOF');
rejectCounted('fixture AI cannot count', (value) => { value.scenarios[0].proof.ai.fixture = true; }, 'JSON_CONTRACT_CONST');
rejectCounted('working-tree load cannot count', (value) => { value.scenarios[0].proof.product.load = 'working-tree-build'; }, 'JSON_CONTRACT_CONST');
rejectCounted('missing response digest cannot count', (value) => { delete value.scenarios[0].proof.ai.responseDigest; }, 'JSON_CONTRACT_REQUIRED');
rejectCounted('invalid evidence digest cannot count', (value) => { value.scenarios[0].proof.evidenceDigests[0] = 'not-a-digest'; }, 'JSON_CONTRACT_PATTERN');
rejectCounted('fewer than three connected operations cannot count', (value) => { value.scenarios[0].proof.connectedOperations = 2; }, 'JSON_CONTRACT_MINIMUM');
rejectCounted('rejected AI response cannot count', (value) => { value.scenarios[0].proof.ai.responseAccepted = false; }, 'JSON_CONTRACT_CONST');
rejectCounted('known token total must balance', (value) => { value.scenarios[0].proof.ai.tokenRecord.total = 99; }, 'TOKEN_TOTAL_MISMATCH');
rejectCounted('proposal counts must balance', (value) => { value.scenarios[0].proof.counts.proposed = 0; }, 'PROPOSAL_COUNT_MISMATCH');
rejectCounted('execution counts must balance', (value) => { value.scenarios[0].proof.counts.executed = 2; }, 'EXECUTION_COUNT_MISMATCH');
rejectCounted('skipped logical scenario cannot count', (value) => { value.scenarios[0].proof.counts.passed = 0; value.scenarios[0].proof.counts.skipped = 1; }, 'COUNTED_SCENARIO_NOT_PASSED');
rejectCounted('residual state cannot count', (value) => { value.scenarios[0].proof.counts.residual = 1; }, 'COUNTED_RESIDUE');
rejectCounted('mutation must report clean cleanup', (value) => { value.scenarios[0].proof.cleanupOutcome = 'not-required'; }, 'MUTATION_NOT_CLEAN');
rejectCounted('accepted count must match entries', (value) => { value.acceptedScenarioCount = 0; }, 'ACCEPTED_COUNT_MISMATCH');

const sample = validSample();
check('complete benchmark sample passes', validateRealValidationBenchmarkSample(sample).length === 0);
rejectSample('unknown sample property', (value) => { value.unknown = true; }, 'JSON_CONTRACT_ADDITIONALPROPERTIES');
rejectSample('memory percentiles must be ordered', (value) => { value.resources.rssMedianBytes = value.resources.rssPeakBytes + 1; }, 'MEMORY_PERCENTILE_ORDER');
rejectSample('inspection subsets must be ordered', (value) => { value.inspection.parsedFiles = value.inspection.openedFiles + 1; }, 'INSPECTION_COUNT_ORDER');
rejectSample('missing AI metrics require a reason', (value) => { value.ai.inputTokens = null; value.ai.unavailableReason = null; }, 'AI_METRIC_REASON_REQUIRED');
rejectSample('known AI metrics forbid unavailable reason', (value) => { value.ai.unavailableReason = 'not returned'; }, 'AI_METRIC_REASON_UNEXPECTED');
rejectSample('sample execution counts must balance', (value) => { value.execution.executed = 2; }, 'EXECUTION_COUNT_MISMATCH');
rejectSample('passed sample cannot contain failure', (value) => { value.execution.passed = 0; value.execution.failed = 1; }, 'PASSED_WITH_NONPASS');
rejectSample('passed sample cannot retain database residue', (value) => { value.database.residual = 1; }, 'PASSED_WITH_RESIDUE');
rejectSample('sample evidence digest is mandatory', (value) => { value.evidenceDigests[0] = 'bad'; }, 'JSON_CONTRACT_PATTERN');

const failures = checks.filter((entry) => !entry.passed);
console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.real-validation-contract-smoke.v1',
  checks: checks.length,
  positive: checks.filter((entry) => entry.kind === 'positive').length,
  rejectedInvalid: checks.filter((entry) => entry.kind === 'negative' && entry.passed).length,
  failures: failures.map((entry) => ({ name: entry.name, observed: entry.observed })),
  acceptedCorpus: { required: manifest.requiredTotal, accepted: manifest.acceptedScenarioCount, excludedHistoricalEvidence: manifest.excludedEvidence.length },
}, null, 2));
if (failures.length > 0) process.exitCode = 1;

function rejectManifest(name, mutate, expectedCode) {
  const value = clone(manifest);
  mutate(value);
  rejects(name, validateRealValidationManifest(value), expectedCode);
}

function rejectCounted(name, mutate, expectedCode) {
  const value = clone(counted);
  mutate(value);
  rejects(name, validateRealValidationManifest(value), expectedCode);
}

function rejectSample(name, mutate, expectedCode) {
  const value = clone(sample);
  mutate(value);
  rejects(name, validateRealValidationBenchmarkSample(value), expectedCode);
}

function rejects(name, issues, expectedCode) {
  check(name, issues.some((entry) => entry.code === expectedCode), 'negative', issues.map((entry) => entry.code).join(','));
}

function check(name, passed, kind = 'positive', observed = undefined) {
  checks.push({ name, passed, kind, observed });
  assert.equal(typeof passed, 'boolean');
}

function validScenario() {
  return {
    id: 'directus-rest-001', applicationId: 'directus', bucketId: 'rest',
    title: 'Create, publish, refuse delete, and clean an article',
    businessRisk: 'A least-privilege user must not delete protected content and test data must not remain.',
    surfaces: ['api', 'authorization', 'database'], status: 'counted',
    proof: {
      proofClass: 'real-ai', runId: 'run-proof-001',
      ai: { provider: 'provider', model: 'model', requestDigest: sha('1'), responseDigest: sha('2'), responseAccepted: true, fixture: false, tokenRecord: { availability: 'known', input: 100, output: 50, total: 150 } },
      product: { version: '0.2.0', packageDigest: sha('3'), load: 'clean-installed-package' },
      connectedOperations: 7, mutated: true, cleanupOutcome: 'clean',
      counts: { proposed: 1, accepted: 1, rejected: 0, compiled: 1, executed: 1, passed: 1, failed: 0, skipped: 0, errors: 0, cleaned: 1, residual: 0 },
      evidenceDigests: [sha('4')], durationMs: 1000,
    },
  };
}

function validSample() {
  return {
    schemaVersion: 'brisk-aitesting.real-validation-sample.v1', sampleId: 'sample-001', corpusVersion: manifest.corpusVersion,
    productVersion: '0.2.0', applicationId: 'directus', scenarioIds: ['directus-rest-001'], mode: 'cold', concurrency: 1, repetition: 1,
    startedAt: '2026-08-03T00:00:00.000Z', durationMs: 1000,
    identity: { machineDigest: sha('5'), runtime: 'node-24.4.1-windows', applicationVersion: '12.2.0', provider: 'provider', model: 'model', configurationDigest: sha('6') },
    stages: [{ name: 'inspection', durationMs: 100, providerWaitMs: 0 }, { name: 'planning', durationMs: 500, providerWaitMs: 450 }],
    resources: { cpuUserMicros: 1000, cpuSystemMicros: 500, normalizedCpuPercent: 10, rssBaselineBytes: 100, rssMedianBytes: 120, rssP95Bytes: 140, rssPeakBytes: 160, eventLoopDelayP95Ms: 2, activeHandlesPeak: 5, openFilesPeak: 3, openSocketsPeak: 2, childProcessesPeak: 0 },
    inspection: { enumeratedFiles: 100, openedFiles: 80, parsedFiles: 70, acceptedFiles: 60, rejectedFiles: 10, excludedFiles: 20, bytesRead: 10000, routesOrOperations: 20, graphNodes: 30, graphEdges: 40, conflicts: 1, unresolvedFacts: 0 },
    ai: { requests: 1, retries: 0, timeouts: 0, cancellations: 0, inputTokens: 100, outputTokens: 50, cost: 0.01, unavailableReason: null },
    execution: { proposed: 1, accepted: 1, rejected: 0, compiled: 1, executed: 1, passed: 1, failed: 0, skipped: 0, errors: 0, cleaned: 1, residual: 0, operationsPerSecond: 7 },
    artifacts: { files: 10, bytes: 20000 }, database: { created: 1, cleaned: 1, residual: 0 }, outcome: 'passed', exclusions: [], evidenceDigests: [sha('7')],
  };
}

function sha(character) { return `sha256:${character.repeat(64)}`; }
function clone(value) { return structuredClone(value); }
