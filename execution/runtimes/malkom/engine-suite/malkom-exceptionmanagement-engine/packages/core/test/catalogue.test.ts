import { describe, expect, it } from 'vitest';
import { admin, asViewer, DESKS, observer, offshore, onshore, registerDesks, run } from './viewers.js';
import { resolveCatalogue, resolveReason } from '../src/catalogue.js';
import { ExceptionEngine } from '../src/engine.js';
import { reasonDefinitionSchema, type ReasonDefinitionInput } from '../src/schemas.js';

/**
 * How one catalogue serves forty offices — and why it is one catalogue rather
 * than forty. Everything here is the answer to "how does the exception list
 * get built for each country, region and office".
 */

const define = (input: ReasonDefinitionInput) => reasonDefinitionSchema.parse(input);

const budgets = (respond: number, act: number) => ({
  respond: { minutes: respond, calendarId: '24x7' },
  act: { minutes: act, calendarId: '24x7' },
  referralMaxMinutes: 4320, autoAcceptMinutes: null,
});

/** Global by default; EMEA answers slower; Houston answers faster; not in Germany. */
const COST_APPROVAL = define({
  code: 'COST_APPROVAL', label: 'Cost approval needed', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: budgets(240, 480), defaultDestination: 'onshore.ap.GLOBAL',
  variants: [
    { where: { region: 'EMEA' }, note: 'EMEA works one shift', budgets: budgets(480, 480), defaultDestination: 'onshore.ap.EMEA' },
    { where: { office: 'USHOU' }, note: 'Houston is staffed all day', budgets: budgets(120, 480), defaultDestination: 'onshore.ap.USHOU' },
    { where: { country: 'DE' }, note: 'German entities approve in SAP, not here', enabled: false },
    { where: { country: 'FR' }, note: 'France needs the TVA number on the question', asks: ['tvaNumber'] },
  ],
});

/** A reason that exists only in one country. */
const GERMAN_TAX = define({
  code: 'STEUERNUMMER_MISSING', label: 'Steuernummer missing', subjectTypes: ['task'],
  where: { country: 'DE' }, answerShape: ['steuernummer'], budgets: budgets(240, 480),
});

const ALL = [COST_APPROVAL, GERMAN_TAX];

describe('what each scope actually gets', () => {
  it('gives a global reason to a scope that names nothing', () => {
    const list = resolveCatalogue(ALL, {});
    expect(list.map((r) => r.code)).toEqual(['COST_APPROVAL']);
    expect(list[0]?.budgets.respond?.minutes).toBe(240);
  });

  it('gives Houston the office variant, not the global default', () => {
    const houston = resolveReason(COST_APPROVAL, { country: 'US', office: 'USHOU', queue: 'AP' });
    expect(houston?.budgets.respond?.minutes).toBe(120);
    expect(houston?.defaultDestination).toBe('onshore.ap.USHOU');
  });

  it('layers region then office, so the narrower one lands last', () => {
    // A London office inside EMEA: EMEA's 480 applies, Houston's does not.
    const london = resolveReason(COST_APPROVAL, { region: 'EMEA', office: 'GBLON' });
    expect(london?.budgets.respond?.minutes).toBe(480);
    expect(london?.defaultDestination).toBe('onshore.ap.EMEA');

    // Houston is not in EMEA, so only the office variant applies.
    const houston = resolveReason(COST_APPROVAL, { region: 'AMER', office: 'USHOU' });
    expect(houston?.resolvedFrom).toEqual(['base', 'office=USHOU']);
  });

  it('withdraws a reason in one country without touching the others', () => {
    expect(resolveReason(COST_APPROVAL, { country: 'DE' })).toBeNull();
    expect(resolveReason(COST_APPROVAL, { country: 'FR' })).not.toBeNull();
    expect(resolveCatalogue(ALL, { country: 'DE' }).map((r) => r.code)).toEqual(['STEUERNUMMER_MISSING']);
  });

  it('keeps a country-only reason out of every other country', () => {
    expect(resolveCatalogue(ALL, { country: 'FR' }).map((r) => r.code)).toEqual(['COST_APPROVAL']);
    expect(resolveCatalogue(ALL, { country: 'DE' }).map((r) => r.code)).toEqual(['STEUERNUMMER_MISSING']);
  });

  it('changes what a question asks for, not only how fast it is owed', () => {
    // France asks for the TVA number up front; nowhere else does.
    expect(resolveReason(COST_APPROVAL, { country: 'FR' })?.asks).toEqual(['tvaNumber']);
    expect(resolveReason(COST_APPROVAL, { country: 'US' })?.asks).toEqual([]);
  });

  it('explains itself, so a desk can be told why its SLA differs', () => {
    const paris = resolveReason(COST_APPROVAL, { region: 'EMEA', country: 'FR' });
    expect(paris?.resolvedFrom).toEqual(['base', 'region=EMEA', 'country=FR']);
    expect(paris?.budgets.respond?.minutes).toBe(480); // from EMEA
    expect(paris?.asks).toEqual(['tvaNumber']); // from FR
  });

  it('breaks a specificity tie on the order the author wrote them', () => {
    const twoWays = define({
      code: 'TIE', label: 'Tie', subjectTypes: ['task'], budgets: budgets(60, 60),
      variants: [
        { where: { country: 'US' }, note: 'first', defaultDestination: 'first' },
        { where: { region: 'AMER' }, note: 'second', defaultDestination: 'second' },
      ],
    });
    // Both pin exactly one field, so the later declaration wins — the order an
    // administrator sees on screen is the order that decides.
    expect(resolveReason(twoWays, { country: 'US', region: 'AMER' })?.defaultDestination).toBe('second');
  });

  it('narrows to the subject type the raise dialog is actually on', () => {
    const other = define({ code: 'SHIPMENT_ONLY', label: 'x', subjectTypes: ['shipment'], budgets: budgets(60, 60) });
    expect(resolveCatalogue([...ALL, other], { country: 'US' }, 'task').map((r) => r.code)).toEqual(['COST_APPROVAL']);
    expect(resolveCatalogue([...ALL, other], { country: 'US' }, 'shipment').map((r) => r.code)).toEqual(['SHIPMENT_ONLY']);
  });

  it('does not carry spent variants into the resolved definition', () => {
    // A resolved reason that still held its variants would invite a second,
    // silent resolution somewhere downstream against a different scope.
    expect(resolveReason(COST_APPROVAL, { office: 'USHOU' })?.variants).toEqual([]);
  });
});

describe('a scoped catalogue governs the whole life of a handover', () => {
  const OFF = { id: 'usr_priya', name: 'Priya', side: 'ORIGINATOR' } as const;
  const ON = { id: 'usr_dale', name: 'Dale', side: 'RESOLVER' } as const;

  const engineWith = () => {
    const engine = new ExceptionEngine();
  registerDesks(engine);
    engine.putReason(COST_APPROVAL);
    engine.putReason(GERMAN_TAX);
    return engine;
  };

  it('refuses a raise in a scope the reason does not reach', () => {
    const engine = engineWith();
    expect(() =>
      run(engine, {
        type: 'raise', idempotencyKey: 'de', at: '2026-08-24T09:00:00Z', actor: OFF,
        data: {
          reasonCode: 'COST_APPROVAL', scope: { country: 'DE' },
          subject: { type: 'task', id: 't-de' }, question: 'approve?',
        },
      } as never),
    ).toThrow(/does not apply to this work/);
  });

  it('raises against the WORK scope, so a Kolkata processor gets Houston rules', () => {
    const engine = engineWith();
    const { handover } = run(engine, {
      type: 'raise', idempotencyKey: 'hou', at: '2026-08-24T09:00:00Z', actor: OFF,
      data: {
        reasonCode: 'COST_APPROVAL', scope: { country: 'US', office: 'USHOU', queue: 'AP' },
        subject: { type: 'task', id: 't-hou' }, question: 'approve?',
      },
    } as never);
    expect(handover.destination).toBe('onshore.ap.USHOU');
    expect(handover.budgets.respond?.minutes).toBe(120);
    // Due two hours later, on Houston's variant — not the global four.
    expect(handover.dueAt).toBe('2026-08-24T11:00:00.000Z');
    expect(handover.resolvedFrom).toEqual(['base', 'office=USHOU']);
  });

  it('keeps the same resolution for every later command, not just the raise', () => {
    const engine = engineWith();
    const { handover } = run(engine, {
      type: 'raise', idempotencyKey: 'fr', at: '2026-08-24T09:00:00Z', actor: OFF,
      data: {
        reasonCode: 'COST_APPROVAL', scope: { region: 'EMEA', country: 'FR' },
        subject: { type: 'task', id: 't-fr' }, question: 'approve?', fields: { tvaNumber: 'FR123' },
      },
    } as never);
    // The French variant's answer contract is what the answer is judged by.
    const answered = run(engine, {
      type: 'answer', handoverId: handover.id, idempotencyKey: 'fr-a', at: '2026-08-24T10:00:00Z',
      actor: ON, data: { body: 'ok', fields: { decision: 'approved' } },
    } as never).handover;
    expect(answered.holder).toBe('ORIGINATOR');
    // And the ledger can prove which resolution governed it.
    const stamps = engine.events(admin, handover.id).map((event) => event.policy.resolvedFrom.join('>'));
    expect(new Set(stamps)).toEqual(new Set(['base>region=EMEA>country=FR']));
  });

  it('serves a per-office list straight from the engine', () => {
    const engine = engineWith();
    expect(engine.catalogue({ country: 'DE' }, 'task').map((r) => r.code)).toEqual(['STEUERNUMMER_MISSING']);
    expect(engine.catalogue({ office: 'USHOU' }, 'task').map((r) => `${r.code}@${r.budgets.respond?.minutes}m`))
      .toEqual(['COST_APPROVAL@120m']);
  });
});
