import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const SEM = '82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d';
const ORIGINAL = 'governance/recovery/R0.1B/UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json';
const CLOSURE = 'governance/recovery/R0.1B/UNIVERSE_FINAL_AUTHORITY_CLOSURE.json';
const SRC_A = 'reference/universe-v7.3.html';
const SRC_B = 'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html';
const SRC_C = 'frozen-assets/inbox/ocean-fcl-lcl-v0.5-v7.3/site/universe-v7.3.html';

const D = JSON.parse(fs.readFileSync(ORIGINAL, 'utf8'));
const F = JSON.parse(fs.readFileSync(CLOSURE, 'utf8'));
const pay = JSON.parse(fs.readFileSync('data/universe/r0-1a-r/universe-semantic-payload.json', 'utf8'));
const rep = JSON.parse(fs.readFileSync('data/universe/r0-1a-r/universe-extraction-report.json', 'utf8'));
const cmp = JSON.parse(fs.readFileSync('data/universe/r0-1a-r/universe-copy-comparison.json', 'utf8'));

// ---- closure is a NEW record; the original determination is untouched -----------------
assert.notEqual(CLOSURE, ORIGINAL);
assert.equal(F.relationshipToOriginalDetermination.originalModified, false);
assert.equal(F.relationshipToOriginalDetermination.originalSha256, sha(ORIGINAL),
  'closure must cite the unmodified original determination hash');
assert.equal(D.stageId, 'R0.1B');
assert.equal(D.status, 'CANDIDATE_AWAITING_INDEPENDENT_QA', 'original determination must retain its original status text');

// ---- inputs are the corrected, certified generation ------------------------------------
for (const [p, h] of Object.entries(F.inputs)) {
  assert.ok(fs.existsSync(p), `governed input must resolve: ${p}`);
  assert.equal(sha(p), h, `governed input hash must match: ${p}`);
}
const qa = JSON.parse(fs.readFileSync('governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json', 'utf8'));
assert.equal(qa.qaDisposition, 'PASS', 'closure may only proceed on an R0.1A-R QA PASS');
assert.equal(pay.stageId, 'R0.1A-R', 'authority must bind to the corrected generation');
assert.equal(pay.extractorVersion, 'atlas-universe-semantic-extractor-1.1.0');

// ---- D1 confirmed against the corrected materialization --------------------------------
assert.equal(F.determinationReverification.D1.status, 'CONFIRMED_UNCHANGED');
assert.deepEqual(
  cmp.differingStructures.map(x => x.name).sort(),
  D.D1_sourceCopyDifferenceClassification.structures.slice().sort(),
  'corrected materialization must yield the same differing structures as the original determination'
);
assert.equal(cmp.copies.length, 3);
assert.equal(cmp.distinctSourceHashes, 2);

// ---- D2 confirmed; authority hashes still resolve ---------------------------------------
assert.equal(F.determinationReverification.D2.status, 'CONFIRMED_UNCHANGED');
assert.equal(F.finalAuthority.releaseShellAuthority.authoritativeCopy.sha256, sha(SRC_B));
assert.equal(D.D2_authority.releaseShellAuthority.sha256, sha(SRC_B), 'original D2 authority hash must still match the source');
assert.equal(F.finalAuthority.releaseShellAuthority.retainedLaterRepackage.sha256, sha(SRC_A));
assert.equal(sha(SRC_A), sha(SRC_C), 'the later repackage is retained in two identical copies');
assert.equal(F.finalAuthority.releaseShellAuthority.discardedCopies, 'NONE', 'no retained copy may be discarded');

// ---- D3 confirmed; two identities finalized and kept separate ----------------------------
assert.equal(F.determinationReverification.D3.status, 'CONFIRMED_UNCHANGED');
assert.equal(F.finalAuthority.governedIdentities.releaseVersion.value, '7.3');
assert.equal(F.finalAuthority.governedIdentities.semanticPayloadVersion.value, '7.2.0');
assert.equal(F.finalAuthority.governedIdentities.reconciliation, 'FINALIZED_AS_TWO_DISTINCT_GOVERNED_IDENTITIES');
assert.match(F.finalAuthority.governedIdentities.prohibited, /Relabeling/);
assert.equal(pay.lineage.releaseShellVersion, '7.3');
assert.equal(pay.lineage.embeddedSemanticIdentity.version, '7.2.0');
for (const c of cmp.copies) assert.equal(c.embeddedSemanticIdentity.version, '7.2.0',
  'every retained copy must still carry semantic identity 7.2.0');

// ---- D4-D6 recorded as remediated by R0.1A-R, not re-performed here -----------------------
for (const k of ['D4', 'D5', 'D6']) {
  assert.equal(F.determinationReverification[k].status, 'REMEDIATED_BY_R0_1A_R');
  assert.equal(F.determinationReverification[k].certifiedBy, 'R0.1A-R independent QA PASS');
}
assert.equal(F.determinationReverification.contradictionsFound, 0);
// remediation is demonstrable in the corrected artifacts
assert.ok('description' in pay.structures.systemRecords[0]);
assert.ok('description' in pay.structures.businessObjectRecords[0]);
assert.ok(!('domainIds' in pay.structures.systemRecords[0]));
assert.equal(rep.constructionBoundaryConsistency.divergentRecordCount, 0);
assert.ok(!('state' in pay.structures));
assert.ok(pay.excludedRuntimeState.some(e => e.name === 'state' && e.determination === 'R0.1B D6'));

// ---- semantic authority binding -----------------------------------------------------------
const auth = F.finalAuthority.semanticPayloadAuthority;
assert.equal(auth.semanticStructuresSha256, SEM, 'authority must bind to the certified semantic hash');
assert.equal(rep.hashes.semanticStructures, SEM, 'corrected payload must still carry that hash');
assert.equal(auth.fileSha256, sha(auth.repositoryPath));
assert.equal(auth.producingStage, 'R0.1A-R');
assert.equal(auth.preconditionSatisfied, true, 'D2 required D5 remediation before semantic authority could bind');

// ---- supersession finalized, both generations retained -------------------------------------
const sup = F.finalAuthority.supersessionOfDefectiveMaterialization;
assert.equal(sup.supersededArtifact.modified, false);
assert.equal(sup.supersededArtifact.retained, true);
assert.equal(sup.supersededArtifact.classification, 'IMMUTABLE_HISTORICAL_EVIDENCE_NOT_ELIGIBLE_FOR_CANONICAL_PROMOTION');
assert.notEqual(sup.supersededArtifact.semanticStructuresSha256, sup.supersedingArtifact.semanticStructuresSha256);
const hist = JSON.parse(fs.readFileSync('data/universe/universe-semantic-payload.json', 'utf8'));
assert.equal(hist.stageId, 'R0.1A', 'historical payload identity must be untouched');
assert.ok(!('description' in hist.structures.systemRecords[0]),
  'the defective historical payload must retain its defect as evidence');

// ---- scope: nothing promoted, nothing outside closure --------------------------------------
for (const [k, v] of Object.entries(F.promotion)) {
  if (k === 'note') continue;
  assert.ok(['NOT_PERFORMED', 'UNCHANGED'].includes(v), `premature promotion: ${k}=${v}`);
}
assert.equal(F.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT');
assert.equal(F.referenceResolution.owner, 'R0.1C');
assert.equal(pay.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT');
assert.ok(F.outOfScopeConfirmations.some(c => /7\.4/.test(c)));
assert.ok(F.outOfScopeConfirmations.some(c => /not rerun or modified/i.test(c)));
assert.ok(!fs.existsSync('governance/recovery/R0.1B/POST_QA_GOVERNED_STATE.json'),
  'Checkpoint C is not written by the implementation agent');
assert.equal(F.status, 'CANDIDATE_AWAITING_INDEPENDENT_QA');

console.log('R0.1B final authority closure certification PASS');
