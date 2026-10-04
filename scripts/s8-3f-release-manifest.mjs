#!/usr/bin/env node
// S8-3F deterministic release-manifest generator/verifier CLI.
//   --write      regenerate and write the manifest (refuses if any lineage entry is not MATCH)
//   --check      verify the committed manifest equals deterministic regeneration and all controls hold (default)
//   --reproduce  additionally reproduce the protected derivative identities from the governed lineage (hashes only)
// Never writes protected bytes. Does not promote, deploy, or certify release/rollback/runtime readiness.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MANIFEST_PATH, generateManifest, serialize, verifyManifest, reproduceProtectedIdentities} from '../lib/release/s8-release-manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const target = path.join(root, MANIFEST_PATH);

if (args.has('--write')) {
  const manifest = generateManifest(root);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, serialize(manifest));
  console.log(`WROTE ${MANIFEST_PATH}`);
}
const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
const reproduce = args.has('--reproduce') ? await reproduceProtectedIdentities(root) : null;
const result = verifyManifest(manifest, {root, reproduce});
console.log(JSON.stringify({manifest: MANIFEST_PATH, ok: result.ok, entries: manifest.lineage.length, failures: result.failures, reproduced: Boolean(reproduce)}, null, 2));
process.exit(result.ok ? 0 : 1);
