import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// D2.0.6 — FULL-STATE end-to-end certification.
//
// Guardrail NO_DELTA_ONLY_CERTIFICATION is the defining constraint: this suite certifies the
// WHOLE branch state, not only what changed since the main baseline. Every check below walks
// the actual tree or the actual shipped surfaces rather than a diff.

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const gz = p => JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'base64')));
const tracked = () => execFileSync('git', ['ls-tree', '-r', 'HEAD', '--name-only'], { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const results = [];
const check = (name, fn) => {
  try { fn(); results.push([true, name]); }
  catch (e) { results.push([false, `${name} — ${e.message}`]); }
};

const ALL = tracked();

// =============================================================================
// 1. FULL-STATE INVENTORY — the whole tree, not a delta.
// =============================================================================
check('full branch inventory is non-trivial and readable', () => {
  assert.ok(ALL.length > 500, `expected a full repository, got ${ALL.length} files`);
  for (const f of ALL) {
    assert.ok(fs.existsSync(f), `tracked file missing from working tree: ${f}`);
  }
});

// =============================================================================
// 2. REFERENTIAL INTEGRITY — every governed reference resolves AND hash-matches.
// =============================================================================
const cat = J('data/module-catalog.json');

check('module catalog: every declared asset exists and hash-matches', () => {
  const entries = [cat.baseModule, ...cat.modules];
  for (const e of entries) {
    assert.ok(fs.existsSync(e.url), `catalog references missing file: ${e.url}`);
    if (e.sha256) {
      assert.equal(sha(e.url), e.sha256, `catalog hash mismatch for ${e.id} (${e.url})`);
    }
  }
});

check('P4 bridge: every canvasBaselineVersion resolves to an ACTIVE catalog module', () => {
  const targets = J('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json').targets;
  const active = Object.fromEntries(cat.modules.map(m => [m.id, m.version]));
  for (const [mid, t] of Object.entries(targets)) {
    assert.equal(active[mid], t.canvasBaselineVersion,
      `${mid}: bridge expects canvas v${t.canvasBaselineVersion}, catalog has v${active[mid]}`);
  }
});

check('projection registry: every materialized source has a real, decodable bundle', () => {
  const reg = J('governance/presentation/p2-projection-source-registry.json');
  for (const s of reg.sources) {
    if (!s.materialized) continue;
    const p = s.publicProjectionBundlePath;
    assert.ok(fs.existsSync(p), `${s.sourceKey}: bundle missing at ${p}`);
    const bundle = gz(p);
    assert.ok(bundle.sources[s.sourceKey],
      `${s.sourceKey}: bundle does not contain its own declared sourceKey`);
    assert.ok(Object.keys(bundle.sources[s.sourceKey]).length > 0,
      `${s.sourceKey}: bundle contains zero tasks`);
  }
});

check('bridge daughter targets have matching projection sources', () => {
  const targets = J('governance/presentation/P4_CANVAS_DAUGHTER_TARGETS.json').targets;
  const reg = J('governance/presentation/p2-projection-source-registry.json');
  const keys = new Set(reg.sources.map(s => s.sourceKey));
  for (const [mid, t] of Object.entries(targets)) {
    const expect = `${mid}@${t.daughterModuleVersion}`;
    assert.ok(keys.has(expect), `bridge target ${expect} has no projection source registered`);
  }
});

// =============================================================================
// 3. PUBLIC / ADMIN BOUNDARY — VERIFY_PUBLIC_ADMIN_BOUNDARIES
// =============================================================================
const PROTECTED_ROUTES = ['/api/work-decomposition', '/api/work-definition',
  '/api/admin-workdefinitions', '/api/governance-operational-projection', '/api/malkom-projections'];

check('public API router exposes only handlers that exist', () => {
  for (const routeFile of ALL.filter(f => f.startsWith('api/') && f.endsWith('.js'))) {
    const src = fs.readFileSync(routeFile, 'utf8');
    for (const m of src.matchAll(/'\.\/([a-z0-9-]+)\.js'/g)) {
      const target = `lib/api/${m[1]}.js`;
      assert.ok(fs.existsSync(target),
        `${routeFile} routes to a handler that does not exist: ${target}`);
    }
  }
});

check('public-facing demo surfaces do not reference protected execution-IP routes', () => {
  const publicPages = ['index.html', 'daughter.html', 'atlas-poc-journey.html',
    'atlas-execution-readiness.html'].filter(f => fs.existsSync(f));
  assert.ok(publicPages.length >= 3, 'expected the demo public surfaces to be present');
  for (const p of publicPages) {
    const src = fs.readFileSync(p, 'utf8');
    for (const route of PROTECTED_ROUTES) {
      assert.ok(!src.includes(route), `${p} references protected route ${route}`);
    }
  }
});

check('daughter bridge and renderer do not reach protected routes', () => {
  for (const f of ['assets/canvas-daughter-bridge-v2.0.1.mjs', 'assets/universal-daughter-renderer-v2.js']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const route of PROTECTED_ROUTES) {
      assert.ok(!src.includes(route), `${f} references protected route ${route}`);
    }
  }
});

check('public projection bundles carry no protected execution detail', () => {
  for (const [p, key] of [
    ['data/materialized/road-ltl-1.5-public-safe-projections.json.gz.b64', 'road-ltl@1.5'],
    ['data/materialized/ocean-0.6-public-safe-projections.json.gz.b64', 'ocean-fcl@0.6'],
  ]) {
    const bundle = gz(p);
    for (const proj of Object.values(bundle.sources[key])) {
      assert.equal(proj.projectionClass, 'PUBLIC_SAFE',
        `${key}: a projection is not marked PUBLIC_SAFE`);
      const pe = proj.protectedExecution || {};
      assert.notEqual(pe.workDecomposition?.detailIncluded, true,
        `${key}: work decomposition detail leaked into a public projection`);
      assert.notEqual(pe.workDefinition?.detailIncluded, true,
        `${key}: work definition detail leaked into a public projection`);
    }
  }
});

// =============================================================================
// 4. VERSION LABEL ACCURACY — VERIFY_NO_STALE_OR_FALSE_VERSION_LABELS
// =============================================================================
check('demo surfaces state version labels that match the catalog', () => {
  const journey = fs.readFileSync('atlas-poc-journey.html', 'utf8');
  assert.ok(journey.includes(`v${cat.baseModule.version}`),
    `journey page must state the real base module version v${cat.baseModule.version}`);
  for (const m of cat.modules) {
    assert.ok(journey.includes(`${m.id} v${m.version}`),
      `journey page must state ${m.id} at its real catalog version v${m.version}`);
  }
});

check('no demo surface claims a Road LTL version the branch does not carry', () => {
  const journey = fs.readFileSync('atlas-poc-journey.html', 'utf8');
  // 1.4 is not a demo-branch surface version; it must not be presented as one.
  assert.ok(!/road-ltl v1\.4/i.test(journey), 'journey page claims road-ltl v1.4, which is not registered');
});

// =============================================================================
// 5. FALSE-CROSS-LINEAGE REGRESSION — required by the lineage correction doc.
// =============================================================================
const mk = J('data/materialized/road-ltl-v2.3-malkom-reference-projection.json');

check('Malkom artifact still declares the V1.2 reference lineage', () => {
  assert.equal(mk.lineage.sourceModel, 'Road LTL V1.2');
  assert.equal(mk.classification, 'DEMO_REFERENCE_PROJECTION_NOT_CANONICAL_TRUTH');
  for (const d of ['Road LTL 1.5', 'P6.1 recursive work decomposition',
    'P6.2 canonical WorkDefinition compiler']) {
    assert.ok(mk.lineage.notGeneratedFrom.includes(d), `disclaimer must name: ${d}`);
  }
});

check('no shipped surface claims the governed lineage produced Malkom output', () => {
  const surfaces = ['atlas-poc-journey.html', 'atlas-execution-readiness.html']
    .filter(f => fs.existsSync(f));
  for (const p of surfaces) {
    const src = fs.readFileSync(p, 'utf8').replace(/\s+/g, ' ');
    // A surface mentioning both 1.5 and Malkom must also carry an explicit disclaimer.
    if (/1\.5/.test(src) && /Malkom/i.test(src)) {
      assert.ok(/not[^.]{0,40}generated from|not<\/strong> generated from|NOT[^.]{0,40}from Road LTL 1\.5/i.test(src),
        `${p} mentions both Road LTL 1.5 and Malkom without an explicit non-generation disclaimer`);
    }
  }
});

check('the 185 EXECUTOR_READY leaves are never presented as persisted WorkDefinitions', () => {
  for (const p of ['atlas-poc-journey.html', 'atlas-execution-readiness.html'].filter(f => fs.existsSync(f))) {
    const src = fs.readFileSync(p, 'utf8').replace(/\s+/g, ' ');
    assert.ok(!/185[^.]{0,60}persisted/i.test(src), `${p} implies the 185 leaves are persisted`);
    assert.ok(!/185 (?:canonical )?WorkDefinitions\b/i.test(src),
      `${p} presents the 185 leaves as WorkDefinitions`);
  }
});

// =============================================================================
// 6. NAVIGATION / LINK INTEGRITY across all demo surfaces.
// =============================================================================
check('every relative link on demo surfaces resolves to a real file', () => {
  const surfaces = ['atlas-poc-journey.html', 'atlas-execution-readiness.html', 'daughter.html']
    .filter(f => fs.existsSync(f));
  for (const p of surfaces) {
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/href="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|#|\/)/.test(href)) continue;
      const target = path.join(path.dirname(p), href.split('#')[0].split('?')[0]);
      assert.ok(fs.existsSync(target), `${p} links to a missing file: ${href}`);
    }
  }
});

check('demo surfaces carry their non-production disclaimer', () => {
  for (const p of ['atlas-poc-journey.html', 'atlas-execution-readiness.html'].filter(f => fs.existsSync(f))) {
    assert.match(fs.readFileSync(p, 'utf8'), /not a production promotion/i,
      `${p} must carry the demo-candidate disclaimer`);
  }
});

// =============================================================================
// 7. NO_DEPLOYMENT_PARITY_REQUIREMENT — assert this suite does not require a deployment.
// =============================================================================
check('certification requires no live deployment and performs no network call', () => {
  // Inspect the imports and calls this suite actually makes, not string literals it mentions.
  const self = fs.readFileSync('tests/d2-0-6-full-state-certification.mjs', 'utf8');
  const imports = [...self.matchAll(/^import .*?from '([^']+)';/gm)].map(m => m[1]);
  for (const mod of imports) {
    assert.ok(mod.startsWith('node:'),
      `this suite may only import node builtins, found: ${mod}`);
  }
  assert.ok(!/\bawait fetch\(|\bfetch\(`|\bfetch\('/.test(self),
    'this suite must make no network call');
  assert.ok(!/https?:\/\/[a-z]/.test(self.replace(/\/\/.*$/gm, '')),
    'this suite must reference no remote URL outside comments');
});

// =============================================================================
// REPORT
// =============================================================================
const failed = results.filter(([ok]) => !ok);
console.log('D2.0.6 FULL-STATE CERTIFICATION');
console.log(`  branch files inventoried: ${ALL.length}`);
for (const [ok, name] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'} · ${name}`);
console.log(`  ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error(`\n${failed.length} check(s) FAILED`);
  process.exit(1);
}
console.log('  D2.0.6 full-state certification PASS');
