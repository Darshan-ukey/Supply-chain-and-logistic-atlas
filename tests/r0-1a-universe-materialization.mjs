import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildPayload, extractUniverseSemantics, canonicalHash, stableStringify, EXTRACTOR_VERSION, PAYLOAD_SCHEMA_VERSION } from '../tools/universe/extract-universe-semantics.mjs';
import { compareCopies, SHELL_NAVIGATION_STRUCTURES } from '../tools/universe/compare-universe-copies.mjs';

const SOURCES = [
  'reference/universe-v7.3.html',
  'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html',
  'frozen-assets/inbox/ocean-fcl-lcl-v0.5-v7.3/site/universe-v7.3.html'
];
const PAYLOAD = 'data/universe/universe-semantic-payload.json';
const REPORT = 'data/universe/universe-extraction-report.json';
const COMPARISON = 'data/universe/universe-copy-comparison.json';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// ---------------------------------------------------------------- sources retained
for (const s of SOURCES) assert.ok(fs.existsSync(s), `retained Universe source must be present: ${s}`);
const sourceHashes = SOURCES.map(sha);
assert.equal(new Set(sourceHashes).size, 2, 'exactly two distinct Universe source hashes are retained');

// ---------------------------------------------------------------- determinism
const html = fs.readFileSync(SOURCES[0], 'utf8');
const a = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
const b = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
assert.equal(stableStringify(a.payload), stableStringify(b.payload), 'extraction must be byte-deterministic across runs');
assert.equal(canonicalHash(a.payload.structures), canonicalHash(b.payload.structures), 'semantic hash must be stable');

// ---------------------------------------------------------------- completeness
const ex = extractUniverseSemantics(html).extraction;
assert.equal(ex.unresolved.length, 0, `every module-scope structure must be recovered; unresolved: ${ex.unresolved.join(', ')}`);
assert.equal(
  ex.recoveredPass1.length + ex.recoveredPass2.length + ex.recoveredPass3.length,
  ex.topLevelDeclarations,
  'recovered structures must account for every module-scope declaration'
);
assert.ok(ex.topLevelDeclarations >= 52, 'module-scope declaration count must not regress');

// ---------------------------------------------------------------- committed payload matches source
const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
assert.equal(payload.schemaVersion, PAYLOAD_SCHEMA_VERSION);
assert.equal(payload.extractorVersion, EXTRACTOR_VERSION, 'committed payload must match the retained extractor version');
assert.equal(payload.lineage.sourceSha256, sha(SOURCES[0]), 'committed payload must derive from the retained source');
assert.equal(
  canonicalHash(payload.structures), canonicalHash(a.payload.structures),
  'committed payload must be reproducible by re-running the retained extractor'
);
assert.ok(Object.keys(payload.structures).length >= 52, 'committed structure count must not regress');

// ---------------------------------------------------------------- dual lineage preserved
assert.equal(payload.lineage.releaseShellVersion, '7.3', 'release shell version must be recorded');
assert.equal(payload.lineage.embeddedSemanticIdentity.version, '7.2.0', 'embedded semantic identity must be recorded verbatim');
assert.equal(payload.lineage.embeddedSemanticIdentity.id, 'supply-chain-logistics-universe-v7.2');
assert.equal(payload.lineage.identityReconciliation, 'PENDING_R0_1B', 'R0.1A must not decide release identity');

// ------------------------------------------------- no inference / no invented identifiers
assert.equal(payload.classification, 'MECHANICAL_SEMANTIC_MATERIALIZATION_NO_INFERENCE');
assert.equal(
  payload.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
  'reference ownership must remain unclassified until R0.1C'
);
const blob = JSON.stringify(payload.structures);
for (const forbidden of [/"a5-[a-z]/i, /"scp-[a-z]/i]) {
  assert.ok(!forbidden.test(blob), `R0.1A must not introduce daughter identifiers matching ${forbidden}`);
}
// every extracted value must be literally present in the source: spot-check identifiers
for (const key of ['universeReleaseMetadata', 'domains', 'businessObjectRecords', 'sourceRecords']) {
  assert.ok(key in payload.structures, `expected structure missing: ${key}`);
  assert.ok(html.includes(key), `structure name must exist verbatim in source: ${key}`);
}

// ---------------------------------------------------------------- extraction report
const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
assert.equal(report.stageId, 'R0.1A');
assert.equal(report.completeness.unresolvedCount, 0);
assert.equal(report.hashes.semanticStructures, canonicalHash(payload.structures), 'report hash must match the payload');
assert.ok(report.totalRecords >= 900, 'record count must not regress');

// ---------------------------------------------------------------- copy comparison
const comparison = JSON.parse(fs.readFileSync(COMPARISON, 'utf8'));
const live = compareCopies(SOURCES);
assert.equal(live.result, comparison.result, 'committed comparison must be reproducible');
assert.equal(live.distinctSourceHashes, 2);
assert.equal(live.distinctCoreSemanticHashes, 1, 'core Universe semantics must be identical across retained copies');
assert.equal(live.result, 'CORE_SEMANTICS_IDENTICAL_SHELL_NAVIGATION_DIFFERS');
assert.equal(live.authorityDetermination, 'NOT_DETERMINED_PENDING_R0_1B', 'R0.1A must not select an authoritative copy');
for (const d of live.differingStructures) {
  assert.equal(d.classification, 'SHELL_NAVIGATION', `unexpected semantic difference in ${d.name}`);
  assert.ok(SHELL_NAVIGATION_STRUCTURES.includes(d.name));
}

// ---------------------------------------------------------------- scope guard
// Guards must inspect executable code, not the comments that disclaim these behaviours.
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
for (const tool of ['tools/universe/extract-universe-semantics.mjs', 'tools/universe/compare-universe-copies.mjs']) {
  const code = stripComments(fs.readFileSync(tool, 'utf8'));
  assert.doesNotMatch(code, /crosswalk/i, `${tool} must not build a crosswalk`);
  assert.doesNotMatch(code, /\b7\.4\b/, `${tool} must not create Universe 7.4`);
  assert.doesNotMatch(code, /road-ltl|ocean-fcl|ocean-lcl/i, `${tool} must not touch daughter references`);
  assert.doesNotMatch(code, /["'`]a5-|["'`]scp-/i, `${tool} must not introduce daughter identifiers`);
}

console.log('R0.1A Universe semantic materialization certification PASS');
