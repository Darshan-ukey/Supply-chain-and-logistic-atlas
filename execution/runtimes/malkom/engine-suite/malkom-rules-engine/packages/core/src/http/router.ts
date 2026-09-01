import { z } from 'zod';
import { ConfigInvalidError, MalkomError, NotFoundError } from '../domain/errors.js';
import type { RulesEngine, GroupQueryCriteria, ActorOptions } from '../engine.js';
import type { GroupDefinitionInput, RegistryDocInput } from '../config/schemas.js';
import type { DecisionQuery } from '../ports/statestore.js';
import { GROUP_STATES } from '../domain/types.js';
import { ApiAuth, type AuthKeys, type Scope } from './auth.js';

/**
 * The REST control plane as a web-standard fetch handler — mounts unchanged
 * on node:http, Hono, Bun or Deno. A thin transport over the engine facade:
 * if a route does something the facade can't, that's a bug.
 *
 * Boundary discipline: auth runs BEFORE the body is read; query params and
 * bodies are zod-validated so garbage input is a 422, never a silently-empty
 * 200. Scopes: GETs + applicable/explain need `read`; lifecycle mutations,
 * apply, backtest (it returns real host rows) and deletions need `admin`.
 */

export type FetchHandler = (req: Request) => Promise<Response>;

export interface RouterOptions {
  /**
   * Omitting keys (or passing empty lists) leaves the control plane OPEN —
   * every caller gets admin. Deliberate for dev embedding; never expose an
   * open plane on a network.
   */
  auth?: AuthKeys;
}

// ---------------------------------------------------------------------------
// Boundary schemas — garbage in, 422 out
// ---------------------------------------------------------------------------

const intParam = z.coerce.number().int().min(0);
const instant = z
  .string()
  .refine((s) => Number.isFinite(Date.parse(s)), 'must be an ISO-8601 instant');

const groupQuerySchema = z.object({
  entity: z.string().optional(),
  state: z.enum(GROUP_STATES).optional(),
  validity: z.enum(['valid', 'degraded', 'broken', 'unchecked']).optional(),
  touchesField: z.string().optional(),
  scopeField: z.string().optional(),
  scopeValue: z.string().optional(),
  expiringBefore: instant.optional(),
  text: z.string().optional(),
  limit: intParam.max(500).optional(),
  offset: intParam.optional(),
});

const decisionQuerySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  mode: z.enum(['explain', 'apply']).optional(),
  since: instant.optional(),
  until: instant.optional(),
  limit: intParam.max(500).optional(),
  offset: intParam.optional(),
});

const actorBodySchema = z.object({
  actor: z.string().min(1),
  reason: z.string().min(1).optional(),
});

const evalBodySchema = z.object({
  entity: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
  row: z.record(z.string(), z.unknown()).optional(),
  asOf: instant.optional(),
  entityId: z.string().optional(),
});

const backtestBodySchema = z.object({
  definition: z.unknown().optional(),
  sample: z.number().int().min(1).max(1000).optional(),
  asOf: instant.optional(),
});

const registryVersionParam = z.coerce.number().int().min(1);

function parsed<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ConfigInvalidError(
      `invalid ${what}`,
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  return result.data;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof MalkomError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  return json({ error: { code: 'INTERNAL', message: 'internal error' } }, 500);
}

/** Strict body read: absent → {}, malformed → 422 — never silently {}. */
async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.trim() === '') return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ConfigInvalidError('request body must be valid JSON');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigInvalidError('request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

/**
 * Lifecycle mutations stamp the audit trail — a missing actor is a 422, not
 * a silent "anonymous" (D3: the engine records who did what).
 */
function requireActor(b: Record<string, unknown>): ActorOptions {
  const a = parsed(actorBodySchema, b, 'body: actor is required (the audit trail records who did this)');
  return a.reason !== undefined ? { actor: a.actor, reason: a.reason } : { actor: a.actor };
}

function groupCriteria(url: URL): GroupQueryCriteria {
  const raw = parsed(groupQuerySchema, Object.fromEntries(url.searchParams), 'query parameters');
  const criteria: GroupQueryCriteria = {};
  if (raw.entity !== undefined) criteria.entity = raw.entity;
  if (raw.state !== undefined) criteria.state = raw.state;
  if (raw.validity !== undefined) criteria.validity = raw.validity;
  if (raw.touchesField !== undefined) criteria.touchesField = raw.touchesField;
  if (raw.scopeField !== undefined && raw.scopeValue !== undefined) {
    criteria.scopeValue = { field: raw.scopeField, value: raw.scopeValue };
  }
  if (raw.expiringBefore !== undefined) criteria.expiringBefore = raw.expiringBefore;
  if (raw.text !== undefined) criteria.text = raw.text;
  if (raw.limit !== undefined) criteria.limit = raw.limit;
  if (raw.offset !== undefined) criteria.offset = raw.offset;
  return criteria;
}

function decisionQuery(url: URL): DecisionQuery {
  const raw = parsed(decisionQuerySchema, Object.fromEntries(url.searchParams), 'query parameters');
  const query: DecisionQuery = {};
  if (raw.entity !== undefined) query.entity = raw.entity;
  if (raw.entityId !== undefined) query.entityId = raw.entityId;
  if (raw.mode !== undefined) query.mode = raw.mode;
  if (raw.since !== undefined) query.since = raw.since;
  if (raw.until !== undefined) query.until = raw.until;
  if (raw.limit !== undefined) query.limit = raw.limit;
  if (raw.offset !== undefined) query.offset = raw.offset;
  return query;
}

function backtestOpts(b: Record<string, unknown>): { sample?: number; asOf?: string } {
  const raw = parsed(backtestBodySchema, b, 'backtest body');
  const opts: { sample?: number; asOf?: string } = {};
  if (raw.sample !== undefined) opts.sample = raw.sample;
  if (raw.asOf !== undefined) opts.asOf = raw.asOf;
  return opts;
}

export function buildFetchHandler(engine: RulesEngine, options: RouterOptions = {}): FetchHandler {
  const auth = new ApiAuth(options.auth ?? { adminKeys: [], readKeys: [] });

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();

    const guard = (scope: Scope): void => {
      auth.check(req, scope);
    };

    try {
      // --- discovery ---
      if (method === 'GET' && path === '/v1') {
        guard('read');
        return json(engine.describe());
      }
      if (method === 'GET' && path === '/v1/schemas') {
        guard('read');
        return json(engine.jsonSchemas());
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
      }

      // --- evaluation ---
      if (method === 'POST' && path.startsWith('/v1/eval/')) {
        // Auth first: nobody gets a free JSON parse of a large row.
        if (path === '/v1/eval/apply') guard('admin');
        else guard('read');
        const b = parsed(evalBodySchema, await body(req), 'evaluation body');
        const opts: { asOf?: string; entityId?: string } = {};
        if (b.asOf !== undefined) opts.asOf = b.asOf;
        if (b.entityId !== undefined) opts.entityId = b.entityId;
        if (path === '/v1/eval/applicable') {
          return json(await engine.applicable(b.entity, b.props ?? {}, opts));
        }
        if (path === '/v1/eval/explain') {
          return json(await engine.explain(b.entity, b.row ?? {}, opts));
        }
        if (path === '/v1/eval/apply') {
          return json(await engine.apply(b.entity, b.row ?? {}, opts));
        }
      }

      // --- authoring: collection routes ---
      if (path === '/v1/groups') {
        if (method === 'GET') {
          guard('read');
          return json(await engine.queryGroups(groupCriteria(url)));
        }
        if (method === 'POST') {
          guard('admin');
          const b = await body(req);
          return json(
            await engine.createGroup(b['definition'] as GroupDefinitionInput, requireActor(b)),
            201,
          );
        }
      }
      if (method === 'POST' && path === '/v1/validate') {
        guard('read');
        return json(await engine.validateGroup((await body(req))['definition'] as GroupDefinitionInput));
      }
      if (method === 'POST' && path === '/v1/backtest') {
        guard('admin'); // returns real host rows
        const b = await body(req);
        return json(await engine.backtest(b['definition'] as GroupDefinitionInput, backtestOpts(b)));
      }
      if (path === '/v1/consistency') {
        if (method === 'GET') {
          guard('read');
          return json(await engine.consistency());
        }
        if (method === 'POST') {
          guard('read');
          return json(await engine.consistency((await body(req))['definition'] as GroupDefinitionInput));
        }
      }

      // --- authoring: per-group routes ---
      const groupMatch = /^\/v1\/groups\/([^/]+)(?:\/([a-z]+))?$/.exec(path);
      if (groupMatch) {
        const id = decodeURIComponent(groupMatch[1]!);
        const action = groupMatch[2];
        if (action === undefined) {
          if (method === 'GET') {
            guard('read');
            return json(await engine.getGroup(id));
          }
          if (method === 'PUT') {
            guard('admin');
            const b = await body(req);
            return json(await engine.updateGroup(id, b['definition'] as GroupDefinitionInput, requireActor(b)));
          }
        }
        if (method === 'GET' && action === 'versions') {
          guard('read');
          return json(await engine.listGroupVersions(id));
        }
        if (method === 'POST' && action !== undefined) {
          if (action === 'validate') {
            guard('read');
            return json(await engine.validateGroup(id));
          }
          if (action === 'backtest') {
            guard('admin'); // returns real host rows
            return json(await engine.backtest(id, backtestOpts(await body(req))));
          }
          if (action === 'submit' || action === 'activate' || action === 'reject' || action === 'retire') {
            guard('admin'); // before the body is read
            const actor = requireActor(await body(req));
            if (action === 'submit') return json(await engine.submit(id, actor));
            if (action === 'activate') return json(await engine.activate(id, actor));
            if (action === 'reject') return json(await engine.reject(id, actor));
            return json(await engine.retire(id, actor));
          }
        }
      }

      // --- decisions ---
      if (path === '/v1/decisions') {
        if (method === 'GET') {
          guard('read');
          return json(await engine.queryDecisions(decisionQuery(url)));
        }
        if (method === 'DELETE') {
          guard('admin');
          const b = await body(req);
          const filter: { entity?: string; before?: string; ids?: string[] } = {};
          if (typeof b['entity'] === 'string') filter.entity = b['entity'];
          if (typeof b['before'] === 'string') filter.before = b['before'];
          if (Array.isArray(b['ids'])) filter.ids = b['ids'].map(String);
          return json({ deleted: await engine.deleteDecisions(filter) });
        }
      }

      // --- metrics ---
      if (path === '/v1/metrics') {
        if (method === 'GET') {
          guard('read');
          return new Response(engine.metrics.toPrometheus(), {
            status: 200,
            headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
          });
        }
        if (method === 'DELETE') {
          guard('admin');
          engine.metrics.reset();
          return json({ ok: true });
        }
      }
      if (method === 'GET' && path === '/v1/metrics.json') {
        guard('read');
        return json(engine.metrics.toJSON());
      }

      throw new NotFoundError(`route ${method} ${path}`);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
