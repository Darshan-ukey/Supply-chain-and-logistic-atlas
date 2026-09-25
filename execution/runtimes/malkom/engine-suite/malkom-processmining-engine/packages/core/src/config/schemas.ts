import { z } from 'zod';
import { identifierSchema, registryIdSchema, scalarSchema } from '../domain/identifiers.js';
import { columnRefSchema, relationInputSchema, type Relation } from './relation.js';

/**
 * The configuration language. Nothing in the mining core knows a host column
 * name; a host declares where its data lives and what each column MEANS, and
 * every downstream stage reads roles rather than columns.
 *
 * Every type below is a z.infer output — schema is the single source of truth.
 */

// ---------------------------------------------------------------------------
// Grain — what a source row represents, and therefore what it can support
// ---------------------------------------------------------------------------

/**
 * Process mining needs to know WHEN each transition happened. A column holding
 * a current value gives the value but not the history, and no amount of
 * configurability recovers transitions the host never persisted. So each
 * binding declares its grain, and the engine reasons about what is answerable
 * instead of discovering it at render time.
 *
 * - `event`    one row per occurrence, append-only. One timestamp, one event.
 *              Full control-flow discovery.
 * - `interval` one row per unit of work with a start and an end. Unpivots into
 *              two events, and separates handling time from waiting time.
 * - `snapshot` one row per entity, updated in place. No history. Contributes
 *              case attributes only — never steps.
 */
export const grainSchema = z.enum(['event', 'interval', 'snapshot']);
export type Grain = z.infer<typeof grainSchema>;

/** Does this grain contribute steps to the trace, or only attributes? */
export function grainYieldsSteps(grain: Grain): boolean {
  return grain === 'event' || grain === 'interval';
}

/** How many events one row of this grain unpivots into. */
export function eventsPerRow(grain: Grain): number {
  switch (grain) {
    case 'event':
      return 1;
    case 'interval':
      return 2;
    case 'snapshot':
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Activity classifier
// ---------------------------------------------------------------------------

/**
 * What counts as "the activity". A single column gives a coarse map; several
 * composed give a fine one. Both are valid lenses on the same log, so this is
 * chosen per analysis rather than baked into the schema.
 *
 * `columns` are joined with `separator`, NULL-tolerantly (concat_ws), so a row
 * with a null sub-queue still yields an activity name rather than vanishing.
 */
/**
 * One part of an activity name.
 *
 * A plain column, or a field inside a JSON column. The second form exists
 * because real audit tables routinely record WHAT changed in a typed column
 * and WHAT IT BECAME inside a JSON payload — so the type alone collapses every
 * transition into a single box and draws a process with one step. Reaching one
 * level into the JSON is the difference between a usable map and a useless one,
 * and it is the host's data shape, not something the engine should ask them to
 * denormalise around.
 *
 * The key is an identifier, not free text: it is interpolated into SQL rather
 * than bound, and an identifier cannot carry a quote to break out with.
 */
export const classifierPartSchema = z.union([
  columnRefSchema,
  z.object({ column: columnRefSchema, jsonKey: identifierSchema }),
]);

export type ClassifierPart = z.infer<typeof classifierPartSchema>;

export const activityClassifierSchema = z.object({
  columns: z.array(classifierPartSchema).min(1).max(4),
  separator: z.string().min(1).max(8).default(' · '),
});
export type ActivityClassifier = z.infer<typeof activityClassifierSchema>;

/** Accept a bare column name as shorthand for a one-column classifier. */
export const activityClassifierInputSchema = z.union([
  columnRefSchema.transform((column): ActivityClassifier => ({ columns: [column], separator: ' · ' })),
  z
    .array(columnRefSchema)
    .min(1)
    .max(4)
    .transform((columns): ActivityClassifier => ({ columns, separator: ' · ' })),
  activityClassifierSchema,
]);

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/**
 * A timestamp column plus how to read it.
 *
 * `tz` is only for legacy naive columns that store local time with no offset.
 * A column that is already timestamptz needs nothing here; setting `tz` on one
 * that is would shift every event and silently reorder the log.
 */
export const timestampRefSchema = z.object({
  column: columnRefSchema,
  /** IANA zone for naive local-time columns. Omit for UTC/timestamptz columns. */
  tz: z.string().min(1).max(64).optional(),
});
export type TimestampRef = z.infer<typeof timestampRefSchema>;

// The transform is annotated so both arms of the union produce the SAME type.
// Without it the inferred union is `{column} | {column, tz?}` and every reader
// has to narrow before touching `tz`.
export const timestampRefInputSchema = z.union([
  columnRefSchema.transform((column): TimestampRef => ({ column })),
  timestampRefSchema,
]);

// ---------------------------------------------------------------------------
// Roles — the host's columns mapped onto process mining meaning
// ---------------------------------------------------------------------------

/**
 * The role map. This is the engine's central abstraction: no column name is
 * assumed anywhere in the core, so a host maps `queueId` to `case` while
 * another maps `pnr` or `document_id`, and nothing downstream changes.
 *
 * Which roles are REQUIRED depends on grain, and that rule lives in
 * validateBinding rather than here — zod cannot express "start and end are
 * mandatory iff grain is interval" without making the type union unusable.
 */
export const rolesSchema = z.object({
  /**
   * The value that repeats across every row belonging to one business item.
   * Optional only when the binding declares `objects` instead — see below.
   */
  case: columnRefSchema.optional(),
  /** What happened. Required for step-yielding grains. */
  activity: activityClassifierInputSchema.optional(),
  /** Who did it. Optional; its absence disables the organizational perspective. */
  resource: columnRefSchema.optional(),
  /** When it happened. Required for `event` grain. */
  timestamp: timestampRefInputSchema.optional(),
  /** Start of the work. Required for `interval` grain. */
  start: timestampRefInputSchema.optional(),
  /** End of the work. Required for `interval` grain. */
  end: timestampRefInputSchema.optional(),
  /**
   * Handling time in seconds, when the host already records it. Lets the
   * engine separate time spent BEING WORKED from time spent waiting, rather
   * than inferring handling from the interval and conflating the two.
   */
  duration: columnRefSchema.optional(),
  /**
   * What this step cost, in whatever unit the host works in.
   *
   * Optional, and absent from most logs. Where it exists it changes what the
   * engine can say: a bottleneck measured only in time argues for itself, a
   * bottleneck measured in money argues for a budget. The engine never derives
   * cost from duration — a rate card is a business decision, not a mining one,
   * and inventing one would put a fabricated number next to measured ones.
   */
  cost: columnRefSchema.optional(),
  /** A lifecycle transition column (start/complete/suspend), XES-style. */
  lifecycle: columnRefSchema.optional(),
});
export type Roles = z.infer<typeof rolesSchema>;

// ---------------------------------------------------------------------------
// Object links — the seam that keeps the case key a per-analysis choice
// ---------------------------------------------------------------------------

/**
 * An object this source's rows relate to.
 *
 * Recording relationships rather than stamping one permanent `caseId` is what
 * lets the same stream be mined at booking level, item level or invoice level.
 * OCEL 2.0 is deliberately NOT adopted as an internal model: the extractor
 * projects these links down to a flat case-centric log, and every downstream
 * algorithm sees ordinary rows.
 *
 * The payoff is concrete. Five line items each amended once, flattened onto
 * one booking timeline, render as Amend → Amend → Amend → Amend → Amend and
 * the map draws a rework loop that never happened. Re-projecting the same
 * events at item level makes it disappear, because it was an artefact of the
 * projection rather than a fact about the process.
 */
export const objectLinkSchema = z.object({
  /** Object type name — 'booking', 'item', 'invoice'. The case key names one of these. */
  type: registryIdSchema,
  /** Column holding this object's identifier on this source's rows. */
  column: columnRefSchema,
  /** Optional role this object plays in the event, e.g. 'subject' vs 'context'. */
  qualifier: registryIdSchema.optional(),
});
export type ObjectLink = z.infer<typeof objectLinkSchema>;

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

/**
 * A column carried through to the mined log for the data perspective.
 *
 * `scope` decides where it lands: `event` attributes vary per step, `case`
 * attributes describe the whole case. Snapshot sources contribute case
 * attributes almost by definition.
 */
export const attributeSchema = z.object({
  column: columnRefSchema,
  /** Name in the mined log. Defaults to the column name. */
  as: identifierSchema.optional(),
  scope: z.enum(['event', 'case']).default('event'),
});
export type Attribute = z.infer<typeof attributeSchema>;

export const attributeInputSchema = z.union([
  columnRefSchema.transform((column): Attribute => ({ column, scope: 'event' })),
  attributeSchema,
]);

// ---------------------------------------------------------------------------
// Filters — pushed into SQL, never applied in memory
// ---------------------------------------------------------------------------

/**
 * The extraction filter AST. Deliberately narrow, and deliberately without a
 * raw-SQL escape hatch: bindings arrive from admin UIs and API callers, and
 * every operator here compiles to a parameterised predicate.
 */
export type FilterExpr =
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; column: string; value: string | number | boolean | null }
  | { op: 'in' | 'notIn'; column: string; values: (string | number | boolean | null)[] }
  | { op: 'isNull' | 'isNotNull'; column: string }
  | { op: 'and' | 'or'; args: FilterExpr[] }
  | { op: 'not'; arg: FilterExpr };

export const filterExprSchema: z.ZodType<FilterExpr> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      column: columnRefSchema,
      value: scalarSchema,
    }),
    z.object({
      op: z.enum(['in', 'notIn']),
      column: columnRefSchema,
      values: z.array(scalarSchema).min(1).max(1000),
    }),
    z.object({ op: z.enum(['isNull', 'isNotNull']), column: columnRefSchema }),
    z.object({ op: z.enum(['and', 'or']), args: z.array(filterExprSchema).min(1).max(32) }),
    z.object({ op: z.literal('not'), arg: filterExprSchema }),
  ]),
);

/** Every column a filter expression references — used for bind-time verification. */
export function filterColumns(expr: FilterExpr, into: Set<string> = new Set()): Set<string> {
  switch (expr.op) {
    case 'and':
    case 'or':
      for (const a of expr.args) filterColumns(a, into);
      break;
    case 'not':
      filterColumns(expr.arg, into);
      break;
    default:
      into.add(expr.column);
  }
  return into;
}

// ---------------------------------------------------------------------------
// Source binding
// ---------------------------------------------------------------------------

/** One host table, its grain, and what its columns mean. */
export const sourceBindingSchema = z.object({
  id: registryIdSchema,
  connectionRef: registryIdSchema,
  /**
   * Where the rows come from: one table, or several joined. Accepts a bare
   * table reference as shorthand, so a single-table binding is written exactly
   * as it was before joins existed.
   */
  from: relationInputSchema,
  grain: grainSchema,
  roles: rolesSchema,
  /** Objects these rows relate to. At least one is needed to correlate a case. */
  objects: z.array(objectLinkSchema).max(16).default([]),
  attributes: z.array(attributeInputSchema).max(64).default([]),
  /** Static predicate always applied to this source, e.g. excluding test rows. */
  where: filterExprSchema.optional(),
});
export type SourceBinding = z.infer<typeof sourceBindingSchema>;

// ---------------------------------------------------------------------------
// Stream definition
// ---------------------------------------------------------------------------

/** A half-open time window [from, to). Half-open so adjacent windows tile without overlap. */
export const timeWindowSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((w) => w.from.getTime() < w.to.getTime(), {
    message: 'from must be strictly before to',
  });
export type TimeWindow = z.infer<typeof timeWindowSchema>;

/**
 * Filters applied at extraction time, pushed into the host's SQL.
 *
 * These are what the coverage record is compared against: a request whose
 * window sits inside what a stream already holds is served from the stream
 * file without touching the host database at all.
 */
export const streamFiltersSchema = z.object({
  window: timeWindowSchema.optional(),
  /** Per-binding extra predicates, keyed by binding id. */
  where: z.record(registryIdSchema, filterExprSchema).default({}),
  /** Hard cap on cases materialised. 0 = unbounded. A cap is always logged, never silent. */
  caseLimit: z.number().int().min(0).default(0),
});
export type StreamFilters = z.infer<typeof streamFiltersSchema>;

/**
 * A stream that came from a file rather than from SQL.
 *
 * An imported log is a snapshot: there is no host behind it to re-query, so it
 * has no bindings and can never grow one. Everything downstream is unaffected
 * — the events land in the same three tables and every miner reads them the
 * same way — but the stream has to be able to SAY where it came from, because
 * "refresh this" and "widen this" are not offers that can be honoured for it.
 */
export const streamFileOriginSchema = z.object({
  /** The name it was uploaded under. Display only; never used as a path. */
  filename: z.string().min(1).max(400),
  format: z.enum(['csv', 'xes']),
  importedAt: z.coerce.date(),
  events: z.number().int().min(0).default(0),
  cases: z.number().int().min(0).default(0),
  activities: z.number().int().min(0).default(0),
  /** What was off about the file, kept so it can be shown long after import. */
  warnings: z.array(z.string()).default([]),
});
export type StreamFileOrigin = z.infer<typeof streamFileOriginSchema>;

export const streamDefinitionSchema = z
  .object({
    id: registryIdSchema,
    name: z.string().min(1).max(200).optional(),
    // No minimum here, enforced below instead: a stream needs either bindings
    // to extract from or a file it was imported from, and stating that as one
    // rule gives one error message rather than a confusing count complaint.
    bindings: z.array(sourceBindingSchema).max(32).default([]),
    /** Set when this stream was imported from a log rather than extracted. */
    file: streamFileOriginSchema.optional(),
    /**
     * Object type the case key resolves to by default — 'booking', 'item'.
     * Overridable per analysis; that is the whole point of the object links.
     */
    defaultCaseObject: registryIdSchema.optional(),
    filters: streamFiltersSchema.default({ where: {}, caseLimit: 0 }),
  })
  .superRefine((stream, ctx) => {
    if (stream.file === undefined && stream.bindings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bindings'],
        message:
          'a stream needs at least one binding to extract from, or a file it was imported from',
      });
    }
    if (stream.file !== undefined && stream.bindings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bindings'],
        message: 'an imported stream has no host to extract from, so it cannot carry bindings',
      });
    }
  });
export type StreamDefinition = z.infer<typeof streamDefinitionSchema>;

/**
 * A stream definition as it is WRITTEN, before defaults and coercion.
 *
 * The parsed type is not the same shape as the literal a caller composes:
 * `filters` has a default so it may be left out, and `importedAt` is coerced,
 * so a caller may hand over the ISO string it already has rather than build a
 * Date for the schema to turn straight back into a string.
 *
 * Exported because a host that has to `as never` its way past that mismatch
 * has silenced the type checker on the very object this schema exists to
 * check — and would then be told about a mistake by a validation error in
 * somebody's browser rather than by a compiler.
 */
export type StreamDefinitionInput = z.input<typeof streamDefinitionSchema>;

// ---------------------------------------------------------------------------
// Coverage — what a materialised stream ACTUALLY contains
// ---------------------------------------------------------------------------

/**
 * The record that makes reuse possible. A stream's DEFINITION says what it
 * selects; its COVERAGE says which slice has actually been pulled and written.
 * Comparing an incoming request against coverage is what turns exploratory use
 * into cache hits instead of repeated full extractions.
 */
export const coverageRecordSchema = z.object({
  streamId: registryIdSchema,
  /** Materialised windows, normalised to a disjoint ascending set. */
  windows: z.array(timeWindowSchema).default([]),
  /** Filters in force when this coverage was built; a change invalidates reuse. */
  filterFingerprint: z.string().min(1),
  eventCount: z.number().int().min(0).default(0),
  caseCount: z.number().int().min(0).default(0),
  bytesOnDisk: z.number().int().min(0).default(0),
  lastRefreshedAt: z.coerce.date().optional(),
  /** Max source timestamp seen at last refresh — the basis for drift reporting. */
  sourceWatermark: z.coerce.date().optional(),
});
export type CoverageRecord = z.infer<typeof coverageRecordSchema>;
