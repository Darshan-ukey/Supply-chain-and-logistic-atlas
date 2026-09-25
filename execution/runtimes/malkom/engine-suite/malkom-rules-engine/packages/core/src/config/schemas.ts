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

/**
 * Zod schemas are the single source of truth for every configuration shape.
 * TS types are z.infer outputs — there is no hand-written type that can drift.
 * JSON Schema export (config/jsonschema.ts) serves the same schemas to
 * non-TS hosts and rule-builder UIs.
 */

export const ENTITY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const entityIdSchema = z
  .string()
  .regex(ENTITY_ID_RE, 'must be 1-64 chars: letters, digits, _ or - (leading alphanumeric)');

// ---------------------------------------------------------------------------
// Entity registry — the engine's knowledge of the host (§2.1 of the doc)
// ---------------------------------------------------------------------------

/**
 * A field of a registered entity. Rules reference fields by stable `id`;
 * `column` maps to the physical DB column and defaults to the id, so a DB
 * rename is a one-line registry edit, not a rule migration.
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

/** A registered entity — a queue whose rows rules apply to. */
export const registryEntitySchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1).max(200).optional(),
  /** Physical table; required for tier-2 validation and backtests. */
  table: tableRefSchema.optional(),
  /** Connection profile id for tier-2/backtest reads; optional in library mode. */
  connectionRef: z.string().min(1).max(128).optional(),
  /**
   * The field whose values discriminate sub-queues (e.g. booking.status).
   * Sub-queue targeting is just a scope term on this field.
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
// Scope — the indexable selector that puts a group "in play" (§2.2)
// ---------------------------------------------------------------------------

/**
 * Scope grammar is deliberately restricted to a conjunction of equality /
 * membership terms over registered fields. The restriction is what makes
 * scopes compilable into the inverted selector index; full expressiveness
 * lives in rule conditions (FilterExpr) which run only on the already-
 * narrowed candidate set.
 */
export const scopeTermSchema = z.union([
  z.object({ field: identifierSchema, op: z.literal('eq'), value: scalarSchema }),
  z.object({ field: identifierSchema, op: z.literal('in'), values: z.array(scalarSchema).min(1).max(256) }),
  z.object({ field: identifierSchema, op: z.literal('inSet'), set: valueSetRefSchema }),
]);
export type ScopeTerm = z.infer<typeof scopeTermSchema>;

export const scopeSchema = z.object({
  all: z.array(scopeTermSchema).min(1).max(8),
});
export type Scope = z.infer<typeof scopeSchema>;

// ---------------------------------------------------------------------------
// Actions — typed verbs (§2.3)
// ---------------------------------------------------------------------------

/**
 * Values in effect targets may reference the evaluated row with the
 * "$row.<fieldId>" convention; they resolve at emission time (missing field
 * resolves to null). Everything else is a literal scalar.
 */
export const ROW_REF_RE = /^\$row\.[A-Za-z_][A-Za-z0-9_$]{0,127}$/;

export const effectTargetSchema = z.object({
  entity: entityIdSchema,
  op: z.enum(['insert', 'update', 'upsert']),
  /** Correlation key identifying the target row(s). */
  key: z.record(identifierSchema, scalarSchema),
  /** Values to write. */
  set: z.record(identifierSchema, scalarSchema),
});
export type EffectTarget = z.infer<typeof effectTargetSchema>;

export const actionSchema = z.discriminatedUnion('verb', [
  z.object({
    verb: z.literal('assert'),
    /** The property the violation is attributed to. */
    field: identifierSchema,
    /** Predicate that must hold; evaluated against the row. */
    check: filterExprSchema,
    message: z.string().min(1).max(500).optional(),
  }),
  z.object({
    verb: z.literal('default'),
    field: identifierSchema,
    value: scalarSchema,
    reason: z.string().min(1).max(500).optional(),
  }),
  z.object({
    verb: z.literal('set'),
    field: identifierSchema,
    value: scalarSchema,
    reason: z.string().min(1).max(500).optional(),
  }),
  z.object({
    verb: z.literal('effect'),
    target: effectTargetSchema,
    message: z.string().min(1).max(500).optional(),
  }),
]);
export type Action = z.infer<typeof actionSchema>;
export type ActionVerb = Action['verb'];

// ---------------------------------------------------------------------------
// Rules and groups (§2.2–§2.4)
// ---------------------------------------------------------------------------

/** ISO-8601 UTC instant ("Z" suffix required); windows are half-open [from, to). */
export const instantSchema = z.iso.datetime();

export const ruleSchema = z.object({
  /** Stable id within the group; engine-assigned when omitted. */
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(200).optional(),
  when: filterExprSchema,
  then: z.array(actionSchema).min(1).max(16),
  /** Optional per-rule window, intersected with the group's (§6.1). */
  effectiveFrom: instantSchema.optional(),
  effectiveTo: instantSchema.optional(),
});
export type Rule = z.infer<typeof ruleSchema>;

/**
 * Hit policy — conflict handling INSIDE a group, declared, never emergent:
 *  - first:  first matching rule in order wins; later matches don't fire.
 *  - all:    every matching rule fires; same-field writes become conflicts.
 *  - unique: more than one matching rule is itself an error surfaced as a
 *            conflict — for groups meant to partition cleanly.
 */
export const hitPolicySchema = z.enum(['first', 'all', 'unique']);
export type HitPolicy = z.infer<typeof hitPolicySchema>;

/** Current AST grammar version; stored rules must keep parsing forever. */
export const AST_VERSION = 1;

/**
 * The authorable definition of a rule group — what a draft holds and what an
 * activation snapshots. Lifecycle state lives on the group head (engine-
 * managed), never inside the definition.
 */
export const groupDefinitionSchema = z.object({
  astVersion: z.literal(AST_VERSION).default(AST_VERSION),
  name: z.string().min(1).max(200),
  entity: entityIdSchema,
  scope: scopeSchema,
  hitPolicy: hitPolicySchema.default('first'),
  /** Cross-group tiebreak after specificity; higher wins. */
  priority: z.number().int().min(-1000).max(1000).default(0),
  /** Extra predicates ANDed into scope evaluation (tenant/env fencing, §6.3). */
  filters: z.array(filterExprSchema).max(8).default([]),
  effectiveFrom: instantSchema.optional(),
  effectiveTo: instantSchema.optional(),
  /** Drafts may hold zero rules while being composed; activation requires ≥1. */
  rules: z.array(ruleSchema).max(64).default([]),
  tenantId: z.string().min(1).max(128).optional(),
});
export type GroupDefinition = z.infer<typeof groupDefinitionSchema>;
export type GroupDefinitionInput = z.input<typeof groupDefinitionSchema>;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Extract the field ids a scope reads. */
export function scopeFields(scope: Scope, into: Set<string> = new Set()): Set<string> {
  for (const t of scope.all) into.add(t.field);
  return into;
}

/** Extract the value-set ids a scope references. */
export function scopeValueSets(scope: Scope, into: Set<string> = new Set()): Set<string> {
  for (const t of scope.all) if (t.op === 'inSet') into.add(t.set);
  return into;
}

/**
 * Half-open window containment check: from ≤ asOf < to.
 * Compared as epoch milliseconds — never lexically, so "00:00:00Z" and
 * "00:00:00.000Z" are the same instant.
 */
export function inWindow(asOfIso: string, from?: string, to?: string): boolean {
  const asOf = Date.parse(asOfIso);
  if (from !== undefined && asOf < Date.parse(from)) return false;
  if (to !== undefined && asOf >= Date.parse(to)) return false;
  return true;
}

export type { FilterExpr, Scalar };
