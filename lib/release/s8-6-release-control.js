import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

// S8-6 release-control: (1) release-integrity baseline regeneration + verification (never waived), (2) mechanical drift reconciliation record,
// (3) rollback manifest (rollback/reference only; never injected into active v1.5 execution). Pure functions of pinned constants + the git tree.

export const BASELINE_PATH = 'release/baselines/v2-critical-hashes.json';
export const ROLLBACK_MANIFEST_PATH = 'release/manifests/atlas-v1.5-successor-s8-rollback.json';
export const DRIFT_RECON_PATH = 'governance/product/s8-6-evidence/release-integrity-drift-reconciliation.json';
export const BASELINE_SCHEMA = 's8-6-release-integrity-baseline-v1';
export const ROLLBACK_SCHEMA = 'atlas-v1.5-successor-rollback-manifest-v1-s8-6';
export const BASE_COMMIT = '97e3086daa7b1ca694d019f0f30bb2c3150e7a6d'; // S8-5B final evidence head (pre-S8-6 baseline state)

const sha256Hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const gitBlobOfBytes = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000, stdio: ['ignore', 'pipe', 'pipe']}).trim();
const gitTry = (root, args) => { try { return git(root, args); } catch { return null; } };
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
export const serialize = (v) => JSON.stringify(sortKeys(v), null, 2) + '\n';
const fileSha = (root, p) => { const f = path.join(root, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? sha256Hex(fs.readFileSync(f)) : null; };

// ---------------------------------------------------------------------------------------------- baseline
// The 44 files of the pre-S8-6 baseline plus the successor-critical identities (journey, history module, Deepen module, governed-depth API/projection,
// certified Ask 2.0.1, Canvas donor + bridge, root shell, consumer surfaces). All are inside the Lab/Stable packages.
export const PRE_S8_6_BASELINE_FILES = Object.freeze([
  '.env.example', 'admin.html', 'api/atlas.js', 'data/atlas-registry.json', 'data/module-catalog.json', 'index.html', 'lib/api/_utils.js', 'lib/api/admin-workdefinitions.js',
  'package.json', 'release/release-meta.js', 'stage18-client.js', 'vercel.json'
]);
export const SUCCESSOR_CRITICAL_FILES = Object.freeze([
  '.vercelignore', 'assets/atl-140-consumer-view.mjs', 'assets/atl-140-v15-journey.mjs', 'assets/atl-167-v15-deepen-inspect.mjs', 'assets/atl-s8-history-sync.mjs',
  'assets/canvas-daughter-bridge-v2.0.1.mjs', 'assets/universal-daughter-renderer-v2.js', 'atl-140-malkom-consumer.html', 'canvas-v2/canvas-v2/assets/canvas-v2.css',
  'canvas-v2/canvas-v2/assets/canvas-v2.js', 'canvas-v2/canvas-v2/index.html', 'daughter.html', 'execution/ui/runtime-access-shell.js', 'governance/ask-atlas-surface-contract-v1.json',
  'lib/api/ask-atlas.js', 'lib/api/governed-depth-summary.js', 'lib/ask/p5-governed-retrieval.js', 'lib/projections/governed-depth-summary.js', 'runtime/universal-ask-atlas.js'
]);

// The pre-S8-6 baseline's full 44-file list is recorded in git at BASE_COMMIT (identity pinned by the reconciliation record); the regenerated baseline covers
// exactly that list again (same paths, current identities) plus the successor-critical set.
export function preBaselineAtBase(root) {
  const raw = gitTry(root, ['show', `${BASE_COMMIT}:${BASELINE_PATH}`]);
  return raw ? JSON.parse(raw) : null;
}
export function baselinePaths(root, preBaseline = preBaselineAtBase(root)) {
  const prior = preBaseline ? Object.keys(preBaseline.files) : null;
  const list = prior ?? [...PRE_S8_6_BASELINE_FILES];
  return [...new Set([...list, ...SUCCESSOR_CRITICAL_FILES])].sort();
}

export function buildBaseline(root, paths) {
  const files = {};
  for (const p of paths) { const h = fileSha(root, p); if (h === null) throw new Error(`BASELINE_FILE_MISSING:${p}`); files[p] = h; }
  return {schemaVersion: BASELINE_SCHEMA, release: 'v2.0.0', class: 'GOVERNED_RELEASE_INTEGRITY_BASELINE (S8-6 successor RC; regenerated after mechanical drift reconciliation; never waived)',
    successorRelease: 'atlas-v1.5-road-ltl-malkom-successor-rc', reconciliation: DRIFT_RECON_PATH, files};
}

// Same verification as lib/api/release-integrity.js (sha256 of every listed file under cwd), reported with detail.
export function verifyBaseline(root, baseline = JSON.parse(fs.readFileSync(path.join(root, BASELINE_PATH), 'utf8'))) {
  const mismatches = []; let count = 0;
  for (const [rel, expected] of Object.entries(baseline.files ?? {})) { count++; const a = fileSha(root, rel); if (a === null) mismatches.push({path: rel, reason: 'missing'}); else if (a !== expected) mismatches.push({path: rel, reason: 'drift'}); }
  return {status: count > 0 && mismatches.length === 0 ? 'PASSES_VERIFICATION' : 'FAILS_VERIFICATION', fileCount: count, mismatches};
}

// ---------------------------------------------------------------------------------------------- drift reconciliation (evidence; generated once, identity-pinned)
export function buildDriftReconciliation(root) {
  const pre = preBaselineAtBase(root);
  if (!pre) throw new Error('PRE_BASELINE_UNAVAILABLE');
  const tracked = new Set(git(root, ['ls-files', '-z']).split('\0').filter(Boolean));
  const revs = (p) => (gitTry(root, ['log', '--format=%H', `${BASE_COMMIT}`, '--', p]) ?? '').split('\n').filter(Boolean);
  const staleMarker = ['wd', '::road-ltl::LTL-04::v', '1'].join('');
  const entries = [];
  for (const [p, oldSha] of Object.entries(pre.files).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const cur = fileSha(root, p);
    if (cur === oldSha) { entries.push({path: p, status: 'MATCH', oldBaselineSha256: oldSha, currentSha256: cur}); continue; }
    const chain = []; let matched = null; let seen = null;
    for (const c of revs(p)) { const h = fileShaAt(root, c, p); if (h !== seen) { chain.push({commit: c, sha256: h, subject: git(root, ['log', '-1', '--format=%s', c]).slice(0, 140)}); seen = h; } if (h === oldSha && !matched) matched = c; }
    const latest = chain[0] ?? null;
    const atBase = fileShaAt(root, BASE_COMMIT, p);
    const currentEqualsBase = atBase === cur;
    const text = cur === null ? '' : fs.readFileSync(path.join(root, p), 'utf8');
    const classification = !currentEqualsBase ? 'CHANGED_AFTER_BASE_BY_S8_6' : matched === null ? 'BASELINE_VALUE_PREDATES_LINEAGE' : 'AUTHORIZED_LINEAGE_CHANGE_AFTER_BASELINE';
    const checks = {
      tracked: tracked.has(p),
      authorized: classification !== 'CHANGED_AFTER_BASE_BY_S8_6' && latest !== null && isAncestorOf(root, latest.commit, BASE_COMMIT),
      inRc: tracked.has(p) && cur !== null,
      notStale: cur !== null && !text.includes(staleMarker),
      notAccidental: latest !== null && /^[A-Za-z0-9._-]+[:\s]/.test(latest.subject) && chain.length > 0
    };
    const reconciled = checks.tracked && checks.authorized && checks.inRc && checks.notStale && checks.notAccidental;
    entries.push({path: p, status: 'DRIFT', classification, oldBaselineSha256: oldSha, currentSha256: cur, currentGitBlob: cur === null ? null : gitBlobOfBytes(fs.readFileSync(path.join(root, p))),
      baselineMatchedAnyCommittedRevision: matched !== null, baselineMatchedCommit: matched,
      driftOrigin: matched === null ? 'BASELINE_NEVER_MATCHED_A_COMMITTED_REVISION (recorded value was not produced from this lineage)' : 'FILE_CHANGED_AFTER_THE_MATCHING_REVISION',
      lastChangeCommit: latest && latest.commit, lastChangeSubject: latest && latest.subject, committedRevisionCount: chain.length, currentEqualsBaseCommitRevision: currentEqualsBase,
      provenance: latest === null ? null : /^S8-/.test(latest.subject) ? 'ACCEPTED_S8_STAGE_COMMIT' : 'ACCEPTED_BASE_RELEASE_HISTORY (pre-S8 commit inherited through the accepted S8-5B base; for ATL-181 independent audit)',
      checks, reconciled, revisionChain: chain.slice(0, 6)});
  }
  const drift = entries.filter((e) => e.status === 'DRIFT');
  const unexplained = drift.filter((e) => !e.reconciled);
  return {schemaVersion: 's8-6-release-integrity-drift-reconciliation-v1', class: 'MECHANICAL_DRIFT_CLASSIFICATION (evidence; drift is reconciled by classification and baseline regeneration, never waived; verifier not weakened)',
    baseCommit: BASE_COMMIT, preBaseline: {path: BASELINE_PATH, gitBlobAtBase: gitTry(root, ['rev-parse', `${BASE_COMMIT}:${BASELINE_PATH}`]), fileCount: Object.keys(pre.files).length},
    rules: ['authorized: the last change is a commit that is an ancestor of the accepted S8-5B final evidence head (the accepted base) - never a post-base or unexplained change', 'inRc: the file is tracked and present in the RC tree', 'notStale: the file does not carry the stale WD lineage marker',
      'notAccidental: the change is attributable to a recorded commit with a stage subject', 'a drift entry that fails any check is UNEXPLAINED and blocks generation'],
    summary: {preBaselineFileCount: entries.length, matchCount: entries.length - drift.length, driftCount: drift.length, unexplainedCount: unexplained.length, allReconciled: unexplained.length === 0,
      byClassification: Object.fromEntries([...new Set(drift.map((e) => e.classification))].sort().map((c) => [c, drift.filter((e) => e.classification === c).length])), unexplainedPaths: unexplained.map((e) => e.path)},
    entries};
}
function isAncestorOf(root, c, d) { try { cp.execFileSync('git', ['-c', `safe.directory=${root}`, 'merge-base', '--is-ancestor', c, d], {cwd: root, stdio: 'ignore'}); return true; } catch { return false; } }
function fileShaAt(root, commit, p) { const b = cp.spawnSync('git', ['-c', `safe.directory=${root}`, 'show', `${commit}:${p}`], {cwd: root, maxBuffer: 300000000}); return b.status === 0 ? sha256Hex(b.stdout) : null; }

// ---------------------------------------------------------------------------------------------- rollback manifest
export const ROLLBACK_ASSETS = Object.freeze([
  {assetId: 'road-ltl-1.3', path: 'data/modules/road-ltl-v1.3.json', sha256: '0f855cc0b11991a0f58a76791d64def8b688f4349b0e5bd1105161241f7ad808'},
  {assetId: 'ocean-fcl-0.5', path: 'data/modules/ocean-fcl-v0.5.json', sha256: '71526914c600cb10c47434a5b6dc064e851062776a336ae480f37e487e108ebc'},
  {assetId: 'ocean-lcl-0.5', path: 'data/modules/ocean-lcl-v0.5.json', sha256: '9dbaadc129a6c8be30e9e77c7ff319af40a9f5c4226e82817c2389cde01d18e6'}
]);
export const NOT_ROLLBACK_TARGETS = Object.freeze([
  {id: 'atl-175-release-contract', commit: 'dd32b8a4eabe3c8c08f2da305efd79738c11ecd3', reason: 'ATL-175 branch tip is candidate/control evidence, not a rollback target'},
  {id: 'atl-141-release-candidate', commit: 'ef6e375ca947c34902ee1e366dd71e08914f7fa8', reason: 'historical ATL-141 RC assembly (S7-IMP-003 REPLACE_ASSEMBLY); candidate, not rollback'},
  {id: 'atl-141-release-integrity', commit: 'f0a5b90904c781ac721037be98f1ae71653e7551', reason: 'historical ATL-141 release-integrity assembly (S7-IMP-021 REPLACE_ASSEMBLY); candidate, not rollback'},
  {id: 'atl-142-custody', commit: 'dba6968b0bdf28b533f4efd765302796e6ebed58', reason: 'historical ATL-142 custody/root assembly (S7-IMP-004/006 WRONG_DONOR); not rollback'}
]);

export function buildRollbackManifest(root) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'governance/frozen-assets/ASSET_REGISTER.json'), 'utf8'));
  const assets = ROLLBACK_ASSETS.map((a) => {
    const f = path.join(root, a.path); const bytes = fs.existsSync(f) ? fs.readFileSync(f) : null; const reg = (registry.assets ?? []).find((x) => x.assetId === a.assetId) ?? null;
    return {assetId: a.assetId, path: a.path, expectedSha256: a.sha256, observedSha256: bytes ? sha256Hex(bytes) : null, gitBlob: bytes ? gitBlobOfBytes(bytes) : null, bytes: bytes ? bytes.length : null,
      status: bytes && sha256Hex(bytes) === a.sha256 ? 'MATCH' : bytes ? 'MISMATCH' : 'MISSING',
      frozenAssetRegister: {file: 'governance/frozen-assets/ASSET_REGISTER.json', status: reg && reg.status, sha256: reg && reg.sha256, registerAgrees: !!reg && reg.sha256 === a.sha256 && reg.status === 'FROZEN_PRODUCTION_BASELINE'}};
  });
  return {schemaVersion: ROLLBACK_SCHEMA, class: 'ROLLBACK_REFERENCE_ONLY', purpose: 'Deterministic rollback identity for the v1.5 Road LTL successor RC: the frozen production-baseline daughter modules.',
    injectedIntoActiveV15Execution: false, activeExecutionUse: 'NONE — reference/restore evidence only; never loaded by the v1.5 runtime',
    assets, nominatedRollbackTargets: assets.map((a) => a.assetId).sort(), notRollbackTargets: NOT_ROLLBACK_TARGETS.map((n) => ({...n, nominatedAsRollback: false})),
    staleBranchRollback: false, candidateBranchRollback: false,
    rules: ['restore only from identity-verified (sha256) frozen production-baseline assets', 'a candidate branch/commit is never a rollback target', 'the current RC is not its own rollback', 'no rollback asset is injected into active v1.5 execution',
      'application-first rollback to the last known-good deployment remains the operational mechanism (release/ROLLBACK_RUNBOOK.md); this manifest names the frozen data identities only'],
    deploymentRollbackIdentity: 'NOT_ESTABLISHED (no deployment exists; none inferred)', productionPromotionAuthorized: false};
}

export function verifyRollbackManifest(root, manifest = JSON.parse(fs.readFileSync(path.join(root, ROLLBACK_MANIFEST_PATH), 'utf8'))) {
  const f = []; const fail = (code, detail) => f.push({code, detail});
  if (manifest.schemaVersion !== ROLLBACK_SCHEMA) fail('ROLLBACK_SCHEMA', String(manifest.schemaVersion));
  if (manifest.class !== 'ROLLBACK_REFERENCE_ONLY' || manifest.injectedIntoActiveV15Execution !== false) fail('ROLLBACK_INJECTED_INTO_ACTIVE_EXECUTION', String(manifest.injectedIntoActiveV15Execution));
  const ids = (manifest.nominatedRollbackTargets ?? []).slice().sort().join(',');
  if (ids !== ROLLBACK_ASSETS.map((a) => a.assetId).sort().join(',')) fail('ROLLBACK_TARGET_SET', ids);
  for (const a of manifest.assets ?? []) {
    const pin = ROLLBACK_ASSETS.find((x) => x.assetId === a.assetId);
    if (!pin) { fail('ROLLBACK_UNKNOWN_ASSET', a.assetId); continue; }
    if (a.expectedSha256 !== pin.sha256 || a.path !== pin.path) fail('ROLLBACK_HASH_ALTERED', a.assetId);
    if (fileSha(root, pin.path) !== pin.sha256) fail('ROLLBACK_ASSET_DRIFT', pin.path);
  }
  for (const n of manifest.notRollbackTargets ?? []) if (n.nominatedAsRollback !== false) fail('ROLLBACK_STALE_BRANCH_NOMINATED', n.id);
  for (const n of NOT_ROLLBACK_TARGETS) if (!(manifest.notRollbackTargets ?? []).some((x) => x.commit === n.commit)) fail('ROLLBACK_NEGATIVE_RECORD_MISSING', n.id);
  if (manifest.staleBranchRollback !== false || manifest.candidateBranchRollback !== false) fail('ROLLBACK_STALE_BRANCH_NOMINATED', 'flags');
  if (manifest.productionPromotionAuthorized !== false) fail('PRODUCTION_PROMOTION_AUTHORIZED', String(manifest.productionPromotionAuthorized));
  if (serialize(manifest) !== serialize(buildRollbackManifest(root))) fail('ROLLBACK_MANIFEST_DRIFT', 'differs from deterministic regeneration');
  return {ok: f.length === 0, failures: f};
}

export {sha256Hex, gitBlobOfBytes, fileSha};
