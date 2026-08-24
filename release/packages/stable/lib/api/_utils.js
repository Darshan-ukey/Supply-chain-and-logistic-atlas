const ACCESS_COOKIE='atlas_access';
const REFRESH_COOKIE='atlas_refresh';

export function env(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) throw new Error('Stage 17 server is missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
  return {url:url.replace(/\/$/,''),key};
}
export function send(res,status,payload,headers={}){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  for(const [k,v] of Object.entries(headers))res.setHeader(k,v);
  res.end(JSON.stringify(payload));
}
export async function body(req){
  if(req.body && typeof req.body==='object') return req.body;
  let raw=''; for await (const c of req) raw+=c;
  if(!raw)return {};
  try{return JSON.parse(raw)}catch{throw Object.assign(new Error('Invalid JSON body'),{status:400})}
}
export function cookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(i<0?x:x.slice(0,i)),decodeURIComponent(i<0?'':x.slice(i+1))]}));
}
function cookie(name,value,maxAge){
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function setSession(res,session){
  const max=Math.max(60,Number(session.expires_in||3600));
  res.setHeader('Set-Cookie',[cookie(ACCESS_COOKIE,session.access_token,max),cookie(REFRESH_COOKIE,session.refresh_token,60*60*24*30)]);
}
export function clearSession(res){
  res.setHeader('Set-Cookie',[cookie(ACCESS_COOKIE,'',0),cookie(REFRESH_COOKIE,'',0)]);
}
export function accessToken(req){return cookies(req)[ACCESS_COOKIE]||null}
export function refreshToken(req){return cookies(req)[REFRESH_COOKIE]||null}
export async function supabase(path,{method='GET',token,headers={},data,rawBody}={}){
  const {url,key}=env();
  const h={apikey:key,...headers};
  if(token)h.Authorization=`Bearer ${token}`;
  let payload;
  if(rawBody!==undefined){payload=rawBody}
  else if(data!==undefined){h['Content-Type']='application/json';payload=JSON.stringify(data)}
  const r=await fetch(`${url}${path}`,{method,headers:h,body:payload});
  const text=await r.text(); let out=text;
  try{out=text?JSON.parse(text):null}catch{}
  if(!r.ok){const e=new Error(out?.msg||out?.message||out?.error_description||`Supabase ${r.status}`);e.status=r.status;e.detail=out;throw e}
  return {status:r.status,data:out,headers:r.headers};
}
export async function userForToken(token){
  if(!token)return null;
  try{return (await supabase('/auth/v1/user',{token})).data}catch{return null}
}
export async function requireUser(req){
  const token=accessToken(req); const user=await userForToken(token);
  if(!user){const e=new Error('Authentication required');e.status=401;throw e}
  return {token,user};
}
export async function refreshSession(req,res){
  const rt=refreshToken(req); if(!rt)return null;
  try{
    const {data}=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:rt}});
    setSession(res,data); return data;
  }catch{return null}
}
export function safeName(name){return String(name||'evidence').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'evidence'}
export function err(res,e){send(res,e.status||500,{ok:false,error:e.message,detail:e.status===400?e.detail:undefined})}
