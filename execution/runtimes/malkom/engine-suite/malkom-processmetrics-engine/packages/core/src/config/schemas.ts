import { z } from 'zod';
import {
  filterExprSchema,
  identifierSchema,
  scalarSchema,
  valueSetRefSchema,
  type FilterExpr,
  type Scalar,
} from '../domain/filter.js';
import { tableRefSchema } from './connection.js';
import {
  DST_AMBIGUITY_DEFAULT,
  dstAmbiguitySchema,
  percentileMethodSchema,
  timezoneSchema,
  UNIT_DEFAULTS,
  WEEKDAYS,
} from './defaults.js';

/**
 * Zod schemas are the single source of truth for every configuration shape.
 * TS types are z.infer outputs — there is no hand-written type that can drift.
 * JSON Schema export (config/jsonschema.ts) serves the same schemas to
 * non-TS hosts and metric-builder UIs.
 */

export const ENTITY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const entityIdSchema = z
  .string()
  .regex(ENTITY_ID_RE, 'must be 1-64 chars: letters, digits, _ or - (leading alphanumeric)');

// ---------------------------------------------------------------------------
// Entity registry — the engine's knowledge of the host
// ---------------------------------------------------------------------------

/**
 * A field of a registered entity. Metric definitions reference fields by
 * stable `id`; `column` maps to the physical DB column and defaults to the
 * id, so a DB rename is a one-line registry edit, not a definition migration.
 */
export const registryFieldSchema = z.object({
  id: identifierSchema,
  type: z.enum(['string', 'number', 'boolean', 'date']),
  column: identifierSchema.optional(),
  /** Reference to a shared value-set constraining/describing legal values. */
  valueSet: valueSetRefSchema.optional(),
  /** Inline enum of legal values, for small closed sets. */
  values: z.array(scalarSchema).min(1).max(256).optional(),
  /** Human label for UIs; never used for resolution. */
  label: z.string().min(1).max(200).optional(),
});
export type RegistryField = z.infer<typeof registryFieldSchema>;

/** A registered entity — a queue whose rows metrics are computed over. */
export const registryEntitySchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1).max(200).optional(),
  /** Physical table; required for tier-2 validation and computation reads. */
  table: tableRefSchema.optional(),
  /** Connection profile id for tier-2/computation reads; optional in library mode. */
  connectionRef: z.string().min(1).max(128).optional(),
  /**
   * The field whose values discriminate sub-queues (e.g. booking.status).
   * Sub-queue targeting is just a filter term on this field.
   */
  subQueueField: identifierSchema.optional(),
  fields: z.array(registryFieldSchema).min(1).max(128),
});
export type RegistryEntity = z.infer<typeof registryEntitySchema>;

/** A named, reusable list of values (regions, currency codes, port codes …). */
export const valueSetSchema = z.object({
  id: valueSetRefSchema,
  name: z.string().min(1).max(200).optional(),
  values: z.array(scalarSchema).min(1).max(4096),
});
export type ValueSet = z.infer<typeof valueSetSchema>;

/** The registry document a host applies. Versioning is engine-managed. */
export const registryDocSchema = z.object({
  entities: z.array(registryEntitySchema).default([]),
  valueSets: z.array(valueSetSchema).default([]),
  /** Engine-managed; accepted on input for compare-and-swap updates. */
  version: z.number().int().positive().optional(),
});
export type RegistryDoc = z.infer<typeof registryDocSchema>;
export type RegistryDocInput = z.input<typeof registryDocSchema>;

// ---------------------------------------------------------------------------
// Shared authoring primitives
// ---------------------------------------------------------------------------

/**
 * Slugs name the things authors create (metrics, calendars, exclusions).
 * Same grammar as entity ids — the family's one naming rule for host-visible
 * handles.
 */
export const slugSchema = z
  .string()
  .regex(ENTITY_ID_RE, 'must be 1-64 chars: letters, digits, _ or - (leading alphanumeric)');

/**
 * ISO-8601 instant with an EXPLICIT timezone — "Z" or a ±HH:MM offset. A
 * zone-less datetime would be interpreted in the host's local zone, so the
 * same request could name different windows on different hosts; every
 * API-boundary instant (facade + router) validates through this schema.
 * Windows are half-open [from, to).
 */
export const instantSchema = z.iso.datetime({
  offset: true,
  error: 'must be an ISO-8601 instant with an explicit timezone ("Z" or ±HH:MM offset)',
});

/** "HH:MM" 24-hour wall-clock time. */
export const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const hhmmSchema = z.string().regex(HHMM_RE, 'must be "HH:MM" (24-hour)');

/** "YYYY-MM-DD" that is also a real calendar date (no 2026-02-30). */
export const calendarDateSchema = z.iso.date().refine(
  (s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
  },
  { message: 'must be a real calendar date' },
);

// ---------------------------------------------------------------------------
// Metric / KPI definitions — the authorable document
// ---------------------------------------------------------------------------

export const metricKindSchema = z.enum(['sla', 'kpi']);
export type MetricKind = z.infer<typeof metricKindSchema>;

export const metricTypeSchema = z.enum(['count', 'percent', 'ratio', 'duration', 'currency', 'number']);
export type MetricType = z.infer<typeof metricTypeSchema>;

export const aggFnSchema = z.enum(['count', 'countDistinct', 'sum', 'avg', 'min', 'max', 'p50', 'p90', 'p95', 'p99']);
export type AggFn = z.infer<typeof aggFnSchema>;

/**
 * One aggregation over a registered entity's rows. `field` is a registry
 * field id or a derived field name; only bare `count` may omit it.
 */
export const aggSpecSchema = z
  .strictObject({
    agg: aggFnSchema,
    source: entityIdSchema,
    field: identifierSchema.optional(),
    where: filterExprSchema.optional(),
  })
  .refine((s) => s.agg === 'count' || s.field !== undefined, {
    message: 'field is required for every aggregation except "count"',
    path: ['field'],
  });
export type AggSpec = z.infer<typeof aggSpecSchema>;

export const formulaSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('aggregate'), over: aggSpecSchema }),
  z.strictObject({ kind: z.literal('ratio'), numerator: aggSpecSchema, denominator: aggSpecSchema }),
]);
export type MetricFormula = z.infer<typeof formulaSchema>;

/**
 * How facts attach to a resolved window:
 *  - 'event': a fact belongs to a window iff its anchor timestamp (a
 *    date-typed field present on EVERY formula source) falls in [start, end);
 *  - 'snapshot': facts are fetched as-of-now regardless of the window — for
 *    point-in-time metrics like Backlog Aging, where the window merely labels
 *    the point.
 */
export const metricAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('event'), field: identifierSchema }),
  z.strictObject({ kind: z.literal('snapshot') }),
]);
export type MetricAnchor = z.infer<typeof metricAnchorSchema>;

/** Per-definition evaluation options; anything unset falls back to EngineDefaults. */
export const metricOptionsSchema = z.strictObject({
  percentileMethod: percentileMethodSchema.optional(),
});
export type MetricOptions = z.infer<typeof metricOptionsSchema>;

/** calendar = wall-clock boundaries; business = the referenced ops calendar's. */
export const windowAlignmentSchema = z.enum(['calendar', 'business']);
export type WindowAlignment = z.infer<typeof windowAlignmentSchema>;

export const windowSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('periodic'),
    grain: z.enum(['day', 'week', 'month', 'quarter']),
    alignment: windowAlignmentSchema.default('calendar'),
  }),
  z.strictObject({
    kind: z.literal('rolling'),
    length: z.number().int().positive(),
    unit: z.enum(['day', 'hour']),
    alignment: windowAlignmentSchema.default('calendar'),
  }),
]);
export type MetricWindow = z.infer<typeof windowSchema>;

export const thresholdsSchema = z.strictObject({
  warn: z.number().optional(),
  breach: z.number().optional(),
});
export type Thresholds = z.infer<typeof thresholdsSchema>;

export const targetSchema = z.strictObject({
  value: z.number(),
  direction: z.enum(['higher_is_better', 'lower_is_better']),
  thresholds: thresholdsSchema.optional(),
});
export type MetricTarget = z.infer<typeof targetSchema>;

/**
 * Business-time derived fields: computed per row from date/datetime entity
 * fields through the referenced calendar. Arity is part of the grammar —
 * between-functions take exactly two args, age takes one.
 */
export const deriveSpecSchema = z.discriminatedUnion('fn', [
  z.strictObject({
    fn: z.enum(['businessMinutesBetween', 'businessDaysBetween']),
    args: z.array(identifierSchema).length(2, 'between-functions take exactly 2 args'),
  }),
  z.strictObject({
    fn: z.literal('ageBusinessMinutes'),
    args: z.array(identifierSchema).length(1, 'ageBusinessMinutes takes exactly 1 arg'),
  }),
]);
export type DeriveSpec = z.infer<typeof deriveSpecSchema>;

/** Rows matching `when` are excluded from every aggregate while in window. */
export const exclusionSchema = z.strictObject({
  id: slugSchema,
  reason: z.string().min(1).max(500),
  when: filterExprSchema,
  effectiveFrom: instantSchema.optional(),
  effectiveTo: instantSchema.optional(),
});
export type MetricExclusion = z.infer<typeof exclusionSchema>;

const metricDefinitionBaseSchema = z.strictObject({
  name: slugSchema,
  description: z.string().min(1).max(2000).optional(),
  kind: metricKindSchema,
  metricType: metricTypeSchema,
  /** Defaults by metricType; currency/number require an explicit unit. */
  unit: z.string().min(1).max(64).optional(),
  /** Registry field ids the metric is broken down by; [] = entity-wide. */
  scope: z.strictObject({ dimensions: z.array(identifierSchema).max(16) }),
  window: windowSchema,
  /** How facts attach to the window (event timestamp vs point-in-time snapshot). */
  anchor: metricAnchorSchema,
  target: targetSchema,
  /** Per-definition evaluation options; unset entries fall back to EngineDefaults. */
  options: metricOptionsSchema.optional(),
  /** Required when window alignment is 'business' or `derive` is used. */
  calendarRef: slugSchema.optional(),
  /** derivedFieldName → business-time function over entity date fields. */
  derive: z.record(slugSchema, deriveSpecSchema).optional(),
  formula: formulaSchema,
  exclusions: z
    .array(exclusionSchema)
    .max(64)
    .superRefine((arr, ctx) => {
      const seen = new Set<string>();
      arr.forEach((e, i) => {
        if (seen.has(e.id)) {
          ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate exclusion id "${e.id}"` });
        }
        seen.add(e.id);
      });
    })
    .optional(),
  effectiveFrom: instantSchema.optional(),
  effectiveTo: instantSchema.optional(),
});

/**
 * The authorable definition of a metric. Lifecycle state lives on the
 * definition head (engine-managed), never inside the document. Parsing
 * applies the per-metricType unit default; currency/number without an
 * explicit unit fail parse.
 */
export const metricDefinitionSchema = metricDefinitionBaseSchema.transform((def, ctx) => {
  const unit = def.unit ?? UNIT_DEFAULTS[def.metricType];
  if (unit === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['unit'],
      message: `metricType "${def.metricType}" requires an explicit unit`,
    });
    return z.NEVER;
  }
  return { ...def, unit };
});
export type MetricDefinition = z.infer<typeof metricDefinitionSchema>;
export type MetricDefinitionInput = z.input<typeof metricDefinitionSchema>;

// ---------------------------------------------------------------------------
// Calendars — business-time context for windows and derived fields
// ---------------------------------------------------------------------------

export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

// The IANA-timezone validator lives in config/defaults.ts (a leaf module both
// the defaults and these schemas share); re-exported here as API surface.
export { timezoneSchema };

export const calendarSchema = z.strictObject({
  name: slugSchema,
  timezone: timezoneSchema,
  workweek: z
    .array(weekdaySchema)
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, { message: 'workweek days must be unique' }),
  /** The day weeks start on, for week windows resolved through this calendar. */
  weekStart: weekdaySchema.default('mon'),
  /** How ambiguous wall times (fall-back replays them) resolve to instants. */
  dstAmbiguity: dstAmbiguitySchema.default(DST_AMBIGUITY_DEFAULT),
  workingHours: z
    .strictObject({ start: hhmmSchema, end: hhmmSchema })
    .refine((h) => h.start < h.end, { message: 'start must be before end', path: ['end'] }),
  holidays: z
    .array(z.strictObject({ date: calendarDateSchema, label: z.string().min(1).max(200) }))
    .max(1024)
    .superRefine((arr, ctx) => {
      const seen = new Set<string>();
      arr.forEach((h, i) => {
        if (seen.has(h.date)) {
          ctx.addIssue({ code: 'custom', path: [i, 'date'], message: `duplicate holiday date "${h.date}"` });
        }
        seen.add(h.date);
      });
    })
    .default([]),
});
export type Calendar = z.infer<typeof calendarSchema>;
export type CalendarInput = z.input<typeof calendarSchema>;

// ---------------------------------------------------------------------------
// Assignments — a metric bound to a concrete scope slice
// ---------------------------------------------------------------------------

/** Scope bindings are concrete scalars — never null, never expressions. */
export const assignmentScopeValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type AssignmentScopeValue = z.infer<typeof assignmentScopeValueSchema>;

export const targetOverrideSchema = z.strictObject({
  value: z.number().optional(),
  thresholds: thresholdsSchema.optional(),
});
export type TargetOverride = z.infer<typeof targetOverrideSchema>;

export const assignmentSchema = z.strictObject({
  metric: slugSchema,
  /** fieldId → value; keys must equal the metric's scope.dimensions exactly. */
  scope: z.record(identifierSchema, assignmentScopeValueSchema),
  targetOverride: targetOverrideSchema.optional(),
  active: z.boolean().default(true),
});
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignmentInput = z.input<typeof assignmentSchema>;

export type { FilterExpr, Scalar };
