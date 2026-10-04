import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {reproduceCorrectedLineage, assertCorrectedIdentities, CORRECTED_PINS} from './s8-5a-support/successor-lineage.mjs';
import {buildSandbox, materialize, runNode, writeRequest, verifyFixtures, treeDigest, sha256, blobOfBytes, FIXTURE_DIR, FIXTURE_PINS, INPUT_PINS, HISTORICAL_COMMIT, PRODUCT_PATHS_FORBIDDEN} from './s8-5a-support/atl157-sandbox.mjs';
import {deriveSuccessorUtilityProof, verifyUtilityProof, HISTORICAL_BASELINE, UTILITY_SCHEMA} from './s8-5a-support/atl173-utility-derivation.mjs';
import {generateEvidence, EVIDENCE_FILES, S8_3F_BASE, sortKeys} from './s8-5a-support/evidence.mjs';

// S8-5A — bounded successor retests (ATL-157 compatibility, ATL-173 corrected-lineage utility proof; ATL-167 BLOCKED record).
// PASS here means ONLY these bounded results. It is not S8-5 completion, runtime readiness, release readiness or any authorization.
const root = process.cwd();
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 300000000}).trim();
const clone = (v) => structuredClone(v);
const results = [];
const test = async (name, fn) => { try { await fn(); results.push({name, ok: true}); console.log(`PASS ${name}`); } catch (e) { results.push({name, ok: false}); console.log(`FAIL ${name}\n  ${String(e.message).split('\n').slice(0, 4).join('\n  ')}`); } };

const lineage = await reproduceCorrectedLineage(root);
const {artifacts, hashes} = lineage;
const gen = await generateEvidence(root);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ======================================================= ATL-157 — successor compatibility (historical mechanism, corrected inputs)
await test('K01 historical ATL-157 fixtures are byte-identical to the pinned historical blobs and resolvable at the historical commit', () => {
  assert.deepEqual(verifyFixtures(path.join(root, FIXTURE_DIR)), {ok: true, mismatches: []});
  for (const [name, p] of Object.entries({'materialize-bounded-depth-v1.cjs': 'scripts/materialize-bounded-depth-v1.cjs', 'atlas-bounded-depth-v1.json': 'data/contracts/atlas-bounded-depth-v1.json', 'atl-157-bounded-depth.test.cjs': 'tests/atl-157-bounded-depth.test.cjs', 'atl-157-road-ltl-depth-request.json': 'tests/fixtures/atl-157-road-ltl-depth-request.json', 'atl-157-machine-trigger-reject.json': 'tests/fixtures/atl-157-machine-trigger-reject.json'})) assert.equal(git(['rev-parse', `${HISTORICAL_COMMIT}:${p}`]), FIXTURE_PINS[name].blob, name);
  assert.equal(git(['rev-parse', `${HISTORICAL_COMMIT}^{commit}`]), HISTORICAL_COMMIT);
});
await test('K02 fixtures are test-only: outside product paths; ATL-157 is not shipped in the successor tree', () => {
  const tracked = git(['ls-files']).split('\n');
  for (const p of PRODUCT_PATHS_FORBIDDEN) assert.ok(!tracked.some((t) => t === p || t.startsWith(p + '/')), `product path present: ${p}`);
  assert.ok(tracked.filter((t) => /bounded-depth/i.test(t)).every((t) => t.startsWith(FIXTURE_DIR + '/') || t.startsWith('tests/s8-5a-support/')), 'bounded-depth files only as fixtures');
  assert.equal(JSON.parse(read(`${FIXTURE_DIR}/PROVENANCE.json`)).classification, 'HISTORICAL_TEST_FIXTURE_NOT_PRODUCT');
});
await test('K03 corrected successor inputs are pinned (semantics record, provenance, source registry) and corrected lineage verifies', () => {
  assertCorrectedIdentities(hashes);
  assert.equal(hashes.semanticsRecord, 'd642c1d59f2e938e5afcc60355f086b61e57f33d63e57e54b2a72def09a21576');
  assert.equal(artifacts.semantics.status, 'S8_REMEDIATED_CANDIDATE');
  assert.equal(artifacts.semantics.records.length, 22);
  assert.equal(git(['hash-object', INPUT_PINS.provenance.path]), INPUT_PINS.provenance.blob);
  assert.equal(git(['hash-object', INPUT_PINS.registry.path]), INPUT_PINS.registry.blob);
  assert.equal(git(['rev-parse', `${HISTORICAL_COMMIT}:${INPUT_PINS.provenance.path}`]), INPUT_PINS.provenance.blob, 'provenance unchanged since the historical test');
  assert.equal(git(['rev-parse', `${HISTORICAL_COMMIT}:${INPUT_PINS.registry.path}`]), INPUT_PINS.registry.blob, 'registry unchanged since the historical test');
});
await test('K04 the UNMODIFIED historical ATL-157 test passes in a sandbox built from corrected successor inputs', () => {
  const sb = buildSandbox(root, {semantics: artifacts.semantics});
  try {
    const before = treeDigest(sb.dir);
    const r = runNode(sb.dir, ['tests/atl-157-bounded-depth.test.cjs']);
    assert.equal(r.status, 0, r.stderr.slice(-400));
    assert.match(r.stdout, /^PASS ATL-157 bounded human-triggered depth: 6 provenanced candidates$/m);
    assert.equal(treeDigest(sb.dir), before, 'sandbox must be unchanged by the run');
  } finally { sb.cleanup(); }
});
const run157 = (opts, request) => { const sb = buildSandbox(root, opts); try { return {sb, r: materialize(sb.dir, request)}; } finally { sb.cleanup(); } };
const base157 = run157({semantics: artifacts.semantics});
const out157 = JSON.parse(base157.r.stdout);
await test('K05 successor output is bound to the corrected semantics record and its governed sources (field-for-field)', () => {
  const rec = artifacts.record;
  assert.equal(out157.moduleId, 'road-ltl'); assert.equal(out157.processId, 'LTL-04'); assert.equal(out157.moduleVersion, artifacts.semantics.moduleVersion);
  assert.equal(out157.existingKnowledgeLookup.semanticRecordId, rec.semanticRecordId);
  assert.deepEqual(out157.existingKnowledgeLookup.sourceIds, rec.sourceIds);
  assert.deepEqual(out157.candidateKnowledge.map((c) => c.field), ['decision', 'rule', 'control', 'action', 'evidence', 'outcome']);
  for (const c of out157.candidateKnowledge) { assert.deepEqual(c.value, rec[c.field], c.field); assert.equal(c.entityResolution.canonicalSemanticRecordId, rec.semanticRecordId); assert.ok(c.sourceIds.length > 0 && c.sourceIds.every((s) => rec.sourceIds.includes(s))); assert.ok(c.claims.length > 0); }
  assert.equal(out157.gapDetection.gaps.length, 0);
});
await test('K06 bounded-depth guarantees hold on corrected inputs: human trigger, fail-closed, no canonical mutation/promotion, governed-registry-only research', () => {
  assert.equal(out157.trigger.actorType, 'AUTHORIZED_HUMAN'); assert.equal(out157.trigger.explicitRequest, true);
  assert.equal(out157.validation.failClosed, true); assert.equal(out157.validation.canonicalMutation, false); assert.equal(out157.validation.allCandidatesProvenanced, true);
  assert.equal(out157.downstream.canonicalPromotion, 'NOT_PERFORMED');
  assert.equal(out157.boundedResearch.mode, 'GOVERNED_SOURCE_REGISTRY_ONLY');
  assert.equal(out157.persistenceDisposition, 'CANDIDATE_OVERLAY_READY_FOR_HUMAN_APPROVAL');
  const reg = JSON.parse(read(INPUT_PINS.registry.path)); const ids = new Set((reg.sources || reg.items).map((s) => s.id || s.sourceId));
  for (const e of out157.boundedResearch.eligibleSources) assert.ok(ids.has(e.sourceId), e.sourceId);
});
await test('K07 deterministic; and compatible with the historical (pre-S8) semantics: identical candidates, only the document moduleVersion differs', async () => {
  const again = run157({semantics: artifacts.semantics});
  assert.equal(again.r.stdout, base157.r.stdout);
  const histDoc = JSON.parse(git(['show', `${HISTORICAL_COMMIT}:${INPUT_PINS.historicalSemantics.path}`]));
  assert.equal(git(['rev-parse', `${HISTORICAL_COMMIT}:${INPUT_PINS.historicalSemantics.path}`]), INPUT_PINS.historicalSemantics.blob);
  const h = JSON.parse(run157({semantics: histDoc}).r.stdout);
  assert.deepEqual(h.candidateKnowledge, out157.candidateKnowledge);
  assert.deepEqual(h.gapDetection, out157.gapDetection);
  assert.deepEqual(h.boundedResearch, out157.boundedResearch);
  assert.equal(h.moduleVersion, '1.2'); assert.equal(out157.moduleVersion, '1.5');
});
const req = {moduleId: 'road-ltl', processId: 'LTL-04', trigger: {actorType: 'AUTHORIZED_HUMAN', explicitRequest: true, requestId: 'S8-5A-NEG'}, requestedFields: ['decision', 'rule', 'control', 'action', 'evidence', 'outcome']};
const negative = (name, code, opts, mutateReq) => test(`K08 fail-closed on corrected inputs: ${name} → ${code}`, () => {
  const sb = buildSandbox(root, opts);
  try { const r = materialize(sb.dir, writeRequest(sb.dir, 'tests/fixtures/neg-request.json', mutateReq ? mutateReq(clone(req)) : req)); assert.notEqual(r.status, 0, 'must exit non-zero'); assert.ok(r.stderr.includes(code), `expected ${code}; stderr tail: ${r.stderr.slice(-200)}`); } finally { sb.cleanup(); }
});
const histMachine = path.join(root, FIXTURE_DIR, 'atl-157-machine-trigger-reject.json');
await test('K08 fail-closed on corrected inputs: historical machine-trigger fixture → HUMAN_TRIGGER_REQUIRED', () => {
  const sb = buildSandbox(root, {semantics: artifacts.semantics});
  try { const r = materialize(sb.dir, 'tests/fixtures/atl-157-machine-trigger-reject.json'); assert.notEqual(r.status, 0); assert.ok(r.stderr.includes('HUMAN_TRIGGER_REQUIRED')); assert.equal(blobOfBytes(fs.readFileSync(histMachine)), FIXTURE_PINS['atl-157-machine-trigger-reject.json'].blob); } finally { sb.cleanup(); }
});
await negative('non-human trigger', 'HUMAN_TRIGGER_REQUIRED', {semantics: artifacts.semantics}, (r) => { r.trigger.actorType = 'MALKOM_RUNTIME'; return r; });
await negative('trigger without explicit request', 'HUMAN_TRIGGER_REQUIRED', {semantics: artifacts.semantics}, (r) => { r.trigger.explicitRequest = false; return r; });
await negative('unsupported module', 'UNSUPPORTED_MODULE', {semantics: artifacts.semantics}, (r) => { r.moduleId = 'ocean-fcl'; return r; });
await negative('unknown process', 'UNKNOWN_PROCESS', {semantics: artifacts.semantics}, (r) => { r.processId = 'LTL-99'; return r; });
await negative('unsupported requested field', 'UNSUPPORTED_REQUESTED_FIELD', {semantics: artifacts.semantics}, (r) => { r.requestedFields = ['rule', 'price']; return r; });
await negative('no depth fields requested', 'NO_DEPTH_FIELDS', {semantics: artifacts.semantics}, (r) => { r.requestedFields = []; return r; });
await negative('record without provenance sourceIds', 'MISSING_PROVENANCE', (() => { const s = clone(artifacts.semantics); s.records.find((x) => x.processId === 'LTL-04').sourceIds = []; return {semantics: s}; })());
await negative('record source not in governed registry', 'UNREGISTERED_AUTHORITATIVE_SOURCE', (() => { const reg = JSON.parse(read(INPUT_PINS.registry.path)); const key = reg.sources ? 'sources' : 'items'; reg[key] = reg[key].filter((s) => (s.id || s.sourceId) !== 'src-x12'); return {semantics: artifacts.semantics, registry: reg}; })());
await negative('claim without sourceIds', 'MISSING_PROVENANCE', (() => { const p = JSON.parse(read(INPUT_PINS.provenance.path)); for (const c of p.claims) if (c.processId === 'LTL-04' && String(c.field).toLowerCase() === 'rule') c.sourceIds = []; return {semantics: artifacts.semantics, provenance: p}; })());
const gapOf = (opts, field) => { const sb = buildSandbox(root, opts); try { const r = materialize(sb.dir, writeRequest(sb.dir, 'tests/fixtures/gap-request.json', req)); assert.equal(r.status, 0, r.stderr.slice(-200)); const o = JSON.parse(r.stdout); return {o, gap: o.gapDetection.gaps.find((g) => g.field === field), cand: o.candidateKnowledge.find((c) => c.field === field)}; } finally { sb.cleanup(); } };
await test('K09 conflicting source claims are NOT promoted: field becomes CANDIDATE_REVIEW_REQUIRED, no candidate, no downstream eligibility', () => {
  const p = JSON.parse(read(INPUT_PINS.provenance.path)); const one = p.claims.find((c) => c.processId === 'LTL-04' && String(c.field).toLowerCase() === 'rule'); p.claims.push({...structuredClone(one), claimId: 'S8-5A-CONFLICT', statement: 'a conflicting statement'});
  const {o, gap, cand} = gapOf({semantics: artifacts.semantics, provenance: p}, 'rule');
  assert.equal(gap.state, 'CANDIDATE_REVIEW_REQUIRED'); assert.equal(cand, undefined); assert.equal(o.downstream.workDefinitionInputEligible, false); assert.equal(o.downstream.canonicalPromotion, 'NOT_PERFORMED');
});
await test('K09 missing field-level provenance is NOT promoted (CANDIDATE_REVIEW_REQUIRED); empty governed value is UNKNOWN', () => {
  const p = JSON.parse(read(INPUT_PINS.provenance.path)); p.claims = p.claims.filter((c) => !(c.processId === 'LTL-04' && String(c.field).toLowerCase() === 'control'));
  const a = gapOf({semantics: artifacts.semantics, provenance: p}, 'control'); assert.equal(a.gap.state, 'CANDIDATE_REVIEW_REQUIRED'); assert.equal(a.cand, undefined);
  const s = clone(artifacts.semantics); s.records.find((x) => x.processId === 'LTL-04').evidence = '';
  const b = gapOf({semantics: s}, 'evidence'); assert.equal(b.gap.state, 'UNKNOWN'); assert.equal(b.cand, undefined);
});
await test('K10 harness rejects tampered historical fixtures and a stale-semantics substitution', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 's8-5a-fx-')); try {
    for (const n of Object.keys(FIXTURE_PINS)) fs.copyFileSync(path.join(root, FIXTURE_DIR, n), path.join(tmp, n));
    assert.equal(verifyFixtures(tmp).ok, true);
    fs.appendFileSync(path.join(tmp, 'materialize-bounded-depth-v1.cjs'), '\n// tampered\n');
    const v = verifyFixtures(tmp); assert.equal(v.ok, false); assert.equal(v.mismatches[0].reason, 'blob-mismatch');
    fs.rmSync(path.join(tmp, 'atlas-bounded-depth-v1.json')); assert.ok(verifyFixtures(tmp).mismatches.some((m) => m.reason === 'missing'));
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  const histDoc = JSON.parse(git(['show', `${HISTORICAL_COMMIT}:${INPUT_PINS.historicalSemantics.path}`]));
  const hash = lineage.canonicalHash(histDoc.records.find((r) => r.processId === 'LTL-04'));
  assert.notEqual(hash, CORRECTED_PINS.semanticsRecord, 'historical record is not the corrected identity');
  assert.throws(() => assertCorrectedIdentities({...hashes, semanticsRecord: hash}), /LINEAGE_IDENTITY_MISMATCH:semanticsRecord/);
});

// ======================================================= ATL-173 — successor utility proof on corrected lineage
const proof = deriveSuccessorUtilityProof(artifacts, hashes);
const mutated = (fn) => { const a = clone(artifacts); fn(a); return a; };
await test('U01 corrected package/readiness/projection identities equal the accepted pins and the public S8-3B..3D summaries', () => {
  assert.equal(hashes.package, '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367');
  assert.equal(hashes.readiness, 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617');
  assert.equal(hashes.projection, '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c');
  assert.equal(JSON.parse(read('governance/product/s8-3c-evidence/package-readiness-summary.json')).packageHash, hashes.package);
  assert.equal(JSON.parse(read('governance/product/s8-3c-evidence/package-readiness-summary.json')).readinessHash, hashes.readiness);
  assert.equal(JSON.parse(read('governance/product/s8-3d-evidence/projection-summary.json')).projectionHash, hashes.projection);
  assert.equal(JSON.parse(read('governance/product/s8-3b-evidence/reconstruction-summary.json')).outputHash, hashes.wd);
});
await test('U02 the successor proof is deterministic, key-order independent, and equals the committed proof byte-for-byte', () => {
  assert.equal(JSON.stringify(deriveSuccessorUtilityProof(artifacts, hashes)), JSON.stringify(proof));
  const reordered = Object.fromEntries(Object.entries(proof).reverse());
  assert.equal(JSON.stringify(sortKeys(reordered)), JSON.stringify(sortKeys(deriveSuccessorUtilityProof(artifacts, hashes))));
  assert.equal(read(EVIDENCE_FILES.atl173), gen.files[EVIDENCE_FILES.atl173]);
  assert.equal(JSON.parse(read(EVIDENCE_FILES.atl173)).schemaVersion, UTILITY_SCHEMA);
});
await test('U03 findings are DERIVED from the corrected artifacts (requirement statuses and counts)', () => {
  const st = Object.fromEntries(proof.requirements.map((r) => [r.requirement, r.status]));
  assert.deepEqual(st, {'Canonical identity/version/lineage': 'AVAILABLE', 'Work semantics': 'PARTIAL', 'Client execution parameters': 'CLIENT_BINDING_REQUIRED', 'Malkom API endpoint': 'REQUIREMENT_NOT_CONFIRMED'});
  assert.deepEqual(proof.counts, {materialRequirements: 4, availableOrProjectable: 1, partial: 1, clientBindingRequired: 1, unsupportedOrUnconfirmed: 1});
  const rd = artifacts.readiness; const t = rd.totals; const re = proof.reusableElements;
  assert.deepEqual(re.workSemantics, {state: rd.workSemantics.state, workDefinitionVersion: rd.workSemantics.workDefinitionVersion, requiredInputCount: rd.workSemantics.requiredInputCount, actionCount: rd.workSemantics.actionCount, outcomeCount: rd.workSemantics.outcomeCount});
  assert.deepEqual(re.rulesControlsCoverage, rd.rulesControlsCoverage);
  assert.equal(re.compilation.notCompiledLeafCount, t.notCompiledLeafCount); assert.equal(re.compilation.knowledgeGapEntryCount, rd.knowledgeGaps.length);
  assert.deepEqual(re.clientBindings, {state: rd.clientBindings.state, resolvedCount: rd.clientBindings.resolvedCount, unresolvedCount: rd.clientBindings.unresolvedCount});
});
await test('U04 truthfully reports the corrected bounded state (partial semantics, 4 knowledge-gap entries, 4 of 5 leaves not compiled, unresolved binding)', () => {
  const re = proof.reusableElements;
  assert.equal(re.workSemantics.state, 'PARTIAL'); assert.equal(re.compilation.knowledgeGapEntryCount, 4); assert.equal(re.compilation.leafCount, 5); assert.equal(re.compilation.notCompiledLeafCount, 4); assert.equal(re.compilation.compiledLeafCount, 1);
  assert.equal(re.clientBindings.unresolvedCount, 1);
  assert.equal(re.workSemantics.requiredInputCount, 7); assert.equal(re.workSemantics.outcomeCount, 0); assert.equal(re.rulesControlsCoverage.decisionCount, 0); assert.equal(re.rulesControlsCoverage.ruleCount, 0); assert.equal(re.rulesControlsCoverage.controlCount, 0);
  assert.ok(proof.limitations.some((l) => /No savings/.test(l))); assert.ok(proof.limitations.some((l) => /only partially compiled/.test(l)));
});
await test('U05 independent cross-check: the proof agrees with the S8-4 consumer crosswalk built from the public S8-3 summaries', async () => {
  const {buildConsumerViewModel, buildCrosswalk, loadSummaries} = await import('../assets/atl-140-consumer-view.mjs');
  const files = {'/governance/product/s8-3b-evidence/reconstruction-summary.json': 's8-3b-evidence/reconstruction-summary.json', '/governance/product/s8-3c-evidence/package-readiness-summary.json': 's8-3c-evidence/package-readiness-summary.json', '/governance/product/s8-3d-evidence/projection-summary.json': 's8-3d-evidence/projection-summary.json', '/governance/product/s8-3e-evidence/flow-summary.json': 's8-3e-evidence/flow-summary.json'};
  const fetchImpl = async (u) => ({ok: true, json: async () => JSON.parse(read(`governance/product/${files[u]}`))});
  const model = buildConsumerViewModel(await loadSummaries(fetchImpl)); const cw = buildCrosswalk(model);
  const byReq = Object.fromEntries(cw.map((r) => [r[0], r[4]]));
  const mine = Object.fromEntries(proof.requirements.map((r) => [r.requirement, r.status]));
  assert.equal(mine['Canonical identity/version/lineage'], byReq['Canonical identity/version/lineage']);
  assert.equal(mine['Work semantics'], byReq['Work semantics']);
  assert.equal(mine['Client execution parameters'], byReq['Client execution parameters']);
  assert.ok(['UNSUPPORTED', 'REQUIREMENT_NOT_CONFIRMED'].includes(byReq['Malkom API endpoint']) && mine['Malkom API endpoint'] === 'REQUIREMENT_NOT_CONFIRMED');
  assert.equal(model.coverage.notCompiledLeafCount, proof.reusableElements.compilation.notCompiledLeafCount); assert.equal(model.readiness.unresolvedBindingCount, proof.reusableElements.clientBindings.unresolvedCount);
});
await test('U06 historical baseline is preserved as HISTORICAL_ONLY with an explicit delta; historical counts/PASS are not reproduced', () => {
  assert.equal(proof.historicalBaseline.status, 'HISTORICAL_ONLY'); assert.equal(proof.historicalBaseline.proofBlob, '8608c68f1007ea5f18b07452eeb9d3894b9aea40'); assert.equal(proof.method.historicalCountsReproduced, false);
  assert.equal(proof.historicalBaseline.delta.availableOrProjectable.historical, 2); assert.equal(proof.historicalBaseline.delta.availableOrProjectable.successor, 1);
  assert.equal(proof.historicalBaseline.delta.workSemanticsState.historical, 'AVAILABLE'); assert.equal(proof.historicalBaseline.delta.workSemanticsState.successor, 'PARTIAL');
  const histProof = JSON.parse(git(['show', `b6df8cfe581fb5ac2ff8f51774cdbdfc15a54f77:data/generated/utility/road-ltl-ltl04-malkom-utility-proof-v1.json`]));
  assert.equal(git(['rev-parse', 'b6df8cfe581fb5ac2ff8f51774cdbdfc15a54f77:data/generated/utility/road-ltl-ltl04-malkom-utility-proof-v1.json']), HISTORICAL_BASELINE.proofBlob);
  assert.deepEqual(histProof.counts, HISTORICAL_BASELINE.counts);
  const {historicalBaseline, ...rest} = proof; const text = JSON.stringify(rest);
  for (const stale of HISTORICAL_BASELINE.pinnedStaleSourceBlobs) assert.ok(!text.includes(stale), stale);
});
await test('U07 no promotion: not runtime/universal-execution ready, not materializable, not independently proven; no utility-value claim', () => {
  assert.deepEqual(proof.state, {projectionDisposition: 'BLOCKED', projectionBlocked: true, universalExecutionReady: false, materializable: false, runtimeCertification: false, independentExecutorProofStatus: 'NOT_INDEPENDENTLY_PROVEN', clientBindingState: 'CLIENT_BINDING_REQUIRED'});
  assert.ok(!/utility[- ]value (target )?(achieved|proven)/i.test(JSON.stringify(proof)));
  assert.deepEqual(verifyUtilityProof(proof, artifacts, hashes), {ok: true, failures: []});
});
await test('U08 the committed proof is public-safe: no source ids, binding ids, knowledge-gap ids or handoff ids', () => {
  const text = read(EVIDENCE_FILES.atl173);
  for (const re of [/src-[a-z0-9-]+/i, /binding::/, /KG::/, /malkom-projection-boundary::/, /LTL-04::ACT/, /LTL-04::DG/]) assert.ok(!re.test(text.replace(/road-ltl@1\.5::LTL-04::LTL-04::ACT::02::WD/g, '').replace(/malkom-dw::road-ltl::LTL-04::v1/g, '')), String(re));
  assert.equal(JSON.parse(text).classification, 'PUBLIC_NON_RECONSTRUCTIVE');
});
const rejectInput = (name, fn, code) => test(`U09 rejects ${name} → ${code}`, () => {
  const a = mutated(fn); const h = {...hashes, readiness: lineage.canonicalHash(a.readiness), package: lineage.canonicalHash(a.package), projection: lineage.canonicalHash(a.projection), wd: lineage.canonicalHash(a.wd)};
  assert.throws(() => deriveSuccessorUtilityProof(a, h), new RegExp(code));
});
await rejectInput('readiness promoted to AVAILABLE work semantics', (a) => { a.readiness.workSemantics.state = 'AVAILABLE'; }, 'LINEAGE_IDENTITY_MISMATCH:(package|readiness)');
await rejectInput('client binding silently resolved', (a) => { a.readiness.clientBindings.unresolvedCount = 0; a.readiness.clientBindings.state = 'RESOLVED'; }, 'LINEAGE_IDENTITY_MISMATCH:(package|readiness)');
await rejectInput('projection promoted to materializable', (a) => { a.projection.release.materializable = true; }, 'LINEAGE_IDENTITY_MISMATCH:projection');
await rejectInput('package interface changed to an invented endpoint', (a) => { a.package.interface.apiEndpointDisposition = 'CONFIRMED'; }, 'LINEAGE_IDENTITY_MISMATCH:package');
await rejectInput('WorkDefinition leaf coverage inflated', (a) => { a.wd.totals.notCompiledLeafCount = 0; }, 'LINEAGE_IDENTITY_MISMATCH:wd');
await test('U09 rejects substituting the HISTORICAL (stale) readiness/package/projection blobs for the corrected artifacts', () => {
  for (const [p, key] of [['data/generated/readiness/road-ltl-ltl04-malkom-readiness-v1.json', 'readiness'], ['data/generated/malkom-domain-warehouse/road-ltl-ltl04-v1.json', 'package'], ['data/generated/malkom-domain-warehouse/road-ltl-ltl04-projection-boundary-v1.json', 'projection']]) {
    const hist = JSON.parse(git(['show', `b6df8cfe581fb5ac2ff8f51774cdbdfc15a54f77:${p}`])); const a = clone(artifacts); a[key] = hist;
    assert.throws(() => deriveSuccessorUtilityProof(a, {...hashes, [key]: lineage.canonicalHash(hist)}), new RegExp(`LINEAGE_IDENTITY_MISMATCH:${key}`), key);
  }
});
const verifierRejects = (name, fn, code) => test(`U10 verifier rejects tampered proof: ${name} → ${code}`, () => { const p = clone(proof); fn(p); const r = verifyUtilityProof(p, artifacts, hashes); assert.equal(r.ok, false); assert.ok(r.failures.some((x) => x.code === code), JSON.stringify(r.failures.map((x) => x.code))); });
await verifierRejects('work semantics overstated', (p) => { p.requirements[1].status = 'AVAILABLE'; p.counts.availableOrProjectable = 2; p.counts.partial = 0; }, 'WORK_SEMANTICS_OVERSTATED');
await verifierRejects('readiness promoted', (p) => { p.state.universalExecutionReady = true; }, 'READINESS_PROMOTED');
await verifierRejects('materializable promoted', (p) => { p.state.materializable = true; }, 'READINESS_PROMOTED');
await verifierRejects('historical counts claimed as current', (p) => { p.method.historicalCountsReproduced = true; }, 'HISTORICAL_COUNTS_CLAIMED_AS_CURRENT');
await verifierRejects('no-savings guard removed', (p) => { p.limitations = p.limitations.filter((l) => !/No savings/.test(l)); }, 'UTILITY_VALUE_CLAIM_GUARD_REMOVED');
await verifierRejects('client-binding blocker removed', (p) => { p.residualDiscovery = p.residualDiscovery.filter((r) => r.type !== 'CLIENT_BINDING_REQUIRED'); }, 'UNRESOLVED_BLOCKER_REMOVED');
await verifierRejects('stale source blob injected', (p) => { p.method.basis += ' c3bb7336'; }, 'STALE_IDENTITY_IN_PROOF');
await verifierRejects('any other drift', (p) => { p.counts.materialRequirements = 5; }, 'PROOF_DRIFT');

// ======================================================= ATL-167 — BLOCKED record
const rec167 = JSON.parse(read(EVIDENCE_FILES.atl167));
await test('V01 ATL-167 is recorded BLOCKED — NO CURRENT SUCCESSOR RETEST SURFACE, with mechanically verified evidence', () => {
  assert.equal(read(EVIDENCE_FILES.atl167), gen.files[EVIDENCE_FILES.atl167]);
  assert.equal(rec167.result, 'BLOCKED'); assert.equal(rec167.reason, 'NO_CURRENT_SUCCESSOR_RETEST_SURFACE');
  const e = rec167.mechanicallyVerifiedEvidence;
  for (const k of ['slicePageAbsentFromSuccessorTree', 'slicePageHistoricalBlobResolvable', 'historicalTestBlobResolvable', 'historicalTestBoundToStaleWorkDefinitionId', 'historicalTestBoundToStalePackageId', 'historicalTestBoundToStaleHash88bd3da8', 'historicalTestRequiresRootToLinkSlice', 's8_4DocStatesSliceNotRebound', 's8_4SuiteAssertsStalePagesAbsent', 's8_3fManifestExcludesStaleSlice']) assert.equal(e[k], true, k);
  assert.equal(e.certifiedRootLinksSlice, false); assert.equal(e.tracked167Tests, 0); assert.equal(e.certifiedRootIndexBlob, '043802523b1618c143a0e78b88bbfb2afaa7c7dd');
  assert.equal(rec167.historicalIdentity.commit, 'abbb472999025df3278db0a2756b08186a40f183');
});
await test('V02 ATL-167 is NOT executed, ported, rebuilt, marked superseded, or partially claimed as PASS', () => {
  const txt = JSON.stringify(rec167);
  assert.match(rec167.notAnAuthoritativeSupersession, /NOT a supersession decision/);
  assert.ok(!/"result":\s*"(PASS|SUPERSEDED|PARTIAL)"/.test(txt));
  for (const o of rec167.historicalObligationInventory) assert.ok(!/^PASS/.test(o.successorSurface), o.id);
  const tracked = git(['ls-files']).split('\n');
  assert.ok(!tracked.includes('atl-167-interaction-slice.html') && !tracked.some((p) => /^tests\/atl-167/.test(p)));
  assert.equal(git(['rev-parse', 'HEAD:index.html']), git(['rev-parse', `${S8_3F_BASE}:index.html`]), 'certified root untouched');
  assert.equal(git(['rev-parse', 'HEAD:index.html']), '043802523b1618c143a0e78b88bbfb2afaa7c7dd');
});

// ======================================================= scope / non-promotion
await test('S01 S8-5A scope: only additive verification/evidence/documentation paths vs the S8-3F evidence head; no product path, workbook, release or root change', () => {
  const changed = git(['diff', '--name-status', S8_3F_BASE, 'HEAD']).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const okPath = (p) => p.startsWith('tests/fixtures/s8-5a/atl-157-historical/') || p.startsWith('tests/s8-5a-support/') || p === 'tests/s8-5a-successor-retests.test.mjs' || p === 'governance/product/S8_5A_BOUNDED_SUCCESSOR_RETESTS.md' || p.startsWith('governance/product/s8-5a-evidence/');
  for (const [st, p] of changed) { assert.equal(st, 'A', `${p}: only additions`); assert.ok(okPath(p), `unexpected changed path ${p}`); }
  for (const p of ['lib', 'api', 'assets', 'data', 'release', 'scripts', 'canvas-v2', 'runtime', 'execution', 'schemas']) assert.equal(git(['diff', '--name-only', S8_3F_BASE, 'HEAD', '--', p]), '', p);
});
await test('S02 inherited corrected-lineage identities are unchanged (manifest not regenerated; S8-3F evidence untouched)', () => {
  assert.equal(git(['diff', '--name-only', S8_3F_BASE, 'HEAD', '--', 'release/manifests', 'governance/product/s8-3f-evidence', 'governance/product/s8-4-evidence', 'governance/product/s8-3e-evidence']), '');
});
await test('S03 evidence artifacts are deterministic: regenerated files equal committed files', () => {
  for (const [p, c] of Object.entries(gen.files)) assert.equal(read(p), c, p);
});

const failed = results.filter((r) => !r.ok);
console.log(`\nS8-5A: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'));
console.log(JSON.stringify({suite: 's8-5a-successor-retests', total: results.length, passed: results.length - failed.length, failed: failed.length}));
if (failed.length) process.exit(1);
