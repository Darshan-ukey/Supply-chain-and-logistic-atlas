/**
 * Window resolution: periodic boundaries in a calendar timezone vs UTC,
 * Monday-start ISO weeks, quarter edges, rolling calendar vs business
 * alignment, the unsupported rolling-hour-business combination, and key
 * stability.
 */
import { describe, expect, it } from 'vitest';
import { calendarSchema, type CalendarInput, type MetricWindow } from '../src/config/schemas.js';
import { MalkomError } from '../src/domain/errors.js';
import { compileCalendar } from '../src/runtime/calendar.js';
import { resolveWindow } from '../src/runtime/window.js';

function compile(input: CalendarInput) {
  return compileCalendar(calendarSchema.parse(input));
}

const INDIA = compile({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

const NEW_YORK = compile({
  name: 'ny-ops',
  timezone: 'America/New_York',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '17:00' },
});

const periodic = (grain: 'day' | 'week' | 'month' | 'quarter'): MetricWindow => ({
  kind: 'periodic',
  grain,
  alignment: 'calendar',
});

describe('periodic windows', () => {
  it('day: a late-night UTC instant falls on the NEXT day in IST', () => {
    // 2026-08-12T20:00Z is already 2026-08-13 01:30 IST.
    expect(resolveWindow(periodic('day'), '2026-08-12T20:00:00Z')).toEqual({
      startIso: '2026-08-12T00:00:00.000Z',
      endIso: '2026-08-13T00:00:00.000Z',
      key: 'day:2026-08-12',
      grain: 'day',
      alignment: 'calendar',
    });
    expect(resolveWindow(periodic('day'), '2026-08-12T20:00:00Z', INDIA)).toEqual({
      startIso: '2026-08-12T18:30:00.000Z', // 2026-08-13 00:00 IST
      endIso: '2026-08-13T18:30:00.000Z',
      key: 'day:2026-08-13',
      grain: 'day',
      alignment: 'calendar',
    });
  });

  it('day: a DST-transition day is physically 23 hours long', () => {
    // America/New_York 2026-03-08: midnight EST = 05:00Z, next midnight EDT = 04:00Z.
    const w = resolveWindow(periodic('day'), '2026-03-08T12:00:00Z', NEW_YORK);
    expect(w.startIso).toBe('2026-03-08T05:00:00.000Z');
    expect(w.endIso).toBe('2026-03-09T04:00:00.000Z');
    expect(w.key).toBe('day:2026-03-08');
  });

  it('week: Monday start, ISO week key, boundaries in the calendar timezone', () => {
    // Wed 2026-08-12 -> week of Mon 2026-08-10 (ISO week 33).
    expect(resolveWindow(periodic('week'), '2026-08-12T05:00:00Z', INDIA)).toEqual({
      startIso: '2026-08-09T18:30:00.000Z', // Mon 08-10 00:00 IST
      endIso: '2026-08-16T18:30:00.000Z',
      key: 'week:2026-W33',
      grain: 'week',
      alignment: 'calendar',
    });
    expect(resolveWindow(periodic('week'), '2026-08-12T05:00:00Z')).toEqual({
      startIso: '2026-08-10T00:00:00.000Z',
      endIso: '2026-08-17T00:00:00.000Z',
      key: 'week:2026-W33',
      grain: 'week',
      alignment: 'calendar',
    });
  });

  it('week: Sunday belongs to the week of the PRECEDING Monday', () => {
    const w = resolveWindow(periodic('week'), '2026-08-16T12:00:00Z');
    expect(w.startIso).toBe('2026-08-10T00:00:00.000Z');
    expect(w.key).toBe('week:2026-W33');
  });

  it('week: ISO week-year edges (2026-01-01 is W01; 2027-01-01 is 2026-W53)', () => {
    const w1 = resolveWindow(periodic('week'), '2026-01-01T12:00:00Z');
    expect(w1.startIso).toBe('2025-12-29T00:00:00.000Z');
    expect(w1.key).toBe('week:2026-W01');
    const w53 = resolveWindow(periodic('week'), '2027-01-01T12:00:00Z');
    expect(w53.startIso).toBe('2026-12-28T00:00:00.000Z');
    expect(w53.key).toBe('week:2026-W53');
  });

  it('month: an instant on the UTC/IST month boundary lands in different months', () => {
    // 2026-08-31T19:00Z = 2026-09-01 00:30 IST.
    const utc = resolveWindow(periodic('month'), '2026-08-31T19:00:00Z');
    expect(utc.key).toBe('month:2026-08');
    expect(utc.startIso).toBe('2026-08-01T00:00:00.000Z');
    expect(utc.endIso).toBe('2026-09-01T00:00:00.000Z');
    const ist = resolveWindow(periodic('month'), '2026-08-31T19:00:00Z', INDIA);
    expect(ist.key).toBe('month:2026-09');
    expect(ist.startIso).toBe('2026-08-31T18:30:00.000Z');
    expect(ist.endIso).toBe('2026-09-30T18:30:00.000Z');
  });

  it('quarter: edges resolve per timezone (late 09-30 UTC is already Q4 in IST)', () => {
    const utc = resolveWindow(periodic('quarter'), '2026-09-30T20:00:00Z');
    expect(utc).toMatchObject({
      startIso: '2026-07-01T00:00:00.000Z',
      endIso: '2026-10-01T00:00:00.000Z',
      key: 'quarter:2026-Q3',
    });
    const ist = resolveWindow(periodic('quarter'), '2026-09-30T20:00:00Z', INDIA);
    expect(ist).toMatchObject({
      startIso: '2026-09-30T18:30:00.000Z', // Oct 1 00:00 IST
      endIso: '2026-12-31T18:30:00.000Z',
      key: 'quarter:2026-Q4',
    });
  });

  it("containment under dstAmbiguity 'later': a tick inside the repeated hour stays in the STILL-OPEN period", () => {
    // America/Havana falls back 2026-11-01: 01:00 CDT → 00:00 CST, so wall
    // midnight Nov 1 occurs at 04:00Z (CDT) and again at 05:00Z (CST).
    // Under 'later' the day boundary is 05:00Z — an instant at 04:05Z reads
    // wall date Nov 1 but the Nov 1 window has NOT started yet. The resolved
    // window must CONTAIN the instant: it is still Oct 31's (25-hour) day.
    const havana = compile({
      name: 'havana-ops',
      timezone: 'America/Havana',
      workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      workingHours: { start: '09:00', end: '17:00' },
      dstAmbiguity: 'later',
    });
    const at = '2026-11-01T04:05:00Z';
    const day = resolveWindow(periodic('day'), at, havana);
    expect(day).toMatchObject({
      key: 'day:2026-10-31',
      startIso: '2026-10-31T04:00:00.000Z',
      endIso: '2026-11-01T05:00:00.000Z',
    });
    expect(Date.parse(day.startIso) <= Date.parse(at) && Date.parse(at) < Date.parse(day.endIso)).toBe(true);

    // Same invariant at the month boundary: October is still open at 04:15Z.
    const month = resolveWindow(periodic('month'), '2026-11-01T04:15:00Z', havana);
    expect(month).toMatchObject({
      key: 'month:2026-10',
      startIso: '2026-10-01T04:00:00.000Z',
      endIso: '2026-11-01T05:00:00.000Z',
    });

    // Once past the (later-resolved) boundary, the new period begins.
    expect(resolveWindow(periodic('day'), '2026-11-01T05:05:00Z', havana)).toMatchObject({
      key: 'day:2026-11-01',
      startIso: '2026-11-01T05:00:00.000Z',
      endIso: '2026-11-02T05:00:00.000Z',
    });
  });

  it('business alignment is recorded but never reshapes periodic bounds', () => {
    const spec: MetricWindow = { kind: 'periodic', grain: 'week', alignment: 'business' };
    const business = resolveWindow(spec, '2026-08-12T05:00:00Z', INDIA);
    const calendar = resolveWindow(periodic('week'), '2026-08-12T05:00:00Z', INDIA);
    expect(business.startIso).toBe(calendar.startIso);
    expect(business.endIso).toBe(calendar.endIso);
    expect(business.key).toBe(calendar.key);
    expect(business.alignment).toBe('business');
  });
});

describe('rolling windows', () => {
  it('rolling 7d calendar: same wall time seven days back', () => {
    // Tue 2026-08-18 10:00 IST.
    expect(resolveWindow({ kind: 'rolling', length: 7, unit: 'day', alignment: 'calendar' }, '2026-08-18T04:30:00Z', INDIA)).toEqual({
      startIso: '2026-08-11T04:30:00.000Z',
      endIso: '2026-08-18T04:30:00.000Z',
      key: 'rolling-7d:2026-08-18T04:30:00Z',
      grain: 'rolling-7d',
      alignment: 'calendar',
    });
  });

  it('rolling 7d business: walks back over the weekend AND the 08-14 holiday', () => {
    // Working days counted back from Tue 08-18: 18, 17, (16 Sun, 15 Sat,
    // 14 holiday skipped), 13, 12, 11, 10, (09 Sun, 08 Sat skipped), 07.
    // Start = Fri 2026-08-07 00:00 IST.
    expect(resolveWindow({ kind: 'rolling', length: 7, unit: 'day', alignment: 'business' }, '2026-08-18T04:30:00Z', INDIA)).toEqual({
      startIso: '2026-08-06T18:30:00.000Z',
      endIso: '2026-08-18T04:30:00.000Z',
      key: 'rolling-7d:2026-08-18T04:30:00Z',
      grain: 'rolling-7d',
      alignment: 'business',
    });
  });

  it('rolling hours: end minus length hours, UTC when no calendar is given', () => {
    expect(resolveWindow({ kind: 'rolling', length: 4, unit: 'hour', alignment: 'calendar' }, '2026-08-12T10:00:00Z')).toEqual({
      startIso: '2026-08-12T06:00:00.000Z',
      endIso: '2026-08-12T10:00:00.000Z',
      key: 'rolling-4h:2026-08-12T10:00:00Z',
      grain: 'rolling-4h',
      alignment: 'calendar',
    });
  });

  it('rolling hour + business alignment throws a MalkomError', () => {
    let thrown: unknown;
    try {
      resolveWindow({ kind: 'rolling', length: 4, unit: 'hour', alignment: 'business' }, '2026-08-12T10:00:00Z', INDIA);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MalkomError);
    expect((thrown as MalkomError).code).toBe('UNSUPPORTED');
  });

  it('rolling business without a calendar throws a MalkomError', () => {
    expect(() =>
      resolveWindow({ kind: 'rolling', length: 7, unit: 'day', alignment: 'business' }, '2026-08-18T04:30:00Z'),
    ).toThrowError(MalkomError);
  });
});

describe('determinism and keys', () => {
  it('the same (spec, at, calendar) resolves identically every time', () => {
    const spec = periodic('week');
    expect(resolveWindow(spec, '2026-08-12T05:00:00Z', INDIA)).toEqual(resolveWindow(spec, '2026-08-12T05:00:00Z', INDIA));
  });

  it('keys are canonical: seconds precision, ms preserved only when non-zero', () => {
    const whole = resolveWindow({ kind: 'rolling', length: 30, unit: 'day', alignment: 'calendar' }, '2026-08-12T10:00:00Z');
    expect(whole.key).toBe('rolling-30d:2026-08-12T10:00:00Z');
    const withMs = resolveWindow({ kind: 'rolling', length: 30, unit: 'day', alignment: 'calendar' }, '2026-08-12T10:00:00.250Z');
    expect(withMs.key).toBe('rolling-30d:2026-08-12T10:00:00.250Z');
  });

  it('rejects an unparseable "at" instant', () => {
    expect(() => resolveWindow(periodic('day'), 'not-a-time')).toThrowError(MalkomError);
  });
});
