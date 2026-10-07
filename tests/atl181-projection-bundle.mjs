import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';

// Reproduce server cwd with only explicitly bundled dependencies, not the repo.
const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const registryPath = 'governance/presentation/p2-projection-source-registry.json';
const registry = read(registryPath);
const required = [...new Set([registryPath, ...registry.sources.flatMap(s =>
  ['modulePath','operationalKnowledgePath','informationResolutionBaselinePath','publicProjectionBundlePath'].map(k => s[k]).filter(Boolean))])];
const pattern = read('vercel.json').functions['api/atlas.js'].includeFiles;
assert(pattern.length <= 256, 'Vercel includeFiles schema limit');
const bundled=[...fs.globSync(pattern)].map(p=>p.replaceAll('\\','/')).sort();
const summaryPaths=['governance/product/s8-3b-evidence/reconstruction-summary.json','governance/product/s8-3c-evidence/package-readiness-summary.json','governance/product/s8-3d-evidence/projection-summary.json','governance/product/s8-3e-evidence/flow-summary.json'];
assert.deepEqual(bundled,[...required,'governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json',...summaryPaths].sort(),'only audited public projection/summary dependencies are bundled');
const tuples = registry.sources.flatMap(s => {
  const tasks = s.publicProjectionBundlePath
    ? Object.keys(JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(s.publicProjectionBundlePath,'utf8').trim(),'base64'))).sources[s.sourceKey])
    : read(s.modulePath)[s.taskCollection].map(t => t[s.taskIdField]);
  return tasks.map(taskId => ({moduleId:s.moduleId,moduleVersion:s.moduleVersion,taskId}));
});
assert.equal(tuples.length,61);
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'atlas-projection-bundle-'));
try {
  for (const p of [...bundled, 'lib/projections/execution-depth-projection.js','lib/api/execution-depth-projection.js','lib/api/_utils.js','lib/projections/governed-depth-summary.js','lib/api/governed-depth-summary.js','assets/atl-140-consumer-view.mjs']) {
    const dest = path.join(dir,p);
    fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(path.join(root,p),dest);
  }
  fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}');
  fs.writeFileSync(path.join(dir,'run.mjs'), `
import assert from 'node:assert/strict';
import handler from './lib/api/execution-depth-projection.js';
import summaryHandler from './lib/api/governed-depth-summary.js';
import {publicProjectionForbiddenTokens} from './lib/projections/execution-depth-projection.js';
const call=async(query,method='GET')=>{let data;const res={setHeader(){},end(v){data=JSON.parse(v)}};await handler({method,query},res);return {status:res.statusCode,data}};
for(const tuple of ${JSON.stringify(tuples)}){
 const r=await call(tuple);assert.equal(r.status,200);assert.equal(r.data.projection.projectionClass,'PUBLIC_SAFE');
 for(const k of ['moduleId','moduleVersion','taskId'])assert.equal(r.data.projection.trace[k],tuple[k]);
 for(const token of publicProjectionForbiddenTokens())assert(!JSON.stringify(r.data).includes(token),token);
}
for(const tuple of [
 {moduleId:'road-ltl',moduleVersion:'1.2',taskId:'LTL-03'},
 {moduleId:'ocean-fcl',moduleVersion:'0.5',taskId:'FCL-01'},
 {moduleId:'road-ltl',moduleVersion:'1.5',taskId:'MISSING'},
 {moduleId:'../../private',moduleVersion:'1',taskId:'x'}])assert.equal((await call(tuple)).status,404);
assert.equal((await call({})).status,400);
assert.equal((await call({},'POST')).status,405);
let summary;const response={setHeader(){},end(v){summary=JSON.parse(v)}};
await summaryHandler({method:'GET',query:{moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-04'}},response);
assert.equal(response.statusCode,200,JSON.stringify(summary));assert.equal(summary.ok,true);
console.log('PASS: isolated bundle; 61 exact PUBLIC_SAFE tuples; protected token exclusion; 6 fail-closed negatives');
`);
  process.stdout.write(execFileSync(process.execPath,['run.mjs'],{cwd:dir,encoding:'utf8'}));
} finally {
  assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(dir,{recursive:true,force:true});
}
