import React, { useEffect, useMemo, useState } from 'react';
import { buildQueueFlow, enumerateQueuePaths, toBpmn, toImage } from '@malkom/domainwarehouse-core';
import type { QueueFlowPath, QueueFlowQueue, QueueFlowValueList } from '@malkom/domainwarehouse-core';

export interface QueueFlowExplorerProps {
  queue:QueueFlowQueue;
  valueLists?:QueueFlowValueList[];
  canonicalEscalationTarget?:{taskId:string;queue?:string};
  mode?:'bpmn'|'flow';
  animate?:boolean;
  pathSelector?:boolean;
  exportImage?:boolean;
  exportBpmn?:boolean;
}

const download=(filename:string,content:string,type:string)=>{
  if(typeof document==='undefined')return;
  const blob=new Blob([content],{type});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;a.click();URL.revokeObjectURL(href);
};

export function QueueFlowExplorer({queue,valueLists=[],canonicalEscalationTarget,mode:initialMode='flow',animate=true,pathSelector=true,exportImage=true,exportBpmn=true}:QueueFlowExplorerProps){
  const graph=useMemo(()=>buildQueueFlow(queue,valueLists,{canonicalEscalationTarget}),[queue,valueLists,canonicalEscalationTarget]);
  const paths=useMemo(()=>enumerateQueuePaths(graph,{maxVisitsPerNode:2,maxDepth:64,maxPaths:1000}),[graph]);
  const [mode,setMode]=useState<'bpmn'|'flow'>(initialMode);
  const [pathIndex,setPathIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [step,setStep]=useState<number|undefined>(undefined);
  useEffect(()=>{setPathIndex(0);setPlaying(false);setStep(undefined)},[graph.queueId]);
  const selected=paths[Math.min(pathIndex,Math.max(0,paths.length-1))];
  useEffect(()=>{
    if(!playing||!selected)return;
    const max=selected.edgeIds.length;
    const timer=setInterval(()=>setStep((previous)=>{
      const next=(previous??-1)+1;
      if(next>=max){setPlaying(false);return undefined}
      return next;
    }),520);
    return()=>clearInterval(timer);
  },[playing,selected]);
  const renderedPath:QueueFlowPath|undefined=selected&&step!==undefined?{...selected,nodeIds:selected.nodeIds.slice(0,step+2),edgeIds:selected.edgeIds.slice(0,step+1)}:selected;
  const svg=useMemo(()=>toImage(graph,renderedPath,mode),[graph,renderedPath,mode]);
  const escalationEdges=graph.edges.filter((edge)=>edge.kind==='CANONICAL_ESCALATION');
  const stayEdges=graph.edges.filter((edge)=>edge.kind==='STAY_RETURN');
  const pathMeta=selected?.edgeIds.map((id)=>graph.edges.find((edge)=>edge.id===id)).filter(Boolean)??[];
  return <section data-testid="queue-flow-explorer">
    <header>
      <h3>Queue Flow Explorer</h3>
      <p>Derived from the compiled queue/subqueue/outcome projection. Every branch retains outcome, route, status and next step. STAY is a guarded return edge.</p>
      <p><strong>{queue.sourceTaskId} · {queue.name}</strong> · {queue.subQueues.length} subqueues · {queue.outcomes.length} outcomes · {paths.length} finite guarded paths</p>
    </header>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:8}}>
      <button type="button" onClick={()=>setMode('bpmn')} aria-pressed={mode==='bpmn'}>BPMN</button>
      <button type="button" onClick={()=>setMode('flow')} aria-pressed={mode==='flow'}>Flow</button>
      {pathSelector&&<>
        <button type="button" onClick={()=>{setPathIndex((i)=>(i-1+paths.length)%Math.max(1,paths.length));setStep(undefined)}} disabled={!paths.length}>‹ Path</button>
        <span>Path {paths.length?pathIndex+1:0} of {paths.length}{selected?` · ${selected.termination}`:''}</span>
        <button type="button" onClick={()=>{setPathIndex((i)=>(i+1)%Math.max(1,paths.length));setStep(undefined)}} disabled={!paths.length}>Path ›</button>
      </>}
      {animate&&<button type="button" onClick={()=>{setStep(undefined);setPlaying((v)=>!v)}} disabled={!selected}>{playing?'Pause':'▶ Play'}</button>}
      {exportImage&&<button type="button" onClick={()=>download(`${queue.sourceTaskId}-${mode}-path-${pathIndex+1}.svg`,toImage(graph,selected,mode),'image/svg+xml')}>Image</button>}
      {exportBpmn&&<button type="button" onClick={()=>download(`${queue.sourceTaskId}.bpmn`,toBpmn(graph),'application/xml')}>BPMN XML</button>}
    </div>
    <div style={{overflow:'auto',border:'1px solid #d7e3ec',borderRadius:8}} dangerouslySetInnerHTML={{__html:svg}}/>
    {selected&&<details open><summary>Selected path semantics</summary><ul>{pathMeta.map((edge)=><li key={edge!.id}><strong>{edge!.label}</strong>{edge!.meta?` · route=${edge!.meta.route} · status=${edge!.meta.status} · next=${edge!.meta.nextStep}`:''}</li>)}</ul></details>}
    {stayEdges.length>0&&<p><strong>STAY return edges:</strong> {stayEdges.length}. Path enumeration uses maxVisitsPerNode=2 and maxDepth=64, so loops remain visible without infinite traversal.</p>}
    {escalationEdges.length>0&&<div><h4>Canonical escalation — always visible</h4><ul>{escalationEdges.map((edge)=><li key={edge.id}><strong>{edge.label}</strong> · canonical governed route · current Malkom materialization gap</li>)}</ul></div>}
  </section>;
}
