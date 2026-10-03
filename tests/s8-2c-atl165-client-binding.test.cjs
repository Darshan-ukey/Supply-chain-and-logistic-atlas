const cp=require('child_process'),assert=require('assert'),fs=require('fs');
const run=()=>cp.execFileSync(process.execPath,['scripts/materialize-client-binding-v1.cjs'],{encoding:'utf8'});
const a=run(),b=run();assert.strictEqual(a,b);
const x=JSON.parse(a),req=JSON.parse(fs.readFileSync('schemas/client-binding-requirement-v1.json','utf8'));
assert.strictEqual(x.schemaVersion,'atlas-client-binding-set-v1.1');
assert.strictEqual(x.semanticModuleVersion,'1.5');
assert.strictEqual(x.semanticRecordId,'road-ltl::LTL-04::operational-semantics::v1');
assert.strictEqual(x.governingContract,'schemas/client-binding-requirement-v1.json');
assert.strictEqual(x.canonicalTruthMutation,false);
assert.strictEqual(x.workDefinitionContext.state,'CORRECTED_CONTEXT_REQUIRED_BEFORE_S8_3_REGENERATION');
assert.strictEqual(x.bindings.length,3);
for(const b of x.bindings){
 for(const k of req.required) assert.ok(Object.prototype.hasOwnProperty.call(b,k),'missing governed field '+k);
 assert.strictEqual(b.taskId,'LTL-04'); assert.ok(b.sourceRefs.length);
}
assert.strictEqual(x.readiness.resolvedCount,2);assert.strictEqual(x.readiness.unresolvedCount,1);assert.strictEqual(x.readiness.failClosed,true);
assert.deepStrictEqual(x.consumerProjection.unresolvedBindingIds,['binding::road-ltl::LTL-04::execution-parameters']);
assert.strictEqual(x.consumerProjection.canonicalMutation,false);
console.log('PASS S8-2C ATL-165 governed client binding: 3 requirements; 2 resolved; 1 fail-closed');
