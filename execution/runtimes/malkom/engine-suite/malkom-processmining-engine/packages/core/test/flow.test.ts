import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import {
  bucketRange,
  cumulativeFlow,
  littlesLaw,
  openCaseAging,
} from '../src/runtime/flow.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Where the work is.
 *
 * The fixture is a conveyor belt: one case starts every day and takes exactly
 * two days to cross two stages. That makes every number here knowable in
 * advance — steady-state work in progress is two, one case at each stage — and
 * it makes Little's law an independent check rather than a restatement, because
 * the cycle time is measured from the cases and the work in progress is
 * measured from the arrivals and departures, and the two must agree.
 *
 * The failure this guards is quiet and specific. A case's last event has no
 * successor. Counted as an arrival with no matching departure, every finished
 * case stays stacked on its final step forever, and the chart shows a growing
 * backlog that is really just accumulated history. It renders perfectly.
 */

const DAY = 86_400;
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

/** Ten cases, one starting each day, each three steps on three consecutive days. */
async function conveyor(): Promise<SqlClient> {
  const path = join(dir, 'flow-fixture.csv');
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  const at = (n: number): string => `2026-03-${String(n).padStart(2, '0')}T12:00:00Z`;
  for (let i = 0; i < 10; i += 1) {
    rows.push(`k${i},submit,${at(1 + i)},alice`);
    rows.push(`k${i},review,${at(2 + i)},bob`);
    rows.push(`k${i},done,${at(3 + i)},carol`);
  }
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('work in progress by stage', () => {
  it('holds a steady level on a steady process', async () => {
    client = await conveyor();
    const flow = await cumulativeFlow(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });

    // One case at submit and one at review, every day of the steady middle.
    const steady = flow.intervals.slice(2, 10);
    for (const interval of steady) expect(interval.wip).toBe(2);
    expect(steady[0]?.stages.map((s) => `${s.activity}:${s.cases}`).sort()).toEqual([
      'review:1',
      'submit:1',
    ]);
  });

  it('does not park finished cases on their last step forever', async () => {
    // The bug this file exists for. A case's final event has no successor; if
    // it is counted as an arrival anyway, nothing ever departs and the level
    // climbs by one per case for the length of the log.
    client = await conveyor();
    const flow = await cumulativeFlow(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });

    expect(flow.intervals.at(-1)?.wip).toBe(0);
    expect(flow.backlogGrowing).toBe(false);
    // 'done' is nobody's waypoint, so it is not a stage anything occupies.
    expect(flow.activities).not.toContain('done');
  });

  it('rises and falls with the work', async () => {
    client = await conveyor();
    const flow = await cumulativeFlow(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });
    const levels = flow.intervals.map((i) => i.wip);

    expect(levels[0]).toBe(1); // first case arrives
    expect(Math.max(...levels)).toBe(2);
    expect(levels.at(-1)).toBe(0); // everything drains
  });

  it('counts a case arriving once, not once per step', async () => {
    client = await conveyor();
    const flow = await cumulativeFlow(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });

    expect(flow.intervals.reduce((n, i) => n + i.arrived, 0)).toBe(10);
    expect(flow.intervals.reduce((n, i) => n + i.completed, 0)).toBe(10);
  });

  it('returns every interval between the ends, gaps included', async () => {
    // A quiet week is a finding. Closing the gap would draw continuous work.
    client = await conveyor();
    const flow = await cumulativeFlow(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });

    expect(flow.intervals).toHaveLength(12); // 1 March to 12 March inclusive
    for (let i = 1; i < flow.intervals.length; i += 1) {
      const gap = flow.intervals[i]!.at.getTime() - flow.intervals[i - 1]!.at.getTime();
      expect(gap).toBe(DAY * 1000);
    }
  });

  it('answers an empty log with an empty series rather than throwing', async () => {
    client = await openMemoryDuckDB();
    const path = join(dir, 'flow-empty.csv');
    await writeFile(path, 'case:concept:name,concept:name,time:timestamp\n', 'utf8');
    await importCsv(client, duckdbDialect, { path });

    const flow = await cumulativeFlow(client, duckdbDialect, { objectType: 'case' });
    expect(flow.intervals).toEqual([]);
    expect(flow.activities).toEqual([]);
  });
});

describe("Little's law as a check on the log", () => {
  it('holds on a log that records whole cases', async () => {
    // WIP measured from arrivals and departures; cycle time measured from the
    // cases themselves. Two independent paths, and the identity says they agree.
    client = await conveyor();
    const law = await littlesLaw(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });

    expect(law.cycleIntervals).toBe(2);
    expect(law.ratio).toBeCloseTo(1, 5);
    expect(law.reading).toContain('holds');
  });

  it('says the log is clipped when it plainly is', async () => {
    // Only the tail of each case survives the window, so cases complete having
    // never been seen to arrive. That is a data finding, not a process one.
    client = await conveyor();
    const law = await littlesLaw(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
      window: { from: new Date('2026-03-08T00:00:00Z') },
    });

    expect(law.ratio).not.toBeNull();
    expect(law.ratio!).toBeLessThan(1);
    expect(law.reading).toContain('starts mid-process');
  });
});

describe('open cases, by age', () => {
  const asOf = (iso: string) => new Date(iso);

  it('counts the work actually in flight at that instant', async () => {
    client = await conveyor();
    const aging = await openCaseAging(client, duckdbDialect, {
      objectType: 'case',
      now: asOf('2026-03-05T12:00:00Z'),
      openCases: { kind: 'missing-end-activity', endActivities: ['done'] },
    });

    // The same two the flow chart has in progress, reached a different way.
    expect(aging.openCases).toBe(2);
    expect(aging.oldest.map((o) => o.lastActivity).sort()).toEqual(['review', 'submit']);
  });

  it('does not let tomorrow close a case today', async () => {
    // Every case eventually performs 'done'. Asked of the raw log rather than
    // the log as of `now`, that closes all of them and reports nothing open —
    // a historical evaluation flattering itself with events that had not
    // happened yet.
    client = await conveyor();
    const aging = await openCaseAging(client, duckdbDialect, {
      objectType: 'case',
      now: asOf('2026-03-05T12:00:00Z'),
      openCases: { kind: 'missing-end-activity', endActivities: ['done'] },
    });

    expect(aging.openCases).toBeGreaterThan(0);
  });

  it('marks the ones past their deadline', async () => {
    client = await conveyor();
    const aging = await openCaseAging(client, duckdbDialect, {
      objectType: 'case',
      now: asOf('2026-03-05T12:00:00Z'),
      openCases: { kind: 'missing-end-activity', endActivities: ['done'] },
      slaSeconds: DAY / 2,
    });

    expect(aging.buckets.reduce((n, b) => n + b.breaching, 0)).toBe(2);
  });

  it('states how open was decided', async () => {
    // A log is a snapshot. A number of open cases with no rule beside it reads
    // as live operational truth when it may be nothing of the kind.
    client = await conveyor();
    const aging = await openCaseAging(client, duckdbDialect, {
      objectType: 'case',
      now: asOf('2026-03-05T12:00:00Z'),
      openCases: { kind: 'missing-end-activity', endActivities: ['done'] },
    });

    expect(aging.openCaseRule).toContain('done');
  });
});

describe('bucketing time', () => {
  it('steps a day at a time, inclusive of both ends', () => {
    const buckets = bucketRange(
      new Date('2026-03-01T09:00:00Z'),
      new Date('2026-03-03T23:00:00Z'),
      'day',
    );
    expect(buckets.map((d) => d.toISOString())).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-03-02T00:00:00.000Z',
      '2026-03-03T00:00:00.000Z',
    ]);
  });

  it('starts a week on Monday, as both dialects do', () => {
    // 2026-03-04 is a Wednesday.
    const buckets = bucketRange(
      new Date('2026-03-04T00:00:00Z'),
      new Date('2026-03-04T00:00:00Z'),
      'week',
    );
    expect(buckets[0]?.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('steps months without drifting through the short ones', () => {
    const buckets = bucketRange(
      new Date('2026-01-31T00:00:00Z'),
      new Date('2026-04-01T00:00:00Z'),
      'month',
    );
    expect(buckets.map((d) => d.toISOString().slice(0, 7))).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });
});
