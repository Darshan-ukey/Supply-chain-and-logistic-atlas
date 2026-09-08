import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { auditOwnership, derivabilityFromModuleIdentity, collectDefinitions, LAYERS, EXCLUDED_EVIDENCE_PATHS } from '../tools/references/audit-reference-ownership.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D = JSON.parse(fs.readFileSync('governance/recovery/R0.1C/REFERENCE_OWNERSHIP_DETERMINATION.json', 'utf8'));
const A = JSON.parse(fs.readFileSync('data/references/reference-ownership-audit.json', 'utf8'));
const CW = 'data/crosswalks/process-concept-crosswalk-v1.json';
const UP = 'data/universe/r0-1a-r/universe-semantic-payload.json';
const cw = JSON.parse(fs.readFileSync(CW, 'utf8'));
const universe = JSON.parse(fs.readFileSync(UP, 'utf8'));

// ---- required status language preserved verbatim -------------------------------------
assert.equal(D.canonicalReferenceResolution, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT');
assert.equal(universe.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
  'the governed payload status must not be promoted by this stage');

// ---- audit is reproducible from evidence ----------------------------------------------
const live = auditOwnership({
  roots: ['data', 'governance'], universePayloadPath: UP, crosswalkPath: CW, warehousePath: 'data/atlas-warehouse-v1.json'
});
const byClass = c => live.classes.find(x => x.identifierClass === c);
assert.equal(byClass('a5').referencedCount, A.classes.find(c => c.identifierClass === 'a5').referencedCount,
  'committed audit must be reproducible');
assert.equal(byClass('scp').referencedCount, A.classes.find(c => c.identifierClass === 'scp').referencedCount);
for (const [p, h] of Object.entries(D.auditInputs)) assert.equal(sha(p), h, `audit input hash must match: ${p}`);

// ---- a5-* : Daughter-local, evidence-based ---------------------------------------------
const a5 = byClass('a5');
assert.deepEqual(Object.keys(a5.byLayer), ['DAUGHTER_LOCAL'], 'every a5-* must classify as daughter-local');
assert.deepEqual(a5.definitionSites, [], 'a5-* must have no definition site anywhere in governed custody');
assert.equal(collectDefinitions(['data', 'governance'], /^a5-/).size, 0);
const der = derivabilityFromModuleIdentity('data/atlas-warehouse-v1.json');
assert.equal(der.allDerivable, true, 'daughter-local claim rests on full derivability');
assert.equal(der.derivableCount, der.sampleSize);
assert.ok(der.sampleSize >= 82, 'derivability must be checked across the whole identifier space');
for (const i of a5.identifiers) assert.equal(i.presentInUniversePayload, false, `${i.identifier} must not be in the Universe payload`);
assert.equal(D.A_a5_ownership.defectClassification, 'NOT_A_REFERENCE_DEFECT');

// ---- scp-* : cross-layer contract, zero orphans -------------------------------------------
const scp = byClass('scp');
assert.deepEqual(Object.keys(scp.byLayer), ['CROSS_LAYER_CONTRACT']);
assert.deepEqual(scp.definitionSites, [`${CW}::conceptId`], 'scp-* must be defined in the governed crosswalk');
const defined = new Set(cw.concepts.map(c => c.conceptId));
for (const i of scp.identifiers) assert.ok(defined.has(i.identifier), `${i.identifier} must be defined, not orphaned`);
assert.equal(scp.identifiers.filter(i => i.governingLayer === 'ORPHAN').length, 0);
for (const c of cw.concepts) assert.equal(c.definitionStatus, 'ATLAS_CANONICAL_CROSS_MODULE_CONCEPT');
// anchored to Universe domains without being defined there
const domains = new Set(universe.structures.domains.map(d => d.id));
for (const c of cw.concepts) assert.ok(domains.has(c.enterpriseTerritory),
  `enterpriseTerritory '${c.enterpriseTerritory}' must resolve to a Universe domain id`);
for (const i of scp.identifiers) assert.equal(i.presentInUniversePayload, false);

// ---- true defects distinguished from valid identifiers --------------------------------------
const d = D.D_trueDefectsVersusValidIdentifiers;
assert.equal(d.trueReferenceDefects, 0);
assert.equal(d.orphans, 0);
assert.equal(live.classes.flatMap(c => c.identifiers).filter(i => i.governingLayer === 'ORPHAN').length, 0,
  'audit must report zero orphans if the determination claims zero');
// the Ocean gap is recorded as coverage, not as a reference defect
const gap = d.openCoverageGaps.find(g => g.id === 'GAP-OCEAN-CONCEPT-MAPPING');
assert.ok(gap && gap.isReferenceDefect === false, 'Ocean coverage gap must not be miscast as a reference defect');
assert.equal(cw.rules.futureModuleMappingsRequiredForA5Compare, true, 'the gap must rest on the crosswalk\'s own rule');
for (const f of ['data/modules/ocean-fcl-v0.5.json', 'data/modules/ocean-lcl-v0.5.json']) {
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).processConceptMappings, undefined,
    'Ocean modules must genuinely lack concept mappings for the gap to be real');
}

// ---- no mutation, no invention ---------------------------------------------------------------
assert.match(D.E_recommendedRepairTypeNoMutation.note, /Recommendations only/i);
for (const r of D.E_recommendedRepairTypeNoMutation.recommendations) assert.ok(r.id && r.repairType && r.action);
for (const [k, v] of Object.entries(D.promotion)) assert.ok(['NOT_PERFORMED', 'UNCHANGED'].includes(v), `promotion: ${k}=${v}`);
assert.ok(D.outOfScopeConfirmations.some(c => /No crosswalk invented/i.test(c)));
assert.ok(D.outOfScopeConfirmations.some(c => /No canonical ID created/i.test(c)));
// the crosswalk must be untouched evidence, not authored here
assert.equal(String(cw.schemaVersion), '1.0', 'crosswalk schema must be the pre-existing governed one');
assert.ok(cw.concepts.every(c => c.sourceModuleSeed && c.sourceProcessId), 'crosswalk concepts must retain their original seed provenance');
// audit tool must not create identifiers
const toolSrc = fs.readFileSync('tools/references/audit-reference-ownership.mjs', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
assert.doesNotMatch(toolSrc, /writeFileSync\([^)]*crosswalk/i, 'audit tool must never write a crosswalk');
assert.ok(Object.keys(LAYERS).includes('ORPHAN'), 'orphan must remain a reachable classification');

// ---- the audit must not read its own output (self-reference regression) -------------------
// Its findings quote the very identifiers it inventories, so scanning them would make the
// counts change once the audit is committed.
for (const p of ['data/references', 'governance/recovery']) {
  assert.ok(EXCLUDED_EVIDENCE_PATHS.includes(p), `${p} must be excluded from the evidence scan`);
}
assert.ok(fs.existsSync('data/references/reference-ownership-audit.json'));
const auditBlob = fs.readFileSync('data/references/reference-ownership-audit.json', 'utf8');
assert.ok(/a5-ltl-01/.test(auditBlob) && /scp-/.test(auditBlob),
  'the audit output does quote identifiers, which is why it must be excluded');
const rerun = auditOwnership({
  roots: ['data', 'governance'], universePayloadPath: UP, crosswalkPath: CW, warehousePath: 'data/atlas-warehouse-v1.json'
});
assert.equal(rerun.classes.find(c => c.identifierClass === 'a5').referencedCount,
  A.classes.find(c => c.identifierClass === 'a5').referencedCount,
  'audit counts must be stable with its own committed output present');
assert.equal(rerun.classes.find(c => c.identifierClass === 'scp').referencedCount,
  A.classes.find(c => c.identifierClass === 'scp').referencedCount);
for (const c of rerun.classes) for (const i of c.identifiers) {
  for (const ref of i.referencedBy) {
    assert.ok(!EXCLUDED_EVIDENCE_PATHS.some(x => ref.startsWith(x)),
      `reference evidence must come from source artifacts, not audit records: ${ref}`);
  }
}

assert.ok(!fs.existsSync('governance/recovery/R0.1C/POST_QA_GOVERNED_STATE.json'),
  'Checkpoint C is not written by the implementation agent');

console.log('R0.1C reference ownership audit certification PASS');
