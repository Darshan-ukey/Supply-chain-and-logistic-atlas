// S8-5B (ATL-167 successor): bounded, read-only, public-safe "Deepen / Inspect existing governed depth" projection for the
// exact scope road-ltl@1.5 / LTL-04.
//
// This is NOT an ATL-157 execution-depth materialization and it is NOT a knowledge materializer: it performs an
// existing-knowledge lookup over the already-certified, public, non-reconstructive S8-3B..3E evidence summaries. It never
// reads protected WorkDefinition/package/readiness/projection/flow artifacts, never researches, never enriches, never
// resolves bindings or knowledge gaps, never promotes readiness and never writes canonical state.
// It deliberately reuses the S8-4 lineage validator/view-model (no duplicate semantic truth path) and adds exact identity pins.
import fs from 'node:fs';
import path from 'node:path';
import {validateLineage, buildConsumerViewModel, buildCrosswalk, SUMMARY_PATHS, CONSUMER_SCOPE} from '../../assets/atl-140-consumer-view.mjs';

export const GOVERNED_DEPTH_SCHEMA = 'atlas-v1.5-governed-depth-summary-v1';
// Allowlist: exactly one governed scope. Not a generic/universal depth endpoint.
export const GOVERNED_DEPTH_SCOPE = Object.freeze({moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'});
// Corrected S8 identities (accepted pins). Any drift in the public evidence fails closed.
export const GOVERNED_PINS = Object.freeze({
  wd: 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
  package: '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
  readiness: 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617',
  projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c'
});
export const GOVERNED_WORKDEFINITION_ID = CONSUMER_SCOPE.workDefinitionId;
export const PROTECTED_PARAMETER_NAMES = Object.freeze(['include', 'detail', 'details', 'protected', 'artifact', 'artifacts', 'format', 'raw', 'bytes', 'full', 'expand', 'admin', 'bpmn', 'svg', 'workdefinition', 'package', 'readiness', 'projection']);
export const ALLOWED_PARAMETER_NAMES = Object.freeze(['action', 'moduleId', 'module', 'moduleVersion', 'version', 'taskId']);

const httpError = (status, code, message) => { const e = new Error(message || code); e.status = status; e.code = code; return e; };

// Fail-closed scope check: exact tuple only. No fallback to LTL-03, no fallback to Road 1.4.
export function assertGovernedScope({moduleId, moduleVersion, taskId} = {}) {
  if (!moduleId || !moduleVersion || !taskId) throw httpError(400, 'SCOPE_INCOMPLETE', 'moduleId/moduleVersion/taskId are required');
  if (String(moduleId) !== GOVERNED_DEPTH_SCOPE.moduleId) throw httpError(404, 'UNSUPPORTED_MODULE', `Governed depth summary is not available for module: ${moduleId}`);
  if (String(moduleVersion) !== GOVERNED_DEPTH_SCOPE.moduleVersion) throw httpError(404, 'UNSUPPORTED_MODULE_VERSION', `Governed depth summary is not available for ${moduleId}@${moduleVersion}`);
  if (String(taskId) !== GOVERNED_DEPTH_SCOPE.taskId) throw httpError(404, 'UNSUPPORTED_TASK', `Governed depth summary is not available for task: ${taskId}`);
  return {...GOVERNED_DEPTH_SCOPE};
}

// Rejects any parameter that is not part of the exact-scope request; protected-content requests are refused outright.
export function assertAllowedParameters(names) {
  for (const n of names) {
    if (PROTECTED_PARAMETER_NAMES.includes(String(n).toLowerCase())) throw httpError(403, 'PROTECTED_CONTENT_NOT_AVAILABLE', 'Protected execution content is not available through the public-safe governed depth summary');
    if (!ALLOWED_PARAMETER_NAMES.includes(n)) throw httpError(400, 'UNSUPPORTED_PARAMETER', `Unsupported parameter: ${n}`);
  }
}

export function readGovernedSummaries(root = process.cwd()) {
  const out = {};
  for (const [k, p] of Object.entries(SUMMARY_PATHS)) {
    const full = path.join(root, p.replace(/^\//, ''));
    let raw;
    try { raw = fs.readFileSync(full, 'utf8'); } catch { throw httpError(503, 'GOVERNED_EVIDENCE_UNAVAILABLE', `Required governed evidence is unavailable: ${k}`); }
    try { out[k] = JSON.parse(raw); } catch { throw httpError(503, 'GOVERNED_EVIDENCE_MALFORMED', `Required governed evidence is malformed: ${k}`); }
  }
  return out;
}

// Pure derivation from the four public summaries. Throws (fail closed) on any identity/lineage/promotion mismatch.
export function deriveGovernedDepthSummary(summaries) {
  try { validateLineage(summaries); } catch (e) { throw httpError(409, 'LINEAGE_IDENTITY_MISMATCH', `Governed lineage validation failed: ${e.message}`); }
  const m = buildConsumerViewModel(summaries);
  const {reconstruction: b, packageReadiness: c, projection: d, flow: e} = summaries;
  for (const [key, expected] of Object.entries(GOVERNED_PINS)) {
    const observed = m.lineage[key];
    if (observed !== expected) throw httpError(409, 'LINEAGE_IDENTITY_MISMATCH', `Governed ${key} identity differs from the accepted pin`);
  }
  if (!c.readinessHash || c.projectionDisposition === undefined) throw httpError(409, 'READINESS_STATE_MISSING', 'Readiness state is missing');
  if (m.scope.workDefinitionId !== GOVERNED_WORKDEFINITION_ID) throw httpError(409, 'LINEAGE_IDENTITY_MISMATCH', 'WorkDefinition identity differs from the accepted pin');
  const t = c.totals;
  const compiled = t.leafCount - t.notCompiledLeafCount;
  const workSemantics = t.notCompiledLeafCount > 0 ? 'PARTIAL' : 'AVAILABLE';
  const crosswalk = buildCrosswalk(m).map(([requirement, , , rule, status]) => ({requirement, projectionRule: rule, status}));
  return {
    schemaVersion: GOVERNED_DEPTH_SCHEMA,
    projectionClass: 'PUBLIC_SAFE',
    basis: 'EXISTING_GOVERNED_S8_EVIDENCE_ONLY',
    readOnly: true,
    scope: {...GOVERNED_DEPTH_SCOPE, workDefinitionId: m.scope.workDefinitionId, contextKey: `${GOVERNED_DEPTH_SCOPE.moduleId}@${GOVERNED_DEPTH_SCOPE.moduleVersion} / ${GOVERNED_DEPTH_SCOPE.taskId}`},
    mechanism: {
      kind: 'EXISTING_KNOWLEDGE_LOOKUP_NOT_A_MATERIALIZER',
      atl157PublicDepth: {action: 'execution-depth-projection', ltl04Disposition: 'NOT_MATERIALIZED_BY_DESIGN', materializedProofScope: 'LTL-03', changed: false},
      research: false, enrichment: false, newOperationalSemantics: false, workDefinitionCompilation: false, bindingResolution: false, knowledgeGapFilling: false, readinessPromotion: false, canonicalWrite: false
    },
    lineage: {
      workDefinition: m.lineage.wd, package: m.lineage.package, readiness: m.lineage.readiness, projection: m.lineage.projection,
      binding: m.lineage.binding, semanticsRecord: m.lineage.semantics,
      sourcePin: {commit: b.sourcePin.commit, blob: b.sourcePin.blob, taskHash: b.sourcePin.taskHash, semanticSourceVersion: b.sourcePin.semanticSourceVersion, note: 'Source lineage identity only; not the requested module version and not a fallback.'},
      flow: {graph: m.lineage.flowGraph, bpmnSha256: m.lineage.flowBpmnSha256, svgSha256: m.lineage.flowSvgSha256, flowViewSha256: m.lineage.flowViewSha256}
    },
    workDefinition: {protectedCount: t.workDefinitionCount, leafCount: t.leafCount, compiledLeafCount: compiled, notCompiledLeafCount: t.notCompiledLeafCount, blockedByClientBindingLeafCount: t.blockedByClientBindingLeafCount, blockedByKnowledgeGapLeafCount: t.blockedByKnowledgeGapLeafCount, workSemantics, bodyIncluded: false},
    readiness: {disposition: 'BLOCKED', clientBinding: 'CLIENT_BINDING_REQUIRED', unresolvedBindingCount: c.unresolvedBindingCount, universalExecutionReady: false, materializable: false, runtimeCertification: false, independentExecutorProofStatus: 'NOT_INDEPENDENTLY_PROVEN'},
    knowledgeGaps: {blockedLeafCount: t.blockedByKnowledgeGapLeafCount, resolved: false},
    malkom: {packageDisposition: 'PACKAGE_IDENTITY_CONSUMED_NOT_REGENERATED', projectionDisposition: 'BLOCKED', apiEndpointDisposition: m.interface.apiEndpointDisposition, requirementCoverage: crosswalk},
    trace: {flow: m.flow, publicTracePath: '/atl-140-malkom-consumer.html#generated-flow', protectedBytesIncluded: false},
    blockers: [
      {code: 'CLIENT_BINDING_REQUIRED', unresolvedBindingCount: c.unresolvedBindingCount, blockedLeafCount: t.blockedByClientBindingLeafCount},
      {code: 'KNOWLEDGE_GAP', blockedLeafCount: t.blockedByKnowledgeGapLeafCount},
      {code: 'LEAVES_NOT_COMPILED', notCompiledLeafCount: t.notCompiledLeafCount, leafCount: t.leafCount},
      {code: 'PROJECTION_BLOCKED'},
      {code: 'EXECUTOR_NOT_INDEPENDENTLY_PROVEN'},
      {code: 'API_ENDPOINT_REQUIREMENT_NOT_CONFIRMED'}
    ],
    protectedOmissions: ['WorkDefinition body/content', 'protected Malkom package bytes', 'readiness private payload', 'protected projection bytes', 'Flow/BPMN/SVG bytes', 'client values', 'hidden leaf internals', 'protected source claim content', 'runtime mappings'],
    notClaimed: ['runtime ready', 'release ready', 'ATL-157 materialization of LTL-04', 'utility value achieved', 'knowledge gaps closed', 'client binding resolved']
  };
}

export function buildGovernedDepthSummary(scope, {root = process.cwd()} = {}) {
  assertGovernedScope(scope);
  return deriveGovernedDepthSummary(readGovernedSummaries(root));
}
