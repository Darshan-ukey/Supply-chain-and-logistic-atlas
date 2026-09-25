import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { businessCalendarSchema, type BusinessCalendar } from '../src/runtime/calendar.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { analysePerformance } from '../src/runtime/performance.js';
import { analyseVariants } from '../src/runtime/variants.js';
import { listCases, caseTimeline } from '../src/runtime/cases.js';
import { analyseOrganizational } from '../src/runtime/organizational.js';
import { parseCalendarSpec } from '../src/http/specs.js';
import { createRouter, type MiningRequest, type MiningResponse } from '../src/http/router.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * The working-hours clock, where it actually shows up.
 *
 * `calendar.test.ts` pins the arithmetic. This checks the wiring: that a
 * configured calendar reaches every duration the engine reports, and that no
 * duration is left measuring on the other clock.
 *
 * The whole existing suite runs with no calendar and is the other half of the
 * proof — those 600-odd known answers are what says the clock is inert until
 * somebody asks for it.
 */

const OFFICE: BusinessCalendar = businessCalendarSchema.parse({
  timezone: 'Europe/London',
  workingDays: [0, 1, 2, 3, 4],
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  holidays: [],
});

const HOURS = 3600;

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
 * Two cases that do the same work, one across a weekend and one inside a week.
 *
 * `weekend` runs Friday 16:00 → Monday 10:00: 66 wall-clock hours, but two
 * working hours, since the office shut at five on Friday and opened at nine on
 * Monday. `weekday` runs Tuesday 10:00 → Wednesday 15:00: 29 wall-clock hours
 * and 13 working hours.
 *
 * The pair is chosen so the two cases swap places. On wall-clock the weekend
 * case is the slower of the two by a wide margin; on the working clock it is
 * the faster. Anything still measuring on the old clock keeps the old order,
 * which is a failure a threshold test would not catch.
 */
async function fixture(): Promise<SqlClient> {
  const path = join(dir, 'working-hours.csv');
  const rows: string[] = [
    'case:concept:name,concept:name,time:timestamp,org:resource',
    // Friday
    'weekend,submit,2026-03-06T16:00:00Z,alice',
    // Monday
    'weekend,approve,2026-03-09T10:00:00Z,bob',
    // Tuesday
    'weekday,submit,2026-03-03T10:00:00Z,alice',
    // Wednesday
    'weekday,approve,2026-03-04T15:00:00Z,bob',
  ];
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

const WALL_WEEKEND = 66 * HOURS;
const WALL_WEEKDAY = 29 * HOURS;
const WORK_WEEKEND = 2 * HOURS;
const WORK_WEEKDAY = 13 * HOURS;

describe('a calendar changes what gets reported', () => {
  it('measures an arc across a weekend in working hours', async () => {
    client = await fixture();
    const wall = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const work = await buildDfg(client, duckdbDialect, { objectType: 'case', calendar: OFFICE });

    const arc = (d: Awaited<ReturnType<typeof buildDfg>>) =>
      d.edges.find((e) => e.from === 'submit' && e.to === 'approve')!;

    // Both cases share the arc, so its median is the mean of the two.
    expect(arc(wall).medianSeconds).toBe((WALL_WEEKEND + WALL_WEEKDAY) / 2);
    expect(arc(work).medianSeconds).toBe((WORK_WEEKEND + WORK_WEEKDAY) / 2);
  });

  it('re-orders a variant ranking rather than merely rescaling it', async () => {
    client = await fixture();
    const wall = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    const work = await analyseVariants(client, duckdbDialect, {
      objectType: 'case',
      calendar: OFFICE,
    });

    // One variant, both cases: the median is the midpoint either way, and it
    // is the figure a reader would act on.
    expect(wall.variants[0]?.medianCycleSeconds).toBe((WALL_WEEKEND + WALL_WEEKDAY) / 2);
    expect(work.variants[0]?.medianCycleSeconds).toBe((WORK_WEEKEND + WORK_WEEKDAY) / 2);
  });

  it('swaps which case is the slowest', async () => {
    client = await fixture();
    const slowestOn = async (calendar?: BusinessCalendar): Promise<string | undefined> => {
      const page = await listCases(client, duckdbDialect, {
        objectType: 'case',
        sort: 'duration',
        direction: 'desc',
        limit: 10,
        ...(calendar !== undefined ? { calendar } : {}),
      });
      return page.cases[0]?.caseId;
    };

    expect(await slowestOn()).toBe('weekend');
    expect(await slowestOn(OFFICE)).toBe('weekday');
  });

  it('charges a case nothing for the weekend it sat through', async () => {
    client = await fixture();
    const timeline = await caseTimeline(client, duckdbDialect, 'weekend', {
      objectType: 'case',
      calendar: OFFICE,
    });

    expect(timeline.cycleSeconds).toBe(WORK_WEEKEND);
    // The step that spans the weekend: two working hours of waiting, not 66.
    expect(timeline.steps[1]?.waitingSeconds).toBe(WORK_WEEKEND);
  });

  it('ranks bottlenecks on working time', async () => {
    client = await fixture();
    const work = await analysePerformance(client, duckdbDialect, {
      objectType: 'case',
      calendar: OFFICE,
    });
    const wall = await analysePerformance(client, duckdbDialect, { objectType: 'case' });

    expect(wall.cases.cycleTime.p50).toBe((WALL_WEEKEND + WALL_WEEKDAY) / 2);
    expect(work.cases.cycleTime.p50).toBe((WORK_WEEKEND + WORK_WEEKDAY) / 2);

    // The waiting figure is what a bottleneck is ranked on, and it is derived
    // from the cycle time rather than measured separately.
    expect(work.cases.waitingTime.total).toBe(WORK_WEEKEND + WORK_WEEKDAY);
  });

  it('prices a handover in working time', async () => {
    client = await fixture();
    const work = await analyseOrganizational(client, duckdbDialect, {
      objectType: 'case',
      calendar: OFFICE,
    });
    const handover = work.handovers.find((h) => h.from === 'alice' && h.to === 'bob')!;

    // alice hands to bob in both cases: two working hours and thirteen.
    expect(handover.totalWaitSeconds).toBe(WORK_WEEKEND + WORK_WEEKDAY);
  });

  it('selects on the same clock it reports on', async () => {
    client = await fixture();
    // Under three working hours picks out the weekend case alone; on wall-clock
    // the same threshold picks out neither. A filter measuring on one clock
    // while the report measures on the other is the subtlest way to be wrong.
    const page = await listCases(client, duckdbDialect, {
      objectType: 'case',
      calendar: OFFICE,
      filter: { kind: 'cycleTime', maxSeconds: 3 * HOURS },
      limit: 10,
    });
    expect(page.cases.map((c) => c.caseId)).toEqual(['weekend']);

    const wallClock = await listCases(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'cycleTime', maxSeconds: 3 * HOURS },
      limit: 10,
    });
    expect(wallClock.cases).toEqual([]);
  });
});

describe('leaving the figures alone when nobody asked', () => {
  it('reports the wall-clock answer with no calendar', async () => {
    client = await fixture();
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const arc = dfg.edges.find((e) => e.from === 'submit' && e.to === 'approve')!;
    expect(arc.medianSeconds).toBe((WALL_WEEKEND + WALL_WEEKDAY) / 2);
  });
});

// ---------------------------------------------------------------------------

describe('writing a calendar down', () => {
  const parse = (spec: string) => {
    const shape = parseCalendarSpec(spec);
    return shape === undefined ? undefined : businessCalendarSchema.parse(shape);
  };

  it('takes a zone on its own and assumes an office week', () => {
    const c = parse('Europe/London')!;
    expect(c.timezone).toBe('Europe/London');
    expect(c.workingDays).toEqual([0, 1, 2, 3, 4]);
    expect(c.startMinute).toBe(9 * 60);
    expect(c.endMinute).toBe(17 * 60);
  });

  it('does not mistake a zone name for a list of days', () => {
    // 'Europe/London' and 'Europe/London/mon,wed,fri' differ only in whether
    // the last segment reads as days. Getting this wrong drops half the zone.
    expect(parse('Europe/London')!.timezone).toBe('Europe/London');
    const named = parse('Europe/London/mon,wed,fri')!;
    expect(named.timezone).toBe('Europe/London');
    expect(named.workingDays).toEqual([0, 2, 4]);
  });

  it('reads hours, with or without minutes', () => {
    expect(parse('Europe/London@8-16')!.startMinute).toBe(8 * 60);
    const half = parse('Asia/Kolkata@09:30-18:00')!;
    expect(half.startMinute).toBe(9 * 60 + 30);
    expect(half.endMinute).toBe(18 * 60);
  });

  it('reads a range of days, including one that wraps the weekend', () => {
    expect(parse('Europe/London@9-17/mon-sat')!.workingDays).toEqual([0, 1, 2, 3, 4, 5]);
    expect(parse('Europe/London/sat-sun')!.workingDays).toEqual([5, 6]);
    // fri-mon crosses the end of the week and means what it says.
    expect(parse('Europe/London/fri-mon')!.workingDays).toEqual([4, 5, 6, 0]);
  });

  it('reads closed dates after a semicolon', () => {
    // A semicolon rather than a plus: '+' in a query string decodes to a
    // space, which would corrupt the spec silently rather than rejecting it.
    expect(parse('Europe/London@9-17;2026-12-25,2026-12-26')!.holidays).toEqual([
      '2026-12-25',
      '2026-12-26',
    ]);
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(parseCalendarSpec('')).toBeUndefined();
    expect(parseCalendarSpec('Europe/London@9')).toBeUndefined();
    expect(parseCalendarSpec('Europe/London@25-30')).toBeUndefined();
  });

  it('refuses a zone the runtime has never heard of', () => {
    // The parser cannot know which names exist, so the schema is what stops a
    // typo becoming an error from inside the store.
    expect(() => parse('Mars/Olympus')).toThrow();
  });
});

describe('asking for a calendar over HTTP', () => {
  const routerFor = (c: SqlClient) =>
    createRouter({ resolveStore: async () => c, defaultStore: 'main' });
  const get = (
    route: (r: MiningRequest) => Promise<MiningResponse>,
    path: string,
    query = '',
  ): Promise<MiningResponse> =>
    route({ method: 'GET', path, query: new URLSearchParams(query) });

  it('measures on the calendar the query asked for', async () => {
    client = await fixture();
    const route = routerFor(client);

    const wall = await get(route, '/v1/discover');
    const work = await get(route, '/v1/discover', 'calendar=Europe/London');
    const arc = (r: MiningResponse) =>
      (r.body as { edges: { medianSeconds: number }[] }).edges[0]?.medianSeconds;

    expect(arc(wall)).toBe((WALL_WEEKEND + WALL_WEEKDAY) / 2);
    expect(arc(work)).toBe((WORK_WEEKEND + WORK_WEEKDAY) / 2);
  });

  it('says on every result which clock produced it', async () => {
    client = await fixture();
    const route = routerFor(client);
    const meta = async (query: string): Promise<string> => {
      const res = await get(route, '/v1/performance', query);
      return (res.body as { meta: { clock: string } }).meta.clock;
    };

    expect(await meta('')).toBe('wall-clock');
    expect(await meta('calendar=Europe/London')).toContain('Mon-Fri 09:00-17:00 Europe/London');
  });

  it('rejects a calendar it cannot use, naming what was wrong', async () => {
    client = await fixture();
    const route = routerFor(client);

    const unknownZone = await get(route, '/v1/discover', 'calendar=Mars/Olympus');
    expect(unknownZone.status).toBe(422);
    expect(JSON.stringify(unknownZone.body)).toContain('unknown IANA time zone');

    const nonsense = await get(route, '/v1/discover', 'calendar=Europe/London@9');
    expect(nonsense.status).toBe(422);
    // The grammar comes back with the error, so a caller can correct it.
    expect(JSON.stringify(nonsense.body)).toContain('ZONE@8-16');
  });

  it('accepts the structured form a UI would post', async () => {
    client = await fixture();
    const route = routerFor(client);
    const res = await route({
      method: 'POST',
      path: '/v1/performance',
      query: new URLSearchParams(),
      body: {
        calendar: {
          timezone: 'Europe/London',
          workingDays: [0, 1, 2, 3, 4],
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          holidays: ['2026-03-09'],
        },
      },
    });

    // Monday shut: the weekend case gets Friday's last hour and nothing more.
    const body = res.body as { cases: { cycleTime: { p50: number } } };
    expect(body.cases.cycleTime.p50).toBe((1 * HOURS + WORK_WEEKDAY) / 2);
  });
});
