import { describe, expect, it } from 'vitest';
import { CompiledRegistry, registryHash } from '../src/domain/registry.js';
import { validateGroupDefinition, validateRegistryDoc } from '../src/config/validate.js';
import { registryDocSchema, type GroupDefinitionInput, type RegistryDocInput } from '../src/config/schemas.js';

/**
 * M1 exit criterion: the architecture doc's §2 worked example round-trips
 * and validates. Plus the tier-1 error/warning matrix.
 */

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      table: { name: 'bookings' },
      connectionRef: 'main',
      subQueueField: 'status',
      fields: [
        { id: 'shipperParty', type: 'string', column: 'shipper_party' },
        { id: 'portOfLoading', type: 'string', valueSet: 'ports' },
        { id: 'portOfDischarge', type: 'string', valueSet: 'ports' },
        { id: 'currency', type: 'string', valueSet: 'iso4217' },
        { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped'] },
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
    { id: 'ports', values: ['USLAX', 'USORE', 'USNYC', 'CNNGB', 'CNSHA'] },
    { id: 'iso4217', values: ['USD', 'EUR', 'CNY'] },
    { id: 'region:transpacific-uswc', values: ['USLAX', 'USORE', 'USNYC'] },
  ],
};

/** The §2 worked example, verbatim from the architecture doc. */
const WORKED_EXAMPLE: GroupDefinitionInput = {
  name: 'Shipper A — USD corridors',
  entity: 'booking',
  scope: {
    all: [
      { field: 'shipperParty', op: 'eq', value: 'A' },
      { field: 'status', op: 'eq', value: 'new' },
    ],
  },
  hitPolicy: 'first',
  effectiveFrom: '2026-09-01T00:00:00Z',
  effectiveTo: '2027-09-01T00:00:00Z',
  rules: [
    {
      when: {
        op: 'and',
        args: [
          { op: 'inSet', field: 'portOfLoading', set: 'region:transpacific-uswc' },
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
};

function compiled(): CompiledRegistry {
  const { result, doc } = validateRegistryDoc(REGISTRY);
  expect(result.errors).toEqual([]);
  return new CompiledRegistry(doc!, 1);
}

describe('registry validation', () => {
  it('accepts the reference registry without errors', () => {
    const { result } = validateRegistryDoc(REGISTRY);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects duplicate field ids with a precise path', () => {
    const { result } = validateRegistryDoc({
      entities: [{ id: 'e', fields: [{ id: 'x', type: 'string' }, { id: 'x', type: 'number' }] }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.path).toBe('entities[0].fields[1].id');
  });

  it('rejects unknown value-set references and undeclared subQueueField', () => {
    const { result } = validateRegistryDoc({
      entities: [{ id: 'e', subQueueField: 'nope', fields: [{ id: 'x', type: 'string', valueSet: 'missing' }] }],
    });
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('entities[0].fields[0].valueSet');
    expect(paths).toContain('entities[0].subQueueField');
  });

  it('rejects a field declaring both valueSet and inline values', () => {
    const { result } = validateRegistryDoc({
      valueSets: [{ id: 's', values: [1] }],
      entities: [{ id: 'e', fields: [{ id: 'x', type: 'number', valueSet: 's', values: [1] }] }],
    });
    expect(result.errors.some((e) => e.message.includes('not both'))).toBe(true);
  });
});

describe('compiled registry', () => {
  it('resolves columns (explicit and defaulted), value-sets, and sub-queues', () => {
    const reg = compiled();
    expect(reg.columnFor('booking', 'shipperParty')).toBe('shipper_party');
    expect(reg.columnFor('booking', 'currency')).toBe('currency');
    expect(reg.valueSet('iso4217')).toEqual(['USD', 'EUR', 'CNY']);
    expect(reg.fieldValues('booking', 'portOfLoading')).toEqual(['USLAX', 'USORE', 'USNYC', 'CNNGB', 'CNSHA']);
    expect(reg.subQueues('booking')).toEqual(['new', 'confirmed', 'shipped']);
    expect(reg.filterContext().valueSet?.('ports')).toBeDefined();
  });

  it('hashes canonically — key order does not matter, content does', () => {
    const a = registryDocSchema.parse(REGISTRY);
    const reordered = JSON.parse(JSON.stringify(a)) as typeof a;
    reordered.entities.reverse();
    // Same keys, different array order IS different content.
    expect(registryHash(a)).not.toBe(registryHash(reordered));
    // Object key order is normalized away.
    const b = registryDocSchema.parse(JSON.parse(JSON.stringify(REGISTRY)));
    expect(registryHash(a)).toBe(registryHash(b));
  });
});

describe('group validation (tier-1)', () => {
  it('accepts the §2 worked example — the M1 exit criterion', () => {
    const { result, definition } = validateGroupDefinition(WORKED_EXAMPLE, compiled());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(definition?.hitPolicy).toBe('first');
    expect(definition?.astVersion).toBe(1);
    // Round-trip: defaults applied, content preserved.
    expect(definition?.rules[0]?.then[0]?.verb).toBe('assert');
  });

  it('rejects an unregistered entity', () => {
    const { result } = validateGroupDefinition({ ...WORKED_EXAMPLE, entity: 'nope' }, compiled());
    expect(result.errors[0]).toMatchObject({ path: 'entity' });
  });

  it('rejects undeclared fields in scope, when, and actions', () => {
    const bad: GroupDefinitionInput = {
      ...WORKED_EXAMPLE,
      scope: { all: [{ field: 'ghost', op: 'eq', value: 1 }] },
      rules: [
        {
          when: { op: 'eq', field: 'phantom', value: 1 },
          then: [{ verb: 'set', field: 'spectre', value: 1 }],
        },
      ],
    };
    const { result } = validateGroupDefinition(bad, compiled());
    const messages = result.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    expect(messages).toContain('scope: field "ghost"');
    expect(messages).toContain('rules[0].when: field "phantom"');
    expect(messages).toContain('rules[0].then[0].field: field "spectre"');
  });

  it('validates effect targets: entity registration, target fields, $row references', () => {
    const withEffect: GroupDefinitionInput = {
      ...WORKED_EXAMPLE,
      rules: [
        {
          when: { op: 'eq', field: 'shipperParty', value: 'A' },
          then: [
            {
              verb: 'effect',
              target: {
                entity: 'shipmentTask',
                op: 'upsert',
                key: { bookingId: '$row.teu' },
                set: { reviewRequired: true },
              },
            },
          ],
        },
      ],
    };
    expect(validateGroupDefinition(withEffect, compiled()).result.ok).toBe(true);

    const badRef = JSON.parse(JSON.stringify(withEffect)) as GroupDefinitionInput;
    (badRef.rules![0]!.then[0] as { target: { key: Record<string, unknown> } }).target.key = {
      bookingId: '$row.ghost',
    };
    const { result } = validateGroupDefinition(badRef, compiled());
    expect(result.errors.some((e) => e.message.includes('"ghost" is not declared'))).toBe(true);

    const badEntity = JSON.parse(JSON.stringify(withEffect)) as GroupDefinitionInput;
    (badEntity.rules![0]!.then[0] as { target: { entity: string } }).target.entity = 'nowhere';
    expect(
      validateGroupDefinition(badEntity, compiled()).result.errors.some((e) =>
        e.path.endsWith('target.entity'),
      ),
    ).toBe(true);
  });

  it('rejects inverted windows and flags never-firing rule windows', () => {
    const inverted: GroupDefinitionInput = {
      ...WORKED_EXAMPLE,
      effectiveFrom: '2027-01-01T00:00:00Z',
      effectiveTo: '2026-01-01T00:00:00Z',
    };
    expect(
      validateGroupDefinition(inverted, compiled()).result.errors.some((e) => e.path === 'effectiveTo'),
    ).toBe(true);

    const neverFires: GroupDefinitionInput = {
      ...WORKED_EXAMPLE,
      rules: [
        {
          ...WORKED_EXAMPLE.rules![0]!,
          effectiveFrom: '2028-01-01T00:00:00Z',
          effectiveTo: '2028-06-01T00:00:00Z',
        },
      ],
    };
    const { result } = validateGroupDefinition(neverFires, compiled());
    expect(result.ok).toBe(true); // warning, not error
    expect(result.warnings.some((w) => w.message.includes('can never fire'))).toBe(true);
  });

  it('warns on values outside a field\'s legal set and on type mismatches', () => {
    const fishy: GroupDefinitionInput = {
      ...WORKED_EXAMPLE,
      scope: { all: [{ field: 'currency', op: 'eq', value: 'XYZ' }] },
      rules: [
        {
          when: { op: 'gt', field: 'teu', value: 'many' },
          then: [{ verb: 'set', field: 'currency', value: 'GBP' }],
        },
      ],
    };
    const { result } = validateGroupDefinition(fishy, compiled());
    expect(result.ok).toBe(true);
    const warnings = result.warnings.map((w) => w.message).join('\n');
    expect(warnings).toContain('"XYZ" is not among the legal values');
    expect(warnings).toContain('does not match declared type "number"');
    expect(warnings).toContain('"GBP" is not among the legal values');
  });

  it('accepts partial drafts with zod path-keyed errors; blocks empty groups only at activation', () => {
    const draft = { entity: 'booking', scope: { all: [{ field: 'status', op: 'eq', value: 'new' }] } };
    const { result } = validateGroupDefinition(draft as GroupDefinitionInput, compiled());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'name')).toBe(true);

    const emptyRules: GroupDefinitionInput = { ...WORKED_EXAMPLE, rules: [] };
    expect(validateGroupDefinition(emptyRules, compiled()).result.ok).toBe(true);
    const activation = validateGroupDefinition(emptyRules, compiled(), { forActivation: true });
    expect(activation.result.errors.some((e) => e.path === 'rules')).toBe(true);
  });
});
