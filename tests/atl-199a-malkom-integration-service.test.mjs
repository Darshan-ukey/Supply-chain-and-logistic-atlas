import assert from 'node:assert/strict';
import {createMalkomIntegrationService,normalizeMalkomIntegrationError} from '../lib/integrations/malkom-integration-service.js';

const profile={taskId:'LTL-04',taskLabel:'Profile',queue:'Pickup',subQueues:[{name:'New'}],workTypes:[{name:'New'}],fields:[{name:'shipmentID'}],outcomes:[{id:'out'}],clientOverridePoints:[]};
const wd={schemaVersion:'atlas-canonical-workdefinition-v1',workDefinitionId:'wd-1',contractVersion:'1.0.0',version:'1.0.0',title:'Pickup',lineage:{daughterModule:'road-ltl',daughterVersion:'1.5',sourceTaskId:'LTL-04',sourceWorkUnitId:'WU-1'},provenance:{governedInputContentHash:'a'.repeat(64),sourceRefs:['src-1']},applicability:{},trigger:'go',inputs:[],actors:[],systems:[],decisions:[],rules:[],controls:[],actions:[],outcomes:[],clocks:[],evidence:[],dependencies:[],executionCharacteristics:{outputState:null},clientBindingRequirements:['BIND-1']};
const projection={schemaVersion:'atlas-malkom-projection-boundary-v1.0',handoffId:'h1',consumer:'MALKOM',canonicalBoundary:{canonicalMutation:false,failClosed:true},payload:{canonicalWorkDefinition:wd},readiness:{universalExecutionReady:false,clientBindings:{unresolvedCount:1},blockers:[{type:'CLIENT_BINDING_REQUIRED'}]},dispositions:{},release:{materializable:false,runtimeCertification:false}};
const engine={
  verify:defs=>({valid:defs[0]?.kind==='malkom.domain-work-definition/2.3',issues:[]}),
  compileMalkom:def=>({bindingRequired:true,workflow:{materializable:true,blockers:[]},runtimeProjection:{disposition:'MAPPED'},queue:{name:def.decomposition.malkom.queue,subQueues:[1],workTypes:[1],fields:[1],outcomes:[1]}})
};
const service=createMalkomIntegrationService(engine);
const result=service.run({atlasProjection:projection,consumerProfile:profile,profile:{id:'p1',sha256:'x',compatibility:'UNVERIFIED_HISTORICAL_CONSUMER_PROFILE'}});
assert.equal(result.ok,true);
assert.equal(result.verification.valid,true);
assert.equal(result.materialization.finalMaterializable,false);
assert.deepEqual(result.materialization.reasons,['ATLAS_UPSTREAM_NOT_MATERIALIZABLE','CONSUMER_PROFILE_NOT_VERIFIED','CLIENT_BINDING_REQUIRED']);
const summary=service.projectionSummary({result});
assert.equal(summary.queue,'Pickup');
assert.equal(summary.canonicalMutation,false);
assert.equal(summary.finalMaterializable,false);
assert.throws(()=>createMalkomIntegrationService({verify(){}}),/MALKOM_ENGINE_COMPILE_REQUIRED/);
const normalized=normalizeMalkomIntegrationError(Object.assign(new Error('boom'),{code:'X'}));
assert.equal(normalized.error.code,'X');
console.log(JSON.stringify({status:'PASS',summary}));
