/**
 * Business-time math: hand-computed fixtures (IST, no DST), DST correctness
 * pinned to exact minutes (America/New_York, Europe/Berlin), day counting,
 * the pathological-span guard, and a deterministic property test against an
 * independent brute-force minute-scan reference.
 */
import { describe, expect, it } from 'vitest';
import { calendarSchema, type CalendarInput } from '../src/config/schemas.js';
import { MalkomError } from '../src/domain/errors.js';
import { compileCalendar } from '../src/runtime/calendar.js';

function compile(input: CalendarInput, version?: number) {
  return compileCalendar(calendarSchema.parse(input), version);
}

/**
 * Asia/Kolkata is UTC+05:30 year-round (no DST) — every fixture below is
 * hand-checked with plain +5:30 arithmetic. 2026-08-14 is a Friday.
 */
const INDIA = compile({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

/** 01:00-05:00 wall, all seven days — the window straddles the 02:00 DST jumps. */
const NEW_YORK = compile({
  name: 'ny-ops',
  timezone: 'America/New_York',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  workingHours: { start: '01:00', end: '05:00' },
});

const BERLIN = compile({
  name: 'berlin-ops',
  timezone: 'Europe/Berlin',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  workingHours: { start: '01:00', end: '05:00' },
});

describe('businessMinutesBetween — Asia/Kolkata (no DST)', () => {
  it('same-day partial overlap: 10:30-13:00 IST = 150', () => {
    // 10:30 IST = 05:00Z, 13:00 IST = 07:30Z (Wed 2026-08-12)
    expect(INDIA.businessMinutesBetween('2026-08-12T05:00:00Z', '2026-08-12T07:30:00Z')).toBe(150);
  });

  it('clamps to the working window: 07:00-20:00 IST = full 540', () => {
    // 07:00 IST = 01:30Z, 20:00 IST = 14:30Z
    expect(INDIA.businessMinutesBetween('2026-08-12T01:30:00Z', '2026-08-12T14:30:00Z')).toBe(540);
  });

  it('overnight: Wed 17:00 -> Thu 10:00 IST = 60 + 60', () => {
    // 17:00 IST Wed = 11:30Z; 10:00 IST Thu = 04:30Z
    expect(INDIA.businessMinutesBetween('2026-08-12T11:30:00Z', '2026-08-13T04:30:00Z')).toBe(120);
  });

  it('evening to next early morning touches no working minutes = 0', () => {
    // Wed 19:00 IST (13:30Z) -> Thu 08:00 IST (02:30Z)
    expect(INDIA.businessMinutesBetween('2026-08-12T13:30:00Z', '2026-08-13T02:30:00Z')).toBe(0);
  });

  it('over a weekend: Fri 16:00 -> Mon 10:00 = 120 + 60', () => {
    // Fri 2026-08-07 16:00 IST = 10:30Z; Mon 2026-08-10 10:00 IST = 04:30Z
    expect(INDIA.businessMinutesBetween('2026-08-07T10:30:00Z', '2026-08-10T04:30:00Z')).toBe(180);
  });

  it('over a holiday weekend: Thu 17:00 -> Mon 10:00 skips Fri 08-14 = 60 + 60', () => {
    // Thu 2026-08-13 17:00 IST = 11:30Z; Mon 2026-08-17 10:00 IST = 04:30Z
    expect(INDIA.businessMinutesBetween('2026-08-13T11:30:00Z', '2026-08-17T04:30:00Z')).toBe(120);
  });

  it('returns 0 when end <= start', () => {
    expect(INDIA.businessMinutesBetween('2026-08-12T05:00:00Z', '2026-08-12T05:00:00Z')).toBe(0);
    expect(INDIA.businessMinutesBetween('2026-08-12T07:30:00Z', '2026-08-12T05:00:00Z')).toBe(0);
  });

  it('accepts epoch-ms inputs and agrees with the ISO form', () => {
    const start = Date.parse('2026-08-12T05:00:00Z');
    const end = Date.parse('2026-08-12T07:30:00Z');
    expect(INDIA.businessMinutesBetween(start, end)).toBe(150);
  });

  it('ageBusinessMinutes is businessMinutesBetween(field, now)', () => {
    expect(INDIA.ageBusinessMinutes('2026-08-12T05:00:00Z', '2026-08-13T04:30:00Z')).toBe(
      INDIA.businessMinutesBetween('2026-08-12T05:00:00Z', '2026-08-13T04:30:00Z'),
    );
  });

  it('throws a MalkomError on spans longer than 4000 days', () => {
    const start = Date.parse('2020-01-01T00:00:00Z');
    const end = start + 4001 * 86_400_000;
    let thrown: unknown;
    try {
      INDIA.businessMinutesBetween(start, end);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MalkomError);
    expect((thrown as MalkomError).code).toBe('UNSUPPORTED');
    expect(() => INDIA.businessDaysBetween(start, end)).toThrowError(MalkomError);
  });
});

describe('businessMinutesBetween — DST transitions, exact minutes', () => {
  it('America/New_York spring-forward 2026-03-08: the 01:00-05:00 window loses the skipped hour = 180', () => {
    // 01:00 EST (UTC-5) = 06:00Z; clocks jump 02:00 -> 03:00; 05:00 EDT (UTC-4) = 09:00Z.
    // Wall span is 4h but the real window is 09:00Z - 06:00Z = 3h = 180 min.
    expect(NEW_YORK.businessMinutesBetween('2026-03-08T06:00:00Z', '2026-03-08T09:00:00Z')).toBe(180);
    // A measurement over the whole local day sees only those 180 minutes.
    expect(NEW_YORK.businessMinutesBetween('2026-03-08T00:00:00Z', '2026-03-09T00:00:00Z')).toBe(180);
  });

  it('America/New_York control day 2026-03-09 (all EDT): 01:00-05:00 = 240', () => {
    // 01:00 EDT = 05:00Z; 05:00 EDT = 09:00Z.
    expect(NEW_YORK.businessMinutesBetween('2026-03-09T05:00:00Z', '2026-03-09T09:00:00Z')).toBe(240);
  });

  it('America/New_York fall-back 2026-11-01: the window gains the repeated hour = 300', () => {
    // Window start 01:00 is ambiguous; the FIRST occurrence is 01:00 EDT = 05:00Z.
    // Clocks fall back 02:00 EDT -> 01:00 EST, replaying 01:00-02:00; window
    // end 05:00 EST = 10:00Z. Real window = 10:00Z - 05:00Z = 5h = 300 min
    // (60 EDT + repeated 60 EST + 180 EST).
    expect(NEW_YORK.businessMinutesBetween('2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toBe(300);
    // The first occurrence of wall 01:00 already counts as working time.
    expect(NEW_YORK.businessMinutesBetween('2026-11-01T05:00:00Z', '2026-11-01T06:00:00Z')).toBe(60);
  });

  it('America/New_York control day 2026-11-02 (all EST): 01:00-05:00 = 240', () => {
    // 01:00 EST = 06:00Z; 05:00 EST = 10:00Z.
    expect(NEW_YORK.businessMinutesBetween('2026-11-02T06:00:00Z', '2026-11-02T10:00:00Z')).toBe(240);
  });

  it('Europe/Berlin spring-forward 2026-03-29: 01:00-05:00 loses the skipped hour = 180', () => {
    // 01:00 CET (UTC+1) = 00:00Z; clocks jump 02:00 -> 03:00; 05:00 CEST (UTC+2) = 03:00Z.
    expect(BERLIN.businessMinutesBetween('2026-03-29T00:00:00Z', '2026-03-29T03:00:00Z')).toBe(180);
  });
});

describe('isWorkingDay and businessDaysBetween', () => {
  it('isWorkingDay = workweek membership minus holidays', () => {
    expect(INDIA.isWorkingDay('2026-08-12')).toBe(true); // Wednesday
    expect(INDIA.isWorkingDay('2026-08-14')).toBe(false); // Friday, holiday
    expect(INDIA.isWorkingDay('2026-08-15')).toBe(false); // Saturday
    expect(INDIA.isWorkingDay('2026-08-16')).toBe(false); // Sunday
  });

  it('counts working local dates in [localDate(start), localDate(end)) across weekend + holiday', () => {
    // Thu 08-13 10:30 IST -> Tue 08-18 10:30 IST: counted dates 13(Thu ok),
    // 14(holiday), 15(Sat), 16(Sun), 17(Mon ok); 18 is exclusive => 2.
    expect(INDIA.businessDaysBetween('2026-08-13T05:00:00Z', '2026-08-18T05:00:00Z')).toBe(2);
    // Mon 08-10 -> Mon 08-17 (one full week containing the holiday) => 4.
    expect(INDIA.businessDaysBetween('2026-08-10T05:00:00Z', '2026-08-17T05:00:00Z')).toBe(4);
  });

  it('yields 0 on the same local date and when end <= start', () => {
    expect(INDIA.businessDaysBetween('2026-08-12T04:00:00Z', '2026-08-12T11:00:00Z')).toBe(0);
    expect(INDIA.businessDaysBetween('2026-08-13T05:00:00Z', '2026-08-12T05:00:00Z')).toBe(0);
  });

  it('uses the CALENDAR-LOCAL date, not the UTC date', () => {
    // 2026-08-12T19:30:00Z is already Thu 08-13 01:00 in IST, so the counted
    // range [08-13, 08-14) holds exactly one working day.
    expect(INDIA.businessDaysBetween('2026-08-12T19:30:00Z', '2026-08-13T19:30:00Z')).toBe(1);
  });
});

describe('property: businessMinutesBetween equals a brute-force minute scan', () => {
  /**
   * Independent reference: walk every minute of [start, end) and test its
   * IST wall clock against the calendar rules directly. Asia/Kolkata is a
   * fixed UTC+05:30, so the reference needs no timezone machinery at all —
   * it shares nothing with the implementation under test.
   */
  const IST_OFFSET_MS = 330 * 60_000;
  const HOLIDAYS = new Set(['2026-08-14']);
  function referenceBusinessMinutes(startMs: number, endMs: number): number {
    let minutes = 0;
    for (let t = startMs; t < endMs; t += 60_000) {
      const wall = new Date(t + IST_OFFSET_MS);
      const dow = wall.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (HOLIDAYS.has(wall.toISOString().slice(0, 10))) continue;
      const minuteOfDay = wall.getUTCHours() * 60 + wall.getUTCMinutes();
      if (minuteOfDay >= 9 * 60 && minuteOfDay < 18 * 60) minutes += 1;
    }
    return minutes;
  }

  it('agrees on 40 pinned-seed random spans within a 3-week window', () => {
    // Deterministic LCG (Numerical Recipes constants), pinned seed — no
    // Math.random anywhere, so a failure is reproducible forever.
    let seed = 0xdecafbad >>> 0;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const base = Date.parse('2026-08-03T00:00:00Z'); // Monday, span covers the 08-14 holiday
    const spanMinutes = 21 * 24 * 60;
    for (let i = 0; i < 40; i += 1) {
      const a = base + (rand() % spanMinutes) * 60_000;
      const b = base + (rand() % spanMinutes) * 60_000;
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const label = `${new Date(start).toISOString()} -> ${new Date(end).toISOString()}`;
      expect(INDIA.businessMinutesBetween(start, end), label).toBe(referenceBusinessMinutes(start, end));
    }
  });
});

describe('compileCalendar re-validates working hours (hosts construct Calendar objects directly)', () => {
  it('throws ConfigInvalidError for an inverted or empty working window instead of zeroing business time', () => {
    // Bypass the zod schema deliberately — the host-constructed-object path.
    const overnight = {
      name: 'overnight-ops',
      timezone: 'UTC',
      workweek: ['mon', 'tue', 'wed', 'thu', 'fri'] as const,
      weekStart: 'mon' as const,
      dstAmbiguity: 'earlier' as const,
      workingHours: { start: '18:00', end: '09:00' },
      holidays: [],
    };
    let thrown: unknown;
    try {
      compileCalendar(overnight as never);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MalkomError);
    expect((thrown as MalkomError).code).toBe('CONFIG_INVALID');
    expect((thrown as MalkomError).message).toContain('workingHours');

    expect(() => compileCalendar({ ...overnight, workingHours: { start: '09:00', end: '09:00' } } as never)).toThrowError(
      MalkomError,
    );
  });
});
