import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput, RoutingAdvisor, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * Three tiers, kept apart: the catalogue's scoped default, a rules proposal
 * over the transaction's data, and a human override. The engine asks and
 * applies; it never evaluates a predicate of its own.
 */

const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  asks: ['amount'], answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
};

const PRIYA: Viewer = {
  id: 'usr_priya', name: 'Priya', unit: 'Offshore AP', system: false,
  grants: [{ capabilities: ['read', 'raise', 'reroute'], where: {}, note: '' }],
};

/** What a @malkom/rules-core adapter looks like from this side of the seam. */
const bigTicketToController: RoutingAdvisor = {
  name: 'rules:grp_cost_thresholds@v11',
  propose: ({ fields }) => {
    const amount = Number(fields['amount'] ?? 0);
    return amount > 25_000
      ? { destination: 'onshore.ap.USDAL', because: `amount ${amount} is over the 25,000 threshold` }
      : null; // no opinion — the catalogue default stands
  },
};

const seed = (advisors: RoutingAdvisor[] = []) => {
  const engine = new ExceptionEngine({ routingAdvisors: advisors });
  registerDesks(engine);
  engine.putReason(REASON);
  const raise = (id: string, amount: number, destination: string | null = null) =>
    engine.handle({
      type: 'raise', idempotencyKey: `r-${id}`, at: '2026-08-24T08:00:00Z',
      data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id }, question: 'approve?',
              fields: { amount }, destination, scope: { country: 'US', office: 'USHOU' } },
    } as never, PRIYA).handover;
  return { engine, raise };
};

describe('routing depends on the data, not only the scope', () => {
  it('sends nine hundred and ninety thousand to different desks', () => {
    const { raise } = seed([bigTicketToController]);
    expect(raise('small', 900).destination).toBe('onshore.ap.USHOU');
    expect(raise('large', 90_000).destination).toBe('onshore.ap.USDAL');
  });

  it('leaves the catalogue default standing when no advisor has an opinion', () => {
    const { raise } = seed([bigTicketToController]);
    const small = raise('quiet', 10);
    expect(small.routedBy).toBe('catalogue');
    expect(small.routedBecause).toContain('COST_APPROVAL resolved');
  });

  it('works with no advisor at all — the standalone case stays cheap', () => {
    const { raise } = seed();
    expect(raise('alone', 90_000)).toMatchObject({ destination: 'onshore.ap.USHOU', routedBy: 'catalogue' });
  });
});

describe('where the decision came from stays knowable', () => {
  it('names the advisor and its reasoning on a rules route', () => {
    const { engine, raise } = seed([bigTicketToController]);
    const h = raise('big', 90_000);
    expect(h.routedBy).toBe('rules');
    expect(h.routedBecause).toBe('amount 90000 is over the 25,000 threshold');
    // And it rides the event, so a quarter later it is still answerable.
    expect(engine.events(PRIYA, h.id)[0]?.data).toMatchObject({ routedBy: 'rules' });
  });

  it('marks a hand-picked destination as an override, not as policy', () => {
    const { raise } = seed([bigTicketToController]);
    const h = raise('by-hand', 90_000, 'onshore.wh.USHOU');
    expect(h).toMatchObject({ destination: 'onshore.wh.USHOU', routedBy: 'override' });
  });

  it('marks a correction as an override and keeps the resolver’s clock running', () => {
    const { engine, raise } = seed();
    const h = raise('wrong', 10);
    const fixed = engine.handle({
      type: 'reroute', handoverId: h.id, idempotencyKey: 'r-fix', at: '2026-08-24T10:00:00Z',
      reason: 'AP does not own this', data: { destination: 'onshore.wh.USHOU' },
    } as never, PRIYA).handover;
    expect(fixed.routedBy).toBe('override');
    expect(fixed.routedBecause).toContain('AP does not own this');
    expect(fixed.rerouted).toBe(1);
    // A correction is not a fresh start.
    expect(fixed.segments.filter((s) => s.side === 'RESOLVER')).toHaveLength(1);
  });

  it('puts routedBy on the fact row, so "how often is routing wrong" is a metric', () => {
    const { engine, raise } = seed([bigTicketToController]);
    raise('a', 10);
    raise('b', 90_000);
    raise('c', 10, 'onshore.wh.USHOU');
    const by: Record<string, number> = {};
    for (const fact of engine.facts(PRIYA, {}, '2026-08-24T10:00:00Z')) {
      by[fact.routedBy] = (by[fact.routedBy] ?? 0) + 1;
    }
    expect(by).toEqual({ catalogue: 1, rules: 1, override: 1 });
  });
});

describe('the first opinion wins', () => {
  it('consults advisors in order and stops at the first that speaks', () => {
    const asked: string[] = [];
    const quiet: RoutingAdvisor = { name: 'quiet', propose: () => { asked.push('quiet'); return null; } };
    const loud: RoutingAdvisor = {
      name: 'loud', propose: () => { asked.push('loud'); return { destination: 'onshore.ap.EMEA', because: 'said so' }; },
    };
    const never: RoutingAdvisor = { name: 'never', propose: () => { asked.push('never'); return null; } };
    const { raise } = seed([quiet, loud, never]);
    expect(raise('order', 1).destination).toBe('onshore.ap.EMEA');
    expect(asked).toEqual(['quiet', 'loud']);
  });

  it('still refuses a proposal naming a desk nobody configured', () => {
    const rogue: RoutingAdvisor = { name: 'rogue', propose: () => ({ destination: 'onshore.ap.MARS', because: 'why not' }) };
    const { raise } = seed([rogue]);
    expect(() => raise('rogue', 1)).toThrow(/not a configured desk/);
  });
});
