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
const b=generateMalkomPackage(compiled,binding,record);
assert.equal(stableStringify(a),stableStringify(b));
assert.equal(stableStringify({compiled,binding,record}),before);
assert.deepEqual(a.packageArtifact.projection.canonicalWorkDefinition,compiled.definitions[0]);
assert.deepEqual(a.packageArtifact.projection.coverage,compiled.coverage);
assert.deepEqual(a.packageArtifact.bindings.requirements,binding.bindings);
assert.equal(a.packageArtifact.bindings.appliedToCanonicalDefinition,false);
assert.equal(a.packageArtifact.interface.apiEndpoint,null);
assert.equal(a.readiness.projection.disposition,'BLOCKED');
assert.equal(a.readiness.universalExecutionReady,false);
assert.equal(a.readiness.independentExecutorProofStatus,'NOT_INDEPENDENTLY_PROVEN');
assert.equal(a.readiness.clientBindings.unresolvedCount,1);
assert.equal(a.readiness.totals.notCompiledLeafCount,4);
assert.equal(a.readiness.knowledgeGaps.length,4);
assert.equal(a.readiness.clientBindings.resolvedCount,2);
const schema=JSON.parse(fs.readFileSync('schemas/malkom-readiness-summary-v1.schema.json','utf8'));
assert.deepEqual(validateFrozenSchema(a.readiness,schema),[]);
assert.equal(git(['hash-object','schemas/malkom-readiness-summary-v1.schema.json']).trim(),'42507e6053096f86e294df5e69d974c60fc3c105');
assert.equal(git(['hash-object','governance/product/s8-3c-evidence/ATL_138_CONSUMPTION_CONTRACT.json']).trim(),'edcefecc310462967fffce0b853579c619c97a01');
const contract=JSON.parse(fs.readFileSync('governance/product/s8-3c-evidence/ATL_138_CONSUMPTION_CONTRACT.json','utf8'));
assert.equal(contract.consumption.interface_state,a.packageArtifact.interface.apiEndpointDisposition);
assert.equal(contract.governance.canonical_owner,'Atlas');
assert.equal(a.packageArtifact.canonicalMutation,false);
assert.equal(a.packageArtifact.dispositions.loss.length,0);
assert.deepEqual(a.readiness.stopBoundary,['NO_UNIVERSAL_DOMAIN_ENTERPRISE_RUNTIME_RESOLVER','NO_FIRI_GENERALIZED_READINESS','NO_AUTOMATIC_READINESS_DRIVEN_RESEARCH_LOOP']);
let negativeCount=0;
for(const [key,code] of [['wd','WD_HASH_MISMATCH'],['binding','BINDING_HASH_MISMATCH'],['record','SEMANTIC_HASH_MISMATCH']]) {
  const inputs={wd:structuredClone(compiled),binding:structuredClone(binding),record:structuredClone(record)};
  inputs[key].unauthorized=true;
  assert.throws(()=>generateMalkomPackage(inputs.wd,inputs.binding,inputs.record),new RegExp(code));negativeCount++;
}
const promoted=structuredClone(compiled);promoted.definitions[0].executability.independentExecutorProofStatus='PROVEN';
assert.throws(()=>generateMalkomPackage(promoted,binding,record),/WD_HASH_MISMATCH/);negativeCount++;
const full=structuredClone(compiled);full.totals.notCompiledLeafCount=0;
assert.throws(()=>generateMalkomPackage(full,binding,record),/WD_HASH_MISMATCH/);negativeCount++;

if(process.env.S8_3C_PRIVATE_OUTPUT_DIR) {
  const out=process.env.S8_3C_PRIVATE_OUTPUT_DIR;
  assert.ok(!out.replaceAll('\\','/').startsWith(process.cwd().replaceAll('\\','/')),'Protected outputs must be outside repository');
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/malkom-package.json`,stableStringify(a.packageArtifact)+'\n');
  fs.writeFileSync(`${out}/readiness.json`,stableStringify(a.readiness)+'\n');
}
const summary={schemaVersion:'s8-3c-package-readiness-evidence-v1',classification:'PUBLIC_NON_RECONSTRUCTIVE',detailIncluded:false,inputHashes:PINS,packageHash:canonicalHash(a.packageArtifact),readinessHash:canonicalHash(a.readiness),deterministic:true,canonicalNonMutation:true,canonicalLeafProjectionLossless:true,retainedReadinessSchema:'PASS',packageQA:'PASS',readinessQA:'PASS',negativeCasesPassed:negativeCount,totals:compiled.totals,unresolvedBindingCount:1,projectionDisposition:'BLOCKED',universalExecutionReady:false,independentExecutorProofStatus:'NOT_INDEPENDENTLY_PROVEN',stageAcceptance:'PASS',runtimeCertification:false};
assert.deepEqual(summary,JSON.parse(fs.readFileSync('governance/product/s8-3c-evidence/package-readiness-summary.json','utf8')),'Committed public evidence must reproduce from actual governed inputs');
if(process.env.S8_3C_SUMMARY_PATH)fs.writeFileSync(process.env.S8_3C_SUMMARY_PATH,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
