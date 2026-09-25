import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { LifecycleGuard, ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * Where this engine meets the two that already solve half its problem.
 * Neither binding reaches into the other engine's store: what crosses is a
 * descriptor, and the host wires it, because the host owns its own tables.
 */

const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
  pauseReasons: [{ code: 'AWAITING_SUPPLIER', label: 'Supplier', maxMinutes: 4320 }],
};
const V = (id: string, caps: string[]): Viewer => ({
  id, name: id, unit: 'unit', system: false,
  grants: [{ capabilities: caps as never, where: {}, note: '' }],
});
const PRIYA = V('usr_priya', ['read', 'raise', 'accept', 'withdraw']);
const DALE = V('usr_dale', ['read', 'answer', 'refer', 'reassign']);

const seed = (guard?: LifecycleGuard) => {
  const engine = new ExceptionEngine(guard === undefined ? {} : { lifecycleGuard: guard });
  registerDesks(engine);
  engine.putReason(REASON);
  const h = engine.handle({
    type: 'raise', idempotencyKey: 'w-1', at: '2026-08-24T08:00:00Z',
    data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-1' }, question: 'q', scope: { office: 'USHOU' } },
  } as never, PRIYA).handover;
  return { engine, h };
};

describe('the allocation binding', () => {
  it('describes a queue the allocation engine can run for one desk', () => {
    const { engine } = seed();
    const queue = engine.allocationQueue({ connectionRef: 'runtime', destination: 'onshore.ap.USHOU' });
    expect(queue).toMatchObject({
      connectionRef: 'runtime',
      queueId: 'onshore.ap.USHOU',
      // Only work actually waiting on this desk. A handover back with the
      // originator is not theirs to pick up.
      allocatableStates: ['QUERY_OPEN'],
      onAssignSet: { transactionStateId: 'QUERY_HELD' },
      onReleaseSet: { transactionStateId: 'QUERY_OPEN' },
    });
  });

  it('refuses to describe a queue for a desk nobody configured', () => {
    const { engine } = seed();
    expect(() => engine.allocationQueue({ connectionRef: 'runtime', destination: 'onshore.ap.MARS' }))
      .toThrow(/not a configured desk/);
  });

  it('produces the row a producer should insert, and never inserts it', () => {
    const { engine, h } = seed();
    const [item] = engine.workItems(PRIYA);
    expect(item).toEqual({
      id: h.id,
      queueId: 'onshore.ap.USHOU',
      subqueueId: 'AP',
      transactionStateId: 'QUERY_OPEN',
      allocatedTo: null,   // allocation writes this, not us
      completedOn: null,
    });
  });

  it('moves the row out of allocatable the moment the desk answers', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'answer', handoverId: h.id, idempotencyKey: 'w-a', at: '2026-08-24T09:00:00Z',
      data: { body: 'ok', fields: { decision: 'approved' } } } as never, DALE);
    expect(engine.workItems(PRIYA)[0]?.transactionStateId).toBe('QUERY_RETURNED');

    engine.handle({ type: 'accept', handoverId: h.id, idempotencyKey: 'w-c', at: '2026-08-24T10:00:00Z',
      data: {} } as never, PRIYA);
    expect(engine.workItems(PRIYA)[0]).toMatchObject({ transactionStateId: 'QUERY_CLOSED', completedOn: '2026-08-24T10:00:00Z' });
  });

  it('reflects a claim as held, so allocation does not hand it out twice', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'reassign', handoverId: h.id, idempotencyKey: 'w-r', at: '2026-08-24T09:00:00Z',
      data: { holderRef: 'usr_dale' } } as never, DALE);
    expect(engine.workItems(PRIYA)[0]).toMatchObject({ transactionStateId: 'QUERY_HELD', allocatedTo: 'usr_dale' });
  });

  it('scopes the work items to the viewer like every other read', () => {
    const { engine } = seed();
    expect(engine.workItems(V('usr_none', []))).toEqual([]);
  });
});

describe('the workflow binding', () => {
  it('publishes a lifecycle an operator can read, with the pauses marked honestly', () => {
    const { engine } = seed();
    const lifecycle = engine.lifecycleDefinition();
    expect(lifecycle.initialState).toBe('WITH_RESOLVER');
    const held = lifecycle.states.filter((state) => state.holdsClock).map((state) => state.key);
    expect(held.sort()).toEqual(['PAUSED', 'REFERRED']);
    const terminal = lifecycle.states.filter((state) => state.terminal).map((state) => state.key);
    expect(terminal.sort()).toEqual(['CLOSED', 'WITHDRAWN']);
    // One SLA number here would lie: budgets are per reason and per leg.
    expect(lifecycle.slaMinutes).toBe(0);
  });

  it('reports the handover’s state in that lifecycle’s vocabulary', () => {
    const { engine, h } = seed();
    expect(engine.lifecycleState(PRIYA, h.id)).toBe('WITH_RESOLVER');
    engine.handle({ type: 'refer', handoverId: h.id, idempotencyKey: 'w-p', at: '2026-08-24T09:00:00Z',
      data: { pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-1' } } as never, DALE);
    expect(engine.lifecycleState(PRIYA, h.id)).toBe('REFERRED');
  });

  it('asks the host’s workflow before a move lands, and refuses in its words', () => {
    const asked: string[] = [];
    const guard: LifecycleGuard = {
      lifecycleId: 'malkom-handover',
      legal: (_item, from, to) => {
        asked.push(`${from}->${to}`);
        return to === 'REFERRED'
          ? { legal: false, reason: 'referral is switched off for this client' }
          : { legal: true, reason: null };
      },
    };
    const { engine, h } = seed(guard);
    expect(() =>
      engine.handle({ type: 'refer', handoverId: h.id, idempotencyKey: 'w-g', at: '2026-08-24T09:00:00Z',
        data: { pauseReason: 'AWAITING_SUPPLIER' } } as never, DALE),
    ).toThrow(/referral is switched off for this client/);

    // Refused before anything was written.
    expect(engine.get(PRIYA, h.id)?.holder).toBe('RESOLVER');
    expect(engine.get(PRIYA, h.id)?.version).toBe(1);

    engine.handle({ type: 'answer', handoverId: h.id, idempotencyKey: 'w-ok', at: '2026-08-24T09:00:00Z',
      data: { body: 'ok', fields: { decision: 'approved' } } } as never, DALE);
    expect(asked).toEqual(['WITH_RESOLVER->REFERRED', 'WITH_RESOLVER->WITH_ORIGINATOR']);
  });

  it('does not consult it for a move that changes no lifecycle state', () => {
    const asked: string[] = [];
    const guard: LifecycleGuard = {
      lifecycleId: 'malkom-handover',
      legal: (_i, from, to) => { asked.push(`${from}->${to}`); return { legal: true, reason: null }; },
    };
    const { engine, h } = seed(guard);
    // A reassign moves work inside the desk; the lifecycle never notices.
    engine.handle({ type: 'reassign', handoverId: h.id, idempotencyKey: 'w-n', at: '2026-08-24T09:00:00Z',
      data: { holderRef: 'usr_dale' } } as never, DALE);
    expect(asked).toEqual([]);
  });

  it('stands on its own invariants when no host workflow is wired', () => {
    const { engine, h } = seed();
    // No guard, and the aggregate still cannot be talked into a bad move.
    expect(() =>
      engine.handle({ type: 'accept', handoverId: h.id, idempotencyKey: 'w-x', at: '2026-08-24T09:00:00Z',
        data: {} } as never, DALE),
    ).toThrow(/no accept grant/);
  });
});
