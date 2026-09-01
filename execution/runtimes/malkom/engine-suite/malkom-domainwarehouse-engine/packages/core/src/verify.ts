import type { WorkDefinition } from '@malkom/domainwarehouse-contract';
import { compileWorkflow } from './workflow.js';

export interface VerificationIssue { severity:'ERROR'|'WARNING'; code:string; message:string; workDefinitionId?:string; }
export interface VerificationResult { valid:boolean; issues:VerificationIssue[]; }

export function verify(definitions:WorkDefinition[]):VerificationResult {
  const issues:VerificationIssue[]=[]; const ids=new Set<string>(); const tasks=new Set<string>();
  for(const d of definitions){
    if(ids.has(d.id))issues.push({severity:'ERROR',code:'DUPLICATE_ID',message:`Duplicate definition ${d.id}`,workDefinitionId:d.id});ids.add(d.id);
    if(tasks.has(d.sourceTask.taskId))issues.push({severity:'ERROR',code:'DUPLICATE_TASK',message:`Duplicate source task ${d.sourceTask.taskId}`,workDefinitionId:d.id});tasks.add(d.sourceTask.taskId);
    if(d.provenance.sourceRecord!=='SOURCE_BACKED'||d.provenance.canonical!=='SOURCE_BACKED')issues.push({severity:'ERROR',code:'SOURCE_PROVENANCE',message:'Canonical/source records must remain SOURCE_BACKED.',workDefinitionId:d.id});
    if(d.provenance.decomposition!=='MALKOM_STANDARD')issues.push({severity:'ERROR',code:'DECOMPOSITION_PROVENANCE',message:'Malkom decomposition must be marked MALKOM_STANDARD.',workDefinitionId:d.id});
    if(!d.notes.length)issues.push({severity:'ERROR',code:'MISSING_KNOWLEDGE_NOTES',message:'v2.3 requires first-class KnowledgeNote records.',workDefinitionId:d.id});
    if(!d.projections.length)issues.push({severity:'ERROR',code:'MISSING_RUNTIME_PROJECTION',message:'v2.3 requires explicit runtime projection metadata.',workDefinitionId:d.id});
    const noteIds=new Set<string>();for(const note of d.notes){if(noteIds.has(note.id))issues.push({severity:'ERROR',code:'DUPLICATE_NOTE',message:`Duplicate knowledge note ${note.id}`,workDefinitionId:d.id});noteIds.add(note.id);}
    const p=d.decomposition.malkom; const wt=new Set(p.workTypes.map(w=>w.name)); const outcomes=new Set(p.outcomes.map(o=>o.id));
    for(const s of p.subQueues){for(const w of s.workTypes)if(!wt.has(w))issues.push({severity:'ERROR',code:'UNKNOWN_WORKTYPE',message:`Subqueue ${s.name} references ${w}`,workDefinitionId:d.id});for(const o of s.outcomes)if(!outcomes.has(o))issues.push({severity:'ERROR',code:'UNKNOWN_OUTCOME',message:`Subqueue ${s.name} references ${o}`,workDefinitionId:d.id});}
    const wf=compileWorkflow(d); for(const b of wf.blockers)issues.push({severity:'WARNING',code:'RUNTIME_CAPABILITY_GAP',message:`${b.outcomeCode}: ${b.nextStep}${b.targetTaskId?` -> ${b.targetTaskId}`:''}`,workDefinitionId:d.id});
  }
  return {valid:!issues.some(i=>i.severity==='ERROR'),issues};
}
