import {send,err} from './_utils.js';
import {buildPublicExecutionDepthProjection} from '../projections/execution-depth-projection.js';

// PUBLIC_SAFE. No authentication: mirrors the existing public /api/execution-depth-projection
// contract already assumed by assets/universal-daughter-renderer-v2.js
// (PUBLIC_PROJECTION_ENDPOINT) and governed by governance/presentation/p2-projection-source-registry.json.
// This route never touches protected Work Decomposition / WorkDefinition payloads or the
// admin-workdefinitions/malkom-projections capability-gated surfaces.
export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const q=req.query||Object.fromEntries(new URL(req.url,'http://localhost').searchParams);
    const moduleId=String(q.moduleId||'').trim();
    const moduleVersion=String(q.moduleVersion||'').trim();
    const taskId=String(q.taskId||'').trim();
    if(!moduleId||!moduleVersion||!taskId){
      return send(res,400,{ok:false,error:'moduleId, moduleVersion and taskId are all required'});
    }
    const projection=buildPublicExecutionDepthProjection({moduleId,moduleVersion,taskId});
    return send(res,200,{ok:true,projection},{'Cache-Control':'public, max-age=300, stale-while-revalidate=60'});
  }catch(e){err(res,e)}
}
