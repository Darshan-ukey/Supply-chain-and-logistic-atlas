(function(g){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=(...p)=>p.map(x=>String(x??'').replace(/[^A-Za-z0-9_-]+/g,'_')).filter(Boolean).join('__');
const arr=x=>Array.isArray(x)?x:(x==null?[]:[x]);
const label=(x,fallback='')=>typeof x==='string'?x:(x?.label||x?.name||x?.code||x?.id||fallback);

function node(kind,labelText,extra={}){return {id:extra.id||id(kind,labelText),kind,label:labelText,...extra}}
function edge(from,to,kind='FLOW',extra={}){return {id:extra.id||id('edge',from,to,kind,extra.label||''),from,to,kind,label:extra.label||'',runtimeSupported:extra.runtimeSupported!==false,style:extra.style||'solid',meta:extra.meta,note:extra.note}}

function canonicalFromElements(def,elements){
  const graph={id:`canonical:${def?.id||def?.sourceTask?.sourceId||'work'}`,name:def?.canonicalName||def?.sourceTask?.sourceLabel||'Canonical execution',mode:'canonical',nodes:[],edges:[],startNodeId:'start'};
  graph.nodes.push(node('START','Start',{id:'start'}));
  const byId=new Map();
  for(const el of elements){const n=node(el.type||'WORK',el.purpose||el.label||el.id,{id:`wd__${el.id}`,meta:el});graph.nodes.push(n);byId.set(el.id,n)}
  const incoming=new Map(elements.map(e=>[e.id,0]));
  for(const el of elements)for(const nextId of arr(el.next)){if(incoming.has(nextId))incoming.set(nextId,incoming.get(nextId)+1)}
  for(const el of elements){const from=byId.get(el.id);for(const nextId of arr(el.next)){const to=byId.get(nextId);if(to)graph.edges.push(edge(from.id,to.id,'FLOW',{label:'next'}))}}
  const roots=elements.filter(e=>(incoming.get(e.id)||0)===0);for(const r of roots){const n=byId.get(r.id);graph.edges.push(edge('start',n.id,'ENTER',{label:'enter'}))}
  const withOutgoing=new Set(graph.edges.map(e=>e.from));
  for(const el of elements){const n=byId.get(el.id);if(!withOutgoing.has(n.id)){const endId=`end__${n.id}`;graph.nodes.push(node('END','End',{id:endId}));graph.edges.push(edge(n.id,endId,'END',{label:'complete'}))}}
  return graph;
}

function buildCanonicalFlow(def){
  const elements=def?.decomposition?.elements;
  if(Array.isArray(elements)&&elements.length)return canonicalFromElements(def,elements);
  const ex=def?.execution||def?.canonical?.execution||{};
  const graph={id:`canonical:${def?.id||def?.sourceTask?.sourceId||'work'}`,name:def?.canonicalName||def?.sourceTask?.sourceLabel||'Canonical execution',mode:'canonical',nodes:[],edges:[],startNodeId:'start'};
  graph.nodes.push(node('START','Start',{id:'start'}));
  const steps=[];
  const add=(kind,text,key)=>{if(text){const n=node(kind,String(text),{id:`canonical__${key}`,meta:{key}});graph.nodes.push(n);steps.push(n)}};
  add('STATE',ex.stateBefore||ex.before,'state-before');
  add('EVENT',ex.event||ex.trigger,'event');
  add('DECISION',ex.decision,'decision');
  add('RULE',ex.rule,'rule');
  add('CONTROL',ex.control,'control');
  add('ACTION',ex.action,'action');
  add('EVIDENCE',ex.evidence,'evidence');
  let prev='start';for(const s of steps){graph.edges.push(edge(prev,s.id,s.kind==='DECISION'?'DECISION':'FLOW',{label:s.kind==='EVENT'?'trigger/event':''}));prev=s.id}
  const outcomes=arr(def?.outcomes).length?arr(def.outcomes):ex.outcome?[{name:ex.outcome}]:[];
  if(outcomes.length){
    const gateway=steps.find(x=>x.kind==='DECISION')||null;
    const branchFrom=gateway?.id||prev;
    if(gateway){graph.edges=graph.edges.filter(e=>e.from!==gateway.id);prev=gateway.id}
    outcomes.forEach((o,i)=>{const text=label(o,`Outcome ${i+1}`),outId=`canonical__outcome__${i}`;graph.nodes.push(node('OUTCOME',text,{id:outId,meta:o}));graph.edges.push(edge(branchFrom,outId,'OUTCOME',{label:text,meta:o}));const endId=`canonical__end__${i}`;graph.nodes.push(node('END','End',{id:endId,meta:o}));graph.edges.push(edge(outId,endId,'END',{label:'state after',meta:{stateAfter:ex.stateAfter||ex.after||''}}))})
  }else{
    const endId='canonical__end';graph.nodes.push(node('END','End',{id:endId}));graph.edges.push(edge(prev,endId,'END',{label:ex.stateAfter||ex.after||'complete'}));
  }
  return graph;
}

function normalizeMalkom(def){
  const p=def?.malkomProjection||def?.decomposition?.malkom;
  if(!p)return null;
  const outcomes=arr(p.outcomes).map((o,i)=>({
    id:o.id||o.outcomeId||`out-${i+1}`,
    code:o.code||o.name||o.label||`OUTCOME_${i+1}`,
    label:o.label||o.name||o.code||`Outcome ${i+1}`,
    route:o.route||o.outcomeRoute||'UNBOUND',
    status:o.status||o.outcomeStatus||'UNBOUND',
    nextStep:o.nextStep||o.next_step||'UNBOUND',
    targetTaskId:o.targetTaskId||o.escalationTargetTaskId||null
  }));
  const allOutcomeIds=outcomes.map(o=>o.id);
  const subQueues=arr(p.subQueues).map((s,i)=>({
    name:s.name||s.label||`Subqueue ${i+1}`,
    workTypes:arr(s.workTypes).length?arr(s.workTypes):s.workType?[s.workType.name||s.workType]:[],
    outcomes:arr(s.outcomes).length?arr(s.outcomes):allOutcomeIds
  }));
  return {queue:{id:p.queueId||`malkom-${def?.sourceTask?.sourceId||def?.sourceTask?.taskId||def?.id||'work'}`,name:typeof p.queue==='string'?p.queue:(p.queue?.name||def?.canonicalName||'Malkom Queue'),sourceTaskId:def?.sourceTask?.sourceId||def?.sourceTask?.taskId||def?.id||'unknown',subQueues,outcomes},outcomes,p};
}

function buildMalkomFlow(def){
  const normalized=normalizeMalkom(def);if(!normalized)return null;
  const {queue}=normalized,graph={id:`malkom:${queue.id}`,name:queue.name,mode:'malkom',nodes:[],edges:[],startNodeId:`${queue.id}__start`};
  graph.nodes.push(node('START','Start',{id:graph.startNodeId}));const outcomeById=new Map(queue.outcomes.map(o=>[o.id,o]));
  queue.subQueues.forEach((sq,si)=>{
    const sqId=id(queue.id,'sq',si,sq.name);graph.nodes.push(node('SUBQUEUE',sq.name,{id:sqId,meta:{workTypes:sq.workTypes}}));graph.edges.push(edge(graph.startNodeId,sqId,'ENTER',{label:'enter'}));
    sq.outcomes.forEach((ref,oi)=>{const o=outcomeById.get(typeof ref==='string'?ref:(ref.id||ref.outcomeId));if(!o)return;const meta={outcomeId:o.id,outcomeCode:o.code,outcomeLabel:o.label,route:o.route,status:o.status,nextStep:o.nextStep,targetTaskId:o.targetTaskId};const outId=id(queue.id,'out',si,oi,o.id),routeId=id(queue.id,'route',si,oi,o.id);graph.nodes.push(node('OUTCOME',o.label,{id:outId,meta}));graph.nodes.push(node('ROUTE_STATUS',`${o.route} · ${o.status}`,{id:routeId,meta}));graph.edges.push(edge(sqId,outId,'OUTCOME',{label:o.label,meta}));graph.edges.push(edge(outId,routeId,'ROUTE',{label:`${o.route} · ${o.status} · ${o.nextStep}`,meta}));
      const next=String(o.nextStep||'').toUpperCase();
      if(['END_WORK_ITEM','END_QUEUE','END'].includes(next)){const endId=id(queue.id,'end',si,oi,o.id);graph.nodes.push(node('END','End',{id:endId,meta}));graph.edges.push(edge(routeId,endId,'END',{label:next,meta}));}
      else if(['STAY_IN_QUEUE','STAY'].includes(next)){graph.edges.push(edge(routeId,sqId,'STAY_RETURN',{label:`${next} · return`,meta,note:'Guarded return edge'}));}
      else if(next==='ESCALATE'){const target=o.targetTaskId||'runtime-binding-required',targetId=id(queue.id,'external',target);graph.nodes.push(node(o.targetTaskId?'EXTERNAL_TARGET':'RUNTIME_GAP',o.targetTaskId?`Escalate → ${o.targetTaskId}`:'Escalation target requires binding',{id:targetId,meta}));graph.edges.push(edge(routeId,targetId,'CANONICAL_ESCALATION',{label:o.targetTaskId?`ESCALATE → ${o.targetTaskId}`:'ESCALATE',meta,runtimeSupported:false,style:'dashed'}));}
      else {const gap=id(queue.id,'gap',si,oi,next||'unknown');graph.nodes.push(node('RUNTIME_GAP',`${o.nextStep||'Unknown next step'} · capability gap`,{id:gap,meta}));graph.edges.push(edge(routeId,gap,'RUNTIME_GAP',{label:o.nextStep||'UNKNOWN',meta,runtimeSupported:false,style:'dashed'}));}
    });
  });
  return graph;
}

function enumeratePaths(graph,opt={}){
  const maxVisitsPerNode=opt.maxVisitsPerNode??2,maxDepth=opt.maxDepth??64,maxPaths=opt.maxPaths??1000,byFrom=new Map();
  for(const e of graph.edges){const a=byFrom.get(e.from)||[];a.push(e);byFrom.set(e.from,a)}
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])),paths=[];let serial=0;
  const push=(nodeIds,edgeIds,termination)=>{if(paths.length<maxPaths)paths.push({id:`path-${++serial}`,nodeIds:[...nodeIds],edgeIds:[...edgeIds],termination})};
  function visit(nid,nodeIds,edgeIds,visits,depth){if(paths.length>=maxPaths)return;if(depth>=maxDepth)return push(nodeIds,edgeIds,'MAX_DEPTH');const n=nodes.get(nid);if(!n)return push(nodeIds,edgeIds,'DEAD_END');if(n.kind==='END')return push(nodeIds,edgeIds,'END');if(n.kind==='EXTERNAL_TARGET')return push(nodeIds,edgeIds,'EXTERNAL_TARGET');if(n.kind==='RUNTIME_GAP')return push(nodeIds,edgeIds,'RUNTIME_GAP');const outs=byFrom.get(nid)||[];if(!outs.length)return push(nodeIds,edgeIds,'DEAD_END');for(const e of outs){const count=visits.get(e.to)||0;if(count>=maxVisitsPerNode){push(nodeIds,edgeIds,'LOOP_GUARD');continue}const v=new Map(visits);v.set(e.to,count+1);visit(e.to,[...nodeIds,e.to],[...edgeIds,e.id],v,depth+1)}}
  visit(graph.startNodeId,[graph.startNodeId],[],new Map([[graph.startNodeId,1]]),0);return paths;
}

function toBpmn(graph){
  const bid=s=>`id_${String(s).replace(/[^A-Za-z0-9_]/g,'_')}`,xml=s=>esc(s).replace(/&#39;/g,'&apos;');
  const nx=graph.nodes.map(n=>{const i=bid(n.id),nm=xml(n.label);if(n.kind==='START')return `<bpmn:startEvent id="${i}" name="${nm}"/>`;if(n.kind==='END')return `<bpmn:endEvent id="${i}" name="${nm}"/>`;if(['DECISION','OUTCOME'].includes(n.kind))return `<bpmn:exclusiveGateway id="${i}" name="${nm}"/>`;return `<bpmn:task id="${i}" name="${nm}"><bpmn:documentation>${xml(n.kind)}</bpmn:documentation></bpmn:task>`}).join('');
  const ex=graph.edges.map(e=>`<bpmn:sequenceFlow id="${bid(e.id)}" sourceRef="${bid(e.from)}" targetRef="${bid(e.to)}" name="${xml(e.label)}"><bpmn:documentation>${xml(`${e.kind}${e.runtimeSupported===false?' | RUNTIME_GAP':''}`)}</bpmn:documentation></bpmn:sequenceFlow>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="${bid(`Definitions_${graph.id}`)}" targetNamespace="urn:atlas:execution"><bpmn:process id="${bid(graph.id)}" name="${xml(graph.name)}" isExecutable="false">${nx}${ex}</bpmn:process></bpmn:definitions>`;
}

function layout(graph){
  const nodes=graph.nodes,depth=new Map([[graph.startNodeId,0]]),byFrom=new Map();for(const e of graph.edges){const a=byFrom.get(e.from)||[];a.push(e);byFrom.set(e.from,a)}
  const q=[graph.startNodeId];while(q.length){const n=q.shift(),d=depth.get(n)||0;for(const e of byFrom.get(n)||[])if(!depth.has(e.to)){depth.set(e.to,d+1);q.push(e.to)}}
  const cols=new Map();for(const n of nodes){const d=depth.get(n)??99;const a=cols.get(d)||[];a.push(n);cols.set(d,a)}
  const ordered=[...cols.keys()].sort((a,b)=>a-b),pos=new Map();let maxRows=1;for(const d of ordered)maxRows=Math.max(maxRows,cols.get(d).length);const width=Math.max(760,ordered.length*190+100),height=Math.max(310,maxRows*92+90);
  for(const d of ordered){const a=cols.get(d),x=70+d*180;const gap=height/(a.length+1);a.forEach((n,i)=>pos.set(n.id,{x,y:gap*(i+1)}))}return {pos,width,height};
}

function toSvg(graph,selectedPath=null,mode='bpmn'){
  const {pos,width,height}=layout(graph),selN=new Set(selectedPath?.nodeIds||[]),selE=new Set(selectedPath?.edgeIds||[]),has=!!selectedPath;
  const edges=graph.edges.map(e=>{const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)return'';const on=!has||selE.has(e.id),dash=e.kind==='STAY_RETURN'?'6 5':e.style==='dashed'?'9 6':'none',bend=e.kind==='STAY_RETURN';const d=bend?`M ${a.x+55} ${a.y} C ${a.x+100} ${a.y+45}, ${b.x-100} ${b.y+45}, ${b.x-55} ${b.y}`:`M ${a.x+55} ${a.y} L ${b.x-55} ${b.y}`;return `<path d="${d}" fill="none" stroke="${e.runtimeSupported===false?'#b66b11':'#8297a1'}" stroke-width="${on?2.2:1}" stroke-dasharray="${dash}" opacity="${on?1:.18}" marker-end="url(#arrow)"><title>${esc(`${e.label} · ${e.kind}`)}</title></path>`}).join('');
  const shapes=graph.nodes.map(n=>{const p=pos.get(n.id);if(!p)return'';const on=!has||selN.has(n.id),w=110,h=48,x=p.x-w/2,y=p.y-h/2,gap=n.kind==='RUNTIME_GAP'||n.kind==='EXTERNAL_TARGET',fill=gap?'#fff7e8':n.kind==='START'||n.kind==='END'?'#e8f5f0':n.kind==='DECISION'||n.kind==='OUTCOME'?'#edf7fb':'#fff',stroke=gap?'#b66b11':on?'#0b8099':'#aebdc3';const text=esc(n.label.length>30?n.label.slice(0,28)+'…':n.label);if(mode==='bpmn'&&(n.kind==='DECISION'||n.kind==='OUTCOME')){const pts=`${p.x},${y} ${x+w},${p.y} ${p.x},${y+h} ${x},${p.y}`;return `<g opacity="${on?1:.3}"><polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${on?2:1}"/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="9" font-family="system-ui" fill="#17343d">${text}</text></g>`}return `<g opacity="${on?1:.3}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${mode==='flow'?10:6}" fill="${fill}" stroke="${stroke}" stroke-width="${on?2:1}"/><text x="${p.x}" y="${p.y-3}" text-anchor="middle" font-size="9" font-weight="700" font-family="system-ui" fill="#17343d">${text}</text><text x="${p.x}" y="${p.y+12}" text-anchor="middle" font-size="7.5" font-family="ui-monospace" fill="#6e858e">${esc(n.kind)}</text></g>`}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${esc(graph.name)}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#8297a1"/></marker></defs>${edges}${shapes}</svg>`;
}

function download(name,text,type='text/plain'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function filename(def,suffix){const base=String(def?.sourceTask?.sourceId||def?.sourceTask?.taskId||def?.id||'work').replace(/[^a-z0-9_-]+/gi,'-');return `${base}-${suffix}`}

function renderHTML(def){const hasM=!!normalizeMalkom(def);return `<div class="atlas-flow" id="atlasExecutionFlowRoot"><div class="atlas-flow-head"><div><b>Execution Flow Generator</b><span>Generated from governed data · not separately authored</span></div><div class="atlas-flow-toolbar"><button data-af-scope="canonical" class="active">Canonical</button>${hasM?'<button data-af-scope="malkom">Malkom</button>':''}<button data-af-mode="bpmn" class="active">BPMN</button><button data-af-mode="flow">Flow</button><button data-af-prev>‹ Path</button><button data-af-next>Path ›</button><button data-af-play>▶ Play</button><button data-af-bpmn>BPMN XML</button><button data-af-svg>SVG</button></div></div><div class="atlas-flow-meta" data-af-meta></div><div class="atlas-flow-stage" data-af-stage></div><div class="atlas-flow-note" data-af-note></div></div>`}

function bind(root,def){
  if(!root)return;let scope='canonical',mode='bpmn',index=0,timer=null;
  const graphs={canonical:buildCanonicalFlow(def),malkom:buildMalkomFlow(def)};
  function current(){return graphs[scope]||graphs.canonical}
  function paths(){return enumeratePaths(current(),{maxVisitsPerNode:2,maxDepth:64,maxPaths:1000})}
  function draw(){const ps=paths();if(index>=ps.length)index=0;const p=ps[index]||null;root.querySelector('[data-af-stage]').innerHTML=toSvg(current(),p,mode);root.querySelector('[data-af-meta]').textContent=`${scope==='canonical'?'Atlas canonical':'Malkom projection'} · ${mode.toUpperCase()} · ${ps.length?`Path ${index+1} of ${ps.length} · ${p.termination}`:'No finite paths'}`;const loop=current().edges.filter(e=>e.kind==='STAY_RETURN').length,gaps=current().edges.filter(e=>e.runtimeSupported===false).length;root.querySelector('[data-af-note]').textContent=`${current().nodes.length} nodes · ${current().edges.length} edges · ${loop} guarded return edge(s) · ${gaps} runtime-gap edge(s). Path guards: maxVisitsPerNode=2, maxDepth=64.`;root.querySelectorAll('[data-af-scope]').forEach(b=>b.classList.toggle('active',b.dataset.afScope===scope));root.querySelectorAll('[data-af-mode]').forEach(b=>b.classList.toggle('active',b.dataset.afMode===mode))}
  root.querySelectorAll('[data-af-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.afScope;index=0;draw()});root.querySelectorAll('[data-af-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.afMode;draw()});root.querySelector('[data-af-prev]').onclick=()=>{const n=paths().length;index=n?(index-1+n)%n:0;draw()};root.querySelector('[data-af-next]').onclick=()=>{const n=paths().length;index=n?(index+1)%n:0;draw()};root.querySelector('[data-af-play]').onclick=()=>{if(timer){clearInterval(timer);timer=null;root.querySelector('[data-af-play]').textContent='▶ Play';return}root.querySelector('[data-af-play]').textContent='■ Stop';timer=setInterval(()=>{const n=paths().length;if(!n)return;index=(index+1)%n;draw()},900)};root.querySelector('[data-af-bpmn]').onclick=()=>download(filename(def,`${scope}.bpmn`),toBpmn(current()),'application/xml');root.querySelector('[data-af-svg]').onclick=()=>download(filename(def,`${scope}.svg`),toSvg(current(),paths()[index]||null,mode),'image/svg+xml');draw();
 }

const api={version:'atlas-execution-flow-v1-dev1',buildCanonicalFlow,buildMalkomFlow,enumeratePaths,toBpmn,toSvg,renderHTML,bind,normalizeMalkom};
g.AtlasExecutionFlow=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
