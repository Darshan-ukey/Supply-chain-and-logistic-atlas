import type { CaseFilter } from '../runtime/filter.js';
import type { OutcomeSpec } from '../runtime/rootcause.js';

/**
 * The terse selector grammar, shared by the CLI and the HTTP surface.
 *
 * Defined once because two parsers for one grammar drift, and the moment they
 * do, a selection that works in the terminal quietly means something else over
 * the wire. It is deliberately compact: these are typed at a prompt or pasted
 * into a query string, and a JSON blob is unusable in both.
 *
 *   channel=web            attribute equals
 *   channel=web,phone      attribute is any of
 *   activity:Approve       the case does it        (!activity: never does)
 *   resource:alice         the case involves them  (!resource: never does)
 *   slower-than:3600       cycle time at least N seconds
 *   faster-than:3600       cycle time at most N seconds
 *   length:3..5            trace length between (open-ended as 3..)
 *   from:ISO..ISO          case active in the window
 *   variant:A>B>C          the case follows exactly this path
 *   path:A>B               A led to B          (path!:A>B for immediately after)
 *   rework:3               some step ran 3+ times
 *   rework:Assess:3        Assess ran 3+ times
 */
export function parseFilterSpec(spec: string): CaseFilter | undefined {
  const trimmed = spec.trim();
  if (trimmed === '') return undefined;

  if (trimmed.startsWith('!activity:')) {
    return { kind: 'activity', activity: trimmed.slice(10), present: false };
  }
  if (trimmed.startsWith('activity:')) {
    return { kind: 'activity', activity: trimmed.slice(9) };
  }
  if (trimmed.startsWith('!resource:')) {
    return { kind: 'resource', resource: trimmed.slice(10), present: false };
  }
  if (trimmed.startsWith('resource:')) {
    return { kind: 'resource', resource: trimmed.slice(9) };
  }

  if (trimmed.startsWith('slower-than:')) {
    const seconds = Number(trimmed.slice(12));
    return Number.isFinite(seconds) ? { kind: 'cycleTime', minSeconds: seconds } : undefined;
  }
  if (trimmed.startsWith('faster-than:')) {
    const seconds = Number(trimmed.slice(12));
    return Number.isFinite(seconds) ? { kind: 'cycleTime', maxSeconds: seconds } : undefined;
  }

  if (trimmed.startsWith('length:')) {
    const [minText, maxText] = trimmed.slice(7).split('..');
    const min = Number(minText);
    if (!Number.isFinite(min)) return undefined;
    // 'length:3..' is open-ended on purpose — "at least three steps" is a more
    // common question than "between three and some arbitrary ceiling".
    const max = maxText === undefined || maxText === '' ? undefined : Number(maxText);
    if (max !== undefined && !Number.isFinite(max)) return undefined;
    return { kind: 'length', min, ...(max !== undefined ? { max } : {}) };
  }

  // '>' separates steps: it reads as a path, and unlike a comma it does not
  // collide with activity names, which routinely contain commas and rarely
  // contain angle brackets.
  if (trimmed.startsWith('variant:')) {
    const path = trimmed
      .slice(8)
      .split('>')
      .map((a) => a.trim())
      .filter((a) => a !== '');
    return path.length === 0 ? undefined : { kind: 'variant', path };
  }
  if (trimmed.startsWith('path!:') || trimmed.startsWith('path:')) {
    const directly = trimmed.startsWith('path!:');
    const [from, to] = trimmed
      .slice(directly ? 6 : 5)
      .split('>')
      .map((a) => a.trim());
    if (from === undefined || to === undefined || from === '' || to === '') return undefined;
    return { kind: 'path', from, to, ...(directly ? { directly: true } : {}) };
  }
  if (trimmed.startsWith('rework:')) {
    const parts = trimmed.slice(7).split(':');
    // 'rework:3' means any step; 'rework:Assess:3' names one. The count is
    // always last, so an activity containing a colon still parses.
    const times = Number(parts[parts.length - 1]);
    if (!Number.isFinite(times) || times < 1) return undefined;
    const activity = parts.slice(0, -1).join(':');
    return {
      kind: 'rework',
      minTimes: Math.trunc(times),
      ...(activity === '' ? {} : { activity }),
    };
  }

  if (trimmed.startsWith('from:')) {
    const [fromText, toText] = trimmed.slice(5).split('..');
    if (fromText === undefined || toText === undefined) return undefined;
    const from = new Date(fromText);
    const to = new Date(toText);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined;
    return { kind: 'window', from, to };
  }

  const equals = trimmed.indexOf('=');
  if (equals > 0) {
    const key = trimmed.slice(0, equals);
    const values = trimmed
      .slice(equals + 1)
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '');
    if (values.length === 0) return undefined;
    return values.length === 1
      ? { kind: 'attribute', key, value: values[0]! }
      : { kind: 'attribute', key, values };
  }

  return undefined;
}

/**
 * The outcome grammar for root-cause analysis.
 *
 *   slowest:0.2            the slowest fifth of cases
 *   slower-than:604800     cases taking more than a week
 *   contains:Reject        cases that reach an activity
 *   missing:Pay            cases that never reach one
 */
export function parseOutcomeSpec(spec: string): OutcomeSpec | undefined {
  const trimmed = spec.trim();

  if (trimmed.startsWith('slowest:')) {
    const fraction = Number(trimmed.slice(8));
    return Number.isFinite(fraction) && fraction > 0 && fraction < 1
      ? { kind: 'slowest-fraction', fraction }
      : undefined;
  }
  if (trimmed.startsWith('slower-than:')) {
    const seconds = Number(trimmed.slice(12));
    return Number.isFinite(seconds) ? { kind: 'slower-than', seconds } : undefined;
  }
  if (trimmed.startsWith('contains:')) {
    const activity = trimmed.slice(9);
    return activity === '' ? undefined : { kind: 'contains', activity };
  }
  if (trimmed.startsWith('missing:')) {
    const activity = trimmed.slice(8);
    return activity === '' ? undefined : { kind: 'missing', activity };
  }
  return undefined;
}

/** Every filter form, for help text and API discovery. */
export const FILTER_GRAMMAR: readonly { form: string; means: string }[] = [
  { form: 'key=value', means: 'case attribute equals' },
  { form: 'key=a,b', means: 'case attribute is any of' },
  { form: 'activity:X', means: 'the case performs X' },
  { form: '!activity:X', means: 'the case never performs X' },
  { form: 'resource:R', means: 'the case involves R' },
  { form: '!resource:R', means: 'the case never involves R' },
  { form: 'slower-than:N', means: 'cycle time at least N seconds' },
  { form: 'faster-than:N', means: 'cycle time at most N seconds' },
  { form: 'length:a..b', means: 'trace length between a and b (b optional)' },
  { form: 'from:ISO..ISO', means: 'case active in the window' },
  { form: 'variant:A>B>C', means: 'the case follows exactly this path' },
  { form: 'path:A>B', means: 'A led to B, eventually' },
  { form: 'path!:A>B', means: 'B came immediately after A' },
  { form: 'rework:N', means: 'some step ran N or more times' },
  { form: 'rework:X:N', means: 'X ran N or more times' },
];

// ---------------------------------------------------------------------------
// Working calendars
// ---------------------------------------------------------------------------

/** Day names, Monday first, matching `BusinessCalendar.workingDays`. */
const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DEFAULT_START_MINUTE = 9 * 60;
const DEFAULT_END_MINUTE = 17 * 60;
const DEFAULT_DAYS = [0, 1, 2, 3, 4];

/** `9`, `09:30`, or `17:45` as minutes from midnight. Undefined if it is neither. */
function parseClockTime(text: string): number | undefined {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(text.trim());
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (hours > 24 || minutes > 59) return undefined;
  const total = hours * 60 + minutes;
  return total > 24 * 60 ? undefined : total;
}

/** `mon-fri`, `mon,wed,fri`, or a single day. Undefined if any name is unknown. */
function parseDays(text: string): number[] | undefined {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') return undefined;

  const indexOf = (name: string): number =>
    DAY_NAMES.indexOf(name.trim() as (typeof DAY_NAMES)[number]);

  if (trimmed.includes('-')) {
    const [fromName, toName, ...rest] = trimmed.split('-');
    if (rest.length > 0 || fromName === undefined || toName === undefined) return undefined;
    const from = indexOf(fromName);
    const to = indexOf(toName);
    if (from < 0 || to < 0) return undefined;
    // Wrapping is allowed, so sat-sun and fri-mon both mean what they say
    // rather than being rejected as backwards.
    const days: number[] = [];
    for (let d = from; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === to) break;
    }
    return days;
  }

  const days = trimmed.split(',').map(indexOf);
  return days.some((d) => d < 0) ? undefined : days;
}

/**
 * A working calendar in one string, for a query parameter or a prompt.
 *
 *   Europe/London                          09:00–17:00, Monday to Friday
 *   Europe/London@8-16                     other hours
 *   Asia/Kolkata@09:30-18:00               to the minute
 *   Europe/London@9-17/mon-sat             a six-day week
 *   Europe/London/mon,wed,fri              days without restating the hours
 *   Europe/London@9-17;2026-12-25          shut for the day
 *
 * The zone is required and has no default. A calendar with no zone is a
 * calendar in whichever zone the server happens to sit in, and the same log
 * would then measure differently in Mumbai and Frankfurt.
 *
 * Returns the plain shape rather than a parsed `BusinessCalendar`: validation
 * belongs to the schema, and doing it twice is how two answers to "is this
 * legal" appear. Undefined when the text is not a calendar at all.
 */
export function parseCalendarSpec(spec: string): Record<string, unknown> | undefined {
  const trimmed = spec.trim();
  if (trimmed === '') return undefined;

  // Split off holidays first: a date contains '-', which every other part
  // also uses as a range separator.
  const [scheduleText, holidayText] = splitOnce(trimmed, ';');
  const holidays =
    holidayText === undefined
      ? []
      : holidayText
          .split(',')
          .map((h) => h.trim())
          .filter((h) => h.length > 0);

  // Then days, then hours: '/' cannot appear in the hours and does appear in
  // every zone name, so it is taken from the right.
  let rest = scheduleText;
  let days = DEFAULT_DAYS;
  const slash = rest.lastIndexOf('/');
  const at = rest.indexOf('@');
  if (slash > at && slash > 0 && at >= 0) {
    const parsed = parseDays(rest.slice(slash + 1));
    if (parsed === undefined) return undefined;
    days = parsed;
    rest = rest.slice(0, slash);
  } else if (at < 0 && slash > 0) {
    // No hours given, so a trailing segment is only days if it reads as days —
    // otherwise it is part of the zone, as in Europe/London.
    const parsed = parseDays(rest.slice(slash + 1));
    if (parsed !== undefined) {
      days = parsed;
      rest = rest.slice(0, slash);
    }
  }

  let startMinute = DEFAULT_START_MINUTE;
  let endMinute = DEFAULT_END_MINUTE;
  const [zone, hours] = splitOnce(rest, '@');
  if (hours !== undefined) {
    const [startText, endText] = splitOnce(hours, '-');
    if (endText === undefined) return undefined;
    const start = parseClockTime(startText);
    const end = parseClockTime(endText);
    if (start === undefined || end === undefined) return undefined;
    startMinute = start;
    endMinute = end;
  }
  if (zone.trim() === '') return undefined;

  return {
    timezone: zone.trim(),
    workingDays: days,
    startMinute,
    endMinute,
    holidays,
  };
}

/** Split on the first occurrence, leaving later ones in the tail. */
function splitOnce(text: string, separator: string): [string, string | undefined] {
  const at = text.indexOf(separator);
  return at < 0 ? [text, undefined] : [text.slice(0, at), text.slice(at + separator.length)];
}

/** Every calendar form, for help text and API discovery. */
export const CALENDAR_GRAMMAR: readonly { form: string; means: string }[] = [
  { form: 'ZONE', means: 'IANA zone, 09:00-17:00 Mon-Fri' },
  { form: 'ZONE@8-16', means: 'other hours' },
  { form: 'ZONE@09:30-18:00', means: 'hours to the minute' },
  { form: 'ZONE@9-17/mon-sat', means: 'a six-day week' },
  { form: 'ZONE/mon,wed,fri', means: 'named days' },
  { form: 'ZONE@9-17;2026-12-25', means: 'closed on these dates' },
];
