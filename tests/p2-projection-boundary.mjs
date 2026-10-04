import {
  buildPublicExecutionDepthProjection,
  buildGovernanceOperationalProjection,
  publicProjectionForbiddenTokens
} from '../lib/projections/execution-depth-projection.js';

let failures=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};

const args={moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-03'};
const pub=buildPublicExecutionDepthProjection(args);
const pubText=JSON.stringify(pub);

check(pub.projectionClass==='PUBLIC_SAFE','public projection class is explicit');
check(pub.trace.moduleId==='road-ltl'&&pub.trace.moduleVersion==='1.5'&&pub.trace.taskId==='LTL-03','trace retains canonical module/task identity');
check(pub.trace.projectionContractVersion==='1.1.0','projection identifies P1R presentation contract version');
check(String(pub.trace.operationalKnowledgeContractVersion||'').includes('operational-knowledge-contract-2'),'trace retains Operational Knowledge v2 lineage');
check(String(pub.trace.informationResolutionContractVersion||'').includes('information-resolution-contract-v1'),'trace retains Information Resolution v1 lineage');
check(pub.operationalKnowledge?.businessMeaning?.length>20,'public projection contains useful Operational Knowledge');
check(pub.operationalKnowledge?.informationResolution?.canonicalObjectFamilies?.includes('TransportDocument'),'public projection contains safe canonical object semantics');
check(pub.operationalKnowledge?.informationResolution?.criticalResolutionSummaries?.length===4,'public projection contains human-readable resolution summaries');
check(pub.executionReadiness?.status==='CONDITIONAL_READY','readiness reflects unresolved source-context/metric gates');
check(pub.executionReadiness?.coverage?.informationResolution?.status==='PARTIAL','information resolution is not overstated as complete before proof');
check(pub.executionReadiness?.unresolved?.sourceContextPendingCount===4,'source-context unresolved count is projected without raw labels');
check(pub.executionReadiness?.unresolved?.clientBindingCount===6,'client-binding unresolved count is projected without raw client values');
check(pub.executionReadiness?.unresolved?.operationalKnowledgeCount===4,'client-binding requirements are not falsely counted as operational-knowledge gaps');
check(pub.operationalKnowledge?.informationResolution?.measurement?.metricDefinitionPendingCount===11,'metric-definition anomaly is surfaced as safe diagnostic count');
check(pub.protectedExecution?.workDecomposition?.detailIncluded===false,'Work Decomposition detail is absent');
check(pub.protectedExecution?.workDefinition?.detailIncluded===false,'WorkDefinition detail is absent');

for(const token of publicProjectionForbiddenTokens())check(!pubText.includes(token),`public projection excludes protected token · ${token}`);
for(const token of ['Shipper Code','Handling Unit Line No','exact Bill To Account Number semantics','120.83','sourceClaimIds','workDecompositionSeed']){
  check(!pubText.includes(token),`public projection excludes reconstructive/client/runtime detail · ${token}`);
}

const gov=buildGovernanceOperationalProjection(args);
const govText=JSON.stringify(gov);
const govCanonicalText=JSON.stringify(gov.canonical||{});
check(gov.projectionClass==='GOVERNANCE_CANONICAL_NO_EXECUTION_IP','governance projection class is explicit');
check(govText.includes('fieldPerformanceBaseline'),'governance projection can retain governed runtime-feedback evidence');
check(govText.includes('Shipper Code'),'governance projection can retain exact unresolved source/client labels');
check(Array.isArray(gov.executionProtectedOmissions)&&gov.executionProtectedOmissions.length>=5,'governance projection declares protected omissions');
check(!govCanonicalText.includes('workDecompositionSeed'),'governance canonical data strips protected decomposition seed');
check(!govCanonicalText.includes('resolutionWorkflow'),'governance canonical data strips reconstructive resolution workflow');
check(!govCanonicalText.includes('sourceClaimIds'),'governance canonical data strips detailed execution/source crosswalk from task rules');

let badPath=false;
try{buildPublicExecutionDepthProjection({moduleId:'../../private-seed',moduleVersion:'1',taskId:'x'})}catch(e){badPath=e?.status===404}
check(badPath,'unregistered request input cannot become a filesystem path');

console.log(failures?`FAIL · ${failures} P2 projection boundary check(s) failed`:'PASS · P2 projection boundary · safe projection useful and protected execution detail absent');
if(failures)process.exit(1);
