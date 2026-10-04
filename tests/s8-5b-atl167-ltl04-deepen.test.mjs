import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import router from '../api/atlas.js';
import {buildGovernedDepthSummary, deriveGovernedDepthSummary, readGovernedSummaries, assertGovernedScope, assertAllowedParameters, GOVERNED_PINS, GOVERNED_DEPTH_SCOPE, PROTECTED_PARAMETER_NAMES} from '../lib/projections/governed-depth-summary.js';
import {buildPublicExecutionDepthProjection, publicProjectionForbiddenTokens} from '../lib/projections/execution-depth-projection.js';
import {DEEPEN_SCOPE, buildDeepenUrl, validateDeepenSummary, fetchDeepenSummary, summaryMarkup, failureMarkup, deepenControlMarkup, wireDeepen, contextKey, DEEPEN_PINS, DEEPEN_BUTTON_ID, DEEPEN_REGION_ID} from '../assets/atl-167-v15-deepen-inspect.mjs';
import {journeyMarkup, install, resolveWorkDetailHref, JOURNEY_SECTION_ID, FLOW_ANCHOR_PATH, CONSUMER_VIEW_PATH} from '../assets/atl-140-v15-journey.mjs';
import {buildConsumerViewModel} from '../assets/atl-140-consumer-view.mjs';
import {reproduceCorrectedLineage, assertCorrectedIdentities} from './s8-5a-support/successor-lineage.mjs';
import {generateEvidence, EVIDENCE_FILES, S8_5A_HEAD, MODIFIED_PRODUCT, NEW_PRODUCT} from './s8-5b-support/evidence.mjs';

// S8-5B — ATL-167 bounded successor remediation: same-context (road-ltl@1.5 / LTL-04) public-safe Deepen/Inspect over EXISTING
// governed S8 evidence. Derived from the governing capability contract, not from the historical ATL-167 page.
// PASS here means only that bounded interaction capability; it is not runtime/release readiness or ATL-157 materialization of LTL-04.
const root = process.cwd();
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}).trim();
const gitOk = (args) => { try { cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, stdio: 'pipe'}); return true; } catch { return false; } };
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const blobOf = (p) => git(['hash-object', p]);
const changedVsBase = () => {
  const tracked = git(['diff', '--name-status', '--no-renames', S8_5A_HEAD]).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const untracked = git(['ls-files', '-o', '--exclude-standard']).split('\n').filter(Boolean).map((p) => ['A', p]);
  return [...tracked, ...untracked];
};
const baseBlob = (p) => git(['rev-parse', `${S8_5A_HEAD}:${p}`]);
const clone = (v) => structuredClone(v);
const results = [];
const test = async (id, name, fn) => { const label = `${id} ${name}`; try { await fn(); results.push({id, ok: true}); console.log(`PASS ${label}`); } catch (e) { results.push({id, ok: false}); console.log(`FAIL ${label}\n  ${String(e.message).split('\n').slice(0, 4).join('\n  ')}`); } };
const STALE_WD = ['wd', '::road-ltl::LTL-04::v', '1'].join('');
const STALE_PKG = ['malkom-dw', '::road-ltl::LTL-04::v', '1'].join('');
const STALE_TIP = '88bd3da8';
const API = (q) => `/api/atlas?action=governed-depth-summary${q}`;
const TUPLE = '&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04';

async function call(url, method = 'GET') {
  const u = new URL(url, 'http://atlas.local');
  const res = {headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; }};
  await router({method, url, query: Object.fromEntries(u.searchParams), headers: {host: 'atlas.local'}}, res);
  return {status: res.statusCode, headers: res.headers, json: JSON.parse(res.body), body: res.body};
}
const routerFetch = async (url) => { const r = await call(url); return {ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json}; };

const gen = await generateEvidence(root);
const live = (await call(API(TUPLE)));
const summary = live.json.summary;

// ===================================================================== Z: scope / identity discipline
const ALLOWED_ADD = (p) => p === 'assets/atl-167-v15-deepen-inspect.mjs' || p === 'lib/api/governed-depth-summary.js' || p === 'lib/projections/governed-depth-summary.js' || p === 'tests/s8-5b-atl167-ltl04-deepen.test.mjs' || p.startsWith('tests/s8-5b-support/') || p === 'governance/product/S8_5B_ATL167_LTL04_DEEPEN.md' || p.startsWith('governance/product/s8-5b-evidence/');
await test('Z01', 'changed paths vs the exact S8-5A head are only the classified set: 2 modified integration files + new ATL-167 files/tests/evidence', () => {
  const changed = changedVsBase();
  const modified = changed.filter(([s]) => s === 'M').map(([, p]) => p).sort();
  assert.deepEqual(modified, MODIFIED_PRODUCT.map(([p]) => p).sort(), 'only the two classified integration files may be modified');
  for (const [s, p] of changed) { assert.ok(['A', 'M'].includes(s), `no deletions/renames: ${p}`); if (s === 'A') assert.ok(ALLOWED_ADD(p), `unclassified new path ${p}`); }
});
await test('Z02', 'certified / predecessor / canonical paths are byte-identical to the S8-5A head (root, shell, Canvas, bridge, Ask, Daughter, vercel, registry, data, release, compile, all prior evidence)', () => {
  for (const p of ['index.html', 'execution/ui/runtime-access-shell.js', 'assets/canvas-daughter-bridge-v2.0.1.mjs', 'assets/universal-daughter-renderer-v2.js', 'daughter.html', 'lib/api/ask-atlas.js', 'runtime/universal-ask-atlas.js', 'atl-140-malkom-consumer.html', 'assets/atl-140-consumer-view.mjs', 'vercel.json', 'package.json', 'lib/projections/execution-depth-projection.js', 'lib/api/execution-depth-projection.js']) assert.equal(blobOf(p), baseBlob(p), p);
  assert.equal(git(['diff', '--name-only', S8_5A_HEAD, '--', 'release', 'canvas-v2', 'lib/compile', 'lib/release', 'schemas', 'data', 'governance/presentation', 'governance/product/s8-3b-evidence', 'governance/product/s8-3c-evidence', 'governance/product/s8-3d-evidence', 'governance/product/s8-3e-evidence', 'governance/product/s8-3f-evidence', 'governance/product/s8-4-evidence', 'governance/product/s8-5a-evidence', 'execution', 'runtime', 'scripts']), '');
  assert.equal(changedVsBase().map(([, p]) => p).filter((p) => p.startsWith('tests/') && !p.startsWith('tests/s8-5b')).join(','), '', 'no prior test is edited or weakened');
});
await test('Z03', 'api/atlas.js = predecessor blob + exactly one added route line; every prior route intact', () => {
  const was = git(['show', `${S8_5A_HEAD}:api/atlas.js`]).split('\n'), now = read('api/atlas.js').trim().split('\n');
  assert.equal(now.length, was.length + 1);
  assert.deepEqual(now.filter((l) => !was.includes(l)), ["  'governed-depth-summary':'./governed-depth-summary.js',"]);
  assert.deepEqual(was.filter((l) => !now.includes(l)), []);
  assert.ok(read('api/atlas.js').includes("'execution-depth-projection':'./execution-depth-projection.js'"));
  assert.equal(fs.readdirSync(path.join(root, 'api')).filter((f) => f.endsWith('.js')).length, 8, 'top-level function count unchanged');
});
await test('Z04', 'predecessor donor identities other than the one registered route are intact (S8-4 provenance imports) and shell = donor + exactly one line', () => {
  const prov = JSON.parse(read('governance/product/s8-4-evidence/donor-provenance.json'));
  for (const e of prov.imports) { if (e.path === 'api/atlas.js' || e.path === 'execution/ui/runtime-access-shell.js') continue; assert.equal(blobOf(e.path), e.expectedBlob, `donor identity lost ${e.path}`); }
  assert.equal(blobOf('execution/ui/runtime-access-shell.js'), baseBlob('execution/ui/runtime-access-shell.js'));
  assert.equal(git(['show', `${prov.imports.find((e) => e.path === 'api/atlas.js').sourceCommit}:api/atlas.js`]).split('\n').length + 1, read('api/atlas.js').trim().split('\n').length);
});
await test('Z05', 'the successor-identity evidence records predecessor vs successor blobs for each changed product file and is deterministic', () => {
  const id = JSON.parse(read(EVIDENCE_FILES.identity));
  assert.equal(id.base.commit, S8_5A_HEAD);
  for (const m of id.modifiedProductFiles) { assert.equal(m.predecessorBlob, baseBlob(m.path)); assert.equal(m.successorBlob, blobOf(m.path)); assert.notEqual(m.predecessorBlob, m.successorBlob); }
  for (const n of id.newProductFiles) assert.equal(n.successorBlob, blobOf(n.path));
  assert.equal(id.predecessorsPreserved.s8_3f.manifestRegenerated, false);
  for (const [p, c] of Object.entries(gen.files)) assert.equal(read(p), c, `evidence not deterministic: ${p}`);
});

// ===================================================================== D: ATL-157 non-expansion
await test('D01', 'ATL-157 materialization is unchanged: registry/module/operational blobs equal predecessor; LTL-03 remains the only materialized task', () => {
  for (const p of ['governance/presentation/p2-projection-source-registry.json', 'data/modules/road-ltl-v1.5.json', 'data/operational-knowledge/road-ltl-v1.5-operational.json', 'data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json']) assert.equal(blobOf(p), baseBlob(p), p);
  const reg = JSON.parse(read('governance/presentation/p2-projection-source-registry.json')).sources.find((s) => s.sourceKey === 'road-ltl@1.5');
  assert.equal(reg.firstProofTaskId, 'LTL-03'); assert.equal(reg.taskCollection, 'taskOverrides');
  assert.deepEqual(JSON.parse(read('data/modules/road-ltl-v1.5.json')).taskOverrides.map((x) => x.id), ['LTL-03']);
  assert.deepEqual(JSON.parse(read('data/operational-knowledge/road-ltl-v1.5-operational.json')).taskOperationalKnowledge.map((x) => x.taskId), ['LTL-03']);
});
await test('D02', 'existing execution-depth-projection behaviour is unchanged: LTL-03 → 200 PUBLIC_SAFE; LTL-04 → exact 404 (correct current behaviour)', async () => {
  const q = (t) => `/api/atlas?action=execution-depth-projection&moduleId=road-ltl&moduleVersion=1.5&taskId=${t}`;
  const a = await call(q('LTL-03')); assert.equal(a.status, 200); assert.equal(a.headers['X-Atlas-Projection-Class'], 'PUBLIC_SAFE'); assert.equal(a.json.projection.trace.taskId, 'LTL-03');
  const b = await call(q('LTL-04')); assert.equal(b.status, 404); assert.deepEqual(b.json, {ok: false, error: 'Task is not materialized in registered projection source: LTL-04'});
  assert.throws(() => buildPublicExecutionDepthProjection({moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'}), /not materialized/);
  assert.equal(JSON.parse(read(EVIDENCE_FILES.identity)).atl157NonExpansion.ltl04ExecutionDepthProjection.status, 404);
});
await test('D03', 'the new mechanism is NOT built on ATL-157: no import/route/URL of execution-depth-projection in the new files; no LTL-03 fallback in the client', () => {
  for (const p of ['lib/projections/governed-depth-summary.js', 'lib/api/governed-depth-summary.js', 'assets/atl-167-v15-deepen-inspect.mjs']) { const t = read(p); assert.ok(!/from\s+['"][^'"]*execution-depth-projection/.test(t), `${p} imports the ATL-157 projection`); }
  const code = (p) => read(p).replace(/\/\/.*$/mg, '');
  assert.ok(!code('assets/atl-167-v15-deepen-inspect.mjs').includes('execution-depth-projection'));
  assert.ok(!code('assets/atl-167-v15-deepen-inspect.mjs').includes('LTL-03'));
  const lib = code('lib/projections/governed-depth-summary.js');
  assert.ok(!/LTL-03/.test(lib.replace(/materializedProofScope: 'LTL-03'/, '')), 'LTL-03 appears only as the informational ATL-157 proof-scope marker');
});

// ===================================================================== A: bounded API
await test('A01', 'exact tuple road-ltl/1.5/LTL-04 → 200 PUBLIC_SAFE read-only summary, deterministic and equal to the committed evidence', async () => {
  assert.equal(live.status, 200); assert.equal(live.headers['X-Atlas-Projection-Class'], 'PUBLIC_SAFE'); assert.equal(live.json.ok, true);
  assert.equal(summary.schemaVersion, 'atlas-v1.5-governed-depth-summary-v1'); assert.equal(summary.projectionClass, 'PUBLIC_SAFE'); assert.equal(summary.readOnly, true); assert.equal(summary.basis, 'EXISTING_GOVERNED_S8_EVIDENCE_ONLY');
  assert.deepEqual({moduleId: summary.scope.moduleId, moduleVersion: summary.scope.moduleVersion, taskId: summary.scope.taskId}, {moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'});
  assert.equal((await call(API(TUPLE))).body, live.body);
  assert.equal(JSON.parse(read(EVIDENCE_FILES.summary)).summary.scope.contextKey, 'road-ltl@1.5 / LTL-04');
  assert.deepEqual(Object.keys(summary).sort(), ['basis', 'blockers', 'knowledgeGaps', 'lineage', 'malkom', 'mechanism', 'notClaimed', 'projectionClass', 'protectedOmissions', 'readOnly', 'readiness', 'schemaVersion', 'scope', 'trace', 'workDefinition']);
});
await test('A02', 'consumes exactly the governed identities: WD/package/readiness/projection equal the accepted pins AND the independently reproduced protected lineage (no semantic mutation)', async () => {
  assert.deepEqual({wd: summary.lineage.workDefinition, package: summary.lineage.package, readiness: summary.lineage.readiness, projection: summary.lineage.projection}, {wd: 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61', package: '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367', readiness: 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617', projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c'});
  assert.deepEqual(GOVERNED_PINS, {wd: summary.lineage.workDefinition, package: summary.lineage.package, readiness: summary.lineage.readiness, projection: summary.lineage.projection});
  const lin = await reproduceCorrectedLineage(root); assertCorrectedIdentities(lin.hashes);
  assert.equal(lin.hashes.wd, summary.lineage.workDefinition); assert.equal(lin.hashes.package, summary.lineage.package); assert.equal(lin.hashes.readiness, summary.lineage.readiness); assert.equal(lin.hashes.projection, summary.lineage.projection); assert.equal(lin.hashes.binding, summary.lineage.binding);
  assert.equal(summary.scope.workDefinitionId, 'road-ltl@1.5::LTL-04::LTL-04::ACT::02::WD');
});
await test('A03', 'state is reported exactly and not softened: PARTIAL, 1 protected WD, 5/1/4 leaves, 2 binding + 2 knowledge-gap blockers, 1 unresolved binding, BLOCKED, not ready, not materializable, not independently proven', () => {
  assert.deepEqual(summary.workDefinition, {protectedCount: 1, leafCount: 5, compiledLeafCount: 1, notCompiledLeafCount: 4, blockedByClientBindingLeafCount: 2, blockedByKnowledgeGapLeafCount: 2, workSemantics: 'PARTIAL', bodyIncluded: false});
  assert.deepEqual(summary.readiness, {disposition: 'BLOCKED', clientBinding: 'CLIENT_BINDING_REQUIRED', unresolvedBindingCount: 1, universalExecutionReady: false, materializable: false, runtimeCertification: false, independentExecutorProofStatus: 'NOT_INDEPENDENTLY_PROVEN'});
  assert.deepEqual(summary.knowledgeGaps, {blockedLeafCount: 2, resolved: false});
  assert.equal(summary.malkom.projectionDisposition, 'BLOCKED'); assert.equal(summary.malkom.apiEndpointDisposition, 'REQUIREMENT_NOT_CONFIRMED');
  assert.deepEqual(summary.malkom.requirementCoverage.map((r) => r.status), ['AVAILABLE', 'PARTIAL', 'CLIENT_BINDING_REQUIRED', 'UNSUPPORTED']);
  assert.deepEqual(summary.blockers.map((b) => b.code), ['CLIENT_BINDING_REQUIRED', 'KNOWLEDGE_GAP', 'LEAVES_NOT_COMPILED', 'PROJECTION_BLOCKED', 'EXECUTOR_NOT_INDEPENDENTLY_PROVEN', 'API_ENDPOINT_REQUIREMENT_NOT_CONFIRMED']);
  assert.equal(summary.mechanism.kind, 'EXISTING_KNOWLEDGE_LOOKUP_NOT_A_MATERIALIZER');
  for (const k of ['research', 'enrichment', 'newOperationalSemantics', 'workDefinitionCompilation', 'bindingResolution', 'knowledgeGapFilling', 'readinessPromotion', 'canonicalWrite']) assert.equal(summary.mechanism[k], false, k);
  assert.equal(summary.mechanism.atl157PublicDepth.ltl04Disposition, 'NOT_MATERIALIZED_BY_DESIGN');
});
await test('A04', 'consistent with the S8-4 consumer view-model built from the same public summaries (single truth path, no duplicate semantics)', () => {
  const s = readGovernedSummaries(root); const m = buildConsumerViewModel(s);
  assert.equal(m.lineage.wd, summary.lineage.workDefinition); assert.equal(m.lineage.flowGraph, summary.lineage.flow.graph); assert.equal(m.coverage.notCompiledLeafCount, summary.workDefinition.notCompiledLeafCount); assert.equal(m.readiness.unresolvedBindingCount, summary.readiness.unresolvedBindingCount); assert.equal(m.flow.blockedLeaves, summary.trace.flow.blockedLeaves);
  assert.ok(read('lib/projections/governed-depth-summary.js').includes("from '../../assets/atl-140-consumer-view.mjs'"));
});
const neg = (id, name, url, status, code) => test(id, name, async () => { const r = await call(url); assert.equal(r.status, status); assert.equal(r.json.ok, false); assert.equal(r.json.code, code); assert.equal(r.json.summary, undefined, 'no fallback summary'); assert.ok(!r.body.includes('fcc3e6cf'), 'no lineage leaked on failure'); });
await neg('A05', 'unsupported task LTL-03 fails closed (no LTL-03 fallback)', API('&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-03'), 404, 'UNSUPPORTED_TASK');
await neg('A06', 'unknown task fails closed', API('&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-99'), 404, 'UNSUPPORTED_TASK');
await neg('A07', 'wrong version Road 1.4 fails closed (no 1.4 fallback)', API('&moduleId=road-ltl&moduleVersion=1.4&taskId=LTL-04'), 404, 'UNSUPPORTED_MODULE_VERSION');
await neg('A08', 'wrong module fails closed', API('&moduleId=ocean-fcl&moduleVersion=1.5&taskId=LTL-04'), 404, 'UNSUPPORTED_MODULE');
await neg('A09', 'incomplete scope fails closed', API('&moduleId=road-ltl&moduleVersion=1.5'), 400, 'SCOPE_INCOMPLETE');
await test('A10', 'protected content requests fail closed (403) for every protected parameter; unknown parameters and non-GET are refused', async () => {
  for (const n of PROTECTED_PARAMETER_NAMES) { const r = await call(API(`${TUPLE}&${n}=1`)); assert.equal(r.status, 403, n); assert.equal(r.json.code, 'PROTECTED_CONTENT_NOT_AVAILABLE'); assert.equal(r.json.summary, undefined); }
  assert.equal((await call(API(`${TUPLE}&nope=1`))).status, 400);
  assert.equal((await call(API(TUPLE), 'POST')).status, 405);
  assert.equal((await call(API(TUPLE), 'PUT')).status, 405);
});
await test('A11', 'lineage identity / readiness / package mismatches and promotion claims in the governed evidence fail closed', () => {
  const base = readGovernedSummaries(root); const code = (fn) => { const s = clone(base); fn(s); try { deriveGovernedDepthSummary(s); } catch (e) { return e.code; } return 'NO_THROW'; };
  const flip = (h) => (h[0] === '0' ? '1' : '0') + h.slice(1);
  assert.equal(code((s) => { s.packageReadiness.inputHashes.wd = flip(s.packageReadiness.inputHashes.wd); }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.packageReadiness.packageHash = flip(s.packageReadiness.packageHash); }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.projection.inputHashes.package = flip(s.projection.inputHashes.package); }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { const h = flip(s.packageReadiness.readinessHash); s.packageReadiness.readinessHash = h; s.projection.inputHashes.readiness = h; s.flow.inputHashes.readiness = h; }), 'LINEAGE_IDENTITY_MISMATCH', 'self-consistent but unpinned readiness identity');
  assert.equal(code((s) => { const h = flip(s.reconstruction.outputHash); s.reconstruction.outputHash = h; s.packageReadiness.inputHashes.wd = h; s.projection.inputHashes.wd = h; s.flow.inputHashes.wd = h; }), 'LINEAGE_IDENTITY_MISMATCH', 'self-consistent but unpinned WD identity');
  assert.equal(code((s) => { delete s.packageReadiness.readinessHash; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.projection.readiness = 'READY'; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.projection.materializable = true; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.packageReadiness.universalExecutionReady = true; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.flow.workDefinitionId = STALE_WD; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { s.flow.boundary.canonicalMutation = true; }), 'LINEAGE_IDENTITY_MISMATCH');
  assert.equal(code((s) => { delete s.flow; }), 'LINEAGE_IDENTITY_MISMATCH');
});
await test('A12', 'unavailable or malformed governed evidence fails closed (503), never a partial summary', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 's8-5b-'));
  try {
    assert.throws(() => buildGovernedDepthSummary(DEEPEN_SCOPE, {root: tmp}), (e) => e.status === 503 && e.code === 'GOVERNED_EVIDENCE_UNAVAILABLE');
    for (const p of ['governance/product/s8-3b-evidence/reconstruction-summary.json', 'governance/product/s8-3c-evidence/package-readiness-summary.json', 'governance/product/s8-3d-evidence/projection-summary.json', 'governance/product/s8-3e-evidence/flow-summary.json']) { fs.mkdirSync(path.dirname(path.join(tmp, p)), {recursive: true}); fs.writeFileSync(path.join(tmp, p), '{not json'); }
    assert.throws(() => buildGovernedDepthSummary(DEEPEN_SCOPE, {root: tmp}), (e) => e.status === 503 && e.code === 'GOVERNED_EVIDENCE_MALFORMED');
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  assert.throws(() => assertGovernedScope({moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-03'}), (e) => e.status === 404);
  assert.throws(() => assertAllowedParameters(['moduleId', 'include']), (e) => e.status === 403);
});
await test('A13', 'read-only: calling the API changes nothing; the implementation has no write/network/research/compile calls', async () => {
  const before = git(['status', '--porcelain']);
  for (let i = 0; i < 3; i++) await call(API(TUPLE));
  assert.equal(git(['status', '--porcelain']), before);
  for (const p of ['lib/projections/governed-depth-summary.js', 'lib/api/governed-depth-summary.js']) { const t = read(p).replace(/\/\/.*$/mg, ''); assert.ok(!/writeFile|appendFile|mkdirSync|rmSync|unlink|rename|createWriteStream|child_process|fetch\(|http\.|https\.|require\(/.test(t), `${p} must be read-only`); const specs = [...t.matchAll(/from\s+'([^']+)'/g)].map((x) => x[1]); for (const sp of specs) assert.ok(/^(node:fs|node:path|\.\/_utils\.js|\.\.\/projections\/governed-depth-summary\.js|\.\.\/\.\.\/assets\/atl-140-consumer-view\.mjs)$/.test(sp), `${p} unexpected import ${sp}`); }
});
await test('A14', 'protected-boundary: the public summary contains no WD body, package/readiness/projection bytes, Flow/BPMN/SVG bytes, claim ids, binding values or runtime mappings', () => {
  const t = JSON.stringify(summary);
  for (const tok of publicProjectionForbiddenTokens()) assert.ok(!t.includes(tok), `forbidden token ${tok}`);
  for (const re of [/src-[a-z0-9-]+/i, /binding::/, /KG::/, /<bpmn|<svg|<\?xml/i, /definitions"/, /"leaves"/, /"nodes":\s*\[/, /"edges":\s*\[/]) assert.ok(!re.test(t), String(re));
  assert.ok(t.length < 6000, `summary is a bounded public projection (${t.length} bytes)`);
  assert.equal(summary.trace.protectedBytesIncluded, false);
  const allowedHashes = new Set([...Object.values(summary.lineage).filter((v) => typeof v === 'string'), ...Object.values(summary.lineage.flow), summary.lineage.sourcePin.taskHash]);
  for (const h of t.match(/\b[0-9a-f]{64}\b/g) || []) assert.ok(allowedHashes.has(h), `unexpected 64-hex identity ${h}`);
});

// ===================================================================== C: client Deepen/Inspect interaction
await test('C01', 'Deepen builds ONLY the exact governed tuple request; any other scope is refused before any network call', async () => {
  const u = new URL(buildDeepenUrl(), 'http://x'); assert.equal(u.pathname, '/api/atlas'); assert.deepEqual(Object.fromEntries(u.searchParams), {action: 'governed-depth-summary', moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-04'});
  for (const bad of [{moduleId: 'road-ltl', moduleVersion: '1.5', taskId: 'LTL-03'}, {moduleId: 'road-ltl', moduleVersion: '1.4', taskId: 'LTL-04'}, {moduleId: 'ocean-fcl', moduleVersion: '1.5', taskId: 'LTL-04'}, {}, null]) {
    assert.throws(() => buildDeepenUrl(bad), /DEEPEN_SCOPE_NOT_GOVERNED/);
    let called = false; await assert.rejects(fetchDeepenSummary(async () => { called = true; return {ok: true}; }, bad), /DEEPEN_SCOPE_NOT_GOVERNED/); assert.equal(called, false);
  }
});
await test('C02', 'Deepen consumes the governed API and yields a validated public-safe summary (exact request URL observed)', async () => {
  const seen = []; const s = await fetchDeepenSummary(async (url, opts) => { seen.push([url, opts]); return routerFetch(url); });
  assert.equal(seen.length, 1); assert.equal(seen[0][0], buildDeepenUrl()); assert.equal(seen[0][1].credentials, 'same-origin'); assert.equal(seen[0][1].cache, 'no-store');
  assert.ok(!seen[0][0].includes('execution-depth-projection') && !seen[0][0].includes('LTL-03'));
  assert.deepEqual(s, summary);
});
await test('C03', 'Deepen fails closed on unavailable API, non-OK status, malformed responses, scope/identity mismatch, protected content and any promotion claim', async () => {
  const code = async (f) => { try { await fetchDeepenSummary(f); } catch (e) { return e.code || e.message; } return 'NO_THROW'; };
  const ok = (body) => async () => ({ok: true, status: 200, json: async () => body});
  const mut = (fn) => ok({ok: true, summary: (() => { const s = clone(summary); fn(s); return s; })()});
  assert.equal(await code(undefined), 'DEEPEN_API_UNAVAILABLE'); // fetch missing handled by default-arg path below
  assert.equal(await code(async () => { throw new Error('net'); }), 'DEEPEN_API_UNAVAILABLE');
  assert.equal(await code(async () => ({ok: false, status: 404})), 'DEEPEN_API_STATUS:404');
  assert.equal(await code(async () => ({ok: false, status: 500})), 'DEEPEN_API_STATUS:500');
  assert.equal(await code(async () => ({ok: true, status: 200, json: async () => { throw new Error('bad'); }})), 'DEEPEN_RESPONSE_MALFORMED');
  assert.equal(await code(ok({ok: false})), 'DEEPEN_RESPONSE_MALFORMED');
  assert.equal(await code(ok({ok: true})), 'DEEPEN_RESPONSE_MALFORMED');
  assert.equal(await code(ok({ok: true, summary: {schemaVersion: DEEPEN_PINS && 'x'}})), 'DEEPEN_RESPONSE_SCHEMA');
  assert.equal(await code(mut((s) => { s.scope.taskId = 'LTL-03'; })), 'DEEPEN_SCOPE_MISMATCH');
  assert.equal(await code(mut((s) => { s.scope.moduleVersion = '1.4'; })), 'DEEPEN_SCOPE_MISMATCH');
  assert.equal(await code(mut((s) => { s.scope.workDefinitionId = STALE_WD; })), 'DEEPEN_WORKDEFINITION_ID_MISMATCH');
  assert.equal(await code(mut((s) => { s.lineage.package = '0'.repeat(64); })), 'DEEPEN_LINEAGE_MISMATCH:package');
  assert.equal(await code(mut((s) => { s.lineage.workDefinition = '0'.repeat(64); })), 'DEEPEN_LINEAGE_MISMATCH:workDefinition');
  assert.equal(await code(mut((s) => { s.readiness.disposition = 'READY'; })), 'DEEPEN_PROMOTION_CLAIM:readiness');
  assert.equal(await code(mut((s) => { s.readiness.materializable = true; })), 'DEEPEN_PROMOTION_CLAIM:materializable');
  assert.equal(await code(mut((s) => { s.readiness.universalExecutionReady = true; })), 'DEEPEN_PROMOTION_CLAIM:universalExecutionReady');
  assert.equal(await code(mut((s) => { s.readiness.clientBinding = 'RESOLVED'; })), 'DEEPEN_PROMOTION_CLAIM:clientBinding');
  assert.equal(await code(mut((s) => { s.readiness.unresolvedBindingCount = 0; })), 'DEEPEN_PROMOTION_CLAIM:bindingResolved');
  assert.equal(await code(mut((s) => { s.readiness.independentExecutorProofStatus = 'PROVEN'; })), 'DEEPEN_PROMOTION_CLAIM:executor');
  assert.equal(await code(mut((s) => { s.workDefinition.workSemantics = 'AVAILABLE'; })), 'DEEPEN_PROMOTION_CLAIM:workSemantics');
  assert.equal(await code(mut((s) => { s.workDefinition.bodyIncluded = true; })), 'PROTECTED_CONTENT_IN_RESPONSE:workDefinitionBody');
  assert.equal(await code(mut((s) => { s.trace.protectedBytesIncluded = true; })), 'PROTECTED_CONTENT_IN_RESPONSE:flowBytes');
  assert.equal(await code(mut((s) => { s.trace.bpmnXml = '<bpmn/>'; })), 'PROTECTED_CONTENT_IN_RESPONSE:bpmnXml');
  assert.equal(await code(mut((s) => { s.mechanism.canonicalWrite = true; })), 'DEEPEN_CANONICAL_WRITE_CLAIM');
  assert.equal(await code(mut((s) => { s.malkom.projectionDisposition = 'READY'; })), 'DEEPEN_PROMOTION_CLAIM:malkomProjection');
});
await test('C04', 'rendering is truthful: PARTIAL, 4 of 5 leaves not compiled, BLOCKED, unresolved binding, knowledge gaps, not independently proven; nothing promoted; exact context shown', () => {
  const h = summaryMarkup(summary);
  for (const t of ['road-ltl@1.5 / LTL-04', 'PARTIAL', '1 / 4 of 5', '2 / 2', 'BLOCKED', 'CLIENT_BINDING_REQUIRED (1 unresolved)', 'NOT_INDEPENDENTLY_PROVEN', 'false / false', 'KNOWLEDGE_GAP', 'LEAVES_NOT_COMPILED', 'Malkom requirement coverage', 'UNSUPPORTED', 'Not runtime ready']) assert.ok(h.includes(t), `missing ${t}`);
  assert.ok(!/\bRESOLVED\b|PRODUCTION|CERTIFIED|\bREADY\b/.test(h.replace(/CLIENT_BINDING_REQUIRED/g, '')), 'no promotion wording');
  assert.ok(!h.includes(STALE_WD) && !h.includes(STALE_PKG) && !h.includes('LTL-03'));
  assert.ok(failureMarkup('DEEPEN_API_STATUS:404').includes('role="alert"') && failureMarkup('X').includes('road-ltl@1.5 / LTL-04'));
  assert.throws(() => summaryMarkup({...summary, readiness: {...summary.readiness, disposition: 'READY'}}), /DEEPEN_PROMOTION_CLAIM/);
});
await test('C05', 'journey: fixed context, certified-bridge Ask link, Trace and Malkom links and the Deepen control all carry the SAME road-ltl@1.5 / LTL-04 context; S8-4 links preserved', () => {
  const href = resolveWorkDetailHref(JSON.parse(read('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json')));
  assert.equal(href, '/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04');
  const m = journeyMarkup(href); const key = contextKey();
  for (const l of ['work-detail', 'trace-flow', 'consumer-output']) assert.ok(m.includes(`data-journey-link="${l}"`), l);
  assert.ok(m.includes(`href="${href.replace(/&/g, '&amp;')}" data-journey-link="ask-context" data-context="${key}"`));
  assert.ok(m.includes(`href="/atl-140-malkom-consumer.html#generated-flow" data-journey-link="trace-context" data-context="${key}"`));
  assert.ok(m.includes(`id="${DEEPEN_BUTTON_ID}"`) && m.includes('Deepen this scope / Inspect') && m.includes('type="button"') && m.includes(`id="${DEEPEN_REGION_ID}"`) && m.includes('aria-live="polite"'));
  assert.deepEqual([...new Set([...m.matchAll(/data-context="([^"]*)"/g)].map((x) => x[1]))], [key]);
  assert.ok(!m.includes('LTL-03') && !m.includes(STALE_WD));
  assert.ok(journeyMarkup(null).includes('Ask unavailable (governed target not resolved)') && journeyMarkup(null).includes('aria-disabled="true"'), 'Ask context fails closed when the governed target does not resolve');
  assert.ok(deepenControlMarkup(href).includes(key));
});
function fakeDoc() {
  const nodes = new Map(); const appended = [];
  const mk = () => { const el = {_h: '', handlers: {}, children: [], set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, addEventListener(t, f) { this.handlers[t] = f; }, querySelector(sel) { const id = sel.replace('#', ''); if (!this._h.includes(`id="${id}"`)) return null; if (!nodes.has(id)) nodes.set(id, {_h: '', handlers: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, addEventListener(t, f) { this.handlers[t] = f; }}); return nodes.get(id); }, appendChild() {}}; return el; };
  const doc = {readyState: 'complete', head: {appendChild: (n) => appended.push(n)}, body: {appendChild: (n) => appended.push(n)}, getElementById: (id) => appended.find((n) => n.id === id) ?? null, createElement: () => mk()};
  return {doc, nodes, appended};
}
await test('C06', 'end-to-end interaction (journey install → click Deepen → governed summary) preserves the same context and shows the blocked state; failure renders fail-closed with no fallback', async () => {
  const href = '/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04';
  const seen = []; const a = fakeDoc(); const host = install(a.doc, href, {fetchImpl: async (u, o) => { seen.push(u); return routerFetch(u); }});
  assert.ok(host); const region = a.nodes.get(DEEPEN_REGION_ID) || host.querySelector(`#${DEEPEN_REGION_ID}`); const btn = host.querySelector(`#${DEEPEN_BUTTON_ID}`);
  assert.equal(typeof btn.handlers.click, 'function'); await btn.handlers.click();
  assert.equal(seen.length, 1); assert.equal(seen[0], buildDeepenUrl());
  assert.ok(region.innerHTML.includes('data-deepen-state="loaded"') && region.innerHTML.includes('PARTIAL') && region.innerHTML.includes('BLOCKED') && region.innerHTML.includes('road-ltl@1.5 / LTL-04'));
  const all = host.innerHTML + region.innerHTML; assert.deepEqual([...new Set([...all.matchAll(/data-context="([^"]*)"/g)].map((x) => x[1]))], [contextKey()]);
  for (const f of [async () => ({ok: false, status: 404}), async () => { throw new Error('offline'); }, async () => ({ok: true, status: 200, json: async () => ({ok: true, summary: {}})})]) {
    const b = fakeDoc(); const h = install(b.doc, href, {fetchImpl: f}); const r = h.querySelector(`#${DEEPEN_REGION_ID}`); await h.querySelector(`#${DEEPEN_BUTTON_ID}`).handlers.click();
    assert.ok(r.innerHTML.includes('data-deepen-state="failed"') && r.innerHTML.includes('role="alert"') && !r.innerHTML.includes('PARTIAL') && !r.innerHTML.includes('LTL-03'));
  }
  assert.equal(wireDeepen({querySelector: () => null}), null);
});
await test('C07', 'reachability chain from the certified root: root index → runtime shell → journey → Deepen/Inspect module → bounded API; Ask/Trace/Malkom surfaces exist; root and shell unchanged', () => {
  assert.ok(read('index.html').includes('/execution/ui/runtime-access-shell.js'));
  assert.ok(read('execution/ui/runtime-access-shell.js').includes("import('/assets/atl-140-v15-journey.mjs')"));
  assert.ok(read('assets/atl-140-v15-journey.mjs').includes("from './atl-167-v15-deepen-inspect.mjs'") && read('assets/atl-140-v15-journey.mjs').includes('canvas-daughter-bridge-v2.0.1.mjs'));
  assert.ok(read('atl-140-malkom-consumer.html').includes('id="generated-flow"') || read('atl-140-malkom-consumer.html').includes('generated-flow'));
  assert.ok(fs.existsSync(path.join(root, 'assets/universal-daughter-renderer-v2.js')) && fs.existsSync(path.join(root, 'daughter.html')) && fs.existsSync(path.join(root, 'lib/api/ask-atlas.js')));
  assert.equal(CONSUMER_VIEW_PATH, '/atl-140-malkom-consumer.html'); assert.equal(FLOW_ANCHOR_PATH, '/atl-140-malkom-consumer.html#generated-flow');
  assert.ok(JOURNEY_SECTION_ID);
});
await test('C08', 'Ask remains the certified Universal Ask 2.0.1 (not replaced or duplicated); Trace uses corrected S8-3E public evidence; Daughter/Ask for LTL-04 stay fail-closed', async () => {
  assert.equal(blobOf('lib/api/ask-atlas.js'), baseBlob('lib/api/ask-atlas.js')); assert.equal(blobOf('runtime/universal-ask-atlas.js'), baseBlob('runtime/universal-ask-atlas.js'));
  assert.equal(git(['ls-files', '-co', '--exclude-standard']).split('\n').filter((p) => p && fs.existsSync(p) && !p.startsWith('release/') && blobOf(p) === 'cb2bcfea0892adf5a871fb4584461b50729ab383').length, 0, 'superseded Ask blob must not be live');
  assert.ok(!/askAtlas|ask-atlas|question|answer/i.test(read('assets/atl-167-v15-deepen-inspect.mjs').replace(/certified Universal Ask 2\.0\.1/g, '').replace(/Ask this scope|Ask unavailable|ask-context|\bAsk\b/g, '')), 'no Ask re-implementation in the new module');
  assert.equal(summary.lineage.flow.graph, JSON.parse(read('governance/product/s8-3e-evidence/flow-summary.json')).artifactIdentities.graphHash);
  assert.equal(summary.trace.publicTracePath, FLOW_ANCHOR_PATH);
  const d = await call('/api/atlas?action=execution-depth-projection&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04'); assert.equal(d.status, 404);
});
await test('C09', 'accessibility/responsiveness preserved: keyboard-operable button, labelled live region, alert on failure, journey host keeps viewport-bounded layout', () => {
  const m = journeyMarkup('/daughter?moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04');
  assert.ok(/<button type="button" id="atl-167-deepen-button"[^>]*aria-controls="atl-167-deepen-region"/.test(m)); assert.ok(/role="region" aria-live="polite" aria-label="Governed depth for road-ltl@1\.5 \/ LTL-04"/.test(m));
  assert.ok(read('assets/atl-140-v15-journey.mjs').includes('max-width:min(420px,calc(100vw - 24px))'));
  assert.ok(failureMarkup('X').includes('role="alert"'));
});

// ===================================================================== P: stale lineage / surfaces / mutations guard
await test('P01', 'no stale WD id, stale Malkom package id or stale source tip in any new or changed file; no stale ATL-167 / ATL-178 page restored; wrong roots absent', () => {
  const touched = git(['diff', '--name-only', '--no-renames', S8_5A_HEAD, 'HEAD']).split('\n').filter(Boolean);
  const untracked = git(['ls-files', '-o', '--exclude-standard']).split('\n').filter(Boolean);
  for (const p of new Set([...touched, ...untracked, ...MODIFIED_PRODUCT.map(([x]) => x), ...NEW_PRODUCT.map(([x]) => x)])) { if (!fs.existsSync(path.join(root, p)) || /\.(b64|gz|png)$/.test(p)) continue; const t = read(p); for (const s of [STALE_WD, STALE_PKG, STALE_TIP]) if (p !== 'tests/s8-5b-atl167-ltl04-deepen.test.mjs') assert.ok(!t.includes(s), `${s} in ${p}`); }
  for (const p of ['atl-167-interaction-slice.html', 'atl-178-flow-explorer.html', 'tests/atl-167-interaction-slice.test.cjs']) assert.ok(!fs.existsSync(path.join(root, p)), `stale surface restored: ${p}`);
  assert.equal(blobOf('index.html'), baseBlob('index.html')); assert.equal(blobOf('index.html'), '043802523b1618c143a0e78b88bbfb2afaa7c7dd');
  for (const p of git(['ls-files', '*.html']).split('\n').filter(Boolean)) assert.ok(!['9cf88a867359ba33ebfbe85c1360f0ab21bc29b3', '379f988ce807f33dc8fd43b49b227b917a15b8c0'].includes(blobOf(p)), `wrong root blob at ${p}`);
  assert.deepEqual(git(['ls-files']).split('\n').filter((p) => /interaction-slice|flow-explorer/i.test(p) && !p.startsWith('tests/s8-5b') && !p.startsWith('governance/product/s8-5')), []);
});
await test('P02', 'journey modification is minimal and additive: the S8-4 exports/markup remain; only the successor import, one markup call and the install option were added', () => {
  const was = git(['show', `${S8_5A_HEAD}:assets/atl-140-v15-journey.mjs`]).split('\n'), now = read('assets/atl-140-v15-journey.mjs').split('\n');
  const removed = was.filter((l) => !now.includes(l)); const added = now.filter((l) => !was.includes(l));
  assert.ok(added.length <= 8, `added ${added.length}`); assert.ok(removed.length <= 4, `removed ${removed.length}`);
  assert.ok(removed.every((l) => /journeyMarkup|return `<section|export function install|const run = \(\) => install|doc\.body\.appendChild|bootJourney/.test(l) || l.trim() === ''), `unexpected removal ${removed.join(' | ').slice(0, 200)}`);
  for (const e of ['JOURNEY_SECTION_ID', 'JOURNEY_SCOPE', 'CONSUMER_VIEW_PATH', 'FLOW_ANCHOR_PATH', 'resolveWorkDetailHref', 'journeyMarkup', 'loadRegistry', 'install', 'bootJourney']) assert.ok(read('assets/atl-140-v15-journey.mjs').includes(`export ${e === 'JOURNEY_SECTION_ID' || e === 'JOURNEY_SCOPE' || e === 'CONSUMER_VIEW_PATH' || e === 'FLOW_ANCHOR_PATH' ? 'const' : (e === 'bootJourney' || e === 'loadRegistry' ? 'async function' : 'function')} ${e}`), e);
});

const failed = results.filter((r) => !r.ok);
console.log(`\nS8-5B: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.id).join('\n'));
console.log(JSON.stringify({suite: 's8-5b-atl167-ltl04-deepen', total: results.length, passed: results.length - failed.length, failed: failed.length, caseIds: results.map((r) => r.id)}));
if (failed.length) process.exit(1);
