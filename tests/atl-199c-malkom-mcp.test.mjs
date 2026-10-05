import assert from 'node:assert/strict';
import {createMalkomMcpTools,malkomToolDefinitions} from '../mcp/malkom-tools.js';
import {createMalkomMcpJsonRpcHandler} from '../mcp/malkom-jsonrpc.js';

const service={
  verify:x=>({valid:true,input:x}),
  adapt:x=>({definition:{kind:'malkom.domain-work-definition/2.3'},assessment:{canonicalMutation:false},input:x}),
  compile:x=>({queue:{name:'Pickup'},input:x}),
  run:x=>({ok:true,stage:'COMPLETE',adapter:{assessment:{adapter:'a',profileId:'p',canonicalMutation:false},definition:{sourceRecord:{atlasCanonical:{workDefinitionId:'wd'}}}},verification:{valid:true},compilation:{queue:{name:'Pickup'}},materialization:{finalMaterializable:false,finalDisposition:'BLOCKED_BY_ATLAS_GOVERNANCE',reasons:['BIND'],queueSummary:{name:'Pickup'}}}),
  projectionSummary:({result})=>({ok:true,stage:result.stage,adapter:'a',workDefinitionId:'wd',profileId:'p',verificationValid:true,queue:'Pickup',finalMaterializable:false,finalDisposition:'BLOCKED_BY_ATLAS_GOVERNANCE',blockers:['BIND'],canonicalMutation:false})
};
assert.ok(malkomToolDefinitions.length>=7);
const tools=createMalkomMcpTools(service);
const call=await tools.call('run_malkom_integration',{atlasProjection:{},consumerProfile:{}});
assert.equal(call.isError,false);
const decoded=JSON.parse(call.content[0].text);
assert.equal(decoded.claims.liveHostCertified,false);
const rpc=createMalkomMcpJsonRpcHandler(service);
const init=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{}});
assert.equal(init.result.serverInfo.name,'atlas-malkom-bounded');
const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});
assert.equal(list.result.tools.length,malkomToolDefinitions.length);
const bad=await rpc({jsonrpc:'2.0',id:3,method:'missing'});
assert.equal(bad.error.code,-32601);
console.log(JSON.stringify({status:'PASS',tools:malkomToolDefinitions.map(x=>x.name)}));
