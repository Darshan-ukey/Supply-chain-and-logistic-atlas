/**
 * Registry compile + tier-1 validation, adapted from the rules engine's
 * validate suite (registry parts only — definition validation arrives with
 * the definition schemas in M1).
 */
import { describe, expect, it } from 'vitest';
import { CompiledRegistry, registryHash } from '../src/domain/registry.js';
import { validateRegistryDoc } from '../src/config/validate.js';
import { registryDocSchema, type RegistryDocInput } from '../src/config/schemas.js';
import { jsonSchemas, SCHEMA_VERSION } from '../src/config/jsonschema.js';

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

  it('rejects malformed shapes with zod path-keyed errors', () => {
    const { result } = validateRegistryDoc({
      entities: [{ id: 'e', fields: [{ id: 'bad field', type: 'string' }] }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.path).toBe('entities[0].fields[0].id');
  });

  it('rejects duplicate entity, field, and value-set ids with precise paths', () => {
    const { result } = validateRegistryDoc({
      valueSets: [
        { id: 's', values: [1] },
        { id: 's', values: [2] },
      ],
      entities: [
        { id: 'e', fields: [{ id: 'x', type: 'string' }, { id: 'x', type: 'number' }] },
        { id: 'e', fields: [{ id: 'y', type: 'string' }] },
      ],
    });
    expect(result.ok).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('valueSets[1].id');
    expect(paths).toContain('entities[0].fields[1].id');
    expect(paths).toContain('entities[1].id');
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

  it('warns (not errors) on incomplete table/connection bindings', () => {
    const { result } = validateRegistryDoc({
      entities: [
        { id: 'a', connectionRef: 'main', fields: [{ id: 'x', type: 'string' }] },
        { id: 'b', table: { name: 't' }, fields: [{ id: 'x', type: 'string' }] },
      ],
    });
    expect(result.ok).toBe(true);
    const paths = result.warnings.map((w) => w.path);
    expect(paths).toContain('entities[0].connectionRef');
    expect(paths).toContain('entities[1].table');
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
    expect(reg.entityIds()).toEqual(['booking', 'shipmentTask']);
    expect(reg.fieldIds('shipmentTask')).toEqual(['bookingId', 'reviewRequired']);
    expect(reg.field('booking', 'ghost')).toBeUndefined();
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

describe('json schema export', () => {
  it('exposes the registry, connection, and authoring schemas, versioned', () => {
    expect(SCHEMA_VERSION).toBe(1);
    const schemas = jsonSchemas();
    expect(Object.keys(schemas).sort()).toEqual([
      'assignment',
      'calendar',
      'connection-profile',
      'engine-defaults',
      'metric-definition',
      'registry-doc',
    ]);
    const registrySchema = schemas['registry-doc'] as { properties?: Record<string, unknown> };
    expect(registrySchema.properties).toHaveProperty('entities');
    expect(registrySchema.properties).toHaveProperty('valueSets');
    // The authoring schemas export the pre-default (input) shape.
    const definitionSchema = schemas['metric-definition'] as { properties?: Record<string, unknown> };
    expect(definitionSchema.properties).toHaveProperty('formula');
    expect(definitionSchema.properties).toHaveProperty('window');
    const calendar = schemas['calendar'] as { properties?: Record<string, unknown> };
    expect(calendar.properties).toHaveProperty('workweek');
    const assignment = schemas['assignment'] as { properties?: Record<string, unknown> };
    expect(assignment.properties).toHaveProperty('scope');
  });
});
