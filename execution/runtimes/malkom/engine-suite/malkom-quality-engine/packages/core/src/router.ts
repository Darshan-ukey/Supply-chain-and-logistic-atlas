import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { EngineConflictError, EngineNotFoundError, EngineValidationError, QualityEngine } from './engine.js';
import { configBundleSchema, streamDefinitionSchema } from './schemas.js';

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

export const buildFetchHandler = (engine: QualityEngine, keys: AuthKeys) => {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const method = request.method.toUpperCase();

    if (path === '/v1/health') return json(200, { ok: true, engine: 'malkom-quality', version: '0.1.0' });

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
          engine: 'malkom-quality',
          version: '0.1.0',
          capabilities: { decisions: ['sampled', 'mandatoryFields'] },
          streams: engine.listStreams().length,
        });
      }
      if (path === '/v1/schemas' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, {
          'stream-definition': z.toJSONSchema(streamDefinitionSchema, { io: 'input' }),
          'config-bundle': z.toJSONSchema(configBundleSchema, { io: 'input' }),
        });
      }
      if (path === '/v1/streams' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        return json(200, { streams: engine.listStreams() });
      }
      if (path === '/v1/config/apply' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.applyConfig(await body()));
      }

      const streamMatch = path.match(/^\/v1\/streams\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})(\/(decide|summary))?$/);
      if (streamMatch) {
        const streamId = streamMatch[1] as string;
        const action = streamMatch[3];
        if (action === 'decide' && method === 'POST') {
          const denied = need('read');
          if (denied) return denied;
          return json(200, engine.decide(streamId, await body()));
        }
        if (action === 'summary' && method === 'GET') {
          const denied = need('read');
          if (denied) return denied;
          return json(200, engine.summary(streamId));
        }
        if (action === undefined && method === 'DELETE') {
          const denied = need('admin');
          if (denied) return denied;
          engine.deleteStream(streamId);
          return json(200, { deleted: true });
        }
      }

      if (path === '/v1/reviews' && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.openReview(await body()));
      }
      if (path === '/v1/reviews' && method === 'GET') {
        const denied = need('read');
        if (denied) return denied;
        const streamId = url.searchParams.get('streamId');
        const statusRaw = url.searchParams.get('status');
        const status = statusRaw === 'OPEN' || statusRaw === 'DONE' ? statusRaw : null;
        const limit = Number(url.searchParams.get('limit') ?? 100);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return json(200, { reviews: engine.reviews(streamId, status, limit, offset) });
      }
      const reviewMatch = path.match(/^\/v1\/reviews\/([A-Za-z0-9-]{1,64})\/complete$/);
      if (reviewMatch && method === 'POST') {
        const denied = need('admin');
        if (denied) return denied;
        return json(200, engine.completeReview(reviewMatch[1] as string, await body()));
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
