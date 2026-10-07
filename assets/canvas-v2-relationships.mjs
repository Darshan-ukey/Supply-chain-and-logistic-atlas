// Host presentation correction for REM-029/030. Frozen module/renderer bytes are inputs.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique = values => [...new Set(values.filter(Boolean).map(String))];
const split = value => (Array.isArray(value) ? value : [value]).filter(Boolean).flatMap(x => String(x).split(/\s*\/\s*/)).map(x => x.trim()).filter(Boolean);

export function systemRoles(process) {
  const systems = new Map();
  for (const [field, role] of [['producer','Producer'],['authoritySystem','Authority'],['consumers','Consumer']]) {
    for (const id of split(process?.[field])) {
      if (!systems.has(id)) systems.set(id, {id, roles:[], fields:[]});
      const row = systems.get(id);
      if (!row.roles.includes(role)) row.roles.push(role);
      if (!row.fields.includes(field)) row.fields.push(field);
    }
  }
  return [...systems.values()].sort((a,b) => a.id.localeCompare(b.id));
}

export function relationshipModel(module, taskId) {
  const process = module.processes?.find(p => p.id === taskId);
  if (!process) throw new Error('Task is absent from the loaded governed module: ' + taskId);
  const objectIds = unique([...(process.inputs || []), ...(process.outputs || [])]);
  const systemIds = systemRoles(process).map(s => s.id);
  const related = (module.processes || []).filter(p => p.id !== taskId && p.pathType !== 'STANDARD').map(p => {
    const edges = (module.processFlowEdges || []).filter(e => (e.from === taskId && e.to === p.id) || (e.to === taskId && e.from === p.id));
    const sharedObjects = unique([...(p.inputs || []), ...(p.outputs || [])]).filter(id => objectIds.includes(id));
    const sharedSystems = systemRoles(p).map(s => s.id).filter(id => systemIds.includes(id));
    return {id:p.id,label:p.label,type:p.pathType || 'Not stated',edges,sharedObjects,sharedSystems,
      score:(edges.length ? 10 : 0) + sharedObjects.length * 2 + sharedSystems.length};
  }).filter(p => p.score > 0).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  const objects = new Map();
  for (const [field,role] of [['inputs','Input'],['outputs','Output'],['documentIds','Document touchpoint']]) {
    for (const id of unique(process[field] || [])) {
      if (!objects.has(id)) objects.set(id,{id,roles:[],fields:[]});
      objects.get(id).roles.push(role); objects.get(id).fields.push(field);
    }
  }
  if (process.authorityObject) {
    const id = process.authorityObject;
    if (!objects.has(id)) objects.set(id,{id,roles:[],fields:[]});
    objects.get(id).roles.push('Authority object'); objects.get(id).fields.push('authorityObject');
  }
  return {taskId,process,related,systems:systemRoles(process),objects:[...objects.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    inputCount:unique(process.inputs||[]).length,outputCount:unique(process.outputs||[]).length,
    documentCount:unique(process.documentIds||[]).length,sources:unique(process.sourceIds||[])};
}

export function densityWindow(items, limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Positive visual limit required');
  return {visible:items.slice(0,limit),remaining:items.slice(limit),total:items.length};
}

export function canonicalRelationshipLabel(module, references, id) {
  const row = [...(references.systemRecords||[]),...(references.businessObjectRecords||[]),...(references.documentRecords||[]),...(module.ontologyNodes||[]),...(module.entityNodes||[])].find(x=>x.id===id);
  return row?.name || row?.label || id;
}

export function installRelationshipDisclosure(module, {sourcePath,references={}} = {}) {
  if (!sourcePath) throw new Error('Relationship source path is required');
  const style = document.createElement('link'); style.rel='stylesheet'; style.href='/assets/canvas-v2-relationships.css'; document.head.append(style);
  const label = id => canonicalRelationshipLabel(module,references,id);
  const dialog = document.createElement('dialog'); dialog.id='hostRelationshipDialog'; dialog.setAttribute('aria-labelledby','hostRelationshipTitle'); document.body.append(dialog);
  let returnFocus, currentTask, selectedTask;
  const basis = row => [
    ...row.edges.map(e=>`Declared flow: ${e.from} → ${e.to}${e.type ? ' · '+e.type : ''}`),
    row.sharedObjects.length ? 'Shared objects: '+row.sharedObjects.map(label).join(', ') : '',
    row.sharedSystems.length ? 'Shared systems: '+row.sharedSystems.map(label).join(', ') : ''
  ].filter(Boolean).join('; ');
  const list = (rows, render) => rows.length ? `<ul>${rows.map(r=>`<li>${render(r)}</li>`).join('')}</ul>` : '<p>None declared in this source.</p>';
  const section = (title, count, body) => `<details open><summary>${esc(title)}${count===null?'':' · '+count}</summary>${body}</details>`;
  function show(taskId, opener) {
    const model = relationshipModel(module,taskId), p=model.process;
    currentTask=taskId;
    if (!dialog.open) returnFocus=opener || document.activeElement;
    dialog.innerHTML=`<header><div><p>${taskId===selectedTask?'Selected task':'Related task reference · Canvas selection unchanged'}</p><h2 id="hostRelationshipTitle">${esc(taskId)} · ${esc(p.label)}</h2></div><button data-host-close aria-label="Close relationships">×</button></header>
      <div class="host-relationship-content"><p>Every declared relationship for this task is available below. Shared systems or objects show common context; they do not imply a process flow.</p><details><summary>Source and lineage</summary><p>Loaded module: <code>${esc(sourcePath)}</code>. Canonical task: <code>${esc(taskId)}</code>. Names resolve from canonical reference records; IDs and roles are unchanged.</p></details>
      ${taskId!==selectedTask?'<button data-host-return>Return to selected task</button>':''}
      ${section('Related processes',model.related.length,list(model.related,r=>`<button data-host-inspect="${esc(r.id)}">${esc(r.id)} · ${esc(r.label)}</button><p>${esc(r.type)} · ${r.edges.length?'Declared process connection':'Shared context'}</p><details><summary>Why related?</summary><p>${esc(basis(r))}</p></details>`))}
      ${section('Systems',model.systems.length,'<p>Producer provides information. Authority owns the authoritative state. Consumer uses the information. A system may serve more than one role.</p>'+list(model.systems,s=>`<strong>${esc(label(s.id))}</strong><p>${esc(s.roles.join(' · '))}</p><details><summary>Source details</summary><code>${esc(s.id)}</code><p>Source fields: ${esc(s.fields.join(', '))}</p></details>`))}
      ${section('Objects and documents',model.objects.length,`<p>${model.inputCount} inputs · ${model.outputCount} outputs · ${model.documentCount} document touchpoints. An identity can have several roles.</p>`+list(model.objects,o=>`<strong>${esc(label(o.id))}</strong> <code>${esc(o.id)}</code><p>${esc(o.roles.join(' · '))}</p><small>Source fields: ${esc(o.fields.join(', '))}</small> <button data-trace="${esc(o.id)}">Trace ${esc(label(o.id))}</button>`))}
      ${section('Actor and controls',null,`<dl><dt>Performer / actor</dt><dd>${esc(p.performer||p.actor||'Not stated')}</dd><dt>Control</dt><dd>${esc(p.control||'Not stated')}</dd><dt>Rule</dt><dd>${esc(p.rule||'Not stated')}</dd><dt>Evidence</dt><dd>${esc(p.evidence||'Not stated')}</dd></dl>`)}
      ${section('Source references',model.sources.length,list(model.sources,id=>{const s=(module.sources||[]).find(x=>x.id===id); const url=s?.url||s?.sourceUrl;return `<code>${esc(id)}</code> ${esc(s?.title||'Source title not supplied')}${/^https?:\/\//.test(url||'')?` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open source</a>`:''}`}))}
      <p>Execution-definition details remain subject to their separate authorization boundary.</p></div>`;
    if (!dialog.open) dialog.showModal();
  }
  dialog.addEventListener('click',e=>{
    if (e.target.closest('[data-host-close]')) dialog.close();
    const item=e.target.closest('[data-host-inspect]'); if(item){e.stopPropagation();show(item.dataset.hostInspect);}
    if(e.target.closest('[data-host-return]'))show(selectedTask);
    if(e.target.closest('[data-trace]'))dialog.close();
  });
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
  const overflow = (n, title) => n ? `<button class="host-overflow" data-host-all>+${n} more ${esc(title)}</button>` : '';
  const relatedCard = r => `<button class="related-card ${r.type==='EXCEPTION'?'exception':'control'}" data-host-inspect="${esc(r.id)}" title="${esc(basis(r))}"><b>${esc(r.id)} · ${esc(r.label)}</b><small>${esc(r.type)} · ${r.edges.length?'Declared flow':'Shared context'}</small></button>`;
  function refresh() {
    const id=document.getElementById('playMetaText')?.textContent.split(' · ')[0];
    if(!module.processes.some(p=>p.id===id))return;
    selectedTask=id; const model=relationshipModel(module,id);
    const depth=document.querySelector('#depthControl .active')?.dataset.depth;
    const top=document.getElementById('relatedTop'),bottom=document.getElementById('relatedBottom');
    if(top && bottom && depth!=='a2'){
      if(depth==='a3') { const w=densityWindow(model.related,4);top.innerHTML=w.visible.map(relatedCard).join('')+overflow(w.remaining.length,'related processes'); }
      else { const w=densityWindow(model.systems,3);top.innerHTML=w.visible.map(s=>`<button class="related-card system info" data-host-all title="${esc(s.id+': '+s.roles.join(', ')+'; source fields '+s.fields.join(', '))}"><b>${esc(label(s.id))}</b><small>${esc(s.roles.join(' · '))}</small></button>`).join('')+overflow(w.remaining.length,'systems'); }
      if(depth==='a4'){const w=densityWindow(model.related,3);bottom.innerHTML=w.visible.map(relatedCard).join('')+overflow(w.remaining.length,'related processes');}
      if(depth==='a5'){const w=densityWindow(model.objects,4);bottom.innerHTML=w.visible.map(o=>`<button class="related-card data" data-related="${esc(o.id)}" title="${esc(o.roles.join(', '))}"><b>${esc(label(o.id))}</b><small>${esc(o.roles.join(' · '))}</small></button>`).join('')+overflow(w.remaining.length,'objects / documents');}
    }
    let control=document.getElementById('hostRelationshipControl');
    if(!control){control=document.createElement('button');control.id='hostRelationshipControl';control.dataset.hostAll='';document.querySelector('.canvas-head').append(control);}
    control.textContent=`View all relationships · ${model.related.length} processes · ${model.systems.length} systems`;
    control.title=`${model.inputCount} inputs; ${model.outputCount} outputs; ${model.documentCount} document touchpoints. Complete source-derived details.`;
    const detail=document.getElementById('stageDetail');
    if(detail&&!detail.querySelector('.host-completeness')){
      const note=document.createElement('button');note.className='host-completeness';note.dataset.hostAll='';note.textContent=`Complete task relationships: ${model.inputCount} inputs · ${model.outputCount} outputs · ${model.documentCount} documents. View all.`;detail.prepend(note);
    }
    if(dialog.open)show(currentTask);
  }
  document.addEventListener('click',e=>{
    if(dialog.contains(e.target))return;
    const all=e.target.closest('[data-host-all]'); if(all){e.stopPropagation();show(selectedTask,all);return;}
    const item=e.target.closest('[data-host-inspect]');if(item){e.stopPropagation();show(item.dataset.hostInspect,item);}
  },true);
  const observer=new MutationObserver(refresh);
  observer.observe(document.getElementById('canvasStage'),{childList:true});
  observer.observe(document.getElementById('playMetaText'),{childList:true,characterData:true,subtree:true});
  refresh();return {refresh,observer};
}
