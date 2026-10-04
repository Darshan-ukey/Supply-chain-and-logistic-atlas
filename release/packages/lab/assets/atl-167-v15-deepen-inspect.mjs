// S8-5B (ATL-167 successor, S8-5B successor interaction identity): bounded "Deepen this scope / Inspect" interaction for the
// exact governed scope road-ltl@1.5 / LTL-04. Additive module consumed by assets/atl-140-v15-journey.mjs.
//
// It calls ONLY the bounded, read-only, public-safe action /api/atlas?action=governed-depth-summary with the exact tuple
// road-ltl / 1.5 / LTL-04 and renders the governed state exactly as returned. It never calls the ATL-157
// execution-depth-projection endpoint, never falls back to LTL-03 or Road 1.4, never derives or promotes readiness,
// and fails closed on an unavailable API, a non-OK status, a malformed response or any identity/promotion mismatch.
// Ask (certified Universal Ask 2.0.1) and Trace (corrected S8-3E public flow evidence) are linked, not re-implemented.

export const DEEPEN_SCOPE = Object.freeze({moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'});
export const DEEPEN_ENDPOINT = '/api/atlas';
export const DEEPEN_ACTION = 'governed-depth-summary';
export const DEEPEN_SCHEMA = 'atlas-v1.5-governed-depth-summary-v1';
export const DEEPEN_WORKDEFINITION_ID = 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD';
export const DEEPEN_PINS = Object.freeze({
  workDefinition: 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
  package: '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
  readiness: 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617',
  projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c'
});
export const DEEPEN_REGION_ID = 'atl-167-deepen-region';
export const DEEPEN_BUTTON_ID = 'atl-167-deepen-button';
export const TRACE_PATH = '/atl-140-malkom-consumer.html#generated-flow';
export const MALKOM_PATH = '/atl-140-malkom-consumer.html';
const FORBIDDEN_KEYS = new Set(['definitions', 'workDefinitionBody', 'packageBytes', 'bpmnXml', 'svgMarkup', 'clientValues', 'runtimeMappings', 'sourceClaimIds', 'sourceRefs', 'leafInternals', 'readinessPayload']);

export const contextKey = (s = DEEPEN_SCOPE) => `${s.moduleId}@${s.moduleVersion} / ${s.taskId}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fail = (code) => { const e = new Error(code); e.code = code; throw e; };
const eq = (a, b, code) => { if (a !== b) fail(code); };

// The ONLY request this interaction can make: the exact governed tuple. Any other scope is refused (no fallback).
export function buildDeepenUrl(scope = DEEPEN_SCOPE) {
  if (!scope || scope.moduleId !== DEEPEN_SCOPE.moduleId || scope.moduleVersion !== DEEPEN_SCOPE.moduleVersion || scope.taskId !== DEEPEN_SCOPE.taskId) fail('DEEPEN_SCOPE_NOT_GOVERNED');
  const q = new URLSearchParams({action: DEEPEN_ACTION, moduleId: scope.moduleId, moduleVersion: scope.moduleVersion, taskId: scope.taskId});
  return `${DEEPEN_ENDPOINT}?${q.toString()}`;
}

function scanForbidden(v, depth = 0) {
  if (depth > 8 || v === null || typeof v !== 'object') return;
  for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_KEYS.has(k)) fail(`PROTECTED_CONTENT_IN_RESPONSE:${k}`); scanForbidden(x, depth + 1); }
}

// Strict, fail-closed validation of the public-safe summary. Does not infer; only checks what the governed API must state.
export function validateDeepenSummary(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail('DEEPEN_RESPONSE_MALFORMED');
  eq(s.schemaVersion, DEEPEN_SCHEMA, 'DEEPEN_RESPONSE_SCHEMA');
  eq(s.projectionClass, 'PUBLIC_SAFE', 'DEEPEN_RESPONSE_NOT_PUBLIC_SAFE');
  eq(s.readOnly, true, 'DEEPEN_RESPONSE_NOT_READ_ONLY');
  if (!s.scope || !s.lineage || !s.workDefinition || !s.readiness || !s.knowledgeGaps || !s.malkom || !s.trace || !s.mechanism || !Array.isArray(s.blockers)) fail('DEEPEN_RESPONSE_MALFORMED');
  eq(s.scope.moduleId, DEEPEN_SCOPE.moduleId, 'DEEPEN_SCOPE_MISMATCH');
  eq(s.scope.moduleVersion, DEEPEN_SCOPE.moduleVersion, 'DEEPEN_SCOPE_MISMATCH');
  eq(s.scope.taskId, DEEPEN_SCOPE.taskId, 'DEEPEN_SCOPE_MISMATCH');
  eq(s.scope.workDefinitionId, DEEPEN_WORKDEFINITION_ID, 'DEEPEN_WORKDEFINITION_ID_MISMATCH');
  eq(s.lineage.workDefinition, DEEPEN_PINS.workDefinition, 'DEEPEN_LINEAGE_MISMATCH:workDefinition');
  eq(s.lineage.package, DEEPEN_PINS.package, 'DEEPEN_LINEAGE_MISMATCH:package');
  eq(s.lineage.readiness, DEEPEN_PINS.readiness, 'DEEPEN_LINEAGE_MISMATCH:readiness');
  eq(s.lineage.projection, DEEPEN_PINS.projection, 'DEEPEN_LINEAGE_MISMATCH:projection');
  // Never accept a promotion: every blocked/not-ready state must be reported exactly.
  eq(s.readiness.disposition, 'BLOCKED', 'DEEPEN_PROMOTION_CLAIM:readiness');
  eq(s.readiness.universalExecutionReady, false, 'DEEPEN_PROMOTION_CLAIM:universalExecutionReady');
  eq(s.readiness.materializable, false, 'DEEPEN_PROMOTION_CLAIM:materializable');
  eq(s.readiness.runtimeCertification, false, 'DEEPEN_PROMOTION_CLAIM:runtimeCertification');
  eq(s.readiness.independentExecutorProofStatus, 'NOT_INDEPENDENTLY_PROVEN', 'DEEPEN_PROMOTION_CLAIM:executor');
  eq(s.readiness.clientBinding, 'CLIENT_BINDING_REQUIRED', 'DEEPEN_PROMOTION_CLAIM:clientBinding');
  if (!(Number(s.readiness.unresolvedBindingCount) >= 1)) fail('DEEPEN_PROMOTION_CLAIM:bindingResolved');
  const w = s.workDefinition;
  if (!(Number(w.notCompiledLeafCount) >= 0) || !(Number(w.leafCount) >= 1)) fail('DEEPEN_RESPONSE_MALFORMED');
  eq(w.workSemantics, w.notCompiledLeafCount > 0 ? 'PARTIAL' : 'AVAILABLE', 'DEEPEN_PROMOTION_CLAIM:workSemantics');
  eq(w.bodyIncluded, false, 'PROTECTED_CONTENT_IN_RESPONSE:workDefinitionBody');
  eq(s.trace.protectedBytesIncluded, false, 'PROTECTED_CONTENT_IN_RESPONSE:flowBytes');
  eq(s.mechanism.canonicalWrite, false, 'DEEPEN_CANONICAL_WRITE_CLAIM');
  eq(s.mechanism.readinessPromotion, false, 'DEEPEN_PROMOTION_CLAIM:mechanism');
  eq(s.malkom.projectionDisposition, 'BLOCKED', 'DEEPEN_PROMOTION_CLAIM:malkomProjection');
  scanForbidden(s);
  return true;
}

// Fetches ONLY the exact governed tuple; any transport/shape/identity failure throws (fail closed). No fallback scope.
export async function fetchDeepenSummary(fetchImpl = globalThis.fetch, scope = DEEPEN_SCOPE) {
  if (typeof fetchImpl !== 'function') fail('DEEPEN_API_UNAVAILABLE');
  const url = buildDeepenUrl(scope);
  let r;
  try { r = await fetchImpl(url, {credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}}); } catch { fail('DEEPEN_API_UNAVAILABLE'); }
  if (!r || !r.ok) fail(`DEEPEN_API_STATUS:${r ? r.status : 'none'}`);
  let d;
  try { d = await r.json(); } catch { fail('DEEPEN_RESPONSE_MALFORMED'); }
  if (!d || d.ok !== true || !d.summary) fail('DEEPEN_RESPONSE_MALFORMED');
  validateDeepenSummary(d.summary);
  return d.summary;
}

const li = (k, v) => `<li><span>${esc(k)}</span> <strong>${esc(v)}</strong></li>`;
export function summaryMarkup(s) {
  validateDeepenSummary(s);
  const w = s.workDefinition, r = s.readiness;
  const coverage = s.malkom.requirementCoverage.map((x) => li(x.requirement, x.status)).join('');
  const blockers = s.blockers.map((b) => li(b.code, Object.entries(b).filter(([k]) => k !== 'code').map(([k, v]) => `${k}=${v}`).join(', ') || 'blocked')).join('');
  return `<div data-deepen-state="loaded" data-context="${esc(contextKey(s.scope))}"><p><strong>Governed depth (existing evidence, read-only) — ${esc(contextKey(s.scope))}</strong></p>`
    + `<ul aria-label="Inspect governed state">${li('WorkDefinition (protected, 1)', s.scope.workDefinitionId)}${li('Work semantics', w.workSemantics)}${li('Leaves compiled / not compiled', `${w.compiledLeafCount} / ${w.notCompiledLeafCount} of ${w.leafCount}`)}${li('Blocked by client binding / knowledge gap', `${w.blockedByClientBindingLeafCount} / ${w.blockedByKnowledgeGapLeafCount}`)}${li('Readiness', r.disposition)}${li('Client binding', `${r.clientBinding} (${r.unresolvedBindingCount} unresolved)`)}${li('Knowledge gaps', `${s.knowledgeGaps.blockedLeafCount} blocked leaves, unresolved`)}${li('Executor', r.independentExecutorProofStatus)}${li('Universal execution ready / materializable', `${r.universalExecutionReady} / ${r.materializable}`)}</ul>`
    + `<p><strong>Blockers</strong></p><ul>${blockers}</ul><p><strong>Malkom requirement coverage</strong></p><ul>${coverage}</ul>`
    + `<p><small>Lineage — WD ${esc(s.lineage.workDefinition.slice(0, 12))}… · package ${esc(s.lineage.package.slice(0, 12))}… · readiness ${esc(s.lineage.readiness.slice(0, 12))}… · projection ${esc(s.lineage.projection.slice(0, 12))}… · flow ${esc(s.lineage.flow.graph.slice(0, 12))}…</small></p>`
    + `<p><small>Public-safe summary of already-certified S8 evidence. Not runtime ready; protected WorkDefinition, package, readiness, projection and flow bytes are not exposed.</small></p></div>`;
}

export function failureMarkup(code) {
  return `<div data-deepen-state="failed" data-context="${esc(contextKey())}" role="alert"><p><strong>Deepen / Inspect unavailable (fail-closed): ${esc(code)}</strong></p><p><small>No fallback scope is used; ${esc(contextKey())} governed depth could not be shown.</small></p></div>`;
}

// Static, always-rendered part of the journey: the fixed context, the Ask context (certified Universal Ask 2.0.1 via the
// governed Daughter bridge link) and the Deepen/Inspect control. The Ask link is the certified bridge href; no Ask logic is here.
export function deepenControlMarkup(askHref) {
  const ask = askHref
    ? `<a href="${esc(askHref)}" data-journey-link="ask-context" data-context="${esc(contextKey())}">Ask this scope (certified Universal Ask 2.0.1)</a>`
    : `<span data-journey-link="ask-context" data-context="${esc(contextKey())}" aria-disabled="true">Ask unavailable (governed target not resolved)</span>`;
  return `<div data-atl-167="deepen-inspect" data-context="${esc(contextKey())}"><p><small>Selected scope: <strong>${esc(contextKey())}</strong> · ${ask} · <a href="${esc(TRACE_PATH)}" data-journey-link="trace-context" data-context="${esc(contextKey())}">Trace (generated flow)</a></small></p><button type="button" id="${DEEPEN_BUTTON_ID}" data-journey-action="deepen-inspect" aria-controls="${DEEPEN_REGION_ID}">Deepen this scope / Inspect</button><div id="${DEEPEN_REGION_ID}" role="region" aria-live="polite" aria-label="Governed depth for ${esc(contextKey())}"></div></div>`;
}

// Wires the Deepen/Inspect button inside an installed journey host. Read-only; renders summary or fail-closed state.
export function wireDeepen(root, {fetchImpl = globalThis.fetch} = {}) {
  const button = root && root.querySelector && root.querySelector(`#${DEEPEN_BUTTON_ID}`);
  const region = root && root.querySelector && root.querySelector(`#${DEEPEN_REGION_ID}`);
  if (!button || !region) return null;
  const run = async () => {
    region.innerHTML = '<p data-deepen-state="loading">Loading existing governed depth…</p>';
    try { region.innerHTML = summaryMarkup(await fetchDeepenSummary(fetchImpl)); } catch (e) { region.innerHTML = failureMarkup(e.code || 'DEEPEN_ERROR'); }
  };
  button.addEventListener('click', run);
  return run;
}
