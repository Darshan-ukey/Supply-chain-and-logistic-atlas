import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { behaviourLimits, metricTrend } from '../src/runtime/trend.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * A number with a trend behind it.
 *
 * The arithmetic is pinned against hand-worked answers, and then the readings
 * are checked — because the reading is what a person acts on, and the two ways
 * it can be wrong are opposite and both expensive. Calling ordinary variation a
 * change sends a team chasing noise. Missing a real shift because every point
 * still sits inside the limits is the failure control charts were invented for.
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

/** One case per day for `days`, each taking `hours(day)` hours end to end. */
async function daily(days: number, hours: (day: number) => number): Promise<SqlClient> {
  const path = join(dir, `trend-${days}-${hours(0)}.csv`);
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  for (let d = 0; d < days; d += 1) {
    const date = `2026-03-${String(2 + d).padStart(2, '0')}`;
    rows.push(`k${d},submit,${date}T00:00:00Z,alice`);
    rows.push(`k${d},approve,${date}T${String(hours(d)).padStart(2, '0')}:00:00Z,bob`);
  }
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('behaviour limits', () => {
  it('builds the limits from period-to-period movement', () => {
    // Nine tens and a thirty. Mean 12. Moving ranges are eight zeros and a 20,
    // so the mean moving range is 20/9, and the limits sit 2.66 of those away.
    const limits = behaviourLimits([10, 10, 10, 10, 10, 10, 10, 10, 10, 30], 'cycle')!;

    expect(limits.centre).toBe(12);
    expect(limits.meanMovingRange).toBeCloseTo(20 / 9, 10);
    expect(limits.upper).toBeCloseTo(12 + 2.66 * (20 / 9), 10);
    expect(limits.lower).toBeCloseTo(12 - 2.66 * (20 / 9), 10);
  });

  it('refuses to draw limits from two points', () => {
    // Limits from two points are arithmetic, not evidence: any third point is
    // outside them by construction and every period looks exceptional.
    expect(behaviourLimits([5, 9], 'cycle')).toBeNull();
    expect(behaviourLimits([5, 9, 7], 'cycle')).not.toBeNull();
  });

  it('never puts the lower limit below zero', () => {
    // A negative floor on a duration is an unreachable threshold, and reads as
    // though the process could be suspiciously fast.
    const limits = behaviourLimits([1, 40, 1, 40, 1, 40], 'cycle')!;
    expect(limits.lower).toBe(0);
  });

  it('ignores the periods that hold nothing', () => {
    // A quiet week is not a week with a value of zero.
    const withGaps = behaviourLimits([10, null, 10, null, 10, 30], 'cycle')!;
    const without = behaviourLimits([10, 10, 10, 30], 'cycle')!;
    expect(withGaps).toEqual(without);
  });
});

describe('what the series is telling you', () => {
  it('says nothing needs explaining when nothing does', async () => {
    // Ordinary wobble around a steady centre. The commonest case, and the one a
    // chart must not dramatise.
    client = await daily(14, (d) => 5 + (d % 3));
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    expect(trend.points.every((p) => !p.exceptional)).toBe(true);
    expect(trend.reading).toContain('ordinary');
  });

  it('flags a period that leaves the range the process normally holds', async () => {
    client = await daily(14, (d) => (d === 9 ? 20 : 4));
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    const flagged = trend.points.filter((p) => p.exceptional);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.value).toBe(20 * 3600);
    expect(trend.reading).toContain('worth explaining');
  });

  it('catches a shift where every single period still looks normal', async () => {
    // Ten days wobbling around five hours, then ten wobbling around eight. The
    // wobble matters: it gives the moving range something to measure, so the
    // limits are wide enough that no single day falls outside them. The step is
    // then invisible to the limits and visible only to the run rule — which is
    // the case control charts exist for, and the case a naive implementation
    // reports as calm.
    client = await daily(20, (d) => (d < 10 ? 4 : 7) + (d % 3));
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    expect(trend.reading).toContain('shifted');
  });

  it('does not call a flat line a shift', async () => {
    // Every point equals the centre. Read as "not above", every point counts as
    // below and the calmest possible series announces a change.
    client = await daily(12, () => 5);
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    expect(trend.reading).toContain('identical');
    expect(trend.points.every((p) => !p.exceptional)).toBe(true);
  });

  it('says when there is too little to judge', async () => {
    client = await daily(2, () => 5);
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    expect(trend.limits).toBeNull();
    expect(trend.reading).toContain('too few');
  });
});

describe('the series itself', () => {
  it('leaves a quiet period empty rather than calling it zero', async () => {
    // Two bursts a week apart. Drawing a line through the gap would show work
    // that never happened.
    const path = join(dir, 'trend-gap.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    for (const day of ['02', '03', '10', '11']) {
      rows.push(`g${day},submit,2026-03-${day}T00:00:00Z`);
      rows.push(`g${day},approve,2026-03-${day}T04:00:00Z`);
    }
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });

    expect(trend.points).toHaveLength(10);
    const empty = trend.points.filter((p) => p.value === null);
    expect(empty).toHaveLength(6);
    expect(empty.every((p) => p.n === 0)).toBe(true);
  });

  it('carries the count, so a spike on two cases can be seen for what it is', async () => {
    client = await daily(6, () => 5);
    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'cycle',
      granularity: 'day',
    });
    expect(trend.points.filter((p) => p.value !== null).every((p) => p.n === 1)).toBe(true);
  });

  it('counts arrivals by when work started and throughput by when it finished', async () => {
    // The two differ by exactly the cycle time, and reporting one as the other
    // hides a backlog.
    client = await daily(5, () => 5);
    const arrivals = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'arrivals',
      granularity: 'day',
    });
    const throughput = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'throughput',
      granularity: 'day',
    });

    expect(arrivals.unit).toBe('cases');
    expect(arrivals.points.reduce((n, p) => n + (p.value ?? 0), 0)).toBe(5);
    expect(throughput.points.reduce((n, p) => n + (p.value ?? 0), 0)).toBe(5);
  });

  it('measures rework as a share of effort', async () => {
    const path = join(dir, 'trend-rework.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    // Four events, one of which repeats an activity already done: a 25% share.
    rows.push('r,submit,2026-03-02T00:00:00Z');
    rows.push('r,review,2026-03-02T01:00:00Z');
    rows.push('r,review,2026-03-02T02:00:00Z');
    rows.push('r,approve,2026-03-02T03:00:00Z');
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const trend = await metricTrend(client, duckdbDialect, {
      objectType: 'case',
      metric: 'rework',
      granularity: 'day',
    });
    expect(trend.unit).toBe('share');
    expect(trend.points[0]?.value).toBeCloseTo(0.25, 10);
  });

  it('answers an empty log with an empty series rather than throwing', async () => {
    const path = join(dir, 'trend-empty.csv');
    await writeFile(path, 'case:concept:name,concept:name,time:timestamp\n', 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const trend = await metricTrend(client, duckdbDialect, { objectType: 'case' });
    expect(trend.points).toEqual([]);
    expect(trend.limits).toBeNull();
  });
});
