export const UNIVERSAL_DAUGHTER_RENDERER_VERSION='2.0.0';
export const PUBLIC_PROJECTION_ENDPOINT='/api/execution-depth-projection';
export const DEPTHS=Object.freeze([
  {id:'overview',label:'Overview',protected:false},
  {id:'operational-knowledge',label:'Operational Knowledge',protected:false},
  {id:'execution-readiness',label:'Execution Readiness',protected:false},
  {id:'work-decomposition',label:'Work Decomposition',protected:true},
  {id:'work-definition',label:'WorkDefinition',protected:true}
]);

export function escapeHtml(value){
  return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
const esc=escapeHtml;
const text=value=>value===null||value===undefined||value===''?'Not stated':esc(value);
const array=value=>Array.isArray(value)?value:[];
const titleCase=value=>String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const badge=(value,kind='neutral')=>`<span class="udr-badge ${kind}">${text(titleCase(value||'UNKNOWN'))}</span>`;
const pills=values=>array(values).length?`<div class="udr-pills">${array(values).map(v=>`<span>${text(v)}</span>`).join('')}</div>`:'<div class="udr-empty">Not stated</div>';
const list=values=>array(values).length?`<ul>${array(values).map(v=>`<li>${text(v)}</li>`).join('')}</ul>`:'<div class="udr-empty">Not stated</div>';
const kv=(pairs)=>`<div class="udr-kv">${pairs.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${text(v)}</strong></div>`).join('')}</div>`;

export function parseDaughterSelection(search=''){
  const q=new URLSearchParams(String(search||'').replace(/^\?/,''));
  const moduleId=q.get('moduleId')||'';
  const moduleVersion=q.get('moduleVersion')||'';
  const taskId=q.get('taskId')||'';
  return {moduleId,moduleVersion,taskId,complete:Boolean(moduleId&&moduleVersion&&taskId)};
}

export async function fetchPublicProjection(selection,{fetchImpl=globalThis.fetch}={}){
  if(!selection?.moduleId||!selection?.moduleVersion||!selection?.taskId){
    const e=new Error('A published moduleId, moduleVersion and taskId are required.');e.code='INCOMPLETE_SELECTION';throw e;
  }
  if(typeof fetchImpl!=='function'){const e=new Error('Fetch is unavailable.');e.code='FETCH_UNAVAILABLE';throw e;}
  const query=new URLSearchParams({moduleId:selection.moduleId,moduleVersion:selection.moduleVersion,taskId:selection.taskId});
  const response=await fetchImpl(`${PUBLIC_PROJECTION_ENDPOINT}?${query.toString()}`,{headers:{Accept:'application/json'},credentials:'same-origin'});
  let payload=null;try{payload=await response.json()}catch{}
  if(!response.ok||!payload?.ok||!payload?.projection){
    const e=new Error(payload?.error||`Execution-depth presentation is not published for this exact selection (${response.status}).`);
    e.status=response.status;e.code='PROJECTION_UNAVAILABLE';throw e;
  }
  return payload.projection;
}

function section(title,body,extra=''){
  return `<section class="udr-section ${extra}"><h3>${esc(title)}</h3>${body}</section>`;
}
function overviewView(p){
  const o=p?.overview||{};const t=p?.trace||{};
  return `<div class="udr-hero"><div><div class="udr-eyebrow">A5 TASK · ${text(t.taskId)}</div><h2>${text(o.title)}</h2><p>${text(o.purpose)}</p></div>${badge(o.semanticStatus,'semantic')}</div>`+
    section('Operational state',kv([['Trigger',o.trigger],['State before',o.before],['State after',o.after],['Outcome',o.outcome]]))+
    section('Canonical trace',kv([['Module',t.moduleId],['Module version',t.moduleVersion],['Canonical task',t.canonicalTaskRef],['Process concept',t.canonicalProcessConceptId],['Projection contract',t.projectionContractVersion],['Operational Knowledge',t.operationalKnowledgeContractVersion],['Information Resolution',t.informationResolutionContractVersion]]));
}
function informationResolutionView(ir={}){
  const unresolved=ir.unresolved||{};const measurement=ir.measurement||{};
  return section('Information Resolution',
    `<p class="udr-note">Canonical information is resolved before any client/runtime mapping. This view contains the safe human-readable projection only.</p>`+
    `<h4>Canonical object families</h4>${pills(ir.canonicalObjectFamilies)}`+
    `<div class="udr-two"><div><h4>Required when</h4>${list(ir.applicability?.requiredWhen)}</div><div><h4>Prohibited when</h4>${list(ir.applicability?.prohibitedWhen)}</div></div>`+
    `<h4>Resolution capabilities</h4>${pills(ir.resolutionCapabilities)}`+
    `<h4>Critical resolution summaries</h4>${array(ir.criticalResolutionSummaries).length?`<div class="udr-cards">${array(ir.criticalResolutionSummaries).map(x=>`<article><b>${text(x.fieldFamily)}</b><p>${text(x.summary)}</p></article>`).join('')}</div>`:'<div class="udr-empty">No safe summaries published</div>'}`+
    `<h4>Unresolved knowledge</h4>${kv([['Total',unresolved.total??0],...Object.entries(unresolved.countsByStatus||{}).map(([k,v])=>[titleCase(k),v])])}`+
    `<h4>Measurement integrity</h4>${kv([['Status',measurement.status],['Metric-definition pending',measurement.metricDefinitionPendingCount??0]])}${pills(measurement.targetMeasurementFamilies)}`
  );
}
function operationalKnowledgeView(p){
  const o=p?.operationalKnowledge||{};
  return `<div class="udr-hero compact"><div><div class="udr-eyebrow">GOVERNED HUMAN-READABLE PROJECTION</div><h2>Operational Knowledge</h2><p>${text(o.businessMeaning)}</p></div></div>`+
    section('Why this work exists',`<p>${text(o.why)}</p>`)+
    informationResolutionView(o.informationResolution||{})+
    section('Rule / control',kv([['Rule summary',o.ruleSummary],['Control summary',o.controlSummary]]))+
    section('Action / timing / evidence',kv([['Action summary',o.actionSummary],['Timing summary',o.timingSummary],['Evidence summary',o.evidenceSummary]]))+
    section('Client/runtime dependency',kv([['Client binding required',o.clientDependencySummary?.bindingRequired?'Yes':'No'],['Exact client values included',o.clientDependencySummary?.exactClientValuesIncluded?'Yes':'No'],['Exact runtime mappings included',o.clientDependencySummary?.exactRuntimeMappingsIncluded?'Yes':'No']]));
}
function coverageCards(coverage={}){
  const entries=Object.entries(coverage||{});
  return entries.length?`<div class="udr-cards readiness">${entries.map(([key,val])=>`<article><b>${esc(titleCase(key))}</b>${badge(val?.status||'UNKNOWN',String(val?.status||'').toLowerCase())}<p>${Number(val?.unresolvedCount||0)} unresolved</p></article>`).join('')}</div>`:'<div class="udr-empty">No coverage diagnostics published</div>';
}
function readinessView(p){
  const r=p?.executionReadiness||{};const u=r.unresolved||{};const d=r.dependencies||{};const down=r.downstream||{};
  return `<div class="udr-hero compact"><div><div class="udr-eyebrow">EXECUTION DIAGNOSTIC · NOT EXECUTOR PROOF</div><h2>Execution Readiness</h2><p>Can this A5 Operational Knowledge safely proceed toward recursive Work Decomposition and canonical WorkDefinition compilation?</p></div>${badge(r.status,String(r.status||'').toLowerCase())}</div>`+
    section('Readiness status',kv([['Overall',r.status],['Decomposition required',r.decompositionRequired?'Yes':'No'],['Decomposition status',r.decompositionStatus],['Executor readiness',r.executorReadyStatus],['Independent executor proof',r.independentExecutorProofStatus]]))+
    section('Coverage',coverageCards(r.coverage||{}))+
    section('Unresolved',kv([['Operational knowledge',u.operationalKnowledgeCount??0],['Source/context pending',u.sourceContextPendingCount??0],['Client binding',u.clientBindingCount??0],['Metric definition pending',u.metricDefinitionPendingCount??0],['Unknown',u.unknownCount??0]]))+
    section('Dependencies',kv([['Human review / HITL',d.hitlRequired?'Required/possible':'Not indicated'],['System action',d.systemActionRequired?'Required':'Not indicated'],['Client binding',d.clientBindingRequired?'Required':'Not indicated']]))+
    section('Downstream protected assets',kv([['Work Decomposition',down.workDecompositionStatus],['WorkDefinition',down.workDefinitionStatus]]));
}
function protectedView(p,type){
  const isWd=type==='work-definition';
  const source=isWd?p?.protectedExecution?.workDefinition:p?.protectedExecution?.workDecomposition;
  const label=isWd?'WorkDefinition':'Work Decomposition';
  return `<div class="udr-protected"><div class="udr-lock" aria-hidden="true">⌾</div><div class="udr-eyebrow">PROTECTED EXECUTION IP</div><h2>${label}</h2><p>The public Daughter receives status only. Full ${label} detail is fetched only by a separately authorized execution surface and is never preloaded here.</p>${badge(source?.status||'NOT_AVAILABLE','protected')}<div class="udr-protected-facts">${kv([['Detail included in this browser',source?.detailIncluded?'Yes':'No'],['Authorization boundary','Separate protected capability required']])}</div><button class="udr-authorized-intent" type="button" data-protected-intent="${esc(type)}">Open authorized execution surface</button></div>`;
}

export function renderDepth(projection,depthId){
  switch(depthId){
    case 'overview':return overviewView(projection);
    case 'operational-knowledge':return operationalKnowledgeView(projection);
    case 'execution-readiness':return readinessView(projection);
    case 'work-decomposition':return protectedView(projection,'work-decomposition');
    case 'work-definition':return protectedView(projection,'work-definition');
    default:return '<div class="udr-empty">Unknown presentation depth</div>';
  }
}
export function renderShell(projection,activeDepth='overview'){
  const safeDepth=DEPTHS.some(x=>x.id===activeDepth)?activeDepth:'overview';
  return `<div class="udr-root" data-renderer-version="${UNIVERSAL_DAUGHTER_RENDERER_VERSION}"><div class="udr-tabs" role="tablist" aria-label="A5 execution depth">${DEPTHS.map(d=>`<button type="button" role="tab" aria-selected="${d.id===safeDepth?'true':'false'}" class="${d.id===safeDepth?'active':''} ${d.protected?'protected':''}" data-depth="${d.id}">${d.protected?'<span aria-hidden="true">⌾</span> ':''}${esc(d.label)}</button>`).join('')}</div><div class="udr-panel" role="tabpanel" data-active-depth="${safeDepth}">${renderDepth(projection,safeDepth)}</div></div>`;
}
export function renderUnavailable(message='Execution-depth presentation is not published for this exact version/task.'){
  return `<div class="udr-state"><div class="udr-eyebrow">FAIL-CLOSED PRESENTATION BOUNDARY</div><h2>Execution depth unavailable</h2><p>${text(message)}</p><p>No alternate Daughter version has been substituted.</p></div>`;
}

export function attachRendererInteractions(mount,projection){
  mount.querySelectorAll('[data-depth]').forEach(btn=>btn.addEventListener('click',()=>{
    const depth=btn.dataset.depth;
    mount.innerHTML=renderShell(projection,depth);
    attachRendererInteractions(mount,projection);
  }));
  mount.querySelectorAll('[data-protected-intent]').forEach(btn=>btn.addEventListener('click',()=>{
    mount.dispatchEvent(new CustomEvent('atlas:protected-execution-request',{bubbles:true,detail:{type:btn.dataset.protectedIntent,trace:projection?.trace||{}}}));
  }));
}

export async function bootUniversalDaughterRendererV2({mount,selection,fetchImpl=globalThis.fetch}={}){
  const target=typeof mount==='string'?document.querySelector(mount):mount;
  if(!target)throw new Error('Universal Daughter Renderer mount not found.');
  const chosen=selection||parseDaughterSelection(globalThis.location?.search||'');
  target.innerHTML='<div class="udr-state"><div class="udr-spinner" aria-hidden="true"></div><h2>Loading governed execution depth…</h2></div>';
  try{
    const projection=await fetchPublicProjection(chosen,{fetchImpl});
    target.innerHTML=renderShell(projection,'overview');
    attachRendererInteractions(target,projection);
    return projection;
  }catch(error){
    target.innerHTML=renderUnavailable(error?.message);
    return null;
  }
}
