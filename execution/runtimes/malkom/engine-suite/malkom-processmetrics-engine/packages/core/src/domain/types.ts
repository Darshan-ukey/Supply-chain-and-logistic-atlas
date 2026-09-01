import type { PercentileMethod } from '../config/defaults.js';
import type { AggFn, MetricAnchor, MetricKind, MetricTarget, MetricType, WindowAlignment } from '../config/schemas.js';

/**
 * Backend-free runtime shapes for the calculation core. Everything here is
 * JSON-serializable — computed points persist these verbatim and the REST
 * surface returns them unchanged. All timestamps are ISO-8601 UTC instants;
 * evaluation is pure, so identical inputs reproduce identical values forever.
 */

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/**
 * The grain a resolved window carries: a periodic grain, or the rolling
 * token that also prefixes the window key ("rolling-30d", "rolling-4h").
 */
export type WindowGrain =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | `rolling-${number}d`
  | `rolling-${number}h`;

/**
 * A window resolved to concrete instants, half-open [startIso, endIso).
 * `key` is the canonical point-identity string ("week:2026-W33",
 * "rolling-30d:2026-08-12T10:00:00Z") — deterministic and timezone-resolved,
 * so re-computing the same window always lands on the same point. `alignment`
 * travels even where it does not alter bounds (periodic windows) because the
 * trace must show how business time entered the calculation.
 */
export interface ResolvedWindow {
  startIso: string;
  endIso: string;
  key: string;
  grain: WindowGrain;
  alignment: WindowAlignment;
}

// ---------------------------------------------------------------------------
// Evaluation output
// ---------------------------------------------------------------------------

export type MetricStatus = 'attained' | 'warn' | 'breach' | 'no_data' | 'computed';

export type AggregateRole = 'over' | 'numerator' | 'denominator';

/** Input accounting for one aggregation: how many rows fed it, how many values survived. */
export interface AggregateTrace {
  role: AggregateRole;
  agg: AggFn;
  /** Aggregated field id (registry or derived); null for bare `count`. */
  field: string | null;
  /** Rows matching the aggregation's `where` (after scope + exclusions). */
  rowsIn: number;
  /** Values actually aggregated: non-null, coercible; count/countDistinct report their input count. */
  values: number;
}

/** How one formula source's facts were fetched (calculateMetric only). */
export interface FetchTrace {
  /** 'port' = a host FactSourcePort; 'sql' = the engine's SQL fetch path. */
  mode: 'port' | 'sql';
  /** One entry per formula source, in formula order (numerator first). */
  perSource: ReadonlyArray<{ entity: string; rows: number; limited: boolean }>;
}

/**
 * The replay trail of one evaluation. Counts are of ROWS at each pipeline
 * stage: factsIn → scopeFiltered (rows REMAINING in scope) → exclusions
 * (rows removed, per exclusion id; inactive exclusions record 0) → aggregate
 * inputs. `skippedValues` counts non-null values that could not be used where
 * a number was required — skipped, never thrown. Multi-source ratios sum the
 * per-set stage counts.
 */
export interface MetricTrace {
  factsIn: number;
  /** Rows remaining after the scope filter (== factsIn when no scope given). */
  scopeFiltered: number;
  /** Rows removed per exclusion id, in declaration order. */
  excluded: Record<string, number>;
  /** The definition's windowing anchor, verbatim. */
  anchor: MetricAnchor;
  derivedFields: readonly string[];
  aggregates: readonly AggregateTrace[];
  skippedValues: number;
  /** The method used — present when any percentile aggregation ran. */
  percentileMethod?: PercentileMethod;
  /** Present when a calendar participated (derived fields or business alignment). */
  calendar?: { name: string; version?: number };
  /** Present when calculateMetric fetched the facts (never set by evaluateMetric). */
  fetch?: FetchTrace;
  /**
   * Present when a persisted backfill REFUSED to fabricate history for a
   * snapshot-anchored definition (the window ended before the fetch instant,
   * so as-of-now facts cannot describe it); the point is no_data by policy.
   */
  snapshotBackfill?: string;
  /** ctx.nowIso verbatim — the caller's clock, never the engine's. */
  evaluatedAt: string;
}

/** One computed metric value with its status, window and replay trace. */
export interface MetricResult {
  metric: string;
  kind: MetricKind;
  metricType: MetricType;
  unit: string;
  value: number | null;
  /** Ratio formulas only: the two aggregate outputs before division/scaling. */
  numerator?: number | null;
  denominator?: number | null;
  status: MetricStatus;
  /** The target the status was judged against (already assignment-merged). */
  target?: MetricTarget;
  window: ResolvedWindow;
  trace: MetricTrace;
}
