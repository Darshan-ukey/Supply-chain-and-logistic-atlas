import {getModel,processById,sourceById} from '../atlas/store.js';
import {incoming,outgoing,edges} from '../atlas/graph.js';

export const RELATIONSHIP_SEMANTICS=Object.freeze({
  REQUIRES:'The downstream process depends on the upstream process or state.',
  PRECEDES:'The upstream process normally occurs before the downstream process on this governed path.',
  FOLLOWS:'The process follows the referenced governed process.',
  TRIGGERS:'The upstream event or condition explicitly activates the downstream process.',
  MAY_TRIGGER:'The upstream process can activate the downstream process when the relevant condition occurs.',
  BRANCHES_TO:'Execution can split to this alternate governed branch when its condition applies.',
  OPTIONAL_AFTER:'This process may occur after the upstream process but is not mandatory in every execution.',
  ALTERNATIVE_TO:'One governed route can substitute for the other under a valid context.',
  BLOCKS:'The upstream process or unresolved condition prevents the downstream process from proceeding.',
  ESCALATES_TO:'Unresolved execution is handed to an exception/escalation path.',
  RECOVERS_TO:'After recovery, execution can re-enter the governed flow at this process.',
  ENABLES:'The upstream process establishes a condition that permits the downstream process to proceed.',
  ITERATES_TO_NEXT_LEG:'The governed movement cycle repeats for the next network leg.'
});

const DIMENSIONS=Object.freeze({
  role:{key:'roleApplicability',collections:['roles'],neutral:new Set(['neutral',''])},
  movement:{key:'movementApplicability',collections:['movements'],neutral:new Set(['none',''])},
  node:{key:'nodeApplicability',collections:['nodes'],neutral:new Set(['none',''])},
  jurisdiction:{key:'jurisdictionApplicability',collections:['jurisdictions'],neutral:new Set(['none',''])},
  regime:{key:'regimeApplicability',collections:['regimes'],neutral:new Set([''])},
  condition:{key:'conditionApplicability',collections:['conditions'],neutral:new Set([''])},
  contract:{key:'contractApplicability',collections:['contracts'],neutral:new Set(['contract-unresolved',''])}
});

function text(v=''){return String(v||'').replace(/\s+/g,' ').trim()}
function splitDot(v=''){return text(v).split(/\s*[·•]\s*/).map(text).filter(Boolean)}
function uniq(xs=[]){return [...new Set(xs.filter(Boolean))]}
function labelOf(collection,id){const m=getModel(),x=(m[collection]||[]).find(v=>v.id===id);return x?.name||x?.label||x?.title||id}
function allContextCandidates(){const m=getModel();return ['roles','movements','nodes','jurisdictions','regimes','conditions','contracts'].flatMap(k=>(m[k]||[]).map(x=>({id:x.id,label:x.name||x.label||x.title||x.id,collection:k}))) }

export function normalizeContext(raw={}){
  const candidates=allContextCandidates();
  const byLabel=new Map(candidates.map(x=>[text(x.label).toLowerCase(),x]));
  const exact=id=>candidates.find(x=>x.id===id)?.id||'';
  const resolve=v=>{
    if(!v)return '';
    if(typeof v==='object')return exact(v.id)||byLabel.get(text(v.label).toLowerCase())?.id||'';
    return exact(String(v))||byLabel.get(text(v).toLowerCase())?.id||'';
  };
  const select=raw.selectIds||{};
  const active=[...(raw.activeState||[]),...(raw.selectedValues||[]),...(raw.labels||[])].map(text).filter(Boolean);
  const findPref=(prefix,collection)=>{
    const line=active.find(x=>x.toLowerCase().startsWith(prefix.toLowerCase()+':'));
    if(!line)return '';
    const label=text(line.slice(line.indexOf(':')+1));
    return (getModel()[collection]||[]).find(x=>text(x.name||x.label).toLowerCase()===label.toLowerCase())?.id||'';
  };
  const legalLine=active.find(x=>x.toLowerCase().startsWith('legal / regulatory:'))||'';
  const legalLabels=legalLine?legalLine.slice(legalLine.indexOf(':')+1).split('+').map(text):[];
  const legalIds=legalLabels.map(l=>byLabel.get(l.toLowerCase())?.id).filter(Boolean);
  const ids={
    mode:resolve(select.mode)||raw.mode||'',
    role:resolve(select.role)||raw.role||findPref('Role','roles'),
    movement:resolve(select.movement)||raw.movement||findPref('Movement','movements'),
    node:resolve(select.node)||raw.node||findPref('Node','nodes'),
    contract:resolve(select.contract)||raw.contract||findPref('Contract / service','contracts'),
    jurisdictions:uniq([...(Array.isArray(raw.jurisdictions)?raw.jurisdictions:(raw.jurisdiction?[raw.jurisdiction]:[])).map(resolve),...legalIds.filter(x=>x.startsWith('jur-'))]),
    regimes:uniq([...(Array.isArray(raw.regimes)?raw.regimes:(raw.regime?[raw.regime]:[])).map(resolve),...legalIds.filter(x=>x.startsWith('cr-'))]),
    conditions:uniq([...(Array.isArray(raw.conditions)?raw.conditions:(raw.condition?[raw.condition]:[])).map(resolve),...legalIds.filter(x=>x.startsWith('cond-'))])
  };
  const ribbon=[];
  if(ids.mode&&ids.mode!=='none')ribbon.push(raw.selectIds?.mode?.label||text(raw.modeLabel)||'Road LTL');
  if(ids.role&&!DIMENSIONS.role.neutral.has(ids.role))ribbon.push(labelOf('roles',ids.role));
  if(ids.movement&&!DIMENSIONS.movement.neutral.has(ids.movement))ribbon.push(labelOf('movements',ids.movement));
  if(ids.node&&!DIMENSIONS.node.neutral.has(ids.node))ribbon.push(labelOf('nodes',ids.node));
  for(const id of ids.jurisdictions)ribbon.push(labelOf('jurisdictions',id));
  for(const id of ids.regimes)ribbon.push(labelOf('regimes',id));
  for(const id of ids.conditions)ribbon.push(labelOf('conditions',id));
  if(ids.contract&&!DIMENSIONS.contract.neutral.has(ids.contract))ribbon.push(labelOf('contracts',ids.contract));
  return {...ids,ribbon:uniq(ribbon),raw};
}

function statusForValue(record,id){
  if(!record||!id)return 'UNRESOLVED';
  if((record.required||[]).includes(id))return 'ACTIVE';
  if((record.primary||[]).includes(id))return 'ACTIVE';
  if((record.applicable||[]).includes(id))return 'ACTIVE';
  if((record.conditional||[]).includes(id))return 'CONDITIONAL';
  if((record.notDirect||[]).includes(id))return 'NOT_DIRECT';
  if((record.incompatible||[]).includes(id))return 'INCOMPATIBLE';
  if((record.researchRequired||[]).includes(id))return 'RESEARCH_REQUIRED';
  return record.defaultState||'NOT_DIRECT';
}

export function evaluateApplicability(process,rawContext={}){
  const context=normalizeContext(rawContext),results=[];
  const add=(dimension,value)=>{
    if(!value||DIMENSIONS[dimension].neutral.has(value))return;
    const rec=process.applicability?.[DIMENSIONS[dimension].key];
    results.push({dimension,value,status:statusForValue(rec,value)});
  };
  add('role',context.role);add('movement',context.movement);add('node',context.node);add('contract',context.contract);
  context.jurisdictions.forEach(v=>add('jurisdiction',v));context.regimes.forEach(v=>add('regime',v));context.conditions.forEach(v=>add('condition',v));
  const statuses=results.map(x=>x.status);
  let state=process.pathType==='EXCEPTION'?'AVAILABLE':process.pathType==='CONDITIONAL'?'CONDITIONAL':'ACTIVE';
  if(statuses.includes('INCOMPATIBLE'))state='INCOMPATIBLE';
  else if(statuses.includes('RESEARCH_REQUIRED'))state='RESEARCH_REQUIRED';
  else if(statuses.includes('CONDITIONAL'))state='CONDITIONAL';
  else if(statuses.includes('NOT_DIRECT'))state='NOT_DIRECT';
  else if(!results.length&&process.pathType!=='STANDARD')state='AVAILABLE';
  return {state,dimensionResults:results,context};
}

export function standardJourney(){
  const m=getModel(),standard=new Set(m.processes.filter(p=>p.pathType==='STANDARD').map(p=>p.id));
  const standardEdges=m.processFlowEdges.filter(e=>e.type==='PRECEDES'&&standard.has(e.from)&&standard.has(e.to));
  const incomingCount=new Map([...standard].map(id=>[id,0]));
  const nextMap=new Map([...standard].map(id=>[id,[]]));
  for(const e of standardEdges){incomingCount.set(e.to,(incomingCount.get(e.to)||0)+1);nextMap.get(e.from)?.push(e.to)}
  const roots=[...standard].filter(id=>(incomingCount.get(id)||0)===0);
  if(roots.length!==1)throw new Error(`STANDARD journey must have exactly one root; found ${roots.join(', ')||'none'}`);
  const order=[],seen=new Set();let current=roots[0];
  while(current){if(seen.has(current))throw new Error(`STANDARD journey cycle at ${current}`);seen.add(current);order.push(current);const next=nextMap.get(current)||[];if(next.length>1)throw new Error(`STANDARD journey ambiguity after ${current}: ${next.join(', ')}`);current=next[0]||null}
  if(seen.size!==standard.size)throw new Error(`STANDARD journey does not cover all STANDARD processes. Covered ${seen.size}/${standard.size}`);
  return order.map(processById);
}

export function relationshipOptions(processId){
  return outgoing(processId).map(e=>({
    ...e,
    semantic:RELATIONSHIP_SEMANTICS[e.type]||'Governed relationship.',
    target:processById(e.to),
    routeClass:e.type==='PRECEDES'?'STANDARD_CONTINUATION':e.type==='ESCALATES_TO'||e.type==='TRIGGERS'?'EXCEPTION_OR_EVENT':e.type==='BLOCKS'?'BLOCKING':e.type==='RECOVERS_TO'?'RECOVERY':e.type==='BRANCHES_TO'||e.type==='ALTERNATIVE_TO'||e.type==='ITERATES_TO_NEXT_LEG'?'BRANCH_OR_VARIANT':'DEPENDENCY_OR_OPTION'
  }))
}

function systemParts(v=''){return uniq(text(v).split(/\s*\/\s*/).map(text))}
function sourceRefs(p){return (p.sourceIds||[]).map(sourceById).filter(Boolean).map(s=>({id:s.id,title:s.title}))}
function shared(a=[],b=[]){const bs=new Set(b);return uniq(a.filter(x=>bs.has(x)))}

export function riskSignalsForProcess(process,workspaceFact=null){
  const signals=[];
  const exceptionEdges=outgoing(process.id).filter(e=>['TRIGGERS','MAY_TRIGGER','ESCALATES_TO','BLOCKS'].includes(e.type));
  for(const e of exceptionEdges){const target=processById(e.to);signals.push({
    id:`risk-${e.id}`,
    processId:process.id,
    status:'ATLAS-DERIVED HYPOTHESIS',
    title:e.type==='BLOCKS'?`Execution can be blocked before ${target?.label||e.to}`:`Variance/condition can activate ${target?.label||e.to}`,
    explanation:RELATIONSHIP_SEMANTICS[e.type],
    basis:`${e.id}: ${e.from} ${e.type} ${e.to}`,
    quantified:false
  })}
  if(process.control||process.rule){signals.push({id:`risk-control-${process.id}`,processId:process.id,status:'ATLAS-DERIVED HYPOTHESIS',title:'Control failure could weaken the governed state transition',explanation:`The Atlas explicitly models a rule/control at this step. The simulator surfaces a potential control-risk hypothesis without assigning probability, severity or financial impact.`,basis:[process.rule,process.control].filter(Boolean).join(' | '),quantified:false})}
  if(workspaceFact&&['CONFIRMED','OBSERVED','PUBLICLY_EVIDENCED'].includes(workspaceFact.status)){
    for(const [key,label] of [['manualHandoff','Manual handoff'],['rekeying','Re-keying / duplicate entry'],['exceptionLatency','Exception latency'],['controlGap','Control gap']])if(text(workspaceFact[key]))signals.push({id:`risk-client-${process.id}-${key}`,processId:process.id,status:'CLIENT-EVIDENCED',clientEvidenceStatus:workspaceFact.status,title:label,explanation:text(workspaceFact[key]),basis:`Client workspace fact · ${workspaceFact.status}`,quantified:false})
  }
  return signals;
}

export function handoffPacket(edge,workspaceFacts=[]){
  const from=processById(edge.from),to=processById(edge.to);if(!from||!to)return null;
  const fromIds=splitDot(from.identifiers),toIds=splitDot(to.identifiers),sharedIds=shared(fromIds,toIds),sharedObjects=shared(from.outputs||[],to.inputs||[]);
  const fromFact=workspaceFacts.find(x=>x.processId===from.id),toFact=workspaceFacts.find(x=>x.processId===to.id);
  return {
    id:`handoff-${edge.id}`,
    edge:{...edge,semantic:RELATIONSHIP_SEMANTICS[edge.type]||'Governed relationship.'},
    from:{id:from.id,label:from.label,actor:from.performer||from.actor,owner:from.owner,systemAuthority:from.authoritySystem,producerSystems:systemParts(from.producer),stateAfter:from.after,custody:from.custody},
    to:{id:to.id,label:to.label,actor:to.performer||to.actor,owner:to.owner,systemAuthority:to.authoritySystem,consumerSystems:systemParts(to.consumers),stateBefore:to.before,custody:to.custody},
    physical:{status:(text(from.custody)||text(to.custody))?'EXPLICIT_PROCESS_CONTEXT':'NOT_MODELED',fromCustody:text(from.custody)||'NOT_MODELED',toCustody:text(to.custody)||'NOT_MODELED'},
    information:{event:text(from.event)||'NOT_MODELED',outputObjects:from.outputs||[],inputObjects:to.inputs||[],sharedObjects,sharedObjectStatus:sharedObjects.length?'EXPLICIT_OBJECT_CONTINUITY':'NOT_MODELED'},
    data:{producerIdentifiers:fromIds,consumerIdentifiers:toIds,sharedIdentifiers:sharedIds,fieldLevelStatus:sharedIds.length?'EXPLICIT_MODEL_IDENTIFIERS':'NOT_MODELED',guardrail:'Identifiers are shown only when explicitly present in the Road LTL model. No EDI/API payload fields are inferred.'},
    financial:{from:text(from.financial)||'NOT_MODELED',to:text(to.financial)||'NOT_MODELED',status:(text(from.financial)||text(to.financial))?'EXPLICIT_PROCESS_CONTEXT':'NOT_MODELED'},
    controls:{decision:text(from.decision)||'NOT_MODELED',rule:text(from.rule)||'NOT_MODELED',control:text(from.control)||'NOT_MODELED',downstreamTrigger:text(to.trigger)||'NOT_MODELED'},
    evidence:{generated:text(from.evidence)||'NOT_MODELED',downstreamRequirement:text(to.before)||'NOT_MODELED'},
    lineage:{from:text(from.lineage)||'NOT_MODELED',to:text(to.lineage)||'NOT_MODELED'},
    risks:uniq([...riskSignalsForProcess(from,fromFact),...riskSignalsForProcess(to,toFact)].map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)),
    provenance:{from:{provenance:from.provenance,sourceRelationship:from.sourceMap,sources:sourceRefs(from)},to:{provenance:to.provenance,sourceRelationship:to.sourceMap,sources:sourceRefs(to)}},
    client:{fromStatus:fromFact?.status||'REFERENCE_ONLY',toStatus:toFact?.status||'REFERENCE_ONLY',guardrail:'REFERENCE_ONLY and UNKNOWN are never promoted to client truth by the simulator.'}
  }
}

export function stepPacket(processId,{context={},workspaceFacts=[]}={}){
  const p=processById(processId);if(!p)return null;const fact=workspaceFacts.find(x=>x.processId===p.id);const applicability=evaluateApplicability(p,context);
  return {
    id:p.id,label:p.label,phase:p.phase,pathType:p.pathType,
    state:{before:p.before,after:p.after},trigger:p.trigger,event:p.event,decision:p.decision,rule:p.rule,control:p.control,clock:p.clock,action:p.action,evidence:p.evidence,outcome:p.outcome,
    actor:{performer:p.performer||p.actor,owner:p.owner,decisionAuthority:p.decisionAuthority,custody:p.custody,exceptionOwner:p.exceptionOwner},
    systems:{authoritySystem:p.authoritySystem,authorityObject:p.authorityObject,producer:p.producer,consumers:p.consumers,interface:p.interface},
    data:{identifiers:splitDot(p.identifiers),inputs:p.inputs||[],outputs:p.outputs||[],lineage:p.lineage,fieldLevelGuardrail:'Only explicit identifiers and canonical objects are displayed. Unmodeled payload fields remain NOT_MODELED.'},
    financial:p.financial||'NOT_MODELED',
    relationships:{incoming:incoming(p.id).map(e=>({...e,semantic:RELATIONSHIP_SEMANTICS[e.type]})),outgoing:relationshipOptions(p.id)},
    risks:riskSignalsForProcess(p,fact),
    applicability,
    provenance:{provenance:p.provenance,sourceRelationship:p.sourceMap,claimBoundary:p.claimBoundary,sources:sourceRefs(p)},
    client:{status:fact?.status||'REFERENCE_ONLY',clientLabel:fact?.clientLabel||'',systemName:fact?.systemName||'',evidenceText:fact?.evidenceText||'',unknown:!fact||['REFERENCE_ONLY','UNKNOWN'].includes(fact.status)}
  }
}

export function compareTwin(workspace={}){
  const m=getModel(),asIs=workspace?.asIs?.facts||[],toBe=workspace?.toBe?.facts||[];
  return m.processes.map(p=>{const a=asIs.find(x=>x.processId===p.id),t=toBe.find(x=>x.processId===p.id);const asStatus=a?.status||'REFERENCE_ONLY',toStatus=t?.status||'UNKNOWN';let change='NO_TO_BE_DEFINED';if(t){change=JSON.stringify(a||{})===JSON.stringify(t||{})?'UNCHANGED':'PROPOSED_CHANGE'}return {processId:p.id,label:p.label,reference:'GOVERNED_REFERENCE',asIs:{status:asStatus,label:a?.clientLabel||'',system:a?.systemName||'',unknown:['REFERENCE_ONLY','UNKNOWN'].includes(asStatus)},toBe:{status:toStatus,label:t?.clientLabel||'',system:t?.systemName||'',proposed:!!t},change,guardrail:'A difference from the reference is not automatically a gap or defect.'}})
}

export function buildSimulation({context={},workspace={}}={}){
  const journey=standardJourney();const facts=workspace?.asIs?.facts||[];
  const steps=journey.map(p=>stepPacket(p.id,{context,workspaceFacts:facts}));
  const allHandoffs=edges().map(e=>handoffPacket(e,facts)).filter(Boolean);
  const standardHandoffs=[];for(let i=0;i<journey.length-1;i++){const e=edges().find(x=>x.from===journey[i].id&&x.to===journey[i+1].id&&x.type==='PRECEDES');if(!e)throw new Error(`Missing PRECEDES handoff ${journey[i].id} -> ${journey[i+1].id}`);standardHandoffs.push(handoffPacket(e,facts))}
  const processPackets=getModel().processes.map(p=>stepPacket(p.id,{context,workspaceFacts:facts}));
  const processMap=Object.fromEntries(processPackets.map(p=>[p.id,p]));
  const branches=Object.fromEntries(getModel().processes.map(p=>[p.id,relationshipOptions(p.id).filter(x=>x.type!=='PRECEDES')]));
  const exceptions={};
  for(const p of journey){const entry=outgoing(p.id).find(e=>e.type==='TRIGGERS'&&processById(e.to)?.pathType==='EXCEPTION');if(!entry)continue;const escalation=outgoing(entry.to).find(e=>e.type==='ESCALATES_TO');const recoveries=escalation?outgoing(escalation.to).filter(e=>e.type==='RECOVERS_TO'):[];exceptions[p.id]={entry:{...entry,semantic:RELATIONSHIP_SEMANTICS[entry.type]},detection:processMap[entry.to],escalation:escalation?{...escalation,semantic:RELATIONSHIP_SEMANTICS[escalation.type]}:null,recovery:escalation?processMap[escalation.to]:null,recoveryOptions:recoveries.map(e=>({...e,semantic:RELATIONSHIP_SEMANTICS[e.type],target:processMap[e.to]})),guardrail:recoveries.length>1?'Multiple governed recovery points exist; the simulator must not choose one without user/scenario context.':'Recovery follows the explicit governed relationship.'}}
  return {
    release:'Atlas Intelligence v0.6.6',
    model:'Reference Execution Digital Twin',
    context:normalizeContext(context),
    standardJourney:steps,
    processPackets,
    processMap,
    standardHandoffs,
    allHandoffs,
    branches,
    exceptions,
    compare:compareTwin(workspace),
    counts:{processes:getModel().processes.length,standardProcesses:journey.length,processFlowEdges:getModel().processFlowEdges.length,handoffs:allHandoffs.length,entityNodes:getModel().entityNodes.length,ontologyEdges:getModel().ontologyEdges.length,executionTransitions:getModel().executionTransitions.length},
    guardrails:{deterministicPaths:true,llmSelectsPaths:false,atlasWrites:false,unmodeledFieldsRemainUnknown:true,riskQuantificationRequiresEvidence:true,referenceOnlyIsNotClientTruth:true,differenceIsNotGap:true}
  };
}
