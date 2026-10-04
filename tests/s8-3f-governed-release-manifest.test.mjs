import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {MANIFEST_PATH, SCHEMA_VERSION, GENERATOR_PATHS, PROTECTED, EXCLUDED, STALE_WD_MARKER, serialize, buildManifest, generateManifest, verifyManifest, reproduceProtectedIdentities, integrityState, packageAskResidual} from '../lib/release/s8-release-manifest.js';

// S8-3F — Governed Release Manifest Regeneration. PASS here means manifest/regeneration correctness ONLY.
// It is not release readiness, rollback readiness or runtime readiness.
const root = process.cwd();
const git = (args) => cp.execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd: root, encoding: 'utf8', maxBuffer: 200000000}).trim();
const clone = (v) => structuredClone(v);
const results = [];
const test = async (name, fn) => { try { await fn(); results.push({name, ok: true}); console.log(`PASS ${name}`); } catch (e) { results.push({name, ok: false}); console.log(`FAIL ${name}\n  ${e.message}`); } };
const codes = (m, opts = {}) => verifyManifest(m, {root, ...opts}).failures.map((f) => f.code);
const rejects = (name, mutate, expectCode) => test(`negative: ${name} → ${expectCode}`, () => {
  const m = clone(committed); mutate(m);
  const c = codes(m);
  assert.ok(c.length > 0, 'mutated manifest must be rejected');
  assert.ok(c.includes(expectCode), `expected ${expectCode}; got ${[...new Set(c)].join(',')}`);
});

const committed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const entry = (m, id) => m.lineage.find((l) => l.id === id);

// ---------------------------------------------------------------- regeneration / determinism
await test('manifest schema/version and stage identity', () => {
  assert.equal(committed.schemaVersion, SCHEMA_VERSION);
  assert.equal(committed.stage.id, 'S8-3F'); assert.match(committed.stage.meaning, /NOT release readiness, rollback readiness or runtime readiness/);
  assert.equal(committed.successorSpine.branchBase, '3ead8bd108c349ba2149063d39376c8d2a04c2f3');
});
await test('deterministic regeneration equals the committed manifest byte-for-byte', () => {
  assert.equal(serialize(generateManifest(root)), fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.equal(serialize(generateManifest(root)), serialize(generateManifest(root)));
});
await test('every governed lineage entry is MATCH (expected == observed)', () => {
  assert.ok(committed.lineage.length >= 50);
  for (const l of committed.lineage) assert.equal(l.status, 'MATCH', l.id);
});
await test('verifier accepts the committed manifest', () => {
  const r = verifyManifest(committed, {root});
  assert.deepEqual(r.failures, []); assert.equal(r.ok, true);
});
await test('protected derivatives reproduce from the governed lineage (hashes only) and equal the pins', async () => {
  const r = await reproduceProtectedIdentities(root);
  for (const p of PROTECTED) assert.equal(r[p.id], p.expected, p.id);
  assert.equal(r['source.task-hash'], entry(committed, 'source.task-hash').expected);
  assert.equal(r['source.semantics-record'], entry(committed, 'source.semantics-record').expected);
  assert.equal(r['source.client-binding'], entry(committed, 'source.client-binding').expected);
  assert.deepEqual(verifyManifest(committed, {root, reproduce: r}).failures, []);
});
await test('required accepted identities are pinned (WD/package/readiness/projection/graph/flow/BPMN/SVG; S8-4)', () => {
  const want = {
    'derivative.wd': 'fcc3e6cfd3d9a3a93e5a88dc33a61c40d698be212d4c346fddfb81bf2d58be61',
    'derivative.package': '6324ff247ba3e21e9bb973a87061ef7a943871d1b9bf676d428f993d981f9367',
    'derivative.readiness': 'c2d2e9eef7b768f681558d0a1e37d4d4ff805c23d25186f3037dd3731fbdc617',
    'derivative.projection': '703f3a5bb02a270275672105ac2efcfcee227e2290082c5e26e13d7d363b654c',
    'derivative.flow-graph': 'dfad5a029ce830e4c1bff68ea1a9ac7f482315c619495a7295aef3c50abe408e',
    'derivative.flow-view': '1b3839e0bde5e92216373b9ff232a5d20de5e84a7c25250f7d4ce4b93dbaba6f',
    'derivative.bpmn': '1ede708543a8906333646f010b082446ec75dbf371337ad6069481c4958dfd61',
    'derivative.svg': 'dbd7d34f978d21a7f81059b58b6de6cac78c89c66c047af6bf98c71ead237482'
  };
  for (const [id, h] of Object.entries(want)) { assert.equal(entry(committed, id).expected, h); assert.equal(entry(committed, id).observed, h); }
  assert.deepEqual(committed.successorSpine.s8_4, {finalEvidenceHead: '3ead8bd108c349ba2149063d39376c8d2a04c2f3', testedCommit: '07a41138f7b52e5fe1d0c9d5989f72b9835560c5', testedTree: '075784fe046f4f7a55ea719809d5ccb10376ea2c', qaEvidenceSha256: '3ed23c6732f97d1451e62a32be517b19697ac24fee9f9cc8e769d0d365c3fe51', ...committed.successorSpine.s8_4});
  for (const id of ['source.road-ltl-v1.4', 'source.semantics-record', 'source.client-binding', 'interaction.canvas-index', 'interaction.canvas-daughter-bridge', 'interaction.ask-api', 'interaction.ask-runtime', 'stage.s8-4']) assert.ok(entry(committed, id), id);
});

// ---------------------------------------------------------------- protected boundary
await test('protected derivatives carry identity/classification/custody only (no bytes, no path)', () => {
  for (const p of PROTECTED) { const l = entry(committed, p.id); assert.equal(l.classification, 'EXECUTION_PROTECTED'); assert.equal(l.bytesPublished, false); for (const k of ['path', 'content', 'bytes', 'body']) assert.ok(!(k in l), `${p.id}.${k}`); assert.equal(l.custody.reconstructedContentInManifest, false); }
});
await test('no tracked file equals protected bytes (leak scan by sha256 and canonical-hash filename)', () => {
  const protectedShas = new Set(PROTECTED.filter((p) => p.kind === 'SHA256_BYTES').map((p) => p.expected));
  for (const f of git(['ls-files']).split('\n')) { if (!fs.statSync(f).isFile() || fs.statSync(f).size > 20e6) continue; assert.ok(!protectedShas.has(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')), `protected bytes tracked at ${f}`); }
  assert.ok(!/\.(bpmn|svg)$/i.test(git(['ls-files', 'governance/product/s8-3f-evidence', 'release/manifests'])));
});

// ---------------------------------------------------------------- exclusions / stale identities
await test('every excluded stale/wrong-donor identity is absent from authority and from the tree', () => {
  assert.equal(committed.exclusions.length, EXCLUDED.length);
  for (const x of committed.exclusions) { assert.equal(x.currentAuthority, false, x.id); assert.equal(x.status, 'ABSENT_FROM_AUTHORITY', x.id); assert.deepEqual(x.locations, [], x.id); }
  assert.deepEqual(committed.staleLineageMarkerFiles, []);
});
await test('ATL-140 / ATL-142 roots are not the current root; certified root index is pinned', () => {
  assert.equal(entry(committed, 'interaction.root-index').expected, '043802523b1618c143a0e78b88bbfb2afaa7c7dd');
  const dumped = JSON.stringify(committed.lineage.map((l) => [l.expected, l.observed]));
  for (const bad of ['9cf88a867359ba33ebfbe85c1360f0ab21bc29b3', '379f988ce807f33dc8fd43b49b227b917a15b8c0']) assert.ok(!dumped.includes(bad));
});
await test('superseded Ask copies under release/packages are detected and represented as UNRESOLVED residual, not current', () => {
  const found = packageAskResidual(root);
  const paths = found.affectedPaths.map((a) => a.path).sort();
  assert.deepEqual(paths, ['release/packages/lab/lib/api/ask-atlas.js', 'release/packages/stable/lib/api/ask-atlas.js']);
  const res = committed.residuals.find((r) => r.id === 'RES-ASK-RELEASE-PACKAGES');
  assert.equal(res.status, 'UNRESOLVED_SUCCESSOR_ASSEMBLY_CLEANUP'); assert.equal(res.representsCurrentCertifiedAsk, false);
  assert.equal(res.currentCertifiedAskApiBlob, '8fa80f9dd0b733a523aed6970269f5f32d5e64da');
  assert.equal(git(['hash-object', 'lib/api/ask-atlas.js']), '8fa80f9dd0b733a523aed6970269f5f32d5e64da');
  assert.equal(git(['hash-object', 'release/packages/lab/lib/api/ask-atlas.js']), 'cb2bcfea0892adf5a871fb4584461b50729ab383');
});
await test('release packages are untouched relative to the S8-4 base (no rewrite)', () => {
  assert.equal(git(['diff', '--name-only', '3ead8bd108c349ba2149063d39376c8d2a04c2f3', 'HEAD', '--', 'release/packages']), '');
});

// ---------------------------------------------------------------- release controls
await test('Owner gate required; production promotion not authorized; release DO NOT MERGE', () => {
  assert.equal(committed.controls.ownerGateRequired, true); assert.equal(committed.controls.productionPromotionAuthorized, false);
  assert.equal(committed.downstream.release, 'DO NOT MERGE');
  assert.equal(committed.controls.identityVerification.mode, 'EXACT'); assert.equal(committed.controls.identityVerification.onMismatch, 'FAIL_CLOSED');
});
await test('rollback: mechanism ESTABLISHED; identity/deployment NOT_ESTABLISHED; five-way distinction; ATL-175 baseline is historical evidence only', () => {
  const r = committed.rollback;
  assert.equal(r.rollbackMechanismStatus, 'ESTABLISHED'); assert.equal(r.rollbackIdentityStatus, 'NOT_ESTABLISHED');
  assert.equal(r.currentSuccessorRollbackTarget, null); assert.equal(r.deploymentRollbackIdentity, 'NOT_ESTABLISHED');
  assert.equal(r.interpretationGuards.length, 5); assert.ok(r.promotionBlockedWhile.length >= 3);
  const h = committed.historicalEvidence.find((x) => x.id === 'historical.atl-175-rollback-baseline');
  assert.equal(h.classification, 'HISTORICAL_ROLLBACK_CONTROL_EVIDENCE'); assert.equal(h.currentSuccessorRollbackIdentity, false); assert.equal(h.importedIntoSuccessorTree, false);
  assert.ok(!fs.existsSync('release/baselines/v1.1.8-critical-hashes.json'));
  const text = JSON.stringify(r);
  for (const bad of ['02a3e9e2', 'v1.1.7-critical-hashes', 'v2-critical-hashes']) assert.ok(!text.includes(bad), `rollback section must not nominate ${bad}`);
});
await test('recovery evidence: every recovery artifact is identity-pinned and matches the tree', () => {
  for (const [p, blob] of Object.entries(committed.rollback.recoveryEvidence.gitContentAddressedArtifacts)) assert.equal(git(['hash-object', p]), blob, p);
  assert.equal(git(['hash-object', 'release/ROLLBACK_RUNBOOK.md']), committed.rollback.mechanism.runbookBlob);
});
await test('historical ATL-175 / ATL-141 donors are retrievable and classified evidence-only', () => {
  for (const id of ['historical.atl-175-control-donor', 'historical.atl-141-integrity-evidence']) { const h = committed.historicalEvidence.find((x) => x.id === id); assert.equal(h.commitResolves, true, id); assert.equal(h.currentAuthority, false); assert.equal(h.contentAuthority, false); }
  assert.equal(committed.historicalEvidence.find((x) => x.id === 'historical.atl-141-integrity-evidence').tree, '3aae4c19fcccea3aa8baa7d01c7e5faa5cc5e484');
});
await test('release integrity fails closed and the manifest does NOT certify the baseline', async () => {
  const ri = committed.releaseIntegrity;
  assert.equal(ri.certified, false); assert.equal(ri.manifestCertifiesBaseline, false); assert.equal(ri.observedVerification.status, 'FAILS_VERIFICATION');
  assert.deepEqual(integrityState(root).observedVerification, ri.observedVerification);
  const {default: handler} = await import('../lib/api/release-integrity.js');
  const res = {statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.payload = b; return this; }, end(b) { if (b) { try { this.payload = JSON.parse(b); } catch { this.payload = b; } } return this; }};
  await handler({method: 'GET', headers: {}, query: {}}, res);
  assert.equal(res.statusCode, 500); assert.equal(res.payload?.ok, false); assert.equal(res.payload?.criticalIntegrity, false);
  assert.equal(git(['hash-object', 'release/baselines/v2-critical-hashes.json']), '1c4e7f34327817b7ed16e96b901392049f57b989', 'baseline not repaired');
  assert.equal(git(['hash-object', 'lib/api/release-integrity.js']), ri.verifier.blob, 'verifier not weakened');
});
await test('runtime readiness remains blocked; unresolved blockers unchanged', () => {
  const rt = committed.runtimeState;
  assert.equal(rt.universalExecutionReady, false); assert.equal(rt.materializable, false); assert.equal(rt.independentExecutorProofStatus, 'NOT_INDEPENDENTLY_PROVEN');
  assert.equal(rt.runtimeReadiness, 'NOT_PROMOTED'); assert.equal(rt.clientBindingState, 'CLIENT_BINDING_REQUIRED'); assert.equal(rt.knowledgeGapState, 'BLOCKED');
  assert.equal(committed.downstream['S8-5'], 'NOT STARTED'); assert.equal(committed.downstream['S8-6'], 'NOT STARTED'); assert.equal(committed.downstream['ATL-181'], 'BLOCKED — WAIT S8-6');
});
await test('generator paths are pinned in the manifest and the stale WD marker is absent from them', () => {
  assert.deepEqual(committed.generator.paths, [...GENERATOR_PATHS]); for (const p of GENERATOR_PATHS) assert.equal(committed.generator.blobs[p], git(['hash-object', p]), p);
  for (const p of GENERATOR_PATHS) assert.ok(!fs.readFileSync(p, 'utf8').includes(STALE_WD_MARKER), p);
});

// ---------------------------------------------------------------- mutation / rejection (manifest level)
await rejects('derivative replaced by a stale identity', (m) => { entry(m, 'derivative.wd').expected = 'c3bb7336' + '0'.repeat(56); entry(m, 'derivative.wd').observed = entry(m, 'derivative.wd').expected; }, 'OUTPUT_HASH_DRIFT');
await rejects('corrected S8 input replaced by stale blob', (m) => { entry(m, 'interaction.ask-runtime').expected = 'd43f4130' + '0'.repeat(32); }, 'IDENTITY_REPLACED_OR_STALE');
await rejects('ATL-140 wrong root reintroduced as release authority', (m) => { entry(m, 'interaction.root-index').expected = '9cf88a867359ba33ebfbe85c1360f0ab21bc29b3'; entry(m, 'interaction.root-index').observed = '9cf88a867359ba33ebfbe85c1360f0ab21bc29b3'; }, 'ATL_140_ROOT_REINTRODUCED');
await rejects('ATL-142 wrong root introduced as release authority', (m) => { entry(m, 'interaction.root-index').expected = '379f988ce807f33dc8fd43b49b227b917a15b8c0'; entry(m, 'interaction.root-index').observed = '379f988ce807f33dc8fd43b49b227b917a15b8c0'; }, 'ATL_142_ROOT_REINTRODUCED');
await rejects('superseded Ask represented as current certified Ask', (m) => { entry(m, 'interaction.ask-api').expected = 'cb2bcfea0892adf5a871fb4584461b50729ab383'; entry(m, 'interaction.ask-api').observed = 'cb2bcfea0892adf5a871fb4584461b50729ab383'; }, 'SUPERSEDED_ASK_AS_CURRENT');
await rejects('residual Ask copies claimed to be current', (m) => { m.residuals.find((r) => r.id === 'RES-ASK-RELEASE-PACKAGES').representsCurrentCertifiedAsk = true; }, 'SUPERSEDED_ASK_AS_CURRENT');
await rejects('residual Ask cleanup status upgraded', (m) => { m.residuals.find((r) => r.id === 'RES-ASK-RELEASE-PACKAGES').status = 'CERTIFIED_CURRENT'; }, 'SUPERSEDED_ASK_AS_CURRENT');
await rejects('governed source identity missing', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'source.road-ltl-v1.4'); }, 'SOURCE_OR_FROZEN_DONOR_IDENTITY_MISSING');
await rejects('frozen donor identity missing', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'generator.workdefinition-compiler'); }, 'SOURCE_OR_FROZEN_DONOR_IDENTITY_MISSING');
await rejects('protected artifact represented by ungoverned/reconstructed content', (m) => { entry(m, 'derivative.bpmn').path = 'generated/flow.bpmn'; }, 'PROTECTED_ARTIFACT_UNGOVERNED_REPRESENTATION');
await rejects('protected artifact content embedded', (m) => { entry(m, 'derivative.svg').content = '<svg/>'; }, 'PROTECTED_ARTIFACT_UNGOVERNED_REPRESENTATION');
await rejects('protected artifact bytesPublished true', (m) => { entry(m, 'derivative.wd').bytesPublished = true; }, 'PROTECTED_ARTIFACT_UNGOVERNED_REPRESENTATION');
await rejects('output hash drift (package)', (m) => { entry(m, 'derivative.package').observed = '0'.repeat(64); }, 'OUTPUT_HASH_DRIFT');
await rejects('rollback identity asserted without authority (target nominated)', (m) => { m.rollback.currentSuccessorRollbackTarget = 'release/baselines/v2-critical-hashes.json'; m.rollback.rollbackIdentityStatus = 'ESTABLISHED'; }, 'ROLLBACK_IDENTITY_ASSERTED_WITHOUT_AUTHORITY');
await rejects('rollback identity missing (section removed)', (m) => { delete m.rollback; }, 'ROLLBACK_STATE_INVALID');
await rejects('rollback recovery evidence missing', (m) => { delete m.rollback.recoveryEvidence; }, 'ROLLBACK_RECOVERY_EVIDENCE_MISSING');
await rejects('rollback recovery identity drift', (m) => { const a = m.rollback.recoveryEvidence.gitContentAddressedArtifacts; a['index.html'] = '0'.repeat(40); }, 'ROLLBACK_RECOVERY_IDENTITY_DRIFT');
await rejects('rollback promotion guard removed', (m) => { m.rollback.interpretationGuards = []; }, 'ROLLBACK_PROMOTION_GUARD_MISSING');
await rejects('deployment rollback identity fabricated', (m) => { m.rollback.deploymentRollbackIdentity = 'dpl_fabricated'; }, 'DEPLOYMENT_IDENTITY_ASSERTED_WITHOUT_AUTHORITY');
await rejects('historical ATL-175 baseline relabelled as current rollback', (m) => { const h = m.historicalEvidence.find((x) => x.id === 'historical.atl-175-rollback-baseline'); h.currentSuccessorRollbackIdentity = true; }, 'HISTORICAL_ROLLBACK_EVIDENCE_MISREPRESENTED');
await rejects('ATL-141 evidence promoted to authority', (m) => { m.historicalEvidence.find((x) => x.id === 'historical.atl-141-integrity-evidence').currentAuthority = true; }, 'STALE_IDENTITY_AS_AUTHORITY');
await rejects('ownerGateRequired false', (m) => { m.controls.ownerGateRequired = false; }, 'OWNER_GATE_NOT_REQUIRED');
await rejects('productionPromotionAuthorized true', (m) => { m.controls.productionPromotionAuthorized = true; }, 'PRODUCTION_PROMOTION_AUTHORIZED');
await rejects('identity verification no longer fail-closed', (m) => { m.controls.identityVerification.onMismatch = 'WARN'; }, 'IDENTITY_VERIFICATION_NOT_FAIL_CLOSED');
await rejects('release-integrity baseline certified while failing', (m) => { m.releaseIntegrity.certified = true; m.releaseIntegrity.manifestCertifiesBaseline = true; m.releaseIntegrity.observedVerification.status = 'PASSES_VERIFICATION'; }, 'INTEGRITY_BASELINE_CERTIFIED_WHILE_FAILING');
await rejects('release-integrity drift list erased', (m) => { m.releaseIntegrity.observedVerification.mismatches = []; m.releaseIntegrity.observedVerification.mismatchedCount = 0; }, 'RELEASE_INTEGRITY_STATE_DRIFT');
await rejects('runtime readiness promoted (universalExecutionReady)', (m) => { m.runtimeState.universalExecutionReady = true; }, 'RUNTIME_READINESS_PROMOTED');
await rejects('runtime readiness promoted (materializable)', (m) => { m.runtimeState.materializable = true; }, 'RUNTIME_READINESS_PROMOTED');
await rejects('independent proof claimed', (m) => { m.runtimeState.independentExecutorProofStatus = 'INDEPENDENTLY_PROVEN'; }, 'RUNTIME_READINESS_PROMOTED');
await rejects('unresolved blocker removed (client binding)', (m) => { m.runtimeState.unresolvedBindingCount = 0; m.runtimeState.clientBindingState = 'RESOLVED'; }, 'UNRESOLVED_BLOCKER_REMOVED');
await rejects('unresolved blocker removed (knowledge gap)', (m) => { m.runtimeState.blockedByKnowledgeGapLeafCount = 0; m.runtimeState.knowledgeGapState = 'RESOLVED'; }, 'UNRESOLVED_BLOCKER_REMOVED');
await rejects('downstream state altered (S8-5 started)', (m) => { m.downstream['S8-5'] = 'STARTED'; }, 'DOWNSTREAM_STATE_ALTERED');
await rejects('release state changed to mergeable', (m) => { m.downstream.release = 'MERGE'; }, 'DOWNSTREAM_STATE_ALTERED');
await rejects('S8-4 identity omitted (successorSpine)', (m) => { delete m.successorSpine.s8_4; }, 'S8_4_IDENTITY_MISSING');
await rejects('S8-4 interaction entry omitted', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'interaction.canvas-daughter-bridge'); }, 'S8_4_IDENTITY_MISSING');
await rejects('S8-4 stage QA evidence omitted', (m) => { m.lineage = m.lineage.filter((l) => l.id !== 'stage.s8-4'); }, 'S8_4_IDENTITY_MISSING');
await rejects('S8-4 tested tree altered', (m) => { m.successorSpine.s8_4.testedTree = '0'.repeat(40); }, 'S8_4_IDENTITY_MISSING');
await rejects('wrong successor base', (m) => { m.successorSpine.branchBase = 'fe17ebb5c77fe86ef44a68d8a38eab65b5ce4751'; }, 'WRONG_SUCCESSOR_BASE');
await rejects('exclusion record removed', (m) => { m.exclusions = m.exclusions.filter((x) => x.id !== 'excluded.atl-140-root-index'); }, 'EXCLUSION_RECORD_MISSING');
await rejects('exclusion promoted to authority', (m) => { m.exclusions[0].currentAuthority = true; }, 'STALE_IDENTITY_AS_AUTHORITY');
await rejects('stale WD lineage marker reported', (m) => { m.staleLineageMarkerFiles = ['assets/atl-140-v15-journey.mjs']; }, 'STALE_WD_LINEAGE_MARKER');
await rejects('manifest not equal to deterministic regeneration (hand edit)', (m) => { m.generator = {...m.generator, hand: 'edited'}; }, 'MANIFEST_DRIFT');
await rejects('schema version altered', (m) => { m.schemaVersion = 'atlas-v1.5-release-manifest-v1'; }, 'SCHEMA_VERSION_MISMATCH');

const failed = results.filter((r) => !r.ok);
console.log(`\nS8-3F: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'));
console.log(JSON.stringify({suite: 's8-3f-governed-release-manifest', total: results.length, passed: results.length - failed.length, failed: failed.length}));
if (failed.length) process.exit(1);
