'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const requiredA5=['id','label','level','a3ParentId','trigger','before','event','decision','rule','control','clock','action','evidence','after','outcome','inputs','outputs','sourceIds','applicability','pathType','participants','confidenceModel','stateBeforeId','stateAfterId','decisionId','ruleId','controlId','actionId','evidenceId','outcomeId'];
function read(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))}
function nonempty(v){return v!==undefined&&v!==null&&(!(typeof v==='string')||v.trim().length>0)}
function alignmentIndex(){try{return Object.fromEntries(read('data/crosswalks/process-concept-crosswalk-v1.json').mappings.map(x=>[`${x.moduleId}:${x.processId}`,x.canonicalProcessConceptId]))}catch{return{}}}
function validateModule(module,entry={}){
 const errors=[],warnings=[],depth=entry.depth||module.depth||'REFERENCE_ONLY',moduleId=entry.id||module.id||'',ids=new Set(),sourceIds=new Set((module.sources||[]).map(s=>s.id)),a3Ids=new Set((module.a3Parents||[]).map(a=>a.id)),align=alignmentIndex();
 if(!Array.isArray(module.processes)||!module.processes.length)errors.push('Module must contain processes');
 for(const s of module.sources||[])for(const k of ['id','issuer','title','version','status','accessDate'])if(!nonempty(s[k]))errors.push(`Source ${s.id||'?'}: missing governed metadata ${k}`);
 for(const p of module.processes||[]){if(!p.id||!p.label)errors.push('Every process requires id and label');if(ids.has(p.id))errors.push(`Duplicate process id ${p.id}`);ids.add(p.id);if(depth==='A5_VERIFIED'){for(const k of requiredA5)if(!nonempty(p[k]))errors.push(`${p.id}: missing A5 field ${k}`);if(!Array.isArray(p.sourceIds)||!p.sourceIds.length)errors.push(`${p.id}: sourceIds required`);for(const sid of p.sourceIds||[])if(!sourceIds.has(sid))errors.push(`${p.id}: unknown sourceId ${sid}`);if(a3Ids.size&&p.a3ParentId&&!a3Ids.has(p.a3ParentId))errors.push(`${p.id}: unknown a3ParentId ${p.a3ParentId}`);if(moduleId&&!p.canonicalProcessConceptId&&!align[`${moduleId}:${p.id}`])errors.push(`${p.id}: missing canonical process-concept alignment for A5 comparison`)}}
 let rel={};try{rel=read('governance/relationship-vocabulary-v1.json')}catch{}const flowAllowed=new Set(rel.namespaces?.PROCESS_FLOW?.types||[]),ontAllowed=new Set(rel.namespaces?.ONTOLOGY_EXECUTION?.types||[]);
 for(const e of module.processFlowEdges||[]){if(!ids.has(e.from)||!ids.has(e.to))errors.push(`${e.id||'edge'}: dangling process edge ${e.from}->${e.to}`);if(flowAllowed.size&&!flowAllowed.has(e.type))errors.push(`${e.id||'edge'}: unknown process relationship ${e.type}`)}
 for(const e of module.ontologyEdges||[]){if(ontAllowed.size&&!ontAllowed.has(e.type))errors.push(`${e.id||'ontology edge'}: unknown ontology relationship ${e.type}`)}
 if(depth==='A5_VERIFIED'&&(module.executionTransitions||[]).length!==(module.processes||[]).length)errors.push('A5_VERIFIED module requires one execution transition per process');
 return{valid:errors.length===0,errors,warnings,stats:{processes:(module.processes||[]).length,sources:(module.sources||[]).length,edges:(module.processFlowEdges||[]).length,depth,moduleId}};
}
module.exports={requiredA5,validateModule};
