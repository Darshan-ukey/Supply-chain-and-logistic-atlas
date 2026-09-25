import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const toolDir = path.join(root, "tools", "atlas-release-controller");
const args = new Map(process.argv.slice(2).map(a => {
  const i=a.indexOf("="); return i<0?[a.replace(/^--/,""),true]:[a.slice(2,i),a.slice(i+1)];
}));
const configPath = path.join(toolDir, args.get("config") || "release-config.json");
const statePath = path.join(toolDir, args.get("state") || "release-state.snapshot.json");
const mode = args.get("mode") || "preflight";
const outDir = path.join(root, "artifacts", "atlas-v2-release-controller");
fs.mkdirSync(outDir,{recursive:true});

const readJson = p => JSON.parse(fs.readFileSync(p,"utf8"));
const config=readJson(configPath);
const state=readJson(statePath);
const allTasks=[...new Set(Object.values(config.phases).flat())];

function gitBlobSha(file){
  try { return execFileSync("git",["hash-object",file],{cwd:root,encoding:"utf8"}).trim(); }
  catch { return null; }
}
function isComplete(id){
  const t=state.tasks[id];
  return !!t && (t.statusType==="completed" || ["Done","Completed","Governed Complete"].includes(t.status));
}
function detectCycle(graph){
  const seen=new Set(), stack=new Set(), chain=[];
  function visit(n){
    if(stack.has(n)){ chain.push(n); return true; }
    if(seen.has(n)) return false;
    seen.add(n); stack.add(n);
    for(const d of (graph[n]||[])){ if(visit(d)){ chain.push(n); return true; } }
    stack.delete(n); return false;
  }
  for(const n of Object.keys(graph)){ if(visit(n)) return chain.reverse(); }
  return null;
}
function manifestPath(id){ return path.join(root,config.taskManifestDir,`${id}.yaml`); }

// A bare boolean is not authority. Each granted gate must carry a decision
// record naming who granted it and a durable reference to the real Owner
// decision (Linear comment URL or governance commit). Missing/malformed
// record fails closed even when the boolean itself is true.
function hasValidDecisionRecord(gateName){
  if(config.authorityEnforcement?.requireDecisionRecord!==true) return true;
  const rec=(state.ownerDecisionRecords||{})[gateName];
  if(!rec || typeof rec!=="object") return false;
  return (config.authorityEnforcement.decisionRecordFields||[]).every(
    f=>typeof rec[f]==="string" && rec[f].trim().length>0
  );
}
function gateGranted(gateName){
  return state.ownerAuthorizations[gateName]===true && hasValidDecisionRecord(gateName);
}
function ownerFreezeGranted(){
  return gateGranted("PRODUCT_CONTRACT_FREEZE");
}
function eligible(id){
  if(!state.tasks[id]) return false;
  if(isComplete(id)) return false;
  if(phaseFor(id)!=="prefreeze" && !ownerFreezeGranted()) return false;
  return (config.dependencies[id]||[]).every(isComplete);
}
function phaseFor(id){ return Object.entries(config.phases).find(([,v])=>v.includes(id))?.[0]||"unknown"; }

const checks=[];
const fail=(id,details)=>checks.push({id,result:"FAIL",details});
const pass=(id,details)=>checks.push({id,result:"PASS",details});

const stateAgeMs=Date.now()-new Date(state.generatedAt).getTime();
const maxAgeMs=config.staleness?.maxStateAgeMs;
(Number.isFinite(maxAgeMs) && stateAgeMs<=maxAgeMs)
  ? pass("STATE_SNAPSHOT_FRESH",{ageMs:stateAgeMs,maxAgeMs})
  : fail("STATE_SNAPSHOT_FRESH",{ageMs:stateAgeMs,maxAgeMs,generatedAt:state.generatedAt});

for(const gateName of Object.keys(config.ownerGates||{})){
  const claimed=state.ownerAuthorizations?.[gateName]===true;
  if(!claimed) continue; // gate not claimed granted; nothing to validate
  hasValidDecisionRecord(gateName)
    ? pass("OWNER_GATE_DECISION_RECORD_"+gateName,state.ownerDecisionRecords[gateName])
    : fail("OWNER_GATE_DECISION_RECORD_"+gateName,"ownerAuthorizations claims granted but ownerDecisionRecords is missing or malformed — treated as NOT granted");
}

const cycle=detectCycle(config.dependencies);
cycle?fail("DEPENDENCY_GRAPH_ACYCLIC",cycle):pass("DEPENDENCY_GRAPH_ACYCLIC","no cycle");

for(const id of allTasks){
  if(!state.tasks[id]) fail("TASK_STATE_"+id,"missing task state");
}
if(!checks.some(x=>x.id.startsWith("TASK_STATE_"))) pass("ALL_RELEASE_TASKS_HAVE_STATE",allTasks.length);

const pcSha=gitBlobSha(config.productContract.path);
pcSha===config.productContract.expectedBlobSha
 ? pass("PRODUCT_CONTRACT_IDENTITY",pcSha)
 : fail("PRODUCT_CONTRACT_IDENTITY",{expected:config.productContract.expectedBlobSha,actual:pcSha});

const cmSha=gitBlobSha(config.coverageMatrix.path);
cmSha===config.coverageMatrix.expectedBlobSha
 ? pass("COVERAGE_MATRIX_IDENTITY",cmSha)
 : fail("COVERAGE_MATRIX_IDENTITY",{expected:config.coverageMatrix.expectedBlobSha,actual:cmSha});

const missingManifests=allTasks.filter(id=>!fs.existsSync(manifestPath(id)));
missingManifests.length?fail("TASK_MANIFESTS",missingManifests):pass("TASK_MANIFESTS","all present");

if(config.qaPolicy.builderMaySelfApprove===false && config.qaPolicy.executableVerificationRequired===true)
  pass("QA_SEPARATION","builder cannot self-approve; executable verification required");
else fail("QA_SEPARATION",config.qaPolicy);

if(config.productCoherence.taskCompletionAloneIsInsufficient===true)
  pass("PRODUCT_NOT_EQUAL_TASK_DONE","explicit independent product coherence required");
else fail("PRODUCT_NOT_EQUAL_TASK_DONE","unsafe configuration");

const logOk=config.loggingPolicy.routine.includes("TASK_MANIFEST") &&
  !config.loggingPolicy.routine.includes("SHARED_LOG") &&
  config.loggingPolicy.sharedLogOnly.includes("OWNER_DECISION");
logOk?pass("LOG_POLICY","routine→manifest/actions; shared log only material"):fail("LOG_POLICY",config.loggingPolicy);

const gateNames=Object.keys(config.ownerGates);
["PRODUCT_CONTRACT_FREEZE","MATERIAL_PRODUCT_SCOPE_EXCEPTION","PRODUCTION_GO_LIVE"].every(x=>gateNames.includes(x))
 ? pass("OWNER_GATES",gateNames)
 : fail("OWNER_GATES",gateNames);

const freezeDeps=config.dependencies["ATL-110"]||[];
["ATL-103","ATL-118","ATL-119"].every(x=>freezeDeps.includes(x))
 ? pass("FREEZE_GATE_CHAIN",freezeDeps)
 : fail("FREEZE_GATE_CHAIN",freezeDeps);

const finalDeps=config.dependencies["ATL-109"]||[];
const requiredBeforeFinal=["ATL-95","ATL-104","ATL-105","ATL-106","ATL-107","ATL-108","ATL-111","ATL-112","ATL-113","ATL-114","ATL-115","ATL-116","ATL-117"];
requiredBeforeFinal.every(x=>finalDeps.includes(x))
 ? pass("FINAL_PRODUCT_GATE_DEPENDENCIES",finalDeps)
 : fail("FINAL_PRODUCT_GATE_DEPENDENCIES",{missing:requiredBeforeFinal.filter(x=>!finalDeps.includes(x))});

const allComponentTasks=config.phases.build.concat(config.phases.value);
const allTaskProof=allComponentTasks.every(id=>isComplete(id) && state.proof[id]==="PASS");
const allCoherence=config.productCoherence.requiredSuites.every(s=>state.productCoherence[s]==="PASS");
const finalTask=isComplete("ATL-109") && state.proof["ATL-109"]==="PASS";
const prodAuth=gateGranted("PRODUCTION_GO_LIVE");
const productReady=allTaskProof && allCoherence && finalTask && prodAuth;

if(productReady) pass("PRODUCT_READY","all component proof + coherence + ATL-109 + Owner go-live");
else pass("PRODUCT_READY_GUARD",{ready:false,allTaskProof,allCoherence,finalTask,prodAuth});

const eligibleNow=allTasks.filter(eligible);
if(isComplete("ATL-110") && !ownerFreezeGranted())
  pass("PRODUCT_CONTRACT_OWNER_GATE_GUARD","ATL-110 completion cannot release build without explicit Owner freeze");
else if(ownerFreezeGranted())
  pass("PRODUCT_CONTRACT_OWNER_GATE_GUARD","explicit Owner freeze recorded");
else
  pass("PRODUCT_CONTRACT_OWNER_GATE_GUARD","pre-freeze; Owner authorization absent as expected");
let stage;
if(!isComplete("ATL-110") || !ownerFreezeGranted()) stage="PRE_FREEZE";
else if(!allComponentTasks.every(isComplete)) stage="BUILD_AND_QA";
else if(!isComplete("ATL-117")) stage="VALUE_GATE";
else if(!isComplete("ATL-109")) stage="FINAL_ACCEPTANCE";
else stage=productReady?"PRODUCT_LIVE":"PRODUCT_COHERENCE_OR_OWNER_GATE";

const preflightPass=!checks.some(x=>x.result==="FAIL");
let outcome;
if(!preflightPass) outcome="FAIL_CLOSED_PREFLIGHT";
else if(stage==="PRE_FREEZE") outcome="SAFE_STOP_PRE_FREEZE";
else if(mode==="preflight") outcome="PREFLIGHT_PASS_EXECUTION_NOT_REQUESTED";
else outcome="EXECUTION_ELIGIBLE";

const report={
  schemaVersion:"0.1",
  generatedAt:new Date().toISOString(),
  releaseId:config.releaseId,
  mode,
  stage,
  outcome,
  preflightPass,
  productReady,
  eligibleNow,
  checks,
  productCoherence:state.productCoherence,
  ownerAuthorizations:state.ownerAuthorizations,
  safetyStatement:"No task status can make productReady=true without executable proof, all product-coherence suites, ATL-109 proof and explicit production Owner authorization."
};

fs.writeFileSync(path.join(outDir,"report.json"),JSON.stringify(report,null,2)+"\n");
const md=[
  "# Atlas v2 Temporary Release Controller — Run Report",
  "",
  `- Outcome: **${outcome}**`,
  `- Stage: **${stage}**`,
  `- Preflight: **${preflightPass?"PASS":"FAIL"}**`,
  `- Product ready: **${productReady?"YES":"NO"}**`,
  `- Eligible now: ${eligibleNow.length?eligibleNow.join(", "):"none"}`,
  "",
  "## Checks",
  ...checks.map(x=>`- ${x.result==="PASS"?"PASS":"FAIL"} — ${x.id}: ${typeof x.details==="string"?x.details:JSON.stringify(x.details)}`),
  "",
  "## Product coherence",
  ...Object.entries(state.productCoherence).map(([k,v])=>`- ${k}: ${v}`),
  "",
  "## Safety",
  report.safetyStatement,
  ""
].join("\n");
fs.writeFileSync(path.join(outDir,"report.md"),md);

console.log(md);
if(!preflightPass) process.exit(2);
if(mode==="execute" && stage!=="PRE_FREEZE"){
  console.log("EXECUTION_MODE_READY: dispatch layer may run only tasks listed in eligibleNow and must honor validation/QA contracts.");
}
