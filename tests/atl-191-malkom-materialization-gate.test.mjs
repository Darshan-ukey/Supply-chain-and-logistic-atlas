import assert from 'node:assert/strict';
import {evaluateMalkomProofMaterialization} from '../lib/adapters/malkom-proof-materialization-gate.js';

const adapter={assessment:{canonicalMutation:false,upstreamBlocked:true,profileVerified:false}};
const compilation={
  bindingRequired:true,
  workflow:{materializable:true,blockers:[]},
  runtimeProjection:{disposition:'MAPPED'},
  queue:{name:'Pickup Request',subQueues:[1,2,3],workTypes:[1,2,3],fields:Array(10),outcomes:Array(4)}
};
const blocked=evaluateMalkomProofMaterialization(adapter,compilation);
assert.equal(blocked.engineWorkflowMaterializable,true);
assert.equal(blocked.finalMaterializable,false);
assert.equal(blocked.finalDisposition,'BLOCKED_BY_ATLAS_GOVERNANCE');
assert.deepEqual(blocked.reasons,['ATLAS_UPSTREAM_NOT_MATERIALIZABLE','CONSUMER_PROFILE_NOT_VERIFIED','CLIENT_BINDING_REQUIRED']);

const ready=evaluateMalkomProofMaterialization(
  {assessment:{canonicalMutation:false,upstreamBlocked:false,profileVerified:true}},
  {...compilation,bindingRequired:false,workflow:{materializable:true,blockers:[]}}
);
assert.equal(ready.finalMaterializable,true);
console.log(JSON.stringify({status:'PASS',blocked,readyMaterializable:ready.finalMaterializable}));
