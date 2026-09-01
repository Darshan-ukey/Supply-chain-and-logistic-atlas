/**
 * The pure calculation core end-to-end: the Booking-TAT SLA fixture from the
 * M1 tests evaluated over crafted workEvents rows with pinned numerator /
 * denominator / value / status / trace, plus aggregation semantics
 * (nearest-rank percentiles, empty inputs, countDistinct, junk values),
 * exclusion effective-dating, the status matrix, and target merging.
 */
import { describe, expect, it } from 'vitest';
import {
  assignmentSchema,
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type MetricDefinitionInput,
  type MetricTarget,
} from '../src/config/schemas.js';
import { ConfigInvalidError } from '../src/domain/errors.js';
import { CompiledRegistry } from '../src/domain/registry.js';
import type { MetricStatus, ResolvedWindow } from '../src/domain/types.js';
import { compileCalendar } from '../src/runtime/calendar.js';
import { compileMetric, effectiveTarget } from '../src/runtime/compile.js';
import { evaluateMetric, statusForValue } from '../src/runtime/evaluate.js';
import { resolveWindow } from '../src/runtime/window.js';

const REGISTRY = new CompiledRegistry(
  registryDocSchema.parse({
    entities: [
      {
        id: 'booking',
        fields: [
          { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped', 'cancelled'] },
          { id: 'region', type: 'string', valueSet: 'regions' },
          { id: 'teu', type: 'number' },
          { id: 'createdAt', type: 'date' },
          { id: 'confirmedAt', type: 'date' },
          { id: 'customerTier', type: 'string', values: ['gold', 'silver', 'bronze'] },
        ],
      },
    ],
    valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
  }),
  1,
);

/** Mon-Fri 09:00-18:00 IST; Friday 2026-08-14 is a holiday. Store version 3. */
const CALENDAR = compileCalendar(
  calendarSchema.parse({
    name: 'india-ops',
    timezone: 'Asia/Kolkata',
    workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workingHours: { start: '09:00', end: '18:00' },
    holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
  }),
  3,
);

/** The Booking-TAT SLA from the M1 authoring tests, verbatim. */
const BOOKING_TAT: MetricDefinitionInput = {
  name: 'booking-tat-sla',
  description: 'Share of bookings confirmed within 240 business minutes',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'week' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
  calendarRef: 'india-ops',
  derive: {
    tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] },
  },
  formula: {
    kind: 'ratio',
    numerator: {
      agg: 'count',
      source: 'booking',
      where: {
        op: 'and',
        args: [
          { op: 'eq', field: 'status', value: 'confirmed' },
          { op: 'lte', field: 'tatMinutes', value: 240 },
        ],
      },
    },
    denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
  },
  exclusions: [
    {
      id: 'bronze-migration',
      reason: 'bronze accounts migrating to the new workflow are out of SLA scope',
      when: { op: 'eq', field: 'customerTier', value: 'bronze' },
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    },
  ],
  effectiveFrom: '2026-08-01T00:00:00Z',
};

function compiled(input: MetricDefinitionInput) {
  return compileMetric(metricDefinitionSchema.parse(input), REGISTRY, CALENDAR);
}

function tatVariant(patch: Partial<MetricDefinitionInput>) {
  return compiled({ ...structuredClone(BOOKING_TAT), ...patch });
}

// A type alias (not an interface) so it satisfies Record<string, unknown>.
type Row = {
  id: string;
  region: string;
  status: string;
  createdAt: string | null;
  confirmedAt: string | null;
  customerTier: string;
};

function row(id: string, region: string, status: string, createdAt: string | null, confirmedAt: string | null, customerTier: string): Row {
  return { id, region, status, createdAt, confirmedAt, customerTier };
}

/**
 * Crafted workEvents. tatMinutes hand-computed against india-ops
 * (IST = UTC+05:30; Mon-Fri 09:00-18:00; 2026-08-14 holiday):
 *   b1  Mon 10:00 -> Mon 12:00                    = 120  in SLA
 *   b2  Mon 10:00 -> Mon 17:00                    = 420  over
 *   b3  Tue 17:00 -> Wed 10:00        (60 + 60)   = 120  in SLA
 *   b4  Thu 17:30 -> Mon 09:30        (30 + 30;
 *       Fri holiday + weekend skipped)            =  60  in SLA
 *   b5  Mon 09:00 -> Mon 18:00 (bronze)           = 540  EXCLUDED
 *   b6  status new                                       not confirmed
 *   b7  status cancelled                                 not confirmed
 *   b8  EMEA, Mon 10:00 -> Mon 11:40              = 100  out of APAC scope
 *   b9  EMEA, Mon 10:00 -> Mon 15:00              = 300  out of APAC scope
 *   b10 confirmedAt missing -> derived null              denominator only
 *   b11 Wed 09:00 -> Wed 13:00                    = 240  in SLA (lte)
 *   b12 Wed 09:00 -> Wed 12:50                    = 230  in SLA
 *   b13 Wed 10:00 -> Wed 11:30                    =  90  in SLA
 */
const WORK_EVENTS: Row[] = [
  row('b1', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'),
  row('b2', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T11:30:00Z', 'gold'),
  row('b3', 'APAC', 'confirmed', '2026-08-11T11:30:00Z', '2026-08-12T04:30:00Z', 'silver'),
  row('b4', 'APAC', 'confirmed', '2026-08-13T12:00:00Z', '2026-08-17T04:00:00Z', 'gold'),
  row('b5', 'APAC', 'confirmed', '2026-08-10T03:30:00Z', '2026-08-10T12:30:00Z', 'bronze'),
  row('b6', 'APAC', 'new', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b7', 'APAC', 'cancelled', '2026-08-12T04:30:00Z', null, 'silver'),
  row('b8', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:10:00Z', 'gold'),
  row('b9', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T09:30:00Z', 'gold'),
  row('b10', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b11', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:30:00Z', 'gold'),
  row('b12', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:20:00Z', 'silver'),
  row('b13', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', '2026-08-12T06:00:00Z', 'gold'),
];

/** The ISO week containing Wed 2026-08-12, in IST: [Mon 08-10, Mon 08-17). */
const WEEK = resolveWindow({ kind: 'periodic', grain: 'week', alignment: 'calendar' }, '2026-08-12T05:00:00Z', CALENDAR);
const NOW = '2026-08-16T12:00:00Z';

describe('Booking-TAT SLA end-to-end', () => {
  const TAT = compiled(BOOKING_TAT);

  it('pins numerator/denominator/value/status and the full trace for APAC', () => {
    const result = evaluateMetric(TAT, WORK_EVENTS, {
      window: WEEK,
      scope: { region: 'APAC' },
      nowIso: NOW,
      target: effectiveTarget(TAT.definition),
    });
    // Denominator: APAC confirmed minus excluded bronze = b1..b4, b10..b13 = 8.
    // Numerator: tatMinutes <= 240 = b1, b3, b4, b11, b12, b13 = 6. 6/8 = 75%.
    expect(result.numerator).toBe(6);
    expect(result.denominator).toBe(8);
    expect(result.value).toBe(75);
    expect(result.status).toBe('breach'); // 75 < breach threshold 88
    expect(result.metric).toBe('booking-tat-sla');
    expect(result.kind).toBe('sla');
    expect(result.metricType).toBe('percent');
    expect(result.unit).toBe('percent');
    expect(result.window).toEqual(WEEK);
    expect(result.target).toEqual({ value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } });
    expect(result.trace).toEqual({
      factsIn: 13,
      scopeFiltered: 11, // the two EMEA rows fall out
      excluded: { 'bronze-migration': 1 }, // b5
      anchor: { kind: 'event', field: 'confirmedAt' },
      derivedFields: ['tatMinutes'],
      aggregates: [
        { role: 'numerator', agg: 'count', field: null, rowsIn: 6, values: 6 },
        { role: 'denominator', agg: 'count', field: null, rowsIn: 8, values: 8 },
      ],
      skippedValues: 0,
      calendar: { name: 'india-ops', version: 3 },
      evaluatedAt: NOW,
    });
  });

  it('metricType ratio reports the raw quotient (no percent scaling)', () => {
    const ratio = tatVariant({ metricType: 'ratio' });
    const result = evaluateMetric(ratio, WORK_EVENTS, { window: WEEK, scope: { region: 'APAC' }, nowIso: NOW });
    expect(result.value).toBe(0.75);
    expect(result.unit).toBe('ratio');
  });

  it('evaluates unsliced when no scope is given (EMEA rows join in)', () => {
    const result = evaluateMetric(TAT, WORK_EVENTS, { window: WEEK, nowIso: NOW, target: effectiveTarget(TAT.definition) });
    expect(result.trace.scopeFiltered).toBe(13);
    expect(result.numerator).toBe(7); // + b8 (100 min)
    expect(result.denominator).toBe(10); // + b8, b9
    expect(result.value).toBe(70);
  });

  it('zero denominator means no_data with a null value', () => {
    const result = evaluateMetric(TAT, [], { window: WEEK, nowIso: NOW, target: effectiveTarget(TAT.definition) });
    expect(result.value).toBeNull();
    expect(result.numerator).toBe(0);
    expect(result.denominator).toBe(0);
    expect(result.status).toBe('no_data');
  });

  it('reports status "computed" when no target is provided', () => {
    const result = evaluateMetric(TAT, WORK_EVENTS, { window: WEEK, scope: { region: 'APAC' }, nowIso: NOW });
    expect(result.value).toBe(75);
    expect(result.status).toBe('computed');
    expect(result.target).toBeUndefined();
  });
});

describe('exclusion effective-dating (judged at the LAST instant inside the window)', () => {
  const TAT = compiled(BOOKING_TAT);
  const windowEndingAt = (endIso: string): ResolvedWindow => ({
    startIso: '2026-07-01T00:00:00Z',
    endIso,
    key: `week:test-${endIso}`,
    grain: 'week',
    alignment: 'calendar',
  });

  function denomAt(endIso: string) {
    const result = evaluateMetric(TAT, WORK_EVENTS, { window: windowEndingAt(endIso), scope: { region: 'APAC' }, nowIso: NOW });
    return { excluded: result.trace.excluded, denominator: result.denominator, value: result.value };
  }

  it('not yet effective: window ends before effectiveFrom, bronze rows count', () => {
    const r = denomAt('2026-07-31T23:59:59Z');
    expect(r.excluded).toEqual({ 'bronze-migration': 0 });
    expect(r.denominator).toBe(9); // b5 stays
    expect(r.value).toBeCloseTo(200 / 3, 10); // 6/9 — b5's 540 min misses the SLA
  });

  it('active: window ends inside [from, to)', () => {
    const r = denomAt('2026-08-16T18:30:00Z');
    expect(r.excluded).toEqual({ 'bronze-migration': 1 });
    expect(r.denominator).toBe(8);
  });

  it('a window ending exactly at effectiveTo is judged by its last contained instant — still inside', () => {
    // Windows are half-open: a window ending at Sep 1 has Aug 31 23:59:59.999
    // as its last instant, squarely inside the [Aug 1, Sep 1) exclusion.
    // Judging at the end instant itself would hand the point to September.
    const r = denomAt('2026-09-01T00:00:00Z');
    expect(r.excluded).toEqual({ 'bronze-migration': 1 });
    expect(r.denominator).toBe(8);
  });

  it('a month-aligned exclusion applies to its own month only', () => {
    // [Aug 1, Sep 1) dated exclusion vs month windows: July's window (ending
    // Aug 1) must NOT be hit — its last instant is July 31; August's window
    // (ending Sep 1) is; September's is past effectiveTo.
    const monthWindow = (startIso: string, endIso: string): ResolvedWindow => ({
      startIso,
      endIso,
      key: `month:test-${startIso}`,
      grain: 'month',
      alignment: 'calendar',
    });
    const evalIn = (startIso: string, endIso: string) =>
      evaluateMetric(TAT, WORK_EVENTS, { window: monthWindow(startIso, endIso), scope: { region: 'APAC' }, nowIso: NOW })
        .trace.excluded;
    expect(evalIn('2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')).toEqual({ 'bronze-migration': 0 }); // July
    expect(evalIn('2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z')).toEqual({ 'bronze-migration': 1 }); // August
    expect(evalIn('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toEqual({ 'bronze-migration': 0 }); // September
  });
});

describe('exclusions over derived fields (derive runs BEFORE exclusions)', () => {
  it('a numeric threshold on a derived field actually excludes the outlier', () => {
    // Two APAC rows: 120 min and 14400 min. The exclusion drops anything
    // over 10000 derived minutes — with derive computed first, the avg sees
    // only the 120-minute booking.
    const m = tatVariant({
      name: 'avg-tat-with-outlier-exclusion',
      metricType: 'duration',
      target: { value: 240, direction: 'lower_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'avg', source: 'booking', field: 'tatMinutes' } },
      exclusions: [
        {
          id: 'data-migration-outliers',
          reason: 'legacy rows re-imported with original creation instants',
          when: { op: 'gt', field: 'tatMinutes', value: 10000 },
        },
      ],
    });
    const facts = [
      row('m1', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'), // 120 min
      row('m2', 'APAC', 'confirmed', '2026-06-01T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'), // ~14400 min
    ];
    const result = evaluateMetric(m, facts, { window: WEEK, scope: { region: 'APAC' }, nowIso: NOW });
    expect(result.trace.excluded).toEqual({ 'data-migration-outliers': 1 });
    expect(result.value).toBe(120);
  });

  it('isNull on a derived field excludes only rows whose derivation is null', () => {
    const m = tatVariant({
      name: 'tat-null-derived-exclusion',
      metricType: 'count',
      target: { value: 1, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
      exclusions: [
        {
          id: 'unconfirmed',
          reason: 'rows without a confirmation instant have no TAT to judge',
          when: { op: 'isNull', field: 'tatMinutes' },
        },
      ],
    });
    const facts = [
      row('n1', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'), // derives 120
      row('n2', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', null, 'gold'), // derives null → excluded
    ];
    const result = evaluateMetric(m, facts, { window: WEEK, scope: { region: 'APAC' }, nowIso: NOW });
    // Before the derive-first ordering, tatMinutes was missing on EVERY row
    // at exclusion time — isNull matched all of them and the count was 0.
    expect(result.trace.excluded).toEqual({ unconfirmed: 1 });
    expect(result.value).toBe(1);
  });
});

describe('aggregate semantics over derived business time', () => {
  const durVariant = (agg: 'avg' | 'min' | 'max' | 'p50' | 'p90' | 'p95' | 'p99') =>
    tatVariant({
      name: `booking-tat-${agg}`,
      metricType: 'duration',
      target: { value: 240, direction: 'lower_is_better', thresholds: { warn: 300, breach: 360 } },
      formula: {
        kind: 'aggregate',
        over: { agg, source: 'booking', field: 'tatMinutes', where: { op: 'eq', field: 'status', value: 'confirmed' } },
      },
    });

  // APAC confirmed minus bronze = 8 rows; b10's derived tat is null and drops
  // out, leaving values sorted ascending: [60, 90, 120, 120, 230, 240, 420].
  const evalAgg = (agg: 'avg' | 'min' | 'max' | 'p50' | 'p90' | 'p95' | 'p99') => {
    const m = durVariant(agg);
    return evaluateMetric(m, WORK_EVENTS, {
      window: WEEK,
      scope: { region: 'APAC' },
      nowIso: NOW,
      target: effectiveTarget(m.definition),
    });
  };

  it('avg ignores null derived values (8 rows in, 7 values)', () => {
    const result = evalAgg('avg');
    expect(result.value).toBeCloseTo(1280 / 7, 10);
    expect(result.status).toBe('attained'); // ~182.9 <= 240, lower is better
    expect(result.trace.aggregates).toEqual([
      { role: 'over', agg: 'avg', field: 'tatMinutes', rowsIn: 8, values: 7 },
    ]);
    expect(result.unit).toBe('minutes');
  });

  it('min and max', () => {
    expect(evalAgg('min').value).toBe(60);
    const max = evalAgg('max');
    expect(max.value).toBe(420);
    expect(max.status).toBe('breach'); // 420 > breach threshold 360
  });

  it('percentiles use nearest-rank on the sorted values and say so in the trace', () => {
    // n = 7: rank(p) = ceil(p/100 * 7) -> p50: 4th = 120; p90: 7th = 420;
    // p95: 7th = 420; p99: 7th = 420.
    const p50 = evalAgg('p50');
    expect(p50.value).toBe(120);
    expect(p50.status).toBe('attained');
    expect(p50.trace.percentileMethod).toBe('nearest_rank');
    expect(evalAgg('p90').value).toBe(420);
    expect(evalAgg('p95').value).toBe(420);
    expect(evalAgg('p99').value).toBe(420);
    expect(evalAgg('p90').status).toBe('breach');
  });

  it('empty input: avg/min/max/percentiles yield no_data', () => {
    for (const agg of ['avg', 'min', 'max', 'p90'] as const) {
      const m = durVariant(agg);
      const result = evaluateMetric(m, [], { window: WEEK, nowIso: NOW, target: effectiveTarget(m.definition) });
      expect(result.value, agg).toBeNull();
      expect(result.status, agg).toBe('no_data');
    }
  });
});

describe('the other derive functions', () => {
  it('ageBusinessMinutes measures against ctx.nowIso and nothing else', () => {
    const m = compiled({
      name: 'open-booking-age',
      kind: 'kpi',
      metricType: 'duration',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'snapshot' }, // backlog aging: point-in-time, the window only labels the point
      target: { value: 600, direction: 'lower_is_better' },
      calendarRef: 'india-ops',
      derive: { ageMins: { fn: 'ageBusinessMinutes', args: ['createdAt'] } },
      formula: { kind: 'aggregate', over: { agg: 'avg', source: 'booking', field: 'ageMins', where: { op: 'eq', field: 'status', value: 'new' } } },
    });
    // now = Wed 2026-08-12 12:00 IST. Ages: created Mon 10:00 IST ->
    // 480 (Mon) + 540 (Tue) + 180 (Wed 09:00-12:00) = 1200; created Wed
    // 10:00 IST -> 120. avg = 660.
    const facts = [
      { status: 'new', createdAt: '2026-08-10T04:30:00Z' },
      { status: 'new', createdAt: '2026-08-12T04:30:00Z' },
    ];
    const result = evaluateMetric(m, facts, { window: WEEK, nowIso: '2026-08-12T06:30:00Z', target: effectiveTarget(m.definition) });
    expect(result.value).toBe(660);
    expect(result.status).toBe('breach'); // 660 > 600, lower is better, no thresholds
    expect(result.trace.evaluatedAt).toBe('2026-08-12T06:30:00Z');
  });

  it('businessDaysBetween derives working-day counts per row', () => {
    const m = compiled({
      name: 'booking-tat-days',
      kind: 'kpi',
      metricType: 'duration',
      unit: 'days',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'week' },
      anchor: { kind: 'event', field: 'confirmedAt' },
      target: { value: 3, direction: 'lower_is_better' },
      calendarRef: 'india-ops',
      derive: { tatDays: { fn: 'businessDaysBetween', args: ['createdAt', 'confirmedAt'] } },
      formula: { kind: 'aggregate', over: { agg: 'max', source: 'booking', field: 'tatDays' } },
    });
    // Thu 08-13 -> Tue 08-18: counted dates 13(Thu) and 17(Mon) = 2
    // (Fri 08-14 holiday, weekend skipped, end date exclusive).
    const facts = [{ createdAt: '2026-08-13T05:00:00Z', confirmedAt: '2026-08-18T05:00:00Z' }];
    const result = evaluateMetric(m, facts, { window: WEEK, nowIso: NOW, target: effectiveTarget(m.definition) });
    expect(result.value).toBe(2);
    expect(result.status).toBe('attained');
  });
});

describe('aggregate semantics over plain fields', () => {
  it('sum over an empty input is 0 (a real measurement), not no_data', () => {
    const m = compiled({
      name: 'shipped-teu',
      kind: 'kpi',
      metricType: 'number',
      unit: 'teu',
      scope: { dimensions: [] },
      window: { kind: 'rolling', length: 7, unit: 'day' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 100, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking', field: 'teu', where: { op: 'eq', field: 'status', value: 'shipped' } } },
    });
    const result = evaluateMetric(m, WORK_EVENTS, { window: WEEK, nowIso: NOW });
    expect(result.value).toBe(0);
    expect(result.status).toBe('computed');
  });

  it('sum skips non-numeric junk (counted, never thrown) and accepts driver-stringified numbers', () => {
    const m = compiled({
      name: 'booked-teu',
      kind: 'kpi',
      metricType: 'number',
      unit: 'teu',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 10, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking', field: 'teu' } },
    });
    const facts = [{ teu: 3 }, { teu: 'oops' }, { teu: 5 }, { teu: null }, { teu: '4' }];
    const result = evaluateMetric(m, facts, { window: WEEK, nowIso: NOW, target: effectiveTarget(m.definition) });
    expect(result.value).toBe(12); // 3 + 5 + '4'; 'oops' skipped; null ignored
    expect(result.trace.skippedValues).toBe(1);
    expect(result.trace.aggregates).toEqual([{ role: 'over', agg: 'sum', field: 'teu', rowsIn: 5, values: 3 }]);
    expect(result.status).toBe('attained');
  });

  it("sum skips non-finite numeric strings ('Infinity' is junk, not a value)", () => {
    const m = compiled({
      name: 'booked-teu-finite',
      kind: 'kpi',
      metricType: 'number',
      unit: 'teu',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 5, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking', field: 'teu' } },
    });
    const facts = [{ teu: 3 }, { teu: 'Infinity' }, { teu: 5 }];
    const result = evaluateMetric(m, facts, { window: WEEK, nowIso: NOW, target: effectiveTarget(m.definition) });
    expect(result.value).toBe(8); // an Infinity string must not blow up the aggregate
    expect(result.trace.skippedValues).toBe(1);
    expect(result.trace.aggregates).toEqual([{ role: 'over', agg: 'sum', field: 'teu', rowsIn: 3, values: 2 }]);
  });

  it('countDistinct counts distinct non-null values', () => {
    const m = compiled({
      name: 'regions-served',
      kind: 'kpi',
      metricType: 'count',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 3, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'countDistinct', source: 'booking', field: 'region' } },
    });
    const facts = [{ region: 'APAC' }, { region: 'APAC' }, { region: 'EMEA' }, { region: null }, {}];
    const result = evaluateMetric(m, facts, { window: WEEK, nowIso: NOW, target: effectiveTarget(m.definition) });
    expect(result.value).toBe(2);
    expect(result.status).toBe('breach'); // 2 < 3, no thresholds declared
    expect(result.trace.aggregates).toEqual([
      { role: 'over', agg: 'countDistinct', field: 'region', rowsIn: 5, values: 2 },
    ]);
  });
});

describe('scope matching tolerates driver value shapes (rows SQL matched must match in memory)', () => {
  it('a Date-object row value matches an ISO scope string', () => {
    const m = compiled({
      name: 'per-cohort-count',
      kind: 'kpi',
      metricType: 'count',
      scope: { dimensions: ['createdAt'] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'snapshot' },
      target: { value: 1, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
    });
    const facts = [{ createdAt: new Date('2026-08-10T04:30:00Z') }, { createdAt: new Date('2026-08-11T04:30:00Z') }];
    const result = evaluateMetric(m, facts, {
      window: WEEK,
      scope: { createdAt: '2026-08-10T04:30:00Z' },
      nowIso: NOW,
    });
    expect(result.trace.scopeFiltered).toBe(1);
    expect(result.value).toBe(1);
  });

  it('a numeric row value matches a stringified scope number (and vice versa)', () => {
    const m = compiled({
      name: 'per-teu-count',
      kind: 'kpi',
      metricType: 'count',
      scope: { dimensions: ['teu'] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'snapshot' },
      target: { value: 1, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
    });
    const facts = [{ teu: 5 }, { teu: '5' }, { teu: 7 }];
    const result = evaluateMetric(m, facts, { window: WEEK, scope: { teu: '5' }, nowIso: NOW });
    expect(result.trace.scopeFiltered).toBe(2); // 5 and '5' both name the value SQL matched
    expect(result.value).toBe(2);
  });
});

describe('status matrix', () => {
  const hi: MetricTarget = { value: 100, direction: 'higher_is_better', thresholds: { warn: 90, breach: 80 } };
  const hiBare: MetricTarget = { value: 100, direction: 'higher_is_better' };
  const hiWarnOnly: MetricTarget = { value: 100, direction: 'higher_is_better', thresholds: { warn: 90 } };
  const lo: MetricTarget = { value: 100, direction: 'lower_is_better', thresholds: { warn: 110, breach: 120 } };
  const loBare: MetricTarget = { value: 100, direction: 'lower_is_better' };

  const cases: Array<[string, number | null, MetricTarget | undefined, MetricStatus]> = [
    ['higher: at target', 100, hi, 'attained'],
    ['higher: above target', 105, hi, 'attained'],
    ['higher: between breach and target', 85, hi, 'warn'],
    ['higher: exactly at breach line', 80, hi, 'warn'], // breach needs value < breach
    ['higher: past breach', 79, hi, 'breach'],
    ['higher, no thresholds: at target', 100, hiBare, 'attained'],
    ['higher, no thresholds: any miss breaches', 99, hiBare, 'breach'],
    ['higher, warn-only thresholds: miss warns', 50, hiWarnOnly, 'warn'],
    ['lower: at target', 100, lo, 'attained'],
    ['lower: below target', 95, lo, 'attained'],
    ['lower: between target and breach', 115, lo, 'warn'],
    ['lower: exactly at breach line', 120, lo, 'warn'],
    ['lower: past breach', 121, lo, 'breach'],
    ['lower, no thresholds: any miss breaches', 101, loBare, 'breach'],
    ['no value: no_data even with a target', null, hi, 'no_data'],
    ['no target: computed', 42, undefined, 'computed'],
  ];

  it.each(cases)('%s', (_label, value, target, expected) => {
    expect(statusForValue(value, target)).toBe(expected);
  });
});

describe('effectiveTarget override merge', () => {
  const def = metricDefinitionSchema.parse(structuredClone(BOOKING_TAT));

  function assignment(targetOverride: Record<string, unknown> | undefined) {
    return assignmentSchema.parse({
      metric: 'booking-tat-sla',
      scope: { region: 'APAC' },
      ...(targetOverride === undefined ? {} : { targetOverride }),
    });
  }

  it('no assignment / no override: the definition target as-is', () => {
    expect(effectiveTarget(def)).toBe(def.target);
    expect(effectiveTarget(def, assignment(undefined))).toBe(def.target);
  });

  it('value only: thresholds inherited', () => {
    expect(effectiveTarget(def, assignment({ value: 90 }))).toEqual({
      value: 90,
      direction: 'higher_is_better',
      thresholds: { warn: 92, breach: 88 },
    });
  });

  it('thresholds only: value inherited, block replaced wholesale', () => {
    expect(effectiveTarget(def, assignment({ thresholds: { warn: 90, breach: 85 } }))).toEqual({
      value: 95,
      direction: 'higher_is_better',
      thresholds: { warn: 90, breach: 85 },
    });
  });

  it('both: full override, direction always from the definition', () => {
    expect(effectiveTarget(def, assignment({ value: 90, thresholds: { warn: 85, breach: 80 } }))).toEqual({
      value: 90,
      direction: 'higher_is_better',
      thresholds: { warn: 85, breach: 80 },
    });
  });
});

describe('compileMetric refuses unclean definitions', () => {
  it('throws ConfigInvalidError listing tier-1 issues', () => {
    const input = structuredClone(BOOKING_TAT);
    (input.formula as { numerator: { source: string } }).numerator.source = 'ghost';
    let thrown: unknown;
    try {
      compileMetric(metricDefinitionSchema.parse(input), REGISTRY, CALENDAR);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ConfigInvalidError);
    expect((thrown as ConfigInvalidError).details.some((d) => d.includes('formula.numerator.source'))).toBe(true);
  });

  it('throws when a business-time definition is compiled without its calendar', () => {
    expect(() => compileMetric(metricDefinitionSchema.parse(structuredClone(BOOKING_TAT)), REGISTRY)).toThrowError(
      ConfigInvalidError,
    );
  });
});
