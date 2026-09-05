import fs from 'node:fs';
import {
  governedTarget,
  resolveAskTuple,
  askProjectionCoverage,
  buildAskProjectionEvidence,
  publicTraceFromAskProjection
} from '../lib/ask/p5-governed-retrieval.js';
import ask from '../lib/api/ask-atlas.js';

let failures=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} · ${label}`);if(!ok)failures++;};
process.env.ATLAS_LLM_PROVIDER='none';

for(const [moduleId,version] of [['road-ltl','1.5'],['ocean-fcl','0.6'],['ocean-lcl','0.6']]){
  const t=governedTarget(moduleId);
  check(t?.daughterModuleVersion===version,`${moduleId} resolves P4 governed target ${version}`);
  const tuple=resolveAskTuple({surface:'canvas',moduleId,selectedProcess:moduleId==='road-ltl'?'LTL-03':moduleId==='ocean-fcl'?'FCL-01':'LCL-01'},'');
  check(tuple?.moduleVersion===version,`${moduleId} missing browser version resolves only from governed P4 target registry`);
  check(tuple?.versionResolution==='P4_GOVERNED_TARGET_REGISTRY',`${moduleId} records governed version-resolution provenance`);
}
let mismatch=false;try{resolveAskTuple({moduleId:'ocean-fcl',moduleVersion:'0.5',selectedProcess:'FCL-01'},'')}catch(e){mismatch=Number(e.status)===409}
check(mismatch,'Ocean 0.5 exact-version request is rejected; no 0.6/0.5 substitution');

const ltl=buildAskProjectionEvidence({question:'Explain LTL-03',state:{surface:'daughter',moduleId:'road-ltl',moduleVersion:'1.5',selectedProcess:'LTL-03'}});
check(ltl.projectionClass==='PUBLIC_SAFE','Road LTL-03 Ask evidence is PUBLIC_SAFE projection-backed');
check(ltl.evidence.length===1&&ltl.evidence[0].class==='ATLAS_EXECUTION_DEPTH_PROJECTION','Road LTL-03 emits governed projection evidence only');
check((ltl.evidence[0].sourceIds||[]).length===0,'Ask projection citation does not expose exact source claim identifiers');
const lt=publicTraceFromAskProjection(ltl);
check(lt.moduleVersion==='1.5'&&lt.taskId==='LTL-03','Ask trace preserves exact Road LTL target tuple');
check(lt.semanticDepthsUsed.join('|')==='OVERVIEW|OPERATIONAL_KNOWLEDGE|EXECUTION_READINESS','Trace reports only three safe semantic depths used');
check(lt.protectedExecutionIncluded===false,'Trace does not imply protected execution inclusion');

const fcl=buildAskProjectionEvidence({question:'Explain FCL-01',state:{surface:'daughter',moduleId:'ocean-fcl',moduleVersion:'0.6',selectedProcess:'FCL-01'}});
check(fcl.projectionClass==='PUBLIC_SAFE','Ocean FCL 0.6 Ask evidence is PUBLIC_SAFE projection-backed');
check(fcl.projection?.trace?.moduleVersion==='0.6','Ocean FCL projection preserves exact 0.6 trace');
check(askProjectionCoverage(fcl.tuple).status==='FULL_PRECOMPILED_PUBLIC_SAFE','Ocean FCL 0.6 reports full precompiled public-safe coverage');

const lcl=buildAskProjectionEvidence({question:'Explain LCL-01',state:{surface:'canvas',moduleId:'ocean-lcl',selectedProcess:'LCL-01'}});
check(lcl.projection?.trace?.moduleVersion==='0.6','Ocean LCL Canvas Ask resolves exact 0.6 target without 0.5 fallback');

let roadGap=false;try{buildAskProjectionEvidence({question:'Explain LTL-04',state:{surface:'daughter',moduleId:'road-ltl',moduleVersion:'1.5',selectedProcess:'LTL-04'}})}catch(e){roadGap=Number(e.status)===404}
check(roadGap,'Road LTL 1.5 non-materialized inherited task fails closed instead of reading older raw semantic source');
check(askProjectionCoverage(resolveAskTuple({moduleId:'road-ltl',selectedProcess:'LTL-03'},'')).status==='REGISTERED_CANONICAL_PROFILE_TASK_SCOPED','Road LTL 1.5 task-scoped P2 materialization limitation is explicit');

function res(){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(x){this.body=x}}}
async function call(payload){const r=res();await ask({method:'POST',body:payload,headers:{}},r);return{status:r.statusCode,headers:r.headers,body:JSON.parse(r.body)}}
let x=await call({question:'Why is LTL-03 needed?',surfaceState:{surface:'daughter',moduleId:'road-ltl',moduleVersion:'1.5',selectedProcess:'LTL-03'}});
check(x.status===200&&x.body.stage==='atlas-p5-governed-ask','P5 Ask API responds from governed Ask stage');
check(x.body.grounding?.projectionClass==='PUBLIC_SAFE','P5 public A5 API declares PUBLIC_SAFE grounding');
check(x.body.trace?.moduleId==='road-ltl'&&x.body.trace?.moduleVersion==='1.5'&&x.body.trace?.taskId==='LTL-03','P5 API emits exact safe trace tuple');
check(x.body.citations.some(c=>c.class==='ATLAS_EXECUTION_DEPTH_PROJECTION'),'P5 API cites execution-depth projection, not raw ATLAS_PROCESS');
check(!x.body.citations.some(c=>c.class==='ATLAS_PROCESS'||c.class==='ATLAS_SOURCE'||c.class==='PROTECTED_WORK_DEFINITION'),'P5 A5 API excludes raw process/source/protected WD evidence classes');
const serialized=JSON.stringify(x.body);
for(const token of ['workDecompositionSeed','resolutionWorkflow','sourceClaimIds','sourceClaimPackRef','runtimeMappings','clientApplication','clientEnvironment'])check(!serialized.includes(token),`P5 public Ask response excludes protected token · ${token}`);

x=await call({question:'Explain FCL-01',surfaceState:{surface:'canvas',moduleId:'ocean-fcl',selectedProcess:'FCL-01'}});
check(x.status===200&&x.body.trace?.moduleVersion==='0.6','Canvas Ask resolves Ocean FCL to governed 0.6 target');
check(x.body.trace?.versionResolution==='P4_GOVERNED_TARGET_REGISTRY','Canvas Ask trace records registry-based exact-version resolution');

x=await call({question:'Explain FCL-01',surfaceState:{surface:'daughter',moduleId:'ocean-fcl',moduleVersion:'0.5',selectedProcess:'FCL-01'}});
check(x.status===409,'Ask API rejects stale Ocean 0.5 Daughter tuple instead of substituting');

const askSrc=fs.readFileSync(new URL('../lib/api/ask-atlas.js',import.meta.url),'utf8');
check(!askSrc.includes('supabaseService'),'ordinary Ask handler no longer reads protected WorkDefinition store directly');
check(!askSrc.includes("class==='PROTECTED_WORK_DEFINITION'"),'ordinary Ask fallback has no legacy protected WD evidence path');
check(askSrc.includes('includeProtectedExecution'),'protected Ask intent is explicit rather than automatic on Admin surface');
check(askSrc.includes('atlas.workdefinition.full.read'),'explicit protected intent is capability-gated');
check(askSrc.includes('GOVERNANCE_CANONICAL_NO_EXECUTION_IP'),'governance-safe projection class is explicit');

const traceSrc=fs.readFileSync(new URL('../lib/ask/p5-governed-retrieval.js',import.meta.url),'utf8');
check(!/moduleId\s*===?\s*['"]ocean-(fcl|lcl)['"]\s*\?\s*['"]0\.6/.test(traceSrc),'P5 Ask adapter does not hardcode Ocean version semantics');
check(traceSrc.includes('P4_CANVAS_DAUGHTER_TARGETS.json'),'Ask exact versions come from the governed P4 target registry');

console.log(failures?`FAIL · ${failures} P5 Ask/Trace/Governance gate(s) unresolved`:'PASS · P5 Ask Atlas / Trace / Governance projection-boundary certification');
if(failures)process.exit(1);
