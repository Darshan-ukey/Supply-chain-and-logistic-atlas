import {getModel,processById} from '../atlas/store.js';
import {ALLOWED_FACT_STATUS,FACT_STATUS} from './contracts.js';
const MUTATION_WORDS=/\b(edit atlas|change atlas|update atlas|delete atlas|rewrite atlas|patch atlas|modify frozen|overwrite source)\b/i;
export function validateWorkspace(ws){
 const errors=[],warnings=[]; const model=getModel(); const validIds=new Set(model.processes.map(p=>p.id));
 if(!ws||typeof ws!=='object')errors.push('Workspace is missing or invalid.');
 if(MUTATION_WORDS.test(JSON.stringify(ws||{})))errors.push('Workspace contains an Atlas mutation instruction, which is forbidden.');
 for(const layer of ['asIs','toBe']){
  for(const fact of ws?.[layer]?.facts||[]){
   if(fact.processId&&!validIds.has(fact.processId))errors.push(`${layer}: unknown Atlas process ${fact.processId}`);
   if(!ALLOWED_FACT_STATUS.has(fact.status))errors.push(`${layer}: invalid fact status ${fact.status}`);
   if(fact.status===FACT_STATUS.CONFIRMED&&!(fact.evidenceRef||fact.evidenceText))warnings.push(`${layer}: ${fact.processId||fact.label||'fact'} is CONFIRMED but has no evidence reference.`);
   if(fact.status===FACT_STATUS.REFERENCE_ONLY&&fact.clientValue)errors.push(`${layer}: REFERENCE_ONLY fact cannot contain a client-confirmed value.`);
   if(fact.status===FACT_STATUS.UNKNOWN&&fact.clientValue)errors.push(`${layer}: UNKNOWN fact cannot contain a client value.`);
  }
 }
 const ref=ws?.reference?.processIds||[]; for(const id of ref)if(!validIds.has(id))errors.push(`Reference contains unknown Atlas process ${id}`);
 return {passed:errors.length===0,errors,warnings,guardrails:{atlasReadOnly:true,unknownsPreserved:true,inferredNeverPromotedAutomatically:true,referenceOnlyNeverTreatedAsClientTruth:true,toBeAdvisoryUntilHumanApproved:true}};
}
export function validateProcessOrder(processIds){
 const ids=processIds.filter(Boolean),errors=[],pos=new Map(ids.map((id,i)=>[id,i]));
 for(const e of getModel().processFlowEdges||[]){
  if(!['PRECEDES','REQUIRES','TRIGGERS','ENABLES','FOLLOWS'].includes(e.type))continue;
  if(!pos.has(e.from)||!pos.has(e.to))continue;
  if(e.type==='FOLLOWS'){if(pos.get(e.from)<pos.get(e.to))errors.push(`${e.from} is governed as FOLLOWING ${e.to}, but appears before it.`)}
  else if(pos.get(e.from)>pos.get(e.to))errors.push(`${e.from} ${e.type} ${e.to}, but appears after it.`);
 }
 return {passed:errors.length===0,errors};
}
export function processReferenceCard(id){const p=processById(id);if(!p)return null;return {id:p.id,label:p.label,phase:p.phase,pathType:p.pathType,actor:p.actor,performer:p.performer,owner:p.owner,authoritySystem:p.authoritySystem,inputs:p.inputs,outputs:p.outputs,control:p.control,evidence:p.evidence,outcome:p.outcome,sourceIds:p.sourceIds}}
