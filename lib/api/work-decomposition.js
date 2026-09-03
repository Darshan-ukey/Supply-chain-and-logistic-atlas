import {requireCapabilities,send,err} from './_utils.js';

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const auth=await requireCapabilities(req,'atlas.work_decomposition.full.read');
    return send(res,501,{
      ok:false,
      status:'NOT_YET_COMPILED',
      message:'Canonical Work Decomposition is not yet materialized. The endpoint is reserved and capability-gated before P6 compilation.',
      actor:{id:auth.user.id,email:auth.user.email},
      protection:'EXECUTION_CAPABILITY_REQUIRED'
    },{'Cache-Control':'private, no-store, max-age=0','X-Atlas-Projection-Class':'EXECUTION_PROTECTED'});
  }catch(e){err(res,e)}
}
