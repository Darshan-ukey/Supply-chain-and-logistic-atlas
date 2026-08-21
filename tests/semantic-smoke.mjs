import assert from 'node:assert/strict';
import {getModel,verifyModelIntegrity} from '../lib/atlas/store.js';
import {resolveCanonical,linkedProcessIds} from '../lib/atlas/canonical.js';
import {assessInput} from '../lib/intake/trust-gate.js';
import {run} from '../lib/agents/orchestrator.js';
import {llmCapability} from '../lib/llm/gateway.js';
const m=getModel(),ctx={visibleHeadings:['Execution Context','Jurisdiction'],activeState:['Page 0 · Ecosystem']};
// Every governed LTL process must be traceable by exact process ID.
for(const p of m.processes){const r=await run(`trace ${p.id}`,{context:{atlasContext:ctx}});assert.equal(r.meta.audit.passed,true,p.id);assert.ok(r.uiActions.some(a=>a.type==='TRACE_PROCESS'&&a.processIds?.includes(p.id)),p.id)}
// Every entity node must canonically resolve back to its governed process when queried by its stable ID.
for(const e of m.entityNodes){const c=resolveCanonical(`trace ${e.id}`,ctx);assert.ok(c.best,`canonical ${e.id}`);assert.ok(linkedProcessIds(c.best).includes(e.processId),`link ${e.id} -> ${e.processId}`)}
const objectIds=[...new Set(m.processes.flatMap(p=>[...(p.inputs||[]),...(p.outputs||[])]))];for(const id of objectIds){const c=resolveCanonical(`trace ${id}`,ctx);assert.ok(c.best,`object ${id}`);assert.ok(linkedProcessIds(c.best).length>0,`object link ${id}`)}
const traces={POD:'LTL-13',invoice:'LTL-17',claim:'LTL-18',BOL:'LTL-03',rate:'LTL-02'};
for(const [term,id] of Object.entries(traces)){const r=await run(`trace ${term}`,{context:{atlasContext:ctx}});const a=r.uiActions.find(x=>x.type==='TRACE_PROCESS');assert.equal(a?.processId,id,`${term} anchor`);assert.equal(r.meta.audit.passed,true)}
const explain={
 'what is movement pattern?':'Movement pattern',
 'what does OTHER signify on the page?':'Other national / corridor jurisdiction',
 'what is source-native backbone?':'Source-native backbone',
 'what is governed evidence universe?':'Governed evidence universe',
 'what is authority domain?':'Authority domain',
 'what is a source category?':'Source category',
 'what is carriage regime?':'Carriage regime',
 'what is enterprise lens?':'Enterprise lens'
};
for(const [q,label] of Object.entries(explain)){assert.equal(assessInput({text:q,atlasContext:ctx}).decision,'ACCEPT',q);const r=await run(q,{context:{atlasContext:ctx}});assert.match(r.answer,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),q);assert.equal(r.meta.audit.passed,true)}
// All native selector/source names must be accepted by trust gate + canonical resolver.
for(const [arr,key] of [[m.roles,'name'],[m.movements,'name'],[m.nodes,'name'],[m.jurisdictions,'name'],[m.regimes,'name'],[m.conditions,'name'],[m.contracts,'name'],[m.lenses,'name'],[m.views,'name'],[m.sources,'title']])for(const x of arr){const q=`what is ${x[key]}`;assert.equal(assessInput({text:q,atlasContext:ctx}).decision,'ACCEPT',q);assert.ok(resolveCanonical(q,ctx).best,q)}
const owner=await run('who owns LTL-13?');assert.ok(owner.meta.agentPath.includes('actors'));assert.match(owner.answer,/Owner: Delivery operations/);
const cap=llmCapability();assert.equal(cap.requiredEnvironmentVariables.geminiKey,'GEMINI_API_KEY');
assert.equal(verifyModelIntegrity().ok,true);
console.log('semantic-smoke: PASS');
