import {requireCapabilities,supabaseService,send,err} from './_utils.js';
export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const {user,capabilities}=await requireCapabilities(req,'RUNTIME_MALKOM_VIEW');
    const q='/rest/v1/atlas_work_definitions?status=eq.ACTIVE&select=definition_id,definition_version,source_task_id,payload&order=source_task_id.asc';
    const rows=(await supabaseService(q)).data||[];
    const definitions=rows.map(row=>{
      const d=row.payload||{};return {
        definitionId:row.definition_id,definitionVersion:row.definition_version,sourceTaskId:row.source_task_id,
        canonicalName:d.canonicalName||d.sourceTask?.sourceLabel||row.source_task_id,
        sourceTask:d.sourceTask?{sourceId:d.sourceTask.sourceId||d.sourceTask.taskId,sourceVersion:d.sourceTask.sourceVersion||null}:null,
        malkomProjection:d.malkomProjection||d.decomposition?.malkom||null,
        clientBindingPoints:d.clientBindingPoints||d.clientOverridePoints||[]
      };
    }).filter(x=>x.malkomProjection);
    return send(res,200,{ok:true,user:{id:user.id,email:user.email},runtime:'MALKOM_3',capabilities,definitions},{'Cache-Control':'private, no-store, max-age=0'});
  }catch(e){err(res,e)}
}
