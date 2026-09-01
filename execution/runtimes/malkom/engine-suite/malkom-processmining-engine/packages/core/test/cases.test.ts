import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { ConfigInvalidError } from '../src/domain/errors.js';
import { summariseLog } from '../src/runtime/summary.js';
import { caseTimeline, listCases, type CaseSort, type SortDirection } from '../src/runtime/cases.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * The case explorer.
 *
 * Two things here are worth more than the rest. Paging must visit every case
 * exactly once — a keyset cursor that is subtly wrong does not error, it
 * silently skips or repeats rows, and a list that quietly omits cases is worse
 * than no list. And a case with no recorded cost must never sort as the
 * cheapest, because "nobody costed this" and "this was free" call for opposite
 * responses.
 */

const CASE_COUNT = 40;
const STEPS = ['submit', 'review', 'decide'];

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
 * 40 cases of three steps each, every one a different length.
 *
 * Case i spans (i+1) x 120 seconds, so no two cases tie on duration and a wrong
 * sort cannot coincidentally look right. Even-numbered cases carry a cost and
 * odd-numbered ones carry none, which is what puts a real null boundary in the
 * middle of the cost ordering.
 */
async function fixture(): Promise<SqlClient> {
  const path = join(dir, 'cases-fixture.csv');
  const base = Date.parse('2026-04-01T00:00:00Z');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource,case:channel'];

  for (let i = 0; i < CASE_COUNT; i += 1) {
    const id = `k${String(i).padStart(2, '0')}`;
    const gap = (i + 1) * 60_000;
    STEPS.forEach((activity, s) => {
      const ts = new Date(base + i * 86_400_000 + s * gap).toISOString();
      lines.push(`${id},${activity},${ts},worker${s % 3},${i % 2 === 0 ? 'web' : 'phone'}`);
    });
  }

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });

  // Cost is not a CSV role, so it is written directly. Every event of an
  // even-numbered case costs 10; the rest stay null.
  await c.execute(
    `UPDATE malkom_events SET cost = 10 WHERE event_id IN (
       SELECT event_id FROM malkom_event_objects
       WHERE object_type = 'case' AND CAST(SUBSTR(object_id, 2) AS INTEGER) % 2 = 0)`,
    [],
  );
  return c;
}

/** Walk every page, returning the ids in the order they were served. */
async function walk(
  sort: CaseSort,
  direction: SortDirection,
  limit: number,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;

  // A bound that cannot be reached by correct paging: hitting it means the
  // cursor stopped advancing, which is the failure mode worth failing loudly on.
  while (pages < CASE_COUNT + 5) {
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      capabilities: { cost: true },
      sort,
      direction,
      limit,
      ...(cursor !== undefined ? { cursor } : {}),
    });
    pages += 1;
    ids.push(...page.cases.map((c) => c.caseId));
    if (page.nextCursor === null) return { ids, pages };
    cursor = page.nextCursor;
  }
  throw new Error('paging did not terminate');
}

describe('listing cases', () => {
  it('counts every case in the selection, not just the page', async () => {
    client = await fixture();
    const page = await listCases(client, duckdbDialect, { objectType: 'case', limit: 5 });

    expect(page.cases).toHaveLength(5);
    expect(page.total).toBe(CASE_COUNT);
    expect(page.nextCursor).not.toBeNull();
  });

  it('agrees with the log summary about how many cases there are', async () => {
    client = await fixture();
    const [page, summary] = await Promise.all([
      listCases(client, duckdbDialect, { objectType: 'case', limit: 1 }),
      summariseLog(client, duckdbDialect, { objectType: 'case' }),
    ]);
    expect(page.total).toBe(summary.cases);
  });

  it('rolls a case up to the figures a list needs', async () => {
    client = await fixture();
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      sort: 'duration',
      direction: 'desc',
      limit: 1,
    });

    const longest = page.cases[0];
    expect(longest?.caseId).toBe('k39');
    // Case 39 spans two gaps of 40 x 60s.
    expect(longest?.cycleSeconds).toBe(4800);
    expect(longest?.events).toBe(3);
    expect(longest?.activities).toBe(3);
    expect(longest?.resources).toBe(3);
  });

  it('orders shortest first when asked to', async () => {
    client = await fixture();
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      sort: 'duration',
      direction: 'asc',
      limit: 1,
    });
    expect(page.cases[0]?.caseId).toBe('k00');
    expect(page.cases[0]?.cycleSeconds).toBe(120);
  });

  it('narrows to the filtered selection, total included', async () => {
    client = await fixture();
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'attribute', key: 'channel', value: 'web' },
    });
    expect(page.total).toBe(CASE_COUNT / 2);
    expect(page.cases.every((c) => Number(c.caseId.slice(1)) % 2 === 0)).toBe(true);
  });
});

describe('paging', () => {
  it('visits every case exactly once', async () => {
    client = await fixture();
    const { ids, pages } = await walk('duration', 'desc', 7);

    expect(ids).toHaveLength(CASE_COUNT);
    expect(new Set(ids).size).toBe(CASE_COUNT);
    // 40 cases at 7 a page is six pages, and the last is a short one.
    expect(pages).toBe(6);
  });

  it('serves pages in the requested order', async () => {
    client = await fixture();
    const { ids } = await walk('duration', 'desc', 7);
    expect(ids[0]).toBe('k39');
    expect(ids.at(-1)).toBe('k00');
  });

  it('holds up at a page size of one', async () => {
    client = await fixture();
    const { ids } = await walk('duration', 'asc', 1);
    expect(ids).toHaveLength(CASE_COUNT);
    expect(new Set(ids).size).toBe(CASE_COUNT);
    expect(ids[0]).toBe('k00');
  });

  it('ends without a cursor when the last page is exactly full', async () => {
    client = await fixture();
    // 40 cases at 10 a page divides evenly — the case where an off-by-one in
    // the look-ahead row shows up as a phantom empty page.
    const { ids, pages } = await walk('duration', 'desc', 10);
    expect(pages).toBe(4);
    expect(ids).toHaveLength(CASE_COUNT);
  });

  it('visits every case when paging by a measure half the log lacks', async () => {
    client = await fixture();
    const { ids } = await walk('cost', 'desc', 6);
    expect(ids).toHaveLength(CASE_COUNT);
    expect(new Set(ids).size).toBe(CASE_COUNT);
  });

  it('pages by start and by end without losing anyone', async () => {
    client = await fixture();
    for (const sort of ['start', 'end', 'events'] as const) {
      const { ids } = await walk(sort, 'desc', 9);
      expect(new Set(ids).size, `paging by ${sort}`).toBe(CASE_COUNT);
    }
  });

  it('refuses a cursor it did not issue', async () => {
    client = await fixture();
    await expect(
      listCases(client, duckdbDialect, { objectType: 'case', cursor: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(ConfigInvalidError);
  });
});

describe('a case with nothing recorded against it', () => {
  it('sorts uncosted cases last, whichever way the list runs', async () => {
    client = await fixture();

    for (const direction of ['desc', 'asc'] as const) {
      const page = await listCases(client, duckdbDialect, {
        objectType: 'case',
        capabilities: { cost: true },
        sort: 'cost',
        direction,
        limit: CASE_COUNT,
      });

      const firstNull = page.cases.findIndex((c) => c.cost === null);
      // Exactly half the log is costed, so the boundary lands in one place.
      expect(firstNull, `nulls last when ${direction}`).toBe(CASE_COUNT / 2);
      expect(page.cases.slice(0, firstNull).every((c) => c.cost === 30)).toBe(true);
      expect(page.cases.slice(firstNull).every((c) => c.cost === null)).toBe(true);
    }
  });

  it('reports an absent cost as null rather than as zero', async () => {
    client = await fixture();
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      capabilities: { cost: true },
      sort: 'cost',
      direction: 'desc',
      limit: CASE_COUNT,
    });

    const costed = page.cases.filter((c) => c.cost !== null);
    expect(costed).toHaveLength(CASE_COUNT / 2);
    // Three events at 10 each.
    expect(costed.every((c) => c.cost === 30)).toBe(true);
    expect(page.cases.filter((c) => c.cost === 0)).toHaveLength(0);
  });
});

describe('one case, step by step', () => {
  it('returns the steps in the order they happened', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'k05', { objectType: 'case' });

    expect(timeline.caseId).toBe('k05');
    expect(timeline.steps.map((s) => s.activity)).toEqual(STEPS);
    expect(timeline.events).toBe(3);
    expect(timeline.truncated).toBe(false);
  });

  it('reports the wait before each step, and none before the first', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'k05', { objectType: 'case' });

    // Nothing preceded the first step: null, not a wait of zero.
    expect(timeline.steps[0]?.waitingSeconds).toBeNull();
    // Case 5's gap is 6 x 60s, and no handling time is recorded to subtract.
    expect(timeline.steps[1]?.waitingSeconds).toBe(360);
    expect(timeline.steps[2]?.waitingSeconds).toBe(360);
    expect(timeline.waitingSeconds).toBe(720);
  });

  it('carries the case attributes alongside the steps', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'k04', { objectType: 'case' });
    expect(timeline.attributes).toContainEqual({ key: 'channel', value: 'web' });
  });

  it('agrees with the list about the case it describes', async () => {
    client = await fixture();
    const [page, timeline] = await Promise.all([
      listCases(client, duckdbDialect, {
        objectType: 'case',
        sort: 'duration',
        direction: 'desc',
        limit: 1,
      }),
      caseTimeline(client, duckdbDialect, 'k39', { objectType: 'case' }),
    ]);
    expect(timeline.cycleSeconds).toBe(page.cases[0]?.cycleSeconds);
    expect(timeline.events).toBe(page.cases[0]?.events);
  });

  it('says when it has shown fewer steps than the case has', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'k05', {
      objectType: 'case',
      limit: 2,
    });

    expect(timeline.steps).toHaveLength(2);
    // The count is of the case, not of the page — otherwise truncation is invisible.
    expect(timeline.events).toBe(3);
    expect(timeline.truncated).toBe(true);
  });

  it('reports an unknown case as empty rather than failing', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'no-such-case', {
      objectType: 'case',
    });

    expect(timeline.steps).toEqual([]);
    expect(timeline.events).toBe(0);
    expect(timeline.firstEvent).toBeNull();
    expect(timeline.cycleSeconds).toBeNull();
  });

  it('shows only the steps the current selection includes', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'k05', {
      objectType: 'case',
      window: { from: new Date(Date.parse('2026-04-06T00:05:00Z')) },
    });

    // The submit at 00:00 falls outside the window; the trace starts at review.
    expect(timeline.steps.map((s) => s.activity)).toEqual(['review', 'decide']);
    expect(timeline.steps[0]?.waitingSeconds).toBeNull();
  });
});
