import { beforeAll, describe, expect, it } from 'vitest';
import {
  AllocationEngine,
  buildFetchHandler,
  MemoryBackendAdapter,
  noopLogger,
} from '../src/index.js';
import { agentRow, parseQueue, queueInput, taskRow } from './helpers.js';
import { isAdapterRef } from '../src/config/schemas.js';

const ADMIN = 'admin-key-1';
const READ = 'read-key-1';

function req(method: string, path: string, opts: { key?: string; body?: unknown } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.key !== undefined) headers['authorization'] = `Bearer ${opts.key}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

describe('control-plane router', () => {
  let handler: (r: Request) => Promise<Response>;
  let engine: AllocationEngine;
  let adapter: MemoryBackendAdapter;

  beforeAll(async () => {
    engine = new AllocationEngine({ logger: noopLogger });
    const bindings = parseQueue();
    if (isAdapterRef(bindings.work) || isAdapterRef(bindings.workers)) throw new Error('unexpected');
    adapter = new MemoryBackendAdapter({
      workRows: [taskRow(1), taskRow(2)],
      workerRows: [agentRow('A')],
      work: bindings.work,
      workers: bindings.workers,
    });
    engine.registerAdapter('mem', adapter);
    await engine.start();
    handler = buildFetchHandler(engine, { auth: { adminKeys: [ADMIN], readKeys: [READ] } });
  });

  it('serves the discovery document without auth', async () => {
    const res = await handler(req('GET', '/v1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { engine: string; capabilities: { strategies: string[] } };
    expect(body.engine).toBe('malkom-alloc');
    expect(body.capabilities.strategies).toContain('round_robin');
  });

  it('serves JSON Schemas generated from the zod source of truth', async () => {
    const res = await handler(req('GET', '/v1/schema/queue-definition'));
    expect(res.status).toBe(200);
    const schema = (await res.json()) as Record<string, unknown>;
    expect(JSON.stringify(schema)).toContain('allocatableWhen');
  });

  it('enforces scopes: 401 without a key, 403 for read key on admin routes', async () => {
    expect((await handler(req('GET', '/v1/queues'))).status).toBe(401);
    expect((await handler(req('GET', '/v1/queues', { key: READ }))).status).toBe(200);
    expect((await handler(req('POST', '/v1/queues/x/pause', { key: READ }))).status).toBe(403);
    expect((await handler(req('GET', '/v1/queues', { key: 'wrong' }))).status).toBe(401);
  });

  it('PUT /v1/queues/:id validates and stores; bad configs get structured 422s', async () => {
    const good = queueInput((d) => {
      d.work = { adapterRef: 'mem' };
      d.workers = { adapterRef: 'mem' };
    });
    const ok = await handler(req('PUT', '/v1/queues/q-test', { key: ADMIN, body: good }));
    expect(ok.status).toBe(200);
    const stored = (await ok.json()) as { definition: { version: number } };
    expect(stored.definition.version).toBe(1);

    const bad = queueInput((d) => {
      d.strategy = { kind: 'nope' };
      d.work = { adapterRef: 'mem' };
      d.workers = { adapterRef: 'mem' };
    });
    const res = await handler(req('PUT', '/v1/queues/q-test', { key: ADMIN, body: bad }));
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: { code: string; details: string[] } };
    expect(err.error.code).toBe('CONFIG_INVALID');
    expect(err.error.details.join(' ')).toContain('registered:');
  });

  it('trigger → runs → run detail → allocations round-trip', async () => {
    const trig = await handler(req('POST', '/v1/queues/q-test/trigger', { key: ADMIN }));
    expect(trig.status).toBe(200);
    const record = (await trig.json()) as { id: string; counts: { assigned: number } };
    expect(record.counts.assigned).toBe(2);

    const runs = await handler(req('GET', '/v1/runs?queueId=q-test', { key: READ }));
    expect(((await runs.json()) as { total: number }).total).toBeGreaterThan(0);

    const detail = await handler(req('GET', `/v1/runs/${record.id}`, { key: READ }));
    expect(detail.status).toBe(200);

    const allocs = await handler(req('GET', '/v1/allocations?workerId=A', { key: READ }));
    const list = (await allocs.json()) as { allocations: Array<{ workerId: string }> };
    expect(list.allocations.length).toBe(2);
  });

  it('refuses unfiltered bulk run deletion', async () => {
    const res = await handler(req('DELETE', '/v1/runs', { key: ADMIN }));
    expect(res.status).toBe(422);
  });

  it('serves Prometheus text and JSON metrics, resets on admin request', async () => {
    const prom = await handler(req('GET', '/v1/metrics', { key: READ }));
    expect(prom.status).toBe(200);
    expect(await prom.text()).toContain('malkom_runs_total');

    const reset = await handler(req('POST', '/v1/metrics/reset', { key: ADMIN }));
    expect(reset.status).toBe(200);
    const after = await handler(req('GET', '/v1/metrics.json', { key: READ }));
    const snap = (await after.json()) as { counters: Record<string, number> };
    expect(Object.keys(snap.counters)).toHaveLength(0);
  });

  it('404s unknown routes with a helpful error', async () => {
    const res = await handler(req('GET', '/v1/nope', { key: READ }));
    expect(res.status).toBe(404);
  });
});
