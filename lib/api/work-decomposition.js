import {requireCapabilities,supabaseService,send,err} from './_utils.js';

const text=v=>String(v??'').trim();
const enc=v=>encodeURIComponent(text(v));

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const {user}=await requireCapabilities(req,'atlas.work_decomposition.full.read');
    const moduleId=text(req.query?.moduleId);
    const moduleVersion=text(req.query?.moduleVersion);
    const taskId=text(req.query?.taskId);
    if(!moduleId||!moduleVersion||!taskId){
      return send(res,400,{ok:false,error:'Exact moduleId, moduleVersion and taskId are required. No Daughter version/task substitution is permitted.'},{'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'});
    }
    const q=`/rest/v1/atlas_work_decompositions?module_id=eq.${enc(moduleId)}&module_version=eq.${enc(moduleVersion)}&source_task_id=eq.${enc(taskId)}&contract_version=eq.1.0.0&status=in.(VALIDATED_REFERENCE_DECOMPOSITION,APPROVED,ACTIVE)&select=decomposition_id,module_id,module_version,source_task_id,contract_version,semantic_source_version,status,payload,content_hash&limit=1`;
    const rows=(await supabaseService(q)).data||[];
    const row=rows[0];
    if(!row)return send(res,404,{ok:false,error:`Protected Work Decomposition is not materialized for exact tuple ${moduleId}@${moduleVersion}/${taskId}. No alternate version was substituted.`},{'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'});
    if(row.module_id!==moduleId||String(row.module_version)!==moduleVersion||row.source_task_id!==taskId){
      return send(res,500,{ok:false,error:'Protected Work Decomposition store returned a tuple mismatch; request failed closed.'},{'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'});
    }
    return send(res,200,{
      ok:true,
      projectionClass:'EXECUTION_PROTECTED',
      actor:{id:user.id,email:user.email},
      trace:{moduleId:row.module_id,moduleVersion:row.module_version,taskId:row.source_task_id,semanticSourceVersion:row.semantic_source_version,contractVersion:row.contract_version,decompositionId:row.decomposition_id,contentHash:row.content_hash},
      decomposition:row.payload,
      protection:'atlas.work_decomposition.full.read'
    },{'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'});
  }catch(e){err(res,e)}
}
