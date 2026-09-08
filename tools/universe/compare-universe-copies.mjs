import fs from 'node:fs';
import { buildPayload, canonicalHash, sha256, EXTRACTOR_VERSION } from './extract-universe-semantics.mjs';

// R0.1A — deterministic comparison of retained Universe HTML copies.
//
// SCOPE BOUNDARY: this tool records observations only. It does not decide whether a
// difference is semantic, presentation, build-state or noise, and it does not decide
// which copy is authoritative. Both determinations belong to R0.1B.
//
// Usage: node tools/universe/compare-universe-copies.mjs <a.html> <b.html> [...] [--out report.json]

export function compareCopies(paths) {
  const copies = paths.map(p => {
    const html = fs.readFileSync(p, 'utf8');
    const { payload, result } = buildPayload({ sourcePath: p, html, releaseShellVersion: '7.3' });
    return {
      path: p,
      sourceSha256: sha256(Buffer.from(html, 'utf8')),
      embeddedSemanticIdentity: payload.lineage.embeddedSemanticIdentity,
      structureCount: Object.keys(payload.structures).length,
      recordCount: result.inventory.reduce((n, x) => n + x.records, 0),
      unresolved: result.extraction.unresolved,
      semanticPayloadHash: canonicalHash(payload.structures),
      structures: payload.structures
    };
  });

  const names = [...new Set(copies.flatMap(c => Object.keys(c.structures)))].sort();
  const differingStructures = [];
  for (const name of names) {
    const perCopy = copies.map(c => ({ path: c.path, valueHash: canonicalHash(c.structures[name] ?? null) }));
    if (new Set(perCopy.map(x => x.valueHash)).size > 1) {
      // Deliberately unclassified. R0.1A observes; R0.1B interprets.
      differingStructures.push({ name, differenceClassification: 'PENDING_R0_1B', perCopyValueHashes: perCopy });
    }
  }
  const identical = names.filter(n => !differingStructures.some(d => d.name === n));

  return {
    schemaVersion: 'atlas-universe-copy-comparison-v2',
    stageId: 'R0.1A',
    extractorVersion: EXTRACTOR_VERSION,
    classification: 'RAW_OBSERVATION_NO_INTERPRETATION',
    copies: copies.map(({ structures, ...rest }) => rest),
    distinctSourceHashes: [...new Set(copies.map(c => c.sourceSha256))].length,
    distinctSemanticPayloadHashes: [...new Set(copies.map(c => c.semanticPayloadHash))].length,
    structureCountPerCopy: [...new Set(copies.map(c => c.structureCount))],
    identicalStructureCount: identical.length,
    differingStructureCount: differingStructures.length,
    differingStructures,
    differenceClassification: 'PENDING_R0_1B',
    authorityDetermination: 'NOT_DETERMINED_PENDING_R0_1B',
    note: 'Differences are recorded as observed facts. Whether they are semantic, presentation, build-state or non-semantic noise is determined in R0.1B, as is source authority.'
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
    console.log(c.path);
    console.log(`  source sha256    : ${c.sourceSha256}`);
    console.log(`  structures       : ${c.structureCount}  records: ${c.recordCount}  unresolved: ${c.unresolved.length}`);
    console.log(`  semantic payload : ${c.semanticPayloadHash}`);
  }
  console.log(`\ndistinct source hashes           : ${report.distinctSourceHashes}`);
  console.log(`distinct semantic payload hashes : ${report.distinctSemanticPayloadHashes}`);
  console.log(`identical structures             : ${report.identicalStructureCount}`);
  console.log(`differing structures             : ${report.differingStructureCount} -> ${report.differingStructures.map(d => d.name).join(', ') || 'none'}`);
  console.log(`difference classification        : ${report.differenceClassification}`);
  console.log(`authority                        : ${report.authorityDetermination}`);
  if (out) { fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`); console.log(`written                          : ${out}`); }
}
