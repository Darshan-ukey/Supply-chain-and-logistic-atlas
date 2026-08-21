import {processById} from '../atlas/store.js';
export function suggestFutureState(ws,analysis){
 const suggestions=[];
 for(const g of analysis.potentialGaps||[]){const p=processById(g.processId);if(!p)continue;
  if(g.type==='MANUAL_HANDOFF'||g.type==='DATA_REENTRY')suggestions.push({processId:p.id,label:p.label,pattern:'Workflow / integration / deterministic automation first',proposal:'Reduce manual transfer and duplicate entry while preserving authoritative-system ownership.',status:'AI_RECOMMENDATION'});
  if(g.type==='EXCEPTION_LATENCY')suggestions.push({processId:p.id,label:p.label,pattern:'Event detection + case orchestration + human approval',proposal:'Detect the exception earlier, create an owned case, gather evidence and route recovery actions.',status:'AI_RECOMMENDATION'});
  if(g.type==='CONTROL_GAP')suggestions.push({processId:p.id,label:p.label,pattern:'Rules engine + control evidence',proposal:'Make the control executable and auditable before considering autonomous action.',status:'AI_RECOMMENDATION'});
  if(g.type==='DISCOVERY_GAP')suggestions.push({processId:p.id,label:p.label,pattern:'Discovery required',proposal:'Do not design TO-BE yet. Confirm client execution, systems, actors, evidence and exceptions first.',status:'AI_RECOMMENDATION'});
 }
 return {suggestions,guardrail:'These are advisory transformation hypotheses. They do not alter the frozen Atlas or become client truth until manually validated.'};
}
