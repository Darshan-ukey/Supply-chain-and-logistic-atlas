import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { EscalationLadderInput, ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * Escalation buys attention. Only a transfer moves work — and a system where
 * escalating makes something somebody else's problem teaches everybody to
 * escalate. Rungs name roles, because a ladder naming a person breaks the week
 * they take leave.
 */

const B = { respond: { minutes: 100, calendarId: '24x7' }, act: { minutes: 200, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
};

const V = (id: string, caps: string[], wheres: object[] = [{}]): Viewer => ({
  id, name: id, unit: 'unit', system: false,
  grants: wheres.map((where) => ({ capabilities: caps as never, where, note: '' })),
});
const PRIYA = V('usr_priya', ['read', 'raise', 'accept']);
const DALE = V('usr_dale', ['read', 'answer']);
const ADMIN = V('usr_admin', ['administer']);

const GLOBAL_LADDER: EscalationLadderInput = {
  id: 'ap-global', label: 'AP standard', where: {},
  rungs: [
    { atPercent: 80, role: 'desk-lead', at: 'DESK', label: 'At risk' },
    { atPercent: 100, role: 'office-manager', at: 'OFFICE', label: 'Breached' },
    { atPercent: 150, role: 'process-owner', at: 'REGION', label: 'Badly breached' },
  ],
};

const seed = (ladders: EscalationLadderInput[] = [GLOBAL_LADDER]) => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putReason(REASON);
  for (const ladder of ladders) engine.putLadder(ladder, ADMIN);
  const h = engine.handle({
    type: 'raise', idempotencyKey: 'e-1', at: '2026-08-24T08:00:00Z',
    data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-1' }, question: 'q',
            scope: { country: 'US', office: 'USHOU' } },
  } as never, PRIYA).handover;
  return { engine, h };
};

/** 100 minutes of respond budget, so t+n minutes is n% used. */
const at = (minutes: number) => new Date(Date.parse('2026-08-24T08:00:00Z') + minutes * 60_000).toISOString();

describe('one ladder, forty offices', () => {
  it('earns nothing before the first rung', () => {
    const { engine } = seed();
    expect(engine.dueEscalations(PRIYA, {}, at(50))).toEqual([]);
  });

  it('earns the rung its overrun deserves, and names a role not a person', () => {
    const { engine } = seed();
    const [due] = engine.dueEscalations(PRIYA, {}, at(85));
    expect(due?.rung).toMatchObject({ atPercent: 80, role: 'desk-lead', label: 'At risk' });
    expect(due?.side).toBe('RESOLVER');
    expect(due?.audience).toEqual({ region: 'AMER', country: 'US', office: 'USHOU', department: 'AP' });
  });

  it('jumps to the highest rung earned, rather than climbing politely', () => {
    const { engine } = seed();
    // Nobody looked for three days; it does not arrive at 80%.
    const [due] = engine.dueEscalations(PRIYA, {}, at(200));
    expect(due?.rung.atPercent).toBe(150);
    expect(due?.audience).toEqual({ region: 'AMER' }); // process owner, region-wide
  });

  it('lets a narrower ladder beat the global one', () => {
    const { engine } = seed([
      GLOBAL_LADDER,
      { id: 'houston', label: 'Houston', where: { office: 'USHOU' },
        rungs: [{ atPercent: 50, role: 'shift-lead', at: 'DESK', label: 'Houston watches early' }] },
    ]);
    const [due] = engine.dueEscalations(PRIYA, {}, at(60));
    expect(due?.ladderId).toBe('houston');
    expect(due?.rung.role).toBe('shift-lead');
  });

  it('watches the originator’s leg too, not only the desk’s', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'answer', handoverId: h.id, idempotencyKey: 'e-a', at: at(10),
      data: { body: 'ok', fields: { decision: 'approved' } } } as never, DALE);
    // 200 minutes of act budget; 190 minutes later is 95% of the ORIGINATOR's.
    const [due] = engine.dueEscalations(PRIYA, {}, at(200));
    expect(due).toMatchObject({ side: 'ORIGINATOR', ladderId: 'ap-global' });
    expect(due?.rung.atPercent).toBe(80);
  });

  it('stays quiet while the clock is paused, since nobody is overrunning anything', () => {
    const { engine, h } = seed();
    engine.putReason({ ...REASON, pauseReasons: [{ code: 'SUPPLIER', label: 'Supplier', maxMinutes: 4320 }] });
    engine.handle({ type: 'refer', handoverId: h.id, idempotencyKey: 'e-p', at: at(10),
      data: { pauseReason: 'SUPPLIER', waitingOn: 'SUP-1' } } as never,
      V('usr_dale', ['read', 'answer', 'refer']));
    expect(engine.dueEscalations(PRIYA, {}, at(500))).toEqual([]);
  });
});

describe('escalating moves nothing', () => {
  it('leaves the baton, the clock and the desk exactly where they were', () => {
    const { engine, h } = seed();
    const before = engine.get(PRIYA, h.id);
    const after = engine.handle({ type: 'escalate', handoverId: h.id, idempotencyKey: 'e-x', at: at(85),
      data: { atPercent: 80 } } as never, PRIYA).handover;
    expect(after.holder).toBe(before?.holder);
    expect(after.destination).toBe(before?.destination);
    expect(after.segments).toHaveLength(before?.segments.length ?? 0);
    expect(engine.events(PRIYA, h.id).at(-1)?.baton).toBeNull();
  });

  it('does not fire the same rung twice, however many sweeps race', () => {
    const { engine, h } = seed();
    const fire = (key: string) => engine.handle({ type: 'escalate', handoverId: h.id, idempotencyKey: key,
      at: at(85), data: { atPercent: 80 } } as never, PRIYA).handover;
    fire('e-1a');
    expect(engine.dueEscalations(PRIYA, {}, at(85))).toEqual([]);
    expect(fire('e-1b').escalatedAt).toBe(80);
  });

  it('re-arms when the baton passes, so one side never inherits the other’s overrun', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'escalate', handoverId: h.id, idempotencyKey: 'e-r1', at: at(85),
      data: { atPercent: 80 } } as never, PRIYA);
    const answered = engine.handle({ type: 'answer', handoverId: h.id, idempotencyKey: 'e-r2', at: at(90),
      data: { body: 'ok', fields: { decision: 'approved' } } } as never, DALE).handover;
    expect(answered.escalatedAt).toBe(0);
  });

  it('lets anyone who can see it raise the alarm', () => {
    const { engine, h } = seed();
    const watcher = V('usr_watch', ['read']);
    expect(() =>
      engine.handle({ type: 'escalate', handoverId: h.id, idempotencyKey: 'e-w', at: at(85),
        data: { atPercent: 80 } } as never, watcher),
    ).not.toThrow();
  });
});

describe('a reason firing far above its rate', () => {
  const LIMITED: ReasonDefinitionInput = { ...REASON, code: 'FEED_BROKEN',
    rateLimit: { maxPerWindow: 3, windowMinutes: 60, action: 'SUPPRESS' } };

  const flood = (engine: ExceptionEngine, count: number) => {
    for (let n = 0; n < count; n += 1) {
      engine.handle({ type: 'raise', idempotencyKey: `f-${n}`, at: at(n),
        data: { reasonCode: 'FEED_BROKEN', subject: { type: 'task', id: `t-${n}` }, question: 'q',
                scope: { office: 'USHOU' } } } as never, PRIYA);
    }
  };

  it('is suppressed at the ceiling, and says why in terms of the cause', () => {
    const engine = new ExceptionEngine();
    registerDesks(engine);
    engine.putReason(LIMITED);
    flood(engine, 3);
    expect(() => flood(engine, 4)).toThrow(/FEED_BROKEN is suppressed: 3 raised in the last 60 minutes/);
  });

  it('reports how hot it is running before it gets there', () => {
    const engine = new ExceptionEngine();
    registerDesks(engine);
    engine.putReason(LIMITED);
    flood(engine, 2);
    expect(engine.reasonHealth('FEED_BROKEN', {}, at(10))).toMatchObject({
      raised: 2, ceiling: 3, over: false, suppressed: false,
    });
  });

  it('warns without refusing when that is what the reason asks for', () => {
    const engine = new ExceptionEngine();
    registerDesks(engine);
    engine.putReason({ ...LIMITED, code: 'NOISY', rateLimit: { maxPerWindow: 1, windowMinutes: 60, action: 'WARN' } });
    for (const n of [0, 1, 2]) {
      engine.handle({ type: 'raise', idempotencyKey: `w-${n}`, at: at(n),
        data: { reasonCode: 'NOISY', subject: { type: 'task', id: `w-${n}` }, question: 'q', scope: {} } } as never, PRIYA);
    }
    expect(engine.reasonHealth('NOISY', {}, at(5))).toMatchObject({ over: true, suppressed: false });
  });

  it('says nothing about a reason with no ceiling, rather than a meaningless dial', () => {
    const { engine } = seed();
    expect(engine.reasonHealth('COST_APPROVAL')).toBeNull();
  });

  it('lets the window roll past, so a fixed feed is not suppressed forever', () => {
    const engine = new ExceptionEngine();
    registerDesks(engine);
    engine.putReason(LIMITED);
    flood(engine, 3);
    // Two hours later the window has moved on and the ceiling is clear again.
    expect(() =>
      engine.handle({ type: 'raise', idempotencyKey: 'f-later', at: at(180),
        data: { reasonCode: 'FEED_BROKEN', subject: { type: 'task', id: 't-later' }, question: 'q', scope: {} } } as never, PRIYA),
    ).not.toThrow();
  });
});

describe('ladders are governed like everything else', () => {
  it('refuses an author whose grants do not cover the ladder’s scope', () => {
    const engine = new ExceptionEngine();
    registerDesks(engine);
    const houston = V('usr_hou', ['administer'], [{ office: 'USHOU' }]);
    expect(() => engine.putLadder(GLOBAL_LADDER, houston)).toThrow(/no administer grant covering anywhere/);
    expect(() =>
      engine.putLadder({ ...GLOBAL_LADDER, id: 'hou', where: { office: 'USHOU' } }, houston),
    ).not.toThrow();
  });

  it('refuses two rungs at the same threshold', () => {
    const engine = new ExceptionEngine();
    expect(() =>
      engine.putLadder({ id: 'x', label: 'x', rungs: [
        { atPercent: 100, role: 'a', at: 'DESK', label: 'a' },
        { atPercent: 100, role: 'b', at: 'DESK', label: 'b' },
      ] }, ADMIN),
    ).toThrow(/two rungs at 100%/);
  });

  it('records who changed it', () => {
    const engine = new ExceptionEngine();
    engine.putLadder(GLOBAL_LADDER, ADMIN);
    expect(engine.configHistory('ladder', 'ap-global').at(-1)).toMatchObject({ actorId: 'usr_admin', created: true });
  });
});
