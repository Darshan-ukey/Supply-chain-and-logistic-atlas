import fs from 'node:fs';
import path from 'node:path';
import {
  buildPublicExecutionDepthProjection,
  buildGovernanceOperationalProjection
} from '../projections/execution-depth-projection.js';

const ROOT=process.cwd();
const TARGETS_PATH='governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json';
const P2_SOURCE_PATH='governance/presentation/p2-projection-source-registry.json';
const cache=new Map();

function readJson(rel){
  if(cache.has(rel))return cache.get(rel);
  const value=JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
  cache.set(rel,value);
  return value;
}
function clean(v){return v===undefined||v===null?null:String(v).trim()||null}
function taskIdFromQuestion(question,moduleId){
  const q=String(question||'').toUpperCase();
  const prefix=moduleId==='road-ltl'?'LTL':moduleId==='ocean-fcl'?'FCL':moduleId==='ocean-lcl'?'LCL':null;
  if(!prefix)return null;
  const m=q.match(new RegExp(`\\b${prefix}-\\d{2}\\b`));
  return m?.[0]||null;
}
export function governedTarget(moduleId){
  const id=clean(moduleId);if(!id)return null;
  const registry=readJson(TARGETS_PATH);
  if(registry?.status!=='ACTIVE_P4_INTEGRATION_CONTRACT')return null;
  const t=registry.targets?.[id];
  if(!t||t.moduleId!==id||!t.daughterModuleVersion)return null;
  return t;
}
export function resolveAskTuple(rawState={},question=''){
  const moduleId=clean(rawState.moduleId||rawState.activeModule);
  if(!moduleId)return null;
  const target=governedTarget(moduleId);
  if(!target){const e=new Error(`No governed P4 Daughter target is registered for ${moduleId}`);e.status=404;throw e}
  const requestedVersion=clean(rawState.moduleVersion||rawState.version);
  const targetVersion=String(target.daughterModuleVersion);
  if(requestedVersion&&requestedVersion!==targetVersion){
    const e=new Error(`Ask Atlas exact-version mismatch: requested ${moduleId}@${requestedVersion}; governed target is ${moduleId}@${targetVersion}. No substitution performed.`);e.status=409;throw e;
  }
  const taskId=clean(rawState.selectedProcess||rawState.taskId)||taskIdFromQuestion(question,moduleId);
  return {
    moduleId,
    moduleVersion:targetVersion,
    taskId,
    versionResolution:requestedVersion?'REQUEST_EXACT_MATCH':'P4_GOVERNED_TARGET_REGISTRY',
    targetStatus:target.targetStatus||'GOVERNED_TARGET'
  };
}
function p2Source(tuple){
  const registry=readJson(P2_SOURCE_PATH);
  return (registry.sources||[]).find(x=>x.sourceKey===`${tuple.moduleId}@${tuple.moduleVersion}`&&x.materialized===true)||null;
}
export function askProjectionCoverage(tuple){
  if(!tuple)return {status:'NO_A5_CONTEXT'};
  const source=p2Source(tuple);
  if(!source)return {status:'UNMATERIALIZED_SOURCE',sourceKey:`${tuple.moduleId}@${tuple.moduleVersion}`};
  if(source.publicProjectionBundlePath)return {status:'FULL_PRECOMPILED_PUBLIC_SAFE',sourceKey:source.sourceKey,profile:source.sourceProfile};
  return {status:'REGISTERED_CANONICAL_PROFILE_TASK_SCOPED',sourceKey:source.sourceKey,profile:source.sourceProfile,firstProofTaskId:source.firstProofTaskId||null};
}
function projectionEvidence(projection,tuple,projectionClass){
  const title=projectionClass==='PUBLIC_SAFE'
    ? `${tuple.taskId} · ${projection?.overview?.title||'Execution depth'}`
    : `${tuple.taskId} · Governance operational projection`;
  return {
    key:`p5:${projectionClass}:${tuple.moduleId}:${tuple.moduleVersion}:${tuple.taskId}`,
    id:'P5E1',
    class:projectionClass==='PUBLIC_SAFE'?'ATLAS_EXECUTION_DEPTH_PROJECTION':'ATLAS_GOVERNANCE_OPERATIONAL_PROJECTION',
    title,
    sourceIds:[],
    moduleId:tuple.moduleId,
    content:projection
  };
}
export function buildAskProjectionEvidence({question,state,projectionClass='PUBLIC_SAFE'}){
  const tuple=resolveAskTuple(state,question);
  if(!tuple||!tuple.taskId)return {tuple,coverage:askProjectionCoverage(tuple),evidence:[],projectionClass:'NONE'};
  let projection;
  if(projectionClass==='GOVERNANCE_CANONICAL_NO_EXECUTION_IP')projection=buildGovernanceOperationalProjection(tuple);
  else projection=buildPublicExecutionDepthProjection(tuple);
  return {
    tuple,
    coverage:askProjectionCoverage(tuple),
    evidence:[projectionEvidence(projection,tuple,projection.projectionClass||projectionClass)],
    projectionClass:projection.projectionClass||projectionClass,
    projection
  };
}
export function publicTraceFromAskProjection(result,{protectedEvidenceUsed=false}={}){
  const p=result?.projection||null,t=result?.tuple||null;
  if(!t)return {
    schemaVersion:'atlas-ask-trace-v1',
    projectionClass:'UNIVERSE_REFERENCE',
    semanticDepthsUsed:[],
    protectedExecutionIncluded:false
  };
  const canonical=p?.trace||{};
  return {
    schemaVersion:'atlas-ask-trace-v1',
    projectionClass:result.projectionClass||'NONE',
    moduleId:t.moduleId,
    moduleVersion:t.moduleVersion,
    taskId:t.taskId||null,
    versionResolution:t.versionResolution,
    targetStatus:t.targetStatus,
    semanticDepthsUsed:p?['OVERVIEW','OPERATIONAL_KNOWLEDGE','EXECUTION_READINESS']:[],
    protectedDepths:['WORK_DECOMPOSITION','WORK_DEFINITION'],
    protectedExecutionIncluded:!!protectedEvidenceUsed,
    exactSourceClaimIdentifiersIncluded:false,
    clientValuesIncluded:false,
    runtimeMappingsIncluded:false,
    projectionContractVersion:canonical.projectionContractVersion||null,
    operationalKnowledgeContractVersion:canonical.operationalKnowledgeContractVersion||null,
    informationResolutionContractVersion:canonical.informationResolutionContractVersion||null,
    coverage:result.coverage||null
  };
}
