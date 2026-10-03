'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const BASELINE='f9b08a951ca823ff8c23b64044fe1a7abb9dde79';
const GENERATOR_ID='atl-155-bounded-daughter-generator',GENERATOR_VERSION='1.1.0',CONTRACT_VERSION='ATL-155-BOUNDED-DAUGHTER-GENERATION-V1';
const DIMENSIONS=['hierarchy','objects/documents','actors','systems','events','dependencies','controls','known gaps'];
const STATE_MAP={BASELINE_GOVERNED:'KNOWN_AUTHORITATIVE',CANDIDATE:'CANDIDATE_UNVALIDATED',CONDITIONAL:'CONTEXT_CONDITIONAL',CONFLICT:'CONFLICTING_EVIDENCE',UNRESOLVED:'UNKNOWN_OR_NOT_YET_GOVERNED'};
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const seal=o=>{o.identity.outputHash=sha({...o,identity:{...o.identity,outputHash:''}});return o};
const catalog=read('data/module-catalog.json'),registry=read('data/atlas-registry.json'),sourceRegistry=read('data/governance/source-registry-v1.json');
const sources=new Map(sourceRegistry.sources.map(s=>[s.id,s]));
function provenance(claim){
 return (claim.sourceIds||[]).map(id=>{const s=sources.get(id)||{};return{
  claim_id:claim.id,baseline_commit:BASELINE,governed_source_id:id,issuer:s.issuer||'UNKNOWN_GOVERNED_ISSUER',
  source_version:s.version||'UNKNOWN_GOVERNED_VERSION',source_status:s.status||'GOVERNED',
  scope:{mode:s.modeScope||null,jurisdiction:s.jurisdictionScope||null,role:s.roleScope||null},
  supports:s.supports||null,not_supports:s.notSupports||null,claim_boundary:claim.claimBoundary||null
 }})
}
function identity(id,version,moduleSha,input){return{baselineCommit:BASELINE,moduleId:id,moduleVersion:version,moduleSha256:moduleSha,generatorId:GENERATOR_ID,generatorVersion:GENERATOR_VERSION,contractVersion:CONTRACT_VERSION,inputHash:sha(input),outputHash:''}}
function road(){
 const module=read('data/modules/road-ltl-v1.2.json'),cat=catalog.modules.find(x=>x.id==='road-ltl'),reg=registry.modules.find(x=>x.id==='road-ltl');
 if(!cat||!reg||cat.publicationState!=='ACTIVE'||cat.depth!=='A5_VERIFIED')throw Error('road-ltl is not eligible ACTIVE/A5_VERIFIED');
 const input={baselineCommit:BASELINE,moduleCatalog:cat,registry:{id:reg.id,processCount:reg.processCount,a3Count:reg.a3Count,edgeCount:reg.edgeCount,sourceCount:reg.sourceCount},moduleSha256:cat.sha256,sourceRegistryId:sourceRegistry.registryId};
 const tasks=module.processes.map(p=>({
  id:p.id,stableId:'road-ltl::'+p.id,label:p.label,parentId:p.a3ParentId,
  objects:{inputs:p.inputs||[],outputs:p.outputs||[],documents:p.documentIds||[]},
  actors:[p.actor,p.performer,p.owner,p.decisionAuthority,p.exceptionOwner].filter(Boolean),
  systems:[p.authoritySystem,p.producer,p.consumers].filter(Boolean),
  events:p.eventIds||[],dependencies:{upstream:p.upstream||null,downstream:p.downstream||null},
  controls:[p.rule,p.control].filter(Boolean),knownGaps:[],
  minimum_record:{affected_object:p.authorityObject||p.id,evidence_class:'BASELINE_GOVERNED',confidence:p.confidenceModel?.executionDetailConfidence||'HIGH',promotion_requirement:'NONE_FROZEN_BASELINE'},
  knowledge_state:'KNOWN_AUTHORITATIVE',provenance:provenance(p)
 }));
 const model={schemaVersion:'atlas-daughter-knowledge-model-v1',status:'FROZEN',identity:identity('road-ltl',module.module.version,cat.sha256,input),knowledgeStateMapping:STATE_MAP,
  hierarchy:{a3:module.a3Parents.map(a=>({id:a.id,stableId:'road-ltl::'+a.id,label:a.label,childProcessIds:a.childProcessIds})),tasks},
  edges:module.processFlowEdges,dimensions:DIMENSIONS,knownGaps:[],provenance:tasks.flatMap(t=>t.provenance),
  counts:{processCount:tasks.length,a3Count:module.a3Parents.length,edgeCount:module.processFlowEdges.length,sourceCount:module.sources.length},
  storage:{path:'data/generated/daughters/road-ltl/knowledge-model-v1.json',writer:GENERATOR_ID,validator:'tests/atl-155-bounded-daughter-generation.test.js',promoter:'Owner gate ATL-142'},
  retrieval:{interface:'static governed JSON',consumer:'Atlas runtime via window.activateModule("road-ltl"); Inspector reads canonical selected process'}};
 const expected={processCount:reg.processCount,a3Count:reg.a3Count,edgeCount:reg.edgeCount,sourceCount:reg.sourceCount};
 if(JSON.stringify(model.counts)!==JSON.stringify(expected))throw Error('Road LTL count reconciliation failed');
 seal(model);
 const projection={schemaVersion:'atlas-daughter-page-projection-v1',status:'FROZEN',identity:{...model.identity,canonicalModelHash:model.identity.outputHash,outputHash:''},
  ux:{entrypoint:'index.html',activation:'window.activateModule("road-ltl")',component:'existing Atlas spatial canvas + selected-item Inspector',contract:'atlas-page0-contract-v1.0'},
  module:{id:'road-ltl',depth:'A5_VERIFIED'},sections:model.hierarchy.a3.map(a=>({id:a.id,title:a.label,tasks:a.childProcessIds})),knowledgeModelPath:model.storage.path};
 seal(projection);return{model,projection};
}
function reference(id,requestedDepth='REFERENCE_ONLY'){
 const planned=catalog.planned.find(x=>x.id===id),reg=registry.items.find(x=>x.id===id);
 if(!planned||planned.depth!=='REFERENCE_ONLY'||reg?.depth!=='REFERENCE_ONLY')throw Error(id+' is not governed REFERENCE_ONLY');
 if(requestedDepth!=='REFERENCE_ONLY')throw Error('REFUSE_UNGOVERNED_DEPTH:'+id+':'+requestedDepth);
 const input={baselineCommit:BASELINE,planned,registry:reg,sourceManifest:'reference/atlas-source-manifest.csv'};
 const idn=identity(id,'PLANNED',sha(planned),input);
 const gap={id:id+'::A4_A5',stableId:id+'::gap::A4_A5',knowledge_state:'RESEARCH_REQUIRED',minimum_record:{affected_object:id,evidence_class:'UNRESOLVED',confidence:'UNKNOWN',promotion_requirement:'GOVERNED_RESEARCH_AND_VALIDATION'},claim_boundary:'No governed A4/A5 exists in the frozen baseline; synthesis is prohibited.'};
 const model={schemaVersion:'atlas-daughter-knowledge-model-v1',status:'FROZEN',identity:idn,knowledgeStateMapping:STATE_MAP,hierarchy:{a3:[],tasks:[]},edges:[],dimensions:DIMENSIONS,knownGaps:[gap],provenance:[],
  storage:{path:'data/generated/daughters/'+id+'/knowledge-model-v1.json',writer:GENERATOR_ID,validator:'tests/atl-155-bounded-daughter-generation.test.js',promoter:'Owner gate ATL-142'},
  retrieval:{interface:'static governed JSON',consumer:'Atlas registry/reference coverage surface; deeper request remains RESEARCH_REQUIRED'}};
 seal(model);
 const projection={schemaVersion:'atlas-daughter-page-projection-v1',status:'FROZEN',identity:{...model.identity,canonicalModelHash:model.identity.outputHash,outputHash:''},
  ux:{entrypoint:'index.html',activation:'registry/reference coverage lookup for '+id,component:'existing Atlas module registry/reference coverage surface',contract:'atlas-page0-contract-v1.0'},
  module:{id,depth:'REFERENCE_ONLY'},sections:[{id:'coverage-gap',state:'RESEARCH_REQUIRED',gapId:gap.id}],knowledgeModelPath:model.storage.path};
 seal(projection);return{model,projection};
}
function assertPublishable(moduleId){
 const fixture=(catalog.testFixtures||[]).find(x=>x.id===moduleId);
 if(fixture&&(fixture.testOnly||fixture.mustNotPublish||fixture.publicationState==='TEST_ONLY'))throw Error('REFUSE_TEST_ONLY_PUBLICATION:'+moduleId);
 return true;
}
function write(id,out){const dir=path.join(ROOT,'data/generated/daughters',id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'knowledge-model-v1.json'),JSON.stringify(out.model,null,2)+'\n');fs.writeFileSync(path.join(dir,'page-projection-v1.json'),JSON.stringify(out.projection,null,2)+'\n')}
function generateAll(){const out={'road-ltl':road(),'ocean-fcl':reference('ocean-fcl'),'ocean-lcl':reference('ocean-lcl')};for(const [id,v] of Object.entries(out))write(id,v);return out}
if(require.main===module)generateAll();
module.exports={road,reference,assertPublishable,generateAll,STATE_MAP,DIMENSIONS};
