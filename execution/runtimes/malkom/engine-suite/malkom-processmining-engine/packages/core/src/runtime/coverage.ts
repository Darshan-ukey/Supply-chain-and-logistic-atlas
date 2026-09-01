import type { CoverageRecord, TimeWindow } from '../config/schemas.js';

/**
 * Coverage arithmetic — what makes a materialised stream reusable.
 *
 * A stream's DEFINITION says what it selects; its COVERAGE says which slice has
 * actually been pulled and written. Comparing a request against coverage turns
 * exploratory use — narrowing to last month, then this quarter, then one queue —
 * into cache hits instead of repeated full extractions.
 *
 * Windows are half-open, [from, to), so adjacent windows tile without
 * double-counting the boundary instant. An event at exactly `to` belongs to the
 * next window, never to both.
 */

/** A window as epoch-ms, which is the only form the arithmetic below works in. */
interface Span {
  from: number;
  to: number;
}

function toSpan(w: TimeWindow): Span {
  return { from: w.from.getTime(), to: w.to.getTime() };
}

function toWindow(s: Span): TimeWindow {
  return { from: new Date(s.from), to: new Date(s.to) };
}

/**
 * Normalise a set of windows: drop empties, sort, and merge everything that
 * overlaps OR touches.
 *
 * Touching windows must merge, not merely overlapping ones: [Jan, Feb) and
 * [Feb, Mar) cover January through February continuously, and leaving them
 * separate would make a request for [Jan, Mar) look like a partial miss and
 * trigger a pointless re-fetch of data already on disk.
 */
export function normaliseWindows(windows: readonly TimeWindow[]): TimeWindow[] {
  const spans = windows.map(toSpan).filter((s) => s.from < s.to);
  if (spans.length === 0) return [];
  spans.sort((a, b) => a.from - b.from || a.to - b.to);

  const merged: Span[] = [{ ...spans[0]! }];
  for (const span of spans.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (span.from <= last.to) {
      // overlapping or exactly adjacent
      if (span.to > last.to) last.to = span.to;
    } else {
      merged.push({ ...span });
    }
  }
  return merged.map(toWindow);
}

/** Total covered milliseconds across a normalised set. */
export function coveredMs(windows: readonly TimeWindow[]): number {
  return normaliseWindows(windows).reduce((sum, w) => sum + (w.to.getTime() - w.from.getTime()), 0);
}

/** Subtract covered windows from a request, returning the gaps still to fetch. */
export function subtractWindows(
  request: TimeWindow,
  covered: readonly TimeWindow[],
): TimeWindow[] {
  const req = toSpan(request);
  if (req.from >= req.to) return [];

  const gaps: Span[] = [];
  let cursor = req.from;

  for (const span of normaliseWindows(covered).map(toSpan)) {
    if (span.to <= cursor) continue; // entirely before the remaining request
    if (span.from >= req.to) break; // entirely after; the rest are too
    if (span.from > cursor) gaps.push({ from: cursor, to: Math.min(span.from, req.to) });
    cursor = Math.max(cursor, span.to);
    if (cursor >= req.to) break;
  }
  if (cursor < req.to) gaps.push({ from: cursor, to: req.to });

  return gaps.map(toWindow);
}

/** How a request relates to what a stream already holds. */
export type ReusePlanKind =
  /** Fully materialised. Serve from the stream file; the host is not touched. */
  | 'hit'
  /** Partially materialised. Fetch only the gaps, then serve. */
  | 'partial'
  /** Nothing usable. Fetch the whole request. */
  | 'miss'
  /** The definition changed, so existing rows mean something else. Rebuild. */
  | 'rebuild';

export interface ReusePlan {
  kind: ReusePlanKind;
  /** Windows that must be fetched from the host. Empty for a hit. */
  fetch: TimeWindow[];
  /** Windows already on disk that satisfy part of the request. */
  reuse: TimeWindow[];
  /** Fraction of the request already materialised, 0–1. */
  reuseRatio: number;
  /** Human-readable explanation, suitable for surfacing to an operator. */
  reason: string;
}

/**
 * Decide how to satisfy a request against a stream's coverage.
 *
 * `requestFingerprint` is compared against the stored one first, and a mismatch
 * forces a rebuild regardless of windows: re-pointing a binding at another
 * table or remapping a role changes what already-materialised rows MEAN, and
 * mixing two definitions in one file would produce a log that is silently
 * describing two different processes.
 */
export function planReuse(
  coverage: CoverageRecord,
  request: TimeWindow | undefined,
  requestFingerprint: string,
): ReusePlan {
  if (coverage.filterFingerprint !== requestFingerprint) {
    return {
      kind: 'rebuild',
      fetch: request === undefined ? [] : [request],
      reuse: [],
      reuseRatio: 0,
      reason:
        'the stream definition changed (bindings, roles or filters), so materialised rows no longer mean the same thing',
    };
  }

  const covered = normaliseWindows(coverage.windows);

  // An unbounded request can only be served from an unbounded materialisation,
  // and the engine has no way to prove it holds "everything" — so it re-fetches
  // rather than quietly answering from whatever happens to be on disk.
  if (request === undefined) {
    return covered.length === 0
      ? { kind: 'miss', fetch: [], reuse: [], reuseRatio: 0, reason: 'nothing is materialised yet' }
      : {
          kind: 'partial',
          fetch: [],
          reuse: covered,
          reuseRatio: 1,
          reason: `serving the full materialised extent (${covered.length} window${covered.length === 1 ? '' : 's'}); an unbounded request cannot be proven complete`,
        };
  }

  if (covered.length === 0) {
    return { kind: 'miss', fetch: [request], reuse: [], reuseRatio: 0, reason: 'nothing is materialised yet' };
  }

  const gaps = subtractWindows(request, covered);
  const requestMs = request.to.getTime() - request.from.getTime();
  const gapMs = coveredMs(gaps);
  const reuseRatio = requestMs === 0 ? 1 : Math.max(0, 1 - gapMs / requestMs);
  const reuse = intersectWindows(request, covered);

  if (gaps.length === 0) {
    return {
      kind: 'hit',
      fetch: [],
      reuse,
      reuseRatio: 1,
      reason: 'the request lies inside what is already materialised; the host is not queried',
    };
  }
  if (reuse.length === 0) {
    return { kind: 'miss', fetch: gaps, reuse: [], reuseRatio: 0, reason: 'the request is disjoint from existing coverage' };
  }
  return {
    kind: 'partial',
    fetch: gaps,
    reuse,
    reuseRatio,
    reason: `${Math.round(reuseRatio * 100)}% already materialised; fetching ${gaps.length} gap${gaps.length === 1 ? '' : 's'}`,
  };
}

/** The parts of `request` that fall inside `covered`. */
export function intersectWindows(
  request: TimeWindow,
  covered: readonly TimeWindow[],
): TimeWindow[] {
  const req = toSpan(request);
  const out: Span[] = [];
  for (const span of normaliseWindows(covered).map(toSpan)) {
    const from = Math.max(req.from, span.from);
    const to = Math.min(req.to, span.to);
    if (from < to) out.push({ from, to });
  }
  return out.map(toWindow);
}

/** Record newly materialised windows, merging them into the coverage set. */
export function extendCoverage(
  coverage: CoverageRecord,
  added: readonly TimeWindow[],
  stats: { eventCount?: number; caseCount?: number; bytesOnDisk?: number; at?: Date; watermark?: Date } = {},
): CoverageRecord {
  return {
    ...coverage,
    windows: normaliseWindows([...coverage.windows, ...added]),
    eventCount: stats.eventCount ?? coverage.eventCount,
    caseCount: stats.caseCount ?? coverage.caseCount,
    bytesOnDisk: stats.bytesOnDisk ?? coverage.bytesOnDisk,
    ...(stats.at !== undefined ? { lastRefreshedAt: stats.at } : {}),
    ...(stats.watermark !== undefined ? { sourceWatermark: stats.watermark } : {}),
  };
}

/**
 * Narrow coverage to `keep`, which is what makes a permanent trim safe: rows
 * outside the retained windows can be deleted and the file shrunk, and the
 * coverage record stops claiming data that is no longer there.
 */
export function trimCoverage(coverage: CoverageRecord, keep: TimeWindow): CoverageRecord {
  return { ...coverage, windows: intersectWindows(keep, coverage.windows) };
}

/** The full materialised extent, or null when nothing is materialised. */
export function coverageExtent(coverage: CoverageRecord): TimeWindow | null {
  const windows = normaliseWindows(coverage.windows);
  const first = windows[0];
  const last = windows[windows.length - 1];
  if (first === undefined || last === undefined) return null;
  return { from: first.from, to: last.to };
}

/**
 * Rows in the source newer than the last refresh — the drift figure every
 * response carries so a stale answer is never served as though it were live.
 */
export function driftWindow(coverage: CoverageRecord, now: Date): TimeWindow | null {
  const watermark = coverage.sourceWatermark;
  if (watermark === undefined) return null;
  if (watermark.getTime() >= now.getTime()) return null;
  return { from: watermark, to: now };
}
