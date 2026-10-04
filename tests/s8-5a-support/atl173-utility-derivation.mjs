// S8-5A support (ATL-173): deterministic SUCCESSOR derivation of the Malkom utility-proof findings from the corrected
// S8 package / readiness / projection lineage. It re-applies the governed ATL-173 method (the four-requirement ATL-140
// crosswalk evaluated against governed artifacts) and reports the corrected bounded state truthfully. It does NOT
// reproduce historical counts, never promotes readiness, and emits only public-safe content (counts, enums, ids already
// public in S8-4 summaries; no source ids, binding ids, knowledge-gap ids or handoff ids).
import {CORRECTED_PINS, assertCorrectedIdentities} from './successor-lineage.mjs';

export const UTILITY_SCHEMA = 'atlas-v1.5-malkom-utility-proof-successor-v1.0-s8-5a';
export const HISTORICAL_BASELINE = Object.freeze({
  status: 'HISTORICAL_ONLY',
  branch: 'atl-173-v15-malkom-utility-proof', commit: 'b6df8cfe581fb5ac2ff8f51774cdbdfc15a54f77', proofBlob: '8608c68f1007ea5f18b07452eeb9d3894b9aea40',
  pinnedStaleSourceBlobs: ['c3bb7336', 'd43f4130', '1a542b1a', '47fe62aa'],
  counts: {materialRequirements: 4, availableOrProjectable: 2, clientBindingRequired: 1, unsupportedOrUnconfirmed: 1},
  workSemantics: {state: 'AVAILABLE', requiredInputCount: 4, actionCount: 1, outcomeCount: 1, decision: true, rule: true, control: true, evidence: true},
  note: 'Evidence about the OLD candidate under test; not transferable to the corrected successor and not reproduced here.'
});

const need = (cond, code) => { if (!cond) throw new Error(code); };
const pickCount = (rows, pred) => rows.filter(pred).length;

export function deriveSuccessorUtilityProof(artifacts, hashes) {
  assertCorrectedIdentities(hashes); // fail closed on any stale/mutated input identity
  const {wd, package: pkg, readiness: rd, projection} = artifacts;
  need(Array.isArray(wd.definitions) && wd.definitions.length === 1, 'LINEAGE_WORKDEFINITION_COUNT');
  const wdId = wd.definitions[0].workDefinitionId;
  // identity/lineage chain must be internally consistent before it is reported as AVAILABLE
  need(rd.workDefinitionId === wdId && pkg.projection?.canonicalWorkDefinition?.workDefinitionId === wdId && projection.sourcePackage?.workDefinitionId === wdId, 'LINEAGE_WORKDEFINITION_ID_MISMATCH');
  need(rd.lineage?.inputHashes?.wd === hashes.wd && rd.lineage?.inputHashes?.binding === hashes.binding && rd.lineage?.inputHashes?.semantics === hashes.semanticsRecord, 'LINEAGE_READINESS_INPUT_HASH_MISMATCH');
  need(projection.sourcePackage?.inputHashes?.wd === hashes.wd && projection.sourcePackage?.inputHashes?.package === hashes.package && projection.sourcePackage?.inputHashes?.readiness === hashes.readiness, 'LINEAGE_PROJECTION_INPUT_HASH_MISMATCH');
  need(projection.sourcePackage?.packageId === pkg.packageId, 'LINEAGE_PACKAGE_ID_MISMATCH');
  const t = rd.totals;
  const iface = pkg.interface?.apiEndpointDisposition;
  need(iface === projection.release?.interface?.apiEndpointDisposition, 'INTERFACE_DISPOSITION_MISMATCH');

  const workSemanticsStatus = rd.workSemantics.state === 'AVAILABLE' && t.notCompiledLeafCount === 0 ? 'AVAILABLE' : 'PARTIAL';
  const bindingStatus = rd.clientBindings.unresolvedCount > 0 ? 'CLIENT_BINDING_REQUIRED' : 'RESOLVED';
  const requirements = [
    {requirement: 'Canonical identity/version/lineage', status: 'AVAILABLE', projection: 'PRESERVE', derivedFrom: 'workDefinition/package/readiness/projection identity chain verified', residual: 'None for bounded identity/lineage.'},
    {requirement: 'Work semantics', status: workSemanticsStatus, projection: 'PRESERVE_COMPILED_ONLY', derivedFrom: 'readiness.workSemantics + readiness.totals', residual: `${t.notCompiledLeafCount} of ${t.leafCount} leaves are not compiled; downstream consumers still face rediscovery for those leaves.`},
    {requirement: 'Client execution parameters', status: bindingStatus, projection: 'SEPARATE_BINDING', derivedFrom: 'readiness.clientBindings', residual: 'An authorized client/master-data owner must supply governed execution parameters before projection can execute.'},
    {requirement: 'Malkom API endpoint', status: iface, projection: 'NO_GUESSED_INTERFACE', derivedFrom: 'package.interface + projection.release.interface', residual: 'Confirm whether an API endpoint is actually required; no interface is implied.'}
  ];
  const counts = {
    materialRequirements: requirements.length,
    availableOrProjectable: pickCount(requirements, (r) => r.status === 'AVAILABLE'),
    partial: pickCount(requirements, (r) => r.status === 'PARTIAL'),
    clientBindingRequired: pickCount(requirements, (r) => r.status === 'CLIENT_BINDING_REQUIRED'),
    unsupportedOrUnconfirmed: pickCount(requirements, (r) => r.status === 'REQUIREMENT_NOT_CONFIRMED' || r.status === 'UNSUPPORTED')
  };
  need(counts.availableOrProjectable + counts.partial + counts.clientBindingRequired + counts.unsupportedOrUnconfirmed + pickCount(requirements, (r) => r.status === 'RESOLVED') === counts.materialRequirements, 'REQUIREMENT_STATUS_UNCLASSIFIED');
  const blockerTypes = [...new Set((rd.blockers || []).map((b) => b.type))].sort();
  return {
    schemaVersion: UTILITY_SCHEMA,
    classification: 'PUBLIC_NON_RECONSTRUCTIVE',
    proofId: 'utility-proof::road-ltl::LTL-04::malkom::successor-s8',
    scope: {moduleId: rd.moduleId, processId: rd.processId, workDefinitionId: wdId, packageId: pkg.packageId, consumer: 'MALKOM'},
    method: {basis: 'Deterministic re-derivation of the four-requirement ATL-140/ATL-173 Malkom crosswalk from the corrected S8 package/readiness/projection artifacts (identities verified against accepted pins before use).', historicalCountsReproduced: false, correctedIdentities: {...CORRECTED_PINS}},
    counts,
    requirements,
    reusableElements: {
      domainKnowledge: {state: rd.reusableDomainKnowledge.state, sourceCount: rd.reusableDomainKnowledge.sourceIds.length},
      workSemantics: {state: rd.workSemantics.state, workDefinitionVersion: rd.workSemantics.workDefinitionVersion, requiredInputCount: rd.workSemantics.requiredInputCount, actionCount: rd.workSemantics.actionCount, outcomeCount: rd.workSemantics.outcomeCount},
      rulesControlsCoverage: {...rd.rulesControlsCoverage},
      compilation: {leafCount: t.leafCount, compiledLeafCount: t.leafCount - t.notCompiledLeafCount, notCompiledLeafCount: t.notCompiledLeafCount, blockedByClientBindingLeafCount: t.blockedByClientBindingLeafCount, blockedByKnowledgeGapLeafCount: t.blockedByKnowledgeGapLeafCount, knowledgeGapEntryCount: rd.knowledgeGaps.length, blockerTypes},
      clientBindings: {state: rd.clientBindings.state, resolvedCount: rd.clientBindings.resolvedCount, unresolvedCount: rd.clientBindings.unresolvedCount}
    },
    residualDiscovery: [
      {type: 'CLIENT_BINDING_REQUIRED', count: rd.clientBindings.unresolvedCount, blocking: true},
      {type: 'KNOWLEDGE_GAP_BLOCKED_LEAF', count: t.blockedByKnowledgeGapLeafCount, blocking: true},
      {type: 'PARTIAL_WORKDEFINITION_COVERAGE', count: t.notCompiledLeafCount, blocking: true},
      {type: 'REQUIREMENT_NOT_CONFIRMED', id: 'Malkom API endpoint', blockingForCurrentJsonExport: false},
      {type: 'NOT_INDEPENDENTLY_PROVEN', status: rd.independentExecutorProofStatus, blocking: true}
    ],
    state: {
      projectionDisposition: rd.projection.disposition, projectionBlocked: rd.projection.blocked, universalExecutionReady: rd.universalExecutionReady, materializable: projection.release.materializable, runtimeCertification: projection.release.runtimeCertification,
      independentExecutorProofStatus: rd.independentExecutorProofStatus, clientBindingState: rd.clientBindings.state
    },
    limitations: [
      'Single representative Road LTL/LTL-04 scope only.',
      'No savings, effort reduction or economic benefit is claimed because governed evidence does not quantify them.',
      'No statistically robust enterprise study, cross-runtime comparison or final product kill decision.',
      'Projection remains fail-closed while the required client execution-parameters binding is unresolved.',
      'The corrected successor WorkDefinition is only partially compiled; the proof reports the corrected bounded state and does not claim the utility-value target is achieved.'
    ],
    historicalBaseline: {...HISTORICAL_BASELINE, delta: {
      availableOrProjectable: {historical: HISTORICAL_BASELINE.counts.availableOrProjectable, successor: counts.availableOrProjectable},
      workSemanticsState: {historical: HISTORICAL_BASELINE.workSemantics.state, successor: rd.workSemantics.state},
      requiredInputCount: {historical: HISTORICAL_BASELINE.workSemantics.requiredInputCount, successor: rd.workSemantics.requiredInputCount},
      outcomeCount: {historical: HISTORICAL_BASELINE.workSemantics.outcomeCount, successor: rd.workSemantics.outcomeCount},
      unresolvedClientBinding: {historical: 1, successor: rd.clientBindings.unresolvedCount}
    }}
  };
}

// Independent verifier: re-derives from the artifacts and compares; also enforces truthfulness invariants.
export function verifyUtilityProof(proof, artifacts, hashes) {
  const f = []; const fail = (code, d) => f.push({code, detail: d});
  let expected; try { expected = deriveSuccessorUtilityProof(artifacts, hashes); } catch (e) { return {ok: false, failures: [{code: e.message, detail: 'derivation refused'}]}; }
  if (JSON.stringify(proof) !== JSON.stringify(expected)) fail('PROOF_DRIFT', 'proof differs from deterministic derivation');
  const s = proof?.state ?? {};
  if (s.universalExecutionReady !== false || s.materializable !== false || s.runtimeCertification !== false || s.projectionBlocked !== true || s.independentExecutorProofStatus !== 'NOT_INDEPENDENTLY_PROVEN') fail('READINESS_PROMOTED', JSON.stringify(s));
  const ws = (proof?.requirements ?? []).find((r) => r.requirement === 'Work semantics');
  if (!ws || (ws.status === 'AVAILABLE' && proof?.reusableElements?.compilation?.notCompiledLeafCount > 0)) fail('WORK_SEMANTICS_OVERSTATED', ws?.status);
  if (proof?.method?.historicalCountsReproduced !== false) fail('HISTORICAL_COUNTS_CLAIMED_AS_CURRENT', '');
  if (!(proof?.limitations ?? []).some((l) => /No savings/.test(l))) fail('UTILITY_VALUE_CLAIM_GUARD_REMOVED', '');
  if (!(proof?.residualDiscovery ?? []).some((r) => r.type === 'CLIENT_BINDING_REQUIRED' && r.count >= 1)) fail('UNRESOLVED_BLOCKER_REMOVED', 'client binding');
  const {historicalBaseline, ...rest} = proof ?? {};
  const text = JSON.stringify(rest);
  for (const stale of HISTORICAL_BASELINE.pinnedStaleSourceBlobs) if (text.includes(stale)) fail('STALE_IDENTITY_IN_PROOF', stale);
  return {ok: f.length === 0, failures: f};
}
