import {send} from './_utils.js';import {providerStatus} from './_llm.js';
export default async function handler(req,res){if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});const x=providerStatus();send(res,200,{ok:true,stage:'18',provider:x.provider,configured:x.configured,model:x.model,keysExposedToBrowser:false})}
