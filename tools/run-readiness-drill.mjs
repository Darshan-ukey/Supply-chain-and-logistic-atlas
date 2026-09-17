import fs from 'node:fs';
import path from 'node:path';
import { resolveReadiness, attachRunContext, RESOLVER_IMPLEMENTATION_VERSION } from '../lib/readiness/readiness-resolver.mjs';

// PC-5 drill runner. Reads a frozen drill package, runs the resolver, emits the proof.
// Pure with respect to the evaluation: only the package and the pinned resolver identity
// determine the semantic result.

const PKG = process.argv[2];
const OUT = process.argv[3];
const RESOLVER_COMMIT = process.argv[4];

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const config = { ...pkg.resolver_config, resolver_commit: RESOLVER_COMMIT };

const result = resolveReadiness(pkg.manifest, config);
const withContext = attachRunContext(result, {
  evaluation_run_id: `${pkg.drill_id}:${process.argv[5] ?? 'run'}`,
  evaluation_timestamp: process.env.DRILL_FIXED_TIMESTAMP ?? new Date().toISOString()
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(withContext, null, 2) + '\n');

const byType = {};
for (const b of result.blockers) byType[b.blocker_type] = (byType[b.blocker_type] ?? 0) + 1;

console.log(`drill:                  ${pkg.drill_id}`);
console.log(`resolver:               v${RESOLVER_IMPLEMENTATION_VERSION} @ ${RESOLVER_COMMIT}`);
console.log(`state evaluated:        ${result.state_evaluated}`);
console.log(`RESULT:                 ${result.result}`);
console.log(`blockers:               ${result.blockers.length}`);
for (const [t, n] of Object.entries(byType).sort()) console.log(`   ${String(n).padStart(3)}  ${t}`);
console.log(`semantic_result_hash:   ${result.semantic_result_hash}`);
console.log(`proof_id:               ${result.proof_id}`);
