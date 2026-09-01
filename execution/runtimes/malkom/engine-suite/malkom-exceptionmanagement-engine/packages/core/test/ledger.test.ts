import { describe, expect, it } from 'vitest';
import { ALWAYS_ON, StaticCalendarProvider, type BusinessCalendar } from '../src/calendar.js';
import {
  assertContiguous,
  assertMonotonic,
  closeSegment,
  elapsedMinutesOf,
  InvariantViolation,
  liveTotalsOf,
  openSegment,
  totalsOf,
  ZERO,
  type Segment,
} from '../src/ledger.js';

const calendars = new StaticCalendarProvider();

/** Build a tiled run of segments from (side, endedAt) pairs on one calendar. */
const timeline = (start: string, steps: readonly [Segment['side'], string][]): Segment[] => {
  const segments: Segment[] = [];
  let at = start;
  for (const [side, endedAt] of steps) {
    segments.push(closeSegment(openSegment(side, null, at, ALWAYS_ON.id), endedAt, calendars));
    at = endedAt;
  }
  return segments;
};

describe('the age identity', () => {
  it('leaves no residual: originator + resolver + paused is the whole life', () => {
    const segments = timeline('2026-08-21T09:00:00Z', [
      ['RESOLVER', '2026-08-21T11:30:00Z'],
      ['ORIGINATOR', '2026-08-21T13:30:00Z'],
      ['RESOLVER', '2026-08-21T15:10:00Z'],
      ['EXTERNAL', '2026-08-21T16:50:00Z'],
      ['RESOLVER', '2026-08-21T18:50:00Z'],
      ['ORIGINATOR', '2026-08-21T20:40:00Z'],
    ]);
    const totals = totalsOf(segments);
    expect(totals).toEqual({ resolver: 370, originator: 230, paused: 100 });
    expect(totals.resolver + totals.originator + totals.paused).toBe(
      elapsedMinutesOf(segments, '2026-08-21T20:40:00Z'),
    );
  });

  it('counts the running segment for a live reading without writing it', () => {
    const segments = [
      ...timeline('2026-08-21T09:00:00Z', [['RESOLVER', '2026-08-21T11:00:00Z']]),
      openSegment('ORIGINATOR', 'usr_off', '2026-08-21T11:00:00Z', ALWAYS_ON.id),
    ];
    expect(totalsOf(segments).originator).toBe(0); // nothing closed, nothing claimed
    expect(liveTotalsOf(segments, '2026-08-21T12:30:00Z', calendars).originator).toBe(90);
    expect(segments[1]?.minutes).toBeNull(); // still derived, still not stored
  });

  it('measures a party in the calendar its segment was opened with', () => {
    const houston: BusinessCalendar = {
      id: 'onshore-houston', timezone: 'America/Chicago', workdays: [1, 2, 3, 4, 5],
      start: '09:00', end: '18:00', holidays: [],
    };
    const provider = new StaticCalendarProvider([houston]);
    const segment = closeSegment(
      openSegment('RESOLVER', null, '2026-08-21T11:10:00Z', houston.id),
      '2026-08-21T21:00:00Z',
      provider,
    );
    expect(segment.minutes).toBe(420); // not the 590 minutes the wall clock saw
  });
});

describe('invariant 2 — assertMonotonic', () => {
  it('passes when every party total holds or grows', () => {
    expect(() => assertMonotonic(ZERO, { originator: 0, resolver: 40, paused: 0 }, 'answer')).not.toThrow();
  });

  it('names the party whose clock went backwards', () => {
    expect(() =>
      assertMonotonic({ originator: 30, resolver: 40, paused: 0 }, { originator: 10, resolver: 40, paused: 0 }, 'accept'),
    ).toThrow(/accept reduced originator/);
  });

  it('throws an InvariantViolation, not a validation error', () => {
    try {
      assertMonotonic({ originator: 0, resolver: 40, paused: 0 }, ZERO, 'requery');
      expect.unreachable('a rewound clock must not pass');
    } catch (error) {
      expect(error).toBeInstanceOf(InvariantViolation);
      expect((error as InvariantViolation).invariant).toBe('clocks-are-monotonic');
    }
  });
});

describe('segments tile the timeline', () => {
  it('accepts a contiguous run with one open segment at the end', () => {
    const segments = [
      ...timeline('2026-08-21T09:00:00Z', [['RESOLVER', '2026-08-21T11:00:00Z']]),
      openSegment('ORIGINATOR', null, '2026-08-21T11:00:00Z', ALWAYS_ON.id),
    ];
    expect(() => assertContiguous(segments)).not.toThrow();
  });

  it('catches a gap, which is where an unexplained hour would hide', () => {
    const segments = [
      ...timeline('2026-08-21T09:00:00Z', [['RESOLVER', '2026-08-21T11:00:00Z']]),
      openSegment('ORIGINATOR', null, '2026-08-21T11:45:00Z', ALWAYS_ON.id),
    ];
    expect(() => assertContiguous(segments)).toThrow(/previous one ended/);
  });

  it('catches a second open segment', () => {
    const segments = [
      openSegment('RESOLVER', null, '2026-08-21T09:00:00Z', ALWAYS_ON.id),
      openSegment('ORIGINATOR', null, '2026-08-21T11:00:00Z', ALWAYS_ON.id),
    ];
    expect(() => assertContiguous(segments)).toThrow(/open but is not the last/);
  });
});
