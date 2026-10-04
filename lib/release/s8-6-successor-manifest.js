import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {PROTECTED, EXCLUDED, STALE_WD_MARKER, buildManifest as buildPredecessorManifest} from './s8-release-manifest.js';
import {describePackage, packageIdentity, verifyPackageDir, CHANNELS, PACKAGE_BUILDER_PATHS, trackedFiles} from './s8-6-package-builder.js';
import {BASELINE_PATH, ROLLBACK_MANIFEST_PATH, DRIFT_RECON_PATH, baselinePaths, verifyBaseline, verifyRollbackManifest, buildRollbackManifest, ROLLBACK_ASSETS, fileSha, serialize as rcSerialize} from './s8-6-release-control.js';

// S8-6 SUCCESSOR RC MANIFEST (governed regeneration over the full corrected lineage).
//
// A pure, deterministic function of (a) the pinned registry below, (b) the repository tree at the tested commit and (c) the identities recorded by the
// PREDECESSOR S8-3F manifest/generator (whose files are never modified; they stay predecessor evidence). No clock, no randomness, no network, no
// dependency on a divergent branch: the governed source is read from the committed custody copy; every historical commit is a pinned CONSTANT whose
// ancestry is reported as a boolean (identical in a full clone and in a lineage-only single-branch clone).
//
// PASS of this manifest means "successor RC assembled and internally consistent, ready for ATL-181 independent audit". It is NOT ATL-181 PASS, UAT, sign-off,
// promotion, deployment or runtime readiness.

export const SUCCESSOR_MANIFEST_PATH = 'release/manifests/atlas-v1.5-successor-s8-rc.json';
export const SUCCESSOR_SCHEMA = 'atlas-v1.5-successor-rc-manifest-v1.0-s8-6';
export const GENERATOR_PATHS = Object.freeze(['lib/release/s8-6-successor-manifest.js', 'lib/release/s8-6-release-control.js', 'scripts/s8-6-successor-manifest.mjs']);
export const PREDECESSOR_MANIFEST_PATH = 'release/manifests/atlas-v1.5-road-ltl-malkom-release-v1.json';
export const PREDECESSOR_GENERATOR_PATHS = Object.freeze(['lib/release/s8-release-manifest.js', 'scripts/s8-3f-release-manifest.mjs']);
export const CUSTODY_PINS_PATH = 'release/custody/s8-6/custody-pins.json';

// ------------------------------------------------------------------ pinned registry (accepted identities; commits are constants, never resolved)
export const C = Object.freeze({
  s8_5bFinalHead: '97e3086daa7b1ca694d019f0f30bb2c3150e7a6d', s8_5bFinalTree: '33c820c5d5c347ca918f128492f9b6928ea07f64',
  s8_5bTested: 'c05d35d7eea79dacfa2290bc04bd0bf1727b1ef0', s8_5bTestedTree: '5947ea9547ca264e3449b71b4b39a1727060443f',
  s8_5aHead: 'f8dc6c3863bc7310d8d83addf2d6ff1b6d34e12f', s8_5aTested: 'cf6c89dc51187329e4455f20fa12e2d742735621', s8_5aTestedTree: 'c8a17ab0aaf813381813810da5a2e1b92f1370e2',
  s8_3fHead: 'a3e2dc1687a9dd8a290645a4ed77895fb39f97e7', s8_3fTested: '67c80d513aa9de798e33814b963ee0e62ed7abad', s8_3fTestedTree: '32576bbf8a1589f787a286a0386490a4b42b3aa9',
  s8_4Tested: '07a41138f7b52e5fe1d0c9d5989f72b9835560c5', s8_4Head: '3ead8bd108c349ba2149063d39376c8d2a04c2f3',
  dauFix: '917a39cf34e23e1c2f371b7ce079e69ac71af323', dauTested: 'e0a1ce28530735e4673d1e59ade4c8fd1ece58ce',
  atl141Rc: 'ef6e375ca947c34902ee1e366dd71e08914f7fa8', atl141RcTree: 'f573ec5cfec0e2553686bb3c1e76672a4c03a25b',
  atl141Integrity: 'f0a5b90904c781ac721037be98f1ae71653e7551', atl141IntegrityTree: '3aae4c19fcccea3aa8baa7d01c7e5faa5cc5e484',
  atl142: 'dba6968b0bdf28b533f4efd765302796e6ebed58', atl142Tree: '20929e402ffdde3053139066c4ad52385a78330b',
  atl175: 'dd32b8a4eabe3c8c08f2da305efd79738c11ecd3', divergentSource: '662c7847d3839c1ffd95dc8589d3d0d6ac100d67'
});
const SHA = Object.freeze({
  sourceModule: 'c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4', taskHash: 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65',
  s8_3fEvidence: '1440364b073e091ee325326bff307e7334d33092a1bf02a2399ed8ee3f8e2180', s8_5aEvidence: '5d9bf6f43732a1a54b0dd5f0e69bff79c35b447bb9fbb76117135a2939ff3cbb', s8_5bEvidence: 'fe03604f4f1ca98f56d3ad79b9400cacca9a4463cd9bc0e28818bff912c7d883',
  s8_5bIdentityRecord: 'e329bc94f068302b5e498b92de021043d4ad23787417eacb1137b33631d0a7c9', s8_5bDepthSummary: '4408f649a9ad6293d97244bf1810feb418ddebf98e5f8558e80e2ca23d4208b4'
});
// DAU remediation evidence identity (exact-commit QA; committed before this manifest was assembled)
export const DAU_EVIDENCE = Object.freeze({path: 'governance/product/s8-6-evidence/dau-exact-qa.json', sha256: '2d85ce25309e756e1c9c1d9bbe985f471700043bd3c0efcb6f34547d2e5da393', gitBlob: '2029f50559048d2e9d11fccd303ef1aaa6fec063', testedCommit: C.dauTested});

// Successor interaction / product identities: [id, role, stage, path, expectedBlob, supersedes[]]
const SUCCESSOR_BLOBS = Object.freeze([
  ['successor.api-atlas-router', 'ROUTER_REGISTRATION_GOVERNED_DEPTH_SUMMARY (S8-5B)', 'S8-5B', 'api/atlas.js', '60dcb85999eed6d1bbc67e52b7ef6c3667cd5709', [{stage: 'S8-4', blob: 'bf872b2b66cb222e53a5e9cff4a47dbeab65c546'}]],
  ['successor.atl-140-journey', 'SUCCESSOR_JOURNEY (S8-4 journey + S8-5B Deepen/Inspect + S8-6 history registration)', 'S8-6', 'assets/atl-140-v15-journey.mjs', '74bc1919ae6904a3feb8ea115ab9040911055b7f', [{stage: 'S8-4', blob: '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7'}, {stage: 'S8-5B', blob: '6c11bf4c89eaf212004beab7a939fd4cda38477c'}]],
  ['successor.history-sync-module', 'GOVERNED_HISTORY_SYNC (DAU-007/DAU-006 remediation; additive)', 'S8-6', 'assets/atl-s8-history-sync.mjs', '52631ec3628a2cf40509f4672a482ca5b2bf8bc3', []],
  ['successor.atl167-deepen-module', 'ATL167_SUCCESSOR_INTERACTION_MODULE', 'S8-5B', 'assets/atl-167-v15-deepen-inspect.mjs', '34bc9e6b4ca719823257c51b2058b19522169e9f', []],
  ['successor.governed-depth-api', 'ATL167_BOUNDED_API_HANDLER', 'S8-5B', 'lib/api/governed-depth-summary.js', '01a3594fd9ccd8286131c493f422f80a26e5aaf9', []],
  ['successor.governed-depth-projection', 'ATL167_PUBLIC_SAFE_PROJECTION', 'S8-5B', 'lib/projections/governed-depth-summary.js', '9a6b07bd2141e8212d9ffbc78a1b2f3fabc92695', []],
  ['successor.s8-5b-identity-record', 'S8-5B successor identity record', 'S8-5B', 'governance/product/s8-5b-evidence/successor-identity.json', 'f0108c15235d95e5cff35e6990fa0b5416ddb4af', []],
  ['successor.s8-5b-depth-summary-evidence', 'S8-5B public governed-depth summary evidence', 'S8-5B', 'governance/product/s8-5b-evidence/governed-depth-summary-ltl04.json', '0f61b1ea08a104570a3ec675a74b92faaa161966', []],
  ['successor.s8-5a-atl157-retest', 'S8-5A ATL-157 retest evidence', 'S8-5A', 'governance/product/s8-5a-evidence/atl-157-retest-summary.json', '9584ae46b8a2bab47cb7ee1edd4ab6e65165e51f', []],
  ['successor.s8-5a-atl167-blocked-record', 'S8-5A ATL-167 blocked record (historical; superseded by S8-5B)', 'S8-5A', 'governance/product/s8-5a-evidence/atl-167-blocked-record.json', '9eb3d0faf94f928c18379211f2b426ab5aef26ac', []],
  ['successor.s8-5a-atl173-utility-proof', 'S8-5A ATL-173 successor utility proof', 'S8-5A', 'governance/product/s8-5a-evidence/atl-173-successor-utility-proof.json', '16026367a134ca48f7476989023f0548c42dc4ad', []],
  ['predecessor.s8-3f-manifest-generator', 'S8-3F generator (predecessor evidence; unmodified)', 'S8-3F', 'lib/release/s8-release-manifest.js', '14db0fdfd8e5dc2809f2c64051c71dc1f66c22b0', []],
  ['predecessor.s8-3f-manifest-cli', 'S8-3F generator CLI (predecessor evidence; unmodified)', 'S8-3F', 'scripts/s8-3f-release-manifest.mjs', '7ebe8fb7f5176c41cca58bf6fa334e117a0b5a91', []],
  ['predecessor.s8-3f-manifest', 'S8-3F historical release manifest (predecessor evidence; unmodified; NOT current authority)', 'S8-3F', PREDECESSOR_MANIFEST_PATH, '4bdc0873086c514e399d16972875b69716d69fde', []]
]);
// Evidence of stages added after the predecessor manifest.
const STAGE_EVIDENCE_ADDED = Object.freeze([
  {id: 'stage.s8-3f', stage: 'S8-3F', file: 'governance/product/s8-3f-evidence/exact-qa.json', testedCommit: C.s8_3fTested, testedTree: C.s8_3fTestedTree, finalHead: C.s8_3fHead, qa: SHA.s8_3fEvidence},
  {id: 'stage.s8-5a', stage: 'S8-5A', file: 'governance/product/s8-5a-evidence/exact-qa.json', testedCommit: C.s8_5aTested, testedTree: C.s8_5aTestedTree, finalHead: C.s8_5aHead, qa: SHA.s8_5aEvidence},
  {id: 'stage.s8-5b', stage: 'S8-5B', file: 'governance/product/s8-5b-evidence/exact-qa.json', testedCommit: C.s8_5bTested, testedTree: C.s8_5bTestedTree, finalHead: C.s8_5bFinalHead, qa: SHA.s8_5bEvidence}
]);
// Identities that must never be current authority (additional to the S8-3F EXCLUDED registry): [id, kind, value, classification, reason]
const EXCLUDED_ADDED = Object.freeze([
  {id: 'excluded.atl-141-rc-commit', kind: 'GIT_COMMIT', value: C.atl141Rc, classification: 'EXCLUDED_REPLACED_ASSEMBLY', reason: 'S7-IMP-003 ATL-141 RC assembly (REPLACE_ASSEMBLY); candidate, never base/rollback/RC authority'},
  {id: 'excluded.atl-141-integrity-commit', kind: 'GIT_COMMIT', value: C.atl141Integrity, classification: 'EXCLUDED_REPLACED_ASSEMBLY', reason: 'S7-IMP-021 ATL-141 release-integrity assembly (REPLACE_ASSEMBLY); behavioural evidence only'},
  {id: 'excluded.atl-175-commit', kind: 'GIT_COMMIT', value: C.atl175, classification: 'EXCLUDED_NOT_ROLLBACK_TARGET', reason: 'ATL-175 control donor; mechanism retained as evidence only; never rollback/RC authority'},
  {id: 'excluded.divergent-source-commit', kind: 'GIT_COMMIT', value: C.divergentSource, classification: 'EXCLUDED_DIVERGENT_DEPENDENCY', reason: 'divergent source branch tip; the governed source is carried by the committed custody copy; the RC must not depend on this commit'},
  {id: 'excluded.superseded-journey-s8-4', kind: 'GIT_BLOB', value: '2c97dbdee40fa1ba13ad108a7de6a0fa170bfec7', classification: 'SUPERSEDED_SUCCESSOR_IDENTITY', reason: 'S8-4 journey blob; superseded by the S8-6 successor journey (history registration) - historical evidence only'},
  {id: 'excluded.superseded-journey-s8-5b', kind: 'GIT_BLOB', value: '6c11bf4c89eaf212004beab7a939fd4cda38477c', classification: 'SUPERSEDED_SUCCESSOR_IDENTITY', reason: 'S8-5B journey blob; superseded by the S8-6 successor journey (history registration) - historical evidence only'},
  {id: 'excluded.superseded-api-atlas-s8-4', kind: 'GIT_BLOB', value: 'bf872b2b66cb222e53a5e9cff4a47dbeab65c546', classification: 'SUPERSEDED_SUCCESSOR_IDENTITY', reason: 'S8-4 router without governed-depth-summary; superseded by the S8-5B router'}
]);
const HISTORICAL_ASSEMBLIES = Object.freeze([
  {id: 'S7-IMP-003', subject: 'ATL-141 release candidate', commit: C.atl141Rc, tree: C.atl141RcTree, branch: 'atl-141-v15-release-candidate', disposition: 'REPLACE_ASSEMBLY', exclusions: ['excluded.atl-141-rc-commit', 'excluded.atl-140-root-index', 'excluded.historical-manifest-atl141', 'excluded.superseded-ask-api']},
  {id: 'S7-IMP-004', subject: 'ATL-142 final certification custody', commit: C.atl142, tree: C.atl142Tree, branch: 'atl-142-v15-final-certification-custody', disposition: 'REPLACE_ASSEMBLY', exclusions: ['excluded.atl-142-commit', 'excluded.superseded-ask-api']},
  {id: 'S7-IMP-006', subject: 'ATL-142 frontend/root assembly', commit: C.atl142, tree: C.atl142Tree, rootBlob: '379f988ce807f33dc8fd43b49b227b917a15b8c0', branch: 'atl-142-v15-final-certification-custody', disposition: 'REPLACE_ASSEMBLY', exclusions: ['excluded.atl-142-root-index', 'excluded.atl-142-commit']},
  {id: 'S7-IMP-021', subject: 'ATL-141 release integrity', commit: C.atl141Integrity, tree: C.atl141IntegrityTree, branch: 'atl-141-v15-release-integrity', disposition: 'REPLACE_ASSEMBLY', exclusions: ['excluded.atl-141-integrity-commit', 'excluded.atl-141-baseline-rewrite']}
]);
const DEFERRED_V2 = Object.freeze([
  {id: 'ATL-71', title: 'ATL-71 (deferred v2 obligation)'}, {id: 'F-130-06', title: 'F-130-06 runtime integration (deferred v2 obligation)'}, {id: 'ATL-107', title: 'ATL-107 (deferred v2 obligation)'},
  {id: 'V2-GENERALIZED-INTERACTION', title: 'generalized v2 interaction (beyond bounded Road LTL / LTL-04)'}, {id: 'V2-RUNTIME-READINESS-PROFILES', title: 'runtime-readiness profiles'}, {id: 'V2-BOL-FIRI', title: 'v2 BOL / FIRI'}
]);
export const NEW_MODULE_PATHS = Object.freeze(['assets/atl-s8-history-sync.mjs']);

// ------------------------------------------------------------------ utilities
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
export const serialize = (v) => JSON.stringify(sortKeys(v), null, 2) + '\n';
const sha256Hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const gitBlobOfBytes = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000, stdio: ['ignore', 'pipe', 'pipe']}).trim();
const isAncestor = (root, c) => { try { cp.execFileSync('git', ['-c', `safe.directory=${root}`, 'merge-base', '--is-ancestor', c, 'HEAD'], {cwd: root, stdio: 'ignore'}); return true; } catch { return false; } };
const worktreeBlob = (root, p) => { const f = path.join(root, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? gitBlobOfBytes(fs.readFileSync(f)) : null; };
const worktreeSha = (root, p) => fileSha(root, p);
const readJson = (root, p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const dig = (o, keys) => keys.reduce((a, k) => (a == null ? undefined : a[k]), o);
function trackedBlobMap(root) {
  const m = new Map();
  for (const l of git(root, ['ls-files', '-s', '-z']).split('\0').filter(Boolean)) { const [meta, p] = l.split('\t'); const blob = meta.split(' ')[1]; if (!m.has(blob)) m.set(blob, []); m.get(blob).push(p); }
  return m;
}
const entry = (id, role, stage, kind, expected, observed, extra = {}) => ({id, role, stage, kind, ...extra, expected, observed, status: expected != null && observed != null && expected === observed ? 'MATCH' : observed == null ? 'MISSING' : 'MISMATCH'});

// ------------------------------------------------------------------ ATL-157 / LTL-04 non-materialization (fail-closed)
// The successor RC must not materialize an LTL-04 daughter / execution-depth artifact (ATL-157 is test-only fixture evidence; the governed LTL-04 source
// lives only in the committed custody copy and is never a product data module).
const MATERIALIZATION_EVIDENCE_ALLOWED = [/^tests\//, /^governance\/product\//, /^frozen-assets\//, /^prototypes\//, /^release\/custody\//, /^release\/manifests\//, /^release\/packages\//, /^lib\/release\//, /^scripts\//];
export function ltl04Materialization(root) {
  const violations = [];
  for (const p of trackedFiles(root)) {
    if (MATERIALIZATION_EVIDENCE_ALLOWED.some((r) => r.test(p))) continue;
    if (/atl-?157|bounded-depth-v1/i.test(p)) violations.push({path: p, reason: 'ATL-157 mechanism/artifact in a product path'});
    else if (/^data\/modules\/road-ltl-v1\.4/i.test(p)) violations.push({path: p, reason: 'LTL 1.4 governed source materialized as a product data module'});
    else if (/^data\/materialized\/.*(ltl-04|road-ltl-v1\.4)/i.test(p)) violations.push({path: p, reason: 'LTL-04 materialized artifact'});
  }
  return {atl157InProduct: violations.some((v) => /ATL-157/.test(v.reason)), ltl04DaughterOrDepthMaterialized: violations.some((v) => !/ATL-157/.test(v.reason)), materializable: false, violations};
}

// ------------------------------------------------------------------ protected-bytes leak scan (no tracked file may equal a protected artifact's bytes)
export function protectedBytesScan(root) {
  const shas = new Map(PROTECTED.filter((p) => p.kind === 'SHA256_BYTES').map((p) => [p.expected, p.id]));
  const leaks = []; let scanned = 0;
  for (const p of trackedFiles(root)) {
    const f = path.join(root, p); let st; try { st = fs.statSync(f); } catch { continue; }
    if (!st.isFile() || st.size > 30e6) continue;
    scanned++; const id = shas.get(sha256Hex(fs.readFileSync(f))); if (id) leaks.push({path: p, protectedId: id});
  }
  const generatedFlowFiles = trackedFiles(root).filter((p) => /\.(bpmn|svg)$/i.test(p) && /^(governance\/product\/s8-|release\/)/.test(p));
  return {protectedIdentitiesChecked: shas.size, leaks, generatedFlowFiles, bytesPublished: leaks.length > 0 || generatedFlowFiles.length > 0};
}

// ------------------------------------------------------------------ custody
export function custodyState(root) {
  const pins = fs.existsSync(path.join(root, CUSTODY_PINS_PATH)) ? readJson(root, CUSTODY_PINS_PATH) : null;
  const f = pins ? path.join(root, pins.custodyFile) : null;
  const bytes = f && fs.existsSync(f) ? fs.readFileSync(f) : null;
  let taskHash = null; let taskCount = null;
  return {pins, bytes, f};
}

// ------------------------------------------------------------------ build
export async function buildSuccessorManifest(root, {canonicalHash = null} = {}) {
  const pred = buildPredecessorManifest(root); // identities/pins of the accepted S8-3F..S8-4 lineage (generator unmodified)
  const overridden = new Set(['interaction.atl-140-journey', 'source.road-ltl-v1.4']);
  const lineage = pred.lineage.filter((l) => !overridden.has(l.id));
  // source custody (replaces the divergent-commit read)
  const cus = custodyState(root);
  const custBlob = cus.bytes ? gitBlobOfBytes(cus.bytes) : null; const custSha = cus.bytes ? sha256Hex(cus.bytes) : null;
  lineage.push(entry('source.road-ltl-v1.4', 'GOVERNED_SOURCE_FROZEN_TASK_MODULE (carried by committed custody; no divergent-branch dependency)', 'S8-3A/S8-3B/S8-6', 'GIT_BLOB', 'd06974e9ee86cea59227e0866a98ad5d1367bfad', custBlob,
    {path: cus.pins?.custodyFile ?? null, sha256: {expected: SHA.sourceModule, observed: custSha}, custody: true, origin: {commit: C.divergentSource, path: 'data/modules/road-ltl-v1.4.json', branch: 's8-3a-atl155-daughter-regeneration', dependencyAfterCustody: false}}));
  lineage.push(entry('custody.source-sha256', 'GOVERNED_SOURCE_SHA256', 'S8-6', 'SHA256_BYTES', SHA.sourceModule, custSha, {path: cus.pins?.custodyFile ?? null}));
  lineage.push(entry('custody.pins-record', 'SOURCE_CUSTODY_PIN_RECORD', 'S8-6', 'GIT_BLOB', worktreeBlob(root, CUSTODY_PINS_PATH), worktreeBlob(root, CUSTODY_PINS_PATH), {path: CUSTODY_PINS_PATH}));
  if (canonicalHash && cus.bytes) {
    let observed = null; try { const t = JSON.parse(cus.bytes.toString('utf8')).tasks.find((x) => x.taskId === 'LTL-04'); observed = canonicalHash(t); } catch { observed = null; }
    lineage.push(entry('custody.task-hash', 'GOVERNED_SOURCE_TASK_LTL-04 (recomputed from custody bytes)', 'S8-6', 'SHA256_CANONICAL', SHA.taskHash, observed, {path: cus.pins?.custodyFile ?? null}));
  }
  // successor product / predecessor evidence blobs
  for (const [id, role, stage, p, pin, sup] of SUCCESSOR_BLOBS) lineage.push(entry(id, role, stage, 'GIT_BLOB', pin, worktreeBlob(root, p), {path: p, ...(sup.length ? {supersededPins: sup} : {})}));
  // stage QA evidence added after the predecessor manifest + the DAU remediation evidence
  for (const s of [...STAGE_EVIDENCE_ADDED, {id: 'stage.s8-6-dau', stage: 'S8-6', file: DAU_EVIDENCE.path, testedCommit: DAU_EVIDENCE.testedCommit, testedTree: null, finalHead: null, qa: DAU_EVIDENCE.sha256}]) {
    const f = path.join(root, s.file); const ok = fs.existsSync(f); const doc = ok ? readJson(root, s.file) : null; const bytes = ok ? fs.readFileSync(f) : null;
    const observed = {testedCommit: doc?.testedCommit ?? null, testedTree: doc?.testedTree ?? null, status: doc?.status ?? null, evidenceSha256: bytes ? sha256Hex(bytes) : null, evidenceBlob: bytes ? gitBlobOfBytes(bytes) : null};
    const expected = {testedCommit: s.testedCommit, testedTree: s.testedTree ?? observed.testedTree, status: 'PASS', evidenceSha256: s.qa};
    const good = ok && observed.testedCommit === expected.testedCommit && observed.testedTree === expected.testedTree && observed.status === 'PASS' && observed.evidenceSha256 === expected.evidenceSha256;
    lineage.push({id: s.id, role: 'STAGE_QA_EVIDENCE', stage: s.stage, kind: 'STAGE_EVIDENCE', path: s.file, finalEvidenceHead: s.finalHead, expected, observed, status: good ? 'MATCH' : ok ? 'MISMATCH' : 'MISSING'});
  }
  // the journey override: successor identity (superseded pins recorded, never accepted)
  const j = SUCCESSOR_BLOBS.find((b) => b[0] === 'successor.atl-140-journey');
  lineage.push(entry('interaction.atl-140-journey', j[1], 'S8-6', 'GIT_BLOB', j[4], worktreeBlob(root, j[3]), {path: j[3], supersededPins: j[5], note: 'S8-4 pin 2c97dbde and S8-5B pin 6c11bf4c are historical; the successor identity governs'}));
  // release-control identities
  const rc = (id, role, p) => lineage.push(entry(id, role, 'S8-6', 'GIT_BLOB', worktreeBlob(root, p), worktreeBlob(root, p), {path: p, sha256: worktreeSha(root, p), selfPinned: true}));
  rc('release.integrity-baseline', 'RELEASE_INTEGRITY_BASELINE (regenerated; verifies at the RC)', BASELINE_PATH);
  rc('release.rollback-manifest', 'ROLLBACK_MANIFEST (reference only)', ROLLBACK_MANIFEST_PATH);
  rc('release.drift-reconciliation', 'RELEASE_INTEGRITY_DRIFT_RECONCILIATION (mechanical classification record)', DRIFT_RECON_PATH);
  rc('release.vercelignore', 'DEPLOYMENT_EXCLUSIONS (.vercelignore: protected execution + source custody)', '.vercelignore');
  for (const p of PACKAGE_BUILDER_PATHS) rc(`release.package-builder:${p}`, 'DETERMINISTIC_PACKAGE_BUILDER', p);
  for (const p of GENERATOR_PATHS) rc(`release.successor-generator:${p}`, 'SUCCESSOR_MANIFEST_GENERATOR', p);
  lineage.sort((a, b) => (a.id < b.id ? -1 : 1));

  // exclusions (own evaluation; no allowed-inherited-path waiver; pinned historical constants)
  const tracked = trackedBlobMap(root);
  const predExcl = new Map((readJson(root, PREDECESSOR_MANIFEST_PATH).exclusions ?? []).map((e) => [e.id, e]));
  const evalExcl = (e) => {
    const base = {id: e.id, kind: e.kind, classification: e.classification, reason: e.reason, currentAuthority: false};
    if (e.kind === 'GIT_BLOB') { const where = tracked.get(e.value) ?? []; return {...base, value: e.value, presentInRcTree: where.length > 0, locations: where, status: where.length ? 'PRESENT_VIOLATION' : 'ABSENT_FROM_AUTHORITY'}; }
    if (e.kind === 'GIT_COMMIT') { const anc = isAncestor(root, e.value); return {...base, value: e.value, ancestorOfRc: anc, status: anc ? 'PRESENT_VIOLATION' : 'ABSENT_FROM_AUTHORITY'}; }
    const hist = predExcl.get(e.id)?.historicalBlob ?? null; const where = hist ? (tracked.get(hist) ?? []) : [];
    return {...base, commit: e.commit, path: e.path, historicalBlob: hist, presentInRcTree: where.length > 0, locations: where, status: where.length ? 'PRESENT_VIOLATION' : hist ? 'ABSENT_FROM_AUTHORITY' : 'HISTORICAL_BLOB_PIN_MISSING'};
  };
  const exclusions = [...EXCLUDED.map((e) => { const {allowedInheritedPaths, ...rest} = e; return rest; }), ...EXCLUDED_ADDED].map(evalExcl);
  const exclById = new Map(exclusions.map((e) => [e.id, e]));
  const staleMarkerFiles = lineage.filter((l) => l.path && l.kind === 'GIT_BLOB' && /^S8-(3[B-E]|4|5|6)/.test(l.stage) && fs.existsSync(path.join(root, l.path)) && !/\.(b64|gz|json)$/.test(l.path) && !l.custody && /\.(js|mjs|cjs|html|md)$/.test(l.path)
    && fs.readFileSync(path.join(root, l.path), 'utf8').includes(STALE_WD_MARKER)).map((l) => l.path).filter((p) => p !== 'lib/compile/s8-flow-bpmn.js' && !p.startsWith('lib/release/') && !p.startsWith('release/'));

  // historical assemblies: mechanically demonstrated not to be current authority
  const assemblies = HISTORICAL_ASSEMBLIES.map((a) => ({id: a.id, subject: a.subject, commit: a.commit, tree: a.tree, ...(a.rootBlob ? {rootBlob: a.rootBlob} : {}), branch: a.branch, historicalDisposition: a.disposition, currentAuthority: false, supersededBy: 'S8-6 successor RC/custody assembly',
    ancestorOfRc: isAncestor(root, a.commit), distinguishingIdentities: a.exclusions.map((x) => ({exclusion: x, status: exclById.get(x)?.status ?? 'EXCLUSION_RECORD_MISSING'})), historyDeleted: false, historyMutated: false}));

  // packages
  const packages = Object.fromEntries(CHANNELS.map((ch) => { const id = packageIdentity(root, ch); const verification = verifyPackageDir(root, ch); return [ch, {...(id ?? {channel: ch, path: `release/packages/${ch}`, missing: true}), verification: verification.ok ? 'VERIFIED_EXACT_FILE_SET_AND_BYTES' : 'FAILED', failures: verification.failures.map((f) => `${f.code}:${f.detail}`)}]; }));
  const askBlobs = {superseded: 'cb2bcfea0892adf5a871fb4584461b50729ab383'};
  const pkgFiles = CHANNELS.flatMap((ch) => (fs.existsSync(path.join(root, 'release/packages', ch)) ? describePackage(root, ch).entries.map((e) => ({...e, channel: ch})) : []));
  const supersededAskInPackages = pkgFiles.filter((e) => e.gitBlob === askBlobs.superseded).map((e) => `${e.channel}:${e.path}`);
  const stalePackageFiles = ['README_DEPLOY.txt'].flatMap((n) => CHANNELS.filter((ch) => fs.existsSync(path.join(root, 'release/packages', ch, n))).map((ch) => `${ch}:${n}`));
  const pkgBlobOf = (ch, p) => { const f = path.join(root, 'release/packages', ch, p); return fs.existsSync(f) ? gitBlobOfBytes(fs.readFileSync(f)) : null; };
  const currentIdentities = Object.fromEntries(['index.html', 'execution/ui/runtime-access-shell.js', 'assets/canvas-daughter-bridge-v2.0.1.mjs', 'runtime/universal-ask-atlas.js', 'lib/api/ask-atlas.js', 'lib/ask/p5-governed-retrieval.js', 'governance/ask-atlas-surface-contract-v1.json',
    'api/atlas.js', 'lib/api/governed-depth-summary.js', 'lib/projections/governed-depth-summary.js', 'assets/atl-140-v15-journey.mjs', 'assets/atl-s8-history-sync.mjs', 'assets/atl-167-v15-deepen-inspect.mjs', 'canvas-v2/canvas-v2/index.html', 'canvas-v2/canvas-v2/assets/canvas-v2.js', 'canvas-v2/canvas-v2/assets/canvas-v2.css']
    .map((p) => [p, {tree: worktreeBlob(root, p), lab: pkgBlobOf('lab', p), stable: pkgBlobOf('stable', p)}]));
  // stale WD lineage id inside packaged files: permitted ONLY as the pinned S8-2D governed binding-set schema const (accepted lineage; not generated output)
  const schemaPin = lineage.find((l) => l.id === 'contract.client-binding-set-schema')?.expected ?? null;
  const packageStaleMarkers = pkgFiles.filter((e) => /\.(js|mjs|cjs|html|json|md)$/.test(e.path) && fs.existsSync(path.join(root, 'release/packages', e.channel, e.path)) && fs.readFileSync(path.join(root, 'release/packages', e.channel, e.path), 'utf8').includes(STALE_WD_MARKER))
    .map((e) => ({channel: e.channel, path: e.path, gitBlob: e.gitBlob, permitted: e.path === 'data/contracts/atlas-client-binding-set-v1.schema.json' && schemaPin !== null && e.gitBlob === schemaPin, justification: 'pinned S8-2D governed schema const (contract.client-binding-set-schema); identical bytes to the tracked governed contract'}));
  const packagesCarryCurrent = Object.values(currentIdentities).every((v) => v.tree && v.tree === v.lab && v.tree === v.stable);

  // release integrity (regenerated baseline must PASS at the RC; drift is reconciled, never waived)
  const integrity = verifyBaseline(root);
  const recon = fs.existsSync(path.join(root, DRIFT_RECON_PATH)) ? readJson(root, DRIFT_RECON_PATH) : null;
  const releaseIntegrity = {endpoint: '/api/release-integrity', verifier: {path: 'lib/api/release-integrity.js', blob: worktreeBlob(root, 'lib/api/release-integrity.js')}, baseline: {path: BASELINE_PATH, blob: worktreeBlob(root, BASELINE_PATH), sha256: worktreeSha(root, BASELINE_PATH), fileCount: integrity.fileCount},
    observedVerification: {status: integrity.status, mismatchedCount: integrity.mismatches.length, mismatches: integrity.mismatches}, driftWaived: false, verifierWeakened: false,
    reconciliation: {path: DRIFT_RECON_PATH, blob: worktreeBlob(root, DRIFT_RECON_PATH), sha256: worktreeSha(root, DRIFT_RECON_PATH), driftEntries: recon ? recon.summary?.driftCount ?? null : null, unexplainedDrift: recon ? recon.summary?.unexplainedCount ?? null : null,
      allAuthorizedClassifiedInRcNotStaleNotAccidental: recon ? recon.summary?.allReconciled === true : false},
    certified: integrity.status === 'PASSES_VERIFICATION' && recon?.summary?.allReconciled === true, certifiesRuntimeReadiness: false};

  // rollback
  const rollbackVerification = verifyRollbackManifest(root);
  const rollbackManifest = fs.existsSync(path.join(root, ROLLBACK_MANIFEST_PATH)) ? readJson(root, ROLLBACK_MANIFEST_PATH) : null;
  const rollback = {rollbackMechanismStatus: 'ESTABLISHED', rollbackIdentityStatus: rollbackVerification.ok ? 'ESTABLISHED_REFERENCE_ONLY' : 'NOT_ESTABLISHED', manifest: {path: ROLLBACK_MANIFEST_PATH, blob: worktreeBlob(root, ROLLBACK_MANIFEST_PATH), sha256: worktreeSha(root, ROLLBACK_MANIFEST_PATH), verification: rollbackVerification.ok ? 'VERIFIED' : 'FAILED', failures: rollbackVerification.failures},
    nominatedRollbackAssets: ROLLBACK_ASSETS.map((a) => ({assetId: a.assetId, path: a.path, sha256: a.sha256, observedSha256: worktreeSha(root, a.path)})), injectedIntoActiveV15Execution: rollbackManifest?.injectedIntoActiveV15Execution ?? null,
    candidateOrStaleBranchNominated: false, runbook: {path: 'release/ROLLBACK_RUNBOOK.md', blob: worktreeBlob(root, 'release/ROLLBACK_RUNBOOK.md')}, deploymentRollbackIdentity: 'NOT_ESTABLISHED (no deployment exists; none inferred)'};

  const pkgStatusOk = CHANNELS.every((ch) => packages[ch].verification === 'VERIFIED_EXACT_FILE_SET_AND_BYTES');
  const rtState = pred.runtimeState;
  const assetClosure = {
    askSupersededAbsentFromPackages: supersededAskInPackages.length === 0, stalePackageFilesAbsent: stalePackageFiles.length === 0, packagesVerifiedExact: pkgStatusOk, packagesCarryCurrentIdentities: packagesCarryCurrent,
    supersededIdentitiesAbsentFromRcTree: ['excluded.superseded-ask-api', 'excluded.superseded-journey-s8-4', 'excluded.superseded-journey-s8-5b', 'excluded.superseded-api-atlas-s8-4'].every((x) => exclById.get(x)?.status === 'ABSENT_FROM_AUTHORITY'),
    protectedExecutionAbsentFromPackages: pkgFiles.every((e) => !/^execution\/(runtimes|adapters|core|contracts)\//.test(e.path) && !e.path.startsWith('release/custody/')), rollbackManifestVerified: rollbackVerification.ok, baselinePassesAtRc: integrity.status === 'PASSES_VERIFICATION'
  };
  const assetClosed = Object.values(assetClosure).every(Boolean);

  const manifest = {
    schemaVersion: SUCCESSOR_SCHEMA, releaseId: 'atlas-v1.5-road-ltl-malkom-successor-rc', manifestClass: 'GOVERNED_SUCCESSOR_RC_MANIFEST',
    stage: {id: 'S8-6', authority: ['S7-IMP-003', 'S7-IMP-004', 'S7-IMP-006', 'S7-IMP-021', 'S6-LIN-034', 'S6-LIN-035', 'SEQ-09'], meaning: 'successor RC assembly/custody consistency only; ready for ATL-181 independent audit; NOT ATL-181 PASS, UAT, sign-off, promotion, deployment or runtime readiness'},
    supersedes: {predecessorManifest: {path: PREDECESSOR_MANIFEST_PATH, blob: worktreeBlob(root, PREDECESSOR_MANIFEST_PATH), disposition: 'PREDECESSOR_EVIDENCE_UNMODIFIED_NOT_CURRENT_AUTHORITY', mutated: false, regeneratedInPlace: false}, historicalAssemblies: assemblies, historicalContentCarriedForward: false},
    generator: {paths: [...GENERATOR_PATHS], blobs: Object.fromEntries(GENERATOR_PATHS.map((p) => [p, worktreeBlob(root, p)])), predecessorGeneratorPaths: [...PREDECESSOR_GENERATOR_PATHS], predecessorGeneratorBlobs: Object.fromEntries(PREDECESSOR_GENERATOR_PATHS.map((p) => [p, worktreeBlob(root, p)])), deterministic: true, inputs: 'pinned registry + repository tree + committed custody; no clock, no randomness, no network, no divergent-branch read'},
    successorSpine: {
      branchBase: C.s8_5bFinalHead, branchBaseTree: C.s8_5bFinalTree,
      s8_5b: {finalEvidenceHead: C.s8_5bFinalHead, testedCommit: C.s8_5bTested, testedTree: C.s8_5bTestedTree, qaEvidenceSha256: SHA.s8_5bEvidence, qaEvidencePath: 'governance/product/s8-5b-evidence/exact-qa.json'},
      s8_5a: {head: C.s8_5aHead, testedCommit: C.s8_5aTested, qaEvidenceSha256: SHA.s8_5aEvidence}, s8_4: {finalEvidenceHead: C.s8_4Head, testedCommit: C.s8_4Tested, qaEvidencePath: 'governance/product/s8-4-evidence/exact-qa.json'}, s8_3f: {finalEvidenceHead: C.s8_3fHead, testedCommit: C.s8_3fTested, qaEvidenceSha256: SHA.s8_3fEvidence},
      dauRemediation: {fixCommit: C.dauFix, testedCommit: DAU_EVIDENCE.testedCommit, evidence: DAU_EVIDENCE.path, evidenceSha256: DAU_EVIDENCE.sha256, historyModuleBlob: worktreeBlob(root, 'assets/atl-s8-history-sync.mjs'), journeySuccessorBlob: worktreeBlob(root, 'assets/atl-140-v15-journey.mjs')},
      publicDerivativeSummaries: pred.successorSpine.publicDerivativeSummaries, workDefinitionId: pred.successorSpine.workDefinitionId
    },
    lineage, exclusions, staleLineageMarkerFiles: staleMarkerFiles,
    sourceCustody: {path: cus.pins?.custodyFile ?? null, gitBlob: custBlob, sha256: custSha, bytes: cus.bytes ? cus.bytes.length : null, taskHash: SHA.taskHash, pinsRecord: CUSTODY_PINS_PATH, divergentCommit: C.divergentSource, divergentCommitAncestorOfRc: isAncestor(root, C.divergentSource), readsDivergentCommit: false, deployed: false, deploymentExclusion: '.vercelignore: release/custody/'},
    packages: {lab: packages.lab, stable: packages.stable, builder: {paths: [...PACKAGE_BUILDER_PATHS], blobs: Object.fromEntries(PACKAGE_BUILDER_PATHS.map((p) => [p, worktreeBlob(root, p)])), deterministic: true},
      carriesCurrentIdentities: currentIdentities, staleMarkerOccurrences: packageStaleMarkers, supersededAskPresent: supersededAskInPackages, staleFilesPresent: stalePackageFiles, respectsVercelIgnore: true, manifestsIncludedInPackages: false},
    rollback, releaseIntegrity, ltl04Materialization: ltl04Materialization(root), protectedBytesScan: (({protectedIdentitiesChecked, leaks, generatedFlowFiles, bytesPublished}) => ({protectedIdentitiesChecked, leaks, generatedFlowFiles, bytesPublished}))(protectedBytesScan(root)),
    deploymentCandidate: {class: 'IDENTITY_ONLY_NOT_A_DEPLOYMENT', packages: {lab: {treeSha256: packages.lab.treeSha256, fileCount: packages.lab.fileCount}, stable: {treeSha256: packages.stable.treeSha256, fileCount: packages.stable.fileCount}}, rollbackManifestSha256: rollback.manifest.sha256, sourceCustodySha256: custSha,
      integrityBaselineSha256: releaseIntegrity.baseline.sha256, rcCommitAndTree: 'the exact tested commit/tree recorded by the S8-6 exact-QA evidence; never self-referenced by this manifest', deployed: false},
    controls: {ownerGateRequired: true, productionPromotionAuthorized: false, stagePath: ['STAGING', 'INDEPENDENT_QA', 'OWNER_GATE', 'PRODUCTION'], channelMapping: {staging: 'Lab', production: 'Stable'}, frozenAssetMutationAllowed: false,
      identityVerification: {mode: 'EXACT', onMismatch: 'FAIL_CLOSED', implicitMultiGenerationNegotiation: false, unknownCompatibility: 'FAIL_CLOSED'}, verificationEndpoints: ['/api/version', '/api/readiness', '/api/release-integrity'], mechanismSource: 'ATL-175 dd32b8a4… (retained mechanism only; content is evidence)'},
    runtimeState: rtState,
    defects: {
      'DEF-REL-ASSET-001': {s8Portion: assetClosed ? 'CLOSED_S8_PORTION' : 'OPEN', proofs: assetClosure, scope: 'S8 successor RC release assets only; any non-S8 portion remains open', closesRuntimeReadiness: false},
      'DEF-DAU-007': {status: 'REMEDIATED_BOUNDED_ON_SUCCESSOR_PENDING_ATL181_INDEPENDENT_AUDIT', evidence: DAU_EVIDENCE.path, fixCommit: C.dauFix, closedByThisManifest: false},
      'DEF-DAU-006': {status: 'REGRESSION_CLOSED_BOUNDED_ON_SUCCESSOR_PENDING_ATL181_INDEPENDENT_AUDIT', evidence: DAU_EVIDENCE.path, closedByThisManifest: false},
      'DEF-GOV-002': {status: 'PRESERVED_OPEN', routing: 'governance/product/s8-6-evidence/gov-002-residual-routing.md', silentlyClosed: false}
    },
    deferredV2Obligations: DEFERRED_V2.map((d) => ({id: d.id, title: d.title, status: 'DEFERRED_NOT_PASS', markedPass: false, handoff: 'governance/product/s8-6-evidence/v2-preservation-handoff.md'})),
    downstream: {'S8-5': 'COMPLETE/PASS', 'S8-6': 'RC ASSEMBLED — freeze subject to exact-QA evidence', 'ATL-181': 'BLOCKED — until S8-6 freezes the RC (controller decision on this evidence)', release: 'DO NOT MERGE / DO NOT PROMOTE', successorRc: 'ASSEMBLED (this manifest); not deployed'},
    residuals: [
      {id: 'RES-DEPLOYMENT-IDENTITY', status: 'NOT_ESTABLISHED', detail: 'No exact last-known-good deployment identity exists; none inferred or fabricated.'},
      {id: 'RES-S8-3B-QA-HASH-RECORD', status: 'RECORD_DISCREPANCY_FOR_RECONCILIATION', detail: 'The S8-3B closure row records an evidence SHA256 that differs from the committed exact-qa.json; derivative identities are unaffected; the committed file identity is pinned.'},
      {id: 'RES-ROOT-INIT-ORDER', status: 'PRE_EXISTING_ROOT_DEFECT_COMPENSATED', detail: 'The certified root restores deep-link/last-session state before the V1.5 layers exist (stage15RenderContract is not defined); the root is unchanged and the history module re-applies the canonical target after the root settles.'},
      {id: 'RES-ROOT-LOAD-RACE', status: 'PRE_EXISTING_ROOT_RACE_NOTED', detail: 'Intermittent load-time stack overflow in the unchanged root (Stage-8 closeFutureDrawer recursion repaired by a later script block); mechanism proven independent of the history module; counted in QA evidence.'},
      {id: 'RES-SHARE-LINK-A5', status: 'NOTED', detail: 'The existing share-link serialization cannot encode A4 vs A5; history entries carry the exact level.'},
      {id: 'RES-HISTORY-OVERLAYS', status: 'NOTED', detail: 'Working-surface/context overlays are not recorded in history and reset on traversal.'},
      {id: 'RES-DEPLOYMENT-BUNDLING', status: 'UNVERIFIED', detail: 'Bundling of the governed-depth-summary action into the deployed function set is verified only in-package (router/handler import and execution inside the package directory), not on a deployment.'},
      {id: 'RES-LTL04-DAUGHTER-ASK', status: 'FAIL_CLOSED_BY_DESIGN', detail: 'LTL-04 execution-depth/Daughter/Ask paths return 404 (ATL-157 not materialized for LTL-04); no fabricated depth.'},
      {id: 'RES-NONGATING-PREEXISTING-TESTS', status: 'NOTED', detail: 'tests/v2-ui-browser-smoke.mjs and tests/v1.1.4-static-parity.mjs fail identically on the base; classified non-gating.'},
      {id: 'RES-NODE-VARIANCE', status: 'NOTED', detail: 'QA runs on Node v22; repository engines state 24.x.'},
      {id: 'RES-ATL141-MOVING-TIP', status: 'NOTED', detail: 'The ATL-141 RC commit is pinned as a constant; branch tips are never resolved or trusted.'}
    ]
  };
  return manifest;
}

// ------------------------------------------------------------------ verify (fail-closed; returns every failure)
const REQUIRED_LINEAGE = Object.freeze(['source.road-ltl-v1.4', 'custody.source-sha256', 'custody.pins-record', 'interaction.atl-140-journey', 'successor.api-atlas-router', 'successor.history-sync-module', 'successor.atl167-deepen-module', 'successor.governed-depth-api',
  'successor.governed-depth-projection', 'stage.s8-3f', 'stage.s8-5a', 'stage.s8-5b', 'stage.s8-6-dau', 'release.integrity-baseline', 'release.rollback-manifest', 'release.drift-reconciliation', ...PROTECTED.map((p) => p.id)]);

export async function verifySuccessorManifest(manifest, {root, canonicalHash = null, reproduce = null} = {}) {
  const f = []; const fail = (code, detail) => f.push({code, detail});
  const m = manifest;
  if (!m || typeof m !== 'object') return {ok: false, failures: [{code: 'MANIFEST_INVALID', detail: 'not an object'}]};
  if (m.schemaVersion !== SUCCESSOR_SCHEMA) fail('SCHEMA_VERSION_MISMATCH', String(m.schemaVersion));
  let rebuilt;
  try { rebuilt = await buildSuccessorManifest(root, {canonicalHash}); } catch (e) { const code = /^([A-Z][A-Z0-9_]+)[:\s]/.exec(String(e.message))?.[1] ?? 'RC_REBUILD_ERROR'; return {ok: false, failures: [{code, detail: String(e.message).slice(0, 300)}]}; }
  const byId = new Map((m.lineage ?? []).map((l) => [l.id, l]));
  for (const id of REQUIRED_LINEAGE) if (!byId.has(id)) fail(id === 'interaction.atl-140-journey' || id.startsWith('successor.') ? 'SUCCESSOR_IDENTITY_MISSING' : id.startsWith('source.') || id.startsWith('custody.') ? 'SOURCE_CUSTODY_MISSING' : id.startsWith('stage.s8-6') ? 'DAU_RESULT_OMITTED' : id.startsWith('release.') ? 'RELEASE_CONTROL_MISSING' : id.startsWith('derivative.') ? 'ENTRY_MISSING' : 'LINEAGE_ENTRY_MISSING', id);
  for (const l of m.lineage ?? []) {
    const reg = rebuilt.lineage.find((r) => r.id === l.id);
    if (!reg) { fail('UNKNOWN_ENTRY', l.id); continue; }
    if (serialize(l.expected) !== serialize(reg.expected)) fail(l.id === 'interaction.atl-140-journey' ? 'JOURNEY_IDENTITY_REPLACED' : /^source\.|^custody\./.test(l.id) ? 'SOURCE_HASH_ALTERED' : String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_REPLACED_OR_STALE', `${l.id}: manifest expected differs from the accepted pin`);
    if (serialize(l.observed) !== serialize(reg.observed)) fail(/^source\.|^custody\./.test(l.id) ? 'SOURCE_CUSTODY_DRIFT' : String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_MISMATCH', `${l.id}: recorded observed identity differs from the repository`);
    if (reg.status !== 'MATCH') fail(l.id === 'interaction.atl-140-journey' || l.id === 'successor.api-atlas-router' ? 'SUCCESSOR_IDENTITY_MISMATCH' : /^source\.|^custody\./.test(l.id) ? 'SOURCE_CUSTODY_DRIFT' : l.id === 'stage.s8-6-dau' ? 'DAU_RESULT_OMITTED' : String(l.id).startsWith('derivative.') ? 'OUTPUT_HASH_DRIFT' : 'IDENTITY_MISMATCH', `${l.id}: repository identity is ${reg.status}`);
    if (l.status !== 'MATCH') fail('ENTRY_NOT_MATCH', `${l.id}: ${l.status}`);
    if (l.classification === 'EXECUTION_PROTECTED') { if (l.bytesPublished !== false || 'path' in l || 'content' in l || 'bytes' in l || 'body' in l || l.custody?.reconstructedContentInManifest !== false) fail('PROTECTED_BYTES_PUBLISHED', l.id); }
    else if (String(l.id).startsWith('derivative.')) fail('PROTECTED_BYTES_PUBLISHED', `${l.id}: derivative must be EXECUTION_PROTECTED`);
  }
  // supersession of historical assemblies
  const sup = m.supersedes ?? {};
  if (sup.predecessorManifest?.mutated !== false || sup.predecessorManifest?.regeneratedInPlace !== false || sup.predecessorManifest?.blob !== '4bdc0873086c514e399d16972875b69716d69fde' || worktreeBlob(root, PREDECESSOR_MANIFEST_PATH) !== '4bdc0873086c514e399d16972875b69716d69fde') fail('HISTORICAL_EVIDENCE_REWRITTEN', 'predecessor S8-3F manifest');
  for (const a of HISTORICAL_ASSEMBLIES) {
    const x = (sup.historicalAssemblies ?? []).find((y) => y.id === a.id);
    if (!x) { fail('HISTORICAL_ASSEMBLY_RECORD_MISSING', a.id); continue; }
    if (x.currentAuthority !== false) fail(a.id === 'S7-IMP-003' ? 'STALE_ATL141_RC_NOMINATED' : a.id === 'S7-IMP-021' ? 'STALE_ATL141_RC_NOMINATED' : 'STALE_ATL142_ROOT', a.id);
    if (x.commit !== a.commit || x.tree !== a.tree) fail('HISTORICAL_ASSEMBLY_IDENTITY_ALTERED', a.id);
    if (x.historyDeleted !== false || x.historyMutated !== false) fail('HISTORICAL_EVIDENCE_REWRITTEN', a.id);
  }
  for (const x of rebuilt.supersedes.historicalAssemblies) { if (x.ancestorOfRc) fail(x.id === 'S7-IMP-003' || x.id === 'S7-IMP-021' ? 'STALE_ATL141_RC_NOMINATED' : 'STALE_ATL142_ROOT', `${x.id} is an ancestor of the RC`); for (const d of x.distinguishingIdentities) if (d.status !== 'ABSENT_FROM_AUTHORITY') fail(x.id === 'S7-IMP-003' || x.id === 'S7-IMP-021' ? 'STALE_ATL141_RC_NOMINATED' : 'STALE_ATL142_ROOT', `${x.id}: ${d.exclusion} ${d.status}`); }
  // exclusions: never authority; never present
  const excl = new Map((m.exclusions ?? []).map((e) => [e.id, e]));
  for (const e of [...EXCLUDED, ...EXCLUDED_ADDED]) { const x = excl.get(e.id); if (!x) { fail('EXCLUSION_RECORD_MISSING', e.id); continue; } if (x.currentAuthority !== false) fail('STALE_IDENTITY_AS_AUTHORITY', e.id); if (x.classification !== e.classification) fail('EXCLUSION_RECLASSIFIED', e.id); }
  const codeFor = (id) => id === 'excluded.superseded-ask-api' ? 'SUPERSEDED_ASK_INCLUDED' : id === 'excluded.atl-142-root-index' || id === 'excluded.atl-142-commit' ? 'STALE_ATL142_ROOT' : id === 'excluded.atl-140-root-index' ? 'STALE_ATL140_ROOT' : id === 'excluded.superseded-journey-s8-4' || id === 'excluded.superseded-journey-s8-5b' ? 'OLD_JOURNEY_RESTORED' : id === 'excluded.superseded-api-atlas-s8-4' ? 'OLD_API_ATLAS_RESTORED' : id === 'excluded.divergent-source-commit' ? 'DIVERGENT_BRANCH_DEPENDENCY' : /atl-141|atl-175/.test(id) ? 'STALE_ATL141_RC_NOMINATED' : 'EXCLUDED_IDENTITY_PRESENT';
  for (const x of rebuilt.exclusions) { if (x.status === 'PRESENT_VIOLATION') fail(codeFor(x.id), `${x.id} ${JSON.stringify(x.locations ?? x.value)}`); if (x.status === 'HISTORICAL_BLOB_PIN_MISSING') fail('EXCLUSION_PIN_MISSING', x.id); }
  for (const l of m.lineage ?? []) for (const e of EXCLUDED) if (e.kind === 'GIT_BLOB' && (l.expected === e.value || l.observed === e.value)) fail(codeFor(e.id), `${l.id} carries excluded ${e.id}`);
  if ((rebuilt.staleLineageMarkerFiles ?? []).length || (m.staleLineageMarkerFiles ?? []).length) fail('STALE_WD_LINEAGE_MARKER', [...rebuilt.staleLineageMarkerFiles, ...(m.staleLineageMarkerFiles ?? [])].join(','));
  // source custody (no divergent-commit dependency)
  const sc = m.sourceCustody ?? {};
  if (!sc.path || !fs.existsSync(path.join(root, sc.path))) fail('SOURCE_CUSTODY_MISSING', String(sc.path));
  else if (sha256Hex(fs.readFileSync(path.join(root, sc.path))) !== SHA.sourceModule) fail('SOURCE_HASH_ALTERED', sc.path);
  if (sc.readsDivergentCommit !== false || sc.deployed !== false) fail('DIVERGENT_BRANCH_DEPENDENCY', JSON.stringify({r: sc.readsDivergentCommit, d: sc.deployed}));
  // packages
  for (const ch of CHANNELS) { const p = m.packages?.[ch]; if (!p || p.verification !== 'VERIFIED_EXACT_FILE_SET_AND_BYTES') fail('PACKAGE_NOT_VERIFIED', `${ch}: ${p?.verification}`); const v = verifyPackageDir(root, ch); for (const x of v.failures) fail(/PACKAGE_EXTRA_FILE|PACKAGE_FILE_DRIFT|PACKAGE_MANIFEST_DRIFT/.test(x.code) ? 'PACKAGE_STALE_OR_DRIFTED_FILE' : x.code, `${ch}:${x.detail}`); }
  for (const o of rebuilt.packages.staleMarkerOccurrences ?? []) if (!o.permitted) fail('STALE_WD_LINEAGE_MARKER', `${o.channel}:${o.path}`);
  if ((rebuilt.packages.supersededAskPresent ?? []).length) fail('SUPERSEDED_ASK_INCLUDED', rebuilt.packages.supersededAskPresent.join(','));
  if ((rebuilt.packages.staleFilesPresent ?? []).length) fail('PACKAGE_STALE_OR_DRIFTED_FILE', rebuilt.packages.staleFilesPresent.join(','));
  // controls
  const c = m.controls ?? {};
  if (c.ownerGateRequired !== true) fail('OWNER_GATE_REMOVED', String(c.ownerGateRequired));
  if (c.productionPromotionAuthorized !== false) fail('PRODUCTION_PROMOTION_AUTHORIZED', String(c.productionPromotionAuthorized));
  if (c.identityVerification?.mode !== 'EXACT' || c.identityVerification?.onMismatch !== 'FAIL_CLOSED') fail('IDENTITY_VERIFICATION_NOT_FAIL_CLOSED', JSON.stringify(c.identityVerification));
  if (c.frozenAssetMutationAllowed !== false) fail('FROZEN_ASSET_MUTATION_ALLOWED', String(c.frozenAssetMutationAllowed));
  // rollback
  const rv = verifyRollbackManifest(root); for (const x of rv.failures) fail(x.code, x.detail);
  if (m.rollback?.injectedIntoActiveV15Execution !== false || m.rollback?.candidateOrStaleBranchNominated !== false) fail('ROLLBACK_STALE_BRANCH_NOMINATED', JSON.stringify({i: m.rollback?.injectedIntoActiveV15Execution, c: m.rollback?.candidateOrStaleBranchNominated}));
  if (m.rollback?.rollbackIdentityStatus !== 'ESTABLISHED_REFERENCE_ONLY') fail('ROLLBACK_IDENTITY_NOT_ESTABLISHED', String(m.rollback?.rollbackIdentityStatus));
  // release integrity (drift reconciled, never waived)
  const ri = m.releaseIntegrity ?? {}; const live = rebuilt.releaseIntegrity;
  if (live.observedVerification.status !== 'PASSES_VERIFICATION') fail('INTEGRITY_BASELINE_FAILS_AT_RC', JSON.stringify(live.observedVerification.mismatches));
  try { const bl = JSON.parse(fs.readFileSync(path.join(root, BASELINE_PATH), 'utf8')); const missing = baselinePaths(root).filter((p) => !(p in (bl.files ?? {}))); if (missing.length) fail('INTEGRITY_BASELINE_COVERAGE_REDUCED', missing.join(',')); } catch (e) { fail('INTEGRITY_BASELINE_UNREADABLE', String(e.message)); }
  if (ri.driftWaived !== false || ri.verifierWeakened !== false) fail('INTEGRITY_DRIFT_WAIVED', JSON.stringify({w: ri.driftWaived, v: ri.verifierWeakened}));
  if (live.reconciliation.allAuthorizedClassifiedInRcNotStaleNotAccidental !== true || live.reconciliation.unexplainedDrift !== 0) fail('INTEGRITY_UNEXPLAINED_DRIFT', JSON.stringify(live.reconciliation));
  if (serialize(ri.observedVerification ?? null) !== serialize(live.observedVerification)) fail('RELEASE_INTEGRITY_STATE_DRIFT', 'observedVerification differs from recomputation');
  // runtime / blockers
  const rt = m.runtimeState ?? {};
  if (rt.universalExecutionReady !== false || rt.materializable !== false || rt.runtimeCertification !== false || rt.projectionDisposition !== 'BLOCKED' || rt.runtimeReadiness !== 'NOT_PROMOTED' || rt.independentExecutorProofStatus !== 'NOT_INDEPENDENTLY_PROVEN') fail('READINESS_PROMOTED', JSON.stringify(rt));
  if (rt.unresolvedBindingCount !== 1 || rt.notCompiledLeafCount !== 4 || rt.blockedByClientBindingLeafCount !== 2 || rt.blockedByKnowledgeGapLeafCount !== 2 || rt.clientBindingState !== 'CLIENT_BINDING_REQUIRED' || rt.knowledgeGapState !== 'BLOCKED') fail('BLOCKED_LEAVES_HIDDEN', JSON.stringify(rt));
  // deferred obligations + defects + downstream
  const dv = new Map((m.deferredV2Obligations ?? []).map((d) => [d.id, d]));
  for (const d of DEFERRED_V2) { const x = dv.get(d.id); if (!x) fail('DEFERRED_OBLIGATION_MISSING', d.id); else if (x.status !== 'DEFERRED_NOT_PASS' || x.markedPass !== false) fail('DEFERRED_MARKED_PASS', d.id); }
  const df = m.defects ?? {};
  if (df['DEF-GOV-002']?.status !== 'PRESERVED_OPEN' || df['DEF-GOV-002']?.silentlyClosed !== false) fail('GOV_002_SILENTLY_CLOSED', JSON.stringify(df['DEF-GOV-002']));
  if (!df['DEF-DAU-007'] || df['DEF-DAU-007'].closedByThisManifest !== false) fail('DAU_RESULT_OMITTED', 'DEF-DAU-007');
  if (df['DEF-REL-ASSET-001']?.s8Portion === 'CLOSED_S8_PORTION' && !Object.values(df['DEF-REL-ASSET-001'].proofs ?? {}).every(Boolean)) fail('DEF_REL_ASSET_CLOSED_WITHOUT_PROOFS', JSON.stringify(df['DEF-REL-ASSET-001'].proofs));
  if (serialize(df['DEF-REL-ASSET-001'] ?? null) !== serialize(rebuilt.defects['DEF-REL-ASSET-001'])) fail('DEF_REL_ASSET_STATE_DRIFT', 'recomputed closure differs');
  const d = m.downstream ?? {};
  if (d['S8-5'] !== 'COMPLETE/PASS' || !/^BLOCKED/.test(d['ATL-181'] ?? '') || d.release !== 'DO NOT MERGE / DO NOT PROMOTE') fail('DOWNSTREAM_STATE_ALTERED', JSON.stringify(d));
  const lm = m.ltl04Materialization ?? {}; const liveLm = rebuilt.ltl04Materialization;
  if (liveLm.violations.length) fail('ATL157_LTL04_MATERIALIZED', liveLm.violations.map((v) => v.path).join(','));
  if (lm.atl157InProduct !== false || lm.ltl04DaughterOrDepthMaterialized !== false || (lm.violations ?? []).length !== 0 || lm.materializable !== false) fail('ATL157_LTL04_MATERIALIZED', JSON.stringify(lm));
  if (rebuilt.protectedBytesScan.bytesPublished) fail('PROTECTED_BYTES_PUBLISHED', JSON.stringify({leaks: rebuilt.protectedBytesScan.leaks, flow: rebuilt.protectedBytesScan.generatedFlowFiles}));
  if (m.protectedBytesScan?.bytesPublished !== false) fail('PROTECTED_BYTES_PUBLISHED', 'manifest protectedBytesScan');
  if (!fs.existsSync(path.join(root, '.vercelignore')) || !fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split('\n').map((l) => l.trim()).includes('release/custody/')) fail('CUSTODY_NOT_EXCLUDED_FROM_DEPLOYMENT', '.vercelignore');
  // optional reproduction of the protected identities from the CUSTODY copy (never printed)
  if (reproduce) for (const [id, h] of Object.entries(reproduce)) { const l = byId.get(id); if (!l || l.observed !== h) fail('OUTPUT_HASH_DRIFT', `${id}: reproduced identity differs`); }
  if (serialize(m) !== serialize(rebuilt)) fail('MANIFEST_DRIFT', 'manifest differs from deterministic regeneration');
  return {ok: f.length === 0, failures: f};
}

export async function generateSuccessorManifest(root, opts = {}) {
  const manifest = await buildSuccessorManifest(root, opts);
  const bad = manifest.lineage.filter((l) => l.status !== 'MATCH');
  if (bad.length) throw Error('GENERATION_REFUSED: ' + bad.map((l) => `${l.id}=${l.status}`).join(', '));
  const viol = manifest.exclusions.filter((x) => x.status !== 'ABSENT_FROM_AUTHORITY');
  if (viol.length) throw Error('GENERATION_REFUSED: excluded identity present: ' + viol.map((x) => x.id).join(', '));
  if (manifest.releaseIntegrity.observedVerification.status !== 'PASSES_VERIFICATION') throw Error('GENERATION_REFUSED: release-integrity baseline does not verify');
  return manifest;
}

// Reproduce the protected derivative identities from the CUSTODY copy of the governed source (no divergent-commit read). Returns hashes only.
export async function reproduceFromCustody(root) {
  const u = (p) => import(new URL('file://' + path.join(root, p)));
  const {generateMalkomPackage} = await u('lib/compile/s8-malkom-package.js');
  const {generateMalkomProjection} = await u('lib/compile/s8-malkom-projection.js');
  const {canonicalHash} = await u('lib/compile/workdefinition-compiler.js');
  const {reconstructTask} = await u('lib/compile/source-task-decomposition.js');
  const {compileCorrectedTask} = await u('lib/compile/s8-workdefinition-compiler.js');
  const {generateFlowArtifacts} = await u('lib/compile/s8-flow-bpmn.js');
  const pins = readJson(root, CUSTODY_PINS_PATH);
  const sourceBytes = fs.readFileSync(path.join(root, pins.custodyFile));
  if (sha256Hex(sourceBytes) !== SHA.sourceModule) throw Error('SOURCE_HASH_ALTERED');
  const source = JSON.parse(sourceBytes.toString('utf8'));
  const run = (s) => JSON.parse(cp.execFileSync(process.execPath, [s], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}));
  const semantics = run('scripts/materialize-operational-semantics-v1.cjs'); const binding = run('scripts/materialize-client-binding-v1.cjs');
  const record = semantics.records.find((r) => r.processId === 'LTL-04'); const task = source.tasks.find((t) => t.taskId === 'LTL-04');
  const pin = {commit: pins.origin.commit, path: pins.origin.path, blob: pins.gitBlob, taskHash: canonicalHash(task), semanticSourceVersion: '1.4'};
  const envelope = reconstructTask(task, pin, record, binding);
  const compiled = compileCorrectedTask(envelope, canonicalHash(envelope.decomposition), semantics, binding);
  const a = generateMalkomPackage(compiled, binding, record);
  const projection = generateMalkomProjection(compiled, a.packageArtifact, a.readiness);
  const flow = generateFlowArtifacts(compiled, a.packageArtifact, a.readiness, projection);
  return {'derivative.wd': canonicalHash(compiled), 'derivative.package': canonicalHash(a.packageArtifact), 'derivative.readiness': canonicalHash(a.readiness), 'derivative.projection': canonicalHash(projection),
    'derivative.flow-graph': flow.identities.graphHash, 'derivative.flow-view': flow.identities.flowViewSha256, 'derivative.bpmn': flow.identities.bpmnSha256, 'derivative.svg': flow.identities.svgSha256,
    'source.task-hash': canonicalHash(task), 'source.semantics-record': canonicalHash(record), 'source.client-binding': canonicalHash(binding)};
}

export {rcSerialize, buildRollbackManifest, trackedFiles};
