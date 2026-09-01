import { describe, expect, it } from 'vitest';
import { sourceBindingSchema, streamDefinitionSchema } from '../src/config/schemas.js';
import {
  assertValid,
  bindingColumns,
  canonicalJson,
  filterFingerprint,
  isValid,
  validateBinding,
  validateStream,
} from '../src/config/validate.js';
import { ConfigInvalidError } from '../src/domain/errors.js';

const intervalRoles = {
  case: 'queueId',
  activity: ['subqueueId', 'transactionStateId'],
  resource: 'allocatedTo',
  start: 'allocatedOn',
  end: 'completedOn',
};

function parseBinding(overrides: Record<string, unknown> = {}) {
  return sourceBindingSchema.parse({
    id: 'work-events',
    connectionRef: 'ops',
    from: { name: 'workEvents' },
    grain: 'interval',
    roles: intervalRoles,
    ...overrides,
  });
}

describe('grain determines which roles are mandatory', () => {
  it("requires a timestamp for grain 'event'", () => {
    const result = validateBinding(
      parseBinding({ grain: 'event', roles: { case: 'ref', activity: 'act' } }),
    );
    expect(isValid(result)).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('MISSING_ROLE');
    expect(result.errors.some((e) => e.path.endsWith('roles.timestamp'))).toBe(true);
  });

  it("requires start AND end for grain 'interval'", () => {
    const result = validateBinding(
      parseBinding({ roles: { case: 'ref', activity: 'act', start: 'startedAt' } }),
    );
    expect(result.errors.some((e) => e.path.endsWith('roles.end'))).toBe(true);
  });

  it('accepts a well-formed interval binding', () => {
    expect(isValid(validateBinding(parseBinding()))).toBe(true);
  });

  it('requires an activity from any step-yielding grain', () => {
    const result = validateBinding(
      parseBinding({ roles: { case: 'ref', start: 'a', end: 'b' } }),
    );
    expect(result.errors.some((e) => e.path.endsWith('roles.activity'))).toBe(true);
  });

  it("ignores rather than rejects an activity on grain 'snapshot'", () => {
    const result = validateBinding(
      parseBinding({
        grain: 'snapshot',
        roles: { case: 'ref', activity: 'act' },
        attributes: ['channel'],
      }),
    );
    expect(isValid(result)).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('IGNORED_ROLE');
  });

  it('warns that a snapshot with no attributes contributes nothing', () => {
    const result = validateBinding(
      parseBinding({ grain: 'snapshot', roles: { case: 'ref' }, attributes: [] }),
    );
    expect(result.warnings.map((w) => w.code)).toContain('EMPTY_SNAPSHOT');
  });
});

describe('correlation is mandatory', () => {
  it('rejects a binding with neither a case role nor object links', () => {
    const result = validateBinding(
      parseBinding({ roles: { activity: 'act', start: 'a', end: 'b' }, objects: [] }),
    );
    expect(result.errors.map((e) => e.code)).toContain('NO_CORRELATION');
  });

  it('accepts object links in place of an explicit case role', () => {
    const result = validateBinding(
      parseBinding({
        roles: { activity: 'act', start: 'a', end: 'b' },
        objects: [{ type: 'booking', column: 'bookingRef' }],
      }),
    );
    expect(isValid(result)).toBe(true);
  });

  it('rejects a duplicate object type within one binding', () => {
    const result = validateBinding(
      parseBinding({
        objects: [
          { type: 'booking', column: 'queueId' },
          { type: 'booking', column: 'otherRef' },
        ],
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_OBJECT_TYPE');
  });
});

describe('sharp edges are warned about, not hidden', () => {
  it('flags a timezone applied to a timestamp column', () => {
    const result = validateBinding(
      parseBinding({
        roles: { ...intervalRoles, start: { column: 'allocatedOn', tz: 'Asia/Kolkata' } },
      }),
    );
    expect(isValid(result)).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('NAIVE_TIMEZONE');
  });

  it('rejects two attributes resolving to the same name', () => {
    const result = validateBinding(
      parseBinding({
        attributes: [{ column: 'channel' }, { column: 'sourceChannel', as: 'channel' }],
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_ATTRIBUTE');
  });

  it('reports an unknown connection when a registry is supplied', () => {
    const result = validateBinding(parseBinding(), { knownConnections: new Set(['analytics']) });
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_CONNECTION');
  });
});

function parseStream(overrides: Record<string, unknown> = {}) {
  return streamDefinitionSchema.parse({
    id: 'booking-ops',
    bindings: [
      {
        id: 'work-events',
        connectionRef: 'ops',
        from: { name: 'workEvents' },
        grain: 'interval',
        roles: intervalRoles,
        objects: [
          { type: 'booking', column: 'queueId' },
          { type: 'item', column: 'itemId' },
        ],
      },
    ],
    ...overrides,
  });
}

describe('stream validation', () => {
  it('collects the object types available as case keys', () => {
    const result = validateStream(parseStream());
    expect(result.objectTypes).toEqual(['booking', 'item']);
    expect(result.canDiscoverControlFlow).toBe(true);
  });

  it('rejects a defaultCaseObject no binding declares', () => {
    const result = validateStream(parseStream({ defaultCaseObject: 'invoice' }));
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_OBJECT_TYPE');
    expect(result.errors[0]?.message).toContain('booking, item');
  });

  it('accepts a defaultCaseObject that exists', () => {
    expect(isValid(validateStream(parseStream({ defaultCaseObject: 'item' })))).toBe(true);
  });

  it('rejects duplicate binding ids', () => {
    const stream = parseStream();
    const twice = parseStream({ bindings: [stream.bindings[0], stream.bindings[0]] });
    expect(validateStream(twice).errors.map((e) => e.code)).toContain('DUPLICATE_BINDING');
  });

  it('rejects a filter aimed at a binding that does not exist', () => {
    const result = validateStream(
      parseStream({
        filters: { where: { 'no-such-binding': { op: 'isNull', column: 'x' } }, caseLimit: 0 },
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_BINDING');
  });

  it('warns — but does not fail — when every source is snapshot grain', () => {
    const result = validateStream(
      parseStream({
        bindings: [
          {
            id: 'bookings',
            connectionRef: 'ops',
            from: { name: 'bookings' },
            grain: 'snapshot',
            roles: { case: 'ref' },
            attributes: ['channel', 'value'],
          },
        ],
      }),
    );
    expect(isValid(result)).toBe(true); // performance mining is still possible
    expect(result.canDiscoverControlFlow).toBe(false);
    const warning = result.warnings.find((w) => w.code === 'NO_CONTROL_FLOW');
    expect(warning?.message).toContain('will be refused');
    expect(warning?.message).toContain('Bind an append-only');
  });

  it('never lets a case limit truncate silently', () => {
    const result = validateStream(
      parseStream({ filters: { where: {}, caseLimit: 5000 } }),
    );
    const warning = result.warnings.find((w) => w.code === 'BOUNDED_COVERAGE');
    expect(warning?.message).toContain('sample, not a total');
  });
});

describe('assertValid', () => {
  it('throws a ConfigInvalidError carrying every issue', () => {
    const result = validateBinding(
      parseBinding({ grain: 'event', roles: { case: 'ref' } }),
    );
    expect(() => assertValid(result, 'binding')).toThrow(ConfigInvalidError);
    try {
      assertValid(result, 'binding');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigInvalidError);
      const cfg = err as ConfigInvalidError;
      expect(cfg.issues.length).toBe(result.errors.length);
      expect(cfg.details[0]).toContain('roles.');
    }
  });

  it('is a no-op when there are no errors', () => {
    expect(() => assertValid(validateBinding(parseBinding()), 'binding')).not.toThrow();
  });
});

describe('canonicalJson and fingerprints', () => {
  it('is insensitive to key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('is sensitive to values', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it('drops undefined but keeps null, which mean different things in config', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('serialises dates by instant, not by local formatting', () => {
    expect(canonicalJson({ t: new Date('2026-03-01T09:00:00Z') })).toBe(
      '{"t":"2026-03-01T09:00:00.000Z"}',
    );
  });

  it('gives identical streams the same fingerprint regardless of binding order', () => {
    const a = parseStream({
      bindings: [
        parseStream().bindings[0],
        {
          id: 'bookings',
          connectionRef: 'ops',
          from: { name: 'bookings' },
          grain: 'snapshot',
          roles: { case: 'ref' },
          attributes: ['channel'],
        },
      ],
    });
    const b = parseStream({
      bindings: [
        {
          id: 'bookings',
          connectionRef: 'ops',
          from: { name: 'bookings' },
          grain: 'snapshot',
          roles: { case: 'ref' },
          attributes: ['channel'],
        },
        parseStream().bindings[0],
      ],
    });
    expect(filterFingerprint(a)).toBe(filterFingerprint(b));
  });

  it('changes when a role is remapped, because already-materialised rows change meaning', () => {
    const before = filterFingerprint(parseStream());
    const after = filterFingerprint(
      parseStream({
        bindings: [{ ...parseStream().bindings[0], roles: { ...intervalRoles, case: 'itemId' } }],
      }),
    );
    expect(after).not.toBe(before);
  });

  it('excludes the time window, so widening appends rather than invalidates', () => {
    const narrow = filterFingerprint(
      parseStream({
        filters: {
          where: {},
          caseLimit: 0,
          window: { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' },
        },
      }),
    );
    const wide = filterFingerprint(
      parseStream({
        filters: {
          where: {},
          caseLimit: 0,
          window: { from: '2026-01-01T00:00:00Z', to: '2026-06-01T00:00:00Z' },
        },
      }),
    );
    expect(narrow).toBe(wide);
  });
});

describe('bindingColumns', () => {
  it('collects every column a binding touches, for bind-time verification', () => {
    const cols = bindingColumns(
      parseBinding({
        attributes: [{ column: 'channel' }],
        where: { op: 'eq', column: 'tenantId', value: 't1' },
      }),
    );
    expect([...cols].sort()).toEqual(
      ['allocatedOn', 'allocatedTo', 'channel', 'completedOn', 'queueId', 'subqueueId', 'tenantId', 'transactionStateId'].sort(),
    );
  });

  it('includes object-link columns even when a case role is also set', () => {
    const cols = bindingColumns(
      parseBinding({ objects: [{ type: 'item', column: 'itemId' }] }),
    );
    expect(cols.has('itemId')).toBe(true);
    expect(cols.has('queueId')).toBe(true);
  });
});
