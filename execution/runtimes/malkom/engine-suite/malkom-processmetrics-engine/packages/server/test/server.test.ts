/**
 * Server-shell boot smoke test — the gap the rules engine shipped with,
 * closed here: the node:http shell really serves the fetch handler on a
 * random free port, requests round-trip end-to-end (headers, streamed JSON
 * bodies), and bearer auth answers 401 before anything else happens.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { buildFetchHandler, MetricsEngine, noopLogger } from '../../core/src/index.js';
import { DEFAULT_MAX_BODY_BYTES, drainAndStop, serveFetchHandler, type FetchHandler, type ServeOptions } from '../src/index.js';

interface Running {
  engine: MetricsEngine;
  server: Server;
  base: string;
}

const running: Running[] = [];

async function boot(engineOptions: ConstructorParameters<typeof MetricsEngine>[0] = {}): Promise<Running> {
  const engine = new MetricsEngine({ logger: noopLogger, ...engineOptions });
  await engine.start();
  // Port 0: the OS assigns a free port — nothing hardcoded, no collisions.
  const server = serveFetchHandler(buildFetchHandler(engine), { port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  const entry = { engine, server, base: `http://127.0.0.1:${port}` };
  running.push(entry);
  return entry;
}

afterAll(async () => {
  for (const r of running) {
    await new Promise<void>((resolve) => r.server.close(() => resolve()));
    await r.engine.stop();
  }
});

describe('malkom-metrics-server shell', () => {
  it('serves the control plane over real HTTP on a random free port', async () => {
    const { base } = await boot();

    const res = await fetch(`${base}/v1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const doc = (await res.json()) as Record<string, unknown>;
    expect(doc['engine']).toBe('malkom-processmetrics-engine');

    // A mutation round-trips through the node:http body plumbing.
    const put = await fetch(`${base}/v1/registry`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entities: [{ id: 'booking', fields: [{ id: 'createdAt', type: 'date' }] }],
      }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { version: number }).version).toBe(1);

    // Prometheus text streams with its own content type.
    const prom = await fetch(`${base}/v1/telemetry`);
    expect(prom.status).toBe(200);
    expect(prom.headers.get('content-type')).toContain('text/plain');
    expect(await prom.text()).toContain('malkom_metrics_transitions_total');

    // Unknown routes are honest 404 envelopes, not empty sockets.
    expect((await fetch(`${base}/v1/nope`)).status).toBe(404);
  });

  it('enforces bearer auth at the shell boundary: 401 without a key', async () => {
    const { base } = await boot({ auth: { adminKeys: ['adm-1'], readKeys: [] } });

    expect((await fetch(`${base}/v1`)).status).toBe(401);
    const authed = await fetch(`${base}/v1`, { headers: { authorization: 'Bearer adm-1' } });
    expect(authed.status).toBe(200);
    expect((await fetch(`${base}/v1`, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Body budget — the shell must never buffer an unbounded body (review wave 2)
// ---------------------------------------------------------------------------

/** Serve a bare FetchHandler (no engine) and hand back base + close. */
async function serveRaw(
  handler: FetchHandler,
  opts: Omit<ServeOptions, 'port'> = {},
): Promise<{ base: string; server: Server; close: () => Promise<void> }> {
  const server = serveFetchHandler(handler, { port: 0, host: '127.0.0.1', ...opts });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

describe('request-body budget (max-body-bytes)', () => {
  it('refuses a declared over-budget body with 413 WITHOUT running the handler', async () => {
    let calls = 0;
    const spy: FetchHandler = async () => {
      calls += 1;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const { base, close } = await serveRaw(spy, { maxBodyBytes: 1024 });
    try {
      // fetch sets Content-Length for a string body — the cheap pre-check path.
      const res = await fetch(`${base}/v1/registry`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(4096),
      });
      expect(res.status).toBe(413);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(calls).toBe(0); // auth (inside the handler) never saw the request

      // An under-budget body still round-trips.
      const ok = await fetch(`${base}/v1/registry`, { method: 'PUT', body: 'x'.repeat(512) });
      expect(ok.status).toBe(200);
      expect(calls).toBe(1);
    } finally {
      await close();
    }
  });

  it('aborts a CHUNKED body mid-stream once the byte count crosses the budget', async () => {
    let calls = 0;
    const spy: FetchHandler = async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    };
    const { base, close } = await serveRaw(spy, { maxBodyBytes: 1024 });
    try {
      // A streamed body carries NO Content-Length — only the running byte
      // count can enforce the budget.
      const chunk = new Uint8Array(512).fill(120);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < 8; i += 1) controller.enqueue(chunk); // 4 KiB > 1 KiB budget
          controller.close();
        },
      });
      let status: number | undefined;
      let aborted = false;
      try {
        const res = await fetch(`${base}/v1/registry`, {
          method: 'PUT',
          body,
          duplex: 'half',
        });
        status = res.status;
      } catch {
        aborted = true; // the shell destroyed the socket mid-upload — also a pass
      }
      if (!aborted) expect(status).toBe(413);
      expect(calls).toBe(0); // the handler never ran either way
    } finally {
      await close();
    }
  });

  it('boots with the documented default budget (1 MiB) and refuses beyond it before auth', async () => {
    expect(DEFAULT_MAX_BODY_BYTES).toBe(1_048_576);
    const { base } = await boot({ auth: { adminKeys: ['adm-1'], readKeys: [] } });
    // No key AND over budget: the budget answers first — a 413 (when the
    // client reads it before its upload hits the destroyed socket) or a
    // connection abort. NEVER a 401: auth lives in the handler, and the
    // handler must not run.
    let status: number | undefined;
    let aborted = false;
    try {
      const res = await fetch(`${base}/v1/registry`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(DEFAULT_MAX_BODY_BYTES + 1),
      });
      status = res.status;
    } catch {
      aborted = true; // the shell destroyed the socket mid-upload — also a pass
    }
    if (!aborted) expect(status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown — drain in-flight requests, THEN stop the engine
// ---------------------------------------------------------------------------

describe('drainAndStop', () => {
  it('lets an in-flight response complete before the engine stops', async () => {
    const events: string[] = [];
    const slow: FetchHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const { base, server } = await serveRaw(slow);

    const inFlight = fetch(`${base}/v1`).then((res) => {
      events.push('response');
      return res.status;
    });
    // Give the request time to reach the handler, then start the drain.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const drained = drainAndStop(server, async () => {
      events.push('engine-stopped');
    });

    expect(await inFlight).toBe(200); // the old fire-and-forget close raced this
    await drained;
    expect(events).toEqual(['response', 'engine-stopped']); // drain BEFORE stop, always
  });
});
