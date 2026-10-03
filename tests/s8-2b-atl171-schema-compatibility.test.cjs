const fs=require('fs'),cp=require('child_process'),assert=require('assert');
const schema=JSON.parse(fs.readFileSync('data/contracts/atlas-operational-semantic-record-v1.schema.json','utf8'));
const ok=JSON.parse(fs.readFileSync('schemas/operational-knowledge-contract-v2.json','utf8'));
const ir=JSON.parse(fs.readFileSync('schemas/information-resolution-contract-v1.json','utf8'));
const out=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-operational-semantics-v1.cjs'],{encoding:'utf8'}));
assert.strictEqual(schema.properties.moduleVersion.const,'1.5');
assert.ok(schema.required.includes('governingLineage'));
assert.strictEqual(schema.properties.governingLineage.properties.operationalKnowledgeContract.const,'schemas/operational-knowledge-contract-v2.json');
assert.strictEqual(schema.properties.governingLineage.properties.informationResolutionContract.const,'schemas/information-resolution-contract-v1.json');
assert.strictEqual(ok.informationResolution.$ref,'information-resolution-contract-v1');
for(const k of ir.required) assert.ok(ir.properties[k], 'IR required property absent: '+k);
const req=schema.required;
for(const r of out.records){
 for(const k of req) assert.ok(Object.prototype.hasOwnProperty.call(r,k),'record '+r.processId+' missing '+k);
 assert.strictEqual(r.moduleVersion,'1.5');
 assert.ok(r.sourceIds.length);
 assert.ok(schema.properties.knowledgeState.enum.includes(r.knowledgeState));
 assert.ok(schema.properties.dependencyClass.enum.includes(r.dependencyClass));
 for(const rel of r.relationships) assert.ok(schema.properties.relationships.items.properties.type.enum.includes(rel.type));
 const g=r.governingLineage;
 assert.strictEqual(g.operationalKnowledgeContract,'schemas/operational-knowledge-contract-v2.json');
 assert.strictEqual(g.informationResolutionContract,'schemas/information-resolution-contract-v1.json');
}
assert.strictEqual(out.records.length,22);
assert.deepStrictEqual(out.changedTaskIds,['LTL-03']);
console.log('PASS S8-2B schema compatibility: 22 ATL-171 records conform to bounded v1.5 + OKv2/IR lineage');
