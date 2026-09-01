/**
 * Authoring storage contract tests, run against BOTH shipped implementations
 * like statestore.test.ts: calendars (content-hash idempotent versioning),
 * definition heads (draft state, validationStatus default), and assignments
 * ((metric, scopeHash) uniqueness with key-order-independent hashing).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  assignmentSchema,
  calendarSchema,
  metricDefinitionSchema,
  type Assignment,
  type Calendar,
  type MetricDefinition,
} from '../src/config/schemas.js';
import type { MetricsStateStore } from '../src/ports/statestore.js';
import { InMemoryMetricsStateStore } from '../src/state/memory.js';
import { SqliteMetricsStateStore } from '../src/state/sqlite.js';

const CAL_V1: Calendar = calendarSchema.parse({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-01-26', label: 'Republic Day' }],
});

const CAL_V2: Calendar = calendarSchema.parse({
  ...CAL_V1,
  holidays: [
    { date: '2026-01-26', label: 'Republic Day' },
    { date: '2026-08-15', label: 'Independence Day' },
  ],
});

function definition(name: string, targetValue = 100): MetricDefinition {
  return metricDefinitionSchema.parse({
    name,
    kind: 'kpi',
    metricType: 'count',
    scope: { dimensions: [] },
    window: { kind: 'rolling', length: 7, unit: 'day' },
    anchor: { kind: 'event', field: 'createdAt' },
    target: { value: targetValue, direction: 'higher_is_better' },
    formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
  });
}

function assignment(input: Record<string, unknown>): Assignment {
  return assignmentSchema.parse({ metric: 'confirmed-bookings', ...input });
}

const T0 = '2026-08-12T10:00:00.000Z';
const T1 = '2026-08-12T11:00:00.000Z';
const T2 = '2026-08-12T12:00:00.000Z';

const IMPLS: Array<[string, () => MetricsStateStore]> = [
  ['InMemoryMetricsStateStore', () => new InMemoryMetricsStateStore()],
  ['SqliteMetricsStateStore (:memory:)', () => new SqliteMetricsStateStore(':memory:')],
];

describe.each(IMPLS)('%s authoring', (_name, make) => {
  let store: MetricsStateStore;

  async function open(): Promise<MetricsStateStore> {
    store = make();
    await store.init();
    return store;
  }

  afterEach(async () => {
    await store.close();
  });

  describe('calendars', () => {
    it('re-applying identical content is a no-op; changed content bumps the version', async () => {
      const s = await open();
      const first = await s.upsertCalendar(CAL_V1, T0);
      expect(first.version).toBe(1);
      expect(first.updatedAt).toBe(T0);

      // Identical content later: same version, same hash, updatedAt untouched.
      const again = await s.upsertCalendar(structuredClone(CAL_V1), T1);
      expect(again).toEqual(first);
      expect((await s.getCalendar('india-ops'))?.version).toBe(1);

      // Changed content: next version, new hash.
      const changed = await s.upsertCalendar(CAL_V2, T2);
      expect(changed.version).toBe(2);
      expect(changed.docHash).not.toBe(first.docHash);
      expect(changed.updatedAt).toBe(T2);
      expect((await s.getCalendar('india-ops'))?.doc).toEqual(CAL_V2);
    });

    it('getCalendar misses are null; listCalendars is name-ordered', async () => {
      const s = await open();
      expect(await s.getCalendar('nope')).toBeNull();
      await s.upsertCalendar(calendarSchema.parse({ ...CAL_V1, name: 'z-ops' }), T0);
      await s.upsertCalendar(CAL_V1, T0);
      expect((await s.listCalendars()).map((c) => c.name)).toEqual(['india-ops', 'z-ops']);
    });
  });

  describe('definition heads', () => {
    it('round-trips a draft with state and validationStatus defaults', async () => {
      const s = await open();
      const doc = definition('confirmed-bookings');
      const saved = await s.saveDefinitionDraft(doc, T0);
      expect(saved.state).toBe('draft');
      expect(saved.validationStatus).toBe('unchecked');
      expect(saved.createdAt).toBe(T0);
      expect(saved.updatedAt).toBe(T0);

      const got = await s.getDefinition('confirmed-bookings');
      expect(got).toEqual(saved);
      expect(got?.doc).toEqual(doc);
    });

    it('re-saving preserves createdAt, bumps updatedAt, and re-hashes', async () => {
      const s = await open();
      const first = await s.saveDefinitionDraft(definition('confirmed-bookings', 100), T0);
      const second = await s.saveDefinitionDraft(definition('confirmed-bookings', 150), T1);
      expect(second.createdAt).toBe(T0);
      expect(second.updatedAt).toBe(T1);
      expect(second.docHash).not.toBe(first.docHash);
      expect((await s.listDefinitions()).map((d) => d.name)).toEqual(['confirmed-bookings']);
    });

    it('deleteDefinition removes the head; deleting a missing head is a no-op', async () => {
      const s = await open();
      await s.saveDefinitionDraft(definition('confirmed-bookings'), T0);
      await s.deleteDefinition('confirmed-bookings');
      expect(await s.getDefinition('confirmed-bookings')).toBeNull();
      await s.deleteDefinition('confirmed-bookings');
      expect(await s.listDefinitions()).toEqual([]);
    });
  });

  describe('mutator isolation (returned records never alias caller objects)', () => {
    it('upsertCalendar: mutating the input doc or the returned record never poisons the store', async () => {
      const s = await open();
      const doc = structuredClone(CAL_V1);
      const returned = await s.upsertCalendar(doc, T0);
      doc.holidays.push({ date: '2026-12-25', label: 'sneaky mutation' });
      returned.doc.timezone = 'Mars/Olympus_Mons';
      expect((await s.getCalendar('india-ops'))?.doc).toEqual(CAL_V1);
    });

    it('saveDefinitionDraft: the stored doc is isolated both ways', async () => {
      const s = await open();
      const doc = definition('confirmed-bookings');
      const returned = await s.saveDefinitionDraft(structuredClone(doc), T0);
      returned.doc.target.value = -1;
      returned.transitions.push({ to: 'retired', actor: 'evil', at: T1 });
      expect((await s.getDefinition('confirmed-bookings'))?.doc).toEqual(doc);
      expect((await s.getDefinition('confirmed-bookings'))?.transitions).toEqual([]);
    });

    it('putAssignment: the stored scope is isolated both ways', async () => {
      const s = await open();
      const input = assignment({ scope: { region: 'APAC' }, targetOverride: { value: 90 } });
      const returned = await s.putAssignment(input, T0);
      input.scope['region'] = 'MUTATED';
      returned.scope['region'] = 'POISONED';
      returned.targetOverride!.value = -1;
      const [stored] = await s.listAssignments();
      expect(stored?.scope).toEqual({ region: 'APAC' });
      expect(stored?.targetOverride).toEqual({ value: 90 });
    });

    it('upsertPoint: the stored scope is isolated both ways', async () => {
      const s = await open();
      const upsert = {
        metric: 'confirmed-bookings',
        versionNo: 1,
        scopeHash: 'h1',
        scope: { region: 'APAC' },
        windowKey: 'day:2026-08-10',
        windowStartIso: '2026-08-10T00:00:00.000Z',
        windowEndIso: '2026-08-11T00:00:00.000Z',
        grain: 'day' as const,
        value: 1,
        numerator: null,
        denominator: null,
        targetValue: null,
        status: 'attained' as const,
        computedAtIso: T0,
        runId: 'r1',
      };
      const { point } = await s.upsertPoint(upsert);
      upsert.scope['region'] = 'MUTATED';
      point.scope['region'] = 'POISONED';
      expect((await s.queryPoints({ metric: 'confirmed-bookings' }))[0]?.scope).toEqual({ region: 'APAC' });
    });

    it('appendVersion: the stored version doc is isolated both ways', async () => {
      const s = await open();
      const doc = definition('confirmed-bookings');
      const input = {
        metric: 'confirmed-bookings',
        doc: structuredClone(doc),
        registryVersion: 1,
        activatedAt: T0,
        actor: 'priya',
      };
      const returned = await s.appendVersion(input);
      input.doc.target.value = -1;
      returned.doc.target.value = -2;
      expect((await s.getVersion('confirmed-bookings', 1))?.doc).toEqual(doc);
    });
  });

  describe('assignments', () => {
    it('same (metric, scope) updates in place — even with different key order', async () => {
      const s = await open();
      const created = await s.putAssignment(
        assignment({ scope: { region: 'APAC', customerTier: 'gold' } }),
        T0,
      );
      expect(created.active).toBe(true);
      expect(created.targetOverride).toBeNull();

      // Same scope, reversed key order, new override: updates the same row.
      const updated = await s.putAssignment(
        assignment({
          scope: { customerTier: 'gold', region: 'APAC' },
          targetOverride: { value: 90 },
          active: false,
        }),
        T1,
      );
      expect(updated.id).toBe(created.id);
      expect(updated.scopeHash).toBe(created.scopeHash);
      expect(updated.createdAt).toBe(T0);
      expect(updated.updatedAt).toBe(T1);
      expect(updated.targetOverride).toEqual({ value: 90 });
      expect(updated.active).toBe(false);
      expect(await s.listAssignments()).toHaveLength(1);
    });

    it('a different scope for the same metric creates a second assignment', async () => {
      const s = await open();
      const a = await s.putAssignment(assignment({ scope: { region: 'APAC' } }), T0);
      const b = await s.putAssignment(assignment({ scope: { region: 'EMEA' } }), T0);
      expect(b.id).not.toBe(a.id);
      expect(b.scopeHash).not.toBe(a.scopeHash);
      expect(await s.listAssignments({ metric: 'confirmed-bookings' })).toHaveLength(2);
    });

    it('filters by metric and deletes by id', async () => {
      const s = await open();
      const kept = await s.putAssignment(assignment({ scope: { region: 'APAC' } }), T0);
      const dropped = await s.putAssignment(
        assignment({ metric: 'booking-tat-sla', scope: { region: 'APAC' } }),
        T0,
      );
      expect((await s.listAssignments({ metric: 'booking-tat-sla' })).map((a) => a.id)).toEqual([dropped.id]);
      await s.deleteAssignment(dropped.id);
      expect((await s.listAssignments()).map((a) => a.id)).toEqual([kept.id]);
      await s.deleteAssignment(dropped.id); // no-op
    });
  });
});

describe('SqliteMetricsStateStore authoring persistence', () => {
  it('persists calendars, definitions, and assignments across reopen', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'malkom-metrics-'));
    const file = join(dir, 'state.db');
    try {
      const a = new SqliteMetricsStateStore(file);
      await a.init();
      await a.upsertCalendar(CAL_V1, T0);
      await a.saveDefinitionDraft(definition('confirmed-bookings'), T0);
      const stored = await a.putAssignment(assignment({ scope: { region: 'APAC' } }), T0);
      await a.close();

      const b = new SqliteMetricsStateStore(file);
      await b.init(); // idempotent DDL on an existing file
      expect((await b.getCalendar('india-ops'))?.doc).toEqual(CAL_V1);
      expect((await b.getDefinition('confirmed-bookings'))?.validationStatus).toBe('unchecked');
      expect((await b.listAssignments()).map((x) => x.id)).toEqual([stored.id]);
      await b.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
