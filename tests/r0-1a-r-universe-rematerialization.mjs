import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  buildPayload, extractUniverseSemantics, canonicalHash, stableStringify,
  GOVERNED_RUNTIME_STATE_EXCLUSIONS, PAYLOAD_SCHEMA_VERSION,
  EXTRACTOR_VERSION, PRODUCING_STAGE_ID, SUPERSEDED_EXTRACTOR_VERSION
} from '../tools/universe/extract-universe-semantics.mjs';
import { compareCopies } from '../tools/universe/compare-universe-copies.mjs';
import { inventoryModuleDeclarations } from '../tools/universe/inventory-module-declarations.mjs';

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const SOURCES = [
  'reference/universe-v7.3.html',
  'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html',
  'frozen-assets/inbox/ocean-fcl-lcl-v0.5-v7.3/site/universe-v7.3.html'
];
const NEW = 'data/universe/r0-1a-r/universe-semantic-payload.json';
const NEW_REPORT = 'data/universe/r0-1a-r/universe-extraction-report.json';
const NEW_CMP = 'data/universe/r0-1a-r/universe-copy-comparison.json';
const NEW_INV = 'data/universe/r0-1a-r/universe-declaration-inventory.json';
const html = fs.readFileSync(SOURCES[0], 'utf8');
const payload = JSON.parse(fs.readFileSync(NEW, 'utf8'));
const report = JSON.parse(fs.readFileSync(NEW_REPORT, 'utf8'));
const S = payload.structures;

// ---- 1. complete declaration expression is captured ---------------------------------
const probe = `<script>(() => {
  const plain=[{id:'a'}];
  const mapped=[{id:'b'}].map(r=>({...r,addedInDeclaration:true}));
  const nested=[{id:'c'}].map(r=>({...r,x:1})).filter(r=>r.x===1);
  mapped.forEach(r=>{r.addedAfterDeclaration=true});
  plain.forEach(r=>{r.addedAfterDeclaration=true});
  document.body.innerHTML='runtime';
})();</script>`;
const pr = extractUniverseSemantics(probe).structures;
assert.equal(pr.mapped[0].addedInDeclaration, true, 'declaration-level chained transform must be captured');   // 2
assert.equal(pr.nested[0].x, 1, 'multi-step declaration chains must be captured');
// ---- 3. later mutation statements cannot alter captured values -----------------------
assert.ok(!('addedAfterDeclaration' in pr.mapped[0]), 'post-declaration mutation must not reach the snapshot');
assert.ok(!('addedAfterDeclaration' in pr.plain[0]), 'post-declaration mutation must not reach the snapshot');

// ---- 4/5. description retained on both affected structures ---------------------------
for (const name of ['systemRecords', 'businessObjectRecords']) {
  assert.ok(S[name].length > 0, `${name} must be materialized`);
  for (const r of S[name]) assert.ok('description' in r, `${name}: every record must retain the source-declared description`);
  // must equal the value the source declares, not an invented one
  const declared = /\]\s*\.map\(record=>\(\{\.\.\.record,description:'([^']+)'/.exec(html);
  if (name === 'systemRecords') assert.equal(S[name][0].description, declared[1], 'description must be the source-declared value');
}
// ---- 6. later-added domainIds excluded ----------------------------------------------
for (const name of ['systemRecords', 'businessObjectRecords']) {
  for (const r of S[name]) assert.ok(!('domainIds' in r), `${name}: domainIds is added post-declaration and must be excluded`);
}
assert.match(html, /systemRecords\.forEach\(record=>\{record\.domainIds=/, 'domainIds must be shown as a post-declaration mutation in source');
// no special-casing: the fix must be generic
const extractorSrc = fs.readFileSync('tools/universe/extract-universe-semantics.mjs', 'utf8');
for (const forbidden of [/['"`]systemRecords['"`]/, /['"`]businessObjectRecords['"`]/, /['"`]description['"`]/, /['"`]domainIds['"`]/]) {
  assert.doesNotMatch(extractorSrc, forbidden, `extractor must not hard-code ${forbidden} to satisfy tests`);
}

// ---- 7. state classified runtime/UI and excluded --------------------------------------
assert.ok(!('state' in S), 'state must not appear in the canonical semantic payload');
const excl = payload.excludedRuntimeState.find(e => e.name === 'state');
assert.ok(excl, 'state exclusion must be recorded as auditable evidence');
assert.equal(excl.classification, 'RUNTIME_UI_STATE');
assert.equal(excl.determination, 'R0.1B D6');
assert.ok(excl.materialized, 'state must still be materialized, not deleted or disguised');
assert.ok(excl.topLevelKeys.includes('navigationState'), 'exclusion evidence must show the UI state keys');
assert.match(html, /(?:const|let|var)\s+state\s*=/, 'the source declaration must remain untouched');
assert.ok(inventoryModuleDeclarations(html).mustMaterialize.includes('state'),
  'state must remain visible in the independent inventory so the exclusion is auditable');

// ---- 8. heterogeneous same-ID records do not create false divergence ------------------
const cbc = report.constructionBoundaryConsistency;
assert.equal(cbc.identityRule, 'SAME_LOGICAL_COLLECTION_BY_IDENTICAL_ID_SET');
assert.equal(cbc.divergentRecordCount, 0, 'no field-set divergence should remain after correction');
for (const id of ['warehouse', 'finance']) {
  const c = cbc.heterogeneousIdCollisions.find(h => h.recordId === id);
  assert.ok(c, `${id} must be reported as an id collision`);
  assert.equal(c.classification, 'DISTINCT_COLLECTIONS_SHARING_AN_ID_NOT_A_DIVERGENCE');
}

// ---- 9. no source field invented ------------------------------------------------------
// Only plain-object records carry named fields; array elements index numerically and are
// not field names. Every named field must appear verbatim in the retained source.
let fieldsChecked = 0;
for (const [name, value] of Object.entries(S)) {
  if (!Array.isArray(value)) continue;
  for (const r of value.slice(0, 8)) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    for (const k of Object.keys(r)) {
      if (/^\d+$/.test(k)) continue;
      fieldsChecked++;
      // Fields may appear as `name:` or as ES6 shorthand inside a factory (`({id, name, sequence})`),
      // so whole-word presence in the retained source is the provenance test.
      assert.match(html, new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
        `field '${k}' in ${name} must exist in the retained source (never invented)`);
    }
  }
}
assert.ok(fieldsChecked > 200, `field-provenance check must be meaningful (checked ${fieldsChecked})`);

// ---- 10. every must-materialize declaration accounted for -----------------------------
const inv = inventoryModuleDeclarations(html);
const den = report.completeness.independentInventory;
assert.equal(den.mustMaterializeCount, inv.mustMaterializeCount);
assert.deepEqual(den.notMaterialized, [], 'nothing may be silently unmaterialized');
assert.deepEqual(den.governedRuntimeStateExclusions, GOVERNED_RUNTIME_STATE_EXCLUSIONS.map(r => r.name).sort());
assert.equal(den.materialized.length + den.governedRuntimeStateExclusions.length, den.mustMaterializeCount,
  'materialized + governed exclusions must account for the full denominator');
assert.equal(report.completeness.unresolvedCount, 0);

// ---- 11. all retained copies evaluated -------------------------------------------------
const cmp = JSON.parse(fs.readFileSync(NEW_CMP, 'utf8'));
assert.equal(cmp.copies.length, 3, 'all three retained copies must be materialized');
const live = compareCopies(SOURCES);
assert.equal(live.differingStructureCount, cmp.differingStructureCount, 'comparison must be reproducible');
assert.equal(live.distinctSourceHashes, 2);
// no NEW semantic divergence introduced by the correction
const before = JSON.parse(fs.readFileSync('data/universe/universe-copy-comparison.json', 'utf8'));
assert.deepEqual(live.differingStructures.map(d => d.name).sort(), before.differingStructures.map(d => d.name).sort(),
  'the correction must not introduce or remove copy-level differences');
assert.equal(live.differenceClassification, 'PENDING_R0_1B', 'classification authority remains with R0.1B');

// ---- 12. R0.1A / R0.1B artifacts byte-identical -----------------------------------------
const HISTORICAL = {
  'data/universe/universe-semantic-payload.json': '2d6405c534b96f4054cb87ac2428a0a7a1bf4626334a86e5cc96ec342add4043',
  'governance/recovery/R0.1B/UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json': null
};
const r0aReport = JSON.parse(fs.readFileSync('data/universe/universe-extraction-report.json', 'utf8'));
assert.equal(r0aReport.hashes.semanticStructures, HISTORICAL['data/universe/universe-semantic-payload.json'],
  'R0.1A certified payload must remain byte-identical');
assert.ok(!('description' in JSON.parse(fs.readFileSync('data/universe/universe-semantic-payload.json', 'utf8')).structures.systemRecords[0]),
  'the historical R0.1A payload must retain its defect as evidence, not be silently repaired');
for (const p of ['governance/recovery/R0.1A/PRE_CHANGE_BASELINE.json', 'governance/recovery/R0.1A/POST_IMPLEMENTATION_PRE_QA.json',
                 'governance/recovery/R0.1A/POST_QA_GOVERNED_STATE.json', 'governance/recovery/R0.1B/UNIVERSE_IDENTITY_AUTHORITY_DETERMINATION.json']) {
  assert.ok(fs.existsSync(p), `historical evidence must still exist: ${p}`);
}
// the R0.1A Checkpoint C must be supplemented, not rewritten
const sup = JSON.parse(fs.readFileSync('governance/recovery/R0.1A/POST_QA_GOVERNED_STATE_SUPPLEMENT.json', 'utf8'));
assert.equal(sup.originalModified, false);
assert.equal(sup.supplementSha256OfOriginal, sha('governance/recovery/R0.1A/POST_QA_GOVERNED_STATE.json'),
  'supplement must cite the unmodified original hash');

// ---- 13. R0.1C remains blocked ----------------------------------------------------------
assert.equal(payload.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
  'R0.1C reference-ownership work must not begin');
const idPattern = /\b(?:a5|scp)-[a-z0-9][\w-]*/gi;
for (const id of [...new Set(JSON.stringify(S).match(idPattern) || [])]) {
  assert.ok(html.includes(id), `identifier '${id}' must be present in source, never introduced`);
}

// ---- 14. no premature canonical promotion ------------------------------------------------
const supersession = JSON.parse(fs.readFileSync('governance/recovery/R0.1A-R/UNIVERSE_MATERIALIZATION_SUPERSESSION.json', 'utf8'));
assert.equal(supersession.promotion.canonicalPromotion, 'NOT_PERFORMED');
assert.equal(supersession.promotion.currentPointer, 'UNCHANGED');
assert.equal(supersession.promotion.assetRegister, 'UNCHANGED');
assert.equal(payload.classification, 'MECHANICAL_SEMANTIC_MATERIALIZATION_NO_INFERENCE');
assert.equal(payload.lineage.identityReconciliation, 'PENDING_R0_1B', 'R0.1A-R must not resolve release identity');
assert.ok(!fs.existsSync('governance/recovery/R0.1A-R/POST_QA_GOVERNED_STATE.json'), 'Checkpoint C is not written by the implementation agent');

// ---- supersession lineage integrity --------------------------------------------------------
assert.ok(supersession.hashesDiffer, 'corrected payload must not reuse the R0.1A semantic hash');
assert.equal(supersession.supersedingArtifact.semanticStructuresHash, report.hashes.semanticStructures);
assert.equal(supersession.supersededArtifact.semanticStructuresHash, r0aReport.hashes.semanticStructures);
assert.equal(supersession.supersedingArtifact.fileSha256, sha(NEW));

// ---- determinism -----------------------------------------------------------------------------
const a = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
const b = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
assert.equal(stableStringify(a.payload), stableStringify(b.payload), 'corrected extraction must be deterministic');
assert.equal(canonicalHash(a.payload.structures), report.hashes.semanticStructures, 'committed payload must be reproducible');
assert.equal(payload.schemaVersion, PAYLOAD_SCHEMA_VERSION);

// ---- dependency closure registry ---------------------------------------------------------------
const reg = JSON.parse(fs.readFileSync('governance/registry/UNIVERSE_MACHINE_READABLE_INPUT_REGISTRY.json', 'utf8'));
for (const g of reg.generations) for (const asset of g.assets) {
  assert.ok(fs.existsSync(asset.repositoryPath), `registry path must resolve: ${asset.repositoryPath}`);
  assert.equal(asset.sha256, sha(asset.repositoryPath), `registry hash must match: ${asset.repositoryPath}`);
}
assert.equal(reg.governanceBranchClosure.appliedByThisStage, false, 'governance-branch mutation is a Checkpoint C action');

// ---- producer identity / lineage accuracy -------------------------------------------
const PINNED_SEMANTIC_HASH = '82104521148e1d1c24d4cc161afa872f6076e6d204e06c062393f3dac656044d';
const cmpArtifact = JSON.parse(fs.readFileSync(NEW_CMP, 'utf8'));
const invArtifact = JSON.parse(fs.readFileSync(NEW_INV, 'utf8'));

// corrected artifacts must identify their producing remediation stage
assert.equal(PRODUCING_STAGE_ID, 'R0.1A-R');
for (const [label, doc] of [['payload', payload], ['report', report], ['comparison', cmpArtifact], ['inventory', invArtifact]]) {
  assert.equal(doc.stageId, 'R0.1A-R', `corrected ${label} must declare stageId R0.1A-R`);
}
// corrected artifacts must carry the new extractor version
assert.equal(EXTRACTOR_VERSION, 'atlas-universe-semantic-extractor-1.1.0');
assert.notEqual(EXTRACTOR_VERSION, SUPERSEDED_EXTRACTOR_VERSION, 'corrected extractor must not reuse the R0.1A version');
for (const [label, doc] of [['payload', payload], ['report', report], ['comparison', cmpArtifact]]) {
  assert.equal(doc.extractorVersion, EXTRACTOR_VERSION, `corrected ${label} must record the new extractor version`);
}
// the extractor must not describe itself as the original R0.1A implementation
const headComment = extractorSrc.slice(0, extractorSrc.indexOf('export const'));
assert.doesNotMatch(headComment, /^\/\/ R0\.1A —/m, 'extractor header must not present itself as the R0.1A implementation');
assert.match(headComment, /R0\.1A-R/, 'extractor header must identify the corrected implementation');

// historical R0.1A identity must remain untouched
const histPayload = JSON.parse(fs.readFileSync('data/universe/universe-semantic-payload.json', 'utf8'));
const histReport = JSON.parse(fs.readFileSync('data/universe/universe-extraction-report.json', 'utf8'));
assert.equal(histPayload.stageId, 'R0.1A', 'historical R0.1A payload must keep its original stageId');
assert.equal(histPayload.extractorVersion, SUPERSEDED_EXTRACTOR_VERSION, 'historical R0.1A payload must keep extractor 1.0.0');
assert.equal(histReport.stageId, 'R0.1A');
assert.equal(histReport.extractorVersion, SUPERSEDED_EXTRACTOR_VERSION);

// metadata-only correction: semantics must be bit-identical to the pinned value
assert.equal(report.hashes.semanticStructures, PINNED_SEMANTIC_HASH,
  'metadata correction must not alter the semantic structures hash');
assert.equal(canonicalHash(payload.structures), PINNED_SEMANTIC_HASH);
assert.equal(supersession.supersedingArtifact.semanticStructuresHash, PINNED_SEMANTIC_HASH);
assert.equal(supersession.supersedingArtifact.fileSha256, sha(NEW), 'supersession must record the revised file hash');
assert.equal(supersession.supersededArtifact.semanticStructuresHash, histReport.hashes.semanticStructures);

console.log('R0.1A-R Universe re-materialization correction certification PASS');
