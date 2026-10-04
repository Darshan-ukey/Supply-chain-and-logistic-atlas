// S8-5A support: reproduces the corrected S8 successor lineage (same chain as S8-3B..3E) in memory and verifies it
// against the accepted canonical identities. Verification harness only; not a product component.
import path from 'node:path';
import cp from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const SOURCE_COMMIT = '662c7847d3839c1ffd95dc8589d3d0d6ac100d67';
export const SOURCE_PATH = 'data/modules/road-ltl-v1.4.json';
export const SOURCE_BLOB = 'd06974e9ee86cea59227e0866a98ad5d1367bfad';
export const CORRECTED_PINS = Object.freeze({
  taskHash: 'b0bee64f418dcf99ccd60480c86dcd9dcd066231fe72ab7033c80994922b4e65',
  semanticsRecord: 'd642c1d59f2e938e5afcc60355f086b61e57f33d63e57e54b2a72def09a21576',
  binding: '2f532fad61c0a5878028fb0bf362827b18593f7c1c502ba88b557dcc8e3a56f9',
  wd: 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
  package: '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
  readiness: 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617',
  projection: '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c'
});

const gitIn = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000});
const imp = (root, p) => import(pathToFileURL(path.join(root, p)).href);

export async function reproduceCorrectedLineage(root) {
  const {generateMalkomPackage} = await imp(root, 'lib/compile/s8-malkom-package.js');
  const {generateMalkomProjection} = await imp(root, 'lib/compile/s8-malkom-projection.js');
  const {canonicalHash} = await imp(root, 'lib/compile/workdefinition-compiler.js');
  const {reconstructTask} = await imp(root, 'lib/compile/source-task-decomposition.js');
  const {compileCorrectedTask} = await imp(root, 'lib/compile/s8-workdefinition-compiler.js');
  const source = JSON.parse(gitIn(root, ['show', `${SOURCE_COMMIT}:${SOURCE_PATH}`]));
  const run = (s) => JSON.parse(cp.execFileSync(process.execPath, [s], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}));
  const semantics = run('scripts/materialize-operational-semantics-v1.cjs');
  const binding = run('scripts/materialize-client-binding-v1.cjs');
  const record = semantics.records.find((r) => r.processId === 'LTL-04');
  const task = source.tasks.find((t) => t.taskId === 'LTL-04');
  const pin = {commit: SOURCE_COMMIT, path: SOURCE_PATH, blob: SOURCE_BLOB, taskHash: canonicalHash(task), semanticSourceVersion: '1.4'};
  const envelope = reconstructTask(task, pin, record, binding);
  const wd = compileCorrectedTask(envelope, canonicalHash(envelope.decomposition), semantics, binding);
  const a = generateMalkomPackage(wd, binding, record);
  const projection = generateMalkomProjection(wd, a.packageArtifact, a.readiness);
  const artifacts = {semantics, record, binding, wd, package: a.packageArtifact, readiness: a.readiness, projection};
  const hashes = {taskHash: canonicalHash(task), semanticsRecord: canonicalHash(record), binding: canonicalHash(binding), wd: canonicalHash(wd), package: canonicalHash(a.packageArtifact), readiness: canonicalHash(a.readiness), projection: canonicalHash(projection)};
  return {artifacts, hashes, canonicalHash};
}

// Fails closed (throws) unless every observed identity equals the accepted corrected pin.
export function assertCorrectedIdentities(hashes) {
  for (const [k, v] of Object.entries(CORRECTED_PINS)) if (hashes[k] !== v) throw new Error(`LINEAGE_IDENTITY_MISMATCH:${k}`);
  return true;
}
