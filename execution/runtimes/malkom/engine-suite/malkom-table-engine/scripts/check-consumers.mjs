/**
 * Proves the built packages are consumable the way real hosts consume them.
 *
 * Three checks, each in a throwaway workspace under the repo (so the npm
 * workspace links for @malkom/* resolve exactly as they would for an
 * installed dependency):
 *
 *   1. ESM runtime   — `import` from a "type": "module" package
 *   2. CJS runtime   — `require` from a "type": "commonjs" package
 *   3. Types         — tsc --noEmit with module/moduleResolution node16,
 *                      the resolution mode most host apps and Next.js use
 *
 * Run after `npm run build`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workDir = join(repoRoot, '.consumer-check');
const tscPath = join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');

const write = (relativePath, contents) => {
  const target = join(workDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
};

const failures = [];
const check = (name, run) => {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    const detail = String(error.stdout ?? error.message ?? error).trim();
    console.log(`  FAIL ${name}\n${detail.split('\n').slice(0, 12).join('\n')}`);
  }
};

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

console.log('consumer checks:');

// 1. ESM runtime
write('esm/package.json', JSON.stringify({ type: 'module' }));
write(
  'esm/index.mjs',
  `import { MalkomTableEngine, compileCondition, serializeCsv } from '@malkom/table-core';
if (typeof MalkomTableEngine !== 'function') throw new Error('MalkomTableEngine missing');
if (typeof compileCondition !== 'function') throw new Error('compileCondition missing');
if (typeof serializeCsv !== 'function') throw new Error('serializeCsv missing');
`
);
check('esm require of @malkom/table-core', () =>
  execFileSync(process.execPath, [join(workDir, 'esm', 'index.mjs')], {
    encoding: 'utf8'
  })
);

// 2. CJS runtime
write('cjs/package.json', JSON.stringify({ type: 'commonjs' }));
write(
  'cjs/index.cjs',
  `const core = require('@malkom/table-core');
if (typeof core.MalkomTableEngine !== 'function') throw new Error('MalkomTableEngine missing');
if (typeof core.compileCondition !== 'function') throw new Error('compileCondition missing');
`
);
check('commonjs require of @malkom/table-core', () =>
  execFileSync(process.execPath, [join(workDir, 'cjs', 'index.cjs')], {
    encoding: 'utf8'
  })
);

// 3. Types under node16 resolution
write(
  'types/tsconfig.json',
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'node16',
        moduleResolution: 'node16',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: []
      },
      files: ['consumer.ts']
    },
    null,
    2
  )
);
write(
  'types/consumer.ts',
  `import { MalkomTableEngine } from '@malkom/table-core';
import type { MalkomTableConfig, RowData } from '@malkom/table-core';

interface Row extends RowData {
  id: string;
}

const config: MalkomTableConfig<Row> = {
  title: 'Consumer',
  index: 'id',
  columns: [{ field: 'id', header: 'ID' }]
};

export function mount(host: HTMLElement): MalkomTableEngine<Row> {
  return new MalkomTableEngine<Row>(host, config);
}
`
);
check('type-check under module/moduleResolution node16', () =>
  execFileSync(process.execPath, [tscPath, '-p', join(workDir, 'types', 'tsconfig.json')], {
    encoding: 'utf8'
  })
);

rmSync(workDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n${failures.length} consumer check(s) failed`);
  process.exit(1);
}
console.log('all consumer checks passed');
