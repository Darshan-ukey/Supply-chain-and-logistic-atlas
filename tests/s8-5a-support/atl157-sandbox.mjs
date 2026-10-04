// S8-5A support (ATL-157): runs the byte-identical HISTORICAL ATL-157 mechanism inside an ephemeral sandbox that is
// assembled from corrected S8 successor inputs. The mechanism is test-subject only; it is never written into the
// successor tree and never into a product path.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

export const FIXTURE_DIR = 'tests/fixtures/s8-5a/atl-157-historical';
export const HISTORICAL_COMMIT = '770ae4ab9865ae924dd4badb4df6b16f16e52531';
export const FIXTURE_PINS = Object.freeze({
  'materialize-bounded-depth-v1.cjs': {blob: '348f4c48c7ce58ef629d0660e3ea3281537679ae', sandbox: 'scripts/materialize-bounded-depth-v1.cjs'},
  'atlas-bounded-depth-v1.json': {blob: '86f1a82a231ed13c50fccc49d6377e25c34e7e80', sandbox: 'data/contracts/atlas-bounded-depth-v1.json'},
  'atl-157-bounded-depth.test.cjs': {blob: 'a254a7a611b2c2881c35e44f5c5c19e085ef41ff', sandbox: 'tests/atl-157-bounded-depth.test.cjs'},
  'atl-157-road-ltl-depth-request.json': {blob: '8e34f2e4a021d084e7f5509b67146c0a2895bbd0', sandbox: 'tests/fixtures/atl-157-road-ltl-depth-request.json'},
  'atl-157-machine-trigger-reject.json': {blob: 'c79ecf1cf04b9d46ed0197b3d1f4d490f3ba7c3f', sandbox: 'tests/fixtures/atl-157-machine-trigger-reject.json'}
});
export const INPUT_PINS = Object.freeze({
  provenance: {path: 'data/provenance/road-ltl-claim-provenance-v1.json', blob: '25cd876658c2de42445ca49eab80abe003eceea2'},
  registry: {path: 'data/governance/source-registry-v1.json', blob: '6beaa755b5046d577b3211cd48ddccbe81f8475c'},
  historicalSemantics: {path: 'data/generated/operational-semantics/road-ltl-v1.json', blob: '3de9d96e1eb0bc09851c8bcfb551913e57bb6614'}
});
export const PRODUCT_PATHS_FORBIDDEN = Object.freeze(['scripts/materialize-bounded-depth-v1.cjs', 'data/contracts/atlas-bounded-depth-v1.json', 'lib/bounded-depth', 'api/bounded-depth']);

export const blobOfBytes = (buf) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
export const sha256 = (v) => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');

// opts: {semantics, provenance, registry} (objects). Returns {dir, cleanup}.
export function buildSandbox(root, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-5a-atl157-'));
  const put = (rel, data) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true}); fs.writeFileSync(path.join(dir, rel), data); };
  for (const [name, {sandbox}] of Object.entries(FIXTURE_PINS)) put(sandbox, fs.readFileSync(path.join(root, FIXTURE_DIR, name)));
  put('data/generated/operational-semantics/road-ltl-v1.json', JSON.stringify(opts.semantics, null, 2) + '\n');
  put(INPUT_PINS.provenance.path, opts.provenance === undefined ? fs.readFileSync(path.join(root, INPUT_PINS.provenance.path)) : JSON.stringify(opts.provenance, null, 2) + '\n');
  put(INPUT_PINS.registry.path, opts.registry === undefined ? fs.readFileSync(path.join(root, INPUT_PINS.registry.path)) : JSON.stringify(opts.registry, null, 2) + '\n');
  return {dir, cleanup: () => fs.rmSync(dir, {recursive: true, force: true})};
}

export function runNode(dir, args) {
  const r = cp.spawnSync(process.execPath, args, {cwd: dir, encoding: 'utf8', maxBuffer: 100000000});
  return {status: r.status, stdout: r.stdout, stderr: r.stderr};
}
export const materialize = (dir, request) => runNode(dir, ['scripts/materialize-bounded-depth-v1.cjs', ...(request ? [request] : [])]);

export function treeDigest(dir) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, {withFileTypes: true}).sort((a, b) => (a.name < b.name ? -1 : 1))) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out.push(path.relative(dir, f) + ':' + sha256(fs.readFileSync(f))); } };
  walk(dir);
  return sha256(out.join('\n'));
}

export function writeRequest(dir, rel, obj) { fs.mkdirSync(path.dirname(path.join(dir, rel)), {recursive: true}); fs.writeFileSync(path.join(dir, rel), JSON.stringify(obj, null, 2) + '\n'); return rel; }

// Verifies the historical fixtures are byte-identical to the pinned historical blobs. Returns {ok, mismatches}.
export function verifyFixtures(dirAbs) {
  const mismatches = [];
  for (const [name, {blob}] of Object.entries(FIXTURE_PINS)) { const f = path.join(dirAbs, name); if (!fs.existsSync(f)) mismatches.push({name, reason: 'missing'}); else if (blobOfBytes(fs.readFileSync(f)) !== blob) mismatches.push({name, reason: 'blob-mismatch'}); }
  return {ok: mismatches.length === 0, mismatches};
}
