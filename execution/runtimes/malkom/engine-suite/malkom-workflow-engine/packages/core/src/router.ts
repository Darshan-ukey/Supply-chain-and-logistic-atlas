import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { EngineConflictError, EngineNotFoundError, EngineValidationError, WorkflowEngine } from './engine.js';
import { configBundleSchema, lifecycleDefinitionSchema } from './schemas.js';

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

export const buildFetchHandler = (engine: WorkflowEngine, keys: AuthKeys) => {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const method = request.method.toUpperCase();

    if (path === '/v1/health') return json(200, { ok: true, engine: 'malkom-workflow', version: '0.1.0' });

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
          engine: 'malkom-workflow',
          version: '0.1.0',
          capabilities: { clock: ['holdsClock', 'terminal'], sla: 'minutes' },
          lifecycles: engine.listLifecycles().length,
        });
      }
      if (path === '/v1/schemas' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, {
          'lifecycle-definition': z.toJSONSchema(lifecycleDefinitionSchema, { io: 'input' }),
          'config-bundle': z.toJSONSchema(configBundleSchema, { io: 'input' }),
        });
      }
      if (path === '/v1/lifecycles' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, { lifecycles: engine.listLifecycles() });
      }
      if (path === '/v1/config/apply' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.applyConfig(await body()));
      }

      const lifecycleMatch = path.match(/^\/v1\/lifecycles\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})(\/(start|move|items|transitions|breaches))?$/);
      if (lifecycleMatch) {
        const lifecycleId = lifecycleMatch[1] as string;
        const action = lifecycleMatch[3];
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        if (action === 'start' && method === 'POST') {
          const denied = need('admin');
          if (denied) return denied;
          return json(200, engine.start(lifecycleId, await body()));
        }
        if (action === 'move' && method === 'POST') {
          const denied = need('admin');
          if (denied) return denied;
          return json(200, engine.move(lifecycleId, await body()));
        }
        if (action === 'items' && method === 'GET') {
          const denied = need('read');
          if (denied) return denied;
          const itemId = url.searchParams.get('itemId');
          if (itemId !== null) return json(200, engine.status(lifecycleId, itemId));
          return json(200, { items: engine.items(lifecycleId, url.searchParams.get('state'), limit, offset) });
        }
        if (action === 'transitions' && method === 'GET') {
          const denied = need('read');
          if (denied) return denied;
          return json(200, { transitions: engine.transitions(lifecycleId, url.searchParams.get('itemId'), limit, offset) });
        }
        if (action === 'breaches' && method === 'GET') {
          const denied = need('read');
          if (denied) return denied;
          return json(200, { breaches: engine.breaches(lifecycleId, limit) });
        }
        if (action === undefined && method === 'DELETE') {
          const denied = need('admin');
          if (denied) return denied;
          engine.deleteLifecycle(lifecycleId);
          return json(200, { deleted: true });
        }
      }

      return json(404, errorBody('not_found', `no route ${method} ${path}`));
    } catch (error) {
      if (error instanceof EngineNotFoundError) return json(404, errorBody('not_found', error.message));
      if (error instanceof EngineConflictError) return json(409, errorBody('conflict', error.message));
      if (error instanceof EngineValidationError) return json(422, errorBody('invalid', error.message));
      if (error instanceof z.ZodError) return json(422, errorBody('invalid', error.issues[0]?.message ?? 'invalid input'));
      return json(500, errorBody('internal', (error as Error).message));
    }
  };
};
