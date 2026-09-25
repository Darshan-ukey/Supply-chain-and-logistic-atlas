import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { alluvial, fingerprints, prefixTree } from '../src/runtime/prefix.js';
import { deltaMap } from '../src/runtime/delta.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Where routes diverge, and how two cohorts differ.
 *
 * The fixture is one process with a segment that behaves differently: twenty
 * cases go submit then review, then either approve or reject — except the eight
 * phone cases, which always take a `chase` detour first. Every count below is
 * therefore decided in advance.
 *
 * That shape is chosen because it is the one a delta map exists to find: an arc
 * present in one cohort and entirely absent from the other. Side-by-side maps
 * hide exactly this, because an absent arc is invisible.
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

/** 12 web cases and 8 phone; every fourth case is rejected. Phone always chases. */
async function branching(): Promise<SqlClient> {
  const path = join(dir, 'prefix-fixture.csv');
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource,case:channel'];
  for (let i = 0; i < 20; i += 1) {
    const channel = i < 12 ? 'web' : 'phone';
    const day = String(2 + i).padStart(2, '0');
    let hour = 0;
    const step = (activity: string, who: string): void => {
      rows.push(
        `p${i},${activity},2026-03-${day}T${String(hour).padStart(2, '0')}:00:00Z,${who},${channel}`,
      );
      hour += 1;
    };
    step('submit', 'alice');
    step('review', 'bob');
    if (channel === 'phone') step('chase', 'carol');
    step(i % 4 === 0 ? 'reject' : 'approve', 'dave');
  }
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('routes as a tree of shared prefixes', () => {
  it('merges the common opening rather than repeating it per route', async () => {
    // The whole point: four variants share 'submit then review', and a flat
    // list shows that opening four times without saying they are the same.
    client = await branching();
    const tree = await prefixTree(client, duckdbDialect, { objectType: 'case' });

    const submit = tree.nodes.find((n) => n.id === 'submit')!;
    expect(submit.cases).toBe(20);
    expect(tree.totalCases).toBe(20);
  });

  it('finds where the process fans out', async () => {
    client = await branching();
    const tree = await prefixTree(client, duckdbDialect, { objectType: 'case' });

    expect(tree.widestSplit?.activity).toBe('review');
    expect(tree.widestSplit?.branches).toBe(3);
  });

  it('counts a route ending at a node separately from passing through it', async () => {
    // A leaf is a real outcome; without `ends`, a node cannot say whether work
    // stopped there or carried on.
    client = await branching();
    const tree = await prefixTree(client, duckdbDialect, { objectType: 'case' });

    const chase = tree.nodes.find((n) => n.activity === 'chase')!;
    expect(chase.cases).toBe(8);
    expect(chase.ends).toBe(0);

    const webApprove = tree.nodes.find((n) => n.id === 'submit → review → approve')!;
    expect(webApprove.cases).toBe(9);
    expect(webApprove.ends).toBe(9);
  });

  it('keeps every case counted into its parent even when a branch is pruned', async () => {
    // A node's count must be the truth about the log, not the truth about the
    // subset that survived pruning.
    client = await branching();
    const tree = await prefixTree(client, duckdbDialect, {
      objectType: 'case',
      minCases: 5,
    });

    expect(tree.nodes.find((n) => n.id === 'submit')?.cases).toBe(20);
    // The three-case reject branch is pruned from the tree.
    expect(tree.nodes.some((n) => n.id === 'submit → review → reject')).toBe(false);
  });

  it('says how many cases run past the depth it stopped at', async () => {
    client = await branching();
    const tree = await prefixTree(client, duckdbDialect, {
      objectType: 'case',
      maxDepth: 2,
    });

    expect(tree.maxDepth).toBe(2);
    expect(tree.casesBeyondDepth).toBe(20);
    expect(tree.nodes.every((n) => n.depth <= 2)).toBe(true);
  });
});

describe('segment, route and outcome as one flow', () => {
  it('links each segment to the routes it takes and where they end', async () => {
    client = await branching();
    const flow = await alluvial(client, duckdbDialect, {
      objectType: 'case',
      attribute: 'channel',
    });

    expect(flow.stages).toEqual(['channel', 'route', 'outcome']);
    expect(flow.totalCases).toBe(20);

    const phoneRoutes = flow.flows.filter((f) => f.fromStage === 0 && f.from === 'phone');
    expect(phoneRoutes.reduce((n, f) => n + f.cases, 0)).toBe(8);
    expect(phoneRoutes.every((f) => f.to.includes('chase'))).toBe(true);
  });

  it('conserves cases across every column', async () => {
    // Widths that do not add up are the way a flow diagram lies.
    client = await branching();
    const flow = await alluvial(client, duckdbDialect, {
      objectType: 'case',
      attribute: 'channel',
    });

    for (const stage of [0, 1, 2]) {
      const total = flow.bands
        .filter((b) => b.stage === stage)
        .reduce((n, b) => n + b.cases, 0);
      expect(total).toBe(20);
    }
  });

  it('merges rare routes into one band rather than dropping them', async () => {
    client = await branching();
    const flow = await alluvial(client, duckdbDialect, {
      objectType: 'case',
      attribute: 'channel',
      routeLimit: 1,
    });

    // Still twenty cases: the merged band carries what it absorbed.
    expect(flow.bands.filter((b) => b.stage === 1).reduce((n, b) => n + b.cases, 0)).toBe(20);
    expect(flow.bands.some((b) => b.stage === 1 && b.label === 'other routes')).toBe(true);
  });

  it('files cases with no value under a named segment rather than dropping them', async () => {
    const path = join(dir, 'prefix-noattr.csv');
    await writeFile(
      path,
      'case:concept:name,concept:name,time:timestamp\nx,only,2026-03-02T00:00:00Z\n',
      'utf8',
    );
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const flow = await alluvial(client, duckdbDialect, {
      objectType: 'case',
      attribute: 'channel',
    });
    expect(flow.totalCases).toBe(1);
    expect(flow.bands.find((b) => b.stage === 0)?.label).toBe('unknown');
  });
});

describe('every case as a row of blocks', () => {
  it('returns activities as indices into one palette', async () => {
    // Repeating the strings is what makes a five-hundred-row strip too big to
    // send; the palette is the whole reason this shape exists.
    client = await branching();
    const strip = await fingerprints(client, duckdbDialect, { objectType: 'case', limit: 5 });

    expect(strip.cases).toHaveLength(5);
    for (const row of strip.cases) {
      for (const step of row.steps) {
        expect(strip.activities[step]).toBeDefined();
      }
    }
  });

  it('reconstructs the real trace from the palette', async () => {
    client = await branching();
    const strip = await fingerprints(client, duckdbDialect, {
      objectType: 'case',
      sort: 'start',
      limit: 1,
    });
    const row = strip.cases[0]!;

    // p0 is a web case, rejected: submit, review, reject.
    expect(row.steps.map((i) => strip.activities[i])).toEqual(['submit', 'review', 'reject']);
  });

  it('cuts a long trace and says it did', async () => {
    client = await branching();
    const strip = await fingerprints(client, duckdbDialect, {
      objectType: 'case',
      maxSteps: 2,
    });

    expect(strip.maxSteps).toBe(2);
    expect(strip.cases.every((c) => c.steps.length <= 2)).toBe(true);
    expect(strip.cases.some((c) => c.truncated)).toBe(true);
  });

  it('says how many cases it did not return', async () => {
    client = await branching();
    const strip = await fingerprints(client, duckdbDialect, { objectType: 'case', limit: 3 });
    expect(strip.cases).toHaveLength(3);
    expect(strip.totalCases).toBe(20);
  });
});

describe('two cohorts on one map', () => {
  it('finds an arc one cohort uses and the other never does', async () => {
    // The finding side-by-side maps cannot show, because an absent arc is
    // invisible on the map that lacks it.
    client = await branching();
    const delta = await deltaMap(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
    });

    const chase = delta.arcs.find((a) => a.from === 'review' && a.to === 'chase')!;
    expect(chase.shareA).toBe(1);
    expect(chase.shareB).toBe(0);
    expect(chase.exclusive).toBe(true);
    expect(delta.reading).toContain('only in');
  });

  it('compares shares, not counts, because cohorts are different sizes', async () => {
    client = await branching();
    const delta = await deltaMap(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
    });

    expect(delta.casesA).toBe(8);
    expect(delta.casesB).toBe(12);
    // review→approve is 9 of 12 in web and 0 of 8 in phone. On raw counts the
    // arc would look busier in the larger cohort for the wrong reason.
    const approve = delta.arcs.find((a) => a.from === 'review' && a.to === 'approve')!;
    expect(approve.shareB).toBeCloseTo(0.75, 10);
    expect(approve.shareA).toBe(0);
  });

  it('carries both cohorts structure in the graph it returns', async () => {
    // An arc only B uses must still be laid out, or the difference cannot be
    // drawn.
    client = await branching();
    const delta = await deltaMap(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
    });

    const arcs = delta.graph.edges.map((e) => `${e.from}->${e.to}`);
    expect(arcs).toContain('review->chase');
    expect(arcs).toContain('review->approve');
  });

  it('refuses a median across two populations', async () => {
    client = await branching();
    const delta = await deltaMap(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
    });

    // 'submit→review' exists in both, so the merged edge cannot claim a median.
    const shared = delta.graph.edges.find((e) => e.from === 'submit' && e.to === 'review')!;
    expect(shared.medianSeconds).toBeNull();
  });

  it('says nothing rather than everything when one side is empty', async () => {
    // Against an empty cohort every arc is technically exclusive, and a map
    // lit up end to end says nothing at all.
    client = await branching();
    const delta = await deltaMap(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'fax' },
    });

    expect(delta.casesA).toBe(0);
    expect(delta.arcs.every((a) => !a.exclusive)).toBe(true);
    expect(delta.reading).toContain('empty');
  });
});
