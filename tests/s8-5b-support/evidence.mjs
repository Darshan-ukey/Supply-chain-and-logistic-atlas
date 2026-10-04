// S8-5B deterministic, public-safe evidence generation (hashes/counts/enums only; no protected content).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

export const S8_5A_HEAD = 'f8dc6c3863bc7310d8d83addf2d6ff1b6d34e12f';
export const S8_5A_TREE = 'b2fa339ac2ce1c6410a623978c2cfcf4dc3ce0aa';
export const S8_4_TESTED = '07a41138f7b52e5fe1d0c9d5989f72b9835560c5';
export const S8_3F_TESTED = '67c80d513aa9de798e33814b963ee0e62ed7abad';
export const EVIDENCE_DIR = 'governance/product/s8-5b-evidence';
export const EVIDENCE_FILES = Object.freeze({summary: `${EVIDENCE_DIR}/governed-depth-summary-ltl04.json`, identity: `${EVIDENCE_DIR}/successor-identity.json`});
// Product files that change identity or are introduced by S8-5B (tests/evidence/docs excluded to avoid circularity).
export const MODIFIED_PRODUCT = Object.freeze([
  ['api/atlas.js', 'ROUTER_REGISTRATION_ONE_LINE', 'Registers the bounded governed-depth-summary action in the consolidated Atlas router (8 top-level functions retained). Donor-pinned in S8-4 provenance.'],
  ['assets/atl-140-v15-journey.mjs', 'JOURNEY_INTEGRATION_POINT', 'S8-4 journey module; additive Deepen/Inspect control + exact-context Ask/Trace links (S8-5B successor interaction identity; not a retroactive S8-4 mutation). Pinned in the S8-3F manifest.']
]);
export const NEW_PRODUCT = Object.freeze([
  ['assets/atl-167-v15-deepen-inspect.mjs', 'ATL167_SUCCESSOR_INTERACTION_MODULE'],
  ['lib/api/governed-depth-summary.js', 'ATL167_BOUNDED_API_HANDLER'],
  ['lib/projections/governed-depth-summary.js', 'ATL167_PUBLIC_SAFE_PROJECTION']
]);
export const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
export const ser = (v) => JSON.stringify(sortKeys(v), null, 2) + '\n';
export const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}).trim();
const blobOfFile = (root, p) => { const b = fs.readFileSync(path.join(root, p)); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); };

async function callApi(root, url) {
  const prev = process.cwd(); process.chdir(root);
  try {
    const {default: router} = await import(`file://${path.join(root, 'api/atlas.js')}`);
    const u = new URL(url, 'http://atlas.local');
    const res = {headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; }};
    await router({method: 'GET', url, query: Object.fromEntries(u.searchParams), headers: {host: 'atlas.local'}}, res);
    return {status: res.statusCode, headers: res.headers, body: res.body};
  } finally { process.chdir(prev); }
}

export async function generateEvidence(root) {
  const depth = (t) => `/api/atlas?action=execution-depth-projection&moduleId=road-ltl&moduleVersion=1.5&taskId=${t}`;
  const ltl04 = await callApi(root, '/api/atlas?action=governed-depth-summary&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04');
  const summary = JSON.parse(ltl04.body).summary;
  const d04 = await callApi(root, depth('LTL-04')), d03 = await callApi(root, depth('LTL-03'));
  const sources = ['governance/presentation/p2-projection-source-registry.json', 'data/modules/road-ltl-v1.5.json', 'data/operational-knowledge/road-ltl-v1.5-operational.json', 'data/operational-knowledge/road-ltl-v1.5-bol-resolution-baseline.json', 'lib/projections/execution-depth-projection.js', 'lib/api/execution-depth-projection.js'];
  const identity = {
    schemaVersion: 's8-5b-successor-interaction-identity-v1',
    classification: 'PUBLIC_NON_RECONSTRUCTIVE',
    stage: 'S8-5B ATL-167 bounded successor remediation (LTL-04 public-safe Deepen/Inspect)',
    base: {commit: S8_5A_HEAD, tree: S8_5A_TREE},
    statement: 'S8-5B introduces a NEW successor interaction identity. It is not a retroactive mutation of S8-4 and does not re-pin, edit or reinterpret S8-4 or S8-3F evidence. S8-4 remains PASS at its own exact tested commit; S8-3F remains PASS at its own exact tested commit; the S8-3F release manifest is a PREDECESSOR manifest and is not regenerated here (S8-6 finalizes the successor manifest over this lineage).',
    predecessorsPreserved: {s8_4: {testedCommit: S8_4_TESTED, evidenceUntouched: true}, s8_3f: {testedCommit: S8_3F_TESTED, evidenceUntouched: true, manifestRegenerated: false}, s8_5a: {head: S8_5A_HEAD, evidenceUntouched: true}},
    modifiedProductFiles: MODIFIED_PRODUCT.map(([p, kind, why]) => ({path: p, kind, predecessorBlob: git(root, ['rev-parse', `${S8_5A_HEAD}:${p}`]), successorBlob: blobOfFile(root, p), reason: why})),
    newProductFiles: NEW_PRODUCT.map(([p, kind]) => ({path: p, kind, successorBlob: blobOfFile(root, p)})),
    unchangedCertifiedIdentities: Object.fromEntries(['index.html', 'execution/ui/runtime-access-shell.js', 'assets/canvas-daughter-bridge-v2.0.1.mjs', 'assets/universal-daughter-renderer-v2.js', 'daughter.html', 'lib/api/ask-atlas.js', 'runtime/universal-ask-atlas.js', 'atl-140-malkom-consumer.html', 'assets/atl-140-consumer-view.mjs', 'vercel.json'].map((p) => [p, blobOfFile(root, p)])),
    atl157NonExpansion: {
      materializedProofScope: 'LTL-03',
      sourceBlobs: Object.fromEntries(sources.map((p) => [p, blobOfFile(root, p)])),
      ltl04ExecutionDepthProjection: {status: d04.status, body: JSON.parse(d04.body)},
      ltl03ExecutionDepthProjection: {status: d03.status, projectionClass: d03.headers['X-Atlas-Projection-Class'], bodySha256: sha256(d03.body)}
    },
    expectedSuccessorOnlyFailuresOfPredecessorSuites: {
      'tests/s8-4-interaction-rebinding.test.mjs': ['D01 (api/atlas.js donor pin: one registered route)', 'S01', 'S02', 'S03 (stage-scope guards)'],
      'tests/s8-3f-governed-release-manifest.test.mjs': ['manifest regeneration / verifier / protected-derivative pin check / recovery identity (journey blob pinned in the predecessor manifest)', 'S8-3F scope guard']
    }
  };
  return {files: {[EVIDENCE_FILES.summary]: ser({apiRequest: 'GET /api/atlas?action=governed-depth-summary&moduleId=road-ltl&moduleVersion=1.5&taskId=LTL-04', httpStatus: ltl04.status, projectionClassHeader: ltl04.headers['X-Atlas-Projection-Class'], summary}), [EVIDENCE_FILES.identity]: ser(identity)}, summary, identity};
}
