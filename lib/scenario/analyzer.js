import {getModel,processById} from '../atlas/store.js';
import {FACT_STATUS} from './contracts.js';
import {incoming,outgoing} from '../atlas/graph.js';
function byProcess(facts=[]){const m=new Map();facts.forEach(f=>{if(f.processId)m.set(f.processId,f)});return m}
export function analyzeWorkspace(ws){
 const model=getModel(),as=byProcess(ws?.asIs?.facts),refIds=(ws?.reference?.processIds?.length?ws.reference.processIds:model.processes.map(p=>p.id));
 const mapped=[],unknown=[],referenceOnly=[],inferred=[],deviations=[],potentialGaps=[];
 for(const id of refIds){const p=processById(id);if(!p)continue;const f=as.get(id);
  if(!f){referenceOnly.push({processId:id,label:p.label,reason:'Atlas reference exists; client state not mapped.'});continue}
  if(f.status===FACT_STATUS.UNKNOWN)unknown.push({processId:id,label:p.label});
  else if(f.status===FACT_STATUS.REFERENCE_ONLY)referenceOnly.push({processId:id,label:p.label,reason:'Reference-only; not client-confirmed.'});
  else if(f.status===FACT_STATUS.INFERRED)inferred.push({processId:id,label:p.label,clientValue:f.clientValue||''});
  else mapped.push({processId:id,label:p.label,status:f.status,clientValue:f.clientValue||''});
  if(f.clientLabel&&f.clientLabel!==p.label)deviations.push({processId:id,type:'NAMING_OR_PROCESS_VARIANT',reference:p.label,client:f.clientLabel});
  if(f.systemName&&p.authoritySystem&&!String(f.systemName).toLowerCase().includes(String(p.authoritySystem).toLowerCase()))deviations.push({processId:id,type:'SYSTEM_INSTANCE_VARIANT',reference:p.authoritySystem,client:f.systemName});
  if(f.manualHandoff)potentialGaps.push({processId:id,type:'MANUAL_HANDOFF',detail:f.manualHandoff});
  if(f.rekeying)potentialGaps.push({processId:id,type:'DATA_REENTRY',detail:f.rekeying});
  if(f.exceptionLatency)potentialGaps.push({processId:id,type:'EXCEPTION_LATENCY',detail:f.exceptionLatency});
  if(f.controlGap)potentialGaps.push({processId:id,type:'CONTROL_GAP',detail:f.controlGap});
 }
 for(const u of unknown){const inc=incoming(u.processId).map(e=>e.from),out=outgoing(u.processId).map(e=>e.to);potentialGaps.push({processId:u.processId,type:'DISCOVERY_GAP',detail:`Client state unknown. Upstream: ${inc.join(', ')||'none mapped'}; downstream: ${out.join(', ')||'none mapped'}.`})}
 const discoveryQuestions=unknown.concat(referenceOnly.slice(0,10)).map(x=>({processId:x.processId,question:`How does the client execute ${x.label}? Which system, actor, evidence, exception path and control are actually used?`}));
 return {summary:{referenceProcesses:refIds.length,mapped:mapped.length,unknown:unknown.length,referenceOnly:referenceOnly.length,inferred:inferred.length,deviations:deviations.length,potentialGaps:potentialGaps.length},mapped,unknown,referenceOnly,inferred,deviations,potentialGaps,discoveryQuestions,warning:'Difference from Atlas is not automatically a problem. Potential gaps require human validation.'};
}
export function deltaView(ws){const a=byProcess(ws?.asIs?.facts),b=byProcess(ws?.toBe?.facts),ids=new Set([...a.keys(),...b.keys()]);const rows=[];for(const id of ids){const A=a.get(id),B=b.get(id),p=processById(id);rows.push({processId:id,label:p?.label||A?.clientLabel||B?.clientLabel||id,asIs:A||null,toBe:B||null,change:!A&&B?'ADDED':A&&!B?'REMOVED':JSON.stringify(A)!==JSON.stringify(B)?'CHANGED':'UNCHANGED'})}return rows}
