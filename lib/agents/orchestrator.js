import {retrieve} from '../atlas/search.js';
import {retrieveFullAtlas} from '../atlas/full-search.js';
import {getModel,processById,sourceById,verifyModelIntegrity} from '../atlas/store.js';
import {compareProcesses,pathImpact} from '../atlas/graph.js';
import {resolveCanonical,linkedProcessIds,explainCanonical} from '../atlas/canonical.js';
import {searchConstitution,constitutionSummary} from '../atlas/constitution.js';
import {standardJourney,stepPacket,handoffPacket,riskSignalsForProcess,RELATIONSHIP_SEMANTICS} from '../simulation/engine.js';
import {validateUiActions} from '../runtime/ui-actions.js';
import {auditResponse} from './audit.js';
import {synthesize} from '../llm/gateway.js';

export function classifyPrimaryIntent(q=''){
  const s=String(q).trim().toLowerCase();
  if(/(?:explain|summari[sz]e|describe|what is)\s+(?:this\s+|the\s+|current\s+)?(?:page|screen|view)\b/.test(s)||/^explain (?:the )?page(?: in short)?$/.test(s))return 'PAGE_SUMMARY';
  if(/(?:explain|summari[sz]e|describe)\s+(?:this\s+|the\s+|current\s+)?section\b/.test(s))return 'SECTION_SUMMARY';
  if(/what (?:is|does) (?:the )?current context|explain (?:the )?current context|what context/.test(s))return 'CURRENT_CONTEXT_EXPLANATION';
  if(/what (?:data|information|identifiers?|objects?) (?:is|are|gets?|moves?|move|exchanged|passed)|data exchange|what gets handed|what is exchanged/.test(s))return 'DATA_EXCHANGE_QUERY';
  if(/handoff|hand[- ]?off/.test(s))return 'HANDOFF_EXPLANATION';
  if(/what (?:is )?happening here|what happens here|what is this step doing|current step/.test(s))return 'CURRENT_STEP_EXPLANATION';
  if(/what happens next|what is next|next step/.test(s))return 'NEXT_STEP_QUERY';
  if(/what happens if|what if|if .* (?:missing|fails|blocked|rejected|unavailable)/.test(s))return 'WHAT_IF_QUERY';
  if(/why (?:is )?this risky|what (?:can|could) go wrong|risk here|risks? (?:here|at this step)/.test(s))return 'RISK_QUERY';
  if(/^(?:play|start|run) (?:the )?simulation|simulate (?:the )?(?:journey|flow)|open simulation/.test(s))return 'SIMULATION_PLAY';
  if(/^(?:pause|stop) (?:the )?simulation/.test(s))return 'SIMULATION_PAUSE';
  if(/^(?:next|step forward)(?: step)?$/.test(s))return 'SIMULATION_NEXT';
  if(/^(?:previous|back|step back)(?: step)?$/.test(s))return 'SIMULATION_PREVIOUS';
  return 'GENERAL_ATLAS_QUERY';
}

export function routeIntents(q){
  const s=String(q||'').toLowerCase(),a=[],primary=classifyPrimaryIntent(q);
  if(primary==='PAGE_SUMMARY')a.push('pageSummary','explainer');
  if(primary==='SECTION_SUMMARY')a.push('sectionSummary','explainer');
  if(['CURRENT_STEP_EXPLANATION','NEXT_STEP_QUERY','HANDOFF_EXPLANATION','DATA_EXCHANGE_QUERY'].includes(primary))a.push('simulator','explainer');
  if(primary==='WHAT_IF_QUERY')a.push('simulator','exception','impact','explainer');
  if(primary==='RISK_QUERY')a.push('simulator','risk');
  if(primary.startsWith('SIMULATION_'))a.push('simulator','navigator');
  if(/what (?:is|does)|meaning|signif|explain|define|what's|whats|how (?:was|is|do)|methodology|provenance|source-native|source native|crosswalk|taxonomy|ontology|walkthrough/.test(s))a.push('explainer');
  if(/source|evidence|why|support|provenance|cite/.test(s))a.push('evidence');
  if(/compare|difference|versus|\bvs\b/.test(s))a.push('compare');
  if(/play|simulate|walk through|end.?to.?end|sequence|step through/.test(s))a.push('simulator');
  if(/source conflict|sources disagree|conflict between sources|framework difference/.test(s))a.push('sourceConflict','evidence');
  if(/exception|fail|failure|recovery|escalat|retry|missing|refusal/.test(s))a.push('exception');
  if(/upstream|downstream|impact|affect|consequence/.test(s))a.push('impact');
  if(/system|tms|wms|erp|interface|producer|consumer/.test(s))a.push('systems');
  if(/actor|owner|owns|perform|performs|custody|responsib|decision authority/.test(s))a.push('actors');
  if(/document|data|identifier|lineage|pod|proof of delivery|invoice|bol|eb ol|bill of lading|track|trace|follow/.test(s))a.push('lineage');
  if(/regulat|jurisdiction|dangerous|hazmat|cmr|customs|bonded/.test(s))a.push('regulatory');
  if(/enterprise|financial|procure|order|master data|customer/.test(s))a.push('enterprise');
  if(/opportunit|white.?space|automate|ai use case/.test(s))a.push('opportunity','solution');
  if(/risk|control|approval|compliance/.test(s))a.push('risk');
  if(/coverage|complete|missing from atlas|research required/.test(s))a.push('coverage');
  if(/show|highlight|open|where|trace|track|focus|follow/.test(s))a.push('navigator');
  if(/client|workspace|confirmed|observed|unknown|mapped|operating model|digital twin|as-is|current state/.test(s))a.push('clientMapping');
  if(/operating model|digital twin|unknown|discovery|what do we know/.test(s))a.push('discovery');
  return [...new Set(a.length?a:['atlas'])];
}

function idsIn(q){return [...new Set((String(q).match(/\bLTL-\d{2}\b/ig)||[]).map(x=>x.toUpperCase()))]}
function sourceLines(p){return (p.sourceIds||[]).map(id=>sourceById(id)).filter(Boolean).map(s=>({id:s.id,title:s.title}))}
function processEvidence(p){return {id:p.id,label:p.label,parent:p.parentLabel||p.parent,a3ParentId:p.a3ParentId,a3ParentLabel:p.a3ParentLabel,phase:p.phase,pathType:p.pathType,provenance:p.provenance,sourceMap:p.sourceMap,variant:p.variant,trigger:p.trigger,event:p.event,before:p.before,after:p.after,exceptionOwner:p.exceptionOwner,escalation:p.escalation,recovery:p.recovery,authoritySystem:p.authoritySystem,authorityObject:p.authorityObject,producer:p.producer,consumers:p.consumers,interface:p.interface,performer:p.performer||p.actor,owner:p.owner,decisionAuthority:p.decisionAuthority,custody:p.custody,identifiers:p.identifiers,lineage:p.lineage,inputs:p.inputs,outputs:p.outputs,rule:p.rule,control:p.control,decision:p.decision,action:p.action,evidence:p.evidence,claimBoundary:p.claimBoundary,upstream:p.upstream,downstream:p.downstream,lenses:p.lenses,outcome:p.outcome,confidenceModel:p.confidenceModel,sources:sourceLines(p)}}
function getProcesses(q,hits){const explicit=idsIn(q);return explicit.map(processById).filter(Boolean).concat(hits.filter(h=>h.kind==='process').map(h=>h.item)).filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i).slice(0,6)}
function standardFlow(){return standardJourney()}
function deterministicFullAtlasAnswer(fullHits=[]){if(!fullHits.length)return {answer:"I couldn't find sufficient evidence for that in the governed current Atlas.",uiActions:[]};const lines=['Governed current-Atlas evidence (read-only):'];for(const h of fullHits.slice(0,4))lines.push(`${h.id}: ${h.text.replace(/\s+/g,' ').slice(0,900)}`);lines.push('READ-ONLY GUARDRAIL: this evidence comes from the frozen integrated Atlas. Intelligence may explain or recommend, but cannot change Atlas content. Corrections must be manually governed by the Atlas administrator.');return {answer:lines.join('\n\n'),uiActions:[]}}
function processScore(p,q){const s=String(q).toLowerCase(),tokens=s.match(/[a-z0-9]+/g)||[];let n=0;const label=(p.label||'').toLowerCase(),io=[...(p.inputs||[]),...(p.outputs||[])].join(' ').toLowerCase();for(const t of tokens){if(t.length<4)continue;if(label.includes(t))n+=8;if(io.includes(t))n+=3}return n}
function canonicalTrace(canonical,q){const linked=linkedProcessIds(canonical.best).map(processById).filter(Boolean).sort((a,b)=>processScore(b,q)-processScore(a,q));if(!linked.length)return null;const primary=linked[0],g=pathImpact(primary.id),ids=[primary.id,...linked.map(p=>p.id),...g.incoming.map(e=>e.from),...g.outgoing.map(e=>e.to)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,14);return {primary,ids,linked}}

function pageSummary(context={}){
  const short=String(context?.requestedQuestion||'').toLowerCase().includes('short');
  const road=!!context?.atlasContext?.roadLtl?.open||/road ltl/i.test(context?.atlasContext?.page||'')||/road-ltl/i.test(context?.atlasContext?.hash||'');
  if(road)return short?
    'This is the Road LTL execution model: it shows how an LTL shipment moves from service commitment through pickup, terminal processing, line-haul, delivery, POD, charging/billing and exception/recovery, with actors, systems, controls, evidence and applicability attached to each step.':
    'This page is the governed Road LTL execution model. Read it as an operating journey: commercial eligibility and commitment create the shipment; pickup and terminal processes establish custody and load state; line-haul and destination processes move and prepare freight; delivery closes custody; charge calculation and settlement close the financial obligation; explicit exception/regulatory/identity/customer-resolution processes sit around that base spine when their conditions apply. Each process card exposes trigger, state before/after, event, decision/rule/control, actor, systems, objects, evidence, applicability and source/provenance. Use Simulation Studio to watch the governed path run rather than reading every card at once.';
  return short?
    'Page 0 is the Atlas control tower. Select Mode / Service first, refine the operating context, then use the canonical domains, enterprise lenses, source-native crosswalks and planned child models to navigate the supply-chain universe without changing the underlying taxonomy.':
    'Page 0 is the global-neutral control tower for the Supply Chain / Logistics Process Atlas. Mode / Service is the primary execution lens; Operating Role, Movement Pattern, Node, Jurisdiction, Carriage Regime, Condition and Contract / Service Context refine the operating reality. The enterprise universe remains visible while applicability and emphasis change. SCOR and APQC remain source-native reference frameworks and are crosswalked rather than silently rewritten as Atlas taxonomy. The canonical Atlas spine, enterprise lenses, source/evidence universe and planned child models provide navigation; Road LTL is the currently available governed execution child. In Work mode, reference/governance sections can stay collapsed and be reopened only when you need to inspect how a statement is governed.';
}

function simulationBaseline(primary,context={}){
  const sim=context?.simulationContext||{},step=sim.activeStep||null,handoff=sim.selectedHandoff||null;
  if(primary==='SIMULATION_PLAY')return {answer:'Starting the governed Road LTL reference journey. Playback follows the deterministic PRECEDES spine; Gemini does not choose the route.',uiActions:[{type:'OPEN_SIMULATION'},{type:'SIMULATION_PLAY'}]};
  if(primary==='SIMULATION_PAUSE')return {answer:'Pausing the simulation at the current governed step.',uiActions:[{type:'SIMULATION_PAUSE'}]};
  if(primary==='SIMULATION_NEXT')return {answer:'Advancing one governed step.',uiActions:[{type:'SIMULATION_STEP',direction:'NEXT'}]};
  if(primary==='SIMULATION_PREVIOUS')return {answer:'Moving back one governed step.',uiActions:[{type:'SIMULATION_STEP',direction:'PREVIOUS'}]};
  if(!step)return {answer:'Open Simulation Studio or select a current simulation step first. I will keep the route deterministic and use Gemini only to explain the selected governed state.',uiActions:[{type:'OPEN_SIMULATION'}]};
  if(primary==='CURRENT_STEP_EXPLANATION')return {answer:`In simple English: you are at ${step.id} — ${step.label}.\n\nWhat is happening: ${step.action||'Action not modeled.'}\nTrigger: ${step.trigger||'not modeled'}\nState: ${step.state?.before||'not modeled'} → ${step.state?.after||'not modeled'}\nWho: ${step.actor?.performer||'not modeled'}\nSystem authority: ${step.systems?.authoritySystem||'not modeled'}\nWhy it matters: ${step.outcome||'Outcome not modeled.'}`,uiActions:[{type:'FOCUS_PROCESS',processId:step.id}]};
  if(primary==='NEXT_STEP_QUERY')return {answer:sim.nextStep?`Next on the governed standard spine is ${sim.nextStep.id} — ${sim.nextStep.label}. Relationship: ${sim.nextRelationship?.type||'PRECEDES'} — ${sim.nextRelationship?.semantic||RELATIONSHIP_SEMANTICS.PRECEDES}`:'This is the end of the current governed standard journey. Conditional, exception or client-specific routes are shown separately rather than appended as if mandatory.',uiActions:[]};
  if(primary==='HANDOFF_EXPLANATION'){
    if(!handoff)return {answer:'Select a handoff in Simulation Studio first. The Handoff Inspector will show actors, systems, objects, identifiers, state, evidence, controls and provenance without inventing unmodeled payload fields.',uiActions:[]};
    return {answer:`Handoff: ${handoff.from.id} → ${handoff.to.id} (${handoff.edge.type}).\nIn real life: ${handoff.edge.semantic}\nFrom: ${handoff.from.actor||'not modeled'}\nTo: ${handoff.to.actor||'not modeled'}\nShared governed objects: ${(handoff.information?.sharedObjects||[]).join(' · ')||'NOT_MODELED'}\nShared explicit identifiers: ${(handoff.data?.sharedIdentifiers||[]).join(' · ')||'NOT_MODELED'}\nEvidence leaving the upstream step: ${handoff.evidence?.generated||'NOT_MODELED'}`,uiActions:[]};
  }
  if(primary==='DATA_EXCHANGE_QUERY'){
    const target=handoff;if(!target)return {answer:`At ${step.id}, the Atlas explicitly models identifiers ${(step.data?.identifiers||[]).join(' · ')||'NOT_MODELED'}, inputs ${(step.data?.inputs||[]).join(' · ')||'NOT_MODELED'} and outputs ${(step.data?.outputs||[]).join(' · ')||'NOT_MODELED'}. Select a handoff to see what is shared with the downstream step. I will not invent EDI/API payload fields.`,uiActions:[]};
    return {answer:`Data exchange for ${target.from.id} → ${target.to.id}:\nShared canonical objects: ${(target.information?.sharedObjects||[]).join(' · ')||'NOT_MODELED'}\nShared explicit identifiers: ${(target.data?.sharedIdentifiers||[]).join(' · ')||'NOT_MODELED'}\nProducer identifiers: ${(target.data?.producerIdentifiers||[]).join(' · ')||'NOT_MODELED'}\nConsumer identifiers: ${(target.data?.consumerIdentifiers||[]).join(' · ')||'NOT_MODELED'}\nField-level status: ${target.data?.fieldLevelStatus||'NOT_MODELED'}\n\nGuardrail: ${target.data?.guardrail||'No payload inference.'}`,uiActions:[]};
  }
  if(primary==='RISK_QUERY')return {answer:(step.risks||[]).length?`Potential risk signals at ${step.id} are shown as hypotheses with provenance, not quantified facts:\n${step.risks.slice(0,6).map(r=>`- ${r.status}: ${r.title}. Basis: ${r.basis}`).join('\n')}`:`No explicit/derived risk signal is modeled for this step beyond its governed rule/control. I will not invent probability, severity or financial impact.`,uiActions:[]};
  return null;
}

function deterministicAnswer(q,procs,agents,fullHits=[],canonical=null,{primary='GENERAL_ATLAS_QUERY',context={}}={}){
  if(canonical?.ambiguous)return {answer:canonical.clarification||'I found more than one valid Atlas meaning. Please clarify which one you mean.',uiActions:[]};
  if(primary==='PAGE_SUMMARY')return {answer:pageSummary({atlasContext:context.atlasContext||{},requestedQuestion:q}),uiActions:[]};
  if(primary==='SECTION_SUMMARY'){
    const selected=context?.atlasContext?.lastSelection?.text||context?.atlasContext?.visibleHeadings?.[0];
    if(!selected)return {answer:'Which section do you want me to explain? Click the section or name it, and I will explain its purpose in plain English before showing its Atlas classification/provenance.',uiActions:[]};
    return {answer:`Current section/focus: ${selected}. I will explain this from the current Atlas context rather than guessing from a repeated keyword.`,uiActions:[]};
  }
  if(['CURRENT_STEP_EXPLANATION','NEXT_STEP_QUERY','HANDOFF_EXPLANATION','DATA_EXCHANGE_QUERY','RISK_QUERY','SIMULATION_PLAY','SIMULATION_PAUSE','SIMULATION_NEXT','SIMULATION_PREVIOUS'].includes(primary))return simulationBaseline(primary,context);
  if(primary==='WHAT_IF_QUERY'){
    const active=context?.simulationContext?.activeStep||null,p=active||(procs[0]?stepPacket(procs[0].id,{context:context?.atlasContext||{},workspaceFacts:context?.workspaceFacts||[]}):null);
    if(!p)return {answer:'I can only simulate a what-if when the relevant governed process or current simulation step can be resolved. Name/click the process or open Simulation Studio; unmodeled scenarios remain unknown.',uiActions:[]};
    const options=(p.relationships?.outgoing||[]).filter(x=>x.type!=='PRECEDES');
    const lines=[`What-if anchor: ${p.id} — ${p.label}.`,`The Atlas does not assign a probability or silently invent the outcome. It can only follow explicit governed relationships from this step.`];
    if(options.length){
      lines.push(`Governed non-standard possibilities:
${options.map(x=>`- ${x.type} → ${x.to}: ${x.semantic}`).join('\n')}`);
    }else{
      lines.push('No non-standard outgoing relationship is explicitly modeled at this step. If the condition you describe is not represented elsewhere in the governed graph, the result is UNKNOWN rather than invented.');
    }
    if(p.risks?.length){
      lines.push(`Relevant risk/control signals:
${p.risks.slice(0,5).map(r=>`- ${r.status}: ${r.title}`).join('\n')}`);
    }
    return {answer:lines.join('\n\n'),uiActions:[{type:'OPEN_SIMULATION'},{type:'FOCUS_PROCESS',processId:p.id}]};
  }
  const explainIntent=agents.includes('explainer'),traceIntent=agents.includes('lineage')&&/trace|track|follow|lineage|where/.test(String(q).toLowerCase()),clientModelRequest=agents.includes('clientMapping')&&/operating model|digital twin|as-is|current state/i.test(String(q));
  if(explainIntent&&canonical?.best){const text=explainCanonical(canonical.best);const ids=linkedProcessIds(canonical.best);return {answer:`${text}\n\nThis explanation is grounded in the current frozen Atlas vocabulary; it does not create or change Atlas content.`,uiActions:ids.length?[{type:'FOCUS_PROCESSES',processIds:ids.slice(0,12)}]:[]}}
  if(traceIntent&&canonical?.best){const tr=canonicalTrace(canonical,q);if(tr)return {answer:`${explainCanonical(canonical.best)}\n\nTrace anchor: ${tr.primary.id} — ${tr.primary.label}\nGoverned trace neighbourhood: ${tr.ids.join(' → ')}\n\nThe trace follows existing governed process/object relationships; it does not invent a new sequence.`,uiActions:[{type:'TRACE_PROCESS',processId:tr.primary.id,processIds:tr.ids}]}}
  if(!procs.length&&!agents.includes('simulator')&&!clientModelRequest)return deterministicFullAtlasAnswer(fullHits);
  const lines=[],actions=[];
  if(clientModelRequest){const flow=standardFlow();lines.push('Client operating-model request detected.','The governed Road LTL reference backbone can be loaded, but it is REFERENCE_ONLY until client-specific evidence is mapped.','No missing client fact will be invented. Upload RFP/RFI/SOP/workshop evidence or use the Client Research Agent; unresolved areas remain UNKNOWN / REFERENCE_ONLY.','Reference backbone: '+flow.map(x=>`${x.id} — ${x.label}`).join(' → '));actions.push({type:'OPEN_SIMULATION'},{type:'PLAY_EXISTING_FLOW',processIds:flow.map(x=>x.id)})}
  else if(agents.includes('simulator')){const flow=standardFlow();lines.push('Governed standard-flow walkthrough (existing Atlas PRECEDES spine; no new scenario created):');flow.forEach((x,i)=>lines.push(`${i+1}. ${x.id} — ${x.label}`));actions.push({type:'OPEN_SIMULATION'})}
  else if(agents.includes('compare')&&procs.length>=2){const c=compareProcesses(procs[0].id,procs[1].id);lines.push(`Comparison: ${c.a.id} vs ${c.b.id}`);c.differences.slice(0,10).forEach(d=>lines.push(`${d.field}:\n- ${c.a.id}: ${d.a||'not mapped'}\n- ${c.b.id}: ${d.b||'not mapped'}`));actions.push({type:'COMPARE_PROCESSES',processIds:[c.a.id,c.b.id]})}
  else {const p=procs[0];lines.push(`${p.id} — ${p.label}\nPhase/path: ${p.phase||'not mapped'} / ${p.pathType||'not mapped'}\nEvent: ${p.event||'not mapped'}\nState: ${p.before||'not mapped'} → ${p.after||'not mapped'}\nProvenance: ${p.provenance||'not mapped'}\nSource relationship: ${p.sourceMap||'not mapped'}`);actions.push({type:'FOCUS_PROCESS',processId:p.id});
    if(agents.includes('exception'))lines.push(`Exception owner: ${p.exceptionOwner||'not mapped'}\nEscalation: ${p.escalation||'not mapped'}\nRecovery: ${p.recovery||'not mapped'}`);
    if(agents.includes('systems'))lines.push(`System authority: ${p.authoritySystem||'not mapped'} for ${p.authorityObject||'not mapped'}\nProducer: ${p.producer||'not mapped'}\nConsumers: ${p.consumers||'not mapped'}\nInterface: ${p.interface||'not mapped'}`);
    if(agents.includes('actors'))lines.push(`Performer: ${p.performer||p.actor||'not mapped'}\nOwner: ${p.owner||'not mapped'}\nDecision authority: ${p.decisionAuthority||'not mapped'}\nCustody: ${p.custody||'not mapped'}`);
    if(agents.includes('lineage')){const g=pathImpact(p.id),traceIds=[p.id,...g.incoming.map(e=>e.from),...g.outgoing.map(e=>e.to)].filter((x,i,a)=>a.indexOf(x)===i);lines.push(`Identifiers: ${p.identifiers||'not mapped'}\nLineage: ${p.lineage||'not mapped'}\nInputs: ${(p.inputs||[]).join(' · ')||'not mapped'}\nOutputs: ${(p.outputs||[]).join(' · ')||'not mapped'}\nImmediate trace: ${traceIds.join(' → ')}`);actions.push({type:'TRACE_PROCESS',processId:p.id,processIds:traceIds})}
    if(agents.includes('impact')){const g=pathImpact(p.id);lines.push(`Incoming relationships: ${g.incoming.map(e=>`${e.from} ${e.type} ${e.to}`).join(' · ')||'none'}\nOutgoing relationships: ${g.outgoing.map(e=>`${e.from} ${e.type} ${e.to}`).join(' · ')||'none'}\nMapped upstream: ${p.upstream||'not mapped'}\nMapped downstream: ${p.downstream||'not mapped'}`);actions.push({type:'TRACE_PROCESS',processId:p.id})}
    if(agents.includes('risk'))lines.push(`Control: ${p.control||'not mapped'}\nDecision: ${p.decision||'not mapped'}\nEvidence: ${p.evidence||'not mapped'}\nClaim boundary: ${p.claimBoundary||'not mapped'}`);
    if(agents.includes('evidence')||agents.includes('regulatory')||agents.includes('sourceConflict'))lines.push(`Claim boundary: ${p.claimBoundary||'not mapped'}\nSources: ${sourceLines(p).map(s=>`${s.id} — ${s.title}`).join('; ')||'No explicit source record mapped'}`);
    if(agents.includes('sourceConflict'))lines.push('Source-conflict check: frameworks are not silently reconciled; differences are surfaced for human review.');
    if(agents.includes('enterprise'))lines.push(`Enterprise lenses: ${(p.lenses||[]).join(', ')||'not mapped'}\nOutcome: ${p.outcome||'not mapped'}`);
    if(agents.includes('coverage'))lines.push(`Coverage status: structural=${p.confidenceModel?.structuralConfidence||'not mapped'}; execution=${p.confidenceModel?.executionDetailConfidence||'not mapped'}; applicability=${p.confidenceModel?.applicabilityConfidence||'not mapped'}`);
    if(agents.includes('opportunity'))lines.push(`ADVISORY HYPOTHESIS: inspect manual handoffs, exception ownership, evidence gaps, repeated reconciliation and decision latency around ${p.id}.`);
    if(agents.includes('solution'))lines.push('Solution-pattern classification is advisory only and requires human validation.');
  }
  lines.push('READ-ONLY GUARDRAIL: intelligence may highlight, compare, trace, simulate and recommend, but cannot change the frozen Page 0/LTL model. Corrections must be manually applied by the Atlas administrator.');return {answer:lines.join('\n\n'),uiActions:actions}
}

function workspaceEvidence(context={},procs=[]){const facts=context?.workspaceFacts||[],ids=new Set(procs.map(p=>p.id));return facts.filter(f=>ids.has(f.processId)||!procs.length).slice(0,30).map(f=>({processId:f.processId,status:f.status,clientLabel:f.clientLabel||'',systemName:f.systemName||'',evidenceText:f.evidenceText||''}))}
function safeSimulationContext(context={}){const s=context?.simulationContext;if(!s)return null;return {open:!!s.open,view:s.view||'',activeIndex:s.activeIndex??null,activeStep:s.activeStep||null,nextStep:s.nextStep||null,nextRelationship:s.nextRelationship||null,selectedHandoff:s.selectedHandoff||null,flowLayers:s.flowLayers||{},twinLayer:s.twinLayer||'REFERENCE'}}

export async function run(message,{context={}}={}){
  const model=getModel(),primary=classifyPrimaryIntent(message),specialist=routeIntents(message),skipCanonical=['PAGE_SUMMARY','SECTION_SUMMARY','CURRENT_STEP_EXPLANATION','NEXT_STEP_QUERY','HANDOFF_EXPLANATION','DATA_EXCHANGE_QUERY','RISK_QUERY','SIMULATION_PLAY','SIMULATION_PAUSE','SIMULATION_NEXT','SIMULATION_PREVIOUS'].includes(primary);
  const canonical=skipCanonical?{best:null,ambiguous:false,candidates:[],resolution:'CONTEXT_INTENT'}:resolveCanonical(message,context.atlasContext||{}),hits=retrieve(message,12),constitutionHits=searchConstitution(message,8);
  const preferFull=/page\s*0|ecosystem|navigator|canonical entity registry|enterprise lens|page-zero|movement pattern|operating role|carriage regime|jurisdiction|reference universe|source native|source-native|authority domain|methodology|how to read|crosswalk|provenance|taxonomy|ontology/i.test(String(message));
  let procs=preferFull||skipCanonical?[]:getProcesses(message,hits);if((specialist.includes('lineage')||specialist.includes('explainer'))&&canonical.best){const linked=linkedProcessIds(canonical.best).map(processById).filter(Boolean);if(linked.length)procs=linked.slice(0,6)}
  const fullHits=(skipCanonical||procs.length&&!specialist.includes('explainer'))?[]:retrieveFullAtlas(message,5),runtimeContext={...context,simulationContext:safeSimulationContext(context)};
  const base=deterministicAnswer(message,procs,specialist,fullHits,canonical,{primary,context:runtimeContext});
  if(canonical.ambiguous){const payload={answer:base.answer,uiActions:[],meta:{primaryIntent:primary,agentPath:['orchestrator','explainer','audit'],specialists:['explainer'],canonical:null,ambiguity:{required:true,candidates:canonical.candidates?.map(x=>({id:x.id,label:x.label,kind:x.kind}))||[]},grounding:'ATLAS_V6.2.3_GUIDE_OVER_FROZEN_V6.2.2_PLUS_LTL_V1.2',llmStatus:'NOT_INVOKED_AMBIGUITY',atlasWrites:false,integrity:verifyModelIntegrity(),evidencePacketCounts:{processes:0,atlasExcerpts:0,constitutionEntries:constitutionHits.length,clientFacts:0}}};const audit=auditResponse(payload);payload.meta.audit=audit;return payload}
  const sim=safeSimulationContext(context),packet={grounding:'ATLAS_V6.2.3_GUIDE_OVER_FROZEN_V6.2.2_PLUS_LTL_V1.2',primaryIntent:primary,constitution:constitutionSummary(),constitutionEntries:constitutionHits.map(x=>({id:x.id,label:x.label,kind:x.kind,namespace:x.namespace,definition:x.definition,plainEnglish:x.plainEnglish,provenance:x.provenance,origin:x.origin})),canonical:canonical.best?{id:canonical.best.id,label:canonical.best.label,kind:canonical.best.kind,namespace:canonical.best.namespace,definition:canonical.best.definition,plainEnglish:canonical.best.plainEnglish,origin:canonical.best.origin,provenance:canonical.best.provenance,section:canonical.best.section,relatedProcessIds:linkedProcessIds(canonical.best)}:null,atlasContext:context.atlasContext||{},simulationContext:sim,processes:procs.map(processEvidence),atlasExcerpts:fullHits.map(h=>({id:h.id,text:h.text})),clientWorkspaceFacts:workspaceEvidence(context,procs),rules:{atlasWrites:false,frozenFoundation:'Page 0 V6.2.2 + Road LTL V1.2',guideLayer:'V6.2.3 additive only',unknownsRemainUnknown:true,referenceOnlyIsNotClientTruth:true,differenceIsNotGap:true,manualCorrectionOnly:true,sourceNativeMustRemainDistinctFromCrosswalkAndSynthesis:true,ambiguityRequiresClarification:true,deterministicSimulationRoutes:true,llmMayExplainButNotSelectPath:true,unmodeledPayloadFieldsMustNotBeInvented:true,riskQuantificationRequiresEvidence:true}};
  const synth=await synthesize({question:message,evidencePacket:packet,deterministicAnswer:base.answer});const payload={answer:synth.text,uiActions:validateUiActions(base.uiActions),meta:{primaryIntent:primary,agentPath:['orchestrator',...specialist,'audit'],specialists:specialist,canonical:packet.canonical,grounding:packet.grounding,modelCounts:{processes:model.processes.length,sources:model.sources.length,edges:model.processFlowEdges.length},llm:synth.capability,llmStatus:synth.status,atlasWrites:false,integrity:verifyModelIntegrity(),evidencePacketCounts:{processes:packet.processes.length,atlasExcerpts:packet.atlasExcerpts.length,constitutionEntries:packet.constitutionEntries.length,clientFacts:packet.clientWorkspaceFacts.length,simulation:sim?1:0}}};const audit=auditResponse(payload);payload.meta.audit=audit;if(!audit.passed)return {answer:'Atlas Intelligence blocked this response because a guardrail or integrity check failed.',uiActions:[],meta:payload.meta};return payload
}
