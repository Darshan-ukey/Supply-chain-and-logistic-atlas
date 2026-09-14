import fs from 'node:fs';

const path = 'governance/baselines/P6_1_V1_LTL03_RECONSTRUCTED_DECOMPOSITION.json';
const artifact = JSON.parse(fs.readFileSync(path, 'utf8'));

const BINDING_ID = 'CB-LTL03-EXECUTOR-AUTHORITY';
const BLOCKING_REASON = 'Frozen P6.1 V1 requires resolved system/actor authority or an explicit binding requirement before a terminal leaf may be classified EXECUTOR_READY. The pinned LTL-03 sources do not establish executor authority for these units; fail closed to client binding rather than infer authority.';

const byId = new Map(artifact.workUnits.map((u) => [u.workUnitId, u]));
const parentIds = new Set(artifact.workUnits.map((u) => u.parentWorkUnitId).filter(Boolean));
const leaves = artifact.workUnits.filter((u) => !parentIds.has(u.workUnitId));

let converted = 0;
for (const unit of leaves) {
  if (unit.executorReadiness?.status !== 'EXECUTOR_READY') continue;
  unit.executorReadiness.status = 'BLOCKED_BY_CLIENT_BINDING';
  unit.executorReadiness.blockingReasons = Array.from(new Set([...(unit.executorReadiness.blockingReasons || []), BLOCKING_REASON]));
  unit.executorReadiness.requiredClientBindings = Array.from(new Set([...(unit.executorReadiness.requiredClientBindings || []), BINDING_ID]));
  unit.executorReadiness.requiredKnowledgeGaps = unit.executorReadiness.requiredKnowledgeGaps || [];
  unit.executorReadiness.downstreamCompilationTarget = 'CANONICAL_WORKDEFINITION';
  unit.fallbackIfBlocked = unit.fallbackIfBlocked || 'Do not execute or infer authority. Route to governed client-binding resolution for executor/system/actor authority; retain the source-grounded decomposition and evidence unchanged.';
  converted++;
}

if (converted !== 38) {
  throw new Error(`Expected to convert exactly 38 EXECUTOR_READY leaves; converted ${converted}.`);
}

const freshLeaves = artifact.workUnits.filter((u) => !parentIds.has(u.workUnitId));
const counts = { EXECUTOR_READY: 0, BLOCKED_BY_CLIENT_BINDING: 0, BLOCKED_BY_KNOWLEDGE_GAP: 0 };
for (const leaf of freshLeaves) {
  const s = leaf.executorReadiness?.status;
  if (!(s in counts)) throw new Error(`Invalid terminal status ${s} on ${leaf.workUnitId}`);
  counts[s]++;
}

const requiredClientBindings = Array.from(new Set(freshLeaves.flatMap((u) => u.executorReadiness?.requiredClientBindings || []))).sort();
const requiredKnowledgeGaps = Array.from(new Set(freshLeaves.flatMap((u) => u.executorReadiness?.requiredKnowledgeGaps || []))).sort();

artifact.executionReadinessStatus = `PARTIAL__${counts.EXECUTOR_READY}_EXECUTOR_READY__${counts.BLOCKED_BY_CLIENT_BINDING}_CLIENT_BINDING_BLOCKED__${counts.BLOCKED_BY_KNOWLEDGE_GAP}_KNOWLEDGE_GAP_BLOCKED`;
artifact.summary.workUnitCount = artifact.workUnits.length;
artifact.summary.leafCount = freshLeaves.length;
artifact.summary.leafStatusCounts = counts;
artifact.summary.knowledgeGapCount = requiredKnowledgeGaps.length;
artifact.summary.clientBindingRefCount = requiredClientBindings.length;
artifact.summary.requiredKnowledgeGaps = requiredKnowledgeGaps;
artifact.summary.requiredClientBindings = requiredClientBindings;
artifact.summary.executorProof = 'STRICT_P6_1_V1_FAIL_CLOSED: no leaf is asserted EXECUTOR_READY until executor/system/actor authority is explicitly bound. Source-grounded decomposition details are preserved; 38 formerly ready leaves are now client-binding blocked by CB-LTL03-EXECUTOR-AUTHORITY.';
artifact.summary.workDefinitionCompilationStatus = 'BLOCKED_PENDING_EXECUTOR_AUTHORITY_BINDING';

artifact.nonBlockingKnownGaps = artifact.nonBlockingKnownGaps || {};
artifact.nonBlockingKnownGaps.reconstructionGovernance = {
  ...(artifact.nonBlockingKnownGaps.reconstructionGovernance || {}),
  classification: 'RECONSTRUCTED_P6_1_V1',
  authorityGate: BINDING_ID,
  authorityGateBasis: 'EXECUTABILITY_AND_RECURSIVE_DECOMPOSITION_STANDARD_V1_FROZEN.md + CANONICAL_WORK_DECOMPOSITION_COMPILER_SPEC_V1_FROZEN.md',
  note: 'This change does not invent an executor. It converts unresolved executor authority into the explicit client-binding dependency permitted by the frozen V1 standard.'
};

if (counts.EXECUTOR_READY !== 0 || counts.BLOCKED_BY_CLIENT_BINDING !== 45 || counts.BLOCKED_BY_KNOWLEDGE_GAP !== 3) {
  throw new Error(`Unexpected terminal counts after authority gate: ${JSON.stringify(counts)}`);
}

fs.writeFileSync(path, JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ converted, workUnits: artifact.workUnits.length, leaves: freshLeaves.length, counts, clientBindingRefs: requiredClientBindings.length, knowledgeGapRefs: requiredKnowledgeGaps.length }, null, 2));
