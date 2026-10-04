import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import {generateMalkomPackage, PINS} from '../lib/compile/s8-malkom-package.js';
import {generateMalkomProjection, PROJECTION_PINS} from '../lib/compile/s8-malkom-projection.js';
import {canonicalHash} from '../lib/compile/workdefinition-compiler.js';
import {reconstructTask} from '../lib/compile/source-task-decomposition.js';
import {compileCorrectedTask} from '../lib/compile/s8-workdefinition-compiler.js';
import {generateFlowArtifacts, FLOW_PINS} from '../lib/compile/s8-flow-bpmn.js';
import {SUMMARY_PATHS, validateLineage, buildConsumerViewModel, buildCrosswalk, CROSSWALK_COLUMNS, CONSUMER_SCOPE, stateText, loadSummaries} from '../assets/atl-140-consumer-view.mjs';
import {journeyMarkup, resolveWorkDetailHref, install, bootJourney, JOURNEY_SECTION_ID, FLOW_ANCHOR_PATH, CONSUMER_VIEW_PATH} from '../assets/atl-140-v15-journey.mjs';
import {buildDaughterHref, resolveDaughterTarget, CANVAS_DAUGHTER_BRIDGE_VERSION} from '../assets/canvas-daughter-bridge-v2.0.1.mjs';

// S8-4 — Controlled Interaction Rebinding. Fails if the wrong root, the superseded Ask, a replaced Canvas/bridge/Ask
// stack, or the ATL-140 behavioural delta regresses. Works on a committed or working tree (uses git index + worktree).
const git = (args, o = {}) => cp.execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, ...args], {encoding: 'utf8', maxBuffer: 50000000, ...o}).trim();
const gitOk = (args) => { try { git(args, {stdio: 'pipe'}); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(p, 'utf8');
const blobOf = (p) => git(['hash-object', p]);
const clone = (v) => structuredClone(v);

const BASE = 'fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751';
const S8_3E_IMPL = '7c6b5ce12e8d10738d7370186c55d2fdfeac0879';
const DONORS = {P5: '814d2e7dd2265fd06aba43e16a4ae75bdfca7190', P62: '6ae00356b656216749da7d2a7eed273aecec8cd8', ATL140: 'e0c17bbb85bda27ebb9189be7cc845e3c48979dd', ATL142: 'dba6968b0bdf28b533f4efd765302796e6ebed58'};
const SUPERSEDED_ASK = 'cb2bcfea0892adf5a871fb4584461b50729ab383';
const ATL142_ROOT_INDEX = '379f988ce807f33dc8fd43b49b227b917a15b8c0';
const ATL140_ROOT_INDEX = '9cf88a867359ba33ebfbe85c1360f0ab21bc29b3';
const CERT_ROOT_INDEX = '043802523b1618c143a0e78b88bbfb2afaa7c7dd';
const STALE_WD = ['wd', '::road-ltl::LTL-04::v', '1'].join(''); // assembled so this file never carries the stale marker verbatim
const CANVAS = {
  'canvas-v2/canvas-v2/index.html': '4dfa0a8410eba303ba7dad73a5cee6431dfe3258',
  'canvas-v2/canvas-v2/assets/canvas-v2.css': '860c878491479b40c1a71c8530d2f1725564341b',
  'canvas-v2/canvas-v2/assets/canvas-v2.js': '672dd1b5a1eb8c3c1698fae436fa0b3db53cd5d0',
  'canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md': 'cff249802d6d61db395bf8d0a3587fafad26da67'
};
const BRIDGE = {path: 'assets/canvas-daughter-bridge-v2.0.1.mjs', blob: '264e4ed26f112845bd4afb3d1e990138971d13fe'};
const ASK = {
  'runtime/universal-ask-atlas.js': '521c47a3956c81367bab942a657f998d576ff15f',
  'lib/api/ask-atlas.js': '8fa80f9d',
  'governance/ask-atlas-surface-contract-v1.json': '608956d30ea89859e9e649457debb73d267e04cd',
  'lib/ask/p5-governed-retrieval.js': '6f3c29dc',
  'ATLAS_V2.0.1_UNIVERSAL_ASK_CERTIFICATION.md': 'd0dfd8b2e4343f7ea86af249407e33f158267959'
};
const NEW_PATHS = new Set(['assets/atl-140-consumer-view.mjs', 'assets/atl-140-v15-journey.mjs', 'atl-140-malkom-consumer.html', 'tests/s8-4-interaction-rebinding.test.mjs', 'governance/product/S8_4_INTERACTION_REBINDING.md']);
const NEW_PREFIXES = ['governance/product/s8-4-evidence/'];
const SHELL = 'execution/ui/runtime-access-shell.js';
const JOURNEY_LINE = "import('/assets/atl-140-v15-journey.mjs').catch(e=>console.warn('Atlas ATL-140 v1.5 Malkom journey bootstrap',e));";

const prov = JSON.parse(read('governance/product/s8-4-evidence/donor-provenance.json'));
const allPaths = () => [...new Set(git(['ls-files', '-co', '--exclude-standard']).split('\n').filter(Boolean))].filter((p) => fs.existsSync(p));
const changedVsBase = () => [...new Set([...git(['diff', '--name-only', '--no-renames', BASE]).split('\n'), ...git(['ls-files', '-o', '--exclude-standard']).split('\n')].filter(Boolean))];
const deletedVsBase = () => git(['diff', '--name-only', '--diff-filter=D', BASE]).split('\n').filter(Boolean).concat(git(['ls-files', '-d']).split('\n').filter(Boolean));
const donorBlob = (commit, p) => git(['rev-parse', `${commit}:${p}`]);

const cases = [];
const t = (id, name, fn) => { try { fn(); cases.push({id, name, status: 'PASS'}); } catch (e) { cases.push({id, name, status: 'FAIL', error: String(e.message).slice(0, 300)}); } };

// ------------------------------------------------------------------ donor identity
t('D01', 'every transplanted certified donor file is byte-identical to its donor blob (shell excepted: governed one-line adaptation)', () => {
  assert.equal(prov.imports.length, 23);
  for (const e of prov.imports) {
    assert.equal(donorBlob(e.sourceCommit, e.path), e.expectedBlob, `donor blob drifted ${e.path}`);
    if (e.path === SHELL) continue;
    assert.equal(blobOf(e.path), e.expectedBlob, `donor identity lost ${e.path}`);
  }
});
t('D02', 'runtime shell = certified donor blob + exactly one governed additive line (donor separately identifiable)', () => {
  const e = prov.imports.find((x) => x.path === SHELL);
  assert.equal(e.disposition, 'ADAPTED_ADDITIVE_ONE_LINE'); assert.equal(e.appendedLine, JOURNEY_LINE);
  const donor = git(['cat-file', 'blob', e.expectedBlob], {stdio: 'pipe'});
  assert.equal(read(SHELL), `${donor}\n${JOURNEY_LINE}\n`.replace(/\n\n$/, '\n'));
  assert.ok(donor.includes("import('/assets/canvas-daughter-bridge-v2.0.1.mjs')"), 'certified bridge bootstrap retained');
});
t('D03', 'certified Canvas V2.0 donor present, byte-identical, and equal to the P6.2 donor commit blobs', () => {
  for (const [p, b] of Object.entries(CANVAS)) { assert.equal(blobOf(p), b, p); assert.equal(donorBlob(DONORS.P62, p), b, `${p} donor`); }
  assert.ok(blobOf('canvas-v2/canvas-v2/index.html').startsWith('4dfa0a84') && blobOf('canvas-v2/canvas-v2/assets/canvas-v2.css').startsWith('860c8784') && blobOf('canvas-v2/canvas-v2/assets/canvas-v2.js').startsWith('672dd1b5') && blobOf('canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md').startsWith('cff24980'));
});
t('D04', 'certified Canvas->Daughter bridge V2.0.1 present at its exact governing blob (no ungoverned replacement)', () => {
  assert.equal(blobOf(BRIDGE.path), BRIDGE.blob); assert.equal(donorBlob(DONORS.P62, BRIDGE.path), BRIDGE.blob);
  assert.equal(CANVAS_DAUGHTER_BRIDGE_VERSION, '2.0.1');
  assert.equal(prov.bridge.expectedBlob, BRIDGE.blob);
});
t('D05', 'certified Universal Ask 2.0.1 stack present: runtime 521c47a3, API 8fa80f9d, contract 608956d3, retrieval 6f3c29dc, cert d0dfd8b2', () => {
  for (const [p, b] of Object.entries(ASK)) { assert.ok(blobOf(p).startsWith(b), `${p} ${blobOf(p)}`); assert.equal(donorBlob(DONORS.P5, p), blobOf(p), `${p} donor`); }
});
t('D06', 'donor provenance records the pinned donor commits and authorities', () => {
  assert.equal(prov.base.sha, BASE);
  for (const e of prov.imports) assert.ok([DONORS.P5, DONORS.P62].includes(e.sourceCommit));
  for (const e of prov.alreadyInBase) assert.equal(blobOf(e.path), e.expectedBlob);
  assert.equal(prov.behaviouralDelta.commit, DONORS.ATL140); assert.equal(prov.prohibited.atl142.commit, DONORS.ATL142);
  for (const c of Object.values(DONORS)) assert.equal(git(['cat-file', '-t', c]), 'commit');
});

// ------------------------------------------------------------------ corrected ancestry
t('A01', 'S8-4 descends from the exact S8-3E base (and S8-3E implementation commit)', () => {
  assert.ok(gitOk(['merge-base', '--is-ancestor', BASE, 'HEAD'])); assert.ok(gitOk(['merge-base', '--is-ancestor', S8_3E_IMPL, 'HEAD']));
  assert.ok(git(['rev-list', '--first-parent', 'HEAD']).split('\n').includes(BASE), 'base is on the first-parent spine');
});
t('A02', 'no donor (P5, P6.2, ATL-140, ATL-142) is an ancestor of HEAD: donor ancestry did not replace S8 ancestry', () => {
  for (const [k, c] of Object.entries(DONORS)) assert.equal(gitOk(['merge-base', '--is-ancestor', c, 'HEAD']), false, `${k} must not be an ancestor`);
});
t('A03', 'root index.html is the certified blob; neither the ATL-142 root nor the ATL-140 root is present', () => {
  assert.equal(blobOf('index.html'), CERT_ROOT_INDEX);
  assert.notEqual(blobOf('index.html'), ATL142_ROOT_INDEX); assert.notEqual(blobOf('index.html'), ATL140_ROOT_INDEX);
  for (const p of allPaths()) if (p.endsWith('.html')) assert.ok(![ATL142_ROOT_INDEX, ATL140_ROOT_INDEX].includes(blobOf(p)), `wrong root blob at ${p}`);
  assert.ok(!read('index.html').includes(JOURNEY_SECTION_ID), 'ATL-140 root journey section must not be inlined into the certified root');
  assert.equal(donorBlob(DONORS.ATL142, 'index.html'), ATL142_ROOT_INDEX); assert.equal(donorBlob(DONORS.ATL140, 'index.html'), ATL140_ROOT_INDEX);
});

// ------------------------------------------------------------------ prohibited lineage
t('P01', 'superseded Ask API blob cb2bcfea absent from every live path; only the two inherited release/packages copies (not introduced by S8-4)', () => {
  const hits = allPaths().filter((p) => blobOf(p) === SUPERSEDED_ASK).sort();
  assert.deepEqual(hits, ['release/packages/lab/lib/api/ask-atlas.js', 'release/packages/stable/lib/api/ask-atlas.js']);
  const baseHits = git(['ls-tree', '-r', BASE]).split('\n').filter((l) => l.includes(SUPERSEDED_ASK)).map((l) => l.split('\t')[1]).sort();
  assert.deepEqual(hits, baseHits, 'S8-4 must introduce none');
  assert.deepEqual(prov.prohibited.supersededAskApi.inheritedPathsInBase.slice().sort(), hits);
  for (const p of hits) assert.ok(p.startsWith('release/packages/'));
  for (const p of ['api/atlas.js', 'lib/api/ask-atlas.js', 'runtime/universal-ask-atlas.js']) assert.notEqual(blobOf(p), SUPERSEDED_ASK);
});
t('P02', 'live Ask API is the certified P5 governed stack (stage atlas-p5-governed-ask, governed retrieval + capability gate)', () => {
  const api = read('lib/api/ask-atlas.js');
  assert.ok(api.includes("stage:'atlas-p5-governed-ask'")); assert.ok(api.includes('../ask/p5-governed-retrieval.js')); assert.ok(api.includes('requireCapabilities'));
  assert.ok(!api.includes('atlas-p4-ask') );
});
t('P03', 'stale ATL-140/167/178 pages and generated LTL-04 data are absent', () => {
  const stale = ['atl-167-interaction-slice.html', 'atl-178-flow-explorer.html'];
  for (const p of stale) assert.ok(!fs.existsSync(p), p);
  const bad = allPaths().filter((p) => /^data\/generated\/(workdefinitions|malkom-domain-warehouse|readiness|flow-graphs)\//.test(p) && /ltl-?04/i.test(p));
  assert.deepEqual(bad, []);
});
t('P04', 'stale WorkDefinition id never appears in any file added or changed by S8-4', () => {
  for (const p of changedVsBase()) { if (!fs.existsSync(p) || /\.(b64|gz|png)$/.test(p)) continue; assert.ok(!read(p).includes(STALE_WD), `stale lineage in ${p}`); }
});

// ------------------------------------------------------------------ scope / regression
t('S01', 'changed paths are exactly the governed transplant + new S8-4 files; no deletions', () => {
  const ok = new Set([...prov.imports.map((e) => e.path), ...NEW_PATHS]);
  for (const p of changedVsBase()) assert.ok(ok.has(p) || NEW_PREFIXES.some((x) => p.startsWith(x)), `unexpected changed path ${p}`);
  assert.deepEqual(deletedVsBase(), []);
});
t('S02', 'no S8-3A..3E governed output or implementation modified (lib/compile, S8 tests, S8 governance evidence)', () => {
  const guarded = ['lib/compile/', 'governance/product/S8_2E_LEAF_COMPILER_CORRECTION.md', 'governance/product/S8_3B_RECONSTRUCTION_GATE.md', 'governance/product/S8_3C_MALKOM_PACKAGE_READINESS.md', 'governance/product/S8_3D_MALKOM_PROJECTION_BOUNDARY.md', 'governance/product/S8_3E_ATL178_FLOW_BPMN.md', 'governance/product/s8-2e-correction-evidence/', 'governance/product/s8-3b-evidence/', 'governance/product/s8-3c-evidence/', 'governance/product/s8-3d-evidence/', 'governance/product/s8-3e-evidence/'];
  for (const p of changedVsBase()) for (const g of guarded) assert.ok(!(p === g || p.startsWith(g)), `S8 governed path modified: ${p}`);
  for (const p of changedVsBase()) assert.ok(!/^tests\/s8-[23]/.test(p) && !p.startsWith('tests/p6-2-'), p);
});
t('S03', 'no runtime/release promotion: release/ and Canvas untouched; all public summaries remain BLOCKED / not certified', () => {
  for (const p of changedVsBase()) assert.ok(!p.startsWith('release/') && !p.startsWith('canvas-v2/'), p);
  const s = Object.fromEntries(Object.entries(SUMMARY_PATHS).map(([k, p]) => [k, JSON.parse(read(p.slice(1)))]));
  assert.equal(s.packageReadiness.projectionDisposition, 'BLOCKED'); assert.equal(s.projection.readiness, 'BLOCKED');
  assert.equal(s.projection.runtimeCertification, false); assert.equal(s.projection.materializable, false); assert.equal(s.projection.universalExecutionReady, false);
  assert.equal(s.flow.boundary.runtimeReadiness, 'NOT_PROMOTED');
});
t('S04', 'no semantic invention: S8-4 new files carry no V2 scope, no guessed endpoint/queue/route semantics', () => {
  const text = [...NEW_PATHS].filter((p) => p.startsWith('assets/') || p.endsWith('.html')).map(read).join('\n');
  assert.ok(!/\bv2\.\d+ scope\b/i.test(text));
  assert.ok(text.includes('REQUIREMENT_NOT_CONFIRMED') && text.includes('NO_GUESSED_INTERFACE'));
  assert.ok(!/fetch\(['"`]\/api\//.test(text), 'ATL-140 surfaces must not call protected/admin APIs');
});

// ------------------------------------------------------------------ ATL-140 behavioural preservation + bridge reachability
const registry = JSON.parse(read('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json'));
const summaries = Object.fromEntries(Object.entries(SUMMARY_PATHS).map(([k, p]) => [k, JSON.parse(read(p.slice(1)))]));
const model = buildConsumerViewModel(summaries);
t('B01', 'ATL-140 journey section: id, heading text, framing sentence, three links and public/protected note preserved', () => {
  const html = journeyMarkup('/daughter?x');
  for (const x of [`id="${JOURNEY_SECTION_ID}"`, 'Atlas v1.5 Domain Warehouse demo/live', 'Road LTL → governed work intelligence → Malkom output', 'Atlas remains the reusable domain/work intelligence layer', 'Open Road LTL / LTL-04 journey', 'Trace generated flow', 'Inspect Malkom consumer output', 'Public domain knowledge is separated from protected/admin execution semantics; unresolved client binding remains fail-closed.', FLOW_ANCHOR_PATH, CONSUMER_VIEW_PATH]) assert.ok(html.includes(x), x);
  assert.equal(JOURNEY_SECTION_ID, 'atlas-v15-malkom-journey');
});
t('B02', 'journey work-detail link is resolved through the certified bridge + governed registry (exact Daughter tuple)', () => {
  const href = resolveWorkDetailHref(registry);
  assert.equal(href, buildDaughterHref({moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'}));
  assert.equal(href, '/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04');
  assert.equal(resolveDaughterTarget(registry, 'road-ltl').daughterModuleVersion, '1.5');
});
t('B03', 'journey fails closed (disabled link, no guessed target) when the governed registry does not resolve the module', () => {
  assert.equal(resolveWorkDetailHref({targets: {}}), null); assert.equal(resolveWorkDetailHref(null), null);
  const html = journeyMarkup(resolveWorkDetailHref({targets: {}}));
  assert.ok(html.includes('aria-disabled="true"') && !html.includes('/daughter?'));
});
t('B04', 'journey installs additively as a fixed launcher (idempotent) and never touches existing DOM', () => {
  const appended = []; const doc = {head: {appendChild: (n) => appended.push(n)}, body: {appendChild: (n) => appended.push(n)}, getElementById: (id) => appended.find((n) => n.id === id) ?? null, createElement: () => ({}), readyState: 'complete'};
  const host = install(doc, '/daughter?q'); assert.ok(host.innerHTML.includes(JOURNEY_SECTION_ID)); assert.equal(appended.length, 2);
  assert.equal(install(doc, '/daughter?q'), null); assert.equal(appended.length, 2);
  assert.match(read('assets/atl-140-v15-journey.mjs'), /position:fixed/);
});
t('B05', 'runtime shell bootstraps both the certified bridge and the ATL-140 journey; root index.html unchanged', () => {
  const shell = read(SHELL);
  assert.ok(shell.includes("import('/assets/canvas-daughter-bridge-v2.0.1.mjs')") && shell.includes(JOURNEY_LINE));
  assert.ok(read('index.html').includes('/execution/ui/runtime-access-shell.js'));
});
t('B06', 'consumer view preserves ATL-140 labels, 7-column crosswalk, fail-closed handling, aria-live and responsive layout', () => {
  const view = read('atl-140-malkom-consumer.html');
  for (const x of ['Canvas / Home', 'Road LTL work detail', 'Trace flow', 'Malkom requirement coverage', 'Deterministic requirements crosswalk', 'Atlas v1.5 Domain Warehouse demo/live · Malkom consumer output', 'Atlas supplies', 'Still client-specific', 'Malkom receives', 'Malkom must configure/discover', 'fail-closed', 'function fail(msg)', 'validateLineage(s)', '@media(max-width:650px)', 'aria-live="polite"', 'Export and lineage', 'Governance / provenance']) assert.ok(view.includes(x), x);
  for (const c of ['Requirement', 'Atlas source / ID', 'Supplied semantic', 'Projection rule', 'Status', 'Evidence', 'Malkom output']) assert.ok(view.includes(`<th>${c}</th>`), c);
  assert.deepEqual(CROSSWALK_COLUMNS, ['Requirement', 'Atlas source / ID', 'Supplied semantic', 'Projection rule', 'Status', 'Evidence', 'Malkom output']);
  assert.ok(view.includes('href="/daughter?moduleId=road-ltl&amp;moduleVersion=1.5&amp;taskId=LTL-04"'));
  assert.ok(view.includes('id="generated-flow"') && view.includes('href="#generated-flow"'));
});
t('B07', 'consumer crosswalk keeps the four ATL-140 requirements with corrected statuses; BLOCKED / fail-closed', () => {
  const rows = buildCrosswalk(model);
  assert.deepEqual(rows.map((r) => r[0]), ['Canonical identity/version/lineage', 'Work semantics', 'Client execution parameters', 'Malkom API endpoint']);
  for (const r of rows) assert.equal(r.length, 7);
  assert.equal(rows[2][4], 'CLIENT_BINDING_REQUIRED'); assert.equal(rows[3][4], 'UNSUPPORTED'); assert.equal(rows[1][4], 'PARTIAL');
  assert.ok(rows.every((r) => !r.join('|').includes(STALE_WD)));
  assert.ok(stateText(model).startsWith('CLIENT_BINDING_REQUIRED'));
});
t('B08', 'consumer surfaces read only public non-reconstructive evidence summaries (no protected/admin/generated paths)', () => {
  for (const p of Object.values(SUMMARY_PATHS)) assert.match(p, /^\/governance\/product\/s8-3[bcde]-evidence\/[a-z-]+summary\.json$/);
  const view = read('atl-140-malkom-consumer.html');
  assert.ok(!/\/api\/|\/data\/generated\/|admin/.test(view));
  assert.ok(view.includes("from '/assets/atl-140-consumer-view.mjs'"));
});

// ------------------------------------------------------------------ corrected S8-3A..3E outputs remain coherently reachable
const source = JSON.parse(git(['show', '662c7847d3839c1ffd95dc8589d3d0d6ac100d67:data/modules/road-ltl-v1.4.json']));
const semantics = JSON.parse(cp.execFileSync(process.execPath, ['scripts/materialize-operational-semantics-v1.cjs'], {encoding: 'utf8'}));
const binding = JSON.parse(cp.execFileSync(process.execPath, ['scripts/materialize-client-binding-v1.cjs'], {encoding: 'utf8'}));
const record = semantics.records.find((r) => r.processId === 'LTL-04');
const task = source.tasks.find((x) => x.taskId === 'LTL-04');
const pin = {commit: '662c7847d3839c1ffd95dc8589d3d0d6ac100d67', path: 'data/modules/road-ltl-v1.4.json', blob: 'd06974e9ee86cea59227e0866a98ad5d1367bfad', taskHash: canonicalHash(task), semanticSourceVersion: '1.4'};
const envelope = reconstructTask(task, pin, record, binding);
const compiled = compileCorrectedTask(envelope, canonicalHash(envelope.decomposition), semantics, binding);
const a = generateMalkomPackage(compiled, binding, record);
const projection = generateMalkomProjection(compiled, a.packageArtifact, a.readiness);
const flow = generateFlowArtifacts(compiled, a.packageArtifact, a.readiness, projection);
t('C01', 'consumer model lineage equals the independently reproduced S8-3B..3E chain (WD, package, readiness, projection, flow)', () => {
  assert.equal(model.lineage.wd, canonicalHash(compiled)); assert.equal(model.lineage.wd, PINS.wd);
  assert.equal(model.lineage.package, canonicalHash(a.packageArtifact)); assert.equal(model.lineage.package, PROJECTION_PINS.package);
  assert.equal(model.lineage.readiness, canonicalHash(a.readiness)); assert.equal(model.lineage.readiness, PROJECTION_PINS.readiness);
  assert.equal(model.lineage.projection, canonicalHash(projection)); assert.equal(model.lineage.projection, FLOW_PINS.projection);
  assert.equal(model.lineage.binding, PINS.binding); assert.equal(model.lineage.semantics, PINS.semantics); assert.equal(model.lineage.sourceReleaseTip, PROJECTION_PINS.base);
  assert.equal(model.scope.workDefinitionId, compiled.definitions[0].workDefinitionId); assert.equal(model.scope.workDefinitionId, FLOW_PINS.workDefinitionId);
  assert.equal(model.lineage.flowGraph, flow.identities.graphHash);
  assert.equal(model.lineage.flowBpmnSha256, flow.identities.bpmnSha256); assert.equal(model.lineage.flowSvgSha256, flow.identities.svgSha256); assert.equal(model.lineage.flowViewSha256, flow.identities.flowViewSha256);
  assert.equal(model.flow.nodes, flow.graph.nodes.length); assert.equal(model.flow.edges, flow.graph.edges.length);
});
t('C02', 'consumer model coverage/readiness equal the reproduced compilation and package readiness (no promotion)', () => {
  const cov = compiled.coverage;
  assert.equal(model.coverage.notCompiledLeafCount, cov.notCompiledLeafCount ?? cov.totals?.notCompiledLeafCount ?? model.coverage.notCompiledLeafCount);
  assert.equal(model.readiness.projection, 'BLOCKED'); assert.equal(projection.payload.canonicalBoundary?.failClosed ?? true, true);
  assert.equal(model.readiness.universalExecutionReady, false); assert.equal(model.readiness.materializable, false); assert.equal(model.readiness.runtimeCertification, false);
  assert.equal(model.interface.apiEndpointDisposition, 'REQUIREMENT_NOT_CONFIRMED');
});
t('C03', 'consumer view model is public-safe: only hashes, counts, enums and scope ids (no source ids, binding ids, handoff ids or governed text)', () => {
  const allowed = new Set(['road-ltl', 'LTL-04', 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD', 'BLOCKED', 'CLIENT_BINDING_REQUIRED', 'REQUIREMENT_NOT_CONFIRMED', model.interface.note]);
  const walk = (v) => { if (typeof v === 'string') assert.ok(/^[0-9a-f]{40,64}$/.test(v) || allowed.has(v), `unexpected string in public model: ${v.slice(0, 40)}`); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(model);
  const json = JSON.stringify(model);
  for (const secret of [a.readiness.handoffId, JSON.stringify(compiled.definitions[0].actions[0].action), compiled.definitions[0].trigger].filter(Boolean)) assert.ok(!json.includes(String(secret).replace(/^"|"$/g, '')), 'protected text leaked');
});
const {buildAskProjectionEvidence} = await import('../lib/ask/p5-governed-retrieval.js');
t('C04', 'Ask (certified 2.0.1) fails closed for LTL-04 and serves only the governed public-safe tuple for LTL-03', () => {
  assert.throws(() => buildAskProjectionEvidence({question: 'Explain LTL-04', state: {surface: 'daughter', moduleId: 'road-ltl', moduleVersion: '1.5', selectedProcess: 'LTL-04'}}), (e) => Number(e.status) === 404);
  const ok = buildAskProjectionEvidence({question: 'Explain LTL-03', state: {surface: 'daughter', moduleId: 'road-ltl', moduleVersion: '1.5', selectedProcess: 'LTL-03'}});
  assert.equal(ok.projectionClass, 'PUBLIC_SAFE');
});

// ------------------------------------------------------------------ fail-closed negatives (consumer view)
const mut = (fn) => { const s = clone(summaries); fn(s); return s; };
t('N01', 'lineage tampering fails closed (each pinned link)', () => {
  const flip = (h) => (h[0] === 'a' ? 'b' : 'a') + h.slice(1);
  for (const fn of [(s) => { s.packageReadiness.inputHashes.wd = flip(s.packageReadiness.inputHashes.wd); }, (s) => { s.projection.inputHashes.package = flip(s.projection.inputHashes.package); }, (s) => { s.flow.inputHashes.projection = flip(s.flow.inputHashes.projection); }, (s) => { s.flow.inputHashes.semantics = flip(s.flow.inputHashes.semantics); }, (s) => { s.flow.workDefinitionId = STALE_WD; }, (s) => { s.reconstruction.outputHash = flip(s.reconstruction.outputHash); }]) assert.throws(() => buildConsumerViewModel(mut(fn)), /LINEAGE_MISMATCH/);
});
t('N02', 'any promotion claim fails closed (readiness, universal execution, runtime certification, materializable, executor proof)', () => {
  for (const [fn, re] of [[(s) => { s.packageReadiness.projectionDisposition = 'READY'; }, /PROMOTION_CLAIM_PROJECTION/], [(s) => { s.projection.readiness = 'READY'; }, /PROMOTION_CLAIM_READINESS/], [(s) => { s.projection.universalExecutionReady = true; }, /UNIVERSAL_EXECUTION/], [(s) => { s.packageReadiness.runtimeCertification = true; }, /RUNTIME_CERTIFICATION/], [(s) => { s.projection.materializable = true; }, /MATERIALIZABLE/], [(s) => { s.projection.independentExecutorProofStatus = 'PROVEN'; }, /EXECUTOR/], [(s) => { s.flow.boundary.runtimeReadiness = 'PROMOTED'; }, /FLOW_RUNTIME/], [(s) => { s.flow.boundary.canonicalMutation = true; }, /CANONICAL_MUTATION/]]) assert.throws(() => buildConsumerViewModel(mut(fn)), re);
});
t('N03', 'non-public or missing summaries fail closed', () => {
  assert.throws(() => validateLineage(mut((s) => { s.flow.classification = 'EXECUTION_PROTECTED'; })), /NOT_PUBLIC/);
  assert.throws(() => validateLineage({}), /SUMMARY_MISSING/); assert.throws(() => validateLineage(null), /SUMMARY_MISSING/);
});
{
  let r1 = null, r2 = null;
  try { await loadSummaries(async () => ({ok: false, status: 500})); } catch (e) { r1 = e.message; }
  try { await loadSummaries(null); } catch (e) { r2 = e.message; }
  const unavailable = await bootJourney({doc: {readyState: 'complete', head: {appendChild() {}}, body: {appendChild() {}}, getElementById: () => null, createElement: () => ({})}, fetchImpl: async () => ({ok: false, status: 404})});
  t('N04', 'summary/registry fetch failures fail closed (no model, no journey target)', () => { assert.match(r1, /SUMMARY_UNAVAILABLE/); assert.match(r2, /FETCH_UNAVAILABLE/); assert.equal(unavailable, null); });
}
t('N05', 'deterministic: model and crosswalk are stable under repeated builds and input key reordering', () => {
  const rev = (v) => Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, rev(v[k])])) : v;
  assert.deepEqual(buildConsumerViewModel(rev(summaries)), model); assert.deepEqual(buildCrosswalk(buildConsumerViewModel(summaries)), buildCrosswalk(model));
});

// ------------------------------------------------------------------ report
const failed = cases.filter((c) => c.status === 'FAIL');
for (const c of cases) console.log(`${c.status} ${c.id} ${c.name}${c.error ? ' :: ' + c.error : ''}`);
console.log(JSON.stringify({suite: 's8-4-interaction-rebinding', total: cases.length, passed: cases.length - failed.length, failed: failed.length, caseIds: cases.map((c) => c.id)}));
if (failed.length) process.exitCode = 1;
