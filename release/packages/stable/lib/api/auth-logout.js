import {accessToken,clearSession,send,supabase} from './_utils.js';
export default async function handler(req,res){if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});const t=accessToken(req);if(t){try{await supabase('/auth/v1/logout',{method:'POST',token:t})}catch{}}clearSession(res);send(res,200,{ok:true});}
