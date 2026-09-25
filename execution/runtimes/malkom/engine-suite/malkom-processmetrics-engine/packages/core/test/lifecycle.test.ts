/**
 * M4 lifecycle state machine — the rules engine's group model, ported to
 * definition heads: the full transition matrix (legal and illegal), required
 * actors, the re-run tier-1 activation gate, immutable version rows with
 * pinned registry/calendar versions, draft-edit-while-active, the
 * revalidation sweep, and sqlite restart parity.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type Calendar,
  type MetricDefinition,
  type MetricDefinitionInput,
  type RegistryDocInput,
} from '../src/config/schemas.js';
import { ConfigInvalidError, ConflictError, MalkomError, NotFoundError } from '../src/domain/errors.js';
import { CompiledRegistry } from '../src/domain/registry.js';
import type { EngineEvent } from '../src/ports/hooks.js';
import { noopLogger } from '../src/ports/logger.js';
import type { MetricsStateStore } from '../src/ports/statestore.js';
import {
  activateDefinition,
  rejectDefinition,
  retireDefinition,
  revalidationSweep,
  submitDefinition,
} from '../src/runtime/lifecycle.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';
import { SqliteMetricsStateStore } from '../src/state/sqlite.js';

// ---------------------------------------------------------------------------
// Fixture: the Booking-TAT world (registry, calendar, definition)
// ---------------------------------------------------------------------------

const REGISTRY_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
        { id: 'region', type: 'string' },
        { id: 'createdAt', type: 'date' },
        { id: 'confirmedAt', type: 'date' },
      ],
    },
  ],
};
const REGISTRY_V1 = new CompiledRegistry(registryDocSchema.parse(REGISTRY_INPUT), 1);

/** v2 drops `region` — every definition scoped by region breaks. */
const DRIFTED_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
        { id: 'createdAt', type: 'date' },
        { id: 'confirmedAt', type: 'date' },
      ],
    },
  ],
};
const REGISTRY_V2 = new CompiledRegistry(registryDocSchema.parse(DRIFTED_INPUT), 2);

const CAL_V1: Calendar = calendarSchema.parse({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
});
const CAL_V2: Calendar = calendarSchema.parse({
  ...CAL_V1,
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

const TAT_INPUT: MetricDefinitionInput = {
  name: 'booking-tat-sla',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'day' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
  calendarRef: 'india-ops',
  derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] } },
  formula: {
    kind: 'ratio',
    numerator: { agg: 'count', source: 'booking', where: { op: 'lte', field: 'tatMinutes', value: 240 } },
    denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
  },
};

function tatDefinition(targetValue = 95): MetricDefinition {
  return metricDefinitionSchema.parse({
    ...structuredClone(TAT_INPUT),
    target: { ...structuredClone(TAT_INPUT.target), value: targetValue },
  });
}

/** Dimensionless, calendar-free — stays valid under the drifted registry. */
const COUNT_DEF: MetricDefinition = metricDefinitionSchema.parse({
  name: 'booking-count',
  kind: 'kpi',
  metricType: 'count',
  scope: { dimensions: [] },
  window: { kind: 'periodic', grain: 'day' },
  anchor: { kind: 'event', field: 'createdAt' },
  target: { value: 1, direction: 'higher_is_better' },
  formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
});

const T = (n: number): string => new Date(Date.UTC(2026, 7, 12, 10, n)).toISOString();

const IMPLS: Array<[string, () => MetricsStateStore]> = [
  ['InMemoryMetricsStateStore', () => new InMemoryMetricsStateStore()],
  ['SqliteMetricsStateStore (:memory:)', () => new SqliteMetricsStateStore(':memory:')],
];

describe.each(IMPLS)('%s lifecycle', (_name, make) => {
  let store: MetricsStateStore;
  let events: EngineEvent[];

  async function open(): Promise<MetricsStateStore> {
    store = make();
    events = [];
    await store.init();
    await store.upsertCalendar(CAL_V1, T(0));
    return store;
  }

  const hooks = { onEvent: (e: EngineEvent) => void events.push(e) };
  const opts = (actor: string, now: string, reason?: string) => ({
    actor,
    now,
    hooks,
    logger: noopLogger,
    ...(reason !== undefined ? { reason } : {}),
  });

  afterEach(async () => {
    await store.close();
  });

  it('walks draft → pending → active → retired, records actors, emits events', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));

    const pending = await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    expect(pending.state).toBe('pending');

    const { head, version } = await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));
    expect(head.state).toBe('active');
    expect(head.latestVersion).toBe(1);
    expect(head.activeVersion).toBe(1);
    expect(head.validationStatus).toBe('valid');
    expect(version).toMatchObject({
      metric: 'booking-tat-sla',
      versionNo: 1,
      registryVersion: 1,
      calendarName: 'india-ops',
      calendarVersion: 1,
      activatedAt: T(3),
      actor: 'priya',
    });

    const retired = await retireDefinition(s, 'booking-tat-sla', opts('money', T(4), 'contract ended'));
    expect(retired.state).toBe('retired');
    expect(retired.activeVersion).toBeNull(); // rollups stop
    expect(await s.getActiveVersion('booking-tat-sla')).toBeNull();
    expect((await s.getVersion('booking-tat-sla', 1))?.versionNo).toBe(1); // history stays

    // The audit trail knows who did what, in order.
    expect(retired.transitions.map((t) => `${t.to}:${t.actor}`)).toEqual([
      'pending:money',
      'active:priya',
      'retired:money',
    ]);
    expect(retired.transitions[2]?.reason).toBe('contract ended');

    expect(events.map((e) => e.type)).toEqual([
      'definition.submitted',
      'definition.activated',
      'definition.retired',
    ]);
    expect(events[1]).toMatchObject({ metric: 'booking-tat-sla', versionNo: 1, actor: 'priya', occurredAtIso: T(3) });
    expect(events[2]).toMatchObject({ versionNo: 1, occurredAtIso: T(4) });
  });

  it('enforces the FULL transition matrix — every illegal move throws ConflictError', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    const name = 'booking-tat-sla';

    // draft: only submit is legal.
    await expect(rejectDefinition(s, name, opts('m', T(2)))).rejects.toThrowError(ConflictError);
    await expect(activateDefinition(s, name, REGISTRY_V1, opts('m', T(2)))).rejects.toThrow(/cannot activate a draft/);
    await expect(retireDefinition(s, name, opts('m', T(2)))).rejects.toThrow(/cannot retire a draft/);

    // pending: only reject/activate are legal; edits are blocked.
    await submitDefinition(s, name, opts('m', T(3)));
    await expect(submitDefinition(s, name, opts('m', T(4)))).rejects.toThrow(/requires draft/);
    await expect(retireDefinition(s, name, opts('m', T(4)))).rejects.toThrowError(ConflictError);
    await expect(s.saveDefinitionDraft(tatDefinition(90), T(4), 'm')).rejects.toThrow(/pending approval/);

    // reject sends it back to draft.
    const rejected = await rejectDefinition(s, name, opts('priya', T(5), 'not yet'));
    expect(rejected.state).toBe('draft');
    expect(rejected.transitions.at(-1)).toMatchObject({ to: 'draft', actor: 'priya', reason: 'not yet' });

    // active: only retire is legal (editing is covered separately).
    await submitDefinition(s, name, opts('m', T(6)));
    await activateDefinition(s, name, REGISTRY_V1, opts('priya', T(7)));
    await expect(submitDefinition(s, name, opts('m', T(8)))).rejects.toThrowError(ConflictError);
    await expect(rejectDefinition(s, name, opts('m', T(8)))).rejects.toThrowError(ConflictError);
    await expect(activateDefinition(s, name, REGISTRY_V1, opts('m', T(8)))).rejects.toThrow(/cannot activate/);

    // retired: nothing is legal any more, including edits.
    await retireDefinition(s, name, opts('m', T(9)));
    await expect(submitDefinition(s, name, opts('m', T(10)))).rejects.toThrowError(ConflictError);
    await expect(rejectDefinition(s, name, opts('m', T(10)))).rejects.toThrowError(ConflictError);
    await expect(activateDefinition(s, name, REGISTRY_V1, opts('m', T(10)))).rejects.toThrowError(ConflictError);
    await expect(retireDefinition(s, name, opts('m', T(10)))).rejects.toThrowError(ConflictError);
    await expect(s.saveDefinitionDraft(tatDefinition(90), T(10), 'm')).rejects.toThrow(/retired/);

    // Unknown definitions are NotFound, not Conflict.
    await expect(submitDefinition(s, 'ghost', opts('m', T(11)))).rejects.toThrowError(NotFoundError);
  });

  it('every transition requires a non-empty actor', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    await expect(submitDefinition(s, 'booking-tat-sla', opts('', T(2)))).rejects.toThrowError(ConfigInvalidError);
    await expect(submitDefinition(s, 'booking-tat-sla', opts('   ', T(2)))).rejects.toThrowError(ConfigInvalidError);
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(3)));
    await expect(
      activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('', T(4))),
    ).rejects.toThrowError(ConfigInvalidError);
    await expect(rejectDefinition(s, 'booking-tat-sla', opts(' ', T(4)))).rejects.toThrowError(ConfigInvalidError);
  });

  it('the activation gate RE-RUNS tier-1 against the current registry — stored status is never trusted', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    // A sweep under the healthy registry marks the head valid…
    await revalidationSweep({ store: s, registry: REGISTRY_V1, calendars: [CAL_V1], now: T(2), logger: noopLogger });
    expect((await s.getDefinition('booking-tat-sla'))?.validationStatus).toBe('valid');
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(3)));

    // …but activation against the DRIFTED registry re-validates and refuses.
    const failure = await activateDefinition(s, 'booking-tat-sla', REGISTRY_V2, opts('priya', T(4))).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(MalkomError);
    expect((failure as MalkomError).code).toBe('CONFIG_INVALID');
    expect((failure as MalkomError).details.some((d) => d.includes('region'))).toBe(true);

    // Nothing moved: still pending, no version row, no event.
    const head = await s.getDefinition('booking-tat-sla');
    expect(head?.state).toBe('pending');
    expect(head?.activeVersion).toBeNull();
    expect(await s.listVersions('booking-tat-sla')).toEqual([]);
    expect(events.map((e) => e.type)).toEqual(['definition.submitted']);
  });

  it('version rows are immutable: activate v1, edit, activate v2 — v1 is bit-identical, pins correct', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(95), T(1));
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    const first = await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));
    const v1Snapshot = structuredClone(first.version);

    // Draft-edit while active, calendar changes underneath, then activate v2
    // against the (grown) registry version 2 semantics — here the same doc
    // compiled as a later version to prove per-activation pinning.
    await s.upsertCalendar(CAL_V2, T(4)); // calendar content changed → version 2
    await s.saveDefinitionDraft(tatDefinition(97), T(5), 'money');
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(6)));
    const registryV2SameDoc = new CompiledRegistry(registryDocSchema.parse(REGISTRY_INPUT), 2);
    const second = await activateDefinition(s, 'booking-tat-sla', registryV2SameDoc, opts('priya', T(7)));

    // v1 row unchanged — byte-for-byte the record captured at activation.
    expect(await s.getVersion('booking-tat-sla', 1)).toEqual(v1Snapshot);
    expect((await s.getVersion('booking-tat-sla', 1))?.doc.target.value).toBe(95);

    // v2 pins the NEW registry and calendar versions.
    expect(second.version).toMatchObject({
      versionNo: 2,
      registryVersion: 2,
      calendarName: 'india-ops',
      calendarVersion: 2,
      actor: 'priya',
    });
    expect(second.version.doc.target.value).toBe(97);
    expect(second.head.latestVersion).toBe(2);
    expect(second.head.activeVersion).toBe(2);

    // Exactly one active version; point-in-time reads serve both forever.
    expect((await s.getActiveVersion('booking-tat-sla'))?.versionNo).toBe(2);
    expect((await s.listVersions('booking-tat-sla')).map((v) => v.versionNo)).toEqual([1, 2]);

    // Version rows can never be overwritten: the STORE assigns the next
    // versionNo, so even a re-appended old record lands as a NEW row and v1
    // stays bit-identical.
    const reAppended = await s.appendVersion(structuredClone(v1Snapshot));
    expect(reAppended.versionNo).toBe(3);
    expect(await s.getVersion('booking-tat-sla', 1)).toEqual(v1Snapshot);
  });

  it('an orphaned version row (crash between append and head update) never bricks the lineage', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(95), T(1));
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));

    // Simulate the crash: a version row exists that no head counter saw.
    const v1 = (await s.getVersion('booking-tat-sla', 1))!;
    const orphan = await s.appendVersion({ ...structuredClone(v1), activatedAt: T(4) });
    expect(orphan.versionNo).toBe(2);
    expect((await s.getDefinition('booking-tat-sla'))?.latestVersion).toBe(1); // the head never learned of it

    // The next activation still succeeds — versionNo comes from the rows.
    await s.saveDefinitionDraft(tatDefinition(96), T(5), 'money');
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(6)));
    const { head, version } = await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(7)));
    expect(version.versionNo).toBe(3);
    expect(head.latestVersion).toBe(3);
    expect(head.activeVersion).toBe(3);
  });

  it('deleteDefinition refuses while version rows exist — retire is the end-of-life path', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));
    await retireDefinition(s, 'booking-tat-sla', opts('money', T(4)));

    // Even retired: the immutable version rows keep the name occupied —
    // deleting and recreating the lineage would collide with them forever.
    await expect(s.deleteDefinition('booking-tat-sla')).rejects.toThrowError(ConflictError);
    expect(await s.getDefinition('booking-tat-sla')).not.toBeNull();

    // A never-activated head deletes fine.
    await s.saveDefinitionDraft(COUNT_DEF, T(5));
    await s.deleteDefinition('booking-count');
    expect(await s.getDefinition('booking-count')).toBeNull();
  });

  it('draft-edit-while-active: the lineage moves to draft, the active version keeps standing', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(95), T(1));
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));

    // Editing an active head without an actor is refused — it is a transition.
    await expect(s.saveDefinitionDraft(tatDefinition(90), T(4))).rejects.toThrow(/actor/);

    const edited = await s.saveDefinitionDraft(tatDefinition(90), T(4), 'money');
    expect(edited.state).toBe('draft');
    expect(edited.activeVersion).toBe(1); // v1 keeps evaluating untouched
    expect(edited.validationStatus).toBe('unchecked'); // edits reset the verdict
    expect(edited.transitions.at(-1)).toMatchObject({ to: 'draft', actor: 'money', reason: 'edited' });

    // The head carries the edit; the active snapshot does not.
    expect(edited.doc.target.value).toBe(90);
    expect((await s.getActiveVersion('booking-tat-sla'))?.doc.target.value).toBe(95);

    // Editing a plain draft again needs no actor — no state changed.
    const again = await s.saveDefinitionDraft(tatDefinition(85), T(5));
    expect(again.state).toBe('draft');
    expect(again.transitions).toHaveLength(edited.transitions.length);
  });

  it('revalidationSweep re-marks every non-retired head — the active version counts too', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    await s.saveDefinitionDraft(COUNT_DEF, T(1));

    // Healthy registry: both valid.
    const clean = await revalidationSweep({
      store: s,
      registry: REGISTRY_V1,
      calendars: [CAL_V1],
      now: T(2),
      hooks,
      logger: noopLogger,
    });
    expect(clean).toEqual([
      { metric: 'booking-count', validationStatus: 'valid' },
      { metric: 'booking-tat-sla', validationStatus: 'valid' },
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'sweep.completed', checked: 2, occurredAtIso: T(2) });

    // Activate the TAT metric, then draft-edit it to DROP the region
    // dimension (valid under the drifted registry). The pinned v1 still uses
    // region — the sweep must report the worse verdict, not the head's.
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(3)));
    await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(4)));
    const dimensionless = metricDefinitionSchema.parse({
      ...structuredClone(TAT_INPUT),
      scope: { dimensions: [] },
    });
    await s.saveDefinitionDraft(dimensionless, T(5), 'money');

    const drifted = await revalidationSweep({
      store: s,
      registry: REGISTRY_V2,
      calendars: [CAL_V1],
      now: T(6),
      hooks,
      logger: noopLogger,
    });
    expect(drifted).toEqual([
      { metric: 'booking-count', validationStatus: 'valid' },
      { metric: 'booking-tat-sla', validationStatus: 'broken' }, // via the pinned active doc
    ]);
    expect((await s.getDefinition('booking-tat-sla'))?.validationStatus).toBe('broken');
    expect((await s.getDefinition('booking-tat-sla'))?.updatedAt).toBe(T(6));

    // Retired lineages are left alone.
    await submitDefinition(s, 'booking-count', opts('m', T(7)));
    await activateDefinition(s, 'booking-count', REGISTRY_V2, opts('m', T(8)));
    await retireDefinition(s, 'booking-count', opts('m', T(9)));
    const afterRetire = await revalidationSweep({
      store: s,
      registry: REGISTRY_V2,
      calendars: [CAL_V1],
      now: T(10),
      logger: noopLogger,
    });
    expect(afterRetire.map((r) => r.metric)).toEqual(['booking-tat-sla']);
  });

  it('the sweep never resurrects a head that transitioned mid-sweep (CAS on updatedAt)', async () => {
    const s = await open();
    await s.saveDefinitionDraft(tatDefinition(), T(1));
    await submitDefinition(s, 'booking-tat-sla', opts('money', T(2)));
    await activateDefinition(s, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3)));

    // A store view whose listDefinitions retires the head AFTER the sweep
    // captured its snapshot — the read-modify-write race, made deterministic.
    const racy = Object.create(s) as MetricsStateStore;
    racy.listDefinitions = async () => {
      const snapshot = await s.listDefinitions();
      await retireDefinition(s, 'booking-tat-sla', opts('money', T(4)));
      return snapshot;
    };

    // Under the drifted registry the sweep wants to mark the head broken…
    const entries = await revalidationSweep({
      store: racy,
      registry: REGISTRY_V2,
      calendars: [CAL_V1],
      now: T(5),
      logger: noopLogger,
    });
    expect(entries).toEqual([{ metric: 'booking-tat-sla', validationStatus: 'broken' }]);

    // …but the retire won the race: the head stays retired, the stale write
    // was refused — neither the state nor the verdict was clobbered.
    const head = await s.getDefinition('booking-tat-sla');
    expect(head?.state).toBe('retired');
    expect(head?.activeVersion).toBeNull();
    expect(head?.updatedAt).toBe(T(4));
    expect(head?.validationStatus).toBe('valid');
  });

  it('a missing calendar breaks the activation gate (calendars are part of tier-1)', async () => {
    const s = await open();
    // A fresh store WITHOUT the calendar: the definition references india-ops.
    const bare = make();
    await bare.init();
    try {
      await bare.saveDefinitionDraft(tatDefinition(), T(1));
      await submitDefinition(bare, 'booking-tat-sla', opts('money', T(2)));
      const failure = await activateDefinition(bare, 'booking-tat-sla', REGISTRY_V1, opts('priya', T(3))).catch(
        (e: unknown) => e,
      );
      expect(failure).toBeInstanceOf(ConfigInvalidError);
      expect((failure as MalkomError).details.some((d) => d.includes('india-ops'))).toBe(true);
    } finally {
      await bare.close();
    }
  });
});

describe('sqlite lifecycle restart parity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'malkom-metrics-m4-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reopening the file reproduces heads, versions, transitions and pointers exactly', async () => {
    const file = join(dir, 'state.db');
    const a = new SqliteMetricsStateStore(file);
    await a.init();
    await a.upsertCalendar(CAL_V1, T(0));
    await a.saveDefinitionDraft(tatDefinition(95), T(1));
    await submitDefinition(a, 'booking-tat-sla', { actor: 'money', now: T(2), logger: noopLogger });
    await activateDefinition(a, 'booking-tat-sla', REGISTRY_V1, { actor: 'priya', now: T(3), logger: noopLogger });
    await a.saveDefinitionDraft(tatDefinition(90), T(4), 'money'); // draft-edit while active
    const headBefore = await a.getDefinition('booking-tat-sla');
    const versionsBefore = await a.listVersions('booking-tat-sla');
    await a.close();

    const b = new SqliteMetricsStateStore(file);
    await b.init(); // idempotent DDL on an existing file
    expect(await b.getDefinition('booking-tat-sla')).toEqual(headBefore);
    expect(await b.listVersions('booking-tat-sla')).toEqual(versionsBefore);
    expect((await b.getActiveVersion('booking-tat-sla'))?.versionNo).toBe(1);
    expect((await b.getDefinition('booking-tat-sla'))?.transitions.map((t) => t.to)).toEqual([
      'pending',
      'active',
      'draft',
    ]);
    await b.close();
  });
});
