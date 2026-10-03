const fs=require('fs'),cp=require('child_process'),assert=require('assert');
const schema=JSON.parse(fs.readFileSync('data/contracts/atlas-client-binding-set-v1.schema.json','utf8'));
const req=JSON.parse(fs.readFileSync('schemas/client-binding-requirement-v1.json','utf8'));
const out=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-client-binding-v1.cjs'],{encoding:'utf8'}));
assert.strictEqual(schema.properties.schemaVersion.const,'atlas-client-binding-set-v1.1');
assert.strictEqual(schema.properties.semanticModuleVersion.const,'1.5');
assert.strictEqual(schema.properties.governingContract.const,'schemas/client-binding-requirement-v1.json');
assert.strictEqual(schema.properties.canonicalTruthMutation.const,false);
assert.strictEqual(schema.properties.workDefinitionContext.properties.state.const,'CORRECTED_CONTEXT_REQUIRED_BEFORE_S8_3_REGENERATION');
for(const k of req.required) assert.ok(schema.properties.bindings.items.required.includes(k),'schema missing governed binding field '+k);
for(const b of out.bindings){
 for(const k of req.required) assert.ok(Object.prototype.hasOwnProperty.call(b,k),'output missing '+k);
 assert.ok(['CLIENT_BINDING_REQUIRED','RESOLVED'].includes(b.resolutionStatus));
 assert.strictEqual(b.taskId,'LTL-04');
}
assert.strictEqual(out.bindings.length,3);
assert.strictEqual(out.readiness.unresolvedCount,1);
assert.strictEqual(out.readiness.failClosed,true);
assert.strictEqual(out.consumerProjection.canonicalMutation,false);
console.log('PASS S8-2D ATL-165 schema compatibility: governed requirement fields + bounded fail-closed projection');
