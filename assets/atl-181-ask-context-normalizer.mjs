// ATL-181 RP-04: bounded Canvas→Ask exact-context normalizer.
// Preserves the frozen root and the server-side exact-version guard. Only POST JSON requests
// to Ask Atlas are normalized from the structural Canvas baseline to the governed P4 target.

export const ASK_PATHS=Object.freeze(['api/ask-atlas','/api/ask-atlas']);
export const TARGET_REGISTRY_PATH='/governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json';
const PATCH=Symbol.for('atlas.rp04.askContextNormalizer');
const clone=x=>JSON.parse(JSON.stringify(x));

function requestPath(input){
  try{
    if(typeof input==='string')return new URL(input,globalThis.location?.origin||'http://atlas.local').pathname.replace(/^\//,'');
    if(input?.url)return new URL(input.url,globalThis.location?.origin||'http://atlas.local').pathname.replace(/^\//,'');
  }catch{}
  return null;
}
export function governedAskTarget(registry,moduleId){
  const id=String(moduleId||'').trim();
  if(registry?.status!=='ACTIVE_P4_INTEGRATION_CONTRACT'||!id)return null;
  const t=registry.targets?.[id];
  if(!t||t.moduleId!==id||!t.daughterModuleVersion)return null;
  return t;
}
export function normalizeAskBody(body,registry){
  if(!body||typeof body!=='object')return body;
  const out=clone(body);
  const state=(out.surfaceState&&typeof out.surfaceState==='object')?out.surfaceState:
              ((out.canvasState&&typeof out.canvasState==='object')?out.canvasState:null);
  if(!state)return out;
  const moduleId=state.moduleId||state.activeModule||out.canvasState?.moduleId||out.canvasState?.activeModule||null;
  const target=governedAskTarget(registry,moduleId);
  if(!target)return out;
  const prior=state.moduleVersion||state.version||out.canvasState?.moduleVersion||null;
  const version=String(target.daughterModuleVersion);
  const normalizeState=s=>{
    if(!s||typeof s!=='object')return;
    if((s.moduleId||s.activeModule||moduleId)!==moduleId)return;
    if(prior&&prior!==version)s.canvasBaselineVersion=String(prior);
    s.moduleId=moduleId;
    s.moduleVersion=version;
    if(Object.prototype.hasOwnProperty.call(s,'version'))s.version=version;
  };
  normalizeState(out.surfaceState);
  normalizeState(out.canvasState);
  out.atlasAskContext={
    ...(out.atlasAskContext||{}),
    source:'P4_GOVERNED_TARGET_REGISTRY',
    moduleId,
    moduleVersion:version,
    canvasBaselineVersion:prior&&prior!==version?String(prior):null,
    selectedProcess:state.selectedProcess||state.taskId||null
  };
  return out;
}
async function readTargets(fetchImpl){
  const r=await fetchImpl(TARGET_REGISTRY_PATH,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`P4 target registry unavailable (${r.status})`);
  const d=await r.json();
  if(d?.status!=='ACTIVE_P4_INTEGRATION_CONTRACT')throw new Error('P4 target registry is not active');
  return d;
}
export async function installAskContextNormalizer({fetchImpl=globalThis.fetch,globalObj=globalThis}={}){
  if(typeof fetchImpl!=='function')throw new Error('Fetch unavailable');
  if(globalObj[PATCH])return globalObj[PATCH];
  const registry=await readTargets(fetchImpl);
  const original=fetchImpl.bind(globalObj);
  const wrapped=async(input,init={})=>{
    const path=requestPath(input);
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    if(path==='api/ask-atlas'&&method==='POST'&&typeof init?.body==='string'){
      try{
        const parsed=JSON.parse(init.body);
        const normalized=normalizeAskBody(parsed,registry);
        init={...init,body:JSON.stringify(normalized)};
      }catch{}
    }
    return original(input,init);
  };
  globalObj.fetch=wrapped;
  const marker=Object.freeze({installed:true,registry,original,wrapped});
  Object.defineProperty(globalObj,PATCH,{value:marker,enumerable:false,configurable:false,writable:false});
  return marker;
}
export async function bootAskContextNormalizer(){
  try{
    const marker=await installAskContextNormalizer();
    globalThis.AtlasAskContextNormalizer={status:'INSTALLED',registry:marker.registry};
  }catch(e){
    globalThis.AtlasAskContextNormalizer={status:'BLOCKED',error:e.message};
    console.warn('Atlas RP-04 Ask context normalizer:',e.message);
  }
}
if(typeof window!=='undefined'&&typeof document!=='undefined')bootAskContextNormalizer();
