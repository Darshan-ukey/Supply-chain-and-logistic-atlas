import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { materializeEffective, taskIdentityOf, canonicalHash } from '../tools/road-ltl/materialize-effective-road-ltl.mjs';
import { auditOwnership } from '../tools/references/audit-reference-ownership.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const C = JSON.parse(fs.readFileSync('governance/recovery/R0.2/ROAD_LTL_SOURCE_CLOSURE_RECORD.json', 'utf8'));
const reg = Object.fromEntries(JSON.parse(fs.readFileSync('governance/frozen-assets/ASSET_REGISTER.json', 'utf8')).assets.map(a => [a.assetId, a]));
const BASE = 'data/modules/road-ltl-v1.4.json';
const OVERLAY = 'data/modules/road-ltl-v1.5.json';

// ---- custody closed: registered assets now resolve at their registered paths -------------
assert.ok(fs.existsSync(BASE), 'road-ltl 1.4 must be in governed repository custody');
assert.equal(sha(BASE), reg['road-ltl-1.4-candidate'].sha256, 'custodied 1.4 must match its registered sha256 exactly');
// The register describes 1.4 as source=artifact-package with artifactPath (the in-package
// path) and no repositoryPath. Custody places the bytes at that same relative path; adding a
// repositoryPath to the register is a governed registration action left for QA.
assert.equal(reg['road-ltl-1.4-candidate'].artifactPath, BASE, 'custody must land at the registered artifactPath');
assert.equal(reg['road-ltl-1.4-candidate'].source, 'artifact-package',
  'R0.2 must not rewrite the register entry; registration is a governed action after QA');
assert.equal(reg['road-ltl-1.4-candidate'].repositoryPath, undefined,
  'the missing repositoryPath is the recorded custody gap, not something this stage silently fills');
for (const p of ['data/operational-knowledge/road-ltl-v1.4-operational.json',
                 'data/client-binding-requirements/road-ltl-v1.4-bindings.json',
                 'data/source-claims/road-ltl-v1.4-claims.json']) {
  assert.ok(fs.existsSync(p), `1.4 supporting asset must be custodied: ${p}`);
}
// recorded custody hashes must be truthful
for (const e of C.B_custodyClosure.roadLtl14) assert.equal(sha(e.repositoryPath), e.sha256);
for (const e of [...C.B_custodyClosure.p60DependencyClosure, ...C.B_custodyClosure.r01cToolingClosure]) {
  assert.ok(fs.existsSync(e.repositoryPath), `dependency closure path must resolve: ${e.repositoryPath}`);
  assert.equal(sha(e.repositoryPath), e.sha256);
}
assert.equal(C.B_custodyClosure.sourceBytesMutated, false);

// ---- no hash chosen by assumption ---------------------------------------------------------
assert.equal(C.A_hashReconciliation.conflictsFound, 0);
assert.equal(C.A_hashReconciliation.packageVerification.match, true);
assert.equal(C.A_hashReconciliation.packageVerification.internalManifestMismatches, 0);
assert.equal(C.A_hashReconciliation.packageVerification.registeredSha256, reg['daughter-release-ltl1.4-ocean0.6'].sha256);
for (const id of C.A_hashReconciliation.registeredAssetsPresentAndMatching) {
  const p = reg[id].repositoryPath ?? reg[id].artifactPath;
  assert.equal(sha(p), reg[id].sha256, `${id} must still match its registered hash`);
}

// ---- effective 1.5 materialization is deterministic and lineage-proven ---------------------
const a = materializeEffective({ basePath: BASE, overlayPath: OVERLAY });
const b = materializeEffective({ basePath: BASE, overlayPath: OVERLAY });
assert.equal(canonicalHash(a), canonicalHash(b), 'materialization must be deterministic');
assert.equal(a.lineage.effectiveTaskCount, 22);
assert.equal(a.lineage.inheritedUnchangedCount, 21, 'exactly 21 tasks inherit 1.4 unchanged');
assert.equal(a.lineage.directGovernedOverrideCount, 1);
assert.deepEqual(a.lineage.overriddenTaskIds, ['LTL-03']);
assert.deepEqual(a.lineage.semanticSourceVersionSpread, { '1.4': 21, '1.5': 1 });
assert.equal(a.semanticBaseVersion, '1.4');
assert.equal(a.effectiveModuleVersion, '1.5');
assert.equal(C.C_effectiveMaterialization.lineageProof.proven, true);
// lineage is derived from the recovered base, not asserted
assert.equal(a.inputs.base.sha256, reg['road-ltl-1.4-candidate'].sha256);
assert.equal(a.inputs.overlay.sha256, reg['road-ltl-1.5-candidate'].sha256);

// ---- taskId/id drift normalized in tooling only, sources untouched --------------------------
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
assert.ok(base.tasks.every(t => typeof t.taskId === 'string'), 'the 1.4 base must still use taskId');
assert.ok(overlay.taskOverrides.every(t => typeof t.id === 'string'), 'the 1.5 overlay must still use id');
assert.ok(base.tasks.every(t => t.id === undefined), 'the base must NOT have been rewritten to carry id');
assert.ok(overlay.taskOverrides.every(t => t.taskId === undefined), 'the overlay must NOT have been rewritten to carry taskId');
assert.equal(taskIdentityOf({ taskId: 'LTL-01' }), 'LTL-01');
assert.equal(taskIdentityOf({ id: 'LTL-03' }), 'LTL-03');
assert.throws(() => taskIdentityOf({}), /taskId or id/, 'a task with no identity must fail closed');
assert.equal(a.identityKeyNormalization.sourceAssetsMutated, false);
assert.equal(a.identityKeyNormalization.handledIn, 'DERIVED_TOOLING_ONLY');
// an override targeting an unknown task must fail closed, not silently add one
assert.throws(() => materializeEffective({ basePath: OVERLAY, overlayPath: OVERLAY }), /failed closed/);

// ---- reference integrity unchanged under the R0.1C model -------------------------------------
const audit = auditOwnership({
  roots: ['data', 'governance'],
  universePayloadPath: 'data/universe/r0-1a-r/universe-semantic-payload.json',
  crosswalkPath: 'data/crosswalks/process-concept-crosswalk-v1.json',
  warehousePath: 'data/atlas-warehouse-v1.json'
});
const a5 = audit.classes.find(c => c.identifierClass === 'a5');
const scp = audit.classes.find(c => c.identifierClass === 'scp');
assert.deepEqual(Object.keys(a5.byLayer), ['DAUGHTER_LOCAL']);
assert.deepEqual(Object.keys(scp.byLayer), ['CROSS_LAYER_CONTRACT']);
assert.equal(a5.referencedCount, C.D_referenceIntegrity.a5.referenced);
assert.equal(scp.referencedCount, C.D_referenceIntegrity.scp.referenced);
assert.equal(audit.classes.flatMap(c => c.identifiers).filter(i => i.governingLayer === 'ORPHAN').length, 0);
assert.equal(C.D_referenceIntegrity.r01cDeterminationsAltered, false);
// R0.1C determination must be untouched
const d = JSON.parse(fs.readFileSync('governance/recovery/R0.1C/REFERENCE_OWNERSHIP_DETERMINATION.json', 'utf8'));
assert.equal(d.A_a5_ownership.governingLayer, 'DAUGHTER_LOCAL');
assert.equal(d.B_scp_ownership.governingLayer, 'CROSS_LAYER_CONTRACT');
assert.equal(d.canonicalReferenceResolution, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT');

// ---- P6.0 re-certification recorded truthfully -------------------------------------------------
assert.equal(C.E_p60Recertification.result, 'PASS');
assert.equal(C.E_p60Recertification.gatesFailed, 0);
assert.ok(C.E_p60Recertification.gatesPassed > 400, 'P6.0 gate count must be substantive');
for (const p of ['tests/p6-0-road-ltl-1.5-effective-materialization.mjs',
                 'data/materialized/road-ltl-1.5-public-safe-projections.json.gz.b64',
                 'governance/baselines/P6_0_ROAD_LTL_1_5_SOURCE_MATERIALIZATION_CERTIFICATION.json']) {
  assert.ok(fs.existsSync(p), `P6.0 re-certification input must be custodied: ${p}`);
}

// ---- scope ---------------------------------------------------------------------------------------
// Only the promotion STATUS fields carry NOT_PERFORMED/UNCHANGED; the rest is metadata.
for (const k of ['canonicalPromotion', 'currentPointer', 'latestPointer', 'assetRegister']) {
  assert.ok(['NOT_PERFORMED', 'UNCHANGED'].includes(C.promotion[k]), `promotion: ${k}=${C.promotion[k]}`);
}
assert.ok(C.outOfScopeConfirmations.some(x => /not reconstructed from 1\.3/i.test(x)));
assert.ok(C.outOfScopeConfirmations.some(x => /No hash was selected by filename or date/i.test(x)));
assert.ok(!fs.existsSync('data/modules/ocean-fcl-v0.6.json'), 'Ocean custody is R0.5 scope and must not be performed here');
assert.ok(!fs.existsSync('governance/recovery/R0.2/POST_QA_GOVERNED_STATE.json'), 'Checkpoint C is not written by the implementation agent');

// ---- original frozen release ZIP is in governed binary custody -----------------------------
const CANON = 'b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289';
const PKG = 'release/packages/frozen/atlas-daughter-release-ltl-v1.4-ocean-v0.6.zip';
const BC = JSON.parse(fs.readFileSync('governance/recovery/R0.2/BINARY_PACKAGE_CUSTODY_RECORD.json', 'utf8'));
assert.ok(fs.existsSync(PKG), 'the exact original release ZIP must be in governed custody');
assert.equal(sha(PKG), CANON, 'custodied ZIP must be the exact original bytes');
assert.equal(BC.package.custodiedSha256, CANON);
assert.equal(BC.package.shaMatchesCanonical, true);
assert.equal(BC.package.recompressed, false, 'the archive must not have been re-compressed');
assert.equal(BC.package.reconstructedFromExtractedFiles, false, 'the archive must not have been rebuilt from extracts');
assert.equal(BC.package.custodiedRepositoryPath, PKG);
assert.equal(reg['daughter-release-ltl1.4-ocean0.6'].sha256, CANON, 'canonical identity comes from the register');
// identity by hash, never by filename
assert.match(BC.identitySelectionRule, /never by filename or date/i);
assert.ok(BC.filenameVariantsObserved.length >= 3, 'observed filename variants must be recorded');
for (const v of BC.filenameVariantsObserved) {
  if (v.sha256 !== 'NOT_OBSERVED_AS_A_DISTINCT_ARTIFACT') assert.equal(v.sha256, CANON, `variant ${v.filename} must resolve to the canonical bytes`);
}
// provenance must be explicit
assert.match(BC.provenance.readFrom, /uploads/, 'provenance must state where the bytes were read from');
assert.equal(BC.provenance.readFromSha256, CANON);
assert.equal(BC.provenance.driveBytesIndependentlyRetrievedByThisStage, false,
  'the stage must not claim to have retrieved Drive bytes it did not fetch');
assert.equal(BC.provenance.driveSourceFileIdFromHistoricalEvidence, '1CVUC40CZuhexs8oJjasBFw7OAjv4AhUI');
// historical hash evidence retained, not used for identity
const hist = BC.historicalHashEvidence.find(h => h.sha256 === '00ef9905');
assert.ok(hist, 'historical hash reference must be retained');
assert.equal(hist.status, 'HISTORICAL_REFERENCE_RETAINED');
assert.notEqual(hist.sha256, CANON);

// the original ZIP must still verify its own internal manifest
const zip = fs.readFileSync(PKG);
assert.equal(crypto.createHash('sha256').update(zip).digest('hex'), CANON);
assert.equal(BC.internalManifestVerification.entries, 30);
assert.equal(BC.internalManifestVerification.mismatches, 0);

// ---- closure record states registration accurately -------------------------------------------
assert.equal(C.promotion.assetRegisterBindsRecoveredRepositoryPaths, false,
  'the record must not imply ASSET_REGISTER already binds the recovered paths');
assert.equal(C.promotion.registrationPending, 'INDEPENDENT_QA_AND_GOVERNANCE_CLOSURE');
assert.match(C.promotion.note, /has NOT been updated/i);
assert.equal(reg['road-ltl-1.4-candidate'].repositoryPath, undefined, 'register must still lack repositoryPath');
assert.equal(reg['daughter-release-ltl1.4-ocean0.6'].repositoryBinaryMaterialization, 'PENDING_CONNECTOR_BINARY_UPLOAD',
  'register binary materialization must still be pending; QA owns that change');
assert.equal(BC.registerTreatment.registerMutatedByThisStage, false);
assert.equal(C.B_custodyClosure.originalPackageBinaryCustody.matchesCanonicalRegisteredSha256, true);

console.log('R0.2 Road LTL source closure certification PASS');
