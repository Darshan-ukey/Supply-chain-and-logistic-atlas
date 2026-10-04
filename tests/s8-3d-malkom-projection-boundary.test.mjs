import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import {generateMalkomPackage,PINS} from '../lib/compile/s8-malkom-package.js';
import {canonicalHash,stableStringify} from '../lib/compile/workdefinition-compiler.js';
import {reconstructTask} from '../lib/compile/source-task-decomposition.js';
import {compileCorrectedTask} from '../lib/compile/s8-workdefinition-compiler.js';
import {validateFrozenSchema} from '../lib/compile/frozen-schema-validator.js';

const git=args=>cp.execFileSync('git',['-c',`safe.directory=${process.cwd()}`,...args],{encoding:'utf8',maxBuffer:20000000});
const source=JSON.parse(git(['show','662c7847d3839c1ffd95dc8589d3d0d6ac100d67:data/modules/road-ltl-v1.4.json']));
const semantics=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-operational-semantics-v1.cjs'],{encoding:'utf8'}));
const binding=JSON.parse(cp.execFileSync(process.execPath,['scripts/materialize-client-binding-v1.cjs'],{encoding:'utf8'}));
const record=semantics.records.find(r=>r.processId==='LTL-04');
const task=source.tasks.find(t=>t.taskId==='LTL-04');
const pin={commit:'662c7847d3839c1ffd95dc8589d3d0d6ac100d67',path:'data/modules/road-ltl-v1.4.json',blob:'d06974e9ee86cea59227e0866a98ad5d1367bfad',taskHash:canonicalHash(task),semanticSourceVersion:'1.4'};
const envelope=reconstructTask(task,pin,record,binding);
const compiled=compileCorrectedTask(envelope,canonicalHash(envelope.decomposition),semantics,binding);
assert.equal(canonicalHash(compiled),PINS.wd);
const before=stableStringify({compiled,binding,record});
const a=generateMalkomPackage(compiled,binding,record);
const {generateMalkomProjection,PROJECTION_PINS}=await import('../lib/compile/s8-malkom-projection.js');
const p=generateMalkomProjection(compiled,a.packageArtifact,a.readiness);
assert.equal(stableStringify(p),stableStringify(generateMalkomProjection(compiled,a.packageArtifact,a.readiness)));
assert.equal(stableStringify({compiled,binding,record}),before);
assert.deepEqual(p.payload.canonicalWorkDefinition,compiled.definitions[0]);
assert.deepEqual(p.payload.coverage,compiled.coverage);
assert.deepEqual(p.payload.totals,compiled.totals);
assert.deepEqual(p.bindings,a.packageArtifact.bindings);
assert.deepEqual(p.dispositions,a.packageArtifact.dispositions);
assert.deepEqual(p.readiness,a.readiness);
assert.deepEqual(p.trace,a.packageArtifact.lineage);
assert.equal(p.sourcePackage.sourceReleaseTip,PROJECTION_PINS.base);
assert.equal(p.canonicalBoundary.canonicalMutation,false);
assert.equal(p.canonicalBoundary.failClosed,true);
assert.equal(p.bindings.appliedToCanonicalDefinition,false);
assert.equal(p.release.materializable,false);
assert.equal(p.release.runtimeCertification,false);
assert.equal(p.release.readiness,'BLOCKED');
assert.equal(p.release.interface.apiEndpoint,null);
assert.equal(p.release.interface.executableCompatibilityProven,false);
assert.equal(p.readiness.universalExecutionReady,false);
assert.equal(p.readiness.independentExecutorProofStatus,'NOT_INDEPENDENTLY_PROVEN');
assert.equal(p.readiness.clientBindings.unresolvedCount,1);
assert.equal(p.payload.totals.notCompiledLeafCount,4);
assert.equal(p.payload.totals.blockedByClientBindingLeafCount,2);
assert.equal(p.payload.totals.blockedByKnowledgeGapLeafCount,2);
for(const state of ['CLIENT_BINDING_REQUIRED','UNKNOWN','LOSS_OR_UNSUPPORTED','REQUIREMENT_NOT_CONFIRMED'])assert.ok(p.capabilityMap.some(x=>x.state===state));
assert.equal(p.stopBoundary.requiredConsumer,'MALKOM');
assert.equal(p.stopBoundary.productionPromotionAuthorized,false);
assert.deepEqual(p.stopBoundary.excludedConsumers,['AGENTIC_AI','RPA_BPM_WORKFLOW','SAP','TMS','WMS','OTHER_RUNTIME_PACKAGES']);
const schema=JSON.parse(fs.readFileSync('governance/product/s8-3d-evidence/ATL_169_BOUNDARY_SCHEMA.json','utf8'));
assert.deepEqual(validateFrozenSchema(p,schema),[]);
assert.equal(git(['hash-object','governance/product/s8-3d-evidence/ATL_169_BOUNDARY_SCHEMA.json']).trim(),git(['rev-parse','88bd3da8e9bf46d41676adbfce0c96fc45cf013c:data/contracts/atlas-malkom-projection-boundary-v1.schema.json']).trim());
const cases=[
 ['wd',x=>{x.unauthorized=true;},'WD_HASH_MISMATCH'],
 ['pkg',x=>{x.lineage.workDefinitionHead='stale';},'PACKAGE_HASH_MISMATCH'],
 ['pkg',x=>{x.projection.coverage=[];},'PACKAGE_HASH_MISMATCH'],
 ['pkg',x=>{x.bindings.appliedToCanonicalDefinition=true;},'PACKAGE_HASH_MISMATCH'],
 ['pkg',x=>{x.dispositions.loss=[];x.dispositions.unsupported=[];},'PACKAGE_HASH_MISMATCH'],
 ['pkg',x=>{x.interface.apiEndpoint='https://inferred.invalid';},'PACKAGE_HASH_MISMATCH'],
 ['ready',x=>{x.universalExecutionReady=true;},'READINESS_HASH_MISMATCH'],
 ['ready',x=>{x.independentExecutorProofStatus='PROVEN';},'READINESS_HASH_MISMATCH'],
 ['ready',x=>{x.clientBindings.unresolvedCount=0;},'READINESS_HASH_MISMATCH'],
 ['ready',x=>{x.projection.disposition='SUPPORTED';},'READINESS_HASH_MISMATCH']
];
for(const [key,mutate,code] of cases){const inputs={wd:structuredClone(compiled),pkg:structuredClone(a.packageArtifact),ready:structuredClone(a.readiness)};mutate(inputs[key]);assert.throws(()=>generateMalkomProjection(inputs.wd,inputs.pkg,inputs.ready),new RegExp(code));}
const summary={schemaVersion:'s8-3d-projection-evidence-v1',classification:'PUBLIC_NON_RECONSTRUCTIVE',detailIncluded:false,inputHashes:{...PINS,...PROJECTION_PINS},projectionHash:canonicalHash(p),deterministic:true,canonicalNonMutation:true,losslessCompiledLeaf:true,coverageAndResidualsPreserved:true,retainedBoundarySchema:'PASS',negativeCasesPassed:cases.length,totals:compiled.totals,unresolvedBindingCount:1,readiness:'BLOCKED',universalExecutionReady:false,independentExecutorProofStatus:'NOT_INDEPENDENTLY_PROVEN',materializable:false,runtimeCertification:false,stageAcceptance:'PASS'};
if(process.env.S8_3D_SUMMARY_PATH)fs.writeFileSync(process.env.S8_3D_SUMMARY_PATH,JSON.stringify(summary,null,2)+'\n');
else assert.deepEqual(summary,JSON.parse(fs.readFileSync('governance/product/s8-3d-evidence/projection-summary.json','utf8')));
console.log(JSON.stringify(summary));
