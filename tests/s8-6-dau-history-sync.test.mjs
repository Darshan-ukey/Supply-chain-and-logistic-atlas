import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {HISTORY_SYNC_SCHEMA, HISTORY_STATE_KEY, VIEW_FIELDS, sanitizeView, viewKey, buildEnvelope, parseEnvelope, validateView, buildApplyInput, stablePin, isAtlasRoot, installHistorySync, HistoryStateRejection} from '../assets/atl-s8-history-sync.mjs';
import {startRaceProbeServer, withoutRootLoadRace, loadRaceTally, LOAD_RACE_MESSAGE, launch, startStaticServer, openAtlas, snapshot, govState, settle, activateRoadLtl, selectA3, setLevel, selectProcess, reach, expectedState, STATES, reloadAndSettle, back, forward, waitForGov, waitActiveSync, firstProcessOf, chromiumExecutable} from './s8-6-support/atlas-browser.mjs';

// S8-6 DAU-007 / DAU-006 bounded remediation: governed in-app history registration + restoration synchronization.
// PASS means only that bounded navigation capability on the corrected successor lineage; it is not runtime/release readiness.
const root = process.cwd();
const BASE = '97e3086daa7b1ca694d019f0f30bb2c3150e7a6d';
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}).trim();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
import crypto from 'node:crypto';
const HISTORY_MODULE_BLOB = '52631ec3628a2cf40509f4672a482ca5b2bf8bc3', HISTORY_MODULE_SHA256 = '09602b7a70f402e8f2282e46c1bf033cea59f77db9fcc7c4b0f3785248bd9039';
const JOURNEY_SUCCESSOR_BLOB = '74bc1919ae6904a3feb8ea115ab9040911055b7f', JOURNEY_SUCCESSOR_SHA256 = 'd7106bc7e4c560e3da7a3e465208aecd2e0e94db1abceb9badf9ec11f35cb402';
const shaOf = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const blobOf = (p) => git(['hash-object', p]);
const baseBlob = (p) => git(['rev-parse', `${BASE}:${p}`]);
const results = [];
const queue = [];
const ONLY = process.env.S8_6_ONLY ? new RegExp(process.env.S8_6_ONLY) : null;
const run = async (id, name, fn) => { const label = `${id} ${name}`; try { await fn(); results.push({id, ok: true}); console.log(`PASS ${label}`); } catch (e) { results.push({id, ok: false}); console.log(`FAIL ${label}\n  ${String(e.message).split('\n').slice(0, process.env.S8_6_VERBOSE ? 40 : 6).join('\n  ')}`); } };
const test = (id, name, fn) => { queue.push({id, name, fn, browser: false}); };
const btest = (id, name, fn) => { queue.push({id, name, fn, browser: true}); };
const clone = (v) => structuredClone(v);
// The certified root (unchanged, byte-identical) has one pre-existing init-order defect: deep-link/last-session restore runs before the V1.5 layers exist and throws this exact ReferenceError.
// It is tolerated ONLY as that exact message; every other page error still fails the case (the consumer-page case C01 stays strict).
const KNOWN_ROOT_INIT_ERROR = 'stage15RenderContract is not defined';
const attach = (errs, list) => { Object.defineProperty(list, 'stacks', {value: errs.stacks ?? [], enumerable: false}); return list; };
const strictErrors = (errs) => { const u = attach(errs, withoutRootLoadRace(errs)); if (u.length && errs.stacks) console.log('PAGEERROR STACKS\n' + errs.stacks.join('\n---\n').split('\n').slice(0, 160).join('\n')); return [...u]; };
const unexpectedErrors = (errs) => { const u = strictErrors(errs).filter((e) => e !== KNOWN_ROOT_INIT_ERROR); return u; };

// ------------------------------------------------------------------ fixtures for unit validation (shape of the loaded Road LTL module)
const MOD = {a3Parents: [{id: 'a3-commercial-commitment', page0DomainId: 'commercial'}, {id: 'a3-origin-terminal', page0DomainId: 'origin'}], processes: [{id: 'LTL-01', a3ParentId: 'a3-commercial-commitment'}, {id: 'LTL-05', a3ParentId: 'a3-origin-terminal'}]};
const PIN = {registrySchemaVersion: '1.1.4', page0: {id: 'ecosystem-page-0', version: '6.2.2'}, dataContractVersion: 'atlas-data-contract-v1.1', module: {id: 'road-ltl', version: '1.5', sha256: 'a'.repeat(64)}, overlays: [], capturedAt: '2026-10-04T00:00:00.000Z'};
const APP = {registryHas: (id) => ['road-ltl', 'ocean-fcl', 'ecosystem-page-0'].includes(id), isLoaded: (id) => (id === 'road-ltl' ? MOD : null), domainIds: () => new Set(['commercial', 'origin', 'plan']), currentPin: () => ({...PIN, capturedAt: '2030-01-01T00:00:00.000Z'})};
const captureOf = (o = {}) => ({schema: 'atlas-view-state-v0.1', atlasModule: 'road-ltl', coveragePreview: null, primary: 'execute', depth: 'a4', selectedDomain: null, selectedA3: 'a3-commercial-commitment', selectedProcess: 'LTL-01', moduleVersion: '1.5', dataContractVersion: 'atlas-data-contract-v1.1', governancePin16: clone(PIN), playback: {enabled: false}, trace: {enabled: false}, context: {role: 'x'}, lens: {enabled: false}, ...o});
const envOf = (o = {}, level = 2) => ({schema: HISTORY_SYNC_SCHEMA, level, view: sanitizeView(captureOf(o))});
const valid = (o, level, opts = {}) => validateView(sanitizeView(captureOf(o)), level, APP, opts);
const SAMPLE = (s) => ({U: {atlasModule: null, depth: 'domain', selectedA3: null, selectedProcess: null}, M: {depth: 'a3', selectedA3: null, selectedProcess: null}, A: {depth: 'a3', selectedProcess: null}, B: {selectedProcess: null}, C: {}, D: {}, E: {selectedA3: 'a3-origin-terminal', selectedProcess: 'LTL-05'}, F: {atlasModule: null, depth: 'domain', selectedA3: null, selectedProcess: null, selectedDomain: 'commercial'}, G: {depth: 'domain', selectedA3: null, selectedProcess: null}}[s]);

// ===================================================================== U: unit (pure module logic)
test('U01', 'schema, key and allow-listed view fields are the governed navigation projection only', () => {
  assert.equal(HISTORY_SYNC_SCHEMA, 'atlas-s8-history-sync-v1'); assert.equal(HISTORY_STATE_KEY, 'atlasS8HistorySync');
  assert.deepEqual([...VIEW_FIELDS].sort(), ['atlasModule', 'coveragePreview', 'dataContractVersion', 'depth', 'governancePin16', 'moduleVersion', 'primary', 'schema', 'selectedA3', 'selectedDomain', 'selectedProcess']);
});
test('U02', 'sanitizeView drops every non-allow-listed capture field (context, lens, playback, trace, protected extras)', () => {
  const v = sanitizeView(captureOf({workDefinition: {wd: 'x'}, malkomPackage: 'p', readiness: {a: 1}, clientValues: {k: 'v'}, bpmn: '<bpmn/>', token: 't'}));
  assert.deepEqual(Object.keys(v).sort(), [...VIEW_FIELDS].sort());
  const s = JSON.stringify(v); for (const bad of ['workDefinition', 'malkomPackage', 'readiness', 'clientValues', 'bpmn', 'token', 'playback', 'context', 'lens', 'trace']) assert.ok(!s.includes(bad), bad);
});
test('U03', 'buildEnvelope is exactly {schema, level, view}', () => { const e = buildEnvelope(captureOf(), 2); assert.deepEqual(Object.keys(e).sort(), ['level', 'schema', 'view']); assert.equal(e.level, 2); });
test('U04', 'parseEnvelope accepts a valid written envelope round-trip', () => { const e = buildEnvelope(captureOf(), 2); const p = parseEnvelope(e); assert.ok(p.ok); assert.equal(p.level, 2); assert.equal(p.view.selectedProcess, 'LTL-01'); });
test('U05', 'parseEnvelope rejects unknown keys at envelope and view level', () => {
  assert.equal(parseEnvelope({...envOf(), extra: 1}).code, 'HISTORY_STATE_UNKNOWN_KEY');
  const e = envOf(); e.view.workDefinition = 'x'; assert.equal(parseEnvelope(e).code, 'HISTORY_STATE_UNKNOWN_KEY');
});
test('U06', 'parseEnvelope rejects incomplete and non-object state', () => {
  const e = envOf(); delete e.view.selectedA3; assert.equal(parseEnvelope(e).code, 'INCOMPLETE_STATE');
  for (const bad of [null, 'x', 7, [], {}, {schema: 'nope'}, {schema: HISTORY_SYNC_SCHEMA}]) assert.equal(parseEnvelope(bad).ok, false);
});
test('U07', 'parseEnvelope rejects protected-looking values (never strips and continues)', () => {
  for (const [k, v] of [['selectedProcess', 'wd::road-ltl::LTL-04::v1'], ['atlasModule', 'bpmn'], ['selectedA3', 'malkom-dw::road-ltl::LTL-04::v1'], ['selectedDomain', '<svg/>']]) { const e = envOf(); e.view[k] = v; const r = parseEnvelope(e); assert.equal(r.ok, false, k); }
  const e2 = envOf(); e2.view.selectedProcess = 'LTL-01 secret'; assert.equal(parseEnvelope(e2).ok, false);
  const e3 = envOf(); e3.view.selectedProcess = 'api-key'; assert.equal(parseEnvelope(e3).code, 'PROTECTED_CONTENT_REJECTED');
});
test('U08', 'parseEnvelope rejects invalid depth, level and primary', () => {
  const d = envOf(); d.view.depth = 'zz'; assert.equal(parseEnvelope(d).code, 'INVALID_DEPTH');
  for (const lvl of [-1, 4, 1.5, '2', null]) assert.equal(parseEnvelope({...envOf(), level: lvl}).code, 'INVALID_LEVEL');
  const p = envOf(); p.view.primary = 'transform'; assert.equal(parseEnvelope(p).ok, false);
});
test('U09', 'every governed critical state validates against the canonical module (U,M,A,B,C,D,E,F,G)', () => {
  const levels = {U: 0, M: 1, A: 1, B: 2, C: 2, D: 3, E: 2, F: 0, G: 0};
  for (const s of Object.keys(levels)) { const r = valid(SAMPLE(s), levels[s], {checkPin: true}); assert.ok(r.ok, `${s}: ${r.code} ${r.detail}`); }
});
test('U10', 'canonical validation fails closed: unknown/unsupported module, A3, process, domain, mismatch', () => {
  assert.equal(valid({atlasModule: 'nope'}, 2).code, 'UNSUPPORTED_MODULE');
  assert.equal(valid({atlasModule: 'ocean-fcl'}, 2).code, 'UNSUPPORTED_MODULE');
  assert.equal(valid({atlasModule: 'ecosystem-page-0'}, 2).code, 'UNSUPPORTED_MODULE');
  assert.equal(valid({selectedA3: 'a3-nope', selectedProcess: null}, 2).code, 'UNKNOWN_A3');
  assert.equal(valid({selectedProcess: 'LTL-99'}, 2).code, 'UNKNOWN_PROCESS');
  assert.equal(valid({selectedProcess: 'LTL-05'}, 2).code, 'PROCESS_A3_MISMATCH');
  assert.equal(valid({depth: 'a3', selectedProcess: null, selectedDomain: 'nope'}, 1).code, 'UNKNOWN_DOMAIN');
  assert.equal(valid({coveragePreview: 'ocean-fcl'}, 2).code, 'UNSUPPORTED_CONTEXT');
  assert.equal(valid({coveragePreview: 'ocean-fcl'}, 2, {allowCoverage: true}).ok, true);
  assert.equal(valid({coveragePreview: 'nope'}, 2, {allowCoverage: true}).code, 'UNSUPPORTED_CONTEXT');
});
test('U11', 'canonical validation fails closed: incomplete / incoherent depth-level states', () => {
  assert.equal(valid({selectedA3: null, selectedProcess: null}, 2).code, 'INCOMPLETE_STATE'); // A4 without A3
  assert.equal(valid({atlasModule: null, selectedA3: 'a3-commercial-commitment'}, 1).code, 'INCOMPLETE_STATE');
  assert.equal(valid({selectedProcess: null}, 3).code, 'INCOMPLETE_STATE'); // A5 needs a process
  assert.equal(valid({depth: 'a3', selectedProcess: null}, 2).code, 'INVALID_LEVEL');
  assert.equal(valid({depth: 'a4'}, 1).code, 'INVALID_LEVEL');
  assert.equal(valid({atlasModule: null, depth: 'a4', selectedA3: null, selectedProcess: null}, 2).code, 'INVALID_DEPTH');
  assert.equal(valid({depth: 'domain', selectedProcess: null}, 0).code, 'INCOMPLETE_STATE');
  assert.equal(valid({depth: 'bogus'}, 2).code, 'INVALID_DEPTH');
  assert.equal(valid({}, 9).code, 'INVALID_LEVEL');
});
test('U12', 'stale/missing version pin fails closed; the capture clock is ignored', () => {
  assert.ok(valid({}, 2, {checkPin: true}).ok);
  assert.equal(valid({governancePin16: {...clone(PIN), dataContractVersion: 'atlas-data-contract-v0.9'}}, 2, {checkPin: true}).code, 'STALE_VERSION');
  assert.equal(valid({governancePin16: {...clone(PIN), module: {id: 'other-module', version: '1.4'}}}, 2, {checkPin: true}).code, 'STALE_VERSION');
  assert.equal(valid({governancePin16: {...clone(PIN), registrySchemaVersion: 'atlas-registry-v0.0'}}, 2, {checkPin: true}).code, 'STALE_VERSION');
  assert.ok(valid({governancePin16: {...clone(PIN), module: {id: 'road-ltl', version: '1.4', sha256: 'a'.repeat(64)}, capturedAt: 'later'}}, 2, {checkPin: true}).ok, 'module-level staleness is delegated to the root version gate');
  assert.equal(valid({governancePin16: null}, 2, {checkPin: true}).code, 'STALE_VERSION');
  assert.deepEqual(stablePin({a: 1, capturedAt: 'x'}), {a: 1});
  assert.throws(() => stablePin({'bad key!': 1}), HistoryStateRejection);
});
test('U13', 'A3, A4 (no process) and process are distinct history keys; idempotent renders share a key', () => {
  const k = (o, l) => viewKey(sanitizeView(captureOf(o)), l);
  const A = k({depth: 'a3', selectedProcess: null}, 1), B = k({selectedProcess: null}, 2), C = k({}, 2), D = k({}, 3), M = k({depth: 'a3', selectedA3: null, selectedProcess: null}, 1), U = k({atlasModule: null, depth: 'domain', selectedA3: null, selectedProcess: null}, 0), G = k({depth: 'domain', selectedA3: null, selectedProcess: null}, 0);
  assert.equal(new Set([A, B, C, D, M, U, G]).size, 7);
  assert.equal(k({}, 2), k({governancePin16: null, moduleVersion: '9'}, 2));
});
test('U14', 'buildApplyInput = allow-listed view + idle working surfaces only', () => {
  const a = buildApplyInput(captureOf({context: {role: 'x'}}));
  assert.equal(a.playback.enabled, false); assert.equal(a.trace.enabled, false); assert.equal(a.transform.enabled, false); assert.equal(a.compare.enabled, false);
  assert.ok(!('context' in a) && !('lens' in a) && !('variantExecution' in a));
  assert.equal(a.selectedProcess, 'LTL-01');
});
test('U15', 'no-op where the Atlas root navigation model is absent (consumer page, Node)', () => {
  assert.equal(isAtlasRoot({}), false); assert.equal(isAtlasRoot(null), false);
  assert.equal(installHistorySync(globalThis), null); assert.equal(installHistorySync({document: {documentElement: {dataset: {}}}}), null);
  const win = {document: {documentElement: {dataset: {}}}}; installHistorySync(win); assert.equal(win.document.documentElement.dataset.atlasHistorySync, 'inactive-non-root'); assert.equal(win.AtlasS8HistorySync, undefined);
});
test('U16', 'module source: no network/storage/eval, no imports, no ATL-142 controller, no protected content handling', () => {
  const src = read('assets/atl-s8-history-sync.mjs');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/^import\s/m.test(code), 'self-contained module');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'eval(', 'new Function', 'document.cookie', 'navigator.sendBeacon']) assert.ok(!code.includes(bad), bad);
  for (const bad of ['stage11HistoryState', 'stage11HistoryWrite', 'stage11HistoryWrap']) assert.ok(!src.includes(bad), `ATL-142 controller token ${bad}`);
  assert.ok(!/atlasViewState/.test(src), 'ATL-142 history key');
});
test('U17', 'journey loads the module additively and installs it exactly once, before the registry/UI work', () => {
  const j = read('assets/atl-140-v15-journey.mjs');
  assert.equal((j.match(/atl-s8-history-sync\.mjs/g) ?? []).length, 1);
  assert.equal((j.match(/installHistorySync\(globalThis\)/g) ?? []).length, 1);
  assert.ok(j.indexOf('installHistorySync(globalThis)') < j.indexOf('loadRegistry(fetchImpl)'));
  const added = git(['diff', BASE, '--', 'assets/atl-140-v15-journey.mjs']).split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  assert.equal(added.filter((l) => l.startsWith('-')).length, 0, 'journey change is purely additive');
  assert.equal(added.filter((l) => l.startsWith('+')).length, 3, 'journey change is exactly three added lines');
});

// ===================================================================== I: identity preservation
const PINS = {
  'index.html': '043802523b1618c143a0e78b88bbfb2afaa7c7dd',
  'execution/ui/runtime-access-shell.js': 'e65e98b9a0f57acfb9abfd7633fcada4671a9084',
  'assets/canvas-daughter-bridge-v2.0.1.mjs': '264e4ed26f112845bd4afb3d1e990138971d13fe',
  'canvas-v2/canvas-v2/index.html': '4dfa0a8410eba303ba7dad73a5cee6431dfe3258',
  'canvas-v2/canvas-v2/assets/canvas-v2.css': '860c878491479b40c1a71c8530d2f1725564341b',
  'canvas-v2/canvas-v2/assets/canvas-v2.js': '672dd1b5a1eb8c3c1698fae436fa0b3db53cd5d0',
  'canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md': 'cff249802d6d61db395bf8d0a3587fafad26da67',
  'runtime/universal-ask-atlas.js': '521c47a3956c81367bab942a657f998d576ff15f',
  'lib/api/ask-atlas.js': '8fa80f9dd0b733a523aed6970269f5f32d5e64da',
  'governance/ask-atlas-surface-contract-v1.json': '608956d30ea89859e9e649457debb73d267e04cd',
  'lib/ask/p5-governed-retrieval.js': '6f3c29dcbdf0ee60a694cd2f7ac7c9e521367a00',
  'ATLAS_V2.0.1_UNIVERSAL_ASK_CERTIFICATION.md': 'd0dfd8b2e4343f7ea86af249407e33f158267959',
  'assets/atl-140-consumer-view.mjs': 'fc20076a892356a84b0b80c285bc263bf4484c9a',
  'atl-140-malkom-consumer.html': '8a2739c4482824a52bdf7c49b1852815b6d75c0f',
  'daughter.html': 'd55cec5389e42e28ea9d9991b26c740661546f5c',
  'api/atlas.js': '60dcb85999eed6d1bbc67e52b7ef6c3667cd5709',
  'assets/atl-167-v15-deepen-inspect.mjs': null,
  'lib/api/governed-depth-summary.js': null,
  'lib/projections/governed-depth-summary.js': null
};
test('I01', 'root index.html is byte-identical to the certified root (not ATL-140/ATL-142)', () => { assert.equal(blobOf('index.html'), PINS['index.html']); assert.equal(baseBlob('index.html'), PINS['index.html']); for (const stale of ['9cf88a867359ba33ebfbe85c1360f0ab21bc29b3', '379f988ce807f33dc8fd43b49b227b917a15b8c0']) assert.notEqual(blobOf('index.html'), stale); });
test('I02', 'runtime shell is byte-identical', () => assert.equal(blobOf('execution/ui/runtime-access-shell.js'), PINS['execution/ui/runtime-access-shell.js']));
test('I03', 'Canvas→Daughter bridge and Canvas V2.0 donor assets are byte-identical', () => { for (const p of ['assets/canvas-daughter-bridge-v2.0.1.mjs', 'canvas-v2/canvas-v2/index.html', 'canvas-v2/canvas-v2/assets/canvas-v2.css', 'canvas-v2/canvas-v2/assets/canvas-v2.js', 'canvas-v2/canvas-v2/FREEZE_CERTIFICATE.md']) assert.equal(blobOf(p), PINS[p], p); });
test('I04', 'Universal Ask 2.0.1 certified identities are byte-identical (runtime, API, contract, retrieval, certification)', () => { for (const p of ['runtime/universal-ask-atlas.js', 'lib/api/ask-atlas.js', 'governance/ask-atlas-surface-contract-v1.json', 'lib/ask/p5-governed-retrieval.js', 'ATLAS_V2.0.1_UNIVERSAL_ASK_CERTIFICATION.md']) assert.equal(blobOf(p), PINS[p], p); });
test('I05', 'consumer view/page, Daughter page and S8-5B router identity are unchanged by the history fix', () => { for (const p of ['assets/atl-140-consumer-view.mjs', 'atl-140-malkom-consumer.html', 'daughter.html', 'api/atlas.js']) assert.equal(blobOf(p), PINS[p], p); });
test('I06', 'S8-5B product files and the Daughter renderer are unchanged vs the S8-5B base', () => { for (const p of ['assets/atl-167-v15-deepen-inspect.mjs', 'lib/api/governed-depth-summary.js', 'lib/projections/governed-depth-summary.js', 'assets/universal-daughter-renderer-v2.js']) assert.equal(blobOf(p), baseBlob(p), p); });
test('I07', 'protected S8-3B/C/D/E public derivative evidence and generators are unchanged vs the base', () => {
  const tracked = git(['ls-tree', '-r', '--name-only', BASE, '--', 'governance/product/s8-3b-evidence', 'governance/product/s8-3c-evidence', 'governance/product/s8-3d-evidence', 'governance/product/s8-3e-evidence', 'lib/compile', 'data/modules', 'data/operational-knowledge']).split('\n').filter(Boolean);
  assert.ok(tracked.length > 20);
  for (const p of tracked) assert.equal(blobOf(p), baseBlob(p), p);
});
test('I08', 'forbidden product paths are not touched (root, shell, Canvas, bridge, Ask, router, data) — only journey + history module', () => {
  const changed = git(['diff', '--name-only', '--no-renames', BASE]).split('\n').filter(Boolean).concat(git(['ls-files', '-o', '--exclude-standard']).split('\n').filter(Boolean));
  const forbidden = [/^index\.html$/, /^execution\//, /^canvas-v2\//, /^assets\/canvas-daughter-bridge/, /^runtime\//, /^lib\/(ask|api\/ask-atlas)/, /^ATLAS_V2\.0\.1/, /^api\//, /^daughter\.html$/, /^atl-140-malkom-consumer\.html$/, /^assets\/atl-140-consumer-view\.mjs$/, /^assets\/atl-167-/, /^assets\/universal-daughter/, /^data\//, /^lib\/(compile|projections)\//, /^vercel\.json$/];
  for (const p of changed) for (const f of forbidden) assert.ok(!f.test(p), `forbidden path changed: ${p}`);
});
test('I09', 'successor identities are pinned: history module blob/sha256 and the successor journey blob/sha256', () => {
  const sha = (p) => cp.createHash ? null : null;
  assert.equal(blobOf('assets/atl-s8-history-sync.mjs'), HISTORY_MODULE_BLOB);
  assert.equal(blobOf('assets/atl-140-v15-journey.mjs'), JOURNEY_SUCCESSOR_BLOB);
  assert.equal(shaOf('assets/atl-s8-history-sync.mjs'), HISTORY_MODULE_SHA256);
  assert.equal(shaOf('assets/atl-140-v15-journey.mjs'), JOURNEY_SUCCESSOR_SHA256);
  assert.equal(baseBlob('assets/atl-140-v15-journey.mjs'), '6c11bf4c89eaf212004beab7a939fd4cda38477c');
});

// ===================================================================== B: browser (DAU-007 / DAU-006)
let browser = null, server = null, origin = null;
const E = {U: STATES.U, M: STATES.M, A: STATES.A, B: STATES.B, C: STATES.C, D: STATES.D};
async function transcript(page) {
  const steps = [];
  const rec = async (label) => { const s = await snapshot(page); steps.push({label, ...(({module, a3, process, depth, level}) => ({module, a3, process, depth, level}))(s), hist: s.hist, histLen: s.histLen}); };
  await rec('1 loaded');
  await activateRoadLtl(page); await rec('2 Road LTL');
  await selectA3(page); await rec('3 commercial A3');
  await setLevel(page, 2); await rec('4 slider A4');
  await selectProcess(page, 'LTL-01'); await rec('5 LTL-01');
  await back(page); await waitForGov(page, E.B); await rec('6 Back -> A4 (no process)');
  await forward(page); await waitForGov(page, E.C); await rec('7 Forward -> LTL-01');
  await back(page); await waitForGov(page, E.B); await rec('8 Back -> A4 again');
  await forward(page); await waitForGov(page, E.C); await rec('9 Forward -> LTL-01');
  await reloadAndSettle(page); await rec('10 refresh at LTL-01');
  return steps;
}
btest('B007-01', 'DAU-007 exact 14-step sequence: A3→A4→LTL-01, Back→A4, Forward→LTL-01, Back→A4, Forward, refresh→exact', async () => {
  const {ctx, page, errors} = await openAtlas(browser, origin);
  try {
    assert.deepEqual(await govState(page), E.U);
    await activateRoadLtl(page); assert.deepEqual(await govState(page), E.M);
    await selectA3(page); assert.deepEqual(await govState(page), E.A);
    await setLevel(page, 2); assert.deepEqual(await govState(page), E.B);
    await selectProcess(page, 'LTL-01'); assert.deepEqual(await govState(page), E.C);
    const urlBefore = (await snapshot(page)).path;
    await back(page); await waitForGov(page, E.B);
    let s = await snapshot(page);
    assert.deepEqual(await govState(page), E.B, 'Back #1 restores Road LTL + commercial A3 + A4 + no process');
    assert.equal(s.process, null); assert.equal(s.slider, '2'); assert.equal(s.path, urlBefore, 'still inside Atlas');
    await forward(page); await waitForGov(page, E.C);
    assert.deepEqual(await govState(page), E.C, 'Forward restores LTL-01 at A4');
    await back(page); await waitForGov(page, E.B);
    assert.deepEqual(await govState(page), E.B, 'Back #2 restores the immediately preceding A4 state (not skipped)');
    await forward(page); await waitForGov(page, E.C);
    await reloadAndSettle(page);
    s = await snapshot(page);
    assert.deepEqual(await govState(page), E.C, 'refresh reconstructs module + A3 + A4 + LTL-01 exactly');
    assert.equal(s.slider, '2'); assert.equal(s.levelName, 'ACTIVE CONTEXT · A4');
    assert.deepEqual(strictErrors(errors), []);
  } finally { await ctx.close(); }
});
btest('B007-02', 'DAU-007 sequence is deterministic across independent runs (identical transcripts)', async () => {
  const runs = [];
  for (let i = 0; i < 2; i++) { const {ctx, page} = await openAtlas(browser, origin); try { runs.push(await transcript(page)); } finally { await ctx.close(); } }
  assert.equal(JSON.stringify(runs[0]), JSON.stringify(runs[1]));
  const t = runs[0];
  assert.deepEqual(t.slice(0, 5).map((s) => [s.level, s.process]), [[0, null], [1, null], [1, null], [2, null], [2, 'LTL-01']]);
  assert.deepEqual(t.slice(5, 9).map((s) => [s.level, s.process]), [[2, null], [2, 'LTL-01'], [2, null], [2, 'LTL-01']]);
});
btest('B007-03', 'history accounting: one adoption (replace) + four governed pushes; Back/Forward/refresh write nothing; entries carry only the allow-listed projection', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    let s = await snapshot(page); assert.equal(s.hist.push, 0); assert.equal(s.hist.replace, 1, 'startup adopts the current entry with replaceState');
    const base = s.histLen;
    await activateRoadLtl(page); await selectA3(page); await setLevel(page, 2); await selectProcess(page, 'LTL-01');
    s = await snapshot(page); assert.equal(s.hist.push, 4); assert.equal(s.hist.replace, 1); assert.equal(s.histLen, base + 4);
    const st = await page.evaluate(() => history.state);
    assert.deepEqual(Object.keys(st), ['atlasS8HistorySync']);
    const e = st.atlasS8HistorySync; assert.deepEqual(Object.keys(e).sort(), ['level', 'schema', 'view']); assert.deepEqual(Object.keys(e.view).sort(), [...VIEW_FIELDS].sort());
    assert.ok(parseEnvelope(e).ok);
    const blob = JSON.stringify(st);
    for (const bad of ['wd::', 'malkom-dw', 'bpmn', 'workDefinition', 'readiness', 'package', 'token', 'secret', 'playback', 'context']) assert.ok(!blob.toLowerCase().includes(bad.toLowerCase()), bad);
    const marks = {push: s.hist.push, replace: s.hist.replace};
    await back(page); await waitForGov(page, E.B); await forward(page); await waitForGov(page, E.C); await back(page); await waitForGov(page, E.B);
    await page.waitForTimeout(900);
    s = await snapshot(page); assert.equal(s.hist.push, marks.push, 'popstate restoration never pushes'); assert.equal(s.hist.replace, marks.replace, 'popstate restoration never replaces'); assert.equal(s.histLen, base + 4);
    await reloadAndSettle(page); s = await snapshot(page);
    assert.equal(s.hist.push, 0); assert.equal(s.hist.replace, 0, 'reload with a valid entry writes no duplicate');
  } finally { await ctx.close(); }
});
btest('B007-04', 'Back walks every governed entry without leaving Atlas (C→B→A→M→U) and Forward replays them exactly', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'C');
    const p0 = (await snapshot(page)).path;
    for (const n of ['B', 'A', 'M', 'U']) { await back(page); await waitForGov(page, E[n] ?? STATES[n]); assert.equal((await snapshot(page)).path, p0); assert.ok(await page.evaluate(() => !!window.AtlasS8HistorySync)); }
    for (const n of ['M', 'A', 'B', 'C']) { await forward(page); await waitForGov(page, STATES[n]); }
    assert.deepEqual(await govState(page), STATES.C);
  } finally { await ctx.close(); }
});
btest('B007-05', 'A4 is an independent restorable entry (level 2, no selected process) with its own history.state', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'C'); await back(page); await waitForGov(page, STATES.B);
    const e = await page.evaluate(() => history.state.atlasS8HistorySync);
    assert.equal(e.level, 2); assert.equal(e.view.depth, 'a4'); assert.equal(e.view.selectedProcess, null); assert.equal(e.view.selectedA3, 'a3-commercial-commitment');
  } finally { await ctx.close(); }
});
btest('B007-06', 'module changes are preserved (Universe → Road LTL → Fit → Universe; Back returns the module-with-fit state)', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await activateRoadLtl(page); await page.evaluate(() => v152FitUniverse()); await page.waitForFunction(() => S.visual152.level === 0 && S.activeModule === 'road-ltl'); await settle(page);
    await page.evaluate(() => reset()); await page.waitForFunction(() => S.activeModule === null); await settle(page);
    assert.deepEqual(await govState(page), STATES.U);
    await back(page); await waitForGov(page, STATES.G); assert.equal((await govState(page)).module, 'road-ltl');
    await back(page); await waitForGov(page, STATES.M);
    await forward(page); await waitForGov(page, STATES.G); await forward(page); await waitForGov(page, STATES.U);
  } finally { await ctx.close(); }
});
btest('B007-07', 'A3 changes are preserved (commercial A3 → another A3; Back returns the first A3)', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await activateRoadLtl(page); await selectA3(page, 'a3-commercial-commitment'); await selectA3(page, 'a3-origin-terminal');
    assert.equal((await govState(page)).a3, 'a3-origin-terminal');
    await back(page); await waitForGov(page, STATES.A); assert.equal((await govState(page)).a3, 'a3-commercial-commitment');
    await forward(page); await waitForGov(page, {...STATES.A, a3: 'a3-origin-terminal'});
  } finally { await ctx.close(); }
});
btest('B007-08', 'repeated identical transitions and idempotent renders create no duplicate entries', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'C');
    const before = await snapshot(page);
    await page.evaluate(() => { renderCanvas(); renderCanvas(); renderCanvas(); });
    await page.waitForTimeout(900); await settle(page);
    const after = await snapshot(page);
    assert.deepEqual(await govState(page), STATES.C);
    assert.equal(after.hist.push, before.hist.push); assert.equal(after.hist.replace, before.hist.replace);
    assert.equal(after.histLen, before.histLen);
  } finally { await ctx.close(); }
});
btest('B007-09', 'rapid Back×3 then Forward×3 converges on the exact state (restoration is serialized, no skipped/looping entry)', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'C');
    await page.evaluate(() => { history.back(); history.back(); history.back(); });
    await waitForGov(page, STATES.M);
    await page.evaluate(() => { history.forward(); history.forward(); history.forward(); });
    await waitForGov(page, STATES.C);
    const s = await snapshot(page); assert.equal(s.hist.push, 4);
  } finally { await ctx.close(); }
});
btest('B007-10', 'A5 focus (level 3 + LTL-01) is restorable via Back/Forward and refresh', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'D'); await back(page); await waitForGov(page, STATES.C); await forward(page); await waitForGov(page, STATES.D);
    await reloadAndSettle(page); assert.deepEqual(await govState(page), STATES.D);
  } finally { await ctx.close(); }
});

// ---- DAU-006 deep-link / reload matrix (100% of governed critical states)
const MATRIX = ['U', 'M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
for (const s of MATRIX) {
  btest(`D6-R-${s}`, `refresh at state ${s} reconstructs it exactly from the history entry`, async () => {
    const {ctx, page} = await openAtlas(browser, origin);
    try { await reach(page, s); const exp = await expectedState(page, s); assert.deepEqual(await govState(page), exp); await reloadAndSettle(page); assert.deepEqual(await govState(page), exp); } finally { await ctx.close(); }
  });
}
for (const s of MATRIX.filter((x) => x !== 'U')) {
  btest(`D6-L-${s}`, `generated deep link (#view=…) for state ${s} loads exactly in a fresh session and adopts one history entry`, async () => {
    const a = await openAtlas(browser, origin);
    let link, exp;
    try { await reach(a.page, s); exp = await expectedState(a.page, s); link = await a.page.evaluate(() => stage11ShareUrl()); } finally { await a.ctx.close(); }
    const hash = link.slice(link.indexOf('#'));
    assert.ok(hash.startsWith('#view='));
    const b = await openAtlas(browser, origin, {hash});
    try {
      await settle(b.page);
      const want = s === 'D' ? {...exp, level: 2} : exp; // the existing share-link serialization has no A4-vs-A5 field; A5 deep-links open at A4 with the process (not redesigned)
      assert.deepEqual(await govState(b.page), want);
      const h = await snapshot(b.page); assert.equal(h.hist.push, 0); assert.ok(h.hist.replace >= 1);
      assert.equal(await b.page.evaluate(() => !!history.state?.atlasS8HistorySync), true);
      assert.deepEqual(unexpectedErrors(b.errors), []);
    } finally { await b.ctx.close(); }
  });
}
btest('D6-D1', 'direct load of the bare URL opens the Universe (no stored state) and adopts a single entry', async () => {
  const {ctx, page, errors} = await openAtlas(browser, origin);
  try { assert.deepEqual(await govState(page), STATES.U); const s = await snapshot(page); assert.equal(s.hist.push, 0); assert.equal(s.hist.replace, 1); assert.deepEqual(strictErrors(errors), []); } finally { await ctx.close(); }
});
btest('D6-R2', 'refresh after Back restores the BACK entry (history entry wins over the root last-session restore)', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try { await reach(page, 'C'); await back(page); await waitForGov(page, STATES.B); await reloadAndSettle(page); assert.deepEqual(await govState(page), STATES.B); await forward(page); await waitForGov(page, STATES.C); await reloadAndSettle(page); assert.deepEqual(await govState(page), STATES.C); } finally { await ctx.close(); }
});
btest('D6-R3', 'Back/Forward after a reload still traverses the pre-reload entries', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try { await reach(page, 'C'); await reloadAndSettle(page); await back(page); await waitForGov(page, STATES.B); await back(page); await waitForGov(page, STATES.A); await forward(page); await waitForGov(page, STATES.B); } finally { await ctx.close(); }
});

// ---- negatives: history.state injection
const mutateEnvelope = (kind) => ({
  malformedString: () => 'garbage', malformedArray: () => [1, 2], malformedEmpty: () => ({}),
  unknownKey: (e) => ({...e, extra: 1}), unknownViewKey: (e) => ({...e, view: {...e.view, workDefinition: 'x'}}),
  incomplete: (e) => { const v = {...e.view}; delete v.selectedA3; return {...e, view: v}; },
  unknownModule: (e) => ({...e, view: {...e.view, atlasModule: 'nope-module'}}),
  unsupportedModule: (e) => ({...e, view: {...e.view, atlasModule: 'ocean-fcl'}}),
  unknownA3: (e) => ({...e, view: {...e.view, selectedA3: 'a3-nope'}}),
  unknownProcess: (e) => ({...e, view: {...e.view, selectedProcess: 'LTL-99'}}),
  processMismatch: (e) => ({...e, view: {...e.view, selectedProcess: 'LTL-05'}}),
  invalidDepth: (e) => ({...e, view: {...e.view, depth: 'zz'}}),
  invalidLevel: (e) => ({...e, level: 9}),
  a4NoA3: (e) => ({...e, view: {...e.view, selectedA3: null, selectedProcess: null}}),
  stalePin: (e) => ({...e, view: {...e.view, governancePin16: {...e.view.governancePin16, dataContractVersion: 'atlas-data-contract-v0.1'}}}),
  protectedProcess: (e) => ({...e, view: {...e.view, selectedProcess: 'wd::road-ltl::LTL-04::v1'}}),
  protectedKey: (e) => ({...e, malkomPackage: 'p'}),
  protectedModule: (e) => ({...e, view: {...e.view, atlasModule: 'bpmn'}})
})[kind];
const NEG = ['malformedString', 'malformedArray', 'malformedEmpty', 'unknownKey', 'unknownViewKey', 'incomplete', 'unknownModule', 'unsupportedModule', 'unknownA3', 'unknownProcess', 'processMismatch', 'invalidDepth', 'invalidLevel', 'a4NoA3', 'stalePin', 'protectedProcess', 'protectedKey', 'protectedModule'];
for (const kind of NEG) {
  btest(`N-P-${kind}`, `popstate to a history entry with ${kind} state is refused (fail closed): live state unchanged, nothing pushed`, async () => {
    const {ctx, page} = await openAtlas(browser, origin);
    try {
      await reach(page, 'B');
      const good = await page.evaluate(() => JSON.parse(JSON.stringify(history.state.atlasS8HistorySync)));
      const bad = mutateEnvelope(kind)(good);
      // create [.., B, BAD, C] then walk back to BAD
      await page.evaluate((b) => { history.pushState({atlasS8HistorySync: b}, '', location.href); }, bad);
      await page.evaluate(() => { history.back(); }); await page.waitForTimeout(400); await settle(page).catch(() => {});
      const before = await snapshot(page);
      await page.evaluate(() => { history.forward(); }); await page.waitForTimeout(900);
      const after = await snapshot(page);
      assert.deepEqual(await govState(page), STATES.B, 'bad entry never applied');
      assert.equal(after.hist.push, before.hist.push, 'no governed push for the refused entry');
      assert.ok(after.sync.stats.rejected >= 1, `rejected counter (${JSON.stringify(after.sync.stats)})`);
      assert.equal(after.adminOpen, false, 'a refused stale/invalid entry must not open the admin surface');
    } finally { await ctx.close(); }
  });
  btest(`N-R-${kind}`, `reload on an entry carrying ${kind} state is refused: no application of the bad state, Atlas stays usable`, async () => {
    const {ctx, page, errors} = await openAtlas(browser, origin);
    try {
      await reach(page, 'B');
      const good = await page.evaluate(() => JSON.parse(JSON.stringify(history.state.atlasS8HistorySync)));
      const bad = mutateEnvelope(kind)(good);
      await page.evaluate((b) => history.replaceState({atlasS8HistorySync: b}, '', location.href), bad);
      await page.evaluate(() => localStorage.removeItem('atlas-last-view-state-v0.1'));
      await page.reload({waitUntil: 'load'}); await waitActiveSync(page); await settle(page);
      const g = await govState(page);
      assert.notDeepEqual(g.process ?? null, 'LTL-99'); assert.notEqual(g.module, 'nope-module'); assert.notEqual(g.module, 'ocean-fcl'); assert.notEqual(g.module, 'bpmn'); assert.notEqual(g.a3, 'a3-nope');
      const s = await snapshot(page);
      assert.ok(s.sync.stats.rejected >= 1, 'rejection recorded');
      assert.deepEqual(g, STATES.U, 'no fabricated fallback: the neutral Universe');
      assert.deepEqual(unexpectedErrors(errors), []);
    } finally { await ctx.close(); }
  });
}

// ---- negatives: deep links
const link = (o) => `#view=${encodeURIComponent(JSON.stringify({schema: 'atlas-view-state-v0.1', atlasModule: 'road-ltl', coveragePreview: null, primary: 'execute', depth: 'a4', selectedDomain: null, selectedA3: 'a3-commercial-commitment', selectedProcess: 'LTL-01', playback: {enabled: false, index: 0, follow: 'all', frozen: false}, trace: {enabled: false, target: null, focusIndex: 0}, transform: {enabled: false, filter: 'all', submode: 'reference'}, compare: {enabled: false, mode: 'reference-client', targetModuleId: 'road-ftl', selectedProcess: null}, ...o}))}`;
const DEEP_NEG = {
  malformedJson: '#view=%7Bnot-json', unknownModule: link({atlasModule: 'nope-module'}), unsupportedModule: link({atlasModule: 'ocean-fcl'}), unknownA3: link({selectedA3: 'a3-nope', selectedProcess: null}),
  unknownProcess: link({selectedProcess: 'LTL-99'}), processMismatch: link({selectedProcess: 'LTL-05'}), invalidDepth: link({depth: 'zz'}), a4NoA3: link({selectedA3: null, selectedProcess: null}),
  protectedProcess: link({selectedProcess: 'wd::road-ltl::LTL-04::v1'}), unknownDomain: link({atlasModule: null, depth: 'domain', selectedA3: null, selectedProcess: null, selectedDomain: 'nope'})
};
for (const [k, hash] of Object.entries(DEEP_NEG)) {
  btest(`N-L-${k}`, `invalid deep link (${k}) fails closed: the invalid state is not applied, the neutral Universe stands`, async () => {
    const {ctx, page, errors} = await openAtlas(browser, origin, {hash});
    try {
      await settle(page);
      const g = await govState(page);
      assert.deepEqual(g, STATES.U, `got ${JSON.stringify(g)}`);
      assert.equal(await page.evaluate(() => S.selectedProcess ?? null), null);
      assert.deepEqual(unexpectedErrors(errors), []);
    } finally { await ctx.close(); }
  });
}
btest('N-L-stale', 'stale-version deep link is refused by the existing version gate (no state applied)', async () => {
  const stale = link({governancePin16: {registrySchemaVersion: '0.0.1', page0: {id: 'ecosystem-page-0', version: '1.0.0'}, dataContractVersion: 'atlas-data-contract-v0.1', module: {id: 'road-ltl', version: '0.1'}, overlays: []}});
  const {ctx, page, errors} = await openAtlas(browser, origin, {hash: stale});
  try { await settle(page); assert.deepEqual(await govState(page), STATES.U); assert.deepEqual(unexpectedErrors(errors), []); } finally { await ctx.close(); }
});
btest('N-X1', 'protected-value injection cannot enter history.state through any normal navigation (write-path allow-list)', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await page.evaluate(() => { const orig = window.stage11CaptureState; window.stage11CaptureState = function () { const st = orig(); st.workDefinition = {wd: 'wd::road-ltl::LTL-04::v1'}; st.malkomPackage = 'secret'; st.readiness = {x: 1}; st.bpmn = '<bpmn/>'; return st; }; });
    await reach(page, 'C');
    const st = JSON.stringify(await page.evaluate(() => history.state));
    for (const bad of ['workDefinition', 'wd::', 'malkomPackage', 'secret', 'readiness', 'bpmn']) assert.ok(!st.includes(bad), bad);
  } finally { await ctx.close(); }
});
btest('N-X2', 'restoration feedback loop: forcing renders during/after a restore never pushes or replaces', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'C'); const m = await snapshot(page);
    await back(page); await page.evaluate(() => { for (let i = 0; i < 20; i++) setTimeout(() => renderCanvas(), i * 40); });
    await waitForGov(page, STATES.B); await page.waitForTimeout(1200);
    const s = await snapshot(page); assert.equal(s.hist.push, m.hist.push); assert.equal(s.hist.replace, m.hist.replace);
  } finally { await ctx.close(); }
});
btest('N-X3', 'working surfaces (trace/playback/compare/transform) are not governed navigation: no entries are recorded while active', async () => {
  const {ctx, page} = await openAtlas(browser, origin);
  try {
    await reach(page, 'A'); const m = await snapshot(page);
    await page.evaluate(() => { S.playback.enabled = true; });
    await page.evaluate(() => { v152SetLevel(2, {center: false}); });
    await page.waitForTimeout(700);
    const s = await snapshot(page); assert.equal(s.hist.push, m.hist.push, 'no push while a working surface is active');
    await page.evaluate(() => { S.playback.enabled = false; }); await page.waitForTimeout(700); await settle(page);
    assert.equal((await snapshot(page)).hist.push, m.hist.push + 1, 'recorded once the surface is idle');
  } finally { await ctx.close(); }
});

// ---- consumer page guard
btest('C01', 'no-op on the Malkom consumer page: no errors, no history writes, status inactive-non-root', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__hist = {push: 0, replace: 0}; const op = history.pushState.bind(history), or = history.replaceState.bind(history); history.pushState = (...a) => { window.__hist.push++; return op(...a); }; history.replaceState = (...a) => { window.__hist.replace++; return or(...a); }; });
  try {
    await page.goto(`${origin}/atl-140-malkom-consumer.html`, {waitUntil: 'load'});
    await page.evaluate(() => import('/assets/atl-140-v15-journey.mjs'));
    await page.waitForFunction(() => document.documentElement.dataset.atlasHistorySync === 'inactive-non-root');
    assert.equal(await page.evaluate(() => typeof window.AtlasS8HistorySync), 'undefined');
    assert.deepEqual(await page.evaluate(() => window.__hist), {push: 0, replace: 0});
    assert.deepEqual(strictErrors(errors), []);
  } finally { await ctx.close(); }
});

// ---- root load-time race (pre-existing, root unchanged): mechanism proof + the tolerance is narrow
test('R01', 'the load-race tolerance is exact: only the stack-overflow message, only before the history module set any status', () => {
  const mk = (errs, meta) => { Object.defineProperty(errs, 'meta', {value: meta, enumerable: false}); return errs; };
  const before = loadRaceTally.tolerated;
  assert.deepEqual(withoutRootLoadRace(mk([LOAD_RACE_MESSAGE], [{m: LOAD_RACE_MESSAGE, a: null}])), []);
  assert.deepEqual(withoutRootLoadRace(mk([LOAD_RACE_MESSAGE], [{m: LOAD_RACE_MESSAGE, a: 'active'}])), [LOAD_RACE_MESSAGE]);
  assert.deepEqual(withoutRootLoadRace(mk(['TypeError: x'], [{m: 'TypeError: x', a: null}])), ['TypeError: x']);
  assert.deepEqual(withoutRootLoadRace(mk([LOAD_RACE_MESSAGE, LOAD_RACE_MESSAGE], [{m: LOAD_RACE_MESSAGE, a: null}])), [LOAD_RACE_MESSAGE]);
  assert.deepEqual(withoutRootLoadRace([LOAD_RACE_MESSAGE]), [LOAD_RACE_MESSAGE], 'no meta recorded => nothing tolerated');
  loadRaceTally.tolerated = before;
});
btest('R02', 'root load-race mechanism: a render task before the Stage-8 repair overflows the stack in the UNCHANGED root with the history module absent', async () => {
  const probe = await startRaceProbeServer(root, {inject: true, blockHistoryModule: true});
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const seen = [];
  page.on('console', (m) => { if (m.text().startsWith('RACEPROBE')) seen.push(m.text()); });
  try {
    await page.goto(`${probe.origin}/index.html`, {waitUntil: 'load'}); await page.waitForTimeout(1500);
    assert.equal(seen.length, 1, 'probe fired once'); assert.ok(seen[0].includes(LOAD_RACE_MESSAGE), seen[0]);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.atlasHistorySync ?? null), null, 'module absent: it cannot be the cause');
    assert.equal(blobOf('index.html'), PINS['index.html']);
  } finally { await ctx.close(); await probe.close(); }
});
btest('R03', 'without the injected early render the split-delivery root loads cleanly and the module activates (the overflow is a timing window, not a steady-state defect)', async () => {
  const probe = await startRaceProbeServer(root, {inject: false, blockHistoryModule: false});
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const seen = [];
  page.on('console', (m) => { if (m.text().startsWith('RACEPROBE')) seen.push(m.text()); });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${probe.origin}/index.html`, {waitUntil: 'load'}); await waitActiveSync(page);
    assert.deepEqual(seen, []); assert.ok(!errors.some((e) => e.includes(LOAD_RACE_MESSAGE)), errors.join('|'));
    assert.deepEqual(await govState(page), STATES.U);
  } finally { await ctx.close(); await probe.close(); }
});

// ===================================================================== runner
const wantBrowser = !process.env.S8_6_SKIP_BROWSER;
const exe = chromiumExecutable();
if (wantBrowser) { browser = await launch(); const s = await startStaticServer(root); server = s; origin = s.origin; }
const unit = queue.filter((q) => !q.browser && (!ONLY || ONLY.test(q.id)));
for (const q of unit) await run(q.id, q.name, q.fn);
const bq = queue.filter((q) => q.browser && wantBrowser && (!ONLY || ONLY.test(q.id)));
const CONCURRENCY = Number(process.env.S8_6_CONCURRENCY ?? 2);
let next = 0;
await Promise.all(Array.from({length: CONCURRENCY}, async () => { while (next < bq.length) { const q = bq[next++]; await run(q.id, q.name, q.fn); } }));
const browserVersion = browser ? browser.version() : null;
if (browser) await browser.close();
if (server) await server.close();
results.sort((a, b) => (a.id < b.id ? -1 : 1));
const failed = results.filter((r) => !r.ok);
console.log(`\nS8-6 DAU history-sync: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.id).join('\n'));
console.log(JSON.stringify({suite: 's8-6-dau-history-sync', total: results.length, passed: results.length - failed.length, failed: failed.length, rootLoadRaceTolerated: loadRaceTally.tolerated, browser: browserVersion ? `chromium ${browserVersion}` : null, browserExecutable: exe, caseIds: results.map((r) => r.id)}));
if (failed.length) process.exit(1);
