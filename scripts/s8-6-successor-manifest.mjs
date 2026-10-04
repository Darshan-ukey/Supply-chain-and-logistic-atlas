#!/usr/bin/env node
// S8-6 successor RC manifest generator/verifier CLI.
//   --write      regenerate and write the successor manifest (refuses if any lineage entry is not MATCH / any exclusion present / baseline fails)
//   --check      verify the committed manifest equals deterministic regeneration and all controls hold (default)
//   --reproduce  additionally reproduce the protected derivative identities from the committed CUSTODY copy (hashes only; no divergent-commit read)
// Never writes protected bytes. Does not promote, deploy, or certify runtime readiness.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SUCCESSOR_MANIFEST_PATH, generateSuccessorManifest, verifySuccessorManifest, reproduceFromCustody, serialize} from '../lib/release/s8-6-successor-manifest.js';
import {canonicalHash} from '../lib/compile/workdefinition-compiler.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const target = path.join(root, SUCCESSOR_MANIFEST_PATH);

if (args.has('--write')) {
  const manifest = await generateSuccessorManifest(root, {canonicalHash});
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, serialize(manifest));
  console.log(`WROTE ${SUCCESSOR_MANIFEST_PATH}`);
}
const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
const reproduce = args.has('--reproduce') ? await reproduceFromCustody(root) : null;
const result = await verifySuccessorManifest(manifest, {root, canonicalHash, reproduce});
console.log(JSON.stringify({manifest: SUCCESSOR_MANIFEST_PATH, ok: result.ok, entries: manifest.lineage.length, failures: result.failures, reproduced: Boolean(reproduce)}, null, 2));
process.exit(result.ok ? 0 : 1);
