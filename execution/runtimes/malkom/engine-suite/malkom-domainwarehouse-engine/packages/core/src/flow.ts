export type QueueFlowNodeKind = 'START' | 'SUBQUEUE' | 'OUTCOME' | 'ROUTE_STATUS' | 'END' | 'EXTERNAL_TARGET' | 'RUNTIME_GAP';
export type QueueFlowEdgeKind = 'ENTER' | 'OUTCOME' | 'ROUTE' | 'END' | 'STAY_RETURN' | 'CANONICAL_ESCALATION' | 'RUNTIME_GAP';

export interface QueueFlowOutcomeMeta {
  outcomeId:string;
  outcomeCode:string;
  outcomeLabel:string;
  route:string;
  status:string;
  nextStep:string;
}
export interface QueueFlowNode {
  id:string;
  kind:QueueFlowNodeKind;
  label:string;
  subQueue?:string;
  externalTaskId?:string;
  meta?:QueueFlowOutcomeMeta;
}
export interface QueueFlowEdge {
  id:string;
  from:string;
  to:string;
  kind:QueueFlowEdgeKind;
  label:string;
  runtimeSupported:boolean;
  style:'solid'|'dashed';
  meta?:QueueFlowOutcomeMeta;
  note?:string;
}
export interface QueueFlowModel {
  queueId:string;
  queueName:string;
  sourceTaskId:string;
  startNodeId:string;
  nodes:QueueFlowNode[];
  edges:QueueFlowEdge[];
}
export interface QueueFlowPath {
  id:string;
  nodeIds:string[];
  edgeIds:string[];
  termination:'END'|'EXTERNAL_TARGET'|'RUNTIME_GAP'|'LOOP_GUARD'|'MAX_DEPTH'|'DEAD_END';
}
export interface QueueFlowPathOptions { maxVisitsPerNode?:number; maxDepth?:number; maxPaths?:number; }
export interface QueueFlowValueList { id:string; name:string; values:string[]; sourceTaskId:string; }
export interface QueueFlowQueue {
  id:string;
  name:string;
  sourceTaskId:string;
  subQueues:Array<{name:string;workTypes:string[];outcomes:string[]}>;
  outcomes:Array<{id:string;code:string;label:string;route:string;status:string;nextStep:string}>;
}
export interface QueueFlowBuildOptions {
  canonicalEscalationTarget?:{taskId:string;queue?:string};
}

const nodeId=(...parts:string[])=>parts.map((p)=>p.replace(/[^A-Za-z0-9_-]+/g,'_')).join('__');
const xml=(s:string)=>s.replace(/[<>&"']/g,(c)=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
const bpmnId=(s:string)=>`id_${s.replace(/[^A-Za-z0-9_]/g,'_')}`;

/**
 * Build the Queue Flow Explorer graph from the compiled Malkom queue projection.
 * No separately-authored process diagram is used. Every outcome branch retains
 * outcome, route, status and nextStep. STAY is a real return edge.
 */
export function buildQueueFlow(queue:QueueFlowQueue, _valueLists:QueueFlowValueList[]=[], options:QueueFlowBuildOptions={}):QueueFlowModel{
  const startNodeId=nodeId(queue.id,'start');
  const nodes:QueueFlowNode[]=[{id:startNodeId,kind:'START',label:'Start'}];
  const edges:QueueFlowEdge[]=[];
  const outcomeById=new Map(queue.outcomes.map((o)=>[o.id,o]));

  queue.subQueues.forEach((subQueue,sqIndex)=>{
    const sqId=nodeId(queue.id,'sq',String(sqIndex),subQueue.name);
    nodes.push({id:sqId,kind:'SUBQUEUE',label:subQueue.name,subQueue:subQueue.name});
    edges.push({id:nodeId('edge',queue.id,'enter',String(sqIndex)),from:startNodeId,to:sqId,kind:'ENTER',label:'enter',runtimeSupported:true,style:'solid'});

    subQueue.outcomes.forEach((outcomeRef,outIndex)=>{
      const outcome=outcomeById.get(outcomeRef);
      if(!outcome) return;
      const meta:QueueFlowOutcomeMeta={outcomeId:outcome.id,outcomeCode:outcome.code,outcomeLabel:outcome.label,route:outcome.route,status:outcome.status,nextStep:outcome.nextStep};
      const outId=nodeId(queue.id,'out',String(sqIndex),String(outIndex),outcome.id);
      const routeId=nodeId(queue.id,'route',String(sqIndex),String(outIndex),outcome.id);
      nodes.push({id:outId,kind:'OUTCOME',label:outcome.label,subQueue:subQueue.name,meta});
      nodes.push({id:routeId,kind:'ROUTE_STATUS',label:`${outcome.route} · ${outcome.status}`,subQueue:subQueue.name,meta});
      edges.push({id:nodeId('edge',outId,'outcome'),from:sqId,to:outId,kind:'OUTCOME',label:outcome.label,runtimeSupported:true,style:'solid',meta});
      edges.push({id:nodeId('edge',routeId,'route'),from:outId,to:routeId,kind:'ROUTE',label:`${outcome.route} · ${outcome.status} · ${outcome.nextStep}`,runtimeSupported:true,style:'solid',meta});

      if(outcome.nextStep==='END_WORK_ITEM'){
        const endId=nodeId(queue.id,'end',String(sqIndex),String(outIndex),outcome.id);
        nodes.push({id:endId,kind:'END',label:'End',subQueue:subQueue.name,meta});
        edges.push({id:nodeId('edge',routeId,'end'),from:routeId,to:endId,kind:'END',label:'END_WORK_ITEM',runtimeSupported:true,style:'solid',meta});
      } else if(outcome.nextStep==='STAY_IN_QUEUE'){
        edges.push({id:nodeId('edge',routeId,'stay'),from:routeId,to:sqId,kind:'STAY_RETURN',label:'STAY_IN_QUEUE · return',runtimeSupported:true,style:'solid',meta,note:'Return edge. Finite path enumeration is protected by node-visit and depth guards.'});
      } else if(outcome.nextStep==='ESCALATE'){
        const target=options.canonicalEscalationTarget;
        const targetId=nodeId(queue.id,'external','escalation',target?.taskId??'unbound');
        nodes.push({id:targetId,kind:target?'EXTERNAL_TARGET':'RUNTIME_GAP',label:target?`${target.taskId}${target.queue?` · ${target.queue}`:''}`:'Escalation target requires runtime binding',externalTaskId:target?.taskId,meta});
        edges.push({
          id:nodeId('edge',routeId,'escalate'),from:routeId,to:targetId,kind:'CANONICAL_ESCALATION',
          label:`ESCALATE${target?` → ${target.taskId}`:''}`,runtimeSupported:false,style:'dashed',meta,
          note:'Governed canonical escalation is always visible. Current Malkom cross-queue escalation materialization is not yet defined.'
        });
      } else {
        const gapId=nodeId(queue.id,'gap',String(sqIndex),String(outIndex),outcome.nextStep);
        nodes.push({id:gapId,kind:'RUNTIME_GAP',label:`${outcome.nextStep} · runtime capability gap`,subQueue:subQueue.name,meta});
        edges.push({id:nodeId('edge',routeId,'gap'),from:routeId,to:gapId,kind:'RUNTIME_GAP',label:outcome.nextStep,runtimeSupported:false,style:'dashed',meta,note:'Canonical meaning retained; current runtime projection does not define this next-step semantic.'});
      }
    });
  });
  return {queueId:queue.id,queueName:queue.name,sourceTaskId:queue.sourceTaskId,startNodeId,nodes,edges};
}

export function enumerateQueuePaths(graph:QueueFlowModel, options:QueueFlowPathOptions={}):QueueFlowPath[]{
  const maxVisitsPerNode=options.maxVisitsPerNode??2;
  const maxDepth=options.maxDepth??64;
  const maxPaths=options.maxPaths??1000;
  const byFrom=new Map<string,QueueFlowEdge[]>();
  for(const edge of graph.edges){const list=byFrom.get(edge.from)??[];list.push(edge);byFrom.set(edge.from,list)}
  const nodeById=new Map(graph.nodes.map((n)=>[n.id,n]));
  const paths:QueueFlowPath[]=[];
  let serial=0;
  const push=(nodeIds:string[],edgeIds:string[],termination:QueueFlowPath['termination'])=>{
    if(paths.length>=maxPaths)return;
    paths.push({id:`path-${++serial}`,nodeIds:[...nodeIds],edgeIds:[...edgeIds],termination});
  };
  const visit=(nodeId:string,nodeIds:string[],edgeIds:string[],visits:Map<string,number>,depth:number)=>{
    if(paths.length>=maxPaths)return;
    if(depth>=maxDepth){push(nodeIds,edgeIds,'MAX_DEPTH');return}
    const node=nodeById.get(nodeId);
    if(!node){push(nodeIds,edgeIds,'DEAD_END');return}
    if(node.kind==='END'){push(nodeIds,edgeIds,'END');return}
    if(node.kind==='EXTERNAL_TARGET'){push(nodeIds,edgeIds,'EXTERNAL_TARGET');return}
    if(node.kind==='RUNTIME_GAP'){push(nodeIds,edgeIds,'RUNTIME_GAP');return}
    const outgoing=byFrom.get(nodeId)??[];
    if(!outgoing.length){push(nodeIds,edgeIds,'DEAD_END');return}
    for(const edge of outgoing){
      const next=edge.to;
      const nextCount=visits.get(next)??0;
      if(nextCount>=maxVisitsPerNode){push(nodeIds,edgeIds,'LOOP_GUARD');continue}
      const nextVisits=new Map(visits);nextVisits.set(next,nextCount+1);
      visit(next,[...nodeIds,next],[...edgeIds,edge.id],nextVisits,depth+1);
      if(paths.length>=maxPaths)return;
    }
  };
  const visits=new Map<string,number>([[graph.startNodeId,1]]);
  visit(graph.startNodeId,[graph.startNodeId],[],visits,0);
  return paths;
}

export function toBpmn(flow:QueueFlowModel):string{
  const nodeXml=flow.nodes.map((n)=>{
    const id=bpmnId(n.id),name=xml(n.label);
    if(n.kind==='START')return `<bpmn:startEvent id="${id}" name="${name}"/>`;
    if(n.kind==='END')return `<bpmn:endEvent id="${id}" name="${name}"/>`;
    if(n.kind==='OUTCOME')return `<bpmn:exclusiveGateway id="${id}" name="${name}"/>`;
    return `<bpmn:task id="${id}" name="${name}"><bpmn:documentation>${xml(n.meta?`${n.meta.outcomeCode} | ${n.meta.route} | ${n.meta.status} | ${n.meta.nextStep}`:n.kind)}</bpmn:documentation></bpmn:task>`;
  }).join('');
  const edgeXml=flow.edges.map((e)=>`<bpmn:sequenceFlow id="${bpmnId(e.id)}" sourceRef="${bpmnId(e.from)}" targetRef="${bpmnId(e.to)}" name="${xml(e.label)}"><bpmn:documentation>${xml(e.meta?`${e.meta.outcomeCode} | route=${e.meta.route} | status=${e.meta.status} | nextStep=${e.meta.nextStep}${e.runtimeSupported?'':' | CURRENT_RUNTIME_GAP'}`:(e.note??e.kind))}</bpmn:documentation></bpmn:sequenceFlow>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="${bpmnId(`Definitions_${flow.queueId}`)}" targetNamespace="urn:malkom:domainwarehouse"><bpmn:process id="${bpmnId(flow.queueId)}" name="${xml(flow.queueName)}" isExecutable="false">${nodeXml}${edgeXml}</bpmn:process></bpmn:definitions>`;
}

function layout(flow:QueueFlowModel){
  const rows=new Map<string,number>();
  let row=0;
  for(const n of flow.nodes){if(n.kind==='OUTCOME')rows.set(n.id,row++);}
  const positions=new Map<string,{x:number;y:number}>();
  const branches=Math.max(1,row),height=Math.max(260,branches*72+110);
  const start=flow.nodes.find(n=>n.kind==='START');if(start)positions.set(start.id,{x:55,y:height/2});
  const subQueues=flow.nodes.filter(n=>n.kind==='SUBQUEUE');
  for(const sq of subQueues){const outs=flow.nodes.filter(n=>n.kind==='OUTCOME'&&n.subQueue===sq.subQueue);const ys=outs.map(o=>(rows.get(o.id)??0)*72+55);const y=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:height/2;positions.set(sq.id,{x:210,y});}
  for(const out of flow.nodes.filter(n=>n.kind==='OUTCOME')){const y=(rows.get(out.id)??0)*72+55;positions.set(out.id,{x:455,y});}
  for(const route of flow.nodes.filter(n=>n.kind==='ROUTE_STATUS')){const out=flow.nodes.find(n=>n.kind==='OUTCOME'&&n.meta?.outcomeId===route.meta?.outcomeId&&n.subQueue===route.subQueue);positions.set(route.id,{x:680,y:out?positions.get(out.id)!.y:height/2});}
  for(const end of flow.nodes.filter(n=>['END','EXTERNAL_TARGET','RUNTIME_GAP'].includes(n.kind))){const routeEdge=flow.edges.find(e=>e.to===end.id);const route=routeEdge?positions.get(routeEdge.from):undefined;positions.set(end.id,{x:940,y:route?.y??height/2});}
  return {positions,width:1120,height};
}

export function toSvg(flow:QueueFlowModel, selectedPath?:QueueFlowPath|string[], mode:'flow'|'bpmn'='flow'):string{
  const {positions,width,height}=layout(flow);
  const selectedNodes=new Set(Array.isArray(selectedPath)?selectedPath:(selectedPath?.nodeIds??[]));
  const selectedEdges=new Set(Array.isArray(selectedPath)?[]:(selectedPath?.edgeIds??[]));
  const hasSelection=selectedNodes.size>0||selectedEdges.size>0;
  const defs=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6b8296"/></marker><marker id="arrowGap" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#b36b00"/></marker></defs>`;
  const edges=flow.edges.map((e)=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return'';const on=!hasSelection||selectedEdges.has(e.id);const gap=!e.runtimeSupported;const dash=e.kind==='STAY_RETURN'?'5 4':e.style==='dashed'?'8 6':'none';const bend=e.kind==='STAY_RETURN';const d=bend?`M ${a.x} ${a.y} C ${a.x-80} ${a.y+32}, ${b.x+80} ${b.y+32}, ${b.x} ${b.y}`:`M ${a.x} ${a.y} L ${b.x} ${b.y}`;return `<path d="${d}" fill="none" stroke="${gap?'#b36b00':'#7890a6'}" stroke-width="${on?2.4:1}" stroke-dasharray="${dash}" opacity="${on?1:.22}" marker-end="url(#${gap?'arrowGap':'arrow'})"><title>${xml(`${e.label}${e.meta?` | ${e.meta.outcomeCode} | ${e.meta.route} | ${e.meta.status} | ${e.meta.nextStep}`:''}`)}</title></path>`}).join('');
  const shape=(n:QueueFlowNode,p:{x:number;y:number},on:boolean)=>{const opacity=on?1:.3;const fill=n.kind==='START'?'#e8f5f0':n.kind==='END'?'#e8f5f0':n.kind==='EXTERNAL_TARGET'||n.kind==='RUNTIME_GAP'?'#fff7df':'#fff';if(n.kind==='OUTCOME'&&mode==='bpmn'){return `<g opacity="${opacity}"><polygon points="${p.x},${p.y-23} ${p.x+23},${p.y} ${p.x},${p.y+23} ${p.x-23},${p.y}" fill="${fill}" stroke="#58738a"/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="10" fill="#102a43">${xml(n.label.slice(0,16))}</text></g>`}const w=n.kind==='ROUTE_STATUS'?190:n.kind==='SUBQUEUE'?180:150;return `<g opacity="${opacity}"><rect x="${p.x-w/2}" y="${p.y-20}" width="${w}" height="40" rx="${n.kind==='START'||n.kind==='END'?20:7}" fill="${fill}" stroke="#7890a6"/><text x="${p.x}" y="${p.y-3}" text-anchor="middle" font-size="11" font-weight="600" fill="#102a43">${xml(n.label.slice(0,30))}</text>${n.meta?`<text x="${p.x}" y="${p.y+12}" text-anchor="middle" font-size="9" fill="#627d98">${xml(`${n.meta.route} · ${n.meta.status} · ${n.meta.nextStep}`.slice(0,44))}</text>`:''}</g>`};
  const nodes=flow.nodes.map((n)=>{const p=positions.get(n.id);if(!p)return'';return shape(n,p,!hasSelection||selectedNodes.has(n.id))}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(`${flow.queueName} queue flow`)}"><rect width="100%" height="100%" fill="#f7f9fc"/>${defs}${edges}${nodes}</svg>`;
}

export function toImage(flow:QueueFlowModel, selectedPath?:QueueFlowPath|string[], mode:'flow'|'bpmn'='flow'):string{return toSvg(flow,selectedPath,mode)}
