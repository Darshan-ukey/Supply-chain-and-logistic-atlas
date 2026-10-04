import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPackages} from '../../lib/release/s8-6-package-builder.js';

// S8-6 deterministic successor package build. Usage: node release/scripts/s8-6-build-packages.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
console.log(JSON.stringify({ok: true, ...buildPackages(root)}, null, 2));
