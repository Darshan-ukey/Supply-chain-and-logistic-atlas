import {canonicalHash, stableStringify} from './workdefinition-compiler.js';
import {verifyCompilation} from './workdefinition-verifier.js';

export const PINS = Object.freeze({
  wd:'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
  binding:'2f532fad61c0a5878028fb0bf362827b18593f7c1c502ba88b557dcc8e3a56f9',
  semantics:'d642c1d59f2e938e5afcc60355f086b61e57f33d63e57e54b2a72def09a21576'
});
const check=(ok,code)=>{if(!ok)throw Error(code);};

// Protected inputs and outputs: the public caller may publish hashes/counts only.
// Preserve the frozen canonical leaf vocabulary rather than expanding it into
// the historical task-wide WD or inventing an executable Malkom interface.
export function generateMalkomPackage(compilation,binding,record) {
  check(canonicalHash(compilation)===PINS.wd,'WD_HASH_MISMATCH');
  check(canonicalHash(binding)===PINS.binding,'BINDING_HASH_MISMATCH');
  check(canonicalHash(record)===PINS.semantics,'SEMANTIC_HASH_MISMATCH');
  check(verifyCompilation(compilation).ok,'WD_VERIFICATION_FAILED');
  const before=stableStringify({compilation,binding,record});
  const wd=compilation.definitions[0];
  check(compilation.definitions.length===1 && compilation.totals.notCompiledLeafCount===4,'PARTIAL_COVERAGE_REQUIRED');
  check(wd.lineage.sourceTaskId===binding.processId && binding.semanticModuleVersion===wd.lineage.daughterVersion,'BINDING_PROCESS_LINEAGE_MISMATCH');
  check(wd.executability.independentExecutorProofStatus==='NOT_INDEPENDENTLY_PROVEN','EXECUTOR_PROOF_UPGRADE_FORBIDDEN');
  const unresolved=binding.bindings.filter(b=>b.resolution.state!=='RESOLVED');
  const required=wd.executability.requiredClientBindings;
  check(required.every(id=>binding.bindings.some(b=>b.bindingId===id)),'REQUIRED_BINDING_MISSING');
  const coverage=structuredClone(compilation.coverage);
  const blockers=[
    ...unresolved.map(b=>({type:'CLIENT_BINDING_REQUIRED',id:b.bindingId,nextQuestion:b.collectionQuestion})),
    {type:'PARTIAL_WORKDEFINITION_COVERAGE',count:compilation.totals.notCompiledLeafCount},
    {type:'NOT_INDEPENDENTLY_PROVEN',id:wd.workDefinitionId},
    {type:'REQUIREMENT_NOT_CONFIRMED',id:'MALKOM-DW-006'}
  ];
  const lineage={workDefinitionId:wd.workDefinitionId,workDefinitionVersion:wd.version,moduleId:'road-ltl',processId:'LTL-04',moduleVersion:'1.5',sourceIds:structuredClone(wd.provenance.sourceRefs),historicalFixtureRelabeled:false,inputHashes:{...PINS},workDefinitionHead:'7c5384ec57c47cea3102911851a02add48d3007d'};
  const readiness={
    schemaVersion:'atlas-malkom-readiness-summary-v1.0',status:'FROZEN',bounded:true,
    moduleId:'road-ltl',processId:'LTL-04',workDefinitionId:wd.workDefinitionId,
    readinessClass:'V1_5_MALKOM_HANDOFF_READINESS',universalExecutionReady:false,
    reusableDomainKnowledge:{state:'AVAILABLE',sourceIds:structuredClone(wd.provenance.sourceRefs)},
    workSemantics:{state:'PARTIAL',workDefinitionVersion:wd.version,requiredInputCount:wd.inputs.length,actionCount:wd.actions.length,outcomeCount:wd.outcomes.length},
    rulesControlsCoverage:{state:'PARTIAL',decisionCount:wd.decisions.length,ruleCount:wd.rules.length,controlCount:wd.controls.length,evidenceCount:wd.evidence.length},
    knowledgeGaps:structuredClone(coverage[0].notCompiled),
    clientBindings:{state:binding.readiness.state,resolvedCount:binding.readiness.resolvedCount,unresolvedCount:unresolved.length,unresolvedBindingIds:unresolved.map(b=>b.bindingId)},
    masterExternalDependencies:unresolved.map(b=>({dependency:b.bindingObject,system:b.systemOfRecord,authority:b.authorityOwner,state:'REQUIRED'})),
    projection:{consumer:'MALKOM',disposition:'BLOCKED',supported:false,supportedWithLoss:false,blocked:true,reason:'Unresolved client binding, four noncompiled leaves, unproven executor and unconfirmed interface remain explicit.'},
    blockers,lineage,coverage,totals:structuredClone(compilation.totals),
    independentExecutorProofStatus:wd.executability.independentExecutorProofStatus,
    stopBoundary:['NO_UNIVERSAL_DOMAIN_ENTERPRISE_RUNTIME_RESOLVER','NO_FIRI_GENERALIZED_READINESS','NO_AUTOMATIC_READINESS_DRIVEN_RESEARCH_LOOP']
  };
  const packageArtifact={
    schemaVersion:'atlas-malkom-domain-warehouse-package-v1.0',packageId:'malkom-dw::road-ltl::LTL-04::v1',version:'1.0.0',status:'BUILD_CANDIDATE',bounded:true,consumer:'MALKOM',classification:'EXECUTION_PROTECTED',canonicalMutation:false,lineage,
    projection:{canonicalWorkDefinition:structuredClone(wd),coverage,totals:structuredClone(compilation.totals)},
    bindings:{scope:'GOVERNED_PROCESS_BINDINGS_ONLY',appliedToCanonicalDefinition:false,canonicalMutation:false,state:binding.readiness.state,requirements:structuredClone(binding.bindings)},
    dispositions:{unknown:structuredClone(coverage[0].notCompiled),unsupported:[{requirementId:'MALKOM-DW-006',state:'REQUIREMENT_NOT_CONFIRMED'}],loss:[],partialCoverage:true},
    readiness,
    interface:{type:'MACHINE_READABLE_EXPORT',format:'JSON',apiEndpoint:null,apiEndpointDisposition:'REQUIREMENT_NOT_CONFIRMED',executableCompatibilityProven:false},
    manifest:{projectionRulesVersion:'s8-3c-canonical-leaf-projection-v1',deterministic:true,contentHashAlgorithm:'SHA256_CANONICAL_JSON'}
  };
  check(stableStringify({compilation,binding,record})===before,'CANONICAL_INPUT_MUTATION');
  return {packageArtifact,readiness};
}
