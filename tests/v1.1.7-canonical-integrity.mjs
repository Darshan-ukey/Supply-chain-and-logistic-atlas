import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Canonical integrity guard.
 *
 * The v1.1 Foundation invariant is that the frozen Page 0 source and the
 * integrated Page 0 + Road LTL source are never modified. v1.1.4 kept both
 * files intact but stopped asserting their hashes anywhere, so the invariant
 * was no longer enforced by anything runnable. This restores that anchor.
 *
 * The machine-readable JSON is deliberately checked semantically rather than
 * by byte hash: v1.1.4 merged the Stage 23 key shape (ontologyNodes,
 * availableContext, module, publication) back alongside the v1.1 shape
 * (entityNodes, contracts, roles...) so one file can serve both the restored
 * Stage 23 frontend and the Foundation backend. That is an additive superset,
 * not a content change - and this test proves it stays additive.
 */

const FROZEN = {
  'reference/legacy-v0.6.6/page0-v6.2.3.html':
    '45ea5ad55c6f0103bdb70ee33c05e2ca68587d98453a8c0c2c160e67d51e73c7',
  'reference/legacy-v0.6.6/road-ltl-v1.2.html':
    'a75ca386b0048af94aa8f8f9ea726dbe10f3c819c602d90daff4f90ddf942c92',
  'reference/legacy-v0.6.6/page0-v6.2.2-frozen.html':
    '47a111bd72f8524ee1c1f2d67b85d6958156c5f1026659e9769f1c6a28639002',
  'reference/legacy-v0.6.6/page0-road-ltl-v1.2-integrated-frozen.html':
    '70850a00baac10253d263e41465ab80fe3a0e4c269e6d06391e6a4f333af2747',
  'reference/source/page0-v6.2.2-frozen-original.html':
    '47a111bd72f8524ee1c1f2d67b85d6958156c5f1026659e9769f1c6a28639002',
  'reference/source/page0-road-ltl-v1.2-integrated-original.html':
    '70850a00baac10253d263e41465ab80fe3a0e4c269e6d06391e6a4f333af2747'
};


// Exact machine-readable canonical hashes inherited unchanged from certified v1.1.5.
// These guard release-to-release drift; frozen source HTML above remains the source anchor.
const CANONICAL_JSON = {
  'data/page0/page0-v6.2.2.json': 'c8805c194f87cd795014e4a44f362d67c921f5e0e978b9a29014befafc0fbbd0',
  'data/modules/road-ltl-v1.2.json': '2d5c78d4480bb693747bcb18a2c006b3fe0a63e6150c506e84ea3e4c5f3f6cfd'
};

// Semantic counts that must never move without a governed republication.
const COUNTS = {
  'data/modules/road-ltl-v1.2.json': {
    processes: 22, a3Parents: 13, processFlowEdges: 39,
    executionTransitions: 22, sources: 29, lenses: 27,
    childActors: 15, ontologyEdges: 176
  },
  'data/page0/page0-v6.2.2.json': { page0Domains: 15 }
};

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${label}`);
  if (!ok) failures++;
};

// 1. Frozen sources must be byte-identical to the original release.
for (const [path, expected] of Object.entries(FROZEN)) {
  if (!fs.existsSync(path)) {
    check(false, `frozen source present · ${path}`);
    continue;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  check(actual === expected, `frozen source hash · ${path.split('/').pop()} · ${actual.slice(0, 16)}`);
}

// 2. Machine-readable canonical data must remain byte-identical to the v1.1.5 certified donor.
for (const [path, expected] of Object.entries(CANONICAL_JSON)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  check(actual === expected, `canonical JSON hash · ${path.split('/').pop()} · ${actual.slice(0, 16)}`);
}

// 3. Canonical counts must hold.
const ltl = JSON.parse(fs.readFileSync('data/modules/road-ltl-v1.2.json', 'utf8'));
const p0 = JSON.parse(fs.readFileSync('data/page0/page0-v6.2.2.json', 'utf8'));

for (const [key, want] of Object.entries(COUNTS['data/modules/road-ltl-v1.2.json'])) {
  const got = Array.isArray(ltl[key]) ? ltl[key].length : undefined;
  check(got === want, `road-ltl ${key} · ${got}`);
}
const domains = Array.isArray(p0.domains) ? p0.domains.length
  : Array.isArray(p0.page0Domains) ? p0.page0Domains.length : undefined;
check(domains === 15, `page0 domains · ${domains}`);

// 4. Stage 23 and v1.1 node shapes must agree where both are present.
if (ltl.ontologyNodes && ltl.entityNodes) {
  check(
    JSON.stringify(ltl.ontologyNodes) === JSON.stringify(ltl.entityNodes),
    `dual-shape node parity · ontologyNodes === entityNodes · ${ltl.entityNodes.length}`
  );
} else {
  check(
    Array.isArray(ltl.entityNodes || ltl.ontologyNodes),
    'node collection present'
  );
}

// 5. The dual shape must stay additive - no alias may contradict its counterpart.
const ALIASES = [['ontologyNodes', 'entityNodes']];
for (const [a, b] of ALIASES) {
  if (ltl[a] && ltl[b]) {
    check(ltl[a].length === ltl[b].length, `alias length parity · ${a}/${b}`);
  }
}

console.log(
  failures === 0
    ? 'PASS · v1.1.7 canonical/reference integrity · frozen + V6.2.3/Road LTL legacy donors anchored, counts held, dual shape additive'
    : `FAIL · ${failures} canonical integrity check(s) failed`
);
if (failures) process.exit(1);
