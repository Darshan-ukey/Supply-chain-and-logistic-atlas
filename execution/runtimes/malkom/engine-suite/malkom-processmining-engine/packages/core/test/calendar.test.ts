import { afterEach, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import {
  businessCalendarSchema,
  businessElapsed,
  businessElapsedExpr,
  businessSecondsBetween,
  localParts,
  workingDaySeconds,
  type BusinessCalendar,
} from '../src/runtime/calendar.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';

/**
 * The working-hours clock.
 *
 * Two things are checked, and the second matters more than the first. The
 * arithmetic is pinned against answers worked out by hand — a Friday-evening
 * handover is worth nothing, not sixty-two hours — and then the SQL expression
 * is run against a real DuckDB and compared to the TypeScript for the same
 * instants.
 *
 * That second check exists because the two implementations are transcriptions
 * of one formula, and a transcription error does not fail: it produces a number
 * that looks like a duration and is quietly wrong on one day in seven.
 */

const HOURS = 3600;

/** Nine to five, Monday to Friday, London. */
const OFFICE: BusinessCalendar = businessCalendarSchema.parse({
  timezone: 'Europe/London',
  workingDays: [0, 1, 2, 3, 4],
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  holidays: [],
});

const at = (iso: string): Date => new Date(iso);

/** 2026-03-02 is a Monday; every fixture below is anchored to that week. */
const MONDAY = '2026-03-02';
const TUESDAY = '2026-03-03';
const FRIDAY = '2026-03-06';
const SATURDAY = '2026-03-07';
const NEXT_MONDAY = '2026-03-09';

let client: SqlClient;
afterEach(async () => {
  await client?.close();
});

describe('the arithmetic', () => {
  it('counts a full working day as the length of the working day', () => {
    expect(businessSecondsBetween(at(`${MONDAY}T09:00:00Z`), at(`${MONDAY}T17:00:00Z`), OFFICE)).toBe(
      8 * HOURS,
    );
    expect(workingDaySeconds(OFFICE)).toBe(8 * HOURS);
  });

  it('charges nothing for a weekend', () => {
    // The finding this whole module exists for. Wall-clock says 64 hours.
    expect(
      businessSecondsBetween(at(`${FRIDAY}T17:00:00Z`), at(`${NEXT_MONDAY}T09:00:00Z`), OFFICE),
    ).toBe(0);
  });

  it('charges only the open hours either side of a weekend', () => {
    expect(
      businessSecondsBetween(at(`${FRIDAY}T16:00:00Z`), at(`${NEXT_MONDAY}T10:00:00Z`), OFFICE),
    ).toBe(2 * HOURS);
  });

  it('ignores time before the office opens and after it shuts', () => {
    expect(businessSecondsBetween(at(`${MONDAY}T05:00:00Z`), at(`${MONDAY}T10:00:00Z`), OFFICE)).toBe(
      1 * HOURS,
    );
    expect(businessSecondsBetween(at(`${MONDAY}T16:00:00Z`), at(`${MONDAY}T23:00:00Z`), OFFICE)).toBe(
      1 * HOURS,
    );
    expect(businessSecondsBetween(at(`${MONDAY}T18:00:00Z`), at(`${MONDAY}T20:00:00Z`), OFFICE)).toBe(
      0,
    );
  });

  it('charges nothing for a Saturday spent working', () => {
    expect(
      businessSecondsBetween(at(`${SATURDAY}T10:00:00Z`), at(`${SATURDAY}T14:00:00Z`), OFFICE),
    ).toBe(0);
  });

  it('counts a working week as five days', () => {
    expect(
      businessSecondsBetween(at(`${MONDAY}T09:00:00Z`), at(`${NEXT_MONDAY}T09:00:00Z`), OFFICE),
    ).toBe(5 * 8 * HOURS);
  });

  it('never runs backwards', () => {
    // Events out of order or overlapping give a negative gap, not negative time.
    expect(businessSecondsBetween(at(`${TUESDAY}T09:00:00Z`), at(`${MONDAY}T09:00:00Z`), OFFICE)).toBe(
      0,
    );
  });
});

describe('holidays', () => {
  const withHoliday: BusinessCalendar = businessCalendarSchema.parse({
    ...OFFICE,
    holidays: [TUESDAY],
  });

  it('skips a closed day entirely', () => {
    // Monday to Wednesday is normally two working days; with Tuesday shut it is one.
    expect(
      businessSecondsBetween(at(`${MONDAY}T09:00:00Z`), at('2026-03-04T09:00:00Z'), withHoliday),
    ).toBe(8 * HOURS);
  });

  it('charges nothing for the holiday itself', () => {
    expect(
      businessSecondsBetween(at(`${TUESDAY}T09:00:00Z`), at(`${TUESDAY}T17:00:00Z`), withHoliday),
    ).toBe(0);
  });

  it('does not subtract a holiday that falls on a closed day', () => {
    // A bank holiday on a Sunday costs a team nothing, and removing a day that
    // was never added would run the clock backwards.
    const sundayHoliday = businessCalendarSchema.parse({ ...OFFICE, holidays: ['2026-03-08'] });
    expect(
      businessSecondsBetween(at(`${FRIDAY}T09:00:00Z`), at(`${NEXT_MONDAY}T17:00:00Z`), sundayHoliday),
    ).toBe(businessSecondsBetween(at(`${FRIDAY}T09:00:00Z`), at(`${NEXT_MONDAY}T17:00:00Z`), OFFICE));
  });

  it('is unmoved by the same holiday listed twice', () => {
    const duplicated = businessCalendarSchema.parse({ ...OFFICE, holidays: [TUESDAY, TUESDAY] });
    expect(businessElapsed(at(`${FRIDAY}T12:00:00Z`), duplicated)).toBe(
      businessElapsed(at(`${FRIDAY}T12:00:00Z`), withHoliday),
    );
  });
});

describe('clocks changing', () => {
  it('still counts eight hours on the day the clocks go forward', () => {
    // Europe/London springs forward on 2026-03-29, a Sunday. The Monday after
    // is a normal working day, and a wall-clock day is what a team works.
    expect(
      businessSecondsBetween(at('2026-03-27T09:00:00Z'), at('2026-03-30T17:00:00+01:00'), OFFICE),
    ).toBe(2 * 8 * HOURS);
  });

  it('reads local wall time rather than the instant', () => {
    // 23:30 UTC in London during summer is 00:30 the NEXT day locally, which is
    // a different working day. Getting this wrong shifts a whole day's work.
    const summer = localParts(at('2026-06-30T23:30:00Z'), 'Europe/London');
    expect(summer.date).toBe('2026-07-01');
    expect(summer.secondsIntoDay).toBe(30 * 60);
  });

  it('measures a zone the server is not in', () => {
    const mumbai = businessCalendarSchema.parse({ ...OFFICE, timezone: 'Asia/Kolkata' });
    // 09:30 UTC is 15:00 in Kolkata, two hours before close.
    expect(
      businessSecondsBetween(at(`${MONDAY}T09:30:00Z`), at(`${MONDAY}T15:00:00Z`), mumbai),
    ).toBe(2 * HOURS);
  });
});

describe('configuration that cannot mean anything', () => {
  it('refuses a day that ends before it starts', () => {
    expect(() =>
      businessCalendarSchema.parse({ ...OFFICE, startMinute: 17 * 60, endMinute: 9 * 60 }),
    ).toThrow();
  });

  it('refuses a week with no open days', () => {
    expect(() => businessCalendarSchema.parse({ ...OFFICE, workingDays: [] })).toThrow();
  });

  it('refuses a calendar with no zone', () => {
    expect(() => businessCalendarSchema.parse({ ...OFFICE, timezone: '' })).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('the SQL says the same thing as the TypeScript', () => {
  /** Run the expression over a set of instants and return what SQL computed. */
  async function inSql(calendar: BusinessCalendar, instants: readonly string[]): Promise<number[]> {
    client = await openMemoryDuckDB();
    await client.execute('CREATE TABLE t (ts TIMESTAMPTZ)', []);
    for (const iso of instants) {
      await client.execute(`INSERT INTO t VALUES (CAST('${iso}' AS TIMESTAMPTZ))`, []);
    }

    const params: unknown[] = [];
    const expr = businessElapsedExpr(duckdbDialect, 'ts', calendar, params);
    const { rows } = await client.query(
      `SELECT ${expr} AS elapsed, ts FROM t ORDER BY ts`,
      params,
    );
    return rows.map((r) => Number(r['elapsed']));
  }

  /**
   * Instants chosen to land on every branch: both sides of the working day,
   * a weekend, a holiday, a clock change, a month boundary, and a date before
   * the origin so the negative-modulo path is exercised.
   */
  const PROBES = [
    '1969-06-11T10:00:00Z',
    `${MONDAY}T05:00:00Z`,
    `${MONDAY}T09:00:00Z`,
    `${MONDAY}T13:37:00Z`,
    `${MONDAY}T17:00:00Z`,
    `${MONDAY}T23:59:59Z`,
    `${TUESDAY}T11:00:00Z`,
    `${FRIDAY}T16:59:00Z`,
    `${SATURDAY}T12:00:00Z`,
    '2026-03-08T12:00:00Z',
    `${NEXT_MONDAY}T09:30:00Z`,
    '2026-03-30T12:00:00+01:00',
    '2026-12-31T16:00:00Z',
    '2027-01-01T09:30:00Z',
  ];

  it('agrees on every instant, with no holidays', async () => {
    const fromSql = await inSql(OFFICE, PROBES);
    const sorted = [...PROBES].sort((a, b) => Date.parse(a) - Date.parse(b));
    const fromTs = sorted.map((iso) => businessElapsed(at(iso), OFFICE));
    expect(fromSql).toEqual(fromTs);
  });

  it('agrees on every instant, with holidays', async () => {
    const withHolidays = businessCalendarSchema.parse({
      ...OFFICE,
      holidays: [TUESDAY, '2027-01-01', '2026-03-08'],
    });
    const fromSql = await inSql(withHolidays, PROBES);
    const sorted = [...PROBES].sort((a, b) => Date.parse(a) - Date.parse(b));
    const fromTs = sorted.map((iso) => businessElapsed(at(iso), withHolidays));
    expect(fromSql).toEqual(fromTs);
  });

  it('agrees in a zone with a half-hour offset', async () => {
    // Asia/Kolkata is +05:30. A half-hour zone is where an offset table built
    // from whole hours goes wrong.
    const kolkata = businessCalendarSchema.parse({ ...OFFICE, timezone: 'Asia/Kolkata' });
    const fromSql = await inSql(kolkata, PROBES);
    const sorted = [...PROBES].sort((a, b) => Date.parse(a) - Date.parse(b));
    expect(fromSql).toEqual(sorted.map((iso) => businessElapsed(at(iso), kolkata)));
  });

  it('agrees for a six-day week with an early finish', async () => {
    const shop = businessCalendarSchema.parse({
      timezone: 'Europe/London',
      workingDays: [0, 1, 2, 3, 4, 5],
      startMinute: 8 * 60 + 30,
      endMinute: 13 * 60 + 45,
      holidays: [],
    });
    const fromSql = await inSql(shop, PROBES);
    const sorted = [...PROBES].sort((a, b) => Date.parse(a) - Date.parse(b));
    expect(fromSql).toEqual(sorted.map((iso) => businessElapsed(at(iso), shop)));
  });

  it('gives the same DIFFERENCE either side, which is what gets reported', async () => {
    // Two elapsed values are only ever subtracted, so the difference is the
    // number a reader sees. Checked directly rather than inferred.
    const [friday, monday] = await inSql(OFFICE, [
      `${FRIDAY}T17:00:00Z`,
      `${NEXT_MONDAY}T09:00:00Z`,
    ]);
    expect((monday ?? 0) - (friday ?? 0)).toBe(0);
  });
});
