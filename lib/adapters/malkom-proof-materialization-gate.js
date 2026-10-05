const check=(ok,code)=>{if(!ok)throw new Error(code);};

export function evaluateMalkomProofMaterialization(adapterResult, engineCompilation){
  check(adapterResult?.assessment?.canonicalMutation===false,'CANONICAL_MUTATION_FORBIDDEN');
  check(engineCompilation?.workflow,'ENGINE_COMPILATION_REQUIRED');
  const reasons=[];
  if(adapterResult.assessment.upstreamBlocked) reasons.push('ATLAS_UPSTREAM_NOT_MATERIALIZABLE');
  if(!adapterResult.assessment.profileVerified) reasons.push('CONSUMER_PROFILE_NOT_VERIFIED');
  if(engineCompilation.bindingRequired) reasons.push('CLIENT_BINDING_REQUIRED');
  if(!engineCompilation.workflow.materializable){
    for(const b of engineCompilation.workflow.blockers||[]) reasons.push(`ENGINE_RUNTIME_GAP:${b.capability}`);
  }
  return {
    engineWorkflowMaterializable:engineCompilation.workflow.materializable,
    engineRuntimeDisposition:engineCompilation.runtimeProjection?.disposition,
    finalMaterializable:reasons.length===0,
    finalDisposition:reasons.length===0?'MATERIALIZABLE':'BLOCKED_BY_ATLAS_GOVERNANCE',
    reasons:[...new Set(reasons)],
    queueSummary:{
      name:engineCompilation.queue?.name,
      subQueues:engineCompilation.queue?.subQueues?.length||0,
      workTypes:engineCompilation.queue?.workTypes?.length||0,
      fields:engineCompilation.queue?.fields?.length||0,
      outcomes:engineCompilation.queue?.outcomes?.length||0
    },
    canonicalMutation:false
  };
}
