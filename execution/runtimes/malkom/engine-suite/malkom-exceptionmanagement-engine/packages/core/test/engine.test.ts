import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asViewer, DESKS, observer, offshore, onshore, registerDesks, run } from './viewers.js';
import { StaticCalendarProvider, type BusinessCalendar } from '../src/calendar.js';
import { ExceptionEngine, EngineConflictError, EngineValidationError } from '../src/engine.js';
import { elapsedMinutesOf, InvariantViolation, totalsOf } from '../src/ledger.js';
import type { ReasonDefinitionInput } from '../src/schemas.js';
import { SqliteHandoverStore } from '../src/store.js';

const KOLKATA: BusinessCalendar = {
  id: 'offshore-kolkata', timezone: 'Asia/Kolkata', workdays: [1, 2, 3, 4, 5],
  start: '09:00', end: '18:00', holidays: [],
};
const HOUSTON: BusinessCalendar = {
  id: 'onshore-houston', timezone: 'America/Chicago', workdays: [1, 2, 3, 4, 5],
  start: '09:00', end: '18:00', holidays: [],
};

/** Deterministic ids, so an event log is reproducible across runs. */
const counting = () => {
  let n = 0;
  return (kind: 'handover' | 'event'): string => {
    n += 1;
    return `${kind === 'handover' ? 'hnd' : 'evt'}_${String(n).padStart(4, '0')}`;
  };
};

const COST_APPROVAL: ReasonDefinitionInput = {
  code: 'COST_APPROVAL',
  label: 'Cost approval needed',
  subjectTypes: ['invoice'],
  asks: ['amount', 'costCentre'],
  answerShape: ['decision', 'approvedAmount'],
  applyOnAccept: { approvedAmount: 'fields.approvedCost' },
  budgets: {
    respond: { minutes: 240, calendarId: '24x7' },
    act: { minutes: 480, calendarId: '24x7' },
    referralMaxMinutes: 4320,
    autoAcceptMinutes: 2880,
  },
  clusterBy: 'workOrderRef',
  defaultDestination: 'onshore.ap.USHOU',
  pauseReasons: [{ code: 'AWAITING_SUPPLIER', label: 'Waiting on the supplier', maxMinutes: 4320 }],
};

const OFFSHORE = { id: 'usr_off', name: 'Priya', side: 'ORIGINATOR' } as const;
const ONSHORE = { id: 'usr_on', name: 'Dale', side: 'RESOLVER' } as const;

const engineWith = (reason: ReasonDefinitionInput = COST_APPROVAL): ExceptionEngine => {
  const engine = new ExceptionEngine({ newId: counting() });
  registerDesks(engine);
  engine.putReason(reason);
  return engine;
};

const raise = (engine: ExceptionEngine, at = '2026-08-21T09:00:00Z') =>
  run(engine, {
    type: 'raise', idempotencyKey: `raise:${at}`, at, actor: OFFSHORE,
    data: {
      reasonCode: 'COST_APPROVAL',
      subject: { type: 'invoice', id: 'INV-9001', path: 'fields.approvedCost' },
      question: 'Work order not updated — approve the cost as invoiced?',
      fields: { amount: '1840.00 USD', costCentre: 'CC-4402' },
      clusterKey: 'WO-88213',
    },
  });

describe('the worked handover — Figure 1, as arithmetic', () => {
  it('splits eleven hours forty into 6h10 onshore, 3h50 offshore and 1h40 paused', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    const id = handover.id;
    const step = (type: string, at: string, actor: typeof OFFSHORE | typeof ONSHORE, data = {}) =>
      run(engine, { type: type as 'answer', handoverId: id, idempotencyKey: `${type}:${at}`, at, actor, data });

    step('answer', '2026-08-21T11:30:00Z', ONSHORE, { body: 'Approved at the lower figure.', fields: { decision: 'approved', approvedAmount: '1740.00 USD' } });
    step('requery', '2026-08-21T13:30:00Z', OFFSHORE);
    step('refer', '2026-08-21T15:10:00Z', ONSHORE, { pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-114' });
    step('external-response', '2026-08-21T16:50:00Z', ONSHORE);
    step('answer', '2026-08-21T18:50:00Z', ONSHORE, { body: 'Supplier confirmed. Approved in full.', fields: { decision: 'approved', approvedAmount: '1840.00 USD' } });
    const final = step('accept', '2026-08-21T20:40:00Z', OFFSHORE).handover;

    const totals = totalsOf(final.segments);
    expect(totals.resolver).toBe(370); // 6h 10m
    expect(totals.originator).toBe(230); // 3h 50m
    expect(totals.paused).toBe(100); // 1h 40m

    // The identity from §1: no term is a residual.
    const age = elapsedMinutesOf(final.segments, '2026-08-21T20:40:00Z');
    expect(age).toBe(700);
    expect(totals.resolver + totals.originator + totals.paused).toBe(age);

    expect(final.round).toBe(2);
    expect(final.status).toBe('ACCEPTED');
    // applyOnAccept: the answer fills the field it was asked about.
    expect(final.appliedOnAccept).toEqual({ 'fields.approvedCost': '1840.00 USD' });
  });

  it('records a baton hand-off on every pass and nothing on a reassign', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    run(engine, {
      type: 'reassign', handoverId: handover.id, idempotencyKey: 'r1', at: '2026-08-21T10:00:00Z',
      actor: ONSHORE, data: { holderRef: 'usr_on_2' },
    });
    const passes = engine.events(admin, handover.id).filter((event) => event.baton !== null);
    expect(passes).toHaveLength(1); // the raise itself; the reassign passed nothing
  });
});

describe('invariant 1 — only the originating side reaches a terminal state', () => {
  it('refuses an accept from the resolver', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'a1', at: '2026-08-21T10:00:00Z',
      actor: ONSHORE, data: { body: 'done', fields: { decision: 'approved', approvedAmount: '1.00 USD' } },
    });
    expect(() =>
      run(engine, {
        type: 'accept', handoverId: handover.id, idempotencyKey: 'x1', at: '2026-08-21T10:05:00Z',
        actor: ONSHORE, data: {},
      }),
    ).toThrow(/no accept grant/);
    expect(engine.get(admin, handover.id)?.status).toBe('OPEN');
  });

  it('lets a service-desk shape close itself through auto-accept, still measuring the return leg', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'a2', at: '2026-08-21T11:00:00Z',
      actor: ONSHORE, data: { body: 'done', fields: { decision: 'approved', approvedAmount: '1.00 USD' } },
    });
    const closed = run(engine, {
      type: 'auto-accept', handoverId: handover.id, idempotencyKey: 'auto', at: '2026-08-23T11:00:00Z',
      actor: { id: 'system', name: 'engine', side: 'NONE' }, data: {},
    }).handover;
    expect(closed.status).toBe('ACCEPTED');
    expect(closed.closedBy).toBe('system');
    // The originator's silence is recorded, not hidden: two days of it.
    expect(totalsOf(closed.segments).originator).toBe(2880);
  });
});

describe('invariant 2 — clocks are monotonic', () => {
  it('never reduces any party total across a random command walk', () => {
    // A seeded walk: reproducible, and it exercises orderings nobody wrote by hand.
    let seed = 20260821;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const moves = ['answer', 'requery', 'refer', 'external-response', 'reassign', 'reroute'] as const;

    for (let trial = 0; trial < 40; trial += 1) {
      const engine = engineWith();
      const { handover } = raise(engine);
      let previous = totalsOf(handover.segments);
      let minute = 0;
      for (let step = 0; step < 12; step += 1) {
        minute += 1 + Math.floor(random() * 90);
        const type = moves[Math.floor(random() * moves.length)] ?? 'answer';
        const actor = type === 'requery' ? OFFSHORE : ONSHORE;
        const at = new Date(Date.parse('2026-08-21T09:00:00Z') + minute * 60_000).toISOString();
        try {
          const result = run(engine, {
            type, handoverId: handover.id, idempotencyKey: `${trial}:${step}`, at, actor,
            data: {
              body: 'x', fields: { decision: 'approved', approvedAmount: '1.00 USD' },
              holderRef: 'usr_on_2', destination: 'onshore.ap.USDAL', pauseReason: 'AWAITING_SUPPLIER',
            },
          });
          const now = totalsOf(result.handover.segments);
          expect(now.originator).toBeGreaterThanOrEqual(previous.originator);
          expect(now.resolver).toBeGreaterThanOrEqual(previous.resolver);
          expect(now.paused).toBeGreaterThanOrEqual(previous.paused);
          previous = now;
        } catch (error) {
          // An illegal move for the current holder is a refusal, never a
          // rewound clock — that distinction is what this asserts.
          expect(error).toBeInstanceOf(EngineValidationError);
          expect(error).not.toBeInstanceOf(InvariantViolation);
        }
      }
    }
  });

  it('keeps the resolver clock running across a reassign and a reroute', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    run(engine, {
      type: 'reassign', handoverId: handover.id, idempotencyKey: 'ra', at: '2026-08-21T10:00:00Z',
      actor: ONSHORE, data: { holderRef: 'usr_on_2' },
    });
    run(engine, {
      type: 'reroute', handoverId: handover.id, idempotencyKey: 'rr', at: '2026-08-21T10:30:00Z',
      actor: ONSHORE, data: { destination: 'onshore.ap.USDAL' },
    });
    const answered = run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'an', at: '2026-08-21T12:00:00Z',
      actor: ONSHORE, data: { body: 'ok', fields: { decision: 'approved', approvedAmount: '1.00 USD' } },
    }).handover;
    // Three hours from the raise, not ninety minutes from the reroute.
    expect(totalsOf(answered.segments).resolver).toBe(180);
    expect(answered.segments.filter((segment) => segment.side === 'RESOLVER')).toHaveLength(1);
  });
});

describe('the reason is a contract', () => {
  it('refuses an answer that cannot close the question', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    expect(() =>
      run(engine, {
        type: 'answer', handoverId: handover.id, idempotencyKey: 'bad', at: '2026-08-21T10:00:00Z',
        actor: ONSHORE, data: { body: 'will check and revert' },
      }),
    ).toThrow(/cannot close the question/);
  });

  it('refuses a raise that is missing what the reason asks for', () => {
    const engine = engineWith();
    expect(() =>
      run(engine, {
        type: 'raise', idempotencyKey: 'thin', at: '2026-08-21T09:00:00Z', actor: OFFSHORE,
        data: {
          reasonCode: 'COST_APPROVAL',
          subject: { type: 'invoice', id: 'INV-1' },
          question: 'approve?', fields: { amount: '1.00 USD' },
        },
      }),
    ).toThrow(/answerable in one round/);
  });

  it('refuses a reason whose apply mapping reads a field it never asks for', () => {
    const engine = new ExceptionEngine({ newId: counting() });
  registerDesks(engine);
    expect(() =>
      engine.putReason({ ...COST_APPROVAL, applyOnAccept: { notAsked: 'fields.x' } }),
    ).toThrow(/maps answer fields it never asks for/);
  });

  it('refuses an unbounded pause', () => {
    const engine = engineWith({ ...COST_APPROVAL, pauseReasons: [], budgets: { ...COST_APPROVAL.budgets, referralMaxMinutes: null } });
    const { handover } = raise(engine);
    expect(() =>
      run(engine, {
        type: 'pause', handoverId: handover.id, idempotencyKey: 'p', at: '2026-08-21T10:00:00Z',
        actor: ONSHORE, data: { pauseReason: 'JUST_BECAUSE' },
      }),
    ).toThrow(/not a bounded pause reason/);
  });
});

describe('a leg with no budget is still measured', () => {
  it('sets no due time on the return leg but accrues the time anyway', () => {
    const engine = engineWith({
      ...COST_APPROVAL,
      budgets: { respond: { minutes: 240, calendarId: '24x7' }, act: null, referralMaxMinutes: 4320, autoAcceptMinutes: null },
    });
    const { handover } = raise(engine);
    const answered = run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'a', at: '2026-08-21T11:00:00Z',
      actor: ONSHORE, data: { body: 'ok', fields: { decision: 'approved', approvedAmount: '1.00 USD' } },
    }).handover;
    expect(answered.dueAt).toBeNull();
    const accepted = run(engine, {
      type: 'accept', handoverId: handover.id, idempotencyKey: 'ac', at: '2026-08-21T15:00:00Z',
      actor: OFFSHORE, data: {},
    }).handover;
    expect(totalsOf(accepted.segments).originator).toBe(240);
  });
});

describe('each leg runs in its own party calendar', () => {
  it('measures the resolver in Houston hours and the originator in Kolkata hours', () => {
    const engine = new ExceptionEngine({
      newId: counting(),
      calendars: new StaticCalendarProvider([KOLKATA, HOUSTON]),
    });
  registerDesks(engine);
    engine.putReason({
      ...COST_APPROVAL,
      budgets: {
        respond: { minutes: 240, calendarId: HOUSTON.id },
        act: { minutes: 480, calendarId: KOLKATA.id },
        referralMaxMinutes: 4320, autoAcceptMinutes: null,
      },
    });
    // Raised 16:40 Friday IST = 11:10 UTC, which is 06:10 in Houston — before
    // that desk opens. Answered 16:00 Houston Friday = 21:00 UTC.
    const { handover } = run(engine, {
      type: 'raise', idempotencyKey: 'r', at: '2026-08-21T11:10:00Z', actor: OFFSHORE,
      data: {
        reasonCode: 'COST_APPROVAL', subject: { type: 'invoice', id: 'INV-2' },
        question: 'approve?', fields: { amount: '1.00 USD', costCentre: 'CC-1' },
      },
    });
    const answered = run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'a', at: '2026-08-21T21:00:00Z',
      actor: ONSHORE, data: { body: 'ok', fields: { decision: 'approved', approvedAmount: '1.00 USD' } },
    }).handover;
    // Nine hours fifty of wall clock; seven hours of Houston working time,
    // because Houston was shut for the first 2h50 of it.
    expect(elapsedMinutesOf(answered.segments, '2026-08-21T21:00:00Z')).toBe(590);
    expect(totalsOf(answered.segments).resolver).toBe(420);
  });
});

describe('writes are safe to retry and refuse to clobber', () => {
  it('replays an idempotency key without writing again', () => {
    const engine = engineWith();
    const first = raise(engine);
    const again = raise(engine);
    expect(again.replayed).toBe(true);
    expect(again.handover.id).toBe(first.handover.id);
    expect(engine.events(admin, first.handover.id)).toHaveLength(1);
  });

  it('refuses a stale expected version and says what the current one is', () => {
    const engine = engineWith();
    const { handover } = raise(engine);
    run(engine, {
      type: 'reassign', handoverId: handover.id, idempotencyKey: 'k1', at: '2026-08-21T10:00:00Z',
      actor: ONSHORE, data: { holderRef: 'usr_on_2' },
    });
    try {
      run(engine, {
        type: 'reassign', handoverId: handover.id, idempotencyKey: 'k2', at: '2026-08-21T10:10:00Z',
        actor: ONSHORE, expectedVersion: 1, data: { holderRef: 'usr_on_3' },
      });
      expect.unreachable('a stale write should not land');
    } catch (error) {
      expect(error).toBeInstanceOf(EngineConflictError);
      expect((error as EngineConflictError).currentVersion).toBe(2);
    }
  });
});

describe('durability', () => {
  it('round-trips a handover, its events and its idempotency through SQLite', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'malkom-exc-'));
    const store = new SqliteHandoverStore(path.join(dir, 'state.db'));
    try {
      const engine = new ExceptionEngine({ store, newId: counting() });
  registerDesks(engine);
      engine.putReason(COST_APPROVAL);
      const { handover } = raise(engine);
      run(engine, {
        type: 'answer', handoverId: handover.id, idempotencyKey: 'a', at: '2026-08-21T11:30:00Z',
        actor: ONSHORE, data: { body: 'ok', fields: { decision: 'approved', approvedAmount: '9.00 USD' } },
      });

      // A second engine over the same file — the restart case.
      const reopened = new ExceptionEngine({ store, newId: counting() });
  registerDesks(reopened);
      const loaded = reopened.get(admin, handover.id);
      expect(loaded?.version).toBe(2);
      expect(loaded?.holder).toBe('ORIGINATOR');
      expect(reopened.events(admin, handover.id)).toHaveLength(2);
      expect(store.bySubject('invoice', 'INV-9001')).toHaveLength(1);
      expect(store.byCluster('WO-88213')).toHaveLength(1);
      // Elapsed time survives a restart because it was never stored.
      expect(totalsOf(loaded?.segments ?? []).resolver).toBe(150);
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
