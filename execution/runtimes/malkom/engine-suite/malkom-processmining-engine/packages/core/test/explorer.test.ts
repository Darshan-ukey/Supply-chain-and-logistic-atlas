import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { abstractNodes, buildDfg, type Dfg } from '../src/runtime/dfg.js';
import { analyseVariants } from '../src/runtime/variants.js';
import { summariseLog } from '../src/runtime/summary.js';
import { describeFilter, type CaseFilter } from '../src/runtime/filter.js';
import { parseFilterSpec } from '../src/http/specs.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Wave 1: the controls that make a log explorable by pointing at it.
 *
 * The properties worth pinning are the ones that fail quietly. A variant
 * filter that matches nothing looks like an empty result rather than a bug. A
 * node slider that drops activities without reconnecting their paths produces
 * a map that still renders — just one describing behaviour the log never
 * contained. Both are tested against counts computed independently.
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

/**
 * 100 cases over four shapes, with a deliberate mix:
 *
 *   40  submit -> review -> approve            the happy path
 *   25  submit -> review -> review -> approve  one rework loop
 *   20  submit -> review -> reject             rejection
 *   15  submit -> triage -> review -> approve  a rare extra step
 *
 * The counts are all distinct so a wrong filter cannot coincidentally match.
 */
async function shapedLog(): Promise<SqlClient> {
  const path = join(dir, 'explorer-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  const base = Date.parse('2026-03-01T00:00:00Z');

  const shapes: { n: number; steps: string[] }[] = [
    { n: 40, steps: ['submit', 'review', 'approve'] },
    { n: 25, steps: ['submit', 'review', 'review', 'approve'] },
    { n: 20, steps: ['submit', 'review', 'reject'] },
    { n: 15, steps: ['submit', 'triage', 'review', 'approve'] },
  ];

  let caseNo = 0;
  shapes.forEach((shape, si) => {
    for (let i = 0; i < shape.n; i += 1) {
      const id = `k${caseNo++}`;
      const start = base + si * 86_400_000 + i * 3_600_000;
      shape.steps.forEach((activity, s) => {
        const ts = new Date(start + s * 600_000).toISOString();
        lines.push(`${id},${activity},${ts},worker${s % 3}`);
      });
    }
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

async function cases(filter: CaseFilter): Promise<number> {
  const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case', filter });
  return dfg.caseCount;
}

// ---------------------------------------------------------------------------
// Filter by variant
// ---------------------------------------------------------------------------

describe('filtering by variant', () => {
  it('selects exactly the cases the variant report counted', async () => {
    client = await shapedLog();

    // The cross-check that matters: the variant list is what a user clicks, so
    // the filter has to return the number that list displayed. Computing both
    // from the same fixture but by different code paths is the point.
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    for (const variant of report.variants) {
      expect(await cases({ kind: 'variant', path: variant.path })).toBe(variant.cases);
    }
  });

  it('matches the whole path, not a prefix of it', async () => {
    client = await shapedLog();

    // 'submit -> review -> approve' is a prefix of the 25 rework cases too.
    // Matching prefixes would return 65 rather than 40, and the number would
    // look plausible enough to ship.
    expect(await cases({ kind: 'variant', path: ['submit', 'review', 'approve'] })).toBe(40);
  });

  it('returns nothing for a path no case took', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'variant', path: ['submit', 'approve'] })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Filter by execution path
// ---------------------------------------------------------------------------

describe('filtering by execution path', () => {
  it('separates "eventually followed by" from "immediately followed by"', async () => {
    client = await shapedLog();

    // review eventually leads to approve in 40 + 25 + 15 = 80 cases.
    expect(await cases({ kind: 'path', from: 'review', to: 'approve' })).toBe(80);

    // But it leads DIRECTLY to approve in all of those too, because the second
    // review in the rework shape is itself followed by approve.
    expect(await cases({ kind: 'path', from: 'review', to: 'approve', directly: true })).toBe(80);

    // submit eventually reaches approve in 80 cases...
    expect(await cases({ kind: 'path', from: 'submit', to: 'approve' })).toBe(80);
    // ...and directly in none: something always happens in between.
    expect(await cases({ kind: 'path', from: 'submit', to: 'approve', directly: true })).toBe(0);
  });

  it('is directional', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'path', from: 'approve', to: 'submit' })).toBe(0);
  });

  it('finds a step only some cases pass through', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'path', from: 'triage', to: 'review', directly: true })).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Filter by rework
// ---------------------------------------------------------------------------

describe('filtering by rework', () => {
  it('finds cases where any step repeated', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'rework', minTimes: 2 })).toBe(25);
  });

  it('finds cases where a named step repeated', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'rework', activity: 'review', minTimes: 2 })).toBe(25);
    // Nothing runs approve twice, so naming it must not inherit review's count.
    expect(await cases({ kind: 'rework', activity: 'approve', minTimes: 2 })).toBe(0);
  });

  it('treats minTimes as a floor, so 1 selects everything that does the step', async () => {
    client = await shapedLog();
    expect(await cases({ kind: 'rework', activity: 'review', minTimes: 1 })).toBe(100);
    expect(await cases({ kind: 'rework', minTimes: 3 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The terse grammar
// ---------------------------------------------------------------------------

describe('the selector grammar', () => {
  it('parses the new forms', () => {
    expect(parseFilterSpec('variant:submit>review>approve')).toEqual({
      kind: 'variant',
      path: ['submit', 'review', 'approve'],
    });
    expect(parseFilterSpec('path:review>approve')).toEqual({
      kind: 'path',
      from: 'review',
      to: 'approve',
    });
    expect(parseFilterSpec('path!:review>approve')).toEqual({
      kind: 'path',
      from: 'review',
      to: 'approve',
      directly: true,
    });
    expect(parseFilterSpec('rework:3')).toEqual({ kind: 'rework', minTimes: 3 });
    expect(parseFilterSpec('rework:review:2')).toEqual({
      kind: 'rework',
      activity: 'review',
      minTimes: 2,
    });
  });

  it('rejects malformed forms rather than guessing', () => {
    expect(parseFilterSpec('variant:')).toBeUndefined();
    expect(parseFilterSpec('path:review')).toBeUndefined();
    expect(parseFilterSpec('rework:none')).toBeUndefined();
  });

  it('describes every new filter in words', () => {
    expect(describeFilter({ kind: 'rework', minTimes: 3 })).toBe('repeating any step 3+ times');
    expect(describeFilter({ kind: 'path', from: 'a', to: 'b', directly: true })).toBe(
      'where b came straight after a',
    );
  });
});

// ---------------------------------------------------------------------------
// Node abstraction
// ---------------------------------------------------------------------------

describe('node abstraction', () => {
  async function full(): Promise<Dfg> {
    return buildDfg(client, duckdbDialect, { objectType: 'case' });
  }

  it('keeps the busiest activities and drops the rest', async () => {
    client = await shapedLog();
    const dfg = await full();
    expect(dfg.activities).toHaveLength(5); // submit review approve reject triage

    const simple = abstractNodes(dfg, { keep: 0.6 });
    expect(simple.activities).toHaveLength(3);
    // triage (15) and reject (20) are the quietest, so they go first.
    expect(simple.activities.map((a) => a.activity).sort()).toEqual([
      'approve',
      'review',
      'submit',
    ]);
  });

  it('reconnects the paths that ran through a removed activity', async () => {
    client = await shapedLog();
    const dfg = await full();

    // triage sat between submit and review in 15 cases. Hiding it must leave
    // submit connected to review — not a dangling pair of orphans.
    const simple = abstractNodes(dfg, { minFrequency: 20 });
    expect(simple.activities.map((a) => a.activity)).not.toContain('triage');

    const bridged = simple.edges.find((e) => e.from === 'submit' && e.to === 'review');
    expect(bridged).toBeDefined();
    // Every case does submit then (eventually) review, so the bridged arc has
    // to carry all 100 — the 85 direct plus the 15 that went via triage.
    expect(bridged?.frequency).toBe(100);
  });

  it('adds the hidden step’s time to the arc rather than losing it', async () => {
    client = await shapedLog();
    const dfg = await full();

    const before = dfg.edges.find((e) => e.from === 'submit' && e.to === 'triage');
    const after = dfg.edges.find((e) => e.from === 'triage' && e.to === 'review');
    expect(before?.medianSeconds).toBe(600);
    expect(after?.medianSeconds).toBe(600);

    const simple = abstractNodes(dfg, { minFrequency: 20 });
    const bridged = simple.edges.find((e) => e.from === 'submit' && e.to === 'review');
    // The delay through the hidden node still happened, so the bridged arc
    // must be slower than the direct one it merged with — never faster.
    expect(bridged?.medianSeconds).not.toBeNull();
    expect(bridged!.medianSeconds!).toBeGreaterThan(600);
  });

  it('never removes a pinned activity', async () => {
    client = await shapedLog();
    const simple = abstractNodes(await full(), { keep: 0.2, pin: ['reject'] });
    expect(simple.activities.map((a) => a.activity)).toContain('reject');
  });

  it('leaves the graph alone when the slider is at the top', async () => {
    client = await shapedLog();
    const dfg = await full();
    expect(abstractNodes(dfg, { keep: 1 })).toBe(dfg);
  });

  it('keeps at least one activity, so the map never empties', async () => {
    client = await shapedLog();
    const simple = abstractNodes(await full(), { keep: 0 });
    expect(simple.activities.length).toBeGreaterThanOrEqual(1);
  });

  it('does not leave a map without an entry point', async () => {
    client = await shapedLog();
    const dfg = await full();
    // submit is the only start. Remove it and its start count must pass to
    // whatever followed, or the graph becomes unreachable.
    const simple = abstractNodes(dfg, { keep: 0.5, pin: [] });
    expect([...simple.starts.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect([...simple.ends.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Log summary
// ---------------------------------------------------------------------------

describe('the log summary', () => {
  it('reports the header figures in one call', async () => {
    client = await shapedLog();
    const summary = await summariseLog(client, duckdbDialect, { objectType: 'case' });

    expect(summary.cases).toBe(100);
    expect(summary.events).toBe(40 * 3 + 25 * 4 + 20 * 3 + 15 * 4);
    expect(summary.activities).toBe(5);
    expect(summary.variants).toBe(4);
    expect(summary.resources).toBe(3);
    expect(summary.resourceCoverage).toBe(1);
  });

  it('agrees with the variant report about how many paths there are', async () => {
    client = await shapedLog();
    const summary = await summariseLog(client, duckdbDialect, { objectType: 'case' });
    const variants = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    expect(summary.variants).toBe(variants.totalVariants);
  });

  it('reports the timeframe and the duration spread', async () => {
    client = await shapedLog();
    const summary = await summariseLog(client, duckdbDialect, { objectType: 'case' });

    expect(summary.timeframe.from).toBeInstanceOf(Date);
    expect(summary.timeframe.to).toBeInstanceOf(Date);
    expect(summary.timeframe.from!.getTime()).toBeLessThan(summary.timeframe.to!.getTime());

    // Three-step cases span 20 minutes, four-step cases 30.
    expect(summary.duration.minSeconds).toBe(1200);
    expect(summary.duration.maxSeconds).toBe(1800);
    expect(summary.duration.medianSeconds).not.toBeNull();
  });

  it('narrows with a filter, exactly as every other analysis does', async () => {
    client = await shapedLog();
    const summary = await summariseLog(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'rework', minTimes: 2 },
    });
    expect(summary.cases).toBe(25);
    expect(summary.variants).toBe(1);
  });
});
