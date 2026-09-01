import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {RuntimeAdapterRegistry} from '../execution/core/runtime-adapter-registry.mjs';
import MalkomAdapterV1 from '../execution/adapters/malkom/malkom-adapter.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));

await import('../execution/ui/atlas-execution-flow.js');
const flow=globalThis.AtlasExecutionFlow;
assert(flow,'AtlasExecutionFlow global missing');

const defs=read('execution/runtimes/malkom/engine-suite/malkom-domainwarehouse-engine/fixtures/road-ltl/work-definitions.json');
assert.equal(defs.length,22,'Expected 22 Road LTL WorkDefinitions in owned Malkom runtime fixture');

const registry=new RuntimeAdapterRegistry();
registry.register(MalkomAdapterV1);
assert.equal(registry.list().length,1);

let canonicalGraphs=0,malkomGraphs=0,bpmnExports=0,stayEdges=0,loopGuardPaths=0,runtimeGapEdges=0;
for(const def of defs){
  const cg=flow.buildCanonicalFlow(def);assert(cg?.nodes?.length>2,`${def.id}: canonical graph too small`);assert(cg.edges.length>0,`${def.id}: canonical edges missing`);canonicalGraphs++;
  const mg=flow.buildMalkomFlow(def);assert(mg?.nodes?.length>2,`${def.id}: Malkom graph missing`);assert(mg.edges.length>0,`${def.id}: Malkom edges missing`);malkomGraphs++;
  const paths=flow.enumeratePaths(mg,{maxVisitsPerNode:2,maxDepth:64,maxPaths:1000});assert(paths.length>0,`${def.id}: no finite Malkom paths`);assert(paths.every(p=>p.nodeIds.length<=65),`${def.id}: depth guard failed`);
  stayEdges+=mg.edges.filter(e=>e.kind==='STAY_RETURN').length;
  runtimeGapEdges+=mg.edges.filter(e=>e.runtimeSupported===false).length;
  loopGuardPaths+=paths.filter(p=>p.termination==='LOOP_GUARD').length;
  const xml=flow.toBpmn(mg);assert(xml.includes('<bpmn:definitions'));assert(xml.includes('<bpmn:process'));bpmnExports++;
  const assessment=registry.assess(MalkomAdapterV1.adapterId,def,{});assert(assessment.adapter.runtime==='MALKOM_3');
  const projection=MalkomAdapterV1.project(def);assert(projection.generatedFrom.workDefinitionId);
  const verification=MalkomAdapterV1.verify(projection);assert.equal(typeof verification.valid,'boolean');
}

assert(stayEdges>0,'Expected STAY return edges across Road LTL projection');
assert(loopGuardPaths>0,'Expected loop-guard terminated paths for STAY semantics');

const ltl22=defs.find(x=>(x.sourceTask?.taskId||x.sourceTask?.sourceId)==='LTL-22');
assert(ltl22,'LTL-22 missing');
const ltl22Flow=flow.buildMalkomFlow(ltl22);
assert(ltl22Flow.edges.some(e=>e.kind==='STAY_RETURN'),'LTL-22 should retain STAY return edges');
assert(ltl22Flow.edges.some(e=>e.kind==='CANONICAL_ESCALATION'||e.kind==='RUNTIME_GAP'),'LTL-22 should expose escalation/runtime-gap semantics');

const admin=fs.readFileSync(path.join(ROOT,'admin.html'),'utf8');
assert(admin.includes('data-v2tab="flow"'),'Admin Flow Generator tab missing');
assert(admin.includes('/execution/ui/atlas-execution-flow.js'),'Admin flow runtime not loaded');
const pub=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
assert(!pub.includes('/execution/ui/atlas-execution-flow.js'),'Protected execution flow runtime leaked into public Atlas');
const vercelIgnore=fs.readFileSync(path.join(ROOT,'.vercelignore'),'utf8');
for(const protectedPath of ['execution/runtimes/','execution/adapters/','execution/core/','execution/contracts/'])assert(vercelIgnore.includes(protectedPath),`Vercel deployment must exclude protected source: ${protectedPath}`);

const apiFiles=fs.readdirSync(path.join(ROOT,'api')).filter(x=>x.endsWith('.js'));
assert.equal(apiFiles.length,8,'Execution Fabric must preserve the 8 consolidated Vercel functions');
const atlasRouter=fs.readFileSync(path.join(ROOT,'api/atlas.js'),'utf8');
assert(atlasRouter.includes('runtime-access')&&atlasRouter.includes('malkom-projections'),'Atlas router must expose capability/runtime actions');
const vercel=JSON.parse(fs.readFileSync(path.join(ROOT,'vercel.json'),'utf8'));
const rewrites=new Map((vercel.rewrites||[]).map(x=>[x.source,x.destination]));
assert(rewrites.has('/api/runtime-access')&&rewrites.has('/api/malkom-projections'),'Runtime rewrites missing');
const migration=fs.readFileSync(path.join(ROOT,'migrations/v2.1-execution-fabric.sql'),'utf8');
for(const table of ['atlas_runtime_adapters','atlas_runtime_projections','atlas_runtime_client_bindings','atlas_runtime_materializations','atlas_runtime_evidence','atlas_user_capabilities'])assert(migration.includes(table),`Execution Fabric migration missing ${table}`);
const architecture=fs.readFileSync(path.join(ROOT,'governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md'),'utf8');
assert(architecture.includes('Status:** FROZEN'));
assert(architecture.includes('One canonical Atlas execution language'));

console.log(JSON.stringify({
  ok:true,build:'2.1.0-dev.1',definitions:defs.length,canonicalGraphs,malkomGraphs,bpmnExports,stayEdges,loopGuardPaths,runtimeGapEdges,
  adapter:registry.list()[0]
},null,2));
