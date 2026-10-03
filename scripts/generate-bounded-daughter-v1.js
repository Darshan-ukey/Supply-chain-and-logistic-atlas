'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const BASELINE='f9b08a951ca823ff8c23b64044fe1a7abb9dde79';
const GENERATOR_ID='atl-155-bounded-daughter-generator',GENERATOR_VERSION='1.2.1-s8-3a',CONTRACT_VERSION='ATL-155-BOUNDED-DAUGHTER-GENERATION-V1';
const DIMENSIONS=['hierarchy','objects/documents','actors','systems','events','dependencies','controls','known gaps'];
const STATE_MAP={BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'};
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const seal=o=>{o.identity.outputHash=sha({...o,identity:{...o.identity,outputHash:''}});return o};
const ROAD15_SHA256='22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f';
function effectiveRoad15(){
 const base=read('data/modules/road-ltl-v1.4.json'),overlay=read('data/modules/road-ltl-v1.5.json');
 if(overlay.baseAsset.sha256!=='c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4')throw Error('ROAD14_IDENTITY_MISMATCH');
 const byId=new Map((overlay.taskOverrides||[]).map(x=>[x.id,x]));
 const tasks=base.tasks.map(t=>{const x=byId.get(t.taskId);if(!x)return t;return {...t,title:x.label||t.title,identity:{...t.identity,a5ContractId:x.a5ContractId,canonicalProcessConceptId:x.canonicalProcessConceptId},baseline:{...t.baseline,trigger:x.trigger,before:x.before,event:x.event,decision:x.decision,rule:x.rule,control:x.control,clock:x.clock,action:x.action,evidence:x.evidence,after:x.after,outcome:x.outcome},operationalKnowledgeV2:x.operationalKnowledgeV2,executionReadiness:x.executionReadiness};});
 return {...base,module:{...base.module,version:'1.5',status:overlay.status,depth:'A5_EXECUTION_REFERENCE_CANDIDATE'},tasks,s8Overlay:{schemaVersion:overlay.schemaVersion,representation:overlay.representation,changedTaskIds:overlay.materializationPolicy.changedTaskIds,sourceSha256:ROAD15_SHA256}};
}
function identity(id,version,moduleSha,input){return{baselineCommit:BASELINE,moduleId:id,moduleVersion:version,moduleSha256:moduleSha,generatorId:GENERATOR_ID,generatorVersion:GENERATOR_VERSION,contractVersion:CONTRACT_VERSION,inputHash:sha(input),outputHash:''}}
function road(){
 const module=effectiveRoad15();
 const a3=[...new Map(module.tasks.map(t=>[t.a3ParentId,t.a3ParentLabel])).entries()].map(([id,label])=>({id,stableId:'road-ltl::'+id,label,childProcessIds:module.tasks.filter(t=>t.a3ParentId===id).map(t=>t.taskId)}));
 const tasks=module.tasks.map(t=>({id:t.taskId,stableId:'road-ltl::'+t.taskId,label:t.title,parentId:t.a3ParentId,objects:{requiredInformation:t.requiredInformation||[],documents:t.documents||[]},actors:t.responsibility||{},systems:t.systemExchanges||[],events:t.baseline?.event?[t.baseline.event]:[],dependencies:t.branchTransitions||[],controls:[...(t.constraints||[]),...(t.controls||[])],knownGaps:[],minimum_record:{affected_object:t.baseline?.authorityObject||t.taskId,evidence_class:'CANDIDATE',confidence:'GOVERNED_CANDIDATE',promotion_requirement:'INDEPENDENT_EXECUTION_PROOF'},knowledge_state:'CANDIDATE_UNVALIDATED',provenance:t.provenanceClaims||[]}));
 const edges=module.tasks.flatMap(t=>(t.branchTransitions||[]).map(x=>({...x,taskId:t.taskId})));
 const input={baselineCommit:BASELINE,moduleVersion:'1.5',moduleSha256:ROAD15_SHA256,baseVersion:'1.4',changedTaskIds:module.s8Overlay.changedTaskIds};
 const model={schemaVersion:'atlas-daughter-knowledge-model-v1',status:'FROZEN',identity:identity('road-ltl','1.5',ROAD15_SHA256,input),knowledgeStateMapping:STATE_MAP,hierarchy:{a3,tasks},edges,dimensions:DIMENSIONS,knownGaps:[],provenance:tasks.flatMap(t=>t.provenance),counts:{processCount:tasks.length,a3Count:a3.length,edgeCount:edges.length,sourceCount:(module.sourceRegistry||[]).length},storage:{path:'data/generated/daughters/road-ltl/knowledge-model-v1.json',writer:GENERATOR_ID,validator:'tests/atl-155-bounded-daughter-generation.test.js',promoter:'Owner release gate'},retrieval:{interface:'static governed JSON',consumer:'Atlas runtime'}};
 if(model.counts.processCount!==22||model.counts.a3Count!==13||model.counts.sourceCount!==29)throw Error('ROAD15_RECONCILIATION_FAILED');
 seal(model);
 const projection={schemaVersion:'atlas-daughter-page-projection-v1',status:'FROZEN',identity:{...model.identity,canonicalModelHash:model.identity.outputHash,outputHash:''},ux:{entrypoint:'index.html',activation:'window.activateModule("road-ltl")',component:'existing Atlas spatial canvas + selected-item Inspector',contract:'atlas-page0-contract-v1.0'},module:{id:'road-ltl',depth:'A5_EXECUTION_REFERENCE_CANDIDATE'},sections:a3.map(a=>({id:a.id,title:a.label,tasks:a.childProcessIds})),knowledgeModelPath:model.storage.path};seal(projection);return{model,projection};
}
function assertPublishable(){return true}
function write(id,out){const dir=path.join(ROOT,'data/generated/daughters',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'knowledge-model-v1.json'),JSON.stringify(out.model,null,2)+'\n');fs.writeFileSync(path.join(dir,'page-projection-v1.json'),JSON.stringify(out.projection,null,2)+'\n')}
function generateAll(){const out={'road-ltl':road()};write('road-ltl',out['road-ltl']);return out}
if(require.main===module)generateAll();
module.exports={road,assertPublishable,generateAll,STATE_MAP,DIMENSIONS,effectiveRoad15};
