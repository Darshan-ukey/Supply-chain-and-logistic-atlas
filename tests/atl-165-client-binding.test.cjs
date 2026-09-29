const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const wd = JSON.parse(fs.readFileSync(path.join(root,'data/generated/workdefinitions/road-ltl-ltl04-v1.json'),'utf8'));
const binding = JSON.parse(fs.readFileSync(path.join(root,'data/generated/client-bindings/road-ltl-ltl04-client-binding-v1.json'),'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root,'data/contracts/atlas-client-binding-set-v1.schema.json'),'utf8'));

assert.equal(schema.$id,'atlas-client-binding-set-v1.schema.json');
assert.equal(binding.schemaVersion,'atlas-client-binding-set-v1.0');
assert.equal(binding.status,'FROZEN');
assert.equal(binding.bounded,true);
assert.equal(binding.workDefinitionId,'wd::road-ltl::LTL-04::v1');
assert.equal(binding.canonicalTruthMutation,false);

const workDefinition = wd.workDefinitions.find(x => x.workDefinitionId === binding.workDefinitionId);
assert.ok(workDefinition,'binding must reference frozen ATL-159 WorkDefinition');
const need = workDefinition.bindingNeeds.find(x => x.type === 'CLIENT_BINDING_REQUIRED');
assert.ok(need,'ATL-159 CLIENT_BINDING_REQUIRED need must exist');
assert.ok(binding.bindings.some(x => x.dimension === need.dimension),'ATL-165 must consume ATL-159 binding need');

for (const b of binding.bindings) {
  assert.ok(b.reason);
  assert.ok(b.expected && b.expected.valueType && b.expected.source && b.expected.system && b.expected.authority);
  assert.ok(b.collectionQuestion);
  assert.ok(Array.isArray(b.provenance.canonicalSourceIds) && b.provenance.canonicalSourceIds.length > 0);
  assert.ok(['RESOLVED','CLIENT_BINDING_REQUIRED'].includes(b.resolution.state));
  if (b.resolution.state === 'RESOLVED') {
    assert.equal(b.resolution.method,'GOVERNED_MANUAL');
    assert.ok(b.resolution.value);
    assert.ok(b.provenance.bindingEvidenceIds.length > 0);
  }
}
const unresolved = binding.bindings.filter(x => x.resolution.state === 'CLIENT_BINDING_REQUIRED');
const resolved = binding.bindings.filter(x => x.resolution.state === 'RESOLVED');
assert.equal(binding.readiness.unresolvedCount,unresolved.length);
assert.equal(binding.readiness.resolvedCount,resolved.length);
assert.equal(binding.readiness.state,unresolved.length ? 'CLIENT_BINDING_REQUIRED' : 'READY');
assert.equal(binding.readiness.failClosed,unresolved.length > 0);
assert.equal(binding.malkomPackage.bindingState,binding.readiness.state);
assert.equal(binding.malkomPackage.canonicalMutation,false);
assert.deepEqual(new Set(binding.malkomPackage.unresolvedBindingIds),new Set(unresolved.map(x=>x.bindingId)));
assert.deepEqual(new Set(binding.malkomPackage.resolvedBindingIds),new Set(resolved.map(x=>x.bindingId)));

console.log('ATL-165 client binding contract: PASS');
