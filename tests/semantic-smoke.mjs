import assert from 'node:assert/strict';
import {getModel,verifyModelIntegrity} from '../lib/atlas/store.js';
import {resolveCanonical,linkedProcessIds} from '../lib/atlas/canonical.js';
import {getConstitution,searchConstitution} from '../lib/atlas/constitution.js';
import {assessInput} from '../lib/intake/trust-gate.js';
import {run} from '../lib/agents/orchestrator.js';
import {llmCapability} from '../lib/llm/gateway.js';
const m=getModel(),ctx={visibleHeadings:['Execution Context','Jurisdiction'],activeState:['Page 0 · Ecosystem']};
for(const p of m.processes){const r=await run(`trace ${p.id}`,{context:{atlasContext:ctx}});assert.equal(r.meta.audit.passed,true,p.id);assert.ok(r.uiActions.some(a=>a.type==='TRACE_PROCESS'&&a.processIds?.includes(p.id)),p.id)}
for(const e of m.entityNodes){const c=resolveCanonical(`trace ${e.id}`,ctx);assert.ok(c.best,`canonical ${e.id}`);assert.ok(linkedProcessIds(c.best).includes(e.processId),`link ${e.id} -> ${e.processId}`)}
const objectIds=[...new Set(m.processes.flatMap(p=>[...(p.inputs||[]),...(p.outputs||[])]))];for(const id of objectIds){const c=resolveCanonical(`trace ${id}`,ctx);assert.ok(c.best,`object ${id}`);assert.ok(linkedProcessIds(c.best).length>0,`object link ${id}`)}
const traces={POD:'LTL-13',invoice:'LTL-17',claim:'LTL-18',BOL:'LTL-03',rate:'LTL-02'};for(const [term,id] of Object.entries(traces)){const r=await run(`trace ${term}`,{context:{atlasContext:ctx}});const a=r.uiActions.find(x=>x.type==='TRACE_PROCESS');assert.equal(a?.processId,id,`${term} anchor`);assert.equal(r.meta.audit.passed,true)}
// Bare OTHER must never be guessed.
const ambiguous=resolveCanonical('what does OTHER signify on the page?',{});assert.equal(ambiguous.ambiguous,true);assert.equal(ambiguous.best,null);const ar=await run('what does OTHER signify on the page?',{context:{atlasContext:{}}});assert.match(ar.answer,/do you mean/i);assert.equal(ar.meta.llmStatus,'NOT_INVOKED_AMBIGUITY');
// Exact clicked runtime state wins and must not resolve to jurisdiction.
const otherCtx={lastSelection:{id:'',text:'OTHER_LTL_KNOWLEDGE',scope:'Road LTL V1.2'},visibleHeadings:['Network movement']};const oc=resolveCanonical('what does OTHER mean?',otherCtx);assert.equal(oc.best?.id,'ui-other-ltl-knowledge');const or=await run('what does OTHER mean?',{context:{atlasContext:otherCtx}});assert.match(or.answer,/other parts of the LTL operating model/i);assert.doesNotMatch(or.answer,/jurisdiction option/i);
// Exact clicked jurisdiction resolves separately.
const jurCtx={lastSelection:{id:'jur-national-corridor',text:'Other national / corridor',scope:'Page 0 / Integrated Atlas'},visibleHeadings:['Jurisdiction']};const jc=resolveCanonical('what does OTHER mean?',jurCtx);assert.equal(jc.best?.id,'jur-national-corridor');
// Methodology/guide questions must use constitution knowledge.
const c=getConstitution();assert.equal(c.release,'V6.2.3');assert.ok(c.methodology.length>=10);assert.ok(searchConstitution('how was the Atlas built').length>0);const method=await run('how was the Atlas built?');assert.equal(method.meta.audit.passed,true);assert.ok(method.meta.evidencePacketCounts.constitutionEntries>0);assert.match(method.answer,/source-native|methodology|Atlas/i);
const explain={
 'what is movement pattern?':'Movement pattern',
 'what is source-native backbone?':'Source-native backbone',
 'what is governed evidence universe?':'Governed evidence universe',
 'what is authority domain?':'Authority domain',
 'what is a source category?':'Source category',
 'what is carriage regime?':'Carriage regime',
 'what is enterprise lens?':'Enterprise lens',
 'what does OTHER_LTL_KNOWLEDGE mean?':'OTHER_LTL_KNOWLEDGE',
 'what does ATLAS CHILD SYNTHESIS mean?':'ATLAS CHILD SYNTHESIS'
};
for(const [q,label] of Object.entries(explain)){assert.equal(assessInput({text:q,atlasContext:ctx}).decision,'ACCEPT',q);const r=await run(q,{context:{atlasContext:ctx}});assert.match(r.answer,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),q);assert.equal(r.meta.audit.passed,true)}
for(const [arr,key] of [[m.roles,'name'],[m.movements,'name'],[m.nodes,'name'],[m.jurisdictions,'name'],[m.regimes,'name'],[m.conditions,'name'],[m.contracts,'name'],[m.lenses,'name'],[m.views,'name'],[m.sources,'title']])for(const x of arr){const q=`what is ${x[key]}`;assert.equal(assessInput({text:q,atlasContext:ctx}).decision,'ACCEPT',q);{const rc=resolveCanonical(q,ctx);assert.ok(rc.best||rc.ambiguous,q)}}
const owner=await run('who owns LTL-13?');assert.ok(owner.meta.agentPath.includes('actors'));assert.match(owner.answer,/Owner: Delivery operations/);
const p8=resolveCanonical('what is LTL-08?',ctx).best;assert.equal(p8?.id,'LTL-08');assert.match(p8?.provenance||'',/ATLAS CHILD SYNTHESIS/i);assert.match(p8?.sourceRelationship||'',/crosswalk/i);
const cap=llmCapability();assert.equal(cap.requiredEnvironmentVariables.geminiKey,'GEMINI_API_KEY');assert.equal(verifyModelIntegrity().ok,true);
console.log('semantic-smoke: PASS');
