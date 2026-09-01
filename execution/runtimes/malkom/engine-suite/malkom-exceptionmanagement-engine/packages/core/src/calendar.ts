/**
 * Business time, per party.
 *
 * The response leg runs in the resolver's working hours and the action leg in
 * the originator's. An engine that uses one calendar for both reports SLAs
 * that are confidently wrong the moment the two parties sit in different
 * zones — which, for a Kolkata/Houston pair, is every single handover.
 *
 * No dependency: `Intl.DateTimeFormat` already knows every IANA zone and its
 * DST history, which is the only hard part. In MALKOM the host swaps this for
 * the process-metrics engine's versioned calendars through `CalendarProvider`;
 * these implementations are the standalone default so the engine runs alone.
 */

export interface BusinessCalendar {
  readonly id: string;
  /** IANA zone, e.g. "Asia/Kolkata". */
  readonly timezone: string;
  /** 0 = Sunday … 6 = Saturday. */
  readonly workdays: readonly number[];
  /** Local "HH:MM"; `end` may be "24:00" for a full day. */
  readonly start: string;
  readonly end: string;
  /** Local "YYYY-MM-DD" dates that are not worked. */
  readonly holidays: readonly string[];
}

/** Every minute counts. The default when a host declares no calendar. */
export const ALWAYS_ON: BusinessCalendar = {
  id: '24x7',
  timezone: 'UTC',
  workdays: [0, 1, 2, 3, 4, 5, 6],
  start: '00:00',
  end: '24:00',
  holidays: [],
};

export interface CalendarProvider {
  /** Never throws: an unknown id falls back to 24x7 rather than stopping work. */
  get(id: string): BusinessCalendar;
}

export class StaticCalendarProvider implements CalendarProvider {
  private readonly byId: Map<string, BusinessCalendar>;
  constructor(calendars: readonly BusinessCalendar[] = []) {
    this.byId = new Map(calendars.map((calendar) => [calendar.id, calendar]));
    if (!this.byId.has(ALWAYS_ON.id)) this.byId.set(ALWAYS_ON.id, ALWAYS_ON);
  }
  get(id: string): BusinessCalendar {
    return this.byId.get(id) ?? ALWAYS_ON;
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  const held = formatters.get(timezone);
  if (held !== undefined) return held;
  const made = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  formatters.set(timezone, made);
  return made;
};

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly weekday: number;
}

/** What the wall clock in `timezone` reads at this instant. */
export const localPartsAt = (instantMs: number, timezone: string): LocalParts => {
  const parts = formatterFor(timezone).formatToParts(new Date(instantMs));
  const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '0';
  const name = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: Math.max(0, WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number])),
  };
};

/** The zone's offset from UTC at a given instant, in milliseconds. */
const offsetMsAt = (instantMs: number, timezone: string): number => {
  const parts = localPartsAt(instantMs, timezone);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asIfUtc - Math.floor(instantMs / 1000) * 1000;
};

/**
 * The instant at which a local wall time occurs. Two passes, because the
 * offset we need is the offset *at the answer* — the first pass gets close
 * enough that the second lands on it either side of a DST change. A local
 * time that does not exist (the spring-forward hour) resolves to the instant
 * the clock jumps to, which is the only defensible reading of it.
 */
export const instantAtLocal = (
  year: number,
  month: number,
  day: number,
  minutesIntoDay: number,
  timezone: string,
): number => {
  const wall = Date.UTC(year, month - 1, day) + minutesIntoDay * 60_000;
  const once = wall - offsetMsAt(wall, timezone);
  return wall - offsetMsAt(once, timezone);
};

const parseHm = (value: string): number => {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const pad = (value: number): string => String(value).padStart(2, '0');

const DAY_MS = 86_400_000;

/**
 * Working minutes between two instants, in one calendar. Walks local calendar
 * dates and sums the overlap of each working window with the interval, so DST
 * shifts and holidays fall out of the arithmetic rather than being corrected
 * for afterwards.
 */
export const businessMinutesBetween = (
  fromIso: string,
  toIso: string,
  calendar: BusinessCalendar,
): number => {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;

  const openMinute = parseHm(calendar.start);
  const closeMinute = parseHm(calendar.end);
  if (closeMinute <= openMinute) return 0;

  const workdays = new Set(calendar.workdays);
  const holidays = new Set(calendar.holidays);

  // Start a day early so a window that opened before `from` is still counted.
  const first = localPartsAt(from - DAY_MS, calendar.timezone);
  let marker = Date.UTC(first.year, first.month - 1, first.day);
  const stopAfter = to + DAY_MS;

  let minutes = 0;
  while (marker <= stopAfter) {
    const date = new Date(marker);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const isHoliday = holidays.has(`${year}-${pad(month)}-${pad(day)}`);
    if (workdays.has(date.getUTCDay()) && !isHoliday) {
      const opens = instantAtLocal(year, month, day, openMinute, calendar.timezone);
      const closes = instantAtLocal(year, month, day, closeMinute, calendar.timezone);
      const lower = Math.max(opens, from);
      const upper = Math.min(closes, to);
      if (upper > lower) minutes += (upper - lower) / 60_000;
    }
    marker += DAY_MS;
  }
  return Math.round(minutes);
};

/**
 * The instant `minutes` of working time after `fromIso`. This is how a due
 * time is set: a four-hour response budget raised at 16:40 in a zone that
 * closes at 18:00 is due at 11:40 the next working morning, not at 20:40.
 */
export const addBusinessMinutes = (
  fromIso: string,
  minutes: number,
  calendar: BusinessCalendar,
): string => {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) throw new TypeError(`not a timestamp: ${fromIso}`);
  if (minutes <= 0) return new Date(from).toISOString();

  const openMinute = parseHm(calendar.start);
  const closeMinute = parseHm(calendar.end);
  if (closeMinute <= openMinute) throw new RangeError(`calendar ${calendar.id} never opens`);

  const workdays = new Set(calendar.workdays);
  const holidays = new Set(calendar.holidays);

  let remaining = minutes;
  const first = localPartsAt(from, calendar.timezone);
  let marker = Date.UTC(first.year, first.month - 1, first.day);

  // A year of days is a generous bound; a budget that cannot be spent inside
  // one is a configuration error, and saying so beats looping forever.
  for (let guard = 0; guard < 400; guard += 1) {
    const date = new Date(marker);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const isHoliday = holidays.has(`${year}-${pad(month)}-${pad(day)}`);
    if (workdays.has(date.getUTCDay()) && !isHoliday) {
      const opens = instantAtLocal(year, month, day, openMinute, calendar.timezone);
      const closes = instantAtLocal(year, month, day, closeMinute, calendar.timezone);
      const enters = Math.max(opens, from);
      if (closes > enters) {
        const available = (closes - enters) / 60_000;
        if (available >= remaining) return new Date(enters + remaining * 60_000).toISOString();
        remaining -= available;
      }
    }
    marker += DAY_MS;
  }
  throw new RangeError(`${minutes} working minutes do not fit within a year of calendar ${calendar.id}`);
};
