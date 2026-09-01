import React, { useMemo, useState } from 'react';
import type { WorkDefinition } from '@malkom/domainwarehouse-contract';
import { compileMalkom, escalationTarget } from '@malkom/domainwarehouse-core';
import { QueueFlowExplorer } from './QueueFlowExplorer.js';
import { WorkflowProjectionPanel } from './WorkflowProjectionPanel.js';

export function DomainWarehouseStudio({definitions}:{definitions:WorkDefinition[]}){
  const [id,setId]=useState(definitions[0]?.id);
  const d=definitions.find((x)=>x.id===id)??definitions[0];
  const queueByTask=useMemo(()=>new Map(definitions.map((definition)=>[definition.sourceTask.taskId,definition.decomposition.malkom.queue])),[definitions]);
  if(!d)return null;
  const c=compileMalkom(d);
  const targetTaskId=escalationTarget(d);
  const allEscalations=definitions.flatMap((definition)=>{
    const target=escalationTarget(definition);
    return definition.decomposition.malkom.outcomes.some((o)=>o.nextStep==='ESCALATE')&&target?[{from:definition.sourceTask.taskId,to:target}]:[];
  });
  return <main><aside>{definitions.map((x)=><button key={x.id} onClick={()=>setId(x.id)}>{x.sourceTask.taskId} · {x.canonicalName}</button>)}</aside><article>
    <h2>{d.sourceTask.taskId} · {d.canonicalName}</h2>
    <section><h3>Lossless Canonical WorkDefinition</h3><dl>{Object.entries(d.canonical.execution).map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl></section>
    <section><h3>Malkom Projection</h3><p>Queue: <strong>{c.queue.name}</strong> · {c.queue.subQueues.length} subqueues · {c.queue.workTypes.length} work types</p></section>
    <WorkflowProjectionPanel definition={d}/>
    <QueueFlowExplorer queue={c.queue} valueLists={c.valueLists} canonicalEscalationTarget={targetTaskId?{taskId:targetTaskId,queue:queueByTask.get(targetTaskId)}:undefined} mode="flow" animate pathSelector exportImage exportBpmn/>
    <section><h3>Canonical cross-queue escalation routes</h3><p>These remain visible independently of current runtime support.</p><ul>{allEscalations.map((route)=><li key={`${route.from}-${route.to}`}><strong>{route.from} → {route.to}</strong> · ESCALATE · current Malkom materialization gap</li>)}</ul></section>
  </article></main>;
}
