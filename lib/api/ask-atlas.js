import {send,body,err,requireUser,requireCapabilities,supabase} from './_utils.js';
import {retrieveAtlas,normalizeSurfaceState,validateSurfaceState,validateCommands,deterministicPlan,atlasData} from './_atlas.js';
import {generateAtlasJson,providerStatus} from './_llm.js';
import {buildAskProjectionEvidence,publicTraceFromAskProjection} from '../ask/p5-governed-retrieval.js';

async function clientWorkspace(req,workspaceId){
  if(!workspaceId)return null;const {token,user}=await requireUser(req);
  const id=encodeURIComponent(workspaceId);const {data}=await supabase(`/rest/v1/atlas_client_states?workspace_id=eq.${id}&select=state,module_id,module_version&limit=1`,{token,headers:{Accept:'application/json'}});return data?.[0]?{workspace:data[0].state,moduleId:data[0].module_id,moduleVersion:data[0].module_version,userId:user.id}:{workspace:null,moduleId:null,moduleVersion:null,userId:user.id}
}
async function requestedProjectionClass(req,b){
  const pref=String(b?.projectionPreference||'PUBLIC_SAFE').toUpperCase();
  if(pref!=='GOVERNANCE_CANONICAL_NO_EXECUTION_IP')return 'PUBLIC_SAFE';
  await requireCapabilities(req,'atlas.operational.full.read');
  return 'GOVERNANCE_CANONICAL_NO_EXECUTION_IP';
}
async function protectedAskIntent(req,b,state){
  if(!b?.includeProtectedExecution)return false;
  if(state.surface!=='admin'){const e=new Error('Protected execution grounding is available only on the protected Admin surface.');e.status=403;throw e}
  await requireCapabilities(req,['atlas.workdefinition.full.read','WORKDEFINITION_VIEW'],{any:true});
  const e=new Error('Protected WorkDefinition grounding in Ask Atlas is intentionally disabled until the canonical P6 WorkDefinition compilation is materialized. Use the protected execution endpoint directly; P5 will not ground answers in the older runtime definition store.');e.status=409;throw e;
}
function safeResult(raw,evidence,fallbackCommands){
  const allowed=new Set(evidence.map(x=>x.id));const citationIds=[...new Set((raw?.citationIds||[]).filter(x=>allowed.has(x)))];
  const commands=Array.isArray(raw?.commands)?raw.commands:fallbackCommands;const answer=String(raw?.answer||'').trim();
  return {answer,citationIds,commands,needsMoreEvidence:!!raw?.needsMoreEvidence}
}
function compactRef(c){if(!c)return'';for(const k of['description','purpose','summary','short','definition','scope','role','type'])if(c[k])return String(c[k]);return''}
function projectionFallback(evidence,question){
  const p=evidence.find(x=>x.class==='ATLAS_EXECUTION_DEPTH_PROJECTION');
  if(!p)return null;const c=p.content||{},o=c.overview||{},ok=c.operationalKnowledge||{},r=c.executionReadiness||{},l=String(question||'').toLowerCase();
  if(/readiness|ready|execute|executability|decompos/.test(l))return{answer:`${p.title}. Execution readiness: ${r.status||'not stated'}. Work Decomposition: ${r.downstream?.workDecompositionStatus||c.protectedExecution?.workDecomposition?.status||'not stated'}. WorkDefinition: ${r.downstream?.workDefinitionStatus||c.protectedExecution?.workDefinition?.status||'not stated'}. Independent executor proof: ${r.independentExecutorProofStatus||'not stated'}.`,citationIds:[p.id],needsMoreEvidence:false};
  if(/why|purpose|explain/.test(l))return{answer:`${p.title}. ${ok.businessMeaning||o.purpose||'Business meaning is not stated in the published projection.'}${ok.why?` ${ok.why}`:''}`,citationIds:[p.id],needsMoreEvidence:false};
  if(/information|data|field|resolve|validation|rule|control/.test(l))return{answer:`${p.title}. ${ok.businessMeaning||o.purpose||''}${ok.ruleSummary?` Rule: ${ok.ruleSummary}.`:''}${ok.controlSummary?` Control: ${ok.controlSummary}.`:''}${ok.clientDependencySummary?.bindingRequired?' Client binding is still required for some values/mappings.':''}`.trim(),citationIds:[p.id],needsMoreEvidence:false};
  return{answer:`${p.title}. ${o.purpose||ok.businessMeaning||''}${o.trigger?` Trigger: ${o.trigger}.`:''}${o.outcome?` Outcome: ${o.outcome}.`:''}`.trim(),citationIds:[p.id],needsMoreEvidence:false};
}
function fallbackAnswer(question,evidence,state){
  const projected=projectionFallback(evidence,question);if(projected)return projected;
  const l=String(question||'').toLowerCase();
  const gov=evidence.find(x=>x.class==='ATLAS_GOVERNANCE_OPERATIONAL_PROJECTION');if(gov)return{answer:`Governance-safe canonical operational evidence is available for ${gov.title}. The projection excludes full Work Decomposition, WorkDefinition and runtime projection IP.`,citationIds:[gov.id],needsMoreEvidence:false};
  const cov=evidence.find(x=>x.class==='COVERAGE');if(cov&&cov.content?.depth!=='A5_VERIFIED'&&/\b(a4|a5|task|workflow|execution sequence|detailed execution|work definition|workdefinition)\b/.test(l))return {answer:`${cov.content.name} is ${cov.content.status} at ${String(cov.content.depth||'reference').replaceAll('_',' ')} depth. Detailed A4/A5 execution is not published, so Ask Atlas will not synthesize it.`,citationIds:[cov.id],needsMoreEvidence:true};
  const refs=evidence.filter(x=>/^ATLAS_(DOMAIN|NAV_ITEM|SYSTEM|OBJECT|DOCUMENT|EVENT|RELATIONSHIP|JURISDICTION|CARRIAGE_REGIME|CONDITION|EXECUTIVE_INTENT)$/.test(x.class));if(refs.length){const first=refs[0],many=/\b(which|list|what systems|what documents|what objects|available|where)\b/.test(l);if(many&&refs.length>1)return{answer:`From the published Universe, relevant items include ${refs.slice(0,6).map(x=>x.content?.name||x.title.replace(/^Universe · /,'')).join(', ')}.`,citationIds:refs.slice(0,6).map(x=>x.id),needsMoreEvidence:false};const detail=compactRef(first.content);return{answer:`${first.content?.name||first.title.replace(/^Universe · /,'')}${detail?` — ${detail}`:''}.`,citationIds:[first.id],needsMoreEvidence:false}}
  if(cov)return{answer:`${cov.content.name}: ${cov.content.status}; published depth ${String(cov.content.depth||'reference').replaceAll('_',' ')}.`,citationIds:[cov.id],needsMoreEvidence:cov.content.depth!=='A5_VERIFIED'};
  if(evidence.length)return {answer:`I found published Atlas evidence relevant to the request, but the deterministic fallback does not have enough evidence to form a more specific answer. Open the cited evidence or configure the server-side LLM gateway.`,citationIds:evidence.slice(0,2).map(x=>x.id),needsMoreEvidence:true};
  return {answer:`I could not find sufficient governed Atlas evidence for that request. I will not fill the gap from general model knowledge or silently substitute another Daughter version.`,citationIds:[],needsMoreEvidence:true}
}
function safeUniverseEvidence(question,state,client){
  return retrieveAtlas(question,state,client,null).filter(x=>x.class!=='ATLAS_PROCESS'&&x.class!=='ATLAS_SOURCE'&&x.class!=='PROTECTED_WORK_DEFINITION');
}
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});const b=await body(req);const question=String(b.question||'').trim();if(!question)return send(res,400,{ok:false,error:'question is required'});
  const supplied=(b.surfaceState&&typeof b.surfaceState==='object')?b.surfaceState:((b.canvasState&&typeof b.canvasState==='object')?{...b.canvasState,surface:'canvas'}:{});const state=normalizeSurfaceState(supplied);const vs=validateSurfaceState(state);if(!vs.valid)return send(res,409,{ok:false,error:'Atlas surface state failed validation',details:vs.errors});
  await protectedAskIntent(req,b,state);
  const client=await clientWorkspace(req,b.workspaceId||null),projectionClass=await requestedProjectionClass(req,b);
  const a5Context=['daughter','canvas','admin'].includes(state.surface)&&!!state.moduleId;
  let projectionResult=null,evidence=[];
  if(a5Context){
    try{projectionResult=buildAskProjectionEvidence({question,state,projectionClass})}
    catch(e){
      if(projectionClass==='GOVERNANCE_CANONICAL_NO_EXECUTION_IP'&&Number(e.status)===404){projectionResult=buildAskProjectionEvidence({question,state,projectionClass:'PUBLIC_SAFE'});projectionResult.governanceProjectionUnavailable=true}
      else throw e;
    }
    evidence=[...(projectionResult.evidence||[]),...safeUniverseEvidence(question,{surface:'universe'},client).slice(0,5)];
  }else evidence=safeUniverseEvidence(question,state,client);
  const fallbackCommands=deterministicPlan(question,state),pstat=providerStatus();
  if(!fallbackCommands.length&&/take me|go to|inspect|focus on|open task/i.test(question)){const pe=evidence.find(x=>x.class==='ATLAS_EXECUTION_DEPTH_PROJECTION');const id=pe?.content?.trace?.taskId;if(id)fallbackCommands.push(state.surface==='canvas'?{type:'select_process',args:{processId:id}}:{type:'open_in_canvas',args:{moduleId:pe.moduleId,processId:id}})}
  const system=`You are Ask Atlas, the governed natural-language intelligence layer shared by the Supply Chain Atlas Universe, Daughter modules, Canvas and protected Admin surface. You may reason only from EVIDENCE supplied in this request. Do not add general logistics knowledge. A5 operational evidence is projection-backed: PUBLIC_SAFE or GOVERNANCE_CANONICAL_NO_EXECUTION_IP. Never reconstruct protected Work Decomposition, WorkDefinition, source-claim crosswalks, client values or runtime mappings from summaries. Respect coverage depth and exact version selection; never substitute another Daughter version. Client binding dependencies are not operational-knowledge gaps. Trace metadata is diagnostic lineage, not a sixth semantic depth. You may PROPOSE Atlas UI commands, but deterministic code validates them. Return strict JSON with keys: answer (string), citationIds (array of evidence IDs), commands (array of {type,args}), needsMoreEvidence (boolean). Every substantive claim in answer must be supported by citationIds. Use only evidence IDs and entity/process/module IDs supplied in EVIDENCE or AVAILABLE GOVERNED OPTIONS. Do not invent IDs.`;
  const history=Array.isArray(b.history)?b.history.slice(-8).map(x=>({role:String(x.role||''),text:String(x.text||'').slice(0,1200)})):[];
  const contextOptions=(atlasData().overlays.overlays||[]).map(o=>({dimension:o.dimension,optionId:o.sourceContextId,name:o.name,scope:o.scope,moduleId:o.moduleId}));
  const user=`QUESTION:\n${question}\n\nRECENT CONVERSATION:\n${JSON.stringify(history)}\n\nATLAS SURFACE STATE:\n${JSON.stringify(state)}\n\nAVAILABLE GOVERNED CONTEXT OPTIONS:\n${JSON.stringify(contextOptions)}\n\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nDETERMINISTIC COMMAND HINTS:\n${JSON.stringify(fallbackCommands)}`;
  let raw=null,providerError=null;if(pstat.configured){try{raw=await generateAtlasJson(system,user)}catch(e){providerError=e.message}}
  const fb=raw?null:fallbackAnswer(question,evidence,state);let base=raw?safeResult(raw,evidence,fallbackCommands):{...fb,commands:fallbackCommands};
  let providerAnswerRejected=false;if(raw&&evidence.length&&base.citationIds.length===0){const safe=fallbackAnswer(question,evidence,state);base={...safe,commands:base.commands?.length?base.commands:fallbackCommands};providerAnswerRejected=true}
  const vc=validateCommands(base.commands,state);const citations=base.citationIds.map(id=>{const e=evidence.find(x=>x.id===id);return e?{id:e.id,class:e.class,title:e.title,sourceIds:e.sourceIds||[],moduleId:e.moduleId||null,content:e.content}:null}).filter(Boolean);
  const trace=publicTraceFromAskProjection(projectionResult,{protectedEvidenceUsed:false});
  if(projectionResult?.governanceProjectionUnavailable)trace.governanceProjectionUnavailable=true;
  const headers=projectionClass==='GOVERNANCE_CANONICAL_NO_EXECUTION_IP'?{'Cache-Control':'private, no-store, max-age=0'}:{'Cache-Control':'no-store, max-age=0'};
  send(res,200,{ok:true,stage:'atlas-p5-governed-ask',surface:state.surface,answer:base.answer,citations,commands:vc.valid,rejectedCommands:vc.rejected,needsMoreEvidence:base.needsMoreEvidence,trace,provider:{...pstat,used:!!raw,error:providerError||null,answerRejectedForMissingCitations:providerAnswerRejected},grounding:{retrieved:evidence.length,cited:citations.length,clientEvidenceUsed:citations.some(x=>x.class.startsWith('CLIENT_')),protectedEvidenceUsed:false,clientWorkspaceRequested:!!b.workspaceId,projectionClass:projectionResult?.projectionClass||'UNIVERSE_REFERENCE',scope:{surface:state.surface,moduleId:projectionResult?.tuple?.moduleId||state.moduleId||null,moduleVersion:projectionResult?.tuple?.moduleVersion||state.moduleVersion||null,selectedProcess:projectionResult?.tuple?.taskId||state.selectedProcess||null}}},headers)
 }catch(e){err(res,e)}
}
