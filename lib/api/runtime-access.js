import {requireUser,capabilitiesForUser,send,err} from './_utils.js';
export default async function handler(req,res){
  try{
    if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
    const {user}=await requireUser(req),capabilities=await capabilitiesForUser(user),has=c=>capabilities.includes(c);
    return send(res,200,{ok:true,user:{id:user.id,email:user.email},capabilities,runtimes:[
      {id:'malkom',label:'Malkom 3.0',available:has('RUNTIME_MALKOM_VIEW'),canConfigure:has('RUNTIME_MALKOM_CONFIGURE'),canCompile:has('RUNTIME_MALKOM_COMPILE'),canMaterialize:has('RUNTIME_MALKOM_MATERIALIZE'),canOperate:has('RUNTIME_MALKOM_OPERATE')}
    ]},{'Cache-Control':'private, no-store, max-age=0'});
  }catch(e){err(res,e)}
}
