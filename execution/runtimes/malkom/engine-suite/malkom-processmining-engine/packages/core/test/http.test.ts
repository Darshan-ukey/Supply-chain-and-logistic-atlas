import { rm } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { createRouter, type MiningRequest, type MiningResponse } from '../src/http/router.js';
import { parseFilterSpec, parseOutcomeSpec } from '../src/http/specs.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { CHOICE_LOG, makeTempDir, writeCsvLog } from './helpers/logs.js';

/**
 * The HTTP surface is what the runtime will actually talk to, so these check
 * the contract rather than the analytics: correct status codes, a discovery
 * document that matches the routes that exist, and errors that say what to do.
 */

let dir: string;
let client: SqlClient;
let route: (req: MiningRequest) => Promise<MiningResponse>;

beforeAll(async () => {
  dir = await makeTempDir();
  const path = await writeCsvLog(dir, 'http-fixture.csv', CHOICE_LOG, { caseAttribute: 'channel' });
  client = await openMemoryDuckDB();
  await importCsv(client, duckdbDialect, { path });
  route = createRouter({ resolveStore: async () => client, defaultStore: 'main' });
});

afterAll(async () => {
  await client?.close();
  await rm(dir, { recursive: true, force: true });
});

function get(path: string, query = '', headers?: Record<string, string>): Promise<MiningResponse> {
  return route({
    method: 'GET',
    path,
    query: new URLSearchParams(query),
    ...(headers !== undefined ? { headers } : {}),
  });
}

function post(path: string, body: unknown): Promise<MiningResponse> {
  return route({ method: 'POST', path, query: new URLSearchParams(), body });
}

function payload(response: MiningResponse): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('simplifying the map', () => {
  it('hides the quiet steps by default and collapses them when asked', async () => {
    const hidden = payload(await get('/v1/discover', 'nodes=0.5'));
    expect(hidden['groups']).toBeUndefined();

    const grouped = payload(await get('/v1/discover', 'nodes=0.5&group=true'));
    // Empty is a real answer here — this fixture's rare steps may not sit
    // beside each other — but the field must be present either way, so a
    // caller can tell "nothing to collapse" from "never asked".
    expect(Array.isArray(grouped['groups'])).toBe(true);
  });
});

describe('the case explorer over HTTP', () => {
  it('lists cases, and one case when given an id', async () => {
    const list = payload(await get('/v1/cases', 'limit=2'));
    expect(list['total']).toBe(4);
    const cases = list['cases'] as { caseId: string }[];
    expect(cases).toHaveLength(2);

    const one = payload(await get('/v1/cases', `id=${cases[0]?.caseId ?? ''}`));
    expect(one['caseId']).toBe(cases[0]?.caseId);
    expect((one['steps'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('reads the shared selection like every other route', async () => {
    const all = payload(await get('/v1/cases'));
    const web = payload(await get('/v1/cases', 'filter=channel%3Dweb'));
    expect(web['total']).toBeLessThan(all['total'] as number);
  });

  it('rejects a cursor it did not issue', async () => {
    // 422, the code this router already gives an invalid configuration.
    const response = await get('/v1/cases', 'cursor=forged');
    expect(response.status).toBe(422);
  });
});

describe('dependency and footprint over HTTP', () => {
  it('annotates arcs with dependency strength', async () => {
    const graph = payload(await get('/v1/dependency'));
    const edges = graph['edges'] as { from: string; to: string; dependency: number }[];
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.dependency >= -1 && e.dependency <= 1)).toBe(true);
    expect(graph['lengthTwoLoopsMeasured']).toBe(true);
  });

  it('skips the alternation pass when asked, and says it did', async () => {
    const graph = payload(await get('/v1/dependency', 'shortLoops=false'));
    expect(graph['lengthTwoLoopsMeasured']).toBe(false);
  });

  it('returns a grid, or a comparison when given a cohort', async () => {
    const grid = payload(await get('/v1/footprint'));
    expect(Array.isArray(grid['cells'])).toBe(true);
    expect(grid['differences']).toBeUndefined();

    const comparison = payload(await get('/v1/footprint', 'a=channel%3Dweb'));
    expect(Array.isArray(comparison['differences'])).toBe(true);
    expect(comparison['agreement']).toBeTypeOf('number');
  });

  it('refuses a comparison against nothing', async () => {
    expect((await get('/v1/footprint', 'a=rest')).status).toBe(422);
  });
});

describe('discovery', () => {
  it('lists the routes that actually exist', async () => {
    const response = await get('/v1');
    expect(response.status).toBe(200);
    const routes = payload(response)['routes'] as { path: string }[];
    const paths = routes.map((r) => r.path);

    // Discovery is generated from the route table, so it cannot drift from it.
    expect(paths).toContain('/v1/discover');
    expect(paths).toContain('/v1/performance');
    expect(paths).toContain('/v1/rootcause');
    expect(paths).toContain('/v1/chart/dotted');
  });

  it('answers on every route it advertises', async () => {
    // The check that scales. Each route is registered by hand, and a handler
    // that throws on an empty query is indistinguishable from one that works
    // until somebody opens that tab — this walks all of them.
    //
    // Routes needing a required argument are given a valid one rather than
    // being skipped, because "throws without its argument" is the easy half
    // and "works with it" is the half that matters.
    const supplied: Record<string, string> = {
      '/v1/spectrum': 'from=a&to=b',
      '/v1/alluvial': 'attribute=channel',
      '/v1/delta': 'a=activity%3Aa',
      '/v1/compare': 'a=activity%3Aa',
      '/v1/risk': 'bad=c',
    };

    // Its own router, so walking every route cannot warm the shared layout
    // cache and make a later test see a hit where it expects a miss.
    const walker = createRouter({ resolveStore: async () => client, defaultStore: 'main' });
    const paths = (payload(await get('/v1'))['routes'] as { path: string }[]).map((r) => r.path);

    const failures: string[] = [];
    for (const path of paths) {
      // Stream management mutates a registry rather than reading the log, so
      // calling every one of those blind would be a different kind of test.
      if (path.startsWith('/v1/stream')) continue;
      const response = await walker({
        method: 'GET',
        path,
        query: new URLSearchParams(supplied[path] ?? ''),
      });
      if (response.status !== 200) {
        failures.push(`${path} -> ${response.status} ${JSON.stringify(response.body)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('honours a numeric option sent as a number, not only as text', async () => {
    // A query string only ever carries text; a JSON body carries a real
    // number. Reading the body as a string discards it, and the request still
    // succeeds — so a cap that never applied looks exactly like a cap that was
    // not needed. Every POSTing client hits this, which is most of them.
    const asNumber = await post('/v1/variants', { top: 1 });
    expect(asNumber.status).toBe(200);
    expect((payload(asNumber)['variants'] as unknown[]).length).toBe(1);

    // And the query string still works, since that is the other half.
    const asText = await get('/v1/variants', 'top=1');
    expect((payload(asText)['variants'] as unknown[]).length).toBe(1);

    // Unbounded really is unbounded, so the one above is the cap biting
    // rather than the fixture only ever having had one route.
    expect((payload(await post('/v1/variants', {}))['variants'] as unknown[]).length)
      .toBeGreaterThan(1);
  });

  it('says what a route needs when it is not given it', async () => {
    // A 500 here would be the same fault dressed as a server problem.
    for (const path of ['/v1/spectrum', '/v1/alluvial', '/v1/delta']) {
      const response = await get(path);
      expect(response.status).toBe(422);
    }
  });

  it('documents the shared parameters, including the filter grammar', async () => {
    const shared = payload(await get('/v1'))['shared'] as Record<string, string>;
    expect(shared['filter']).toContain('activity:');
    expect(shared['objectType']).toBeDefined();
  });

  it('serves the input contract', async () => {
    const requirements = payload(await get('/v1/requirements'))['requirements'] as unknown[];
    expect(requirements.length).toBeGreaterThan(5);
  });

  it('treats a trailing slash as the same route', async () => {
    expect((await get('/v1/')).status).toBe(200);
  });
});

describe('analyses over HTTP', () => {
  it('discovers a process', async () => {
    const body = payload(await get('/v1/discover'));
    expect(body['caseCount']).toBe(4);
    expect(body['treeText']).toBe("->( 'a', X( 'b', 'c' ), 'd' )");
    expect(body['imprecise']).toBe(false);
  });

  it('returns variants', async () => {
    const body = payload(await get('/v1/variants', 'top=2'));
    expect(body['totalVariants']).toBe(2);
  });

  it('lays out a graph and caches it', async () => {
    const first = payload(await get('/v1/layout'));
    expect(first['cached']).toBe(false);
    expect(Number(first['width'])).toBeGreaterThan(0);

    const second = payload(await get('/v1/layout'));
    // Layout is deterministic and identical for every viewer, so recomputing
    // it per request is pure waste.
    expect(second['cached']).toBe(true);
    expect(second['cacheKey']).toBe(first['cacheKey']);
  });

  it('bins a dotted chart', async () => {
    const body = payload(await get('/v1/chart/dotted', 'xBins=10&yBins=10'));
    expect(body['xBins']).toBe(10);
    expect((body['bins'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('applies a filter from the query string', async () => {
    const all = payload(await get('/v1/variants'));
    const filtered = payload(await get('/v1/variants', 'filter=activity:b'));
    expect(Number(filtered['totalCases'])).toBeLessThan(Number(all['totalCases']));

    const meta = filtered['meta'] as Record<string, unknown>;
    // Echoing the filter back means a caller can always see what was applied.
    expect(meta['filter']).toBe('doing b');
  });

  it('combines repeated filters', async () => {
    const response = await get('/v1/variants', 'filter=activity:a&filter=activity:b');
    const meta = payload(response)['meta'] as Record<string, unknown>;
    expect(meta['filter']).toBe('doing a and doing b');
  });

  it('accepts a structured filter in a POST body', async () => {
    const response = await post('/v1/variants', {
      filter: { kind: 'attribute', key: 'channel', value: 'web' },
    });
    expect(response.status).toBe(200);
    const meta = payload(response)['meta'] as Record<string, unknown>;
    expect(meta['filter']).toBe('channel = web');
  });

  it('reports elapsed time and the resolved object type', async () => {
    const meta = payload(await get('/v1/performance'))['meta'] as Record<string, unknown>;
    expect(meta['objectType']).toBe('case');
    expect(Number(meta['elapsedMs'])).toBeGreaterThanOrEqual(0);
    expect(meta['store']).toBe('main');
  });

  it('defaults the object type to whatever the store holds', async () => {
    // Never assume 'case': a store built around bookings must work without the
    // caller knowing what the case notion is called.
    const meta = payload(await get('/v1/discover'))['meta'] as Record<string, unknown>;
    expect(meta['objectType']).toBe('case');
  });

  it('flags a conformance run with no supplied model', async () => {
    const body = payload(await get('/v1/conformance'));
    expect(body['selfCheck']).toBe(true);
    expect(String(body['caveat'])).toContain('not compliance');
  });
});

describe('status codes', () => {
  it('404s an unknown route', async () => {
    const response = await get('/v1/nope');
    expect(response.status).toBe(404);
  });

  it('422s a malformed outcome rather than calling it not found', async () => {
    // A bad parameter is invalid input, not a missing resource. Returning 404
    // sends a caller looking for a route that is right there.
    const response = await get('/v1/rootcause', 'outcome=garbage');
    expect(response.status).toBe(422);
    const error = payload(response)['error'] as Record<string, unknown>;
    expect(error['code']).toBe('CONFIG_INVALID');
    expect((error['details'] as string[]).join(' ')).toContain('slowest:');
  });

  it('422s a missing cohort and says what to pass', async () => {
    const response = await get('/v1/compare');
    expect(response.status).toBe(422);
    const details = (payload(response)['error'] as Record<string, unknown>)['details'] as string[];
    expect(details.join(' ')).toContain('channel=web');
  });

  it('422s an unparseable filter and returns the grammar', async () => {
    const response = await get('/v1/variants', 'filter=%%%nonsense');
    expect(response.status).toBe(422);
    const details = (payload(response)['error'] as Record<string, unknown>)['details'] as string[];
    expect(details.some((d) => d.includes('activity:X'))).toBe(true);
  });

  it('405s a method that is not GET or POST', async () => {
    const response = await route({
      method: 'DELETE',
      path: '/v1/variants',
      query: new URLSearchParams(),
    });
    expect(response.status).toBe(405);
    expect(response.headers['allow']).toBe('GET, POST');
  });

  it('surfaces an honest refusal with its remedies', async () => {
    // The organizational perspective refuses when nothing records who did the
    // work; the HTTP layer must carry the remedies through, not flatten them.
    const path = await writeCsvLog(dir, 'http-noresource.csv', CHOICE_LOG);
    const bare = await openMemoryDuckDB();
    await importCsv(bare, duckdbDialect, { path, mapping: { resource: '__absent__' } });
    const bareRoute = createRouter({ resolveStore: async () => bare, defaultStore: 'main' });

    const response = await bareRoute({
      method: 'GET',
      path: '/v1/resources',
      query: new URLSearchParams(),
    });
    expect(response.status).toBe(409);
    const body = payload(response);
    expect((body['error'] as Record<string, unknown>)['code']).toBe('PERSPECTIVE_UNAVAILABLE');
    expect((body['remedies'] as string[]).length).toBeGreaterThan(0);
    await bare.close();
  });
});

describe('authentication', () => {
  it('rejects a request with no key when keys are configured', async () => {
    const guarded = createRouter({
      resolveStore: async () => client,
      defaultStore: 'main',
      apiKeys: { secret: 'test' },
    });
    const response = await guarded({
      method: 'GET',
      path: '/v1',
      query: new URLSearchParams(),
    });
    expect(response.status).toBe(401);
  });

  it('accepts a valid key', async () => {
    const guarded = createRouter({
      resolveStore: async () => client,
      defaultStore: 'main',
      apiKeys: { secret: 'test' },
    });
    const response = await guarded({
      method: 'GET',
      path: '/v1',
      query: new URLSearchParams(),
      headers: { 'x-api-key': 'secret' },
    });
    expect(response.status).toBe(200);
  });

  it('is open when no keys are configured, for the embedded case', async () => {
    expect((await get('/v1')).status).toBe(200);
  });
});

describe('selector grammar', () => {
  it('parses every documented filter form', () => {
    expect(parseFilterSpec('channel=web')).toEqual({
      kind: 'attribute',
      key: 'channel',
      value: 'web',
    });
    expect(parseFilterSpec('channel=web,phone')).toEqual({
      kind: 'attribute',
      key: 'channel',
      values: ['web', 'phone'],
    });
    expect(parseFilterSpec('activity:Approve')).toEqual({ kind: 'activity', activity: 'Approve' });
    expect(parseFilterSpec('!activity:Reject')).toEqual({
      kind: 'activity',
      activity: 'Reject',
      present: false,
    });
    expect(parseFilterSpec('resource:alice')).toEqual({ kind: 'resource', resource: 'alice' });
    expect(parseFilterSpec('slower-than:3600')).toEqual({ kind: 'cycleTime', minSeconds: 3600 });
    expect(parseFilterSpec('faster-than:60')).toEqual({ kind: 'cycleTime', maxSeconds: 60 });
    expect(parseFilterSpec('length:3..5')).toEqual({ kind: 'length', min: 3, max: 5 });
  });

  it('allows an open-ended length', () => {
    // "at least three steps" is a more common question than "between three and
    // some arbitrary ceiling".
    expect(parseFilterSpec('length:3..')).toEqual({ kind: 'length', min: 3 });
  });

  it('rejects nonsense rather than guessing', () => {
    expect(parseFilterSpec('garbage')).toBeUndefined();
    expect(parseFilterSpec('')).toBeUndefined();
    expect(parseFilterSpec('length:abc')).toBeUndefined();
    expect(parseFilterSpec('=novalue')).toBeUndefined();
  });

  it('parses every outcome form', () => {
    expect(parseOutcomeSpec('slowest:0.2')).toEqual({ kind: 'slowest-fraction', fraction: 0.2 });
    expect(parseOutcomeSpec('slower-than:604800')).toEqual({ kind: 'slower-than', seconds: 604800 });
    expect(parseOutcomeSpec('contains:Reject')).toEqual({ kind: 'contains', activity: 'Reject' });
    expect(parseOutcomeSpec('missing:Pay')).toEqual({ kind: 'missing', activity: 'Pay' });
  });

  it('rejects a fraction outside (0,1)', () => {
    expect(parseOutcomeSpec('slowest:1.5')).toBeUndefined();
    expect(parseOutcomeSpec('slowest:0')).toBeUndefined();
  });
});
