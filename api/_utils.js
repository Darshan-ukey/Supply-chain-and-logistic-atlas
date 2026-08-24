'use strict';
const crypto=require('crypto');
function json(res,status,body){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body))}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;let s='';for await(const c of req)s+=c;if(!s)return{};try{return JSON.parse(s)}catch{return{raw:s}}}
function method(req,allowed){return allowed.includes(req.method)}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}))}
function setCookie(res,name,value,opts={}){const parts=[`${encodeURIComponent(name)}=${encodeURIComponent(value)}`,`Path=${opts.path||'/'}`,`SameSite=${opts.sameSite||'Lax'}`];if(opts.httpOnly!==false)parts.push('HttpOnly');if(opts.secure!==false)parts.push('Secure');if(opts.maxAge!=null)parts.push(`Max-Age=${opts.maxAge}`);res.setHeader('Set-Cookie',parts.join('; '))}
function clearCookie(res,name){setCookie(res,name,'',{maxAge:0})}
function token(req){return cookies(req).atlas_access_token||null}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function safeError(e){return process.env.NODE_ENV==='development'?String(e?.stack||e):String(e?.message||'Request failed')}
async function supabase(path,{method='GET',accessToken,body:payload,headers={}}={}){const url=process.env.SUPABASE_URL;if(!url)throw new Error('SUPABASE_URL not configured');const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;if(!key)throw new Error('SUPABASE_PUBLISHABLE_KEY not configured');const r=await fetch(url.replace(/\/$/,'')+path,{method,headers:{apikey:key,Authorization:`Bearer ${accessToken||key}`,'content-type':'application/json',...headers},body:payload==null?undefined:JSON.stringify(payload)});const txt=await r.text();let out;try{out=txt?JSON.parse(txt):null}catch{out=txt}if(!r.ok){const er=new Error(out?.msg||out?.message||`Supabase ${r.status}`);er.status=r.status;er.payload=out;throw er}return out}
module.exports={json,body,method,cookies,setCookie,clearCookie,token,hash,safeError,supabase};
