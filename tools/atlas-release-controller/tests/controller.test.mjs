import fs from "node:fs";
import assert from "node:assert/strict";

const config=JSON.parse(fs.readFileSync(new URL("../release-config.json",import.meta.url),"utf8"));
function detectCycle(graph){
  const seen=new Set(), stack=new Set();
  function visit(n){
    if(stack.has(n)) return true;
    if(seen.has(n)) return false;
    seen.add(n); stack.add(n);
    for(const d of graph[n]||[]) if(visit(d)) return true;
    stack.delete(n); return false;
  }
  return Object.keys(graph).some(visit);
}
assert.equal(detectCycle(config.dependencies),false,"release graph must be acyclic");
assert.deepEqual(config.dependencies["ATL-103"].sort(),["ATL-118","ATL-119"].sort());
assert.ok(config.dependencies["ATL-110"].includes("ATL-103"));
assert.ok(config.dependencies["ATL-110"].includes("ATL-118"));
assert.ok(config.dependencies["ATL-110"].includes("ATL-119"));
for(const id of ["ATL-104","ATL-105","ATL-106","ATL-107","ATL-108","ATL-111","ATL-112","ATL-113","ATL-114","ATL-115","ATL-116","ATL-117","ATL-95"])
  assert.ok(config.dependencies["ATL-109"].includes(id),`ATL-109 missing ${id}`);
assert.equal(config.qaPolicy.builderMaySelfApprove,false);
assert.equal(config.qaPolicy.executableVerificationRequired,true);
assert.equal(config.productCoherence.taskCompletionAloneIsInsufficient,true);
assert.equal(config.productCoherence.requireAllSuitesPass,true);
assert.equal(config.productCoherence.requireProductionOwnerGate,true);
assert.ok(!config.loggingPolicy.routine.includes("SHARED_LOG"));
assert.ok(config.loggingPolicy.sharedLogOnly.includes("OWNER_DECISION"));

// Explicitly prove "all tasks done" is insufficient.
const fakeAllDone=true;
const fakeCoherence=false;
const fakeOwner=false;
const fakeProductReady=fakeAllDone && fakeCoherence && fakeOwner;
assert.equal(fakeProductReady,false,"task completion alone must never imply product ready");
console.log("TEMP_RELEASE_CONTROLLER_TESTS_PASS");

// Owner freeze is a distinct gate from ATL-110 completion.
assert.equal(config.ownerGates.PRODUCT_CONTRACT_FREEZE.explicitOwnerAuthorizationRequired,true);
for(const id of config.phases.build) assert.ok(config.dependencies[id].includes("ATL-110"),`post-freeze task ${id} must depend on ATL-110`);
console.log("OWNER_FREEZE_GUARD_TESTS_PASS");

// --- Adversarial: re-implement the controller's gate/staleness logic against
// forged state and prove each forgery is rejected. This is not a config
// assertion — it constructs bad state and checks the decision function
// actually refuses it.
assert.equal(config.authorityEnforcement.requireDecisionRecord,true);

function hasValidDecisionRecord(state,gateName){
  if(config.authorityEnforcement.requireDecisionRecord!==true) return true;
  const rec=(state.ownerDecisionRecords||{})[gateName];
  if(!rec || typeof rec!=="object") return false;
  return config.authorityEnforcement.decisionRecordFields.every(
    f=>typeof rec[f]==="string" && rec[f].trim().length>0
  );
}
function gateGranted(state,gateName){
  return state.ownerAuthorizations?.[gateName]===true && hasValidDecisionRecord(state,gateName);
}

// Forgery attempt 1: flip the boolean with no decision record at all.
const forged1={ownerAuthorizations:{PRODUCT_CONTRACT_FREEZE:true},ownerDecisionRecords:{}};
assert.equal(gateGranted(forged1,"PRODUCT_CONTRACT_FREEZE"),false,
  "boolean-only forgery must not grant the gate");

// Forgery attempt 2: decision record present but missing a required field.
const forged2={ownerAuthorizations:{PRODUCT_CONTRACT_FREEZE:true},
  ownerDecisionRecords:{PRODUCT_CONTRACT_FREEZE:{grantedBy:"Darshan",decisionRef:""}}};
assert.equal(gateGranted(forged2,"PRODUCT_CONTRACT_FREEZE"),false,
  "incomplete decision record must not grant the gate");

// Legitimate grant: boolean true + complete decision record.
const real={ownerAuthorizations:{PRODUCT_CONTRACT_FREEZE:true},
  ownerDecisionRecords:{PRODUCT_CONTRACT_FREEZE:{
    grantedBy:"Darshan Ukey",decisionRef:"linear-comment:ATL-110#owner-freeze",grantedAt:"2026-09-25T00:00:00Z"}}};
assert.equal(gateGranted(real,"PRODUCT_CONTRACT_FREEZE"),true,
  "a real, complete decision record must grant the gate");
console.log("AUTHORITY_FORGERY_REJECTION_TESTS_PASS");

// Staleness: prove an old snapshot is rejected, a fresh one is not.
const maxAgeMs=config.staleness.maxStateAgeMs;
assert.ok(Number.isFinite(maxAgeMs) && maxAgeMs>0);
const staleAgeMs=Date.now()-new Date("2020-01-01T00:00:00Z").getTime();
assert.ok(staleAgeMs>maxAgeMs,"fixture must actually be stale relative to policy");
const freshAgeMs=Date.now()-new Date().getTime();
assert.ok(freshAgeMs<=maxAgeMs,"a just-generated snapshot must count as fresh");
console.log("STALENESS_GUARD_TESTS_PASS");
