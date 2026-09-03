import {send,err} from './_utils.js';
import {buildPublicExecutionDepthProjection} from '../projections/execution-depth-projection.js';

function param(req,name){
  const direct=req?.query?.[name];
  if(Array.isArray(direct))return direct[0];
  if(direct!==undefined&&direct!==null&&String(direct).trim())return String(direct).trim();
  try{return new URL(req.url,'http://atlas.local').searchParams.get(name)}catch{return null}
}

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const moduleId=param(req,'moduleId')||param(req,'module');
    const moduleVersion=param(req,'moduleVersion')||param(req,'version');
    const taskId=param(req,'taskId');
    if(!moduleId||!moduleVersion||!taskId)return send(res,400,{ok:false,error:'moduleId/moduleVersion/taskId are required'});
    const projection=buildPublicExecutionDepthProjection({moduleId,moduleVersion,taskId});
    return send(res,200,{ok:true,projection},{
      'Cache-Control':'public, max-age=300, stale-while-revalidate=300',
      'X-Atlas-Projection-Class':'PUBLIC_SAFE'
    });
  }catch(e){err(res,e)}
}
