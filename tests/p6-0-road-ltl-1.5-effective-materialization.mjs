import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {
  buildPublicExecutionDepthProjection,
  buildGovernanceOperationalProjection,
  publicProjectionForbiddenTokens
} from '../lib/projections/execution-depth-projection.js';

let failures=0;
const root=process.cwd();
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++;};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha256=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const expectedIds=new Set(Array.from({length:22},(_,i)=>`LTL-${String(i+1).padStart(2,'0')}`));
const bundlePath='data/materialized/road-ltl-1.5-public-safe-projections.json.gz.b64';
const registryPath='governance/presentation/p2-projection-source-registry.json';
const certPath='governance/baselines/P6_0_ROAD_LTL_1_5_SOURCE_MATERIALIZATION_CERTIFICATION.json';

check(fs.existsSync(path.join(root,bundlePath)),'Road LTL 1.5 effective PUBLIC_SAFE bundle exists');
check(fs.existsSync(path.join(root,registryPath)),'P2 source registry exists');
check(fs.existsSync(path.join(root,certPath)),'P6.0 source/materialization certification exists');

let bundle=null;
try{
  bundle=JSON.parse(zlib.gunzipSync(Buffer.from(read(bundlePath).trim(),'base64')).toString('utf8'));
  check(true,'Road LTL 1.5 effective PUBLIC_SAFE bundle decodes');
}catch(err){check(false,`Road LTL 1.5 effective PUBLIC_SAFE bundle decodes · ${err.message}`);}

const cert=JSON.parse(read(certPath));
check(cert.status==='PASS','P6.0 exact-source/materialization certification is PASS');
check(cert.sourceVault?.fileId==='1CVUC40CZuhexs8oJjasBFw7OAjv4AhUI','governed Drive source-vault file is pinned');
check(cert.sourceVault?.releaseZipSha256==='b81b22d2a31869441ccfbbee05a24f6ac296d32fd56ce4c46472cac7894eb289','frozen source-vault release ZIP SHA-256 is pinned');
check(cert.frozenBase?.moduleSha256==='c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4','frozen Road LTL 1.4 module SHA-256 is pinned');
check(cert.frozenBase?.operationalKnowledgeSha256==='6e5899b2c31f7458a7959ead18950911ea916a366ac28d2aeee7077855dac13e','frozen Road LTL 1.4 Operational Knowledge SHA-256 is pinned');
check(cert.frozenOverlay?.materializationMethod==='LOSSLESS_INHERIT_BASE_THEN_APPLY_DECLARED_OVERRIDE','1.5 effective materialization method is explicitly lossless inheritance plus declared override');
check(JSON.stringify(cert.frozenOverlay?.changedTaskIds)==='["LTL-03"]','only LTL-03 is a declared 1.5 semantic override');
check(cert.publicSafeMaterialization?.coverage==='22/22','certification records 22/22 effective PUBLIC_SAFE coverage');
check(cert.publicSafeMaterialization?.semanticFallbackPermitted===false,'certification prohibits runtime semantic fallback');
check(sha256(bundlePath)==='13143cc785889465024e7037ad70e841ef731b2d7b4700e7e61da7e0761a1502','materialized bundle SHA-256 matches certification lock');

const registry=JSON.parse(read(registryPath));
const source=(registry.sources||[]).find(x=>x.sourceKey==='road-ltl@1.5');
check(!!source,'P2 registry resolves exact road-ltl@1.5 source');
if(source){
  check(source.materialized===true,'road-ltl@1.5 is materialized');
  check(source.publicProjectionBundlePath===bundlePath,'road-ltl@1.5 resolves the effective public-safe bundle');
  check(source.baseVersion==='1.4','road-ltl@1.5 registry records frozen 1.4 base lineage');
  check(source.baseCanonicalModuleSha256===cert.frozenBase.moduleSha256,'registry base module SHA matches source certification');
  check(source.baseOperationalKnowledgeSha256===cert.frozenBase.operationalKnowledgeSha256,'registry base Operational Knowledge SHA matches source certification');
  check(source.effectiveMaterialization?.effectiveTaskCount===22,'registry records 22 effective tasks');
  check(source.effectiveMaterialization?.inheritedTaskCount===21,'registry records 21 inherited tasks');
  check(JSON.stringify(source.effectiveMaterialization?.directOverrideTaskIds)==='["LTL-03"]','registry records only LTL-03 as direct override');
  check(source.effectiveMaterialization?.semanticFallbackPermitted===false,'registry prohibits semantic fallback');
}

const projections=bundle?.sources?.['road-ltl@1.5']||{};
const actualIds=Object.keys(projections);
check(actualIds.length===22,'Road LTL 1.5 bundle contains exactly 22 A5 tasks');
check(actualIds.every(id=>expectedIds.has(id))&&[...expectedIds].every(id=>actualIds.includes(id)),'Road LTL 1.5 bundle contains the complete LTL-01…LTL-22 set');

const forbidden=publicProjectionForbiddenTokens();
for(const taskId of [...expectedIds]){
  const stored=projections[taskId];
  check(!!stored,`${taskId} exists in effective 1.5 bundle`);
  if(!stored)continue;
  check(stored.projectionClass==='PUBLIC_SAFE',`${taskId} is PUBLIC_SAFE`);
  check(stored.trace?.moduleId==='road-ltl'&&String(stored.trace?.moduleVersion)==='1.5'&&stored.trace?.taskId===taskId,`${taskId} preserves exact road-ltl@1.5 trace tuple`);
  check(stored.protectedExecution?.workDecomposition?.detailIncluded===false,`${taskId} excludes Work Decomposition detail`);
  check(stored.protectedExecution?.workDefinition?.detailIncluded===false,`${taskId} excludes WorkDefinition detail`);
  const serialized=JSON.stringify(stored);
  for(const token of forbidden)check(!serialized.includes(token),`${taskId} excludes protected token · ${token}`);
  try{
    const runtime=buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.5',taskId});
    check(JSON.stringify(runtime)===serialized,`${taskId} runtime resolves exact certified 1.5 projection without rewrite/fallback`);
  }catch(err){check(false,`${taskId} runtime projection resolves · ${err.message}`);}
}

for(const taskId of [...expectedIds].filter(x=>x!=='LTL-03')){
  const t=projections[taskId];
  check(t.trace?.effectiveLineage?.semanticSourceVersion==='1.4',`${taskId} records frozen 1.4 semantic source lineage`);
  check(t.trace?.effectiveLineage?.effectiveModuleVersion==='1.5',`${taskId} publishes as effective 1.5`);
  check(t.trace?.effectiveLineage?.inheritance==='LOSSLESS_UNCHANGED_TASK',`${taskId} is explicitly lossless inherited`);
  check(t.operationalKnowledge?.informationResolution?.status==='NOT_POPULATED_AT_OKV2_DEPTH',`${taskId} does not fabricate OKv2 Information Resolution`);
}

const ltl03=projections['LTL-03'];
check(ltl03.trace?.effectiveLineage?.semanticSourceVersion==='1.5'&&ltl03.trace?.effectiveLineage?.inheritance==='DIRECT_GOVERNED_OVERRIDE','LTL-03 remains the direct governed 1.5 override');
check(ltl03.operationalKnowledge?.informationResolution?.canonicalObjectFamilies?.includes('TransportDocument'),'LTL-03 retains 1.5 Information Resolution canonical object model');
check(ltl03.operationalKnowledge?.informationResolution?.criticalResolutionSummaries?.length===4,'LTL-03 retains four governed critical Information Resolution summaries');
check(ltl03.operationalKnowledge?.informationResolution?.unresolved?.countsByStatus?.SOURCE_CONTEXT_PENDING===4,'LTL-03 retains four SOURCE_CONTEXT_PENDING semantics');
check(ltl03.operationalKnowledge?.informationResolution?.unresolved?.countsByStatus?.CLIENT_BINDING_REQUIRED===6,'LTL-03 retains six CLIENT_BINDING_REQUIRED semantics');
check(ltl03.operationalKnowledge?.informationResolution?.measurement?.metricDefinitionPendingCount===11,'LTL-03 retains eleven metric-definition-pending source measurements');
check(ltl03.executionReadiness?.status==='CONDITIONAL_READY','LTL-03 remains CONDITIONAL_READY rather than overstated ready');

let unknown404=false;
try{buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-99'});}catch(err){unknown404=Number(err?.status)===404;}
check(unknown404,'unknown Road LTL 1.5 task fails closed');
let base404=false;
try{buildPublicExecutionDepthProjection({moduleId:'road-ltl',moduleVersion:'1.4',taskId:'LTL-04'});}catch(err){base404=Number(err?.status)===404;}
check(base404,'runtime request for unregistered road-ltl@1.4 fails closed; no base-version fallback path');

try{
  const gov=buildGovernanceOperationalProjection({moduleId:'road-ltl',moduleVersion:'1.5',taskId:'LTL-03'});
  check(gov.projectionClass==='GOVERNANCE_CANONICAL_NO_EXECUTION_IP','existing direct LTL-03 governance projection remains available');
  const s=JSON.stringify(gov);
  for(const token of ['workDecompositionSeed','resolutionWorkflow','sourceClaimIds'])check(!s.includes(token),`LTL-03 governance projection still strips execution IP · ${token}`);
  check(Boolean(gov.canonical?.informationResolutionBaseline?.fieldPerformanceBaseline),'LTL-03 governance projection retains governed diagnostic baseline as before P6.0');
}catch(err){check(false,`existing LTL-03 governance projection remains available · ${err.message}`);}

console.log(failures?`FAIL · ${failures} P6.0 Road LTL 1.5 gate(s) unresolved`:'PASS · P6.0 Road LTL 1.5 effective materialization certification');
if(failures)process.exit(1);
