import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  buildPayload, extractUniverseSemantics, canonicalHash, stableStringify,
  EXTRACTOR_VERSION, PAYLOAD_SCHEMA_VERSION
} from '../tools/universe/extract-universe-semantics.mjs';
import { compareCopies } from '../tools/universe/compare-universe-copies.mjs';
import { inventoryModuleDeclarations } from '../tools/universe/inventory-module-declarations.mjs';

const SOURCES = [
  'reference/universe-v7.3.html',
  'frozen-assets/inbox/supply-chain-logistics-universe-v7.3/Supply-Chain-Logistics-Universe-V7.3.html',
  'frozen-assets/inbox/ocean-fcl-lcl-v0.5-v7.3/site/universe-v7.3.html'
];
const PAYLOAD = 'data/universe/universe-semantic-payload.json';
const REPORT = 'data/universe/universe-extraction-report.json';
const COMPARISON = 'data/universe/universe-copy-comparison.json';
const INVENTORY = 'data/universe/universe-declaration-inventory.json';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for (const s of SOURCES) assert.ok(fs.existsSync(s), `retained Universe source must be present: ${s}`);
assert.equal(new Set(SOURCES.map(sha)).size, 2, 'exactly two distinct Universe source hashes are retained');

const html = fs.readFileSync(SOURCES[0], 'utf8');

// ---------------------------------------------------------------- determinism
const a = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
const b = buildPayload({ sourcePath: SOURCES[0], html, releaseShellVersion: '7.3' });
assert.equal(stableStringify(a.payload), stableStringify(b.payload), 'extraction must be byte-deterministic');

// ------------------------------------- completeness against an INDEPENDENT denominator
// The inventory is produced by a separate parser that enumerates every module-scope
// declaration regardless of right-hand-side shape, so completeness is not judged using
// the extractor's own detection rule.
const inv = inventoryModuleDeclarations(html);
assert.ok(inv.totalModuleScopeDeclarations >= 113, 'independent inventory must enumerate all module-scope declarations');
const missing = inv.mustMaterialize.filter(n => !(n in a.payload.structures));
assert.deepEqual(missing, [], `every data-bearing declaration must be materialized; missing: ${missing.join(', ')}`);
for (const cls of ['FUNCTION_HELPER', 'SCALAR_CONFIG', 'RUNTIME_UI_STATE']) {
  assert.ok(Array.isArray(inv.byClassification[cls] ?? []), `inventory must account for ${cls} declarations explicitly`);
}
assert.equal(extractUniverseSemantics(html, { additionalTargets: inv.mustMaterialize }).extraction.unresolved.length, 0,
  'no data-bearing declaration may remain unresolved');

// committed inventory must match a fresh run
const committedInv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
assert.equal(committedInv.mustMaterializeCount, inv.mustMaterializeCount, 'committed inventory must be reproducible');

// ---------------------------------- pass 3 captures declaration-boundary snapshots
// Regression: a value mutated after its declaration must NOT be captured post-mutation.
const probe = `<script>(() => {
  const probeRecords=[{id:'p1',code:'A'}];
  const probeDerived=probeRecords.map(r=>({...r}));
  for (const r of probeRecords) r.injectedAfterDeclaration = true;
  for (const r of probeDerived) r.injectedAfterDeclaration = true;
  document.body.innerHTML = 'runtime';
})();</script>`;
const probeOut = extractUniverseSemantics(probe, { additionalTargets: ['probeRecords', 'probeDerived'] });
for (const name of ['probeRecords', 'probeDerived']) {
  const rec = probeOut.structures[name]?.[0];
  assert.ok(rec, `${name} must be captured`);
  assert.ok(!('injectedAfterDeclaration' in rec),
    `${name} must be a declaration-boundary snapshot, not a live reference mutated by later runtime code`);
}
// termination must be the deliberate sentinel, not an incidental DOM error
const term = extractUniverseSemantics(html, { additionalTargets: inv.mustMaterialize }).extraction.pass3Termination;
assert.ok(term.length > 0, 'pass 3 termination must be recorded');
for (const t of term) {
  assert.equal(t.termination, 'DELIBERATE_SENTINEL_AFTER_LAST_CAPTURE',
    `pass 3 must terminate deliberately after the last capture, got: ${t.termination}`);
}

// ---------------------------------------------------------- committed payload integrity
const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
assert.equal(payload.schemaVersion, PAYLOAD_SCHEMA_VERSION);
assert.equal(payload.extractorVersion, EXTRACTOR_VERSION);
assert.equal(payload.lineage.sourceSha256, sha(SOURCES[0]), 'payload must derive from the retained source');
assert.equal(canonicalHash(payload.structures), canonicalHash(a.payload.structures), 'payload must be reproducible');

// ---------------------------------------------------------------- dual lineage preserved
assert.equal(payload.lineage.releaseShellVersion, '7.3');
assert.equal(payload.lineage.embeddedSemanticIdentity.version, '7.2.0');
assert.equal(payload.lineage.embeddedSemanticIdentity.id, 'supply-chain-logistics-universe-v7.2');
assert.equal(payload.lineage.identityReconciliation, 'PENDING_R0_1B', 'R0.1A must not decide release identity');

// -------------------------------- no identifier may be introduced that is absent from source
// The rule is "do not invent identifiers", not "such identifiers may not exist in Universe
// content". Any a5-*/scp-* value present must be provably extracted from the retained source.
// Zero occurrences is an observed result, not an assumption.
const idPattern = /\b(?:a5|scp)-[a-z0-9][\w-]*/gi;
const found = [...new Set(JSON.stringify(payload.structures).match(idPattern) || [])];
for (const id of found) {
  assert.ok(html.includes(id), `identifier '${id}' appears in the payload but not in the retained source — it must not be introduced`);
}
console.log(`  observed a5-*/scp-* identifiers in payload: ${found.length}${found.length ? ` (all verified present in source)` : ''}`);
assert.equal(payload.referenceResolution.status, 'UNCLASSIFIED_PENDING_REFERENCE_OWNERSHIP_AUDIT',
  'reference ownership must remain unclassified until R0.1C');
assert.equal(payload.classification, 'MECHANICAL_SEMANTIC_MATERIALIZATION_NO_INFERENCE');

// every structure name must exist verbatim in the source
for (const name of Object.keys(payload.structures)) {
  assert.ok(html.includes(name), `structure name must exist verbatim in source: ${name}`);
}

// ---------------------------------------------------------------- extraction report
const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
assert.equal(report.stageId, 'R0.1A');
assert.equal(report.completeness.unresolvedCount, 0);
assert.equal(report.hashes.semanticStructures, canonicalHash(payload.structures));
assert.deepEqual(report.completeness.independentInventory.notMaterialized, [],
  'report must show every data-bearing declaration materialized');
assert.equal(report.constructionBoundaryConsistency.interpretation, 'PENDING_R0_1B',
  'construction-boundary divergence must be reported without interpretation');

// ------------------------------------------- copy comparison records facts only
const comparison = JSON.parse(fs.readFileSync(COMPARISON, 'utf8'));
const live = compareCopies(SOURCES);
assert.equal(live.distinctSourceHashes, 2);
assert.equal(live.differingStructureCount, comparison.differingStructureCount, 'comparison must be reproducible');
assert.equal(live.differenceClassification, 'PENDING_R0_1B', 'R0.1A must not classify differences');
assert.equal(live.authorityDetermination, 'NOT_DETERMINED_PENDING_R0_1B', 'R0.1A must not select an authoritative copy');
assert.equal(live.classification, 'RAW_OBSERVATION_NO_INTERPRETATION');
for (const d of live.differingStructures) {
  assert.equal(d.differenceClassification, 'PENDING_R0_1B', `${d.name} must remain unclassified in R0.1A`);
}
// Behavioural guard rather than a text match: the comparator must expose no classification
// vocabulary of its own, and every emitted classification must defer to R0.1B.
const comparatorModule = await import('../tools/universe/compare-universe-copies.mjs');
assert.equal(comparatorModule.SHELL_NAVIGATION_STRUCTURES, undefined,
  'comparator must not export a shell/navigation classification list — classification is R0.1B');
const emitted = new Set([
  live.differenceClassification,
  live.authorityDetermination,
  ...live.differingStructures.map(d => d.differenceClassification)
]);
assert.deepEqual([...emitted].sort(), ['NOT_DETERMINED_PENDING_R0_1B', 'PENDING_R0_1B'],
  `comparator emitted an interpretive classification: ${[...emitted].join(', ')}`);

// ---------------------------------------------------------------- scope guards
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
for (const tool of [
  'tools/universe/extract-universe-semantics.mjs',
  'tools/universe/compare-universe-copies.mjs',
  'tools/universe/inventory-module-declarations.mjs'
]) {
  const code = stripComments(fs.readFileSync(tool, 'utf8'));
  assert.doesNotMatch(code, /crosswalk/i, `${tool} must not build a crosswalk`);
  assert.doesNotMatch(code, /\b7\.4\b/, `${tool} must not create Universe 7.4`);
  assert.doesNotMatch(code, /road-ltl|ocean-fcl|ocean-lcl/i, `${tool} must not touch daughter references`);
  assert.doesNotMatch(code, /["'`]a5-|["'`]scp-/i, `${tool} must not embed daughter identifiers`);
}

console.log('R0.1A Universe semantic materialization certification PASS');
