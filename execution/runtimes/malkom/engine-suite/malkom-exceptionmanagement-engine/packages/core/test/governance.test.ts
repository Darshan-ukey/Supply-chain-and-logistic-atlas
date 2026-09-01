import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * A catalogue change decides what may be asked, of whom and by when. That
 * makes it a change to live work, so the engine keeps its own record of who
 * made it — the host's approval flow sits in front, and this log survives it.
 */

const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
  variants: [{ where: { office: 'USHOU' }, note: 'staffed all day', budgets: { ...B, respond: { minutes: 120, calendarId: '24x7' } } }],
};

const author = (id: string, wheres: object[], unit = ''): Viewer => ({
  id, name: id, unit, system: false,
  grants: wheres.map((where) => ({ capabilities: ['administer'] as never, where, note: '' })),
});

const GLOBAL = author('usr_global', [{}], 'Process Design');
const HOUSTON = author('usr_hou', [{ office: 'USHOU' }], 'AP Houston');
const EMEA = author('usr_emea', [{ region: 'EMEA' }], 'AP EMEA');

const seed = () => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putReason(REASON, GLOBAL);
  return engine;
};

describe('the engine records who changed the catalogue', () => {
  it('names the person, their desk, and what moved', () => {
    const engine = seed();
    engine.putReason({ ...REASON, label: 'Cost approval needed' }, GLOBAL);
    const history = engine.configHistory('reason', 'COST_APPROVAL');
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ actorId: 'usr_global', actorUnit: 'Process Design', created: true });
    expect(history[1]).toMatchObject({ created: false });
    expect((history[1]?.after as { label: string }).label).toBe('Cost approval needed');
  });

  it('records desk changes too, since a desk’s region decides who can see what', () => {
    const engine = seed();
    engine.putDestination(
      { id: 'onshore.ap.EMEA', label: 'AP EMEA', department: 'AP', office: 'NLRTM', country: 'NL', region: 'EMEA' },
      EMEA,
    );
    expect(engine.configHistory('destination', 'onshore.ap.EMEA').at(-1)).toMatchObject({ actorId: 'usr_emea' });
  });
});

describe('authorship is scoped, like everything else', () => {
  it('lets a Houston administrator change Houston’s variant', () => {
    const engine = seed();
    expect(() =>
      engine.putReason(
        { ...REASON, variants: [{ where: { office: 'USHOU' }, note: 'faster still', budgets: { ...B, respond: { minutes: 60, calendarId: '24x7' } } }] },
        HOUSTON,
      ),
    ).not.toThrow();
    expect(engine.reasonFor('COST_APPROVAL', { office: 'USHOU' })?.budgets.respond?.minutes).toBe(60);
  });

  it('refuses the same administrator changing the BASE, which reaches everyone', () => {
    const engine = seed();
    expect(() =>
      engine.putReason({ ...REASON, budgets: { ...B, respond: { minutes: 30, calendarId: '24x7' } } }, HOUSTON),
    ).toThrow(/no administer grant covering anywhere/);
  });

  it('refuses an administrator changing a region they do not hold', () => {
    const engine = seed();
    const slowerInEmea = {
      ...REASON,
      variants: [
        ...(REASON.variants ?? []),
        { where: { region: 'EMEA' }, note: 'one shift', budgets: { ...B, respond: { minutes: 960, calendarId: '24x7' } } },
      ],
    };
    expect(() => engine.putReason(slowerInEmea, HOUSTON)).toThrow(/no administer grant covering region=EMEA/);
    // And the EMEA lead may make exactly that change.
    expect(() => engine.putReason(slowerInEmea, EMEA)).not.toThrow();
    expect(engine.reasonFor('COST_APPROVAL', { region: 'EMEA' })?.budgets.respond?.minutes).toBe(960);
  });

  it('asks for rights only where something actually changed', () => {
    const engine = seed();
    // Re-submitting the identical document alters nothing, so it needs nothing.
    expect(() => engine.putReason(REASON, HOUSTON)).not.toThrow();
    expect(engine.configHistory('reason', 'COST_APPROVAL')).toHaveLength(2);
  });

  it('refuses a desk change outside the author’s reach', () => {
    const engine = seed();
    expect(() =>
      engine.putDestination(
        { id: 'onshore.ap.DEFRA', label: 'AP Frankfurt', department: 'AP', office: 'DEFRA', country: 'DE', region: 'EMEA' },
        HOUSTON,
      ),
    ).toThrow(/no administer grant/);
  });
});
