import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * Role is what you may do. Grant is what you may do it to. A "resolver" is not
 * a kind of person — it is somebody holding a resolver-side capability over
 * the desk a particular handover sits on.
 */

const NOW = '2026-08-24T10:00:00Z';
const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };

const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
};

const viewer = (id: string, capabilities: string[], wheres: object[], unit = ''): Viewer => ({
  id, name: id, unit, system: false,
  grants: wheres.map((where) => ({ capabilities: capabilities as never, where, note: '' })),
});

/** Raises everywhere; answers nowhere. The offshore processor. */
const PRIYA = viewer('usr_priya', ['read', 'raise', 'requery', 'accept', 'withdraw'], [{}], 'Offshore AP');

const seed = () => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putReason(REASON);
  const raise = (id: string, destination: string, scope: object, by: Viewer = PRIYA) =>
    engine.handle({
      type: 'raise', idempotencyKey: `a-${id}`, at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id }, question: 'approve?', destination, scope },
    } as never, by).handover;
  return { engine, raise };
};

describe('a resolver sees only the offices assigned to them', () => {
  it('two named offices, and nothing else', () => {
    const { engine, raise } = seed();
    raise('t-hou', 'onshore.ap.USHOU', { country: 'US', office: 'USHOU' });
    raise('t-dal', 'onshore.ap.USDAL', { country: 'US', office: 'USDAL' });
    raise('t-rtm', 'onshore.ap.EMEA', { country: 'NL', office: 'NLRTM' });

    const dale = viewer('usr_dale', ['read', 'answer'], [{ office: 'USHOU' }, { office: 'USDAL' }], 'AP US');
    expect(engine.list(dale, {}, NOW).map((v) => v.handover.subject.id).sort()).toEqual(['t-dal', 't-hou']);
    expect(engine.count(dale, {})).toBe(2);
    // Not a filter someone forgot to apply: the row is not there to be read.
    expect(engine.get(dale, engine.list(PRIYA, { subjectType: 'task' }, NOW)
      .find((v) => v.handover.subject.id === 't-rtm')!.handover.id)).toBeNull();
  });

  it('one office only', () => {
    const { engine, raise } = seed();
    raise('t-hou', 'onshore.ap.USHOU', { office: 'USHOU' });
    raise('t-dal', 'onshore.ap.USDAL', { office: 'USDAL' });
    const houstonOnly = viewer('usr_h', ['read', 'answer'], [{ office: 'USHOU' }]);
    expect(engine.list(houstonOnly, {}, NOW).map((v) => v.handover.subject.id)).toEqual(['t-hou']);
  });

  it('everything under a region', () => {
    const { engine, raise } = seed();
    raise('t-rtm', 'onshore.ap.EMEA', { country: 'NL' });
    raise('t-fra', 'onshore.ap.DEFRA', { country: 'DE' });
    raise('t-hou', 'onshore.ap.USHOU', { country: 'US' });

    const emeaLead = viewer('usr_lead', ['read', 'answer'], [{ region: 'EMEA' }], 'AP EMEA');
    // Two desks in EMEA, neither named — the region grant expands to both.
    expect(engine.list(emeaLead, {}, NOW).map((v) => v.handover.subject.id).sort()).toEqual(['t-fra', 't-rtm']);
  });

  it('a department grant, so a warehouse desk never sees AP’s questions', () => {
    const { engine, raise } = seed();
    raise('t-ap', 'onshore.ap.USHOU', { office: 'USHOU' });
    raise('t-wh', 'onshore.wh.USHOU', { office: 'USHOU' });
    const warehouse = viewer('usr_w', ['read', 'answer'], [{ department: 'WAREHOUSE' }]);
    expect(engine.list(warehouse, {}, NOW).map((v) => v.handover.subject.id)).toEqual(['t-wh']);
  });

  it('denies by default: no grants, no rows — never everything', () => {
    const { engine, raise } = seed();
    raise('t-hou', 'onshore.ap.USHOU', { office: 'USHOU' });
    const nobody = viewer('usr_new', [], []);
    expect(engine.list(nobody, {}, NOW)).toEqual([]);
    expect(engine.count(nobody, {})).toBe(0);
    expect(engine.desk(nobody, 'onshore.ap.USHOU', NOW)).toEqual([]);
    expect(engine.facts(nobody, {}, NOW)).toEqual([]);
  });
});

describe('side is a fact about the handover, not a field on the person', () => {
  it('lets an onshore lead raise a query — which a shore flag makes impossible', () => {
    const { engine } = seed();
    // Dale staffs the Houston desk AND needs to ask the warehouse a question.
    const dale = viewer('usr_dale', ['read', 'answer', 'raise', 'accept'], [{}], 'AP Houston');
    const raised = engine.handle({
      type: 'raise', idempotencyKey: 'a-lead', at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-x' },
              question: 'approve?', destination: 'onshore.wh.USHOU', scope: { office: 'USHOU' } },
    } as never, dale).handover;
    expect(raised.createdBy).toBe('usr_dale');
    expect(engine.events(dale, raised.id)[0]?.actor.side).toBe('ORIGINATOR');
  });

  it('makes the same person originator on one handover and resolver on another', () => {
    const { engine, raise } = seed();
    const dale = viewer('usr_dale', ['read', 'answer', 'raise', 'accept'], [{}], 'AP Houston');
    const mine = engine.handle({
      type: 'raise', idempotencyKey: 'a-mine', at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-mine' },
              question: 'q', destination: 'onshore.wh.USHOU', scope: {} },
    } as never, dale).handover;
    const theirs = raise('t-theirs', 'onshore.ap.USHOU', {});

    expect(engine.events(dale, mine.id)[0]?.actor.side).toBe('ORIGINATOR');
    const answered = engine.handle({
      type: 'answer', handoverId: theirs.id, idempotencyKey: 'a-ans', at: '2026-08-24T09:00:00Z',
      data: { body: 'ok', fields: { decision: 'approved' } },
    } as never, dale);
    expect(answered.event.actor.side).toBe('RESOLVER');
  });

  it('refuses to let anyone answer the question they asked, however wide their grants', () => {
    const { engine } = seed();
    const everything = viewer('usr_boss', ['read', 'raise', 'answer', 'accept'], [{}], 'Operations');
    const mine = engine.handle({
      type: 'raise', idempotencyKey: 'a-self', at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-self' },
              question: 'q', destination: 'onshore.ap.USHOU', scope: {} },
    } as never, everything).handover;

    expect(() =>
      engine.handle({
        type: 'answer', handoverId: mine.id, idempotencyKey: 'a-self-2', at: '2026-08-24T09:00:00Z',
        data: { body: 'ok', fields: { decision: 'approved' } },
      } as never, everything),
    ).toThrow(/you raised this; the desk it went to answers it/);
  });

  it('stamps the unit the actor stood in, so a reorg cannot rewrite history', () => {
    const { engine, raise } = seed();
    const h = raise('t-unit', 'onshore.ap.USHOU', {});
    const actor = engine.events(PRIYA, h.id)[0]?.actor;
    expect(actor).toMatchObject({ id: 'usr_priya', unit: 'Offshore AP', side: 'ORIGINATOR' });
  });
});

describe('grants add, they never subtract', () => {
  it('reaches the union of two grants and nothing outside it', () => {
    const { engine, raise } = seed();
    raise('t-hou', 'onshore.ap.USHOU', { office: 'USHOU' });
    raise('t-fra', 'onshore.ap.DEFRA', { office: 'DEFRA' });
    raise('t-dal', 'onshore.ap.USDAL', { office: 'USDAL' });
    const two = viewer('usr_two', ['read'], [{ office: 'USHOU' }, { office: 'DEFRA' }]);
    expect(engine.list(two, {}, NOW).map((v) => v.handover.subject.id).sort()).toEqual(['t-fra', 't-hou']);
  });

  it('lets a raiser follow their own question into a desk they otherwise cannot see', () => {
    const { engine } = seed();
    // Priya may read nothing by scope, but she raised it.
    const narrow = viewer('usr_narrow', ['read', 'raise'], [{ office: 'NOWHERE' }]);
    const mine = engine.handle({
      type: 'raise', idempotencyKey: 'a-follow', at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-follow' },
              question: 'q', destination: 'onshore.ap.USHOU', scope: { office: 'USHOU' } },
    } as never, narrow).handover;
    expect(engine.get(narrow, mine.id)).not.toBeNull();
    expect(engine.list(narrow, {}, NOW)).toHaveLength(1);
  });

  it('separates reading from answering: an observer sees everything and can do nothing', () => {
    const { engine, raise } = seed();
    const h = raise('t-obs', 'onshore.ap.USHOU', {});
    const auditor = viewer('usr_audit', ['read'], [{}], 'Internal Audit');
    expect(engine.list(auditor, {}, NOW)).toHaveLength(1);
    expect(() =>
      engine.handle({
        type: 'answer', handoverId: h.id, idempotencyKey: 'a-obs', at: '2026-08-24T09:00:00Z',
        data: { body: 'x', fields: { decision: 'approved' } },
      } as never, auditor),
    ).toThrow(/no answer grant covering/);
  });
});

describe('desks a person may work', () => {
  it('offers only the desks their grants reach', () => {
    const { engine } = seed();
    const emea = viewer('usr_emea', ['read', 'answer'], [{ region: 'EMEA' }]);
    expect(engine.desksFor(emea).map((d) => d.id).sort()).toEqual(['onshore.ap.DEFRA', 'onshore.ap.EMEA']);
    const nobody = viewer('usr_none', [], []);
    expect(engine.desksFor(nobody)).toEqual([]);
  });
});

describe('a handover routed to an unconfigured desk', () => {
  it('is refused, because no grant could ever reach it', () => {
    const { engine } = seed();
    expect(() =>
      engine.handle({
        type: 'raise', idempotencyKey: 'a-void', at: '2026-08-24T08:00:00Z',
        data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-void' },
                question: 'q', destination: 'onshore.ap.NOWHERE', scope: {} },
      } as never, PRIYA),
    ).toThrow(/not a configured desk/);
  });
});
