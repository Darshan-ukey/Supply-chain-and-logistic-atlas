import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { queueFormation, roster, seasonality } from '../src/runtime/seasonality.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * When work happens.
 *
 * The fixture is a shift: work arrives at nine and is handled at two, Monday to
 * Friday, for four weeks. Every cell is therefore known before the query runs.
 *
 * The failure worth guarding is the timezone. Bucketing a London log by UTC
 * hour is right in winter and an hour out all summer, which slides the morning
 * peak into the wrong bucket for half the year — and a heatmap that is wrong by
 * one column looks exactly like a heatmap that is right.
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

/** Four weeks of weekdays: arrive 09:00 UTC, handled 14:00 UTC. */
async function shifts(): Promise<SqlClient> {
  const path = join(dir, 'season-fixture.csv');
  const rows = ['case:concept:name,concept:name,time:timestamp,org:resource'];
  for (let week = 0; week < 4; week += 1) {
    for (let day = 0; day < 5; day += 1) {
      // 2026-03-02 is a Monday.
      const date = `2026-03-${String(2 + week * 7 + day).padStart(2, '0')}`;
      rows.push(`c${week}-${day},submit,${date}T09:00:00Z,alice`);
      rows.push(`c${week}-${day},review,${date}T14:00:00Z,bob`);
    }
  }
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('the weekday by hour grid', () => {
  it('returns every cell, including the empty ones', async () => {
    // An absent cell and a zero cell say different things, and "nobody worked
    // then" is the finding. A sparse grid makes the caller guess which it had.
    client = await shifts();
    const grid = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });

    expect(grid.cells).toHaveLength(7 * 24);
    expect(grid.cells.filter((c) => c.events === 0).length).toBeGreaterThan(0);
    expect(grid.total).toBe(40);
  });

  it('puts the work in the hours it happened, on the days it happened', async () => {
    client = await shifts();
    const grid = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });

    const busy = grid.cells
      .filter((c) => c.events > 0)
      .map((c) => `${c.weekday}@${c.hour}=${c.events}`);
    expect(busy).toEqual([
      '0@9=4', '0@14=4',
      '1@9=4', '1@14=4',
      '2@9=4', '2@14=4',
      '3@9=4', '3@14=4',
      '4@9=4', '4@14=4',
    ]);
  });

  it('leaves the weekend empty', async () => {
    client = await shifts();
    const grid = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });
    const weekend = grid.cells.filter((c) => c.weekday >= 5);

    expect(weekend).toHaveLength(2 * 24);
    expect(weekend.every((c) => c.events === 0)).toBe(true);
  });

  it('counts Monday as day zero, as a working calendar does', async () => {
    // Two weekday conventions in one engine would file Sunday's traffic under
    // Monday and nothing would look wrong.
    client = await shifts();
    const grid = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });
    expect(grid.peak?.weekday).toBe(0);
  });

  it('counts arrivals separately from all activity', async () => {
    client = await shifts();
    const starts = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
      measure: 'starts',
    });

    expect(starts.total).toBe(20);
    expect(starts.cells.filter((c) => c.events > 0).every((c) => c.hour === 9)).toBe(true);
    // Nothing precedes a case's first event, so there is no wait to report and
    // zero would be a claim rather than an absence.
    expect(starts.cells.every((c) => c.medianWaitSeconds === null)).toBe(true);
  });

  it('counts completions separately again', async () => {
    client = await shifts();
    const ends = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
      measure: 'ends',
    });

    expect(ends.total).toBe(20);
    expect(ends.cells.filter((c) => c.events > 0).every((c) => c.hour === 14)).toBe(true);
  });

  it('buckets by local wall time, not by the instant', async () => {
    // Asia/Kolkata is +05:30, so 09:00 UTC is 14:30 local and 14:00 UTC is
    // 19:30. A half-hour zone is where an offset table built from whole hours
    // silently goes wrong.
    client = await shifts();
    const grid = await seasonality(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'Asia/Kolkata',
    });

    const hours = [...new Set(grid.cells.filter((c) => c.events > 0).map((c) => c.hour))].sort(
      (a, b) => a - b,
    );
    expect(hours).toEqual([14, 19]);
  });

  it('answers an empty log with an empty grid rather than throwing', async () => {
    client = await openMemoryDuckDB();
    const path = join(dir, 'season-empty.csv');
    await writeFile(path, 'case:concept:name,concept:name,time:timestamp\n', 'utf8');
    await importCsv(client, duckdbDialect, { path });

    const grid = await seasonality(client, duckdbDialect, { objectType: 'case' });
    expect(grid.cells).toHaveLength(7 * 24);
    expect(grid.total).toBe(0);
    expect(grid.peak).toBeNull();
  });
});

describe('when the queue forms', () => {
  it('charges the wait to the hour the waiting ended', async () => {
    client = await shifts();
    const curve = await queueFormation(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });

    expect(curve.hours).toHaveLength(24);
    const waited = curve.hours.filter((h) => h.events > 0);
    expect(waited).toHaveLength(1);
    // 09:00 to 14:00 is five hours, every time.
    expect(waited[0]?.hour).toBe(14);
    expect(waited[0]?.medianWaitSeconds).toBe(5 * 3600);
  });

  it('ranks the worst hour by total waiting, not by the worst single case', async () => {
    // An hour that delays two thousand cases by ten minutes costs more than one
    // that delays three by an afternoon.
    client = await shifts();
    const curve = await queueFormation(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });

    expect(curve.worst?.hour).toBe(14);
    expect(curve.worst?.totalWaitSeconds).toBe(20 * 5 * 3600);
  });

  it('says nothing waited rather than naming an arbitrary hour', async () => {
    client = await openMemoryDuckDB();
    const path = join(dir, 'season-single.csv');
    await writeFile(
      path,
      'case:concept:name,concept:name,time:timestamp\nx,only,2026-03-02T09:00:00Z\n',
      'utf8',
    );
    await importCsv(client, duckdbDialect, { path });

    const curve = await queueFormation(client, duckdbDialect, { objectType: 'case' });
    expect(curve.worst).toBeNull();
  });
});

describe('who works when', () => {
  it('places each person in the hours they actually recorded', async () => {
    client = await shifts();
    const sheet = await roster(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
    });

    expect(sheet.resources.map((r) => r.resource).sort()).toEqual(['alice', 'bob']);
    expect(sheet.resources.every((r) => r.events === 20)).toBe(true);

    const hoursOf = (who: string) =>
      [...new Set(sheet.cells.filter((c) => c.resource === who).map((c) => c.hour))];
    expect(hoursOf('alice')).toEqual([9]);
    expect(hoursOf('bob')).toEqual([14]);
  });

  it('keeps only the busiest people when asked', async () => {
    client = await shifts();
    const sheet = await roster(client, duckdbDialect, {
      objectType: 'case',
      timezone: 'UTC',
      limit: 1,
    });

    expect(sheet.resources).toHaveLength(1);
    // The cells follow the people, or the caller draws rows for names it was
    // never given.
    expect(new Set(sheet.cells.map((c) => c.resource)).size).toBe(1);
  });
});
