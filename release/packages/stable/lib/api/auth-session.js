import {accessToken,userForToken,refreshSession,send} from './_utils.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});let token=accessToken(req),user=await userForToken(token);if(!user){const s=await refreshSession(req,res);token=s?.access_token||null;user=s?.user||await userForToken(token)}send(res,200,{ok:true,authenticated:Boolean(user),user:user?{id:user.id,email:user.email}:null});
}
