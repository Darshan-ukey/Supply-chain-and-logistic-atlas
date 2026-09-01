/**
 * MetricsStateStore contract tests, run against BOTH shipped implementations.
 * Focused cases adapted from the flows the rules engine's lifecycle/router
 * suites exercise through their stores: kv compare-and-set (the version
 * counter / leadership primitive) and registry versioning with content-hash
 * idempotent re-apply.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { registryDocSchema, type RegistryDoc } from '../src/config/schemas.js';
import { registryHash } from '../src/domain/registry.js';
import type { MetricsStateStore, RegistryRecord } from '../src/ports/statestore.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';
import { SqliteMetricsStateStore } from '../src/state/sqlite.js';

const DOC_V1: RegistryDoc = registryDocSchema.parse({
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
        { id: 'teu', type: 'number' },
      ],
    },
  ],
  valueSets: [{ id: 'ports', values: ['USLAX', 'CNNGB'] }],
});

const DOC_V2: RegistryDoc = registryDocSchema.parse({
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped'] },
        { id: 'teu', type: 'number' },
      ],
    },
  ],
  valueSets: [{ id: 'ports', values: ['USLAX', 'CNNGB'] }],
});

function record(doc: RegistryDoc, version: number): RegistryRecord {
  return { version, hash: registryHash(doc), doc, createdAt: new Date(1_755_000_000_000 + version).toISOString() };
}

/**
 * The engine's applyRegistry flow at store level: identical content (same
 * hash as the stored head) is a no-op — no version churn; new content gets
 * the next version.
 */
async function applyLikeEngine(store: MetricsStateStore, doc: RegistryDoc): Promise<{ version: number; hash: string }> {
  const hash = registryHash(doc);
  const current = await store.getRegistry();
  if (current && current.hash === hash) return { version: current.version, hash };
  const version = (current?.version ?? 0) + 1;
  await store.putRegistry(record(doc, version));
  return { version, hash };
}

const IMPLS: Array<[string, () => MetricsStateStore]> = [
  ['InMemoryMetricsStateStore', () => new InMemoryMetricsStateStore()],
  ['SqliteMetricsStateStore (:memory:)', () => new SqliteMetricsStateStore(':memory:')],
];

describe.each(IMPLS)('%s', (_name, make) => {
  let store: MetricsStateStore;

  async function open(): Promise<MetricsStateStore> {
    store = make();
    await store.init();
    return store;
  }

  afterEach(async () => {
    await store.close();
  });

  describe('kv', () => {
    it('get/set/delete round-trip; missing keys are null', async () => {
      const s = await open();
      expect(await s.get('k')).toBeNull();
      await s.set('k', 'v1');
      expect(await s.get('k')).toBe('v1');
      await s.set('k', 'v2'); // overwrite
      expect(await s.get('k')).toBe('v2');
      await s.delete('k');
      expect(await s.get('k')).toBeNull();
      await s.delete('k'); // deleting a missing key is a no-op
    });

    it('compareAndSet creates only when expect is null', async () => {
      const s = await open();
      expect(await s.compareAndSet('lock', null, 'a')).toBe(true);
      expect(await s.get('lock')).toBe('a');
      // A second create-if-absent loses.
      expect(await s.compareAndSet('lock', null, 'b')).toBe(false);
      expect(await s.get('lock')).toBe('a');
    });

    it('compareAndSet swaps only on the expected current value', async () => {
      const s = await open();
      await s.set('counter', '1');
      expect(await s.compareAndSet('counter', '0', '2')).toBe(false); // stale expectation
      expect(await s.get('counter')).toBe('1');
      expect(await s.compareAndSet('counter', '1', '2')).toBe(true);
      expect(await s.get('counter')).toBe('2');
    });

    it('drives a CAS-retry version counter to a consistent end state', async () => {
      const s = await open();
      const bump = async (): Promise<number> => {
        for (;;) {
          const cur = await s.get('version');
          const next = (cur === null ? 0 : Number(cur)) + 1;
          if (await s.compareAndSet('version', cur, String(next))) return next;
        }
      };
      const results = await Promise.all([bump(), bump(), bump(), bump(), bump()]);
      expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      expect(await s.get('version')).toBe('5');
    });
  });

  describe('registry versioning', () => {
    it('returns null before any registry is stored', async () => {
      const s = await open();
      expect(await s.getRegistry()).toBeNull();
      expect(await s.getRegistry(1)).toBeNull();
    });

    it('stores versions and serves latest by default, any version explicitly', async () => {
      const s = await open();
      await s.putRegistry(record(DOC_V1, 1));
      await s.putRegistry(record(DOC_V2, 2));

      const latest = await s.getRegistry();
      expect(latest?.version).toBe(2);
      expect(latest?.hash).toBe(registryHash(DOC_V2));
      expect(latest?.doc).toEqual(DOC_V2);

      const first = await s.getRegistry(1);
      expect(first?.version).toBe(1);
      expect(first?.doc).toEqual(DOC_V1);
    });

    it('re-applying identical content is idempotent — same hash, no version churn', async () => {
      const s = await open();
      const a = await applyLikeEngine(s, DOC_V1);
      expect(a).toEqual({ version: 1, hash: registryHash(DOC_V1) });

      // Same content again (e.g. the same boot file on every restart).
      const b = await applyLikeEngine(s, structuredClone(DOC_V1));
      expect(b).toEqual(a);
      expect((await s.getRegistry())?.version).toBe(1);

      // Changed content bumps the version.
      const c = await applyLikeEngine(s, DOC_V2);
      expect(c.version).toBe(2);
      expect(c.hash).not.toBe(a.hash);
      expect((await s.getRegistry())?.version).toBe(2);
      // History is preserved.
      expect((await s.getRegistry(1))?.hash).toBe(a.hash);
    });

    it('re-putting the same version replaces the record (last write wins)', async () => {
      const s = await open();
      await s.putRegistry(record(DOC_V1, 1));
      await s.putRegistry(record(DOC_V2, 1));
      const got = await s.getRegistry(1);
      expect(got?.hash).toBe(registryHash(DOC_V2));
      expect(got?.doc).toEqual(DOC_V2);
    });

    it('stored records are isolated from caller mutation', async () => {
      const s = await open();
      // Fresh copy: mutating the shared fixture would leak across impls.
      const rec = record(structuredClone(DOC_V1), 1);
      await s.putRegistry(rec);
      rec.doc.entities[0]!.id = 'mutated';
      const got = await s.getRegistry(1);
      expect(got?.doc.entities[0]?.id).toBe('booking');
      // And the way out: mutating a returned record must not poison the store.
      got!.doc.entities[0]!.id = 'poisoned';
      expect((await s.getRegistry(1))?.doc.entities[0]?.id).toBe('booking');
    });
  });
});

describe('SqliteMetricsStateStore persistence', () => {
  it('persists registry and kv across reopen on the same file', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'malkom-metrics-'));
    const file = join(dir, 'state.db');
    try {
      const a = new SqliteMetricsStateStore(file);
      await a.init();
      await a.putRegistry({ version: 1, hash: registryHash(DOC_V1), doc: DOC_V1, createdAt: new Date().toISOString() });
      await a.set('k', 'v');
      await a.close();

      const b = new SqliteMetricsStateStore(file);
      await b.init(); // idempotent DDL on an existing file
      expect((await b.getRegistry())?.hash).toBe(registryHash(DOC_V1));
      expect(await b.get('k')).toBe('v');
      await b.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
