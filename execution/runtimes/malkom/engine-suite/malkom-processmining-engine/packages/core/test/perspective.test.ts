import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { analyseVariants } from '../src/runtime/variants.js';
import { analyseRework } from '../src/runtime/rework.js';
import { summariseLog } from '../src/runtime/summary.js';
import { UNKNOWN_LABEL } from '../src/runtime/eventlog.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Wave 2: looking at the same events a different way, and counting the work
 * that was done twice.
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
 * 12 cases, three steps each, two people — and two events with no resource at
 * all, which is what makes the perspective interesting rather than cosmetic.
 *
 *   8 cases:  submit(ann)  review(bob)  approve(ann)
 *   4 cases:  submit(ann)  review(—)    approve(bob)
 */
async function twoPeople(): Promise<SqlClient> {
  const path = join(dir, 'perspective-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  const base = Date.parse('2026-05-01T00:00:00Z');

  for (let i = 0; i < 12; i += 1) {
    const named = i < 8;
    const who = ['ann', named ? 'bob' : '', named ? 'ann' : 'bob'];
    ['submit', 'review', 'approve'].forEach((activity, s) => {
      const ts = new Date(base + i * 86_400_000 + s * 3_600_000).toISOString();
      lines.push(`p${i},${activity},${ts},${who[s]}`);
    });
  }

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

/** Every case does review twice — with different people, so the two views differ. */
async function reworkedLog(): Promise<SqlClient> {
  const path = join(dir, 'rework-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  const base = Date.parse('2026-06-01T00:00:00Z');

  // 10 cases: submit, review, review (immediate repeat), approve
  //  5 cases: submit, review, escalate, review (a loop back), approve
  const shapes = [
    { n: 10, steps: ['submit', 'review', 'review', 'approve'] },
    { n: 5, steps: ['submit', 'review', 'escalate', 'review', 'approve'] },
  ];
  let caseNo = 0;
  shapes.forEach((shape, si) => {
    for (let i = 0; i < shape.n; i += 1) {
      const id = `r${caseNo++}`;
      shape.steps.forEach((activity, s) => {
        const ts = new Date(base + si * 30 * 86_400_000 + i * 86_400_000 + s * 600_000).toISOString();
        lines.push(`${id},${activity},${ts},ann`);
      });
    }
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

// ---------------------------------------------------------------------------

describe('changing the perspective', () => {
  it('puts people in the boxes instead of steps', async () => {
    client = await twoPeople();

    const steps = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(steps.activities.map((a) => a.activity).sort()).toEqual([
      'approve',
      'review',
      'submit',
    ]);

    const people = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      perspective: { kind: 'resource' },
    });
    expect(people.activities.map((a) => a.activity).sort()).toEqual([
      UNKNOWN_LABEL,
      'ann',
      'bob',
    ]);
    // Same events, same cases — only the labelling changed.
    expect(people.caseCount).toBe(steps.caseCount);
    expect(people.eventCount).toBe(steps.eventCount);
  });

  it('labels events the perspective cannot name rather than dropping them', async () => {
    client = await twoPeople();
    const people = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      perspective: { kind: 'resource' },
    });

    // Dropping the four resource-less events would close the gap they left and
    // manufacture an ann -> bob arc that never happened in those cases.
    const unknown = people.activities.find((a) => a.activity === UNKNOWN_LABEL);
    expect(unknown?.frequency).toBe(4);
    expect(people.eventCount).toBe(36);
  });

  it('re-cuts the variants, because the sequence of people is a different sequence', async () => {
    client = await twoPeople();

    const byStep = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    expect(byStep.totalVariants).toBe(1); // every case does the same three steps

    const byPerson = await analyseVariants(client, duckdbDialect, {
      objectType: 'case',
      perspective: { kind: 'resource' },
    });
    expect(byPerson.totalVariants).toBe(2); // ann-bob-ann, and ann-(unassigned)-bob
  });

  it('filters on the sequence that is actually on screen', async () => {
    client = await twoPeople();
    const perspective = { kind: 'resource' } as const;

    // The click a user makes: pick a variant from the resource view, filter by
    // it, and get back the cases that row counted. Matching against activity
    // names here would return nothing and look like an empty selection.
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case', perspective });
    for (const variant of report.variants) {
      const dfg = await buildDfg(client, duckdbDialect, {
        objectType: 'case',
        perspective,
        filter: { kind: 'variant', path: variant.path },
      });
      expect(dfg.caseCount).toBe(variant.cases);
    }
  });

  it('keeps presence filters meaning real things, not perspective things', async () => {
    client = await twoPeople();

    // Under the resource perspective the boxes say 'ann' and 'bob', but
    // 'activity:review' must still mean the step called review.
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      perspective: { kind: 'resource' },
      filter: { kind: 'activity', activity: 'review' },
    });
    expect(dfg.caseCount).toBe(12);
  });

  it('reports people as the activity count in the summary', async () => {
    client = await twoPeople();
    const summary = await summariseLog(client, duckdbDialect, {
      objectType: 'case',
      perspective: { kind: 'resource' },
    });
    expect(summary.activities).toBe(3); // ann, bob, (unassigned)
    expect(summary.cases).toBe(12);
  });
});

// ---------------------------------------------------------------------------

describe('rework analysis', () => {
  it('counts repeats, and separates immediate retries from loops back', async () => {
    client = await reworkedLog();
    const report = await analyseRework(client, duckdbDialect, { objectType: 'case' });

    const review = report.activities.find((a) => a.activity === 'review');
    expect(review).toBeDefined();
    expect(review?.cases).toBe(15);
    expect(review?.casesWithRepeat).toBe(15);
    expect(review?.repeatExecutions).toBe(15); // one extra execution per case

    // 10 cases repeated it immediately; 5 came back to it after escalate.
    expect(review?.selfLoops).toBe(10);
    expect(review?.revisits).toBe(5);
  });

  it('charges only the repeats, never the first execution', async () => {
    client = await reworkedLog();
    const report = await analyseRework(client, duckdbDialect, { objectType: 'case' });

    // 15 cases do submit exactly once; it must not appear as rework at all.
    expect(report.activities.some((a) => a.activity === 'submit')).toBe(false);

    // 10*4 + 5*5 = 65 events, of which 15 are repeats.
    expect(report.totalEvents).toBe(65);
    expect(report.repeatEvents).toBe(15);
    expect(report.effortShare).toBeCloseTo(15 / 65, 5);
  });

  it('says when rework cannot be costed rather than reporting zero', async () => {
    client = await reworkedLog();
    const report = await analyseRework(client, duckdbDialect, { objectType: 'case' });

    // This log records no handling times. Reporting a cost of 0 would read as
    // "rework is free", which is the opposite of what the data says.
    expect(report.handlingTimesRecorded).toBe(false);
    for (const a of report.activities) expect(a.repeatHandlingSeconds).toBeNull();
  });

  it('narrows with a filter like every other analysis', async () => {
    client = await reworkedLog();
    const report = await analyseRework(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'activity', activity: 'escalate' },
    });
    expect(report.totalCases).toBe(5);
    const review = report.activities.find((a) => a.activity === 'review');
    expect(review?.selfLoops).toBe(0);
    expect(review?.revisits).toBe(5);
  });

  it('reports nothing rather than something when no work was repeated', async () => {
    client = await twoPeople();
    const report = await analyseRework(client, duckdbDialect, { objectType: 'case' });
    expect(report.activities).toEqual([]);
    expect(report.repeatEvents).toBe(0);
    expect(report.summary).toContain('no activity was performed twice');
  });
});
