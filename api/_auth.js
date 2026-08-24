'use strict';
const {token,supabase}=require('./_utils');
async function userFromReq(req){const access=token(req);if(!access)return null;try{return await supabase('/auth/v1/user',{accessToken:access})}catch{return null}}
async function requireUser(req){const user=await userFromReq(req);if(!user){const e=new Error('Authentication required');e.status=401;throw e}return user}
module.exports={userFromReq,requireUser};
