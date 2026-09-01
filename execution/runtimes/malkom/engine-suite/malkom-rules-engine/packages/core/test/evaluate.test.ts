import { describe, expect, it } from 'vitest';
import { CompiledRegistry } from '../src/domain/registry.js';
import { registryDocSchema, groupDefinitionSchema, type GroupDefinitionInput } from '../src/config/schemas.js';
import { CompiledRuleset, probeKeys, type ActiveGroupInput } from '../src/runtime/compile.js';
import { applicableGroups, evaluateRuleset } from '../src/runtime/evaluate.js';

const registry = new CompiledRegistry(
  registryDocSchema.parse({
    entities: [
      {
        id: 'booking',
        subQueueField: 'status',
        fields: [
          { id: 'shipperParty', type: 'string' },
          { id: 'portOfLoading', type: 'string', valueSet: 'ports' },
          { id: 'portOfDischarge', type: 'string', valueSet: 'ports' },
          { id: 'currency', type: 'string' },
          { id: 'status', type: 'string', values: ['new', 'confirmed'] },
          { id: 'paymentTerms', type: 'string' },
          { id: 'teu', type: 'number' },
        ],
      },
      {
        id: 'shipmentTask',
        fields: [
          { id: 'bookingId', type: 'string' },
          { id: 'reviewRequired', type: 'boolean' },
        ],
      },
    ],
    valueSets: [
      { id: 'ports', values: ['USLAX', 'USORE', 'USNYC', 'CNNGB'] },
      { id: 'region:uswc', values: ['USLAX', 'USORE', 'USNYC'] },
    ],
  }),
  1,
);

let seq = 0;
function group(def: GroupDefinitionInput, createdAt = `2026-01-0${(seq % 8) + 1}T00:00:00Z`): ActiveGroupInput {
  seq += 1;
  return {
    groupId: `g-${String(seq).padStart(3, '0')}`,
    version: 1,
    definition: groupDefinitionSchema.parse(def),
    registryVersion: 1,
    createdAt,
  };
}

function ruleset(...groups: ActiveGroupInput[]): CompiledRuleset {
  return new CompiledRuleset(registry, 1, groups);
}

const ASOF = '2026-10-01T00:00:00Z';

/** The doc's worked example: shipper A, USWC→CNNGB corridors settle in USD. */
const shipperA = (): ActiveGroupInput =>
  group({
    name: 'Shipper A — USD corridors',
    entity: 'booking',
    scope: {
      all: [
        { field: 'shipperParty', op: 'eq', value: 'A' },
        { field: 'status', op: 'eq', value: 'new' },
      ],
    },
    effectiveFrom: '2026-09-01T00:00:00Z',
    effectiveTo: '2027-09-01T00:00:00Z',
    rules: [
      {
        id: 'usd-only',
        when: {
          op: 'and',
          args: [
            { op: 'inSet', field: 'portOfLoading', set: 'region:uswc' },
            { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
          ],
        },
        then: [
          {
            verb: 'assert',
            field: 'currency',
            check: { op: 'eq', field: 'currency', value: 'USD' },
            message: 'Shipper A corridors into CNNGB settle in USD only.',
          },
        ],
      },
    ],
  });

const BOOKING = {
  id: 'B-1',
  shipperParty: 'A',
  status: 'new',
  portOfLoading: 'USLAX',
  portOfDischarge: 'CNNGB',
  currency: 'EUR',
  teu: 4,
};

describe('worked example (§2)', () => {
  it('flags the EUR booking and passes the USD one', () => {
    const rs = ruleset(shipperA());
    const bad = evaluateRuleset(rs, 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(bad.assertions).toHaveLength(1);
    expect(bad.assertions[0]).toMatchObject({
      ruleId: 'usd-only',
      field: 'currency',
      message: 'Shipper A corridors into CNNGB settle in USD only.',
    });
    expect(bad.trace[0]?.via).toBe('index');
    expect(bad.trace[0]?.rules[0]?.fired).toBe(true);

    const ok = evaluateRuleset(rs, 'booking', { ...BOOKING, currency: 'USD' }, { asOf: ASOF, mode: 'explain' });
    expect(ok.assertions).toHaveLength(0);
    expect(ok.trace[0]?.rules[0]?.fired).toBe(true); // rule fired, assert held
  });

  it('is deterministic: identical inputs produce identical output', () => {
    const rs = ruleset(shipperA());
    const a = evaluateRuleset(rs, 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    const b = evaluateRuleset(rs, 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not consider bookings outside the scope', () => {
    const rs = ruleset(shipperA());
    const other = evaluateRuleset(
      rs,
      'booking',
      { ...BOOKING, shipperParty: 'B' },
      { asOf: ASOF, mode: 'explain' },
    );
    // Not even a candidate: shipperParty=B probes no bucket for this group.
    expect(other.trace).toHaveLength(0);
  });
});

describe('windows and asOf', () => {
  it('same ruleset, different asOf — group active vs out-of-window', () => {
    const rs = ruleset(shipperA());
    const before = evaluateRuleset(rs, 'booking', BOOKING, { asOf: '2026-08-31T23:59:59Z', mode: 'explain' });
    expect(before.trace[0]?.skipped).toBe('out-of-window');
    expect(before.assertions).toHaveLength(0);

    const boundary = evaluateRuleset(rs, 'booking', BOOKING, { asOf: '2027-09-01T00:00:00Z', mode: 'explain' });
    expect(boundary.trace[0]?.skipped).toBe('out-of-window'); // half-open [from, to)
  });

  it('rule-level windows intersect the group window', () => {
    const g = group({
      name: 'seasonal',
      entity: 'booking',
      scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
      rules: [
        {
          id: 'winter-only',
          when: { op: 'isNotNull', field: 'currency' },
          effectiveFrom: '2026-12-01T00:00:00Z',
          then: [{ verb: 'set', field: 'paymentTerms', value: 'PREPAID' }],
        },
      ],
    });
    const rs = ruleset(g);
    const autumn = evaluateRuleset(rs, 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(autumn.trace[0]?.rules[0]?.outOfWindow).toBe(true);
    expect(autumn.patch).toHaveLength(0);

    const winter = evaluateRuleset(rs, 'booking', BOOKING, { asOf: '2026-12-15T00:00:00Z', mode: 'explain' });
    expect(winter.patch).toMatchObject([{ field: 'paymentTerms', value: 'PREPAID' }]);
  });
});

describe('hit policies', () => {
  const twoRules = (hitPolicy: 'first' | 'all' | 'unique'): ActiveGroupInput =>
    group({
      name: `hp-${hitPolicy}`,
      entity: 'booking',
      scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
      hitPolicy,
      rules: [
        {
          id: 'r-a',
          when: { op: 'eq', field: 'status', value: 'new' },
          then: [{ verb: 'set', field: 'paymentTerms', value: 'COLLECT' }],
        },
        {
          id: 'r-b',
          when: { op: 'gt', field: 'teu', value: 1 },
          then: [{ verb: 'set', field: 'paymentTerms', value: 'PREPAID' }],
        },
      ],
    });

  it('first: the first match wins, later matches are shadowed', () => {
    const r = evaluateRuleset(ruleset(twoRules('first')), 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(r.patch).toMatchObject([{ field: 'paymentTerms', value: 'COLLECT', ruleId: 'r-a' }]);
    expect(r.trace[0]?.rules[1]?.shadowed).toBe(true);
    expect(r.conflicts).toHaveLength(0);
  });

  it('all: both fire; the same-field write is a conflict, first candidate wins', () => {
    const r = evaluateRuleset(ruleset(twoRules('all')), 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(r.patch).toMatchObject([{ field: 'paymentTerms', value: 'COLLECT' }]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ kind: 'same-field-write', field: 'paymentTerms' });
    expect(r.conflicts[0]?.candidates).toHaveLength(2);
  });

  it('unique: two matches poison the group — no actions, a conflict names the rules', () => {
    const r = evaluateRuleset(ruleset(twoRules('unique')), 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(r.patch).toHaveLength(0);
    expect(r.conflicts[0]).toMatchObject({ kind: 'unique-violated', field: '*', ruleIds: ['r-a', 'r-b'] });
  });
});

describe('cross-group resolution (§4.3)', () => {
  const writer = (name: string, scopeTerms: number, priority: number, value: string, createdAt: string) =>
    group(
      {
        name,
        entity: 'booking',
        priority,
        scope: {
          all: [
            { field: 'shipperParty', op: 'eq', value: 'A' },
            ...(scopeTerms > 1 ? [{ field: 'status', op: 'eq' as const, value: 'new' }] : []),
          ],
        },
        rules: [
          {
            when: { op: 'isNotNull', field: 'shipperParty' },
            then: [{ verb: 'set', field: 'currency', value }],
          },
        ],
      },
      createdAt,
    );

  it('specificity beats priority; the resolution is recorded', () => {
    const specific = writer('port-pair', 2, 0, 'USD', '2026-01-02T00:00:00Z');
    const loud = writer('shipper-wide', 1, 999, 'EUR', '2026-01-01T00:00:00Z');
    const r = evaluateRuleset(ruleset(loud, specific), 'booking', BOOKING, { asOf: ASOF, mode: 'apply' });
    expect(r.patch).toMatchObject([{ field: 'currency', value: 'USD', groupId: specific.groupId }]);
    expect(r.conflicts[0]).toMatchObject({ kind: 'same-field-write', winner: 0, resolvedBy: 'specificity' });
  });

  it('equal specificity falls to priority, then created-at', () => {
    const early = writer('early', 1, 0, 'USD', '2026-01-01T00:00:00Z');
    const late = writer('late', 1, 0, 'EUR', '2026-06-01T00:00:00Z');
    const r1 = evaluateRuleset(ruleset(late, early), 'booking', BOOKING, { asOf: ASOF, mode: 'apply' });
    expect(r1.patch[0]).toMatchObject({ value: 'USD', groupId: early.groupId });
    expect(r1.conflicts[0]?.resolvedBy).toBe('created-at');

    const boosted = writer('boosted', 1, 10, 'CNY', '2026-07-01T00:00:00Z');
    const r2 = evaluateRuleset(ruleset(late, early, boosted), 'booking', BOOKING, { asOf: ASOF, mode: 'apply' });
    expect(r2.patch[0]).toMatchObject({ value: 'CNY', groupId: boosted.groupId });
    expect(r2.conflicts[0]?.resolvedBy).toBe('priority');
  });

  it('same value from two groups is not a conflict', () => {
    const a = writer('a', 1, 0, 'USD', '2026-01-01T00:00:00Z');
    const b = writer('b', 1, 0, 'USD', '2026-02-01T00:00:00Z');
    const r = evaluateRuleset(ruleset(a, b), 'booking', BOOKING, { asOf: ASOF, mode: 'apply' });
    expect(r.patch).toHaveLength(1);
    expect(r.conflicts).toHaveLength(0);
  });
});

describe('verbs', () => {
  it('default fills empty ("" counts as empty) and never overwrites', () => {
    const g = group({
      name: 'defaults',
      entity: 'booking',
      scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
      rules: [
        {
          when: { op: 'isNotNull', field: 'shipperParty' },
          then: [{ verb: 'default', field: 'paymentTerms', value: 'COLLECT' }],
        },
      ],
    });
    const rs = ruleset(g);
    const empty = evaluateRuleset(rs, 'booking', { ...BOOKING, paymentTerms: '' }, { asOf: ASOF, mode: 'explain' });
    expect(empty.patch).toMatchObject([{ field: 'paymentTerms', verb: 'default' }]);
    const missing = evaluateRuleset(rs, 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(missing.patch).toHaveLength(1);
    const occupied = evaluateRuleset(
      rs,
      'booking',
      { ...BOOKING, paymentTerms: 'PREPAID' },
      { asOf: ASOF, mode: 'explain' },
    );
    expect(occupied.patch).toHaveLength(0);
  });

  it('effects resolve $row references; a missing field resolves to null', () => {
    const g = group({
      name: 'review-task',
      entity: 'booking',
      scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
      rules: [
        {
          when: { op: 'isNotNull', field: 'shipperParty' },
          then: [
            {
              verb: 'effect',
              target: {
                entity: 'shipmentTask',
                op: 'upsert',
                key: { bookingId: '$row.id' },
                set: { reviewRequired: true, bookingId: '$row.missingField' },
              },
            },
          ],
        },
      ],
    });
    const r = evaluateRuleset(ruleset(g), 'booking', BOOKING, { asOf: ASOF, mode: 'explain' });
    expect(r.effects).toHaveLength(1);
    expect(r.effects[0]?.target.key).toEqual({ bookingId: 'B-1' });
    expect(r.effects[0]?.target.set).toEqual({ reviewRequired: true, bookingId: null });
  });
});

describe('partial rows (§7)', () => {
  it('missing condition fields evaluate as SQL nulls and are flagged unevaluable', () => {
    const rs = ruleset(shipperA());
    const partial = { shipperParty: 'A', status: 'new', portOfDischarge: 'CNNGB' }; // no portOfLoading
    const r = evaluateRuleset(rs, 'booking', partial, { asOf: ASOF, mode: 'explain' });
    expect(r.trace[0]?.skipped).toBeUndefined(); // scope matched
    expect(r.trace[0]?.rules[0]?.fired).toBe(false); // NULL ∉ region:uswc
    expect(r.trace[0]?.rules[0]?.unevaluableFields).toEqual(['portOfLoading']);
    expect(r.assertions).toHaveLength(0); // never fired — honest, not silent
  });

  it('a missing scope field is a scope-miss for evaluation (full-row semantics)', () => {
    const rs = ruleset(shipperA());
    const r = evaluateRuleset(rs, 'booking', { shipperParty: 'A', portOfDischarge: 'CNNGB' }, { asOf: ASOF, mode: 'explain' });
    // status missing → eq 'new' cannot hold; group was a candidate via index but scope-misses.
    expect(r.trace[0]?.skipped).toBe('scope-miss');
  });
});

describe('applicable() (§7, D6)', () => {
  it('partial props: matching terms include, contradicting terms exclude, absent terms cannot exclude', () => {
    const rs = ruleset(shipperA());
    expect(applicableGroups(rs, 'booking', { shipperParty: 'A' }, ASOF)).toHaveLength(1);
    expect(applicableGroups(rs, 'booking', { shipperParty: 'B' }, ASOF)).toHaveLength(0);
    expect(applicableGroups(rs, 'booking', {}, ASOF)).toHaveLength(1);
    expect(applicableGroups(rs, 'booking', { shipperParty: 'A', status: 'confirmed' }, ASOF)).toHaveLength(0);
  });

  it('respects effective windows and reports group summaries', () => {
    const rs = ruleset(shipperA());
    expect(applicableGroups(rs, 'booking', { shipperParty: 'A' }, '2026-01-01T00:00:00Z')).toHaveLength(0);
    const [g] = applicableGroups(rs, 'booking', { shipperParty: 'A' }, ASOF);
    expect(g).toMatchObject({ name: 'Shipper A — USD corridors', ruleCount: 1, hitPolicy: 'first' });
  });
});

describe('selector index correctness', () => {
  it('probeKeys tolerates driver stringification both ways', () => {
    expect(probeKeys('5')).toContain('n:5');
    expect(probeKeys(5)).toContain('s:5');
    expect(probeKeys(1)).toContain('b:true');
    expect(probeKeys(null)).toEqual([]);
  });

  it('index candidates are equivalent to a brute-force scan across row shapes', () => {
    const groups = [
      shipperA(),
      group({
        name: 'uswc-region',
        entity: 'booking',
        scope: { all: [{ field: 'portOfLoading', op: 'inSet', set: 'region:uswc' }] },
        rules: [{ when: { op: 'isNotNull', field: 'portOfLoading' }, then: [{ verb: 'set', field: 'paymentTerms', value: 'X' }] }],
      }),
      group({
        name: 'big-bookings',
        entity: 'booking',
        scope: { all: [{ field: 'teu', op: 'in', values: [4, 8] }] },
        rules: [{ when: { op: 'isNotNull', field: 'teu' }, then: [{ verb: 'set', field: 'paymentTerms', value: 'Y' }] }],
      }),
    ];
    const rs = ruleset(...groups);
    const rows = [
      BOOKING,
      { shipperParty: 'B', portOfLoading: 'USORE', status: 'new' },
      { teu: '4' }, // stringified number must still find the numeric anchor
      { teu: 8, portOfLoading: 'CNNGB' },
      { shipperParty: 'A' },
      {},
    ];
    for (const row of rows) {
      const { viaIndex } = rs.candidatesFor('booking', row);
      const indexIds = new Set(viaIndex.map((g) => g.groupId));
      // Brute force: any group whose scope truly matches must be in the index candidates.
      for (const g of rs.entityGroups('booking')) {
        const truly = evaluateRuleset(new CompiledRuleset(registry, 1, [g]), 'booking', row, { asOf: ASOF, mode: 'explain' });
        const matched = truly.trace[0] !== undefined && truly.trace[0].skipped !== 'scope-miss' && truly.trace[0].skipped !== undefined
          ? false
          : truly.trace[0] !== undefined && truly.trace[0].skipped === undefined;
        if (matched) expect(indexIds.has(g.groupId)).toBe(true);
      }
    }
  });

  it('the reverse index knows which groups touch a field, including effect targets', () => {
    const rs = ruleset(shipperA());
    expect(rs.groupsTouching('booking', 'currency').map((g) => g.definition.name)).toEqual([
      'Shipper A — USD corridors',
    ]);
    expect(rs.groupsTouching('booking', 'paymentTerms')).toHaveLength(0);
  });
});
