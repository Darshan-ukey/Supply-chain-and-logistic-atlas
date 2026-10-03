const cp=require('child_process'),assert=require('assert');
const run=()=>cp.execFileSync(process.execPath,['scripts/materialize-operational-semantics-v1.cjs'],{encoding:'utf8'});
const a=run(),b=run(); assert.strictEqual(a,b);
const x=JSON.parse(a);
assert.strictEqual(x.moduleVersion,'1.5');
assert.strictEqual(x.recordCount,22);
assert.deepStrictEqual(x.changedTaskIds,['LTL-03']);
for(const r of x.records){
  for(const k of ['semanticRecordId','stateBefore','event','decision','rule','control','action','evidence','stateAfter','outcome','knowledgeState','dependencyClass']) assert.ok(r[k]);
  assert.ok(r.sourceIds.length);
  assert.strictEqual(r.governingLineage.overlay,'data/modules/road-ltl-v1.5.json');
}
const l3=x.records.find(r=>r.processId==='LTL-03');
assert.ok(l3);
assert.strictEqual(l3.governingLineage.overrideApplied,true);
assert.strictEqual(l3.governingLineage.operationalKnowledgeRef,'a5-ltl-03');
assert.match(l3.action,/canonical/i);
for(const r of x.records.filter(r=>r.processId!=='LTL-03')) assert.strictEqual(r.governingLineage.overrideApplied,false);
console.log('PASS S8-2A ATL-171 governed v1.5 semantics: '+x.recordCount+' records; override LTL-03 only');
