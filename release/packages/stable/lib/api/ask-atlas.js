import {send,body,err,requireUser,supabase} from './_utils.js';
import {retrieveAtlas,validateCanvasState,validateCommands,deterministicPlan,atlasData} from './_atlas.js';
import {generateAtlasJson,providerStatus} from './_llm.js';

async function clientWorkspace(req,workspaceId){
  if(!workspaceId)return null;const {token,user}=await requireUser(req);
  const id=encodeURIComponent(workspaceId);const {data}=await supabase(`/rest/v1/atlas_client_states?workspace_id=eq.${id}&select=state,module_id,module_version&limit=1`,{token,headers:{Accept:'application/json'}});return data?.[0]?{workspace:data[0].state,moduleId:data[0].module_id,moduleVersion:data[0].module_version,userId:user.id}:{workspace:null,moduleId:null,moduleVersion:null,userId:user.id}
}
function safeResult(raw,evidence,fallbackCommands){
  const allowed=new Set(evidence.map(x=>x.id));const citationIds=[...new Set((raw?.citationIds||[]).filter(x=>allowed.has(x)))];
  const commands=Array.isArray(raw?.commands)?raw.commands:fallbackCommands;const answer=String(raw?.answer||'').trim();
  return {answer,citationIds,commands,needsMoreEvidence:!!raw?.needsMoreEvidence}
}
function fallbackAnswer(question,evidence,state){
  const l=String(question||'').toLowerCase();
  const cov=evidence.find(x=>x.class==='COVERAGE');if(cov&&cov.content?.depth!=='A5_VERIFIED')return {answer:`${cov.content.name} is ${cov.content.status} at ${String(cov.content.depth||'reference').replaceAll('_',' ')} depth. Detailed A4/A5 execution is not published, so Ask Atlas will not synthesize it.`,citationIds:[cov.id],needsMoreEvidence:true};
  const p=evidence.find(x=>x.class==='ATLAS_PROCESS');if(p){const c=p.content;let answer;if(/why|explain/.test(l))answer=`${c.id} — ${c.label}. ${c.claimBoundary||c.provenance||''}`.trim();else if(/input|output/.test(l))answer=`${c.id} — ${c.label}. Inputs: ${(c.inputs||[]).join(', ')||'not stated'}. Outputs: ${(c.outputs||[]).join(', ')||'not stated'}.`;else if(/system/.test(l))answer=`${c.id} — ${c.label}. Producer: ${c.producer||'not stated'}. System of authority: ${c.authoritySystem||'not stated'}. Consumers: ${c.consumers||'not stated'}.`;else answer=`${c.id} — ${c.label}. Event: ${c.event||'not stated'}. Decision: ${c.decision||'not stated'}. Action: ${c.action||'not stated'}. State after: ${c.stateAfter||'not stated'}.`;return {answer,citationIds:[p.id,...evidence.filter(x=>x.class==='ATLAS_SOURCE'&&(p.sourceIds||[]).some(s=>x.sourceIds?.includes(s))).slice(0,2).map(x=>x.id)],needsMoreEvidence:false}}
  if(evidence.length)return {answer:`I found Atlas evidence relevant to the request, but the configured deterministic fallback does not have enough evidence to form a more specific answer. Open the cited evidence or configure the server-side LLM gateway.`,citationIds:evidence.slice(0,2).map(x=>x.id),needsMoreEvidence:true};
  return {answer:`I could not find sufficient published Atlas evidence for that request. I will not fill the gap from general model knowledge.`,citationIds:[],needsMoreEvidence:true}
}
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});const b=await body(req);const question=String(b.question||'').trim();if(!question)return send(res,400,{ok:false,error:'question is required'});
  const state=b.canvasState&&typeof b.canvasState==='object'?b.canvasState:{};const vs=validateCanvasState(state);if(!vs.valid)return send(res,409,{ok:false,error:'Canvas state failed Atlas validation',details:vs.errors});
  const client=await clientWorkspace(req,b.workspaceId||null),evidence=retrieveAtlas(question,state,client),fallbackCommands=deterministicPlan(question,state),pstat=providerStatus();
  if(!fallbackCommands.length&&/take me|go to|inspect|focus on|open task/i.test(question)){const pe=evidence.find(x=>x.class==='ATLAS_PROCESS');if(pe?.content?.id)fallbackCommands.push({type:'select_process',args:{processId:pe.content.id}})}
  if(!fallbackCommands.length&&/show source|open source|evidence source/i.test(question)){const se=evidence.find(x=>x.class==='ATLAS_SOURCE');if(se?.content?.id)fallbackCommands.push({type:'open_source',args:{sourceId:se.content.id}})}
  const system=`You are Ask Atlas, the natural-language operating layer over a governed Supply Chain Atlas. You may reason only from EVIDENCE supplied in this request. Do not add general logistics knowledge. If evidence is incomplete, say so. Atlas Reference and Client evidence are different epistemic classes. Never treat a deviation as a gap, a diagnostic signal as a validated risk, or a proposed TO-BE as source fact. You may PROPOSE canvas commands, but deterministic code validates and executes them. Return strict JSON with keys: answer (string), citationIds (array of evidence IDs), commands (array of {type,args}), needsMoreEvidence (boolean). Every substantive claim in answer must be supported by citationIds. Use only evidence IDs supplied. Do not invent IDs.`;
  const history=Array.isArray(b.history)?b.history.slice(-8).map(x=>({role:String(x.role||''),text:String(x.text||'').slice(0,1200)})):[];
  const contextOptions=(atlasData().overlays.overlays||[]).map(o=>({dimension:o.dimension,optionId:o.sourceContextId,name:o.name,scope:o.scope,moduleId:o.moduleId}));
  const user=`QUESTION:\n${question}\n\nRECENT CONVERSATION:\n${JSON.stringify(history)}\n\nCANVAS STATE:\n${JSON.stringify(state)}\n\nAVAILABLE GOVERNED CONTEXT OPTIONS:\n${JSON.stringify(contextOptions)}\n\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nDETERMINISTIC COMMAND HINTS:\n${JSON.stringify(fallbackCommands)}`;
  let raw=null,providerError=null;if(pstat.configured){try{raw=await generateAtlasJson(system,user)}catch(e){providerError=e.message}}
  const fb=raw?null:fallbackAnswer(question,evidence,state);let base=raw?safeResult(raw,evidence,fallbackCommands):{...fb,commands:fallbackCommands};
  let providerAnswerRejected=false;if(raw&&evidence.length&&base.citationIds.length===0){const safe=fallbackAnswer(question,evidence,state);base={...safe,commands:base.commands?.length?base.commands:fallbackCommands};providerAnswerRejected=true}
  const vc=validateCommands(base.commands,state);const citations=base.citationIds.map(id=>{const e=evidence.find(x=>x.id===id);return e?{id:e.id,class:e.class,title:e.title,sourceIds:e.sourceIds||[],content:e.content}:null}).filter(Boolean);
  send(res,200,{ok:true,stage:'18',answer:base.answer,citations,commands:vc.valid,rejectedCommands:vc.rejected,needsMoreEvidence:base.needsMoreEvidence,provider:{...pstat,used:!!raw,error:providerError||null,answerRejectedForMissingCitations:providerAnswerRejected},grounding:{retrieved:evidence.length,cited:citations.length,clientEvidenceUsed:citations.some(x=>x.class.startsWith('CLIENT_')),clientWorkspaceRequested:!!b.workspaceId}})
 }catch(e){err(res,e)}
}
