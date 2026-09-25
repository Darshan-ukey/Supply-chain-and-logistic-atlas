import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  EngineConflictError,
  EngineNotFoundError,
  EngineValidationError,
  type ExceptionEngine,
} from './engine.js';
import { InvariantViolation } from './ledger.js';
import { commandSchema, destinationSchema, reasonDefinitionSchema, SYSTEM_VIEWER, type Viewer } from './schemas.js';

/**
 * Web-standard fetch handler, mirroring the sibling engines: /v1 routes,
 * Bearer keys hashed and compared timing-safe, admin implies read, open when
 * no keys are configured — which is how MALKOM runs it, in-process behind the
 * runtime's own JWT and roles (`platform/engineHttp.ts`).
 *
 * Everything the CLI can do, any client can: this router is the whole surface.
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

const problem = (code: string, message: string, details?: readonly string[]): unknown => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** One place decides which failure is which status. */
const statusFor = (error: unknown): Response => {
  if (error instanceof EngineNotFoundError) return json(404, problem('not_found', error.message));
  if (error instanceof EngineConflictError) {
    return json(409, problem('version_conflict', error.message, [`current version is ${error.currentVersion}`]));
  }
  if (error instanceof InvariantViolation) {
    // A 500, deliberately. An invariant break is this engine's bug, never the
    // caller's mistake, and dressing it as a 400 would send someone hunting
    // through their own payload for a fault that is ours.
    return json(500, problem('invariant_violated', error.message, [error.invariant]));
  }
  if (error instanceof EngineValidationError) return json(400, problem('invalid', error.message, error.problems));
  return json(500, problem('internal', error instanceof Error ? error.message : 'unknown failure'));
};

const readBody = async (request: Request): Promise<unknown> => {
  const text = await request.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EngineValidationError('request body is not JSON');
  }
};

/**
 * How the host tells the engine who is asking. In MALKOM the runtime fronts
 * this plane with its own JWT and roles, so it supplies a Viewer built from
 * the person's grants; standing alone with no resolver, every request is the
 * engine acting on its own behalf, which is only safe because the plane is
 * in-process and the host is the only thing that can reach it.
 */
export type ViewerResolver = (request: Request) => Viewer;

export const buildFetchHandler = (
  engine: ExceptionEngine,
  keys: AuthKeys = { adminKeys: [], readKeys: [] },
  viewerFrom: ViewerResolver = () => SYSTEM_VIEWER,
) => {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/v1';
    const method = request.method.toUpperCase();
    const scope = scopeOf(request, keys);
    const viewer = viewerFrom(request);

    if (path === '/v1/health') return json(200, { status: 'ok' });
    if (scope === null) return json(401, problem('unauthorized', 'a bearer key is required'));
    const writing = method !== 'GET' && method !== 'HEAD';
    if (writing && scope !== 'admin') return json(403, problem('forbidden', 'this key may only read'));

    try {
      if (method === 'GET' && path === '/v1') {
        return json(200, {
          engine: 'malkom-exceptionmanagement-engine',
          contract: '0.1',
          capabilities: [
            'two-clock-ledger', 'business-calendars', 'clusters', 'deflection', 'scoped-catalogue',
            'scoped-access-grants', 'derived-sides', 'conversation', 'participants',
            'metrics-registry', 'queue-aging', 'page-registry', 'escalation-ladders', 'rate-suppression',
            'idempotency', 'optimistic-concurrency', 'metrics-facts',
          ],
          links: {
            handovers: '/v1/handovers', reasons: '/v1/reasons', schemas: '/v1/schemas',
            desk: '/v1/desks/{destination}', facts: '/v1/facts', deflect: 'POST /v1/deflect',
            catalogue: '/v1/catalogue?country=&region=&office=&queue=',
            registry: '/v1/registry', pauses: '/v1/facts/pauses', aging: '/v1/aging',
            pages: '/v1/pages', forms: '/v1/reasons/{code}/forms', timeline: '/v1/handovers/{id}/timeline',
            ladders: '/v1/ladders', escalations: '/v1/escalations', health: '/v1/reasons/{code}/health',
          },
        });
      }

      if (method === 'GET' && path === '/v1/schemas') {
        return json(200, {
          command: z.toJSONSchema(commandSchema, { io: 'input' }),
          reason: z.toJSONSchema(reasonDefinitionSchema, { io: 'input' }),
          destination: z.toJSONSchema(destinationSchema, { io: 'input' }),
        });
      }

      if (method === 'POST' && path === '/v1/destinations') {
        return json(200, engine.putDestination((await readBody(request)) as never));
      }
      if (method === 'GET' && path === '/v1/destinations') {
        return json(200, { destinations: engine.desksFor(viewer, 'read') });
      }

      if (method === 'POST' && path === '/v1/reasons') {
        return json(200, engine.putReason((await readBody(request)) as never));
      }

      const reason = /^\/v1\/reasons\/([^/]+)$/.exec(path);
      if (method === 'GET' && reason !== null) {
        const found = engine.getReason(decodeURIComponent(reason[1] ?? ''));
        return found === null ? json(404, problem('not_found', 'no such reason')) : json(200, found);
      }

      // Query params map 1:1 onto HandoverQuery; repeated params are the IN lists.
      const queryFrom = (search: URLSearchParams): Record<string, unknown> => {
        const many = (key: string): string[] | undefined => {
          const values = search.getAll(key).flatMap((value) => value.split(','));
          return values.length === 0 ? undefined : values;
        };
        const one = (key: string): string | undefined => search.get(key) ?? undefined;
        const num = (key: string): number | undefined => {
          const raw = search.get(key);
          return raw === null || !Number.isFinite(Number(raw)) ? undefined : Number(raw);
        };
        return Object.fromEntries(
          Object.entries({
            status: many('status'), holder: many('holder'), destination: many('destination'),
            reasonCode: many('reason'), subjectType: one('subjectType'), createdBy: one('createdBy'),
            clusterKey: one('cluster'), dueBefore: one('dueBefore'), raisedAfter: one('raisedAfter'),
            raisedBefore: one('raisedBefore'), order: one('order'), limit: num('limit'), offset: num('offset'),
          }).filter(([, value]) => value !== undefined),
        );
      };
      const nowOf = (search: URLSearchParams): string => search.get('now') ?? new Date().toISOString();

      // The raiser's list, the breach list and everything between: one route.
      if (method === 'GET' && path === '/v1/handovers') {
        const query = queryFrom(url.searchParams);
        return json(200, {
          handovers: engine.list(viewer, query as never, nowOf(url.searchParams)),
          total: engine.count(viewer, query as never),
        });
      }

      // One resolver desk, soonest deadline first, clusters collapsed.
      const desk = /^\/v1\/desks\/([^/]+)$/.exec(path);
      if (method === 'GET' && desk !== null) {
        return json(200, { rows: engine.desk(viewer, decodeURIComponent(desk[1] ?? ''), nowOf(url.searchParams)) });
      }

      // What the metrics engine reads. No percentages computed here.
      if (method === 'GET' && path === '/v1/facts') {
        return json(200, { facts: engine.facts(viewer, queryFrom(url.searchParams) as never, nowOf(url.searchParams)) });
      }

      const scopeFrom = (search: URLSearchParams): Record<string, string> =>
        Object.fromEntries(
          (['country', 'region', 'office', 'queue', 'subQueue'] as const)
            .map((field) => [field, search.get(field)])
            .filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== ''),
        );

      // What the metrics engine registers, and what it then reads.
      if (method === 'GET' && path === '/v1/registry') return json(200, engine.registryDoc());
      if (method === 'GET' && path === '/v1/facts/pauses') {
        return json(200, { facts: engine.pauseFacts(viewer, queryFrom(url.searchParams) as never, nowOf(url.searchParams)) });
      }

      // Ladders, and what has earned a rung nobody has acted on.
      if (method === 'POST' && path === '/v1/ladders') {
        return json(200, engine.putLadder((await readBody(request)) as never, viewer));
      }
      if (method === 'GET' && path === '/v1/escalations') {
        return json(200, {
          due: engine.dueEscalations(viewer, queryFrom(url.searchParams) as never, nowOf(url.searchParams)),
        });
      }
      const health = /^\/v1\/reasons\/([^/]+)\/health$/.exec(path);
      if (method === 'GET' && health !== null) {
        return json(200, {
          health: engine.reasonHealth(
            decodeURIComponent(health[1] ?? ''), scopeFrom(url.searchParams), nowOf(url.searchParams),
          ),
        });
      }

      // Queue aging, always split by holder.
      if (method === 'GET' && path === '/v1/aging') {
        return json(200, engine.aging(viewer, queryFrom(url.searchParams) as never, nowOf(url.searchParams)));
      }

      // What a page renderer needs to draw this engine with no screen written.
      if (method === 'GET' && path === '/v1/pages') return json(200, engine.pageRegistry());

      const forms = /^\/v1\/reasons\/([^/]+)\/forms$/.exec(path);
      if (method === 'GET' && forms !== null) {
        const built = engine.formsFor(decodeURIComponent(forms[1] ?? ''), scopeFrom(url.searchParams));
        return built === null
          ? json(404, problem('not_found', 'that reason does not reach this scope'))
          : json(200, built);
      }

      // The conversation, filtered to what this viewer may see.
      const timeline = /^\/v1\/handovers\/([^/]+)\/timeline$/.exec(path);
      if (method === 'GET' && timeline !== null) {
        return json(200, { comments: engine.timeline(viewer, decodeURIComponent(timeline[1] ?? '')) });
      }

      // The exception list for one country / region / office / queue. This is
      // the route a raise dialog calls to populate itself, and the route an
      // administrator calls to see what a given office actually has.
      if (method === 'GET' && path === '/v1/catalogue') {
        const subjectType = url.searchParams.get('subjectType') ?? undefined;
        const scope = scopeFrom(url.searchParams);
        return json(200, { scope, reasons: engine.catalogue(scope, subjectType) });
      }

      // The known answer, if there is one — asked BEFORE anything is created,
      // which is why it is a POST of the raise fields rather than a lookup by
      // an id that does not exist yet.
      if (method === 'POST' && path === '/v1/deflect') {
        const body = (await readBody(request)) as {
          reasonCode?: string;
          fields?: Record<string, unknown>;
          scope?: Record<string, string>;
        };
        if (typeof body.reasonCode !== 'string') {
          return json(400, problem('invalid', 'deflect needs a reasonCode and the raise fields'));
        }
        return json(200, {
          candidate: engine.deflectionCandidate(
            viewer,
            body.reasonCode,
            body.fields ?? {},
            body.scope ?? scopeFrom(url.searchParams),
            nowOf(url.searchParams),
          ),
        });
      }

      if (method === 'POST' && path === '/v1/handovers') {
        const body = (await readBody(request)) as Record<string, unknown>;
        const result = engine.handle({ ...body, type: 'raise' } as never, viewer);
        return json(result.replayed ? 200 : 201, result);
      }

      const commands = /^\/v1\/handovers\/([^/]+)\/commands$/.exec(path);
      if (method === 'POST' && commands !== null) {
        const body = (await readBody(request)) as Record<string, unknown>;
        const expected = request.headers.get('if-match');
        return json(200, engine.handle({
          ...body,
          handoverId: decodeURIComponent(commands[1] ?? ''),
          ...(expected !== null && body['expectedVersion'] === undefined ? { expectedVersion: Number(expected) } : {}),
        } as never, viewer));
      }

      const events = /^\/v1\/handovers\/([^/]+)\/events$/.exec(path);
      if (method === 'GET' && events !== null) {
        return json(200, { events: engine.events(viewer, decodeURIComponent(events[1] ?? '')) });
      }

      const one = /^\/v1\/handovers\/([^/]+)$/.exec(path);
      if (method === 'GET' && one !== null) {
        const id = decodeURIComponent(one[1] ?? '');
        const handover = engine.get(viewer, id);
        if (handover === null) return json(404, problem('not_found', `no handover ${id}`));
        const now = url.searchParams.get('now') ?? new Date().toISOString();
        return json(200, {
          handover,
          totals: engine.totals(viewer, id, now),
          elapsedMinutes: engine.elapsedMinutes(viewer, id, now),
          budgetUsed: engine.budgetUsed(viewer, id, now),
        });
      }

      // The case panel: every handover on one transaction, in one call.
      const subject = /^\/v1\/subjects\/([^/]+)\/([^/]+)\/handovers$/.exec(path);
      if (method === 'GET' && subject !== null) {
        return json(200, {
          handovers: engine.onSubject(viewer, decodeURIComponent(subject[1] ?? ''), decodeURIComponent(subject[2] ?? '')),
        });
      }

      const cluster = /^\/v1\/clusters\/([^/]+)$/.exec(path);
      if (method === 'GET' && cluster !== null) {
        return json(200, { handovers: engine.inCluster(viewer, decodeURIComponent(cluster[1] ?? '')) });
      }

      return json(404, problem('no_route', `${method} ${path} is not a route on this engine`));
    } catch (error) {
      return statusFor(error);
    }
  };
};
