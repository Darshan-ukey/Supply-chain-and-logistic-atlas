import {getModel} from '../atlas/store.js';
const SUPPORTED=new Set(['FOCUS_PROCESS','FOCUS_PROCESSES','TRACE_PROCESS','COMPARE_PROCESSES','PLAY_EXISTING_FLOW','OPEN_SIMULATION','SIMULATION_PLAY','SIMULATION_PAUSE','SIMULATION_STEP','SIMULATION_RESET','SET_FLOW_LAYER','SELECT_HANDOFF']);
const FLOW_LAYERS=new Set(['physical','information','financial','controls','evidence']);
export function validateUiActions(actions=[]){
  const model=getModel(),validProcesses=new Set(model.processes.map(p=>p.id)),validEdges=new Set(model.processFlowEdges.map(e=>e.id)),safe=[];
  for(const raw of Array.isArray(actions)?actions:[]){if(!raw||!SUPPORTED.has(raw.type))continue;const a={type:raw.type};
    if(typeof raw.processId==='string'&&validProcesses.has(raw.processId))a.processId=raw.processId;
    if(Array.isArray(raw.processIds))a.processIds=raw.processIds.filter(x=>validProcesses.has(x)).slice(0,30);
    if(['FOCUS_PROCESS','TRACE_PROCESS'].includes(raw.type)&&raw.processId&&!a.processId)continue;
    if(['FOCUS_PROCESSES','COMPARE_PROCESSES','PLAY_EXISTING_FLOW'].includes(raw.type)&&raw.processIds&&!a.processIds?.length)continue;
    if(raw.type==='SIMULATION_STEP'&&['NEXT','PREVIOUS'].includes(raw.direction))a.direction=raw.direction;
    if(raw.type==='SIMULATION_STEP'&&!a.direction)continue;
    if(raw.type==='SET_FLOW_LAYER'&&FLOW_LAYERS.has(raw.layer)){a.layer=raw.layer;a.enabled=raw.enabled!==false}else if(raw.type==='SET_FLOW_LAYER')continue;
    if(raw.type==='SELECT_HANDOFF'&&validEdges.has(raw.edgeId||''))a.edgeId=raw.edgeId;else if(raw.type==='SELECT_HANDOFF')continue;
    safe.push(a)
  }return safe
}
export const supportedUiActions=()=>[...SUPPORTED];
