import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { ConfigInvalidError } from '../src/domain/errors.js';
import {
  UNGROUPED,
  binEdges,
  groupedDistribution,
  traceLengths,
} from '../src/runtime/distribution.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Describing a spread.
 *
 * The fixture gives each case a different, known duration, so every quantile
 * has an answer worked out in advance rather than one read back from the
 * implementation.
 *
 * The quartiles are the reason this exists. A box plot's box is p25 to p75, and
 * the engine computed p50, p90 and p95 only — so every "box plot" drawn against
 * it would have been a box drawn from the wrong numbers, which looks exactly
 * like a box drawn from the right ones.
 */

const HOUR = 3600;
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
 * Twelve cases. Case i takes (i+1) hours end to end, so the durations are
 * 1h..12h and every quantile is a number that can be named.
 *
 * Half are 'web' and half are 'phone', interleaved, so the two cohorts have
 * different but overlapping spreads.
 */
async function spread(): Promise<SqlClient> {
  const path = join(dir, 'dist-fixture.csv');
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource,case:channel'];
  for (let i = 0; i < 12; i += 1) {
    const day = String(2 + i).padStart(2, '0');
    const channel = i % 2 === 0 ? 'web' : 'phone';
    rows.push(`c${i},submit,2026-03-${day}T00:00:00Z,alice,${channel}`);
    const end = String(i + 1).padStart(2, '0');
    rows.push(`c${i},approve,2026-03-${day}T${end}:00:00Z,bob,${channel}`);
  }
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('the numbers a box plot is drawn from', () => {
  it('reports the quartiles, which are the box', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
    });
    const values = report.groups[0]!.values;

    // Durations 1h..12h. Interpolated quartiles land at 3.75h and 9.25h.
    expect(values.count).toBe(12);
    expect(values.min).toBe(1 * HOUR);
    expect(values.max).toBe(12 * HOUR);
    expect(values.p25).toBeCloseTo(3.75 * HOUR, 5);
    expect(values.p50).toBeCloseTo(6.5 * HOUR, 5);
    expect(values.p75).toBeCloseTo(9.25 * HOUR, 5);
  });

  it('keeps the upper percentiles too, because a box is not an SLA', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
    });
    const values = report.groups[0]!.values;

    expect(values.p90).not.toBeNull();
    expect(values.p95).not.toBeNull();
    expect(values.p90!).toBeGreaterThan(values.p75!);
  });

  it('names the single population rather than leaving it blank', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
    });
    expect(report.groups[0]!.group).toBe(UNGROUPED);
    expect(report.groupedBy).toBe('none');
  });
});

describe('splitting a population', () => {
  it('splits per case by a case attribute', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
      groupBy: { kind: 'attribute', key: 'channel' },
    });

    expect(report.groups.map((g) => g.group).sort()).toEqual(['phone', 'web']);
    for (const group of report.groups) expect(group.values.count).toBe(6);
    // web is cases 0,2,4,6,8,10 → 1,3,5,7,9,11 hours; phone is 2,4,6,8,10,12.
    const web = report.groups.find((g) => g.group === 'web')!;
    const phone = report.groups.find((g) => g.group === 'phone')!;
    expect(web.values.min).toBe(1 * HOUR);
    expect(phone.values.min).toBe(2 * HOUR);
  });

  it('splits per event by activity', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'waiting',
      groupBy: { kind: 'activity' },
    });

    // Only 'approve' has anything before it; 'submit' opens every case, and a
    // first event has no wait rather than a wait of zero.
    expect(report.groups.map((g) => g.group)).toEqual(['approve']);
    expect(report.groups[0]!.values.count).toBe(12);
  });

  it('splits per event by person', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'waiting',
      groupBy: { kind: 'resource' },
    });
    expect(report.groups.map((g) => g.group)).toEqual(['bob']);
  });

  it('splits per case by route', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
      groupBy: { kind: 'variant' },
    });

    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]!.group).toContain('submit');
    expect(report.groups[0]!.group).toContain('approve');
  });

  it('refuses a grouping that has no honest answer', async () => {
    // Cycle time is one number per case; a case touched by four people would
    // have to be counted four times or attributed to one of them arbitrarily.
    client = await spread();
    await expect(
      groupedDistribution(client, duckdbDialect, {
        objectType: 'case',
        measure: 'cycle',
        groupBy: { kind: 'resource' },
      }),
    ).rejects.toThrow(ConfigInvalidError);
  });

  it('drops groups too small to describe, and says how many', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
      groupBy: { kind: 'attribute', key: 'channel' },
      minObservations: 7,
    });

    expect(report.groups).toEqual([]);
    // Silently returning nothing would read as "no such data".
    expect(report.omittedGroups).toBe(2);
  });
});

describe('the shape, for a violin or a ridgeline', () => {
  it('returns no bins unless asked, and says so with null', async () => {
    // Null rather than empty: "not asked" and "asked, everything in one bar"
    // are different answers.
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
    });
    expect(report.groups[0]!.bins).toBeNull();
  });

  it('bins every observation exactly once', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
      bins: 6,
    });
    const bins = report.groups[0]!.bins!;

    expect(bins).toHaveLength(6);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(12);
  });

  it('bins each group over its own range, so a fast step still has a shape', async () => {
    client = await spread();
    const report = await groupedDistribution(client, duckdbDialect, {
      objectType: 'case',
      measure: 'cycle',
      groupBy: { kind: 'attribute', key: 'channel' },
      bins: 4,
    });

    for (const group of report.groups) {
      expect(group.bins!.reduce((n, b) => n + b.count, 0)).toBe(6);
      expect(group.bins![0]!.from).toBeCloseTo(group.values.min!, 5);
    }
  });
});

describe('bucket edges', () => {
  it('grows geometrically when asked, so a long tail is readable', () => {
    const edges = binEdges(1, 1000, 3, true);
    expect(edges).toHaveLength(4);
    expect(edges[0]).toBeCloseTo(1, 6);
    expect(edges[3]).toBeCloseTo(1000, 6);

    // Equal ratios on the SHIFTED scale, which is where the progression lives:
    // the edges are exp(evenly spaced in log(v + 1)) - 1, because log(0) is
    // undefined and a zero-second duration is ordinary in a real log. Checking
    // raw ratios instead would fail while the spacing was perfectly correct.
    const ratios = [1, 2, 3].map((i) => (edges[i]! + 1) / (edges[i - 1]! + 1));
    expect(ratios[0]).toBeCloseTo(ratios[1]!, 6);
    expect(ratios[1]).toBeCloseTo(ratios[2]!, 6);
  });

  it('survives a zero, which a real log is full of', () => {
    // log(0) is undefined and a zero-second duration is ordinary.
    const edges = binEdges(0, 100, 4, true);
    expect(edges).toHaveLength(5);
    expect(edges.every((e) => Number.isFinite(e))).toBe(true);
    expect(edges[0]).toBeCloseTo(0, 10);
  });

  it('survives every value being identical', () => {
    const edges = binEdges(5, 5, 10, true);
    expect(edges.every((e) => Number.isFinite(e))).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('how many steps a case takes', () => {
  it('counts cases per length, one bucket per length', async () => {
    client = await spread();
    const lengths = await traceLengths(client, duckdbDialect, { objectType: 'case' });

    expect(lengths.buckets).toEqual([{ events: 2, cases: 12 }]);
    expect(lengths.distribution.p50).toBe(2);
  });

  it('leaves no gap in the middle of the axis', async () => {
    // A length nobody produced is a zero bar, not a missing one — the gap is
    // the finding.
    const path = join(dir, 'dist-gappy.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    rows.push('short,a,2026-03-02T00:00:00Z');
    for (let i = 0; i < 4; i += 1) rows.push(`long,s${i},2026-03-02T0${i}:00:00Z`);
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const lengths = await traceLengths(client, duckdbDialect, { objectType: 'case' });
    expect(lengths.buckets.map((b) => b.events)).toEqual([1, 2, 3, 4]);
    expect(lengths.buckets.filter((b) => b.cases === 0).map((b) => b.events)).toEqual([2, 3]);
  });

  it('calls out single-event cases, which are usually a data fault', async () => {
    const path = join(dir, 'dist-singles.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    for (let i = 0; i < 3; i += 1) rows.push(`s${i},only,2026-03-02T00:00:00Z`);
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const lengths = await traceLengths(client, duckdbDialect, { objectType: 'case' });
    expect(lengths.singleEventCases).toBe(3);
  });

  it('describes the lengths without expanding them into a list', async () => {
    client = await spread();
    const lengths = await traceLengths(client, duckdbDialect, { objectType: 'case' });

    expect(lengths.distribution.count).toBe(12);
    expect(lengths.distribution.mean).toBe(2);
    expect(lengths.distribution.total).toBe(24);
  });

  it('answers an empty log with empty buckets rather than throwing', async () => {
    const path = join(dir, 'dist-empty.csv');
    await writeFile(path, 'case:concept:name,concept:name,time:timestamp\n', 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const lengths = await traceLengths(client, duckdbDialect, { objectType: 'case' });
    expect(lengths.buckets).toEqual([]);
    expect(lengths.distribution.count).toBe(0);
  });
});
