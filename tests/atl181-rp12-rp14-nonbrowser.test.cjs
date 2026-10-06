const assert=require('assert');
const fs=require('fs');
const vm=require('vm');

function loadBrowserApi(path,key){
  const code=fs.readFileSync(path,'utf8');
  const ctx={globalThis:{}};
  vm.createContext(ctx);vm.runInContext(code,ctx,{filename:path});
  return ctx.globalThis[key];
}
const discovery=loadBrowserApi('assets/atl-181-canonical-discovery.js','AtlasCanonicalDiscovery');
const traceApi=loadBrowserApi('assets/atl-181-road-ltl-source-trace.js','AtlasRoadLtlSourceTrace');
const page0=JSON.parse(fs.readFileSync('data/page0/page0-v6.2.2.json','utf8'));
const pack=JSON.parse(fs.readFileSync('data/source-claims/road-ltl-v1.5-bol-resolution-claims.json','utf8'));

const searchCases=[
 ['TMS','System','sys-tms'],['MDM','System','sys-mdm'],
 ['Purchase order','Business Object','obj-purchase-order'],
 ['Handling unit','Business Object','obj-handling-unit'],
 ['BOL','Document','doc-road-cmr-bol'],['e-AWB','Document','doc-air-awb'],
 ['pickup','Event','evt-pickup-dispatched'],['inspection','Event','evt-customs-status']
];
let pass=0;
for(const [q,cls,id] of searchCases){
  const r=discovery.resolveCanonicalDiscovery(page0,q,{objectClass:cls});
  assert.equal(r.status,'RESOLVED',q);assert.equal(r.match.id,id,q);
  console.log('PASS COR-015',q,id);pass++;
}
const pod=discovery.resolveCanonicalDiscovery(page0,'POD');
assert.equal(pod.status,'AMBIGUOUS');
assert.deepEqual([...pod.matches.map(x=>x.id)].sort(),['evt-pod-captured','obj-pod']);
console.log('PASS COR-015 POD ambiguity');pass++;
const unknown=discovery.resolveCanonicalDiscovery(page0,'definitely-not-a-governed-atlas-id');
assert.equal(unknown.status,'NO_RESULT');console.log('PASS COR-015 unknown fail-closed');pass++;

const trace=traceApi.buildRoadLtlSourceTrace(pack);
const traceCases=[
 ['bol-us-required-content',['src-ecfr-49-373-101']],
 ['hazmat-entry-identification',['src-ecfr-49-172-201']],
 ['hazmat-basic-description-object',['src-ecfr-49-172-202']],
 ['hazmat-technical-name-conditional',['src-ecfr-49-172-203']],
 ['hazmat-zone-conditional',['src-ecfr-49-172-203']],
 ['hazmat-emergency-provider-identity',['src-ecfr-49-172-604']],
 ['ltl-ebol-standard-version',['src-dsdc-ebol-2.1']],
 ['canonical-object-first-resolution',['src-uncefact-transport-logistics','src-dsdc-ebol-2.1']]
];
for(const [claimId,ids] of traceCases){
  const r=traceApi.traceRoadLtlClaim(trace,claimId);
  assert.equal(r.status,'RESOLVED',claimId);assert.deepEqual([...r.sources.map(x=>x.sourceId)],ids,claimId);
  for(const source of r.sources){
    assert.ok(/^https:\/\//.test(source.url),claimId+' source URL');
    assert.ok(source.issuer&&source.title&&source.tier&&source.applicability,claimId+' source metadata');
  }
  console.log('PASS COR-016',claimId,ids.join(','));pass++;
}
assert.equal(pass,18);console.log(JSON.stringify({pass,total:18}));

const shell=fs.readFileSync('execution/ui/runtime-access-shell.js','utf8');
const rootIndex=fs.readFileSync('index.html','utf8');
assert.ok(rootIndex.includes('/execution/ui/runtime-access-shell.js'),'root must load runtime access shell');
assert.ok(shell.includes("import('/assets/atl-181-canonical-discovery.js')"),'runtime shell loads canonical discovery');
assert.ok(shell.includes("import('/assets/atl-181-road-ltl-source-trace.js')"),'runtime shell loads source trace');
assert.ok(shell.includes("import('/assets/atl-181-rp12-rp14-integration.js')"),'runtime shell loads consumer integration');
console.log('PASS consumer wiring · root -> runtime shell -> RP12/RP14 integration');
