/**
 * M4 points + runs storage contract, run against BOTH shipped store
 * implementations: point upsert identity ((metric, scopeHash, windowKey)
 * unique, revision bumps, previous-status return), point queries and
 * intent-guarded deletion, the append-only runs audit, and the retention
 * policy — age prune, row-cap prune and trace stripping each proven
 * behaviorally with knobs resolved through EngineDefaults.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveDefaults, type RunRetention } from '../src/config/defaults.js';
import type { MetricTrace } from '../src/domain/types.js';
import type { MetricPointUpsert, MetricRunRecord, MetricsStateStore } from '../src/ports/statestore.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';
import { SqliteMetricsStateStore } from '../src/state/sqlite.js';

const NOW = '2026-08-12T10:00:00.000Z';

function day(d: number): string {
  return `2026-08-${String(d).padStart(2, '0')}`;
}

function point(overrides: Partial<MetricPointUpsert> = {}): MetricPointUpsert {
  return {
    metric: 'booking-tat-sla',
    versionNo: 1,
    scopeHash: 'hash-apac',
    scope: { region: 'APAC' },
    windowKey: 'day:2026-08-10',
    windowStartIso: '2026-08-10T00:00:00.000Z',
    windowEndIso: '2026-08-11T00:00:00.000Z',
    grain: 'day',
    value: 50,
    numerator: 2,
    denominator: 4,
    targetValue: 95,
    status: 'breach',
    computedAtIso: NOW,
    runId: 'run-1',
    ...overrides,
  };
}

/** A point for the day window starting on 2026-08-<d>. */
function dayPoint(d: number, overrides: Partial<MetricPointUpsert> = {}): MetricPointUpsert {
  return point({
    windowKey: `day:${day(d)}`,
    windowStartIso: `${day(d)}T00:00:00.000Z`,
    windowEndIso: `${day(d + 1)}T00:00:00.000Z`,
    ...overrides,
  });
}

const TRACE: MetricTrace = {
  factsIn: 4,
  scopeFiltered: 4,
  excluded: {},
  anchor: { kind: 'event', field: 'confirmedAt' },
  derivedFields: [],
  aggregates: [],
  skippedValues: 0,
  evaluatedAt: NOW,
};

let runSeq = 0;
function run(overrides: Partial<MetricRunRecord> = {}): MetricRunRecord {
  runSeq += 1;
  return {
    id: `run-${String(runSeq).padStart(4, '0')}`,
    metric: 'booking-tat-sla',
    versionNo: 1,
    trigger: 'scheduled',
    windowKey: 'day:2026-08-10',
    scopeHash: 'hash-apac',
    status: 'ok',
    startedAtIso: NOW,
    finishedAtIso: NOW,
    error: null,
    trace: structuredClone(TRACE),
    ...overrides,
  };
}

/** Retention knobs resolved the real way — through EngineDefaults. */
function retention(input: Partial<RunRetention> = {}): RunRetention {
  return resolveDefaults({ retention: input }).retention;
}

const IMPLS: Array<[string, () => MetricsStateStore]> = [
  ['InMemoryMetricsStateStore', () => new InMemoryMetricsStateStore()],
  ['SqliteMetricsStateStore (:memory:)', () => new SqliteMetricsStateStore(':memory:')],
];

describe.each(IMPLS)('%s points + runs', (_name, make) => {
  let store: MetricsStateStore;

  async function open(): Promise<MetricsStateStore> {
    store = make();
    await store.init();
    return store;
  }

  afterEach(async () => {
    await store.close();
  });

  describe('points', () => {
    it('first upsert stores revision 1 with no previous statuses', async () => {
      const s = await open();
      const { point: stored, previousStatus, previousAlertStatus } = await s.upsertPoint(point());
      expect(previousStatus).toBeNull();
      expect(previousAlertStatus).toBeNull();
      expect(stored.revision).toBe(1);
      expect(stored).toEqual({ ...point(), lastAlertStatus: 'breach', revision: 1 });
    });

    it('recomputing the same logical key replaces the row, bumps revision, returns the old status', async () => {
      const s = await open();
      await s.upsertPoint(point({ status: 'breach', value: 50 }));
      const second = await s.upsertPoint(point({ status: 'attained', value: 96, runId: 'run-2' }));
      expect(second.previousStatus).toBe('breach');
      expect(second.point.revision).toBe(2);
      expect(second.point.value).toBe(96);

      const third = await s.upsertPoint(point({ status: 'warn', value: 91, runId: 'run-3' }));
      expect(third.previousStatus).toBe('attained');
      expect(third.point.revision).toBe(3);

      // Still ONE row — (metric, scopeHash, windowKey) is the identity.
      const rows = await s.queryPoints({ metric: 'booking-tat-sla' });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ revision: 3, status: 'warn', runId: 'run-3' });
    });

    it('a different scope or window is a different point (revision 1 each)', async () => {
      const s = await open();
      await s.upsertPoint(point());
      const otherScope = await s.upsertPoint(point({ scopeHash: 'hash-emea', scope: { region: 'EMEA' } }));
      const otherWindow = await s.upsertPoint(dayPoint(11));
      expect(otherScope.point.revision).toBe(1);
      expect(otherScope.previousStatus).toBeNull();
      expect(otherWindow.point.revision).toBe(1);
      expect(await s.queryPoints({ metric: 'booking-tat-sla' })).toHaveLength(3);
    });

    it('nullable columns round-trip (no_data points carry nulls, never zeros)', async () => {
      const s = await open();
      await s.upsertPoint(
        point({ value: null, numerator: null, denominator: null, targetValue: null, status: 'no_data' }),
      );
      const [row] = await s.queryPoints({ metric: 'booking-tat-sla' });
      expect(row).toMatchObject({
        value: null,
        numerator: null,
        denominator: null,
        targetValue: null,
        status: 'no_data',
        lastAlertStatus: null, // a first-ever no_data has no alert verdict yet
      });
    });

    it('lastAlertStatus tracks the last NON-no_data status; no_data is transparent', async () => {
      const s = await open();
      const first = await s.upsertPoint(point({ status: 'breach' }));
      expect(first.point.lastAlertStatus).toBe('breach');

      const gap = await s.upsertPoint(point({ status: 'no_data', value: null, runId: 'run-2' }));
      expect(gap.previousStatus).toBe('breach');
      expect(gap.previousAlertStatus).toBe('breach');
      expect(gap.point.lastAlertStatus).toBe('breach'); // the standing verdict survives the gap

      const healed = await s.upsertPoint(point({ status: 'attained', value: 96, runId: 'run-3' }));
      expect(healed.previousStatus).toBe('no_data'); // the raw replaced status
      expect(healed.previousAlertStatus).toBe('breach'); // …but the alert baseline sees through it
      expect(healed.point.lastAlertStatus).toBe('attained');
    });

    it('persistMaterialization lands the point and its run together', async () => {
      const s = await open();
      const result = await s.persistMaterialization(point(), run({ id: 'run-atomic-1' }));
      expect(result.point.revision).toBe(1);
      expect(await s.queryPoints({ metric: 'booking-tat-sla' })).toHaveLength(1);
      expect((await s.queryRuns({ metric: 'booking-tat-sla' }))[0]?.id).toBe('run-atomic-1');
    });

    it('queryPoints filters by scopeHash/grain/half-open window range; orders and limits', async () => {
      const s = await open();
      for (const d of [10, 11, 12, 13]) await s.upsertPoint(dayPoint(d));
      await s.upsertPoint(dayPoint(10, { scopeHash: 'hash-emea', scope: { region: 'EMEA' } }));
      await s.upsertPoint(
        point({
          metric: 'weekly-tat',
          windowKey: 'week:2026-W33',
          windowStartIso: '2026-08-10T00:00:00Z',
          windowEndIso: '2026-08-17T00:00:00Z',
          grain: 'week',
        }),
      );

      // Other metrics never leak in.
      expect(await s.queryPoints({ metric: 'weekly-tat' })).toHaveLength(1);
      expect((await s.queryPoints({ metric: 'booking-tat-sla' })).every((p) => p.metric === 'booking-tat-sla')).toBe(true);

      expect(await s.queryPoints({ metric: 'booking-tat-sla', scopeHash: 'hash-emea' })).toHaveLength(1);
      expect(await s.queryPoints({ metric: 'booking-tat-sla', grain: 'day' })).toHaveLength(5);

      // Half-open [fromIso, toIso) on windowStartIso.
      const ranged = await s.queryPoints({
        metric: 'booking-tat-sla',
        scopeHash: 'hash-apac',
        fromIso: '2026-08-11T00:00:00Z',
        toIso: '2026-08-13T00:00:00Z',
      });
      expect(ranged.map((p) => p.windowKey)).toEqual(['day:2026-08-11', 'day:2026-08-12']);

      // Ascending by default; desc + limit serve "latest N".
      const asc = await s.queryPoints({ metric: 'booking-tat-sla', scopeHash: 'hash-apac' });
      expect(asc.map((p) => p.windowKey)).toEqual([
        'day:2026-08-10',
        'day:2026-08-11',
        'day:2026-08-12',
        'day:2026-08-13',
      ]);
      const latestTwo = await s.queryPoints({
        metric: 'booking-tat-sla',
        scopeHash: 'hash-apac',
        order: 'desc',
        limit: 2,
      });
      expect(latestTwo.map((p) => p.windowKey)).toEqual(['day:2026-08-13', 'day:2026-08-12']);
    });

    it('mixed-precision instants collate identically (canonical .mmm form on write AND on query bounds)', async () => {
      const s = await open();
      // One window start with sub-second precision, one written in the
      // trimmed seconds form — the store canonicalizes both.
      await s.upsertPoint(
        point({ windowKey: 'rolling-1h:a', windowStartIso: '2026-08-12T10:00:00.250Z', windowEndIso: '2026-08-12T11:00:00.250Z' }),
      );
      await s.upsertPoint(
        point({ windowKey: 'rolling-1h:b', windowStartIso: '2026-08-12T10:00:00Z', windowEndIso: '2026-08-12T11:00:00Z' }),
      );

      const from = async (fromIso: string) =>
        (await s.queryPoints({ metric: 'booking-tat-sla', fromIso })).map((p) => p.windowKey).sort();
      // Seconds-precision bound vs sub-second rows: both are at-or-after.
      expect(await from('2026-08-12T10:00:00Z')).toEqual(['rolling-1h:a', 'rolling-1h:b']);
      // Sub-second bound vs a seconds-precision row: 10:00:00.000 < .250 —
      // the trimmed-form row must fall OUT here in both stores alike.
      expect(await from('2026-08-12T10:00:00.250Z')).toEqual(['rolling-1h:a']);
      // Sub-second toIso vs a trimmed row (the reproduced divergence: the
      // lexicographic sqlite comparison used to EXCLUDE '…00Z' < '…00.500Z').
      const to = await s.queryPoints({ metric: 'booking-tat-sla', toIso: '2026-08-12T10:00:00.500Z' });
      expect(to.map((p) => p.windowKey).sort()).toEqual(['rolling-1h:a', 'rolling-1h:b']);
      // Round-trips are canonical, so ordering agrees with chronology.
      expect(to.every((p) => p.windowStartIso.endsWith('Z') && p.windowStartIso.includes('.'))).toBe(true);
    });

    it('deletePoints needs intent: empty filter deletes nothing; metric and beforeIso scope the cut', async () => {
      const s = await open();
      for (const d of [10, 11, 12]) await s.upsertPoint(dayPoint(d));
      await s.upsertPoint(dayPoint(10, { metric: 'weekly-tat' }));

      expect(await s.deletePoints({})).toBe(0);
      expect(await s.queryPoints({ metric: 'booking-tat-sla' })).toHaveLength(3);

      // beforeIso cuts windows that CLOSED before the instant (windowEnd <).
      expect(await s.deletePoints({ metric: 'booking-tat-sla', beforeIso: '2026-08-12T00:00:00Z' })).toBe(1);
      expect((await s.queryPoints({ metric: 'booking-tat-sla' })).map((p) => p.windowKey)).toEqual([
        'day:2026-08-11',
        'day:2026-08-12',
      ]);
      expect(await s.queryPoints({ metric: 'weekly-tat' })).toHaveLength(1); // untouched

      expect(await s.deletePoints({ metric: 'booking-tat-sla' })).toBe(2);
      expect(await s.queryPoints({ metric: 'booking-tat-sla' })).toEqual([]);
    });
  });

  describe('runs', () => {
    it('appendRun/queryRuns round-trip with filters, order and limit', async () => {
      const s = await open();
      const ok = run({ startedAtIso: '2026-08-12T00:05:00.000Z', finishedAtIso: '2026-08-12T00:05:01.000Z' });
      const failed = run({
        status: 'error',
        error: 'no such column: confirmed_at',
        trace: null,
        startedAtIso: '2026-08-12T00:06:00.000Z',
      });
      const skipped = run({
        status: 'skipped',
        trigger: 'scheduled',
        trace: null,
        startedAtIso: '2026-08-12T00:07:00.000Z',
      });
      const backfilled = run({ trigger: 'backfill', metric: 'weekly-tat', startedAtIso: '2026-08-12T00:08:00.000Z' });
      for (const r of [ok, failed, skipped, backfilled]) await s.appendRun(r);

      // Default order: latest first.
      expect((await s.queryRuns()).map((r) => r.id)).toEqual([backfilled.id, skipped.id, failed.id, ok.id]);
      expect((await s.queryRuns({ order: 'asc' })).map((r) => r.id)).toEqual([ok.id, failed.id, skipped.id, backfilled.id]);
      expect((await s.queryRuns({ limit: 2 })).map((r) => r.id)).toEqual([backfilled.id, skipped.id]);

      expect(await s.queryRuns({ metric: 'weekly-tat' })).toEqual([backfilled]);
      expect((await s.queryRuns({ status: 'error' }))[0]).toEqual(failed);
      expect((await s.queryRuns({ trigger: 'backfill' }))[0]?.id).toBe(backfilled.id);
      expect(await s.queryRuns({ windowKey: 'day:2026-08-10', scopeHash: 'hash-apac' })).toHaveLength(4);
      expect(await s.queryRuns({ scopeHash: 'nope' })).toEqual([]);

      // The stored trace replays byte-identically.
      expect((await s.queryRuns({ status: 'ok', metric: 'booking-tat-sla' }))[0]?.trace).toEqual(TRACE);
    });

    it('retention: the AGE knob prunes runs older than runsMaxAgeDays', async () => {
      const s = await open();
      const old = run({ startedAtIso: '2026-05-01T00:00:00.000Z' }); // 103 days before NOW
      const fresh = run({ startedAtIso: '2026-08-01T00:00:00.000Z' }); // 11 days before NOW
      await s.appendRun(old);
      await s.appendRun(fresh);

      // The documented default (90 days) removes only the stale run…
      expect(await s.pruneRuns(retention(), NOW)).toBe(1);
      expect((await s.queryRuns()).map((r) => r.id)).toEqual([fresh.id]);

      // …and tightening the knob removes the fresh one too: the knob acts.
      expect(await s.pruneRuns(retention({ runsMaxAgeDays: 10 }), NOW)).toBe(1);
      expect(await s.queryRuns()).toEqual([]);
    });

    it('retention: the ROW-CAP knob prunes the oldest overflow after the age pass', async () => {
      const s = await open();
      const runs = [10, 11, 12, 13, 14].map((d) =>
        run({ startedAtIso: `2026-08-${d}T00:00:00.000Z`, windowKey: `day:2026-08-${d}` }),
      );
      for (const r of runs) await s.appendRun(r);

      // Cap 3: the two OLDEST go, newest three stay.
      expect(await s.pruneRuns(retention({ runsMaxRows: 3 }), '2026-08-15T00:00:00Z')).toBe(2);
      expect((await s.queryRuns({ order: 'asc' })).map((r) => r.startedAtIso)).toEqual([
        '2026-08-12T00:00:00.000Z',
        '2026-08-13T00:00:00.000Z',
        '2026-08-14T00:00:00.000Z',
      ]);

      // Age applies FIRST, then the cap sees what is left: with two of the
      // three survivors aged out, a cap of 1 has nothing extra to remove.
      expect(await s.pruneRuns(retention({ runsMaxAgeDays: 2, runsMaxRows: 1 }), '2026-08-15T00:00:00Z')).toBe(2);
      expect((await s.queryRuns()).map((r) => r.startedAtIso)).toEqual(['2026-08-14T00:00:00.000Z']);
    });

    it('retention: keepTraces=false strips traces from SURVIVING rows (deletions counted separately)', async () => {
      const s = await open();
      const a = run({ startedAtIso: '2026-08-11T00:00:00.000Z' });
      const b = run({ startedAtIso: '2026-08-12T00:00:00.000Z' });
      await s.appendRun(a);
      await s.appendRun(b);
      expect((await s.queryRuns())[0]?.trace).not.toBeNull();

      const removed = await s.pruneRuns(retention({ keepTraces: false }), NOW);
      expect(removed).toBe(0); // nothing deleted — traces stripped, not rows
      const rows = await s.queryRuns();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.trace === null)).toBe(true);
      // Everything else survives untouched.
      expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());

      // keepTraces=true (the default) leaves traces alone.
      const c = run({ startedAtIso: '2026-08-12T01:00:00.000Z' });
      await s.appendRun(c);
      await s.pruneRuns(retention(), NOW);
      expect((await s.queryRuns({ limit: 1 }))[0]?.trace).toEqual(TRACE);
    });
  });
});

describe('SqliteMetricsStateStore points/runs persistence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'malkom-metrics-m4-store-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('persistMaterialization is ONE transaction: a failing run insert rolls the point back', async () => {
    const s = new SqliteMetricsStateStore(':memory:');
    await s.init();
    await s.appendRun(run({ id: 'run-dupe' })); // occupy the run id
    // The point upsert inside the tx succeeds, the run insert violates the
    // PK — the whole write must vanish, never a point without its audit.
    await expect(s.persistMaterialization(point(), run({ id: 'run-dupe' }))).rejects.toThrow();
    expect(await s.queryPoints({ metric: 'booking-tat-sla' })).toEqual([]);
    // A later persist starts from revision 1 — nothing half-landed.
    const ok = await s.persistMaterialization(point(), run({ id: 'run-clean' }));
    expect(ok.point.revision).toBe(1);
    await s.close();
  });

  it('points and runs survive reopen — revisions and traces intact', async () => {
    const file = join(dir, 'state.db');
    const a = new SqliteMetricsStateStore(file);
    await a.init();
    await a.upsertPoint(point());
    await a.upsertPoint(point({ status: 'attained', value: 96 })); // revision 2
    const stored = run();
    await a.appendRun(stored);
    await a.close();

    const b = new SqliteMetricsStateStore(file);
    await b.init();
    const [p] = await b.queryPoints({ metric: 'booking-tat-sla' });
    expect(p).toMatchObject({ revision: 2, status: 'attained', value: 96, scope: { region: 'APAC' } });
    // A recompute AFTER restart still sees the previous status and revision.
    const third = await b.upsertPoint(point({ status: 'breach', value: 40 }));
    expect(third.previousStatus).toBe('attained');
    expect(third.point.revision).toBe(3);
    expect((await b.queryRuns())[0]).toEqual(stored);
    await b.close();
  });
});
