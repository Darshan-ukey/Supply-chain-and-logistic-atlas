/**
 * package.json resolution hygiene (review wave 2): these are ESM-only
 * packages, and the `exports` map is the single resolution surface. A
 * top-level `main`/`types` pair ADVERTISES classic resolution that the
 * `exports` map then shadows (`require()` → ERR_PACKAGE_PATH_NOT_EXPORTED) —
 * the exact class of bug that broke a host once. Pins:
 *  - no top-level `main` or `types` anywhere;
 *  - core/server expose `.` with `types` + `import` (+ `default`, so a
 *    require(esm)-capable Node can load them and an older one gets the CLEAR
 *    ERR_REQUIRE_ESM, never a confusing path error);
 *  - the CLI exposes only its bin;
 *  - every package.json is BOM-free (the BOM class of bug that broke a host).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

interface PackageJson {
  name: string;
  type?: string;
  main?: string;
  types?: string;
  bin?: Record<string, string>;
  exports?: Record<string, Record<string, string>>;
}

function readPackage(rel: string): { raw: string; pkg: PackageJson } {
  const raw = readFileSync(join(ROOT, rel, 'package.json'), 'utf8');
  return { raw, pkg: JSON.parse(raw) as PackageJson };
}

const PACKAGES = ['packages/core', 'packages/server', 'packages/cli'] as const;

describe('package.json exports hygiene', () => {
  it('no package advertises classic main/types resolution the exports map would shadow', () => {
    for (const rel of PACKAGES) {
      const { pkg } = readPackage(rel);
      expect(pkg.main, `${pkg.name} must not declare top-level main`).toBeUndefined();
      expect(pkg.types, `${pkg.name} must not declare top-level types (exports carries the types condition)`).toBeUndefined();
      expect(pkg.type, pkg.name).toBe('module');
    }
  });

  it('core and server resolve ".": types first, then import, with a default for require(esm) hosts', () => {
    for (const rel of ['packages/core', 'packages/server'] as const) {
      const { pkg } = readPackage(rel);
      const root = pkg.exports?.['.'];
      expect(root, `${pkg.name} must export "."`).toBeDefined();
      // Condition ORDER matters to resolvers: types must come first.
      expect(Object.keys(root!)).toEqual(['types', 'import', 'default']);
      expect(root!['types']).toBe('./dist/index.d.ts');
      expect(root!['import']).toBe('./dist/index.js');
      expect(root!['default']).toBe('./dist/index.js');
    }
  });

  it('the CLI exposes only its bin — no importable surface', () => {
    const { pkg } = readPackage('packages/cli');
    expect(pkg.exports).toBeUndefined();
    expect(pkg.bin).toEqual({ 'malkom-metrics': './dist/bin.js' });
  });

  it('every package.json (and the root) is BOM-free', () => {
    for (const rel of ['.', ...PACKAGES]) {
      const raw = readFileSync(join(ROOT, rel, 'package.json'), 'utf8');
      expect(raw.charCodeAt(0), `${rel}/package.json must not start with a BOM`).not.toBe(0xfeff);
      expect(raw[0], `${rel}/package.json must start with '{'`).toBe('{');
    }
  });
});
