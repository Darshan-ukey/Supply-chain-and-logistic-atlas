#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const readText = p => fs.readFileSync(p, 'utf8');
const readJson = p => JSON.parse(readText(p));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail = [];
const assert = (cond, msg) => { if (!cond) fail.push(msg); };

const paths = {
  ltl: 'data/modules/road-ltl-v1.5.json',
  ok: 'schemas/operational-knowledge-contract-v2.json',
  operational: 'data/operational-knowledge/road-ltl-v1.5-operational.json',
  bol: 'data/operational-knowledge/BOL_INFORMATION_RESOLUTION_BASELINE_V0.1.md',
  bolData: 'data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json',
  claims: 'data/source-claims/road-ltl-v1.5-bol-resolution-claims.json',
  ir: 'schemas/information-resolution-contract-v1.json',
  register: 'governance/frozen-assets/ASSET_REGISTER.json',
  current: 'governance/frozen-assets/CURRENT.json'
};
for (const [k,p] of Object.entries(paths)) assert(fs.existsSync(p), `${k}: missing ${p}`);
if (fail.length) { console.error(fail.join('\n')); process.exit(1); }

const ltl = readJson(paths.ltl);
const ok = readJson(paths.ok);
const operational = readJson(paths.operational);
const claims = readJson(paths.claims);
const ir = readJson(paths.ir);
const register = readJson(paths.register);
const current = readJson(paths.current);
const bol = readText(paths.bol);
const claimIds = new Set(claims.claims.map(c => c.claimId));

assert(ltl.moduleId === 'road-ltl' && ltl.version === '1.5', 'Road LTL identity/version invalid');
assert(ltl.representation === 'LOSSLESS_VERSIONED_OVERLAY', 'Road LTL must be lossless versioned overlay');
assert(ltl.baseAsset?.assetId === 'road-ltl-1.4-candidate', 'Road LTL base asset must be frozen v1.4 candidate');
const base = register.assets.find(a => a.assetId === 'road-ltl-1.4-candidate');
assert(base?.sha256 === ltl.baseAsset?.sha256, 'Road LTL v1.4 base hash does not match canonical register');
assert(JSON.stringify(ltl.materializationPolicy?.changedTaskIds) === JSON.stringify(['LTL-03']), 'Only LTL-03 may be declared changed');
assert((ltl.materializationPolicy?.taskIdentityChanges || []).length === 0, 'LTL task identity changes are not allowed in this enrichment');
assert(ltl.materializationPolicy?.preserveAllUnchangedBaseContent === true, 'Lossless base inheritance must be explicit');
assert(ltl.materializationPolicy?.page0OrUniverseChangeRequired === false && ltl.materializationPolicy?.universeVersion === '7.3', 'Universe must remain 7.3 for this freeze');
const ltl03 = ltl.taskOverrides?.find(t => t.id === 'LTL-03');
assert(!!ltl03 && ltl03.identityPreservedFromBase === true, 'LTL-03 enriched task override missing or identity not preserved');
assert(!!ltl03?.operationalKnowledgeV2, 'LTL-03 Operational Knowledge v2 block missing');
assert(Array.isArray(ltl03?.operationalKnowledgeV2?.canonicalObjectModel) && ltl03.operationalKnowledgeV2.canonicalObjectModel.includes('DangerousGoods[] (conditional)'), 'Canonical BOL object model incomplete');
assert(Array.isArray(ltl03?.operationalKnowledgeV2?.resolutionWorkflow) && ltl03.operationalKnowledgeV2.resolutionWorkflow.length >= 10, 'Information-resolution workflow insufficient');
for (const rule of ltl03?.operationalKnowledgeV2?.criticalResolutionRules || []) {
  for (const id of rule.sourceClaimIds || []) assert(claimIds.has(id), `LTL-03 references missing source claim: ${id}`);
}
assert(Array.isArray(ltl03?.executionReadiness?.knownOpenGates) && ltl03.executionReadiness.knownOpenGates.length >= 3, 'Known open promotion gates must remain disclosed');

assert(ok.schemaVersion === 'atlas-operational-knowledge-contract-v2', 'Operational Knowledge v2 schema identity invalid');
assert(ok.informationResolution?.$ref === 'information-resolution-contract-v1', 'Operational Knowledge v2 must embed Information Resolution v1');
assert(Array.isArray(ok.informationResolution?.minimumSemantics) && ok.informationResolution.minimumSemantics.includes('requiredWhen') && ok.informationResolution.minimumSemantics.includes('runtimeFeedbackProfile'), 'Operational Knowledge v2 minimum information-resolution semantics incomplete');
assert(ok.downstreamContract?.nextLayer === 'Recursive Work Decomposition', 'Operational Knowledge v2 downstream architecture invalid');
assert(ir.title === 'Atlas Information Resolution Contract v1', 'Information Resolution Contract v1 missing/invalid');

assert(operational.moduleId === 'road-ltl' && operational.moduleVersion === '1.5', 'Road LTL v1.5 operational payload identity invalid');
assert(operational.operationalKnowledgeContract === 'atlas-operational-knowledge-contract-v2', 'Operational payload not bound to OK v2');
assert(JSON.stringify(operational.changedTaskIds) === JSON.stringify(['LTL-03']), 'Operational payload may only change LTL-03');
assert(operational.unchangedTasksPolicy?.includes('inherited unchanged'), 'Operational v1.4 inheritance policy missing');

for (const section of ['Canonical object model','Permanent error taxonomy','Measurement control','Authoritative source hierarchy','Explicit unresolved semantics','A5 impact','Version decision','Promotion gates']) {
  assert(bol.includes(section), `BOL baseline missing section: ${section}`);
}
assert(bol.includes('76 source-reported Malkom BOL fields'), 'BOL baseline scope does not preserve 76-field population');
assert(bol.includes('11 source-reported Accuracy values exceed 100%'), 'Metric-integrity anomaly disclosure missing');

assert(claimIds.has('ltl-ebol-standard-version'), 'eBOL source claim missing');
assert(claimIds.has('canonical-object-first-resolution'), 'canonical object-first source claim missing');
assert(claims.explicitBoundaries?.some(x => x.includes('U.S. 49 CFR')), 'Jurisdiction boundary for U.S. claims missing');
assert(claims.explicitBoundaries?.some(x => x.includes('above 100 percent')), 'Metric boundary missing');

assert(current.productionBaseline?.roadLtl === 'road-ltl-1.3', 'Freeze must not silently promote Road LTL production baseline');

console.log('ROAD LTL v1.5 FREEZE VALIDATION: PASS');
for (const p of [paths.ltl, paths.ok, paths.bol, paths.operational, paths.ir, paths.claims, paths.bolData]) {
  console.log(`SHA256 ${p} ${hash(p)}`);
}
console.log('Known open gates are disclosed; this validation authorizes immutable reference-candidate freeze, NOT production promotion.');
