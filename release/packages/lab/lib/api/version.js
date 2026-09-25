import {send} from './_utils.js';
import {releaseRuntime} from '../../release/release-meta.js';
export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const x=releaseRuntime();send(res,200,{ok:true,...x,node:process.version});
}
