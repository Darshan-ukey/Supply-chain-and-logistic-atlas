import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

// S8-6 deterministic Lab/Stable package builder (SUCCESSOR; replaces the stale v1.1.7 builder output; the old builder is not modified).
//
// A package is a pure function of (this policy + the git-tracked repository tree at the RC). No clock, no randomness, no network.
// It carries the CURRENT successor identities (root/presentation, Canvas + bridge, Universal Ask 2.0.1, router/API incl. governed-depth-summary,
// journey, history module, public data/evidence, release-control assets) and never the protected execution implementation (.vercelignore),
// the governed source custody, tests, prototypes, or any historical/stale assembly output.
// Packages never contain the successor manifest or rollback manifest (they record package identities; including them would be circular and
// would inject rollback reference material into active execution).

export const PACKAGE_BUILDER_PATHS = Object.freeze(['lib/release/s8-6-package-builder.js', 'release/scripts/s8-6-build-packages.mjs']);
export const CHANNELS = Object.freeze(['lab', 'stable']);
export const PACKAGES_DIR = 'release/packages';
export const PACKAGE_MANIFEST_NAME = 'PACKAGE_MANIFEST.json';
export const PACKAGE_SCHEMA = 's8-6-package-manifest-v1';

const ROOT_FILES = ['index.html', 'admin.html', 'daughter.html', 'atl-140-malkom-consumer.html', 'legacy-reference-client.js', 'preview-standalone.html',
  'stage17-client.js', 'stage18-client.js', 'stage19-client.js', 'stage20-client.js', 'stage21-client.js', 'package.json', 'vercel.json', '.env.example', '.vercelignore'];
const LAB_ONLY_ROOT_FILES = ['accounts-payable-fixture-standalone.html'];
const DIR_PREFIXES = ['api/', 'assets/', 'canvas-v2/', 'data/', 'engine/', 'governance/', 'lib/', 'migrations/', 'reference/', 'runtime/', 'execution/ui/'];
const LAB_ONLY_PREFIXES = ['pilot/'];
const RELEASE_CONTROL_FILES = ['release/release-meta.js', 'release/baselines/v2-critical-hashes.json', 'release/RELEASE_CONTRACT.md', 'release/ROLLBACK_RUNBOOK.md', 'release/RELEASE_RUNBOOK.md'];
// never packaged (protected implementation, source custody, build/test/evidence tooling, stale/historical material)
const NEVER_PREFIXES = ['lib/compile/', 'lib/release/', 'governance/frozen-assets/', 'release/custody/', 'release/manifests/', 'release/packages/', 'tests/', 'scripts/', 'prototypes/', 'audits/', 'frozen-assets/',
  'execution/runtimes/', 'execution/adapters/', 'execution/core/', 'execution/contracts/'];
// stage QA evidence/tooling and governance prose are repository evidence, not deployment content (the evidence-only head commit must not change package identity)
const NEVER_PATTERNS = [/^governance\/product\/[^/]+\.md$/, /^governance\/product\/s8-[^/]+\/(exact-qa\.json|run-exact-qa\.cjs)$/, /^governance\/product\/s8-6-evidence\//, /^governance\/product\/s8-6-[^/]+\.(md|json)$/];
const NEVER_FILES = ['execution/manifest.json', 'governance/ATLAS_EXECUTION_FABRIC_ARCHITECTURE_V1_FROZEN.md', 'README_DEPLOY.txt'];

export const sha256Hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const gitBlobOfBytes = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000, stdio: ['ignore', 'pipe', 'pipe']});

// .vercelignore is read from the tree and enforced in addition to the explicit never-list (protected dirs can never slip in).
export function vercelIgnoreEntries(root) {
  const f = path.join(root, '.vercelignore');
  return (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}
const ignoredByVercel = (rel, entries) => entries.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

export function trackedFiles(root) {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean).sort();
}

export function planPackage(root, channel) {
  if (!CHANNELS.includes(channel)) throw new Error(`UNKNOWN_CHANNEL:${channel}`);
  const tracked = trackedFiles(root);
  const trackedSet = new Set(tracked);
  const ignore = vercelIgnoreEntries(root);
  const lab = channel === 'lab';
  const rootFiles = [...ROOT_FILES, ...(lab ? LAB_ONLY_ROOT_FILES : [])];
  const prefixes = [...DIR_PREFIXES, ...(lab ? LAB_ONLY_PREFIXES : [])];
  const picked = new Set();
  for (const f of rootFiles) { if (!trackedSet.has(f)) throw new Error(`PACKAGE_REQUIRED_FILE_MISSING:${f}`); picked.add(f); }
  for (const f of RELEASE_CONTROL_FILES) { if (!trackedSet.has(f)) throw new Error(`PACKAGE_REQUIRED_FILE_MISSING:${f}`); picked.add(f); }
  for (const f of tracked) if (prefixes.some((p) => f.startsWith(p))) picked.add(f);
  // Structural rule: every file the release-integrity baseline covers is in the package (the verifier reads them from the deployed working directory).
  // A baseline file under a never-packaged (protected / custody / test) path is a hard error, never silently dropped.
  const baselineFiles = [];
  if (trackedSet.has('release/baselines/v2-critical-hashes.json')) {
    const bl = JSON.parse(fs.readFileSync(path.join(root, 'release/baselines/v2-critical-hashes.json'), 'utf8'));
    for (const f of Object.keys(bl.files ?? {})) {
      if (!trackedSet.has(f)) throw new Error(`PACKAGE_BASELINE_FILE_UNTRACKED:${f}`);
      if (NEVER_PREFIXES.some((p) => f.startsWith(p) && f !== 'scripts/seed-v2-workdefinitions.mjs') || NEVER_FILES.includes(f) || (ignoredByVercel(f, ignore) && !rootFiles.includes(f))) throw new Error(`PACKAGE_BASELINE_FILE_NEVER_PACKAGED:${f}`);
      baselineFiles.push(f); picked.add(f);
    }
  }
  const out = [...picked].filter((f) => !NEVER_PREFIXES.some((p) => f.startsWith(p)) || RELEASE_CONTROL_FILES.includes(f))
    .filter((f) => !NEVER_FILES.includes(f) && !NEVER_PATTERNS.some((r) => r.test(f)) && !(ignoredByVercel(f, ignore) && !rootFiles.includes(f)));
  const outSet = new Set(out);
  for (const f of baselineFiles) outSet.add(f);
  return [...outSet].sort();
}

export function treeIdentity(entries) {
  // entries: [{path, sha256, bytes}] sorted by path
  return sha256Hex(entries.map((e) => `${e.sha256}  ${e.path}\n`).join(''));
}

export function describePackage(root, channel) {
  const files = planPackage(root, channel);
  const entries = files.map((p) => { const b = fs.readFileSync(path.join(root, p)); return {path: p, bytes: b.length, sha256: sha256Hex(b), gitBlob: gitBlobOfBytes(b)}; });
  return {entries, treeSha256: treeIdentity(entries)};
}

export function packageManifestFor(root, channel) {
  const d = describePackage(root, channel);
  return {schemaVersion: PACKAGE_SCHEMA, channel, class: 'GOVERNED_SUCCESSOR_PACKAGE (deployment-candidate content; not a deployment, not a promotion)', policy: {rootFiles: [...ROOT_FILES, ...(channel === 'lab' ? LAB_ONLY_ROOT_FILES : [])], directoryPrefixes: [...DIR_PREFIXES, ...(channel === 'lab' ? LAB_ONLY_PREFIXES : [])], releaseControlFiles: RELEASE_CONTROL_FILES, neverPackaged: [...NEVER_PREFIXES, ...NEVER_FILES, ...NEVER_PATTERNS.map(String)], vercelIgnoreEntries: vercelIgnoreEntries(root)},
    fileCount: d.entries.length, treeSha256: d.treeSha256, files: d.entries};
}
const stable = (v) => JSON.stringify(v, null, 2) + '\n';

export function buildPackages(root, {outDir = path.join(root, PACKAGES_DIR)} = {}) {
  fs.rmSync(outDir, {recursive: true, force: true});
  const summary = {};
  for (const channel of CHANNELS) {
    const dst = path.join(outDir, channel);
    const manifest = packageManifestFor(root, channel);
    for (const e of manifest.files) { const to = path.join(dst, e.path); fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(path.join(root, e.path), to); }
    fs.writeFileSync(path.join(dst, 'RELEASE_CHANNEL'), channel + '\n');
    fs.writeFileSync(path.join(dst, PACKAGE_MANIFEST_NAME), stable(manifest));
    summary[channel] = {fileCount: manifest.fileCount, treeSha256: manifest.treeSha256};
  }
  return summary;
}

// Verifies a package directory against the repository tree: exact file set, byte identity, manifest identity, no extra/stale files.
export function verifyPackageDir(root, channel, dir = path.join(root, PACKAGES_DIR, channel)) {
  const failures = []; const fail = (code, detail) => failures.push({code, detail});
  if (!fs.existsSync(dir)) return {ok: false, failures: [{code: 'PACKAGE_MISSING', detail: dir}]};
  const expected = packageManifestFor(root, channel);
  const expectedFiles = new Map(expected.files.map((e) => [e.path, e]));
  const present = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else present.push(path.relative(dir, f).split(path.sep).join('/')); } };
  walk(dir);
  const control = new Set(['RELEASE_CHANNEL', PACKAGE_MANIFEST_NAME]);
  for (const p of present) if (!expectedFiles.has(p) && !control.has(p)) fail('PACKAGE_EXTRA_FILE', p);
  for (const [p, e] of expectedFiles) {
    const f = path.join(dir, p);
    if (!fs.existsSync(f)) { fail('PACKAGE_FILE_MISSING', p); continue; }
    if (sha256Hex(fs.readFileSync(f)) !== e.sha256) fail('PACKAGE_FILE_DRIFT', p);
  }
  if (!fs.existsSync(path.join(dir, 'RELEASE_CHANNEL')) || fs.readFileSync(path.join(dir, 'RELEASE_CHANNEL'), 'utf8') !== channel + '\n') fail('PACKAGE_CHANNEL_MARKER', channel);
  const mf = path.join(dir, PACKAGE_MANIFEST_NAME);
  if (!fs.existsSync(mf)) fail('PACKAGE_MANIFEST_MISSING', mf); else if (fs.readFileSync(mf, 'utf8') !== stable(expected)) fail('PACKAGE_MANIFEST_DRIFT', channel);
  return {ok: failures.length === 0, failures, fileCount: expected.fileCount, treeSha256: expected.treeSha256};
}

export function packageIdentity(root, channel) {
  const dir = path.join(root, PACKAGES_DIR, channel);
  const mf = path.join(dir, PACKAGE_MANIFEST_NAME);
  if (!fs.existsSync(mf)) return null;
  const bytes = fs.readFileSync(mf);
  const doc = JSON.parse(bytes.toString('utf8'));
  return {channel, path: `${PACKAGES_DIR}/${channel}`, fileCount: doc.fileCount, treeSha256: doc.treeSha256, packageManifestBlob: gitBlobOfBytes(bytes), packageManifestSha256: sha256Hex(bytes)};
}
