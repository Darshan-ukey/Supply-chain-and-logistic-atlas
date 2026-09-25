/**
 * The configurability retrofit (M3 §0): every behavioral default lives in
 * config/defaults.ts (or a schema field / definition option) and every knob
 * PROVABLY changes behavior — weekStart shifts the week window, dstAmbiguity
 * shifts the fall-back count by the repeated hour, linear percentiles differ
 * from nearest-rank on a pinned fixture, maxBusinessSpanDays moves the span
 * guard, defaultTimezone moves calendar-less window boundaries.
 */
import { describe, expect, it } from 'vitest';
import {
  ENGINE_DEFAULTS,
  engineDefaultsSchema,
  resolveDefaults,
  UNIT_DEFAULTS,
} from '../src/config/defaults.js';
import {
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type CalendarInput,
  type MetricDefinitionInput,
} from '../src/config/schemas.js';
import { MalkomError } from '../src/domain/errors.js';
import { CompiledRegistry } from '../src/domain/registry.js';
import { compileCalendar, MAX_SPAN_DAYS } from '../src/runtime/calendar.js';
import { compileMetric } from '../src/runtime/compile.js';
import { evaluateMetric } from '../src/runtime/evaluate.js';
import { resolveWindow } from '../src/runtime/window.js';

describe('engineDefaultsSchema', () => {
  it('resolves the documented defaults from an empty (or absent) input', () => {
    expect(resolveDefaults()).toEqual({
      weekStart: 'mon',
      defaultTimezone: 'UTC',
      maxBusinessSpanDays: 4000,
      percentileMethod: 'nearest_rank',
      maxFactRows: 100_000,
      backtestStep: 1,
      // M4: rollups fire "shortly after window close" in the definition's tz.
      rollupCrons: {
        day: '5 0 * * *',
        week: '10 0 * * 1',
        month: '15 0 1 * *',
        quarter: '20 0 1 1,4,7,10 *',
      },
      scheduler: { leaseTtlMs: 60_000 },
      retention: { runsMaxAgeDays: 90, runsMaxRows: 100_000, keepTraces: true },
      backfillEmitsBreaches: false,
    });
    expect(resolveDefaults({})).toEqual(ENGINE_DEFAULTS);
  });

  it('merges a partial override over the documented defaults', () => {
    const d = resolveDefaults({ weekStart: 'sun', maxFactRows: 50 });
    expect(d.weekStart).toBe('sun');
    expect(d.maxFactRows).toBe(50);
    expect(d.defaultTimezone).toBe('UTC'); // untouched knobs keep their defaults
    expect(d.percentileMethod).toBe('nearest_rank');
  });

  it('deep-merges a partial NESTED override (one knob set, siblings keep defaults)', () => {
    const d = resolveDefaults({
      rollupCrons: { day: '0 1 * * *' },
      retention: { keepTraces: false },
      scheduler: { leaseTtlMs: 5_000 },
    });
    expect(d.rollupCrons.day).toBe('0 1 * * *');
    expect(d.rollupCrons.week).toBe('10 0 * * 1'); // untouched sibling
    expect(d.retention).toEqual({ runsMaxAgeDays: 90, runsMaxRows: 100_000, keepTraces: false });
    expect(d.scheduler.leaseTtlMs).toBe(5_000);
    expect(d.backfillEmitsBreaches).toBe(false);
  });

  it('rejects invalid knobs: bad timezone, non-positive ints, unknown keys', () => {
    expect(engineDefaultsSchema.safeParse({ defaultTimezone: 'Mars/Olympus_Mons' }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ maxFactRows: 0 }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ maxBusinessSpanDays: -1 }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ backtestStep: 1.5 }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ weekStart: 'monday' }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ ghostKnob: true }).success).toBe(false);
    // M4 nested knobs are validated too, incl. their own unknown keys.
    expect(engineDefaultsSchema.safeParse({ scheduler: { leaseTtlMs: 0 } }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ retention: { runsMaxAgeDays: -1 } }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ retention: { ghost: 1 } }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ rollupCrons: { day: '' } }).success).toBe(false);
    expect(engineDefaultsSchema.safeParse({ rollupCrons: { hour: '* * * * *' } }).success).toBe(false);
  });

  it('exports the unit-defaults mapping the definition schema applies', () => {
    expect(UNIT_DEFAULTS).toEqual({
      count: 'count',
      percent: 'percent',
      ratio: 'ratio',
      duration: 'minutes',
      currency: undefined,
      number: undefined,
    });
  });

  it('MAX_SPAN_DAYS is the documented default, not an independent literal', () => {
    expect(MAX_SPAN_DAYS).toBe(ENGINE_DEFAULTS.maxBusinessSpanDays);
    expect(MAX_SPAN_DAYS).toBe(4000);
  });
});

function calendar(input: CalendarInput) {
  return compileCalendar(calendarSchema.parse(input));
}

const WEEK = { kind: 'periodic', grain: 'week', alignment: 'calendar' } as const;

describe('weekStart', () => {
  const monCal: CalendarInput = {
    name: 'utc-ops',
    timezone: 'UTC',
    workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workingHours: { start: '09:00', end: '18:00' },
  };

  it('defaults to Monday on the calendar schema', () => {
    expect(calendarSchema.parse(monCal).weekStart).toBe('mon');
  });

  it("calendar weekStart 'sun' shifts the week window and switches to date keys", () => {
    // Wed 2026-08-12: Monday weeks run [08-10, 08-17); Sunday weeks [08-09, 08-16).
    const mon = resolveWindow(WEEK, '2026-08-12T05:00:00Z', calendar(monCal));
    expect(mon).toMatchObject({ startIso: '2026-08-10T00:00:00.000Z', endIso: '2026-08-17T00:00:00.000Z', key: 'week:2026-W33' });
    const sun = resolveWindow(WEEK, '2026-08-12T05:00:00Z', calendar({ ...monCal, weekStart: 'sun' }));
    expect(sun).toMatchObject({
      startIso: '2026-08-09T00:00:00.000Z',
      endIso: '2026-08-16T00:00:00.000Z',
      // ISO week numbers are Monday-based by definition — non-Monday weeks
      // key by their start date instead of borrowing a lying ISO label.
      key: 'week:2026-08-09',
    });
    // A Sunday instant STARTS the Sunday week but ENDS UP in the previous Monday week.
    const sunOnSunday = resolveWindow(WEEK, '2026-08-16T12:00:00Z', calendar({ ...monCal, weekStart: 'sun' }));
    expect(sunOnSunday.startIso).toBe('2026-08-16T00:00:00.000Z');
    const monOnSunday = resolveWindow(WEEK, '2026-08-16T12:00:00Z', calendar(monCal));
    expect(monOnSunday.startIso).toBe('2026-08-10T00:00:00.000Z');
  });

  it('EngineDefaults.weekStart drives calendar-less week windows', () => {
    const viaDefaults = resolveWindow(WEEK, '2026-08-12T05:00:00Z', undefined, resolveDefaults({ weekStart: 'sun' }));
    expect(viaDefaults.startIso).toBe('2026-08-09T00:00:00.000Z');
    expect(viaDefaults.key).toBe('week:2026-08-09');
    // Untouched defaults keep the documented Monday behavior.
    const stock = resolveWindow(WEEK, '2026-08-12T05:00:00Z');
    expect(stock.startIso).toBe('2026-08-10T00:00:00.000Z');
    expect(stock.key).toBe('week:2026-W33');
  });
});

describe('defaultTimezone', () => {
  it('moves calendar-less periodic boundaries off UTC', () => {
    // 2026-08-12T20:00Z is already 08-13 01:30 in IST — same expectation as
    // the calendar-based fixture in window.test.ts, now via EngineDefaults.
    const ist = resolveWindow(
      { kind: 'periodic', grain: 'day', alignment: 'calendar' },
      '2026-08-12T20:00:00Z',
      undefined,
      resolveDefaults({ defaultTimezone: 'Asia/Kolkata' }),
    );
    expect(ist).toMatchObject({
      startIso: '2026-08-12T18:30:00.000Z',
      endIso: '2026-08-13T18:30:00.000Z',
      key: 'day:2026-08-13',
    });
  });
});

describe('dstAmbiguity', () => {
  /** 01:00-05:00 wall, all seven days — straddles the America/New_York fall-back. */
  const NY: CalendarInput = {
    name: 'ny-ops',
    timezone: 'America/New_York',
    workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    workingHours: { start: '01:00', end: '05:00' },
  };

  it("'later' shifts the fall-back day's count by the repeated hour (300 → 240)", () => {
    // 2026-11-01: wall 01:00 is ambiguous. 'earlier' = 01:00 EDT = 05:00Z
    // (window [05:00Z, 10:00Z) = 300 min, the M2 default behavior);
    // 'later' = 01:00 EST = 06:00Z (window [06:00Z, 10:00Z) = 240 min).
    const earlier = calendar(NY);
    const later = calendar({ ...NY, dstAmbiguity: 'later' });
    expect(earlier.businessMinutesBetween('2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toBe(300);
    expect(later.businessMinutesBetween('2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toBe(240);
    // The first occurrence of wall 01:00 counts only under 'earlier'.
    expect(earlier.businessMinutesBetween('2026-11-01T05:00:00Z', '2026-11-01T06:00:00Z')).toBe(60);
    expect(later.businessMinutesBetween('2026-11-01T05:00:00Z', '2026-11-01T06:00:00Z')).toBe(0);
  });

  it('unambiguous days are identical under either policy', () => {
    const earlier = calendar(NY);
    const later = calendar({ ...NY, dstAmbiguity: 'later' });
    expect(earlier.businessMinutesBetween('2026-11-02T06:00:00Z', '2026-11-02T10:00:00Z')).toBe(240);
    expect(later.businessMinutesBetween('2026-11-02T06:00:00Z', '2026-11-02T10:00:00Z')).toBe(240);
  });
});

describe('maxBusinessSpanDays', () => {
  const INDIA: CalendarInput = {
    name: 'india-ops',
    timezone: 'Asia/Kolkata',
    workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workingHours: { start: '09:00', end: '18:00' },
  };

  it('a lowered guard rejects spans the default happily computes', () => {
    const start = '2026-01-01T00:00:00Z';
    const end11d = Date.parse(start) + 11 * 86_400_000;
    const stock = compileCalendar(calendarSchema.parse(INDIA));
    expect(stock.businessMinutesBetween(start, end11d)).toBeGreaterThan(0);
    const tight = compileCalendar(calendarSchema.parse(INDIA), undefined, { maxBusinessSpanDays: 10 });
    expect(tight.maxBusinessSpanDays).toBe(10);
    let thrown: unknown;
    try {
      tight.businessMinutesBetween(start, end11d);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MalkomError);
    expect((thrown as MalkomError).code).toBe('UNSUPPORTED');
    expect(() => tight.businessDaysBetween(start, end11d)).toThrowError(MalkomError);
  });
});

describe('percentileMethod', () => {
  const REGISTRY = new CompiledRegistry(
    registryDocSchema.parse({
      entities: [
        {
          id: 'obs',
          fields: [
            { id: 'v', type: 'number' },
            { id: 'at', type: 'date' },
          ],
        },
      ],
    }),
    1,
  );

  function p90Metric(options?: { percentileMethod: 'nearest_rank' | 'linear' }) {
    const input: MetricDefinitionInput = {
      name: 'p90-latency',
      kind: 'kpi',
      metricType: 'number',
      unit: 'ms',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'event', field: 'at' },
      target: { value: 400, direction: 'lower_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'p90', source: 'obs', field: 'v' } },
      ...(options === undefined ? {} : { options }),
    };
    return compileMetric(metricDefinitionSchema.parse(input), REGISTRY);
  }

  // Pinned fixture, ascending: [60, 90, 120, 120, 230, 240, 420]; n = 7.
  // nearest-rank p90: v[ceil(0.9×7)] = v[7] = 420.
  // linear p90: h = 6×0.9 = 5.4 → 240 + 0.4×(420−240) = 312.
  const FACTS = [60, 90, 120, 120, 230, 240, 420].map((v) => ({ v }));
  const WINDOW = resolveWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, '2026-08-12T05:00:00Z');
  const NOW = '2026-08-12T06:00:00Z';

  it('defaults to nearest-rank and says so in the trace', () => {
    const result = evaluateMetric(p90Metric(), FACTS, { window: WINDOW, nowIso: NOW });
    expect(result.value).toBe(420);
    expect(result.trace.percentileMethod).toBe('nearest_rank');
  });

  it('definition options switch to linear interpolation (pinned: 312 ≠ 420)', () => {
    const result = evaluateMetric(p90Metric({ percentileMethod: 'linear' }), FACTS, { window: WINDOW, nowIso: NOW });
    expect(result.value).toBeCloseTo(312, 10);
    expect(result.trace.percentileMethod).toBe('linear');
  });

  it('EngineDefaults.percentileMethod applies when the definition is silent', () => {
    const result = evaluateMetric(p90Metric(), FACTS, {
      window: WINDOW,
      nowIso: NOW,
      defaults: resolveDefaults({ percentileMethod: 'linear' }),
    });
    expect(result.value).toBeCloseTo(312, 10);
    expect(result.trace.percentileMethod).toBe('linear');
  });

  it('definition options always beat EngineDefaults', () => {
    const result = evaluateMetric(p90Metric({ percentileMethod: 'nearest_rank' }), FACTS, {
      window: WINDOW,
      nowIso: NOW,
      defaults: resolveDefaults({ percentileMethod: 'linear' }),
    });
    expect(result.value).toBe(420);
    expect(result.trace.percentileMethod).toBe('nearest_rank');
  });

  it('linear agrees with nearest-rank at the extremes (p50 median of odd n)', () => {
    // n = 7, p50: nearest rank v[4] = 120; linear h = 3.0 → 120 exactly.
    const def = metricDefinitionSchema.parse({
      name: 'p50-latency',
      kind: 'kpi',
      metricType: 'number',
      unit: 'ms',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'event', field: 'at' },
      target: { value: 400, direction: 'lower_is_better' },
      options: { percentileMethod: 'linear' },
      formula: { kind: 'aggregate', over: { agg: 'p50', source: 'obs', field: 'v' } },
    });
    const result = evaluateMetric(compileMetric(def, REGISTRY), FACTS, { window: WINDOW, nowIso: NOW });
    expect(result.value).toBe(120);
  });
});
