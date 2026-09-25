import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { EngineConflictError, EngineNotFoundError, EngineValidationError, IntegrationEngine } from './engine.js';
import { CONNECTORS, connectorById } from './registry.js';
import {
  bindingSchema,
  configBundleSchema,
  connectionSchema,
  customConnectorDefSchema,
  executeRequestSchema,
} from './schemas.js';

/**
 * Web-standard fetch handler, mirroring the sibling engines: /v1 routes,
 * Bearer keys hashed and compared timing-safe, admin implies read, open
 * (with a warning left to the shell) when no keys are configured.
 */

export interface AuthKeys {
  adminKeys: string[];
  readKeys: string[];
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

const matches = (candidate: string, keys: string[]): boolean =>
  keys.some((key) => timingSafeEqual(digest(candidate), digest(key)));

type Scope = 'admin' | 'read' | null;

const scopeOf = (request: Request, keys: AuthKeys): Scope => {
  if (keys.adminKeys.length === 0 && keys.readKeys.length === 0) return 'admin';
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token === '') return null;
  if (matches(token, keys.adminKeys)) return 'admin';
  if (matches(token, keys.readKeys)) return 'read';
  return null;
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const errorBody = (code: string, message: string): unknown => ({ error: { code, message } });

const ID = '[A-Za-z0-9][A-Za-z0-9._-]{0,63}';

export const buildFetchHandler = (engine: IntegrationEngine, keys: AuthKeys) => {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const method = request.method.toUpperCase();

    if (path === '/v1/health') return json(200, { ok: true, engine: 'malkom-integrate', version: '0.2.0' });

    const scope = scopeOf(request, keys);
    const need = (required: 'admin' | 'read'): Response | null => {
      if (scope === 'admin') return null;
      if (scope === 'read' && required === 'read') return null;
      return json(scope === null ? 401 : 403, errorBody('forbidden', `${required} scope required`));
    };

    const body = async (): Promise<unknown> => {
      try {
        return await request.json();
      } catch {
        return null;
      }
    };

    try {
      if (path === '/v1' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, {
          engine: 'malkom-integrate',
          version: '0.2.0',
          connectors: CONNECTORS.length,
          connections: engine.listConnections().length,
          bindings: engine.listBindings(null).length,
        });
      }
      if (path === '/v1/schemas' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, {
          connection: z.toJSONSchema(connectionSchema, { io: 'input' }),
          binding: z.toJSONSchema(bindingSchema, { io: 'input' }),
          'custom-connector': z.toJSONSchema(customConnectorDefSchema, { io: 'input' }),
          'execute-request': z.toJSONSchema(executeRequestSchema, { io: 'input' }),
          'config-bundle': z.toJSONSchema(configBundleSchema, { io: 'input' }),
        });
      }

      /* ---------- registry ---------- */
      if (path === '/v1/connectors' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        const plane = url.searchParams.get('plane');
        const category = url.searchParams.get('category');
        return json(200, {
          connectors: CONNECTORS.filter(
            (descriptor) =>
              (plane === null || descriptor.plane === plane) &&
              (category === null || descriptor.category === category),
          ),
        });
      }
      const connectorMatch = path.match(new RegExp(`^/v1/connectors/(${ID})$`));
      if (connectorMatch && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        const descriptor = connectorById(connectorMatch[1] as string);
        if (descriptor === undefined) return json(404, errorBody('not_found', 'unknown connector'));
        return json(200, { connector: descriptor });
      }

      /* ---------- connections ---------- */
      if (path === '/v1/connections' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, { connections: engine.listConnections() });
      }
      if (path === '/v1/connections' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.upsertConnection(connectionSchema.parse(await body())));
      }
      const connectionMatch = path.match(new RegExp(`^/v1/connections/(${ID})(/(test|execute))?$`));
      if (connectionMatch) {
        const connectionId = connectionMatch[1] as string;
        const action = connectionMatch[3];
        if (action === 'test' && method === 'POST') {
          const denied = need('admin');
          if (denied) return denied;
          return json(200, await engine.testConnection(connectionId));
        }
        if (action === 'execute' && method === 'POST') {
          const denied = need('admin');
          if (denied) return denied;
          return json(200, await engine.execute(connectionId, await body()));
        }
        if (action === undefined && method === 'GET') {
          const denied = need('read');
          if (denied) return denied;
          const record = engine.getConnection(connectionId);
          if (record === null) return json(404, errorBody('not_found', 'connection not found'));
          return json(200, { connection: record });
        }
        if (action === undefined && method === 'DELETE') {
          const denied = need('admin');
          if (denied) return denied;
          engine.deleteConnection(connectionId);
          return json(200, { deleted: true });
        }
      }

      /* ---------- bindings ---------- */
      if (path === '/v1/bindings' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, { bindings: engine.listBindings(url.searchParams.get('connectionId')) });
      }
      if (path === '/v1/bindings' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.upsertBinding(bindingSchema.parse(await body())));
      }
      const bindingMatch = path.match(new RegExp(`^/v1/bindings/(${ID})$`));
      if (bindingMatch && method === 'DELETE') {
        const denied = need('admin');
        if (denied) return denied;
        engine.deleteBinding(bindingMatch[1] as string);
        return json(200, { deleted: true });
      }

      /* ---------- custom connector definitions ---------- */
      if (path === '/v1/custom-connectors' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, { customConnectors: engine.listCustomDefs() });
      }
      if (path === '/v1/custom-connectors' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.upsertCustomDef(customConnectorDefSchema.parse(await body())));
      }
      const customMatch = path.match(new RegExp(`^/v1/custom-connectors/(${ID})$`));
      if (customMatch && method === 'DELETE') {
        const denied = need('admin');
        if (denied) return denied;
        engine.deleteCustomDef(customMatch[1] as string);
        return json(200, { deleted: true });
      }

      /* ---------- runs ---------- */
      if (path === '/v1/runs' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return json(200, {
          runs: engine.runs(url.searchParams.get('connectionId'), url.searchParams.get('status'), limit, offset),
        });
      }
      const runMatch = path.match(/^\/v1\/runs\/([A-Za-z0-9-]{1,64})\/(redeliver|collect)$/);
      if (runMatch && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        const runId = runMatch[1] as string;
        if (runMatch[2] === 'redeliver') return json(200, await engine.redeliver(runId));
        const payload = (await body()) as { detail?: string } | null;
        return json(200, engine.collect(runId, payload?.detail ?? 'collected by host transport'));
      }

      /* ---------- config ---------- */
      if (path === '/v1/config/apply' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.applyConfig(await body()));
      }

      return json(404, errorBody('not_found', `no route ${method} ${path}`));
    } catch (error) {
      if (error instanceof EngineNotFoundError) return json(404, errorBody('not_found', error.message));
      if (error instanceof EngineConflictError) return json(409, errorBody('conflict', error.message));
      if (error instanceof EngineValidationError) return json(400, errorBody('invalid', error.message));
      if (error instanceof z.ZodError) return json(400, errorBody('invalid', error.issues[0]?.message ?? 'invalid payload'));
      return json(500, errorBody('internal', (error as Error).message));
    }
  };
};
