import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASELINE_PATH, ROLLBACK_MANIFEST_PATH, DRIFT_RECON_PATH, baselinePaths, buildBaseline, buildDriftReconciliation, buildRollbackManifest, verifyBaseline, serialize} from '../../lib/release/s8-6-release-control.js';

// S8-6 release-control assembly (deterministic): drift reconciliation record -> regenerated baseline -> rollback manifest. Refuses on unexplained drift.
// Usage: node release/scripts/s8-6-assemble-release-control.mjs [--write]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const write = process.argv.includes('--write');
const recon = buildDriftReconciliation(root);
if (!recon.summary.allReconciled) { console.error(JSON.stringify({ok: false, code: 'INTEGRITY_UNEXPLAINED_DRIFT', unexplained: recon.summary.unexplainedPaths})); process.exit(1); }
const baseline = buildBaseline(root, baselinePaths(root));
const rollback = buildRollbackManifest(root);
const outputs = [[DRIFT_RECON_PATH, recon], [BASELINE_PATH, baseline], [ROLLBACK_MANIFEST_PATH, rollback]];
for (const [p, v] of outputs) {
  const f = path.join(root, p);
  if (write) { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, serialize(v)); }
  else if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== serialize(v)) { console.error(JSON.stringify({ok: false, code: 'RELEASE_CONTROL_DRIFT', path: p})); process.exit(1); }
}
const verdict = verifyBaseline(root);
console.log(JSON.stringify({ok: verdict.status === 'PASSES_VERIFICATION', mode: write ? 'WRITE' : 'CHECK', baseline: verdict, drift: recon.summary}, null, 2));
process.exit(verdict.status === 'PASSES_VERIFICATION' ? 0 : 1);
