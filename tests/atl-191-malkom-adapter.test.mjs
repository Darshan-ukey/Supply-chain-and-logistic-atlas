import assert from 'node:assert/strict';
import cp from 'node:child_process';
import {adaptAtlasProjectionToMalkomV23} from '../lib/adapters/atlas-malkom-domainwarehouse-v23.js';
import {generateMalkomPackage,PINS} from '../lib/compile/s8-malkom-package.js';
import {generateMalkomProjection} from '../lib/compile/s8-malkom-projection.js';
import {canonicalHash} from '../lib/compile/workdefinition-compiler.js';
import {reconstructTask} from '../lib/compile/source-task-decomposition.js';
import {compileCorrectedTask} from '../lib/compile/s8-workdefinition-compiler.js';

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
const pkg=generateMalkomPackage(compiled,binding,record);
const projection=generateMalkomProjection(compiled,pkg.packageArtifact,pkg.readiness);
assert.equal(canonicalHash(projection),'703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c');

const profile={
  taskId:'LTL-04',taskLabel:'Consumer profile',a3:'Pickup request',queue:'Pickup Request',queuePurpose:'ATL-191 synthetic consumer structure',
  businessObjects:['Shipment'],
  subQueues:[{name:'New',workTypes:['New'],outcomes:['out-proof']}],
  workTypes:[{name:'New',executionMode:'HUMAN_IN_LOOP',purpose:'Proof work type'}],
  fields:[{name:'shipmentID',label:'Shipment ID',type:'string',required:true}],
  outcomes:[{id:'out-proof',code:'PROOF',label:'Proof',family:'PROOF',route:'SYSTEM',status:'PENDING',businessState:'PROOF',nextStep:'STAY_IN_QUEUE'}],
  decisions:['historical/synthetic'],rules:['historical/synthetic'],controls:['historical/synthetic'],actions:['historical/synthetic'],actors:['historical/synthetic'],systems:['historical/synthetic'],
  clientOverridePoints:['fields[]'],sourceRefs:['historical/synthetic']
};

const options={profileId:'synthetic-atl191:LTL-04',profileSha256:'SYNTHETIC_CONTRACT_TEST',profileCompatibility:'UNVERIFIED_HISTORICAL_CONSUMER_PROFILE'};
const before=JSON.stringify({projection,profile});
const a=adaptAtlasProjectionToMalkomV23(projection,profile,options);
const b=adaptAtlasProjectionToMalkomV23(projection,profile,options);
assert.deepEqual(a,b);
assert.equal(JSON.stringify({projection,profile}),before);
assert.equal(a.definition.kind,'malkom.domain-work-definition/2.3');
assert.equal(a.definition.sourceTask.module,'road-ltl@1.5');
assert.equal(a.definition.sourceTask.taskId,'LTL-04');
assert.equal(a.definition.sourceRecord.atlasCanonical.workDefinitionId,projection.payload.canonicalWorkDefinition.workDefinitionId);
assert.equal(a.definition.provenance.canonical,'ATLAS_DERIVED');
assert.equal(a.definition.decomposition.basis,'MALKOM_STANDARD');
assert.equal(a.definition.decomposition.malkom.taskLabel,projection.payload.canonicalWorkDefinition.title);
assert.deepEqual(a.definition.decomposition.malkom.rules,projection.payload.canonicalWorkDefinition.rules.map(String));
assert.deepEqual(a.definition.decomposition.malkom.actions,projection.payload.canonicalWorkDefinition.actions.map(x=>typeof x==='string'?x:JSON.stringify(x)));
assert.deepEqual(a.definition.decomposition.malkom.sourceRefs,projection.payload.canonicalWorkDefinition.provenance.sourceRefs);
assert.equal(a.assessment.finalMaterializable,false);
assert.equal(a.assessment.reason,'ATLAS_UPSTREAM_NOT_MATERIALIZABLE');
assert.throws(()=>adaptAtlasProjectionToMalkomV23({...projection,consumer:'OTHER'},profile,options),/MALKOM_CONSUMER_REQUIRED/);
assert.throws(()=>adaptAtlasProjectionToMalkomV23(projection,{...profile,taskId:'LTL-99'},options),/PROFILE_TASK_MISMATCH/);
console.log(JSON.stringify({status:'PASS',exactAtl169ProjectionHash:canonicalHash(projection),adapter:a.assessment.adapter,finalMaterializable:a.assessment.finalMaterializable}));
