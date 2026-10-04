import {canonicalHash,stableStringify} from './workdefinition-compiler.js';
import {PINS} from './s8-malkom-package.js';

export const PROJECTION_PINS=Object.freeze({base:'97459a5e06abda96cbe3b2a121dfbee3a0bcf41e',package:'6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',readiness:'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617'});
const check=(ok,code)=>{if(!ok)throw Error(code);};

// Protected derivative; callers may publish only non-reconstructive evidence.
export function generateMalkomProjection(compilation,packageArtifact,readiness) {
  check(canonicalHash(compilation)===PINS.wd,'WD_HASH_MISMATCH');
  check(canonicalHash(packageArtifact)===PROJECTION_PINS.package,'PACKAGE_HASH_MISMATCH');
  check(canonicalHash(readiness)===PROJECTION_PINS.readiness,'READINESS_HASH_MISMATCH');
  const before=stableStringify({compilation,packageArtifact,readiness});
  const wd=compilation.definitions[0];
  check(stableStringify(wd)===stableStringify(packageArtifact.projection.canonicalWorkDefinition),'CANONICAL_LINEAGE_MISMATCH');
  check(stableStringify(packageArtifact.readiness)===stableStringify(readiness),'READINESS_LINEAGE_MISMATCH');
  const result={
    schemaVersion:'atlas-malkom-projection-boundary-v1.0',handoffId:'malkom-projection-boundary::road-ltl::LTL-04::v1',consumer:'MALKOM',classification:'EXECUTION_PROTECTED',bounded:true,
    sourcePackage:{packageId:packageArtifact.packageId,version:packageArtifact.version,workDefinitionId:wd.workDefinitionId,workDefinitionVersion:wd.version,sourceReleaseTip:PROJECTION_PINS.base,inputHashes:{...PINS,...PROJECTION_PINS}},
    canonicalBoundary:{canonicalMutation:false,traceable:true,clientBindingsSeparate:true,unresolvedState:'CLIENT_BINDING_REQUIRED',failClosed:true},
    capabilityMap:[
      {semantic:'canonical identity/version/lineage',state:'SUPPORTED',projection:'PRESERVE'},
      {semantic:'work semantics',state:'SUPPORTED',projection:'PRESERVE',scope:'COMPILED_LEAF_ONLY'},
      {semantic:'client execution parameters',state:'CLIENT_BINDING_REQUIRED',projection:'SEPARATE_BINDING',blocking:true},
      {semantic:'unknown governed knowledge',state:'UNKNOWN',projection:'EXPLICIT_DISPOSITION',blockingWhenMandatory:true},
      {semantic:'consumer-unrepresentable semantics',state:'LOSS_OR_UNSUPPORTED',projection:'EXPLICIT_DISPOSITION',blockingWhenMandatory:true},
      {semantic:'Malkom API endpoint',state:'REQUIREMENT_NOT_CONFIRMED',projection:'NO_GUESSED_INTERFACE',blocking:true}
    ],
    payload:structuredClone(packageArtifact.projection),bindings:structuredClone(packageArtifact.bindings),dispositions:structuredClone(packageArtifact.dispositions),readiness:structuredClone(readiness),
    release:{deterministic:true,manifestVersion:'s8-3d-atl169-handoff-v1',contentHashAlgorithm:'SHA256_CANONICAL_JSON',interface:structuredClone(packageArtifact.interface),readiness:'BLOCKED',materializable:false,runtimeCertification:false},
    trace:structuredClone(packageArtifact.lineage),
    stopBoundary:{requiredConsumer:'MALKOM',excludedConsumers:['AGENTIC_AI','RPA_BPM_WORKFLOW','SAP','TMS','WMS','OTHER_RUNTIME_PACKAGES'],productionPromotionAuthorized:false}
  };
  check(stableStringify({compilation,packageArtifact,readiness})===before,'CANONICAL_INPUT_MUTATION');
  return result;
}
