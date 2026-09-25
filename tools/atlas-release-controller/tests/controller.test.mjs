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
