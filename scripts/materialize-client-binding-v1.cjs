const fs=require('fs');

const semanticSet=JSON.parse(require('child_process').execFileSync(process.execPath,['scripts/materialize-operational-semantics-v1.cjs'],{encoding:'utf8'}));
const requirementSchema=JSON.parse(fs.readFileSync('schemas/client-binding-requirement-v1.json','utf8'));
const principle=fs.readFileSync('governance/standards/CLIENT_BINDING_RESOLUTION_PRINCIPLE_V1_FROZEN.md','utf8');
if(!requirementSchema.required.includes('clientFieldMapping')||!principle.includes('Required object/semantic requirement ≠ runtime value')) throw Error('CLIENT_BINDING_GOVERNANCE_NOT_AVAILABLE');
const sem=semanticSet.records.find(x=>x.processId==='LTL-04');
if(!sem||sem.moduleVersion!=='1.5') throw Error('CORRECTED_LTL04_SEMANTIC_CONTEXT_REQUIRED');

const common={taskId:'LTL-04',requiredWhen:'Before executable/client-specific projection of Road LTL pickup execution',validation:'Must be governed, traceable and compatible with canonical LTL-04 semantics; unresolved material values fail closed',basis:'Corrected Road LTL v1.5 ATL-171 semantic record + frozen Client Binding Resolution Principle v1',resolutionStatus:'CLIENT_BINDING_REQUIRED'};
const bindings=[
 {bindingId:'binding::road-ltl::LTL-04::execution-parameters',bindingObject:'client/master execution parameters',bindingType:'CLIENT_MASTER_OR_CONTRACT',why:'Canonical pickup semantics require environment-specific execution parameters but Atlas must not invent client values.',valueOrigin:'Client master data or governed carrier/client contract',sourceRefs:sem.sourceIds,systemOfRecord:'Client TMS/master-data system or approved configuration source',clientFieldMapping:null,authorityOwner:'Authorized client operations/master-data owner',collectionQuestion:'Which governed client/master execution parameters and approved values apply to this pickup request?',...common},
 {bindingId:'binding::road-ltl::LTL-04::authorized-operator',bindingObject:'authorized operator',bindingType:'CLIENT_ROLE_BINDING',why:'Canonical semantics define an authorized actor role, not the client-specific operator/role identifier.',valueOrigin:'Client role/access master',sourceRefs:sem.sourceIds,systemOfRecord:'Client IAM or approved operating-role register',clientFieldMapping:null,authorityOwner:'Authorized client operations/access owner',collectionQuestion:'Which governed operator or role is authorized to submit and maintain this pickup?',...common},
 {bindingId:'binding::road-ltl::LTL-04::execution-platform',bindingObject:'execution platform',bindingType:'CLIENT_SYSTEM_BINDING',why:'Canonical semantics require an execution-system role without embedding a client-specific platform identifier.',valueOrigin:'Client application/system register',sourceRefs:sem.sourceIds,systemOfRecord:'Enterprise architecture/application inventory',clientFieldMapping:null,authorityOwner:'Authorized client technology/process owner',collectionQuestion:'Which approved client execution platform should receive this pickup WorkDefinition projection?',...common}
];
const resolved={
 'binding::road-ltl::LTL-04::authorized-operator':{method:'GOVERNED_MANUAL',value:'pickup-planner',evidenceIds:['demo-manual-binding::authorized-operator::v1']},
 'binding::road-ltl::LTL-04::execution-platform':{method:'GOVERNED_MANUAL',value:'malkom-demo',evidenceIds:['demo-manual-binding::execution-platform::v1']}
};
for(const b of bindings) if(resolved[b.bindingId]) b.resolutionStatus='RESOLVED';
const out={schemaVersion:'atlas-client-binding-set-v1.1',status:'S8_REMEDIATED_CANDIDATE',bounded:true,moduleId:'road-ltl',processId:'LTL-04',semanticRecordId:sem.semanticRecordId,semanticModuleVersion:sem.moduleVersion,workDefinitionContext:{targetId:'wd::road-ltl::LTL-04::v1',state:'CORRECTED_CONTEXT_REQUIRED_BEFORE_S8_3_REGENERATION',canonicalMutation:false},governingContract:'schemas/client-binding-requirement-v1.json',canonicalTruthMutation:false,bindings:bindings.map(b=>({...b,resolution:resolved[b.bindingId]?{state:'RESOLVED',...resolved[b.bindingId]}:{state:'CLIENT_BINDING_REQUIRED',method:'NOT_RESOLVED',value:null,evidenceIds:[]}}))};
const unresolved=out.bindings.filter(x=>x.resolution.state==='CLIENT_BINDING_REQUIRED');
out.readiness={state:unresolved.length?'CLIENT_BINDING_REQUIRED':'READY',resolvedCount:out.bindings.length-unresolved.length,unresolvedCount:unresolved.length,failClosed:Boolean(unresolved.length)};
out.consumerProjection={consumer:'MALKOM',bindingState:out.readiness.state,canonicalMutation:false,resolvedBindingIds:out.bindings.filter(x=>x.resolution.state==='RESOLVED').map(x=>x.bindingId),unresolvedBindingIds:unresolved.map(x=>x.bindingId)};
process.stdout.write(JSON.stringify(out,null,2)+'\n');
