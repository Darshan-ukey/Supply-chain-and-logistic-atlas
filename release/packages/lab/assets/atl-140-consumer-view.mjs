// S8-4: ATL-140 additive Product UX behaviour, REBOUND onto the corrected S8-3E lineage.
// Behavioural source: ATL-140 @ e0c17bbb85bda27ebb9189be7cc845e3c48979dd (atl-140-malkom-consumer.html).
// Not a donor of ancestry. This module reads ONLY the public, non-reconstructive S8-3B..3E evidence
// summaries; it never reads protected WorkDefinition/package/readiness/projection/flow artifacts.
// Everything it shows is derived from those summaries; nothing is inferred or invented, and any
// lineage mismatch or promotion claim fails closed.

export const SUMMARY_PATHS = Object.freeze({
  reconstruction: '/governance/product/s8-3b-evidence/reconstruction-summary.json',
  packageReadiness: '/governance/product/s8-3c-evidence/package-readiness-summary.json',
  projection: '/governance/product/s8-3d-evidence/projection-summary.json',
  flow: '/governance/product/s8-3e-evidence/flow-summary.json'
});

export const CONSUMER_SCOPE = Object.freeze({
  moduleId: 'road-ltl',
  taskId: 'LTL-04',
  workDefinitionId: 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD'
});

const fail = (code) => { throw new Error(code); };
const same = (a, b, code) => { if (a !== b) fail(code); };

// Validates the four public summaries against each other and the S8 hash chain. Throws on any mismatch.
export function validateLineage(s) {
  if (!s || !s.reconstruction || !s.packageReadiness || !s.projection || !s.flow) fail('SUMMARY_MISSING');
  const {reconstruction: b, packageReadiness: c, projection: d, flow: e} = s;
  for (const x of [b, c, d, e]) same(x.classification, 'PUBLIC_NON_RECONSTRUCTIVE', 'SUMMARY_NOT_PUBLIC_NON_RECONSTRUCTIVE');
  const wd = b.outputHash;
  same(c.inputHashes.wd, wd, 'LINEAGE_MISMATCH_WD_3C');
  same(d.inputHashes.wd, wd, 'LINEAGE_MISMATCH_WD_3D');
  same(e.inputHashes.wd, wd, 'LINEAGE_MISMATCH_WD_3E');
  same(d.inputHashes.package, c.packageHash, 'LINEAGE_MISMATCH_PACKAGE_3D');
  same(e.inputHashes.package, c.packageHash, 'LINEAGE_MISMATCH_PACKAGE_3E');
  same(d.inputHashes.readiness, c.readinessHash, 'LINEAGE_MISMATCH_READINESS_3D');
  same(e.inputHashes.readiness, c.readinessHash, 'LINEAGE_MISMATCH_READINESS_3E');
  same(e.inputHashes.projection, d.projectionHash, 'LINEAGE_MISMATCH_PROJECTION_3E');
  same(c.inputHashes.binding, b.bindingHash, 'LINEAGE_MISMATCH_BINDING_3C');
  same(e.inputHashes.binding, b.bindingHash, 'LINEAGE_MISMATCH_BINDING_3E');
  same(e.inputHashes.semantics, b.semanticRecordHash, 'LINEAGE_MISMATCH_SEMANTICS_3E');
  same(e.workDefinitionId, CONSUMER_SCOPE.workDefinitionId, 'LINEAGE_MISMATCH_WD_ID');
  // No promotion is ever displayed as ready: fail closed if any summary claims otherwise.
  same(c.projectionDisposition, 'BLOCKED', 'PROMOTION_CLAIM_PROJECTION_DISPOSITION');
  same(d.readiness, 'BLOCKED', 'PROMOTION_CLAIM_READINESS');
  for (const x of [c, d]) {
    same(x.universalExecutionReady, false, 'PROMOTION_CLAIM_UNIVERSAL_EXECUTION');
    same(x.runtimeCertification, false, 'PROMOTION_CLAIM_RUNTIME_CERTIFICATION');
    same(x.independentExecutorProofStatus, 'NOT_INDEPENDENTLY_PROVEN', 'PROMOTION_CLAIM_EXECUTOR');
  }
  same(d.materializable, false, 'PROMOTION_CLAIM_MATERIALIZABLE');
  same(e.boundary.runtimeReadiness, 'NOT_PROMOTED', 'PROMOTION_CLAIM_FLOW_RUNTIME');
  same(e.boundary.canonicalMutation, false, 'CANONICAL_MUTATION_CLAIM');
  return true;
}

// Deterministic view model (public, non-reconstructive): no source/binding/handoff identifiers, no governed text.
export function buildConsumerViewModel(s) {
  validateLineage(s);
  const {reconstruction: b, packageReadiness: c, projection: d, flow: e} = s;
  const t = c.totals;
  return {
    scope: {...CONSUMER_SCOPE},
    lineage: {wd: b.outputHash, package: c.packageHash, readiness: c.readinessHash, projection: d.projectionHash, binding: b.bindingHash, semantics: b.semanticRecordHash, sourceReleaseTip: d.inputHashes.base, flowGraph: e.artifactIdentities.graphHash, flowBpmnSha256: e.artifactIdentities.bpmnSha256, flowSvgSha256: e.artifactIdentities.svgSha256, flowViewSha256: e.artifactIdentities.flowViewSha256},
    readiness: {projection: 'BLOCKED', clientBinding: 'CLIENT_BINDING_REQUIRED', unresolvedBindingCount: c.unresolvedBindingCount, universalExecutionReady: false, materializable: false, runtimeCertification: false},
    coverage: {leafCount: t.leafCount, compiledLeafCount: t.leafCount - t.notCompiledLeafCount, notCompiledLeafCount: t.notCompiledLeafCount, blockedByClientBindingLeafCount: t.blockedByClientBindingLeafCount, blockedByKnowledgeGapLeafCount: t.blockedByKnowledgeGapLeafCount, workDefinitionCount: t.workDefinitionCount},
    flow: {nodes: e.counts.nodes, edges: e.counts.edges, declaredPaths: e.counts.declaredPaths, blockedLeaves: e.counts.blockedLeaves, unsupportedDispositions: e.counts.unsupportedDispositions},
    interface: {apiEndpointDisposition: 'REQUIREMENT_NOT_CONFIRMED', note: 'No Malkom API endpoint requirement is confirmed; JSON evidence only (S8-3E governed disposition).'}
  };
}

// The four ATL-140 crosswalk requirements, in ATL-140 column order:
// Requirement | Atlas source / ID | Supplied semantic | Projection rule | Status | Evidence | Malkom output.
export const CROSSWALK_COLUMNS = Object.freeze(['Requirement', 'Atlas source / ID', 'Supplied semantic', 'Projection rule', 'Status', 'Evidence', 'Malkom output']);

export function buildCrosswalk(m) {
  const c = m.coverage;
  return [
    ['Canonical identity/version/lineage', m.scope.workDefinitionId, 'Exact scope, version and source lineage', 'PRESERVE', 'AVAILABLE', `WorkDefinition ${m.lineage.wd.slice(0, 12)}… · package ${m.lineage.package.slice(0, 12)}…`, 'governed lineage hashes'],
    ['Work semantics', m.scope.workDefinitionId, `Compiled ${c.compiledLeafCount} of ${c.leafCount} leaves; ${c.notCompiledLeafCount} not compiled (${c.blockedByClientBindingLeafCount} client binding, ${c.blockedByKnowledgeGapLeafCount} knowledge gap)`, 'PRESERVE_COMPILED_ONLY', c.notCompiledLeafCount > 0 ? 'PARTIAL' : 'AVAILABLE', 'S8-3B coverage totals', 'governed WorkDefinition (protected)'],
    ['Client execution parameters', 'client binding (separate from canonical truth)', 'Client/master execution parameters', 'SEPARATE_BINDING', m.readiness.clientBinding, `${m.readiness.unresolvedBindingCount} unresolved binding`, 'bindings.unresolved'],
    ['Malkom API endpoint', 'projection boundary', 'No endpoint requirement confirmed', 'NO_GUESSED_INTERFACE', 'UNSUPPORTED', `apiEndpointDisposition=${m.interface.apiEndpointDisposition}`, 'machine-readable JSON export only']
  ];
}

export function stateText(m) {
  return m.readiness.projection === 'BLOCKED'
    ? 'CLIENT_BINDING_REQUIRED — projection remains blocked/fail-closed.'
    : 'Unexpected readiness state — treat as fail-closed.';
}

export async function loadSummaries(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') fail('FETCH_UNAVAILABLE');
  const out = {};
  for (const [k, p] of Object.entries(SUMMARY_PATHS)) {
    const r = await fetchImpl(p, {credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}});
    if (!r.ok) fail(`SUMMARY_UNAVAILABLE:${p}`);
    out[k] = await r.json();
  }
  return out;
}
