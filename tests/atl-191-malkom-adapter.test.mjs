import assert from 'node:assert/strict';
import {adaptAtlasProjectionToMalkomV23} from '../lib/adapters/atlas-malkom-domainwarehouse-v23.js';

const profile={
  taskId:'LTL-04',taskLabel:'Historical label',a3:'Pickup request',queue:'Pickup Request',queuePurpose:'Consumer projection profile',
  businessObjects:['Shipment'],
  subQueues:[{name:'New',workTypes:['New'],outcomes:['out-accepted']}],
  workTypes:[{name:'New',executionMode:'HUMAN_IN_LOOP',purpose:'Consumer work type'}],
  fields:[{name:'shipmentID',label:'Shipment ID',type:'string',required:true}],
  outcomes:[{id:'out-accepted',code:'ACCEPTED',label:'Accepted',family:'ACCEPT',route:'SYSTEM',status:'COMPLETED',businessState:'ACCEPTED',nextStep:'END_WORK_ITEM'}],
  decisions:['historical decision'],rules:['historical rule'],controls:['historical control'],actions:['historical action'],actors:['historical actor'],systems:['historical system'],
  clientOverridePoints:['fields[]'],sourceRefs:['historical-source']
};
const wd={
  schemaVersion:'atlas-canonical-workdefinition-v1',workDefinitionId:'road-ltl@1.5::LTL-04::WU-TEST::WD',contractVersion:'1.0.0',version:'1.0.0',status:'VALIDATED_REFERENCE_DEFINITION',
  title:'Request pickup and prove shipment readiness',purpose:'Bounded test leaf',
  lineage:{daughterModule:'road-ltl',daughterVersion:'1.5',semanticSourceVersion:'1.4',inheritance:'LOSSLESS_UNCHANGED_TASK',sourceTaskId:'LTL-04',sourceTaskTitle:'Request pickup and prove shipment readiness',decompositionId:'decomp::LTL-04',decompositionContractVersion:'1.0.0',sourceWorkUnitId:'WU-TEST',workUnitPath:['LTL-04','WU-TEST'],unitType:'ATOMIC_ACTION',parentWorkUnitId:'LTL-04',sequence:1},
  provenance:{compiledFrom:'CANONICAL_WORK_DECOMPOSITION_V1',compilerVersion:'atlas-workdefinition-compiler-1.0.0',governedInputContentHash:'a'.repeat(64),sourceRefs:['src-dsdc-pickup']},
  applicability:{requiredWhen:[],prohibitedWhen:[],entryConditions:['shipment valid']},trigger:'pickup request submitted',
  inputs:['shipment'],actors:[],systems:[],decisions:[],rules:[],validations:[],controls:[],actions:['submit pickup request'],outcomes:[],transitions:[],clocks:[],evidence:['pickup request'],exceptions:[],dependencies:[],
  executability:{status:'EXECUTOR_READY',executorClass:'EXECUTOR_CLASS_UNBOUND',independentExecutorProofStatus:'NOT_INDEPENDENTLY_PROVEN',requiredClientBindings:['BIND-1'],requiredKnowledgeGaps:[]},
  executionCharacteristics:{executorClassBound:false,clientBindingRequired:true,knowledgeGapPresent:false,outputState:null,fallbackIfBlocked:null},clientBindingRequirements:['BIND-1']
};
const projection={
  schemaVersion:'atlas-malkom-projection-boundary-v1.0',handoffId:'malkom-projection-boundary::road-ltl::LTL-04::v1',consumer:'MALKOM',
  canonicalBoundary:{canonicalMutation:false,traceable:true,clientBindingsSeparate:true,unresolvedState:'CLIENT_BINDING_REQUIRED',failClosed:true},
  payload:{canonicalWorkDefinition:wd,coverage:[{notCompiled:[]}],totals:{notCompiledLeafCount:4}},
  bindings:{},dispositions:{unknown:[],unsupported:[],loss:[],partialCoverage:true},
  readiness:{universalExecutionReady:false,clientBindings:{unresolvedCount:1},blockers:[{type:'CLIENT_BINDING_REQUIRED',id:'BIND-1'}]},
  release:{materializable:false,runtimeCertification:false},trace:{}
};
const options={profileId:'august-dw-v0.2.4:LTL-04',profileSha256:'1bed891ecfa7b2d8bf4dd996692e9a109de8033898933e74bd8c892397c16e88',profileCompatibility:'UNVERIFIED_HISTORICAL_CONSUMER_PROFILE'};
const a=adaptAtlasProjectionToMalkomV23(projection,profile,options);
const b=adaptAtlasProjectionToMalkomV23(projection,profile,options);
assert.deepEqual(a,b);
assert.equal(a.definition.kind,'malkom.domain-work-definition/2.3');
assert.equal(a.definition.sourceTask.module,'road-ltl@1.5');
assert.equal(a.definition.provenance.canonical,'ATLAS_DERIVED');
assert.equal(a.definition.decomposition.malkom.taskLabel,wd.title);
assert.deepEqual(a.definition.decomposition.malkom.rules,[]);
assert.deepEqual(a.definition.decomposition.malkom.actions,['submit pickup request']);
assert.deepEqual(a.definition.decomposition.malkom.sourceRefs,['src-dsdc-pickup']);
assert.equal(a.assessment.finalMaterializable,false);
assert.equal(a.assessment.reason,'ATLAS_UPSTREAM_NOT_MATERIALIZABLE');
assert.throws(()=>adaptAtlasProjectionToMalkomV23({...projection,consumer:'OTHER'},profile,options),/MALKOM_CONSUMER_REQUIRED/);
assert.throws(()=>adaptAtlasProjectionToMalkomV23(projection,{...profile,taskId:'LTL-99'},options),/PROFILE_TASK_MISMATCH/);
console.log(JSON.stringify({status:'PASS',adapter:a.assessment.adapter,finalMaterializable:a.assessment.finalMaterializable,profileCompatibility:a.assessment.profileCompatibility}));
