import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { dependencyGraph, lengthTwoLoopCounts } from '../src/runtime/heuristics.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { dfgFixture, makeTempDir, CHOICE_LOG, PARALLEL_LOG } from './helpers/logs.js';

/**
 * Known-answer tests for the dependency measure.
 *
 * The whole reason this module exists is one distinction, so that is what the
 * numbers here are chosen to pin: 890-against-12 must read as an ordering and
 * 200-against-190 must not, whatever else changes. Every expectation below is
 * computed from the formula by hand rather than recorded from a run.
 */

let dir: string;
let client: SqlClient;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterEach(async () => {
  await client?.close();
});

const edgeOf = (graph: ReturnType<typeof dependencyGraph>, from: string, to: string) =>
  graph.edges.find((e) => e.from === from && e.to === to);

describe('a real ordering, against two things that merely co-occur', () => {
  it('calls a lopsided pair a dependency', () => {
    const graph = dependencyGraph(
      dfgFixture([
        ['Send Invoice', 'Receive Payment', 890],
        ['Receive Payment', 'Send Invoice', 12],
      ]),
    );

    const edge = edgeOf(graph, 'Send Invoice', 'Receive Payment');
    // (890 - 12) / (902 + 1) = 878 / 903
    expect(edge?.dependency).toBeCloseTo(878 / 903, 10);
    expect(edge?.kind).toBe('dependency');
    expect(edge?.reliable).toBe(true);
    expect(edge?.support).toBe(902);
  });

  it('refuses to call an evenly balanced pair a dependency', () => {
    const graph = dependencyGraph(
      dfgFixture([
        ['Update Address', 'Update Phone', 200],
        ['Update Phone', 'Update Address', 190],
      ]),
    );

    const edge = edgeOf(graph, 'Update Address', 'Update Phone');
    // (200 - 190) / (390 + 1) — an order of magnitude below the threshold.
    expect(edge?.dependency).toBeCloseTo(10 / 391, 10);
    expect(edge?.kind).toBe('co-occurrence');
    // Plenty of evidence; the evidence just does not say what a map implies.
    expect(edge?.reliable).toBe(true);
  });

  it('reports the reverse direction on the arc as well as its own count', () => {
    const graph = dependencyGraph(
      dfgFixture([
        ['a', 'b', 890],
        ['b', 'a', 12],
      ]),
    );
    expect(edgeOf(graph, 'a', 'b')?.reverseFrequency).toBe(12);
    expect(edgeOf(graph, 'b', 'a')?.reverseFrequency).toBe(890);
    // The weak direction scores negative: the arc points the wrong way.
    expect(edgeOf(graph, 'b', 'a')?.dependency).toBeLessThan(0);
  });
});

describe('thin evidence', () => {
  it('does not let a single observation score as a certainty', () => {
    const graph = dependencyGraph(dfgFixture([['a', 'b', 1]]));
    const edge = edgeOf(graph, 'a', 'b');

    // 1 / 2 — the +1 in the denominator is the entire guard, and it holds.
    expect(edge?.dependency).toBeCloseTo(0.5, 10);
    expect(edge?.kind).not.toBe('dependency');
    expect(edge?.reliable).toBe(false);
  });

  it('reaches the threshold once the evidence does', () => {
    const graph = dependencyGraph(dfgFixture([['a', 'b', 100]]));
    const edge = edgeOf(graph, 'a', 'b');
    expect(edge?.dependency).toBeCloseTo(100 / 101, 10);
    expect(edge?.kind).toBe('dependency');
    expect(edge?.reliable).toBe(true);
  });

  it('honours a caller-supplied support floor', () => {
    const graph = dependencyGraph(dfgFixture([['a', 'b', 100]]), { minSupport: 500 });
    expect(edgeOf(graph, 'a', 'b')?.reliable).toBe(false);
  });
});

describe('repetition', () => {
  it('reports a self-loop separately from the arcs between activities', () => {
    const graph = dependencyGraph(
      dfgFixture([
        ['a', 'b', 50],
        ['b', 'b', 30],
      ]),
    );

    expect(graph.selfLoops).toEqual([{ activity: 'b', frequency: 30, dependency: 30 / 31 }]);
    // A self-loop is not an arc between two activities and must not appear as one.
    expect(edgeOf(graph, 'b', 'b')).toBeUndefined();
  });

  it('files an alternating pair as a loop rather than as unrelated', () => {
    const balanced: [string, string, number][] = [
      ['chase', 'respond', 100],
      ['respond', 'chase', 98],
    ];

    // Without the alternation counts the pair is indistinguishable from two
    // activities that simply co-occur — which is the misreading this guards.
    const blind = dependencyGraph(dfgFixture(balanced));
    expect(edgeOf(blind, 'chase', 'respond')?.kind).toBe('co-occurrence');
    expect(blind.lengthTwoLoopsMeasured).toBe(false);

    const seeing = dependencyGraph(dfgFixture(balanced), {
      lengthTwoCounts: [{ from: 'chase', via: 'respond', occurrences: 96 }],
    });
    expect(edgeOf(seeing, 'chase', 'respond')?.kind).toBe('short-loop');
    expect(edgeOf(seeing, 'respond', 'chase')?.kind).toBe('short-loop');
    expect(seeing.lengthTwoLoopsMeasured).toBe(true);
  });

  it('counts a pair once, not once per phase', () => {
    const graph = dependencyGraph(
      dfgFixture([
        ['a', 'b', 10],
        ['b', 'a', 10],
      ]),
      {
        lengthTwoCounts: [
          { from: 'a', via: 'b', occurrences: 6 },
          { from: 'b', via: 'a', occurrences: 4 },
        ],
      },
    );

    expect(graph.lengthTwoLoops).toEqual([{ a: 'a', b: 'b', occurrences: 10, dependency: 10 / 11 }]);
  });

  it('states that loops were not measured rather than reporting none', () => {
    const graph = dependencyGraph(dfgFixture([['a', 'b', 10]]));
    expect(graph.lengthTwoLoopsMeasured).toBe(false);
    expect(graph.lengthTwoLoops).toEqual([]);
  });
});

describe('splits and joins', () => {
  it('calls interleaving branches concurrent', async () => {
    client = await logFrom('parallel.csv', PARALLEL_LOG);
    const graph = dependencyGraph(await buildDfg(client, duckdbDialect, { objectType: 'case' }));

    const split = graph.splits.find((s) => s.activity === 'a');
    expect(split?.branches).toEqual(['b', 'c']);
    expect(split?.kind).toBe('and');
    // (|b>c| + |c>b|) / (|a>b| + |a>c| + 1) = 4 / 5
    expect(split?.andMeasure).toBeCloseTo(0.8, 10);
  });

  it('calls mutually exclusive branches a choice', async () => {
    client = await logFrom('choice.csv', CHOICE_LOG);
    const graph = dependencyGraph(await buildDfg(client, duckdbDialect, { objectType: 'case' }));

    const split = graph.splits.find((s) => s.activity === 'a');
    expect(split?.kind).toBe('xor');
    expect(split?.andMeasure).toBe(0);

    // The join is the same question asked backwards, and must agree.
    const join = graph.joins.find((j) => j.activity === 'd');
    expect(join?.branches).toEqual(['b', 'c']);
    expect(join?.kind).toBe('xor');
  });

  it('says nothing about an activity with one way out', () => {
    const graph = dependencyGraph(dfgFixture([['a', 'b', 10]]));
    const split = graph.splits.find((s) => s.activity === 'a');
    expect(split?.kind).toBe('single');
  });
});

describe('counting alternations in the database', () => {
  it('counts completed a-b-a alternations, not adjacent pairs', async () => {
    // chase/respond alternates three times; submit and close bracket it.
    client = await logFrom('alternating.csv', [
      ['submit', 'chase', 'respond', 'chase', 'respond', 'chase', 'close'],
      ['submit', 'chase', 'respond', 'chase', 'close'],
    ]);

    const counts = await lengthTwoLoopCounts(client, duckdbDialect, { objectType: 'case' });
    const chaseLoops = counts.find((c) => c.from === 'chase' && c.via === 'respond');
    const respondLoops = counts.find((c) => c.from === 'respond' && c.via === 'chase');

    // Trace one: chase>respond>chase twice, respond>chase>respond once.
    // Trace two: chase>respond>chase once.
    expect(chaseLoops?.occurrences).toBe(3);
    expect(respondLoops?.occurrences).toBe(1);
  });

  it('does not mistake a self-repeat for an alternation', async () => {
    client = await logFrom('repeat.csv', [['a', 'b', 'b', 'b', 'c']]);
    const counts = await lengthTwoLoopCounts(client, duckdbDialect, { objectType: 'case' });
    expect(counts.filter((c) => c.from === c.via)).toEqual([]);
  });

  it('finds nothing in a log with no alternation', async () => {
    client = await logFrom('straight.csv', [['a', 'b', 'c'], ['a', 'b', 'c']]);
    expect(await lengthTwoLoopCounts(client, duckdbDialect, { objectType: 'case' })).toEqual([]);
  });
});

/** Write traces to CSV and import them, so the DFG comes from a real query. */
async function logFrom(name: string, traces: readonly (readonly string[])[]): Promise<SqlClient> {
  const path = join(dir, name);
  const base = Date.parse('2026-05-01T00:00:00Z');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource'];

  traces.forEach((trace, t) => {
    trace.forEach((activity, i) => {
      const ts = new Date(base + t * 86_400_000 + i * 600_000).toISOString();
      lines.push(`case-${t + 1},${activity},${ts},worker`);
    });
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}
