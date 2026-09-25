import { z } from 'zod';
import { filterExprSchema, identifierSchema, scalarSchema } from '../domain/filter.js';

/**
 * Configuration schemas — the single source of truth. The TypeScript types are
 * z.infer outputs; JSON Schema for non-TS clients is generated from these same
 * definitions (see jsonschema.ts). There is no hand-written type that can drift.
 */

export const tableRefSchema = z.object({
  schema: identifierSchema.optional(),
  name: identifierSchema,
});
export type TableRef = z.infer<typeof tableRefSchema>;

export const orderingTermSchema = z.object({
  column: identifierSchema,
  dir: z.enum(['asc', 'desc']).default('asc'),
  nulls: z.enum(['first', 'last']).optional(),
});
export type OrderingTerm = z.infer<typeof orderingTermSchema>;

export const assignedAtSchema = z.object({
  column: identifierSchema,
  /**
   * IANA timezone for legacy NAIVE datetime columns only. UTC/timestamptz
   * columns should omit this. Validation warns when it is set — naive columns
   * are ambiguous during the DST fold.
   */
  timezone: z.string().min(1).optional(),
  /** db-now uses the database's transaction-consistent clock — the default. */
  mode: z.enum(['db-now', 'engine-now']).default('db-now'),
});

export const workSourceBindingSchema = z.object({
  connectionRef: z.string().min(1),
  table: tableRefSchema,
  fields: z.object({
    /** Primary key column. */
    id: identifierSchema,
    /** Column the engine writes the worker id into. */
    assignee: identifierSchema,
    /** Column read for allocatability / task state. */
    state: identifierSchema,
    /** Sub-queue discriminator within a shared table. */
    subQueue: z.object({ column: identifierSchema, value: scalarSchema }).optional(),
    assignedAt: assignedAtSchema.optional(),
    createdAt: identifierSchema.optional(),
    priority: identifierSchema.optional(),
    /** Extra columns surfaced to strategies/matching as WorkItem.attrs. */
    attributes: z.array(identifierSchema).max(32).default([]),
  }),
  /** What "allocatable" means, e.g. state IN ('NEW','REOPENED'). */
  allocatableWhen: filterExprSchema,
  /**
   * What "unassigned" means. Omitted → assignee IS NULL. A scalar → assignee
   * equals that sentinel value (e.g. '' or 'UNASSIGNED') for schemas that
   * cannot store NULL.
   */
  unassignedValue: scalarSchema.optional(),
  /** Deterministic candidate order — FIFO's source of truth. Mandatory. */
  ordering: z.array(orderingTermSchema).min(1).max(8),
  /** Extra column writes applied atomically with the claim, e.g. state → 'ASSIGNED'. */
  onAssign: z.object({ set: z.record(identifierSchema, scalarSchema) }).optional(),
  /** Column writes applied when an item is released back to the pool. */
  onRelease: z.object({ set: z.record(identifierSchema, scalarSchema) }).optional(),
  batchLimit: z.number().int().min(1).max(1000).default(100),
  /** Overscan guards against head-of-line blocking by unassignable items. */
  overscanFactor: z.number().int().min(1).max(5).default(2),
});
export type WorkSourceBinding = z.infer<typeof workSourceBindingSchema>;

export const workerSourceBindingSchema = z.object({
  connectionRef: z.string().min(1),
  table: tableRefSchema,
  fields: z.object({
    /** The value written into the work table's assignee column. */
    id: identifierSchema,
    displayName: identifierSchema.optional(),
    /** Hard eligibility: active, present, not on leave... */
    eligibleWhen: filterExprSchema.optional(),
    capacity: z
      .object({
        column: identifierSchema.optional(),
        default: z.number().int().min(0).optional(),
      })
      .optional(),
    /** Skill/attribute columns for matching rules and strategies. */
    attributes: z.array(identifierSchema).max(32).default([]),
  }),
  /**
   * How current load is measured. count-open-items derives it from the work
   * table (rows where assignee = worker, plus optional countWhere) — the
   * zero-config default that stays correct when humans reassign work manually.
   */
  load: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('count-open-items'), countWhere: filterExprSchema.optional() }),
      z.object({ kind: z.literal('column'), column: identifierSchema }),
    ])
    .default({ kind: 'count-open-items' }),
});
export type WorkerSourceBinding = z.infer<typeof workerSourceBindingSchema>;

export const adapterRefSchema = z.object({ adapterRef: z.string().min(1) });
export type AdapterRef = z.infer<typeof adapterRefSchema>;

export const strategySpecSchema = z.object({
  kind: z.string().min(1).max(64),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type StrategySpec = z.infer<typeof strategySpecSchema>;

export const scheduleSchema = z.object({
  trigger: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('cron'),
      /** Standard 5-field (or 6-field with seconds) cron expression. */
      expr: z.string().min(1).max(100),
      /** IANA timezone the expression evaluates in. Default: host timezone. */
      tz: z.string().min(1).optional(),
    }),
    z.object({
      kind: z.literal('interval'),
      everyMs: z.number().int().min(1000).max(86_400_000),
    }),
  ]),
  /** Random pre-run delay to de-synchronize lock contention across instances. */
  jitterMs: z.number().int().min(0).max(60_000).default(0),
});
export type Schedule = z.infer<typeof scheduleSchema>;

export const matchingRuleSchema = z.object({
  /** WorkItem attribute (a fields.attributes column) or 'id'. */
  itemField: z.string().min(1),
  /** Worker attribute (a fields.attributes column) or 'id'. */
  workerAttr: z.string().min(1),
  /**
   * eq: strict equality. contains: worker attribute is an array containing the
   * item value, or a string containing it as a substring.
   */
  op: z.enum(['eq', 'contains']),
});
export type MatchingRule = z.infer<typeof matchingRuleSchema>;

export const QUEUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const queueDefinitionSchema = z.object({
  id: z.string().regex(QUEUE_ID_RE, 'queue id: letters/digits, then letters/digits/_/-, max 64'),
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  /** Managed by the engine: bumped on every upsert. Accepted on input for CAS. */
  version: z.number().int().min(0).optional(),
  tenantId: z.string().max(128).optional(),
  work: z.union([workSourceBindingSchema, adapterRefSchema]),
  workers: z.union([workerSourceBindingSchema, adapterRefSchema]),
  strategy: strategySpecSchema,
  schedule: scheduleSchema,
  /** Hard per-pair eligibility, evaluated by the engine BEFORE any strategy runs. */
  matching: z.array(matchingRuleSchema).max(16).default([]),
  /** Reclaim assigned-but-untouched items after this long (requires assignedAt binding). */
  staleAfter: z.object({ minutes: z.number().int().min(1).max(60 * 24 * 30) }).optional(),
});
export type QueueDefinition = z.infer<typeof queueDefinitionSchema>;
export type QueueDefinitionInput = z.input<typeof queueDefinitionSchema>;

export const connectionProfileSchema = z.object({
  id: z.string().min(1).max(64),
  /** Adapter plugin key: 'sqlite' | 'postgres' | 'mysql' | custom. */
  dialect: z.string().min(1).max(32),
  /** Env var holding the DSN / filename, resolved at use time. Never a raw secret. */
  env: z.string().min(1).optional(),
  /** Pointer into a secret store; resolution is pluggable. Never a raw secret. */
  secretRef: z.object({ provider: z.string().min(1), path: z.string().min(1) }).optional(),
  /** Non-secret dialect options (e.g. { filename } for sqlite, pool sizing). */
  config: z.record(z.string(), z.unknown()).default({}),
});
export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;

export const configBundleSchema = z.object({
  connections: z.array(connectionProfileSchema).default([]),
  queues: z.array(queueDefinitionSchema).default([]),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;

export function isAdapterRef(x: WorkSourceBinding | WorkerSourceBinding | AdapterRef): x is AdapterRef {
  return 'adapterRef' in x;
}
