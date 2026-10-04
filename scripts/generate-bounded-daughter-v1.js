import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,blob,exactBytes,unzip} from './s8-3a-certified-inputs.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASELINE='f9b08a951ca823ff8c23b64044fe1a7abb9dde79';
const GENERATOR_ID='atl-155-bounded-daughter-generator',GENERATOR_VERSION='1.3.0-s8-3a',CONTRACT_VERSION='ATL-155-BOUNDED-DAUGHTER-GENERATION-V1';
const DIMENSIONS=['hierarchy','objects/documents','actors','systems','events','dependencies','controls','known gaps'];
const STATE_MAP={BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'};
const ROAD15_SHA256='22965f4b7ec2c3d192f86edf5bb073e4820fd3724cda02aa0502e4ff4404ac6f';
const SOURCE_PINS={
 'governance/product/ATL_153_V1_5_GOVERNED_SOURCE_UNIVERSE_BASELINE_V1.md':'ab224f715a2735f19c590986eae31927b936fa2a',
 'data/modules/road-ltl-v1.4.json':'d06974e9ee86cea59227e0866a98ad5d1367bfad',
 'data/modules/road-ltl-v1.5.json':'b69883d5369be8aad15bb9325f910610da875771',
 'data/operational-knowledge/road-ltl-v1.5-operational.json':'91408e34382a26bd96f1d6224b252dfb9f8b8d53',
 'governance/product/s8-3a-baseline/data/governance/source-registry-v1.json':'6beaa755b5046d577b3211cd48ddccbe81f8475c',
 'governance/product/s8-3a-baseline/data/governance/destination-coverage-registry-v1.json':'20ec299542e20cc1f6b0373850fcae3010e80ec9',
 'governance/product/s8-3a-baseline/data/atlas-registry.json':'d29f48119895c00555acee98d29f7ccbd27acb1b',
 'governance/product/s8-3a-baseline/data/provenance/road-ltl-claim-provenance-v1.json':'25cd876658c2de42445ca49eab80abe003eceea2'
};
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const seal=o=>{o.identity.outputHash=hash(JSON.stringify({...o,identity:{...o.identity,outputHash:''}}));return o;};
function certifiedInputs(){
 const sources=Object.entries(SOURCE_PINS).map(([p,b])=>{const bytes=exactBytes(path.join(ROOT,p),b,p==='data/modules/road-ltl-v1.5.json'?ROAD15_SHA256:null);return{path:p,gitBlob:b,sha256:hash(bytes)};});
 const cert=read('governance/product/S8_3A_OCEAN_0_6_SOURCE_CERTIFICATION.json');
 if(cert.promotion!==false||!cert.constraints.includes('NO_OCEAN_0_5_FALLBACK'))throw Error('OCEAN_CERTIFICATION_BOUNDARY');
 const packagePath='release/packages/frozen/atlas-daughter-release-ltl-v1.4-ocean-v0.6.zip';
 const packageBlob='5e7f31db1c2c9db6d265f0f6d9def6ff75b19a5e',packageHash='b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289';
 const zip=unzip(exactBytes(path.join(ROOT,packagePath),packageBlob,packageHash));
 const payloads={};
 for(const [p,expected] of Object.entries(cert.payloads)){
  const b=zip.get('atlas-daughter-release-ltl-v1.4-ocean-v0.6/'+p);
  if(!b||hash(b)!==expected)throw Error('OCEAN_PAYLOAD_IDENTITY:'+p);
  payloads[p]={gitBlob:blob(b),sha256:hash(b)};
 }
 return{sources,cert,zip,payloads,package:{path:packagePath,gitBlob:packageBlob,sha256:packageHash}};
}
function effectiveRoad15(){
 certifiedInputs();
 const base=read('data/modules/road-ltl-v1.4.json'),overlay=read('data/modules/road-ltl-v1.5.json');
 if(overlay.baseAsset.sha256!=='c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4')throw Error('ROAD14_IDENTITY_MISMATCH');
 const byId=new Map(overlay.taskOverrides.map(x=>[x.id,x]));
 const tasks=base.tasks.map(t=>{const x=byId.get(t.taskId);if(!x)return t;return {...t,title:x.label||t.title,identity:{...t.identity,a5ContractId:x.a5ContractId,canonicalProcessConceptId:x.canonicalProcessConceptId},baseline:{...t.baseline,trigger:x.trigger,before:x.before,event:x.event,decision:x.decision,rule:x.rule,control:x.control,clock:x.clock,action:x.action,evidence:x.evidence,after:x.after,outcome:x.outcome},operationalKnowledgeV2:x.operationalKnowledgeV2,executionReadiness:x.executionReadiness,governedOverlay:x};});
 return {...base,module:{...base.module,version:'1.5',status:overlay.status,depth:'A5_EXECUTION_REFERENCE_CANDIDATE'},tasks,s8Overlay:{schemaVersion:overlay.schemaVersion,representation:overlay.representation,changedTaskIds:overlay.materializationPolicy.changedTaskIds,sourceSha256:ROAD15_SHA256}};
}
function assertPublishable(id){
 if(!['road-ltl','ocean-fcl','ocean-lcl'].includes(id))throw Error('REFUSE_UNGOVERNED_PUBLICATION:'+id);
 const catalog=read('data/module-catalog.json');
 const fixture=(catalog.testFixtures||[]).find(x=>x.id===id);
 if(fixture&&(fixture.testOnly||fixture.mustNotPublish||fixture.publicationState==='TEST_ONLY'))throw Error('REFUSE_TEST_ONLY_PUBLICATION:'+id);
 return true;
}
function build(id,module,moduleHash,inputs,sidecars={}){
 assertPublishable(id);
 const sourceMap=new Map(module.sourceRegistry.map(s=>[s.id,s]));
 const provenance=claims=>claims.map(claim=>({...claim,baseline_commit:BASELINE,sourceIdentities:(claim.sourceRefs||[]).map(sourceId=>{const s=sourceMap.get(sourceId);if(!s)throw Error('UNRESOLVED_SOURCE:'+sourceId);return {...s};})}));
 const groups=[...new Map(module.tasks.map(t=>[t.a3ParentId||t.a3ParentLabel,t.a3ParentLabel])).entries()];
 const a3=groups.map(([group,label],index)=>({id:module.tasks.find(t=>(t.a3ParentId||t.a3ParentLabel)===group).a3ParentId||`${id}::a3::${index+1}`,stableId:`${id}::${group}`,label,identityBasis:module.tasks.some(t=>t.a3ParentId===group)?'GOVERNED_ID':'EXACT_SOURCE_LABEL_GROUP',childProcessIds:module.tasks.filter(t=>(t.a3ParentId||t.a3ParentLabel)===group).map(t=>t.taskId)}));
 const tasks=module.tasks.map(t=>({id:t.taskId,stableId:`${id}::${t.taskId}`,label:t.title,parentId:a3.find(a=>a.childProcessIds.includes(t.taskId)).id,objects:{requiredInformation:t.requiredInformation||[],documents:t.documents||[]},actors:t.responsibility||{},systems:t.systemExchanges||[],events:t.baseline?.event?[t.baseline.event]:[],dependencies:t.branchTransitions||[],controls:[...(t.constraints||[]),...(t.controls||[])],knownGaps:[],minimum_record:{affected_object:t.baseline?.authorityObject||t.taskId,evidence_class:'CANDIDATE',confidence:'GOVERNED_CANDIDATE',promotion_requirement:'INDEPENDENT_EXECUTION_PROOF'},knowledge_state:'CANDIDATE_UNVALIDATED',provenance:provenance(t.provenanceClaims||[]),sourceRecord:t}));
 const edges=module.tasks.flatMap(t=>(t.branchTransitions||[]).map(x=>({...x,taskId:t.taskId})));
 const identity={baselineCommit:BASELINE,moduleId:id,moduleVersion:module.module.version,moduleSha256:moduleHash,generatorId:GENERATOR_ID,generatorVersion:GENERATOR_VERSION,contractVersion:CONTRACT_VERSION,inputHash:hash(JSON.stringify(inputs)),outputHash:''};
 const model={schemaVersion:'atlas-daughter-knowledge-model-v1',status:'FROZEN',identity,governedInputs:inputs,sourceModule:module.module,sourceRegistry:module.sourceRegistry,sourceMetadata:Object.fromEntries(Object.entries(module).filter(([key])=>!['tasks','module','sourceRegistry'].includes(key))),certifiedSidecars:sidecars,knowledgeStateMapping:STATE_MAP,hierarchy:{a3,tasks},edges,dimensions:DIMENSIONS,knownGaps:[],provenance:tasks.flatMap(t=>t.provenance),counts:{processCount:tasks.length,a3Count:a3.length,edgeCount:edges.length,sourceCount:module.sourceRegistry.length},executionBoundary:{depth:'A5_EXECUTION_REFERENCE_CANDIDATE',executionStatus:'MODELED_NOT_EXECUTOR_PROVEN',nextLayer:'NEXT_LAYER_NOT_INCLUDED',independentExecutionProof:'PENDING',promotion:false},storage:{path:`data/generated/daughters/${id}/knowledge-model-v1.json`,writer:GENERATOR_ID,validator:'tests/atl-155-bounded-daughter-generation.test.js',promoter:'Owner release gate'},retrieval:{interface:'static governed JSON',consumer:'Atlas runtime'}};
 seal(model);
 const projection={schemaVersion:'atlas-daughter-page-projection-v1',status:'FROZEN',identity:{...model.identity,canonicalModelHash:model.identity.outputHash,outputHash:''},executionBoundary:model.executionBoundary,ux:{entrypoint:'index.html',activation:`window.activateModule("${id}")`,component:'existing Atlas spatial canvas + selected-item Inspector',contract:'atlas-page0-contract-v1.0'},module:{id,version:module.module.version,status:module.module.status,depth:'A5_EXECUTION_REFERENCE_CANDIDATE'},sections:a3.map(a=>({id:a.id,title:a.label,tasks:a.childProcessIds})),knowledgeModelPath:model.storage.path};seal(projection);return{model,projection};
}
function road(){const input=certifiedInputs(),module=effectiveRoad15();const out=build('road-ltl',module,ROAD15_SHA256,{baselineCommit:BASELINE,sources:input.sources,changedTaskIds:module.s8Overlay.changedTaskIds});if(out.model.counts.processCount!==22||out.model.counts.a3Count!==13||out.model.counts.sourceCount!==29)throw Error('ROAD15_RECONCILIATION_FAILED');return out;}
function ocean(id){
 if(!['ocean-fcl','ocean-lcl'].includes(id))throw Error('OCEAN_ID_REFUSED');
 const input=certifiedInputs(),prefix='atlas-daughter-release-ltl-v1.4-ocean-v0.6/';
 const modulePath=`data/modules/${id}-v0.6.json`,module=JSON.parse(input.zip.get(prefix+modulePath));
 if(module.module.id!==id||module.module.version!=='0.6'||module.module.status!=='EXECUTION_READY_REFERENCE_CANDIDATE'||module.tasks.length!==30)throw Error('OCEAN_GOVERNED_IDENTITY');
 const sidecars={};for(const p of Object.keys(input.payloads).filter(p=>p.includes(id)&&p!==modulePath))sidecars[p]=JSON.parse(input.zip.get(prefix+p));
 return build(id,module,input.payloads[modulePath].sha256,{baselineCommit:BASELINE,sources:input.sources.filter(s=>s.path.includes('baseline')||s.path.includes('ATL_153')),package:input.package,payloads:Object.fromEntries(Object.entries(input.payloads).filter(([p])=>p.includes(id)))},sidecars);
}
function write(id,out){assertPublishable(id);const dir=path.join(ROOT,'data/generated/daughters',id);fs.mkdirSync(dir,{recursive:true});for(const [key,name] of [['model','knowledge-model-v1.json'],['projection','page-projection-v1.json']])fs.writeFileSync(path.join(dir,name),JSON.stringify(out[key],null,2)+'\n');}
function generateAll(){const out={'road-ltl':road(),'ocean-fcl':ocean('ocean-fcl'),'ocean-lcl':ocean('ocean-lcl')};for(const [id,value] of Object.entries(out))write(id,value);return out;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))generateAll();
export {road,ocean,assertPublishable,generateAll,STATE_MAP,DIMENSIONS,effectiveRoad15,certifiedInputs,SOURCE_PINS};
