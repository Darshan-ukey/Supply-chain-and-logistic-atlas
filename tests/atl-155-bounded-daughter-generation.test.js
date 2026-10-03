'use strict';
const assert=require('assert'),crypto=require('crypto');
const {road,reference,assertPublishable,STATE_MAP,DIMENSIONS}=require('../scripts/generate-bounded-daughter-v1');
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const digest=o=>crypto.createHash('sha256').update(bytes(o)).digest('hex');
function run(){
 const a=road(),b=road();
 assert.strictEqual(Buffer.compare(bytes(a.model),bytes(b.model)),0,'Road model regeneration must be byte-identical');
 assert.strictEqual(Buffer.compare(bytes(a.projection),bytes(b.projection)),0,'Road projection regeneration must be byte-identical');
 assert.deepStrictEqual(a.model.counts,{processCount:22,a3Count:13,edgeCount:39,sourceCount:29});
 assert.deepStrictEqual(a.model.dimensions,DIMENSIONS);
 assert.strictEqual(a.model.status,'FROZEN'); assert.strictEqual(a.projection.status,'FROZEN');
 assert.ok(a.model.identity.inputHash&&a.model.identity.outputHash&&a.projection.identity.outputHash);
 assert.strictEqual(a.projection.identity.canonicalModelHash,a.model.identity.outputHash);
 assert.strictEqual(a.model.hierarchy.tasks.length,22); assert.ok(a.model.hierarchy.tasks.every(t=>t.stableId&&t.minimum_record&&t.knowledge_state&&Array.isArray(t.provenance)));
 assert.deepStrictEqual(STATE_MAP,{BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'});
 for(const id of ['ocean-fcl','ocean-lcl']){const o=reference(id);assert.strictEqual(o.model.hierarchy.tasks.length,0);assert.strictEqual(o.model.knownGaps[0].knowledge_state,'RESEARCH_REQUIRED');assert.strictEqual(o.projection.module.depth,'REFERENCE_ONLY');assert.throws(()=>reference(id,'A5_VERIFIED'),/REFUSE_UNGOVERNED_DEPTH/)}
 assert.throws(()=>assertPublishable('accounts-payable-fixture'),/REFUSE_TEST_ONLY_PUBLICATION/);
 console.log(JSON.stringify({ok:true,roadCounts:a.model.counts,roadModelBytes:bytes(a.model).length,roadProjectionBytes:bytes(a.projection).length,roadModelFileSha256:digest(a.model),roadProjectionFileSha256:digest(a.projection),oceanNegativeDepth:true,testOnlyPublicationRefused:true,deterministicByteIdentity:true},null,2));
}
run();
