import { z } from 'zod';
import type { SqlDialect } from '../sql/dialect.js';

/**
 * The working-hours clock.
 *
 * Every duration this engine reports is wall-clock, and wall-clock is the wrong
 * unit for most of what it reports on. A handover at five on Friday shows a
 * sixty-two hour wait and outranks a genuine bottleneck that costs four hours
 * every day of the week. Nobody was slow over the weekend; the office was shut.
 *
 * A business calendar converts an instant into **working seconds elapsed since
 * a fixed origin**. Two of those subtract to give the working time between them,
 * which is the whole trick: no interval arithmetic, no calendar join per
 * duration, and every existing measurement becomes a subtraction of two numbers
 * that were computed once per event.
 *
 * Working in LOCAL WALL TIME is deliberate and is what makes daylight saving
 * come out right without a special case. A team works nine to five whatever the
 * clocks did overnight, so the day is defined by its wall-clock boundaries and a
 * 23-hour or 25-hour day still contains eight working hours.
 *
 * Nothing here is on by default. It changes figures the product already
 * reports, so a caller opts in and every result says which clock it used —
 * silently re-basing somebody's bottleneck ranking is not an improvement.
 */

/** Monday is 0. A Sunday-first convention would silently disagree with ISO. */
export const MONDAY = 0;

/**
 * 1970-01-05 was a Monday, which makes it the natural origin: week boundaries
 * fall on multiples of seven days from it with no correction term.
 */
const ORIGIN_DATE = '1970-01-05';

const MINUTES_PER_DAY = 24 * 60;

/** Bounded so a generated holiday comparison cannot grow without limit. */
export const MAX_HOLIDAYS = 1000;

export const businessCalendarSchema = z
  .object({
    /**
     * IANA zone the working day is defined in, e.g. 'Europe/London'.
     *
     * Required rather than defaulted. A calendar with no zone is a calendar in
     * whichever zone the server happens to sit in, and the same log would then
     * measure differently in Mumbai and Frankfurt.
     */
    timezone: z.string().min(1).max(64),
    /** Days the office is open. 0 is Monday. */
    workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    /** Minutes from local midnight the day opens, e.g. 540 for 09:00. */
    startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
    /** Minutes from local midnight the day closes, e.g. 1020 for 17:00. */
    endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
    /**
     * Local dates the office is shut, as YYYY-MM-DD.
     *
     * A holiday falling on a non-working day is ignored rather than subtracted
     * twice — a bank holiday on a Sunday costs a team nothing.
     */
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(MAX_HOLIDAYS).default([]),
  })
  .refine((c) => c.endMinute > c.startMinute, {
    message: 'the working day must end after it starts',
    path: ['endMinute'],
  })
  // Checked here rather than left to fail later. An unknown zone throws inside
  // Intl on the TypeScript side and errors inside the query on the SQL side,
  // neither of which names the setting that was wrong.
  .refine((c) => isKnownTimezone(c.timezone), {
    message: 'unknown IANA time zone',
    path: ['timezone'],
  });

/** Whether the runtime's zone database recognises this name. */
function isKnownTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export type BusinessCalendar = z.infer<typeof businessCalendarSchema>;

/** Seconds in one working day. */
export function workingDaySeconds(calendar: BusinessCalendar): number {
  return (calendar.endMinute - calendar.startMinute) * 60;
}

/** Distinct working days per week, so a repeated entry cannot inflate a week. */
function workingDaysPerWeek(calendar: BusinessCalendar): number {
  return new Set(calendar.workingDays).size;
}

/** Whether a weekday index is open, 0 = Monday. */
function isWorkingDay(calendar: BusinessCalendar, dayOfWeek: number): boolean {
  return calendar.workingDays.includes(dayOfWeek);
}

/**
 * Working days strictly before `dayOfWeek` within its own week.
 *
 * Precomputed as seven numbers because it is a lookup, not a calculation, and
 * inlining it keeps the SQL a fixed size whatever the calendar says.
 */
function weekPrefix(calendar: BusinessCalendar): number[] {
  const prefix: number[] = [];
  let running = 0;
  for (let day = 0; day < 7; day += 1) {
    prefix.push(running);
    if (isWorkingDay(calendar, day)) running += 1;
  }
  return prefix;
}

/**
 * Holidays that actually cost a working day, sorted.
 *
 * A holiday on a closed day is dropped here rather than subtracted later:
 * removing a day that was never added would run the clock backwards.
 */
function effectiveHolidays(calendar: BusinessCalendar): string[] {
  const seen = new Set<string>();
  for (const date of calendar.holidays) {
    if (isWorkingDay(calendar, weekdayOf(date))) seen.add(date);
  }
  return [...seen].sort();
}

/** Weekday index of a YYYY-MM-DD local date, 0 = Monday. */
function weekdayOf(date: string): number {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const origin = Math.floor(Date.parse(`${ORIGIN_DATE}T00:00:00Z`) / 86_400_000);
  return modulo(days - origin, 7);
}

/** Remainder that stays non-negative, which `%` does not for negative inputs. */
function modulo(value: number, by: number): number {
  return ((value % by) + by) % by;
}

// ---------------------------------------------------------------------------
// The calculation, in TypeScript
// ---------------------------------------------------------------------------

/** A timestamp broken into the parts the calculation needs, in local wall time. */
export interface LocalParts {
  /** Whole days from the origin Monday to this local date. */
  dayIndex: number;
  /** Seconds since local midnight. */
  secondsIntoDay: number;
  /** The local date as YYYY-MM-DD. */
  date: string;
}

/**
 * Split an instant into local parts.
 *
 * `Intl.DateTimeFormat` does the zone arithmetic — including every historical
 * daylight-saving rule — rather than a hand-rolled offset table, which is the
 * classic way to be wrong for one hour twice a year.
 */
export function localParts(at: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);

  const read = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  const date = `${pad(read('year'), 4)}-${pad(read('month'))}-${pad(read('day'))}`;

  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const origin = Math.floor(Date.parse(`${ORIGIN_DATE}T00:00:00Z`) / 86_400_000);

  return {
    dayIndex: days - origin,
    secondsIntoDay: read('hour') * 3600 + read('minute') * 60 + read('second'),
    date,
  };
}

/**
 * Working seconds from the origin Monday to this instant.
 *
 * Negative for instants before 1970 — the origin is a reference point, not a
 * floor, and only differences between two of these are ever reported.
 */
export function businessElapsed(at: Date, calendar: BusinessCalendar): number {
  const { dayIndex, secondsIntoDay, date } = localParts(at, calendar.timezone);
  const dayLength = workingDaySeconds(calendar);
  const dayOfWeek = modulo(dayIndex, 7);
  // dayIndex - dayOfWeek is an exact multiple of seven, so this floors correctly
  // on both sides of the origin.
  const weeks = (dayIndex - dayOfWeek) / 7;

  const holidays = effectiveHolidays(calendar);
  const before = holidays.filter((h) => h < date).length;
  const openToday = isWorkingDay(calendar, dayOfWeek) && !holidays.includes(date);

  const startSeconds = calendar.startMinute * 60;
  const partial = openToday
    ? Math.min(dayLength, Math.max(0, secondsIntoDay - startSeconds))
    : 0;

  return (
    (weeks * workingDaysPerWeek(calendar) + weekPrefix(calendar)[dayOfWeek]! - before) * dayLength +
    partial
  );
}

/**
 * Working seconds between two instants.
 *
 * Clamped at zero: a negative gap means the two events overlap or arrived out
 * of order, not that time ran backwards.
 */
export function businessSecondsBetween(
  from: Date,
  to: Date,
  calendar: BusinessCalendar,
): number {
  return Math.max(0, businessElapsed(to, calendar) - businessElapsed(from, calendar));
}

/**
 * Weekday of a LOCAL timestamp expression, 0 = Monday.
 *
 * Derived from the same origin Monday the elapsed calculation uses, so a
 * weekday here and a `workingDays` entry on a calendar are the same number.
 * Two different weekday conventions in one engine would put Sunday's traffic
 * under Monday on a heatmap and nothing would look wrong.
 */
export function weekdayExpr(dialect: SqlDialect, localExpr: string): string {
  const dayIndex = dialect.daysFromDate(ORIGIN_DATE, localExpr);
  return `(((${dayIndex}) % 7 + 7) % 7)`;
}

/** Hour of a LOCAL timestamp expression, 0-23. */
export function hourExpr(dialect: SqlDialect, localExpr: string): string {
  return `CAST(FLOOR((${dialect.secondsIntoDay(localExpr)}) / 3600) AS INTEGER)`;
}

/** Weekday names, Monday first, matching the index above. */
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ---------------------------------------------------------------------------
// The same calculation, in SQL
// ---------------------------------------------------------------------------

/**
 * The SQL twin of `businessElapsed`, as an expression over a timestamp column.
 *
 * Emitted once per event in the projected log so that every duration downstream
 * — waiting, cycle time, arc delay, handover cost — becomes a subtraction of
 * two numbers rather than its own calendar calculation. One place to be right,
 * and no analysis can quietly use a different clock from its neighbour.
 *
 * The timezone and the holiday dates travel as bound parameters. They arrive
 * from configuration, and configuration never reaches SQL as text in this
 * engine.
 */
export function businessElapsedExpr(
  dialect: SqlDialect,
  tsExpr: string,
  calendar: BusinessCalendar,
  params: unknown[],
): string {
  const dayLength = workingDaySeconds(calendar);
  const perWeek = workingDaysPerWeek(calendar);
  const prefix = weekPrefix(calendar);
  const startSeconds = calendar.startMinute * 60;

  params.push(calendar.timezone);
  const zone = dialect.placeholder(params.length);

  const local = dialect.localTimestamp(tsExpr, zone);
  const dayIndex = dialect.daysFromDate(ORIGIN_DATE, local);
  const secondsIntoDay = dialect.secondsIntoDay(local);
  const localDate = dialect.dateOf(local);

  // ((x % 7) + 7) % 7 — SQL's modulo keeps the sign of the dividend, so a date
  // before the origin would otherwise land on a negative weekday.
  const dayOfWeek = `(((${dayIndex}) % 7 + 7) % 7)`;
  const weeks = `(((${dayIndex}) - ${dayOfWeek}) / 7)`;

  const branch = (values: readonly (number | string)[], fallback: string): string =>
    `CASE ${dayOfWeek} ${values.map((v, i) => `WHEN ${i} THEN ${v}`).join(' ')} ELSE ${fallback} END`;

  const prefixExpr = branch(prefix, '0');
  const openWeekday = branch(
    Array.from({ length: 7 }, (_, day) => (isWorkingDay(calendar, day) ? 1 : 0)),
    '0',
  );

  const holidays = effectiveHolidays(calendar);
  const holidayParams = holidays.map((date) => {
    params.push(date);
    return dialect.placeholder(params.length);
  });

  // Whole holidays already counted by the week arithmetic, and whether today is
  // one — a holiday must remove its partial day too, or an event stamped at
  // noon on a closed day would still accrue three hours.
  const holidaysBefore =
    holidays.length === 0
      ? '0'
      : `(${holidayParams.map((p) => `CASE WHEN ${localDate} > ${p} THEN 1 ELSE 0 END`).join(' + ')})`;
  const closedToday =
    holidays.length === 0
      ? '0'
      : `(CASE WHEN ${localDate} IN (${holidayParams.join(', ')}) THEN 1 ELSE 0 END)`;

  const open = `((${openWeekday}) * (1 - ${closedToday}))`;
  const partial = `((${open}) * LEAST(${dayLength}, GREATEST(0, (${secondsIntoDay}) - ${startSeconds})))`;

  return `((((${weeks}) * ${perWeek} + (${prefixExpr}) - (${holidaysBefore})) * ${dayLength}) + ${partial})`;
}

/**
 * A calendar in one line, for the metadata on a result.
 *
 * Every report says which clock produced it. A duration is meaningless without
 * that: eight hours of working time and eight hours of wall-clock time are
 * different measurements, and a reader who cannot tell them apart will compare
 * one against the other.
 */
export function describeCalendar(calendar: BusinessCalendar): string {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [...new Set(calendar.workingDays)].sort((a, b) => a - b);
  const clock = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  // A contiguous run reads as a range; anything else is listed, because
  // 'Mon-Fri' for a Monday/Wednesday/Friday week would be a plain lie.
  const contiguous = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
  const when = contiguous
    ? `${names[days[0]!]}-${names[days[days.length - 1]!]}`
    : days.map((d) => names[d]).join(', ');

  const shut = effectiveHolidays(calendar).length;
  const holidays = shut === 0 ? '' : `, ${shut} closed ${shut === 1 ? 'day' : 'days'}`;
  return `working hours: ${when} ${clock(calendar.startMinute)}-${clock(calendar.endMinute)} ${calendar.timezone}${holidays}`;
}
