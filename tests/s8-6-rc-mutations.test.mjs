import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {SUCCESSOR_MANIFEST_PATH, C, verifySuccessorManifest} from '../lib/release/s8-6-successor-manifest.js';
import {BASELINE_PATH, ROLLBACK_MANIFEST_PATH, DRIFT_RECON_PATH, baselinePaths, buildBaseline, buildDriftReconciliation, serialize as rcSerialize} from '../lib/release/s8-6-release-control.js';
import {canonicalHash} from '../lib/compile/workdefinition-compiler.js';

// S8-6 successor RC mutation suite (filesystem level). Each mutation is applied to an isolated scratch git worktree of HEAD (+ the working-tree overlay),
// never to the working tree, and the successor-manifest verifier (which recomputes every identity from the repository) must REJECT it with one of the
// expected failure codes. A clean control must PASS. A surviving mutation fails this suite.
const root = process.cwd();
const git = (args, cwd = root) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd, encoding: 'utf8', maxBuffer: 300000000}).trim();
const gitBuf = (args, cwd = root) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd, maxBuffer: 300000000});
const committed = JSON.parse(fs.readFileSync(SUCCESSOR_MANIFEST_PATH, 'utf8'));
const only = process.env.S8_6_MUT_ONLY ? new RegExp(process.env.S8_6_MUT_ONLY) : null;

const tmp = fs.mkdtempSync(path.join(process.env.S8_6_MUT_TMP ?? os.tmpdir(), 's8-6-rcmut-'));
const dir = path.join(tmp, 'scratch');
let baseSha = null;
function makeScratch() {
  git(['worktree', 'add', '--detach', dir, 'HEAD']);
  // overlay: working-tree state (modified/untracked/deleted) so the harness also runs before the RC is committed
  const changed = [...new Set([...git(['diff', '--name-only', '--no-renames', '-z', 'HEAD']).split('\0'), ...git(['ls-files', '-o', '--exclude-standard', '-z']).split('\0')].filter(Boolean))];
  for (const f of changed) { const s = path.join(root, f); if (!fs.existsSync(s)) { fs.rmSync(path.join(dir, f), {force: true}); continue; } if (!fs.statSync(s).isFile()) continue; fs.mkdirSync(path.dirname(path.join(dir, f)), {recursive: true}); fs.copyFileSync(s, path.join(dir, f)); }
  git(['add', '-A'], dir);
  git(['-c', 'user.name=s8-6-mutation', '-c', 'user.email=mut@example.invalid', 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'overlay'], dir);
  baseSha = git(['rev-parse', 'HEAD'], dir);
}
const reset = () => { git(['reset', '-q', '--hard', baseSha], dir); git(['clean', '-fdq'], dir); };
const cleanup = () => { try { git(['worktree', 'remove', '--force', dir]); } catch { /* ignore */ } try { git(['worktree', 'prune']); } catch { /* ignore */ } fs.rmSync(tmp, {recursive: true, force: true}); };
const rw = (rel, fn) => { const p = path.join(dir, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
const rwJson = (rel, fn) => { const p = path.join(dir, rel); const j = JSON.parse(fs.readFileSync(p, 'utf8')); fn(j); fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); };
const putBlob = (rel, blob) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true}); fs.writeFileSync(path.join(dir, rel), gitBuf(['cat-file', 'blob', blob])); };
const rm = (rel) => fs.rmSync(path.join(dir, rel), {force: true});

const M = [
  {id: 'R01-OLD-S8-4-JOURNEY-RESTORED', name: 'old S8-4 journey (2c97dbde) restored', apply: () => putBlob('assets/atl-140-v15-journey.mjs', '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7'), expect: ['OLD_JOURNEY_RESTORED', 'JOURNEY_IDENTITY_REPLACED', 'SUCCESSOR_IDENTITY_MISMATCH']},
  {id: 'R02-OLD-S8-5B-JOURNEY-RESTORED', name: 'S8-5B journey (6c11bf4c, no history registration) restored', apply: () => putBlob('assets/atl-140-v15-journey.mjs', '6c11bf4c89eaf212004beab7a939fd4cda38477c'), expect: ['OLD_JOURNEY_RESTORED', 'SUCCESSOR_IDENTITY_MISMATCH']},
  {id: 'R03-OLD-API-ATLAS-RESTORED', name: 'old S8-4 api/atlas.js (no governed-depth-summary) restored', apply: () => putBlob('api/atlas.js', 'bf872b2b66cb222e53a5e9cff4a47dbeab65c546'), expect: ['OLD_API_ATLAS_RESTORED', 'SUCCESSOR_IDENTITY_MISMATCH']},
  {id: 'R04-STALE-ATL142-ROOT', name: 'stale ATL-142 root (379f988c) restored as index.html', apply: () => putBlob('index.html', '379f988ce807f33dc8fd43b49b227b917a15b8c0'), expect: ['STALE_ATL142_ROOT']},
  {id: 'R05-STALE-ATL140-ROOT', name: 'stale ATL-140 root (9cf88a86) restored as index.html', apply: () => putBlob('index.html', '9cf88a867359ba33ebfbe85c1360f0ab21bc29b3'), expect: ['STALE_ATL140_ROOT']},
  {id: 'R06-STALE-ATL141-RC-ANCESTRY', name: 'stale ATL-141 RC commit (ef6e375c) becomes an ancestor of the RC', apply: () => { const t = git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-p', C.atl141Rc, '-m', 'merge stale ATL-141 RC'], dir); git(['reset', '-q', '--hard', t], dir); }, expect: ['STALE_ATL141_RC_NOMINATED']},
  {id: 'R07-STALE-ATL142-CUSTODY-ANCESTRY', name: 'stale ATL-142 commit (dba6968b) becomes an ancestor of the RC', apply: () => { const t = git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-p', C.atl142, '-m', 'merge stale ATL-142'], dir); git(['reset', '-q', '--hard', t], dir); }, expect: ['STALE_ATL142_ROOT']},
  {id: 'R08-SUPERSEDED-ASK-IN-TREE', name: 'superseded Ask API (cb2bcfea) restored as lib/api/ask-atlas.js', apply: () => putBlob('lib/api/ask-atlas.js', 'cb2bcfea0892adf5a871fb4584461b50729ab383'), expect: ['SUPERSEDED_ASK_INCLUDED']},
  {id: 'R09-SUPERSEDED-ASK-IN-LAB', name: 'superseded Ask API copied into the Lab package', apply: () => putBlob('release/packages/lab/lib/api/ask-atlas.js', 'cb2bcfea0892adf5a871fb4584461b50729ab383'), expect: ['SUPERSEDED_ASK_INCLUDED', 'PACKAGE_STALE_OR_DRIFTED_FILE']},
  {id: 'R10-ATL157-LTL04-MODULE', name: 'ATL-157 LTL-04 daughter source materialized as data/modules/road-ltl-v1.4.json', apply: () => { fs.copyFileSync(path.join(dir, 'release/custody/s8-6/road-ltl-v1.4.governed-source.json'), path.join(dir, 'data/modules/road-ltl-v1.4.json')); }, expect: ['ATL157_LTL04_MATERIALIZED']},
  {id: 'R11-ATL157-MECHANISM-IN-PRODUCT', name: 'ATL-157 bounded-depth mechanism shipped in a product path', apply: () => { fs.writeFileSync(path.join(dir, 'lib/api/atl-157-bounded-depth.js'), 'export default function handler(){return null}\n'); }, expect: ['ATL157_LTL04_MATERIALIZED']},
  {id: 'R12-PROTECTED-BYTES-PUBLISHED', name: 'protected derivative bytes written into a tracked public path', apply: () => { fs.writeFileSync(path.join(dir, 'governance/product/s8-6-evidence/flow.bpmn'), '<bpmn/>'); }, expect: ['PROTECTED_BYTES_PUBLISHED']},
  {id: 'R13-CUSTODY-REMOVED', name: 'source custody copy removed', apply: () => rm('release/custody/s8-6/road-ltl-v1.4.governed-source.json'), expect: ['SOURCE_CUSTODY_MISSING', 'SOURCE_CUSTODY_DRIFT']},
  {id: 'R14-CUSTODY-HASH-ALTERED', name: 'source custody bytes altered (one trailing space)', apply: () => rw('release/custody/s8-6/road-ltl-v1.4.governed-source.json', (s) => s + ' '), expect: ['SOURCE_HASH_ALTERED']},
  {id: 'R15-CUSTODY-PINS-REMOVED', name: 'custody pin record removed', apply: () => rm('release/custody/s8-6/custody-pins.json'), expect: ['SOURCE_CUSTODY_MISSING', 'SOURCE_CUSTODY_DRIFT']},
  {id: 'R16-CUSTODY-DEPLOYED', name: 'custody no longer excluded from deployment (.vercelignore)', apply: () => rw('.vercelignore', (s) => s.replace('release/custody/\n', '').replace('release/custody/', '')), expect: ['CUSTODY_NOT_EXCLUDED_FROM_DEPLOYMENT']},
  {id: 'R17-ROLLBACK-ASSET-ALTERED', name: 'rollback target asset (ocean-fcl-v0.5) altered', apply: () => rw('data/modules/ocean-fcl-v0.5.json', (s) => s + '\n'), expect: ['ROLLBACK_ASSET_DRIFT']},
  {id: 'R18-ROLLBACK-HASH-ALTERED', name: 'rollback manifest expected hash altered', apply: () => rwJson(ROLLBACK_MANIFEST_PATH, (j) => { j.assets[0].expectedSha256 = '0'.repeat(64); }), expect: ['ROLLBACK_HASH_ALTERED']},
  {id: 'R19-ROLLBACK-STALE-BRANCH', name: 'rollback manifest nominates a stale candidate branch', apply: () => rwJson(ROLLBACK_MANIFEST_PATH, (j) => { j.notRollbackTargets[0].nominatedAsRollback = true; j.nominatedRollbackTargets.push('atl-175'); }), expect: ['ROLLBACK_STALE_BRANCH_NOMINATED', 'ROLLBACK_TARGET_SET']},
  {id: 'R20-ROLLBACK-INJECTED', name: 'rollback manifest marked injected into active execution', apply: () => rwJson(ROLLBACK_MANIFEST_PATH, (j) => { j.injectedIntoActiveV15Execution = true; }), expect: ['ROLLBACK_INJECTED_INTO_ACTIVE_EXECUTION']},
  {id: 'R21-PROMOTION-TRUE-IN-ROLLBACK', name: 'production promotion authorized in the rollback manifest', apply: () => rwJson(ROLLBACK_MANIFEST_PATH, (j) => { j.productionPromotionAuthorized = true; }), expect: ['PRODUCTION_PROMOTION_AUTHORIZED']},
  {id: 'R22-BASELINE-DRIFT', name: 'unreconciled drift of a baseline-covered file', apply: () => rw('data/atlas-registry.json', (s) => s + '\n'), expect: ['INTEGRITY_BASELINE_FAILS_AT_RC']},
  {id: 'R23-BASELINE-REGENERATED-OVER-UNEXPLAINED-DRIFT', name: 'baseline regenerated over an unexplained post-base change (reconciliation must refuse)', apply: () => {
    rw('stage18-client.js', (s) => s + '\n// unexplained change\n');
    fs.writeFileSync(path.join(dir, DRIFT_RECON_PATH), rcSerialize(buildDriftReconciliation(dir)));
    fs.writeFileSync(path.join(dir, BASELINE_PATH), rcSerialize(buildBaseline(dir, baselinePaths(dir))));
  }, expect: ['INTEGRITY_UNEXPLAINED_DRIFT']},
  {id: 'R24-BASELINE-COVERAGE-REDUCED', name: 'baseline silently drops a covered file (waiver by omission)', apply: () => rwJson(BASELINE_PATH, (j) => { delete j.files['assets/atl-s8-history-sync.mjs']; }), expect: ['INTEGRITY_BASELINE_COVERAGE_REDUCED']},
  {id: 'R25-BASELINE-FAILS-WAIVED-BY-RECON', name: 'reconciliation record falsified to hide drift', apply: () => rwJson(DRIFT_RECON_PATH, (j) => { j.summary.unexplainedCount = 3; j.summary.allReconciled = false; }), expect: ['INTEGRITY_UNEXPLAINED_DRIFT']},
  {id: 'R26-LAB-STALE-FILE', name: 'stale README_DEPLOY.txt left in the Lab package', apply: () => fs.writeFileSync(path.join(dir, 'release/packages/lab/README_DEPLOY.txt'), 'stale\n'), expect: ['PACKAGE_STALE_OR_DRIFTED_FILE']},
  {id: 'R27-STABLE-FILE-DRIFT', name: 'Stable package file altered after build', apply: () => rw('release/packages/stable/assets/atl-140-v15-journey.mjs', (s) => s + '\n// x\n'), expect: ['PACKAGE_STALE_OR_DRIFTED_FILE']},
  {id: 'R28-STABLE-MISSING-HISTORY-MODULE', name: 'history module missing from the Stable package', apply: () => rm('release/packages/stable/assets/atl-s8-history-sync.mjs'), expect: ['PACKAGE_FILE_MISSING']},
  {id: 'R29-PACKAGE-MANIFEST-TAMPERED', name: 'Lab package manifest tampered', apply: () => rwJson('release/packages/lab/PACKAGE_MANIFEST.json', (j) => { j.fileCount += 1; }), expect: ['PACKAGE_STALE_OR_DRIFTED_FILE']},
  {id: 'R30-PROTECTED-EXECUTION-IN-PACKAGE', name: 'protected execution implementation copied into the Stable package', apply: () => { fs.mkdirSync(path.join(dir, 'release/packages/stable/execution/runtimes'), {recursive: true}); fs.writeFileSync(path.join(dir, 'release/packages/stable/execution/runtimes/x.js'), 'x\n'); }, expect: ['PACKAGE_STALE_OR_DRIFTED_FILE']},
  {id: 'R31-HISTORICAL-MANIFEST-REWRITTEN', name: 'predecessor S8-3F manifest rewritten', apply: () => rw('release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json', (s) => s.replace('S8-3F', 'S8-3F ')), expect: ['HISTORICAL_EVIDENCE_REWRITTEN']},
  {id: 'R32-DAU-EVIDENCE-OMITTED', name: 'DAU-007 exact-QA evidence removed', apply: () => rm('governance/product/s8-6-evidence/dau-exact-qa.json'), expect: ['DAU_RESULT_OMITTED']},
  {id: 'R33-DAU-EVIDENCE-ALTERED', name: 'DAU-007 exact-QA evidence altered', apply: () => rwJson('governance/product/s8-6-evidence/dau-exact-qa.json', (j) => { j.status = 'FAIL'; }), expect: ['DAU_RESULT_OMITTED']},
  {id: 'R34-HISTORY-MODULE-REMOVED', name: 'history module removed from the tree', apply: () => rm('assets/atl-s8-history-sync.mjs'), expect: ['IDENTITY_MISMATCH', 'SUCCESSOR_IDENTITY_MISSING', 'PACKAGE_BASELINE_FILE_UNTRACKED']},
  {id: 'R35-STALE-WD-MARKER', name: 'stale WD lineage marker introduced into a lineage asset', apply: () => rw('assets/atl-140-consumer-view.mjs', (s) => s + `\n// ${['wd', '::road-ltl::LTL-04::v', '1'].join('')}\n`), expect: ['STALE_WD_LINEAGE_MARKER']},
  {id: 'R36-PREDECESSOR-GENERATOR-EDITED', name: 'predecessor S8-3F generator edited', apply: () => rw('lib/release/s8-release-manifest.js', (s) => s + '\n// edit\n'), expect: ['IDENTITY_MISMATCH']},
  {id: 'R37-SUCCESSOR-GENERATOR-EDITED', name: 'successor generator edited after the manifest was written', apply: () => rw('lib/release/s8-6-package-builder.js', (s) => s + '\n// edit\n'), expect: ['IDENTITY_MISMATCH']},
  {id: 'R38-DEEPEN-MODULE-ALTERED', name: 'S8-5B Deepen module altered', apply: () => rw('assets/atl-167-v15-deepen-inspect.mjs', (s) => s + '\n// edit\n'), expect: ['IDENTITY_MISMATCH']},
  {id: 'R39-ASK-RUNTIME-ALTERED', name: 'certified Ask runtime altered', apply: () => rw('runtime/universal-ask-atlas.js', (s) => s + '\n// edit\n'), expect: ['IDENTITY_MISMATCH']},
  {id: 'R41-STALE-WD-ID-IN-PACKAGE', name: 'stale WD id shipped in a packaged file other than the pinned governed schema', apply: () => { rw('release/packages/lab/assets/atl-140-consumer-view.mjs', (s) => s + `\n// ${['wd', '::road-ltl::LTL-04::v', '1'].join('')}\n`); }, expect: ['STALE_WD_LINEAGE_MARKER']},
  {id: 'R40-ROOT-ALTERED', name: 'certified root altered', apply: () => rw('index.html', (s) => s + '\n<!-- edit -->\n'), expect: ['IDENTITY_MISMATCH']}
];

const results = []; const report = [];
const run = async (id, name, fn) => { try { await fn(); results.push({id, ok: true}); console.log(`PASS ${id} ${name}`); } catch (e) { results.push({id, ok: false}); console.log(`FAIL ${id} ${name}\n  ${String(e.message).split('\n')[0]}`); } };

const control = {};
makeScratch();
try {
  await run('MC00', 'control: unmodified scratch verifies clean', async () => {
    reset(); const r = await verifySuccessorManifest(committed, {root: dir, canonicalHash}); control.failures = r.failures; control.lineageEntries = committed.lineage.length; control.lineageMatch = committed.lineage.filter((l) => l.status === 'MATCH').length; control.exclusionsAbsent = committed.exclusions.filter((x) => x.status === 'ABSENT_FROM_AUTHORITY').length; control.exclusions = committed.exclusions.length;
    assert.deepEqual(r.failures, []); assert.equal(r.ok, true);
  });
  for (const m of M) {
    if (only && !only.test(m.id)) continue;
    await run(m.id, m.name, async () => {
      reset(); m.apply(); git(['add', '-A'], dir); // the RC is the committed tree: stage the mutation exactly as a commit would
      const r = await verifySuccessorManifest(committed, {root: dir, canonicalHash});
      const codes = [...new Set(r.failures.map((f) => f.code))];
      report.push({id: m.id, name: m.name, expectedCodes: m.expect, observedCodes: codes, rejected: !r.ok && codes.length > 0, rejectedByExpectedCode: m.expect.some((c) => codes.includes(c))});
      assert.ok(!r.ok && codes.length > 0, 'mutation SURVIVED: verifier accepted the mutated tree');
      assert.ok(m.expect.some((c) => codes.includes(c)), `rejected, but not by an expected code (${m.expect.join('|')}); got ${codes.join(',')}`);
    });
  }
} finally { cleanup(); }

const mutations = results.filter((r) => r.id !== 'MC00');
const failed = results.filter((r) => !r.ok);
const detected = mutations.filter((r) => r.ok).length;
console.log(`\nS8-6 RC mutations: ${detected}/${mutations.length} detected; control ${results.find((r) => r.id === 'MC00')?.ok ? 'clean' : 'NOT clean'}`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.id).join('\n'));
if (process.env.S8_6_MUT_REPORT) fs.writeFileSync(process.env.S8_6_MUT_REPORT, JSON.stringify({control, mutations: report}, null, 2) + '\n');
console.log(JSON.stringify({suite: 's8-6-rc-mutations', control: results.find((r) => r.id === 'MC00')?.ok === true, mutations: mutations.length, detected, survived: mutations.length - detected}));
if (failed.length) process.exit(1);
