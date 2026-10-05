import {adaptAtlasProjectionToMalkomV23} from '../adapters/atlas-malkom-domainwarehouse-v23.js';
import {evaluateMalkomProofMaterialization} from '../adapters/malkom-proof-materialization-gate.js';

const fail=(code,message=code,details=null)=>{
  const e=new Error(message);e.code=code;e.details=details;throw e;
};
const clone=v=>JSON.parse(JSON.stringify(v));

export function normalizeMalkomIntegrationError(error){
  return {
    ok:false,
    error:{
      code:String(error?.code||error?.message||'MALKOM_INTEGRATION_ERROR'),
      message:String(error?.message||error||'Malkom integration error'),
      details:error?.details??null
    }
  };
}

export function createMalkomIntegrationService(engine){
  if(typeof engine?.verify!=='function') fail('MALKOM_ENGINE_VERIFY_REQUIRED');
  if(typeof engine?.compileMalkom!=='function') fail('MALKOM_ENGINE_COMPILE_REQUIRED');

  const adapt=({atlasProjection,consumerProfile,profile={}}={})=>{
    if(!atlasProjection) fail('ATLAS_PROJECTION_REQUIRED');
    if(!consumerProfile) fail('MALKOM_CONSUMER_PROFILE_REQUIRED');
    const inputBefore=JSON.stringify({atlasProjection,consumerProfile});
    const result=adaptAtlasProjectionToMalkomV23(atlasProjection,consumerProfile,{
      profileId:profile.id,
      profileSha256:profile.sha256,
      profileCompatibility:profile.compatibility
    });
    if(JSON.stringify({atlasProjection,consumerProfile})!==inputBefore) fail('INTEGRATION_INPUT_MUTATION');
    return clone(result);
  };

  const verify=({definition}={})=>{
    if(!definition) fail('MALKOM_DEFINITION_REQUIRED');
    const result=engine.verify([clone(definition)]);
    return {valid:result?.valid===true,issues:clone(result?.issues||[])};
  };

  const compile=({definition}={})=>{
    if(!definition) fail('MALKOM_DEFINITION_REQUIRED');
    const result=engine.compileMalkom(clone(definition));
    return clone(result);
  };

  const evaluate=({adapterResult,compilation}={})=>{
    if(!adapterResult) fail('ADAPTER_RESULT_REQUIRED');
    if(!compilation) fail('MALKOM_COMPILATION_REQUIRED');
    return clone(evaluateMalkomProofMaterialization(adapterResult,compilation));
  };

  const run=({atlasProjection,consumerProfile,profile={}}={})=>{
    const adapter=adapt({atlasProjection,consumerProfile,profile});
    const verification=verify({definition:adapter.definition});
    if(!verification.valid){
      return {ok:false,stage:'VERIFY',adapter,verification,compilation:null,materialization:null};
    }
    const compilation=compile({definition:adapter.definition});
    const materialization=evaluate({adapterResult:adapter,compilation});
    return {ok:true,stage:'COMPLETE',adapter,verification,compilation,materialization};
  };

  const projectionSummary=({result}={})=>{
    if(!result) fail('INTEGRATION_RESULT_REQUIRED');
    const c=result.compilation||{};
    const m=result.materialization||{};
    return {
      ok:result.ok===true,
      stage:result.stage,
      adapter:result.adapter?.assessment?.adapter||null,
      workDefinitionId:result.adapter?.definition?.sourceRecord?.atlasCanonical?.workDefinitionId||null,
      profileId:result.adapter?.assessment?.profileId||null,
      verificationValid:result.verification?.valid===true,
      queue:m.queueSummary?.name||c.queue?.name||null,
      finalMaterializable:m.finalMaterializable===true,
      finalDisposition:m.finalDisposition||null,
      blockers:clone(m.reasons||[]),
      canonicalMutation:result.adapter?.assessment?.canonicalMutation===true
    };
  };

  return Object.freeze({adapt,verify,compile,evaluate,run,projectionSummary});
}
