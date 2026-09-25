import { describe, expect, it } from 'vitest';
import { coverageRecordSchema, type CoverageRecord, type TimeWindow } from '../src/config/schemas.js';
import {
  coverageExtent,
  coveredMs,
  driftWindow,
  extendCoverage,
  intersectWindows,
  normaliseWindows,
  planReuse,
  subtractWindows,
  trimCoverage,
} from '../src/runtime/coverage.js';

/** Terse window literal: w('2026-01', '2026-02'). */
function w(from: string, to: string): TimeWindow {
  return { from: new Date(`${from}-01T00:00:00Z`), to: new Date(`${to}-01T00:00:00Z`) };
}

function show(windows: readonly TimeWindow[]): string[] {
  return windows.map((x) => `${x.from.toISOString().slice(0, 7)}..${x.to.toISOString().slice(0, 7)}`);
}

function coverage(windows: TimeWindow[], fingerprint = 'fp1'): CoverageRecord {
  return coverageRecordSchema.parse({
    streamId: 'booking-ops',
    windows,
    filterFingerprint: fingerprint,
  });
}

describe('normaliseWindows', () => {
  it('merges overlapping windows', () => {
    expect(show(normaliseWindows([w('2026-01', '2026-04'), w('2026-03', '2026-06')]))).toEqual([
      '2026-01..2026-06',
    ]);
  });

  it('merges windows that merely touch', () => {
    // [Jan, Feb) and [Feb, Mar) cover January to March continuously. Leaving
    // them apart would make a request for [Jan, Mar) look like a partial miss
    // and re-fetch data already on disk.
    expect(show(normaliseWindows([w('2026-01', '2026-02'), w('2026-02', '2026-03')]))).toEqual([
      '2026-01..2026-03',
    ]);
  });

  it('keeps genuinely disjoint windows apart', () => {
    expect(show(normaliseWindows([w('2026-01', '2026-02'), w('2026-05', '2026-06')]))).toEqual([
      '2026-01..2026-02',
      '2026-05..2026-06',
    ]);
  });

  it('sorts unordered input', () => {
    expect(show(normaliseWindows([w('2026-05', '2026-06'), w('2026-01', '2026-02')]))).toEqual([
      '2026-01..2026-02',
      '2026-05..2026-06',
    ]);
  });

  it('drops empty and inverted windows', () => {
    expect(normaliseWindows([w('2026-03', '2026-03')])).toEqual([]);
    expect(normaliseWindows([{ from: new Date('2026-06-01'), to: new Date('2026-01-01') }])).toEqual([]);
  });
});

describe('subtractWindows', () => {
  it('returns nothing when the request is fully covered', () => {
    expect(subtractWindows(w('2026-02', '2026-04'), [w('2026-01', '2026-06')])).toEqual([]);
  });

  it('returns the trailing gap when the request extends past coverage', () => {
    expect(show(subtractWindows(w('2026-01', '2026-09'), [w('2026-01', '2026-06')]))).toEqual([
      '2026-06..2026-09',
    ]);
  });

  it('returns the leading gap when the request starts earlier', () => {
    expect(show(subtractWindows(w('2025-10', '2026-03'), [w('2026-01', '2026-06')]))).toEqual([
      '2025-10..2026-01',
    ]);
  });

  it('returns the hole between two covered windows', () => {
    expect(
      show(subtractWindows(w('2026-01', '2026-09'), [w('2026-01', '2026-03'), w('2026-06', '2026-09')])),
    ).toEqual(['2026-03..2026-06']);
  });

  it('returns the whole request when coverage is disjoint', () => {
    expect(show(subtractWindows(w('2025-01', '2025-06'), [w('2026-01', '2026-06')]))).toEqual([
      '2025-01..2025-06',
    ]);
  });
});

describe('planReuse', () => {
  const fp = 'fp1';

  it('serves a narrower request without touching the host', () => {
    const plan = planReuse(coverage([w('2026-01', '2026-07')]), w('2026-02', '2026-05'), fp);
    expect(plan.kind).toBe('hit');
    expect(plan.fetch).toEqual([]);
    expect(plan.reuseRatio).toBe(1);
    expect(plan.reason).toContain('the host is not queried');
  });

  it('fetches only the delta when a request extends the window', () => {
    const plan = planReuse(coverage([w('2026-01', '2026-07')]), w('2026-01', '2026-10'), fp);
    expect(plan.kind).toBe('partial');
    expect(show(plan.fetch)).toEqual(['2026-07..2026-10']);
    expect(plan.reuseRatio).toBeGreaterThan(0.6);
  });

  it('fetches only the non-overlapping part', () => {
    const plan = planReuse(coverage([w('2026-01', '2026-07')]), w('2026-03', '2026-09'), fp);
    expect(plan.kind).toBe('partial');
    expect(show(plan.fetch)).toEqual(['2026-07..2026-09']);
  });

  it('treats a disjoint request as a miss', () => {
    const plan = planReuse(coverage([w('2026-01', '2026-07')]), w('2025-01', '2025-06'), fp);
    expect(plan.kind).toBe('miss');
    expect(show(plan.fetch)).toEqual(['2025-01..2025-06']);
  });

  it('is a miss when nothing is materialised', () => {
    const plan = planReuse(coverage([]), w('2026-01', '2026-06'), fp);
    expect(plan.kind).toBe('miss');
    expect(plan.reason).toContain('nothing is materialised');
  });

  it('forces a rebuild when the definition changed, whatever the windows say', () => {
    // Re-pointing a binding or remapping a role changes what materialised rows
    // MEAN; reusing them would mix two definitions in one file.
    const plan = planReuse(coverage([w('2026-01', '2026-12')]), w('2026-02', '2026-03'), 'fp2');
    expect(plan.kind).toBe('rebuild');
    expect(plan.reuseRatio).toBe(0);
    expect(plan.reason).toContain('no longer mean the same thing');
  });

  it('will not claim an unbounded request is complete', () => {
    const plan = planReuse(coverage([w('2026-01', '2026-07')]), undefined, fp);
    expect(plan.kind).toBe('partial');
    expect(plan.reason).toContain('cannot be proven complete');
  });
});

describe('extendCoverage and trimCoverage', () => {
  it('merges newly materialised windows into the record', () => {
    const before = coverage([w('2026-01', '2026-04')]);
    const after = extendCoverage(before, [w('2026-04', '2026-07')], {
      eventCount: 4_200_000,
      caseCount: 380_000,
      at: new Date('2026-08-13T09:14:00Z'),
    });
    expect(show(after.windows)).toEqual(['2026-01..2026-07']); // touching merges
    expect(after.eventCount).toBe(4_200_000);
    expect(after.lastRefreshedAt?.toISOString()).toBe('2026-08-13T09:14:00.000Z');
  });

  it('leaves counts alone when none are supplied', () => {
    const before = extendCoverage(coverage([]), [w('2026-01', '2026-02')], { eventCount: 10 });
    const after = extendCoverage(before, [w('2026-02', '2026-03')]);
    expect(after.eventCount).toBe(10);
  });

  it('narrows coverage so a permanent trim can delete rows safely', () => {
    const trimmed = trimCoverage(coverage([w('2026-01', '2026-12')]), w('2026-02', '2026-05'));
    expect(show(trimmed.windows)).toEqual(['2026-02..2026-05']);
  });
});

describe('reporting helpers', () => {
  it('reports the full materialised extent', () => {
    const extent = coverageExtent(coverage([w('2026-05', '2026-06'), w('2026-01', '2026-02')]));
    expect(show([extent!])).toEqual(['2026-01..2026-06']);
  });

  it('returns no extent when nothing is materialised', () => {
    expect(coverageExtent(coverage([]))).toBeNull();
  });

  it('sums covered time across disjoint windows', () => {
    const ms = coveredMs([w('2026-01', '2026-02'), w('2026-03', '2026-04')]);
    expect(ms).toBe(31 * 86_400_000 + 31 * 86_400_000); // January + March
  });

  it('reports the drift window since the last refresh', () => {
    const record = extendCoverage(coverage([w('2026-01', '2026-02')]), [], {
      watermark: new Date('2026-08-13T09:14:00Z'),
    });
    const drift = driftWindow(record, new Date('2026-08-13T11:00:00Z'));
    expect(drift?.from.toISOString()).toBe('2026-08-13T09:14:00.000Z');
    expect(drift?.to.toISOString()).toBe('2026-08-13T11:00:00.000Z');
  });

  it('reports no drift when the watermark is current', () => {
    const record = extendCoverage(coverage([]), [], { watermark: new Date('2026-08-13T11:00:00Z') });
    expect(driftWindow(record, new Date('2026-08-13T11:00:00Z'))).toBeNull();
  });

  it('reports no drift when there is no watermark yet', () => {
    expect(driftWindow(coverage([]), new Date())).toBeNull();
  });
});

describe('intersectWindows', () => {
  it('clips coverage to the request', () => {
    expect(
      show(intersectWindows(w('2026-02', '2026-05'), [w('2026-01', '2026-03'), w('2026-04', '2026-09')])),
    ).toEqual(['2026-02..2026-03', '2026-04..2026-05']);
  });

  it('returns nothing when there is no overlap', () => {
    expect(intersectWindows(w('2025-01', '2025-02'), [w('2026-01', '2026-02')])).toEqual([]);
  });
});
