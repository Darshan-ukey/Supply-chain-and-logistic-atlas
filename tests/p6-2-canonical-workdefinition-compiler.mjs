import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  compileBundle, compileTaskDecomposition, canonicalHash, stableStringify, COMPILER_VERSION
} from '../lib/compile/workdefinition-compiler.js';
import { verifyCompilation, verifyWorkDefinition } from '../lib/compile/workdefinition-verifier.js';

// Synthetic fixtures only. No governed Road LTL execution IP is committed to the repository.
const HASH = 'a'.repeat(64);
const moduleId = 'fixture-module';
const moduleVersion = '9.9';

const unit = (id, parent, sequence, unitType, status, extra = {}) => ({
  workUnitId: id,
  parentWorkUnitId: parent,
  sequence,
  unitType,
  name: `unit ${id}`,
  purpose: `purpose ${id}`,
  sourceRefs: [`SRC-${id}`],
  executorReadiness: {
    status,
    blockingReasons: status === 'EXECUTOR_READY' ? [] : [`blocked ${id}`],
    requiredClientBindings: status === 'BLOCKED_BY_CLIENT_BINDING' ? [`CB-${id}`] : [],
    requiredKnowledgeGaps: status === 'BLOCKED_BY_KNOWLEDGE_GAP' ? [`KG-${id}`] : [],
    downstreamCompilationTarget: 'CANONICAL_WORKDEFINITION'
  },
  ...extra
});

/** parent -> child -> grandchild, with one ready leaf and both blocker classes. */
function decomposition(taskId = 'A5-01') {
  return {
    schemaVersion: 'atlas-canonical-work-decomposition-v1',
    decompositionId: `d-${taskId}`,
    contractVersion: '1.0.0',
    status: 'VALIDATED_REFERENCE_DECOMPOSITION',
    daughterModule: moduleId,
    daughterVersion: moduleVersion,
    sourceTaskId: taskId,
    sourceTaskTitle: `title ${taskId}`,
    executionReadinessStatus: 'COMPILED',
    semanticLineage: { semanticSourceVersion: '9.8', effectiveModuleVersion: moduleVersion, inheritance: 'LOSSLESS_UNCHANGED_TASK' },
    parentLink: { parentLevel: 'A4', parentTaskId: 'A4-01' },
    stopCriterion: 'executability',
    workUnits: [
      unit('W1', null, 1, 'TASK_ROOT', 'NEEDS_DECOMPOSITION'),
      unit('W2', 'W1', 1, 'ACTION_GROUP', 'NEEDS_DECOMPOSITION'),
      unit('W3', 'W2', 1, 'ATOMIC_ACTION', 'EXECUTOR_READY', {
        trigger: 'inbound event',
        inputs: ['Bill of Lading'],
        entryConditions: ['shipment exists'],
        decisionGates: [{ gate: 'reference matches' }],
        atomicActions: ['validate reference'],
        branchTransitions: [{ to: 'VALIDATED' }],
        temporalConstraints: ['within 24h'],
        evidenceRequirements: ['validation record'],
        dependencies: ['W4'],
        outputState: 'VALIDATED'
      }),
      unit('W4', 'W2', 2, 'ATOMIC_ACTION', 'BLOCKED_BY_CLIENT_BINDING'),
      unit('W5', 'W1', 2, 'EVIDENCE_CAPTURE', 'BLOCKED_BY_KNOWLEDGE_GAP')
    ],
    summary: {
      workUnitCount: 5, leafCount: 3,
      leafStatusCounts: { EXECUTOR_READY: 1, BLOCKED_BY_CLIENT_BINDING: 1, BLOCKED_BY_KNOWLEDGE_GAP: 1 },
      knowledgeGapCount: 1, clientBindingRefCount: 1,
      requiredKnowledgeGaps: ['KG-W5'], requiredClientBindings: ['CB-W4'],
      executorProof: 'NOT_INDEPENDENTLY_PROVEN', workDefinitionCompilationStatus: 'NOT_STARTED'
    }
  };
}

const bundle = { moduleId, moduleVersion, decompositions: { 'A5-01': decomposition('A5-01'), 'A5-02': decomposition('A5-02') } };

// ---------------------------------------------------------------- valid path
const compiled = compileBundle(bundle, { governedInputContentHash: HASH });
assert.equal(compiled.totals.taskCount, 2, 'both tasks must compile');
assert.equal(compiled.totals.workDefinitionCount, 2, 'exactly one EXECUTOR_READY leaf per task compiles');
assert.equal(compiled.totals.leafCount, 6, 'terminal leaves must be counted from the graph');
assert.equal(compiled.totals.blockedByClientBindingLeafCount, 2, 'client-binding blockers must be preserved');
assert.equal(compiled.totals.blockedByKnowledgeGapLeafCount, 2, 'knowledge-gap blockers must be preserved');
assert.equal(compiled.totals.fullyCompiledTaskCount, 0, 'tasks with blocked leaves are never fully compiled');

const verified = verifyCompilation(compiled);
assert.ok(verified.ok, `valid compilation must verify: ${verified.violations.join(' | ')}`);

const wd = compiled.definitions[0];
assert.deepEqual(wd.lineage.workUnitPath, ['W1', 'W2', 'W3'], 'recursive root-to-leaf lineage path must be preserved');
assert.equal(wd.lineage.semanticSourceVersion, '9.8', 'semantic source version must be preserved');
assert.equal(wd.lineage.daughterVersion, moduleVersion, 'effective version must be preserved');
assert.equal(wd.executability.status, 'EXECUTOR_READY');
assert.equal(wd.executability.executorClass, 'EXECUTOR_CLASS_UNBOUND', 'executor class must not be invented');
assert.equal(wd.executability.independentExecutorProofStatus, 'NOT_INDEPENDENTLY_PROVEN');
assert.deepEqual(wd.actors, [], 'categories absent upstream must stay empty, not synthesised');
assert.deepEqual(wd.controls, [], 'categories absent upstream must stay empty, not synthesised');
assert.equal(wd.provenance.governedInputContentHash, HASH, 'lineage anchor to certified input must be carried');
assert.deepEqual(wd.dependencies, ['W4'], 'governed dependencies must be preserved');

// blocked work stays visibly blocked and never becomes a definition
const cov = compiled.coverage.find(c => c.sourceTaskId === 'A5-01');
assert.equal(cov.coverageStatus, 'PARTIALLY_COMPILED_WITH_EXPLICIT_BLOCKERS');
assert.deepEqual(cov.notCompiled.map(x => x.workUnitId), ['W4', 'W5']);
assert.deepEqual(cov.notCompiled.find(x => x.workUnitId === 'W4').requiredClientBindings, ['CB-W4']);
assert.deepEqual(cov.notCompiled.find(x => x.workUnitId === 'W5').requiredKnowledgeGaps, ['KG-W5']);
for (const d of compiled.definitions) {
  assert.ok(!d.workDefinitionId.includes('W4') && !d.workDefinitionId.includes('W5'), 'blocked leaves must not compile');
}

// ---------------------------------------------------------------- determinism
const again = compileBundle(JSON.parse(JSON.stringify(bundle)), { governedInputContentHash: HASH });
assert.equal(stableStringify(compiled), stableStringify(again), 'compilation must be byte-deterministic');
assert.equal(canonicalHash(compiled), canonicalHash(again), 'canonical hash must be stable across runs');

// key order in the source must not change the output
const reordered = { decompositions: { 'A5-02': decomposition('A5-02'), 'A5-01': decomposition('A5-01') }, moduleVersion, moduleId };
assert.equal(canonicalHash(compileBundle(reordered, { governedInputContentHash: HASH })), canonicalHash(compiled), 'output must not depend on input key order');

// stable IDs
assert.deepEqual(
  compiled.definitions.map(d => d.workDefinitionId),
  ['fixture-module@9.9::A5-01::W3::WD', 'fixture-module@9.9::A5-02::W3::WD'],
  'WorkDefinition IDs must be stable and canonical-ID derived'
);

// ---------------------------------------------------------- structural failure
const cyclic = decomposition();
cyclic.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'NEEDS_DECOMPOSITION'), unit('W2', 'W3', 1, 'ACTION_GROUP', 'NEEDS_DECOMPOSITION'), unit('W3', 'W2', 1, 'ATOMIC_ACTION', 'EXECUTOR_READY')];
assert.throws(() => compileTaskDecomposition(cyclic, { governedInputContentHash: HASH }), /cycle/i, 'illegal cycles must fail closed');

const orphan = decomposition();
orphan.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'NEEDS_DECOMPOSITION'), unit('W2', 'MISSING', 1, 'ATOMIC_ACTION', 'EXECUTOR_READY')];
assert.throws(() => compileTaskDecomposition(orphan, { governedInputContentHash: HASH }), /orphan/i, 'orphan parent references must fail closed');

const duplicate = decomposition();
duplicate.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'NEEDS_DECOMPOSITION'), unit('W1', 'W1', 1, 'ATOMIC_ACTION', 'EXECUTOR_READY')];
assert.throws(() => compileTaskDecomposition(duplicate, { governedInputContentHash: HASH }), /Duplicate workUnitId/i, 'duplicate work unit ids must fail closed');

const danglingLeaf = decomposition();
danglingLeaf.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'NEEDS_DECOMPOSITION'), unit('W2', 'W1', 1, 'ATOMIC_ACTION', 'NEEDS_DECOMPOSITION')];
assert.throws(() => compileTaskDecomposition(danglingLeaf, { governedInputContentHash: HASH }), /NEEDS_DECOMPOSITION/, 'terminal NEEDS_DECOMPOSITION must fail closed');

const internalReady = decomposition();
internalReady.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'EXECUTOR_READY'), unit('W2', 'W1', 1, 'ATOMIC_ACTION', 'EXECUTOR_READY')];
assert.throws(() => compileTaskDecomposition(internalReady, { governedInputContentHash: HASH }), /Internal node/i, 'internal nodes must not claim executor readiness');

const twoRoots = decomposition();
twoRoots.workUnits = [unit('W1', null, 1, 'TASK_ROOT', 'EXECUTOR_READY'), unit('W2', null, 2, 'TASK_ROOT', 'EXECUTOR_READY')];
assert.throws(() => compileTaskDecomposition(twoRoots, { governedInputContentHash: HASH }), /exactly one task root/i, 'multiple roots must fail closed');

const badLineage = decomposition();
delete badLineage.semanticLineage.semanticSourceVersion;
assert.throws(() => compileTaskDecomposition(badLineage, { governedInputContentHash: HASH }), /semanticSourceVersion/, 'missing semantic lineage must fail closed');

const badContract = decomposition();
badContract.contractVersion = '2.0.0';
assert.throws(() => compileTaskDecomposition(badContract, { governedInputContentHash: HASH }), /Unsupported Work Decomposition contract version/, 'unsupported upstream contract must fail closed');

assert.throws(() => compileTaskDecomposition(decomposition(), { governedInputContentHash: 'not-a-hash' }), /content hash/i, 'missing governed input hash must fail closed');

const mismatchedTuple = { moduleId, moduleVersion: '9.8', decompositions: { 'A5-01': decomposition('A5-01') } };
assert.throws(() => compileBundle(mismatchedTuple, { governedInputContentHash: HASH }), /does not match bundle tuple/, 'module/version mismatch must fail closed');

// ------------------------------------------------------------ verifier rejects
const reject = (mutate, pattern, message) => {
  const broken = JSON.parse(JSON.stringify(compiled));
  mutate(broken);
  const result = verifyCompilation(broken);
  assert.ok(!result.ok, message);
  assert.ok(result.violations.some(v => pattern.test(v)), `${message} (violations: ${result.violations.join(' | ')})`);
};

reject(c => { c.definitions[0].executability.status = 'BLOCKED_BY_CLIENT_BINDING'; }, /only EXECUTOR_READY/, 'blocked status must be rejected');
reject(c => { c.definitions[0].executability.independentExecutorProofStatus = 'PROVEN'; }, /independentExecutorProofStatus/, 'executor proof must not be claimable');
reject(c => { c.definitions[0].provenance.governedInputContentHash = 'b'.repeat(64); }, /does not match the governed upstream input/, 'lineage anchor mismatch must be rejected');
reject(c => { c.definitions[0].lineage.daughterVersion = '9.8'; }, /daughterVersion does not match/, 'effective version drift must be rejected');
reject(c => { c.definitions[0].lineage.workUnitPath = ['W1', 'W2']; }, /terminate at sourceWorkUnitId/, 'broken lineage path must be rejected');
reject(c => { c.definitions[0].lineage.unitType = 'INVENTED_TYPE'; }, /not a governed unit type/, 'unknown unit types must be rejected');
reject(c => { c.definitions[1] = JSON.parse(JSON.stringify(c.definitions[0])); }, /duplicate workDefinitionId/, 'duplicate ids must be rejected');
reject(c => { c.totals.workDefinitionCount = 99; }, /totals.workDefinitionCount/, 'asserted totals must be rejected');
reject(c => { c.coverage[0].compiledCount = 5; }, /compiledCount/, 'coverage arithmetic must be enforced');
reject(c => { c.coverage[0].coverageStatus = 'FULLY_COMPILED'; }, /coverageStatus/, 'dishonest coverage status must be rejected');
reject(c => { c.coverage[0].notCompiled[0].requiredClientBindings = []; }, /governed blocker reference/, 'blocked leaves must retain blocker references');
reject(c => { c.definitions[0].clientBindingRequirements = ['SOMETHING-ELSE']; }, /must mirror/, 'binding requirement drift must be rejected');
reject(c => { c.definitions[0].executionCharacteristics.clientBindingRequired = true; }, /clientBindingRequired disagrees/, 'derived characteristics must agree with governed facts');
reject(c => { c.definitions[0].executionCharacteristics.executorClassBound = true; }, /executorClassBound disagrees/, 'executor class binding must not be overstated');

// ------------------------------------------- forbidden runtime / client leakage
for (const [key, label] of [
  ['malkomProjection', 'Malkom projection'],
  ['queue', 'runtime queue'],
  ['subQueue', 'runtime sub-queue'],
  ['clientFieldMapping', 'client field mapping'],
  ['clientApplication', 'client application'],
  ['runtimeMappings', 'runtime mappings'],
  ['agentPrompt', 'agent prompt'],
  ['endpoint', 'runtime endpoint']
]) {
  const leaked = JSON.parse(JSON.stringify(compiled.definitions[0]));
  leaked[key] = 'x';
  const result = verifyWorkDefinition(leaked, null);
  assert.ok(!result.ok, `${label} must be rejected at top level`);
  assert.ok(result.violations.some(v => /forbidden runtime\/client key|unknown top-level property/.test(v)), `${label} must be reported`);
}

// nested leakage at depth must also be caught
const nested = JSON.parse(JSON.stringify(compiled.definitions[0]));
nested.actions = [{ step: 'do', binding: { clientFieldMapping: 'SEFL.FIELD_17' } }];
const nestedResult = verifyWorkDefinition(nested, null);
assert.ok(!nestedResult.ok && nestedResult.violations.some(v => /forbidden runtime\/client key/.test(v)), 'nested client mapping must be rejected at any depth');

// ------------------------------------------------------- neutrality of the code
const compilerSource = fs.readFileSync(new URL('../lib/compile/workdefinition-compiler.js', import.meta.url), 'utf8');
const verifierSource = fs.readFileSync(new URL('../lib/compile/workdefinition-verifier.js', import.meta.url), 'utf8');
for (const [name, source] of [['compiler', compilerSource], ['verifier', verifierSource]]) {
  assert.doesNotMatch(source, /road-ltl/i, `${name} must remain daughter-neutral`);
  assert.doesNotMatch(source, /LTL-\d/i, `${name} must not hardcode task semantics`);
  assert.doesNotMatch(source, /ocean-fcl|ocean-lcl/i, `${name} must remain mode-neutral`);
}
assert.match(compilerSource, /EXECUTOR_READY/, 'compilation gate must remain explicit');
assert.equal(COMPILER_VERSION, 'atlas-workdefinition-compiler-1.0.0', 'compiler version must be pinned for provenance');

// ------------------------------------------- schema realization stays in step
const schema = JSON.parse(fs.readFileSync(new URL('../schemas/canonical-workdefinition-contract-v1.schema.json', import.meta.url), 'utf8'));
assert.equal(schema.properties.schemaVersion.const, 'atlas-canonical-workdefinition-v1', 'schema must pin the contract schemaVersion');
assert.equal(schema.properties.contractVersion.const, '1.0.0', 'schema must pin the contract version');
assert.equal(schema.additionalProperties, false, 'schema must be closed against unknown canonical properties');
assert.equal(schema.$defs.executability.properties.status.const, 'EXECUTOR_READY', 'schema must permit only executor-ready compilation');
assert.equal(schema.$defs.provenance.properties.compiledFrom.const, 'CANONICAL_WORK_DECOMPOSITION_V1', 'schema must pin the governed upstream');

// every property the compiler emits must be declared by the schema, and vice versa
const schemaProps = new Set(Object.keys(schema.properties));
for (const key of Object.keys(compiled.definitions[0])) {
  assert.ok(schemaProps.has(key), `compiler emits '${key}' which the schema does not declare`);
}
const verifierAllowed = new Set([...verifierSource.matchAll(/ALLOWED_TOP_LEVEL = new Set\(\[([\s\S]*?)\]\)/g)]
  .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])));
assert.deepEqual([...verifierAllowed].sort(), [...schemaProps].sort(), 'verifier and JSON Schema must declare identical canonical properties');

console.log('P6.2 Canonical WorkDefinition compiler/verifier certification PASS');
