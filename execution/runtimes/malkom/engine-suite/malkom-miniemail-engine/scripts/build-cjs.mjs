/**
 * Emits the CommonJS half of the dual build.
 *
 * The packages are ESM-first, but a host may consume them from a CommonJS
 * context (Next.js server bundles, jest's default transform, ts-node CJS).
 * Without a `require` condition those hosts fail hard — TS1479 at build time,
 * ERR_PACKAGE_PATH_NOT_EXPORTED at runtime — so the same sources are also
 * emitted to `dist/cjs`, marked as CommonJS with a nested package.json.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packages = ['core', 'react'];

for (const name of packages) {
  const packageDir = join(repoRoot, 'packages', name);
  execFileSync(
    process.execPath,
    [
      join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'),
      '-p',
      join(packageDir, 'tsconfig.cjs.json')
    ],
    { stdio: 'inherit' }
  );

  const cjsDir = join(packageDir, 'dist', 'cjs');
  mkdirSync(cjsDir, { recursive: true });
  writeFileSync(
    join(cjsDir, 'package.json'),
    `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
    'utf8'
  );
  console.log(`cjs build ready: packages/${name}/dist/cjs`);
}
