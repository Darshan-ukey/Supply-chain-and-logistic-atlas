import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { RulesEngine, type EngineEvent } from '../src/engine.js';
import { SqliteRulesStateStore } from '../src/state/sqlite.js';
import type { Clock } from '../src/ports/clock.js';
import { noopLogger } from '../src/ports/logger.js';
import type { GroupDefinitionInput, RegistryDocInput } from '../src/config/schemas.js';

class TestClock implements Clock {
  constructor(private t = Date.parse('2026-10-01T00:00:00Z')) {}
  now(): Date {
    return new Date(this.t);
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      subQueueField: 'status',
      fields: [
        { id: 'shipperParty', type: 'string' },
        { id: 'portOfLoading', type: 'string' },
        { id: 'portOfDischarge', type: 'string' },
        { id: 'currency', type: 'string' },
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
      ],
    },
  ],
  valueSets: [{ id: 'region:uswc', values: ['USLAX', 'USORE', 'USNYC'] }],
};

const GROUP: GroupDefinitionInput = {
  name: 'Shipper A — USD corridors',
  entity: 'booking',
  scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
  rules: [
    {
      id: 'usd-only',
      when: { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
      then: [
        {
          verb: 'assert',
          field: 'currency',
          check: { op: 'eq', field: 'currency', value: 'USD' },
          message: 'USD only.',
        },
      ],
    },
  ],
};

const BOOKING = {
  id: 'B-7',
  shipperParty: 'A',
  status: 'new',
  portOfDischarge: 'CNNGB',
  currency: 'EUR',
};

interface Env {
  engine: RulesEngine;
  clock: TestClock;
  events: EngineEvent[];
}

async function engineWith(store?: SqliteRulesStateStore): Promise<Env> {
  const clock = new TestClock();
  const events: EngineEvent[] = [];
  const engine = new RulesEngine({
    ...(store ? { stateStore: store } : {}),
    clock,
    logger: noopLogger,
    hooks: { onEvent: (e) => void events.push(e) },
    // Tests jump the clock by months; keep retention out of the way.
    retention: { maxAgeMs: 10 * 365 * 24 * 60 * 60 * 1000 },
  });
  await engine.start();
  await engine.applyRegistry(REGISTRY);
  return { engine, clock, events };
}

describe('lifecycle state machine (§6)', () => {
  it('walks draft → pending → active, snapshots a version, and emits events', async () => {
    const { engine, events } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });
    expect(head.state).toBe('draft');
    expect(head.validity).toBe('valid');

    await engine.submit(head.id, { actor: 'money' });
    const activated = await engine.activate(head.id, { actor: 'priya' });
    expect(activated.state).toBe('active');
    expect(activated.activeVersion).toBe(1);

    const versions = await engine.listGroupVersions(head.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, registryVersion: 1, activatedBy: 'priya' });

    expect(events.map((e) => e.type)).toEqual([
      'registry.applied',
      'group.created',
      'group.submitted',
      'group.activated',
    ]);
    // The audit trail knows who did what.
    expect(activated.transitions.map((t) => `${t.to}:${t.actor}`)).toEqual([
      'draft:money',
      'pending:money',
      'active:priya',
    ]);
  });

  it('enforces transition legality', async () => {
    const { engine } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });

    await expect(engine.activate(head.id, { actor: 'money' })).rejects.toThrow(/cannot activate a draft/);
    await expect(engine.retire(head.id, { actor: 'money' })).rejects.toThrow(/cannot retire a draft/);

    await engine.submit(head.id, { actor: 'money' });
    await expect(engine.submit(head.id, { actor: 'money' })).rejects.toThrow(/requires draft/);
    await expect(
      engine.updateGroup(head.id, GROUP, { actor: 'money' }),
    ).rejects.toThrow(/pending approval/);

    await engine.reject(head.id, { actor: 'priya', reason: 'not yet' });
    expect((await engine.getGroup(head.id)).state).toBe('draft');
  });

  it('blocks activation of an empty group but stores it as a draft', async () => {
    const { engine } = await engineWith();
    const head = await engine.createGroup({ ...GROUP, rules: [] }, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    const failure = await engine.activate(head.id, { actor: 'priya' }).catch((e: unknown) => e);
    expect(failure).toMatchObject({
      code: 'CONFIG_INVALID',
      details: ['rules: an active group must contain at least one rule'],
    });
  });

  it('editing an active group starts a new draft lineage; the active version keeps evaluating', async () => {
    const { engine, clock } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });

    // v1 evaluates.
    const before = await engine.explain('booking', BOOKING);
    expect(before.assertions).toHaveLength(1);

    // Edit: assert EUR instead (a different rule). Active v1 must keep running.
    clock.advance(60_000);
    const edited: GroupDefinitionInput = {
      ...GROUP,
      rules: [
        {
          id: 'eur-only',
          when: { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
          then: [
            { verb: 'assert', field: 'currency', check: { op: 'eq', field: 'currency', value: 'EUR' } },
          ],
        },
      ],
    };
    const afterEdit = await engine.updateGroup(head.id, edited, { actor: 'money' });
    expect(afterEdit.state).toBe('draft');
    expect(afterEdit.activeVersion).toBe(1);

    const stillV1 = await engine.explain('booking', BOOKING);
    expect(stillV1.assertions).toHaveLength(1); // EUR booking still violates v1's USD rule

    // Activate v2: outcome flips, v1 snapshot is superseded but immutable.
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });
    const v2 = await engine.explain('booking', BOOKING);
    expect(v2.assertions).toHaveLength(0); // EUR booking satisfies v2

    const versions = await engine.listGroupVersions(head.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.supersededAt).toBeDefined();
    expect(versions[0]?.definition.rules[0]?.id).toBe('usd-only'); // untouched by the edit
    expect(versions[1]?.definition.rules[0]?.id).toBe('eur-only');
  });

  it('retire stops evaluation and bumps the ruleset version', async () => {
    const { engine } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });
    expect((await engine.explain('booking', BOOKING)).assertions).toHaveLength(1);

    await engine.retire(head.id, { actor: 'money', reason: 'contract ended' });
    const after = await engine.explain('booking', BOOKING);
    expect(after.trace).toHaveLength(0);
    expect(after.rulesetVersion).toBe(2);
  });
});

describe('decision log (§2.5)', () => {
  it('apply() always records; explain() does not by default; queries filter', async () => {
    const { engine, clock } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });

    await engine.explain('booking', BOOKING);
    clock.advance(1000);
    const applied = await engine.apply('booking', BOOKING);
    expect(applied.mode).toBe('apply');

    const all = await engine.queryDecisions({});
    expect(all.total).toBe(1);
    expect(all.decisions[0]).toMatchObject({
      entity: 'booking',
      entityId: 'B-7',
      mode: 'apply',
      rulesetVersion: 1,
      matched: [{ groupId: head.id, version: 1 }],
      counts: { groupsMatched: 1, rulesFired: 1, assertions: 1 },
    });

    expect((await engine.queryDecisions({ entityId: 'B-7' })).total).toBe(1);
    expect((await engine.queryDecisions({ entityId: 'other' })).total).toBe(0);
    await expect(engine.deleteDecisions({})).rejects.toThrow(/refusing unfiltered/);
    expect(await engine.deleteDecisions({ entity: 'booking' })).toBe(1);
  });

  it('point-in-time replay: rulesetVersion + asOf reproduce the recorded verdict (M3 exit)', async () => {
    const { engine, clock } = await engineWith();
    const windowed: GroupDefinitionInput = {
      ...GROUP,
      effectiveFrom: '2026-09-01T00:00:00Z',
      effectiveTo: '2026-11-01T00:00:00Z',
    };
    const head = await engine.createGroup(windowed, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });

    const inWindow = await engine.apply('booking', BOOKING, { asOf: '2026-10-15T00:00:00Z' });
    expect(inWindow.assertions).toHaveLength(1);

    clock.advance(90 * 24 * 60 * 60 * 1000); // wall clock moves months ahead
    const expired = await engine.apply('booking', BOOKING); // asOf defaults to now
    expect(expired.assertions).toHaveLength(0);
    expect(expired.trace[0]?.skipped).toBe('out-of-window');

    // Replay: the recorded decision carries (rulesetVersion, asOf); evaluating
    // the same row at the recorded asOf reproduces the verdict exactly,
    // because expired versions are never deleted.
    const { decisions } = await engine.queryDecisions({ entity: 'booking' });
    const original = decisions.find((d) => d.asOf === '2026-10-15T00:00:00.000Z');
    expect(original).toBeDefined();
    const replay = await engine.apply('booking', BOOKING, { asOf: original!.asOf });
    expect(replay.rulesetVersion).toBe(original!.result.rulesetVersion);
    expect(JSON.stringify({ ...replay, mode: 0 })).toBe(JSON.stringify({ ...original!.result, mode: 0 }));
  });
});

describe('registry idempotency', () => {
  it('re-applying an identical registry is a no-op — no version churn on restart', async () => {
    const { engine, events } = await engineWith();
    const again = await engine.applyRegistry(REGISTRY);
    expect(again.version).toBe(1); // not bumped
    expect(events.filter((e) => e.type === 'registry.applied')).toHaveLength(1);
    const changed = JSON.parse(JSON.stringify(REGISTRY)) as RegistryDocInput;
    changed.valueSets!.push({ id: 'extra', values: ['x'] });
    expect((await engine.applyRegistry(changed)).version).toBe(2);
  });
});

describe('registry drift (§5.3)', () => {
  it('a registry change re-marks groups; pinned active versions keep evaluating', async () => {
    const { engine } = await engineWith();
    const head = await engine.createGroup(GROUP, { actor: 'money' });
    await engine.submit(head.id, { actor: 'money' });
    await engine.activate(head.id, { actor: 'priya' });

    // v2 registry drops portOfDischarge — the group's when-clause breaks.
    const shrunk = JSON.parse(JSON.stringify(REGISTRY)) as RegistryDocInput;
    shrunk.entities![0]!.fields = shrunk.entities![0]!.fields.filter(
      (f) => f.id !== 'portOfDischarge',
    );
    await engine.applyRegistry(shrunk);

    const after = await engine.getGroup(head.id);
    expect(after.validity).toBe('broken'); // loud, never silent

    // The active snapshot pinned registryVersion 1 and still evaluates.
    const result = await engine.explain('booking', BOOKING);
    expect(result.assertions).toHaveLength(1);
  });
});

describe('sqlite store parity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'malkom-rules-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('the full happy path survives a store restart', async () => {
    const file = join(dir, 'state.db');
    const first = await engineWith(new SqliteRulesStateStore(file));
    const head = await first.engine.createGroup(GROUP, { actor: 'money' });
    await first.engine.submit(head.id, { actor: 'money' });
    await first.engine.activate(head.id, { actor: 'priya' });
    await first.engine.apply('booking', BOOKING);
    await first.engine.stop();

    // A fresh engine over the same file sees everything.
    const store = new SqliteRulesStateStore(file);
    const engine = new RulesEngine({ stateStore: store, clock: new TestClock(), logger: noopLogger });
    await engine.start();
    const reloaded = await engine.getGroup(head.id);
    expect(reloaded).toMatchObject({ state: 'active', activeVersion: 1, name: GROUP.name });

    const verdict = await engine.explain('booking', BOOKING);
    expect(verdict.assertions).toHaveLength(1);
    expect(verdict.rulesetVersion).toBe(1);

    const { decisions, total } = await engine.queryDecisions({ entity: 'booking' });
    expect(total).toBe(1);
    expect(decisions[0]?.entityId).toBe('B-7');
    await engine.stop();
  });
});
