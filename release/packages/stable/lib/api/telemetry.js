import {requireUser,supabase,send,body,err} from './_utils.js';

const EVENTS=new Set([
 'session_start','session_end','view_enter','module_activate','semantic_zoom','process_select','context_change',
 'playback_start','playback_pause','playback_step','freeze_time','trace_start','lens_open','source_open',
 'compare_open','compare_refused','transform_enter','finding_open','opportunity_open','future_state_open',
 'ask_atlas_submit','ask_atlas_result','document_workspace_open','document_ingest','document_rejected',
 'collection_create','collection_item_add','executive_summary_open','presentation_start','transformation_export',
 'collaboration_open','comment_add','comment_resolve','review_request','review_complete','saved_view_open','saved_view_save'
]);
const SAFE_KEYS=new Set(['view','semanticLevel','lens','action','commandType','result','coverageDepth','signal','compareMode','durationMs','count','format','sourceClass','status','deviceClass','contextDimension','contextState','providerMode','grounded','citationCount']);
const enc=x=>encodeURIComponent(String(x));
export function sanitizeTelemetryContext(x){const out={};if(!x||typeof x!=='object')return out;for(const [k,v] of Object.entries(x)){if(!SAFE_KEYS.has(k))continue;if(['string','number','boolean'].includes(typeof v))out[k]=typeof v==='string'?v.slice(0,80):v}return out}
function row(x,userId,workspaceId){const name=String(x.eventName||'');if(!EVENTS.has(name))return null;const cid=String(x.clientEventId||'');if(!/^[0-9a-f-]{36}$/i.test(cid))return null;const entityType=x.entityType?String(x.entityType).slice(0,60):null;const entityKey=x.entityKey?String(x.entityKey).slice(0,240):null;return {client_event_id:cid,workspace_id:workspaceId,user_id:userId,session_id:String(x.sessionId||'').slice(0,120),event_name:name,domain_pack_id:x.domainPackId?String(x.domainPackId).slice(0,120):null,module_id:x.moduleId?String(x.moduleId).slice(0,120):null,entity_type:entityType,entity_key:entityKey,context:cleanContext(x.context),occurred_at:x.occurredAt||new Date().toISOString()}}
export function aggregateTelemetry(rows,days){const counts={},modules={},views={},sources={},commands={},results={};const users=new Set(),sessions=new Set();let first=null,last=null;
 for(const r of rows){counts[r.event_name]=(counts[r.event_name]||0)+1;if(r.module_id)modules[r.module_id]=(modules[r.module_id]||0)+1;if(r.context?.view)views[r.context.view]=(views[r.context.view]||0)+1;if(r.event_name==='source_open'&&r.context?.sourceClass)sources[r.context.sourceClass]=(sources[r.context.sourceClass]||0)+1;if(r.context?.commandType)commands[r.context.commandType]=(commands[r.context.commandType]||0)+1;if(r.context?.result)results[r.context.result]=(results[r.context.result]||0)+1;users.add(r.user_id);sessions.add(r.session_id);const t=r.occurred_at;if(!first||t<first)first=t;if(!last||t>last)last=t}
 const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([key,count])=>({key,count}));
 return {periodDays:days,eventCount:rows.length,uniqueUsers:users.size,uniqueSessions:sessions.size,firstEvent:first,lastEvent:last,counts,topModules:top(modules),topViews:top(views),topSourceClasses:top(sources),topCommands:top(commands),results:top(results)}
}
export default async function handler(req,res){
 try{
  const {token,user}=await requireUser(req);
  if(req.method==='POST'){
   const b=await body(req),workspaceId=String(b.workspaceId||'');if(!workspaceId){const e=new Error('workspaceId is required');e.status=400;throw e}
   const xs=(Array.isArray(b.events)?b.events:[b.event]).filter(Boolean).slice(0,50),rows=xs.map(x=>row(x,user.id,workspaceId)).filter(x=>x&&x.session_id.length>=8);if(!rows.length)return send(res,200,{ok:true,accepted:0});
   await supabase('/rest/v1/atlas_usage_events?on_conflict=client_event_id',{method:'POST',token,headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},data:rows});return send(res,202,{ok:true,accepted:rows.length});
  }
  if(req.method==='GET'){
   const workspaceId=String(req.query?.workspaceId||'');if(!workspaceId){const e=new Error('workspaceId is required');e.status=400;throw e}const days=Math.max(1,Math.min(90,Number(req.query?.days||30))),since=new Date(Date.now()-days*86400000).toISOString();
   const q=`/rest/v1/atlas_usage_events?workspace_id=eq.${enc(workspaceId)}&occurred_at=gte.${enc(since)}&select=user_id,session_id,event_name,module_id,entity_type,entity_key,context,occurred_at&order=occurred_at.desc&limit=5000`;
   const rows=(await supabase(q,{token})).data||[];return send(res,200,{ok:true,analytics:aggregateTelemetry(rows,days)});
  }
  return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 }catch(e){return err(res,e)}
}
