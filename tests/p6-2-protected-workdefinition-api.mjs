import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodeDefinitionPayload, selectExactWorkDefinitions } from '../lib/api/work-definition.js';

// Synthetic fixtures only. No governed execution IP is committed to the repository.
const moduleId = 'fixture-module';
const moduleVersion = '9.9';

const definition = (taskId, unitId) => ({
  schemaVersion: 'atlas-canonical-workdefinition-v1',
  workDefinitionId: `${moduleId}@${moduleVersion}::${taskId}::${unitId}::WD`,
  executability: { status: 'EXECUTOR_READY' },
  lineage: { daughterModule: moduleId, daughterVersion: moduleVersion, sourceTaskId: taskId, sourceWorkUnitId: unitId }
});

const pkg = taskId => ({
  moduleId, moduleVersion, sourceTaskId: taskId,
  semanticSourceVersion: '9.8',
  coverage: { sourceTaskId: taskId, compiledCount: 1, notCompiledCount: 1, coverageStatus: 'PARTIALLY_COMPILED_WITH_EXPLICIT_BLOCKERS' },
  definitions: [definition(taskId, 'W3')]
});

const aggregate = { moduleId, moduleVersion, tasks: { 'A5-01': pkg('A5-01'), 'A5-02': pkg('A5-02') } };

// ---------------------------------------------------------------- codec
const brotliRow = { payload_encoding: 'BROTLI_BASE64', payload_compressed_base64: zlib.brotliCompressSync(Buffer.from(JSON.stringify(aggregate), 'utf8')).toString('base64') };
assert.deepEqual(decodeDefinitionPayload(brotliRow), aggregate, 'Brotli aggregate must decode losslessly');
const gzipRow = { payload_encoding: 'GZIP_BASE64', payload_compressed_base64: zlib.gzipSync(Buffer.from(JSON.stringify(aggregate), 'utf8')).toString('base64') };
assert.deepEqual(decodeDefinitionPayload(gzipRow), aggregate, 'Gzip aggregate must decode losslessly');
assert.throws(() => decodeDefinitionPayload({ payload_encoding: 'BROTLI_BASE64' }), e => e?.status === 500, 'missing compressed payload must fail closed');
assert.throws(() => decodeDefinitionPayload({ payload_encoding: 'UNSUPPORTED' }), e => e?.status === 500, 'unsupported encoding must fail closed');

// ------------------------------------------------- exact-task resolution
const resolved = selectExactWorkDefinitions(aggregate, { moduleId, moduleVersion, taskId: 'A5-02' });
assert.equal(resolved.sourceTaskId, 'A5-02', 'aggregate must resolve only the exact requested task');
assert.equal(resolved.definitions.length, 1);
assert.equal(selectExactWorkDefinitions(pkg('A5-01'), { moduleId, moduleVersion, taskId: 'A5-01' }).sourceTaskId, 'A5-01', 'direct single-task rows remain supported');

assert.throws(() => selectExactWorkDefinitions(aggregate, { moduleId, moduleVersion, taskId: 'A5-99' }), e => e?.status === 404, 'unknown task must fail closed');
assert.throws(() => selectExactWorkDefinitions(aggregate, { moduleId, moduleVersion: '9.8', taskId: 'A5-01' }), e => e?.status === 404, 'wrong version must not fall back');
assert.throws(() => selectExactWorkDefinitions(aggregate, { moduleId: 'other-module', moduleVersion, taskId: 'A5-01' }), e => e?.status === 404, 'wrong module must fail closed');

const ambiguous = { moduleId, moduleVersion, tasks: [pkg('A5-01'), pkg('A5-01')] };
assert.throws(() => selectExactWorkDefinitions(ambiguous, { moduleId, moduleVersion, taskId: 'A5-01' }), e => e?.status === 500, 'ambiguous matches must fail closed');

const lineageDrift = pkg('A5-01');
lineageDrift.definitions[0].lineage.daughterVersion = '9.8';
assert.throws(() => selectExactWorkDefinitions(lineageDrift, { moduleId, moduleVersion, taskId: 'A5-01' }), e => e?.status === 500, 'definition lineage drift must fail closed');

const nonExecutable = pkg('A5-01');
nonExecutable.definitions[0].executability.status = 'BLOCKED_BY_CLIENT_BINDING';
assert.throws(() => selectExactWorkDefinitions(nonExecutable, { moduleId, moduleVersion, taskId: 'A5-01' }), e => e?.status === 500, 'non-executable work must never be served as a WorkDefinition');

// the aggregate container itself must never be returnable
assert.ok(!Object.prototype.hasOwnProperty.call(resolved, 'tasks'), 'resolved package must not carry the aggregate container');

// ---------------------------------------------------------- source guarantees
const source = fs.readFileSync(new URL('../lib/api/work-definition.js', import.meta.url), 'utf8');
assert.match(source, /requireCapabilities\(req,'atlas\.workdefinition\.full\.read'\)/, 'protected capability must remain mandatory');
assert.match(source, /private, no-store/, 'protected responses must remain no-store');
assert.match(source, /EXECUTION_PROTECTED/, 'projection class must remain explicit');
assert.match(source, /source_task_id=like\.__ALL\*__/, 'aggregate storage lookup must remain explicit');
assert.match(source, /selectExactWorkDefinitions\(storedPayload/, 'aggregate payload must be reduced to an exact task before response');
assert.doesNotMatch(source, /road-ltl/i, 'protected API resolver must remain daughter-neutral');
assert.doesNotMatch(source, /ocean-fcl|ocean-lcl/i, 'protected API resolver must remain mode-neutral');
assert.doesNotMatch(source, /malkom/i, 'protected API must not carry runtime projection concerns');

// capability must be a governed protected capability, and routed
const utils = fs.readFileSync(new URL('../lib/api/_utils.js', import.meta.url), 'utf8');
assert.match(utils, /atlas\.workdefinition\.full\.read/, 'capability must exist in the governed authorization matrix');
assert.match(utils, /PROTECTED_PRESENTATION_CAPABILITIES=\[[^\]]*atlas\.workdefinition\.full\.read/s, 'capability must be classified protected, not safe');
assert.match(fs.readFileSync(new URL('../api/atlas.js', import.meta.url), 'utf8'), /'work-definition':'\.\/work-definition\.js'/, 'protected route must be registered');

// ------------------------------------------- PUBLIC_SAFE summary is non-reconstructive
const projectionSource = fs.readFileSync(new URL('../lib/projections/execution-depth-projection.js', import.meta.url), 'utf8');
assert.match(projectionSource, /workDefinitionSummaryPath/, 'PUBLIC_SAFE WorkDefinition summary must be registry-driven');
assert.match(projectionSource, /PUBLIC_SAFE_SUMMARY_ONLY/, 'summary classification must be enforced');
assert.match(projectionSource, /detailIncluded:false/, 'PUBLIC_SAFE WorkDefinition summary must never include detail');

// the public summary shape must expose counts/status only
const summaryFields = projectionSource
  .split('function safeWorkDefinitionSummary')[1]
  .split('function applySafeWorkDefinitionSummary')[0];
for (const forbidden of ['workDefinitionId', 'definitions', 'sourceRefs', 'actions', 'decisions', 'evidence', 'requiredClientBindings', 'requiredKnowledgeGaps']) {
  assert.ok(!summaryFields.includes(forbidden), `PUBLIC_SAFE WorkDefinition summary must not expose ${forbidden}`);
}
// aggregate counts are allowed; the blocked-leaf identifier array is not
assert.ok(/notCompiledLeafCount/.test(summaryFields), 'blocked-leaf counts are allowlisted and must be reported');
assert.ok(!/notCompiled(?!LeafCount)/.test(summaryFields), 'PUBLIC_SAFE summary must not expose the notCompiled blocked-leaf array');

// registry entries without a WorkDefinition summary must be unaffected (P6.1 behaviour preserved)
const registry = JSON.parse(fs.readFileSync(new URL('../governance/presentation/p2-projection-source-registry.json', import.meta.url), 'utf8'));
for (const entry of registry.sources) {
  if (!entry.workDefinitionSummaryPath) continue;
  assert.ok(fs.existsSync(entry.workDefinitionSummaryPath), `registered WorkDefinition summary must exist: ${entry.workDefinitionSummaryPath}`);
  const summary = JSON.parse(fs.readFileSync(entry.workDefinitionSummaryPath, 'utf8'));
  assert.equal(summary.classification, 'PUBLIC_SAFE_SUMMARY_ONLY');
  assert.equal(summary.detailIncluded, false);
}

console.log('P6.2 protected WorkDefinition API / PUBLIC_SAFE boundary certification PASS');
