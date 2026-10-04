import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DEPTHS,
  PUBLIC_PROJECTION_ENDPOINT,
  UNIVERSAL_DAUGHTER_RENDERER_VERSION,
  escapeHtml,
  parseDaughterSelection,
  fetchPublicProjection,
  renderShell,
  renderUnavailable
} from '../assets/universal-daughter-renderer-v2.js';

let failures=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++};
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const gitBlobSha=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')};

check(UNIVERSAL_DAUGHTER_RENDERER_VERSION==='2.0.0','renderer version is V2');
check(DEPTHS.length===5,'renderer exposes exactly five canonical depths');
check(DEPTHS.map(x=>x.label).join('|')==='Overview|Operational Knowledge|Execution Readiness|Work Decomposition|WorkDefinition','five-depth labels match frozen architecture');
check(DEPTHS.filter(x=>x.protected).map(x=>x.id).join('|')==='work-decomposition|work-definition','only Work Decomposition and WorkDefinition are protected depths');
check(PUBLIC_PROJECTION_ENDPOINT==='/api/execution-depth-projection','renderer consumes P2 public-safe projection endpoint');

const src=read('assets/universal-daughter-renderer-v2.js');
for(const token of ['road-ltl','LTL-03','ocean-fcl','ocean-lcl'])check(!src.toLowerCase().includes(token.toLowerCase()),`shared renderer contains no daughter-specific token · ${token}`);
for(const token of ['/api/work-decomposition','/api/admin-workdefinitions','/api/governance-operational-projection'])check(!src.includes(token),`public renderer does not know protected/governance endpoint · ${token}`);
for(const token of ['data/modules/','data/operational-knowledge/','data/source-claims/','private-seed'])check(!src.includes(token),`public renderer does not load canonical/private files · ${token}`);
for(const token of ['workDecompositionSeed','resolutionWorkflow','sourceClaimIds','runtimeMappings','fieldPerformanceBaseline'])check(!src.includes(token),`public renderer contains no protected canonical field token · ${token}`);
check(src.includes("CustomEvent('atlas:protected-execution-request'"),'protected depth emits neutral authorization intent instead of fetching');

const neutralProjection={
  schemaVersion:'atlas-execution-depth-public-projection-v1',projectionClass:'PUBLIC_SAFE',
  trace:{moduleId:'generic-module',moduleVersion:'9.9',taskId:'TASK-7',canonicalTaskRef:'a5-generic-7',canonicalProcessConceptId:'concept-7',projectionContractVersion:'1.1.0',operationalKnowledgeContractVersion:'ok-v2',informationResolutionContractVersion:'ir-v1'},
  overview:{title:'Validate governed execution identity',purpose:'Establish an execution-ready canonical identity.',trigger:'A governed request is accepted.',before:'Identity unresolved.',after:'Identity validated or explicitly pending.',outcome:'Traceable identity.',semanticStatus:'REFERENCE_CANDIDATE'},
  operationalKnowledge:{businessMeaning:'Resolve canonical information before localization.',why:'Downstream work needs validated semantics.',informationResolution:{canonicalObjectFamilies:['CanonicalObject','Reference[]'],applicability:{requiredWhen:['Execution identity is needed.'],prohibitedWhen:['Context is not applicable.']},resolutionCapabilities:['OBJECT_ASSOCIATION','VALIDATION'],criticalResolutionSummaries:[{fieldFamily:'Reference',summary:'Associate the reference to the correct canonical object.'}],unresolved:{total:1,countsByStatus:{SOURCE_CONTEXT_PENDING:1}},measurement:{status:'DEFINED',metricDefinitionPendingCount:0,targetMeasurementFamilies:['Validated Yield']}},ruleSummary:'Use governed canonical semantics.',controlSummary:'Validate identity and applicability.',actionSummary:'Resolve and validate.',timingSummary:'Before downstream execution.',evidenceSummary:'Validation evidence.',clientDependencySummary:{bindingRequired:true,exactClientValuesIncluded:false,exactRuntimeMappingsIncluded:false}},
  executionReadiness:{status:'CONDITIONAL_READY',decompositionRequired:true,decompositionStatus:'REQUIRED_NOT_STARTED',executorReadyStatus:'NOT_READY',independentExecutorProofStatus:'PENDING',coverage:{informationResolution:{status:'PARTIAL',unresolvedCount:1},objectAssociation:{status:'PARTIAL',unresolvedCount:1}},unresolved:{operationalKnowledgeCount:1,sourceContextPendingCount:1,clientBindingCount:1,metricDefinitionPendingCount:0,unknownCount:0},dependencies:{hitlRequired:true,systemActionRequired:false,clientBindingRequired:true},downstream:{workDecompositionStatus:'NOT_YET_COMPILED',workDefinitionStatus:'NOT_YET_COMPILED'}},
  protectedExecution:{workDecomposition:{status:'NOT_YET_COMPILED',detailIncluded:false},workDefinition:{status:'NOT_YET_COMPILED',detailIncluded:false}}
};
const rendered=renderShell(neutralProjection,'operational-knowledge');
check(rendered.includes('generic-module')===false,'view does not inject unrelated trace outside selected depth');
check(rendered.includes('Resolve canonical information before localization.'),'same renderer renders a non-domain-specific contract-conformant projection');
check(rendered.includes('Work Decomposition')&&rendered.includes('WorkDefinition'),'all protected depth tabs remain visible as semantic depths');
check(!rendered.includes('<script>'),'projection content does not create script markup');
check(escapeHtml('<img src=x onerror=alert(1)>')==='&lt;img src=x onerror=alert(1)&gt;','renderer escapes untrusted projection text');

const selection=parseDaughterSelection('?moduleId=generic&moduleVersion=1.2&taskId=T-4');
check(selection.complete&&selection.moduleId==='generic'&&selection.moduleVersion==='1.2'&&selection.taskId==='T-4','exact module/version/task tuple is parsed without substitution');
const incomplete=parseDaughterSelection('?moduleId=generic&taskId=T-4');
check(incomplete.complete===false,'incomplete exact-version selection is rejected');

let fetchUrl='';
const mockOk=async url=>{fetchUrl=url;return {ok:true,status:200,json:async()=>({ok:true,projection:neutralProjection})}};
const fetched=await fetchPublicProjection(selection,{fetchImpl:mockOk});
check(fetched===neutralProjection,'projection fetch accepts only returned PUBLIC projection object');
check(fetchUrl.includes('moduleVersion=1.2')&&fetchUrl.includes('taskId=T-4'),'requested exact version/task is preserved in projection API call');
let failedClosed=false;
try{await fetchPublicProjection(selection,{fetchImpl:async()=>({ok:false,status:404,json:async()=>({ok:false,error:'not registered'})})})}catch(e){failedClosed=e.code==='PROJECTION_UNAVAILABLE'}
check(failedClosed,'unpublished exact selection fails closed');
check(renderUnavailable('not registered').includes('No alternate Daughter version has been substituted.'),'failure UI explicitly rejects silent version substitution');

const daughter=read('daughter.html');
check(daughter.includes("from '/assets/universal-daughter-renderer-v2.js'"),'Daughter route uses shared V2 renderer module');
check(daughter.includes('PUBLIC-SAFE PROJECTION · PROTECTED DETAIL NOT PRELOADED'),'Daughter shell communicates projection/protection boundary');
check(!daughter.includes('/api/work-decomposition')&&!daughter.includes('/api/admin-workdefinitions'),'Daughter page does not call protected execution endpoints');

const vercel=JSON.parse(read('vercel.json'));
const daughterRewrite=(vercel.rewrites||[]).find(x=>x.source==='/daughter');
check(daughterRewrite?.destination==='/daughter.html','Vercel exposes dedicated /daughter route');
check((vercel.functions?.['api/*.js']?.maxDuration||0)===30,'P3 does not alter consolidated API function policy');

check(gitBlobSha('index.html')==='043802523b1618c143a0e78b88bbfb2afaa7c7dd','Canvas/index.html is byte-identical to P2 baseline');
check(gitBlobSha('data/modules/road-ltl-v1.5.json')==='b69883d5369be8aad15bb9325f910610da875771','Road LTL 1.5 semantic candidate is byte-identical to P2 baseline');

console.log(failures?`FAIL · ${failures} P3 universal Daughter renderer check(s) failed`:'PASS · P3 Universal Daughter Renderer V2 · generic, fail-closed, projection-only and Canvas-neutral');
if(failures)process.exit(1);
