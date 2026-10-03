'use strict';
const assert=require('assert'),crypto=require('crypto');
const {road,STATE_MAP,DIMENSIONS,effectiveRoad15}=require('../scripts/generate-bounded-daughter-v1');
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const digest=o=>crypto.createHash('sha256').update(bytes(o)).digest('hex');
function run(){
 const effective=effectiveRoad15(),a=road(),b=road();
 assert.strictEqual(Buffer.compare(bytes(a.model),bytes(b.model)),0,'Road model regeneration must be byte-identical');
 assert.strictEqual(Buffer.compare(bytes(a.projection),bytes(b.projection)),0,'Road projection regeneration must be byte-identical');
 assert.strictEqual(a.model.counts.processCount,22);assert.strictEqual(a.model.counts.a3Count,13);assert.strictEqual(a.model.counts.sourceCount,29);
 assert.strictEqual(a.model.counts.edgeCount,effective.tasks.reduce((n,t)=>n+(t.branchTransitions||[]).length,0));
 assert.ok(a.model.edges.length>0,'Road execution transitions must be preserved');
 assert.deepStrictEqual(a.model.dimensions,DIMENSIONS);
 assert.strictEqual(a.model.status,'FROZEN');assert.strictEqual(a.projection.status,'FROZEN');
 assert.strictEqual(a.model.identity.moduleVersion,'1.5');assert.strictEqual(a.model.identity.moduleSha256,'22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f');
 assert.deepStrictEqual(effective.s8Overlay.changedTaskIds,['LTL-03']);
 assert.strictEqual(effective.tasks.find(t=>t.taskId==='LTL-03').operationalKnowledgeV2.informationResolutionBaselineRef,'BOL Information Resolution Baseline v0.1 — Road LTL / Malkom');
 assert.ok(a.model.identity.inputHash&&a.model.identity.outputHash&&a.projection.identity.outputHash);
 assert.strictEqual(a.projection.identity.canonicalModelHash,a.model.identity.outputHash);
 assert.strictEqual(a.model.hierarchy.tasks.length,22);assert.ok(a.model.hierarchy.tasks.every(t=>t.stableId&&t.minimum_record&&t.knowledge_state&&Array.isArray(t.provenance)));
 assert.deepStrictEqual(STATE_MAP,{BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'});
 console.log(JSON.stringify({ok:true,roadCounts:a.model.counts,roadModelFileSha256:digest(a.model),roadProjectionFileSha256:digest(a.projection),deterministicByteIdentity:true,changedTaskIds:effective.s8Overlay.changedTaskIds},null,2));
}
run();
