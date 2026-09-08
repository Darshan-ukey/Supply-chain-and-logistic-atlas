import fs from 'node:fs';
import { buildPayload, canonicalHash, sha256, EXTRACTOR_VERSION } from './extract-universe-semantics.mjs';

// R0.1A — deterministic comparison of retained Universe HTML copies.
//
// Establishes whether differing source hashes correspond to differing semantics.
// It records the result; it does NOT decide which copy is authoritative. Authority
// reconciliation is R0.1B.
//
// Usage: node tools/universe/compare-universe-copies.mjs <a.html> <b.html> [...] [--out report.json]

// Structures describing the release shell's navigation/presentation wiring rather than
// Universe semantics. Classified separately so a shell-only difference is not reported
// as a semantic difference. Membership is by declared structure name only.
export const SHELL_NAVIGATION_STRUCTURES = ['defaults', 'liveModuleRoutes', 'moduleCoverageStatus'];

export function compareCopies(paths) {
  const copies = paths.map(p => {
    const html = fs.readFileSync(p, 'utf8');
    const { payload, result } = buildPayload({ sourcePath: p, html, releaseShellVersion: '7.3' });
    const core = {}, shell = {};
    for (const [k, v] of Object.entries(payload.structures)) {
      (SHELL_NAVIGATION_STRUCTURES.includes(k) ? shell : core)[k] = v;
    }
    return {
      path: p,
      sourceSha256: sha256(Buffer.from(html, 'utf8')),
      embeddedSemanticIdentity: payload.lineage.embeddedSemanticIdentity,
      structureCount: Object.keys(payload.structures).length,
      recordCount: result.inventory.reduce((n, x) => n + x.records, 0),
      unresolved: result.extraction.unresolved,
      fullSemanticHash: canonicalHash(payload.structures),
      coreSemanticHash: canonicalHash(core),
      shellNavigationHash: canonicalHash(shell),
      structures: payload.structures
    };
  });

  const distinctSources = [...new Set(copies.map(c => c.sourceSha256))];
  const distinctCore = [...new Set(copies.map(c => c.coreSemanticHash))];
  const distinctFull = [...new Set(copies.map(c => c.fullSemanticHash))];

  const differingStructures = [];
  const names = [...new Set(copies.flatMap(c => Object.keys(c.structures)))].sort();
  for (const n of names) {
    const hashes = [...new Set(copies.map(c => canonicalHash(c.structures[n] ?? null)))];
    if (hashes.length > 1) {
      differingStructures.push({ name: n, classification: SHELL_NAVIGATION_STRUCTURES.includes(n) ? 'SHELL_NAVIGATION' : 'UNIVERSE_SEMANTIC' });
    }
  }

  const semanticDifference = distinctCore.length > 1;
  return {
    schemaVersion: 'atlas-universe-copy-comparison-v1',
    stageId: 'R0.1A',
    extractorVersion: EXTRACTOR_VERSION,
    copies: copies.map(({ structures, ...rest }) => rest),
    distinctSourceHashes: distinctSources.length,
    distinctCoreSemanticHashes: distinctCore.length,
    distinctFullSemanticHashes: distinctFull.length,
    differingStructures,
    result: semanticDifference
      ? 'UNIVERSE_SEMANTIC_DIFFERENCE_PRESENT'
      : (distinctFull.length > 1
        ? 'CORE_SEMANTICS_IDENTICAL_SHELL_NAVIGATION_DIFFERS'
        : 'FULLY_IDENTICAL'),
    authorityDetermination: 'NOT_DETERMINED_PENDING_R0_1B'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : null;
  const paths = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
  if (paths.length < 2) { console.error('Usage: compare-universe-copies.mjs <a.html> <b.html> [...] [--out report.json]'); process.exit(2); }

  const report = compareCopies(paths);
  for (const c of report.copies) {
    console.log(`${c.path}`);
    console.log(`  source sha256 : ${c.sourceSha256}`);
    console.log(`  structures    : ${c.structureCount}  records: ${c.recordCount}  unresolved: ${c.unresolved.length}`);
    console.log(`  core semantic : ${c.coreSemanticHash}`);
    console.log(`  shell nav     : ${c.shellNavigationHash}`);
  }
  console.log(`\ndistinct source hashes        : ${report.distinctSourceHashes}`);
  console.log(`distinct core semantic hashes : ${report.distinctCoreSemanticHashes}`);
  console.log(`differing structures          : ${report.differingStructures.map(d => `${d.name}[${d.classification}]`).join(', ') || 'none'}`);
  console.log(`RESULT                        : ${report.result}`);
  console.log(`authority                     : ${report.authorityDetermination}`);
  if (out) { fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`); console.log(`written                       : ${out}`); }
}
