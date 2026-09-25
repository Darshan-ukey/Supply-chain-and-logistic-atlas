import {body,send,setSession,supabase,isAdminUser,err,clearSession} from './_utils.js';
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
  const b=await body(req);
  if(!b.email||!b.password)return send(res,400,{ok:false,error:'Email and password are required'});
  const {data}=await supabase('/auth/v1/token?grant_type=password',{method:'POST',data:{email:b.email,password:b.password}});
  if(!isAdminUser(data?.user)){
   try{if(data?.access_token)await supabase('/auth/v1/logout',{method:'POST',token:data.access_token})}catch{}
   clearSession(res);
   return send(res,403,{ok:false,error:'This account is not authorized for the Atlas Admin execution layer.'});
  }
  setSession(res,data);
  return send(res,200,{ok:true,isAdmin:true,user:{id:data.user.id,email:data.user.email}});
 }catch(e){err(res,e)}
}
