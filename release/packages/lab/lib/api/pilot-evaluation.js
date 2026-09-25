import {requireUser,supabase,send,body,err} from './_utils.js';

const TYPES=new Set(['DOCUMENT_INGEST','CLIENT_TWIN','ASK_ATLAS','TRANSFORMATION','EXPORT','UX','PRIVACY']);
const DIMENSIONS=new Set(['evidenceQuoteFidelity','canonicalIdValidity','mappingPrecision','processRecall','unsupportedMappingRate','promptInjectionResistance','irrelevantDocumentRejection','coverageRefusalCorrectness','ephemeralPersistenceWrites','canonicalMutationCount','grounding','completeness','usefulness','usability']);
const enc=x=>encodeURIComponent(String(x));
function clean(x,n=2000){return String(x??'').trim().slice(0,n)}
function cleanDimensions(x){const out={};if(!x||typeof x!=='object')return out;for(const [k,v] of Object.entries(x)){if(!DIMENSIONS.has(k))continue;const n=Number(v);if(Number.isFinite(n))out[k]=Math.max(0,Math.min(5,n))}return out}
function aggregate(rows){const byType={},byCase={};let passed=0;for(const r of rows){if(r.passed)passed++;byType[r.artifact_type]=byType[r.artifact_type]||{count:0,passed:0};byType[r.artifact_type].count++;if(r.passed)byType[r.artifact_type].passed++;if(r.case_id){byCase[r.case_id]=byCase[r.case_id]||{count:0,passed:0};byCase[r.case_id].count++;if(r.passed)byCase[r.case_id].passed++}}return {count:rows.length,passed,passRate:rows.length?passed/rows.length:0,byType,byCase}}
export default async function handler(req,res){
 try{
  const {token,user}=await requireUser(req);
  if(req.method==='POST'){
   const b=await body(req),workspaceId=clean(b.workspaceId,80),artifactType=clean(b.artifactType,40).toUpperCase(),sessionId=clean(b.sessionId,160);
   if(!workspaceId||!TYPES.has(artifactType)||sessionId.length<8){const e=new Error('workspaceId, valid artifactType and sessionId are required');e.status=400;throw e}
   const row={workspace_id:workspaceId,evaluator_id:user.id,session_id:sessionId,artifact_type:artifactType,case_id:clean(b.caseId,120)||null,entity_key:clean(b.entityKey,240)||null,dimensions:cleanDimensions(b.dimensions),passed:b.passed===true,notes:clean(b.notes,2000)||null};
   const r=await supabase('/rest/v1/atlas_pilot_evaluations',{method:'POST',token,headers:{Prefer:'return=representation'},data:row});
   return send(res,201,{ok:true,evaluation:r.data?.[0]||null});
  }
  if(req.method==='GET'){
   const workspaceId=clean(req.query?.workspaceId,80);if(!workspaceId){const e=new Error('workspaceId is required');e.status=400;throw e}
   const days=Math.max(1,Math.min(90,Number(req.query?.days||30))),since=new Date(Date.now()-days*86400000).toISOString();
   const q=`/rest/v1/atlas_pilot_evaluations?workspace_id=eq.${enc(workspaceId)}&created_at=gte.${enc(since)}&select=id,evaluator_id,session_id,artifact_type,case_id,entity_key,dimensions,passed,notes,created_at&order=created_at.desc&limit=2000`;
   const rows=(await supabase(q,{token})).data||[];return send(res,200,{ok:true,summary:aggregate(rows),evaluations:rows});
  }
  return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 }catch(e){return err(res,e)}
}
