import {createHash} from 'node:crypto';
import {canonicalHash, stableStringify} from './workdefinition-compiler.js';
import {PINS} from './s8-malkom-package.js';
import {PROJECTION_PINS} from './s8-malkom-projection.js';
import {isNCName} from './s8-bpmn-structure.js';

// S8-3E: bounded ATL-178 Flow/BPMN regeneration from the corrected governed lineage.
//
// The single governed graph is derived automatically from the compiled canonical
// WorkDefinition leaf (S8-3B) and annotated with S8-3C/S8-3D lineage. Flow view,
// BPMN 2.0 and SVG are pure renderings of that one graph. Nothing is hand-authored:
// no routing, next-step, sub-queue or queue semantics are invented. Missing semantics
// are surfaced as explicit dispositions. Outputs are EXECUTION_PROTECTED derivatives;
// callers may publish only non-reconstructive evidence (hashes/counts).

export const FLOW_SCHEMA_VERSION = 'atlas-flow-graph-v1.5-s8-3e';
export const FLOW_PINS = Object.freeze({
  ...PINS,
  package: PROJECTION_PINS.package,
  readiness: PROJECTION_PINS.readiness,
  projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c',
  base: PROJECTION_PINS.base,
  workDefinitionId: 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD'
});
export const STALE_ATL178_LINEAGE_MARKERS = Object.freeze(['wd::road-ltl::LTL-04::v1']);

const BPMN_MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const ATLAS_NS = 'urn:aify:atlas:flow-bpmn:v1.5';
const KNOWN_TRANSITION_FIELDS = new Set(['code', 'requiredEvidence', 'stateAfter']);
const check = (ok, code) => { if (!ok) throw Error(code); };
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const isStr = (v) => typeof v === 'string' && v.length > 0;

// ---------------------------------------------------------------- derivation
// Pure: depends only on its arguments. `context` may carry the S8-3C package,
// readiness and S8-3D projection; when supplied they are cross-checked, never trusted.
export function deriveFlowGraph(compilation, context = {}) {
  check(compilation && Array.isArray(compilation.definitions), 'COMPILATION_INVALID');
  check(compilation.definitions.length === 1, 'UNSUPPORTED_SCOPE_DEFINITION_COUNT');
  const wd = compilation.definitions[0];
  check(isStr(wd.workDefinitionId), 'WORKDEFINITION_ID_MISSING');
  check(Array.isArray(wd.actions) && wd.actions.length === 1, 'UNSUPPORTED_SCOPE_ACTION_COUNT');
  const act = wd.actions[0];
  check(isStr(act.actionId) && isStr(act.action), 'ACTION_INVALID');
  check(Array.isArray(wd.transitions) && wd.transitions.length >= 1, 'NO_DECLARED_OUTCOMES');
  check(isStr(wd.trigger), 'TRIGGER_MISSING');

  const codes = new Set();
  for (const t of wd.transitions) {
    check(t && isStr(t.code), 'OUTCOME_CODE_MISSING');
    check(!codes.has(t.code), 'AMBIGUOUS_ROUTING_DUPLICATE_OUTCOME');
    codes.add(t.code);
    check(isStr(t.stateAfter), 'OUTCOME_STATUS_MISSING');
  }

  const pkg = context.packageArtifact; const readiness = context.readiness; const projection = context.projection;
  if (pkg) check(stableStringify(pkg.projection.canonicalWorkDefinition) === stableStringify(wd), 'PACKAGE_WD_LINEAGE_MISMATCH');
  if (readiness) check(readiness.workDefinitionId === wd.workDefinitionId, 'READINESS_WD_LINEAGE_MISMATCH');
  if (projection) {
    check(stableStringify(projection.payload.canonicalWorkDefinition) === stableStringify(wd), 'PROJECTION_WD_LINEAGE_MISMATCH');
    check(stableStringify(projection.payload.coverage) === stableStringify(compilation.coverage), 'PROJECTION_COVERAGE_LINEAGE_MISMATCH');
  }

  const multi = wd.transitions.length > 1;
  const NODE = { start: 'N::START', action: `N::ACTION::${act.actionId}`, gateway: 'N::GATEWAY::OUTCOME' };
  const endId = (code) => `N::END::${code}`;
  const nodes = [
    {id: NODE.start, kind: 'START', label: 'Trigger', governed: {trigger: wd.trigger}},
    {id: NODE.action, kind: 'ACTION', label: act.action, governed: {actionId: act.actionId, performerRole: act.performerRole ?? null, authorityOwner: act.authorityOwner ?? null, precondition: act.precondition ?? null, postcondition: act.postcondition ?? null}}
  ];
  const edges = [{id: `E::${NODE.start}->${NODE.action}`, from: NODE.start, to: NODE.action, kind: 'SEQUENCE', outcome: null, status: null, requiredEvidence: null, route: 'STRUCTURAL', nextStep: null, unsupportedAttributes: []}];
  const edgeFrom = multi ? NODE.gateway : NODE.action;
  if (multi) {
    nodes.push({id: NODE.gateway, kind: 'OUTCOME_GATEWAY', label: 'Declared outcome', governed: {outcomes: wd.transitions.map((t) => t.code)}});
    edges.push({id: `E::${NODE.action}->${NODE.gateway}`, from: NODE.action, to: NODE.gateway, kind: 'SEQUENCE', outcome: null, status: null, requiredEvidence: null, route: 'STRUCTURAL', nextStep: null, unsupportedAttributes: []});
  }
  const unsupported = [];
  const nextStepUngoverned = [];
  for (const t of wd.transitions) {
    nodes.push({id: endId(t.code), kind: 'OUTCOME_END', label: t.code, governed: {outcome: t.code, status: t.stateAfter, requiredEvidence: t.requiredEvidence ?? null}});
    const extra = Object.keys(t).filter((k) => !KNOWN_TRANSITION_FIELDS.has(k)).sort();
    let nextStep = {value: null, disposition: 'NOT_GOVERNED'};
    const unsupportedAttributes = [];
    for (const k of extra) {
      if (k === 'nextStep' && isStr(t[k])) nextStep = {value: t[k], disposition: 'GOVERNED_LABEL_ONLY_NO_TARGET_ASSERTED'};
      else { unsupportedAttributes.push(k); unsupported.push({id: `U::TRANSITION::${t.code}::${k}`, semantic: 'transition routing attribute', state: 'UNSUPPORTED_ROUTING_ATTRIBUTE', source: `transitions[${t.code}].${k}`, handling: 'NOT_RENDERED_NOT_INTERPRETED'}); }
    }
    if (nextStep.value === null) nextStepUngoverned.push(t.code);
    edges.push({id: `E::OUTCOME::${t.code}`, from: edgeFrom, to: endId(t.code), kind: 'DECLARED_OUTCOME', outcome: t.code, status: t.stateAfter, requiredEvidence: t.requiredEvidence ?? null, route: 'DECLARED_OUTCOME_BRANCH', nextStep, unsupportedAttributes});
  }

  const blocked = (compilation.coverage ?? []).flatMap((c) => c.notCompiled ?? []).map((b) => ({
    id: `B::${b.workUnitId}`, workUnitId: b.workUnitId, unitType: b.unitType, status: b.status,
    requiredClientBindings: [...(b.requiredClientBindings ?? [])].sort(), requiredKnowledgeGaps: [...(b.requiredKnowledgeGaps ?? [])].sort(),
    routing: 'NOT_COMPILED_ROUTING_NOT_ASSERTED'
  })).sort((a, b) => (a.id < b.id ? -1 : 1));

  unsupported.push({id: 'U::SUBQUEUE', semantic: 'stage/sub-queue structure', state: 'UNKNOWN_NOT_GOVERNED', source: 'NOT_PRESENT_IN_COMPILED_WORKDEFINITION', handling: 'SURFACED_NOT_INVENTED', note: 'Malkom queue structures are not canonical Atlas process truth.'});
  if (nextStepUngoverned.length) unsupported.push({id: 'U::NEXTSTEP', semantic: 'outcome next-step routing', state: 'NOT_GOVERNED', source: 'NOT_PRESENT_IN_COMPILED_WORKDEFINITION', outcomes: [...nextStepUngoverned].sort(), handling: 'SURFACED_NOT_INVENTED'});
  unsupported.push({id: 'U::RUNTIME-ORCHESTRATION', semantic: 'runtime orchestration/execution', state: 'STOP_BOUNDARY', source: 'S8-3E_SCOPE', handling: 'NOT_PROVIDED'});
  for (const id of [...(wd.clientBindingRequirements ?? [])].sort()) unsupported.push({id: `U::BINDING::${id}`, semantic: 'client execution parameters', state: 'CLIENT_BINDING_REQUIRED', source: 'workDefinition.clientBindingRequirements', handling: 'NOT_APPLIED_TO_CANONICAL'});
  for (const c of [...(wd.clocks ?? [])].sort((a, b) => (a.temporalId < b.temporalId ? -1 : 1))) unsupported.push({id: `U::CLOCK::${c.temporalId}`, semantic: 'clock/timer semantics', state: c.resolutionStatus ?? 'UNRESOLVED', source: 'workDefinition.clocks', handling: 'TIMER_EVENT_NOT_RENDERED'});
  for (const u of (pkg?.dispositions?.unsupported ?? [])) unsupported.push({id: `U::PACKAGE::${u.requirementId}`, semantic: 'Malkom interface requirement', state: u.state, source: 'package.dispositions.unsupported', handling: 'NO_GUESSED_INTERFACE'});
  unsupported.sort((a, b) => (a.id < b.id ? -1 : 1));

  const graph = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    classification: 'EXECUTION_PROTECTED',
    bounded: true,
    scope: {
      atlas: {authority: 'RUNTIME_NEUTRAL_CANONICAL_WORKDEFINITION', moduleId: compilation.moduleId ?? null, moduleVersion: compilation.moduleVersion ?? null, sourceTaskId: wd.lineage?.sourceTaskId ?? null, workDefinitionId: wd.workDefinitionId, workDefinitionVersion: wd.version},
      malkom: {role: 'PROJECTION_CONSUMER_ONLY', queueStructuresCanonical: false, consumer: projection?.consumer ?? pkg?.consumer ?? null, packageId: pkg?.packageId ?? null, handoffId: projection?.handoffId ?? null}
    },
    lineage: {
      workDefinitionId: wd.workDefinitionId, workDefinitionVersion: wd.version, workDefinitionSchemaVersion: wd.schemaVersion,
      decompositionId: wd.lineage?.decompositionId ?? null, sourceWorkUnitId: wd.lineage?.sourceWorkUnitId ?? null, semanticSourceVersion: wd.lineage?.semanticSourceVersion ?? null,
      sourceReleaseTip: projection?.sourcePackage?.sourceReleaseTip ?? null,
      inputHashes: {wd: canonicalHash(compilation), package: pkg ? canonicalHash(pkg) : null, readiness: readiness ? canonicalHash(readiness) : null, projection: projection ? canonicalHash(projection) : null, binding: pkg?.lineage?.inputHashes?.binding ?? null, semantics: pkg?.lineage?.inputHashes?.semantics ?? null},
      canonicalMutation: false
    },
    executionBoundary: {runtimeReadiness: 'NOT_PROMOTED', runtimeOrchestration: 'STOP_BOUNDARY', universalExecutionReady: readiness ? readiness.universalExecutionReady : false, materializable: projection ? projection.release.materializable : false, runtimeCertification: projection ? projection.release.runtimeCertification : false},
    nodes, edges, blocked, unsupported
  };
  graph.declaredPaths = enumerateDeclaredPaths(graph);
  verifyFlowGraph(graph, compilation);
  graph.graphHash = canonicalHash(graph);
  return graph;
}

// Traverses the graph itself: every declared path from the start node to a terminal node.
export function enumerateDeclaredPaths(graph) {
  const out = new Map();
  for (const e of graph.edges) (out.get(e.from) ?? out.set(e.from, []).get(e.from)).push(e);
  const start = graph.nodes.find((n) => n.kind === 'START');
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const paths = [];
  const walk = (id, nodeIds, edgeIds) => {
    const next = out.get(id) ?? [];
    if (!next.length) {
      const term = byId.get(id);
      const last = graph.edges.find((e) => e.id === edgeIds[edgeIds.length - 1]);
      paths.push({id: `P::${term.governed?.outcome ?? term.id}`, nodeIds, edgeIds, terminal: {nodeId: id, outcome: term.governed?.outcome ?? null, status: term.governed?.status ?? null, requiredEvidence: last?.requiredEvidence ?? null}});
      return;
    }
    for (const e of next) { check(!nodeIds.includes(e.to), 'CYCLE_UNSUPPORTED'); walk(e.to, [...nodeIds, e.to], [...edgeIds, e.id]); }
  };
  walk(start.id, [start.id], []);
  return paths;
}

// Completeness/consistency: the graph must represent exactly the governed outcomes.
export function verifyFlowGraph(graph, compilation) {
  const wd = compilation.definitions[0];
  const ids = new Set(graph.nodes.map((n) => n.id));
  check(ids.size === graph.nodes.length, 'NODE_ID_DUPLICATE');
  check(new Set(graph.edges.map((e) => e.id)).size === graph.edges.length, 'EDGE_ID_DUPLICATE');
  for (const e of graph.edges) check(ids.has(e.from) && ids.has(e.to), 'EDGE_ENDPOINT_UNRESOLVED');
  const blockedUnits = (compilation.coverage ?? []).flatMap((c) => c.notCompiled ?? []).map((b) => b.workUnitId);
  const unitOf = (nodeId) => nodeId.replace(/^N::[A-Z]+::/, '');
  for (const e of graph.edges) check(!blockedUnits.includes(unitOf(e.to)) && !blockedUnits.includes(unitOf(e.from)), 'EDGE_TO_NOT_COMPILED_LEAF');
  const byCode = new Map(wd.transitions.map((t) => [t.code, t]));
  for (const e of graph.edges.filter((x) => x.kind === 'DECLARED_OUTCOME')) {
    const t = byCode.get(e.outcome);
    check(t, 'EDGE_OUTCOME_NOT_DECLARED');
    check(e.status === t.stateAfter && (e.requiredEvidence ?? null) === (t.requiredEvidence ?? null), 'EDGE_OUTCOME_ATTRIBUTE_MISMATCH');
    const governedNext = isStr(t.nextStep) ? t.nextStep : null;
    check((e.nextStep?.value ?? null) === governedNext, 'NEXTSTEP_NOT_GOVERNED_BUT_PRESENT');
    check(governedNext !== null || e.nextStep?.disposition === 'NOT_GOVERNED', 'NEXTSTEP_DISPOSITION_MISSING');
  }
  const declared = wd.transitions.map((t) => `${t.code}|${t.stateAfter}`).sort();
  const drawn = graph.declaredPaths.map((p) => `${p.terminal.outcome}|${p.terminal.status}`).sort();
  check(stableStringify(declared) === stableStringify(drawn), 'DECLARED_PATHS_NOT_REPRESENTED');
  const sources = new Set(graph.edges.map((e) => e.from));
  for (const n of graph.nodes) if (n.kind === 'OUTCOME_END') check(!sources.has(n.id), 'OUTCOME_NOT_TERMINAL');
  check(stableStringify(graph.blocked.map((b) => b.workUnitId).sort()) === stableStringify([...blockedUnits].sort()), 'BLOCKED_NOT_SURFACED');
  return true;
}

// ---------------------------------------------------------------- trace
// Selection is mandatory: no default happy path is ever chosen.
export function traceWorkItem(graph, selection) {
  check(selection && (isStr(selection.outcome) || isStr(selection.pathId)), 'TRACE_SELECTION_REQUIRED');
  if (selection.workUnitId !== undefined) {
    check(!graph.blocked.some((b) => b.workUnitId === selection.workUnitId), 'TRACE_TARGET_NOT_COMPILED');
    check(false, 'TRACE_TARGET_UNKNOWN');
  }
  const pathId = selection.pathId ?? `P::${selection.outcome}`;
  const p = graph.declaredPaths.find((x) => x.id === pathId);
  check(p, 'TRACE_SELECTION_UNKNOWN');
  if (isStr(selection.outcome) && isStr(selection.pathId)) check(p.terminal.outcome === selection.outcome, 'TRACE_SELECTION_CONFLICT');
  const edges = p.edgeIds.map((id) => graph.edges.find((e) => e.id === id));
  return {
    workItemId: selection.workItemId ?? null,
    pathId: p.id, nodeIds: [...p.nodeIds], edgeIds: [...p.edgeIds],
    terminal: {...p.terminal},
    nextStep: edges[edges.length - 1].nextStep,
    lineage: {workDefinitionId: graph.lineage.workDefinitionId, workDefinitionVersion: graph.lineage.workDefinitionVersion, graphHash: graph.graphHash, inputHashes: {...graph.lineage.inputHashes}}
  };
}

// ---------------------------------------------------------------- shared layout
const SIZE = {START: [36, 36], OUTCOME_END: [36, 36], ACTION: [150, 80], OUTCOME_GATEWAY: [50, 50]};
const COL_W = 220; const ROW_H = 96; const MARGIN = 40;
export function layoutGraph(graph) {
  const depth = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < graph.nodes.length; pass++) for (const e of graph.edges) depth.set(e.to, Math.max(depth.get(e.to), depth.get(e.from) + 1));
  const cols = new Map();
  for (const n of graph.nodes) (cols.get(depth.get(n.id)) ?? cols.set(depth.get(n.id), []).get(depth.get(n.id))).push(n);
  const tallest = Math.max(...[...cols.values()].map((c) => c.length));
  const height = tallest * ROW_H;
  const shapes = new Map();
  for (const [d, list] of cols) {
    const colTop = MARGIN + (height - list.length * ROW_H) / 2;
    list.forEach((n, i) => {
      const [w, h] = SIZE[n.kind]; const cx = MARGIN + 80 + d * COL_W; const cy = colTop + (i + 0.5) * ROW_H;
      shapes.set(n.id, {x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h, cx: Math.round(cx), cy: Math.round(cy)});
    });
  }
  const wp = new Map();
  for (const e of graph.edges) {
    const s = shapes.get(e.from); const t = shapes.get(e.to);
    const sx = s.x + s.width; const sy = s.cy; const tx = t.x; const ty = t.cy; const mx = Math.round((sx + tx) / 2);
    wp.set(e.id, sy === ty ? [[sx, sy], [tx, ty]] : [[sx, sy], [mx, sy], [mx, ty], [tx, ty]]);
  }
  const maxX = Math.max(...[...shapes.values()].map((s) => s.x + s.width));
  return {shapes, waypoints: wp, width: maxX + MARGIN + 220, bodyHeight: height + 2 * MARGIN};
}

// ---------------------------------------------------------------- flow view
// Structured view of the same graph (no layout/render state beyond deterministic positions).
export function renderFlowView(graph, options = {}) {
  const lay = layoutGraph(graph);
  const selected = options.tracePathId ? traceWorkItem(graph, {pathId: options.tracePathId}) : null;
  return {
    schemaVersion: 'atlas-flow-view-v1.5-s8-3e', graphHash: graph.graphHash, scope: graph.scope, lineage: graph.lineage, executionBoundary: graph.executionBoundary,
    nodes: graph.nodes.map((n) => ({...n, position: {x: lay.shapes.get(n.id).x, y: lay.shapes.get(n.id).y}, onSelectedPath: selected ? selected.nodeIds.includes(n.id) : false})),
    edges: graph.edges.map((e) => ({...e, onSelectedPath: selected ? selected.edgeIds.includes(e.id) : false})),
    declaredPaths: graph.declaredPaths, blocked: graph.blocked, unsupported: graph.unsupported, selectedPath: selected
  };
}

// ---------------------------------------------------------------- BPMN
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function bpmnId(prefix, governedId) {
  const body = String(governedId).replace(/[^A-Za-z0-9_.-]/g, '_');
  const id = `${prefix}_${body}`;
  check(isNCName(id), 'BPMN_ID_INVALID');
  return id;
}
export function renderBpmn(graph) {
  const lay = layoutGraph(graph);
  const ids = new Map(); const used = new Set();
  const claim = (key, prefix) => { const id = bpmnId(prefix, key); check(!used.has(id), 'BPMN_ID_COLLISION'); used.add(id); ids.set(key, id); return id; };
  const procId = claim('PROCESS', 'Process');
  const kindEl = {START: 'startEvent', ACTION: 'task', OUTCOME_GATEWAY: 'exclusiveGateway', OUTCOME_END: 'endEvent'};
  const kindPrefix = {START: 'StartEvent', ACTION: 'Task', OUTCOME_GATEWAY: 'Gateway', OUTCOME_END: 'EndEvent'};
  for (const n of graph.nodes) claim(n.id, kindPrefix[n.kind]);
  for (const e of graph.edges) claim(e.id, 'Flow');
  const defsId = bpmnId('Definitions', graph.graphHash.slice(0, 16));
  const L = [];
  const attr = (name, v) => ` atlas:${name}="${esc(v)}"`;
  L.push('<?xml version="1.0" encoding="UTF-8"?>');
  L.push(`<bpmn:definitions xmlns:bpmn="${BPMN_MODEL}" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:atlas="${ATLAS_NS}" id="${defsId}" targetNamespace="${ATLAS_NS}" exporter="AiFY Atlas S8-3E" exporterVersion="${FLOW_SCHEMA_VERSION}">`);
  L.push(`  <bpmn:process id="${procId}" name="${esc(graph.lineage.workDefinitionId)}" isExecutable="false">`);
  L.push(`    <bpmn:documentation>Derived deterministically from the governed Atlas canonical WorkDefinition ${esc(graph.lineage.workDefinitionId)}. Non-executable descriptive diagram; no routing conditions, queue structures or runtime semantics are asserted.</bpmn:documentation>`);
  L.push('    <bpmn:extensionElements>');
  L.push(`      <atlas:graph${attr('schemaVersion', graph.schemaVersion)}${attr('graphHash', graph.graphHash)}${attr('classification', graph.classification)}${attr('canonicalMutation', 'false')}/>`);
  L.push(`      <atlas:scope${attr('atlasAuthority', graph.scope.atlas.authority)}${attr('moduleId', graph.scope.atlas.moduleId ?? '')}${attr('moduleVersion', graph.scope.atlas.moduleVersion ?? '')}${attr('sourceTaskId', graph.scope.atlas.sourceTaskId ?? '')}${attr('malkomRole', graph.scope.malkom.role)}${attr('malkomQueueStructuresCanonical', 'false')}${attr('consumer', graph.scope.malkom.consumer ?? '')}${attr('packageId', graph.scope.malkom.packageId ?? '')}${attr('handoffId', graph.scope.malkom.handoffId ?? '')}/>`);
  L.push(`      <atlas:lineage${attr('workDefinitionId', graph.lineage.workDefinitionId)}${attr('workDefinitionVersion', graph.lineage.workDefinitionVersion)}${attr('decompositionId', graph.lineage.decompositionId ?? '')}${attr('sourceWorkUnitId', graph.lineage.sourceWorkUnitId ?? '')}${attr('semanticSourceVersion', graph.lineage.semanticSourceVersion ?? '')}${attr('sourceReleaseTip', graph.lineage.sourceReleaseTip ?? '')}${attr('wdHash', graph.lineage.inputHashes.wd)}${attr('packageHash', graph.lineage.inputHashes.package ?? '')}${attr('readinessHash', graph.lineage.inputHashes.readiness ?? '')}${attr('projectionHash', graph.lineage.inputHashes.projection ?? '')}/>`);
  L.push(`      <atlas:executionBoundary${attr('runtimeReadiness', graph.executionBoundary.runtimeReadiness)}${attr('runtimeOrchestration', graph.executionBoundary.runtimeOrchestration)}${attr('materializable', String(graph.executionBoundary.materializable))}${attr('runtimeCertification', String(graph.executionBoundary.runtimeCertification))}/>`);
  for (const b of graph.blocked) L.push(`      <atlas:blocked${attr('id', b.id)}${attr('workUnitId', b.workUnitId)}${attr('unitType', b.unitType)}${attr('status', b.status)}${attr('routing', b.routing)}${attr('requiredClientBindings', b.requiredClientBindings.join(' '))}${attr('requiredKnowledgeGaps', b.requiredKnowledgeGaps.join(' '))}/>`);
  for (const u of graph.unsupported) L.push(`      <atlas:unsupported${attr('id', u.id)}${attr('semantic', u.semantic)}${attr('state', u.state)}${attr('handling', u.handling)}/>`);
  L.push('    </bpmn:extensionElements>');
  const inOf = new Map(); const outOf = new Map();
  for (const e of graph.edges) { (outOf.get(e.from) ?? outOf.set(e.from, []).get(e.from)).push(e); (inOf.get(e.to) ?? inOf.set(e.to, []).get(e.to)).push(e); }
  for (const n of graph.nodes) {
    const el = kindEl[n.kind]; const id = ids.get(n.id);
    const nm = n.kind === 'OUTCOME_END' ? `${n.governed.outcome} (${n.governed.status})` : n.label;
    const extra = n.kind === 'OUTCOME_GATEWAY' ? ' gatewayDirection="Diverging"' : '';
    L.push(`    <bpmn:${el} id="${id}" name="${esc(nm)}"${extra}>`);
    if (n.kind === 'START') L.push(`      <bpmn:documentation>${esc(n.governed.trigger)}</bpmn:documentation>`);
    if (n.kind === 'ACTION') L.push(`      <bpmn:documentation>${esc([n.governed.precondition && `Precondition: ${n.governed.precondition}`, n.governed.postcondition && `Postcondition: ${n.governed.postcondition}`].filter(Boolean).join(' | '))}</bpmn:documentation>`);
    L.push('      <bpmn:extensionElements>');
    L.push(`        <atlas:governedNode${attr('graphNodeId', n.id)}${attr('kind', n.kind)}${n.kind === 'ACTION' ? `${attr('actionId', n.governed.actionId)}${attr('performerRole', n.governed.performerRole ?? '')}${attr('authorityOwner', n.governed.authorityOwner ?? '')}` : ''}${n.kind === 'OUTCOME_END' ? `${attr('outcome', n.governed.outcome)}${attr('status', n.governed.status)}${attr('requiredEvidence', n.governed.requiredEvidence ?? '')}` : ''}/>`);
    L.push('      </bpmn:extensionElements>');
    for (const e of inOf.get(n.id) ?? []) L.push(`      <bpmn:incoming>${ids.get(e.id)}</bpmn:incoming>`);
    for (const e of outOf.get(n.id) ?? []) L.push(`      <bpmn:outgoing>${ids.get(e.id)}</bpmn:outgoing>`);
    L.push(`    </bpmn:${el}>`);
  }
  for (const e of graph.edges) {
    L.push(`    <bpmn:sequenceFlow id="${ids.get(e.id)}" sourceRef="${ids.get(e.from)}" targetRef="${ids.get(e.to)}"${e.outcome ? ` name="${esc(e.outcome)}"` : ''}>`);
    L.push('      <bpmn:extensionElements>');
    L.push(`        <atlas:governedEdge${attr('graphEdgeId', e.id)}${attr('kind', e.kind)}${attr('outcome', e.outcome ?? '')}${attr('status', e.status ?? '')}${attr('requiredEvidence', e.requiredEvidence ?? '')}${attr('route', e.route)}${attr('nextStepDisposition', e.nextStep ? e.nextStep.disposition : '')}${attr('nextStep', e.nextStep?.value ?? '')}${attr('unsupportedAttributes', e.unsupportedAttributes.join(' '))}/>`);
    L.push('      </bpmn:extensionElements>');
    L.push('    </bpmn:sequenceFlow>');
  }
  L.push('  </bpmn:process>');
  L.push(`  <bpmndi:BPMNDiagram id="${bpmnId('Diagram', graph.graphHash.slice(0, 16))}">`);
  L.push(`    <bpmndi:BPMNPlane id="${bpmnId('Plane', graph.graphHash.slice(0, 16))}" bpmnElement="${procId}">`);
  for (const n of graph.nodes) {
    const s = lay.shapes.get(n.id);
    L.push(`      <bpmndi:BPMNShape id="${ids.get(n.id)}_di" bpmnElement="${ids.get(n.id)}"${n.kind === 'OUTCOME_GATEWAY' ? ' isMarkerVisible="true"' : ''}>`);
    L.push(`        <dc:Bounds x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}"/>`);
    L.push('      </bpmndi:BPMNShape>');
  }
  for (const e of graph.edges) {
    L.push(`      <bpmndi:BPMNEdge id="${ids.get(e.id)}_di" bpmnElement="${ids.get(e.id)}">`);
    for (const [x, y] of lay.waypoints.get(e.id)) L.push(`        <di:waypoint x="${x}" y="${y}"/>`);
    L.push('      </bpmndi:BPMNEdge>');
  }
  L.push('    </bpmndi:BPMNPlane>');
  L.push('  </bpmndi:BPMNDiagram>');
  L.push('</bpmn:definitions>');
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------- SVG
export function renderSvg(graph, options = {}) {
  const lay = layoutGraph(graph);
  const selected = options.tracePathId ? traceWorkItem(graph, {pathId: options.tracePathId}) : null;
  const panelLines = [];
  for (const b of graph.blocked) panelLines.push(`NOT COMPILED (routing not asserted): ${b.workUnitId} [${b.status}]`);
  for (const u of graph.unsupported) panelLines.push(`${u.state}: ${u.semantic}`);
  const panelY = lay.bodyHeight + 10;
  const height = panelY + 28 + panelLines.length * 16 + 20;
  const width = Math.max(lay.width, 900);
  const S = [];
  S.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  S.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" data-atlas-schema="${esc(graph.schemaVersion)}" data-graph-hash="${graph.graphHash}" data-work-definition-id="${esc(graph.lineage.workDefinitionId)}" data-work-definition-version="${esc(graph.lineage.workDefinitionVersion)}" data-wd-hash="${graph.lineage.inputHashes.wd}" data-source-release-tip="${esc(graph.lineage.sourceReleaseTip ?? '')}" data-malkom-queue-canonical="false" data-classification="${graph.classification}">`);
  S.push(`<title>${esc(graph.lineage.workDefinitionId)}</title>`);
  S.push(`<desc>Atlas bounded flow derived from the governed canonical WorkDefinition. Graph hash ${graph.graphHash}. Non-executable; no routing conditions, queue structures or runtime semantics asserted.</desc>`);
  S.push('<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#333"/></marker></defs>');
  S.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  for (const e of graph.edges) {
    const pts = lay.waypoints.get(e.id); const on = selected?.edgeIds.includes(e.id);
    S.push(`<g data-edge-id="${esc(e.id)}"${on ? ' data-selected="true"' : ''}><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${on ? '#c0392b' : '#333'}" stroke-width="${on ? 3 : 1.5}" marker-end="url(#arrow)"/>`);
    if (e.outcome) { const [lx, ly] = pts[pts.length - 2]; S.push(`<text x="${lx + 6}" y="${ly - 6}" font-family="sans-serif" font-size="11" fill="#333">${esc(e.outcome)}</text>`); }
    S.push('</g>');
  }
  for (const n of graph.nodes) {
    const s = lay.shapes.get(n.id); const on = selected?.nodeIds.includes(n.id); const stroke = on ? '#c0392b' : '#333'; const sw = on ? 3 : 1.5;
    S.push(`<g data-node-id="${esc(n.id)}" data-kind="${n.kind}"${on ? ' data-selected="true"' : ''}>`);
    if (n.kind === 'START' || n.kind === 'OUTCOME_END') {
      S.push(`<circle cx="${s.cx}" cy="${s.cy}" r="${s.width / 2}" fill="#fff" stroke="${stroke}" stroke-width="${n.kind === 'OUTCOME_END' ? sw + 2 : sw}"/>`);
      const t = n.kind === 'START' ? ['Trigger'] : [n.governed.outcome, n.governed.status];
      t.forEach((line, i) => S.push(`<text x="${s.cx + (n.kind === 'OUTCOME_END' ? 26 : 0)}" y="${n.kind === 'OUTCOME_END' ? s.cy - 2 + i * 14 : s.y + s.height + 14}" text-anchor="${n.kind === 'OUTCOME_END' ? 'start' : 'middle'}" font-family="sans-serif" font-size="11" fill="#111">${esc(line)}</text>`));
    } else if (n.kind === 'ACTION') {
      S.push(`<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="8" fill="#eef4ff" stroke="${stroke}" stroke-width="${sw}"/>`);
      S.push(`<text x="${s.cx}" y="${s.cy - 4}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#111">${esc(n.label)}</text><text x="${s.cx}" y="${s.cy + 14}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#555">${esc(n.governed.actionId)}</text>`);
    } else {
      S.push(`<polygon points="${s.cx},${s.y} ${s.x + s.width},${s.cy} ${s.cx},${s.y + s.height} ${s.x},${s.cy}" fill="#fff8e1" stroke="${stroke}" stroke-width="${sw}"/><text x="${s.cx}" y="${s.y + s.height + 14}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#111">${esc(n.label)}</text>`);
    }
    S.push('</g>');
  }
  S.push(`<g data-panel="dispositions"><line x1="${MARGIN}" y1="${panelY}" x2="${width - MARGIN}" y2="${panelY}" stroke="#999" stroke-dasharray="4 3"/><text x="${MARGIN}" y="${panelY + 18}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#8a1c1c">Surfaced, not modelled (blocked / unsupported / unknown)</text>`);
  panelLines.forEach((line, i) => S.push(`<text x="${MARGIN}" y="${panelY + 36 + i * 16}" font-family="monospace" font-size="10.5" fill="#444">${esc(line)}</text>`));
  S.push('</g>');
  S.push('</svg>');
  return S.join('\n') + '\n';
}

// ---------------------------------------------------------------- stale lineage guard
export function findStaleLineage(text) {
  return STALE_ATL178_LINEAGE_MARKERS.filter((m) => text.includes(m));
}

// ---------------------------------------------------------------- pinned wrapper
// Protected derivative. Every governed input is verified against its exact pin before use.
export function generateFlowArtifacts(compilation, packageArtifact, readiness, projection) {
  check(canonicalHash(compilation) === FLOW_PINS.wd, 'WD_HASH_MISMATCH');
  check(canonicalHash(packageArtifact) === FLOW_PINS.package, 'PACKAGE_HASH_MISMATCH');
  check(canonicalHash(readiness) === FLOW_PINS.readiness, 'READINESS_HASH_MISMATCH');
  check(canonicalHash(projection) === FLOW_PINS.projection, 'PROJECTION_HASH_MISMATCH');
  check(compilation.definitions?.[0]?.workDefinitionId === FLOW_PINS.workDefinitionId, 'WORKDEFINITION_ID_MISMATCH');
  check(projection.sourcePackage?.sourceReleaseTip === FLOW_PINS.base, 'SOURCE_RELEASE_TIP_MISMATCH');
  check(projection.sourcePackage?.inputHashes?.package === FLOW_PINS.package && projection.sourcePackage?.inputHashes?.wd === FLOW_PINS.wd, 'PROJECTION_LINEAGE_MISMATCH');
  const before = stableStringify({compilation, packageArtifact, readiness, projection});
  const graph = deriveFlowGraph(compilation, {packageArtifact, readiness, projection});
  const flowView = renderFlowView(graph);
  const bpmn = renderBpmn(graph);
  const svg = renderSvg(graph);
  check(stableStringify({compilation, packageArtifact, readiness, projection}) === before, 'INPUT_MUTATED');
  for (const text of [stableStringify(graph), stableStringify(flowView), bpmn, svg]) check(findStaleLineage(text).length === 0, 'STALE_ATL178_LINEAGE');
  return {
    graph, flowView, bpmn, svg,
    identities: {graphHash: graph.graphHash, flowViewSha256: sha256(stableStringify(flowView)), bpmnSha256: sha256(bpmn), svgSha256: sha256(svg)}
  };
}
