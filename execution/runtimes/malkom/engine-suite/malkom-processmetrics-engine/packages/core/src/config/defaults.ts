import { z } from 'zod';
import type { MetricType } from './schemas.js';

/**
 * Every behavioral default of the engine lives HERE, in one module — nothing
 * is hardcoded in the runtime, not even timezones. Three homes exist for a
 * behavior knob, and this module is the last of them:
 *
 *  1. author data — schema fields with zod defaults (e.g. a calendar's
 *     `weekStart`/`dstAmbiguity`, a definition's `window.alignment`);
 *  2. per-definition options — `definition.options` (e.g. percentileMethod);
 *  3. EngineDefaults — engine-wide fallbacks a host passes to any runtime
 *     entry point, validated by `engineDefaultsSchema` below.
 *
 * `EngineDefaultsInput` is fully partial: hosts override only what they mean
 * to and zod merges the rest from the documented defaults (the shape is flat,
 * so zod's per-field defaults ARE the deep merge). The schema is exported to
 * JSON Schema (config/jsonschema.ts) so non-TS hosts see the same defaults.
 *
 * This module is a leaf on purpose (it imports only zod and type-only names),
 * so schemas.ts can consume the shared primitives below without a cycle.
 */

/** The one weekday vocabulary of the engine (calendar workweeks, week starts). */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** IANA zone id, validated the way the sibling engines do — by asking Intl. */
export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'must be a valid IANA timezone (e.g. "Asia/Kolkata")' },
  );

/**
 * How an ambiguous wall time (fall-back replays it) resolves to an instant:
 * the earlier (first) or the later (second) occurrence.
 */
export const dstAmbiguitySchema = z.enum(['earlier', 'later']);
export type DstAmbiguity = z.infer<typeof dstAmbiguitySchema>;

/**
 * The calendar-schema default for `dstAmbiguity` — declared once here so the
 * schema default and the no-calendar fallback in window resolution cannot
 * drift apart. (dstAmbiguity is author data, so it has no EngineDefaults
 * entry; a calendar-less resolution simply uses the schema's default.)
 */
export const DST_AMBIGUITY_DEFAULT: DstAmbiguity = 'earlier';

/**
 * Percentile aggregation methods:
 *  - 'nearest_rank': v[ceil(p/100 × n)] over the ascending-sorted values —
 *    every reported percentile is a value that actually occurred;
 *  - 'linear': interpolation between closest ranks (h = (n−1) × p/100,
 *    v[⌊h⌋] + (h−⌊h⌋) × (v[⌊h⌋+1] − v[⌊h⌋]) — the R-7 / numpy default).
 */
export const percentileMethodSchema = z.enum(['nearest_rank', 'linear']);
export type PercentileMethod = z.infer<typeof percentileMethodSchema>;

/**
 * Unit defaults by metricType, applied at definition parse. currency/number
 * have no sensible default — they must declare a unit explicitly. Exported so
 * the mapping is visible surface, not a literal buried in a transform.
 */
export const UNIT_DEFAULTS: Readonly<Record<MetricType, string | undefined>> = {
  count: 'count',
  percent: 'percent',
  ratio: 'ratio',
  duration: 'minutes',
  currency: undefined,
  number: undefined,
};

/**
 * Rollup cron expressions, one per periodic grain (rolling windows are never
 * scheduled — on demand + backfill only). Each default fires SHORTLY AFTER
 * the grain's window closes — a few minutes' grace for late-arriving facts —
 * and each is independently overridable. The cron's timezone is the
 * definition's calendar timezone (else `defaultTimezone`), so "shortly after
 * close" means the definition's own midnight, not the host's.
 */
export const rollupCronsSchema = z.strictObject({
  /** Daily rollup: 00:05 local, just after each day window closes. */
  day: z.string().min(1).max(64).default('5 0 * * *'),
  /**
   * Weekly rollup: 00:10 local, just after the week window closes. The
   * day-of-week field (the LAST cron field) is OVERRIDDEN per definition
   * with its calendar's weekStart (else EngineDefaults.weekStart) — a
   * Tuesday-start week closes on Tuesday, so only the time of day is
   * configurable here.
   */
  week: z.string().min(1).max(64).default('10 0 * * 1'),
  /** Monthly rollup: the 1st, 00:15 local, just after the month closes. */
  month: z.string().min(1).max(64).default('15 0 1 * *'),
  /** Quarterly rollup: Jan/Apr/Jul/Oct 1st, 00:20 local, just after the quarter closes. */
  quarter: z.string().min(1).max(64).default('20 0 1 1,4,7,10 *'),
});
export type RollupCrons = z.infer<typeof rollupCronsSchema>;

/** Scheduler coordination knobs (cross-instance overlap protection). */
export const schedulerDefaultsSchema = z.strictObject({
  /**
   * How long one rollup tick's kv lease on (metric, scopeHash) lives. A tick
   * that finds a live lease held elsewhere records a 'skipped' run instead of
   * double-computing; a crashed holder's lease simply expires.
   */
  leaseTtlMs: z.number().int().positive().default(60_000),
});
export type SchedulerDefaults = z.infer<typeof schedulerDefaultsSchema>;

/** Retention policy for the runs audit table (pruneRuns applies it). */
export const runRetentionSchema = z.strictObject({
  /** Runs older than this many days are pruned first. */
  runsMaxAgeDays: z.number().int().positive().default(90),
  /** Then the oldest overflow beyond this row cap is pruned. */
  runsMaxRows: z.number().int().positive().default(100_000),
  /** When false, pruneRuns also strips traceJson from the surviving rows. */
  keepTraces: z.boolean().default(true),
});
export type RunRetention = z.infer<typeof runRetentionSchema>;

/**
 * Engine-wide behavioral defaults. Every runtime entry point accepts a
 * partial `EngineDefaultsInput` and resolves it through this schema; author
 * data (calendar fields, definition options) always wins over these.
 *
 * Nested blocks use `.prefault({})`, so a partial override of one nested knob
 * still merges the block's remaining documented defaults (the per-field
 * defaults ARE the deep merge, exactly as for the flat knobs).
 */
export const engineDefaultsSchema = z.strictObject({
  /** Week-start day for week windows resolved WITHOUT a calendar. */
  weekStart: z.enum(WEEKDAYS).default('mon'),
  /** Timezone for window resolution when no calendar supplies one. */
  defaultTimezone: timezoneSchema.default('UTC'),
  /** Business-time spans beyond this many days are configuration accidents. */
  maxBusinessSpanDays: z.number().int().positive().default(4000),
  /** Percentile method when neither the definition's options declare one. */
  percentileMethod: percentileMethodSchema.default('nearest_rank'),
  /** Max fact rows one source fetch may return; exceeding it throws (never truncates). */
  maxFactRows: z.number().int().positive().default(100_000),
  /** Days between successive window ends when backtesting a ROLLING definition. */
  backtestStep: z.number().int().positive().default(1),
  /** Rollup schedule per periodic grain — each "shortly after window close". */
  rollupCrons: rollupCronsSchema.prefault({}),
  /** Scheduler coordination (lease TTL for cross-instance overlap protection). */
  scheduler: schedulerDefaultsSchema.prefault({}),
  /** Runs-table retention (age first, then row cap; trace stripping). */
  retention: runRetentionSchema.prefault({}),
  /**
   * Whether backfillMetric emits metric.breached / metric.recovered for the
   * historical windows it persists. Off by default: alert semantics belong to
   * the present — a breach that ended months ago must not page anyone today.
   */
  backfillEmitsBreaches: z.boolean().default(false),
});
export type EngineDefaults = z.infer<typeof engineDefaultsSchema>;
export type EngineDefaultsInput = z.input<typeof engineDefaultsSchema>;

/** Validate + fill a (possibly partial, possibly absent) host override. */
export function resolveDefaults(input?: EngineDefaultsInput): EngineDefaults {
  return engineDefaultsSchema.parse(input ?? {});
}

/** The documented defaults, resolved once. Frozen — never mutated, only merged over. */
export const ENGINE_DEFAULTS: Readonly<EngineDefaults> = Object.freeze(resolveDefaults());
