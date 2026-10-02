const fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const root=fs.readFileSync('index.html','utf8'),consumer=fs.readFileSync('atl-140-malkom-consumer.html','utf8'),slice=fs.readFileSync('atl-167-interaction-slice.html','utf8');
const manifest=JSON.parse(fs.readFileSync('release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json'));
const ready=JSON.parse(fs.readFileSync('data/generated/readiness/road-ltl-ltl04-malkom-readiness-v1.json'));
const boundary=JSON.parse(fs.readFileSync('data/generated/malkom-domain-warehouse/road-ltl-ltl04-projection-boundary-v1.json'));
assert.equal(manifest.releaseCandidate.task,'ATL-141');assert.equal(manifest.releaseCandidate.browserEvidenceRequired,true);assert.equal(manifest.productionPromotionAuthorized,false);
for(const x of ['/atl-167-interaction-slice.html','/atl-140-malkom-consumer.html'])assert(root.includes(x),x);
for(const x of ['Canvas / Home','Road LTL work detail','Malkom requirement coverage','CLIENT_BINDING_REQUIRED','fail-closed'])assert(consumer.includes(x),x);
for(const x of ['data-step="domain"','data-step="daughter"','data-step="inspect"','data-step="deepen"','data-step="wd"','data-step="binding"','data-step="coverage"','data-step="export"'])assert(slice.includes(x),x);
assert(slice.includes('id="publicView"')&&slice.includes('id="adminView"'));assert(slice.includes('BLOCKED_UNKNOWN_BINDING'));assert(ready.projection.blocked===true);assert(boundary.canonicalBoundary.failClosed===true);
for(const d of manifest.dependencies){assert(fs.existsSync(d.path),d.path)}
const forbidden=['full BOL readiness','BOL complete','v2 complete','production approved'];for(const s of forbidden){assert(!consumer.toLowerCase().includes(s.toLowerCase()),s)}
console.log('ATL-141 deterministic release candidate integrity: PASS');
