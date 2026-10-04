import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {createHash} from 'node:crypto';
import {generateMalkomPackage, PINS} from '../lib/compile/s8-malkom-package.js';
import {generateMalkomProjection, PROJECTION_PINS} from '../lib/compile/s8-malkom-projection.js';
import {canonicalHash, stableStringify} from '../lib/compile/workdefinition-compiler.js';
import {reconstructTask} from '../lib/compile/source-task-decomposition.js';
import {compileCorrectedTask} from '../lib/compile/s8-workdefinition-compiler.js';
import {deriveFlowGraph, enumerateDeclaredPaths, verifyFlowGraph, traceWorkItem, renderFlowView, renderBpmn, renderSvg, findStaleLineage, generateFlowArtifacts, FLOW_PINS, FLOW_SCHEMA_VERSION} from '../lib/compile/s8-flow-bpmn.js';
import {validateBpmn, parseXml, BPMN_NS} from '../lib/compile/s8-bpmn-structure.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, ...args], {encoding: 'utf8', maxBuffer: 20000000});
const clone = (v) => structuredClone(v);

// ---- Reproduce the exact governed S8-3B/3C/3D chain (protected; never printed or committed).
const source = JSON.parse(git(['show', '662c7847d3839c1ffd95dc8589d3d0d6ac100d67:data/modules/road-ltl-v1.4.json']));
const semantics = JSON.parse(cp.execFileSync(process.execPath, ['scripts/materialize-operational-semantics-v1.cjs'], {encoding: 'utf8'}));
const binding = JSON.parse(cp.execFileSync(process.execPath, ['scripts/materialize-client-binding-v1.cjs'], {encoding: 'utf8'}));
const record = semantics.records.find((r) => r.processId === 'LTL-04');
const task = source.tasks.find((t) => t.taskId === 'LTL-04');
const pin = {commit: '662c7847d3839c1ffd95dc8589d3d0d6ac100d67', path: 'data/modules/road-ltl-v1.4.json', blob: 'd06974e9ee86cea59227e0866a98ad5d1367bfad', taskHash: canonicalHash(task), semanticSourceVersion: '1.4'};
const envelope = reconstructTask(task, pin, record, binding);
const compiled = compileCorrectedTask(envelope, canonicalHash(envelope.decomposition), semantics, binding);
const a = generateMalkomPackage(compiled, binding, record);
const projection = generateMalkomProjection(compiled, a.packageArtifact, a.readiness);
const inputsBefore = stableStringify({compiled, binding, record, pkg: a.packageArtifact, ready: a.readiness, projection});

const cases = [];
const t = (id, name, fn) => { try { fn(); cases.push({id, name, status: 'PASS'}); } catch (e) { cases.push({id, name, status: 'FAIL', error: String(e.message).slice(0, 300)}); } };

// ---- Pinned governed inputs (exact hash match; no semantic-equivalence weakening).
const out = generateFlowArtifacts(compiled, a.packageArtifact, a.readiness, projection);
const {graph, flowView, bpmn, svg, identities} = out;
const wd = compiled.definitions[0];

t('G01', 'all four governed input hashes match their exact pins', () => {
  assert.equal(canonicalHash(compiled), PINS.wd);
  assert.equal(canonicalHash(a.packageArtifact), PROJECTION_PINS.package);
  assert.equal(canonicalHash(a.readiness), PROJECTION_PINS.readiness);
  assert.equal(canonicalHash(projection), FLOW_PINS.projection);
});
t('G02', 'generation is byte-deterministic across repeated runs', () => {
  const again = generateFlowArtifacts(compiled, a.packageArtifact, a.readiness, projection);
  assert.equal(again.bpmn, bpmn); assert.equal(again.svg, svg);
  assert.equal(stableStringify(again.graph), stableStringify(graph)); assert.equal(stableStringify(again.flowView), stableStringify(flowView));
  assert.deepEqual(again.identities, identities);
});
t('G03', 'generation does not mutate any governed input (canonicalMutation=false)', () => {
  assert.equal(stableStringify({compiled, binding, record, pkg: a.packageArtifact, ready: a.readiness, projection}), inputsBefore);
  assert.equal(graph.lineage.canonicalMutation, false);
});
t('G04', 'deterministic across input key order permutation', () => {
  const rev = (v) => Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, rev(v[k])])) : v;
  const g2 = deriveFlowGraph(rev(compiled), {packageArtifact: rev(a.packageArtifact), readiness: rev(a.readiness), projection: rev(projection)});
  assert.equal(g2.graphHash, graph.graphHash); assert.equal(renderBpmn(g2), bpmn); assert.equal(renderSvg(g2), svg);
});

// ---- Lineage / scope / no stale lineage.
t('L01', 'lineage points to the corrected governed WorkDefinition and inputs', () => {
  assert.equal(graph.lineage.workDefinitionId, FLOW_PINS.workDefinitionId);
  assert.equal(graph.lineage.workDefinitionId, wd.workDefinitionId);
  assert.equal(graph.lineage.workDefinitionVersion, wd.version);
  assert.equal(graph.lineage.inputHashes.wd, PINS.wd);
  assert.equal(graph.lineage.inputHashes.package, PROJECTION_PINS.package);
  assert.equal(graph.lineage.inputHashes.readiness, PROJECTION_PINS.readiness);
  assert.equal(graph.lineage.inputHashes.projection, FLOW_PINS.projection);
  assert.equal(graph.lineage.inputHashes.binding, PINS.binding);
  assert.equal(graph.lineage.inputHashes.semantics, PINS.semantics);
  assert.equal(graph.lineage.sourceReleaseTip, PROJECTION_PINS.base);
  assert.equal(graph.lineage.decompositionId, wd.lineage.decompositionId);
  assert.equal(graph.lineage.sourceWorkUnitId, wd.lineage.sourceWorkUnitId);
  assert.equal(graph.lineage.semanticSourceVersion, '1.4');
});
t('L02', 'no stale ATL-178 WD/package lineage in any artifact', () => {
  for (const text of [stableStringify(graph), stableStringify(flowView), bpmn, svg]) assert.deepEqual(findStaleLineage(text), []);
  assert.ok(!bpmn.includes('wd::road-ltl::LTL-04::v1'));
});
t('L03', 'stale WD lineage is detected and a stale WD cannot pass the pinned gate', () => {
  const stale = clone(compiled); stale.definitions[0].workDefinitionId = 'wd::road-ltl::LTL-04::v1';
  const g = deriveFlowGraph(stale);
  assert.deepEqual(findStaleLineage(renderBpmn(g)), ['wd::road-ltl::LTL-04::v1']);
  assert.throws(() => generateFlowArtifacts(stale, a.packageArtifact, a.readiness, projection), /WD_HASH_MISMATCH/);
});
t('L04', 'Atlas/Malkom scope: Malkom queue structures are not canonical; Malkom is projection consumer only', () => {
  assert.equal(graph.scope.malkom.queueStructuresCanonical, false);
  assert.equal(graph.scope.malkom.role, 'PROJECTION_CONSUMER_ONLY');
  assert.equal(graph.scope.malkom.consumer, 'MALKOM');
  assert.equal(graph.scope.malkom.packageId, a.packageArtifact.packageId);
  assert.equal(graph.scope.malkom.handoffId, projection.handoffId);
  assert.equal(graph.scope.atlas.authority, 'RUNTIME_NEUTRAL_CANONICAL_WORKDEFINITION');
  assert.ok(!graph.nodes.some((n) => /queue/i.test(n.id) || /queue/i.test(n.label)));
});
t('L05', 'exports preserve scope/version/lineage metadata (BPMN + SVG + flow view)', () => {
  const {root} = parseXml(bpmn);
  const ext = root.children[0].children.find((c) => c.local === 'extensionElements');
  const by = (l) => ext.children.find((c) => c.local === l).lattrs;
  assert.equal(by('graph').graphHash, graph.graphHash); assert.equal(by('graph').schemaVersion, FLOW_SCHEMA_VERSION);
  assert.equal(by('lineage').workDefinitionId, wd.workDefinitionId); assert.equal(by('lineage').workDefinitionVersion, wd.version);
  assert.equal(by('lineage').wdHash, PINS.wd); assert.equal(by('lineage').packageHash, PROJECTION_PINS.package);
  assert.equal(by('lineage').readinessHash, PROJECTION_PINS.readiness); assert.equal(by('lineage').projectionHash, FLOW_PINS.projection);
  assert.equal(by('lineage').sourceReleaseTip, PROJECTION_PINS.base);
  assert.equal(by('scope').malkomQueueStructuresCanonical, 'false'); assert.equal(by('scope').consumer, 'MALKOM');
  assert.equal(by('scope').moduleId, compiled.moduleId); assert.equal(by('scope').moduleVersion, compiled.moduleVersion);
  assert.equal(by('executionBoundary').runtimeReadiness, 'NOT_PROMOTED'); assert.equal(by('executionBoundary').materializable, 'false');
  const sv = parseXml(svg).root.attrs;
  assert.equal(sv['data-graph-hash'], graph.graphHash); assert.equal(sv['data-work-definition-id'], wd.workDefinitionId);
  assert.equal(sv['data-work-definition-version'], wd.version); assert.equal(sv['data-wd-hash'], PINS.wd);
  assert.equal(sv['data-source-release-tip'], PROJECTION_PINS.base); assert.equal(sv['data-malkom-queue-canonical'], 'false');
  assert.equal(flowView.graphHash, graph.graphHash); assert.deepEqual(flowView.lineage, graph.lineage); assert.deepEqual(flowView.scope, graph.scope);
});

// ---- Declared paths / coverage.
t('P01', 'every declared outcome is represented as a traversed path (no manual happy path)', () => {
  assert.equal(graph.declaredPaths.length, wd.transitions.length);
  assert.deepEqual(graph.declaredPaths.map((p) => p.terminal.outcome).sort(), wd.transitions.map((x) => x.code).sort());
  for (const tr of wd.transitions) {
    const p = graph.declaredPaths.find((x) => x.terminal.outcome === tr.code);
    assert.equal(p.terminal.status, tr.stateAfter); assert.equal(p.terminal.requiredEvidence, tr.requiredEvidence);
    assert.equal(p.nodeIds[0], 'N::START'); assert.ok(p.nodeIds[1].startsWith('N::ACTION::'));
  }
  assert.deepEqual(enumerateDeclaredPaths(graph), graph.declaredPaths);
  assert.equal(verifyFlowGraph(graph, compiled), true);
});
t('P02', 'start trigger and action derive from the governed WD', () => {
  assert.equal(graph.nodes.find((n) => n.kind === 'START').governed.trigger, wd.trigger);
  const act = graph.nodes.find((n) => n.kind === 'ACTION');
  assert.equal(act.label, wd.actions[0].action); assert.equal(act.governed.actionId, wd.actions[0].actionId);
});
t('P03', 'no default/invented next-step: next-step is surfaced as NOT_GOVERNED on every outcome edge', () => {
  const oe = graph.edges.filter((e) => e.kind === 'DECLARED_OUTCOME');
  assert.equal(oe.length, wd.transitions.length);
  for (const e of oe) { assert.equal(e.nextStep.value, null); assert.equal(e.nextStep.disposition, 'NOT_GOVERNED'); }
  assert.ok(graph.unsupported.some((u) => u.id === 'U::NEXTSTEP' && u.state === 'NOT_GOVERNED'));
});

// ---- Fail-visible unsupported / ambiguous / blocked.
t('F01', 'blocked leaves surfaced with no edges to them and routing not asserted', () => {
  assert.equal(graph.blocked.length, 4);
  assert.equal(graph.blocked.filter((b) => b.status === 'BLOCKED_BY_CLIENT_BINDING').length, 2);
  assert.equal(graph.blocked.filter((b) => b.status === 'BLOCKED_BY_KNOWLEDGE_GAP').length, 2);
  for (const b of graph.blocked) { assert.equal(b.routing, 'NOT_COMPILED_ROUTING_NOT_ASSERTED'); assert.ok(!graph.nodes.some((n) => n.id.endsWith(b.workUnitId))); }
  assert.equal(graph.nodes.length, 7); assert.equal(graph.edges.length, 6);
});
t('F02', 'unsupported/unknown semantics are explicit', () => {
  const states = new Map(graph.unsupported.map((u) => [u.id, u.state]));
  assert.equal(states.get('U::SUBQUEUE'), 'UNKNOWN_NOT_GOVERNED');
  assert.equal(states.get('U::RUNTIME-ORCHESTRATION'), 'STOP_BOUNDARY');
  assert.equal(states.get('U::BINDING::binding::road-ltl::LTL-04::execution-parameters'), 'CLIENT_BINDING_REQUIRED');
  assert.equal(states.get('U::PACKAGE::MALKOM-DW-006'), 'REQUIREMENT_NOT_CONFIRMED');
  assert.ok([...states.keys()].some((k) => k.startsWith('U::CLOCK::')));
  assert.equal(graph.executionBoundary.runtimeReadiness, 'NOT_PROMOTED'); assert.equal(graph.executionBoundary.universalExecutionReady, false);
  assert.equal(graph.executionBoundary.materializable, false); assert.equal(graph.executionBoundary.runtimeCertification, false);
});
t('F03', 'blocked/unsupported items surface in BPMN and SVG, and no conditions/timers are invented', () => {
  const {root} = parseXml(bpmn); const ext = root.children[0].children.find((c) => c.local === 'extensionElements');
  assert.equal(ext.children.filter((c) => c.local === 'blocked').length, graph.blocked.length);
  assert.equal(ext.children.filter((c) => c.local === 'unsupported').length, graph.unsupported.length);
  assert.ok(!/conditionExpression|timerEventDefinition|subProcess|compensate/.test(bpmn));
  assert.ok(svg.includes('NOT COMPILED (routing not asserted)')); assert.ok(svg.includes('UNKNOWN_NOT_GOVERNED'));
});
t('F04', 'ambiguous routing (duplicate outcome code) fails closed', () => {
  const x = clone(compiled); x.definitions[0].transitions.push({...x.definitions[0].transitions[0]});
  assert.throws(() => deriveFlowGraph(x), /AMBIGUOUS_ROUTING_DUPLICATE_OUTCOME/);
});
t('F05', 'unsupported routing attributes on a transition are surfaced, not interpreted', () => {
  const x = clone(compiled); x.definitions[0].transitions[0].guard = 'amount>0'; x.definitions[0].transitions[1].target = 'SOME_QUEUE';
  const g = deriveFlowGraph(x);
  assert.equal(g.edges.length, graph.edges.length); assert.equal(g.nodes.length, graph.nodes.length);
  assert.deepEqual(g.edges.find((e) => e.outcome === 'ACCEPTED').unsupportedAttributes, ['guard']);
  assert.deepEqual(g.edges.find((e) => e.outcome === 'CONDITIONAL').unsupportedAttributes, ['target']);
  assert.ok(g.unsupported.some((u) => u.id === 'U::TRANSITION::ACCEPTED::guard' && u.state === 'UNSUPPORTED_ROUTING_ATTRIBUTE'));
  assert.ok(g.unsupported.some((u) => u.id === 'U::TRANSITION::CONDITIONAL::target'));
  const b = renderBpmn(g); assert.ok(b.includes('U::TRANSITION::ACCEPTED::guard')); assert.ok(!b.includes('SOME_QUEUE') && !b.includes('amount&gt;0'));
  assert.equal(validateBpmn(b).valid, true);
});
t('F06', 'a governed next-step label is carried as a label only; no target/edge is invented', () => {
  const x = clone(compiled); x.definitions[0].transitions[0].nextStep = 'LABEL_ONLY';
  const g = deriveFlowGraph(x);
  assert.equal(g.edges.length, graph.edges.length);
  const e = g.edges.find((q) => q.outcome === 'ACCEPTED'); assert.equal(e.nextStep.value, 'LABEL_ONLY'); assert.equal(e.nextStep.disposition, 'GOVERNED_LABEL_ONLY_NO_TARGET_ASSERTED');
  assert.deepEqual(g.unsupported.find((u) => u.id === 'U::NEXTSTEP').outcomes, ['CANCELLED', 'CONDITIONAL', 'REJECTED']);
});
t('F07', 'scope violations fail closed (multi-definition, multi-action, no outcomes, missing status)', () => {
  const d = clone(compiled); d.definitions.push(clone(d.definitions[0]));
  assert.throws(() => deriveFlowGraph(d), /UNSUPPORTED_SCOPE_DEFINITION_COUNT/);
  const m = clone(compiled); m.definitions[0].actions.push({...m.definitions[0].actions[0], actionId: 'X'});
  assert.throws(() => deriveFlowGraph(m), /UNSUPPORTED_SCOPE_ACTION_COUNT/);
  const z = clone(compiled); z.definitions[0].transitions = [];
  assert.throws(() => deriveFlowGraph(z), /NO_DECLARED_OUTCOMES/);
  const s = clone(compiled); delete s.definitions[0].transitions[2].stateAfter;
  assert.throws(() => deriveFlowGraph(s), /OUTCOME_STATUS_MISSING/);
});
t('F08', 'graph verifier rejects missing outcome, invented next-step, edge to blocked leaf, hidden blocked leaf', () => {
  const g1 = clone(graph); g1.nodes = g1.nodes.filter((n) => n.id !== 'N::END::REJECTED'); g1.edges = g1.edges.filter((e) => e.to !== 'N::END::REJECTED'); g1.declaredPaths = enumerateDeclaredPaths(g1);
  assert.throws(() => verifyFlowGraph(g1, compiled), /DECLARED_PATHS_NOT_REPRESENTED/);
  const g2 = clone(graph); g2.edges.find((e) => e.outcome === 'ACCEPTED').nextStep = {value: 'INVENTED_QUEUE', disposition: 'GOVERNED'};
  assert.throws(() => verifyFlowGraph(g2, compiled), /NEXTSTEP_NOT_GOVERNED_BUT_PRESENT/);
  const g3 = clone(graph); g3.nodes.push({id: 'N::ACTION::LTL-04::DG::02', kind: 'ACTION', label: 'x', governed: {}}); g3.edges.push({id: 'E::X', from: 'N::GATEWAY::OUTCOME', to: 'N::ACTION::LTL-04::DG::02', kind: 'SEQUENCE'});
  assert.throws(() => verifyFlowGraph(g3, compiled), /EDGE_TO_NOT_COMPILED_LEAF/);
  const g4 = clone(graph); g4.blocked.pop();
  assert.throws(() => verifyFlowGraph(g4, compiled), /BLOCKED_NOT_SURFACED/);
  const g5 = clone(graph); g5.edges.find((e) => e.outcome === 'REJECTED').status = 'PICKUP_ACCEPTED';
  assert.throws(() => verifyFlowGraph(g5, compiled), /EDGE_OUTCOME_ATTRIBUTE_MISMATCH/);
  const g6 = clone(graph); g6.edges.find((e) => e.outcome === 'REJECTED').outcome = 'UNDECLARED';
  assert.throws(() => verifyFlowGraph(g6, compiled), /EDGE_OUTCOME_NOT_DECLARED/);
});
t('F09', 'package/projection lineage mismatches fail closed', () => {
  const x = clone(compiled); x.definitions[0].transitions[0].stateAfter = 'CHANGED';
  assert.throws(() => deriveFlowGraph(x, {packageArtifact: a.packageArtifact}), /PACKAGE_WD_LINEAGE_MISMATCH/);
  assert.throws(() => deriveFlowGraph(x, {projection}), /PROJECTION_WD_LINEAGE_MISMATCH/);
  const r = clone(a.readiness); r.workDefinitionId = 'other';
  assert.throws(() => deriveFlowGraph(compiled, {readiness: r}), /READINESS_WD_LINEAGE_MISMATCH/);
});
t('F10', 'any governed-input hash drift is rejected exactly (no semantic equivalence)', () => {
  const cs = [
    ['wd', (x) => { x.unauthorized = true; }, 'WD_HASH_MISMATCH'],
    ['wd', (x) => { x.definitions[0].transitions[0].stateAfter = 'PICKUP_ACCEPTED '; }, 'WD_HASH_MISMATCH'],
    ['pkg', (x) => { x.lineage.workDefinitionHead = 'stale'; }, 'PACKAGE_HASH_MISMATCH'],
    ['pkg', (x) => { x.interface.apiEndpoint = 'https://inferred.invalid'; }, 'PACKAGE_HASH_MISMATCH'],
    ['ready', (x) => { x.universalExecutionReady = true; }, 'READINESS_HASH_MISMATCH'],
    ['ready', (x) => { x.clientBindings.unresolvedCount = 0; }, 'READINESS_HASH_MISMATCH'],
    ['proj', (x) => { x.release.materializable = true; }, 'PROJECTION_HASH_MISMATCH'],
    ['proj', (x) => { x.sourcePackage.sourceReleaseTip = 'stale'; }, 'PROJECTION_HASH_MISMATCH']
  ];
  for (const [k, mut, code] of cs) {
    const i = {wd: clone(compiled), pkg: clone(a.packageArtifact), ready: clone(a.readiness), proj: clone(projection)}; mut(i[k]);
    assert.throws(() => generateFlowArtifacts(i.wd, i.pkg, i.ready, i.proj), new RegExp(code));
  }
});

// ---- Governed source change deterministically changes the diagram.
t('D01', 'governed source change redraws deterministically (add / remove / change an outcome)', () => {
  const add = clone(compiled); add.definitions[0].transitions.push({code: 'ESCALATED', requiredEvidence: 'reason', stateAfter: 'PICKUP_ESCALATED'});
  const rem = clone(compiled); rem.definitions[0].transitions = rem.definitions[0].transitions.filter((x) => x.code !== 'REJECTED');
  const chg = clone(compiled); chg.definitions[0].transitions[0].stateAfter = 'PICKUP_ACCEPTED_V2';
  const base = {g: graph, b: bpmn, s: svg};
  const seen = new Set([base.g.graphHash]);
  for (const [x, paths, must] of [[add, 5, 'ESCALATED'], [rem, 3, null], [chg, 4, 'PICKUP_ACCEPTED_V2']]) {
    const g = deriveFlowGraph(x); const b = renderBpmn(g); const s = renderSvg(g);
    assert.equal(g.declaredPaths.length, paths); assert.ok(!seen.has(g.graphHash)); seen.add(g.graphHash);
    assert.notEqual(b, base.b); assert.notEqual(s, base.s);
    if (must) { assert.ok(b.includes(must)); assert.ok(s.includes(must)); } else { assert.ok(!b.includes('N::END::REJECTED')); assert.ok(!b.includes('PICKUP_REJECTED')); assert.ok(!s.includes('PICKUP_REJECTED')); }
    assert.equal(validateBpmn(b).valid, true);
    const again = deriveFlowGraph(clone(x)); assert.equal(renderBpmn(again), b); assert.equal(renderSvg(again), s); assert.equal(again.graphHash, g.graphHash);
    assert.equal(g.lineage.inputHashes.wd, canonicalHash(x)); assert.notEqual(g.lineage.inputHashes.wd, PINS.wd);
  }
});
t('D02', 'single-outcome change omits the gateway and still validates', () => {
  const one = clone(compiled); one.definitions[0].transitions = [one.definitions[0].transitions[0]];
  const g = deriveFlowGraph(one); assert.equal(g.nodes.length, 3); assert.equal(g.edges.length, 2); assert.ok(!g.nodes.some((n) => n.kind === 'OUTCOME_GATEWAY'));
  assert.equal(validateBpmn(renderBpmn(g)).valid, true);
});
t('D03', 'a change in a non-routing governed field changes lineage hash but not path structure', () => {
  const x = clone(compiled); x.definitions[0].purpose = `${x.definitions[0].purpose} (edited)`;
  const g = deriveFlowGraph(x); assert.notEqual(g.graphHash, graph.graphHash); assert.equal(g.declaredPaths.length, 4);
  assert.notEqual(g.lineage.inputHashes.wd, PINS.wd);
});

// ---- Trace.
t('T01', 'trace requires an explicit selection (no default happy path)', () => {
  for (const sel of [undefined, null, {}, {workItemId: 'WI-1'}, {outcome: ''}]) assert.throws(() => traceWorkItem(graph, sel), /TRACE_SELECTION_REQUIRED/);
});
t('T02', 'trace follows each declared path to the governed outcome/status/evidence and carries lineage', () => {
  for (const tr of wd.transitions) {
    const x = traceWorkItem(graph, {outcome: tr.code, workItemId: `WI-${tr.code}`});
    assert.equal(x.workItemId, `WI-${tr.code}`); assert.equal(x.terminal.status, tr.stateAfter); assert.equal(x.terminal.requiredEvidence, tr.requiredEvidence);
    assert.equal(x.nodeIds[0], 'N::START'); assert.equal(x.nodeIds.at(-1), `N::END::${tr.code}`); assert.equal(x.edgeIds.length, x.nodeIds.length - 1);
    assert.equal(x.nextStep.disposition, 'NOT_GOVERNED');
    assert.equal(x.lineage.workDefinitionId, wd.workDefinitionId); assert.equal(x.lineage.graphHash, graph.graphHash); assert.equal(x.lineage.inputHashes.wd, PINS.wd);
    assert.deepEqual(traceWorkItem(graph, {pathId: `P::${tr.code}`}).nodeIds, x.nodeIds);
  }
});
t('T03', 'trace rejects unknown/conflicting/not-compiled selections and does not mutate the graph', () => {
  const snap = stableStringify(graph);
  assert.throws(() => traceWorkItem(graph, {outcome: 'UNDECLARED'}), /TRACE_SELECTION_UNKNOWN/);
  assert.throws(() => traceWorkItem(graph, {pathId: 'P::UNDECLARED'}), /TRACE_SELECTION_UNKNOWN/);
  assert.throws(() => traceWorkItem(graph, {outcome: 'ACCEPTED', pathId: 'P::REJECTED'}), /TRACE_SELECTION_CONFLICT/);
  assert.throws(() => traceWorkItem(graph, {outcome: 'ACCEPTED', workUnitId: 'LTL-04::DG::02'}), /TRACE_TARGET_NOT_COMPILED/);
  assert.throws(() => traceWorkItem(graph, {outcome: 'ACCEPTED', workUnitId: 'NOPE'}), /TRACE_TARGET_UNKNOWN/);
  assert.equal(stableStringify(graph), snap);
});
t('T04', 'selected-path highlight is identical in Flow view and SVG and absent when nothing is selected', () => {
  assert.ok(!svg.includes('data-selected')); assert.equal(flowView.selectedPath, null); assert.ok(flowView.nodes.every((n) => !n.onSelectedPath));
  const pid = 'P::CONDITIONAL'; const p = graph.declaredPaths.find((x) => x.id === pid);
  const fv = renderFlowView(graph, {tracePathId: pid}); const sv = renderSvg(graph, {tracePathId: pid});
  assert.deepEqual(fv.nodes.filter((n) => n.onSelectedPath).map((n) => n.id).sort(), [...p.nodeIds].sort());
  assert.deepEqual(fv.edges.filter((e) => e.onSelectedPath).map((e) => e.id).sort(), [...p.edgeIds].sort());
  const root = parseXml(sv).root; const sel = (attr) => root.children.filter((c) => c.attrs[attr] && c.attrs['data-selected'] === 'true').map((c) => c.attrs[attr]).sort();
  assert.deepEqual(sel('data-node-id'), [...p.nodeIds].sort()); assert.deepEqual(sel('data-edge-id'), [...p.edgeIds].sort());
  assert.equal(fv.graphHash, graph.graphHash); assert.equal(fv.selectedPath.pathId, pid);
  assert.throws(() => renderSvg(graph, {tracePathId: 'P::UNDECLARED'}), /TRACE_SELECTION_UNKNOWN/);
});

// ---- Flow and BPMN derive from the same graph.
t('S01', 'Flow view, BPMN and SVG expose exactly the same governed nodes, edges and endpoints', () => {
  const {root} = parseXml(bpmn); const proc = root.children.find((c) => c.local === 'process');
  const nodeIdMap = new Map(); const bpmnNodes = new Set(); const bpmnEdges = new Map();
  for (const el of proc.children) {
    const gn = el.children.find((c) => c.local === 'extensionElements')?.children.find((c) => c.local === 'governedNode');
    if (gn) { bpmnNodes.add(gn.lattrs.graphNodeId); nodeIdMap.set(el.attrs.id, gn.lattrs.graphNodeId); }
  }
  for (const el of proc.children.filter((c) => c.local === 'sequenceFlow')) {
    const ge = el.children.find((c) => c.local === 'extensionElements').children.find((c) => c.local === 'governedEdge');
    bpmnEdges.set(ge.lattrs.graphEdgeId, [nodeIdMap.get(el.attrs.sourceRef), nodeIdMap.get(el.attrs.targetRef), ge.lattrs.outcome, ge.lattrs.status]);
  }
  assert.deepEqual([...bpmnNodes].sort(), graph.nodes.map((n) => n.id).sort());
  assert.deepEqual([...bpmnEdges.keys()].sort(), graph.edges.map((e) => e.id).sort());
  for (const e of graph.edges) assert.deepEqual(bpmnEdges.get(e.id), [e.from, e.to, e.outcome ?? '', e.status ?? '']);
  const svgRoot = parseXml(svg).root;
  assert.deepEqual(svgRoot.children.filter((c) => c.attrs['data-node-id']).map((c) => c.attrs['data-node-id']).sort(), graph.nodes.map((n) => n.id).sort());
  assert.deepEqual(svgRoot.children.filter((c) => c.attrs['data-edge-id']).map((c) => c.attrs['data-edge-id']).sort(), graph.edges.map((e) => e.id).sort());
  assert.deepEqual(flowView.nodes.map((n) => n.id), graph.nodes.map((n) => n.id)); assert.deepEqual(flowView.edges.map((e) => e.id), graph.edges.map((e) => e.id));
  assert.deepEqual(flowView.declaredPaths, graph.declaredPaths); assert.deepEqual(flowView.blocked, graph.blocked); assert.deepEqual(flowView.unsupported, graph.unsupported);
});
t('S02', 'BPMN diagram interchange geometry equals the SVG geometry (single layout source)', () => {
  const {root} = parseXml(bpmn); const plane = root.children.find((c) => c.local === 'BPMNDiagram').children[0];
  const idOf = new Map();
  for (const el of root.children.find((c) => c.local === 'process').children) { const gn = el.children.find((c) => c.local === 'extensionElements')?.children.find((c) => c.local === 'governedNode'); if (gn) idOf.set(el.attrs.id, gn.lattrs.graphNodeId); }
  const shapes = plane.children.filter((c) => c.local === 'BPMNShape');
  assert.equal(shapes.length, graph.nodes.length); assert.equal(plane.children.filter((c) => c.local === 'BPMNEdge').length, graph.edges.length);
  const svgRoot = parseXml(svg).root;
  for (const sh of shapes) {
    const b = Object.fromEntries(Object.entries(sh.children[0].attrs).map(([k, v]) => [k, Number(v)]));
    const g = svgRoot.children.find((c) => c.attrs['data-node-id'] === idOf.get(sh.attrs.bpmnElement)); const f = g.children[0];
    if (f.local === 'circle') { assert.equal(Number(f.attrs.cx), b.x + b.width / 2); assert.equal(Number(f.attrs.cy), b.y + b.height / 2); }
    else if (f.local === 'rect') { assert.equal(Number(f.attrs.x), b.x); assert.equal(Number(f.attrs.y), b.y); assert.equal(Number(f.attrs.width), b.width); }
    else { assert.equal(f.attrs.points.split(' ')[0], `${b.x + b.width / 2},${b.y}`); }
  }
  assert.deepEqual(flowView.nodes.map((n) => n.position), graph.nodes.map((n) => { const sh = shapes.find((q) => idOf.get(q.attrs.bpmnElement) === n.id).children[0].attrs; return {x: Number(sh.x), y: Number(sh.y)}; }));
});

// ---- BPMN 2.0 structural validity.
t('B01', 'generated BPMN is well-formed and structurally valid for the supported scope', () => {
  const v = validateBpmn(bpmn);
  assert.deepEqual(v.errors, []); assert.equal(v.valid, true);
  assert.deepEqual(v.summary, {starts: 1, tasks: 1, gateways: 1, ends: 4, flows: 6, shapes: 7, edges: 6});
  const {root} = parseXml(bpmn); assert.equal(root.ns, BPMN_NS.model);
  assert.equal(root.children.find((c) => c.local === 'process').attrs.isExecutable, 'false');
});
t('B02', 'structural validator rejects malformed or out-of-scope BPMN (fail-visible)', () => {
  const neg = [
    ['not well formed', (s) => s.replace('</bpmn:process>', ''), 'XML_NOT_WELL_FORMED'],
    ['missing prolog', (s) => s.replace(/^<\?xml[^>]*\?>\n/, ''), 'XML_PROLOG_MISSING'],
    ['dangling targetRef', (s) => s.replace(/targetRef="[^"]+"/, 'targetRef="Nope"'), 'SEQUENCEFLOW_TARGET_UNRESOLVED'],
    ['duplicate id', (s) => s.replace('id="EndEvent_N__END__ACCEPTED"', 'id="StartEvent_N__START"'), 'ID_DUPLICATE'],
    ['non-NCName id', (s) => s.replace(/id="StartEvent_N__START"/, 'id="1bad"'), 'ID_NOT_NCNAME'],
    ['executable process', (s) => s.replace('isExecutable="false"', 'isExecutable="true"'), 'PROCESS_MUST_BE_NON_EXECUTABLE'],
    ['condition expression', (s) => s.replace(/(<bpmn:sequenceFlow [^>]*name="ACCEPTED">)/, '$1<bpmn:conditionExpression>x</bpmn:conditionExpression>'), 'UNSUPPORTED_SEMANTIC_ELEMENT'],
    ['timer event', (s) => s.replace(/(<bpmn:task [^>]*>)/, '$1<bpmn:timerEventDefinition/>'), 'UNSUPPORTED_SEMANTIC_ELEMENT'],
    ['unsupported element', (s) => s.replace('</bpmn:process>', '<bpmn:subProcess id="SP"/></bpmn:process>'), 'UNSUPPORTED_PROCESS_ELEMENT'],
    ['missing shape', (s) => s.replace(/<bpmndi:BPMNShape id="Task_[\s\S]*?<\/bpmndi:BPMNShape>\n/, ''), 'SHAPE_MISSING'],
    ['missing outgoing ref', (s) => s.replace(/<bpmn:outgoing>[^<]*<\/bpmn:outgoing>\n/, ''), 'OUTGOING_INCONSISTENT'],
    ['child order', (s) => s.replace(/(<bpmn:task [^>]*>)([\s\S]*?)(<bpmn:incoming>[^<]*<\/bpmn:incoming>)/, '$1$3$2'), 'FLOWNODE_CHILD_ORDER'],
    ['wrong root', (s) => s.replace(/bpmn:definitions/g, 'bpmn:process'), 'ROOT_NOT_BPMN_DEFINITIONS'],
    ['unescaped ampersand', (s) => s.replace('exporter="AiFY Atlas S8-3E"', 'exporter="A & B"'), 'XML_NOT_WELL_FORMED']
  ];
  for (const [name, mut, code] of neg) { const v = validateBpmn(mut(bpmn)); assert.equal(v.valid, false, name); assert.ok(v.errors.some((e) => e.startsWith(code) || e.includes(code)), `${name}: ${v.errors.join(',')}`); }
});
t('B03', 'BPMN ids are valid NCNames derived from governed ids without collisions', () => {
  const ids = [...bpmn.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length); for (const id of ids) assert.match(id, /^[A-Za-z_][A-Za-z0-9_.-]*$/);
  assert.ok(ids.includes('Task_N__ACTION__LTL-04__ACT__02'));
});
t('B04', 'SVG is well-formed XML and escapes governed text', () => {
  const x = clone(compiled); x.definitions[0].actions[0].action = 'a<b & "c"';
  const s = renderSvg(deriveFlowGraph(x)); assert.ok(parseXml(s).root.local === 'svg'); assert.ok(s.includes('a&lt;b &amp; &quot;c&quot;'));
  assert.ok(renderBpmn(deriveFlowGraph(x)).includes('a&lt;b &amp; &quot;c&quot;'));
  assert.equal(validateBpmn(renderBpmn(deriveFlowGraph(x))).valid, true);
  assert.equal(parseXml(svg).root.local, 'svg');
});

// ---- Public evidence is non-reconstructive; outputs are protected.
t('E01', 'artifacts are classified EXECUTION_PROTECTED and public summary is non-reconstructive', () => {
  assert.equal(graph.classification, 'EXECUTION_PROTECTED');
  const protectedStrings = [wd.trigger, wd.actions[0].action, wd.actions[0].precondition, ...wd.transitions.flatMap((x) => [x.stateAfter, x.requiredEvidence]), wd.title, wd.purpose];
  const summaryText = JSON.stringify(buildSummary());
  for (const s of protectedStrings) assert.ok(!summaryText.includes(s), `summary leaks: ${s}`);
});

function buildSummary() {
  return {
    schemaVersion: 's8-3e-flow-evidence-v1', classification: 'PUBLIC_NON_RECONSTRUCTIVE', detailIncluded: false,
    flowSchemaVersion: FLOW_SCHEMA_VERSION,
    inputHashes: {wd: FLOW_PINS.wd, package: FLOW_PINS.package, readiness: FLOW_PINS.readiness, projection: FLOW_PINS.projection, binding: FLOW_PINS.binding, semantics: FLOW_PINS.semantics, sourceReleaseTip: FLOW_PINS.base},
    workDefinitionId: graph.lineage.workDefinitionId,
    artifactIdentities: {graphHash: identities.graphHash, flowViewSha256: identities.flowViewSha256, bpmnSha256: identities.bpmnSha256, svgSha256: identities.svgSha256},
    counts: {nodes: graph.nodes.length, edges: graph.edges.length, declaredPaths: graph.declaredPaths.length, blockedLeaves: graph.blocked.length, unsupportedDispositions: graph.unsupported.length, bpmnShapes: validateBpmn(bpmn).summary.shapes, bpmnEdges: validateBpmn(bpmn).summary.edges},
    bpmnValidation: {valid: validateBpmn(bpmn).valid, validator: 'lib/compile/s8-bpmn-structure.js', scope: 'BOUNDED_BPMN_2_0_STRUCTURAL'},
    boundary: {canonicalMutation: false, deterministic: true, runtimeReadiness: 'NOT_PROMOTED', runtimeOrchestration: 'STOP_BOUNDARY', universalExecutionReady: false, materializable: false, runtimeCertification: false, malkomQueueStructuresCanonical: false},
    qa: {caseIds: cases.map((c) => c.id), caseCount: cases.length}
  };
}

const failed = cases.filter((c) => c.status !== 'PASS');
if (failed.length) { console.error(JSON.stringify({status: 'FAIL', failed}, null, 1)); process.exit(1); }
const summary = buildSummary();

// Optional private output (protected derivatives stay outside the public repo).
if (process.env.S8_3E_PRIVATE_OUTPUT_DIR) {
  const dir = path.resolve(process.env.S8_3E_PRIVATE_OUTPUT_DIR); const repo = path.resolve('.');
  assert.ok(path.relative(repo, dir).startsWith('..') || path.isAbsolute(path.relative(repo, dir)), 'PRIVATE_OUTPUT_MUST_BE_OUTSIDE_REPO');
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  for (const [n, c] of [['flow-graph.json', JSON.stringify(graph, null, 2) + '\n'], ['flow-view.json', JSON.stringify(flowView, null, 2) + '\n'], ['flow.bpmn', bpmn], ['flow.svg', svg]]) fs.writeFileSync(path.join(dir, n), c, {mode: 0o600});
}
if (process.env.S8_3E_SUMMARY_PATH) fs.writeFileSync(process.env.S8_3E_SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n');
else assert.deepEqual(summary, JSON.parse(fs.readFileSync('governance/product/s8-3e-evidence/flow-summary.json', 'utf8')));
console.log(JSON.stringify(summary));
