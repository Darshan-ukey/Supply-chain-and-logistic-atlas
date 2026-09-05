export const CANVAS_DAUGHTER_BRIDGE_VERSION='2.0.1';
export const TARGET_REGISTRY_PATH='/governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json';
export const DAUGHTER_ROUTE='/daughter';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function buildDaughterHref({moduleId,moduleVersion,taskId},route=DAUGHTER_ROUTE){
  if(!moduleId||!moduleVersion||!taskId)return null;
  const q=new URLSearchParams({moduleId:String(moduleId),moduleVersion:String(moduleVersion),taskId:String(taskId)});
  return `${route}?${q.toString()}`;
}

export function resolveDaughterTarget(registry,moduleId){
  if(!registry?.targets||!moduleId)return null;
  const t=registry.targets[moduleId];
  if(!t||t.moduleId!==moduleId||!t.daughterModuleVersion)return null;
  return t;
}

export function selectionForCanvasState(registry,state){
  const moduleId=state?.activeModule||state?.module?.module?.id||null;
  const taskId=state?.selectedProcess||null;
  const target=resolveDaughterTarget(registry,moduleId);
  if(!target||!taskId)return null;
  return {
    moduleId:target.moduleId,
    moduleVersion:target.daughterModuleVersion,
    taskId,
    targetStatus:target.targetStatus||'GOVERNED_TARGET',
    canvasBaselineVersion:target.canvasBaselineVersion||null
  };
}

export function bridgeMarkup(selection){
  if(!selection)return'';
  const href=buildDaughterHref(selection);
  if(!href)return'';
  const status=String(selection.targetStatus||'GOVERNED_TARGET').replaceAll('_',' ');
  return `<div class="ins-section atlas-p4-depth" id="atlasP4DepthBridge" data-bridge-version="${CANVAS_DAUGHTER_BRIDGE_VERSION}"><h3>Execution depth</h3><div class="atlas-p4-depth-card"><div><b>Governed Daughter target</b><span>${esc(selection.moduleId)} · ${esc(selection.moduleVersion)} · ${esc(selection.taskId)}</span><small>${esc(status)}</small></div><a class="atlas-p4-depth-action" href="${esc(href)}" data-atlas-daughter-handoff="true">Open Operational Knowledge & readiness →</a></div><p class="atlas-p4-depth-note">Full Work Decomposition and WorkDefinition remain protected. Canvas does not preload protected execution detail.</p></div>`;
}

function installStyle(){
  if(document.getElementById('atlasP4DepthStyle'))return;
  const s=document.createElement('style');s.id='atlasP4DepthStyle';
  s.textContent=`.atlas-p4-depth-card{border:1px solid #b9d9df;background:linear-gradient(135deg,#eff9fa,#fff);border-radius:10px;padding:10px;display:grid;gap:9px}.atlas-p4-depth-card b{display:block;font-size:10px;color:#254b58}.atlas-p4-depth-card span{display:block;font:800 8.5px ui-monospace;color:#0d7f98;margin-top:3px}.atlas-p4-depth-card small{display:block;color:#758990;font-size:8px;margin-top:3px}.atlas-p4-depth-action{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:8px;background:#0d8199;color:#fff!important;padding:8px 10px;font:800 8.5px ui-monospace;letter-spacing:.02em}.atlas-p4-depth-note{font-size:8.5px;line-height:1.45;color:#6e8188;margin:7px 1px 0}`;
  document.head.appendChild(s);
}

async function loadRegistry(fetchImpl=globalThis.fetch){
  if(typeof fetchImpl!=='function')throw new Error('Fetch unavailable for P4 target registry.');
  const r=await fetchImpl(TARGET_REGISTRY_PATH,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`P4 target registry unavailable (${r.status}).`);
  const d=await r.json();
  if(d?.status!=='ACTIVE_P4_INTEGRATION_CONTRACT')throw new Error('P4 target registry is not active.');
  return d;
}

export function decorateCanvasInspector(registry,state=globalThis.S){
  const body=document.getElementById('inspectorBody');
  if(!body)return false;
  body.querySelector('#atlasP4DepthBridge')?.remove();
  const selection=selectionForCanvasState(registry,state);
  if(!selection)return false;
  body.insertAdjacentHTML('beforeend',bridgeMarkup(selection));
  return true;
}

export async function bootCanvasDaughterBridge({fetchImpl=globalThis.fetch}={}){
  if(typeof document==='undefined')return null;
  installStyle();
  let registry;
  try{registry=await loadRegistry(fetchImpl)}catch(e){console.warn('Atlas P4 Canvas→Daughter bridge:',e.message);return null}
  const run=()=>decorateCanvasInspector(registry,globalThis.S);
  const wait=()=>{
    const body=document.getElementById('inspectorBody');
    if(!body||!globalThis.S){setTimeout(wait,80);return}
    run();
    const observer=new MutationObserver(()=>queueMicrotask(run));
    observer.observe(body,{childList:true});
    globalThis.addEventListener?.('atlas:canvas-selection-changed',run);
    globalThis.AtlasCanvasDaughterBridge={version:CANVAS_DAUGHTER_BRIDGE_VERSION,registry,buildDaughterHref,resolveDaughterTarget,selectionForCanvasState,refresh:run,observer};
  };
  wait();
  return registry;
}

if(typeof window!=='undefined'&&typeof document!=='undefined')bootCanvasDaughterBridge();
