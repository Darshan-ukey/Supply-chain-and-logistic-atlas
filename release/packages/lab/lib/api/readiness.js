import {send} from './_utils.js';
import {releaseRuntime} from '../../release/release-meta.js';
const TIMEOUT=Math.max(500,Math.min(5000,Number(process.env.ATLAS_DEPENDENCY_TIMEOUT_MS||2500)));
function configChecks(){
  const release=releaseRuntime();const checks=[];
  const add=(name,ok,required=true,detail='')=>checks.push({name,ok,required,detail});
  add('release-channel',release.channel!=='invalid',true,release.channel);
  add('supabase-url',!!process.env.SUPABASE_URL,true,process.env.SUPABASE_URL?'configured':'missing');
  add('supabase-publishable-key',!!process.env.SUPABASE_PUBLISHABLE_KEY,true,process.env.SUPABASE_PUBLISHABLE_KEY?'configured':'missing');
  const provider=String(process.env.ATLAS_LLM_PROVIDER||'none').toLowerCase();const requireLlm=String(process.env.ATLAS_REQUIRE_LLM||'false').toLowerCase()==='true';
  const llmConfigured=provider==='none'||(!!process.env.ATLAS_LLM_API_KEY&&!!process.env.ATLAS_LLM_MODEL);
  add('llm-gateway',llmConfigured,requireLlm,provider==='none'?'deterministic fallback':provider);
  return {release,checks};
}
async function probeSupabase(){
  const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return {ok:false,status:null,latencyMs:null,error:'configuration missing'};
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),TIMEOUT);const started=Date.now();
  try{const r=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:ac.signal});return {ok:r.ok,status:r.status,latencyMs:Date.now()-started,error:r.ok?null:`HTTP ${r.status}`}}catch(e){return {ok:false,status:null,latencyMs:Date.now()-started,error:e.name==='AbortError'?'timeout':String(e.message||e)}}finally{clearTimeout(timer)}
}
export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  const {release,checks}=configChecks();const requiredConfigOk=checks.filter(x=>x.required).every(x=>x.ok);
  const dependency=requiredConfigOk?await probeSupabase():{ok:false,status:null,latencyMs:null,error:'config gate failed'};
  const ready=requiredConfigOk&&dependency.ok;send(res,ready?200:503,{ok:ready,kind:'readiness',release,checks,dependencies:{supabase:dependency},secretsExposed:false});
}
export {configChecks,probeSupabase};
