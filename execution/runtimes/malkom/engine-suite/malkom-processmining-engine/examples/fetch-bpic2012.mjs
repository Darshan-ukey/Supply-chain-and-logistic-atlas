#!/usr/bin/env node
/**
 * Downloads BPI Challenge 2012 — the canonical public process mining benchmark
 * — and verifies its checksum.
 *
 * 262,200 events across 13,087 loan applications from a Dutch financial
 * institute. Published by 4TU.ResearchData under CC BY 4.0:
 *   https://doi.org/10.4121/uuid:3926db30-f712-4394-aebc-75976070e91f
 *
 * The log is NOT vendored into this repository — it is someone else's data,
 * and it belongs at its source. Run this to fetch a copy.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL_ =
  'https://data.4tu.nl/file/533f66a4-8911-4ac7-8612-1235d65d1f37/3276db7f-8bee-4f2b-88ee-92dbffb5a893';
const EXPECTED_MD5 = '74c7ba9aba85bfcb181a22c9d565e5b5';
const EXPECTED_BYTES = 3_342_406;

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'data');
const out = join(dir, 'BPI_Challenge_2012.xes.gz');

await mkdir(dir, { recursive: true });

try {
  const existing = await stat(out);
  if (existing.size === EXPECTED_BYTES) {
    console.log(`already present: ${out}`);
    process.exit(0);
  }
} catch {
  // not downloaded yet
}

console.log(`downloading BPI Challenge 2012 (${(EXPECTED_BYTES / 1024 / 1024).toFixed(1)} MB)…`);
const response = await fetch(URL_);
if (!response.ok) {
  console.error(`download failed: HTTP ${response.status} ${response.statusText}`);
  process.exit(1);
}
const buffer = Buffer.from(await response.arrayBuffer());

const md5 = createHash('md5').update(buffer).digest('hex');
if (md5 !== EXPECTED_MD5) {
  // Refuse rather than mine data that is not what it claims to be.
  console.error(`checksum mismatch: got ${md5}, expected ${EXPECTED_MD5}`);
  process.exit(1);
}

await writeFile(out, buffer);
console.log(`saved ${out} (md5 verified)`);
console.log('\nnow run:');
console.log('  node --max-old-space-size=8192 packages/cli/dist/bin.js import examples/data/BPI_Challenge_2012.xes.gz --store examples/data/bpic12.duckdb');
console.log('  node packages/cli/dist/bin.js discover --store examples/data/bpic12.duckdb --lifecycle complete --threshold 0.05');
