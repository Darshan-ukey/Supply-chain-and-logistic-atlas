import type { MetricPointUpsert, MetricRunRecord } from '../ports/statestore.js';

/**
 * Canonical persisted-instant form, shared by BOTH store implementations:
 * fixed-width millisecond UTC ISO ("2026-08-12T10:00:00.000Z"). Fixed width
 * makes lexicographic order equal chronological order, so the sqlite store's
 * string comparisons and the memory store's epoch comparisons can never
 * disagree about a range boundary — mixed-precision inputs ('.250Z' vs a
 * seconds-only 'Z' form) collate identically after normalization. Every
 * instant a store COMPARES or ORDERS BY (point window bounds, computedAt,
 * run started/finished, query bounds) passes through here on write and read.
 *
 * Unparseable strings pass through verbatim: rejecting them is the caller's
 * (validated) boundary's job, not a silent store-side rewrite.
 */
export function canonicalInstant(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : new Date(ms).toISOString();
}

/** A point upsert with every instant column in canonical persisted form. */
export function canonicalPointInstants(point: MetricPointUpsert): MetricPointUpsert {
  return {
    ...point,
    windowStartIso: canonicalInstant(point.windowStartIso),
    windowEndIso: canonicalInstant(point.windowEndIso),
    computedAtIso: canonicalInstant(point.computedAtIso),
  };
}

/** A run record with every instant column in canonical persisted form. */
export function canonicalRunInstants(run: MetricRunRecord): MetricRunRecord {
  return {
    ...run,
    startedAtIso: canonicalInstant(run.startedAtIso),
    finishedAtIso: canonicalInstant(run.finishedAtIso),
  };
}
