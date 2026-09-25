import { describe, expect, it } from 'vitest';
import {
  ALWAYS_ON,
  addBusinessMinutes,
  businessMinutesBetween,
  instantAtLocal,
  type BusinessCalendar,
} from '../src/calendar.js';

/**
 * The two-calendar claim, checked rather than asserted. If these numbers are
 * wrong, every SLA this engine reports about a cross-shore pair is wrong.
 */

const WEEKDAYS = [1, 2, 3, 4, 5];

const KOLKATA: BusinessCalendar = {
  id: 'offshore-kolkata',
  timezone: 'Asia/Kolkata',
  workdays: WEEKDAYS,
  start: '09:00',
  end: '18:00',
  holidays: [],
};

const KOLKATA_SHIFTED: BusinessCalendar = { ...KOLKATA, id: 'offshore-kolkata-shifted', start: '12:00', end: '21:00' };

const HOUSTON: BusinessCalendar = {
  id: 'onshore-houston',
  timezone: 'America/Chicago',
  workdays: WEEKDAYS,
  start: '09:00',
  end: '18:00',
  holidays: [],
};

// 2026-08-21 is a Friday. India is UTC+5:30 year round; Chicago is UTC-5 in August.
const FRIDAY = { year: 2026, month: 8, day: 21 };

describe('local wall time to instant', () => {
  it('places the Kolkata working day at 03:30–12:30 UTC', () => {
    expect(instantAtLocal(FRIDAY.year, FRIDAY.month, FRIDAY.day, 9 * 60, KOLKATA.timezone)).toBe(
      Date.parse('2026-08-21T03:30:00Z'),
    );
    expect(instantAtLocal(FRIDAY.year, FRIDAY.month, FRIDAY.day, 18 * 60, KOLKATA.timezone)).toBe(
      Date.parse('2026-08-21T12:30:00Z'),
    );
  });

  it('places the Houston working day at 14:00–23:00 UTC', () => {
    expect(instantAtLocal(FRIDAY.year, FRIDAY.month, FRIDAY.day, 9 * 60, HOUSTON.timezone)).toBe(
      Date.parse('2026-08-21T14:00:00Z'),
    );
    expect(instantAtLocal(FRIDAY.year, FRIDAY.month, FRIDAY.day, 18 * 60, HOUSTON.timezone)).toBe(
      Date.parse('2026-08-21T23:00:00Z'),
    );
  });

  it('tracks a DST change rather than assuming a fixed offset', () => {
    // Chicago is UTC-6 in January and UTC-5 in August. Same local 09:00.
    expect(instantAtLocal(2026, 1, 21, 9 * 60, HOUSTON.timezone)).toBe(Date.parse('2026-01-21T15:00:00Z'));
    expect(instantAtLocal(2026, 8, 21, 9 * 60, HOUSTON.timezone)).toBe(Date.parse('2026-08-21T14:00:00Z'));
  });
});

describe('the overlap a Kolkata/Houston pair actually has', () => {
  it('is zero on the default shift', () => {
    // The whole of Houston's Friday, measured in Kolkata working minutes.
    const inside = businessMinutesBetween('2026-08-21T14:00:00Z', '2026-08-21T23:00:00Z', KOLKATA);
    expect(inside).toBe(0);
  });

  it('is ninety minutes once offshore shifts to 12:00–21:00', () => {
    const inside = businessMinutesBetween('2026-08-21T14:00:00Z', '2026-08-21T23:00:00Z', KOLKATA_SHIFTED);
    expect(inside).toBe(90);
  });
});

describe('business minutes', () => {
  it('counts only the working window, not the wall clock', () => {
    // Friday 08:00 UTC (13:30 IST) to Monday 08:00 UTC (13:30 IST).
    // Friday 13:30->18:00 = 270, Mon 09:00->13:30 = 270. Weekend: nothing.
    expect(businessMinutesBetween('2026-08-21T08:00:00Z', '2026-08-24T08:00:00Z', KOLKATA)).toBe(540);
  });

  it('skips a holiday', () => {
    const withMonday: BusinessCalendar = { ...KOLKATA, holidays: ['2026-08-24'] };
    expect(businessMinutesBetween('2026-08-21T08:00:00Z', '2026-08-24T08:00:00Z', withMonday)).toBe(270);
  });

  it('is wall-clock time on a 24x7 calendar', () => {
    expect(businessMinutesBetween('2026-08-21T09:00:00Z', '2026-08-21T20:40:00Z', ALWAYS_ON)).toBe(700);
  });

  it('is zero for a backwards or empty interval', () => {
    expect(businessMinutesBetween('2026-08-21T12:00:00Z', '2026-08-21T09:00:00Z', ALWAYS_ON)).toBe(0);
    expect(businessMinutesBetween('2026-08-21T12:00:00Z', '2026-08-21T12:00:00Z', ALWAYS_ON)).toBe(0);
  });
});

describe('due times', () => {
  it('pushes a four-hour budget across the weekend it cannot be spent in', () => {
    // Raised 16:40 IST Friday. 80 minutes left that day; the other 160 land
    // on Monday morning. A wall-clock deadline would have said Friday 20:40,
    // when the office it belongs to has been shut for two hours.
    expect(addBusinessMinutes('2026-08-21T11:10:00Z', 240, KOLKATA)).toBe('2026-08-24T06:10:00.000Z');
  });

  it('is plain addition on a 24x7 calendar', () => {
    expect(addBusinessMinutes('2026-08-21T09:00:00Z', 240, ALWAYS_ON)).toBe('2026-08-21T13:00:00.000Z');
  });

  it('refuses a budget that can never be spent', () => {
    const shut: BusinessCalendar = { ...KOLKATA, workdays: [] };
    expect(() => addBusinessMinutes('2026-08-21T09:00:00Z', 60, shut)).toThrow(/do not fit/);
  });
});
