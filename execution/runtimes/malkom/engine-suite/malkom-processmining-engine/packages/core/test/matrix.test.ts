import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { repeatMatrix, skillMatrix } from '../src/runtime/matrix.js';
import { complexityScatter, performanceSpectrum } from '../src/runtime/spectrum.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Grids and spectra — the views that separate cases a summary statistic merges.
 *
 * Two of these distinctions are the whole reason the code exists, so each has a
 * fixture built to embody it:
 *
 *  - a step that ALWAYS runs twice is a two-pass design nobody wrote down; a
 *    step that usually runs once and occasionally six times is one that does not
 *    converge. Identical rework rates, opposite responses.
 *  - a queue worked in order, a queue where later work overtakes earlier, and a
 *    queue released by a batch job all produce the same median wait.
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

const pad = (n: number): string => String(n).padStart(2, '0');

async function load(name: string, rows: readonly string[]): Promise<SqlClient> {
  const path = join(dir, `${name}.csv`);
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

/**
 * Ten cases. `check` runs exactly twice in every one; `chase` runs six times in
 * three of them and not at all in the rest. Each activity has exactly one owner.
 */
function reworkRows(): string[] {
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  for (let i = 0; i < 10; i += 1) {
    rows.push(`m${i},submit,2026-03-02T00:00:00Z,alice`);
    rows.push(`m${i},check,2026-03-02T01:00:00Z,bob`);
    rows.push(`m${i},check,2026-03-02T02:00:00Z,bob`);
    if (i < 3) {
      for (let k = 0; k < 6; k += 1) {
        rows.push(`m${i},chase,2026-03-02T03:0${k}:00Z,carol`);
      }
    }
    rows.push(`m${i},done,2026-03-02T${pad(4 + i)}:00:00Z,dave`);
  }
  return rows;
}

describe('how many times a step ran in one case', () => {
  it('tells a two-pass design apart from a step that never converges', async () => {
    // The distinction the grid exists for. Both are "rework" to a rate.
    client = await load('repeat', reworkRows());
    const matrix = await repeatMatrix(client, duckdbDialect, { objectType: 'case' });

    const check = matrix.activities.find((a) => a.activity === 'check')!;
    expect(check.maxRuns).toBe(2);
    expect(check.reading).toContain('two-pass step');

    const chase = matrix.activities.find((a) => a.activity === 'chase')!;
    expect(chase.maxRuns).toBe(6);
    expect(chase.reading).toContain('tail');
  });

  it('says plainly when a step never repeats', async () => {
    client = await load('repeat2', reworkRows());
    const matrix = await repeatMatrix(client, duckdbDialect, { objectType: 'case' });
    const submit = matrix.activities.find((a) => a.activity === 'submit')!;

    expect(submit.repeatedIn).toBe(0);
    expect(submit.reading).toBe('never repeats');
  });

  it('puts every case in exactly one cell of its row', async () => {
    client = await load('repeat3', reworkRows());
    const matrix = await repeatMatrix(client, duckdbDialect, { objectType: 'case' });

    const cellsFor = (activity: string) => matrix.cells.filter((c) => c.activity === activity);
    expect(cellsFor('check').reduce((n, c) => n + c.cases, 0)).toBe(10);
    expect(cellsFor('chase').reduce((n, c) => n + c.cases, 0)).toBe(3);
  });

  it('folds an extreme run into the top row rather than widening the grid', async () => {
    // A case that ran a step forty times is the most interesting row on the
    // chart; forty columns to show it makes every other row unreadable.
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    for (let k = 0; k < 30; k += 1) rows.push(`w,loop,2026-03-02T00:${pad(k)}:00Z`);
    client = await load('repeat-wide', rows);

    const matrix = await repeatMatrix(client, duckdbDialect, { objectType: 'case', maxRuns: 8 });
    expect(matrix.maxRuns).toBe(8);
    expect(matrix.activities[0]?.reading).toContain('does not converge');
  });
});

describe('who can do what', () => {
  it('names the person who is the only one who can', async () => {
    // A step one person can do is a step that stops when they are on holiday,
    // and no workload chart shows it.
    client = await load('skill', reworkRows());
    const matrix = await skillMatrix(client, duckdbDialect, { objectType: 'case' });

    const owners = Object.fromEntries(
      matrix.activities.filter((a) => a.soleOwner !== null).map((a) => [a.activity, a.soleOwner]),
    );
    expect(owners).toEqual({ submit: 'alice', check: 'bob', chase: 'carol', done: 'dave' });
    expect(matrix.singlePersonActivities).toBe(4);
  });

  it('reports no sole owner once two people share a step', async () => {
    const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
    rows.push('s1,shared,2026-03-02T00:00:00Z,alice');
    rows.push('s2,shared,2026-03-02T01:00:00Z,bob');
    client = await load('skill-shared', rows);

    const matrix = await skillMatrix(client, duckdbDialect, { objectType: 'case' });
    const shared = matrix.activities.find((a) => a.activity === 'shared')!;
    expect(shared.people).toBe(2);
    expect(shared.soleOwner).toBeNull();
    expect(shared.concentration).toBeCloseTo(0.5, 10);
  });

  it('leaves unattributed work out rather than inventing a person', async () => {
    // An "unknown" column reads as somebody who can do everything.
    const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
    rows.push('u1,step,2026-03-02T00:00:00Z,alice');
    rows.push('u2,step,2026-03-02T01:00:00Z,');
    client = await load('skill-unattributed', rows);

    const matrix = await skillMatrix(client, duckdbDialect, { objectType: 'case' });
    expect(matrix.resources.map((r) => r.resource)).toEqual(['alice']);
  });
});

describe('queue discipline', () => {
  /** Eight cases queueing an hour apart, served by the given schedule. */
  async function queue(name: string, servedAt: (i: number) => number): Promise<SqlClient> {
    const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
    for (let i = 0; i < 8; i += 1) {
      rows.push(`q${i},queue,2026-03-02T${pad(i)}:00:00Z,alice`);
      rows.push(`q${i},serve,2026-03-02T${pad(servedAt(i))}:00:00Z,bob`);
    }
    return load(name, rows);
  }

  it('recognises a queue worked in order', async () => {
    client = await queue('fifo', (i) => i + 2);
    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
    });

    expect(spectrum.passages).toHaveLength(8);
    expect(spectrum.overtakingRate).toBe(0);
    expect(spectrum.reading).toContain('first in, first out');
  });

  it('recognises work being overtaken', async () => {
    client = await queue('lifo', (i) => 20 - i);
    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
    });

    expect(spectrum.overtakingRate).toBe(1);
    expect(spectrum.reading).toContain('not being worked in order');
  });

  it('recognises a batch, which no median can', async () => {
    // Every case waits a different length and they all leave together. The
    // fix is a schedule change, not more people, and only the shape says so.
    client = await queue('batch', () => 20);
    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
    });

    expect(spectrum.reading).toContain('batches');
  });

  it('measures only consecutive passages, not eventual ones', async () => {
    // 'queue' then something else then 'serve' is not a handover between the
    // two, and drawing it as one would measure across the intervening work.
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    rows.push('direct,queue,2026-03-02T00:00:00Z');
    rows.push('direct,serve,2026-03-02T01:00:00Z');
    rows.push('detoured,queue,2026-03-02T00:00:00Z');
    rows.push('detoured,escalate,2026-03-02T00:30:00Z');
    rows.push('detoured,serve,2026-03-02T05:00:00Z');
    client = await load('spectrum-consecutive', rows);

    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
    });
    expect(spectrum.passages.map((p) => p.caseId)).toEqual(['direct']);
  });

  it('says how many it did not return', async () => {
    client = await queue('spectrum-cap', (i) => i + 2);
    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
      limit: 3,
    });

    expect(spectrum.passages).toHaveLength(3);
    expect(spectrum.totalPassages).toBe(8);
    expect(spectrum.truncated).toBe(true);
  });

  it('does not read a pattern into one passage', async () => {
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    rows.push('one,queue,2026-03-02T00:00:00Z');
    rows.push('one,serve,2026-03-02T01:00:00Z');
    client = await load('spectrum-one', rows);

    const spectrum = await performanceSpectrum(client, duckdbDialect, {
      objectType: 'case',
      fromActivity: 'queue',
      toActivity: 'serve',
    });
    expect(spectrum.reading).toContain('too few');
  });
});

describe('slow against complicated', () => {
  it('finds the cases that are slow without being complex', async () => {
    // Few steps and a long elapsed means waiting, not working — and that is a
    // queue, which is a different fix from a complicated case taking its time.
    client = await load('scatter', reworkRows());
    const scatter = await complexityScatter(client, duckdbDialect, {
      objectType: 'case',
      bins: 6,
    });

    expect(scatter.totalCases).toBe(10);
    // The three long-chase cases are the complex ones; the slow-and-simple
    // corner must not be made of them.
    expect(scatter.slowAndSimple.every((c) => c.events === 4)).toBe(true);
  });

  it('bins every case exactly once', async () => {
    client = await load('scatter2', reworkRows());
    const scatter = await complexityScatter(client, duckdbDialect, {
      objectType: 'case',
      bins: 6,
    });
    expect(scatter.cells.reduce((n, c) => n + c.cases, 0)).toBe(10);
  });

  it('answers an empty log with an empty grid rather than throwing', async () => {
    client = await load('scatter-empty', ['case:concept:name,concept:name,time:timestamp']);
    const scatter = await complexityScatter(client, duckdbDialect, { objectType: 'case' });

    expect(scatter.cells).toEqual([]);
    expect(scatter.totalCases).toBe(0);
    expect(scatter.slowAndSimple).toEqual([]);
  });
});
