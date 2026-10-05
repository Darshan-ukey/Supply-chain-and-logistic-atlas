import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {deriveOceanPublicationPlan,applyOceanPublicationPlan,OCEAN_PUBLIC_DEPTH_IDS,normalizeOceanProfileModule,installOceanProfileCompatibility} from '../assets/atl-181-ocean-public-depth.mjs';

const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const targets=read('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json');
const projections=read('governance/presentation/p2-projection-source-registry.json');
const registry=read('data/atlas-registry.json');
const catalog=read('data/module-catalog.json');
let pass=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);pass+=1};
const rejects=(fn,re,msg)=>{assert.throws(fn,re,msg);pass+=1};

const profileContract='atlas-data-contract-v1.1 + daughter-quality-profile-v1';
const oceanProfile={module:{id:'ocean-fcl'},contractVersion:profileContract,payload:'preserved'};
const normalizedProfile=normalizeOceanProfileModule(oceanProfile);
ok(normalizedProfile!==oceanProfile,'Ocean profile normalization clones rather than mutates canonical input');
ok(normalizedProfile.contractVersion==='atlas-data-contract-v1.1','Ocean profile normalizes only to the governed v1.1 base contract');
ok(normalizedProfile.atlasOriginalContractVersion===profileContract,'Ocean profile retains the exact original profile contract marker');
ok(normalizeOceanProfileModule({module:{id:'road-ltl'},contractVersion:'atlas-data-contract-v1.1'}).contractVersion==='atlas-data-contract-v1.1','ordinary Road v1.1 remains unchanged');
const fakeLoader={
  validateRuntime(mod){return {ok:mod?.contractVersion==='atlas-data-contract-v1.1',seen:mod?.contractVersion}},
  compose(mod){return {contractVersion:mod?.contractVersion,original:mod?.atlasOriginalContractVersion||null}}
};
const compat=installOceanProfileCompatibility(fakeLoader);
ok(compat.installed===true&&compat.baseContract==='atlas-data-contract-v1.1','Ocean loader compatibility installs against v1.1 base only');
ok(fakeLoader.validateRuntime(oceanProfile).ok===true,'Ocean quality-profile module is accepted through the bounded compatibility adapter');
const composedProfile=fakeLoader.compose(oceanProfile);
ok(composedProfile.contractVersion==='atlas-data-contract-v1.1'&&composedProfile.original===profileContract,'compose path preserves original Ocean profile provenance while using the v1.1 base');
ok(fakeLoader.validateRuntime({module:{id:'air-cargo'},contractVersion:profileContract}).ok===false,'non-Ocean profile is not broadened by the bounded adapter');
ok(installOceanProfileCompatibility(fakeLoader)===compat,'Ocean loader compatibility installation is idempotent');
const plan=deriveOceanPublicationPlan({targets,projections,registry,catalog});
ok(plan.length===2,'exactly two Ocean publication targets are reconciled');
ok(plan.map(x=>x.id).join(',')===OCEAN_PUBLIC_DEPTH_IDS.join(','),'only governed Ocean module ids are included');
for(const p of plan){
  ok(p.canvasBaseline.version==='0.5',`${p.id}: Canvas baseline remains 0.5`);
  ok(p.canvasBaseline.publicationState==='ACTIVE'&&p.canvasBaseline.approved===true,`${p.id}: baseline is approved ACTIVE`);
  ok(p.daughterVersion==='0.6',`${p.id}: Daughter target is exact 0.6`);
  ok(p.targetStatus==='APPROVED_PRODUCTION_GO_LIVE_TARGET',`${p.id}: target carries governed go-live status`);
  ok(p.projectionSourceKey===`${p.id}@0.6`,`${p.id}: exact materialized projection source is selected`);
}

const staleRegistry={
  items:[
    {id:'road-ltl',name:'Road LTL',family:'Mode & Service Execution Models',status:'ACTIVE',depth:'A5_VERIFIED'},
    {id:'ocean-fcl',name:'Ocean FCL',family:'Mode & Service Execution Models',status:'PLANNED',depth:'REFERENCE_ONLY'},
    {id:'ocean-lcl',name:'Ocean LCL',family:'Mode & Service Execution Models',status:'PLANNED',depth:'REFERENCE_ONLY'}
  ]
};
const staleCatalog={
  modules:[{id:'road-ltl',registryId:'road-ltl',version:'1.2',publicationState:'ACTIVE',approved:true}],
  planned:[{id:'ocean-fcl',status:'PLANNED',depth:'REFERENCE_ONLY'},{id:'ocean-lcl',status:'PLANNED',depth:'REFERENCE_ONLY'}]
};
const state={registry:structuredClone(staleRegistry),moduleCatalog:structuredClone(staleCatalog)};
const loader={catalog:structuredClone(staleCatalog)};
const roadBefore=JSON.stringify(state.registry.items.find(x=>x.id==='road-ltl'));
const result=applyOceanPublicationPlan({state,loader,plan});
ok(result.count===2,'two Ocean rows are touched');
ok(JSON.stringify(state.registry.items.find(x=>x.id==='road-ltl'))===roadBefore,'Road registry state remains byte-equivalent in the simulation');
for(const id of OCEAN_PUBLIC_DEPTH_IDS){
  const r=state.registry.items.find(x=>x.id===id);
  const s=state.moduleCatalog.modules.find(x=>x.id===id);
  const l=loader.catalog.modules.find(x=>x.id===id);
  ok(r?.status==='ACTIVE'&&r?.depth==='A5_VERIFIED',`${id}: stale root registry is reconciled to governed publication state`);
  ok(s?.version==='0.5'&&s?.publicationState==='ACTIVE'&&s?.approved===true,`${id}: certified 0.5 Canvas baseline is upserted`);
  ok(l?.version==='0.5'&&l?.publicationState==='ACTIVE'&&l?.approved===true,`${id}: loader catalog receives the same governed baseline`);
  ok(!state.moduleCatalog.planned.some(x=>x.id===id),`${id}: stale planned marker is removed from state catalog`);
  ok(!loader.catalog.planned.some(x=>x.id===id),`${id}: stale planned marker is removed from loader catalog`);
}

const mutate=x=>structuredClone(x);
{
  const x=mutate(targets);x.targets['ocean-fcl'].daughterModuleVersion='0.5';
  rejects(()=>deriveOceanPublicationPlan({targets:x,projections,registry,catalog}),/exact Daughter target is not materialized/,'wrong Daughter version fails closed');
}
{
  const x=mutate(targets);x.targets['ocean-fcl'].canvasBaselineVersion='0.6';
  rejects(()=>deriveOceanPublicationPlan({targets:x,projections,registry,catalog}),/Canvas baseline version does not match/,'wrong Canvas baseline fails closed');
}
{
  const x=mutate(targets);x.targets['ocean-lcl'].targetStatus='FROZEN_EXECUTION_REFERENCE_CANDIDATE';
  rejects(()=>deriveOceanPublicationPlan({targets:x,projections,registry,catalog}),/not approved for go-live/,'non-approved target fails closed');
}
{
  const x=mutate(projections);x.sources.find(y=>y.sourceKey==='ocean-fcl@0.6').materialized=false;
  rejects(()=>deriveOceanPublicationPlan({targets,projections:x,registry,catalog}),/exact Daughter target is not materialized/,'non-materialized 0.6 source fails closed');
}
{
  const x=mutate(catalog);x.modules.find(y=>y.id==='ocean-lcl').publicationState='PLANNED';
  rejects(()=>deriveOceanPublicationPlan({targets,projections,registry,catalog:x}),/Canvas baseline catalog entry is not approved ACTIVE/,'inactive Canvas baseline fails closed');
}
{
  const x=mutate(registry);x.items.find(y=>y.id==='ocean-fcl').status='PLANNED';
  rejects(()=>deriveOceanPublicationPlan({targets,projections,registry:x,catalog}),/governed registry is not ACTIVE\/A5_VERIFIED/,'stale external registry fails closed');
}

const shell=fs.readFileSync(new URL('../execution/ui/runtime-access-shell.js',import.meta.url),'utf8');
ok(shell.includes("import('/assets/atl-181-ocean-public-depth.mjs')"),'runtime shell bootstraps the RP-02 reconciler');
const rootBlob=execFileSync('git',['rev-parse','HEAD:index.html'],{encoding:'utf8'}).trim();
ok(rootBlob==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','frozen root remains byte-identical to S8-6');
const bridgeBlob=execFileSync('git',['rev-parse','HEAD:assets/canvas-daughter-bridge-v2.0.1.mjs'],{encoding:'utf8'}).trim();
ok(bridgeBlob==='264e4ed26f112845bd4afb3d1e990138971d13fe','certified P4 bridge remains byte-identical');

console.log(`ATL-181 RP-02 Ocean public-depth reconciliation: ${pass}/${pass} PASS`);
