import { describe, expect, it } from 'vitest';
import {
  ExceptionEngine,
  cascadeFor,
  categoriesFor,
  categoryLabel,
  mappingRows,
  reasonDefinitionSchema,
  viewerSchema,
  DEMO_CATEGORIES,
  DEMO_DESKS,
  DEMO_REASONS,
  DEMO_PEOPLE,
  type CategoryDefinition,
} from '../src/index.js';

const category = (over: Partial<CategoryDefinition> & { key: string; family: string }): CategoryDefinition => ({
  qualifier: '', qualifierKind: 'SUB_FAMILY', where: {}, enabled: true, sequence: 0, ...over,
});

const reason = (code: string, categoryKey: string, over: Record<string, unknown> = {}) =>
  reasonDefinitionSchema.parse({ code, categoryKey, label: code, subjectTypes: ['task'], ...over });

describe('the colon is doing two different jobs', () => {
  const FAMILY = category({ key: 'REPAIR', family: 'Repair Agreement Issues' });
  const AT_ECHO = category({
    key: 'REPAIR_ECHO', family: 'Repair Agreement Issues', qualifier: 'ECHO',
    qualifierKind: 'SCOPE', where: { office: 'ECHO' },
  });
  const TAX = category({ key: 'TAX', family: 'Finance', qualifier: 'Tax' });
  const ALL = [FAMILY, AT_ECHO, TAX];

  it('reads a sub-family as a name and a scope qualifier as a condition', () => {
    expect(categoryLabel(TAX)).toBe('Finance : Tax');
    expect(categoryLabel(AT_ECHO)).toBe('Repair Agreement Issues : ECHO');
    expect(categoryLabel(FAMILY)).toBe('Repair Agreement Issues');
  });

  it('offers the scoped variant INSTEAD of the plain family, never beside it', () => {
    // Both would be a picker with two entries that mean the same thing, which
    // is how the data stops meaning anything: people choose at random.
    const atEcho = categoriesFor(ALL, { office: 'ECHO' }).map((c) => c.key);
    expect(atEcho).toEqual(['TAX', 'REPAIR_ECHO']);

    const elsewhere = categoriesFor(ALL, { office: 'ALPHA' }).map((c) => c.key);
    expect(elsewhere).toEqual(['TAX', 'REPAIR']);
  });

  it('lets sub-families sit beside each other — they are siblings, not rivals', () => {
    const costing = category({ key: 'COST', family: 'Finance', qualifier: 'Costing' });
    expect(categoriesFor([TAX, costing], {}).map((c) => c.key)).toEqual(['COST', 'TAX']);
  });

  it('refuses a scope qualifier that names no scope', () => {
    // It would suppress the plain family everywhere, which is never what
    // anybody meant by writing a condition down.
    const engine = new ExceptionEngine();
    expect(() =>
      engine.putCategory({ key: 'BAD', family: 'Finance', qualifier: 'Tax', qualifierKind: 'SCOPE' }),
    ).toThrow(/names no scope/);
  });
});

describe('the cascade — two knowns, two picks, one derived', () => {
  const CATEGORIES = [
    category({ key: 'FIN', family: 'Finance', qualifier: 'Costing' }),
    category({ key: 'REP', family: 'Repair Agreement Issues' }),
  ];
  const REASONS = [
    reason('CHARGE_CODE', 'FIN', { defaultDestination: 'onshore.finance' }),
    reason('COST_CENTRE', 'FIN', { defaultDestination: 'onshore.finance' }),
    reason('NO_AGREEMENT', 'REP', { defaultDestination: 'procurement' }),
  ];

  it('narrows the reason list to the category, and names the department on each', () => {
    const cascade = cascadeFor(CATEGORIES, REASONS, { office: 'ALPHA' }, 'task');
    expect(cascade.steps[0]?.options.map((o) => o.label)).toEqual([
      'Finance : Costing', 'Repair Agreement Issues',
    ]);
    expect(cascade.rows).toBe(3);
    const picked = cascade.steps[1]?.options.filter((o) => o.key.startsWith('FIN/'));
    expect(picked?.map((o) => o.hint)).toEqual(['onshore.finance', 'onshore.finance']);
  });

  it('drops a category with nothing under it rather than showing it empty', () => {
    // A dead end in a picker is indistinguishable from a broken catalogue,
    // and people report it as one.
    const empty = category({ key: 'NOBODY', family: 'Nothing here' });
    const cascade = cascadeFor([...CATEGORIES, empty], REASONS, {}, 'task');
    expect(cascade.steps[0]?.options.map((o) => o.key)).not.toContain('NOBODY');
  });

  it('still offers reasons whose category nobody declared, under a heading that says so', () => {
    // Silence would read as "the catalogue is empty at this office", which is
    // a very different problem from "somebody forgot one line of config".
    const orphan = reason('LOOSE_ONE', 'GHOST_CATEGORY');
    const cascade = cascadeFor(CATEGORIES, [...REASONS, orphan], {}, 'task');
    expect(cascade.steps[0]?.options.map((o) => o.label)).toContain('Uncategorised');
    expect(cascade.steps[1]?.options.map((o) => o.key)).toContain('GHOST_CATEGORY/LOOSE_ONE');
  });

  it('narrows by subject type, so a picker never offers what cannot apply', () => {
    const shipmentOnly = reason('SHIPMENT_THING', 'FIN', { subjectTypes: ['shipment'] });
    const onTasks = cascadeFor(CATEGORIES, [...REASONS, shipmentOnly], {}, 'task');
    expect(onTasks.steps[1]?.options.map((o) => o.key)).not.toContain('FIN/SHIPMENT_THING');
  });
});

describe('the demo catalogue behaves the way its comments claim', () => {
  const engine = () => {
    const built = new ExceptionEngine();
    const admin = viewerSchema.parse(DEMO_PEOPLE['admin']);
    for (const desk of DEMO_DESKS) built.putDestination(desk, admin);
    built.applyConfig({ categories: DEMO_CATEGORIES, reasons: DEMO_REASONS });
    return { built, admin };
  };

  it('routes one reason to a different department at one office — from ONE row', () => {
    const { built, admin } = engine();
    const alpha = built.cascade(admin, { office: 'ALPHA', workType: 'REPAIR' }, 'task');
    const echo = built.cascade(admin, { office: 'ECHO', workType: 'REPAIR' }, 'task');
    const at = (c: ReturnType<typeof built.cascade>, key: string) =>
      c.steps[1]?.options.find((o) => o.key.endsWith(key))?.hint;
    expect(at(alpha, 'RATE_NOT_IN_SOURCE')).toBe('procurement');
    expect(at(echo, 'RATE_NOT_IN_SOURCE')).toBe('repair.desk');
  });

  it('withdraws a reason in one country and changes nothing anywhere else', () => {
    const { built, admin } = engine();
    const nordia = built.cascade(admin, { country: 'Nordia' }, 'task');
    const sorland = built.cascade(admin, { country: 'Sorland' }, 'task');
    const has = (c: ReturnType<typeof built.cascade>) =>
      c.steps[1]?.options.some((o) => o.key.endsWith('PERIOD_CONFIRM'));
    expect(has(nordia)).toBe(true);
    expect(has(sorland)).toBe(false);
  });

  it('exports the same catalogue as the flat five-key table people argue about', () => {
    const { built, admin } = engine();
    const rows = built.mapping(admin, [
      { office: 'ALPHA', country: 'Nordia', region: 'WEST', queue: 'ap', subQueue: 'index', workType: 'TERM' },
    ]);
    const mismatch = rows.find((row) => row.reason === 'Rate differs between agreement and document');
    expect(mismatch).toMatchObject({
      office: 'ALPHA', workType: 'TERM', queue: 'ap', subQueue: 'index',
      category: 'Terminal Invoice Issues', department: 'procurement.terminal',
    });
    // Generated from the definitions, never authored beside them — two copies
    // of one mapping is how the export and the behaviour start disagreeing.
    expect(rows.length).toBe(
      mappingRows([...DEMO_CATEGORIES].map((c) => ({
        qualifier: '', qualifierKind: 'SUB_FAMILY', where: {}, enabled: true, sequence: 0, ...c,
      })) as CategoryDefinition[],
      DEMO_REASONS.map((r) => reasonDefinitionSchema.parse(r)),
      [{ office: 'ALPHA', country: 'Nordia', region: 'WEST', queue: 'ap', subQueue: 'index', workType: 'TERM' }]).length,
    );
  });
});
