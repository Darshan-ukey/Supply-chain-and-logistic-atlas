import { jsonSchemas } from '../config/jsonschema.js';
import { MalkomError } from '../domain/errors.js';
import type { RunStatus } from '../domain/types.js';
import type { AllocationEngine } from '../engine.js';
import { ApiAuth, type AuthKeys } from './auth.js';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function text(status: number, body: string, contentType: string): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } });
}

function errorResponse(err: unknown): Response {
  if (err instanceof MalkomError) {
    return json(err.status, { error: { code: err.code, message: err.message, details: err.details } });
  }
  const message = err instanceof Error ? err.message : String(err);
  return json(500, { error: { code: 'INTERNAL', message } });
}

async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new MalkomError('CONFIG_INVALID', 'request body is not valid JSON', 400);
  }
}

function dateParam(url: URL, name: string): Date | undefined {
  const v = url.searchParams.get(name);
  if (v === null) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new MalkomError('CONFIG_INVALID', `query param ${name} is not a valid timestamp`, 400);
  return d;
}

function intParam(url: URL, name: string): number | undefined {
  const v = url.searchParams.get(name);
  if (v === null) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new MalkomError('CONFIG_INVALID', `query param ${name} must be a non-negative integer`, 400);
  return n;
}

const RUN_STATUSES: ReadonlySet<string> = new Set(['running', 'succeeded', 'partial', 'failed', 'skipped', 'abandoned']);

function statusParam(url: URL): RunStatus | undefined {
  const v = url.searchParams.get('status');
  if (v === null) return undefined;
  if (!RUN_STATUSES.has(v)) throw new MalkomError('CONFIG_INVALID', `unknown run status ${JSON.stringify(v)}`, 400);
  return v as RunStatus;
}

function openapiSkeleton(): Record<string, unknown> {
  const summaries: Record<string, Record<string, string>> = {
    '/v1': { get: 'Discovery document: capabilities and links' },
    '/v1/health': { get: 'Liveness' },
    '/v1/schema': { get: 'List exported JSON Schemas' },
    '/v1/schema/{name}': { get: 'One JSON Schema (queue-definition, connection-profile, config-bundle)' },
    '/v1/metrics': { get: 'Prometheus text exposition' },
    '/v1/metrics.json': { get: 'Metrics snapshot as JSON' },
    '/v1/metrics/reset': { post: 'Reset in-process metrics (admin)' },
    '/v1/connections': { get: 'List connections (never secrets)', post: 'Register a connection profile (admin)' },
    '/v1/connections/{id}/probe': { get: 'Live connectivity + column introspection (admin)' },
    '/v1/connections/{id}/provision-work-events': { post: 'Create the default workEvents table, idempotent (admin)' },
    '/v1/queues': { get: 'List queue definitions' },
    '/v1/queues/{id}': { get: 'Queue definition + live status', put: 'Create/update (admin)', delete: 'Delete (admin)' },
    '/v1/queues/{id}/validate': { post: 'Three-tier validation (admin)' },
    '/v1/queues/{id}/dry-run': { post: 'Full pipeline, writes suppressed (admin)' },
    '/v1/queues/{id}/trigger': { post: 'Run now (admin)' },
    '/v1/queues/{id}/pause': { post: 'Pause (admin)' },
    '/v1/queues/{id}/resume': { post: 'Resume (admin)' },
    '/v1/queues/{id}/release': { post: 'Release items back to the pool (admin)' },
    '/v1/schedules': { get: 'Per-queue schedule with nextRunAt/lastStatus' },
    '/v1/runs': { get: 'Run history (queueId, status, since, until, limit, offset)', delete: 'Bulk delete with filters (admin)' },
    '/v1/runs/summary': { get: 'Aggregated run log: totals by status and per queue (queueId, since, until)' },
    '/v1/runs/{id}': { get: 'One run with full assignment audit', delete: 'Delete one run (admin)' },
    '/v1/coverage': { get: 'Unconfigured-work report: waiting items with no enabled queue definition (connectionRef, table)' },
    '/v1/allocations': { get: 'Flattened assignment audit (queueId, workerId, itemId, limit)' },
    '/v1/config': { get: 'Current config bundle view + version' },
    '/v1/config/apply': { post: 'Atomic bundle apply with optional expectedVersion (admin)' },
  };
  const paths: Record<string, unknown> = {};
  for (const [p, methods] of Object.entries(summaries)) {
    paths[p] = Object.fromEntries(
      Object.entries(methods).map(([m, summary]) => [m, { summary, responses: { '200': { description: 'OK' } } }]),
    );
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Malkom Work Allocation Engine — control plane', version: '0.1.0' },
    paths,
  };
}

/**
 * The control plane as a web-standard (Request) => Response handler. The
 * server shell serves it over node:http; library hosts mount it on their own
 * server (Hono/Bun/Deno natively; Express/Fastify via a tiny bridge). The
 * engine never claims a port it wasn't given.
 */
export function buildFetchHandler(
  engine: AllocationEngine,
  opts: { auth?: AuthKeys } = {},
): (req: Request) => Promise<Response> {
  const auth = new ApiAuth(opts.auth);

  return async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const seg = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
      // seg[0] should be 'v1'
      if (seg.length === 0 || seg[0] !== 'v1') {
        return json(404, { error: { code: 'NOT_FOUND', message: 'unknown path — the control plane lives under /v1' } });
      }
      const m = req.method.toUpperCase();
      const p1 = seg[1];
      const p2 = seg[2];
      const p3 = seg[3];

      // -- Discovery, health, schemas -------------------------------------
      if (seg.length === 1 && m === 'GET') return json(200, engine.describe());
      if (p1 === 'health' && m === 'GET') return json(200, { ok: true, version: engine.describe()['version'] });
      if (p1 === 'openapi.json' && m === 'GET') return json(200, openapiSkeleton());
      if (p1 === 'schema' && m === 'GET') {
        const schemas = jsonSchemas();
        if (seg.length === 2) return json(200, { schemas: Object.keys(schemas).sort() });
        const s = schemas[p2!];
        if (!s) return json(404, { error: { code: 'NOT_FOUND', message: `unknown schema ${JSON.stringify(p2)}` } });
        return json(200, s);
      }

      // -- Metrics ---------------------------------------------------------
      if (p1 === 'metrics.json' && m === 'GET') {
        auth.check(req, 'read');
        return json(200, engine.metrics.toJSON());
      }
      if (p1 === 'metrics' && seg.length === 2 && m === 'GET') {
        auth.check(req, 'read');
        return text(200, engine.metrics.toPrometheus(), 'text/plain; version=0.0.4; charset=utf-8');
      }
      if (p1 === 'metrics' && p2 === 'reset' && m === 'POST') {
        auth.check(req, 'admin');
        engine.metrics.reset();
        return json(200, { ok: true });
      }

      // -- Connections -----------------------------------------------------
      if (p1 === 'connections' && seg.length === 2) {
        if (m === 'GET') {
          auth.check(req, 'read');
          return json(200, { connections: engine.connections.list() });
        }
        if (m === 'POST') {
          auth.check(req, 'admin');
          const profile = engine.registerConnectionProfile(await body(req));
          return json(201, { id: profile.id, dialect: profile.dialect });
        }
      }
      if (p1 === 'connections' && p3 === 'probe' && m === 'GET') {
        auth.check(req, 'admin');
        const table = url.searchParams.get('table');
        const schema = url.searchParams.get('schema') ?? undefined;
        const result = await engine.connections.probe(p2!, table ? { schema, name: table } : undefined);
        return json(result.ok ? 200 : 502, result);
      }
      if (p1 === 'connections' && p3 === 'provision-work-events' && m === 'POST') {
        auth.check(req, 'admin');
        const raw = await req.text();
        let payload: { table?: string; schema?: string } = {};
        if (raw.trim() !== '') {
          try {
            payload = JSON.parse(raw) as { table?: string; schema?: string };
          } catch {
            return json(400, { error: { code: 'CONFIG_INVALID', message: 'request body is not valid JSON' } });
          }
        }
        return json(200, await engine.provisionWorkEvents(p2!, { table: payload.table, schema: payload.schema }));
      }

      // -- Queues ----------------------------------------------------------
      if (p1 === 'queues' && seg.length === 2 && m === 'GET') {
        auth.check(req, 'read');
        return json(200, { queues: await engine.listQueues() });
      }
      if (p1 === 'queues' && seg.length === 3) {
        if (m === 'GET') {
          auth.check(req, 'read');
          return json(200, await engine.queueStatus(p2!));
        }
        if (m === 'PUT') {
          auth.check(req, 'admin');
          const payload = (await body(req)) as Record<string, unknown>;
          const result = await engine.upsertQueue({ ...payload, id: p2 });
          return json(200, result);
        }
        if (m === 'DELETE') {
          auth.check(req, 'admin');
          await engine.deleteQueue(p2!);
          return json(200, { ok: true });
        }
      }
      if (p1 === 'queues' && seg.length === 4 && m === 'POST') {
        auth.check(req, 'admin');
        const id = p2!;
        switch (p3) {
          case 'validate':
            return json(200, await engine.validateQueue(id));
          case 'dry-run':
            return json(200, await engine.runQueue(id, 'manual', true));
          case 'trigger':
            return json(200, await engine.runQueue(id, 'manual', false));
          case 'pause':
            await engine.pauseQueue(id);
            return json(200, { ok: true, paused: true });
          case 'resume':
            await engine.resumeQueue(id);
            return json(200, { ok: true, paused: false });
          case 'release': {
            const payload = (await body(req)) as { itemIds?: unknown };
            if (!Array.isArray(payload.itemIds) || payload.itemIds.some((x) => typeof x !== 'string')) {
              return json(400, { error: { code: 'CONFIG_INVALID', message: 'body must be { itemIds: string[] }' } });
            }
            const released = await engine.releaseItems(id, payload.itemIds as string[]);
            return json(200, { released });
          }
        }
      }

      // -- Schedules -------------------------------------------------------
      if (p1 === 'schedules' && m === 'GET') {
        auth.check(req, 'read');
        return json(200, { schedules: await engine.listSchedules() });
      }

      // -- Runs ------------------------------------------------------------
      if (p1 === 'runs' && seg.length === 2) {
        if (m === 'GET') {
          auth.check(req, 'read');
          const result = await engine.listRuns({
            queueId: url.searchParams.get('queueId') ?? undefined,
            status: statusParam(url),
            since: dateParam(url, 'since'),
            until: dateParam(url, 'until'),
            limit: intParam(url, 'limit'),
            offset: intParam(url, 'offset'),
          });
          return json(200, result);
        }
        if (m === 'DELETE') {
          auth.check(req, 'admin');
          const deleted = await engine.deleteRuns({
            queueId: url.searchParams.get('queueId') ?? undefined,
            status: statusParam(url),
            before: dateParam(url, 'before'),
          });
          return json(200, { deleted });
        }
      }
      if (p1 === 'runs' && p2 === 'summary' && m === 'GET') {
        auth.check(req, 'read');
        return json(
          200,
          await engine.summarizeRuns({
            queueId: url.searchParams.get('queueId') ?? undefined,
            since: dateParam(url, 'since'),
            until: dateParam(url, 'until'),
          }),
        );
      }
      if (p1 === 'runs' && seg.length === 3) {
        if (m === 'GET') {
          auth.check(req, 'read');
          return json(200, await engine.getRun(p2!));
        }
        if (m === 'DELETE') {
          auth.check(req, 'admin');
          const deleted = await engine.deleteRuns({ ids: [p2!] });
          return json(200, { deleted });
        }
      }

      // -- Coverage watchdog ----------------------------------------------
      if (p1 === 'coverage' && m === 'GET') {
        auth.check(req, 'read');
        const connectionRef = url.searchParams.get('connectionRef');
        if (connectionRef === null) {
          return json(400, { error: { code: 'CONFIG_INVALID', message: 'query param connectionRef is required' } });
        }
        return json(
          200,
          await engine.coverage(connectionRef, {
            table: url.searchParams.get('table') ?? undefined,
            schema: url.searchParams.get('schema') ?? undefined,
          }),
        );
      }

      // -- Allocations audit ----------------------------------------------
      if (p1 === 'allocations' && m === 'GET') {
        auth.check(req, 'read');
        const allocations = await engine.listAllocations({
          queueId: url.searchParams.get('queueId') ?? undefined,
          workerId: url.searchParams.get('workerId') ?? undefined,
          itemId: url.searchParams.get('itemId') ?? undefined,
          outcome: url.searchParams.get('outcome') ?? undefined,
          limit: intParam(url, 'limit'),
        });
        return json(200, { allocations });
      }

      // -- Config bundles --------------------------------------------------
      if (p1 === 'config' && seg.length === 2 && m === 'GET') {
        auth.check(req, 'read');
        return json(200, await engine.currentConfig());
      }
      if (p1 === 'config' && p2 === 'apply' && m === 'POST') {
        auth.check(req, 'admin');
        const payload = (await body(req)) as Record<string, unknown>;
        const expectedVersion = typeof payload['expectedVersion'] === 'number' ? payload['expectedVersion'] : undefined;
        const result = await engine.applyConfig(
          { connections: payload['connections'] ?? [], queues: payload['queues'] ?? [] },
          expectedVersion !== undefined ? { expectedVersion } : {},
        );
        return json(200, result);
      }

      return json(404, { error: { code: 'NOT_FOUND', message: `no route for ${m} ${url.pathname}` } });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
