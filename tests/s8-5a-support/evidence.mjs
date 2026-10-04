// S8-5A support: deterministic generation of the committed, public-safe S8-5A evidence artifacts.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {reproduceCorrectedLineage, assertCorrectedIdentities, CORRECTED_PINS} from './successor-lineage.mjs';
import {buildSandbox, materialize, runNode, blobOfBytes, sha256, treeDigest, FIXTURE_PINS, FIXTURE_DIR, HISTORICAL_COMMIT, INPUT_PINS} from './atl157-sandbox.mjs';
import {deriveSuccessorUtilityProof} from './atl173-utility-derivation.mjs';

export const EVIDENCE_DIR = 'governance/product/s8-5a-evidence';
export const EVIDENCE_FILES = Object.freeze({
  atl157: `${EVIDENCE_DIR}/atl-157-retest-summary.json`,
  atl173: `${EVIDENCE_DIR}/atl-173-successor-utility-proof.json`,
  atl167: `${EVIDENCE_DIR}/atl-167-blocked-record.json`
});
export const S8_3F_BASE = 'a3e2dc1687a9dd8a290645a4ed77895fb39f97e7';
const ATL167 = {branch: 'atl-167-v15-coherent-interaction-slice-build', commit: 'abbb472999025df3278db0a2756b08186a40f183', htmlBlob: '5d3855e1f7ca049ea720a1cd95862de4c12ff99b', testBlob: '5d3333ee8b5d6e44c85cf7c8708f0c830b70ad93'};
const STALE_WD = ['wd', '::road-ltl::LTL-04::v', '1'].join('');
const STALE_PKG = ['malkom-dw', '::road-ltl::LTL-04::v', '1'].join('');

export const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
export const ser = (v) => JSON.stringify(sortKeys(v), null, 2) + '\n';
const git = (root, args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000});
const gitTry = (root, args) => { try { return git(root, args).trim(); } catch { return null; } };

export async function atl157Evidence(root, lineage) {
  const {semantics, record} = lineage.artifacts;
  const prov = JSON.parse(fs.readFileSync(path.join(root, INPUT_PINS.provenance.path), 'utf8'));
  const reg = JSON.parse(fs.readFileSync(path.join(root, INPUT_PINS.registry.path), 'utf8'));
  const sb = buildSandbox(root, {semantics});
  const histSemText = git(root, ['show', `${HISTORICAL_COMMIT}:${INPUT_PINS.historicalSemantics.path}`]);
  const sbHist = buildSandbox(root, {semantics: JSON.parse(histSemText)});
  try {
    const before = treeDigest(sb.dir);
    const t = runNode(sb.dir, ['tests/atl-157-bounded-depth.test.cjs']);
    const a = materialize(sb.dir), b = materialize(sb.dir);
    const after = treeDigest(sb.dir);
    const out = JSON.parse(a.stdout);
    const h = materialize(sbHist.dir); const hOut = JSON.parse(h.stdout);
    const diffKeys = (x, y, p = '') => (typeof x !== 'object' || typeof y !== 'object' || !x || !y) ? (JSON.stringify(x) === JSON.stringify(y) ? [] : [p || '(root)']) : [...new Set([...Object.keys(x), ...Object.keys(y)])].flatMap((k) => diffKeys(x[k], y[k], p ? `${p}.${k}` : k));
    const negatives = [];
    const neg = (id, expectedCode, opts, request) => {
      const s = buildSandbox(root, opts); try { const r = materialize(s.dir, request); negatives.push({id, expectedCode, observedFailClosed: r.status !== 0 && r.stderr.includes(expectedCode), exit: r.status}); } finally { s.cleanup(); }
    };
    const fx = (name) => `tests/fixtures/${name}`;
    neg('machine-trigger', 'HUMAN_TRIGGER_REQUIRED', {semantics}, fx('atl-157-machine-trigger-reject.json'));
    return {
      out, hOut, outputSha256: sha256(a.stdout), historicalSemanticsOutputSha256: sha256(h.stdout), deterministic: a.stdout === b.stdout && a.status === 0 && b.status === 0,
      historicalTest: {exit: t.status, passLine: (t.stdout.match(/^PASS ATL-157.*$/m) || [null])[0]}, sandboxUnchanged: before === after, differentialDiffKeys: diffKeys(out, hOut), negatives,
      semanticsDocSha256: sha256(JSON.stringify(semantics)), recordHash: lineage.hashes.semanticsRecord, provenanceBlob: INPUT_PINS.provenance.blob, registryBlob: INPUT_PINS.registry.blob, registryHasSources: reg.sources || reg.items ? true : false, provClaims: prov.claims.length
    };
  } finally { sb.cleanup(); sbHist.cleanup(); }
}

export function atl167Record(root) {
  const histTest = gitTry(root, ['show', `${ATL167.commit}:tests/atl-167-interaction-slice.test.cjs`]) ?? '';
  const trackedHere = git(root, ['ls-files']).split('\n');
  const s84doc = fs.readFileSync(path.join(root, 'governance/product/S8_4_INTERACTION_REBINDING.md'), 'utf8');
  const s84test = fs.readFileSync(path.join(root, 'tests/s8-4-interaction-rebinding.test.mjs'), 'utf8');
  const rootIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return {
    schemaVersion: 's8-5a-atl-167-blocked-record-v1',
    classification: 'PUBLIC_NON_RECONSTRUCTIVE',
    obligation: 'ATL-167 coherent public/private interaction slice (S7-IMP-019, S6-LIN-033)',
    result: 'BLOCKED',
    reason: 'NO_CURRENT_SUCCESSOR_RETEST_SURFACE',
    ruling: 'S8-5A ruling B: BLOCKED — NO CURRENT SUCCESSOR RETEST SURFACE. Not executed, not implemented, not ported, not rebuilt, not marked superseded, and no partial S8-4 evidence is claimed as ATL-167 PASS.',
    historicalIdentity: {...ATL167, historicalQa: 'PASS_AFTER_REWORK (round-2 independent QA); lineage class STALE_UPSTREAM + WRONG_DONOR'},
    paDisposition: {paRow: 'PA-5 / S7-IMP-019', disposition: 'RETEST', retestTiming: 'RETEST_AFTER_UPSTREAM (SEQ-07: after corrected flow + presentation assembly; before successor release assembly)'},
    mechanicallyVerifiedEvidence: {
      slicePageAbsentFromSuccessorTree: !trackedHere.includes('atl-167-interaction-slice.html'),
      slicePageHistoricalBlobResolvable: gitTry(root, ['rev-parse', `${ATL167.commit}:atl-167-interaction-slice.html`]) === ATL167.htmlBlob,
      historicalTestBlobResolvable: gitTry(root, ['rev-parse', `${ATL167.commit}:tests/atl-167-interaction-slice.test.cjs`]) === ATL167.testBlob,
      historicalTestBoundToStaleWorkDefinitionId: histTest.includes(STALE_WD),
      historicalTestBoundToStalePackageId: histTest.includes(STALE_PKG),
      historicalTestBoundToStaleHash88bd3da8: histTest.includes('88bd3da8e9bf46d41676adbfce0c96fc45cf013c'),
      historicalTestRequiresRootToLinkSlice: histTest.includes("root.includes('/atl-167-interaction-slice.html')"),
      certifiedRootIndexBlob: gitTry(root, ['rev-parse', 'HEAD:index.html']),
      certifiedRootLinksSlice: rootIndex.includes('atl-167-interaction-slice'),
      s8_4DocStatesSliceNotRebound: /ATL-167 interaction slice[^.]*not rebound/.test(s84doc),
      s8_4SuiteAssertsStalePagesAbsent: s84test.includes("'atl-167-interaction-slice.html'"),
      s8_3fManifestExcludesStaleSlice: fs.readFileSync(path.join(root, 'lib/release/s8-release-manifest.js'), 'utf8').includes("excluded.stale-atl-167-slice"),
      tracked167Tests: trackedHere.filter((p) => /atl-167/i.test(p) && !p.startsWith(`${EVIDENCE_DIR}/`)).length
    },
    notAnAuthoritativeSupersession: 'S8-4 deliberate exclusion of the stale page is NOT a supersession decision; PA-5 retains ATL-167 as v1.5 REMEDIATION / RETEST_AFTER_UPSTREAM.',
    historicalObligationInventory: [
      {id: 'O1', obligation: 'Eight-step coherent journey (domain, daughter, inspect, deepen, wd, binding, coverage, export)', successorSurface: 'NONE'},
      {id: 'O2', obligation: 'Lineage identifiers (WorkDefinition/package/boundary) shown on the page', successorSurface: 'NONE (historical test pins stale identifiers; corrected identifiers differ)'},
      {id: 'O3', obligation: 'Link to the generated flow explorer', successorSurface: 'NONE for the slice (S8-4 provides an unrelated consumer-page flow anchor; not claimed)'},
      {id: 'O4', obligation: 'Root index links the slice', successorSurface: 'CONFLICTS with certified root byte-identity (root must not be modified)'},
      {id: 'O5', obligation: 'In-page interactive Ask with announced responses and fail-closed unsupported-question handling', successorSurface: 'NONE in-page (certified Universal Ask 2.0.1 is a different surface; transferability not established)'},
      {id: 'O6', obligation: 'Distinct, gated public and admin views', successorSurface: 'NONE for the slice'},
      {id: 'O7', obligation: 'Unknown client-binding state fails closed against governed binding state', successorSurface: 'PARTIAL REFERENCE ONLY (S8-4 N-cases for the consumer model); not claimed as ATL-167 PASS'},
      {id: 'O8', obligation: 'Responsive layout, landmarks, labels, keyboard DOM order', successorSurface: 'PARTIAL REFERENCE ONLY (S8-4 B06 for the consumer page); not claimed as ATL-167 PASS'}
    ],
    nextAuthority: 'A separate bounded remediation/authority decision is required; none is taken or implied here.'
  };
}

export async function generateEvidence(root) {
  const lineage = await reproduceCorrectedLineage(root);
  assertCorrectedIdentities(lineage.hashes);
  const proof = deriveSuccessorUtilityProof(lineage.artifacts, lineage.hashes);
  const k = await atl157Evidence(root, lineage);
  const o = k.out;
  const atl157 = {
    schemaVersion: 's8-5a-atl-157-retest-summary-v1',
    classification: 'PUBLIC_NON_RECONSTRUCTIVE',
    result: k.historicalTest.exit === 0 && k.deterministic && k.sandboxUnchanged ? 'PASS' : 'FAIL',
    passMeans: 'The historical ATL-157 bounded-depth mechanism remains compatible with the corrected S8 semantics/input lineage. It is NOT a shipped successor component and no ATL-157 product implementation was introduced.',
    historicalIdentity: {branch: 'atl-157-v15-bounded-depth', commit: HISTORICAL_COMMIT, authority: 'S6-LIN-032 / S7-IMP-018', fixtures: Object.fromEntries(Object.entries(FIXTURE_PINS).map(([n, v]) => [n, v.blob])), fixtureDir: FIXTURE_DIR, fixtureClassification: 'HISTORICAL_TEST_FIXTURE_NOT_PRODUCT'},
    correctedInputs: {semanticsRecordHash: k.recordHash, semanticsRecordPin: CORRECTED_PINS.semanticsRecord, semanticsDocSha256: k.semanticsDocSha256, semanticsStatus: lineage.artifacts.semantics.status, provenanceBlob: k.provenanceBlob, registryBlob: k.registryBlob, generator: 'scripts/materialize-operational-semantics-v1.cjs'},
    historicalTest: k.historicalTest,
    successorOutput: {moduleId: o.moduleId, processId: o.processId, candidateCount: o.candidateKnowledge.length, candidateFields: o.candidateKnowledge.map((c) => c.field), gapCount: o.gapDetection.gaps.length, persistenceDisposition: o.persistenceDisposition, canonicalMutation: o.validation.canonicalMutation, canonicalPromotion: o.downstream.canonicalPromotion, outputSha256: k.outputSha256, deterministic: k.deterministic, sandboxUnchanged: k.sandboxUnchanged},
    differentialVsHistoricalSemantics: {historicalSemanticsBlob: INPUT_PINS.historicalSemantics.blob, outputSha256: k.historicalSemanticsOutputSha256, differingOutputPaths: k.differentialDiffKeys, candidatesIdentical: JSON.stringify(o.candidateKnowledge) === JSON.stringify(k.hOut.candidateKnowledge)},
    notes: ['Semantic field content of the LTL-04 record is identical between the historical (ATL-171) and corrected (S8-2A) semantics; the corrected record adds record-level moduleVersion and governingLineage, and the document-level moduleVersion is 1.5 (historical 1.2), which is the only difference in the materializer output.', 'ATL-157 is not present in the successor product tree and is not introduced into it.']
  };
  return {lineage, proof, files: {[EVIDENCE_FILES.atl157]: ser(atl157), [EVIDENCE_FILES.atl173]: ser(proof), [EVIDENCE_FILES.atl167]: ser(atl167Record(root))}, atl157Raw: k};
}
