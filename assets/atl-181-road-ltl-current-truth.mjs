// ATL-181 RP-03: bounded Road LTL 1.5 semantic-consumption reconciliation.
// Frozen root remains byte-identical. This adapter materializes only the governed changed-task
// overlay declared by the active P2 source registry. Missing/invalid changed-task truth fails closed.

const SOURCE_REGISTRY='/governance/presentation/p2-projection-source-registry.json';
const SOURCE_KEY='road-ltl@1.5';
const EXPECTED_PROFILE='DAUGHTER_OVERLAY_PLUS_OPERATIONAL_KNOWLEDGE_V2';
const SEMANTIC_FIELDS=Object.freeze([
  'label','a5ContractId','canonicalProcessConceptId','trigger','before','event','decision',
  'rule','control','clock','action','evidence','after','outcome','operationalKnowledgeV2',
  'executionReadiness','downstreamRegressionRequired'
]);
const clone=x=>JSON.parse(JSON.stringify(x));

async function readJson(path,fetchImpl){
  const r=await fetchImpl(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

export function deriveRoadLtl15Plan({registry,module15,operational15}){
  if(registry?.status!=='ACTIVE_IMPLEMENTATION_CONTRACT')throw new Error('P2 source registry is not active');
  const source=(registry.sources||[]).find(x=>x.sourceKey===SOURCE_KEY);
  if(!source||source.moduleId!=='road-ltl'||String(source.moduleVersion)!=='1.5')throw new Error('Road LTL 1.5 source registry entry missing');
  if(source.sourceProfile!==EXPECTED_PROFILE||source.materialized!==true)throw new Error('Road LTL 1.5 source profile/materialization invalid');
  if(source.modulePath!=='data/modules/road-ltl-v1.5.json'||source.operationalKnowledgePath!=='data/operational-knowledge/road-ltl-v1.5-operational.json')throw new Error('Road LTL 1.5 governed source paths changed');
  if(module15?.moduleId!=='road-ltl'||String(module15?.version)!=='1.5')throw new Error('Road LTL 1.5 module identity mismatch');
  if(module15?.representation!=='LOSSLESS_VERSIONED_OVERLAY'||module15?.materializationPolicy?.preserveAllUnchangedBaseContent!==true)throw new Error('Road LTL 1.5 overlay policy invalid');
  const changed=[...(module15?.materializationPolicy?.changedTaskIds||[])];
  if(changed.length!==1||changed[0]!=='LTL-03')throw new Error('Unexpected Road LTL 1.5 changed-task set');
  const override=(module15.taskOverrides||[]).find(x=>x.id==='LTL-03');
  if(!override||override.identityPreservedFromBase!==true)throw new Error('Governed LTL-03 override missing or identity changed');
  const op=(operational15?.taskOperationalKnowledge||[]).find(x=>x.taskId==='LTL-03');
  if(operational15?.moduleId!=='road-ltl'||String(operational15?.moduleVersion)!=='1.5'||!op)throw new Error('Governed LTL-03 operational knowledge missing');
  if(op.canonicalTaskRef!==override.a5ContractId)throw new Error('LTL-03 operational/canonical task reference mismatch');
  return Object.freeze({source:clone(source),changedTaskIds:Object.freeze(changed),override:clone(override),operational:clone(op)});
}

export function materializeRoadLtl15Runtime({runtimeModule,plan}){
  if(runtimeModule?.module?.id!=='road-ltl')throw new Error('Active runtime module is not Road LTL');
  if(!Array.isArray(runtimeModule.processes))throw new Error('Road LTL runtime processes unavailable');
  const idx=runtimeModule.processes.findIndex(x=>x.id==='LTL-03');
  if(idx<0)throw new Error('Legacy structural identity LTL-03 unavailable');
  const base=runtimeModule.processes[idx];
  const next=clone(base);
  for(const key of SEMANTIC_FIELDS){
    if(Object.prototype.hasOwnProperty.call(plan.override,key))next[key]=clone(plan.override[key]);
  }
  next.operationalKnowledge=clone(plan.operational);
  next.atlasSemanticSource=SOURCE_KEY;
  next.atlasSemanticVersion='1.5';
  next.atlasSemanticState='GOVERNED_CURRENT';
  runtimeModule.processes.splice(idx,1,next);
  runtimeModule.atlasSemanticVersion='1.5';
  runtimeModule.atlasSemanticSource=SOURCE_KEY;
  return Object.freeze({taskId:'LTL-03',semanticVersion:'1.5',process:next});
}

export function failClosedRoadLtl15Runtime({runtimeModule,reason='GOVERNED_OVERRIDE_UNAVAILABLE'}){
  if(runtimeModule?.module?.id!=='road-ltl'||!Array.isArray(runtimeModule.processes))return null;
  const idx=runtimeModule.processes.findIndex(x=>x.id==='LTL-03');
  if(idx<0)return null;
  const base=runtimeModule.processes[idx],next=clone(base);
  for(const key of ['trigger','before','event','decision','rule','control','clock','action','evidence','after','outcome'])next[key]=null;
  next.operationalKnowledgeV2=null;
  next.operationalKnowledge=null;
  next.atlasSemanticSource=SOURCE_KEY;
  next.atlasSemanticVersion='1.5';
  next.atlasSemanticState='UNRESOLVED_FAIL_CLOSED';
  next.atlasSemanticError=String(reason);
  runtimeModule.processes.splice(idx,1,next);
  runtimeModule.atlasSemanticVersion='1.5';
  runtimeModule.atlasSemanticSource=SOURCE_KEY;
  return Object.freeze({taskId:'LTL-03',semanticVersion:'1.5',state:'UNRESOLVED_FAIL_CLOSED'});
}

export async function reconcileRoadLtl15Truth({fetchImpl=globalThis.fetch,state=globalThis.S,loader=globalThis.AtlasModuleLoader}={}){
  if(typeof fetchImpl!=='function')throw new Error('Fetch unavailable');
  if(!state||!loader)throw new Error('Atlas runtime state unavailable');
  const registry=await readJson(SOURCE_REGISTRY,fetchImpl);
  const source=(registry.sources||[]).find(x=>x.sourceKey===SOURCE_KEY);
  if(!source)throw new Error('Road LTL 1.5 governed source absent');
  const [module15,operational15]=await Promise.all([
    readJson('/'+source.modulePath.replace(/^\//,''),fetchImpl),
    readJson('/'+source.operationalKnowledgePath.replace(/^\//,''),fetchImpl)
  ]);
  let plan;
  try{plan=deriveRoadLtl15Plan({registry,module15,operational15});}
  catch(e){
    const road=loader.get?.('road-ltl')||state.module;
    failClosedRoadLtl15Runtime({runtimeModule:road,reason:e.message});
    globalThis.renderInspector?.();
    throw e;
  }
  const road=loader.get?.('road-ltl')||((state.activeModule==='road-ltl')?state.module:null);
  if(!road)throw new Error('Road LTL runtime module unavailable');
  const result=materializeRoadLtl15Runtime({runtimeModule:road,plan});
  if(state.activeModule==='road-ltl'||state.module===road)state.module=road;
  globalThis.renderInspector?.();
  globalThis.dispatchEvent?.(new CustomEvent('atlas:road-ltl-current-truth',{detail:{taskId:'LTL-03',semanticVersion:'1.5'}}));
  return Object.freeze({plan,result});
}

export function bootRoadLtl15Truth(){
  if(typeof document==='undefined')return;
  let attempts=0;
  const wait=async()=>{
    attempts+=1;
    if(!globalThis.S||!globalThis.AtlasModuleLoader?.get){
      if(attempts<150)setTimeout(wait,80);
      else console.warn('Atlas RP-03 current-truth reconciliation: root state unavailable');
      return;
    }
    try{
      const out=await reconcileRoadLtl15Truth();
      globalThis.AtlasRoadLtlCurrentTruth={status:'RECONCILED',taskId:out.result.taskId,semanticVersion:out.result.semanticVersion};
    }catch(e){
      globalThis.AtlasRoadLtlCurrentTruth={status:'BLOCKED',error:e.message};
      console.warn('Atlas RP-03 current-truth reconciliation:',e.message);
    }
  };
  wait();
}

if(typeof window!=='undefined'&&typeof document!=='undefined')bootRoadLtl15Truth();
