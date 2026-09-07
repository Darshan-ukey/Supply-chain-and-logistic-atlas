import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {buildPublicExecutionDepthProjection,publicProjectionForbiddenTokens} from '../lib/projections/execution-depth-projection.js';

const bundlePath='data/materialized/road-ltl-1.5-public-safe-projections.json.gz.b64';
const bundle=JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(bundlePath,'utf8').trim(),'base64')).toString('utf8'));
const stored=bundle?.sources?.['road-ltl@1.5']||{};
const ids=Array.from({length:22},(_,i)=>`LTL-${String(i+1).padStart(2,'0')}`);
assert.deepEqual(Object.keys(stored).sort(),ids,'P6.0 effective Road LTL 1.5 coverage must remain exactly 22/22');

for(const taskId of ids){
  const before=stored[taskId];
  const runtime=buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.5',taskId});
  assert.equal(runtime.projectionClass,'PUBLIC_SAFE');
  assert.equal(runtime.trace?.moduleId,'road-ltl');
  assert.equal(String(runtime.trace?.moduleVersion),'1.5');
  assert.equal(runtime.trace?.taskId,taskId);
  assert.deepEqual(runtime.overview,before.overview,`${taskId} P6.0 Overview semantics must remain unchanged`);
  assert.deepEqual(runtime.operationalKnowledge,before.operationalKnowledge,`${taskId} P6.0 Operational Knowledge semantics must remain unchanged`);
  assert.equal(runtime.protectedExecution?.workDecomposition?.detailIncluded,false,`${taskId} P6.1 summary must remain non-reconstructive`);
  assert.equal(runtime.protectedExecution?.workDefinition?.detailIncluded,false,`${taskId} WorkDefinition must remain protected/not materialized by P6.1`);
  assert.equal(runtime.executionReadiness?.decompositionStatus,'COMPILED_WITH_EXPLICIT_BLOCKERS',`${taskId} P6.1 may only advance decomposition readiness metadata`);
  for(const token of publicProjectionForbiddenTokens())assert.ok(!JSON.stringify(runtime).includes(token),`${taskId} must not expose protected token ${token}`);
}

assert.throws(()=>buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-99'}),e=>Number(e?.status)===404,'unknown 1.5 task must fail closed');
assert.throws(()=>buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.4',taskId:'LTL-04'}),e=>Number(e?.status)===404,'1.4 must not be used as runtime fallback');
assert.equal(stored['LTL-03']?.trace?.effectiveLineage?.semanticSourceVersion,'1.5','LTL-03 direct governed 1.5 semantic override must remain intact');
assert.equal(stored['LTL-04']?.trace?.effectiveLineage?.semanticSourceVersion,'1.4','inherited task semantic lineage must remain pinned to frozen 1.4 base');

console.log('P6.1 inherited P6.0 semantic/materialization regression PASS');
