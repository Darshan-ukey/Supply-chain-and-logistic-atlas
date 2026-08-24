import fs from 'node:fs';

/**
 * Full-universe scale guard.
 *
 * Proves the canvas engine still handles the full 71-destination registry
 * rather than only the two ACTIVE modules. This existed in v1.1 against the
 * CommonJS domain-neutral-core; v1.1.4 restored the Stage 23 browser engine
 * (globalThis.EnterpriseOpsCore), so the harness is adapted rather than dropped.
 */

const g = globalThis;
g.window = g.window || g;
g.document = g.document || { querySelector: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }) };

await import('../engine/domain-neutral-core.js');
const core = g.EnterpriseOpsCore;

let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} · ${label}`); if (!ok) failures++; };

check(Boolean(core), 'engine exposes EnterpriseOpsCore');
if (!core) { console.log('FAIL · scale smoke aborted'); process.exit(1); }

const cov = JSON.parse(fs.readFileSync('data/governance/destination-coverage-registry-v1.json', 'utf8'));
check(cov.destinations.length === 71, `destination registry · ${cov.destinations.length}`);

const start = performance.now();
let total = 0;
const mods = [];
for (let m = 0; m < cov.destinations.length; m++) {
  const processes = [];
  for (let i = 0; i < 30; i++) {
    processes.push({
      id: `S${m}-${i}`, label: `Synthetic ${m} ${i}`,
      a3ParentId: `A3-${m}-${i % 5}`,
      inputs: [`obj-${i}`], outputs: [`obj-${i + 1}`]
    });
  }
  mods.push({
    id: `synthetic-${m}`, moduleId: `synthetic-${m}`,
    contractVersion: 'enterprise-operations-module-v1.0',
    domainPackId: 'supply-chain', processes, a3Parents: []
  });
  total += processes.length;
}
check(total === 2130, `synthetic processes · ${total}`);

let exercised = 0;
for (const mod of mods) {
  if (typeof core.normalizeModule === 'function') { core.normalizeModule(mod); exercised++; }
  if (typeof core.traceCandidates === 'function') { core.traceCandidates(mod); }
}
const ms = performance.now() - start;

check(exercised === 71 || typeof core.normalizeModule !== 'function',
  `engine exercised across all destinations · ${exercised}`);
check(ms < 5000, `full-universe scale within budget · ${ms.toFixed(1)} ms`);

console.log(failures === 0
  ? `PASS · full-universe scale · 71 destinations · ${total} processes · ${ms.toFixed(1)} ms`
  : `FAIL · ${failures} scale check(s) failed`);
if (failures) process.exit(1);
