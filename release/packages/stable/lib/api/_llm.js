function cfg(){return {provider:String(process.env.ATLAS_LLM_PROVIDER||'none').toLowerCase(),key:process.env.ATLAS_LLM_API_KEY||'',model:process.env.ATLAS_LLM_MODEL||'',base:process.env.ATLAS_LLM_BASE_URL||''}}
async function post(url,headers,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={raw:t}}if(!r.ok)throw new Error(d?.error?.message||d?.message||`LLM provider HTTP ${r.status}`);return d}
function extractJson(s){const text=String(s||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(text)}catch{const a=text.indexOf('{'),b=text.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(text.slice(a,b+1));throw new Error('Provider did not return valid JSON')}}
export function providerStatus(){const c=cfg();return {provider:c.provider,configured:!!(c.provider!=='none'&&c.key),model:c.model||null,requestStorage:c.provider==='gemini'?'store=false':'provider-specific',apiStyle:c.provider==='gemini'?'generateContent-stateless':c.provider}}
export async function generateAtlasJson(system,user){const c=cfg();if(c.provider==='none'||!c.key)return null;
  if(c.provider==='gemini'){
    const model=c.model;if(!model)throw new Error('ATLAS_LLM_MODEL is required for Gemini');
    const u=c.base||`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const d=await post(u,{'x-goog-api-key':c.key},{systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1},store:false});
    return extractJson(d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'')
  }
  if(c.provider==='anthropic'){
    const model=c.model;if(!model)throw new Error('ATLAS_LLM_MODEL is required for Anthropic');const u=c.base||'https://api.anthropic.com/v1/messages';const d=await post(u,{'x-api-key':c.key,'anthropic-version':'2023-06-01'},{model,max_tokens:1400,temperature:0.1,system,messages:[{role:'user',content:user}]});return extractJson(d?.content?.map(x=>x.text||'').join('')||'')
  }
  if(c.provider==='openai'||c.provider==='openai-compatible'){
    const model=c.model;if(!model)throw new Error('ATLAS_LLM_MODEL is required for OpenAI/OpenAI-compatible');const u=c.base||'https://api.openai.com/v1/chat/completions';const d=await post(u,{Authorization:`Bearer ${c.key}`},{model,temperature:0.1,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:user}]});return extractJson(d?.choices?.[0]?.message?.content||'')
  }
  throw new Error(`Unsupported ATLAS_LLM_PROVIDER: ${c.provider}`)
}
