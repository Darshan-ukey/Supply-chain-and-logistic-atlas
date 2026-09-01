import { z } from 'zod';
import {
  instantSchema,
  type AssignmentInput,
  type CalendarInput,
  type MetricDefinitionInput,
  type RegistryDocInput,
} from '../config/schemas.js';
import { AdapterError, ConfigInvalidError, MalkomError, NotFoundError } from '../domain/errors.js';
import type { WindowGrain } from '../domain/types.js';
import type { PointQuery, RunQuery } from '../ports/statestore.js';
import type { ActorOptions, MetricsEngine } from '../engine.js';
import type { Scope } from './auth.js';

/**
 * The REST control plane as a web-standard fetch handler — mounts unchanged
 * on node:http, Hono, Bun or Deno. A thin transport over the engine facade:
 * if a route does something the facade can't, that's a bug.
 *
 * Boundary discipline (the rules-engine router, mirrored):
 *  - auth runs BEFORE the body is read — nobody gets a free JSON parse;
 *  - query params and bodies are zod-validated, so garbage input is a 422
 *    `{ issues: [{ path, code, message }] }`, never a silently-empty 200;
 *  - scopes: GETs + eval reads need `read`; every mutation, lifecycle
 *    transition, backfill, deletion and pruneRuns needs `admin`;
 *  - unknown paths are 404; known paths with a wrong method are 405.
 *
 * OpenAPI skeleton (paths × methods, summaries only) at GET /v1/openapi.json —
 * the alloc-router precedent: enough for tooling to enumerate the surface;
 * schemas live at /v1/schemas.
 */

export type FetchHandler = (req: Request) => Promise<Response>;

// ---------------------------------------------------------------------------
// Boundary schemas — garbage in, 422 out
// ---------------------------------------------------------------------------

const intParam = z.coerce.number().int().min(1);
// Boundary instants REQUIRE an explicit timezone (Z or ±HH:MM): a zone-less
// datetime would be read in the host's local zone, so the same request could
// name different windows on different hosts.
const instant = instantSchema;
const grainParam = z
  .string()
  .regex(/^(day|week|month|quarter|rolling-[1-9]\d*[dh])$/, 'must be a window grain');

const registryVersionParam = z.coerce.number().int().min(1);

const actorBodySchema = z.object({
  actor: z.string().min(1),
  reason: z.string().min(1).optional(),
});

const validateBodySchema = z.object({
  live: z.boolean().optional(),
  definition: z.unknown().optional(),
});

const scopeSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
const rangeSchema = z.object({ fromIso: instant, toIso: instant });

const backtestBodySchema = z.object({
  range: rangeSchema,
  scope: scopeSchema.optional(),
});

const backfillBodySchema = z.object({
  metric: z.string().min(1),
  range: rangeSchema,
  scope: scopeSchema.optional(),
});

const calculateBodySchema = z.object({
  metric: z.string().min(1),
  scope: scopeSchema.optional(),
  at: instant.optional(),
});

const snapshotBodySchema = z.object({
  scope: scopeSchema.optional(),
  at: instant.optional(),
  mode: z.enum(['auto', 'live', 'points']).optional(),
});

const seriesBodySchema = z.object({
  metric: z.string().min(1),
  scope: scopeSchema.optional(),
  grain: grainParam.optional(),
  fromIso: instant,
  toIso: instant,
});

const pointsQuerySchema = z.object({
  metric: z.string().min(1),
  scopeHash: z.string().min(1).optional(),
  grain: grainParam.optional(),
  fromIso: instant.optional(),
  toIso: instant.optional(),
  limit: intParam.max(100_000).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const pointsDeleteSchema = z.object({
  metric: z.string().min(1).optional(),
  beforeIso: instant.optional(),
});

const runsQuerySchema = z.object({
  metric: z.string().min(1).optional(),
  status: z.enum(['ok', 'error', 'skipped']).optional(),
  trigger: z.enum(['scheduled', 'manual', 'backfill']).optional(),
  scopeHash: z.string().min(1).optional(),
  windowKey: z.string().min(1).optional(),
  limit: intParam.max(100_000).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const assignmentsQuerySchema = z.object({
  metric: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

interface Issue {
  path: string;
  code?: string;
  message: string;
}

function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    path: i.path.map((p) => (typeof p === 'number' ? `[${p}]` : String(p))).join('.').replace(/\.\[/g, '['),
    code: i.code,
    message: i.message,
  }));
}

function parsed<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = zodIssues(result.error);
    throw new ConfigInvalidError(
      `invalid ${what}`,
      issues.map((i) => `${i.path}: ${i.message}`),
      issues,
    );
  }
  return result.data;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** ConfigInvalidError details ("path: message") → structured issues, lossily. */
function issuesFrom(err: ConfigInvalidError): Issue[] {
  if (err.issues.length > 0) return [...err.issues];
  if (err.details.length > 0) {
    return err.details.map((d) => {
      const at = d.indexOf(': ');
      return at > 0 ? { path: d.slice(0, at), message: d.slice(at + 2) } : { path: '', message: d };
    });
  }
  return [{ path: '', message: err.message }];
}

function errorResponse(err: unknown): Response {
  if (err instanceof ConfigInvalidError) {
    return json(
      {
        error: { code: err.code, message: err.message, details: err.details },
        issues: issuesFrom(err),
      },
      err.status,
    );
  }
  if (err instanceof AdapterError) {
    // The raw driver message carries table/column/connection intel — it goes
    // to the engine log (SqlFactSource logs it on the throw path), NEVER the
    // wire. The entity name is registry vocabulary and safe to keep.
    return json(
      {
        error: {
          code: err.code,
          message:
            err.entity !== undefined
              ? `upstream data source error (entity "${err.entity}")`
              : 'upstream data source error',
        },
      },
      err.status,
    );
  }
  if (err instanceof MalkomError) {
    // RFC 7235 §4.1: a 401 MUST name the challenge scheme.
    const headers = err.status === 401 ? { 'www-authenticate': 'Bearer' } : {};
    return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status, headers);
  }
  return json({ error: { code: 'INTERNAL', message: 'internal error' } }, 500);
}

/** A known path hit with an unsupported method. */
class MethodNotAllowed extends Error {
  constructor(readonly allow: string[]) {
    super('method not allowed');
  }
}

function methodNotAllowedResponse(err: MethodNotAllowed, method: string, path: string): Response {
  return new Response(
    JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: `${method} is not supported on ${path}` } }),
    {
      status: 405,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        allow: err.allow.join(', '),
      },
    },
  );
}

/** Strict body read: absent → {}, malformed → 422 — never silently {}. */
async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.trim() === '') return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ConfigInvalidError('request body must be valid JSON', [], [{ path: '', message: 'request body must be valid JSON' }]);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigInvalidError('request body must be a JSON object', [], [{ path: '', message: 'request body must be a JSON object' }]);
  }
  return value as Record<string, unknown>;
}

/**
 * Lifecycle mutations stamp the audit trail — a missing actor is a 422, not
 * a silent "anonymous" (the engine records who did what).
 */
function requireActor(b: Record<string, unknown>): ActorOptions {
  const a = parsed(actorBodySchema, b, 'body: actor is required (the audit trail records who did this)');
  return a.reason !== undefined ? { actor: a.actor, reason: a.reason } : { actor: a.actor };
}

function searchParams(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams);
}

/**
 * Decode a path parameter — call this AFTER guard(), never before: auth must
 * answer first, and decodeURIComponent throws URIError on malformed
 * percent-encoding, which would turn an unauthenticated probe into a 500.
 * A path that cannot decode names no resource: 404, no internals leaked.
 */
function decodedParam(raw: string, method: string, path: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new NotFoundError(`route ${method} ${path}`);
  }
}

// ---------------------------------------------------------------------------
// OpenAPI skeleton — the surface inventory, summaries only (alloc precedent)
// ---------------------------------------------------------------------------

function openapiSkeleton(engine: MetricsEngine): Record<string, unknown> {
  const summaries: Record<string, Record<string, string>> = {
    '/v1': { get: 'Discovery document: engine, capabilities, registry summary' },
    '/v1/openapi.json': { get: 'This skeleton' },
    '/v1/schemas': { get: 'JSON Schemas for every config document' },
    '/v1/registry': { get: 'Current (or ?version=n) registry document', put: 'Apply a registry (bumps version, sweeps)' },
    '/v1/calendars': { get: 'List calendars', put: 'Upsert a calendar (content-hash versioned)' },
    '/v1/calendars/{name}': { get: 'One calendar', put: 'Upsert this calendar' },
    '/v1/metrics': { get: 'List definition heads', post: 'Create a draft definition (actor required)' },
    '/v1/metrics/{name}': { get: 'One definition head', patch: 'Edit the working draft (actor required)' },
    '/v1/metrics/{name}/versions': { get: 'Immutable activation snapshots' },
    '/v1/metrics/{name}/validate': { post: 'Tier-1 (+tier-2 with {live:true}) validation verdict' },
    '/v1/metrics/{name}/submit': { post: 'draft → pending' },
    '/v1/metrics/{name}/activate': { post: 'pending → active (snapshots an immutable version)' },
    '/v1/metrics/{name}/reject': { post: 'pending → draft' },
    '/v1/metrics/{name}/retire': { post: 'active → retired' },
    '/v1/metrics/{name}/backtest': { post: 'Recompute the draft over a range — no persistence' },
    '/v1/assignments': { get: 'List assignments (?metric=)', post: 'Bind a metric to a scope slice' },
    '/v1/assignments/{id}': { delete: 'Remove an assignment' },
    '/v1/eval/calculate': { post: 'One on-demand point — no persistence' },
    '/v1/eval/snapshot': { post: 'Current value of every matching active definition' },
    '/v1/eval/series': { post: 'Stored points over a range — no computation' },
    '/v1/eval/backfill': { post: 'Recompute AND persist history for the active version' },
    '/v1/points': { get: 'Query stored points', delete: 'Delete points (filter required)' },
    '/v1/runs': { get: 'Query the runs audit log', delete: 'Apply the runs retention policy now' },
    '/v1/telemetry': { get: 'Prometheus text exposition', delete: 'Reset counters' },
    '/v1/telemetry.json': { get: 'Telemetry as JSON' },
  };
  const paths: Record<string, unknown> = {};
  for (const [route, methods] of Object.entries(summaries)) {
    paths[route] = Object.fromEntries(
      Object.entries(methods).map(([m, summary]) => [m, { summary }]),
    );
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Malkom Process Metrics & KPI Engine — control plane',
      version: String(engine.describe()['version']),
    },
    paths,
  };
}

// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

export function buildFetchHandler(engine: MetricsEngine): FetchHandler {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();

    /** Enforce the required scope; returns the GRANTED scope (admin ≥ read). */
    const guard = (scope: Scope): Scope => engine.auth.check(req, scope);

    try {
      // --- discovery ---
      if (path === '/v1') {
        if (method === 'GET') {
          guard('read');
          return json(engine.describe());
        }
        throw new MethodNotAllowed(['GET']);
      }
      if (path === '/v1/openapi.json') {
        if (method === 'GET') {
          guard('read');
          return json(openapiSkeleton(engine));
        }
        throw new MethodNotAllowed(['GET']);
      }
      if (path === '/v1/schemas') {
        if (method === 'GET') {
          guard('read');
          return json(engine.jsonSchemas());
        }
        throw new MethodNotAllowed(['GET']);
      }

      // --- registry ---
      if (path === '/v1/registry') {
        if (method === 'GET') {
          guard('read');
          const v = url.searchParams.get('version');
          const version = v !== null ? parsed(registryVersionParam, v, 'version parameter') : undefined;
          const record = await engine.getRegistry(version);
          if (!record) throw new NotFoundError(version !== undefined ? `registry v${version}` : 'registry');
          return json(record);
        }
        if (method === 'PUT') {
          guard('admin');
          return json(await engine.applyRegistry((await body(req)) as RegistryDocInput));
        }
        throw new MethodNotAllowed(['GET', 'PUT']);
      }

      // --- calendars ---
      if (path === '/v1/calendars') {
        if (method === 'GET') {
          guard('read');
          return json(await engine.listCalendars());
        }
        if (method === 'PUT') {
          guard('admin');
          return json(await engine.upsertCalendar((await body(req)) as CalendarInput));
        }
        throw new MethodNotAllowed(['GET', 'PUT']);
      }
      const calendarMatch = /^\/v1\/calendars\/([^/]+)$/.exec(path);
      if (calendarMatch) {
        // Decode AFTER guard on every branch — see decodedParam.
        if (method === 'GET') {
          guard('read');
          const name = decodedParam(calendarMatch[1]!, method, path);
          return json(await engine.getCalendar(name));
        }
        if (method === 'PUT') {
          guard('admin');
          const name = decodedParam(calendarMatch[1]!, method, path);
          const doc = (await body(req)) as CalendarInput;
          if (typeof doc['name'] === 'string' && doc['name'] !== name) {
            throw new ConfigInvalidError('calendar name mismatch', [], [
              { path: 'name', message: `body names "${String(doc['name'])}" but the path targets "${name}"` },
            ]);
          }
          return json(await engine.upsertCalendar({ ...doc, name }));
        }
        throw new MethodNotAllowed(['GET', 'PUT']);
      }

      // --- evaluation ---
      if (path.startsWith('/v1/eval/')) {
        const action = path.slice('/v1/eval/'.length);
        if (!['calculate', 'snapshot', 'series', 'backfill'].includes(action)) {
          throw new NotFoundError(`route ${method} ${path}`);
        }
        if (method !== 'POST') throw new MethodNotAllowed(['POST']);
        // Auth first: nobody gets a free JSON parse of a large payload.
        // Backfill WRITES points and runs — admin; the rest are reads.
        const granted = action === 'backfill' ? guard('admin') : guard('read');
        const b = await body(req);
        if (action === 'calculate') {
          const input = parsed(calculateBodySchema, b, 'calculate body');
          return json(
            await engine.calculate({
              metric: input.metric,
              ...(input.scope !== undefined ? { scope: input.scope } : {}),
              ...(input.at !== undefined ? { at: input.at } : {}),
              // Executing an unreviewed WORKING DRAFT against live data is
              // the capability backtest admin-gates — read keys get active
              // versions only (409 when none exists).
              allowDraft: granted === 'admin',
            }),
          );
        }
        if (action === 'snapshot') {
          const input = parsed(snapshotBodySchema, b, 'snapshot body');
          return json(
            await engine.snapshot({
              ...(input.scope !== undefined ? { scope: input.scope } : {}),
              ...(input.at !== undefined ? { at: input.at } : {}),
              ...(input.mode !== undefined ? { mode: input.mode } : {}),
            }),
          );
        }
        if (action === 'series') {
          const input = parsed(seriesBodySchema, b, 'series body');
          return json(
            await engine.series({
              metric: input.metric,
              fromIso: input.fromIso,
              toIso: input.toIso,
              ...(input.scope !== undefined ? { scope: input.scope } : {}),
              ...(input.grain !== undefined ? { grain: input.grain as WindowGrain } : {}),
            }),
          );
        }
        const input = parsed(backfillBodySchema, b, 'backfill body');
        return json(
          await engine.backfill({
            metric: input.metric,
            range: input.range,
            ...(input.scope !== undefined ? { scope: input.scope } : {}),
          }),
        );
      }

      // --- definitions: collection routes ---
      if (path === '/v1/metrics') {
        if (method === 'GET') {
          guard('read');
          return json(await engine.listMetrics());
        }
        if (method === 'POST') {
          guard('admin');
          const b = await body(req);
          return json(await engine.createMetric(b['definition'] as MetricDefinitionInput, requireActor(b)), 201);
        }
        throw new MethodNotAllowed(['GET', 'POST']);
      }

      // --- definitions: per-metric routes ---
      const metricMatch = /^\/v1\/metrics\/([^/]+)(?:\/([a-z]+))?$/.exec(path);
      if (metricMatch) {
        // Decode AFTER guard on every branch — see decodedParam.
        const rawName = metricMatch[1]!;
        const action = metricMatch[2];
        if (action === undefined) {
          if (method === 'GET') {
            guard('read');
            return json(await engine.getMetric(decodedParam(rawName, method, path)));
          }
          if (method === 'PATCH') {
            guard('admin');
            const name = decodedParam(rawName, method, path);
            const b = await body(req);
            return json(await engine.updateMetric(name, b['definition'] as MetricDefinitionInput, requireActor(b)));
          }
          throw new MethodNotAllowed(['GET', 'PATCH']);
        }
        if (action === 'versions') {
          if (method !== 'GET') throw new MethodNotAllowed(['GET']);
          guard('read');
          return json(await engine.listMetricVersions(decodedParam(rawName, method, path)));
        }
        if (['validate', 'submit', 'activate', 'reject', 'retire', 'backtest'].includes(action)) {
          if (method !== 'POST') throw new MethodNotAllowed(['POST']);
          if (action === 'validate') {
            guard('read');
            const name = decodedParam(rawName, method, path);
            const b = parsed(validateBodySchema, await body(req), 'validate body');
            const target = b.definition !== undefined ? (b.definition as MetricDefinitionInput) : name;
            return json(await engine.validateMetric(target, b.live !== undefined ? { live: b.live } : {}));
          }
          if (action === 'backtest') {
            guard('admin'); // returns real host rows
            const name = decodedParam(rawName, method, path);
            const b = parsed(backtestBodySchema, await body(req), 'backtest body');
            return json(
              await engine.backtest({
                metric: name,
                range: b.range,
                ...(b.scope !== undefined ? { scope: b.scope } : {}),
              }),
            );
          }
          guard('admin'); // before the body is read
          const name = decodedParam(rawName, method, path);
          const actor = requireActor(await body(req));
          if (action === 'submit') return json(await engine.submit(name, actor));
          if (action === 'activate') return json(await engine.activate(name, actor));
          if (action === 'reject') return json(await engine.reject(name, actor));
          return json(await engine.retire(name, actor));
        }
        throw new NotFoundError(`route ${method} ${path}`);
      }

      // --- assignments ---
      if (path === '/v1/assignments') {
        if (method === 'GET') {
          guard('read');
          const q = parsed(assignmentsQuerySchema, searchParams(url), 'query parameters');
          return json(await engine.listAssignments(q.metric !== undefined ? { metric: q.metric } : {}));
        }
        if (method === 'POST') {
          guard('admin');
          return json(await engine.assign((await body(req)) as AssignmentInput), 201);
        }
        throw new MethodNotAllowed(['GET', 'POST']);
      }
      const assignmentMatch = /^\/v1\/assignments\/([^/]+)$/.exec(path);
      if (assignmentMatch) {
        if (method !== 'DELETE') throw new MethodNotAllowed(['DELETE']);
        guard('admin');
        await engine.unassign(decodedParam(assignmentMatch[1]!, method, path));
        return json({ ok: true });
      }

      // --- points ---
      if (path === '/v1/points') {
        if (method === 'GET') {
          guard('read');
          const q = parsed(pointsQuerySchema, searchParams(url), 'query parameters');
          const query: PointQuery = { metric: q.metric };
          if (q.scopeHash !== undefined) query.scopeHash = q.scopeHash;
          if (q.grain !== undefined) query.grain = q.grain as WindowGrain;
          if (q.fromIso !== undefined) query.fromIso = q.fromIso;
          if (q.toIso !== undefined) query.toIso = q.toIso;
          if (q.limit !== undefined) query.limit = q.limit;
          if (q.order !== undefined) query.order = q.order;
          return json(await engine.queryPoints(query));
        }
        if (method === 'DELETE') {
          guard('admin');
          const b = parsed(pointsDeleteSchema, await body(req), 'point delete filter');
          return json({
            deleted: await engine.deletePoints({
              ...(b.metric !== undefined ? { metric: b.metric } : {}),
              ...(b.beforeIso !== undefined ? { beforeIso: b.beforeIso } : {}),
            }),
          });
        }
        throw new MethodNotAllowed(['GET', 'DELETE']);
      }

      // --- runs ---
      if (path === '/v1/runs') {
        if (method === 'GET') {
          guard('read');
          const q = parsed(runsQuerySchema, searchParams(url), 'query parameters');
          const query: RunQuery = {};
          if (q.metric !== undefined) query.metric = q.metric;
          if (q.status !== undefined) query.status = q.status;
          if (q.trigger !== undefined) query.trigger = q.trigger;
          if (q.scopeHash !== undefined) query.scopeHash = q.scopeHash;
          if (q.windowKey !== undefined) query.windowKey = q.windowKey;
          if (q.limit !== undefined) query.limit = q.limit;
          if (q.order !== undefined) query.order = q.order;
          return json(await engine.queryRuns(query));
        }
        if (method === 'DELETE') {
          guard('admin');
          return json({ pruned: await engine.pruneRuns() });
        }
        throw new MethodNotAllowed(['GET', 'DELETE']);
      }

      // --- telemetry (the engine's OWN counters; "metrics" is the business domain) ---
      if (path === '/v1/telemetry') {
        if (method === 'GET') {
          guard('read');
          return new Response(engine.telemetry.toPrometheus(), {
            status: 200,
            headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
          });
        }
        if (method === 'DELETE') {
          guard('admin');
          engine.telemetry.reset();
          return json({ ok: true });
        }
        throw new MethodNotAllowed(['GET', 'DELETE']);
      }
      if (path === '/v1/telemetry.json') {
        if (method === 'GET') {
          guard('read');
          return json(engine.telemetry.toJSON());
        }
        throw new MethodNotAllowed(['GET']);
      }

      throw new NotFoundError(`route ${method} ${path}`);
    } catch (err) {
      if (err instanceof MethodNotAllowed) return methodNotAllowedResponse(err, method, path);
      return errorResponse(err);
    }
  };
}
