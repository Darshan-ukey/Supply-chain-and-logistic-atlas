import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT=process.cwd();
const REGISTRY_PATH='governance/presentation/p2-projection-source-registry.json';
const PROJECTION_VERSION='1.1.0';

function readJson(relativePath){
  const full=path.join(ROOT,relativePath);
  return JSON.parse(fs.readFileSync(full,'utf8'));
}
function readGzipBase64Json(relativePath){
  const full=path.join(ROOT,relativePath);
  const encoded=fs.readFileSync(full,'utf8').trim();
  return JSON.parse(zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function statusCounts(items=[]){
  return items.reduce((out,item)=>{const key=String(item?.status||'UNKNOWN');out[key]=(out[key]||0)+1;return out;},{});
}
function sourceEntry(moduleId,moduleVersion){
  const registry=readJson(REGISTRY_PATH);
  const key=`${moduleId}@${moduleVersion}`;
  const entry=(registry.sources||[]).find(x=>x.sourceKey===key&&x.materialized===true);
  if(!entry){const e=new Error(`Projection source is not materialized/registered: ${key}`);e.status=404;throw e}
  return entry;
}
function findTask(container,collection,idField,taskId){
  const items=container?.[collection];
  if(!Array.isArray(items))return null;
  return items.find(x=>String(x?.[idField])===String(taskId))||null;
}
function loadPrecompiledPublicProjection(entry,taskId){
  const bundle=readGzipBase64Json(entry.publicProjectionBundlePath);
  const projection=bundle?.sources?.[entry.sourceKey]?.[taskId];
  if(!projection){const e=new Error(`Task is not materialized in registered public-safe projection source: ${taskId}`);e.status=404;throw e}
  return clone(projection);
}
export function loadCanonicalProjectionSource({moduleId,moduleVersion,taskId}){
  const entry=sourceEntry(moduleId,moduleVersion);
  if(entry.publicProjectionBundlePath&&!entry.modulePath){
    const e=new Error(`Governance-canonical projection is not materialized on this server for ${entry.sourceKey}; only PUBLIC_SAFE is certified.`);e.status=404;throw e;
  }
  const modulePayload=readJson(entry.modulePath);
  const operationalPayload=entry.operationalKnowledgePath?readJson(entry.operationalKnowledgePath):null;
  const informationResolutionBaseline=entry.informationResolutionBaselinePath?readJson(entry.informationResolutionBaselinePath):null;
  const task=findTask(modulePayload,entry.taskCollection,entry.taskIdField,taskId);
  if(!task){const e=new Error(`Task is not materialized in registered projection source: ${taskId}`);e.status=404;throw e}
  const operationalTask=findTask(operationalPayload,entry.operationalTaskCollection,entry.operationalTaskIdField,taskId);
  return {entry,modulePayload,operationalPayload,informationResolutionBaseline,task,operationalTask};
}

function trace(source){
  const {entry,task}=source;
  return {
    moduleId:entry.moduleId,
    moduleVersion:entry.moduleVersion,
    taskId:task.id||task.taskId,
    canonicalTaskRef:task.a5ContractId||source.operationalTask?.canonicalTaskRef||null,
    canonicalProcessConceptId:task.canonicalProcessConceptId||null,
    operationalKnowledgeContractVersion:source.modulePayload?.contractRefs?.operationalKnowledgeContract||null,
    informationResolutionContractVersion:source.modulePayload?.contractRefs?.informationResolutionContract||null,
    projectionContractVersion:PROJECTION_VERSION,
    sourceProfile:entry.sourceProfile
  };
}
function safeRuleSummaries(rules=[]){
  return rules.map(x=>({fieldFamily:x.fieldFamily||'Other',summary:x.rule||null})).filter(x=>x.summary);
}
function readinessCoverage(source){
  const ok=source.task?.operationalKnowledgeV2||{};
  const baseline=source.informationResolutionBaseline||{};
  const unresolvedCount=(baseline.unresolvedSemantics||[]).length;
  const hasResolution=Array.isArray(ok.canonicalObjectModel)&&ok.canonicalObjectModel.length>0;
  const hasRules=Array.isArray(ok.criticalResolutionRules)&&ok.criticalResolutionRules.length>0;
  const hasExceptionPolicy=Boolean(source.operationalTask?.exceptionPolicy);
  const definedButNotProven=(defined)=>({status:defined?'PARTIAL':'MISSING'});
  return {
    informationResolution:{...definedButNotProven(hasResolution),...(hasResolution?{unresolvedCount}: {})},
    objectAssociation:definedButNotProven(hasRules),
    semanticClassification:definedButNotProven(hasRules),
    normalizationValidation:definedButNotProven(hasRules),
    conditionalApplicability:definedButNotProven(Boolean(ok.requiredWhen?.length||ok.prohibitedWhen?.length)),
    conflictPolicy:definedButNotProven(hasExceptionPolicy),
    humanReviewPolicy:definedButNotProven(hasExceptionPolicy)
  };
}
function publicInformationResolution(source){
  const ok=source.task?.operationalKnowledgeV2||{};
  const baseline=source.informationResolutionBaseline||{};
  const unresolvedCounts=statusCounts(baseline.unresolvedSemantics||[]);
  const metricPending=baseline.metricIntegrity?.status==='METRIC_DEFINITION_REQUIRED';
  return {
    canonicalObjectFamilies:clone(ok.canonicalObjectModel||[]),
    applicability:{requiredWhen:clone(ok.requiredWhen||[]),prohibitedWhen:clone(ok.prohibitedWhen||[])},
    resolutionCapabilities:['EVIDENCE_ACQUISITION','OBJECT_ASSOCIATION','NORMALIZATION','VALIDATION','CONFLICT_RESOLUTION','CONFIDENCE_AND_HUMAN_REVIEW'],
    criticalResolutionSummaries:safeRuleSummaries(ok.criticalResolutionRules||[]),
    unresolved:{total:Number((baseline.unresolvedSemantics||[]).length||0),countsByStatus:unresolvedCounts},
    measurement:{status:metricPending?'METRIC_DEFINITION_REQUIRED':'DEFINED',metricDefinitionPendingCount:metricPending?Number(baseline.metricIntegrity?.reportedAccuracyAbove100Count||0):0,targetMeasurementFamilies:clone(baseline.measurementModel||[])}
  };
}
function publicReadiness(source){
  const baseline=source.informationResolutionBaseline||{};
  const statusMap=statusCounts(baseline.unresolvedSemantics||[]);
  const raw=String(source.task?.executionReadiness?.status||'').toUpperCase();
  const metricPending=baseline.metricIntegrity?.status==='METRIC_DEFINITION_REQUIRED';
  const sourceContextPending=Number(statusMap.SOURCE_CONTEXT_PENDING||0);
  const clientBindingCount=Number(statusMap.CLIENT_BINDING_REQUIRED||0);
  const unknownCount=Number(statusMap.UNKNOWN||0);
  const conditional=raw.includes('WHEN_')||raw.includes('CONDITIONAL')||sourceContextPending>0||metricPending;
  return {
    status:conditional?'CONDITIONAL_READY':'READY_FOR_DECOMPOSITION',decompositionRequired:true,decompositionStatus:'REQUIRED_NOT_STARTED',executorReadyStatus:'NOT_READY',independentExecutorProofStatus:'PENDING',coverage:readinessCoverage(source),
    unresolved:{operationalKnowledgeCount:sourceContextPending+unknownCount,sourceContextPendingCount:sourceContextPending,clientBindingCount,metricDefinitionPendingCount:metricPending?1:0,unknownCount},
    dependencies:{deterministicVsJudgement:'UNKNOWN',hitlRequired:true,systemActionRequired:false,clientBindingRequired:clientBindingCount>0},
    downstream:{workDecompositionStatus:'NOT_YET_COMPILED',workDefinitionStatus:'NOT_YET_COMPILED'}
  };
}
export function buildPublicExecutionDepthProjection(args){
  const entry=sourceEntry(args.moduleId,args.moduleVersion);
  if(entry.publicProjectionBundlePath)return loadPrecompiledPublicProjection(entry,args.taskId);
  const source=loadCanonicalProjectionSource(args);
  const task=source.task;const ok=task.operationalKnowledgeV2||{};
  return {
    schemaVersion:'atlas-execution-depth-public-projection-v1',projectionClass:'PUBLIC_SAFE',trace:trace(source),
    overview:{title:task.label||null,purpose:ok.businessMeaning||source.operationalTask?.businessMeaning||null,trigger:task.trigger||null,before:task.before||null,after:task.after||null,outcome:task.outcome||null,semanticStatus:source.modulePayload.status||null},
    operationalKnowledge:{businessMeaning:ok.businessMeaning||source.operationalTask?.businessMeaning||null,why:ok.why||source.operationalTask?.why||null,informationResolution:publicInformationResolution(source),ruleSummary:task.rule||null,controlSummary:task.control||null,actionSummary:task.action||null,timingSummary:task.clock||null,evidenceSummary:task.evidence||null,clientDependencySummary:{bindingRequired:(source.informationResolutionBaseline?.unresolvedSemantics||[]).some(x=>x.status==='CLIENT_BINDING_REQUIRED'),exactClientValuesIncluded:false,exactRuntimeMappingsIncluded:false}},
    executionReadiness:publicReadiness(source),
    protectedExecution:{workDecomposition:{status:'NOT_YET_COMPILED',detailIncluded:false},workDefinition:{status:'NOT_YET_COMPILED',detailIncluded:false}}
  };
}

function stripExecutionProtectedFromTask(task){
  const out=clone(task)||{};
  if(out.operationalKnowledgeV2){delete out.operationalKnowledgeV2.resolutionWorkflow;if(Array.isArray(out.operationalKnowledgeV2.criticalResolutionRules)){out.operationalKnowledgeV2.criticalResolutionRules=out.operationalKnowledgeV2.criticalResolutionRules.map(x=>{const y={...x};delete y.sourceClaimIds;return y;});}delete out.operationalKnowledgeV2.sourceClaimPackRef;delete out.operationalKnowledgeV2.runtimeFeedbackProfileRef;}
  return out;
}
function stripExecutionProtectedOperationalTask(task){const out=clone(task)||{};delete out.workDecompositionSeed;return out;}
function governanceBaseline(baseline){return clone(baseline)||{};}
export function buildGovernanceOperationalProjection(args){
  const source=loadCanonicalProjectionSource(args);
  return {schemaVersion:'atlas-operational-governance-projection-v1',projectionClass:'GOVERNANCE_CANONICAL_NO_EXECUTION_IP',trace:trace(source),canonical:{daughterTask:stripExecutionProtectedFromTask(source.task),operationalKnowledge:stripExecutionProtectedOperationalTask(source.operationalTask),informationResolutionBaseline:governanceBaseline(source.informationResolutionBaseline)},executionProtectedOmissions:['operationalKnowledgeV2.resolutionWorkflow','operationalKnowledgeV2.criticalResolutionRules[].sourceClaimIds','operationalKnowledgeV2.sourceClaimPackRef','operationalKnowledgeV2.runtimeFeedbackProfileRef','taskOperationalKnowledge.workDecompositionSeed','fullWorkDecomposition','fullWorkDefinition','runtimeProjection']};
}
export function publicProjectionForbiddenTokens(){return ['workDecompositionSeed','resolutionWorkflow','sourceClaimIds','sourceClaimPackRef','runtimeFeedbackProfileRef','fieldPerformanceBaseline','sourceRefs','clientFieldOrApiElement','runtimeMappings','clientApplication','clientEnvironment'];}
