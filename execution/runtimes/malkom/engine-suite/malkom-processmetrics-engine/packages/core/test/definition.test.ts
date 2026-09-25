/**
 * Metric-definition authoring: schema parse (defaults, rejections) and tier-1
 * cross-reference validation with exact issue paths and codes, plus
 * assignment validation against its definition.
 */
import { describe, expect, it } from 'vitest';
import {
  assignmentSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type Assignment,
  type MetricDefinition,
  type MetricDefinitionInput,
} from '../src/config/schemas.js';
import { validateAssignment, validateMetricDefinition } from '../src/config/validate.js';
import { CompiledRegistry } from '../src/domain/registry.js';

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
      {
        id: 'shipmentTask',
        fields: [
          { id: 'bookingId', type: 'string' },
          { id: 'completedAt', type: 'date' },
        ],
      },
    ],
    valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
  }),
  1,
);

const CALENDARS = [{ name: 'india-ops' }];

/** The Booking-TAT SLA from the architecture: ratio over derived business time. */
const BOOKING_TAT: MetricDefinitionInput = {
  name: 'booking-tat-sla',
  description: 'Share of bookings confirmed within 240 business minutes',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'week' },
  // The completion event: a booking belongs to the week it was confirmed in.
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

function parse(input: MetricDefinitionInput): MetricDefinition {
  const res = metricDefinitionSchema.safeParse(input);
  expect(res.success, JSON.stringify(res.error?.issues ?? [])).toBe(true);
  return res.data!;
}

function tatWith(patch: Partial<MetricDefinitionInput>): MetricDefinition {
  return parse({ ...structuredClone(BOOKING_TAT), ...patch });
}

describe('metric definition schema', () => {
  it('parses the Booking-TAT SLA and applies defaults (unit, window alignment)', () => {
    const def = parse(BOOKING_TAT);
    expect(def.unit).toBe('percent'); // metricType default
    expect(def.window).toEqual({ kind: 'periodic', grain: 'week', alignment: 'calendar' });
    expect(def.exclusions?.[0]?.id).toBe('bronze-migration');
    // ... and the parsed document is tier-1 clean.
    expect(validateMetricDefinition(def, REGISTRY, CALENDARS)).toEqual([]);
  });

  it('applies unit defaults per metricType (duration → minutes, count → count)', () => {
    const duration = tatWith({
      metricType: 'duration',
      formula: { kind: 'aggregate', over: { agg: 'avg', source: 'booking', field: 'tatMinutes' } },
    });
    expect(duration.unit).toBe('minutes');
    const count = parse({
      name: 'confirmed-bookings',
      kind: 'kpi',
      metricType: 'count',
      scope: { dimensions: [] },
      window: { kind: 'rolling', length: 7, unit: 'day' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 100, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
    });
    expect(count.unit).toBe('count');
    expect(count.window).toEqual({ kind: 'rolling', length: 7, unit: 'day', alignment: 'calendar' });
  });

  it('rejects currency without an explicit unit, accepts it with one', () => {
    const base: MetricDefinitionInput = {
      name: 'booked-revenue',
      kind: 'kpi',
      metricType: 'currency',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'month' },
      anchor: { kind: 'event', field: 'createdAt' },
      target: { value: 1_000_000, direction: 'higher_is_better' },
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking', field: 'teu' } },
    };
    const rejected = metricDefinitionSchema.safeParse(base);
    expect(rejected.success).toBe(false);
    expect(rejected.error?.issues.some((i) => i.path.join('.') === 'unit')).toBe(true);
    expect(parse({ ...base, unit: 'USD' }).unit).toBe('USD');
  });

  it('rejects a non-count aggregation without a field', () => {
    const res = metricDefinitionSchema.safeParse(
      tatInput({ metricType: 'number', unit: 'teu', formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking' } } }),
    );
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.path.join('.') === 'formula.over.field')).toBe(true);
  });

  it('rejects an unknown aggregation function', () => {
    const res = metricDefinitionSchema.safeParse(
      tatInput({
        metricType: 'number',
        unit: 'teu',
        formula: { kind: 'aggregate', over: { agg: 'median' as never, source: 'booking', field: 'teu' } },
      }),
    );
    expect(res.success).toBe(false);
  });

  it('rejects malformed window combinations', () => {
    // periodic must not carry rolling keys (strict objects)
    expect(
      metricDefinitionSchema.safeParse(tatInput({ window: { kind: 'periodic', grain: 'week', length: 7 } as never }))
        .success,
    ).toBe(false);
    // rolling requires length + unit
    expect(metricDefinitionSchema.safeParse(tatInput({ window: { kind: 'rolling', unit: 'day' } as never })).success).toBe(false);
    // rolling length must be a positive integer
    expect(
      metricDefinitionSchema.safeParse(tatInput({ window: { kind: 'rolling', length: 0, unit: 'day' } as never }))
        .success,
    ).toBe(false);
    // unknown window kind
    expect(metricDefinitionSchema.safeParse(tatInput({ window: { kind: 'sliding' } as never })).success).toBe(false);
  });

  it('rejects duplicate exclusion ids with a precise path', () => {
    const input = structuredClone(BOOKING_TAT);
    input.exclusions = [
      { id: 'dup', reason: 'a', when: { op: 'isNull', field: 'confirmedAt' } },
      { id: 'dup', reason: 'b', when: { op: 'isNotNull', field: 'confirmedAt' } },
    ];
    const res = metricDefinitionSchema.safeParse(input);
    expect(res.success).toBe(false);
    expect(res.error?.issues.some((i) => i.path.join('.') === 'exclusions.1.id')).toBe(true);
  });

  it('rejects unknown top-level keys (strict document)', () => {
    const res = metricDefinitionSchema.safeParse({ ...structuredClone(BOOKING_TAT), extra: true } as never);
    expect(res.success).toBe(false);
  });

  it('requires an anchor (event needs a field, snapshot rejects one)', () => {
    const input = structuredClone(BOOKING_TAT);
    delete (input as Record<string, unknown>)['anchor'];
    expect(metricDefinitionSchema.safeParse(input).success).toBe(false);
    // event without a field
    expect(metricDefinitionSchema.safeParse(tatInput({ anchor: { kind: 'event' } as never })).success).toBe(false);
    // snapshot with a field (strict object)
    expect(
      metricDefinitionSchema.safeParse(tatInput({ anchor: { kind: 'snapshot', field: 'createdAt' } as never })).success,
    ).toBe(false);
    // snapshot parses clean
    expect(parse(tatInput({ anchor: { kind: 'snapshot' } })).anchor).toEqual({ kind: 'snapshot' });
  });

  it('accepts per-definition options and rejects unknown option keys', () => {
    const def = parse(tatInput({ options: { percentileMethod: 'linear' } }));
    expect(def.options?.percentileMethod).toBe('linear');
    expect(metricDefinitionSchema.safeParse(tatInput({ options: { unknownKnob: 1 } as never })).success).toBe(false);
  });
});

/** Patch the Booking-TAT input without parsing (for schema-rejection cases). */
function tatInput(patch: Partial<MetricDefinitionInput>): MetricDefinitionInput {
  return { ...structuredClone(BOOKING_TAT), ...patch };
}

function issuesOf(def: MetricDefinition): Array<{ path: string; code?: string }> {
  return validateMetricDefinition(def, REGISTRY, CALENDARS).map(({ path, code }) => ({ path, code }));
}

describe('tier-1 definition validation', () => {
  it('flags an unknown formula source with its exact path', () => {
    const def = tatWith({
      metricType: 'number',
      unit: 'teu',
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'ghost', field: 'teu' } },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'formula.over.source', code: 'unknown_source' });
  });

  it('flags an unknown field inside numerator.where at the exact term', () => {
    const input = structuredClone(BOOKING_TAT);
    (input.formula as unknown as { numerator: { where: { args: Array<{ field: string }> } } }).numerator.where.args[1]!.field =
      'ghostField';
    delete input.derive; // keep the derived name out of resolution
    delete input.calendarRef;
    expect(issuesOf(parse(input))).toContainEqual({
      path: 'formula.numerator.where.args[1].field',
      code: 'unknown_field',
    });
  });

  it('flags a value outside the field value-set (eq membership)', () => {
    const def = tatWith({
      formula: {
        kind: 'ratio',
        numerator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'region', value: 'MARS' } },
        denominator: { agg: 'count', source: 'booking' },
      },
    });
    expect(issuesOf(def)).toContainEqual({
      path: 'formula.numerator.where.value',
      code: 'value_not_allowed',
    });
  });

  it('flags a derived name colliding with an entity field', () => {
    const def = tatWith({
      derive: {
        tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] },
        teu: { fn: 'ageBusinessMinutes', args: ['createdAt'] },
      },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'derive.teu', code: 'derived_name_collision' });
  });

  it('flags a derive arg that is not a date field', () => {
    const def = tatWith({
      derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['status', 'confirmedAt'] } },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'derive.tatMinutes.args[0]', code: 'derive_arg_not_date' });
  });

  it('rejects derived fields as derive args (entity date fields only)', () => {
    const def = tatWith({
      derive: {
        tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] },
        tatAge: { fn: 'ageBusinessMinutes', args: ['tatMinutes'] },
      },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'derive.tatAge.args[0]', code: 'unknown_field' });
  });

  it('requires scope dimensions on EVERY formula source (denominator too)', () => {
    const input = structuredClone(BOOKING_TAT);
    (input.formula as unknown as { denominator: { agg: string; source: string } }).denominator = {
      agg: 'count',
      source: 'shipmentTask',
    };
    const issues = issuesOf(parse(input));
    expect(issues).toContainEqual({ path: 'scope.dimensions[0]', code: 'unknown_field' });
  });

  it('rejects derived fields as scope dimensions', () => {
    const def = tatWith({ scope: { dimensions: ['tatMinutes'] } });
    expect(issuesOf(def)).toContainEqual({ path: 'scope.dimensions[0]', code: 'unknown_field' });
  });

  it('flags an event anchor field that is not declared on the source', () => {
    const def = tatWith({ anchor: { kind: 'event', field: 'ghostStamp' } });
    expect(issuesOf(def)).toContainEqual({ path: 'anchor.field', code: 'unknown_field' });
  });

  it('flags an event anchor field that is not date-typed', () => {
    const def = tatWith({ anchor: { kind: 'event', field: 'status' } });
    expect(issuesOf(def)).toContainEqual({ path: 'anchor.field', code: 'anchor_not_date' });
  });

  it('rejects derived fields as event anchors (registry date fields only)', () => {
    const def = tatWith({ anchor: { kind: 'event', field: 'tatMinutes' } });
    expect(issuesOf(def)).toContainEqual({ path: 'anchor.field', code: 'unknown_field' });
  });

  it('requires the event anchor on EVERY formula source (denominator too)', () => {
    const input = structuredClone(BOOKING_TAT);
    // confirmedAt exists on booking but not on shipmentTask.
    (input.formula as unknown as { denominator: { agg: string; source: string } }).denominator = {
      agg: 'count',
      source: 'shipmentTask',
    };
    expect(issuesOf(parse(input))).toContainEqual({ path: 'anchor.field', code: 'unknown_field' });
  });

  it('snapshot anchors reference no field and need none', () => {
    const def = tatWith({ anchor: { kind: 'snapshot' } });
    expect(issuesOf(def)).toEqual([]);
  });

  it('flags percent metricType with an aggregate formula', () => {
    const def = tatWith({
      formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'formula.kind', code: 'formula_kind_mismatch' });
  });

  it('flags a non-ratio metricType with a ratio formula', () => {
    const def = tatWith({ metricType: 'duration' });
    expect(issuesOf(def)).toContainEqual({ path: 'formula.kind', code: 'formula_kind_mismatch' });
  });

  it('flags threshold ordering violations when higher is better', () => {
    const def = tatWith({
      target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 96, breach: 97 } },
    });
    const issues = issuesOf(def);
    expect(issues).toContainEqual({ path: 'target.thresholds.warn', code: 'threshold_order' });
    expect(issues).toContainEqual({ path: 'target.thresholds.breach', code: 'threshold_order' });
  });

  it('flags threshold ordering violations when lower is better', () => {
    const def = tatWith({
      metricType: 'duration',
      formula: { kind: 'aggregate', over: { agg: 'p90', source: 'booking', field: 'tatMinutes' } },
      target: { value: 240, direction: 'lower_is_better', thresholds: { warn: 200, breach: 180 } },
    });
    const issues = issuesOf(def);
    expect(issues).toContainEqual({ path: 'target.thresholds.warn', code: 'threshold_order' });
    expect(issues).toContainEqual({ path: 'target.thresholds.breach', code: 'threshold_order' });
  });

  it('requires a calendarRef for business-aligned windows', () => {
    const input = structuredClone(BOOKING_TAT);
    input.window = { kind: 'periodic', grain: 'week', alignment: 'business' };
    delete input.derive;
    delete input.calendarRef;
    // drop the derived-field reference from the numerator condition
    (input.formula as { numerator: { where: unknown } }).numerator.where = {
      op: 'eq',
      field: 'status',
      value: 'confirmed',
    };
    expect(issuesOf(parse(input))).toContainEqual({ path: 'calendarRef', code: 'calendar_required' });
  });

  it('requires a calendarRef when derive is present', () => {
    const input = structuredClone(BOOKING_TAT);
    delete input.calendarRef;
    expect(issuesOf(parse(input))).toContainEqual({ path: 'calendarRef', code: 'calendar_required' });
  });

  it('flags a calendarRef that does not resolve', () => {
    const def = tatWith({ calendarRef: 'nowhere-ops' });
    expect(issuesOf(def)).toContainEqual({ path: 'calendarRef', code: 'unknown_calendar' });
  });

  it('flags business-aligned rolling HOUR windows (window_unsupported)', () => {
    const def = tatWith({ window: { kind: 'rolling', length: 4, unit: 'hour', alignment: 'business' } });
    expect(issuesOf(def)).toContainEqual({ path: 'window.alignment', code: 'window_unsupported' });
    // Day-granular business rolling windows stay legal.
    const dayDef = tatWith({ window: { kind: 'rolling', length: 7, unit: 'day', alignment: 'business' } });
    expect(issuesOf(dayDef)).toEqual([]);
  });

  it('flags inverted effective windows on the definition and its exclusions', () => {
    const def = tatWith({
      effectiveFrom: '2026-09-01T00:00:00Z',
      effectiveTo: '2026-08-01T00:00:00Z',
      exclusions: [
        {
          id: 'bad-window',
          reason: 'window test',
          when: { op: 'eq', field: 'customerTier', value: 'bronze' },
          effectiveFrom: '2026-08-15T00:00:00Z',
          effectiveTo: '2026-08-15T00:00:00Z',
        },
      ],
    });
    const issues = issuesOf(def);
    expect(issues).toContainEqual({ path: 'effectiveTo', code: 'bad_effective_window' });
    expect(issues).toContainEqual({ path: 'exclusions[0].effectiveTo', code: 'bad_effective_window' });
  });

  it('flags aggregating a non-numeric field (sum over a string)', () => {
    const def = tatWith({
      metricType: 'number',
      unit: 'teu',
      formula: { kind: 'aggregate', over: { agg: 'sum', source: 'booking', field: 'status' } },
    });
    expect(issuesOf(def)).toContainEqual({ path: 'formula.over.field', code: 'type_mismatch' });
  });

  it('accepts min/max over dates and derived fields as numeric agg inputs', () => {
    const def = tatWith({
      metricType: 'duration',
      formula: { kind: 'aggregate', over: { agg: 'p95', source: 'booking', field: 'tatMinutes' } },
    });
    expect(issuesOf(def)).toEqual([]);
    const minDate = tatWith({
      metricType: 'number',
      unit: 'instant',
      derive: undefined as never,
      calendarRef: undefined as never,
      formula: { kind: 'aggregate', over: { agg: 'min', source: 'booking', field: 'confirmedAt' } },
    });
    expect(issuesOf(minDate)).toEqual([]);
  });

  it('accepts "matches" over string fields; flags it over non-string fields (bad_pattern)', () => {
    const clean = tatWith({
      exclusions: [
        {
          id: 'test-accounts',
          reason: 'synthetic test bookings are out of scope',
          when: { op: 'matches', field: 'customerTier', pattern: '^(gold|silver)$' },
        },
      ],
    });
    expect(issuesOf(clean)).toEqual([]);

    const numeric = tatWith({
      exclusions: [
        { id: 'x', reason: 'regex over a number', when: { op: 'matches', field: 'teu', pattern: '^40$' } },
      ],
    });
    expect(issuesOf(numeric)).toContainEqual({ path: 'exclusions[0].when.field', code: 'bad_pattern' });

    const derived = tatWith({
      formula: {
        kind: 'ratio',
        numerator: {
          agg: 'count',
          source: 'booking',
          where: { op: 'matches', field: 'tatMinutes', pattern: '^\\d+$' },
        },
        denominator: { agg: 'count', source: 'booking' },
      },
    });
    expect(issuesOf(derived)).toContainEqual({ path: 'formula.numerator.where.field', code: 'bad_pattern' });
  });

  it('flags a non-compiling pattern smuggled past the schema (bad_pattern)', () => {
    // Assembled programmatically — the zod refine never ran on this branch.
    const def = parse(BOOKING_TAT);
    def.exclusions = [
      { id: 'smuggled', reason: 'bypassed parse', when: { op: 'matches', field: 'status', pattern: '(' } },
    ];
    expect(issuesOf(def)).toContainEqual({ path: 'exclusions[0].when.pattern', code: 'bad_pattern' });
  });
});

describe('assignment validation', () => {
  const definition = parse(BOOKING_TAT);

  function assignment(input: Record<string, unknown>): Assignment {
    const res = assignmentSchema.safeParse({ metric: 'booking-tat-sla', ...input });
    expect(res.success, JSON.stringify(res.error?.issues ?? [])).toBe(true);
    return res.data!;
  }

  it('accepts a well-formed assignment and defaults active to true', () => {
    const a = assignment({ scope: { region: 'APAC' } });
    expect(a.active).toBe(true);
    expect(validateAssignment(a, definition, REGISTRY)).toEqual([]);
  });

  it('demands scope keys equal to the definition dimensions — missing and extra', () => {
    const a = assignment({ scope: { customerTier: 'gold' } });
    const issues = validateAssignment(a, definition, REGISTRY).map(({ path, code }) => ({ path, code }));
    expect(issues).toContainEqual({ path: 'scope.region', code: 'scope_key_missing' });
    expect(issues).toContainEqual({ path: 'scope.customerTier', code: 'scope_key_unexpected' });
  });

  it('checks scope values against the source field value-set and type', () => {
    const bad = assignment({ scope: { region: 'MARS' } });
    expect(validateAssignment(bad, definition, REGISTRY).map(({ path, code }) => ({ path, code }))).toContainEqual({
      path: 'scope.region',
      code: 'value_not_allowed',
    });
    const wrongType = assignment({ scope: { region: 7 } });
    expect(
      validateAssignment(wrongType, definition, REGISTRY).map(({ path, code }) => ({ path, code })),
    ).toContainEqual({ path: 'scope.region', code: 'type_mismatch' });
  });

  it('holds targetOverride thresholds to the effective target value', () => {
    // Override value 90 (higher is better): warn 92 is above it.
    const overridden = assignment({
      scope: { region: 'EMEA' },
      targetOverride: { value: 90, thresholds: { warn: 92 } },
    });
    expect(
      validateAssignment(overridden, definition, REGISTRY).map(({ path, code }) => ({ path, code })),
    ).toContainEqual({ path: 'targetOverride.thresholds.warn', code: 'threshold_order' });
    // No override value: the definition's 95 applies, so warn 94 is fine.
    const inherited = assignment({ scope: { region: 'EMEA' }, targetOverride: { thresholds: { warn: 94 } } });
    expect(validateAssignment(inherited, definition, REGISTRY)).toEqual([]);
  });
});
