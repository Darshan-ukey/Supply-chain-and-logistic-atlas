import { describe, expect, it } from 'vitest';
import {
  applyMapping,
  buildFetchHandler,
  CONNECTORS,
  connectorById,
  connectorDefaults,
  IntegrationEngine,
  validateConfig,
} from '../src/index.js';

/** A fetch stub that always answers with the given status and body. */
const fetchStub = (status: number, body: unknown = {}): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;

const restConnection = {
  id: 'client-api',
  connectorId: 'out.rest',
  name: 'Client write-back',
  config: { endpoint: 'https://client.example/api' },
  secretRefs: { authToken: 'env:CLIENT_TOKEN' },
};

describe('registry', () => {
  it('has unique ids and valid field defaults on every connector', () => {
    const ids = new Set(CONNECTORS.map((descriptor) => descriptor.id));
    expect(ids.size).toBe(CONNECTORS.length);
    for (const descriptor of CONNECTORS) {
      const check = validateConfig(descriptor, connectorDefaults(descriptor.id));
      const requiredMissing = descriptor.cfg.filter((field) => field.req === true && field.d === '');
      // defaults are valid except where a field is required and intentionally blank
      expect(check.errors.length).toBe(requiredMissing.length);
    }
  });

  it('covers both planes and the approved categories', () => {
    expect(CONNECTORS.some((descriptor) => descriptor.plane === 'infra')).toBe(true);
    expect(connectorById('store.s3')?.capabilities).toContain('poll');
    expect(connectorById('infra.byos')?.execution).toBe('none');
  });

  it('generates a usage manual with IO expectations for every connector', async () => {
    const { usageFor } = await import('../src/registry.js');
    for (const descriptor of CONNECTORS) {
      const usage = usageFor(descriptor);
      expect(usage.overview).toContain(descriptor.name);
      expect(usage.setup.length).toBeGreaterThan(1);
      expect(usage.testing.length).toBeGreaterThan(20);
      expect(usage.execution.length).toBeGreaterThan(20);
      expect(usage.input.length).toBeGreaterThan(20);
      expect(usage.output.length).toBeGreaterThan(20);
      expect(typeof usage.samplePayload).toBe('object');
    }
  });

  it('assigns a provider family and fully-qualified id to every connector', async () => {
    const { providerOf, fqidOf } = await import('../src/registry.js');
    expect(providerOf('store.s3')).toBe('aws');
    expect(fqidOf('store.s3')).toBe('aws.store.s3');
    expect(providerOf('store.azblob')).toBe('microsoft');
    expect(fqidOf('queue.pubsub')).toBe('gcp.queue.pubsub');
    expect(providerOf('queue.kafka')).toBe('byos');
    expect(providerOf('out.rest')).toBe('other');
    expect(fqidOf('out.rest')).toBe('out.rest');
    for (const descriptor of CONNECTORS) {
      expect(descriptor.provider).toBe(providerOf(descriptor.id));
      expect(descriptor.fqid).toBe(fqidOf(descriptor.id));
    }
    // every cloud target carries its own family
    expect(CONNECTORS.filter((d) => d.provider === 'aws').length).toBeGreaterThan(5);
    expect(CONNECTORS.filter((d) => d.provider === 'byos').length).toBeGreaterThan(5);
  });

  it('rejects bad config values with readable errors', () => {
    const descriptor = connectorById('out.rest');
    expect(descriptor).toBeDefined();
    if (descriptor === undefined) return;
    const check = validateConfig(descriptor, { endpoint: '', timeoutMs: 'soon' });
    expect(check.ok).toBe(false);
    expect(check.errors.join(' ')).toMatch(/Endpoint URL is required/);
    expect(check.errors.join(' ')).toMatch(/Timeout \(ms\) must be a number/);
  });
});

describe('connections', () => {
  it('creates, versions and lists connections', () => {
    const engine = new IntegrationEngine();
    expect(engine.upsertConnection(restConnection).version).toBe(1);
    expect(engine.upsertConnection(restConnection).version).toBe(2);
    expect(engine.listConnections()).toHaveLength(1);
    expect(engine.getConnection('client-api')?.status).toBe('UNTESTED');
  });

  it('rejects unknown connectors and invalid config', () => {
    const engine = new IntegrationEngine();
    expect(() => engine.upsertConnection({ ...restConnection, connectorId: 'no.such' })).toThrow(/unknown connector/);
    expect(() => engine.upsertConnection({ ...restConnection, config: {} })).toThrow(/required/);
  });

  it('blocks deletion while bindings exist', () => {
    const engine = new IntegrationEngine();
    engine.upsertConnection(restConnection);
    engine.upsertBinding({
      id: 'b1', connectionId: 'client-api', consumerType: 'pipeline-step', consumerId: 'step-7', direction: 'OUTPUT',
    });
    expect(() => engine.deleteConnection('client-api')).toThrow(/1 binding/);
    engine.deleteBinding('b1');
    engine.deleteConnection('client-api');
    expect(engine.listConnections()).toHaveLength(0);
  });
});

describe('test / verify', () => {
  it('http-ping marks reachable endpoints healthy and records a TEST run', async () => {
    const engine = new IntegrationEngine({ fetchImpl: fetchStub(200) });
    engine.upsertConnection(restConnection);
    const result = await engine.testConnection('client-api');
    expect(result.status).toBe('HEALTHY');
    expect(engine.getConnection('client-api')?.status).toBe('HEALTHY');
    expect(engine.runs('client-api', null, 10, 0)[0]?.kind).toBe('TEST');
  });

  it('adapter connectors degrade without an adapter and pass with one', async () => {
    const engine = new IntegrationEngine();
    engine.upsertConnection({
      id: 's3', connectorId: 'store.s3', name: 'Bucket', config: { bucket: 'docs' }, secretRefs: {},
    });
    expect((await engine.testConnection('s3')).status).toBe('DEGRADED');
    engine.registerAdapter('store.s3', { test: async () => ({ ok: true, detail: 'listed 3 objects' }) });
    expect((await engine.testConnection('s3')).status).toBe('HEALTHY');
  });
});

describe('execution', () => {
  it('delivers http connectors and keeps no payload on success', async () => {
    const engine = new IntegrationEngine({ fetchImpl: fetchStub(200) });
    engine.upsertConnection(restConnection);
    const result = await engine.execute('client-api', { itemId: 'task-1', payload: { booking: 'BKG1' } });
    expect(result.status).toBe('OK');
    expect(engine.runs('client-api', null, 10, 0)[0]?.payload).toBeNull();
  });

  it('stores the payload on failure and supports redelivery', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      return new Response('{}', { status: calls === 1 ? 503 : 200 });
    }) as typeof fetch;
    const engine = new IntegrationEngine({ fetchImpl: flaky });
    engine.upsertConnection(restConnection);
    const first = await engine.execute('client-api', { itemId: 'task-2', payload: { booking: 'BKG2' } });
    expect(first.status).toBe('FAILED');
    const retry = await engine.redeliver(first.runId);
    expect(retry.status).toBe('OK');
  });

  it('stages non-native connectors PREPARED and closes them on collect', async () => {
    const engine = new IntegrationEngine();
    engine.upsertConnection({
      id: 'partner-sftp', connectorId: 'out.sftp', name: 'Partner SFTP',
      config: { host: 'sftp.partner.example', path: '/out' }, secretRefs: {},
    });
    const staged = await engine.execute('partner-sftp', { itemId: 'task-3', payload: { file: 'a.pdf' } });
    expect(staged.status).toBe('PREPARED');
    const closed = engine.collect(staged.runId, 'uploaded by host transport');
    expect(closed.status).toBe('OK');
    expect(closed.payload).toBeNull();
  });

  it('applies binding overrides and field mapping', async () => {
    const seen: Record<string, unknown>[] = [];
    const capture = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const engine = new IntegrationEngine({ fetchImpl: capture });
    engine.upsertConnection(restConnection);
    engine.upsertBinding({
      id: 'map-1', connectionId: 'client-api', consumerType: 'pipeline-step', consumerId: 'out-step',
      direction: 'OUTPUT',
      mapping: [
        { from: 'booking.number', to: 'bkg', coerce: 'string' },
        { from: 'qty', to: 'quantity', coerce: 'number' },
      ],
    });
    await engine.execute('client-api', {
      itemId: 'task-4', bindingId: 'map-1', payload: { booking: { number: 'BKG9' }, qty: '5' },
    });
    expect(seen[0]).toEqual({ bkg: 'BKG9', quantity: 5 });
  });

  it('mapping helper coerces and injects constants', () => {
    const mapped = applyMapping(
      [
        { from: 'a', to: 'x', coerce: 'boolean' },
        { from: '', to: 'source', constant: 'malkom' },
      ],
      { a: 'true' },
    );
    expect(mapped).toEqual({ x: true, source: 'malkom' });
  });
});

describe('custom http connectors', () => {
  it('executes declarative operations and picks the response path', async () => {
    const engine = new IntegrationEngine({ fetchImpl: fetchStub(200, { data: { id: 'T-77' } }) });
    engine.upsertCustomDef({
      id: 'carrier-x', name: 'Carrier X', baseUrl: 'https://api.carrier-x.example', auth: 'bearer',
      operations: [
        { key: 'track', name: 'Track', method: 'GET', path: 'track/{container}', direction: 'read', responsePick: 'data', isTest: true },
        { key: 'book', name: 'Book', method: 'POST', path: 'bookings', direction: 'write', bodyTemplate: '{"container":"{container}"}' },
      ],
    });
    engine.upsertConnection({
      id: 'carrier-x-conn', connectorId: 'custom.http', name: 'Carrier X',
      config: { customDefId: 'carrier-x' }, secretRefs: { secret: 'env:CARRIER_X_KEY' },
    });
    expect((await engine.testConnection('carrier-x-conn')).status).toBe('HEALTHY');
    const run = await engine.execute('carrier-x-conn', {
      itemId: 'task-5', operation: 'track', payload: { container: 'MSKU123' },
    });
    expect(run.status).toBe('OK');
    expect(run.result).toEqual({ id: 'T-77' });
  });
});

describe('secret rotation', () => {
  const rotatingConnection = {
    id: 'mailbox', connectorId: 'mail.client', name: 'Ops mailbox',
    config: { provider: 'outlook', mailboxAddress: 'ops@example.com', clientId: 'client-abc' },
    secretRefs: { accessToken: 'vault:mailbox-access', refreshToken: 'vault:mailbox-refresh' },
  };

  it('writes a rotated secret to the reference its slot names', async () => {
    const written: { reference: string; value: string }[] = [];
    const engine = new IntegrationEngine({
      resolveSecret: async () => 'stale-token',
      persistSecret: async (reference, value) => { written.push({ reference, value }); },
    });
    engine.registerAdapter('mail.client', {
      execute: async (context) => {
        // an adapter names the slot; it never learns where the value lives
        await context.saveSecret?.('accessToken', 'fresh-token');
        return { ok: true, detail: 'refreshed and retried' };
      },
    });
    engine.upsertConnection(rotatingConnection);
    const result = await engine.execute('mailbox', { itemId: 'm1', payload: { path: '/me' } });
    expect(result.status).toBe('OK');
    expect(written).toEqual([{ reference: 'vault:mailbox-access', value: 'fresh-token' }]);
  });

  it('refuses to write a slot the connection never configured', async () => {
    let attempted = false;
    const engine = new IntegrationEngine({
      resolveSecret: async () => 'token',
      persistSecret: async () => { attempted = true; },
    });
    let failure = '';
    engine.registerAdapter('mail.client', {
      execute: async (context) => {
        try {
          await context.saveSecret?.('clientSecret', 'value');
        } catch (error) {
          failure = (error as Error).message;
        }
        return { ok: true, detail: 'done' };
      },
    });
    engine.upsertConnection(rotatingConnection);
    await engine.execute('mailbox', { itemId: 'm2', payload: { path: '/me' } });
    expect(failure).toMatch(/no secret reference configured for slot clientSecret/);
    expect(attempted).toBe(false);
  });

  it('leaves rotation unavailable when the host cannot write', async () => {
    const engine = new IntegrationEngine({ resolveSecret: async () => 'token' });
    let writer: unknown = 'unset';
    engine.registerAdapter('mail.client', {
      execute: async (context) => {
        writer = context.saveSecret;
        return { ok: true, detail: 'done' };
      },
    });
    engine.upsertConnection(rotatingConnection);
    await engine.execute('mailbox', { itemId: 'm3', payload: { path: '/me' } });
    // absent rather than a no-op, so an adapter cannot believe it persisted
    expect(writer).toBeUndefined();
  });
});

describe('legacy destination conversion', () => {
  it('spreads the endpoint onto the fields each connector declares', async () => {
    const { legacyConfigFor } = await import('../src/schemas.js');
    const destination = { id: 'd', name: 'D', headers: {}, timeoutMs: 15_000, enabled: true };
    expect(legacyConfigFor({ ...destination, format: 'API', endpoint: 'https://client.example/api' }))
      .toEqual({ endpoint: 'https://client.example/api', timeoutMs: 15_000 });
    expect(legacyConfigFor({ ...destination, format: 'EDI', endpoint: 'edi/iftmbf' }))
      .toEqual({ endpoint: 'edi/iftmbf' });
    expect(legacyConfigFor({ ...destination, format: 'EMAIL', endpoint: 'ops@client.example' })).toEqual({});
    expect(legacyConfigFor({ ...destination, format: 'SFTP', endpoint: 'sftp.partner.example/out/bookings' }))
      .toEqual({ host: 'sftp.partner.example', path: '/out/bookings' });
    // a bare path carries no host, and none is invented for it
    expect(legacyConfigFor({ ...destination, format: 'SFTP', endpoint: 'outbound/bookings' }))
      .toEqual({ path: '/outbound/bookings' });
  });

  it('rejects only what it cannot apply, and says why', () => {
    const engine = new IntegrationEngine();
    const base = { name: 'D', headers: {}, timeoutMs: 15_000, enabled: true };
    const result = engine.applyConfig({
      destinations: [
        { ...base, id: 'good-api', format: 'API', endpoint: 'https://client.example/api' },
        // recorded as a bare path: no host, so this one cannot be applied
        { ...base, id: 'headless-sftp', format: 'SFTP', endpoint: 'outbound/bookings' },
        { ...base, id: 'good-sftp', format: 'SFTP', endpoint: 'sftp.partner.example/out' },
      ],
    });
    expect(result.applied).toEqual(['good-api', 'good-sftp']);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.id).toBe('headless-sftp');
    expect(result.rejected[0]?.reason).toMatch(/Host is required/);
    // the healthy destinations are configured despite the bad one
    expect(engine.listConnections().map((record) => record.definition.id).sort()).toEqual(['good-api', 'good-sftp']);
  });
});

describe('config bundle', () => {
  it('applies v2 bundles and converts legacy destinations', () => {
    const engine = new IntegrationEngine();
    const applied = engine.applyConfig({
      destinations: [{ id: 'legacy-api', name: 'Legacy', format: 'API', endpoint: 'https://legacy.example' }],
      connections: [restConnection],
      bindings: [{ id: 'b1', connectionId: 'client-api', consumerType: 'pipeline-step', consumerId: 's1', direction: 'OUTPUT' }],
    });
    expect(applied.applied).toContain('legacy-api');
    expect(engine.getConnection('legacy-api')?.definition.connectorId).toBe('out.rest');
    expect(engine.listBindings('client-api')).toHaveLength(1);
  });
});

describe('router', () => {
  const call = async (
    handler: (request: Request) => Promise<Response>,
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const response = await handler(
      new Request(`http://engine.local${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  it('enforces scopes and serves the registry', async () => {
    const engine = new IntegrationEngine({ fetchImpl: fetchStub(200) });
    const handler = buildFetchHandler(engine, { adminKeys: ['admin-key'], readKeys: ['read-key'] });

    expect((await call(handler, 'GET', '/v1/connectors', null)).status).toBe(401);
    const listed = await call(handler, 'GET', '/v1/connectors?category=storage', 'read-key');
    expect(listed.status).toBe(200);
    expect((listed.body['connectors'] as unknown[]).length).toBeGreaterThan(2);

    expect((await call(handler, 'POST', '/v1/connections', 'read-key', restConnection)).status).toBe(403);
    expect((await call(handler, 'POST', '/v1/connections', 'admin-key', restConnection)).status).toBe(200);
    expect((await call(handler, 'POST', '/v1/connections/client-api/test', 'admin-key')).status).toBe(200);
    const runs = await call(handler, 'GET', '/v1/runs?connectionId=client-api', 'read-key');
    expect((runs.body['runs'] as unknown[]).length).toBe(1);
  });

  it('maps engine errors to HTTP statuses', async () => {
    const engine = new IntegrationEngine();
    const handler = buildFetchHandler(engine, { adminKeys: [], readKeys: [] });
    expect((await call(handler, 'GET', '/v1/connections/nope', null)).status).toBe(404);
    expect((await call(handler, 'POST', '/v1/connections', null, { id: 'x', connectorId: 'no.such', name: 'X' })).status).toBe(400);
  });
});
