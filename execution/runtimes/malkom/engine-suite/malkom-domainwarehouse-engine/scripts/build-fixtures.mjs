import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const src=JSON.parse(fs.readFileSync(path.join(root,'fixtures/road-ltl/v2.3-lossless-pack.json'),'utf8'));
const model=src.source.model;
const taskDefs=src.malkomProjection.taskDefinitions;
const procById=new Map(model.processes.map(p=>[p.id,p]));
const trById=new Map(model.executionTransitions.map(t=>[t.processId,t]));
const incoming=new Map(), outgoing=new Map();
for(const e of model.processFlowEdges){ if(!incoming.has(e.to))incoming.set(e.to,[]); incoming.get(e.to).push(e); if(!outgoing.has(e.from))outgoing.set(e.from,[]); outgoing.get(e.from).push(e); }
const advancedSteps=new Set(['ESCALATE','MOVE_TO_QUEUE','WAIT_FOR_EVENT','RETRY','CONTINUE','HUMAN_REVIEW']);
function escTargetFromSourceRecord(p){const text=String(p?.paths?.escalation??p?.escalation??'');return text.match(/LTL-\d{2}/)?.[0]}
const defs=taskDefs.map(m=>{
  const p=procById.get(m.taskId); if(!p) throw new Error(`missing source process ${m.taskId}`);
  const t=trById.get(m.taskId); if(!t) throw new Error(`missing execution transition ${m.taskId}`);
  const hasUnsupported=m.outcomes.some(o=>advancedSteps.has(o.nextStep));
  const id=`road-ltl:${m.taskId}`;
  return {
    kind:'malkom.domain-work-definition/2.3', id, domain:'supply-chain.road-ltl', version:'1.2.0', status:'ACTIVE', canonicalName:p.label,
    sourceTask:{module:'Road LTL V1.2',taskId:m.taskId,normalizedSourceSha256:src.source.normalizedSha256,sourceRefs:[...p.sourceIds]},
    sourceRecord:p,
    sourceGraph:{incoming:incoming.get(m.taskId)??[],outgoing:outgoing.get(m.taskId)??[],executionTransition:t},
    canonical:{
      execution:{trigger:p.trigger,stateBefore:p.before,event:p.event,decision:p.decision,rule:p.rule,control:p.control,clock:p.clock,action:p.action,evidence:p.evidence,stateAfter:p.after,outcome:p.outcome},
      actors:{actor:p.actor,performer:p.performer,owner:p.owner,decisionAuthority:p.decisionAuthority,custody:p.custody,financial:p.financial,exceptionOwner:p.exceptionOwner},
      systems:{producer:p.producer,authoritySystem:p.authoritySystem,authorityObject:p.authorityObject,consumers:p.consumers,interface:p.interface},
      information:{inputs:[...p.inputs],outputs:[...p.outputs],identifiers:p.identifiers,lineage:p.lineage},
      applicability:p.applicability, participants:p.participants??[], paths:p.paths??{}, claimBoundary:p.claimBoundary, sourceIds:[...p.sourceIds], confidenceModel:p.confidenceModel??{}
    },
    decomposition:{basis:'MALKOM_STANDARD',malkom:m},
    notes:[
      {id:`${m.taskId}:note:definition`,kind:'DEFINITION',nodeRef:{kind:'QUEUE',id:m.queue},text:m.queuePurpose,provenance:'MALKOM_STANDARD',sourceRefs:[...p.sourceIds],confidence:'HIGH'},
      {id:`${m.taskId}:note:why`,kind:'WHY_IT_MATTERS',nodeRef:{kind:'CONTROL',id:`${m.taskId}:control`},text:p.claimBoundary,provenance:'SOURCE_BACKED',sourceRefs:[...p.sourceIds],confidence:'HIGH'},
      {id:`${m.taskId}:note:source`,kind:'SOURCE',nodeRef:{kind:'RULE',id:`${m.taskId}:rule`},text:`Governed source references: ${p.sourceIds.join(', ')}`,provenance:'SOURCE_BACKED',sourceRefs:[...p.sourceIds],confidence:'HIGH'}
    ],
    projections:[{
      id:`malkom:${m.taskId}:v1`,runtime:'MALKOM_3',adapterId:'malkom-command',generatedFromWorkDefinitionId:id,
      disposition:hasUnsupported?'UNSUPPORTED_CURRENT_MALKOM':'MAPPED',
      capabilities:['QUEUE','SUBQUEUE','WORK_TYPE','SCHEMA','OUTCOME','VALUE_LIST','WORKFLOW'],
      payloadRef:`fixtures/road-ltl/queue-templates.json#${m.taskId}`,
      note:hasUnsupported?'Canonical definition contains a next-step capability not currently materializable by Malkom; source meaning remains intact.':'Current Malkom projection can represent the managed-work and lifecycle subset without semantic flattening.'
    }],
    clientOverridePoints:[...m.clientOverridePoints],
    provenance:{sourceRecord:'SOURCE_BACKED',canonical:'SOURCE_BACKED',decomposition:'MALKOM_STANDARD',projection:'MALKOM_STANDARD'}
  };
});
fs.writeFileSync(path.join(root,'fixtures/road-ltl/work-definitions.json'),JSON.stringify(defs,null,2));
fs.writeFileSync(path.join(root,'fixtures/road-ltl/source-model.json'),JSON.stringify(model,null,2));

function safe(v,max=40){const n=String(v).toUpperCase().replace(/[^A-Z0-9_]+/g,'_').replace(/^_+|_+$/g,'')||'STATE';return n.slice(0,max)}
function escTarget(d){return escTargetFromSourceRecord(d.sourceRecord)}
function workflow(d){const blockers=[], supported=[], unsupported=[];const states=d.decomposition.malkom.outcomes.map(o=>{const key=safe(`OUT_${o.code}`);const advanced=advancedSteps.has(o.nextStep);if(advanced){unsupported.push(o.code);blockers.push({workDefinitionId:d.id,outcomeCode:o.code,nextStep:o.nextStep,targetTaskId:o.nextStep==='ESCALATE'?escTarget(d):undefined,capability:`workflow.${o.nextStep.toLowerCase()}`,reason:`Current Malkom workflow lifecycle does not define required cross-queue/runtime semantics for ${o.nextStep}.`,disposition:'UNSUPPORTED_CURRENT_MALKOM'});}else supported.push(o.code);return {key,label:advanced?`${o.label} · runtime binding required`:o.label,terminal:o.nextStep==='END_WORK_ITEM',holdsClock:o.nextStep==='STAY_IN_QUEUE'||advanced,to:o.nextStep==='STAY_IN_QUEUE'?['OPEN']:[]}});return {lifecycle:{id:safe(`dw_${d.sourceTask.taskId}`,64),name:d.canonicalName.slice(0,120),initialState:'OPEN',states:[{key:'OPEN',label:'Open',terminal:false,holdsClock:false,to:states.map(s=>s.key)},...states],slaMinutes:0,enabled:true},materializable:blockers.length===0,blockers,supportedOutcomeCodes:supported,unsupportedOutcomeCodes:unsupported}}
const workflows=defs.map(d=>({taskId:d.sourceTask.taskId,...workflow(d)}));
fs.writeFileSync(path.join(root,'fixtures/road-ltl/workflow-projections.json'),JSON.stringify(workflows,null,2));

const queueTemplates=defs.map(d=>({id:`dw-${d.sourceTask.taskId.toLowerCase()}`,name:d.decomposition.malkom.queue,purpose:d.decomposition.malkom.queuePurpose,domain:d.domain,sourceTaskId:d.sourceTask.taskId,subQueues:d.decomposition.malkom.subQueues,workTypes:d.decomposition.malkom.workTypes,fields:d.decomposition.malkom.fields,outcomes:d.decomposition.malkom.outcomes}));
fs.writeFileSync(path.join(root,'fixtures/road-ltl/queue-templates.json'),JSON.stringify(queueTemplates,null,2));
const queueByTask=new Map(queueTemplates.map(q=>[q.sourceTaskId,q]));

// Canonical source/task flow is retained separately from the Malkom Queue Flow Explorer.
const canonicalNodes=defs.map(d=>({id:d.sourceTask.taskId,label:d.canonicalName,queue:d.decomposition.malkom.queue}));
const canonicalEdges=[...model.processFlowEdges.map(e=>({id:e.id,from:e.from,to:e.to,label:e.type,kind:'SOURCE_GRAPH',runtimeSupported:true,style:'solid'}))];
for(const d of defs){if(d.decomposition.malkom.outcomes.some(o=>o.nextStep==='ESCALATE')){const target=escTarget(d);if(target)canonicalEdges.push({id:`ESC-${d.sourceTask.taskId}-${target}`,from:d.sourceTask.taskId,to:target,label:'ESCALATE',kind:'CANONICAL_ESCALATION',runtimeSupported:false,style:'dashed',note:'Governed Road LTL escalation; current Malkom cross-queue escalation materialization is not yet defined.'})}}
const canonicalSourceFlow={nodes:canonicalNodes,edges:canonicalEdges};
fs.writeFileSync(path.join(root,'fixtures/road-ltl/canonical-source-flow.json'),JSON.stringify(canonicalSourceFlow,null,2));

const nid=(...parts)=>parts.map(p=>String(p).replace(/[^A-Za-z0-9_-]+/g,'_')).join('__');
function buildQueueGraph(queue,target){
  const startNodeId=nid(queue.id,'start');const nodes=[{id:startNodeId,kind:'START',label:'Start'}],edges=[];const byOutcome=new Map(queue.outcomes.map(o=>[o.id,o]));
  queue.subQueues.forEach((sq,si)=>{const sqId=nid(queue.id,'sq',si,sq.name);nodes.push({id:sqId,kind:'SUBQUEUE',label:sq.name,subQueue:sq.name});edges.push({id:nid('edge',queue.id,'enter',si),from:startNodeId,to:sqId,kind:'ENTER',label:'enter',runtimeSupported:true,style:'solid'});sq.outcomes.forEach((ref,oi)=>{const o=byOutcome.get(ref);if(!o)return;const meta={outcomeId:o.id,outcomeCode:o.code,outcomeLabel:o.label,route:o.route,status:o.status,nextStep:o.nextStep};const outId=nid(queue.id,'out',si,oi,o.id),routeId=nid(queue.id,'route',si,oi,o.id);nodes.push({id:outId,kind:'OUTCOME',label:o.label,subQueue:sq.name,meta},{id:routeId,kind:'ROUTE_STATUS',label:`${o.route} · ${o.status}`,subQueue:sq.name,meta});edges.push({id:nid('edge',outId,'outcome'),from:sqId,to:outId,kind:'OUTCOME',label:o.label,runtimeSupported:true,style:'solid',meta},{id:nid('edge',routeId,'route'),from:outId,to:routeId,kind:'ROUTE',label:`${o.route} · ${o.status} · ${o.nextStep}`,runtimeSupported:true,style:'solid',meta});if(o.nextStep==='END_WORK_ITEM'){const endId=nid(queue.id,'end',si,oi,o.id);nodes.push({id:endId,kind:'END',label:'End',subQueue:sq.name,meta});edges.push({id:nid('edge',routeId,'end'),from:routeId,to:endId,kind:'END',label:'END_WORK_ITEM',runtimeSupported:true,style:'solid',meta})}else if(o.nextStep==='STAY_IN_QUEUE'){edges.push({id:nid('edge',routeId,'stay'),from:routeId,to:sqId,kind:'STAY_RETURN',label:'STAY_IN_QUEUE · return',runtimeSupported:true,style:'solid',meta,note:'Return edge guarded during path enumeration.'})}else if(o.nextStep==='ESCALATE'){const targetId=nid(queue.id,'external','escalation',target?.taskId??'unbound');nodes.push({id:targetId,kind:target?'EXTERNAL_TARGET':'RUNTIME_GAP',label:target?`${target.taskId}${target.queue?` · ${target.queue}`:''}`:'Escalation target requires runtime binding',externalTaskId:target?.taskId,meta});edges.push({id:nid('edge',routeId,'escalate'),from:routeId,to:targetId,kind:'CANONICAL_ESCALATION',label:`ESCALATE${target?` → ${target.taskId}`:''}`,runtimeSupported:false,style:'dashed',meta,note:'Governed canonical escalation is always visible; current Malkom materialization is not defined.'})}else{const gapId=nid(queue.id,'gap',si,oi,o.nextStep);nodes.push({id:gapId,kind:'RUNTIME_GAP',label:`${o.nextStep} · runtime capability gap`,subQueue:sq.name,meta});edges.push({id:nid('edge',routeId,'gap'),from:routeId,to:gapId,kind:'RUNTIME_GAP',label:o.nextStep,runtimeSupported:false,style:'dashed',meta})}})});return {queueId:queue.id,queueName:queue.name,sourceTaskId:queue.sourceTaskId,startNodeId,nodes,edges}}
function enumerate(graph,{maxVisitsPerNode=2,maxDepth=64,maxPaths=1000}={}){const byFrom=new Map();for(const e of graph.edges){const l=byFrom.get(e.from)??[];l.push(e);byFrom.set(e.from,l)}const byNode=new Map(graph.nodes.map(n=>[n.id,n]));const paths=[];let serial=0;const push=(nodes,edges,termination)=>{if(paths.length<maxPaths)paths.push({id:`path-${++serial}`,nodeIds:[...nodes],edgeIds:[...edges],termination})};const visit=(nodeId,nodeIds,edgeIds,visits,depth)=>{if(paths.length>=maxPaths)return;if(depth>=maxDepth){push(nodeIds,edgeIds,'MAX_DEPTH');return}const n=byNode.get(nodeId);if(!n){push(nodeIds,edgeIds,'DEAD_END');return}if(n.kind==='END'){push(nodeIds,edgeIds,'END');return}if(n.kind==='EXTERNAL_TARGET'){push(nodeIds,edgeIds,'EXTERNAL_TARGET');return}if(n.kind==='RUNTIME_GAP'){push(nodeIds,edgeIds,'RUNTIME_GAP');return}const outs=byFrom.get(nodeId)??[];if(!outs.length){push(nodeIds,edgeIds,'DEAD_END');return}for(const e of outs){const count=visits.get(e.to)??0;if(count>=maxVisitsPerNode){push(nodeIds,edgeIds,'LOOP_GUARD');continue}const next=new Map(visits);next.set(e.to,count+1);visit(e.to,[...nodeIds,e.to],[...edgeIds,e.id],next,depth+1);if(paths.length>=maxPaths)return}};visit(graph.startNodeId,[graph.startNodeId],[],new Map([[graph.startNodeId,1]]),0);return paths}
const queueFlows=queueTemplates.map(queue=>{const d=defs.find(x=>x.sourceTask.taskId===queue.sourceTaskId);const targetTaskId=d?escTarget(d):undefined;const target=targetTaskId?{taskId:targetTaskId,queue:queueByTask.get(targetTaskId)?.name}:undefined;const graph=buildQueueGraph(queue,target);const paths=enumerate(graph);return {taskId:queue.sourceTaskId,graph,paths}});
const queueFlowBundle={version:'2.3',derivedFrom:'compiled-malkom-queue-projection',loopGuards:{maxVisitsPerNode:2,maxDepth:64,maxPaths:1000},queues:queueFlows,canonicalEscalations:canonicalEdges.filter(e=>e.kind==='CANONICAL_ESCALATION')};
fs.writeFileSync(path.join(root,'fixtures/road-ltl/queue-flow.json'),JSON.stringify(queueFlowBundle,null,2));

const blockers=workflows.flatMap(w=>w.blockers);
fs.writeFileSync(path.join(root,'fixtures/road-ltl/materialization-blockers.json'),JSON.stringify(blockers,null,2));
const counts={definitions:defs.length,queues:queueTemplates.length,subQueues:taskDefs.reduce((n,d)=>n+d.subQueues.length,0),workTypes:taskDefs.reduce((n,d)=>n+d.workTypes.length,0),fields:taskDefs.reduce((n,d)=>n+d.fields.length,0),outcomes:taskDefs.reduce((n,d)=>n+d.outcomes.length,0),sourceEdges:model.processFlowEdges.length,executionTransitions:model.executionTransitions.length,entityNodes:model.entityNodes.length,ontologyEdges:model.ontologyEdges.length,sources:model.sources.length,canonicalEscalations:canonicalEdges.filter(e=>e.kind==='CANONICAL_ESCALATION').length,workflowBlockers:blockers.length,stayOutcomes:taskDefs.reduce((n,d)=>n+d.outcomes.filter(o=>o.nextStep==='STAY_IN_QUEUE').length,0),queueFlowStayEdges:queueFlows.reduce((n,q)=>n+q.graph.edges.filter(e=>e.kind==='STAY_RETURN').length,0),queueFlowEscalationEdges:queueFlows.reduce((n,q)=>n+q.graph.edges.filter(e=>e.kind==='CANONICAL_ESCALATION').length,0),queueFlowPaths:queueFlows.reduce((n,q)=>n+q.paths.length,0),knowledgeNotes:defs.reduce((n,d)=>n+d.notes.length,0),runtimeProjections:defs.reduce((n,d)=>n+d.projections.length,0)};
fs.writeFileSync(path.join(root,'fixtures/road-ltl/counts.json'),JSON.stringify(counts,null,2));
console.log(JSON.stringify(counts,null,2));
