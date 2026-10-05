import assert from 'node:assert/strict';
import handler from '../lib/api/malkom-integration.js';

const run=async({method='GET',body=null}={})=>{
  const req={method,body,query:{},url:'/api/malkom-integration',[Symbol.asyncIterator]:async function*(){}};
  let data='';
  const headers={};
  const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,end:x=>{data=String(x??'');return data;}};
  await handler(req,res);
  return {status:res.statusCode,headers,payload:JSON.parse(data)};
};
const get=await run();
assert.equal(get.status,200);
assert.equal(get.payload.mode,'BOUNDED_NON_LIVE');
assert.equal(get.payload.liveHostCertified,false);
const bad=await run({method:'POST',body:{operation:'unknown'}});
assert.equal(bad.status,400);
assert.equal(bad.payload.error.code,'UNKNOWN_OPERATION');
console.log(JSON.stringify({status:'PASS',get:get.payload,bad:bad.payload.error.code}));
