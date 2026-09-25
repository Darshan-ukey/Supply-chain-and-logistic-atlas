import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import semver from 'semver';
import { describe, expect, it } from 'vitest';

/**
 * The manifest is part of the product.
 *
 * Everything else in this suite checks what the engine computes. This file
 * checks that a stranger can install it, because a dependency range that cannot
 * be satisfied does not fail in our CI — it fails on the machine of somebody
 * who has never seen this repository, with an error that names a package they
 * did not ask for.
 *
 * The bug that prompted it: `@duckdb/node-api` has published fifty-seven
 * versions and every one carries a prerelease tag (`1.5.5-r.4`). Under semver,
 * a prerelease version satisfies a range only when some comparator in it shares
 * that version's exact major.minor.patch AND itself carries a prerelease — so
 * `>=1.3.0` matches none of them, and neither does `*`. The declared peer range
 * was therefore unsatisfiable by construction, and `npm install` ended in
 * ETARGET before a single line of engine code ran.
 */

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

const core = readJson(join(here, '..', 'package.json'));
const root = readJson(join(here, '..', '..', '..', 'package.json'));

const peers = (core['peerDependencies'] ?? {}) as Record<string, string>;
const peerMeta = (core['peerDependenciesMeta'] ?? {}) as Record<string, { optional?: boolean }>;
const devDeps = (root['devDependencies'] ?? {}) as Record<string, string>;

describe('every declared range can actually be resolved', () => {
  it.each(Object.entries(peers))('peer range for %s is valid semver', (_name, range) => {
    expect(semver.validRange(range), `"${range}" is not a semver range`).not.toBeNull();
  });

  /**
   * The invariant that would have caught the original bug on the day it was
   * written: we cannot ask a host for a version we ourselves do not run.
   *
   * It is also the cheapest possible check — no network, no install, no
   * registry — because it compares a range against the version this repository
   * develops and tests against.
   */
  it.each(Object.entries(peers))(
    'peer range for %s admits the version we develop against',
    (name, range) => {
      const declared = devDeps[name];
      expect(declared, `${name} is a peer but nothing here pins a version to test with`).toBeDefined();

      const lowest = semver.minVersion(declared ?? '');
      expect(lowest, `could not read a concrete version out of "${declared}"`).not.toBeNull();
      expect(
        semver.satisfies(lowest!.version, range),
        `peer range "${range}" excludes ${lowest?.version}, the version this repo installs. ` +
          'A host following the manifest would install something we never run — or, when the ' +
          'range matches nothing published at all, would not get past npm install.',
      ).toBe(true);
    },
  );

  it('marks every optional peer optional, so a host that skips one still installs', () => {
    for (const name of Object.keys(peers)) {
      expect(peerMeta[name]?.optional, `${name} is a peer but not marked optional`).toBe(true);
    }
  });
});

describe('drivers loaded at runtime rather than declared as peers', () => {
  /**
   * `@duckdb/node-api` is deliberately NOT a peer. See the file header: no
   * forward-compatible range exists for a package that only ships prereleases,
   * so any value we wrote would be wrong at the next upstream release.
   *
   * Nothing is lost by dropping it. The requirement is enforced where it can be
   * enforced exactly — `createDuckDBClient` imports the driver at first use and
   * checks for the API it needs — and a capability check is a better test than
   * a version string, because it verifies the thing the engine actually calls.
   */
  it('does not declare a peer range for @duckdb/node-api', () => {
    expect(peers['@duckdb/node-api']).toBeUndefined();
    expect(peerMeta['@duckdb/node-api']).toBeUndefined();
  });

  it('still pins a DuckDB version to develop and test against', () => {
    expect(devDeps['@duckdb/node-api']).toBeDefined();
  });
});

describe('what a consumer receives', () => {
  it('publishes only built output', () => {
    expect(core['files']).toEqual(['dist']);
  });

  it('points every entry point at a file that the build produces', () => {
    const exports = core['exports'] as Record<string, Record<string, string>>;
    for (const [entry, conditions] of Object.entries(exports)) {
      for (const [condition, target] of Object.entries(conditions)) {
        expect(target.startsWith('./dist/'), `${entry} ${condition} -> ${target}`).toBe(true);
      }
    }
  });

  it('ships as ESM, which is what the source is', () => {
    expect(core['type']).toBe('module');
  });
});
