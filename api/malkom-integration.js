import {getMalkomIntegrationService} from '../lib/integrations/malkom-service-runtime.js';
import {normalizeMalkomIntegrationError} from '../lib/integrations/malkom-integration-service.js';

const json=(res,status,payload)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  return res.end(JSON.stringify(payload));
};
const bodyOf=async req=>{
  if(req?.body&&typeof req.body==='object')return req.body;
  if(typeof req?.body==='string'&&req.body.trim())return JSON.parse(req.body);
  let raw='';for await(const chunk of req)raw+=chunk;
  return raw.trim()?JSON.parse(raw):{};
};

export default async function malkomIntegration(req,res){
  if(req.method==='GET'){
    return json(res,200,{ok:true,service:'atlas-malkom-integration',mode:'BOUNDED_NON_LIVE',liveHostCertified:false,operations:['adapt','verify','compile','run','summary']});
  }
  if(req.method!=='POST')return json(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED',message:'Use GET or POST'}});
  try{
    const body=await bodyOf(req);
    const operation=String(body.operation||'run').toLowerCase();
    const service=await getMalkomIntegrationService();
    let result;
    if(operation==='adapt')result=service.adapt(body.input||body);
    else if(operation==='verify')result=service.verify(body.input||body);
    else if(operation==='compile')result=service.compile(body.input||body);
    else if(operation==='run')result=service.run(body.input||body);
    else if(operation==='summary')result=service.projectionSummary(body.input||body);
    else return json(res,400,{ok:false,error:{code:'UNKNOWN_OPERATION',message:`Unknown Malkom integration operation: ${operation}`}});
    return json(res,200,{ok:true,operation,result,claims:{liveHostCertified:false,scope:'BOUNDED_NON_LIVE'}});
  }catch(error){
    const normalized=normalizeMalkomIntegrationError(error);
    return json(res,400,{...normalized,claims:{liveHostCertified:false,scope:'BOUNDED_NON_LIVE'}});
  }
}
