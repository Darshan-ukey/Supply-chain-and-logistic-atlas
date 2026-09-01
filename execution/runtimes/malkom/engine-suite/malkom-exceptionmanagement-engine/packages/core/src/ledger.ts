/**
 * The baton ledger.
 *
 * At every instant a handover has exactly one holder, and the clock that
 * accrues is the holder's. Passing the baton closes one segment and opens the
 * next at the same instant, so there is no gap and no overlap and the sum of
 * the segments is the whole life of the case.
 *
 * Two rules are enforced here rather than reviewed later, because every
 * workaround anyone has built to make an SLA look better lands on one of them:
 *
 *   1. Elapsed time is DERIVED from segments, never stored as a running total.
 *      A restart, a replay and a report all recompute it identically.
 *   2. Totals are monotonic. `assertMonotonic` is called by the engine on every
 *      command, so a mistake fails at the write rather than in a month-end
 *      argument.
 *
 * A side may be a chain: an architect who forwards an RFI to a structural
 * engineer, or an onshore desk that reassigns between two of its own people,
 * changes `holderRef` and NOT `side` — so that side's clock keeps running
 * across the move. Reassignment is not a reset.
 */

import { businessMinutesBetween, type CalendarProvider } from './calendar.js';

/** Who holds the baton. ORIGINATOR and RESOLVER accrue; the rest do not. */
export type Side = 'ORIGINATOR' | 'RESOLVER' | 'EXTERNAL' | 'PAUSED' | 'NONE';

export const accrues = (side: Side): boolean => side === 'ORIGINATOR' || side === 'RESOLVER';

export interface Segment {
  readonly side: Side;
  /** The round this segment belongs to. A budget is spent per round, and a
   *  pause splits one round into several segments, so minutes must be summed
   *  by round rather than read off a single segment. */
  readonly round: number;
  /** Which party member holds it. Changing this alone never passes the baton. */
  readonly holderRef: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  /** Working minutes in `calendarId`. Filled when the segment closes. */
  readonly minutes: number | null;
  readonly calendarId: string;
  /** Pause or referral reason; null while a party holds it. */
  readonly note: string | null;
}

export interface Totals {
  readonly originator: number;
  readonly resolver: number;
  /** Referral and explicit pause both land here: time nobody inside owed. */
  readonly paused: number;
}

export const ZERO: Totals = { originator: 0, resolver: 0, paused: 0 };

export const openSegment = (
  side: Side,
  holderRef: string | null,
  at: string,
  calendarId: string,
  round = 1,
  note: string | null = null,
): Segment => ({ side, round, holderRef, startedAt: at, endedAt: null, minutes: null, calendarId, note });

/**
 * Working minutes one side spent in one round — what a budget is actually
 * measured against. Open segments count as far as `now` when given.
 */
export const legMinutes = (
  segments: readonly Segment[],
  side: Side,
  round: number,
  now: string | null = null,
  calendars: CalendarProvider | null = null,
): number =>
  segments
    .filter((segment) => segment.side === side && segment.round === round)
    .reduce((total, segment) => {
      if (segment.minutes !== null) return total + segment.minutes;
      if (now === null || calendars === null) return total;
      return total + businessMinutesBetween(segment.startedAt, now, calendars.get(segment.calendarId));
    }, 0);

/** Close a segment at `at`, stamping the minutes in the segment's own calendar. */
export const closeSegment = (segment: Segment, at: string, calendars: CalendarProvider): Segment => {
  if (segment.endedAt !== null) return segment;
  const calendar = calendars.get(segment.calendarId);
  return { ...segment, endedAt: at, minutes: businessMinutesBetween(segment.startedAt, at, calendar) };
};

const add = (totals: Totals, side: Side, minutes: number): Totals => {
  if (side === 'ORIGINATOR') return { ...totals, originator: totals.originator + minutes };
  if (side === 'RESOLVER') return { ...totals, resolver: totals.resolver + minutes };
  if (side === 'EXTERNAL' || side === 'PAUSED') return { ...totals, paused: totals.paused + minutes };
  return totals;
};

/** Owned time from closed segments only — what the ledger can prove. */
export const totalsOf = (segments: readonly Segment[]): Totals =>
  segments.reduce<Totals>(
    (totals, segment) => (segment.minutes === null ? totals : add(totals, segment.side, segment.minutes)),
    ZERO,
  );

/**
 * Owned time as of `now`, including the segment still running. This is what a
 * worklist badge and an escalation check read; nothing is written for it.
 */
export const liveTotalsOf = (
  segments: readonly Segment[],
  now: string,
  calendars: CalendarProvider,
): Totals => {
  const closed = totalsOf(segments);
  const open = segments.find((segment) => segment.endedAt === null);
  if (open === undefined) return closed;
  const running = businessMinutesBetween(open.startedAt, now, calendars.get(open.calendarId));
  return add(closed, open.side, running);
};

/** Wall-clock minutes from the first segment to the last close (or `now`). */
export const elapsedMinutesOf = (segments: readonly Segment[], now: string): number => {
  const first = segments[0];
  if (first === undefined) return 0;
  const last = segments[segments.length - 1];
  const end = last?.endedAt ?? now;
  return Math.round((Date.parse(end) - Date.parse(first.startedAt)) / 60_000);
};

export class InvariantViolation extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(message);
    this.name = 'InvariantViolation';
    this.invariant = invariant;
  }
}

/**
 * Invariant 2, checked on every command. No command may reduce any party's
 * owned time. There is no legitimate reason to run this backwards, so a
 * failure here is a bug and not a business case.
 */
export const assertMonotonic = (before: Totals, after: Totals, command: string): void => {
  const shrunk = (['originator', 'resolver', 'paused'] as const).filter((key) => after[key] < before[key]);
  if (shrunk.length > 0) {
    throw new InvariantViolation(
      'clocks-are-monotonic',
      `${command} reduced ${shrunk.join(' and ')} — owned time can never go backwards`,
    );
  }
};

/**
 * Segments must tile the case's life: each starts exactly where the previous
 * one ended, at most one is open, and it is the last. Checked after every
 * command so a gap can never become an unexplained hour in a report.
 */
export const assertContiguous = (segments: readonly Segment[]): void => {
  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    if (previous !== undefined && previous.endedAt !== segment.startedAt) {
      throw new InvariantViolation(
        'segments-tile-the-timeline',
        `segment ${index} starts at ${segment.startedAt} but the previous one ended at ${String(previous.endedAt)}`,
      );
    }
    if (segment.endedAt === null && index !== segments.length - 1) {
      throw new InvariantViolation('segments-tile-the-timeline', `segment ${index} is open but is not the last`);
    }
  });
};
