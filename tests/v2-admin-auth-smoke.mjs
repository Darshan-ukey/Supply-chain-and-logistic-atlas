process.env.SUPABASE_URL='https://supabase.test';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-test';
process.env.ATLAS_ADMIN_EMAILS='admin@example.com, second.admin@example.com';

import adminLogin from '../lib/api/auth-admin-login.js';
import adminSession from '../lib/api/auth-admin-session.js';
import adminWorkdefs from '../lib/api/admin-workdefinitions.js';

let failures=0;const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};
function req(method='GET',{body={},cookie=''}={}){return {method,body,headers:{cookie},query:{},url:'/api/test'}}
function res(){const h={};return {statusCode:0,body:'',setHeader(k,v){h[k.toLowerCase()]=v},end(v=''){this.body=String(v)},headers:h}}
async function call(handler,r){const s=res();await handler(r,s);let d={};try{d=JSON.parse(s.body||'{}')}catch{}return {status:s.statusCode,data:d,headers:s.headers}}
let mode='admin';const calls=[];
global.fetch=async(url,opt={})=>{
  url=String(url);calls.push({url,opt});
  if(url.includes('/auth/v1/token?grant_type=password')){
    const email=mode==='admin'?'admin@example.com':'user@example.com';
    return {ok:true,status:200,text:async()=>JSON.stringify({access_token:'access-x',refresh_token:'refresh-x',expires_in:3600,user:{id:mode==='admin'?'u-admin':'u-user',email,app_metadata:{}}})};
  }
  if(url.includes('/auth/v1/user')){
    const email=mode==='admin'?'admin@example.com':'user@example.com';
    return {ok:true,status:200,text:async()=>JSON.stringify({id:mode==='admin'?'u-admin':'u-user',email,app_metadata:{}})};
  }
  if(url.includes('/auth/v1/logout'))return {ok:true,status:204,text:async()=>''};
  if(url.includes('/rest/v1/atlas_work_definitions'))return {ok:true,status:200,text:async()=>JSON.stringify([{payload:{id:'wd-test',version:'0.1.0',lifecycleStatus:'ACTIVE',domain:'supply-chain.transport.road-ltl',sourceTask:{sourceId:'LTL-TEST',sourceVersion:'Road LTL V1.2'},malkomProjection:{subQueues:[{}],workTypes:[{}]},fields:[{}],outcomes:[{}],transitions:[{}]}}])};
  throw new Error(`Unexpected fetch ${url}`);
};

mode='admin';let r=await call(adminLogin,req('POST',{body:{email:'admin@example.com',password:'x'}}));
check(r.status===200&&r.data.isAdmin===true,'Admin allowlist login succeeds');
check(Array.isArray(r.headers['set-cookie'])&&r.headers['set-cookie'].some(x=>/HttpOnly/.test(x)&&/Secure/.test(x)),'Admin login issues secure HttpOnly session cookies');
mode='user';r=await call(adminLogin,req('POST',{body:{email:'user@example.com',password:'x'}}));
check(r.status===403,'Non-admin Supabase user is rejected by Admin login');
mode='admin';r=await call(adminSession,req('GET',{cookie:'atlas_access=access-x'}));
check(r.status===200&&r.data.isAdmin===true,'Admin session endpoint confirms authorization');
mode='user';r=await call(adminWorkdefs,req('GET',{cookie:'atlas_access=access-x'}));
check(r.status===403,'Protected WorkDefinition endpoint rejects authenticated non-admin');
mode='admin';calls.length=0;r=await call(adminWorkdefs,req('GET',{cookie:'atlas_access=access-x'}));
check(r.status===200&&r.data.registry?.definitions?.length===1,'Protected WorkDefinition endpoint returns data to Admin');
const serviceCall=calls.find(x=>x.url.includes('/rest/v1/atlas_work_definitions'));
check(serviceCall?.opt?.headers?.Authorization==='Bearer service-role-test','Protected store uses server-only Supabase service role after Admin authorization');
check(/no-store/i.test(String(r.headers['cache-control']||'')),'Protected WorkDefinition response is no-store');
console.log(failures?`FAIL · ${failures} Admin authentication check(s) failed`:'PASS · V2 Admin authentication + authorization boundary');
if(failures)process.exit(1);
