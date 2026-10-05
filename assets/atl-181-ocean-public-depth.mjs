// ATL-181 RP-02: bounded Ocean public-depth publication reconciliation.
// Purpose: reconcile stale inline root publication state with the governed P4/P2 contracts
// without fabricating Ocean 0.6 full-module semantics. Canvas continues to use the certified
// 0.5 navigation baselines; selected task handoff is routed by the existing P4 bridge to
// the exact approved Ocean 0.6 Daughter target.

export const OCEAN_PUBLIC_DEPTH_IDS=Object.freeze(['ocean-fcl','ocean-lcl']);
export const CONTRACT_PATHS=Object.freeze({
  targets:'/governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json',
  projections:'/governance/presentation/p2-projection-source-registry.json',
  registry:'/data/atlas-registry.json',
  catalog:'/data/module-catalog.json'
});

const clone=x=>JSON.parse(JSON.stringify(x));
const sourceKey=(id,version)=>`${id}@${version}`;

export function deriveOceanPublicationPlan({targets,projections,registry,catalog}){
  if(targets?.status!=='ACTIVE_P4_INTEGRATION_CONTRACT')throw new Error('P4 target registry is not active');
  if(projections?.status!=='ACTIVE_IMPLEMENTATION_CONTRACT')throw new Error('P2 projection registry is not active');
  const out=[];
  for(const id of OCEAN_PUBLIC_DEPTH_IDS){
    const target=targets?.targets?.[id];
    const reg=(registry?.items||[]).find(x=>x.id===id);
    const cat=(catalog?.modules||[]).find(x=>x.id===id);
    if(!target||target.moduleId!==id)throw new Error(`${id}: governed P4 target missing`);
    if(target.targetStatus!=='APPROVED_PRODUCTION_GO_LIVE_TARGET')throw new Error(`${id}: target is not approved for go-live`);
    if(target.productionCutover!=='PENDING_P4_INTEGRATION_AND_DEPLOYMENT_SMOKE')throw new Error(`${id}: unexpected production-cutover state`);
    if(target.deployBaselineFirst!==false)throw new Error(`${id}: historical baseline must not be deployed first`);
    if(!reg||reg.status!=='ACTIVE'||reg.depth!=='A5_VERIFIED')throw new Error(`${id}: governed registry is not ACTIVE/A5_VERIFIED`);
    if(!cat||cat.publicationState!=='ACTIVE'||cat.approved!==true)throw new Error(`${id}: Canvas baseline catalog entry is not approved ACTIVE`);
    if(String(cat.version)!==String(target.canvasBaselineVersion))throw new Error(`${id}: Canvas baseline version does not match P4 target contract`);
    const src=(projections?.sources||[]).find(x=>x.sourceKey===sourceKey(id,target.daughterModuleVersion));
    if(!src||src.moduleId!==id||String(src.moduleVersion)!==String(target.daughterModuleVersion)||src.materialized!==true){
      throw new Error(`${id}: exact Daughter target is not materialized in P2`);
    }
    if(src.sourceProfile!=='FROZEN_DAUGHTER_OKV1_PRECOMPILED_PUBLIC_SAFE')throw new Error(`${id}: unexpected public projection profile`);
    out.push(Object.freeze({
      id,
      registry:clone(reg),
      canvasBaseline:clone(cat),
      daughterVersion:String(target.daughterModuleVersion),
      targetStatus:target.targetStatus,
      projectionSourceKey:src.sourceKey
    }));
  }
  return Object.freeze(out);
}

const replaceById=(rows,row)=>{
  const i=rows.findIndex(x=>x.id===row.id);
  if(i<0)throw new Error(`${row.id}: destination row missing from root registry state`);
  rows.splice(i,1,clone(row));
};
const upsertById=(rows,row)=>{
  const i=rows.findIndex(x=>x.id===row.id);
  if(i<0)rows.push(clone(row));
  else rows.splice(i,1,clone(row));
};

export function applyOceanPublicationPlan({state,loader,plan}){
  if(!state?.registry?.items||!state?.moduleCatalog?.modules)throw new Error('Atlas root state is not ready');
  if(!loader?.catalog?.modules)throw new Error('Atlas module loader is not ready');
  const touched=[];
  for(const p of plan){
    replaceById(state.registry.items,p.registry);
    // The frozen root's inline catalog omits Ocean from modules[] and leaves it in planned[].
    // Add the independently verified baseline entry rather than requiring it to pre-exist.
    upsertById(state.moduleCatalog.modules,p.canvasBaseline);
    if(Array.isArray(state.moduleCatalog.planned))state.moduleCatalog.planned=state.moduleCatalog.planned.filter(x=>x.id!==p.id);
    // AtlasModuleLoader.catalog normally aliases S.moduleCatalog, but update independently
    // so this stays correct if a future root stops sharing the same object.
    if(loader.catalog!==state.moduleCatalog){
      upsertById(loader.catalog.modules,p.canvasBaseline);
      if(Array.isArray(loader.catalog.planned))loader.catalog.planned=loader.catalog.planned.filter(x=>x.id!==p.id);
    }
    touched.push(p.id);
  }
  return Object.freeze({touched:Object.freeze(touched),count:touched.length});
}

async function readJson(path,fetchImpl){
  const r=await fetchImpl(path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

export async function reconcileOceanPublicDepth({fetchImpl=globalThis.fetch,state=globalThis.S,loader=globalThis.AtlasModuleLoader}={}){
  if(typeof fetchImpl!=='function')throw new Error('Fetch unavailable');
  const [targets,projections,registry,catalog]=await Promise.all([
    readJson(CONTRACT_PATHS.targets,fetchImpl),
    readJson(CONTRACT_PATHS.projections,fetchImpl),
    readJson(CONTRACT_PATHS.registry,fetchImpl),
    readJson(CONTRACT_PATHS.catalog,fetchImpl)
  ]);
  const plan=deriveOceanPublicationPlan({targets,projections,registry,catalog});
  const result=applyOceanPublicationPlan({state,loader,plan});
  globalThis.renderRegistry?.();
  globalThis.dispatchEvent?.(new CustomEvent('atlas:ocean-public-depth-reconciled',{detail:{modules:[...result.touched]}}));
  return Object.freeze({plan,result});
}

export function bootOceanPublicDepth(){
  if(typeof document==='undefined')return;
  let attempts=0;
  const wait=async()=>{
    attempts+=1;
    if(!globalThis.S?.registry?.items||!globalThis.AtlasModuleLoader?.catalog?.modules){
      if(attempts<150)setTimeout(wait,80);
      else console.warn('Atlas RP-02 Ocean reconciliation: root state unavailable');
      return;
    }
    try{
      const out=await reconcileOceanPublicDepth();
      globalThis.AtlasOceanPublicDepth={status:'RECONCILED',modules:[...out.result.touched],plan:out.plan};
    }catch(e){
      globalThis.AtlasOceanPublicDepth={status:'BLOCKED',error:e.message};
      console.warn('Atlas RP-02 Ocean reconciliation:',e.message);
    }
  };
  wait();
}

if(typeof window!=='undefined'&&typeof document!=='undefined')bootOceanPublicDepth();
