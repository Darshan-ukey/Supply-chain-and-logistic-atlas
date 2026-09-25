/**
 * M5 engine facade e2e: construction (zod-validated options, memory + sqlite
 * descriptors), start() seeding, the full authoring → lifecycle → assignment
 * → evaluation loop, snapshot auto/live/points semantics pinned, scheduler
 * job refresh on lifecycle changes, describe()/jsonSchemas() shape, telemetry
 * wiring, stop() store-ownership semantics, and boundary zod rejections.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CalendarInput, MetricDefinitionInput, RegistryDocInput } from '../src/config/schemas.js';
import { ConfigInvalidError, ConflictError, NotFoundError } from '../src/domain/errors.js';
import { MetricsEngine, type SnapshotEntry } from '../src/engine.js';
import type { Clock } from '../src/ports/clock.js';
import { MemoryFactSource } from '../src/ports/factsource.js';
import type { EngineEvent } from '../src/ports/hooks.js';
import { noopLogger } from '../src/ports/logger.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';

// ---------------------------------------------------------------------------
// Fixture: the booking world
// ---------------------------------------------------------------------------

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'region', type: 'string', valueSet: 'regions' },
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
        { id: 'ref', type: 'string' },
        { id: 'teu', type: 'number' },
        { id: 'createdAt', type: 'date' },
      ],
    },
  ],
  valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
};

const CALENDAR: CalendarInput = {
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
};

/** Daily booking count per region — periodic, event-anchored, dimensioned. */
const REGIONAL_DAILY: MetricDefinitionInput = {
  name: 'regional-daily',
  kind: 'kpi',
  metricType: 'count',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'day' },
  anchor: { kind: 'event', field: 'createdAt' },
  target: { value: 1, direction: 'higher_is_better' },
  formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
};

/** Whole-entity daily count — dimensionless, always in every snapshot. */
const DAILY_TOTAL: MetricDefinitionInput = {
  ...structuredClone(REGIONAL_DAILY),
  name: 'daily-total',
  scope: { dimensions: [] },
};

const ROWS = [
  { region: 'APAC', status: 'confirmed', ref: 'MAEU1234567', createdAt: '2026-08-11T06:00:00Z' },
  { region: 'EMEA', status: 'confirmed', ref: 'HLCU7654321', createdAt: '2026-08-11T09:00:00Z' },
  { region: 'APAC', status: 'new', ref: 'TEST0000001', createdAt: '2026-08-12T01:00:00Z' },
];

class TestClock implements Clock {
  constructor(private t = Date.parse('2026-08-12T06:00:00Z')) {}
  now(): Date {
    return new Date(this.t);
  }
  set(iso: string): void {
    this.t = Date.parse(iso);
  }
}

interface Env {
  engine: MetricsEngine;
  clock: TestClock;
  events: EngineEvent[];
}

async function makeEngine(overrides: ConstructorParameters<typeof MetricsEngine>[0] = {}): Promise<Env> {
  const clock = new TestClock();
  const events: EngineEvent[] = [];
  const engine = new MetricsEngine({
    factSource: new MemoryFactSource(ROWS),
    clock,
    logger: noopLogger,
    hooks: { onEvent: (e) => void events.push(e) },
    ...overrides,
  });
  await engine.start();
  return { engine, clock, events };
}

async function seedActive(engine: MetricsEngine, def: MetricDefinitionInput): Promise<void> {
  await engine.createMetric(def, { actor: 'money' });
  await engine.submit(def.name, { actor: 'money' });
  await engine.activate(def.name, { actor: 'priya' });
}

const TMP = mkdtempSync(join(tmpdir(), 'malkom-metrics-engine-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
// Construction & discovery
// ---------------------------------------------------------------------------

describe('construction and discovery', () => {
  it('rejects malformed options with 422s at construction', () => {
    expect(() => new MetricsEngine({ state: { kind: 'bogus' } as never })).toThrow(ConfigInvalidError);
    expect(() => new MetricsEngine({ scheduler: { enabled: 'yes' } as never })).toThrow(ConfigInvalidError);
    expect(() => new MetricsEngine({ auth: { adminKeys: 'not-a-list' } as never })).toThrow(ConfigInvalidError);
    expect(() => new MetricsEngine({ defaults: { maxFactRows: -1 } })).toThrow(ConfigInvalidError);
    expect(() => new MetricsEngine({ instanceId: '' })).toThrow(ConfigInvalidError);
  });

  it('describe() reports engine identity, capabilities (incl. matches) and registry state', async () => {
    const { engine } = await makeEngine();
    const doc = engine.describe();
    expect(doc['engine']).toBe('malkom-processmetrics-engine');
    expect(doc['version']).toBe('0.1.0');
    expect(doc['schemaVersion']).toBe(1);
    const caps = doc['capabilities'] as Record<string, unknown>;
    expect(caps['operators']).toContain('matches');
    expect(caps['aggregations']).toContain('p95');
    expect(caps['grains']).toEqual(['day', 'week', 'month', 'quarter']);
    expect(caps['snapshotModes']).toEqual(['auto', 'live', 'points']);
    expect(doc['registry']).toBeNull();

    await engine.applyRegistry(REGISTRY);
    const after = engine.describe();
    const reg = after['registry'] as { version: number; entities: Array<{ id: string; fields: string[] }> };
    expect(reg.version).toBe(1);
    expect(reg.entities[0]?.id).toBe('booking');
    expect(reg.entities[0]?.fields).toContain('region');
    await engine.stop();
  });

  it('jsonSchemas() serves every config document schema', async () => {
    const { engine } = await makeEngine();
    expect(Object.keys(engine.jsonSchemas()).sort()).toEqual([
      'assignment',
      'calendar',
      'connection-profile',
      'engine-defaults',
      'metric-definition',
      'registry-doc',
    ]);
    await engine.stop();
  });

  it('refuses operations before start() and before a registry is applied', async () => {
    const engine = new MetricsEngine({ logger: noopLogger });
    await expect(engine.listMetrics()).rejects.toThrow(/not started/);
    await engine.start();
    await expect(engine.createMetric(REGIONAL_DAILY, { actor: 'money' })).rejects.toThrow(/no registry applied/);
    await engine.stop();
  });
});

// ---------------------------------------------------------------------------
// The full loop (memory store)
// ---------------------------------------------------------------------------

describe('full loop: registry → calendar → author → lifecycle → assign → evaluate', () => {
  it('runs end-to-end with pinned values and telemetry', async () => {
    const { engine, events, clock } = await makeEngine();

    // Registry: apply, then a byte-identical re-apply is a version no-op.
    expect(await engine.applyRegistry(REGISTRY)).toMatchObject({ version: 1 });
    expect(await engine.applyRegistry(structuredClone(REGISTRY))).toMatchObject({ version: 1 });
    expect((await engine.getRegistry())?.version).toBe(1);

    // Calendar upsert is content-hash versioned.
    const cal = await engine.upsertCalendar(CALENDAR);
    expect(cal.version).toBe(1);
    expect((await engine.upsertCalendar(structuredClone(CALENDAR))).version).toBe(1);
    expect((await engine.listCalendars()).map((c) => c.name)).toEqual(['india-ops']);

    // Author: create is a draft; duplicates conflict; tier-1 verdict stamped.
    const head = await engine.createMetric(REGIONAL_DAILY, { actor: 'money' });
    expect(head.state).toBe('draft');
    expect(head.validationStatus).toBe('valid');
    await expect(engine.createMetric(REGIONAL_DAILY, { actor: 'money' })).rejects.toThrow(ConflictError);

    // Validation verdicts (never throwing).
    expect(await engine.validateMetric('regional-daily')).toMatchObject({ ok: true, schematic: 'skipped-not-requested' });
    const broken = structuredClone(REGIONAL_DAILY);
    (broken.formula as { over: { source: string } }).over.source = 'nope';
    const verdict = await engine.validateMetric(broken);
    expect(verdict.ok).toBe(false);
    expect(verdict.issues).toContainEqual(expect.objectContaining({ path: 'formula.over.source', code: 'unknown_source' }));

    // Lifecycle: draft → pending → active, actor-stamped.
    await engine.submit('regional-daily', { actor: 'money' });
    const { head: active, version } = await engine.activate('regional-daily', { actor: 'priya' });
    expect(active.state).toBe('active');
    expect(version.versionNo).toBe(1);
    expect(version.registryVersion).toBe(1);
    expect((await engine.listMetricVersions('regional-daily')).length).toBe(1);
    expect(events.map((e) => e.type)).toContain('definition.activated');

    // Assignments: tier-1 gated.
    const apac = await engine.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });
    await engine.assign({ metric: 'regional-daily', scope: { region: 'EMEA' } });
    expect((await engine.listAssignments({ metric: 'regional-daily' })).length).toBe(2);
    await expect(engine.assign({ metric: 'regional-daily', scope: { planet: 'MARS' } })).rejects.toThrow(
      ConfigInvalidError,
    );

    // calculate: on-demand, no persistence. Clock is 2026-08-12T06:00Z; one
    // APAC booking on the 12th (UTC day window).
    const result = await engine.calculate({ metric: 'regional-daily', scope: { region: 'APAC' } });
    expect(result.value).toBe(1);
    expect(result.window.key).toBe('day:2026-08-12');
    expect(result.status).toBe('attained');
    expect((await engine.queryPoints({ metric: 'regional-daily' })).length).toBe(0); // nothing persisted

    // backtest: draft replay over a range, one result per day window.
    const replay = await engine.backtest({
      metric: 'regional-daily',
      scope: { region: 'APAC' },
      range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-13T00:00:00Z' },
    });
    expect(replay.map((r) => [r.window.key, r.value])).toEqual([
      ['day:2026-08-11', 1],
      ['day:2026-08-12', 1],
    ]);

    // backfill: persists a point per (window × active assignment slice) —
    // run AFTER both day windows closed (backfill only persists CLOSED windows).
    clock.set('2026-08-13T00:10:00Z');
    const report = await engine.backfill({
      metric: 'regional-daily',
      range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-13T00:00:00Z' },
    });
    expect(report.slices).toBe(2);
    expect(report.points.length).toBe(4);
    expect(report.versionNo).toBe(1);

    // series: stored points only, ordered ascending.
    const series = await engine.series({
      metric: 'regional-daily',
      scope: { region: 'APAC' },
      fromIso: '2026-08-11T00:00:00Z',
      toIso: '2026-08-13T00:00:00Z',
    });
    expect(series.map((p) => [p.windowKey, p.value])).toEqual([
      ['day:2026-08-11', 1],
      ['day:2026-08-12', 1],
    ]);

    // runs audit: 4 backfill runs, all ok.
    const runs = await engine.queryRuns({ metric: 'regional-daily', trigger: 'backfill' });
    expect(runs.length).toBe(4);
    expect(runs.every((r) => r.status === 'ok')).toBe(true);

    // Telemetry rode along on the event stream.
    const counters = (engine.telemetry.toJSON() as { counters: Record<string, number> }).counters;
    expect(counters['malkom_metrics_points_total']).toBe(4);
    expect(counters['malkom_metrics_runs_total{status="ok",trigger="backfill"}']).toBe(4);
    expect(counters['malkom_metrics_activations_total']).toBe(1);

    // Data plane guard rails.
    await expect(engine.deletePoints({})).rejects.toThrow(/unfiltered/);
    expect(await engine.deletePoints({ metric: 'regional-daily' })).toBe(4); // metric alone deletes all its points
    expect((await engine.queryPoints({ metric: 'regional-daily' })).length).toBe(0);
    expect(typeof (await engine.pruneRuns())).toBe('number');

    // Retire: the head stops pointing at a version; versions stay readable.
    const retired = await engine.retire('regional-daily', { actor: 'priya', reason: 'sunset' });
    expect(retired.state).toBe('retired');
    expect(retired.activeVersion).toBeNull();
    expect((await engine.listMetricVersions('regional-daily')).length).toBe(1);

    await engine.stop();

    // scopeHash of the assignment matched the points it produced.
    expect(report.points.filter((p) => p.scopeHash === apac.scopeHash).length).toBe(2);
  });

  it('snapshot: auto serves stored points for the current window, else live; points mode never computes', async () => {
    const { engine, clock } = await makeEngine();
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, REGIONAL_DAILY);
    await seedActive(engine, DAILY_TOTAL);
    await engine.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });
    await engine.assign({ metric: 'regional-daily', scope: { region: 'EMEA' } });

    const byKey = (entries: SnapshotEntry[]): Record<string, SnapshotEntry> =>
      Object.fromEntries(entries.map((e) => [`${e.metric}@${JSON.stringify(e.scope)}`, e]));

    // No stored points yet: auto computes live for every matching slice —
    // both assignments plus the dimensionless definition.
    const live = byKey(await engine.snapshot());
    expect(Object.keys(live).sort()).toEqual([
      'daily-total@{}',
      'regional-daily@{"region":"APAC"}',
      'regional-daily@{"region":"EMEA"}',
    ]);
    expect(live['daily-total@{}']).toMatchObject({ source: 'live', value: 1, status: 'attained' });
    expect(live['regional-daily@{"region":"APAC"}']).toMatchObject({ source: 'live', value: 1 });
    expect(live['regional-daily@{"region":"EMEA"}']).toMatchObject({ source: 'live', value: 0, status: 'breach' });
    expect(live['daily-total@{}']?.trace).toBeDefined(); // live entries carry the replay trace

    // The scope filter narrows dimensioned slices; dimensionless stays.
    const apacOnly = byKey(await engine.snapshot({ scope: { region: 'APAC' } }));
    expect(Object.keys(apacOnly).sort()).toEqual(['daily-total@{}', 'regional-daily@{"region":"APAC"}']);

    // points mode with an empty store: nothing to serve, nothing computed.
    expect(await engine.snapshot({ mode: 'points' })).toEqual([]);

    // Backfill the 08-12 day window for the APAC slice only — AFTER it
    // closed (backfill refuses still-open windows), then step the clock back
    // so 08-12 is the snapshot's current window again.
    clock.set('2026-08-13T00:10:00Z');
    await engine.backfill({
      metric: 'regional-daily',
      scope: { region: 'APAC' },
      range: { fromIso: '2026-08-12T00:00:00Z', toIso: '2026-08-13T00:00:00Z' },
    });
    clock.set('2026-08-12T06:00:00Z');

    // auto: the APAC slice now serves the stored point (windowKey matches);
    // everything else still computes live.
    const auto = byKey(await engine.snapshot());
    expect(auto['regional-daily@{"region":"APAC"}']).toMatchObject({
      source: 'point',
      value: 1,
      revision: 1,
      versionNo: 1,
    });
    expect(auto['regional-daily@{"region":"APAC"}']?.trace).toBeUndefined(); // stored points carry no trace
    expect(auto['regional-daily@{"region":"EMEA"}']?.source).toBe('live');
    expect(auto['daily-total@{}']?.source).toBe('live');

    // live mode ignores the store even when a point exists.
    const forced = byKey(await engine.snapshot({ mode: 'live' }));
    expect(forced['regional-daily@{"region":"APAC"}']?.source).toBe('live');

    // points mode serves ONLY what the store has for the current window.
    const points = await engine.snapshot({ mode: 'points' });
    expect(points.length).toBe(1);
    expect(points[0]).toMatchObject({ metric: 'regional-daily', source: 'point', scopeHash: expect.any(String) });

    // A stale point (yesterday's windowKey) is never served by auto.
    const stale = byKey(await engine.snapshot({ at: '2026-08-13T06:00:00Z' }));
    expect(stale['regional-daily@{"region":"APAC"}']?.source).toBe('live');
    expect(stale['regional-daily@{"region":"APAC"}']?.window.key).toBe('day:2026-08-13');

    await engine.stop();
  });

  it('boundary zod rejection: every mutation validates its input', async () => {
    const { engine } = await makeEngine();
    await engine.applyRegistry(REGISTRY);

    await expect(engine.applyRegistry({ entities: [{ id: 'x' }] } as never)).rejects.toThrow(ConfigInvalidError);
    await expect(engine.upsertCalendar({ name: 'x' } as never)).rejects.toThrow(ConfigInvalidError);
    await expect(engine.createMetric({ name: 'junk' } as never, { actor: 'a' })).rejects.toThrow(ConfigInvalidError);
    await expect(engine.createMetric(REGIONAL_DAILY, { actor: '' })).rejects.toThrow(ConfigInvalidError);
    await expect(engine.calculate({} as never)).rejects.toThrow(ConfigInvalidError);
    await expect(engine.calculate({ metric: 'regional-daily', at: 'yesterday' })).rejects.toThrow(
      ConfigInvalidError,
    );
    await expect(engine.snapshot({ mode: 'bogus' } as never)).rejects.toThrow(ConfigInvalidError);
    await expect(engine.series({ metric: 'm', fromIso: 'x', toIso: 'y' })).rejects.toThrow(ConfigInvalidError);
    await expect(engine.queryPoints({ metric: 'm', grain: 'fortnight' as never })).rejects.toThrow(
      ConfigInvalidError,
    );
    await expect(engine.queryRuns({ status: 'meh' } as never)).rejects.toThrow(ConfigInvalidError);
    await expect(engine.unassign('nope')).rejects.toThrow(NotFoundError);
    await expect(engine.getMetric('nope')).rejects.toThrow(NotFoundError);
    await expect(engine.getCalendar('nope')).rejects.toThrow(NotFoundError);

    // The structured issues carry exact paths for builder UIs.
    try {
      await engine.calculate({} as never);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigInvalidError);
      expect((err as ConfigInvalidError).issues[0]?.path).toBe('metric');
    }
    await engine.stop();
  });
});

// ---------------------------------------------------------------------------
// Facade guard rails (review-hardening regressions)
// ---------------------------------------------------------------------------

describe('facade guard rails', () => {
  it('calculate and snapshot refuse unknown scope keys — a typo must never fabricate a value-0 breach', async () => {
    const { engine } = await makeEngine();
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, REGIONAL_DAILY);
    await engine.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });

    // The typo'd key ('Region') used to silently match no rows → count 0.
    try {
      await engine.calculate({ metric: 'regional-daily', scope: { Region: 'APAC' } });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigInvalidError);
      expect((err as ConfigInvalidError).issues[0]?.path).toBe('scope.Region');
    }
    await expect(engine.snapshot({ scope: { Region: 'APAC' } })).rejects.toThrow(ConfigInvalidError);
    await expect(
      engine.backtest({ metric: 'regional-daily', scope: { Region: 'APAC' }, range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-12T00:00:00Z' } }),
    ).rejects.toThrow(ConfigInvalidError);
    await expect(
      engine.backfill({ metric: 'regional-daily', scope: { Region: 'APAC' }, range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-12T00:00:00Z' } }),
    ).rejects.toThrow(ConfigInvalidError);

    // Valid keys — including the PARTIAL scope {} — keep working.
    expect((await engine.calculate({ metric: 'regional-daily', scope: { region: 'APAC' } })).value).toBe(1);
    expect((await engine.calculate({ metric: 'regional-daily', scope: {} })).value).toBe(1); // subset = coarser slice
    expect((await engine.snapshot({ scope: { region: 'APAC' } })).length).toBeGreaterThan(0);
    await engine.stop();
  });

  it('boundary instants require an explicit timezone — zone-less datetimes are host-dependent', async () => {
    const { engine } = await makeEngine();
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, REGIONAL_DAILY);

    try {
      await engine.calculate({ metric: 'regional-daily', at: '2026-08-12T00:00:00' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigInvalidError);
      expect((err as ConfigInvalidError).issues[0]).toMatchObject({
        path: 'at',
        message: expect.stringContaining('explicit timezone') as string,
      });
    }
    // An offset form names an unambiguous instant and is accepted.
    const offset = await engine.calculate({ metric: 'regional-daily', at: '2026-08-12T11:30:00+05:30' });
    expect(offset.window.key).toBe('day:2026-08-12'); // 06:00Z
    await expect(
      engine.series({ metric: 'regional-daily', fromIso: '2026-08-11T00:00:00', toIso: '2026-08-12T00:00:00Z' }),
    ).rejects.toThrow(ConfigInvalidError);
    await engine.stop();
  });

  it('a clean draft edit cannot hide a broken ACTIVE version — the worse verdict wins', async () => {
    const { engine } = await makeEngine();
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, REGIONAL_DAILY);

    // The registry drifts: `region` disappears → the ACTIVE version breaks.
    const drifted = structuredClone(REGISTRY);
    drifted.entities![0]!.fields = drifted.entities![0]!.fields!.filter((f) => (f as { id: string }).id !== 'region');
    await engine.applyRegistry(drifted);
    expect((await engine.getMetric('regional-daily')).validationStatus).toBe('broken');

    // Editing the draft to something CLEAN under the new registry must not
    // repaint the head green — version 1 is still computing with `region`.
    const dimensionless = { ...structuredClone(REGIONAL_DAILY), scope: { dimensions: [] } };
    const head = await engine.updateMetric('regional-daily', dimensionless, { actor: 'money' });
    expect(head.state).toBe('draft');
    expect(head.activeVersion).toBe(1);
    expect(head.validationStatus).toBe('broken'); // worse-of(draft valid, active broken)
    await engine.stop();
  });

  it('activation validates against the registry as the STORE has it, not a stale cache', async () => {
    const store = new InMemoryMetricsStateStore();
    const a = new MetricsEngine({ state: store, closeStateStoreOnStop: false, logger: noopLogger, clock: new TestClock() });
    const b = new MetricsEngine({
      state: store,
      closeStateStoreOnStop: false,
      logger: noopLogger,
      clock: new TestClock(),
      factSource: new MemoryFactSource(ROWS),
    });
    await a.start();
    await a.applyRegistry(REGISTRY);
    await b.start(); // b caches registry v1

    await b.createMetric(REGIONAL_DAILY, { actor: 'money' });
    await b.submit('regional-daily', { actor: 'money' });

    // Instance A advances the registry BEHIND b's cache: `region` is gone.
    const drifted = structuredClone(REGISTRY);
    drifted.entities![0]!.fields = drifted.entities![0]!.fields!.filter((f) => (f as { id: string }).id !== 'region');
    await a.applyRegistry(drifted);

    // b's activation gate must re-read the store and refuse — validating
    // against its stale v1 cache would activate a broken definition.
    await expect(b.activate('regional-daily', { actor: 'priya' })).rejects.toThrow(/blocked by tier-1/);
    await a.stop();
    await b.stop();
    await store.close();
  });

  it('snapshot auto treats a point computed BEFORE its window closed as partial and recomputes live', async () => {
    const store = new InMemoryMetricsStateStore();
    const { engine } = await makeEngine({ state: store, closeStateStoreOnStop: false });
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, REGIONAL_DAILY);
    const apac = await engine.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });

    // A point for the CURRENT window, stamped mid-window (partial value 42).
    const partial = {
      metric: 'regional-daily',
      versionNo: 1,
      scopeHash: apac.scopeHash,
      scope: { region: 'APAC' },
      windowKey: 'day:2026-08-12',
      windowStartIso: '2026-08-12T00:00:00.000Z',
      windowEndIso: '2026-08-13T00:00:00.000Z',
      grain: 'day' as const,
      value: 42,
      numerator: null,
      denominator: null,
      targetValue: 1,
      status: 'attained' as const,
      computedAtIso: '2026-08-12T03:00:00.000Z', // before the window's end
      runId: 'seed-partial',
    };
    await store.upsertPoint(partial);

    const viaAuto = (await engine.snapshot()).find((e) => e.scopeHash === apac.scopeHash)!;
    expect(viaAuto.source).toBe('live'); // the partial point is NOT authoritative
    expect(viaAuto.value).toBe(1); // the real live value, not the stale 42

    // 'points' mode is an explicit raw store read — it serves what is there.
    const viaPoints = (await engine.snapshot({ mode: 'points' })).find((e) => e.scopeHash === apac.scopeHash)!;
    expect(viaPoints).toMatchObject({ source: 'point', value: 42 });

    // Once the point is re-stamped at/after close it becomes authoritative.
    await store.upsertPoint({ ...partial, computedAtIso: '2026-08-13T00:05:00.000Z', runId: 'seed-final' });
    const served = (await engine.snapshot()).find((e) => e.scopeHash === apac.scopeHash)!;
    expect(served).toMatchObject({ source: 'point', value: 42 });
    await engine.stop();
    await store.close();
  });
});

// ---------------------------------------------------------------------------
// Scheduler wiring
// ---------------------------------------------------------------------------

describe('scheduler wiring', () => {
  it('activate/assign/retire refresh the job set when enabled', async () => {
    const { engine } = await makeEngine({ scheduler: { enabled: true } });
    await engine.applyRegistry(REGISTRY);
    expect(engine.schedulerJobs()).toEqual([]);

    // Dimensionless: one job (the empty scope) as soon as it activates.
    await seedActive(engine, DAILY_TOTAL);
    expect(engine.schedulerJobs().map((j) => j.metric)).toEqual(['daily-total']);

    // Dimensioned: no jobs until assignments name the slices.
    await seedActive(engine, REGIONAL_DAILY);
    expect(engine.schedulerJobs().map((j) => j.metric)).toEqual(['daily-total']);
    await engine.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });
    await engine.assign({ metric: 'regional-daily', scope: { region: 'EMEA' } });
    expect(engine.schedulerJobs().length).toBe(3);

    // Unassign and retire shrink the job set.
    const emea = (await engine.listAssignments({ metric: 'regional-daily' })).find(
      (a) => a.scope['region'] === 'EMEA',
    )!;
    await engine.unassign(emea.id);
    expect(engine.schedulerJobs().length).toBe(2);
    await engine.retire('regional-daily', { actor: 'priya' });
    expect(engine.schedulerJobs().map((j) => j.metric)).toEqual(['daily-total']);

    await engine.stop();
    expect(engine.schedulerJobs()).toEqual([]);
  });

  it('stays disabled by default — no jobs even with active definitions', async () => {
    const { engine } = await makeEngine();
    await engine.applyRegistry(REGISTRY);
    await seedActive(engine, DAILY_TOTAL);
    expect(engine.schedulerJobs()).toEqual([]);
    expect((engine.describe()['scheduler'] as { enabled: boolean }).enabled).toBe(false);
    await engine.stop();
  });
});

// ---------------------------------------------------------------------------
// Store ownership & sqlite persistence
// ---------------------------------------------------------------------------

class ClosableStore extends InMemoryMetricsStateStore {
  closed = false;
  override async close(): Promise<void> {
    this.closed = true;
  }
}

describe('store ownership and sqlite', () => {
  it('stop() closes the store by default; closeStateStoreOnStop: false leaves it open', async () => {
    const owned = new ClosableStore();
    const e1 = new MetricsEngine({ state: owned, logger: noopLogger });
    await e1.start();
    await e1.stop();
    expect(owned.closed).toBe(true);

    const shared = new ClosableStore();
    const e2 = new MetricsEngine({ state: shared, closeStateStoreOnStop: false, logger: noopLogger });
    await e2.start();
    await e2.stop();
    expect(shared.closed).toBe(false);
  });

  it('sqlite descriptor: start seeds tables, state survives restart', async () => {
    const path = join(TMP, 'engine-e2e.db');
    const firstClock = new TestClock();
    const first = new MetricsEngine({
      state: { kind: 'sqlite', path },
      factSource: new MemoryFactSource(ROWS),
      clock: firstClock,
      logger: noopLogger,
    });
    await first.start();
    await first.applyRegistry(REGISTRY);
    await first.upsertCalendar(CALENDAR);
    await seedActive(first, REGIONAL_DAILY);
    await first.assign({ metric: 'regional-daily', scope: { region: 'APAC' } });
    firstClock.set('2026-08-13T00:10:00Z'); // both day windows have closed
    await first.backfill({
      metric: 'regional-daily',
      scope: { region: 'APAC' },
      range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-13T00:00:00Z' },
    });
    await first.stop();

    const second = new MetricsEngine({
      state: { kind: 'sqlite', path },
      factSource: new MemoryFactSource(ROWS),
      clock: new TestClock(),
      logger: noopLogger,
    });
    await second.start();
    expect((await second.getRegistry())?.version).toBe(1);
    expect((await second.getMetric('regional-daily')).state).toBe('active');
    expect((await second.listCalendars()).length).toBe(1);
    const points = await second.queryPoints({ metric: 'regional-daily' });
    expect(points.length).toBe(2);
    // Snapshot auto immediately serves the persisted current-window point.
    const entries = await second.snapshot();
    expect(entries.find((e) => e.scope['region'] === 'APAC')?.source).toBe('point');
    await second.stop();
  });
});
