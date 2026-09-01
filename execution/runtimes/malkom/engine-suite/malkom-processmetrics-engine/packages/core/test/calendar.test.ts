/**
 * Calendar authoring schema: IANA timezone via Intl, workweek/working-hours
 * sanity, and real-calendar-date holidays.
 */
import { describe, expect, it } from 'vitest';
import { calendarSchema, type CalendarInput } from '../src/config/schemas.js';

const INDIA_OPS: CalendarInput = {
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [
    { date: '2026-01-26', label: 'Republic Day' },
    { date: '2026-08-15', label: 'Independence Day' },
  ],
};

describe('calendar schema', () => {
  it('parses a full calendar and defaults holidays to []', () => {
    const cal = calendarSchema.parse(INDIA_OPS);
    expect(cal.holidays).toHaveLength(2);
    const bare = calendarSchema.parse({
      name: 'utc-ops',
      timezone: 'UTC',
      workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      workingHours: { start: '00:00', end: '23:59' },
    });
    expect(bare.holidays).toEqual([]);
  });

  it('rejects an invalid IANA timezone', () => {
    const res = calendarSchema.safeParse({ ...INDIA_OPS, timezone: 'Mars/Olympus_Mons' });
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.path.join('.') === 'timezone')).toBe(true);
  });

  it('rejects workingHours where start is not before end', () => {
    for (const workingHours of [
      { start: '18:00', end: '09:00' },
      { start: '09:00', end: '09:00' },
    ]) {
      const res = calendarSchema.safeParse({ ...INDIA_OPS, workingHours });
      expect(res.success).toBe(false);
      expect(res.error?.issues.some((i) => i.path.join('.') === 'workingHours.end')).toBe(true);
    }
    // and malformed times never reach the ordering check
    expect(calendarSchema.safeParse({ ...INDIA_OPS, workingHours: { start: '9:00', end: '25:00' } }).success).toBe(false);
  });

  it('rejects an empty or duplicated workweek', () => {
    expect(calendarSchema.safeParse({ ...INDIA_OPS, workweek: [] }).success).toBe(false);
    const res = calendarSchema.safeParse({ ...INDIA_OPS, workweek: ['mon', 'mon'] });
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.message.includes('unique'))).toBe(true);
  });

  it('rejects duplicate holiday dates with a precise path', () => {
    const res = calendarSchema.safeParse({
      ...INDIA_OPS,
      holidays: [
        { date: '2026-01-26', label: 'Republic Day' },
        { date: '2026-01-26', label: 'Duplicate' },
      ],
    });
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.path.join('.') === 'holidays.1.date')).toBe(true);
  });

  it('rejects impossible calendar dates like 2026-02-30', () => {
    for (const date of ['2026-02-30', '2026-04-31', '2025-02-29']) {
      const res = calendarSchema.safeParse({ ...INDIA_OPS, holidays: [{ date, label: 'ghost day' }] });
      expect(res.success, date).toBe(false);
    }
    // leap day on an actual leap year is fine
    expect(calendarSchema.safeParse({ ...INDIA_OPS, holidays: [{ date: '2028-02-29', label: 'leap' }] }).success).toBe(true);
  });
});
