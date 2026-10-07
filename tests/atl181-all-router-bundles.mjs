import assert from 'node:assert/strict';
import fs from 'node:fs';
const groups=['auth','system','workspace','documents','collab','transform','evaluation','atlas'];
const call=async(handler,action)=>{let payload;const res={setHeader(){},status(code){this.statusCode=code;return this},json(value){payload=value;return this},end(value){payload=JSON.parse(value)}};await handler({method:'GET',headers:{},query:{action}},res);return {status:res.statusCode,payload};};
let count=0;
for(const group of groups){
  const source=fs.readFileSync(`api/${group}.js`,'utf8');
  assert(!/['"][^'"]+['"]:\s*['"]\.\//.test(source),`${group}: dynamic handler mapping`);
  const {default:handler}=await import(`../api/${group}.js`);
  const unknown=await call(handler,'not-an-atlas-action');
  assert.equal(unknown.status,404);
  for(const action of unknown.payload.available){
    assert(source.includes(`../lib/api/${action}.js`),`${group}/${action}: static import missing`);
    count++;
  }
  const checks={auth:['auth-admin-session',200],system:['health',200],workspace:['workspaces',401],documents:['documents',401],collab:['collaboration',401],transform:['transformation-export',405],evaluation:['pilot-evaluation',401],atlas:['runtime-access',401]};
  const [action,status]=checks[group];
  const result=await call(handler,action);
  assert.equal(result.status,status,`${group}/${action}: ${JSON.stringify(result.payload)}`);
  if(group==='auth')assert.equal(result.payload.isAdmin,false);
}
console.log(`PASS: ${count} static handler mappings load across ${groups.length} groups; unknown action404; public session/health and protected/method boundaries`);
