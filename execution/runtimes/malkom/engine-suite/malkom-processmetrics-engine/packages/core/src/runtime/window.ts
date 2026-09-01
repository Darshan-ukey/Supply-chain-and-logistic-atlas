import { DST_AMBIGUITY_DEFAULT, ENGINE_DEFAULTS, type DstAmbiguity, type EngineDefaults } from '../config/defaults.js';
import type { MetricWindow, Weekday } from '../config/schemas.js';
import { ConfigInvalidError, UnsupportedError } from '../domain/errors.js';
import type { ResolvedWindow, WindowGrain } from '../domain/types.js';
import { CompiledCalendar, wallClockAt, wallTimeToInstant, type WallClock } from './calendar.js';

/**
 * Window resolution: a window spec + an evaluation instant → concrete
 * half-open [start, end) bounds, a canonical key, and the recorded alignment.
 * Pure and deterministic — the same (spec, at, calendar, defaults) always
 * resolves to the same window, which is what makes point identity (`key`)
 * trustworthy.
 *
 * Periodic windows are the calendar period containing `at` in the calendar's
 * timezone (EngineDefaults.defaultTimezone when no calendar is given). Weeks
 * start on the calendar's `weekStart` (EngineDefaults.weekStart without a
 * calendar); Monday-start weeks are keyed by ISO-8601 week numbers
 * ("2026-W33"), any other week start is keyed by the week's start date
 * ("week:2026-08-09") — ISO week numbering is Monday-based by definition, so
 * borrowing its labels for other week starts would lie. `alignment` does NOT
 * alter periodic bounds — reporting periods stay wall-clock so weeks and
 * months keep their familiar boundaries; business alignment is meaningful for
 * durations (via derived fields) and for rolling windows, so it is recorded
 * here and flows into the trace rather than reshaping the period.
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Weekday index in the getUTCDay() convention (sun = 0). */
export const WEEKDAY_INDEX: Readonly<Record<Weekday, number>> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * Canonical instant form for window BOUNDS (and everything persisted):
 * fixed-width millisecond UTC ISO. Fixed width makes lexicographic order
 * equal chronological order, so the sqlite store's string comparisons and
 * the memory store's epoch comparisons can never disagree.
 */
function isoOf(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Canonical instant form for window KEYS: seconds precision, ms only when
 * non-zero. Keys are point-identity LABELS, persisted forever — they keep
 * the historical trimmed form even though bounds are fixed-width.
 */
function keyIsoOf(epochMs: number): string {
  const s = new Date(epochMs).toISOString();
  return s.endsWith('.000Z') ? `${s.slice(0, -5)}Z` : s;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Midnight (00:00 wall) of a calendar date, as an instant in `tz`. */
function midnight(tz: string, year: number, month: number, day: number, ambiguity: DstAmbiguity): number {
  // Date.UTC normalizes overflow/underflow (month 13, day 0, …), so callers
  // can pass raw arithmetic like day + 7.
  const d = new Date(Date.UTC(year, month - 1, day));
  return wallTimeToInstant(
    tz,
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    ambiguity,
  );
}

/** ISO-8601 week (Monday start): the week's Thursday names the week-year. */
function isoWeekOf(year: number, month: number, day: number): { isoYear: number; week: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayIndex = (date.getUTCDay() + 6) % 7; // 0 = Monday
  const thursday = new Date(Date.UTC(year, month - 1, day - mondayIndex + 3));
  const isoYear = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / MS_PER_DAY / 7) + 1;
  return { isoYear, week };
}

interface PeriodBounds {
  startMs: number;
  endMs: number;
  key: string;
}

/**
 * The bounds and key of the period LABELED by a calendar date (year, month,
 * day — the anchor). Date.UTC normalization inside `midnight` lets callers
 * pass raw arithmetic like `day - 7`.
 */
function periodBounds(
  spec: Extract<MetricWindow, { kind: 'periodic' }>,
  year: number,
  month: number,
  day: number,
  tz: string,
  weekStart: Weekday,
  ambiguity: DstAmbiguity,
): PeriodBounds {
  switch (spec.grain) {
    case 'day': {
      const d = new Date(Date.UTC(year, month - 1, day)); // normalized label date
      return {
        startMs: midnight(tz, year, month, day, ambiguity),
        endMs: midnight(tz, year, month, day + 1, ambiguity),
        key: `day:${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
      };
    }
    case 'week': {
      const date = new Date(Date.UTC(year, month - 1, day));
      const startIndex = (date.getUTCDay() - WEEKDAY_INDEX[weekStart] + 7) % 7; // 0 = the week-start day
      let key: string;
      if (weekStart === 'mon') {
        const { isoYear, week } = isoWeekOf(year, month, day);
        key = `week:${isoYear}-W${pad2(week)}`;
      } else {
        // Non-Monday weeks have no ISO number — key by the start's local date.
        const s = new Date(Date.UTC(year, month - 1, day - startIndex));
        key = `week:${s.getUTCFullYear()}-${pad2(s.getUTCMonth() + 1)}-${pad2(s.getUTCDate())}`;
      }
      return {
        startMs: midnight(tz, year, month, day - startIndex, ambiguity),
        endMs: midnight(tz, year, month, day - startIndex + 7, ambiguity),
        key,
      };
    }
    case 'month': {
      const d = new Date(Date.UTC(year, month - 1, 1));
      return {
        startMs: midnight(tz, year, month, 1, ambiguity),
        endMs: midnight(tz, year, month + 1, 1, ambiguity),
        key: `month:${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`,
      };
    }
    case 'quarter': {
      const d = new Date(Date.UTC(year, month - 1, 1));
      const q = Math.floor(d.getUTCMonth() / 3); // 0-3
      return {
        startMs: midnight(tz, d.getUTCFullYear(), q * 3 + 1, 1, ambiguity),
        endMs: midnight(tz, d.getUTCFullYear(), q * 3 + 4, 1, ambiguity),
        key: `quarter:${d.getUTCFullYear()}-Q${q + 1}`,
      };
    }
  }
}

/** The anchor date of the period immediately BEFORE the one anchored at (y, m, d). */
function priorPeriodAnchor(
  grain: Extract<MetricWindow, { kind: 'periodic' }>['grain'],
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  switch (grain) {
    case 'day':
      return { year, month, day: day - 1 };
    case 'week':
      return { year, month, day: day - 7 };
    case 'month':
      return { year, month: month - 1, day: 1 };
    case 'quarter':
      return { year, month: month - 3, day: 1 };
  }
}

function resolvePeriodic(
  spec: Extract<MetricWindow, { kind: 'periodic' }>,
  atMs: number,
  tz: string,
  weekStart: Weekday,
  ambiguity: DstAmbiguity,
): ResolvedWindow {
  const w = wallClockAt(tz, atMs);
  let bounds = periodBounds(spec, w.year, w.month, w.day, tz, weekStart, ambiguity);
  // Containment invariant: the resolved window must CONTAIN `at`. Under
  // dstAmbiguity 'later' a repeated period-start midnight resolves to its
  // second occurrence, which can lie AFTER `at` even though `at`'s wall date
  // labels the period (e.g. America/Havana 2026-11-01 00:05 CDT, before the
  // fall-back). The instant then still belongs to the PRIOR period — whose
  // end is that same later-resolved midnight.
  if (atMs < bounds.startMs) {
    const prior = priorPeriodAnchor(spec.grain, w.year, w.month, w.day);
    bounds = periodBounds(spec, prior.year, prior.month, prior.day, tz, weekStart, ambiguity);
  }
  return {
    startIso: isoOf(bounds.startMs),
    endIso: isoOf(bounds.endMs),
    key: bounds.key,
    grain: spec.grain,
    alignment: spec.alignment,
  };
}

/**
 * Epoch start of the period LABELED by `at`'s wall date — WITHOUT the
 * containment adjustment resolveWindow applies. Under dstAmbiguity 'later' a
 * repeated period-start midnight can push this boundary past `at` itself;
 * resolveWindow then serves the (still-open) prior period, while the rollup
 * scheduler's previousWindow needs this raw boundary to find the window that
 * closes AT it — otherwise a tick firing inside the repeated hour would step
 * back one period too far and the boundary window would never materialize.
 */
export function labeledPeriodStartMs(
  spec: Extract<MetricWindow, { kind: 'periodic' }>,
  atIso: string,
  calendar?: CompiledCalendar,
  defaults: EngineDefaults = ENGINE_DEFAULTS,
): number {
  const atMs = Date.parse(atIso);
  if (Number.isNaN(atMs)) {
    throw new ConfigInvalidError(`labeledPeriodStartMs: "at" is not a parseable instant: ${JSON.stringify(atIso)}`);
  }
  const tz = calendar?.timezone ?? defaults.defaultTimezone;
  const weekStart = calendar?.weekStart ?? defaults.weekStart;
  const ambiguity = calendar?.dstAmbiguity ?? DST_AMBIGUITY_DEFAULT;
  const w = wallClockAt(tz, atMs);
  return periodBounds(spec, w.year, w.month, w.day, tz, weekStart, ambiguity).startMs;
}

function resolveRolling(
  spec: Extract<MetricWindow, { kind: 'rolling' }>,
  atMs: number,
  tz: string,
  calendar: CompiledCalendar | undefined,
  ambiguity: DstAmbiguity,
): ResolvedWindow {
  const grain: WindowGrain = `rolling-${spec.length}${spec.unit === 'day' ? 'd' : 'h'}`;
  const endIso = isoOf(atMs);
  const key = `${grain}:${keyIsoOf(atMs)}`;

  let startMs: number;
  if (spec.alignment === 'business') {
    if (spec.unit === 'hour') {
      throw new UnsupportedError('rolling hour windows cannot be business-aligned — business time is day-granular');
    }
    if (calendar === undefined) {
      throw new UnsupportedError('business-aligned rolling windows require a calendar');
    }
    startMs = rollingBusinessStart(spec.length, atMs, calendar);
  } else if (spec.unit === 'hour') {
    startMs = atMs - spec.length * MS_PER_HOUR;
  } else {
    // Calendar days are wall-clock days: the same wall time `length` calendar
    // days earlier in the resolving timezone (so a window crossing a DST
    // shift covers the humanly-expected days, not a fixed 24h multiple).
    const w = wallClockAt(tz, atMs);
    const millisecond = atMs - Math.floor(atMs / 1000) * 1000;
    startMs = wallTimeToInstant(tz, { ...w, day: w.day - spec.length, millisecond }, ambiguity);
  }
  return { startIso: isoOf(startMs), endIso, key, grain, alignment: spec.alignment };
}

/**
 * Business-aligned rolling start: walk local dates backwards from the date
 * containing `at` (that date counts when it is a working day) until `length`
 * working days are covered; the window starts at 00:00 wall of the earliest
 * counted working day.
 */
function rollingBusinessStart(length: number, atMs: number, calendar: CompiledCalendar): number {
  const w: WallClock = wallClockAt(calendar.timezone, atMs);
  let cursor = Date.UTC(w.year, w.month - 1, w.day);
  let remaining = length;
  for (let steps = 0; steps <= calendar.maxBusinessSpanDays; steps += 1, cursor -= MS_PER_DAY) {
    const localDate = new Date(cursor).toISOString().slice(0, 10);
    if (calendar.isWorkingDay(localDate)) {
      remaining -= 1;
      if (remaining === 0) {
        const d = new Date(cursor);
        return midnight(calendar.timezone, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), calendar.dstAmbiguity);
      }
    }
  }
  throw new UnsupportedError(
    `could not find ${length} working days within ${calendar.maxBusinessSpanDays} days — calendar "${calendar.name}" is pathological`,
  );
}

/**
 * Resolve a window spec at an instant. The calendar supplies the timezone,
 * week start and DST-ambiguity policy for periodic boundaries and rolling
 * day-walks, plus the working-day set for business-aligned rolling windows;
 * without a calendar those knobs come from `defaults`
 * (EngineDefaults.defaultTimezone / .weekStart — the DST policy without a
 * calendar is the calendar-schema default, 'earlier').
 */
export function resolveWindow(
  spec: MetricWindow,
  atIso: string,
  calendar?: CompiledCalendar,
  defaults: EngineDefaults = ENGINE_DEFAULTS,
): ResolvedWindow {
  const atMs = Date.parse(atIso);
  if (Number.isNaN(atMs)) {
    throw new ConfigInvalidError(`resolveWindow: "at" is not a parseable instant: ${JSON.stringify(atIso)}`);
  }
  const tz = calendar?.timezone ?? defaults.defaultTimezone;
  const weekStart = calendar?.weekStart ?? defaults.weekStart;
  const ambiguity = calendar?.dstAmbiguity ?? DST_AMBIGUITY_DEFAULT;
  return spec.kind === 'periodic'
    ? resolvePeriodic(spec, atMs, tz, weekStart, ambiguity)
    : resolveRolling(spec, atMs, tz, calendar, ambiguity);
}
