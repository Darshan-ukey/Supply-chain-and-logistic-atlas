import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertCertifiedInput, reconcileCompilation, CertificationError } from '../lib/compile/p6-1-certification-gate.js';

const CERT = 'governance/baselines/P6_1_RECURSIVE_WORK_DECOMPOSITION_CERTIFICATION.json';
const SUM = 'governance/presentation/P6_1_PUBLIC_DECOMPOSITION_SUMMARY.json';
const HASH = '2c26e760ff6a5b3d4a0500d22f79b531a92fb8380d5b31d2a60b8b49506092ab';
const base = { moduleId: 'road-ltl', moduleVersion: '1.5', governedInputContentHash: HASH, certificationPath: CERT, summaryPath: SUM };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-2-gate-'));
const write = (name, obj) => { const p = path.join(tmp, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; };
const cert = () => JSON.parse(fs.readFileSync(CERT, 'utf8'));
const summary = () => JSON.parse(fs.readFileSync(SUM, 'utf8'));

const denies = (args, pattern, message) => {
  assert.throws(() => assertCertifiedInput({ ...base, ...args }), e => {
    assert.ok(e instanceof CertificationError, `${message}: must raise CertificationError`);
    assert.match(e.message, pattern, `${message}: got "${e.message}"`);
    return true;
  }, message);
};

// ------------------------------------------------------------ happy path
const attestation = assertCertifiedInput(base);
assert.equal(attestation.attested, true);
assert.equal(attestation.certifiedContentHash, HASH);
assert.equal(attestation.effectiveModuleVersion, '1.5', 'effective version must be 1.5');
assert.equal(attestation.semanticBaseVersion, '1.4', 'semantic base must remain pinned at 1.4');
assert.equal(attestation.expected.taskCount, 22);
assert.equal(attestation.expected.workUnitCount, 603);
assert.equal(attestation.expected.leafCount, 444);
assert.equal(attestation.expected.executorReadyLeafCount, 185);
assert.equal(attestation.expected.blockedByClientBindingLeafCount, 163);
assert.equal(attestation.expected.blockedByKnowledgeGapLeafCount, 96);
assert.equal(attestation.tasks.length, 22);
assert.ok(Object.isFrozen(attestation), 'attestation must be immutable');
// pinned hash accepted when it agrees
assert.equal(assertCertifiedInput({ ...base, pinnedContentHash: HASH }).attested, true);

// -------------------------------------------------- 1. MISSING ORACLE FAILS
denies({ certificationPath: path.join(tmp, 'nope.json') }, /certification record is missing/i, 'missing certification record must fail');
denies({ summaryPath: path.join(tmp, 'nope.json') }, /summary is missing/i, 'missing decomposition summary must fail');
denies({ certificationPath: null }, /path is not configured/i, 'unconfigured certification path must fail');
denies({ summaryPath: undefined }, /path is not configured/i, 'unconfigured summary path must fail');
const corrupt = path.join(tmp, 'corrupt.json'); fs.writeFileSync(corrupt, '{not json');
denies({ certificationPath: corrupt }, /not valid JSON/i, 'unparseable certification must fail');

// ---------------------------------------------------- 2. WRONG TUPLE FAILS
denies({ moduleId: 'ocean-fcl' }, /Certification moduleId/, 'wrong module must fail');
denies({ moduleVersion: '1.4' }, /Certification moduleVersion/, 'wrong version must fail — no 1.4 fallback');
denies({ moduleId: '' }, /Exact moduleId and moduleVersion are required/, 'empty module must fail');
{
  const c = cert(); c.moduleVersion = '1.4';
  denies({ certificationPath: write('tuple-cert.json', c) }, /Certification moduleVersion/, 'certification tuple drift must fail');
}
{
  const s = summary(); s.moduleId = 'ocean-lcl';
  denies({ summaryPath: write('tuple-sum.json', s) }, /summary moduleId/, 'summary tuple drift must fail');
}

// ----------------------------------------------------- 3. WRONG HASH FAILS
denies({ governedInputContentHash: 'b'.repeat(64) }, /content hash vs certified decomposition hash/, 'store hash mismatch must fail');
denies({ pinnedContentHash: 'c'.repeat(64) }, /operator-pinned hash/, 'operator-pinned hash mismatch must fail');
denies({ governedInputContentHash: 'deadbeef' }, /not a 64-hex digest/, 'malformed hash must fail');
{
  const c = cert(); c.protectedBundle.protectedStoreContentHash = 'd'.repeat(64);
  denies({ certificationPath: write('hash-cert.json', c) }, /content hash vs certified decomposition hash/, 'tampered certified hash must fail');
}
{
  const c = cert(); delete c.protectedBundle.protectedStoreContentHash;
  denies({ certificationPath: write('nohash-cert.json', c) }, /no valid protectedStoreContentHash/, 'absent certified hash must fail');
}

// ------------------------------------- governed evidence must agree and be complete
{
  const s = summary(); s.totals.executorReadyLeafCount = 184;
  denies({ summaryPath: write('disagree.json', s) }, /Governed evidence disagrees on executorReadyLeafCount/, 'artifact disagreement must fail');
}
{
  const s = summary(); s.tasks = s.tasks.slice(0, 21);
  denies({ summaryPath: write('short.json', s) }, /lists 21 tasks, certified 22/, 'task-count drift must fail');
}
{
  const s = summary(); s.tasks[0].executorReadyLeafCount += 1;
  denies({ summaryPath: write('sum.json', s) }, /Per-task executor-ready counts sum/, 'per-task sum drift must fail');
}
{
  const c = cert(); c.status = 'PARTIAL';
  denies({ certificationPath: write('status.json', c) }, /Certification status/, 'uncertified status must fail');
}
{
  const c = cert(); c.invariants.cycleCount = 1;
  denies({ certificationPath: write('cycles.json', c) }, /invariants.cycleCount/, 'certified cycles must fail');
}
{
  const c = cert(); c.invariants.exactVersionRuntimeFallbackPermitted = true;
  denies({ certificationPath: write('fallback.json', c) }, /permits runtime version fallback/, 'permitted version fallback must fail');
}
{
  const c = cert(); delete c.sourceLineage.semanticBaseVersion;
  denies({ certificationPath: write('lineage.json', c) }, /sourceLineage.semanticBaseVersion is missing/, 'missing semantic lineage must fail');
}

// ------------------------------------------- 4. --persist CANNOT BYPASS THE GATE
const good = {
  moduleId: 'road-ltl', moduleVersion: '1.5', governedInputContentHash: HASH,
  totals: { taskCount: 22, workUnitCount: 603, leafCount: 444, workDefinitionCount: 185, blockedByClientBindingLeafCount: 163, blockedByKnowledgeGapLeafCount: 96 },
  coverage: attestation.tasks.map(t => ({ sourceTaskId: t.taskId, leafCount: t.leafCount, compiledCount: t.executorReadyLeafCount }))
};
const reconciled = reconcileCompilation(attestation, good);
assert.equal(reconciled.reconciled, true);
assert.equal(reconciled.workDefinitionCount, 185);

// a forged or absent attestation cannot unlock reconciliation
for (const forged of [null, undefined, {}, { attested: false }, { attested: 'true' }]) {
  assert.throws(() => reconcileCompilation(forged, good), /valid upstream certification attestation/, 'forged attestation must be refused');
}
// compiled output that drifts from certified counts is refused
for (const [mutate, pattern, label] of [
  [c => { c.totals.workDefinitionCount = 184; }, /workDefinitionCount \(vs certified EXECUTOR_READY\)/, 'under-count'],
  [c => { c.totals.workDefinitionCount = 186; }, /workDefinitionCount \(vs certified EXECUTOR_READY\)/, 'over-count'],
  [c => { c.totals.leafCount = 443; }, /leafCount/, 'leaf drift'],
  [c => { c.totals.blockedByKnowledgeGapLeafCount = 0; }, /blockedByKnowledgeGapLeafCount/, 'blocker suppression'],
  [c => { c.governedInputContentHash = 'e'.repeat(64); }, /Compiled governed input hash/, 'lineage anchor drift'],
  [c => { c.moduleVersion = '1.4'; }, /Compiled moduleVersion/, 'version drift'],
  [c => { c.coverage = c.coverage.slice(0, 21); }, /absent from compilation/, 'dropped task'],
  [c => { c.coverage.push({ sourceTaskId: 'LTL-99', leafCount: 1, compiledCount: 1 }); }, /not present in certified P6\.1 evidence/, 'invented task'],
  [c => { c.coverage[0].compiledCount += 1; }, /workDefinitionCount/, 'per-task drift']
]) {
  const broken = JSON.parse(JSON.stringify(good));
  mutate(broken);
  assert.throws(() => reconcileCompilation(attestation, broken), pattern, `${label} must be refused`);
}

// ------------------------------- runtime enforcement: the script, not just the tests
const script = fs.readFileSync(new URL('../scripts/compile-p6-2-work-definitions.mjs', import.meta.url), 'utf8');
assert.ok(!/existsSync\s*\(\s*oracle/i.test(script), 'the conditional oracle skip path must no longer exist');
assert.ok(!/cross-check skipped/i.test(script), 'no skip messaging may remain');
assert.match(script, /assertCertifiedInput\(\{/, 'script must invoke the certification gate at runtime');
assert.match(script, /reconcileCompilation\(attestation, compilation\)/, 'script must reconcile compiled output at runtime');
assert.match(script, /Refusing to persist/, 'script must guard the write path explicitly');

// ordering: gate and reconciliation must both precede any persistence branch
const iGate = script.indexOf('assertCertifiedInput({');
const iRec = script.indexOf('reconcileCompilation(attestation, compilation)');
const iPersist = script.indexOf('if (!persist)');
const iWrite = script.indexOf("rest('/rest/v1/atlas_work_definitions");
assert.ok(iGate > 0 && iRec > iGate, 'reconciliation must follow the gate');
assert.ok(iPersist > iRec, 'the persist branch must come after reconciliation');
assert.ok(iWrite > iPersist, 'the write must come after the persist guard');
// there must be no write to the definitions table before the gate
assert.equal(script.slice(0, iGate).includes('atlas_work_definitions'), false, 'no write path may precede certification');

console.log('P6.2 upstream certification gate certification PASS');
