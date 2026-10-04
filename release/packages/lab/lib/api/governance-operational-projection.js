import {requireCapabilities,send,err} from './_utils.js';
import {buildGovernanceOperationalProjection} from '../projections/execution-depth-projection.js';

function param(req,name){
  const direct=req?.query?.[name];
  if(Array.isArray(direct))return direct[0];
  if(direct!==undefined&&direct!==null&&String(direct).trim())return String(direct).trim();
  try{return new URL(req.url,'http://atlas.local').searchParams.get(name)}catch{return null}
}

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const auth=await requireCapabilities(req,'atlas.operational.full.read');
    const moduleId=param(req,'moduleId')||param(req,'module');
    const moduleVersion=param(req,'moduleVersion')||param(req,'version');
    const taskId=param(req,'taskId');
    if(!moduleId||!moduleVersion||!taskId)return send(res,400,{ok:false,error:'moduleId/moduleVersion/taskId are required'});
    const projection=buildGovernanceOperationalProjection({moduleId,moduleVersion,taskId});
    return send(res,200,{ok:true,actor:{id:auth.user.id,email:auth.user.email},projection},{
      'Cache-Control':'private, no-store, max-age=0',
      'X-Atlas-Projection-Class':'GOVERNANCE_CANONICAL_NO_EXECUTION_IP'
    });
  }catch(e){err(res,e)}
}
