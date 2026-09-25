/**
 * MemoryFactSource — the reference FactSourcePort: projection to exactly the
 * requested fields, scalarEquals scope semantics, half-open [start, end)
 * anchor ranges (null/unparseable anchors belong to no window), the row cap,
 * and both construction forms (one shared array vs rows-by-entity).
 */
import { describe, expect, it } from 'vitest';
import { MemoryFactSource, type FactQuery } from '../src/ports/factsource.js';

const ROWS = [
  { id: 'r1', region: 'APAC', status: 'confirmed', confirmedAt: '2026-08-10T06:30:00Z', teu: 4 },
  { id: 'r2', region: 'APAC', status: 'new', confirmedAt: null, teu: 2 },
  { id: 'r3', region: 'EMEA', status: 'confirmed', confirmedAt: '2026-08-12T04:30:00Z', teu: 8 },
  { id: 'r4', region: 'APAC', status: 'confirmed', confirmedAt: 'not-a-time', teu: 1 },
  { id: 'r5', region: null, status: 'confirmed', confirmedAt: '2026-08-16T18:30:00Z', teu: 3 },
];

function q(patch: Partial<FactQuery>): FactQuery {
  return { entity: 'booking', fields: ['id', 'region', 'status', 'confirmedAt', 'teu'], limit: 100, ...patch };
}

describe('MemoryFactSource', () => {
  const source = new MemoryFactSource(ROWS);

  it('projects EXACTLY the requested fields — nothing more, missing keys omitted', async () => {
    const rows = await source.fetchFacts(q({ fields: ['id', 'teu', 'ghost'] }));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ id: 'r1', teu: 4 }); // no region/status leak, no ghost key
    expect(Object.keys(rows[2]!)).toEqual(['id', 'teu']);
  });

  it('applies scope equality with scalarEquals semantics (null matches NULL)', async () => {
    const apac = await source.fetchFacts(q({ scope: { region: 'APAC' } }));
    expect(apac.map((r) => r['id'])).toEqual(['r1', 'r2', 'r4']);
    const both = await source.fetchFacts(q({ scope: { region: 'APAC', status: 'confirmed' } }));
    expect(both.map((r) => r['id'])).toEqual(['r1', 'r4']);
    const nullScope = await source.fetchFacts(q({ scope: { region: null } }));
    expect(nullScope.map((r) => r['id'])).toEqual(['r5']);
    expect(await source.fetchFacts(q({ scope: { region: 'MARS' } }))).toEqual([]);
  });

  it('anchor range is half-open [start, end): start included, end excluded', async () => {
    const rows = await source.fetchFacts(
      q({ anchor: { field: 'confirmedAt', startIso: '2026-08-10T06:30:00Z', endIso: '2026-08-16T18:30:00Z' } }),
    );
    // r1 sits exactly ON the start (in); r5 exactly ON the end (out).
    expect(rows.map((r) => r['id'])).toEqual(['r1', 'r3']);
  });

  it('null and unparseable anchor timestamps belong to NO window', async () => {
    const rows = await source.fetchFacts(
      q({ anchor: { field: 'confirmedAt', startIso: '2000-01-01T00:00:00Z', endIso: '2100-01-01T00:00:00Z' } }),
    );
    expect(rows.map((r) => r['id'])).toEqual(['r1', 'r3', 'r5']); // r2 (null), r4 (junk) never match
  });

  it('caps returned rows at limit (after scope + anchor)', async () => {
    const rows = await source.fetchFacts(q({ limit: 2 }));
    expect(rows).toHaveLength(2);
    const scoped = await source.fetchFacts(q({ scope: { region: 'APAC' }, limit: 2 }));
    expect(scoped.map((r) => r['id'])).toEqual(['r1', 'r2']);
  });

  it('the rows-by-entity form serves per entity; unknown entities are empty', async () => {
    const multi = new MemoryFactSource({
      booking: ROWS,
      task: [{ id: 't1', done: true }],
    });
    expect((await multi.fetchFacts(q({}))).map((r) => r['id'])).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    expect(await multi.fetchFacts({ entity: 'task', fields: ['id'], limit: 10 })).toEqual([{ id: 't1' }]);
    expect(await multi.fetchFacts({ entity: 'ghost', fields: ['id'], limit: 10 })).toEqual([]);
  });

  it('the shared-array form serves any entity name', async () => {
    expect(await source.fetchFacts({ entity: 'whatever', fields: ['id'], limit: 1 })).toEqual([{ id: 'r1' }]);
  });
});
