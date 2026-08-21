import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {verifyModelIntegrity,getModel,getIntegrityManifest} from '../lib/atlas/store.js';
import {buildSimulation} from '../lib/simulation/engine.js';
import {resolveCanonical} from '../lib/atlas/canonical.js';
import {assessQuery} from '../lib/intake/trust-gate.js';
import {validateUiActions} from '../lib/runtime/ui-actions.js';
import {run} from '../lib/agents/orchestrator.js';

const cwd=process.cwd(),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(cwd,p))).digest('hex');
const manifest=getIntegrityManifest(),integrity=verifyModelIntegrity(),model=getModel();
assert.equal(integrity.ok,true,'Frozen integrity must pass');
assert.deepEqual({p:model.processes.length,e:model.processFlowEdges.length,n:model.entityNodes.length,o:model.ontologyEdges.length,t:model.executionTransitions.length,s:model.sources.length},{p:22,e:39,n:220,o:176,t:22,s:29});
assert.equal(sha('public/atlas.html'),manifest.additiveV623.sha256,'V6.2.3 deployed Atlas changed');
assert.equal(sha('data/atlas-constitution-v6.2.3.json'),manifest.constitution.sha256,'Constitution changed');
assert.equal(sha('data/road-ltl-v1.2-model.json'),manifest.extractedModel.sha256,'Road LTL model changed');

const sim=buildSimulation({context:{role:'carrier',movement:'mp-line-haul',node:'node-cross-dock'}});
assert.equal(sim.standardJourney.length,13);assert.equal(sim.allHandoffs.length,39);assert.equal(sim.guardrails.llmSelectsPaths,false);assert.equal(sim.guardrails.unmodeledFieldsRemainUnknown,true);
for(const h of sim.allHandoffs){assert.equal(h.edge.from,h.from.id);assert.equal(h.edge.to,h.to.id);assert.ok(h.edge.semantic);assert.ok(['EXPLICIT_MODEL_IDENTIFIERS','NOT_MODELED'].includes(h.data.fieldLevelStatus));for(const r of h.risks||[])assert.equal(r.quantified,false)}
assert.equal(sim.exceptions['LTL-08'].recoveryOptions.length,3);assert.match(sim.exceptions['LTL-08'].guardrail,/must not choose/i);

const bare=resolveCanonical('what does OTHER mean?',{});assert.equal(bare.ambiguous,true);assert.equal(bare.best,null);
const clicked=resolveCanonical('what does OTHER mean?',{lastSelection:{text:'OTHER_LTL_KNOWLEDGE',scope:'Road LTL V1.2'}});assert.equal(clicked.best?.id,'ui-other-ltl-knowledge');
assert.equal(assessQuery({text:'explain the page',atlasContext:{page:'Road LTL V1.2'}}).decision,'ACCEPT');
const pageSummary=await run('explain the page in short',{context:{atlasContext:{page:'Road LTL V1.2',roadLtl:{open:true}}}});assert.equal(pageSummary.meta.primaryIntent,'PAGE_SUMMARY');assert.match(pageSummary.answer,/Road LTL execution model/i);assert.doesNotMatch(pageSummary.answer,/quarantined/i);
const invalid=validateUiActions([{type:'FOCUS_PROCESS',processId:'LTL-99'},{type:'EXECUTE_JAVASCRIPT'},{type:'SELECT_HANDOFF',edgeId:'BAD'}]);assert.equal(invalid.length,0);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||e.name==='.git'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const runtimeFiles=[...walk(path.join(cwd,'app')),...walk(path.join(cwd,'lib'))];
const forbiddenWrite=/\b(?:writeFile|writeFileSync|unlink|unlinkSync|rmSync|appendFile|createWriteStream|renameSync)\b/;
for(const f of runtimeFiles){const s=fs.readFileSync(f,'utf8');assert.doesNotMatch(s,forbiddenWrite,`Write primitive in ${path.relative(cwd,f)}`)}
const browserFiles=walk(path.join(cwd,'app')).filter(f=>/\.(?:js|jsx|ts|tsx)$/.test(f));const secretPattern=/(AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^<\s])/;for(const f of browserFiles)assert.doesNotMatch(fs.readFileSync(f,'utf8'),secretPattern,`Secret-like value in ${path.relative(cwd,f)}`);
assert.equal(fs.existsSync(path.join(cwd,'.env')),false,'.env must not ship');assert.equal(fs.existsSync(path.join(cwd,'node_modules')),false,'node_modules must not ship');
const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'));assert.equal(pkg.version,'0.6.6');assert.equal(pkg.name,'atlas-integrated-v6.2.3-intelligence-v0.6.6');
const readme=fs.readFileSync(path.join(cwd,'README.md'),'utf8');assert.match(readme,/Atlas Intelligence v0\.6\.6/);assert.doesNotMatch(readme,/Atlas Intelligence v0\.6\.5/);
const page=fs.readFileSync(path.join(cwd,'app/page.js'),'utf8'),studio=fs.readFileSync(path.join(cwd,'app/components/SimulationStudio.js'),'utf8');for(const required of ['ACTIVE CONTEXT','Apply & collapse context','Edit context','Simulation Studio','Atlas Intelligence v0.6.6','Minimize Atlas Intelligence'])assert.ok(page.includes(required),required);for(const required of ['Handoff provenance','Risk signals at this handoff','Exception simulation','REFERENCE_ONLY','prefers-reduced-motion'])assert.ok(studio.includes(required),required);
console.log(JSON.stringify({stage6:'PASS',integrity:true,modelCounts:sim.counts,standardJourney:sim.standardJourney.map(x=>x.id),packageVersion:pkg.version,files:walk(cwd).length},null,2));
