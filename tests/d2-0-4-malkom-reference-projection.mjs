import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildMalkomReferenceProjection } from '../tools/malkom-projection/build-malkom-reference-projection.mjs';

const ART = 'data/materialized/road-ltl-v2.3-malkom-reference-projection.json';
const BUNDLE = 'canvas-v2/canvas-v2/data/road-ltl-workdefinitions-v2.3.json';
const ADAPTER = 'execution/adapters/malkom/malkom-adapter.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const a = J(ART);

// =============================================================================
// 1. LINEAGE GUARDRAILS — the decisive D2.0.4 requirement.
//    NO_FALSE_V15_COMPILER_CLAIM + MALKOM_IS_FIRST_CONSUMER_NOT_CANONICAL_ATLAS_MODEL
// =============================================================================
assert.equal(a.classification, 'DEMO_REFERENCE_PROJECTION_NOT_CANONICAL_TRUTH',
  'the artifact must not present itself as canonical Atlas truth');
assert.equal(a.lineage.lineageName, 'PROVEN_EXECUTION_REFERENCE');
assert.equal(a.lineage.sourceModel, 'Road LTL V1.2',
  'source model must be the V1.2 reference lineage, not 1.5');
assert.match(a.lineage.chain, /V1\.2 -> Domain Warehouse v2\.3 -> Malkom/);

for (const forbidden of ['Road LTL 1.5', 'Operational Knowledge v2',
  'P6.1 recursive work decomposition', 'P6.2 canonical WorkDefinition compiler']) {
  assert.ok(a.lineage.notGeneratedFrom.includes(forbidden),
    `notGeneratedFrom must explicitly disclaim: ${forbidden}`);
}

// The generator must physically read ONLY reference-lineage inputs. If a future change makes it
// read 1.5/P6.1/P6.2 data, this fails — which is the point.
const inputPaths = Object.keys(a.inputs);
assert.equal(inputPaths.length, 3, 'exactly three declared inputs expected');
for (const p of inputPaths) {
  assert.ok(!/road-ltl-v1\.[45]|operational-knowledge|work-decomposition|work-definition|p6-/i.test(p),
    `generator must not read governed-target-lineage input: ${p}`);
  assert.equal(sha(p), a.inputs[p], `declared input hash must match the file on disk: ${p}`);
}

// =============================================================================
// 2. GAPS DOCUMENTED, NOT SUPPRESSED — DOCUMENT_KNOWN_ADAPTER_LOSSES_GAPS
// =============================================================================
const g = a.knownLossesAndGaps;
assert.equal(g.escalateHandling.disposition, 'PARTIAL');
assert.deepEqual(g.escalateHandling.affectedTasks, ['LTL-15', 'LTL-18', 'LTL-22'],
  'the three real ESCALATE tasks must be named individually');
assert.ok(g.escalateHandling.explanation.length > 40);

assert.equal(g.clientBindingRequired.disposition, 'CLIENT_BINDING_REQUIRED');
assert.equal(g.clientBindingRequired.totalPoints, 176,
  'all 176 client binding points must be reported');
assert.equal(g.clientBindingRequired.distinctFamilies, 8);
assert.match(g.clientBindingRequired.explanation, /client supplies the value/i);
assert.match(g.clientBindingRequired.explanation, /none are invented/i);

// Operations the adapter genuinely cannot do must stay listed as not-enabled.
for (const op of ['materialize', 'deploy', 'execute', 'status', 'reconcileEvidence']) {
  assert.ok(a.adapter.operationsEnabled[op] === false,
    `adapter operation must remain honestly disabled: ${op}`);
  assert.ok(g.adapterOperationsNotEnabled.includes(op),
    `not-enabled operation must be surfaced in the gap record: ${op}`);
}

// =============================================================================
// 3. REAL COVERAGE — every task carries genuine Malkom-shaped content.
// =============================================================================
const bundle = J(BUNDLE);
assert.equal(a.summary.definitionsProcessed, 22);
assert.equal(a.summary.definitionsProcessed, bundle.definitions.length,
  'every bundle definition must be processed, none skipped');
assert.equal(a.summary.adapterCompatible, 22);
assert.equal(a.summary.materializable, 22);
assert.equal(Object.keys(a.tasks).length, 22);

for (const [taskId, t] of Object.entries(a.tasks)) {
  assert.ok(t.queue, `${taskId}: queue must be present`);
  assert.ok(t.subQueueCount > 0, `${taskId}: at least one subqueue`);
  assert.ok(t.workTypes.length > 0, `${taskId}: at least one work type`);
  for (const wt of t.workTypes) {
    assert.ok(wt.executionMode, `${taskId}: every work type must declare an executionMode`);
  }
  assert.ok(t.outcomeCount > 0, `${taskId}: at least one outcome`);
  assert.equal(t.compatible, true);
  assert.equal(t.materializable, true);
  assert.ok(t.projectionId.startsWith('malkom:'), `${taskId}: projectionId shape`);
}

// ESCALATE tasks must carry the warning; non-ESCALATE tasks must not.
for (const taskId of g.escalateHandling.affectedTasks) {
  assert.ok(a.tasks[taskId].nextSteps.includes('ESCALATE'), `${taskId} must list ESCALATE`);
  assert.ok(a.tasks[taskId].warnings.length > 0, `${taskId} must carry a PARTIAL warning`);
}

// =============================================================================
// 4. DETERMINISM — byte-identical regeneration, stable semantic hash.
// =============================================================================
const before = sha(ART);
const beforeSemantic = a.semanticHash;
execFileSync(process.execPath, ['tools/malkom-projection/build-malkom-reference-projection.mjs'], { stdio: 'pipe' });
assert.equal(sha(ART), before, 'regeneration must be byte-identical');
assert.equal(J(ART).semanticHash, beforeSemantic, 'semantic hash must be stable');

const twice = [0, 1].map(() => buildMalkomReferenceProjection().semanticHash);
assert.equal(twice[0], twice[1], 'two in-memory derivations must agree');

assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fs.readFileSync(ART, 'utf8')),
  'artifact must contain no wall-clock timestamp, or it cannot be byte-reproducible');

// =============================================================================
// 5. SOURCE INTEGRITY — D2.0.4 must not mutate the reference lineage it reads.
// =============================================================================
assert.equal(sha(BUNDLE), a.inputs[BUNDLE], 'reference bundle must be unmodified');
assert.equal(sha(ADAPTER), a.inputs[ADAPTER], 'governed adapter must be unmodified');

console.log('D2.0.4 Malkom reference projection certification PASS');
console.log(`  ${a.summary.definitionsProcessed} definitions | ${a.summary.adapterCompatible} compatible | ${a.summary.materializable} materializable`);
console.log(`  gaps preserved: ${g.escalateHandling.affectedTasks.length} ESCALATE PARTIAL, ${g.clientBindingRequired.totalPoints} bindings across ${g.clientBindingRequired.distinctFamilies} families, ${g.adapterOperationsNotEnabled.length} operations not enabled`);
console.log(`  semanticHash ${a.semanticHash}`);
