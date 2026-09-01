import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asViewer, DESKS, observer, offshore, onshore, registerDesks, run } from './viewers.js';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput } from '../src/schemas.js';
import { InMemoryHandoverStore, SqliteHandoverStore, type HandoverStore } from '../src/store.js';

/**
 * The surface above a single case. Without it there is no resolver desk, no
 * "what am I waiting on", no breach list and nothing for a metrics engine to
 * read — which is exactly what the interrogation harness found the first time
 * it was run against this engine.
 */

const NOW = '2026-08-24T10:00:00Z';

const GRN: ReasonDefinitionInput = {
  code: 'MISSING_GRN', label: 'Goods receipt not posted', subjectTypes: ['task'],
  asks: ['supplierId', 'office'], answerShape: ['grnRef'],
  deflectOn: ['supplierId', 'office'], deflectWithinMinutes: 43_200,
  budgets: { respond: { minutes: 120, calendarId: '24x7' }, act: { minutes: 240, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null },
  clusterBy: 'grnRef', defaultDestination: 'onshore.wh.USDAL',
  pauseReasons: [{ code: 'AWAITING_SUPPLIER', label: 'Supplier', maxMinutes: 4320 }],
};

const OFF = { id: 'usr_priya', name: 'Priya', side: 'ORIGINATOR' } as const;
const OFF2 = { id: 'usr_ravi', name: 'Ravi', side: 'ORIGINATOR' } as const;
const ON = { id: 'usr_dale', name: 'Dale', side: 'RESOLVER' } as const;

let seq = 0;
const seed = (store?: HandoverStore) => {
  const engine = new ExceptionEngine(store === undefined ? {} : { store });
  registerDesks(engine);
  engine.putReason(GRN);
  const raise = (task: string, at: string, actor: typeof OFF, fields: Record<string, unknown>, clusterKey: string | null = null) =>
    run(engine, {
      type: 'raise', idempotencyKey: `q-${(seq += 1)}`, at, actor,
      data: { reasonCode: 'MISSING_GRN', subject: { type: 'task', id: task }, question: `q on ${task}`, fields, clusterKey },
    } as never).handover;
  return { engine, raise };
};

describe('lists', () => {
  it('answers "what am I waiting on" for one raiser only', () => {
    const { engine, raise } = seed();
    raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    raise('t-2', '2026-08-23T10:00:00Z', OFF, { supplierId: 'S2', office: 'USHOU' });
    raise('t-3', '2026-08-23T11:00:00Z', OFF2, { supplierId: 'S3', office: 'USHOU' });

    const mine = engine.list(admin, { createdBy: OFF.id, status: ['OPEN'], holder: ['RESOLVER'] }, NOW);
    expect(mine.map((view) => view.handover.subject.id)).toEqual(['t-1', 't-2']);
    expect(engine.count(admin, { createdBy: OFF2.id })).toBe(1);
  });

  it('answers "what is overdue" and marks it overdue rather than leaving it to the caller', () => {
    const { engine, raise } = seed();
    const old = raise('t-old', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    raise('t-new', '2026-08-24T09:50:00Z', OFF, { supplierId: 'S2', office: 'USHOU' });

    const late = engine.list(admin, { dueBefore: NOW, status: ['OPEN'] }, NOW);
    expect(late.map((view) => view.handover.id)).toEqual([old.id]);
    expect(late[0]?.overdue).toBe(true);
    expect(late[0]?.budgetUsed).toBeGreaterThan(1);
  });

  it('sorts undated work last on a deadline order rather than first', () => {
    const { engine, raise } = seed();
    engine.putReason({ ...GRN, code: 'NO_BUDGET', budgets: { respond: null, act: null, referralMaxMinutes: null, autoAcceptMinutes: null } });
    raise('t-dated', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    run(engine, {
      type: 'raise', idempotencyKey: 'q-nb', at: '2026-08-22T09:00:00Z', actor: OFF,
      data: { reasonCode: 'NO_BUDGET', subject: { type: 'task', id: 't-undated' }, question: 'q', fields: { supplierId: 'S9', office: 'USHOU' } },
    } as never);
    const ordered = engine.list(admin, { order: 'due' }, NOW).map((view) => view.handover.subject.id);
    expect(ordered).toEqual(['t-dated', 't-undated']);
  });
});

describe('the resolver desk', () => {
  it('collapses a cluster to one row carrying its members', () => {
    const { engine, raise } = seed();
    for (const task of ['t-1', 't-2', 't-3']) raise(task, '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' }, 'GRN-5512');
    raise('t-solo', '2026-08-23T10:00:00Z', OFF, { supplierId: 'S2', office: 'USHOU' });

    const desk = engine.desk(admin, 'onshore.wh.USDAL', NOW);
    expect(desk).toHaveLength(2); // three invoices, one question — plus the solo
    expect(desk[0]?.clusterSize).toBe(3);
    expect(desk[0]?.clusterMembers).toHaveLength(3);
    expect(desk[1]?.clusterSize).toBe(1);
  });

  it('shows only what this desk owes, and only while it owes it', () => {
    const { engine, raise } = seed();
    const mine = raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    const answered = raise('t-2', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S2', office: 'USHOU' });
    run(engine, {
      type: 'answer', handoverId: answered.id, idempotencyKey: 'q-a', at: '2026-08-23T10:00:00Z',
      actor: ON, data: { body: 'ok', fields: { grnRef: 'G1' } },
    } as never);

    const desk = engine.desk(admin, 'onshore.wh.USDAL', NOW);
    // The answered one moved to the originator, so it leaves this desk.
    expect(desk.map((row) => row.handover.id)).toEqual([mine.id]);
  });
});

describe('facts for the metrics registry', () => {
  it('counts a breach per round, not per case', () => {
    const { engine, raise } = seed();
    const h = raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    const step = (type: string, at: string, actor: typeof OFF | typeof ON, data = {}) =>
      run(engine, { type, handoverId: h.id, idempotencyKey: `${type}-${at}`, at, actor, data } as never);
    // Round 1: answered in 60m, inside the 120m budget.
    step('answer', '2026-08-23T10:00:00Z', ON, { body: 'x', fields: { grnRef: 'G1' } });
    // Round 2: five hours, well past it.
    step('requery', '2026-08-23T11:00:00Z', OFF);
    step('answer', '2026-08-23T16:00:00Z', ON, { body: 'y', fields: { grnRef: 'G2' } });

    const fact = engine.facts(admin, {}, NOW)[0];
    expect(fact?.rounds).toBe(2);
    expect(fact?.respondBreaches).toBe(1); // round 2 only
    expect(fact?.resolverMinutes).toBe(360);
  });

  it('does not let a pause hide inside the resolver leg', () => {
    const { engine, raise } = seed();
    const h = raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' });
    const step = (type: string, at: string, data = {}) =>
      run(engine, { type, handoverId: h.id, idempotencyKey: `${type}-${at}`, at, actor: ON, data } as never);
    step('refer', '2026-08-23T09:30:00Z', { pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-114' });
    step('external-response', '2026-08-23T14:30:00Z');
    step('answer', '2026-08-23T15:00:00Z', { body: 'x', fields: { grnRef: 'G1' } });

    const fact = engine.facts(admin, {}, NOW)[0];
    expect(fact?.pausedMinutes).toBe(300);
    expect(fact?.pauseCount).toBe(1);
    // And it says on whom — "30% of ageing is paused" is useless without this.
    // One row per pause, because one handover can wait on three things.
    const pauses = engine.pauseFacts(admin, {}, NOW);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]).toMatchObject({
      pauseReason: 'AWAITING_SUPPLIER', kind: 'REFERRAL', waitingOn: 'SUP-114', minutes: 300, open: false,
    });
    // 30 minutes before the referral, 30 after: the pause is not the desk's.
    expect(fact?.resolverMinutes).toBe(60);
    expect(fact?.respondBreaches).toBe(0);
  });
});

describe('deflection', () => {
  it('is keyed on what the raiser knows, not on what the answer turns out to be', () => {
    const { engine, raise } = seed();
    const settled = raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'SUP-114', office: 'USHOU' });
    run(engine, {
      type: 'answer', handoverId: settled.id, idempotencyKey: 'd-a', at: '2026-08-23T10:00:00Z',
      actor: ON, data: { body: 'GRN 5512.', fields: { grnRef: 'GRN-5512' } },
    } as never);
    run(engine, {
      type: 'accept', handoverId: settled.id, idempotencyKey: 'd-c', at: '2026-08-23T11:00:00Z', actor: OFF, data: {},
    } as never);

    // The next raiser knows the supplier and the office. They do NOT know the
    // GRN — that is the question. Keying on the cluster would be circular.
    const hit = engine.deflectionCandidate(admin, 'MISSING_GRN', { supplierId: 'SUP-114', office: 'USHOU' }, NOW);
    expect(hit?.body).toBe('GRN 5512.');
    expect(hit?.fields).toEqual({ grnRef: 'GRN-5512' });
    expect(engine.deflectionCandidate(admin, 'MISSING_GRN', { supplierId: 'SUP-999', office: 'USHOU' }, NOW)).toBeNull();
  });

  it('offers nothing from an answer that was never accepted, or that has gone stale', () => {
    const { engine, raise } = seed();
    const unaccepted = raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'SUP-1', office: 'USHOU' });
    run(engine, {
      type: 'answer', handoverId: unaccepted.id, idempotencyKey: 'u-a', at: '2026-08-23T10:00:00Z',
      actor: ON, data: { body: 'maybe', fields: { grnRef: 'G?' } },
    } as never);
    // Answered but not accepted: nobody has vouched for it yet.
    expect(engine.deflectionCandidate(admin, 'MISSING_GRN', { supplierId: 'SUP-1', office: 'USHOU' }, NOW)).toBeNull();

    const stale = seed();
    stale.engine.putReason({ ...GRN, deflectWithinMinutes: 60 });
    const old = stale.raise('t-2', '2026-08-20T09:00:00Z', OFF, { supplierId: 'SUP-2', office: 'USHOU' });
    run(stale.engine, { type: 'answer', handoverId: old.id, idempotencyKey: 's-a', at: '2026-08-20T10:00:00Z', actor: ON, data: { body: 'old', fields: { grnRef: 'G0' } } } as never);
    run(stale.engine, { type: 'accept', handoverId: old.id, idempotencyKey: 's-c', at: '2026-08-20T11:00:00Z', actor: OFF, data: {} } as never);
    expect(stale.engine.deflectionCandidate(admin, 'MISSING_GRN', { supplierId: 'SUP-2', office: 'USHOU' }, NOW)).toBeNull();
  });

  it('declines to guess when the reason names no deflection fields', () => {
    const { engine } = seed();
    engine.putReason({ ...GRN, code: 'NO_DEFLECT', deflectOn: [] });
    expect(engine.deflectionCandidate(admin, 'NO_DEFLECT', { supplierId: 'SUP-114', office: 'USHOU' }, NOW)).toBeNull();
  });
});

describe('the two stores agree', () => {
  it('returns the same rows for the same query, in memory and in SQLite', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'malkom-q-'));
    const sqlite = new SqliteHandoverStore(path.join(dir, 'state.db'));
    try {
      // The filter is written twice — a JS predicate and a SQL WHERE. This is
      // the test that keeps them from drifting apart.
      const shapes = [
        { status: ['OPEN'] },
        { holder: ['RESOLVER'], destination: ['onshore.wh.USDAL'] },
        { createdBy: OFF.id, order: 'due' as const },
        { dueBefore: NOW },
        { reasonCode: ['MISSING_GRN'], raisedAfter: '2026-08-23T09:30:00Z' },
        { clusterKey: 'GRN-5512' },
        { deflectionKey: 'supplierId=S1|office=USHOU' },
        { limit: 2, offset: 1, order: 'raised' as const },
      ];
      const build = (store: HandoverStore) => {
        seq = 0; // same ids on both sides
        const { engine, raise } = seed(store);
        raise('t-1', '2026-08-23T09:00:00Z', OFF, { supplierId: 'S1', office: 'USHOU' }, 'GRN-5512');
        raise('t-2', '2026-08-23T10:00:00Z', OFF, { supplierId: 'S2', office: 'USHOU' }, 'GRN-5512');
        raise('t-3', '2026-08-23T11:00:00Z', OFF2, { supplierId: 'S3', office: 'USDAL' });
        raise('t-4', '2026-08-24T09:55:00Z', OFF, { supplierId: 'S4', office: 'USHOU' });
        return engine;
      };
      const memory = build(new InMemoryHandoverStore());
      const durable = build(sqlite);
      for (const shape of shapes) {
        const left = memory.list(admin, shape, NOW).map((view) => view.handover.subject.id);
        const right = durable.list(admin, shape, NOW).map((view) => view.handover.subject.id);
        expect(right, `query ${JSON.stringify(shape)}`).toEqual(left);
        expect(durable.count(admin, shape)).toBe(memory.count(admin, shape));
      }
    } finally {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
