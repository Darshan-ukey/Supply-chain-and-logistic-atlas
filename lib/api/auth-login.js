import {body,send,setSession,supabase,err} from './_utils.js';
export default async function handler(req,res){
 try{if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});const b=await body(req);if(!b.email||!b.password)return send(res,400,{ok:false,error:'Email and password are required'});const {data}=await supabase('/auth/v1/token?grant_type=password',{method:'POST',data:{email:b.email,password:b.password}});setSession(res,data);send(res,200,{ok:true,user:data.user});}catch(e){err(res,e)}}
