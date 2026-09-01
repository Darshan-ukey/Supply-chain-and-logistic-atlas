/**
 * M4 materialization end-to-end over the Booking-TAT fixture +
 * MemoryFactSource: pinned point and run rows, metric.computed on every
 * write, breach → recovered transition events driven by the store's
 * previous-status, swallowed hook failures (with onError informed), the
 * error path (run recorded, NO point), and backfill — five persisted windows
 * with trigger 'backfill', revision bumps on recompute, and breach events
 * suppressed unless EngineDefaults.backfillEmitsBreaches says otherwise.
 */
import { describe, expect, it } from 'vitest';
import {
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type Calendar,
  type MetricDefinitionInput,
  type RegistryDocInput,
} from '../src/config/schemas.js';
import { ConfigInvalidError } from '../src/domain/errors.js';
import { contentHash, CompiledRegistry } from '../src/domain/registry.js';
import { MemoryFactSource, type FactSourcePort } from '../src/ports/factsource.js';
import type { EngineErrorContext, EngineEvent } from '../src/ports/hooks.js';
import { noopLogger } from '../src/ports/logger.js';
import type { DefinitionVersionRecord } from '../src/ports/statestore.js';
import { backfillMetric } from '../src/runtime/backfill.js';
import { materializeWindow, WriteAbortedError } from '../src/runtime/materialize.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';

// ---------------------------------------------------------------------------
// The Booking-TAT world (the M2/M3 fixture, verbatim)
// ---------------------------------------------------------------------------

const REGISTRY_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped', 'cancelled'] },
        { id: 'region', type: 'string', valueSet: 'regions' },
        { id: 'createdAt', type: 'date' },
        { id: 'confirmedAt', type: 'date' },
        { id: 'customerTier', type: 'string', values: ['gold', 'silver', 'bronze'] },
      ],
    },
  ],
  valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
};
const REGISTRY = new CompiledRegistry(registryDocSchema.parse(REGISTRY_INPUT), 1);

const CALENDAR: Calendar = calendarSchema.parse({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

const BOOKING_TAT: MetricDefinitionInput = {
  name: 'booking-tat-sla',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'week' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
  calendarRef: 'india-ops',
  derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] } },
  formula: {
    kind: 'ratio',
    numerator: {
      agg: 'count',
      source: 'booking',
      where: {
        op: 'and',
        args: [
          { op: 'eq', field: 'status', value: 'confirmed' },
          { op: 'lte', field: 'tatMinutes', value: 240 },
        ],
      },
    },
    denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
  },
  exclusions: [
    {
      id: 'bronze-migration',
      reason: 'bronze accounts migrating to the new workflow are out of SLA scope',
      when: { op: 'eq', field: 'customerTier', value: 'bronze' },
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    },
  ],
  effectiveFrom: '2026-08-01T00:00:00Z',
};

type Row = {
  id: string;
  region: string;
  status: string;
  createdAt: string | null;
  confirmedAt: string | null;
  customerTier: string;
};

function row(id: string, region: string, status: string, createdAt: string | null, confirmedAt: string | null, customerTier: string): Row {
  return { id, region, status, createdAt, confirmedAt, customerTier };
}

const WORK_EVENTS: Row[] = [
  row('b1', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'),
  row('b2', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T11:30:00Z', 'gold'),
  row('b3', 'APAC', 'confirmed', '2026-08-11T11:30:00Z', '2026-08-12T04:30:00Z', 'silver'),
  row('b4', 'APAC', 'confirmed', '2026-08-13T12:00:00Z', '2026-08-17T04:00:00Z', 'gold'),
  row('b5', 'APAC', 'confirmed', '2026-08-10T03:30:00Z', '2026-08-10T12:30:00Z', 'bronze'),
  row('b6', 'APAC', 'new', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b7', 'APAC', 'cancelled', '2026-08-12T04:30:00Z', null, 'silver'),
  row('b8', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:10:00Z', 'gold'),
  row('b9', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T09:30:00Z', 'gold'),
  row('b10', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b11', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:30:00Z', 'gold'),
  row('b12', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:20:00Z', 'silver'),
  row('b13', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', '2026-08-12T06:00:00Z', 'gold'),
];

/** The same week with the two slow confirmations fixed — 100% in SLA. */
const FIXED_EVENTS: Row[] = WORK_EVENTS.map((r) =>
  r.id === 'b2' || r.id === 'b12'
    ? { ...r, confirmedAt: r.createdAt === null ? null : new Date(Date.parse(r.createdAt) + 60 * 60_000).toISOString() }
    : r,
);

const AT = '2026-08-12T05:00:00Z'; // Wed of ISO week 33; window [08-09T18:30Z, 08-16T18:30Z)
const APAC = { region: 'APAC' };
const APAC_HASH = contentHash(APAC);

function versionRecord(input: MetricDefinitionInput = BOOKING_TAT, versionNo = 1): DefinitionVersionRecord {
  return {
    metric: input.name!,
    versionNo,
    doc: metricDefinitionSchema.parse(input),
    registryVersion: 1,
    calendarName: 'india-ops',
    calendarVersion: 1,
    activatedAt: '2026-08-01T00:00:00Z',
    actor: 'priya',
  };
}

interface Env {
  store: InMemoryMetricsStateStore;
  events: EngineEvent[];
  errors: Array<{ err: unknown; context: EngineErrorContext }>;
  hooks: { onEvent: (e: EngineEvent) => void; onError: (err: unknown, context: EngineErrorContext) => void };
}

function env(): Env {
  const events: EngineEvent[] = [];
  const errors: Array<{ err: unknown; context: EngineErrorContext }> = [];
  return {
    store: new InMemoryMetricsStateStore(),
    events,
    errors,
    hooks: {
      onEvent: (e) => void events.push(e),
      onError: (err, context) => void errors.push({ err, context }),
    },
  };
}

function materialize(e: Env, overrides: Record<string, unknown> = {}) {
  return materializeWindow({
    definitionVersion: versionRecord(),
    registry: REGISTRY,
    calendars: [CALENDAR],
    facts: { source: new MemoryFactSource(WORK_EVENTS) },
    scope: APAC,
    windowAt: AT,
    nowIso: AT,
    store: e.store,
    hooks: e.hooks,
    logger: noopLogger,
    trigger: 'manual',
    ...overrides,
  });
}

describe('materializeWindow', () => {
  it('persists a pinned point row, a pinned run row, and emits metric.computed', async () => {
    const e = env();
    const outcome = await materialize(e);

    // The calculation itself matches the M3 fixture expectations…
    expect(outcome.result.numerator).toBe(5);
    expect(outcome.result.denominator).toBe(6);
    expect(outcome.result.status).toBe('breach');

    // …and the point row pins every column (instants in the stores' fixed
    // canonical millisecond form).
    const [point] = await e.store.queryPoints({ metric: 'booking-tat-sla' });
    expect(point).toEqual({
      metric: 'booking-tat-sla',
      versionNo: 1,
      scopeHash: APAC_HASH,
      scope: APAC,
      windowKey: 'week:2026-W33',
      windowStartIso: '2026-08-09T18:30:00.000Z',
      windowEndIso: '2026-08-16T18:30:00.000Z',
      grain: 'week',
      value: (5 / 6) * 100,
      numerator: 5,
      denominator: 6,
      targetValue: 95,
      status: 'breach',
      lastAlertStatus: 'breach',
      revision: 1,
      computedAtIso: '2026-08-12T05:00:00.000Z',
      runId: outcome.run.id,
    });

    // The run row carries the full replay trace.
    const [run] = await e.store.queryRuns({ metric: 'booking-tat-sla' });
    expect(run).toEqual({
      id: outcome.run.id,
      metric: 'booking-tat-sla',
      versionNo: 1,
      trigger: 'manual',
      windowKey: 'week:2026-W33',
      scopeHash: APAC_HASH,
      status: 'ok',
      startedAtIso: '2026-08-12T05:00:00.000Z',
      finishedAtIso: '2026-08-12T05:00:00.000Z',
      error: null,
      trace: outcome.result.trace,
    });
    expect(run?.trace?.factsIn).toBe(7);
    expect(run?.trace?.excluded).toEqual({ 'bronze-migration': 1 });

    // metric.computed always; metric.breached because the point ENTERED breach.
    expect(e.events.map((ev) => ev.type)).toEqual(['metric.computed', 'metric.breached']);
    expect(e.events[0]).toMatchObject({
      metric: 'booking-tat-sla',
      versionNo: 1,
      scope: APAC,
      scopeHash: APAC_HASH,
      windowKey: 'week:2026-W33',
      value: (5 / 6) * 100,
      status: 'breach',
      revision: 1,
      runId: outcome.run.id,
      trigger: 'manual',
      occurredAtIso: AT,
    });
    expect(e.events[1]).toMatchObject({ type: 'metric.breached', previousStatus: null });
    expect(e.errors).toEqual([]);
  });

  it('breach then fix: metric.breached once, then metric.recovered off the previous status', async () => {
    const e = env();
    await materialize(e); // breach, revision 1
    await materialize(e); // still breach — must NOT re-emit metric.breached
    const fixed = await materialize(e, { facts: { source: new MemoryFactSource(FIXED_EVENTS) } });

    expect(fixed.result.status).toBe('attained');
    expect(fixed.result.value).toBe(100);
    expect(fixed.previousStatus).toBe('breach');
    expect(fixed.point.revision).toBe(3);

    expect(e.events.map((ev) => ev.type)).toEqual([
      'metric.computed',
      'metric.breached', // entered breach
      'metric.computed', // recompute, still breach — no event storm
      'metric.computed',
      'metric.recovered', // breach → attained
    ]);
    expect(e.events.at(-1)).toMatchObject({ previousStatus: 'breach', status: 'attained', revision: 3 });

    // Three runs audited, one point row standing.
    expect(await e.store.queryRuns({ metric: 'booking-tat-sla' })).toHaveLength(3);
    expect(await e.store.queryPoints({ metric: 'booking-tat-sla' })).toHaveLength(1);
  });

  it('a throwing onEvent hook is swallowed — the run commits and onError is told', async () => {
    const e = env();
    const seen: EngineEvent[] = [];
    const hooks = {
      onEvent: (ev: EngineEvent) => {
        seen.push(ev);
        throw new Error('alerting webhook down');
      },
      onError: e.hooks.onError,
    };
    const outcome = await materialize(e, { hooks });

    // The computation committed despite every event hook throwing.
    expect(outcome.point.revision).toBe(1);
    expect(await e.store.queryPoints({ metric: 'booking-tat-sla' })).toHaveLength(1);
    expect((await e.store.queryRuns())[0]?.status).toBe('ok');

    // Both events were attempted; onError saw each failure.
    expect(seen.map((ev) => ev.type)).toEqual(['metric.computed', 'metric.breached']);
    expect(e.errors).toHaveLength(2);
    expect(e.errors[0]?.context).toMatchObject({ op: 'metric.computed', metric: 'booking-tat-sla' });
    expect(String(e.errors[0]?.err)).toContain('alerting webhook down');
  });

  it('a fetch error records a run with status error and writes NO point', async () => {
    const e = env();
    const broken: FactSourcePort = {
      fetchFacts: () => Promise.reject(new Error('connection refused: ops-db')),
    };
    await expect(materialize(e, { facts: { source: broken } })).rejects.toThrow(/connection refused/);

    expect(await e.store.queryPoints({ metric: 'booking-tat-sla' })).toEqual([]);
    const [run] = await e.store.queryRuns({ metric: 'booking-tat-sla' });
    expect(run).toMatchObject({
      status: 'error',
      trigger: 'manual',
      windowKey: 'week:2026-W33',
      scopeHash: APAC_HASH,
      error: 'connection refused: ops-db',
      trace: null,
    });
    expect(e.events).toEqual([]); // nothing computed, nothing announced
    expect(e.errors[0]?.context).toMatchObject({ op: 'materialize', metric: 'booking-tat-sla', runId: run?.id });
  });

  it('requires a window: neither windowAt nor resolvedWindow is a ConfigInvalidError', async () => {
    const e = env();
    await expect(materialize(e, { windowAt: undefined })).rejects.toThrowError(ConfigInvalidError);
  });

  it('no_data is transparent for alerting: breach → no_data → attained emits metric.recovered', async () => {
    const e = env();
    await materialize(e); // breach
    const gap = await materialize(e, { facts: { source: new MemoryFactSource([]) } }); // no facts → no_data
    expect(gap.result.status).toBe('no_data');
    const fixed = await materialize(e, { facts: { source: new MemoryFactSource(FIXED_EVENTS) } });

    expect(fixed.result.status).toBe('attained');
    expect(e.events.map((ev) => ev.type)).toEqual([
      'metric.computed',
      'metric.breached',
      'metric.computed', // the no_data gap announces nothing
      'metric.computed',
      'metric.recovered', // the standing breach recovered ACROSS the gap
    ]);
    expect(e.events.at(-1)).toMatchObject({ previousStatus: 'breach', status: 'attained' });
  });

  it('no_data is transparent for alerting: breach → no_data → breach does NOT re-emit metric.breached', async () => {
    const e = env();
    await materialize(e); // breach
    await materialize(e, { facts: { source: new MemoryFactSource([]) } }); // no_data
    await materialize(e); // breach again — the SAME standing breach

    expect(e.events.map((ev) => ev.type)).toEqual([
      'metric.computed',
      'metric.breached', // entered breach once
      'metric.computed',
      'metric.computed', // still the same breach — no event storm
    ]);
  });

  it('a persistence failure appends an error run, writes no point, and rethrows', async () => {
    const e = env();
    const failing = Object.create(e.store) as InMemoryMetricsStateStore;
    failing.persistMaterialization = () => Promise.reject(new Error('disk full'));
    await expect(materialize(e, { store: failing })).rejects.toThrow(/disk full/);

    expect(await e.store.queryPoints({ metric: 'booking-tat-sla' })).toEqual([]);
    const [run] = await e.store.queryRuns({ metric: 'booking-tat-sla' });
    expect(run).toMatchObject({ status: 'error', error: 'disk full', trace: null, windowKey: 'week:2026-W33' });
    expect(e.errors[0]?.context).toMatchObject({ op: 'materialize', metric: 'booking-tat-sla' });
    expect(e.events).toEqual([]); // nothing stored, nothing announced
  });

  it('verifyWrite=false aborts BEFORE anything is stored (write fencing)', async () => {
    const e = env();
    await expect(materialize(e, { verifyWrite: () => Promise.resolve(false) })).rejects.toThrowError(
      WriteAbortedError,
    );
    expect(await e.store.queryPoints({ metric: 'booking-tat-sla' })).toEqual([]);
    expect(await e.store.queryRuns({ metric: 'booking-tat-sla' })).toEqual([]);
    expect(e.events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Backfill — a backtest that persists
// ---------------------------------------------------------------------------

const DAILY_TAT: MetricDefinitionInput = {
  ...structuredClone(BOOKING_TAT),
  name: 'booking-tat-daily',
  window: { kind: 'periodic', grain: 'day' },
};

const RANGE = { fromIso: '2026-08-10T00:00:00Z', toIso: '2026-08-14T18:30:00Z' };
/** The (simulated) instant the backfill RUNS — after every window closed. */
const BACKFILL_NOW = '2026-08-15T09:00:00Z';

function backfill(e: Env, overrides: Record<string, unknown> = {}) {
  return backfillMetric({
    definitionVersion: versionRecord(DAILY_TAT),
    registry: REGISTRY,
    calendars: [CALENDAR],
    facts: { source: new MemoryFactSource(WORK_EVENTS) },
    scope: APAC,
    range: RANGE,
    nowIso: BACKFILL_NOW,
    store: e.store,
    hooks: e.hooks,
    logger: noopLogger,
    ...overrides,
  });
}

describe('backfillMetric', () => {
  it('persists five daily points with runs trigger backfill — the backtest series, stored', async () => {
    const e = env();
    const outcomes = await backfill(e);
    expect(outcomes).toHaveLength(5);

    const points = await e.store.queryPoints({ metric: 'booking-tat-daily', scopeHash: APAC_HASH });
    expect(points.map((p) => p.windowKey)).toEqual([
      'day:2026-08-10',
      'day:2026-08-11',
      'day:2026-08-12',
      'day:2026-08-13',
      'day:2026-08-14', // the holiday still yields a point, not a gap
    ]);
    // The M3 backtest series, now durable.
    expect(points.map((p) => p.value)).toEqual([50, null, 100, null, null]);
    expect(points.map((p) => p.status)).toEqual(['breach', 'no_data', 'attained', 'no_data', 'no_data']);
    expect(points.every((p) => p.revision === 1 && p.versionNo === 1)).toBe(true);
    // Each point EVALUATES as of its window end (deterministic replay) but is
    // STAMPED with the execution instant — retention must never age-prune a
    // fresh backfill's audit because of a historical window label.
    for (const p of points) expect(p.computedAtIso).toBe('2026-08-15T09:00:00.000Z');
    for (const o of outcomes) expect(o.result.trace.evaluatedAt).toBe(o.result.window.endIso);

    const runs = await e.store.queryRuns({ metric: 'booking-tat-daily', order: 'asc' });
    expect(runs).toHaveLength(5);
    expect(runs.every((r) => r.trigger === 'backfill' && r.status === 'ok')).toBe(true);
    expect(runs.every((r) => r.startedAtIso === '2026-08-15T09:00:00.000Z')).toBe(true);
    expect(runs.map((r) => r.windowKey).sort()).toEqual([...points.map((p) => p.windowKey)].sort());
  });

  it('never persists a still-open window: windows ending after nowIso are excluded', async () => {
    // Mid-range "now": only the windows that CLOSED by then materialize;
    // day:2026-08-12 is still open at 2026-08-12T05:00Z (IST day ends 18:30Z).
    const e = env();
    const outcomes = await backfill(e, { nowIso: AT });
    const points = await e.store.queryPoints({ metric: 'booking-tat-daily', scopeHash: APAC_HASH });
    expect(points.map((p) => p.windowKey)).toEqual(['day:2026-08-10', 'day:2026-08-11']);
    expect(outcomes).toHaveLength(2);
  });

  it('recomputing the same range bumps every revision (audit sees both passes)', async () => {
    const e = env();
    await backfill(e);
    const again = await backfill(e);
    expect(again.map((o) => o.point.revision)).toEqual([2, 2, 2, 2, 2]);
    expect(again.map((o) => o.previousStatus)).toEqual(['breach', 'no_data', 'attained', 'no_data', 'no_data']);
    expect(await e.store.queryPoints({ metric: 'booking-tat-daily' })).toHaveLength(5);
    expect(await e.store.queryRuns({ metric: 'booking-tat-daily' })).toHaveLength(10);
  });

  it('suppresses breach/recovered events by default — history must not page anyone', async () => {
    const e = env();
    await backfill(e);
    expect(e.events.map((ev) => ev.type)).toEqual(Array<string>(5).fill('metric.computed'));
    expect(e.events.every((ev) => ev.type !== 'metric.breached' && ev.type !== 'metric.recovered')).toBe(true);
  });

  it('emits them when EngineDefaults.backfillEmitsBreaches is true — the knob acts', async () => {
    const e = env();
    await backfill(e, { defaults: { backfillEmitsBreaches: true } });
    expect(e.events.map((ev) => ev.type)).toEqual([
      'metric.computed',
      'metric.breached', // day:2026-08-10 entered breach
      'metric.computed',
      'metric.computed',
      'metric.computed',
      'metric.computed',
    ]);
    expect(e.events[1]).toMatchObject({ windowKey: 'day:2026-08-10', trigger: 'backfill' });
  });

  it('snapshot-anchored definitions refuse fabricated history: closed windows backfill as no_data', async () => {
    // Backlog aging: rows are fetched AS OF NOW, so a window that closed
    // before the fetch instant would see today's backlog with age ~0 and
    // record a cheerful 'attained' that changes on every re-run. The
    // engine refuses: no_data points with an explicit trace note.
    const backlogAge: MetricDefinitionInput = {
      name: 'backlog-age-daily',
      kind: 'kpi',
      metricType: 'duration',
      scope: { dimensions: ['region'] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'snapshot' },
      target: { value: 600, direction: 'lower_is_better' },
      calendarRef: 'india-ops',
      derive: { ageMins: { fn: 'ageBusinessMinutes', args: ['createdAt'] } },
      formula: { kind: 'aggregate', over: { agg: 'avg', source: 'booking', field: 'ageMins' } },
    };
    const e = env();
    const outcomes = await backfill(e, { definitionVersion: versionRecord(backlogAge) });
    expect(outcomes).toHaveLength(5);

    const points = await e.store.queryPoints({ metric: 'backlog-age-daily', scopeHash: APAC_HASH });
    expect(points.every((p) => p.status === 'no_data' && p.value === null)).toBe(true);
    for (const o of outcomes) {
      expect(o.result.status).toBe('no_data');
      expect(o.result.trace.snapshotBackfill).toBe('window predates fetch instant');
      expect(o.result.trace.factsIn).toBe(0);
    }
    // The refusal is auditable, not an error: five ok runs, trigger backfill.
    const runs = await e.store.queryRuns({ metric: 'backlog-age-daily' });
    expect(runs).toHaveLength(5);
    expect(runs.every((r) => r.status === 'ok' && r.trace?.snapshotBackfill === 'window predates fetch instant')).toBe(
      true,
    );
  });
});
