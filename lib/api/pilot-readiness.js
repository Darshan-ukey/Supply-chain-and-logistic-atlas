import {send} from './_utils.js';
import {providerStatus} from './_llm.js';
import {releaseRuntime} from '../../release/release-meta.js';
function yes(name,def=false){const v=process.env[name];if(v==null)return def;return String(v).toLowerCase()==='true'}
export function pilotChecks(){
 const release=releaseRuntime(),p=providerStatus(),allowed=new Set(String(process.env.ATLAS_EPHEMERAL_DOCUMENT_ALLOWED_PROVIDERS||'gemini').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean));
 const checks=[
  {name:'release-channel',ok:release.channel!=='invalid',detail:release.channel},
  {name:'supabase',ok:!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_PUBLISHABLE_KEY,detail:'private workspace/auth boundary'},
  {name:'ephemeral-documents-enabled',ok:yes('ATLAS_EPHEMERAL_DOCUMENTS',true),detail:'session-only source handling'},
  {name:'llm-structuring-enabled',ok:yes('ATLAS_EPHEMERAL_DOCUMENT_LLM',true)&&yes('ATLAS_EPHEMERAL_DOCUMENT_REQUIRE_LLM',true),detail:'no deterministic production fallback'},
  {name:'provider-configured',ok:p.configured,detail:p.provider},
  {name:'provider-allowed',ok:p.configured&&allowed.has(p.provider),detail:[...allowed].join(',')},
  {name:'provider-approved',ok:yes('ATLAS_EPHEMERAL_DOCUMENT_PROVIDER_APPROVED',false),detail:'administrative privacy approval'},
  {name:'request-storage-off',ok:p.provider==='gemini'?p.requestStorage==='store=false':false,detail:p.requestStorage},
  {name:'live-synthetic-evaluation',ok:yes('ATLAS_PILOT_LIVE_EVAL_PASSED',false),detail:'set true only after npm run pilot:eval:live passes against the deployed provider'}
 ];
 return {release,provider:p,checks,ok:checks.every(x=>x.ok)}
}
export default async function handler(req,res){if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});const x=pilotChecks();return send(res,x.ok?200:503,{ok:x.ok,kind:'pilot-readiness',...x,secretsExposed:false})}
