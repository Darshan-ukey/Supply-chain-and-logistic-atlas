const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

function loadBrowserApi(path,key){
  const code=fs.readFileSync(path,'utf8');
  const ctx={globalThis:{}};
  vm.createContext(ctx);
  vm.runInContext(code,ctx,{filename:path});
  return ctx.globalThis[key];
}
const discovery=loadBrowserApi('assets/atl-181-canonical-discovery.js','AtlasCanonicalDiscovery');
const traceApi=loadBrowserApi('assets/atl-181-road-ltl-source-trace.js','AtlasRoadLtlSourceTrace');
const page0=JSON.parse(fs.readFileSync('data/page0/page0-v6.2.2.json','utf8'));
const pack=JSON.parse(fs.readFileSync('data/source-claims/road-ltl-v1.5-bol-resolution-claims.json','utf8'));

const searchCases=[
 ['TMS','System','sys-tms'],
 ['MDM','System','sys-mdm'],
 ['Purchase order','Business Object','obj-purchase-order'],
 ['Handling unit','Business Object','obj-handling-unit'],
 ['BOL','Document','doc-road-cmr-bol'],
 ['e-AWB','Document','doc-air-awb'],
 ['pickup','Event','evt-pickup-dispatched'],
 ['inspection','Event','evt-customs-status']
];
let pass=0;
for(const [q,cls,id] of searchCases){
  const r=discovery.resolveCanonicalDiscovery(page0,q,{objectClass:cls});
  assert.equal(r.status,'RESOLVED',q);
  assert.equal(r.match.id,id,q);
  console.log('PASS COR-015',q,id); pass++;
}
const pod=discovery.resolveCanonicalDiscovery(page0,'POD');
assert.equal(pod.status,'AMBIGUOUS');
assert.deepEqual([...pod.matches.map(x=>x.id)].sort(),['evt-pod-captured','obj-pod']);
console.log('PASS COR-015 POD ambiguity'); pass++;
const unknown=discovery.resolveCanonicalDiscovery(page0,'definitely-not-a-governed-atlas-id');
assert.equal(unknown.status,'NO_RESULT');
console.log('PASS COR-015 unknown fail-closed'); pass++;

const trace=traceApi.buildRoadLtlSourceTrace(pack);
const traceCases=[
 ['bol-us-required-content',['src-ecfr-49-373-101']],
 ['hazmat-entry-identification',['src-ecfr-49-172-201']],
 ['hazmat-basic-description-object',['src-ecfr-49-172-202']],
 ['hazmat-technical-name-conditional...[truncated]