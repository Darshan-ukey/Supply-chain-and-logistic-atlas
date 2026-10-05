import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
  deriveRoadLtl15Plan,
  materializeRoadLtl15Runtime,
  failClosedRoadLtl15Runtime
} from '../assets/atl-181-road-ltl-current-truth.mjs';

const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const registry=read('governance/presentation/p2-projection-source-registry.json');
const module15=read('data/modules/road-ltl-v1.5.json');
const operational15=read('data/operational-knowledge/road-ltl-v1.5-operational.json');
let pass=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);pass+=1};
const rejects=(fn,re,msg)=>{assert.throws(fn,re,msg);pass+=1};

const plan=deriveRoadLtl15Plan({registry,module15,operational15});
ok(plan.changedTaskIds.length===1&&plan.changedTaskIds[0]==='LTL-03','only governed changed task LTL-03 is materialized');
ok(plan.override.id==='LTL-03'&&plan.override.identityPreservedFromBase===true,'LTL-03 identity is preserved');
ok(plan.operational.taskId==='LTL-03','operational knowledge binds exact changed task');

const baseRuntime={
  module:{id:'road-ltl',version:'V1.2'},
  processes:[
    {id:'LTL-02',trigger:'unchanged-two',rule:'unchanged-rule'},
    {id:'LTL-03',label:'Create and validate shipment, consignment and transport-document identity',trigger:'legacy-trigger',before:'legacy-before',event:'legacy-event',decision:'legacy-decision',rule:'legacy-rule',control:'legacy-control',clock:'legacy-clock',action:'legacy-action',evidence:'legacy-evidence',after:'legacy-after',outcome:'legacy-outcome'}
  ]
};
const runtime=structuredClone(baseRuntime);
const result=materializeRoadLtl15Runtime({runtimeModule:runtime,plan});
const p=runtime.processes.find(x=>x.id==='LTL-03');
ok(result.taskId==='LTL-03'&&result.semanticVersion==='1.5','materializer returns exact semantic target');
for(const key of ['trigger','before','event','decision','rule','control','clock','action','evidence','after','outcome']){
  ok(p[key]===plan.override[key],`LTL-03 ${key} equals governed 1.5 override`);
}
ok(p.operationalKnowledge.businessMeaning===plan.operational.businessMeaning,'operational knowledge comes from governed v1.5 payload');
ok(p.atlasSemanticSource==='road-ltl@1.5'&&p.atlasSemanticState==='GOVERNED_CURRENT','consumer marks exact semantic source/state');
ok(runtime.processes.find(x=>x.id==='LTL-02').trigger==='unchanged-two','unchanged process remains regression-identical');
ok(runtime.module.version==='V1.2','adapter does not rewrite structural Canvas module version; version handoff remains separate RP-04 concern');

const deleted=structuredClone(baseRuntime);
const closed=failClosedRoadLtl15Runtime({runtimeModule:deleted,reason:'test deletion'});
const pd=deleted.processes.find(x=>x.id==='LTL-03');
ok(closed.state==='UNRESOLVED_FAIL_CLOSED','missing governed override produces explicit unresolved state');
for(const key of ['trigger','before','event','decision','rule','control','clock','action','evidence','after','outcome']){
  ok(pd[key]===null,`fail-closed deletion clears stale ${key}`);
}
ok(pd.atlasSemanticState==='UNRESOLVED_FAIL_CLOSED'&&pd.atlasSemanticError==='test deletion','fail-closed reason is explicit');
ok(deleted.processes.find(x=>x.id==='LTL-02').trigger==='unchanged-two','deletion handling leaves unchanged process intact');

{
  const x=structuredClone(module15);x.materializationPolicy.changedTaskIds=['LTL-03','LTL-04'];
  rejects(()=>deriveRoadLtl15Plan({registry,module15:x,operational15}),/Unexpected Road LTL 1.5 changed-task set/,'unexpected changed-task expansion fails closed');
}
{
  const x=structuredClone(module15);x.taskOverrides=[];
  rejects(()=>deriveRoadLtl15Plan({registry,module15:x,operational15}),/override missing/,'missing changed-task override fails closed');
}
{
  const x=structuredClone(operational15);x.taskOperationalKnowledge=[];
  rejects(()=>deriveRoadLtl15Plan({registry,module15,operational15:x}),/operational knowledge missing/,'missing operational knowledge fails closed');
}
{
  const x=structuredClone(registry);x.sources.find(y=>y.sourceKey==='road-ltl@1.5').moduleVersion='1.4';
  rejects(()=>deriveRoadLtl15Plan({registry:x,module15,operational15}),/source registry entry missing/,'wrong governed source version fails closed');
}

const rootBlob=execFileSync('git',['rev-parse','HEAD:index.html'],{encoding:'utf8'}).trim();
ok(rootBlob==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','certified root remains byte-identical');
const p2Blob=execFileSync('git',['rev-parse','HEAD:governance/presentation/p2-projection-source-registry.json'],{encoding:'utf8'}).trim();
ok(p2Blob==='cfb870a6897c437376ff35f79d1e9fecd7a65d29','governed P2 source registry remains byte-identical');

console.log(`ATL-181 RP-03 Road LTL current-truth reconciliation: ${pass}/${pass} PASS`);
