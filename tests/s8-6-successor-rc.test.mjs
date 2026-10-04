import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {SUCCESSOR_MANIFEST_PATH, SUCCESSOR_SCHEMA, GENERATOR_PATHS, DAU_EVIDENCE, C, serialize, buildSuccessorManifest, generateSuccessorManifest, verifySuccessorManifest, reproduceFromCustody, ltl04Materialization} from '../lib/release/s8-6-successor-manifest.js';
import {PROTECTED, EXCLUDED, STALE_WD_MARKER} from '../lib/release/s8-release-manifest.js';
import {BASELINE_PATH, ROLLBACK_MANIFEST_PATH, DRIFT_RECON_PATH, BASE_COMMIT, ROLLBACK_ASSETS, verifyBaseline, verifyRollbackManifest, buildRollbackManifest, buildBaseline, baselinePaths, buildDriftReconciliation, serialize as rcSerialize} from '../lib/release/s8-6-release-control.js';
import {CHANNELS, planPackage, describePackage, packageManifestFor, buildPackages, verifyPackageDir, trackedFiles} from '../lib/release/s8-6-package-builder.js';
import {canonicalHash} from '../lib/compile/workdefinition-compiler.js';

// S8-6 — successor RC assembly/custody tests. PASS here means "RC assembly is internally consistent and ready for ATL-181 independent audit".
// It is NOT ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness.
const root = process.cwd();
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}).trim();
const clone = (v) => structuredClone(v);
const results = [];
const test = async (name, fn) => { try { await fn(); results.push({name, ok: true}); console.log(`PASS ${name}`); } catch (e) { results.push({name, ok: false}); console.log(`FAIL ${name}\n  ${e.message}`); } };
const committed = JSON.parse(fs.readFileSync(SUCCESSOR_MANIFEST_PATH, 'utf8'));
const entry = (m, id) => m.lineage.find((l) => l.id === id);
const codes = async (m, opts = {}) => (await verifySuccessorManifest(m, {root, canonicalHash, ...opts})).failures.map((f) => f.code);
const rejects = (name, mutate, expectCode) => test(`negative: ${name} → ${expectCode}`, async () => {
  const m = clone(committed); mutate(m);
  const c = await codes(m);
  assert.ok(c.length > 0, 'mutated manifest must be rejected');
  assert.ok(c.includes(expectCode), `expected ${expectCode}; got ${[...new Set(c)].join(',')}`);
});
const blobOf = (p) => git(['hash-object', p]);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ------------------------------------------------------------------ identity / determinism
await test('manifest schema, stage meaning and successor spine', () => {
  assert.equal(committed.schemaVersion, SUCCESSOR_SCHEMA);
  assert.equal(committed.stage.id, 'S8-6'); assert.match(committed.stage.meaning, /NOT ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness/);
  assert.equal(committed.successorSpine.branchBase, C.s8_5bFinalHead); assert.equal(committed.successorSpine.branchBaseTree, C.s8_5bFinalTree);
  assert.equal(committed.successorSpine.s8_5b.testedCommit, C.s8_5bTested); assert.equal(committed.successorSpine.dauRemediation.fixCommit, C.dauFix);
});
await test('deterministic regeneration equals the committed successor manifest byte-for-byte (twice)', async () => {
  const a = serialize(await buildSuccessorManifest(root, {canonicalHash})); const b = serialize(await buildSuccessorManifest(root, {canonicalHash}));
  assert.equal(a, b); assert.equal(a, fs.readFileSync(SUCCESSOR_MANIFEST_PATH, 'utf8'));
});
await test('every governed lineage entry is MATCH (expected == observed) and the verifier accepts the committed manifest', async () => {
  assert.ok(committed.lineage.length >= 85, `lineage entries: ${committed.lineage.length}`);
  for (const l of committed.lineage) assert.equal(l.status, 'MATCH', l.id);
  const r = await verifySuccessorManifest(committed, {root, canonicalHash});
  assert.deepEqual(r.failures, []); assert.equal(r.ok, true);
});
await test('protected derivatives reproduce from the CUSTODY copy (hashes only) and equal the pins', async () => {
  const r = await reproduceFromCustody(root);
  for (const p of PROTECTED) assert.equal(r[p.id], p.expected, p.id);
  assert.equal(r['source.task-hash'], 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65');
  assert.deepEqual((await verifySuccessorManifest(committed, {root, canonicalHash, reproduce: r})).failures, []);
});
await test('corrected S8-5B identities are pinned (WD/package/readiness/projection/flow/BPMN/SVG)', () => {
  const want = {
    'derivative.wd': 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61', 'derivative.package': '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
    'derivative.readiness': 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617', 'derivative.projection': '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c',
    'derivative.flow-graph': 'dfad5a029ce830e4c1bff68ea1a9ac7f482315c619495a7295aef3c50abe408e', 'derivative.flow-view': '1b3839e0bde5e92216373b9ff232a5d20de5e84a7c25250f7d4ce4b93dbaba6f',
    'derivative.bpmn': '1ede708543a8906333646f010b082446ec75dbf371337ad6069481c4958dfd61', 'derivative.svg': 'dbd7d34f978d21a7f81059b58b6de6cac78c89c66c047af6bf98c71ead237482'
  };
  for (const [id, h] of Object.entries(want)) { assert.equal(entry(committed, id).expected, h, id); assert.equal(entry(committed, id).observed, h, id); }
});
await test('certified Ask 2.0.1, Canvas, bridge and shell identities are pinned and match the tree', () => {
  const want = {'interaction.ask-runtime': '521c47a3', 'interaction.ask-api': '8fa80f9d', 'interaction.ask-contract': '608956d3', 'interaction.ask-retrieval': '6f3c29dc', 'interaction.ask-certification': 'd0dfd8b2'};
  for (const [id, pre] of Object.entries(want)) { const l = entry(committed, id); assert.ok(l.expected.startsWith(pre), id); assert.equal(l.expected, l.observed); assert.equal(l.status, 'MATCH'); }
  for (const id of ['interaction.canvas-index', 'interaction.canvas-js', 'interaction.canvas-css', 'interaction.canvas-daughter-bridge', 'interaction.root-index', 'interaction.runtime-shell-adapted']) assert.equal(entry(committed, id).status, 'MATCH', id);
});
await test('successor identities: S8-5B router/Deepen/governed-depth + S8-6 journey and history module; superseded pins recorded but never accepted', () => {
  assert.equal(entry(committed, 'interaction.atl-140-journey').expected, '74bc1919ae6904a3feb8ea115ab9040911055b7f');
  assert.deepEqual(entry(committed, 'interaction.atl-140-journey').supersededPins.map((p) => p.blob), ['2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7', '6c11bf4c89eaf212004beab7a939fd4cda38477c']);
  assert.equal(entry(committed, 'successor.history-sync-module').expected, '52631ec3628a2cf40509f4672a482ca5b2bf8bc3');
  assert.equal(entry(committed, 'successor.api-atlas-router').expected, '60dcb85999eed6d1bbc67e52b7ef6c3667cd5709');
  for (const id of ['successor.atl167-deepen-module', 'successor.governed-depth-api', 'successor.governed-depth-projection', 'successor.s8-5b-identity-record', 'successor.s8-5b-depth-summary-evidence']) assert.equal(entry(committed, id).status, 'MATCH', id);
  assert.equal(blobOf('assets/atl-140-v15-journey.mjs'), '74bc1919ae6904a3feb8ea115ab9040911055b7f');
  assert.equal(blobOf('assets/atl-s8-history-sync.mjs'), '52631ec3628a2cf40509f4672a482ca5b2bf8bc3');
  assert.ok(!JSON.stringify(committed.lineage.map((l) => [l.expected, l.observed])).includes('"2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7"'));
});
await test('DAU remediation result is carried by the manifest (DAU-007 remediated pending audit; evidence PASS, pinned)', () => {
  const l = entry(committed, 'stage.s8-6-dau');
  assert.equal(l.status, 'MATCH'); assert.equal(l.observed.status, 'PASS'); assert.equal(l.observed.testedCommit, C.dauTested); assert.equal(l.observed.evidenceSha256, DAU_EVIDENCE.sha256);
  assert.equal(sha(DAU_EVIDENCE.path), DAU_EVIDENCE.sha256); assert.equal(blobOf(DAU_EVIDENCE.path), DAU_EVIDENCE.gitBlob);
  assert.match(committed.defects['DEF-DAU-007'].status, /^REMEDIATED_BOUNDED_ON_SUCCESSOR_PENDING_ATL181/); assert.equal(committed.defects['DEF-DAU-007'].closedByThisManifest, false);
  const ev = JSON.parse(fs.readFileSync(DAU_EVIDENCE.path, 'utf8')); assert.equal(ev.status, 'PASS');
});

// ------------------------------------------------------------------ supersession of historical assemblies
await test('four historical REPLACE_ASSEMBLY assemblies are mechanically shown NOT to be current authority', () => {
  const ids = committed.supersedes.historicalAssemblies.map((a) => a.id).sort(); assert.deepEqual(ids, ['S7-IMP-003', 'S7-IMP-004', 'S7-IMP-006', 'S7-IMP-021']);
  for (const a of committed.supersedes.historicalAssemblies) {
    assert.equal(a.currentAuthority, false, a.id); assert.equal(a.ancestorOfRc, false, `${a.id} must not be an ancestor of the RC`); assert.equal(a.historyDeleted, false); assert.equal(a.historyMutated, false);
    assert.equal(a.historicalDisposition, 'REPLACE_ASSEMBLY'); assert.ok(a.distinguishingIdentities.length > 0);
    for (const d of a.distinguishingIdentities) assert.equal(d.status, 'ABSENT_FROM_AUTHORITY', `${a.id}:${d.exclusion}`);
    assert.notEqual(cp.spawnSync('git', ['-c', `safe.directory=${root}`, 'merge-base', '--is-ancestor', a.commit, 'HEAD'], {cwd: root}).status, 0, `${a.id} must not be an ancestor of the RC`);
  }
  assert.equal(committed.supersedes.historicalAssemblies.find((a) => a.id === 'S7-IMP-006').rootBlob, '379f988ce807f33dc8fd43b49b227b917a15b8c0');
  assert.notEqual(blobOf('index.html'), '379f988ce807f33dc8fd43b49b227b917a15b8c0');
});
await test('predecessor S8-3F manifest/generator/CLI are untouched (history is not rewritten); S8-6 adds, never edits, prior evidence', () => {
  for (const p of ['release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json', 'lib/release/s8-release-manifest.js', 'scripts/s8-3f-release-manifest.mjs']) assert.equal(git(['diff', '--name-only', C.s8_5bFinalHead, '--', p]), '', p);
  assert.equal(committed.supersedes.predecessorManifest.mutated, false); assert.equal(committed.supersedes.predecessorManifest.blob, '4bdc0873086c514e399d16972875b69716d69fde');
  const mod = git(['diff', '--name-status', C.s8_5bFinalHead, '--', 'governance/product']).split('\n').filter(Boolean).filter((l) => !/^A\t/.test(l));
  assert.deepEqual(mod, [], 'prior governance/product evidence must not be modified or deleted');
});
await test('exclusions: every stale / superseded / wrong-donor identity is absent from the RC tree and is not authority', () => {
  for (const x of committed.exclusions) { assert.equal(x.currentAuthority, false, x.id); assert.equal(x.status, 'ABSENT_FROM_AUTHORITY', x.id); if (x.locations) assert.deepEqual(x.locations, [], x.id); }
  for (const id of ['excluded.superseded-ask-api', 'excluded.atl-142-root-index', 'excluded.atl-140-root-index', 'excluded.superseded-journey-s8-4', 'excluded.superseded-journey-s8-5b', 'excluded.superseded-api-atlas-s8-4', 'excluded.atl-141-rc-commit', 'excluded.divergent-source-commit']) assert.ok(committed.exclusions.some((x) => x.id === id), id);
  assert.deepEqual(committed.staleLineageMarkerFiles, []);
  assert.ok(git(['ls-files', '-s']).indexOf('cb2bcfea0892adf5a871fb4584461b50729ab383') === -1, 'superseded Ask blob must not be tracked anywhere in the RC tree');
});

// ------------------------------------------------------------------ source custody
await test('source custody is self-contained: committed copy, blob/sha256/task hash pinned; no divergent-commit read', async () => {
  const c = committed.sourceCustody;
  assert.equal(c.gitBlob, 'd06974e9ee86cea59227e0866a98ad5d1367bfad'); assert.equal(c.sha256, 'c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4'); assert.equal(c.taskHash, 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65');
  assert.equal(blobOf(c.path), c.gitBlob); assert.equal(sha(c.path), c.sha256);
  assert.equal(c.readsDivergentCommit, false); assert.equal(c.deployed, false);
  const src = JSON.parse(fs.readFileSync(c.path, 'utf8')); assert.equal(canonicalHash(src.tasks.find((t) => t.taskId === 'LTL-04')), c.taskHash);
  for (const p of ['lib/release/s8-6-successor-manifest.js', 'lib/release/s8-6-release-control.js', 'lib/release/s8-6-package-builder.js', 'scripts/s8-6-successor-manifest.mjs']) {
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(!/(show|rev-parse|cat-file|ls-tree|checkout|fetch)[^\n]*divergentSource/.test(t), `${p} must not read the divergent commit`);
    assert.ok(!/\$\{C\.divergentSource\}:/.test(t), `${p} must not address a path at the divergent commit`);
  }
  assert.equal(entry(committed, 'source.road-ltl-v1.4').custody, true);
});
await test('custody is excluded from deployment (.vercelignore) and absent from both packages', () => {
  assert.ok(fs.readFileSync('.vercelignore', 'utf8').split('\n').includes('release/custody/'));
  for (const ch of CHANNELS) assert.ok(!planPackage(root, ch).some((f) => f.startsWith('release/custody/') || f.startsWith('release/manifests/')), ch);
});

// ------------------------------------------------------------------ protected boundary
await test('protected derivatives carry identity/classification/custody only (no bytes, no path); no tracked file equals protected bytes', () => {
  for (const p of PROTECTED) { const l = entry(committed, p.id); assert.equal(l.classification, 'EXECUTION_PROTECTED'); assert.equal(l.bytesPublished, false); for (const k of ['path', 'content', 'bytes', 'body']) assert.ok(!(k in l), `${p.id}.${k}`); }
  const protectedShas = new Set(PROTECTED.filter((p) => p.kind === 'SHA256_BYTES').map((p) => p.expected));
  for (const f of trackedFiles(root)) { if (!fs.existsSync(f) || !fs.statSync(f).isFile() || fs.statSync(f).size > 30e6) continue; assert.ok(!protectedShas.has(sha(f)), `protected bytes tracked: ${f}`); }
  assert.deepEqual(trackedFiles(root).filter((f) => /\.(bpmn|svg)$/i.test(f) && /s8-[3-6]|release\//.test(f)), []);
});
await test('stale WD id appears in packages only as the pinned S8-2D governed schema const (permitted, identical bytes to the tracked contract)', () => {
  const occ = committed.packages.staleMarkerOccurrences; assert.ok(occ.length >= 1);
  for (const o of occ) { assert.equal(o.permitted, true, `${o.channel}:${o.path}`); assert.equal(o.path, 'data/contracts/atlas-client-binding-set-v1.schema.json'); assert.equal(o.gitBlob, entry(committed, 'contract.client-binding-set-schema').expected); }
  assert.equal(blobOf('data/contracts/atlas-client-binding-set-v1.schema.json'), entry(committed, 'contract.client-binding-set-schema').expected);
});
await test('no ATL-157 / LTL-04 daughter or depth materialization in the RC tree (fail-closed)', () => {
  const m = ltl04Materialization(root); assert.deepEqual(m.violations, []); assert.equal(m.atl157InProduct, false); assert.equal(m.ltl04DaughterOrDepthMaterialized, false);
  assert.deepEqual(committed.ltl04Materialization, m);
  assert.deepEqual(trackedFiles(root).filter((f) => /^data\/modules\/road-ltl-v1\.4/.test(f)), []);
});

// ------------------------------------------------------------------ packages (Lab/Stable)
await test('Lab and Stable packages verify exactly (file set + bytes + manifest + channel marker)', () => {
  for (const ch of CHANNELS) { const v = verifyPackageDir(root, ch); assert.deepEqual(v.failures, [], ch); assert.equal(v.ok, true); assert.equal(committed.packages[ch].treeSha256, v.treeSha256); assert.equal(committed.packages[ch].fileCount, v.fileCount); }
  assert.equal(fs.readFileSync('release/packages/lab/RELEASE_CHANNEL', 'utf8'), 'lab\n'); assert.equal(fs.readFileSync('release/packages/stable/RELEASE_CHANNEL', 'utf8'), 'stable\n');
});
await test('package build is deterministic (rebuild into a scratch dir is byte-identical)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 's8-6-pkg-'));
  try {
    const s1 = buildPackages(root, {outDir: path.join(tmp, 'a')}); const s2 = buildPackages(root, {outDir: path.join(tmp, 'b')});
    assert.deepEqual(s1, s2);
    for (const ch of CHANNELS) { assert.equal(s1[ch].treeSha256, committed.packages[ch].treeSha256); assert.deepEqual(verifyPackageDir(root, ch, path.join(tmp, 'a', ch)).failures, []); }
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
});
await test('packages carry the CURRENT identities (root, Canvas, bridge, Ask 2.0.1, router/API incl. governed-depth-summary, journey, history, Deepen)', () => {
  for (const [p, v] of Object.entries(committed.packages.carriesCurrentIdentities)) { assert.ok(v.tree, p); assert.equal(v.tree, v.lab, `lab ${p}`); assert.equal(v.tree, v.stable, `stable ${p}`); assert.equal(v.tree, blobOf(p), p); }
  for (const ch of CHANNELS) for (const p of ['assets/atl-s8-history-sync.mjs', 'assets/atl-140-v15-journey.mjs', 'lib/api/governed-depth-summary.js', 'lib/projections/governed-depth-summary.js', 'api/atlas.js', 'index.html', 'runtime/universal-ask-atlas.js']) assert.equal(git(['hash-object', `release/packages/${ch}/${p}`]), blobOf(p), `${ch}:${p}`);
  assert.match(fs.readFileSync('release/packages/lab/api/atlas.js', 'utf8'), /governed-depth-summary/);
});
await test('superseded Ask blob and stale package files are gone; protected/custody/test/compile material is absent; .vercelignore is respected', () => {
  for (const ch of CHANNELS) {
    const d = describePackage(root, ch);
    assert.ok(!d.entries.some((e) => e.gitBlob === 'cb2bcfea0892adf5a871fb4584461b50729ab383'), `${ch}: superseded Ask`);
    for (const e of d.entries) { assert.ok(!/^(tests|scripts|prototypes|audits|frozen-assets|lib\/compile|lib\/release|release\/custody|release\/manifests|release\/packages|execution\/(runtimes|adapters|core|contracts))\//.test(e.path) || e.path === 'scripts/seed-v2-workdefinitions.mjs', `${ch}: ${e.path}`); }
    assert.ok(!fs.existsSync(`release/packages/${ch}/README_DEPLOY.txt`));
    assert.ok(!d.entries.some((e) => e.path === 'execution/manifest.json'));
  }
  assert.ok(!planPackage(root, 'stable').includes('accounts-payable-fixture-standalone.html')); assert.ok(planPackage(root, 'lab').includes('accounts-payable-fixture-standalone.html'));
  assert.ok(planPackage(root, 'lab').some((f) => f.startsWith('pilot/'))); assert.ok(!planPackage(root, 'stable').some((f) => f.startsWith('pilot/')));
});
await test('package runtime check: release-integrity handler, router and governed-depth handler execute inside each package directory', () => {
  const script = `const path=require('node:path');(async()=>{const dir=process.cwd();const call=async(mod,req)=>{let out={};const res={statusCode:200,setHeader(){},getHeader(){},end(b){out.body=b},status(c){this.statusCode=c;return this},json(b){out.body=JSON.stringify(b)},write(){}};await mod.default(req,res);out.status=res.statusCode;return out};const ri=await import(path.join(dir,'lib/api/release-integrity.js'));const r=await call(ri,{method:'GET',headers:{},query:{}});const b=JSON.parse(r.body||'{}');const router=await import(path.join(dir,'api/atlas.js'));const gd=await import(path.join(dir,'lib/api/governed-depth-summary.js'));console.log(JSON.stringify({status:r.status,ok:b.ok,files:(b.files||[]).length,bad:(b.files||[]).filter(x=>!x.ok).map(x=>x.rel),router:typeof router.default,gd:typeof gd.default}))})().catch(e=>{console.log(JSON.stringify({error:e.message}));process.exit(1)})`;
  for (const ch of CHANNELS) {
    const out = cp.execFileSync(process.execPath, ['-e', script], {cwd: path.resolve('release/packages', ch), encoding: 'utf8'}).trim().split('\n').pop();
    const j = JSON.parse(out); assert.equal(j.status, 200, `${ch} ${out}`); assert.equal(j.ok, true); assert.deepEqual(j.bad, []); assert.equal(j.router, 'function'); assert.equal(j.gd, 'function'); assert.equal(j.files, committed.releaseIntegrity.baseline.fileCount);
  }
});

// ------------------------------------------------------------------ release integrity (reconciled, never waived)
await test('regenerated release-integrity baseline PASSES at the RC (repo root) and covers every successor-critical file', () => {
  const v = verifyBaseline(root); assert.equal(v.status, 'PASSES_VERIFICATION'); assert.deepEqual(v.mismatches, []);
  const b = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  for (const p of ['assets/atl-140-v15-journey.mjs', 'assets/atl-s8-history-sync.mjs', 'assets/atl-167-v15-deepen-inspect.mjs', 'lib/api/governed-depth-summary.js', 'runtime/universal-ask-atlas.js', 'index.html', 'execution/ui/runtime-access-shell.js', 'canvas-v2/canvas-v2/index.html']) assert.ok(p in b.files, p);
  const base = JSON.parse(git(['show', `${BASE_COMMIT}:${BASELINE_PATH}`]));
  for (const p of Object.keys(base.files)) assert.ok(p in b.files, `old baseline file ${p} still covered`);
  assert.equal(committed.releaseIntegrity.observedVerification.status, 'PASSES_VERIFICATION');
});
await test('drift is reconciled, not waived: 12 drifted files classified (authorized, in RC, not stale, not accidental); zero unexplained; verifier not weakened', () => {
  const r = JSON.parse(fs.readFileSync(DRIFT_RECON_PATH, 'utf8'));
  assert.equal(r.summary.driftCount, 12); assert.equal(r.summary.unexplainedCount, 0); assert.equal(r.summary.allReconciled, true);
  for (const e of r.entries.filter((x) => x.status === 'DRIFT')) { assert.equal(e.reconciled, true, e.path); for (const k of ['tracked', 'authorized', 'inRc', 'notStale', 'notAccidental']) assert.equal(e.checks[k], true, `${e.path}.${k}`); }
  assert.equal(rcSerialize(buildDriftReconciliation(root)), fs.readFileSync(DRIFT_RECON_PATH, 'utf8'));
  assert.equal(blobOf('lib/api/release-integrity.js'), git(['rev-parse', `${BASE_COMMIT}:lib/api/release-integrity.js`]), 'verifier unchanged since the S8-5B base');
  assert.equal(committed.releaseIntegrity.driftWaived, false); assert.equal(committed.releaseIntegrity.verifierWeakened, false);
  // the PRE-S8-6 baseline did fail at the base: the drift is real and was repaired by regeneration, not hidden
  const baseBaseline = JSON.parse(git(['show', `${BASE_COMMIT}:${BASELINE_PATH}`])); let drift = 0; for (const [p, h] of Object.entries(baseBaseline.files)) { const f = path.join(root, p); if (!fs.existsSync(f) || sha(f) !== h) drift++; } assert.equal(drift, 12);
});

// ------------------------------------------------------------------ rollback
await test('rollback manifest: three frozen production-baseline assets verified by sha256; reference-only; no candidate/stale branch nominated', () => {
  const v = verifyRollbackManifest(root); assert.deepEqual(v.failures, []);
  const rb = JSON.parse(fs.readFileSync(ROLLBACK_MANIFEST_PATH, 'utf8'));
  assert.equal(rcSerialize(buildRollbackManifest(root)), rcSerialize(rb)); assert.equal(rb.injectedIntoActiveV15Execution, false); assert.equal(rb.productionPromotionAuthorized, false);
  assert.deepEqual(rb.assets.map((a) => [a.path, a.expectedSha256, a.status]), [['data/modules/road-ltl-v1.3.json', '0f855cc0b11991a0f58a76791d64def8b688f4349b0e5bd1105161241f7ad808', 'MATCH'], ['data/modules/ocean-fcl-v0.5.json', '71526914c600cb10c47434a5b6dc064e851062776a336ae480f37e487e108ebc', 'MATCH'], ['data/modules/ocean-lcl-v0.5.json', '9dbaadc129a6c8be30e9e77c7ff319af40a9f5c4226e82817c2389cde01d18e6', 'MATCH']]);
  for (const a of ROLLBACK_ASSETS) assert.equal(sha(a.path), a.sha256);
  for (const n of rb.notRollbackTargets) assert.equal(n.nominatedAsRollback, false);
  const txt = JSON.stringify(rb.nominatedRollbackTargets); for (const bad of ['atl-175', 'atl-141', 'atl-142', 'dd32b8a4', 'ef6e375c']) assert.ok(!txt.includes(bad), bad);
  assert.equal(committed.rollback.deploymentRollbackIdentity, 'NOT_ESTABLISHED (no deployment exists; none inferred)');
});
await test('rollback reference material is not injected into active execution (not packaged, not imported by runtime code)', () => {
  for (const ch of CHANNELS) assert.ok(!planPackage(root, ch).includes(ROLLBACK_MANIFEST_PATH));
  for (const f of trackedFiles(root).filter((x) => /^(api|runtime|assets|lib\/api|lib\/ask|lib\/projections|execution\/ui)\//.test(x) && /\.(js|mjs|cjs|html)$/.test(x))) assert.ok(!fs.readFileSync(f, 'utf8').includes('atlas-v1.5-successor-s8-rollback'), f);
});

// ------------------------------------------------------------------ controls / state / defects / downstream
await test('controls: Owner gate required; production promotion false; exact identity fail-closed; no frozen-asset mutation; deployment candidate is identity only', () => {
  const c = committed.controls; assert.equal(c.ownerGateRequired, true); assert.equal(c.productionPromotionAuthorized, false); assert.equal(c.identityVerification.mode, 'EXACT'); assert.equal(c.identityVerification.onMismatch, 'FAIL_CLOSED'); assert.equal(c.frozenAssetMutationAllowed, false);
  assert.equal(committed.deploymentCandidate.class, 'IDENTITY_ONLY_NOT_A_DEPLOYMENT'); assert.equal(committed.deploymentCandidate.deployed, false);
  assert.equal(committed.deploymentCandidate.packages.lab.treeSha256, committed.packages.lab.treeSha256);
});
await test('runtime readiness remains blocked and the blocked leaves stay visible', () => {
  const rt = committed.runtimeState; assert.equal(rt.universalExecutionReady, false); assert.equal(rt.materializable, false); assert.equal(rt.runtimeCertification, false); assert.equal(rt.projectionDisposition, 'BLOCKED'); assert.equal(rt.runtimeReadiness, 'NOT_PROMOTED');
  assert.equal(rt.unresolvedBindingCount, 1); assert.equal(rt.notCompiledLeafCount, 4); assert.equal(rt.blockedByClientBindingLeafCount, 2); assert.equal(rt.blockedByKnowledgeGapLeafCount, 2); assert.equal(rt.independentExecutorProofStatus, 'NOT_INDEPENDENTLY_PROVEN');
});
await test('deferred v2 obligations are preserved (not PASS); DEF-GOV-002 preserved open; DEF-REL-ASSET-001 S8 portion closed only on full proofs; downstream states', () => {
  assert.deepEqual(committed.deferredV2Obligations.map((d) => d.id).sort(), ['ATL-107', 'ATL-71', 'F-130-06', 'V2-BOL-FIRI', 'V2-GENERALIZED-INTERACTION', 'V2-RUNTIME-READINESS-PROFILES']);
  for (const d of committed.deferredV2Obligations) { assert.equal(d.status, 'DEFERRED_NOT_PASS'); assert.equal(d.markedPass, false); }
  assert.equal(committed.defects['DEF-GOV-002'].status, 'PRESERVED_OPEN'); assert.equal(committed.defects['DEF-GOV-002'].silentlyClosed, false);
  const a = committed.defects['DEF-REL-ASSET-001']; assert.equal(a.s8Portion, 'CLOSED_S8_PORTION'); for (const [k, v] of Object.entries(a.proofs)) assert.equal(v, true, k); assert.equal(a.closesRuntimeReadiness, false);
  assert.equal(committed.downstream['S8-5'], 'COMPLETE/PASS'); assert.match(committed.downstream['ATL-181'], /^BLOCKED/); assert.equal(committed.downstream.release, 'DO NOT MERGE / DO NOT PROMOTE');
  for (const p of ['gov-002-residual-routing.md', 'v2-preservation-handoff.md']) assert.ok(fs.existsSync(`governance/product/s8-6-evidence/${p}`), p);
});
await test('generator/builder paths are pinned in the manifest and carry no stale WD marker; S8-6 generators exist and are the pinned blobs', () => {
  assert.deepEqual(committed.generator.paths, [...GENERATOR_PATHS]); for (const p of GENERATOR_PATHS) { assert.equal(committed.generator.blobs[p], blobOf(p), p); assert.ok(!fs.readFileSync(p, 'utf8').includes(STALE_WD_MARKER), p); }
  for (const p of committed.packages.builder.paths) assert.equal(committed.packages.builder.blobs[p], blobOf(p), p);
});

// ------------------------------------------------------------------ scope: every change vs the S8-5B base is classified
await test('changed-path classification: every path changed since the S8-5B base is classified; frozen donors/root/shell/Canvas/bridge/Ask are byte-identical', () => {
  const rows = git(['diff', '--name-status', '--no-renames', C.s8_5bFinalHead]).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const classes = [
    ['DAU_REMEDIATION_MODULE', /^assets\/(atl-s8-history-sync|atl-140-v15-journey)\.mjs$/], ['DAU_REMEDIATION_TESTS', /^tests\/s8-6-(dau|support)/], ['DAU_REMEDIATION_EVIDENCE', /^governance\/product\/(S8_6_DAU_HISTORY_SYNC\.md|s8-6-evidence\/(run-dau-qa\.cjs|dau-exact-qa\.json))$/],
    ['RC_GENERATOR', /^(lib\/release\/s8-6-|scripts\/s8-6-|release\/scripts\/s8-6-)/], ['RC_TESTS', /^tests\/s8-6-(successor-rc|rc-mutations)/], ['RC_CUSTODY', /^release\/custody\/s8-6\//], ['RC_DEPLOY_EXCLUSION', /^\.vercelignore$/],
    ['RC_RELEASE_CONTROL', /^(release\/baselines\/v2-critical-hashes\.json|release\/manifests\/atlas-v1\.5-successor-s8-(rc|rollback)\.json|governance\/product\/s8-6-evidence\/release-integrity-drift-reconciliation\.json)$/],
    ['RC_PACKAGES_REPLACED', /^release\/packages\/(lab|stable)\//], ['RC_EVIDENCE_AND_DOCS', /^governance\/product\/(S8_6_[A-Z_]+\.md|s8-6-evidence\/[^/]+)$/]
  ];
  const unclassified = []; const bucket = {};
  for (const [st, p] of rows) { const hit = classes.find(([, re]) => re.test(p)); if (!hit) { unclassified.push(`${st} ${p}`); continue; } (bucket[hit[0]] ??= []).push(`${st} ${p}`); if (st === 'D') assert.ok(hit[0] === 'RC_PACKAGES_REPLACED', `deletion outside the replaced packages: ${p}`); }
  assert.deepEqual(unclassified, [], 'unclassified changed paths');
  for (const p of ['index.html', 'execution/ui/runtime-access-shell.js', 'canvas-v2/canvas-v2/index.html', 'canvas-v2/canvas-v2/assets/canvas-v2.js', 'canvas-v2/canvas-v2/assets/canvas-v2.css', 'assets/canvas-daughter-bridge-v2.0.1.mjs', 'runtime/universal-ask-atlas.js', 'lib/api/ask-atlas.js', 'lib/ask/p5-governed-retrieval.js', 'governance/ask-atlas-surface-contract-v1.json', 'api/atlas.js', 'lib/api/release-integrity.js', 'release/release-meta.js']) assert.equal(git(['diff', '--name-only', C.s8_5bFinalHead, '--', p]), '', `${p} must be byte-identical to the base`);
});

// ------------------------------------------------------------------ negative / mutation (manifest level)
await rejects('S8-5B journey identity omitted', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'interaction.atl-140-journey'); }, 'SUCCESSOR_IDENTITY_MISSING');
await rejects('journey replaced by the S8-4 journey pin', (m) => { entry(m, 'interaction.atl-140-journey').expected = '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7'; entry(m, 'interaction.atl-140-journey').observed = '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7'; }, 'JOURNEY_IDENTITY_REPLACED');
await rejects('journey replaced by the S8-5B journey pin', (m) => { entry(m, 'interaction.atl-140-journey').expected = '6c11bf4c89eaf212004beab7a939fd4cda38477c'; }, 'JOURNEY_IDENTITY_REPLACED');
await rejects('history module identity omitted', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'successor.history-sync-module'); }, 'SUCCESSOR_IDENTITY_MISSING');
await rejects('old api/atlas.js (S8-4 router) restored as the pin', (m) => { entry(m, 'successor.api-atlas-router').expected = 'bf872b2b66cb222e53a5e9cff4a47dbeab65c546'; entry(m, 'successor.api-atlas-router').observed = 'bf872b2b66cb222e53a5e9cff4a47dbeab65c546'; }, 'IDENTITY_REPLACED_OR_STALE');
await rejects('stale ATL-142 root nominated as authority', (m) => { m.supersedes.historicalAssemblies.find((a) => a.id === 'S7-IMP-006').currentAuthority = true; }, 'STALE_ATL142_ROOT');
await rejects('stale ATL-142 custody assembly nominated as authority', (m) => { m.supersedes.historicalAssemblies.find((a) => a.id === 'S7-IMP-004').currentAuthority = true; }, 'STALE_ATL142_ROOT');
await rejects('stale ATL-141 RC nominated as authority', (m) => { m.supersedes.historicalAssemblies.find((a) => a.id === 'S7-IMP-003').currentAuthority = true; }, 'STALE_ATL141_RC_NOMINATED');
await rejects('stale ATL-141 release-integrity assembly nominated', (m) => { m.supersedes.historicalAssemblies.find((a) => a.id === 'S7-IMP-021').currentAuthority = true; }, 'STALE_ATL141_RC_NOMINATED');
await rejects('historical assembly record dropped', (m) => { m.supersedes.historicalAssemblies = m.supersedes.historicalAssemblies.filter((a) => a.id !== 'S7-IMP-021'); }, 'HISTORICAL_ASSEMBLY_RECORD_MISSING');
await rejects('historical evidence rewritten (predecessor manifest relabelled mutated)', (m) => { m.supersedes.predecessorManifest.mutated = true; }, 'HISTORICAL_EVIDENCE_REWRITTEN');
await rejects('historical assembly marked mutated', (m) => { m.supersedes.historicalAssemblies[0].historyMutated = true; }, 'HISTORICAL_EVIDENCE_REWRITTEN');
await rejects('superseded Ask carried as the current Ask API pin', (m) => { entry(m, 'interaction.ask-api').expected = 'cb2bcfea0892adf5a871fb4584461b50729ab383'; entry(m, 'interaction.ask-api').observed = 'cb2bcfea0892adf5a871fb4584461b50729ab383'; }, 'SUPERSEDED_ASK_INCLUDED');
await rejects('superseded Ask promoted to authority', (m) => { m.exclusions.find((x) => x.id === 'excluded.superseded-ask-api').currentAuthority = true; }, 'STALE_IDENTITY_AS_AUTHORITY');
await rejects('ATL-157 LTL-04 materialization recorded', (m) => { m.ltl04Materialization.ltl04DaughterOrDepthMaterialized = true; m.ltl04Materialization.violations = [{path: 'data/modules/road-ltl-v1.4.json', reason: 'x'}]; }, 'ATL157_LTL04_MATERIALIZED');
await rejects('protected bytes published (bytesPublished)', (m) => { entry(m, 'derivative.wd').bytesPublished = true; }, 'PROTECTED_BYTES_PUBLISHED');
await rejects('protected bytes published (embedded content)', (m) => { entry(m, 'derivative.bpmn').content = '<bpmn/>'; }, 'PROTECTED_BYTES_PUBLISHED');
await rejects('protected path published', (m) => { entry(m, 'derivative.svg').path = 'generated/flow.svg'; }, 'PROTECTED_BYTES_PUBLISHED');
await rejects('source custody entry removed', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'source.road-ltl-v1.4'); }, 'SOURCE_CUSTODY_MISSING');
await rejects('source custody sha256 pin removed', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'custody.source-sha256'); }, 'SOURCE_CUSTODY_MISSING');
await rejects('source custody hash altered', (m) => { entry(m, 'custody.source-sha256').expected = '0'.repeat(64); }, 'SOURCE_HASH_ALTERED');
await rejects('source custody task hash altered', (m) => { entry(m, 'custody.task-hash').expected = '0'.repeat(64); }, 'SOURCE_HASH_ALTERED');
await rejects('divergent-branch dependency re-introduced', (m) => { m.sourceCustody.readsDivergentCommit = true; }, 'DIVERGENT_BRANCH_DEPENDENCY');
await rejects('rollback hash altered', (m) => { m.rollback.nominatedRollbackAssets[0].sha256 = '0'.repeat(64); m.rollback.manifest.verification = 'VERIFIED'; }, 'MANIFEST_DRIFT');
await rejects('rollback points to a stale/candidate branch', (m) => { m.rollback.candidateOrStaleBranchNominated = true; }, 'ROLLBACK_STALE_BRANCH_NOMINATED');
await rejects('rollback injected into active execution', (m) => { m.rollback.injectedIntoActiveV15Execution = true; }, 'ROLLBACK_STALE_BRANCH_NOMINATED');
await rejects('rollback identity not established', (m) => { m.rollback.rollbackIdentityStatus = 'NOT_ESTABLISHED'; }, 'ROLLBACK_IDENTITY_NOT_ESTABLISHED');
await rejects('production promotion true', (m) => { m.controls.productionPromotionAuthorized = true; }, 'PRODUCTION_PROMOTION_AUTHORIZED');
await rejects('Owner gate removed', (m) => { m.controls.ownerGateRequired = false; }, 'OWNER_GATE_REMOVED');
await rejects('identity verification no longer fail-closed', (m) => { m.controls.identityVerification.onMismatch = 'WARN'; }, 'IDENTITY_VERIFICATION_NOT_FAIL_CLOSED');
await rejects('readiness promoted (universalExecutionReady)', (m) => { m.runtimeState.universalExecutionReady = true; }, 'READINESS_PROMOTED');
await rejects('readiness promoted (runtimeReadiness)', (m) => { m.runtimeState.runtimeReadiness = 'PROMOTED'; }, 'READINESS_PROMOTED');
await rejects('blocked leaves hidden (not-compiled count)', (m) => { m.runtimeState.notCompiledLeafCount = 0; }, 'BLOCKED_LEAVES_HIDDEN');
await rejects('blocked leaves hidden (binding state)', (m) => { m.runtimeState.clientBindingState = 'RESOLVED'; }, 'BLOCKED_LEAVES_HIDDEN');
await rejects('deferred ATL-71 marked PASS', (m) => { const d = m.deferredV2Obligations.find((x) => x.id === 'ATL-71'); d.status = 'PASS'; d.markedPass = true; }, 'DEFERRED_MARKED_PASS');
await rejects('deferred F-130-06 marked PASS', (m) => { const d = m.deferredV2Obligations.find((x) => x.id === 'F-130-06'); d.status = 'PASS'; d.markedPass = true; }, 'DEFERRED_MARKED_PASS');
await rejects('deferred obligation dropped', (m) => { m.deferredV2Obligations = m.deferredV2Obligations.filter((x) => x.id !== 'ATL-107'); }, 'DEFERRED_OBLIGATION_MISSING');
await rejects('DEF-GOV-002 silently closed', (m) => { m.defects['DEF-GOV-002'].status = 'CLOSED'; m.defects['DEF-GOV-002'].silentlyClosed = true; }, 'GOV_002_SILENTLY_CLOSED');
await rejects('release-integrity drift waived', (m) => { m.releaseIntegrity.driftWaived = true; }, 'INTEGRITY_DRIFT_WAIVED');
await rejects('release-integrity verifier weakened', (m) => { m.releaseIntegrity.verifierWeakened = true; }, 'INTEGRITY_DRIFT_WAIVED');
await rejects('release-integrity state falsified', (m) => { m.releaseIntegrity.observedVerification.status = 'FAILS_VERIFICATION'; }, 'RELEASE_INTEGRITY_STATE_DRIFT');
await rejects('DAU-007 result omitted', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'stage.s8-6-dau'); }, 'DAU_RESULT_OMITTED');
await rejects('DAU-007 defect record omitted', (m) => { delete m.defects['DEF-DAU-007']; }, 'DAU_RESULT_OMITTED');
await rejects('DEF-REL-ASSET-001 closed without proofs', (m) => { m.defects['DEF-REL-ASSET-001'].s8Portion = 'CLOSED_S8_PORTION'; m.defects['DEF-REL-ASSET-001'].proofs.packagesVerifiedExact = false; }, 'DEF_REL_ASSET_CLOSED_WITHOUT_PROOFS');
await rejects('downstream altered (ATL-181 unblocked)', (m) => { m.downstream['ATL-181'] = 'READY'; }, 'DOWNSTREAM_STATE_ALTERED');
await rejects('downstream altered (release mergeable)', (m) => { m.downstream.release = 'MERGE'; }, 'DOWNSTREAM_STATE_ALTERED');
await rejects('exclusion record removed', (m) => { m.exclusions = m.exclusions.filter((x) => x.id !== 'excluded.atl-142-root-index'); }, 'EXCLUSION_RECORD_MISSING');
await rejects('exclusion reclassified', (m) => { m.exclusions[0].classification = 'ALLOWED'; }, 'EXCLUSION_RECLASSIFIED');
await rejects('stale WD lineage marker reported', (m) => { m.staleLineageMarkerFiles = ['assets/atl-140-v15-journey.mjs']; }, 'STALE_WD_LINEAGE_MARKER');
await rejects('Lab package declared unverified', (m) => { m.packages.lab.verification = 'FAILED'; }, 'PACKAGE_NOT_VERIFIED');
await rejects('manifest hand-edited (not equal to deterministic regeneration)', (m) => { m.generator.hand = 'edited'; }, 'MANIFEST_DRIFT');
await rejects('schema version altered', (m) => { m.schemaVersion = 'atlas-v1.5-successor-rc-manifest-v0'; }, 'SCHEMA_VERSION_MISMATCH');

const failed = results.filter((r) => !r.ok);
console.log(`\nS8-6 RC: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'));
console.log(JSON.stringify({suite: 's8-6-successor-rc', total: results.length, passed: results.length - failed.length, failed: failed.length}));
if (failed.length) process.exit(1);
