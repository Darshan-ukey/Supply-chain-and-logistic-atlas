import assert from 'node:assert/strict';
import fs from 'node:fs';
import {systemRoles,relationshipModel,densityWindow} from '../assets/canvas-v2-relationships.mjs';
const module=JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.2.json','utf8'));
let cases=0;
for(const p of module.processes){
 const m=relationshipModel(module,p.id);
 for(const [field,role] of [['producer','Producer'],['authoritySystem','Authority'],['consumers','Consumer']]){
  const ids=(Array.isArray(p[field])?p[field]:[p[field]]).filter(Boolean).flatMap(x=>String(x).split(/\s*\/\s*/)).map(x=>x.trim()).filter(Boolean);
  for(const id of ids)assert(m.systems.some(s=>s.id===id&&s.roles.includes(role)),p.id+':'+field+':'+id);
 }
 assert.equal(new Set(m.systems.map(x=>x.id)).size,m.systems.length);
 for(const [field,role] of [['inputs','Input'],['outputs','Output'],['documentIds','Document touchpoint']])for(const id of p[field]||[])assert(m.objects.some(o=>o.id===id&&o.roles.includes(role)));
 for(const limit of [3,4,5])for(const collection of [m.related,m.systems,m.objects]){
  const w=densityWindow(collection,limit);assert.deepEqual([...w.visible,...w.remaining],collection);assert.equal(w.total,collection.length);
 }
 cases++;
}
const ltl06=relationshipModel(module,'LTL-06');
assert.equal(ltl06.related.length,9);
assert.deepEqual(ltl06.systems.find(s=>s.id==='sys-wms').roles,['Producer','Authority']);
assert.equal(ltl06.systems.length,5);
for(const count of [0,1,2,3,4,5,6,10,100]){
 const base={id:'ROOT',pathType:'STANDARD',inputs:['obj-shared'],producer:'sys-test'};
 const related=Array.from({length:count},(_,i)=>({id:'P'+i,label:'Process '+i,pathType:'CONDITIONAL',inputs:['obj-shared']}));
 const graph={processes:[base,...related],processFlowEdges:[]};
 const model=relationshipModel(graph,'ROOT');assert.equal(model.related.length,count);
 const permuted=relationshipModel({...graph,processes:[...graph.processes].reverse()},'ROOT');assert.deepEqual(model.related,permuted.related);
 if(count){assert.equal(relationshipModel({...graph,processes:graph.processes.slice(0,-1)},'ROOT').related.length,count-1);}
 assert.equal(relationshipModel({...graph,processes:[...graph.processes,{id:'ADDED',pathType:'EXCEPTION',inputs:['obj-shared']}]},'ROOT').related.length,count+1);
 for(const limit of [3,4,5]){const w=densityWindow(model.related,limit);assert.equal(w.visible.length+w.remaining.length,count);}
}
assert.deepEqual(systemRoles({producer:'sys-one',authoritySystem:'sys-one',consumers:['sys-one','sys-two']}),[
 {id:'sys-one',roles:['Producer','Authority','Consumer'],fields:['producer','authoritySystem','consumers']},
 {id:'sys-two',roles:['Consumer'],fields:['consumers']}
]);
assert.throws(()=>relationshipModel(module,'UNKNOWN'),/absent/);
console.log(`PASS: ${cases} real tasks all systems/roles/objects retained; LTL06 9 related + 5 unique systems; boundaries0/1/2/3/4/5/6/10/100; add/remove/reorder; multi-role identity; unknown fails closed`);
