import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

/**
 * The bindings: what this engine hands to the process-metrics engine, and what
 * it hands to a page renderer. Both are contracts owned by somebody else, so
 * both are checked against that somebody else's shape rather than against a
 * convenient one.
 */

const NOW = '2026-08-24T10:00:00Z';
const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval needed', subjectTypes: ['task'],
  asks: ['amount', 'costCentre'], answerShape: ['decision', 'approvedAmount'],
  budgets: B, defaultDestination: 'onshore.ap.USHOU',
  pauseReasons: [{ code: 'AWAITING_SUPPLIER', label: 'Supplier', maxMinutes: 4320 }],
};

const V = (id: string, caps: string[], wheres: object[] = [{}]): Viewer => ({
  id, name: id, unit: 'unit', system: false,
  grants: wheres.map((where) => ({ capabilities: caps as never, where, note: '' })),
});
const PRIYA = V('usr_priya', ['read', 'raise', 'accept']);
const DALE = V('usr_dale', ['read', 'answer', 'refer']);

const seed = () => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putReason(REASON);
  const h = engine.handle({
    type: 'raise', idempotencyKey: 'b-1', at: '2026-08-24T06:00:00Z',
    data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-1' }, question: 'q',
            fields: { amount: 900, costCentre: 'CC-1' }, scope: { country: 'US', office: 'USHOU', queue: 'AP' } },
  } as never, PRIYA).handover;
  return { engine, h };
};

describe('the metrics registry binding', () => {
  it('declares entities whose every field is a type that registry accepts', () => {
    const { engine } = seed();
    const doc = engine.registryDoc();
    expect(doc.entities.map((e) => e.id)).toEqual(['handover', 'handover_pause']);
    // string | number | boolean | date, and nothing else. An object field
    // would not register, which is how pausedByReason failed the first time.
    for (const entity of doc.entities) {
      for (const field of entity.fields) {
        expect(['string', 'number', 'boolean', 'date']).toContain(field.type);
      }
    }
  });

  it('emits rows whose every value is a scalar the declaration matches', () => {
    const { engine } = seed();
    const [fact] = engine.facts(PRIYA, {}, NOW);
    const declared = new Map(engine.registryDoc().entities[0]!.fields.map((f) => [f.id, f.type]));
    for (const [key, value] of Object.entries(fact ?? {})) {
      expect(value === null || typeof value !== 'object', `${key} must be scalar`).toBe(true);
      expect(declared.has(key), `${key} must be declared in the registry entity`).toBe(true);
    }
  });

  it('reads through a FactSourcePort the metrics engine can call as-is', async () => {
    const { engine, h } = seed();
    engine.handle({ type: 'refer', handoverId: h.id, idempotencyKey: 'b-p', at: '2026-08-24T07:00:00Z',
      data: { pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-114' } } as never, DALE);

    // The shape metrics asks for: fetchFacts(q) => Promise<Record<string,unknown>[]>
    const source = engine.factSource(PRIYA, () => NOW);
    const handovers = await source.fetchFacts({ entity: 'handover' });
    const pauses = await source.fetchFacts({ entity: 'handover_pause' });

    expect(handovers).toHaveLength(1);
    expect(handovers[0]).toMatchObject({ reasonCode: 'COST_APPROVAL', department: 'AP', deskOffice: 'USHOU' });
    expect(pauses[0]).toMatchObject({ pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-114', kind: 'REFERRAL', open: true });
  });

  it('scopes the facts to the viewer, so a regional dashboard cannot leak the rest', async () => {
    const { engine } = seed();
    const emeaOnly = V('usr_emea', ['read'], [{ region: 'EMEA' }]);
    expect(await engine.factSource(emeaOnly, () => NOW).fetchFacts({})).toEqual([]);
  });
});

describe('queue aging', () => {
  it('buckets by age AND says whose hands each bucket is in', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'answer', handoverId: h.id, idempotencyKey: 'b-a', at: '2026-08-24T07:00:00Z',
      data: { body: 'ok', fields: { decision: 'approved', approvedAmount: 900 } } } as never, DALE);

    const profile = engine.aging(PRIYA, {}, NOW);
    expect(profile.open).toBe(1);
    const first = profile.buckets.find((b) => b.label === '<1d');
    // Four hours old, and back with the originator — which is the half a
    // plain bucket count cannot tell you.
    expect(first?.total).toBe(1);
    expect(first?.byHolder).toEqual({ ORIGINATOR: 1 });
  });

  it('reports the oldest thing waiting — the alarm that gets somebody out of a chair', () => {
    const { engine } = seed();
    expect(engine.aging(PRIYA, {}, NOW).oldest).toMatchObject({
      minutes: 240, holder: 'RESOLVER', destination: 'onshore.ap.USHOU',
    });
  });

  it('is empty for a viewer with no grants, not global', () => {
    const { engine } = seed();
    const nobody = V('usr_none', [], []);
    expect(engine.aging(nobody, {}, NOW)).toMatchObject({ open: 0, oldest: null });
  });
});

describe('page management', () => {
  it('publishes columns a list definition can name', () => {
    const { engine } = seed();
    const { columns } = engine.pageRegistry();
    const keys = columns.map((c) => c.key);
    expect(keys).toContain('department');
    expect(keys).toContain('resolverMinutes');
    expect(keys).toContain('originatorMinutes');
    // Every column names where its value comes from, so the renderer resolves
    // it rather than guessing — and an unresolvable one is reported, not drawn.
    for (const column of columns) expect(column.path.length).toBeGreaterThan(0);
  });

  it('publishes dashboard sources with dimensions worth slicing by', () => {
    const { engine } = seed();
    const source = engine.pageRegistry().metricSources.find((s) => s.name === 'exceptions.desks');
    expect(source?.dimensions).toContain('department');
    expect(source?.dimensions).toContain('deskOffice');
    expect(engine.pageRegistry().metricSources.map((s) => s.name)).toContain('exceptions.pauses');
  });

  it('generates the raise and answer forms from the reason contract itself', () => {
    const { engine } = seed();
    const forms = engine.formsFor('COST_APPROVAL', { office: 'USHOU' });
    // FieldDef shape, exactly: {key,label,type,options,derived,showIf}
    expect(forms?.raise).toEqual([
      { key: 'amount', label: 'Amount', type: 'number', options: [], derived: null, showIf: null, required: true },
      { key: 'costCentre', label: 'Cost Centre', type: 'text', options: [], derived: null, showIf: null, required: true },
    ]);
    expect(forms?.answer.map((f) => f.key)).toEqual(['decision', 'approvedAmount']);
  });

  it('resolves the form for the scope, so France asks what only France asks', () => {
    const { engine } = seed();
    engine.putReason({
      ...REASON,
      variants: [{ where: { country: 'FR' }, note: 'TVA', asks: ['amount', 'costCentre', 'tvaNumber'] }],
    });
    expect(engine.formsFor('COST_APPROVAL', { country: 'FR' })?.raise.map((f) => f.key))
      .toEqual(['amount', 'costCentre', 'tvaNumber']);
    expect(engine.formsFor('COST_APPROVAL', { country: 'US' })?.raise.map((f) => f.key))
      .toEqual(['amount', 'costCentre']);
  });

  it('holds the noun vocabulary in one place, applied rather than declared and ignored', () => {
    const { engine } = seed();
    expect(engine.pageRegistry().nouns.caseOne).toBe('handover');
    engine.applyConfig({ reasons: [], nouns: { caseOne: 'query', caseMany: 'queries', originator: 'offshore', resolver: 'onshore' } });
    expect(engine.pageRegistry().nouns).toMatchObject({ caseOne: 'query', resolver: 'onshore' });
  });
});
