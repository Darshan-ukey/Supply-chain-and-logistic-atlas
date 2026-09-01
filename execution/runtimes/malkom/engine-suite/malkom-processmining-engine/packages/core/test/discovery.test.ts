import { rm } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { buildDfg, DfgView } from '../src/runtime/dfg.js';
import { mineProcessTree, treeSize, treeToString } from '../src/runtime/inductive.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import {
  CHOICE_LOG,
  DISJOINT_LOG,
  LOOP_LOG,
  PARALLEL_LOG,
  SEQUENCE_LOG,
  makeTempDir,
  writeCsvLog,
} from './helpers/logs.js';

/**
 * Discovery, end to end: CSV on disk → canonical event log → DFG in SQL →
 * process tree. Every fixture has a structure decided in advance, so these are
 * known-answer tests rather than change detectors.
 */

let dir: string;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function mineLog(
  name: string,
  traces: readonly (readonly string[])[],
): Promise<{ client: SqlClient; tree: string; fallbacks: number; dfg: Awaited<ReturnType<typeof buildDfg>> }> {
  const path = await writeCsvLog(dir, name, traces);
  const client = await openMemoryDuckDB();
  await importCsv(client, duckdbDialect, { path });
  const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
  const result = mineProcessTree(dfg);
  return { client, tree: treeToString(result.tree), fallbacks: result.fallbacks, dfg };
}

describe('the directly-follows graph', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('derives edges, starts and ends from a sequential log', async () => {
    const mined = await mineLog('seq-dfg.csv', SEQUENCE_LOG);
    client = mined.client;
    const { dfg } = mined;

    expect(dfg.caseCount).toBe(3);
    expect(dfg.eventCount).toBe(9);
    expect(dfg.activities.map((a) => a.activity).sort()).toEqual(['a', 'b', 'c']);

    const edges = dfg.edges.map((e) => `${e.from}->${e.to}`).sort();
    expect(edges).toEqual(['a->b', 'b->c']);
    expect(dfg.edges.find((e) => e.from === 'a')?.frequency).toBe(3);

    expect([...dfg.starts.keys()]).toEqual(['a']);
    expect([...dfg.ends.keys()]).toEqual(['c']);
  });

  it('measures waiting time on each arc', async () => {
    const mined = await mineLog('seq-timing.csv', SEQUENCE_LOG);
    client = mined.client;
    // The fixture spaces events one hour apart.
    const ab = mined.dfg.edges.find((e) => e.from === 'a' && e.to === 'b');
    expect(ab?.medianSeconds).toBeCloseTo(3600, 0);
  });

  it('records both interleavings of a concurrent pair', async () => {
    const mined = await mineLog('par-dfg.csv', PARALLEL_LOG);
    client = mined.client;
    const edges = mined.dfg.edges.map((e) => `${e.from}->${e.to}`).sort();
    // Concurrency is visible only as b→c AND c→b both occurring.
    expect(edges).toContain('b->c');
    expect(edges).toContain('c->b');
  });

  it('counts a repeated activity once per occurrence, not once per case', async () => {
    const mined = await mineLog('loop-dfg.csv', LOOP_LOG);
    client = mined.client;
    const b = mined.dfg.activities.find((a) => a.activity === 'b');
    // b occurs 1 + 2 + 3 + 1 times across the four traces
    expect(b?.frequency).toBe(7);
    expect(b?.caseCount).toBe(4);
  });
});

describe('the Inductive Miner recovers known structures', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('discovers a pure sequence', async () => {
    const mined = await mineLog('seq.csv', SEQUENCE_LOG);
    client = mined.client;
    expect(mined.tree).toBe("->( 'a', 'b', 'c' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('discovers an exclusive choice between two branches', async () => {
    const mined = await mineLog('choice.csv', CHOICE_LOG);
    client = mined.client;
    expect(mined.tree).toBe("->( 'a', X( 'b', 'c' ), 'd' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('discovers concurrency from interleaved observations', async () => {
    const mined = await mineLog('parallel.csv', PARALLEL_LOG);
    client = mined.client;
    expect(mined.tree).toBe("->( 'a', +( 'b', 'c' ), 'd' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('discovers a loop with a redo path', async () => {
    const mined = await mineLog('loop.csv', LOOP_LOG);
    client = mined.client;
    expect(mined.tree).toBe("->( 'a', *( 'b', 'c' ), 'd' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('separates two processes that share no activities', async () => {
    const mined = await mineLog('disjoint.csv', DISJOINT_LOG);
    client = mined.client;
    // Order within an XOR is not semantically meaningful, so assert shape.
    expect(mined.tree.startsWith('X(')).toBe(true);
    expect(mined.tree).toContain("->( 'a', 'b' )");
    expect(mined.tree).toContain("->( 'x', 'y' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('reads every permutation of three activities as three-way concurrency', async () => {
    // All six orderings means every pair is fully interleaved, which IS what
    // three concurrent activities look like in a log. A flower model here
    // would be an under-fit, not a safe default.
    const allOrders = [
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
      ['c', 'a', 'b'],
      ['b', 'a', 'c'],
      ['c', 'b', 'a'],
      ['a', 'c', 'b'],
    ];
    const mined = await mineLog('all-orders.csv', allOrders);
    client = mined.client;
    expect(mined.tree).toBe("+( 'a', 'b', 'c' )");
    expect(mined.fallbacks).toBe(0);
  });

  it('reports a fallback rather than inventing structure it cannot justify', async () => {
    // A directed cycle a→b→c→a with no clean decomposition: not exclusive
    // (all connected), not sequential (all mutually reachable), not parallel
    // (no pair is interleaved in both directions), and not a loop (the body
    // would swallow every activity, leaving no redo path).
    const cyclic = [
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
    ];
    const mined = await mineLog('cyclic.csv', cyclic);
    client = mined.client;
    expect(mined.fallbacks).toBeGreaterThan(0);
    // The flower model is imprecise but SOUND — it never deadlocks, and the
    // fallback count is what tells the caller not to present it as structure.
    expect(mined.tree.startsWith('*( tau')).toBe(true);
  });
});

describe('miner unit behaviour', () => {
  function viewOf(
    activities: string[],
    edges: [string, string][],
    starts: string[],
    ends: string[],
  ): DfgView {
    return new DfgView(
      activities,
      edges.map(([from, to]) => ({ from, to })),
      starts,
      ends,
    );
  }

  function mineView(view: DfgView): string {
    return treeToString(
      mineProcessTree({
        objectType: 'case',
        activities: [...view.activities].map((a) => ({
          activity: a,
          frequency: 1,
          caseCount: 1,
          medianDurationSeconds: null,
        })),
        edges: [...view.activities].flatMap((a) =>
          [...view.successors(a)].map((b) => ({
            from: a,
            to: b,
            frequency: 1,
            caseCount: 1,
            medianSeconds: null,
            meanSeconds: null,
          })),
        ),
        starts: new Map([...view.starts].map((s) => [s, 1])),
        ends: new Map([...view.ends].map((e) => [e, 1])),
        caseCount: 1,
        eventCount: view.size,
      }).tree,
    );
  }

  it('returns a bare activity for a single-activity log', () => {
    expect(mineView(viewOf(['a'], [], ['a'], ['a']))).toBe("'a'");
  });

  it('returns a loop for a self-repeating activity', () => {
    expect(mineView(viewOf(['a'], [['a', 'a']], ['a'], ['a']))).toBe("*( 'a', tau )");
  });

  it('recomputes sub-view boundaries by entry and exit, not by absent neighbours', () => {
    // a → {b ↔ c} → d. Inside {b, c} both have a predecessor (each other), so
    // a rule based on "no predecessor remains" would find no start activity and
    // send a textbook concurrent branch to the flower fallback.
    const view = viewOf(
      ['a', 'b', 'c', 'd'],
      [
        ['a', 'b'],
        ['a', 'c'],
        ['b', 'c'],
        ['c', 'b'],
        ['b', 'd'],
        ['c', 'd'],
      ],
      ['a'],
      ['d'],
    );
    const inner = view.restrict(new Set(['b', 'c']));
    expect([...inner.starts].sort()).toEqual(['b', 'c']);
    expect([...inner.ends].sort()).toEqual(['b', 'c']);
  });

  it('measures tree size including operator nodes', () => {
    const tree = mineProcessTree({
      objectType: 'case',
      activities: [
        { activity: 'a', frequency: 1, caseCount: 1, medianDurationSeconds: null },
        { activity: 'b', frequency: 1, caseCount: 1, medianDurationSeconds: null },
      ],
      edges: [{ from: 'a', to: 'b', frequency: 1, caseCount: 1, medianSeconds: null, meanSeconds: null }],
      starts: new Map([['a', 1]]),
      ends: new Map([['b', 1]]),
      caseCount: 1,
      eventCount: 2,
    }).tree;
    expect(treeSize(tree)).toBe(3); // seq + two leaves
  });
});

describe('edge filtering', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('drops arcs that are rare relative to their source activity', async () => {
    const traces = [
      ...Array.from({ length: 20 }, () => ['a', 'b', 'c']),
      ['a', 'z', 'c'], // a one-off detour
    ];
    const path = await writeCsvLog(dir, 'noisy.csv', traces);
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const unfiltered = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(unfiltered.edges.some((e) => e.to === 'z')).toBe(true);

    const filtered = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      edgeThreshold: 0.1, // a→z is 1 of 21 outgoing from a
    });
    expect(filtered.edges.some((e) => e.to === 'z')).toBe(false);
    expect(filtered.edges.some((e) => e.from === 'a' && e.to === 'b')).toBe(true);
  });
});
