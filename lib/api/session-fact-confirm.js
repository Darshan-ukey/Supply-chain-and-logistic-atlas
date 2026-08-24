import {body,send,supabase,requireUser,err} from './_utils.js';
import {documentDomainRuntime} from './_document-domain.js';
function clamp(s,n){return String(s||'').slice(0,n)}
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
  const {token,user}=await requireUser(req),b=await body(req); if(!b.workspaceId||!b.fact)return send(res,400,{ok:false,error:'workspaceId and fact are required'});
  const f=b.fact,domain=documentDomainRuntime({domainPackId:String(b.domainPackId||'supply-chain'),moduleId:String(b.moduleId||'road-ltl')});
  const process=f.processId||f.process_id||null; if(process && !(domain.module?.processes||[]).some(p=>p.id===process))return send(res,400,{ok:false,error:'Candidate maps to an unknown canonical process'});
  const statement=clamp(f.statement,1200); if(statement.length<8)return send(res,400,{ok:false,error:'Candidate statement is too short'});
  const q=`/rest/v1/atlas_client_states?workspace_id=eq.${encodeURIComponent(b.workspaceId)}&select=*&limit=1`,current=(await supabase(q,{token})).data?.[0];
  const ws=structuredClone(current?.state||{schemaVersion:'client-as-is-mapping-v0.4',name:'Client Workspace',moduleId:domain.moduleId,mappings:{},evidence:{}}); ws.mappings=ws.mappings||{};ws.evidence=ws.evidence||{};ws.confirmedSessionFacts=ws.confirmedSessionFacts||{};
  const factId=`SESSION-CONFIRMED-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,eid=`SESSION-CONFIRM-${factId}`;
  ws.evidence[eid]={id:eid,type:'CONSULTANT_CONFIRMATION',title:'Consultant confirmation from ephemeral session document',note:'Raw document, excerpt and locator were intentionally not retained. This record represents the consultant confirmation only.',createdAt:new Date().toISOString(),processId:process,ephemeralSourceRemoved:true};
  ws.confirmedSessionFacts[factId]={id:factId,factType:clamp(f.factType||f.fact_type||'OTHER',80),statement,processId:process,canonicalId:clamp(f.canonicalId||f.canonical_id||'',120)||null,confirmedAt:new Date().toISOString(),confirmedBy:user.id,evidenceId:eid,ephemeralSourceRemoved:true};
  if(process){const m=ws.mappings[process]||{processId:process,status:'UNKNOWN',clientLabel:'',clientOwner:'',clientSystems:'',alignment:'NOT_ASSESSED',deviationNote:'',rationale:'',evidenceIds:[],updatedAt:null};m.evidenceIds=[...new Set([...(m.evidenceIds||[]),eid])];const pp=f.proposedPatch||f.proposed_patch||{};if((f.factType||f.fact_type)==='PROCESS_EXISTS'||pp.confirmProcess===true)m.status='CLIENT_CONFIRMED';if((f.factType||f.fact_type)==='PROCESS_LABEL'&&pp.clientLabel)m.clientLabel=clamp(pp.clientLabel,300);if((f.factType||f.fact_type)==='OWNER'&&pp.clientOwner)m.clientOwner=clamp(pp.clientOwner,300);if((f.factType||f.fact_type)==='SYSTEM'&&pp.clientSystem){const a=String(m.clientSystems||'').split(/[,;]\s*/).filter(Boolean);a.push(clamp(pp.clientSystem,300));m.clientSystems=[...new Set(a)].join(', ')}m.updatedAt=new Date().toISOString();ws.mappings[process]=m}
  ws.updatedAt=new Date().toISOString();const row={workspace_id:b.workspaceId,schema_version:ws.schemaVersion||'client-as-is-mapping-v0.4',module_id:ws.moduleId||domain.moduleId,module_version:current?.module_version||null,state:ws,revision:Number(current?.revision||0)+1,updated_by:user.id};await supabase('/rest/v1/atlas_client_states?on_conflict=workspace_id',{method:'POST',token,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},data:row});
  return send(res,200,{ok:true,status:'CONFIRMED',factId,processId:process,evidenceId:eid,rawSourceRetained:false,guardrail:'Only the consultant-confirmed normalized fact was persisted. No file, quote, locator or document reference was retained.'});
 }catch(e){err(res,e)}
}
