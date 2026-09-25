import {requireAdmin,supabaseService,send,err} from './_utils.js';

function sum(defs,key){return defs.reduce((n,x)=>n+Number((key(x)||[]).length||0),0)}
export default async function handler(req,res){
 try{
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const {user}=await requireAdmin(req);
  const q='/rest/v1/atlas_work_definitions?status=eq.ACTIVE&domain=eq.supply-chain.transport.road-ltl&select=payload&order=source_task_id.asc';
  const rows=(await supabaseService(q)).data||[];
  const definitions=rows.map(x=>x.payload).filter(Boolean);
  if(!definitions.length)return send(res,503,{ok:false,error:'Protected WorkDefinition store is empty. Run the private V2 WorkDefinition seed before using the Admin execution layer.'});
  const registry={
    contractVersion:'0.1',release:'Atlas V2 WorkDefinition UI',
    sourceModule:{id:'road-ltl',version:'V1.2',depth:'A5_VERIFIED'},status:'ACTIVE',
    counts:{definitions:definitions.length,queues:definitions.length,subQueues:sum(definitions,x=>x.malkomProjection?.subQueues),workTypes:sum(definitions,x=>x.malkomProjection?.workTypes),fields:sum(definitions,x=>x.fields),outcomes:sum(definitions,x=>x.outcomes),transitions:sum(definitions,x=>x.transitions)},
    definitions
  };
  return send(res,200,{ok:true,admin:{id:user.id,email:user.email},registry},{'Cache-Control':'private, no-store, max-age=0'});
 }catch(e){err(res,e)}
}
