import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {road,ocean,assertPublishable,STATE_MAP,DIMENSIONS,effectiveRoad15,certifiedInputs} from '../scripts/generate-bounded-daughter-v1.js';
import {exactBytes,hash} from '../scripts/s8-3a-certified-inputs.js';
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const effective=effectiveRoad15(),inputs=certifiedInputs();
assert.equal(inputs.sources.length,8);
assert.equal(inputs.package.gitBlob,'5e7f31db1c2c9db6d265f0f6d9def6ff75b19a5e');
assert.equal(inputs.package.sha256,'b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289');
assert.equal(Object.keys(inputs.payloads).length,10);
assert.deepEqual(STATE_MAP,{BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'});
assert.throws(()=>assertPublishable('test-fixture'),/REFUSE/);
assert.throws(()=>assertPublishable('ocean-v0.5'),/REFUSE/);
assert.throws(()=>ocean('ocean-fcl-v0.5'),/REFUSED/);
assert.throws(()=>exactBytes('data/modules/road-ltl-v1.5.json','0000000000000000000000000000000000000000'),/SOURCE_BLOB_MISMATCH/);
const base=JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.4.json'));
const overlay=JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.5.json'));
assert.deepEqual(effective.s8Overlay.changedTaskIds,['LTL-03']);
for(const task of effective.tasks)if(task.taskId!=='LTL-03')assert.deepEqual(task,base.tasks.find(t=>t.taskId===task.taskId),'unchanged Road task must remain lossless');
assert.deepEqual(effective.tasks.find(t=>t.taskId==='LTL-03').governedOverlay,overlay.taskOverrides[0]);
assert.equal(effective.tasks.find(t=>t.taskId==='LTL-03').operationalKnowledgeV2.informationResolutionBaselineRef,'BOL Information Resolution Baseline v0.1 — Road LTL / Malkom');
const report={ok:true,deterministicByteIdentity:true,governedInputs:inputs.sources,oceanPackage:inputs.package,outputs:{},materializedOutputsVerified:false};
let materializedCount=0;
for(const id of ['road-ltl','ocean-fcl','ocean-lcl']){
 const generate=()=>id==='road-ltl'?road():ocean(id),a=generate(),b=generate();
 assert.deepEqual(a.model.dimensions,DIMENSIONS);
 assert.equal(a.model.status,'FROZEN');
 assert.equal(a.model.identity.moduleVersion,id==='road-ltl'?'1.5':'0.6');
 assert.equal(a.model.counts.processCount,id==='road-ltl'?22:30);
 assert.equal(a.model.identity.baselineCommit,'f9b08a951ca823ff8c23b64044fe1a7abb9dde79');
 assert.equal(a.projection.identity.canonicalModelHash,a.model.identity.outputHash);
 assert.equal(a.model.identity.outputHash,hash(JSON.stringify({...a.model,identity:{...a.model.identity,outputHash:''}})));
 assert.deepEqual(a.projection.executionBoundary,{depth:'A5_EXECUTION_REFERENCE_CANDIDATE',executionStatus:'MODELED_NOT_EXECUTOR_PROVEN',nextLayer:'NEXT_LAYER_NOT_INCLUDED',independentExecutionProof:'PENDING',promotion:false});
 assert.equal(a.model.counts.edgeCount,a.model.hierarchy.tasks.reduce((sum,t)=>sum+t.sourceRecord.branchTransitions.length,0));
 assert.ok(a.model.hierarchy.tasks.every(t=>t.stableId&&t.minimum_record&&t.knowledge_state&&t.provenance.length));
 assert.ok(a.model.provenance.every(p=>p.claimBoundary&&p.sourceIdentities.length&&p.sourceIdentities.every(s=>s.id&&s.issuer&&s.version)));
 if(id==='road-ltl'){
  assert.equal(a.model.counts.a3Count,13);assert.equal(a.model.counts.sourceCount,29);
  assert.equal(a.model.identity.moduleSha256,'22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f');
  assert.equal(a.model.counts.edgeCount,effective.tasks.reduce((n,t)=>n+t.branchTransitions.length,0));
  for(const t of a.model.hierarchy.tasks)assert.deepEqual(t.sourceRecord,effective.tasks.find(x=>x.taskId===t.id));
 }else{
  assert.equal(a.model.sourceModule.status,'EXECUTION_READY_REFERENCE_CANDIDATE');
  assert.equal(a.projection.module.depth,'A5_EXECUTION_REFERENCE_CANDIDATE');
  const original=JSON.parse(inputs.zip.get(`atlas-daughter-release-ltl-v1.4-ocean-v0.6/data/modules/${id}-v0.6.json`));
  assert.deepEqual(a.model.sourceRegistry,original.sourceRegistry);
  assert.deepEqual(a.model.hierarchy.tasks.map(t=>t.sourceRecord),original.tasks);
  for(const [p,obj] of Object.entries(a.model.certifiedSidecars))assert.deepEqual(obj,JSON.parse(inputs.zip.get('atlas-daughter-release-ltl-v1.4-ocean-v0.6/'+p)));
  assert.equal(Object.keys(a.model.certifiedSidecars).length,4);
 }
 report.outputs[id]={counts:a.model.counts,sourceVersion:a.model.identity.moduleVersion,moduleSha256:a.model.identity.moduleSha256,files:{}};
 for(const [key,name] of [['model','knowledge-model-v1.json'],['projection','page-projection-v1.json']]){
  assert.equal(Buffer.compare(bytes(a[key]),bytes(b[key])),0,id+' repeated byte identity');
  const p=`data/generated/daughters/${id}/${name}`;
  if(fs.existsSync(p)){assert.equal(Buffer.compare(fs.readFileSync(p),bytes(a[key])),0,p+' committed output must equal regeneration');materializedCount++;}
  report.outputs[id].files[p]=hash(bytes(a[key]));
 }
}
assert.ok(materializedCount===0||materializedCount===6,'partial materialization refused');
report.materializedOutputsVerified=materializedCount===6;
if(process.env.S8_REQUIRE_MATERIALIZED==='1')assert.equal(materializedCount,6);
console.log(JSON.stringify(report,null,2));
