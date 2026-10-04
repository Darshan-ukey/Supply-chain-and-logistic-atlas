import {canonicalHash} from './workdefinition-compiler.js';

// Bounded reconstruction from an independently pinned frozen task. This is a
// new source-grounded derivative, never a recovery of historical payload bytes.
export function reconstructTask(task, sourcePin, semanticRecord, binding) {
  if(canonicalHash(task)!==sourcePin.taskHash) throw Error('FROZEN_TASK_HASH_MISMATCH');
  if(task.taskId!=='LTL-04'||sourcePin.semanticSourceVersion!=='1.4') throw Error('BOUNDED_SOURCE_REQUIRED');
  const b=task.baseline;
  for(const [field,donorField] of Object.entries({before:'stateBefore',event:'event',decision:'decision',rule:'rule',control:'control',action:'action',evidence:'evidence',after:'stateAfter',outcome:'outcome',inputs:'inputs',outputs:'outputs',sourceIds:'sourceIds'})) {
    if(canonicalHash(b[field])!==canonicalHash(semanticRecord[donorField])) throw Error('CORRECTED_SEMANTIC_SOURCE_MISMATCH');
  }
  if(task.decisionGates.length!==3||task.atomicActions.length!==2) throw Error('SOURCE_STRUCTURE_CHANGED');
  const actions=task.atomicActions;
  // A separate child must be explicitly named and carry its own contract.
  const response=actions[1];
  if(response.action!=='publish response'||!response.precondition||!response.postcondition||!response.performerRole||!response.authorityOwner||!task.evidenceContracts.length||!task.expectedOutcomes.length) throw Error('RESPONSE_CHILD_CONTRACT_INSUFFICIENT');
  const parameterBinding=binding.bindings.find(x=>x.bindingType==='CLIENT_MASTER_OR_CONTRACT');
  if(!parameterBinding||parameterBinding.resolution.state!=='CLIENT_BINDING_REQUIRED')throw Error('EXPECTED_UNRESOLVED_PARAMETER_BINDING_REQUIRED');
  const root='LTL-04::S8-RECON::ROOT',units=[],audit=[];
  function add(id,parent,sequence,type,name,status,body={},kg=[],cb=[],pointers=[]) {
    const unit={workUnitId:id,parentWorkUnitId:parent,sequence,unitType:type,name,purpose:task.identity.purpose,sourceRefs:[...b.sourceIds],executorReadiness:{status,blockingReasons:status.startsWith('BLOCKED_')?[...kg,...cb]:[],requiredKnowledgeGaps:kg,requiredClientBindings:cb,downstreamCompilationTarget:'CANONICAL_WORKDEFINITION'},...body};
    units.push(unit);audit.push({unitId:id,status,sourcePointers:pointers,sourceBodyHash:canonicalHash(unit)});return unit;
  }
  add(root,null,1,'TASK_ROOT',task.title,'NEEDS_DECOMPOSITION',{},[],[],['/identity','/executability']);
  task.decisionGates.forEach((gate,i)=>{
    const kg=i===0?['KG::LTL-04::COMPLETENESS_APPLICABLE_VALIDATION_RULES']:[];
    const cb=i>0?[parameterBinding.bindingId]:[];
    add(gate.gateId,root,i+1,'DECISION_GATE',gate.gate,kg.length?'BLOCKED_BY_KNOWLEDGE_GAP':'BLOCKED_BY_CLIENT_BINDING',{
      trigger:b.trigger,inputs:task.requiredInformation.map(r=>r.fieldRequirementId),entryConditions:[b.before],decisionGates:[gate],branchTransitions:task.branchTransitions.filter(t=>t.transitionId.startsWith(`LTL-04::TR::${String(i+1).padStart(2,'0')}`)),evidenceRequirements:task.evidenceContracts,outputState:task.states.success,fallbackIfBlocked:task.states.controlledFailure
    },kg,cb,[`/decisionGates/${i}`,'/requiredInformation','/branchTransitions','/evidenceContracts']);
  });
  const group=actions[0].actionId;
  add(group,root,4,'ACTION_GROUP',actions[0].action,'NEEDS_DECOMPOSITION',{},[],[],['/atomicActions/0']);
  // Do not invent contracts for alternatives by splitting words. The source
  // supplies one alternative-action candidate; missing per-alternative gates
  // and criteria remain a single explicit knowledge blocker under that group.
  add(group+'::UNRESOLVED',group,1,'ATOMIC_ACTION_CANDIDATE',actions[0].action,'BLOCKED_BY_KNOWLEDGE_GAP',{
    trigger:b.trigger,entryConditions:[actions[0].precondition],atomicActions:[actions[0]],evidenceRequirements:task.evidenceContracts,outputState:actions[0].postcondition,fallbackIfBlocked:task.states.controlledFailure
  },['KG::LTL-04::ALTERNATIVE_ACTION_CHILD_CONTRACTS'],[parameterBinding.bindingId],['/atomicActions/0','/controls','/states']);
  // The frozen contracts allow an executor-ready canonical definition to carry
  // stable binding requirements without embedding their values. Publishing a
  // governed result has its own operation, precondition, authority, outcomes,
  // failure path and evidence. Runtime projection remains downstream.
  add(response.actionId,root,5,'ATOMIC_ACTION',response.action,'EXECUTOR_READY',{
    trigger:b.event,inputs:[...b.inputs,...b.outputs],entryConditions:[response.precondition],atomicActions:[{actionId:response.actionId,action:response.action,precondition:response.precondition,performerRole:response.performerRole,authorityOwner:response.authorityOwner,postcondition:response.postcondition,evidenceClass:response.evidenceClass}],
    decisionGates:[],branchTransitions:task.expectedOutcomes.map(o=>({code:o.code,stateAfter:o.stateAfter,requiredEvidence:o.requiredEvidence})),evidenceRequirements:task.evidenceContracts,dependencies:[{kind:'SOURCE_ENTRY_CONDITION',condition:response.precondition},{kind:'GOVERNED_RESULT',outcomes:task.expectedOutcomes}],outputState:response.postcondition,fallbackIfBlocked:task.states.controlledFailure,
    temporalConstraints:task.temporalConstraints,
  },[],[parameterBinding.bindingId],['/atomicActions/1','/expectedOutcomes','/evidenceContracts','/states/controlledFailure','/temporalConstraints','/clientBindingRequirements']);
  const parentIds=new Set(units.map(u=>u.parentWorkUnitId)),leaves=units.filter(u=>!parentIds.has(u.workUnitId));
  const requiredKnowledgeGaps=[...new Set(leaves.flatMap(u=>u.executorReadiness.requiredKnowledgeGaps))].sort();
  const requiredClientBindings=[...new Set(leaves.flatMap(u=>u.executorReadiness.requiredClientBindings))].sort();
  const decomposition={schemaVersion:'atlas-canonical-work-decomposition-v1',decompositionId:'road-ltl@1.5::LTL-04::S8-SOURCE-RECONSTRUCTION-V1',contractVersion:'1.0.0',status:'VALIDATED_REFERENCE_DECOMPOSITION',daughterModule:'road-ltl',daughterVersion:'1.5',sourceTaskId:task.taskId,sourceTaskTitle:task.title,executionReadinessStatus:'PARTIAL_WITH_EXPLICIT_BLOCKERS',semanticLineage:{semanticSourceVersion:'1.4',effectiveModuleVersion:'1.5',inheritance:'LOSSLESS_UNCHANGED_TASK',sourcePin},parentLink:{parentLevel:'A3',parentTaskId:task.a3ParentId},stopCriterion:task.executability.stopCriterion,workUnits:units,summary:{workUnitCount:units.length,leafCount:leaves.length,leafStatusCounts:Object.fromEntries(['EXECUTOR_READY','BLOCKED_BY_CLIENT_BINDING','BLOCKED_BY_KNOWLEDGE_GAP'].map(s=>[s,leaves.filter(u=>u.executorReadiness.status===s).length])),knowledgeGapCount:requiredKnowledgeGaps.length,clientBindingRefCount:requiredClientBindings.length,requiredKnowledgeGaps,requiredClientBindings,executorProof:'NOT_INDEPENDENTLY_PROVEN',workDefinitionCompilationStatus:'NOT_STARTED'}};
  return {classification:'EXECUTION_PROTECTED',decomposition,correctedDonors:{semanticRecordHash:canonicalHash(semanticRecord),clientBindingHash:canonicalHash(binding)},reconstructionAudit:{classification:'EXECUTION_PROTECTED',historicalEquivalenceClaimed:false,sourcePin,units:audit,readinessBasis:'The explicitly separate publication operation meets the canonical stop criterion and carries stable unresolved binding requirements permitted by the frozen WorkDefinition contract. Other source gaps remain blocked. No client value, runtime certification or historical equivalence is asserted.'}};
}

