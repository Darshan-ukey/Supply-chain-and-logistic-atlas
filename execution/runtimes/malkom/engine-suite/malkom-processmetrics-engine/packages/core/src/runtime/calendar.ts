import { ENGINE_DEFAULTS, type DstAmbiguity } from '../config/defaults.js';
import type { Calendar, Weekday } from '../config/schemas.js';
import { ConfigInvalidError, UnsupportedError } from '../domain/errors.js';

/**
 * Business-time math — pure, deterministic, dependency-free.
 *
 * Timezone mechanics use only Intl.DateTimeFormat (instant → wall clock) and
 * a two-pass wall-clock → instant resolver, so the engine needs no timezone
 * library and every result is a pure function of its inputs. No I/O, no
 * ambient clock: every function takes instants (ISO strings or epoch ms).
 *
 * DST is handled, not approximated:
 *  - a working window spanning spring-forward loses the skipped hour (its
 *    boundary instants are resolved through real wall clocks, so the window
 *    is physically shorter);
 *  - fall-back gains the repeated hour;
 *  - ambiguous wall times (fall-back replays them) resolve per the calendar's
 *    `dstAmbiguity` policy — 'earlier' (first occurrence, the default) or
 *    'later';
 *  - skipped wall times (spring-forward removes them) resolve with the
 *    pre-transition offset, i.e. they land just past the jump.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Spans beyond this many days are configuration accidents, not calculations.
 * The DEFAULT bound — per-calendar overrides flow in through compileCalendar
 * options (EngineDefaults.maxBusinessSpanDays).
 */
export const MAX_SPAN_DAYS = ENGINE_DEFAULTS.maxBusinessSpanDays;

/** A local wall-clock reading of an instant in some timezone. */
export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

// One formatter per timezone — construction is expensive, formatting is not.
// Pure cache: the formatter is a deterministic function of the zone id.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Read the wall clock of `epochMs` in `timeZone` via formatToParts. */
export function wallClockAt(timeZone: string, epochMs: number): WallClock {
  const parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const p = parts.find((x) => x.type === type);
    if (p === undefined) throw new ConfigInvalidError(`timezone "${timeZone}" did not format a ${type} part`);
    return Number(p.value);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * The zone's UTC offset at an instant, in ms (positive east of Greenwich).
 * Computed at whole-second precision — offsets are minute-multiples for every
 * modern date, so the instant's sub-second part must not leak into the answer.
 */
function tzOffsetMs(timeZone: string, epochMs: number): number {
  const floored = Math.floor(epochMs / 1000) * 1000;
  const w = wallClockAt(timeZone, floored);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - floored;
}

/**
 * Resolve a local wall time to an instant — the standard two-pass technique:
 * read the offsets a day before and after the naive UTC reading (a window
 * that brackets any single DST transition), derive a candidate instant from
 * each, and keep the ones that round-trip to the requested wall clock.
 *
 *  - unambiguous: both candidates agree → that instant;
 *  - ambiguous (fall-back): both round-trip → the occurrence `ambiguity`
 *    selects ('earlier' = first, the default; 'later' = second);
 *  - skipped (spring-forward): neither round-trips → resolve with the
 *    pre-transition offset, which lands immediately after the jump
 *    (e.g. 02:30 on a US spring-forward day resolves to 03:30 local).
 */
export function wallTimeToInstant(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number; millisecond?: number },
  ambiguity: DstAmbiguity = 'earlier',
): number {
  const target = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
    wall.millisecond ?? 0,
  );
  const offBefore = tzOffsetMs(timeZone, target - MS_PER_DAY);
  const offAfter = tzOffsetMs(timeZone, target + MS_PER_DAY);
  const candidates = offBefore === offAfter ? [target - offBefore] : [target - offBefore, target - offAfter];
  const valid = candidates.filter((c) => c + tzOffsetMs(timeZone, c) === target);
  if (valid.length > 0) return ambiguity === 'later' ? Math.max(...valid) : Math.min(...valid);
  return target - Math.min(offBefore, offAfter); // skipped → pre-transition offset
}

/** Accept an instant as ISO-8601 string or epoch ms; anything else throws. */
function toEpochMs(instant: string | number, what: string): number {
  if (typeof instant === 'number') {
    if (!Number.isFinite(instant)) throw new ConfigInvalidError(`${what} is not a finite epoch-ms value`);
    return instant;
  }
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) throw new ConfigInvalidError(`${what} is not a parseable instant: ${JSON.stringify(instant)}`);
  return ms;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "YYYY-MM-DD" of the wall clock — the calendar-local date of an instant. */
function localDateOfWall(w: WallClock): string {
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Weekday name of a "YYYY-MM-DD" label, by pure date arithmetic (no tz). */
const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function splitLocalDate(localDate: string): { year: number; month: number; day: number } {
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new ConfigInvalidError(`not a "YYYY-MM-DD" local date: ${JSON.stringify(localDate)}`);
  }
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return { year: y, month: m, day: d };
}

/** The instant range [startMs, endMs) of one local day's working window. */
interface DayWindow {
  startMs: number;
  endMs: number;
}

function hhmmToMinutes(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return { hour: h, minute: m };
}

/** Options a host's EngineDefaults thread into calendar compilation. */
export interface CompileCalendarOptions {
  /** Overrides the default span guard (EngineDefaults.maxBusinessSpanDays). */
  maxBusinessSpanDays?: number;
}

/**
 * A calendar compiled for computation: workweek/holiday membership tests and
 * DST-correct business-time arithmetic in the calendar's IANA timezone.
 * Immutable once built; per-day window instants are memoized in a plain Map
 * (deterministic — the cache only ever stores pure-function results).
 */
export class CompiledCalendar {
  readonly doc: Calendar;
  readonly name: string;
  readonly timezone: string;
  /** The day weeks start on (schema default 'mon'); window resolution reads it. */
  readonly weekStart: Weekday;
  /** Ambiguous-wall-time policy (schema default 'earlier'). */
  readonly dstAmbiguity: DstAmbiguity;
  /** Span guard in days (EngineDefaults.maxBusinessSpanDays unless overridden). */
  readonly maxBusinessSpanDays: number;
  /** Store version when compiled from a CalendarRecord; flows into traces. */
  readonly version?: number;

  private readonly workweek: ReadonlySet<Weekday>;
  private readonly holidays: ReadonlySet<string>;
  private readonly start: { hour: number; minute: number };
  private readonly end: { hour: number; minute: number };
  private readonly dayWindows = new Map<string, DayWindow | null>();

  constructor(doc: Calendar, version?: number, options: CompileCalendarOptions = {}) {
    this.doc = doc;
    this.name = doc.name;
    this.timezone = doc.timezone;
    this.weekStart = doc.weekStart;
    this.dstAmbiguity = doc.dstAmbiguity;
    this.maxBusinessSpanDays = options.maxBusinessSpanDays ?? ENGINE_DEFAULTS.maxBusinessSpanDays;
    if (version !== undefined) this.version = version;
    this.workweek = new Set(doc.workweek);
    this.holidays = new Set(doc.holidays.map((h) => h.date));
    // Re-validated here, not only in the zod schema: hosts can construct
    // Calendar objects directly, and an inverted window would silently zero
    // every business-time computation (workingWindow treats end <= start as
    // an empty day).
    if (doc.workingHours.start >= doc.workingHours.end) {
      throw new ConfigInvalidError(
        `calendar "${doc.name}": workingHours.start (${doc.workingHours.start}) must be before end (${doc.workingHours.end})`,
      );
    }
    this.start = hhmmToMinutes(doc.workingHours.start);
    this.end = hhmmToMinutes(doc.workingHours.end);
  }

  private guardSpan(startMs: number, endMs: number): void {
    if (endMs - startMs > this.maxBusinessSpanDays * MS_PER_DAY) {
      throw new UnsupportedError(
        `business-time span exceeds ${this.maxBusinessSpanDays} days — refusing a pathological range`,
      );
    }
  }

  /** Workweek membership minus holidays, for a "YYYY-MM-DD" local date. */
  isWorkingDay(localDate: string): boolean {
    const { year, month, day } = splitLocalDate(localDate);
    const weekday = WEEKDAY_BY_UTC_DAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
    return this.workweek.has(weekday) && !this.holidays.has(localDate);
  }

  /** The calendar-local "YYYY-MM-DD" date an instant falls on. */
  localDateOf(instant: string | number): string {
    return localDateOfWall(wallClockAt(this.timezone, toEpochMs(instant, 'instant')));
  }

  /**
   * The working window of a local date as a half-open instant range, or null
   * on non-working days. Boundaries resolve through real wall clocks, so a
   * window spanning spring-forward is physically one hour shorter and one
   * spanning fall-back one hour longer. Memoized per local date.
   */
  workingWindow(localDate: string): DayWindow | null {
    const cached = this.dayWindows.get(localDate);
    if (cached !== undefined) return cached;
    let window: DayWindow | null = null;
    if (this.isWorkingDay(localDate)) {
      const { year, month, day } = splitLocalDate(localDate);
      const startMs = wallTimeToInstant(this.timezone, { year, month, day, ...this.start }, this.dstAmbiguity);
      const endMs = wallTimeToInstant(this.timezone, { year, month, day, ...this.end }, this.dstAmbiguity);
      // A window swallowed whole by a DST gap would invert; treat as empty.
      if (endMs > startMs) window = { startMs, endMs };
    }
    this.dayWindows.set(localDate, window);
    return window;
  }

  /**
   * Minutes of overlap between [start, end) and the calendar's working
   * windows. Exact (fractional when the instants are not minute-aligned);
   * 0 when end <= start; spans over MAX_SPAN_DAYS days throw.
   */
  businessMinutesBetween(start: string | number, end: string | number): number {
    const startMs = toEpochMs(start, 'start');
    const endMs = toEpochMs(end, 'end');
    if (endMs <= startMs) return 0;
    this.guardSpan(startMs, endMs);

    // Walk local dates from the start's to the end's, inclusive. A day's
    // working window never leaks past its own local midnight, so days outside
    // this range cannot overlap [start, end).
    const first = splitLocalDate(this.localDateOf(startMs));
    const last = this.localDateOf(endMs);
    let overlapMs = 0;
    for (let t = Date.UTC(first.year, first.month - 1, first.day); ; t += MS_PER_DAY) {
      const localDate = new Date(t).toISOString().slice(0, 10);
      const w = this.workingWindow(localDate);
      if (w !== null) {
        overlapMs += Math.max(0, Math.min(endMs, w.endMs) - Math.max(startMs, w.startMs));
      }
      if (localDate === last) break;
    }
    return overlapMs / MS_PER_MINUTE;
  }

  /**
   * The number of working days D (calendar-local dates in this calendar's
   * timezone) with localDate(start) <= D < localDate(end) — i.e. the day
   * containing `start` counts when it is a working day regardless of the
   * time of day, the day containing `end` never counts, and end <= start
   * (or both instants on the same local date) yields 0.
   */
  businessDaysBetween(start: string | number, end: string | number): number {
    const startMs = toEpochMs(start, 'start');
    const endMs = toEpochMs(end, 'end');
    if (endMs <= startMs) return 0;
    this.guardSpan(startMs, endMs);

    const first = splitLocalDate(this.localDateOf(startMs));
    const last = this.localDateOf(endMs);
    let days = 0;
    for (let t = Date.UTC(first.year, first.month - 1, first.day); ; t += MS_PER_DAY) {
      const localDate = new Date(t).toISOString().slice(0, 10);
      if (localDate === last) break;
      if (this.isWorkingDay(localDate)) days += 1;
    }
    return days;
  }

  /** How long something has been waiting, in business minutes, as of `now`. */
  ageBusinessMinutes(fieldInstant: string | number, now: string | number): number {
    return this.businessMinutesBetween(fieldInstant, now);
  }
}

/** Compile a parsed calendar document; `version` (when stored) joins traces. */
export function compileCalendar(doc: Calendar, version?: number, options: CompileCalendarOptions = {}): CompiledCalendar {
  return new CompiledCalendar(doc, version, options);
}
