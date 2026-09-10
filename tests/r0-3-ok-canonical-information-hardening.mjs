import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  composeEffectiveOperationalKnowledge, assessCoverage, buildObjectRegister,
  buildInformationResolutionCoverage, buildKnowledgeGapQueue, canonicalHash, SURFACES,
} from '../tools/r0-3/ok-hardening.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const MODULE = 'data/modules/road-ltl-v1.4.json';
const OK_BASE = 'data/operational-knowledge/road-ltl-v1.4-operational.json';
const OK_OVERLAY = 'data/operational-knowledge/road-ltl-v1.5-operational.json';
const OK_CONTRACT = 'schemas/operational-knowledge-contract-v2.json';
const IR_CONTRACT = 'schemas/information-resolution-contract-v1.json';
const BOL = 'data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json';

const A = J('governance/recovery/R0.3/PRE_CHANGE_BASELINE.json');
const MATRIX = 'governance/recovery/R0.3/OK_COVERAGE_MATRIX.json';
const REGISTER = 'governance/recovery/R0.3/CANONICAL_OBJECT_DOCUMENT_REGISTER.json';
const IRCOV = 'governance/recovery/R0.3/INFORMATION_RESOLUTION_COVERAGE.json';
const GAPS = 'governance/recovery/R0.3/KNOWLEDGE_GAP_QUEUE.json';
const EFFECTIVE_OK = 'data/operational-knowledge/derived/effective-road-ltl-1.5-operational-knowledge.json';

// =============================================================================
// 1. FROZEN SOURCE INTEGRITY — R0.3 must not have mutated any upstream asset.
// =============================================================================
const baselineHash = Object.fromEntries(A.assets.map(a => [a.repositoryPath, a.sha256]));
for (const a of A.assets) {
  assert.ok(fs.existsSync(a.repositoryPath), `Checkpoint A input must still resolve: ${a.repositoryPath}`);
  assert.equal(sha(a.repositoryPath), a.sha256,
    `R0.3 must not mutate a governed input: ${a.repositoryPath}`);
}
// The R0.2-certified hashes specifically.
assert.equal(sha(OK_BASE), '6e5899b2c31f7458a7959ead18950911ea916a366ac28d2aeee7077855dac13e',
  '1.4 Operational Knowledge must remain byte-identical to the R0.2-certified payload');
assert.equal(sha(MODULE), 'c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4',
  'Road LTL 1.4 module must remain byte-identical to the R0.2-certified payload');
assert.equal(sha('data/road-ltl/effective-road-ltl-1.5-materialization.json'),
  'a303d30d1c415d0bbfa9efab27ae1ac1edcd32fffb5f9e236e8c1ebf629bf7f6',
  'R0.2-certified effective materialization must remain byte-identical');

// =============================================================================
// 2. R0.2 LINEAGE REGRESSION — effective 1.5 is still 21 inherited + LTL-03 override.
// =============================================================================
const comp = composeEffectiveOperationalKnowledge({
  modulePath: MODULE, okBasePath: OK_BASE, okOverlayPath: OK_OVERLAY,
});
assert.equal(comp.composed.length, 22, 'effective Road LTL 1.5 must carry exactly 22 tasks');
assert.equal(comp.inheritedCount, 21, 'exactly 21 tasks must be inherited unchanged from 1.4');
assert.equal(comp.overriddenCount, 1, 'exactly 1 task must be a direct governed 1.5 override');
assert.deepEqual(comp.overriddenTaskIds, ['LTL-03'], 'the single override must be LTL-03');
assert.deepEqual(comp.orphanOkTaskIds, [], 'no Operational Knowledge task may be orphaned from the module');

const eff = J(EFFECTIVE_OK);
assert.equal(eff.inheritance.agreesWithR02CertifiedEffectiveMaterialization, true,
  'composed task set must agree with the R0.2-certified effective materialization');
assert.equal(eff.status, 'DERIVED_VIEW_NOT_A_SOURCE_OF_TRUTH',
  'the derived view must never present itself as a source of truth');

// Fail closed rather than guess if the governed inheritance policy ever changes.
assert.throws(
  () => composeEffectiveOperationalKnowledge({ modulePath: MODULE, okBasePath: OK_BASE, okOverlayPath: OK_CONTRACT }),
  /failed closed|inheritancePolicy/i,
  'an unexpected overlay must fail closed, not be interpreted',
);

// =============================================================================
// 3. DUAL SURFACE — both views exist and neither replaces the other.
// =============================================================================
const m = J(MATRIX);
assert.equal(m.schemaVersion, 'atlas-ok-coverage-matrix-v2');
assert.ok(m.composedSurface && m.okOnlySurface, 'both measurement surfaces must be reported');
assert.equal(m.composedSurface.surface, 'COMPOSED');
assert.equal(m.okOnlySurface.surface, 'OK_ONLY');
assert.match(m.evaluationBasis, /COMPOSED/,
  'the matrix must state that the governed evaluation is the composed surface');
assert.ok(m.composedSurface.layers.includes(MODULE),
  'the composed surface must include the governed module layer');
assert.ok(!m.okOnlySurface.layers.includes(MODULE),
  'the OK-only surface must exclude the module layer');
assert.equal(m.scope.taskCount, 22);
assert.equal(m.scope.assessedCells, m.scope.taskCount * m.scope.contractAttributeCount);

// Every cell is accounted for in exactly one of the four statuses, on each surface.
for (const s of [m.composedSurface, m.okOnlySurface]) {
  const t = s.totals;
  assert.equal(
    t.satisfiedDirect + t.satisfiedByDeclaredEquivalent + t.presentNestedOnly + t.absent,
    m.scope.assessedCells,
    `${s.surface}: every assessed cell must carry exactly one status`,
  );
}

// The composed surface must satisfy strictly more than the OK-only surface — that is the
// correction R0.3 exists to make explicit.
const satOf = s => s.totals.satisfiedDirect + s.totals.satisfiedByDeclaredEquivalent;
assert.ok(satOf(m.composedSurface) > satOf(m.okOnlySurface),
  'composing the governed module layer must resolve attributes the OK payload alone lacks');
assert.ok(m.surfaceDelta.satisfiedOnlyWhenComposed.length > 0,
  'the surface delta must name the attributes carried by the module layer');

// =============================================================================
// 4. COMPLIANCE RULE — nested-only and absent are never counted as satisfied.
// =============================================================================
for (const s of [m.composedSurface, m.okOnlySurface]) {
  for (const t of s.byTask) {
    const sat = t.contractAttributes.filter(
      r => r.status === 'SATISFIED_DIRECT' || r.status === 'SATISFIED_BY_DECLARED_EQUIVALENT');
    assert.equal(sat.length, t.satisfiedDirect + t.satisfiedByDeclaredEquivalent,
      `${s.surface}/${t.taskId}: satisfied counts must come only from the two satisfied statuses`);
    for (const r of t.contractAttributes) {
      if (r.status === 'ABSENT') {
        assert.ok(t.absentAttributes.includes(r.attribute),
          `${s.surface}/${t.taskId}: an ABSENT cell must appear in absentAttributes (${r.attribute})`);
      }
      if (r.status === 'PRESENT_NESTED_ONLY_NOT_TASK_LEVEL') {
        assert.ok(t.nestedOnlyAttributes.includes(r.attribute),
          `${s.surface}/${t.taskId}: a nested-only cell must appear in nestedOnlyAttributes (${r.attribute})`);
        assert.ok(r.path, 'a nested-only cell must name where the value actually sits');
      }
      if (r.status === 'PRESENT_NESTED_ONLY_NOT_TASK_LEVEL' || r.status === 'ABSENT') {
        assert.notEqual(r.status, 'SATISFIED_DIRECT');
        assert.notEqual(r.status, 'SATISFIED_BY_DECLARED_EQUIVALENT');
      }
      // A declared equivalent must always carry its named basis, so QA can reject it.
      if (r.status === 'SATISFIED_BY_DECLARED_EQUIVALENT') {
        assert.ok(r.equivalenceBasis && r.equivalenceBasis.length > 20,
          `${t.taskId}/${r.attribute}: a declared equivalent must state its basis`);
        assert.ok(r.path, 'a declared equivalent must name the exact governed path');
      }
      if (r.status === 'ABSENT') {
        assert.equal(r.path, null, 'an absent attribute must not claim a path');
      }
    }
  }
}
assert.match(m.complianceRule, /NOT converted into compliant/i);

// =============================================================================
// 5. GAPS PRESERVED — R0.3 hardens representation; it never manufactures semantics.
// =============================================================================
const reg = J(REGISTER);
assert.equal(reg.objectCount, 66, '66 canonical obj-* identifiers must be collected from governed bytes');
assert.equal(reg.objectsWithCanonicalContract, 0,
  'no object may claim a canonical object contract that no governed asset provides');
for (const o of reg.objects) {
  for (const f of ['businessMeaning', 'relationships', 'cardinality', 'lifecycleOrStateWhereRelevant', 'sourceClaims']) {
    assert.equal(o[f], null, `${o.canonicalObjectId}.${f} must stay null; R0.3 must not invent object semantics`);
  }
  assert.equal(o.objectSemanticsStatus, 'REFERENCED_WITHOUT_CANONICAL_OBJECT_CONTRACT');
}
assert.ok(reg.documentCount > 0, 'declared document identifiers must be collected');

const ir = J(IRCOV);
assert.equal(ir.fieldCount, 76, 'all 76 BOL baseline fields must be carried');
assert.equal(ir.fieldsWithConformantContract, 0,
  'no BOL field may claim a conformant Information Resolution contract that does not exist');
for (const f of ir.fields) {
  assert.equal(f.contractRecordPresent, false);
  assert.equal(f.conformance, 'ABSENT');
  assert.equal(f.satisfiedRequiredProperties, 0);
}
assert.equal(ir.researchedCanonicalObjectModel.promotedToCanonicalObjectContracts, false,
  'the researched BOL object model must not be promoted to canonical contracts by this stage');
assert.equal(ir.researchedCanonicalObjectModel.status, 'DRAFT_RESEARCHED_NOT_PROMOTED');
assert.equal(ir.unresolvedSemanticLabels.length, 10,
  'all 10 unresolved BOL semantic labels must be preserved individually');
assert.match(ir.metricIntegrityNote, /not canonical truth/i,
  'runtime-observed metrics must be explicitly excluded from canonical truth');

// Every unresolved label survives into the gap queue as its own open item.
const gaps = J(GAPS);
assert.equal(gaps.schemaVersion, 'atlas-knowledge-gap-queue-v1.0');
for (const g of gaps.items) {
  for (const k of ['id', 'kind', 'status', 'moduleId', 'createdAt', 'basis']) {
    assert.ok(g[k], `gap ${g.id ?? '?'} must carry required field ${k}`);
  }
  assert.equal(g.status, 'OPEN', 'R0.3 may not close a knowledge gap it did not resolve');
  assert.equal(g.moduleId, 'road-ltl');
}
for (const u of ir.unresolvedSemanticLabels) {
  assert.ok(gaps.items.some(g => g.context?.label === u.label),
    `unresolved BOL label must be preserved as a gap: ${u.label}`);
}
assert.ok(gaps.items.some(g => g.id === 'R0.3-GAP-OBJECT-SEMANTICS'));
assert.ok(gaps.items.some(g => g.id === 'R0.3-GAP-IR-FIELD-CONTRACTS'));

// =============================================================================
// 6. DETERMINISM — regenerate and require byte-identical artifacts and stable hashes.
// =============================================================================
const before = Object.fromEntries([MATRIX, REGISTER, IRCOV, GAPS, EFFECTIVE_OK].map(p => [p, sha(p)]));
const beforeSemantic = { matrix: m.semanticHash, register: reg.semanticHash, ir: ir.semanticHash };

execFileSync(process.execPath, ['tools/r0-3/run-r0-3-hardening.mjs'], { stdio: 'pipe' });

for (const [p, h] of Object.entries(before)) {
  assert.equal(sha(p), h, `regeneration must be byte-identical: ${p}`);
}
assert.equal(J(MATRIX).semanticHash, beforeSemantic.matrix, 'coverage semantic hash must be stable');
assert.equal(J(REGISTER).semanticHash, beforeSemantic.register, 'object register semantic hash must be stable');
assert.equal(J(IRCOV).semanticHash, beforeSemantic.ir, 'IR coverage semantic hash must be stable');

// In-memory determinism too: same inputs, same canonical hash, independent of file IO.
const twice = [0, 1].map(() => {
  const c = composeEffectiveOperationalKnowledge({ modulePath: MODULE, okBasePath: OK_BASE, okOverlayPath: OK_OVERLAY });
  return canonicalHash({
    composed: assessCoverage({ contract: J(OK_CONTRACT), composition: c, surface: 'COMPOSED' }),
    okOnly: assessCoverage({ contract: J(OK_CONTRACT), composition: c, surface: 'OK_ONLY' }),
    objects: buildObjectRegister(c),
    ir: buildInformationResolutionCoverage({ irContract: J(IR_CONTRACT), bolBaseline: J(BOL) }),
  });
});
assert.equal(twice[0], twice[1], 'two independent derivations must produce the same canonical hash');

// Artifacts must be reproducible from declared inputs: no wall-clock value may leak in.
for (const p of [MATRIX, REGISTER, IRCOV, EFFECTIVE_OK]) {
  const raw = fs.readFileSync(p, 'utf8');
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw),
    `${p} must contain no wall-clock timestamp, or it cannot be byte-reproducible`);
}

// Declared provenance must be truthful: every recorded input hash must match on disk.
for (const [p, h] of Object.entries(J(MATRIX).provenance.inputs)) {
  assert.equal(sha(p), h, `declared provenance hash must match the governed input: ${p}`);
  if (baselineHash[p]) assert.equal(h, baselineHash[p], `provenance must agree with Checkpoint A: ${p}`);
}

// =============================================================================
// 7. SCOPE GUARD — R0.3 stays inside its authorized boundary.
// =============================================================================
assert.equal(SURFACES.OK_ONLY.layers.includes('module'), false);
// Compare the governance baseline against the WORKING TREE, not merely HEAD: an
// uncommitted edit to a governed pointer must fail this guard, not slip past it.
const changed = [
  ...execFileSync('git', ['diff', '--name-only', 'origin/atlas-governance-registry-v2.1'],
    { encoding: 'utf8' }).split('\n'),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'],
    { encoding: 'utf8' }).split('\n'),
].filter(Boolean).sort();
assert.ok(changed.length > 0, 'the scope guard must actually be comparing something');
for (const f of changed) {
  assert.ok(
    f.startsWith('governance/recovery/R0.3/') ||
    f.startsWith('tools/r0-3/') ||
    f.startsWith('tests/r0-3') ||
    f.startsWith('.github/workflows/r0-3') ||
    f === EFFECTIVE_OK,
    `R0.3 changed a file outside its authorized surface: ${f}`,
  );
}
for (const forbidden of ['governance/frozen-assets/CURRENT.json', 'governance/frozen-assets/LATEST.md',
  'governance/frozen-assets/ASSET_REGISTER.json', 'governance/backlog/ATLAS_V2_AGENT_EXECUTION_QUEUE.json']) {
  assert.ok(!changed.includes(forbidden),
    `R0.3 must not touch a governed pointer or the queue: ${forbidden}`);
}
for (const stage of ['R0.1A', 'R0.1A-R', 'R0.1B', 'R0.1C', 'R0.2']) {
  assert.ok(!changed.some(f => f.startsWith(`governance/recovery/${stage}/`)),
    `R0.3 must not mutate historical stage evidence: ${stage}`);
}

console.log(`R0.3 Operational Knowledge + canonical information hardening PASS`);
console.log(`  composed surface : ${JSON.stringify(m.composedSurface.totals)}`);
console.log(`  ok-only surface  : ${JSON.stringify(m.okOnlySurface.totals)}`);
console.log(`  objects ${reg.objectCount}/${reg.objectsWithCanonicalContract} contracted | BOL fields ${ir.fieldCount}/${ir.fieldsWithConformantContract} conformant | gaps ${gaps.items.length} OPEN`);
