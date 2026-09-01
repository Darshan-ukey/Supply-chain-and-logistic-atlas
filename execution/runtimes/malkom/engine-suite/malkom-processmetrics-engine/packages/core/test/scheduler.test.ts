/**
 * M4 rollup scheduler: job enumeration (active versions × active
 * assignments; empty-dimension definitions materialize scope {}; dimensioned
 * definitions without assignments materialize nothing; rolling windows are
 * never scheduled), the manually-triggered tick path over an injectable
 * Clock, cross-instance lease contention with a fencing token, the
 * grain-aware previous-window helper (incl. the IST/UTC day-boundary edge),
 * custom rollupCrons overrides, and one real-croner smoke test with unref
 * asserted.
 */
import { describe, expect, it } from 'vitest';
import { resolveDefaults } from '../src/config/defaults.js';
import {
  assignmentSchema,
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type Calendar,
  type MetricDefinition,
  type RegistryDocInput,
} from '../src/config/schemas.js';
import { NotFoundError } from '../src/domain/errors.js';
import { contentHash, CompiledRegistry } from '../src/domain/registry.js';
import type { Clock } from '../src/ports/clock.js';
import { MemoryFactSource, type FactQuery, type FactSourcePort } from '../src/ports/factsource.js';
import type { EngineEvent } from '../src/ports/hooks.js';
import { noopLogger } from '../src/ports/logger.js';
import type { MetricsStateStore } from '../src/ports/statestore.js';
import { compileCalendar } from '../src/runtime/calendar.js';
import { activateDefinition, submitDefinition } from '../src/runtime/lifecycle.js';
import { previousWindow, rollupLeaseKey, RollupScheduler, weekCronFor } from '../src/runtime/scheduler.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const REGISTRY_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'region', type: 'string' },
        { id: 'createdAt', type: 'date' },
      ],
    },
  ],
};
const REGISTRY = new CompiledRegistry(registryDocSchema.parse(REGISTRY_INPUT), 1);

const IST_CAL: Calendar = calendarSchema.parse({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
});

function countDef(
  name: string,
  dims: string[],
  window: Record<string, unknown> = { kind: 'periodic', grain: 'day' },
  calendarRef?: string,
): MetricDefinition {
  return metricDefinitionSchema.parse({
    name,
    kind: 'kpi',
    metricType: 'count',
    scope: { dimensions: dims },
    window,
    anchor: { kind: 'event', field: 'createdAt' },
    target: { value: 1, direction: 'higher_is_better' },
    formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
    ...(calendarRef !== undefined ? { calendarRef } : {}),
  });
}

/** Two bookings on 2026-08-11 UTC (one APAC, one EMEA), one on 08-12. */
const ROWS = [
  { region: 'APAC', createdAt: '2026-08-11T06:00:00Z' },
  { region: 'EMEA', createdAt: '2026-08-11T09:00:00Z' },
  { region: 'APAC', createdAt: '2026-08-12T01:00:00Z' },
];

class TestClock implements Clock {
  constructor(private t = Date.parse('2026-08-12T00:05:00Z')) {}
  now(): Date {
    return new Date(this.t);
  }
  set(iso: string): void {
    this.t = Date.parse(iso);
  }
}

const EMPTY_HASH = contentHash({});
const T = (n: number): string => new Date(Date.UTC(2026, 7, 1, 0, n)).toISOString();

async function seedActive(store: MetricsStateStore, def: MetricDefinition, n: number): Promise<void> {
  await store.saveDefinitionDraft(def, T(n));
  await submitDefinition(store, def.name, { actor: 'money', now: T(n + 1), logger: noopLogger });
  await activateDefinition(store, def.name, REGISTRY, { actor: 'priya', now: T(n + 2), logger: noopLogger });
}

interface Env {
  store: InMemoryMetricsStateStore;
  clock: TestClock;
  events: EngineEvent[];
  scheduler: RollupScheduler;
}

async function makeScheduler(
  store: InMemoryMetricsStateStore,
  overrides: Partial<ConstructorParameters<typeof RollupScheduler>[0]> = {},
): Promise<Env> {
  const clock = (overrides.clock as TestClock | undefined) ?? new TestClock();
  const events: EngineEvent[] = [];
  const scheduler = new RollupScheduler({
    store,
    registry: REGISTRY,
    calendars: [IST_CAL],
    facts: { source: new MemoryFactSource(ROWS) },
    hooks: { onEvent: (e) => void events.push(e) },
    clock,
    logger: noopLogger,
    instanceId: 'sched-a',
    ...overrides,
  });
  await scheduler.start();
  return { store, clock, events, scheduler };
}

describe('job enumeration', () => {
  it('schedules active versions × active assignments; empty dims get the empty scope', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await store.upsertCalendar(IST_CAL, T(0));
    await seedActive(store, countDef('daily-total', []), 1); // dimensionless
    await seedActive(store, countDef('regional-daily', ['region']), 4); // dimensioned
    await seedActive(store, countDef('rolling-7d', [], { kind: 'rolling', length: 7, unit: 'day' }), 7);
    await store.saveDefinitionDraft(countDef('never-activated', []), T(10)); // draft only

    await store.putAssignment(assignmentSchema.parse({ metric: 'regional-daily', scope: { region: 'APAC' } }), T(11));
    await store.putAssignment(assignmentSchema.parse({ metric: 'regional-daily', scope: { region: 'EMEA' } }), T(11));
    await store.putAssignment(
      assignmentSchema.parse({ metric: 'regional-daily', scope: { region: 'AMER' }, active: false }),
      T(11),
    );

    const { scheduler } = await makeScheduler(store);
    const jobs = scheduler.jobs().map((j) => `${j.metric}@${JSON.stringify(j.scope)}`);
    expect(jobs.sort()).toEqual([
      'daily-total@{}', // empty dims materialize the empty scope, no assignment needed
      'regional-daily@{"region":"APAC"}',
      'regional-daily@{"region":"EMEA"}',
      // rolling-7d: never scheduled; never-activated: no active version;
      // AMER: inactive assignment.
    ]);
    await scheduler.stop();
    expect(scheduler.jobs()).toEqual([]); // stop() cancels everything
    await store.close();
  });

  it('a dimensioned definition WITHOUT assignments materializes nothing', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('regional-daily', ['region']), 1);
    const { scheduler } = await makeScheduler(store);
    expect(scheduler.jobs()).toEqual([]);
    await expect(scheduler.tick('regional-daily', EMPTY_HASH)).rejects.toThrowError(NotFoundError);
    await scheduler.stop();
    await store.close();
  });

  it('refresh() re-reads active versions and assignments', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('regional-daily', ['region']), 1);
    const { scheduler } = await makeScheduler(store);
    expect(scheduler.jobs()).toEqual([]);

    await store.putAssignment(assignmentSchema.parse({ metric: 'regional-daily', scope: { region: 'APAC' } }), T(5));
    await scheduler.refresh();
    expect(scheduler.jobs()).toHaveLength(1);
    expect(scheduler.jobs()[0]).toMatchObject({ metric: 'regional-daily', scope: { region: 'APAC' }, grain: 'day' });
    await scheduler.stop();
    await store.close();
  });

  it('cron string and timezone: documented defaults, calendar tz, and overrides — as handed to croner', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await store.upsertCalendar(IST_CAL, T(0));
    await seedActive(store, countDef('daily-total', []), 1); // no calendar → default tz
    await seedActive(store, countDef('ist-weekly', [], { kind: 'periodic', grain: 'week' }, 'india-ops'), 4);

    const stock = await makeScheduler(store);
    const daily = stock.scheduler.jobs().find((j) => j.metric === 'daily-total')!;
    const weekly = stock.scheduler.jobs().find((j) => j.metric === 'ist-weekly')!;
    expect(daily).toMatchObject({ cron: '5 0 * * *', timezone: 'UTC' });
    expect(weekly).toMatchObject({ cron: '10 0 * * 1', timezone: 'Asia/Kolkata' });
    // The croner instance really carries them.
    expect(stock.scheduler.cronFor('daily-total', EMPTY_HASH)?.getPattern()).toBe('5 0 * * *');
    expect(stock.scheduler.cronFor('ist-weekly', EMPTY_HASH)?.options.timezone).toBe('Asia/Kolkata');
    await stock.scheduler.stop();

    const custom = await makeScheduler(store, {
      defaults: { rollupCrons: { day: '30 1 * * *' }, defaultTimezone: 'America/New_York' },
    });
    const overridden = custom.scheduler.jobs().find((j) => j.metric === 'daily-total')!;
    expect(overridden).toMatchObject({ cron: '30 1 * * *', timezone: 'America/New_York' });
    expect(custom.scheduler.cronFor('daily-total', EMPTY_HASH)?.getPattern()).toBe('30 1 * * *');
    expect(custom.scheduler.jobs().find((j) => j.metric === 'ist-weekly')?.cron).toBe('10 0 * * 1'); // sibling default intact
    await custom.scheduler.stop();
    await store.close();
  });
});

describe('ticks (injectable clock, no cron sleeping)', () => {
  it('a tick materializes the JUST-CLOSED window as trigger scheduled', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const { scheduler, events, clock } = await makeScheduler(store);
    clock.set('2026-08-12T00:05:00Z'); // the day-05 cron instant, UTC

    expect(await scheduler.tick('daily-total', EMPTY_HASH)).toBe('ok');

    const [point] = await store.queryPoints({ metric: 'daily-total' });
    expect(point).toMatchObject({
      windowKey: 'day:2026-08-11', // yesterday, not today
      windowStartIso: '2026-08-11T00:00:00.000Z',
      windowEndIso: '2026-08-12T00:00:00.000Z',
      scope: {},
      scopeHash: EMPTY_HASH,
      value: 2, // the two 08-11 bookings; the 08-12 one is out of window
      revision: 1,
      computedAtIso: '2026-08-12T00:05:00.000Z',
    });
    const [run] = await store.queryRuns({ metric: 'daily-total' });
    expect(run).toMatchObject({ trigger: 'scheduled', status: 'ok', windowKey: 'day:2026-08-11' });
    expect(events.map((e) => e.type)).toContain('metric.computed');

    // The lease was released and its fencing token survives for the next bump.
    const lease = JSON.parse((await store.get(rollupLeaseKey('daily-total', EMPTY_HASH)))!) as {
      token: number;
      expiresAtMs: number;
    };
    expect(lease).toMatchObject({ token: 1, expiresAtMs: 0 });
    expect(await scheduler.tick('daily-total', EMPTY_HASH)).toBe('ok'); // re-tick: revision 2, token 2
    expect((await store.queryPoints({ metric: 'daily-total' }))[0]?.revision).toBe(2);
    expect(JSON.parse((await store.get(rollupLeaseKey('daily-total', EMPTY_HASH)))!).token).toBe(2);
    await scheduler.stop();
    await store.close();
  });

  it('assignment scopes flow into the tick — scope, scopeHash and targetOverride', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('regional-daily', ['region']), 1);
    const apac = await store.putAssignment(
      assignmentSchema.parse({ metric: 'regional-daily', scope: { region: 'APAC' }, targetOverride: { value: 99 } }),
      T(5),
    );
    const { scheduler } = await makeScheduler(store);

    expect(await scheduler.tick('regional-daily', apac.scopeHash)).toBe('ok');
    const [point] = await store.queryPoints({ metric: 'regional-daily' });
    expect(point).toMatchObject({
      scope: { region: 'APAC' },
      scopeHash: apac.scopeHash,
      value: 1, // only the APAC booking of 08-11
      targetValue: 99, // the assignment's override, judged and stored
      status: 'breach', // 1 < 99, no thresholds → straight to breach
    });
    await scheduler.stop();
    await store.close();
  });

  it('lease contention: two schedulers, one store, same tick — one computes, one records skipped', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);

    // Scheduler A fetches through a gate so it HOLDS the lease while B ticks.
    let releaseGate!: () => void;
    const gate = new Promise<void>((r) => {
      releaseGate = r;
    });
    let fetchEntered!: () => void;
    const entered = new Promise<void>((r) => {
      fetchEntered = r;
    });
    const inner = new MemoryFactSource(ROWS);
    const gated: FactSourcePort = {
      fetchFacts: async (q: FactQuery) => {
        fetchEntered();
        await gate;
        return inner.fetchFacts(q);
      },
    };

    const clock = new TestClock();
    const a = await makeScheduler(store, { clock, facts: { source: gated }, instanceId: 'sched-a' });
    const b = await makeScheduler(store, { clock, instanceId: 'sched-b' });

    const aTick = a.scheduler.tick('daily-total', EMPTY_HASH);
    await entered; // A has the lease and is mid-materialization…
    expect(await b.scheduler.tick('daily-total', EMPTY_HASH)).toBe('skipped'); // …so B must stand down
    releaseGate();
    expect(await aTick).toBe('ok');

    // Exactly one point (A's), one ok run, one skipped run, one rollup.skipped event.
    expect(await store.queryPoints({ metric: 'daily-total' })).toHaveLength(1);
    const runs = await store.queryRuns({ metric: 'daily-total', order: 'asc' });
    expect(runs.map((r) => r.status).sort()).toEqual(['ok', 'skipped']);
    expect(runs.find((r) => r.status === 'skipped')).toMatchObject({
      windowKey: 'day:2026-08-11',
      trigger: 'scheduled',
      trace: null,
      error: null,
    });
    expect(b.events.map((e) => e.type)).toEqual(['rollup.skipped']);
    expect(b.events[0]).toMatchObject({
      metric: 'daily-total',
      scopeHash: EMPTY_HASH,
      windowKey: 'day:2026-08-11',
      occurredAtIso: '2026-08-12T00:05:00.000Z',
    });

    await a.scheduler.stop();
    await b.scheduler.stop();
    await store.close();
  });

  it('a failing tick returns error, audits the run, and never throws out of the cron path', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const broken: FactSourcePort = { fetchFacts: () => Promise.reject(new Error('host db gone')) };
    const { scheduler } = await makeScheduler(store, { facts: { source: broken } });

    expect(await scheduler.tick('daily-total', EMPTY_HASH)).toBe('error');
    expect((await store.queryRuns())[0]).toMatchObject({ status: 'error', error: 'host db gone' });
    expect(await store.queryPoints({ metric: 'daily-total' })).toEqual([]);
    // The lease was released even on failure — the next tick proceeds.
    expect(await scheduler.tick('daily-total', EMPTY_HASH)).toBe('error');
    await scheduler.stop();
    await store.close();
  });
});

describe('previousWindow (grain-aware, timezone-aware)', () => {
  const defaults = resolveDefaults();
  const ist = compileCalendar(IST_CAL);

  it('pins the previous window per grain (UTC)', () => {
    expect(previousWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, '2026-08-12T00:05:00Z', undefined, defaults)).toMatchObject({
      key: 'day:2026-08-11',
      startIso: '2026-08-11T00:00:00.000Z',
      endIso: '2026-08-12T00:00:00.000Z',
    });
    expect(previousWindow({ kind: 'periodic', grain: 'week', alignment: 'calendar' }, '2026-08-10T00:10:00Z', undefined, defaults)).toMatchObject({
      key: 'week:2026-W32',
      startIso: '2026-08-03T00:00:00.000Z',
      endIso: '2026-08-10T00:00:00.000Z',
    });
    expect(previousWindow({ kind: 'periodic', grain: 'month', alignment: 'calendar' }, '2026-08-01T00:15:00Z', undefined, defaults)).toMatchObject({
      key: 'month:2026-07',
      startIso: '2026-07-01T00:00:00.000Z',
      endIso: '2026-08-01T00:00:00.000Z',
    });
    expect(previousWindow({ kind: 'periodic', grain: 'quarter', alignment: 'calendar' }, '2026-07-01T00:20:00Z', undefined, defaults)).toMatchObject({
      key: 'quarter:2026-Q2',
      startIso: '2026-04-01T00:00:00.000Z',
      endIso: '2026-07-01T00:00:00.000Z',
    });
  });

  it('the IST/UTC day-boundary edge: the same instant closes DIFFERENT days', () => {
    const at = '2026-08-11T18:40:00Z'; // 2026-08-12 00:10 IST — IST's day just closed
    const viaIst = previousWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, at, ist, defaults);
    expect(viaIst).toMatchObject({
      key: 'day:2026-08-11',
      startIso: '2026-08-10T18:30:00.000Z',
      endIso: '2026-08-11T18:30:00.000Z',
    });
    // Under UTC the 11th is still OPEN at that instant — previous is the 10th.
    const viaUtc = previousWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, at, undefined, defaults);
    expect(viaUtc.key).toBe('day:2026-08-10');
  });

  it("fall-back repeated hour (Havana, dstAmbiguity 'later'): the boundary window is never skipped", () => {
    // 2026-11-01: wall midnight occurs at 04:00Z (CDT) and again at 05:00Z
    // (CST); 'later' makes 05:00Z the authoritative day/month boundary. A
    // cron firing at wall 00:05 lands at 04:05Z — BEFORE that boundary. The
    // tick must target the window closing AT the boundary (Oct 31 / October),
    // not re-materialize the not-yet-started Nov window (the old bug) and
    // not step a whole extra period back.
    const havana = compileCalendar(
      calendarSchema.parse({
        name: 'havana-ops',
        timezone: 'America/Havana',
        workweek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        workingHours: { start: '09:00', end: '17:00' },
        dstAmbiguity: 'later',
      }),
    );
    expect(previousWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, '2026-11-01T04:05:00Z', havana, defaults)).toMatchObject({
      key: 'day:2026-10-31',
      startIso: '2026-10-31T04:00:00.000Z',
      endIso: '2026-11-01T05:00:00.000Z',
    });
    expect(previousWindow({ kind: 'periodic', grain: 'month', alignment: 'calendar' }, '2026-11-01T04:15:00Z', havana, defaults)).toMatchObject({
      key: 'month:2026-10',
      startIso: '2026-10-01T04:00:00.000Z',
      endIso: '2026-11-01T05:00:00.000Z',
    });
    // A tick after the boundary agrees — same target, no double-skip.
    expect(previousWindow({ kind: 'periodic', grain: 'day', alignment: 'calendar' }, '2026-11-01T05:05:00Z', havana, defaults).key).toBe(
      'day:2026-10-31',
    );
  });
});

describe('weekly crons follow the calendar weekStart', () => {
  it("weekCronFor rebinds only the DOW field (croner sun=0 convention)", () => {
    expect(weekCronFor('10 0 * * 1', 'sat')).toBe('10 0 * * 6');
    expect(weekCronFor('10 0 * * 1', 'sun')).toBe('10 0 * * 0');
    expect(weekCronFor('10 0 * * 1', 'mon')).toBe('10 0 * * 1');
    expect(weekCronFor('30 15 0 * * 1', 'tue')).toBe('30 15 0 * * 2'); // 6-field (seconds) form
  });

  it("a weekStart:'sat' calendar schedules its weekly rollup on Saturday, not Monday", async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    const satCal = calendarSchema.parse({ ...IST_CAL, name: 'sat-ops', weekStart: 'sat' });
    await store.upsertCalendar(satCal, T(0));
    await seedActive(store, countDef('sat-weekly', [], { kind: 'periodic', grain: 'week' }, 'sat-ops'), 1);

    const { scheduler } = await makeScheduler(store, { calendars: [satCal] });
    const job = scheduler.jobs().find((j) => j.metric === 'sat-weekly')!;
    expect(job.cron).toBe('10 0 * * 6'); // time of day from rollupCrons.week, DOW from the calendar
    expect(scheduler.cronFor('sat-weekly', EMPTY_HASH)?.getPattern()).toBe('10 0 * * 6');
    await scheduler.stop();
    await store.close();
  });
});

/** A fact source whose fetch blocks until the test releases it. */
function gatedFacts(rows: Array<Record<string, unknown>>): {
  source: FactSourcePort;
  entered: Promise<void>;
  release: () => void;
} {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let fetchEntered!: () => void;
  const entered = new Promise<void>((r) => {
    fetchEntered = r;
  });
  const inner = new MemoryFactSource(rows);
  return {
    source: {
      fetchFacts: async (q: FactQuery) => {
        fetchEntered();
        await gate;
        return inner.fetchFacts(q);
      },
    },
    entered,
    release,
  };
}

describe('lease discipline (fencing + same-instance reentrancy)', () => {
  it('a lease stolen mid-materialization aborts the write: skipped run, no point (fencing verified at write time)', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const gate = gatedFacts(ROWS);
    const { scheduler, events } = await makeScheduler(store, { facts: { source: gate.source } });

    const tick = scheduler.tick('daily-total', EMPTY_HASH);
    await gate.entered; // holding the lease (token 1), mid-compute…
    // …when the lease expires and ANOTHER instance takes it over.
    const key = rollupLeaseKey('daily-total', EMPTY_HASH);
    const raw = (await store.get(key))!;
    const stolen = { ...(JSON.parse(raw) as { token: number }), holder: 'thief', token: 2, expiresAtMs: Date.now() + 3_600_000 };
    expect(await store.compareAndSet(key, raw, JSON.stringify(stolen))).toBe(true);

    gate.release();
    expect(await tick).toBe('skipped'); // the loser stands down instead of double-writing
    expect(await store.queryPoints({ metric: 'daily-total' })).toEqual([]);
    const runs = await store.queryRuns({ metric: 'daily-total' });
    expect(runs.map((r) => r.status)).toEqual(['skipped']);
    expect(events.map((e) => e.type)).toEqual(['rollup.skipped']);
    // The thief's lease survives untouched — the loser must not release it.
    expect(JSON.parse((await store.get(key))!)).toMatchObject({ holder: 'thief', token: 2 });
    await scheduler.stop();
    await store.close();
  });

  it('a live lease blocks the SAME instance too: concurrent manual ticks never double-run', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const gate = gatedFacts(ROWS);
    const { scheduler } = await makeScheduler(store, { facts: { source: gate.source } });

    const first = scheduler.tick('daily-total', EMPTY_HASH);
    await gate.entered; // first tick holds the lease…
    expect(await scheduler.tick('daily-total', EMPTY_HASH)).toBe('skipped'); // …its own sibling stands down
    gate.release();
    expect(await first).toBe('ok');

    expect(await store.queryPoints({ metric: 'daily-total' })).toHaveLength(1);
    const runs = await store.queryRuns({ metric: 'daily-total' });
    expect(runs.map((r) => r.status).sort()).toEqual(['ok', 'skipped']);
    // The winner's release stands: token 1, expired.
    expect(JSON.parse((await store.get(rollupLeaseKey('daily-total', EMPTY_HASH)))!)).toMatchObject({
      token: 1,
      expiresAtMs: 0,
    });
    await scheduler.stop();
    await store.close();
  });
});

describe('refresh serialization and stop() draining', () => {
  class ObservedStore extends InMemoryMetricsStateStore {
    active = 0;
    maxConcurrentListings = 0;
    override async listDefinitions() {
      this.active += 1;
      this.maxConcurrentListings = Math.max(this.maxConcurrentListings, this.active);
      await new Promise((r) => setTimeout(r, 10)); // widen the interleaving window
      const out = await super.listDefinitions();
      this.active -= 1;
      return out;
    }
  }

  it('concurrent refresh() calls run strictly one after another (no orphaned crons)', async () => {
    const store = new ObservedStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const { scheduler } = await makeScheduler(store);
    store.maxConcurrentListings = 0;

    await Promise.all([scheduler.refresh(), scheduler.refresh(), scheduler.refresh()]);
    expect(store.maxConcurrentListings).toBe(1); // serialized, never interleaved
    expect(scheduler.jobs()).toHaveLength(1); // and the job set is intact
    expect(scheduler.cronFor('daily-total', EMPTY_HASH)).not.toBeNull();
    await scheduler.stop();
    expect(scheduler.jobs()).toEqual([]);
    await store.close();
  });

  it('stop() drains in-flight ticks — the store closes only after the tick finished', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);
    const gate = gatedFacts(ROWS);
    const { scheduler } = await makeScheduler(store, { facts: { source: gate.source } });

    const tick = scheduler.tick('daily-total', EMPTY_HASH);
    await gate.entered;
    let stopResolved = false;
    const stopping = scheduler.stop().then(() => {
      stopResolved = true;
    });
    await new Promise((r) => setTimeout(r, 25));
    expect(stopResolved).toBe(false); // stop() waits for the gated tick

    gate.release();
    expect(await tick).toBe('ok'); // the tick completed, nothing was cut off
    await stopping;
    expect((await store.queryRuns({ metric: 'daily-total' }))[0]?.status).toBe('ok');
    await store.close(); // and only now does the store go away — no throw
  });
});

describe('croner wiring (one real short-interval smoke test)', () => {
  it('fires a scheduled tick for real, with the timer unref()ed', async () => {
    const store = new InMemoryMetricsStateStore();
    await store.init();
    await seedActive(store, countDef('daily-total', []), 1);

    let resolveComputed!: (e: EngineEvent) => void;
    const computed = new Promise<EngineEvent>((r) => {
      resolveComputed = r;
    });
    const env = await makeScheduler(store, {
      defaults: { rollupCrons: { day: '* * * * * *' } }, // every second (croner 6-field)
      hooks: { onEvent: (e) => (e.type === 'metric.computed' ? resolveComputed(e) : undefined) },
    });

    // Asserted BEFORE the tick fires: the timer never pins the host, and the
    // (overridden) cron string really reached croner.
    expect(env.scheduler.cronFor('daily-total', EMPTY_HASH)?.options.unref).toBe(true);
    expect(env.scheduler.cronFor('daily-total', EMPTY_HASH)?.getPattern()).toBe('* * * * * *');

    const event = await computed; // arrives via a REAL croner timer within ~1s
    await env.scheduler.stop();
    expect(event).toMatchObject({ type: 'metric.computed', metric: 'daily-total' });
    expect((await store.queryRuns({ metric: 'daily-total' })).length).toBeGreaterThan(0);
    await store.close();
  }, 15_000);
});
