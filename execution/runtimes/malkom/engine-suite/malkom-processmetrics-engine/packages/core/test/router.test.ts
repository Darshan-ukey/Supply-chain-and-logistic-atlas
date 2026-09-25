/**
 * M5 REST control plane, mirroring the rules-engine router suite: the full
 * authoring → lifecycle → assignment → evaluation → audit loop purely over
 * HTTP, the 422 `{issues:[{path,code,message}]}` shape with exact issue
 * paths, actor enforcement, the bearer scope matrix (incl. the open-plane
 * path when no keys are configured), 404/405 handling, and both telemetry
 * exposition formats.
 */
import { describe, expect, it } from 'vitest';
import type { CalendarInput, MetricDefinitionInput, RegistryDocInput } from '../src/config/schemas.js';
import { MetricsEngine, type MetricsEngineOptions } from '../src/engine.js';
import { buildFetchHandler, type FetchHandler } from '../src/http/router.js';
import type { Clock } from '../src/ports/clock.js';
import { MemoryFactSource } from '../src/ports/factsource.js';
import { noopLogger, type Logger } from '../src/ports/logger.js';
import type { SqlClient } from '../src/ports/sql.js';
import { ConnectionRegistry } from '../src/sql/connections.js';

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'region', type: 'string', values: ['APAC', 'EMEA'] },
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
        { id: 'createdAt', type: 'date' },
      ],
    },
  ],
  valueSets: [],
};

const CALENDAR: CalendarInput = {
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
};

const REGIONAL_DAILY: MetricDefinitionInput = {
  name: 'regional-daily',
  kind: 'kpi',
  metricType: 'count',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'day' },
  anchor: { kind: 'event', field: 'createdAt' },
  target: { value: 1, direction: 'higher_is_better' },
  formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
};

const ROWS = [
  { region: 'APAC', status: 'confirmed', createdAt: '2026-08-12T01:00:00Z' },
  { region: 'EMEA', status: 'new', createdAt: '2026-08-11T09:00:00Z' },
];

const FIXED_NOW = '2026-08-12T06:00:00Z';
const fixedClock: Clock = { now: () => new Date(FIXED_NOW) };

async function handler(overrides: MetricsEngineOptions = {}): Promise<FetchHandler> {
  const engine = new MetricsEngine({
    factSource: new MemoryFactSource(ROWS),
    clock: fixedClock,
    logger: noopLogger,
    ...overrides,
  });
  await engine.start();
  return buildFetchHandler(engine);
}

function req(method: string, path: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`;
  return new Request(`http://engine.local${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function ok(res: Response): Promise<Record<string, unknown>> {
  const parsed = (await res.json()) as Record<string, unknown>;
  expect(res.status, JSON.stringify(parsed)).toBeLessThan(300);
  return parsed;
}

interface Issue422 {
  path: string;
  code?: string;
  message: string;
}

async function issues(res: Response): Promise<Issue422[]> {
  expect(res.status).toBe(422);
  const body = (await res.json()) as { issues: Issue422[] };
  expect(Array.isArray(body.issues)).toBe(true);
  return body.issues;
}

describe('REST control plane: the full loop over HTTP', () => {
  it('runs registry → calendar → author → lifecycle → assign → evaluate → audit', async () => {
    const fetch = await handler();

    // Discovery before a registry exists.
    const doc = await ok(await fetch(req('GET', '/v1')));
    expect(doc['engine']).toBe('malkom-processmetrics-engine');
    expect(doc['registry']).toBeNull();
    expect((doc['capabilities'] as { operators: string[] }).operators).toContain('matches');
    expect(Object.keys(await ok(await fetch(req('GET', '/v1/schemas'))))).toContain('metric-definition');
    const openapi = await ok(await fetch(req('GET', '/v1/openapi.json')));
    expect(Object.keys(openapi['paths'] as Record<string, unknown>)).toContain('/v1/eval/snapshot');

    // Registry.
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));
    expect((await ok(await fetch(req('GET', '/v1/registry'))))['version']).toBe(1);

    // Calendars: collection PUT, list, per-name GET + PUT.
    await ok(await fetch(req('PUT', '/v1/calendars', CALENDAR)));
    expect(((await fetch(req('GET', '/v1/calendars'))).status)).toBe(200);
    expect((await ok(await fetch(req('GET', '/v1/calendars/india-ops'))))['name']).toBe('india-ops');
    await ok(await fetch(req('PUT', '/v1/calendars/india-ops', CALENDAR)));

    // Create → validate → submit → activate.
    const created = await ok(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'money' })));
    expect(created['state']).toBe('draft');
    expect((await ok(await fetch(req('GET', '/v1/metrics'))))).toBeDefined();
    expect((await ok(await fetch(req('GET', '/v1/metrics/regional-daily'))))['name']).toBe('regional-daily');

    const verdict = await ok(await fetch(req('POST', '/v1/metrics/regional-daily/validate', {})));
    expect(verdict['ok']).toBe(true);

    await ok(await fetch(req('POST', '/v1/metrics/regional-daily/submit', { actor: 'money' })));
    const activated = await ok(await fetch(req('POST', '/v1/metrics/regional-daily/activate', { actor: 'priya' })));
    expect((activated['head'] as { state: string }).state).toBe('active');
    expect(((await ok(await fetch(req('GET', '/v1/metrics/regional-daily/versions')))) as unknown as unknown[]).length).toBe(1);

    // PATCH edits the draft (lineage back to draft; active version untouched).
    const edited = await ok(
      await fetch(
        req('PATCH', '/v1/metrics/regional-daily', {
          definition: { ...structuredClone(REGIONAL_DAILY), description: 'daily volume per region' },
          actor: 'money',
        }),
      ),
    );
    expect(edited['state']).toBe('draft');
    expect(edited['activeVersion']).toBe(1);

    // Re-approve the edited draft: version 2 supersedes.
    await ok(await fetch(req('POST', '/v1/metrics/regional-daily/submit', { actor: 'money' })));
    const reactivated = await ok(await fetch(req('POST', '/v1/metrics/regional-daily/activate', { actor: 'priya' })));
    expect((reactivated['version'] as { versionNo: number }).versionNo).toBe(2);

    // Assignments.
    const assignment = await ok(
      await fetch(req('POST', '/v1/assignments', { metric: 'regional-daily', scope: { region: 'APAC' } })),
    );
    const list = (await ok(await fetch(req('GET', '/v1/assignments?metric=regional-daily')))) as unknown as Array<{
      id: string;
    }>;
    expect(list.length).toBe(1);

    // Evaluation: calculate (no persistence), snapshot, backfill, series.
    const result = await ok(
      await fetch(req('POST', '/v1/eval/calculate', { metric: 'regional-daily', scope: { region: 'APAC' } })),
    );
    expect(result['value']).toBe(1);
    expect((result['window'] as { key: string }).key).toBe('day:2026-08-12');

    const snapshot = (await ok(
      await fetch(req('POST', '/v1/eval/snapshot', { scope: { region: 'APAC' } })),
    )) as unknown as Array<{ metric: string; source: string; value: number }>;
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ metric: 'regional-daily', source: 'live', value: 1 });

    // Backfill persists only CLOSED windows: at the fixed 08-12T06:00Z clock
    // that is the 08-10 and 08-11 days.
    const backfill = await ok(
      await fetch(
        req('POST', '/v1/eval/backfill', {
          metric: 'regional-daily',
          range: { fromIso: '2026-08-10T00:00:00Z', toIso: '2026-08-12T00:00:00Z' },
        }),
      ),
    );
    expect((backfill['points'] as unknown[]).length).toBe(2);

    const series = (await ok(
      await fetch(
        req('POST', '/v1/eval/series', {
          metric: 'regional-daily',
          scope: { region: 'APAC' },
          fromIso: '2026-08-10T00:00:00Z',
          toIso: '2026-08-12T00:00:00Z',
        }),
      ),
    )) as unknown as Array<{ windowKey: string }>;
    expect(series.map((p) => p.windowKey)).toEqual(['day:2026-08-10', 'day:2026-08-11']);

    // Backtest replays the draft.
    const replay = (await ok(
      await fetch(
        req('POST', '/v1/metrics/regional-daily/backtest', {
          range: { fromIso: '2026-08-11T00:00:00Z', toIso: '2026-08-13T00:00:00Z' },
          scope: { region: 'APAC' },
        }),
      ),
    )) as unknown as unknown[];
    expect(replay).toHaveLength(2);

    // Data plane: points + runs.
    const points = (await ok(await fetch(req('GET', '/v1/points?metric=regional-daily')))) as unknown as unknown[];
    expect(points.length).toBe(2);
    const runs = (await ok(await fetch(req('GET', '/v1/runs?metric=regional-daily&trigger=backfill')))) as unknown as unknown[];
    expect(runs.length).toBe(2);

    // Telemetry, both formats.
    const prom = await fetch(req('GET', '/v1/telemetry'));
    expect(prom.status).toBe(200);
    expect(prom.headers.get('content-type')).toContain('text/plain');
    expect(await prom.text()).toContain('malkom_metrics_points_total');
    const telemetryJson = await ok(await fetch(req('GET', '/v1/telemetry.json')));
    expect((telemetryJson['counters'] as Record<string, number>)['malkom_metrics_points_total']).toBe(2);

    // Deletes need admin intent, and answer with counts.
    expect((await ok(await fetch(req('DELETE', '/v1/points', { metric: 'regional-daily' }))))['deleted']).toBe(2);
    expect(typeof (await ok(await fetch(req('DELETE', '/v1/runs'))))['pruned']).toBe('number');

    // Retire ends the loop.
    const retired = await ok(await fetch(req('POST', '/v1/metrics/regional-daily/retire', { actor: 'priya' })));
    expect(retired['state']).toBe('retired');

    // Unassign.
    await ok(await fetch(req('DELETE', `/v1/assignments/${assignment['id'] as string}`)));

    // Errors map to typed envelopes.
    const missing = await fetch(req('GET', '/v1/metrics/nope'));
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('rejects garbage with the 422 {issues:[{path,code,message}]} shape — exact paths', async () => {
    const fetch = await handler();
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));

    // Missing body fields carry their exact path.
    const noMetric = await issues(await fetch(req('POST', '/v1/eval/calculate', {})));
    expect(noMetric.map((i) => i.path)).toContain('metric');
    expect(noMetric[0]?.message).toBeDefined();
    expect(noMetric[0]?.code).toBeDefined();

    // Bad instants and enums, in bodies and query params.
    const badAt = await issues(
      await fetch(req('POST', '/v1/eval/calculate', { metric: 'x', at: 'tomorrow' })),
    );
    expect(badAt.map((i) => i.path)).toContain('at');
    // Zone-less datetimes are refused: the same request must never name
    // different windows on different hosts. Offsets are explicit and fine.
    const zoneless = await issues(
      await fetch(req('POST', '/v1/eval/calculate', { metric: 'x', at: '2026-08-12T00:00:00' })),
    );
    expect(zoneless[0]).toMatchObject({ path: 'at', message: expect.stringContaining('timezone') as string });
    expect((await fetch(req('GET', '/v1/points?metric=m&fromIso=2026-08-12T00:00:00'))).status).toBe(422);
    expect((await fetch(req('POST', '/v1/eval/snapshot', { mode: 'psychic' }))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/points?metric=m&limit=abc'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/points?metric=m&grain=fortnight'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/runs?status=meh'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/registry?version=latest'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/registry?version=99'))).status).toBe(404);
    // /v1/points without ?metric is a 422 naming the missing param.
    const noQueryMetric = await issues(await fetch(req('GET', '/v1/points')));
    expect(noQueryMetric.map((i) => i.path)).toContain('metric');

    // Assigning to a metric that does not exist is an honest 404 …
    expect((await fetch(req('POST', '/v1/assignments', { metric: 'regional-daily', scope: {} }))).status).toBe(404);

    // … and tier-1 issues surface with their AST paths and codes.
    await ok(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'money' })));
    const scopeIssues = await issues(
      await fetch(req('POST', '/v1/assignments', { metric: 'regional-daily', scope: { planet: 'MARS' } })),
    );
    expect(scopeIssues).toContainEqual(
      expect.objectContaining({ path: 'scope.region', code: 'scope_key_missing' }),
    );
    expect(scopeIssues).toContainEqual(
      expect.objectContaining({ path: 'scope.planet', code: 'scope_key_unexpected' }),
    );

    // A definition that parses but fails tier-1 still STORES (drafts compose
    // incrementally), but a shape-invalid one is a 422 with zod paths.
    const shapeless = await issues(
      await fetch(req('POST', '/v1/metrics', { definition: { name: 'x' }, actor: 'money' })),
    );
    expect(shapeless.map((i) => i.path)).toContain('kind');

    // Malformed JSON body must never become a clean {} verdict.
    const malformed = await fetch(
      new Request('http://engine.local/v1/eval/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{oops',
      }),
    );
    expect((await issues(malformed))[0]?.message).toMatch(/valid JSON/);
  });

  it('requires an actor on audited mutations — no silent "anonymous"', async () => {
    const fetch = await handler();
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));

    const noActor = await issues(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY })));
    expect(noActor.map((i) => i.path)).toContain('actor');

    await ok(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'money' })));
    expect((await fetch(req('POST', '/v1/metrics/regional-daily/submit', {}))).status).toBe(422);
    expect((await fetch(req('PATCH', '/v1/metrics/regional-daily', { definition: REGIONAL_DAILY }))).status).toBe(422);
  });

  it('enforces bearer scopes: read reads, admin mutates, unknown is rejected', async () => {
    const fetch = await handler({ auth: { adminKeys: ['adm-1'], readKeys: ['rd-1'] } });

    // No token.
    expect((await fetch(req('GET', '/v1'))).status).toBe(401);
    // Read token: discovery + eval reads yes, mutations no.
    expect((await fetch(req('GET', '/v1', undefined, 'rd-1'))).status).toBe(200);
    expect((await fetch(req('GET', '/v1/telemetry', undefined, 'rd-1'))).status).toBe(200);
    expect((await fetch(req('PUT', '/v1/registry', REGISTRY, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('PUT', '/v1/calendars', CALENDAR, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'a' }, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('POST', '/v1/metrics/x/activate', { actor: 'a' }, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('POST', '/v1/metrics/x/backtest', {}, 'rd-1'))).status).toBe(403); // real host rows
    expect((await fetch(req('POST', '/v1/eval/backfill', {}, 'rd-1'))).status).toBe(403); // writes points
    expect((await fetch(req('DELETE', '/v1/points', {}, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('DELETE', '/v1/runs', undefined, 'rd-1'))).status).toBe(403);
    expect((await fetch(req('DELETE', '/v1/telemetry', undefined, 'rd-1'))).status).toBe(403);
    // Eval reads are read-scoped.
    expect((await fetch(req('POST', '/v1/eval/snapshot', {}, 'rd-1'))).status).not.toBe(403);
    // Admin token mutates.
    expect((await fetch(req('PUT', '/v1/registry', REGISTRY, 'adm-1'))).status).toBe(200);
    // Garbage token.
    expect((await fetch(req('GET', '/v1', undefined, 'nope'))).status).toBe(401);
    // RFC 7235: the scheme is case-insensitive.
    const lower = await fetch(
      new Request('http://engine.local/v1', { method: 'GET', headers: { authorization: 'bearer rd-1' } }),
    );
    expect(lower.status).toBe(200);
  });

  it('leaves the control plane OPEN when no keys are configured — every caller is admin', async () => {
    const fetch = await handler(); // no auth option at all
    expect((await fetch(req('GET', '/v1'))).status).toBe(200);
    expect((await fetch(req('PUT', '/v1/registry', REGISTRY))).status).toBe(200);
    expect((await fetch(req('DELETE', '/v1/telemetry'))).status).toBe(200);
  });

  it('answers auth BEFORE decoding path params; malformed encoding is 404, never 500', async () => {
    const fetch = await handler({ auth: { adminKeys: ['adm-1'], readKeys: [] } });

    // No key: 401 — the old code ran decodeURIComponent first, and a
    // malformed escape turned an UNAUTHENTICATED probe into a URIError 500.
    for (const probe of ['/v1/metrics/%zz', '/v1/metrics/%', '/v1/calendars/%zz', '/v1/calendars/%']) {
      const res = await fetch(req('GET', probe));
      expect(res.status, probe).toBe(401);
    }

    // Valid key: a path that cannot decode names no resource — 404
    // NOT_FOUND, with no URIError internals leaked.
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY, 'adm-1')));
    const cases: Array<[string, string]> = [
      ['GET', '/v1/metrics/%zz'],
      ['GET', '/v1/metrics/%'],
      ['GET', '/v1/metrics/%zz/versions'],
      ['POST', '/v1/metrics/%zz/submit'],
      ['GET', '/v1/calendars/%'],
      ['DELETE', '/v1/assignments/%zz'],
    ];
    for (const [method, probe] of cases) {
      const res = await fetch(req(method, probe, method === 'GET' ? undefined : { actor: 'a' }, 'adm-1'));
      expect(res.status, `${method} ${probe}`).toBe(404);
      const text = await res.text();
      expect(text).toContain('NOT_FOUND');
      expect(text).not.toContain('URIError');
      expect(text).not.toContain('malformed');
    }
  });

  it('every 401 carries WWW-Authenticate: Bearer (RFC 7235)', async () => {
    const fetch = await handler({ auth: { adminKeys: ['adm-1'], readKeys: ['rd-1'] } });

    const missing = await fetch(req('GET', '/v1'));
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toBe('Bearer');

    const bad = await fetch(req('GET', '/v1', undefined, 'not-a-key'));
    expect(bad.status).toBe(401);
    expect(bad.headers.get('www-authenticate')).toBe('Bearer');

    // 403 (known key, wrong scope) is NOT a challenge — no header.
    const forbidden = await fetch(req('PUT', '/v1/registry', REGISTRY, 'rd-1'));
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get('www-authenticate')).toBeNull();
  });

  it('AdapterError never leaks driver text to clients; full detail goes to the engine logger', async () => {
    // A SQL-bound entity whose driver fails with connection/schema intel.
    const boomClient: SqlClient = {
      query: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432 — relation "host_secrets" does not exist');
      },
      execute: async () => ({ rowCount: 0 }),
      close: async () => {},
    };
    const connections = new ConnectionRegistry({ logger: noopLogger });
    connections.registerClient('ops', 'sqlite', boomClient);
    const logged: string[] = [];
    const logger: Logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (fields, msg) => logged.push(JSON.stringify({ ...fields, msg })),
    };
    const engine = new MetricsEngine({ connections, clock: fixedClock, logger });
    await engine.start();
    const fetch = buildFetchHandler(engine);

    const sqlRegistry: RegistryDocInput = {
      entities: [
        {
          id: 'booking',
          table: { name: 'workEvents' },
          connectionRef: 'ops',
          fields: [
            { id: 'region', type: 'string', values: ['APAC', 'EMEA'] },
            { id: 'createdAt', type: 'date' },
          ],
        },
      ],
      valueSets: [],
    };
    await ok(await fetch(req('PUT', '/v1/registry', sqlRegistry)));
    await ok(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'money' })));

    const res = await fetch(req('POST', '/v1/eval/calculate', { metric: 'regional-daily', scope: { region: 'APAC' } }));
    expect(res.status).toBe(502);
    const text = await res.text();
    const body = JSON.parse(text) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ADAPTER_ERROR');
    expect(body.error.message).toBe('upstream data source error (entity "booking")');
    // The driver's table/connection intel stays OFF the wire …
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('host_secrets');
    expect(text).not.toContain('10.0.0.5');
    // … and lands, in full, in the engine log.
    expect(logged.join(' ')).toContain('ECONNREFUSED');
    expect(logged.join(' ')).toContain('host_secrets');
    await engine.stop();
  });

  it('draft execution is admin-gated: read-scope calculate on a draft-only metric is 409', async () => {
    const fetch = await handler({ auth: { adminKeys: ['adm-1'], readKeys: ['rd-1'] } });
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY, 'adm-1')));
    await ok(await fetch(req('POST', '/v1/metrics', { definition: REGIONAL_DAILY, actor: 'money' }, 'adm-1')));

    // Read scope must NOT execute the unreviewed working draft — the exact
    // capability backtest admin-gates. Honest code: 409, no active version.
    const read = await fetch(
      req('POST', '/v1/eval/calculate', { metric: 'regional-daily', scope: { region: 'APAC' } }, 'rd-1'),
    );
    expect(read.status).toBe(409);
    const body = (await read.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('no active version');

    // Admin keeps the draft fallback.
    const admin = await fetch(
      req('POST', '/v1/eval/calculate', { metric: 'regional-daily', scope: { region: 'APAC' } }, 'adm-1'),
    );
    expect(admin.status).toBe(200);

    // Once ACTIVE, read scope computes it.
    await ok(await fetch(req('POST', '/v1/metrics/regional-daily/submit', { actor: 'money' }, 'adm-1')));
    await ok(await fetch(req('POST', '/v1/metrics/regional-daily/activate', { actor: 'priya' }, 'adm-1')));
    const activeRead = await fetch(
      req('POST', '/v1/eval/calculate', { metric: 'regional-daily', scope: { region: 'APAC' } }, 'rd-1'),
    );
    expect(activeRead.status).toBe(200);
  });

  it('answers 404 for unknown routes and 405 (with Allow) for wrong methods', async () => {
    const fetch = await handler();
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));

    expect((await fetch(req('GET', '/v1/nope'))).status).toBe(404);
    expect((await fetch(req('GET', '/v1/eval/psychic'))).status).toBe(404);
    expect((await fetch(req('POST', '/v1/metrics/x/explode', {}))).status).toBe(404);

    const del = await fetch(req('DELETE', '/v1/registry'));
    expect(del.status).toBe(405);
    expect(del.headers.get('allow')).toBe('GET, PUT');
    expect((await fetch(req('POST', '/v1/telemetry.json', {}))).status).toBe(405);
    expect((await fetch(req('GET', '/v1/eval/calculate'))).status).toBe(405);
    expect((await fetch(req('PUT', '/v1/points', {}))).status).toBe(405);
  });
});
