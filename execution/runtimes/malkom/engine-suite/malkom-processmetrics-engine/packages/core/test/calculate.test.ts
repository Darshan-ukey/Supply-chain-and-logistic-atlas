/**
 * M3 orchestration end-to-end: calculateMetric over a REAL SQLite workEvents
 * table (parameterized SQL, minimal projection, param-order regression,
 * overflow-throws, memory/SQL parity, snapshot fetches), tier-2 live schema
 * validation (missing_column / missing_table with exact paths), and
 * backtestMetric series (periodic days incl. no_data + holiday; rolling
 * stepping with a configurable backtestStep).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assignmentSchema,
  calendarSchema,
  metricDefinitionSchema,
  registryDocSchema,
  type Calendar,
  type MetricDefinitionInput,
  type RegistryDocInput,
} from '../src/config/schemas.js';
import { dialectIntrospector, buildFactSelect } from '../src/sql/factfetch.js';
import { validateMetricLive, type LiveSchemaAccess } from '../src/config/validate.js';
import { ConfigInvalidError, MalkomError } from '../src/domain/errors.js';
import { CompiledRegistry } from '../src/domain/registry.js';
import { MemoryFactSource, type FactQuery } from '../src/ports/factsource.js';
import type { SqlClient } from '../src/ports/sql.js';
import { backtestMetric, calculateMetric } from '../src/runtime/calculate.js';
import { SqliteSqlClient } from '../src/sql/clients.js';
import { ConnectionRegistry } from '../src/sql/connections.js';
import { sqliteDialect } from '../src/sql/dialect.js';

// ---------------------------------------------------------------------------
// Shared fixture: the Booking-TAT world, bound to a physical workEvents table
// with RENAMED columns so the registry mapping is actually exercised.
// ---------------------------------------------------------------------------

const REGISTRY_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      table: { name: 'workEvents' },
      connectionRef: 'ops',
      fields: [
        { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped', 'cancelled'] },
        { id: 'region', type: 'string', valueSet: 'regions' },
        { id: 'teu', type: 'number' },
        { id: 'createdAt', type: 'date', column: 'created_at' },
        { id: 'confirmedAt', type: 'date', column: 'confirmed_at' },
        { id: 'customerTier', type: 'string', values: ['gold', 'silver', 'bronze'], column: 'customer_tier' },
      ],
    },
  ],
  valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
};
const REGISTRY = new CompiledRegistry(registryDocSchema.parse(REGISTRY_INPUT), 1);

/** Mon-Fri 09:00-18:00 IST; Friday 2026-08-14 is a holiday. */
const CALENDAR: Calendar = calendarSchema.parse({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

/** The Booking-TAT SLA, anchored on the confirmation event. */
const BOOKING_TAT: MetricDefinitionInput = {
  name: 'booking-tat-sla',
  kind: 'sla',
  metricType: 'percent',
  scope: { dimensions: ['region'] },
  window: { kind: 'periodic', grain: 'week' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
  calendarRef: 'india-ops',
  derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] } },
  formula: {
    kind: 'ratio',
    numerator: {
      agg: 'count',
      source: 'booking',
      where: {
        op: 'and',
        args: [
          { op: 'eq', field: 'status', value: 'confirmed' },
          { op: 'lte', field: 'tatMinutes', value: 240 },
        ],
      },
    },
    denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
  },
  exclusions: [
    {
      id: 'bronze-migration',
      reason: 'bronze accounts migrating to the new workflow are out of SLA scope',
      when: { op: 'eq', field: 'customerTier', value: 'bronze' },
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    },
  ],
  effectiveFrom: '2026-08-01T00:00:00Z',
};

// A type alias (not an interface) so it satisfies Record<string, unknown>.
type Row = {
  id: string;
  region: string;
  status: string;
  createdAt: string | null;
  confirmedAt: string | null;
  customerTier: string;
};

function row(id: string, region: string, status: string, createdAt: string | null, confirmedAt: string | null, customerTier: string): Row {
  return { id, region, status, createdAt, confirmedAt, customerTier };
}

/** The M2 evaluate fixture rows, verbatim (tatMinutes hand-computed there). */
const WORK_EVENTS: Row[] = [
  row('b1', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:30:00Z', 'gold'),
  row('b2', 'APAC', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T11:30:00Z', 'gold'),
  row('b3', 'APAC', 'confirmed', '2026-08-11T11:30:00Z', '2026-08-12T04:30:00Z', 'silver'),
  row('b4', 'APAC', 'confirmed', '2026-08-13T12:00:00Z', '2026-08-17T04:00:00Z', 'gold'),
  row('b5', 'APAC', 'confirmed', '2026-08-10T03:30:00Z', '2026-08-10T12:30:00Z', 'bronze'),
  row('b6', 'APAC', 'new', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b7', 'APAC', 'cancelled', '2026-08-12T04:30:00Z', null, 'silver'),
  row('b8', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T06:10:00Z', 'gold'),
  row('b9', 'EMEA', 'confirmed', '2026-08-10T04:30:00Z', '2026-08-10T09:30:00Z', 'gold'),
  row('b10', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', null, 'gold'),
  row('b11', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:30:00Z', 'gold'),
  row('b12', 'APAC', 'confirmed', '2026-08-12T03:30:00Z', '2026-08-12T07:20:00Z', 'silver'),
  row('b13', 'APAC', 'confirmed', '2026-08-12T04:30:00Z', '2026-08-12T06:00:00Z', 'gold'),
];

const DDL = `CREATE TABLE workEvents (
  id TEXT PRIMARY KEY,
  region TEXT,
  status TEXT NOT NULL,
  created_at TEXT,
  confirmed_at TEXT,
  customer_tier TEXT,
  teu REAL
);`;

async function seed(client: SqliteSqlClient): Promise<void> {
  client.exec(DDL);
  for (const r of WORK_EVENTS) {
    await client.execute(
      'INSERT INTO workEvents (id, region, status, created_at, confirmed_at, customer_tier, teu) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.region, r.status, r.createdAt, r.confirmedAt, r.customerTier, 1],
    );
  }
}

/** Capture every read the engine issues — proves projection + parameterization. */
class SpyClient implements SqlClient {
  readonly queries: Array<{ text: string; params: unknown[] }> = [];
  constructor(private readonly inner: SqliteSqlClient) {}
  async query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }> {
    this.queries.push({ text, params: [...params] });
    return this.inner.query(text, params);
  }
  async execute(text: string, params: unknown[]): Promise<{ rowCount: number }> {
    return this.inner.execute(text, params);
  }
  async close(): Promise<void> {
    await this.inner.close();
  }
}

const AT = '2026-08-12T05:00:00Z'; // Wed of ISO week 33; window [08-09T18:30Z, 08-16T18:30Z)

describe('calculateMetric over a real SQLite workEvents table', () => {
  let dir: string;
  let spy: SpyClient;
  let connections: ConnectionRegistry;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'malkom-metrics-m3-'));
    const client = new SqliteSqlClient(join(dir, 'host.db'));
    await seed(client);
    spy = new SpyClient(client);
    connections = new ConnectionRegistry();
    connections.registerClient('ops', 'sqlite', spy);
  });

  afterAll(async () => {
    await connections.closeAll();
    // Ownership: closeAll() releases but never closes HOST-registered clients
    // (registerClient) — closing this one is the fixture's job now.
    await spy.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('pins numerator/denominator/value/status for Booking-TAT (APAC, week 33)', async () => {
    const result = await calculateMetric({
      definition: metricDefinitionSchema.parse(BOOKING_TAT),
      registry: REGISTRY,
      calendars: [CALENDAR],
      facts: { connections },
      scope: { region: 'APAC' },
      at: AT,
    });
    // Anchor pushdown: APAC rows confirmed inside the week = b1,b2,b3,b5,b11,
    // b12,b13 (7 fetched; b4 confirmed AFTER the window, b6/b7/b10 have no
    // confirmation instant so belong to no window). Bronze b5 excluded → 6.
    // Numerator tat<=240: b1(120), b3(120), b11(240), b12(230), b13(90) = 5.
    expect(result.numerator).toBe(5);
    expect(result.denominator).toBe(6);
    expect(result.value).toBeCloseTo(500 / 6, 10);
    expect(result.status).toBe('breach'); // 83.3 < breach threshold 88
    expect(result.window.key).toBe('week:2026-W33');
    expect(result.window.startIso).toBe('2026-08-09T18:30:00.000Z');
    expect(result.window.endIso).toBe('2026-08-16T18:30:00.000Z');
    expect(result.trace.factsIn).toBe(7);
    expect(result.trace.excluded).toEqual({ 'bronze-migration': 1 });
    expect(result.trace.anchor).toEqual({ kind: 'event', field: 'confirmedAt' });
    expect(result.trace.fetch).toEqual({ mode: 'sql', perSource: [{ entity: 'booking', rows: 7, limited: false }] });
    expect(result.trace.evaluatedAt).toBe(AT);
  });

  it('issues ONE parameterized SELECT with the minimal projection', async () => {
    const before = spy.queries.length;
    await calculateMetric({
      definition: metricDefinitionSchema.parse(BOOKING_TAT),
      registry: REGISTRY,
      calendars: [CALENDAR],
      facts: { connections },
      scope: { region: 'APAC' },
      at: AT,
    });
    expect(spy.queries.length).toBe(before + 1);
    const { text, params } = spy.queries.at(-1)!;

    // Projection: only the referenced fields, renamed columns aliased back to
    // field ids, sorted — and NOTHING else (no teu, no id, no SELECT *).
    expect(text).toBe(
      'SELECT "confirmed_at" AS "confirmedAt", "created_at" AS "createdAt", "customer_tier" AS "customerTier", ' +
        '"region" AS "region", "status" AS "status" FROM "workEvents" ' +
        'WHERE "region" = ? AND "confirmed_at" >= ? AND "confirmed_at" < ? LIMIT ?',
    );
    expect(text).not.toContain('teu');
    expect(text).not.toContain('*');

    // Parameterized: no literal values in the SQL text; params in text order.
    expect(text).not.toContain('APAC');
    expect(text).not.toContain('2026-');
    expect(params).toEqual(['APAC', '2026-08-09T18:30:00.000Z', '2026-08-16T18:30:00.000Z', 100_001]);
  });

  it('param-order regression: params bind in text order — reordering them changes the rows', async () => {
    const q: FactQuery = {
      entity: 'booking',
      fields: ['confirmedAt', 'customerTier', 'region'],
      scope: { region: 'APAC', customerTier: 'gold' },
      anchor: { field: 'confirmedAt', startIso: '2026-08-01T00:00:00.000Z', endIso: '2026-09-01T00:00:00.000Z' },
      limit: 100,
    };
    const { text, params } = buildFactSelect(q, REGISTRY, sqliteDialect);
    // Scope keys are emitted sorted (customerTier before region); every
    // placeholder's value sits at the placeholder's position.
    expect(params).toEqual(['gold', 'APAC', '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', 100]);
    expect((text.match(/\?/g) ?? []).length).toBe(params.length);

    // Gold APAC bookings confirmed in August: b1, b2, b4, b11, b13.
    const { rows } = await spy.query(text, params);
    expect(rows).toHaveLength(5);
    // The alloc-engine bug: same SQL, params out of order → wrong result.
    const swapped = [params[1], params[0], ...params.slice(2)];
    const { rows: none } = await spy.query(text, swapped);
    expect(none).toHaveLength(0);
  });

  it('throws (never truncates) when a fetch exceeds maxFactRows', async () => {
    let thrown: unknown;
    try {
      await calculateMetric({
        definition: metricDefinitionSchema.parse(BOOKING_TAT),
        registry: REGISTRY,
        calendars: [CALENDAR],
        defaults: { maxFactRows: 5 }, // 7 in-window APAC rows > 5
        facts: { connections },
        scope: { region: 'APAC' },
        at: AT,
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MalkomError);
    expect((thrown as MalkomError).code).toBe('UNSUPPORTED');
    expect((thrown as MalkomError).message).toContain('maxFactRows');
    expect((thrown as MalkomError).message).toContain('narrow the scope or window');
    // The fetch asks for limit+1, so the sentinel row is visible in the SQL.
    expect(spy.queries.at(-1)!.params.at(-1)).toBe(6);

    // Exactly at the limit is fine — the cap rejects overflow, not fullness.
    const ok = await calculateMetric({
      definition: metricDefinitionSchema.parse(BOOKING_TAT),
      registry: REGISTRY,
      calendars: [CALENDAR],
      defaults: { maxFactRows: 7 },
      facts: { connections },
      scope: { region: 'APAC' },
      at: AT,
    });
    expect(ok.denominator).toBe(6);
  });

  it('parity: the SQL path and MemoryFactSource produce identical results', async () => {
    const shared = {
      definition: metricDefinitionSchema.parse(BOOKING_TAT),
      registry: REGISTRY,
      calendars: [CALENDAR],
      scope: { region: 'APAC' },
      at: AT,
    };
    const viaSql = await calculateMetric({ ...shared, facts: { connections } });
    const viaPort = await calculateMetric({ ...shared, facts: { source: new MemoryFactSource(WORK_EVENTS) } });

    const { fetch: sqlFetch, ...sqlTrace } = viaSql.trace;
    const { fetch: portFetch, ...portTrace } = viaPort.trace;
    expect({ ...viaSql, trace: sqlTrace }).toEqual({ ...viaPort, trace: portTrace });
    expect(sqlFetch?.mode).toBe('sql');
    expect(portFetch?.mode).toBe('port');
    expect(sqlFetch?.perSource).toEqual(portFetch?.perSource); // same pushdown, same row counts
  });

  it('snapshot anchors fetch as-of-now regardless of the window', async () => {
    const backlogAge: MetricDefinitionInput = {
      name: 'open-backlog-age',
      kind: 'kpi',
      metricType: 'duration',
      scope: { dimensions: [] },
      window: { kind: 'periodic', grain: 'day' },
      anchor: { kind: 'snapshot' }, // point-in-time: the window only labels the point
      target: { value: 600, direction: 'lower_is_better' },
      calendarRef: 'india-ops',
      derive: { ageMins: { fn: 'ageBusinessMinutes', args: ['createdAt'] } },
      formula: {
        kind: 'aggregate',
        over: { agg: 'avg', source: 'booking', field: 'ageMins', where: { op: 'eq', field: 'status', value: 'new' } },
      },
    };
    const result = await calculateMetric({
      definition: metricDefinitionSchema.parse(backlogAge),
      registry: REGISTRY,
      calendars: [CALENDAR],
      facts: { connections },
      at: '2026-08-12T06:30:00Z', // Wed 12:00 IST
    });
    // b6 is the only open booking: created Wed 10:00 IST → 120 business minutes old.
    expect(result.value).toBe(120);
    expect(result.status).toBe('attained');
    expect(result.trace.anchor).toEqual({ kind: 'snapshot' });
    // The WHOLE table is fetched — no anchor range in the SQL, all 13 rows in.
    expect(result.trace.fetch?.perSource).toEqual([{ entity: 'booking', rows: 13, limited: false }]);
    const { text } = spy.queries.at(-1)!;
    expect(text).not.toContain('>=');
    expect(text).not.toContain('confirmed_at');
    expect(text).toBe('SELECT "created_at" AS "createdAt", "status" AS "status" FROM "workEvents" LIMIT ?');
  });

  it('uses the assignment scope and its targetOverride', async () => {
    const assignment = assignmentSchema.parse({
      metric: 'booking-tat-sla',
      scope: { region: 'EMEA' },
      targetOverride: { value: 40 },
    });
    const result = await calculateMetric({
      definition: metricDefinitionSchema.parse(BOOKING_TAT),
      registry: REGISTRY,
      calendars: [CALENDAR],
      facts: { connections },
      at: AT,
      assignment,
    });
    // EMEA in-window: b8 (100 min, in SLA), b9 (300 min, over) → 1/2 = 50%.
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(2);
    expect(result.value).toBe(50);
    expect(result.target).toEqual({ value: 40, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } });
    expect(result.status).toBe('attained'); // 50 >= overridden 40
  });
});

describe('multi-source ratios fetch numerator and denominator independently', () => {
  const MULTI_REGISTRY = new CompiledRegistry(
    registryDocSchema.parse({
      entities: [
        {
          id: 'task',
          fields: [
            { id: 'eventAt', type: 'date' },
            { id: 'state', type: 'string' },
          ],
        },
        { id: 'booking', fields: [{ id: 'eventAt', type: 'date' }] },
      ],
    }),
    1,
  );

  const CROSS_RATIO: MetricDefinitionInput = {
    name: 'done-tasks-per-booking',
    kind: 'kpi',
    metricType: 'ratio',
    scope: { dimensions: [] },
    window: { kind: 'periodic', grain: 'day' },
    anchor: { kind: 'event', field: 'eventAt' }, // exists on BOTH sources (tier-1 enforced)
    target: { value: 1, direction: 'higher_is_better' },
    formula: {
      kind: 'ratio',
      numerator: { agg: 'count', source: 'task', where: { op: 'eq', field: 'state', value: 'done' } },
      denominator: { agg: 'count', source: 'booking' },
    },
  };

  it('fetches per source, evaluates per role, and traces both fetches', async () => {
    const source = new MemoryFactSource({
      task: [
        { eventAt: '2026-08-12T01:00:00Z', state: 'done' },
        { eventAt: '2026-08-12T02:00:00Z', state: 'done' },
        { eventAt: '2026-08-12T03:00:00Z', state: 'open' },
        { eventAt: '2026-08-11T01:00:00Z', state: 'done' }, // outside the day window
      ],
      booking: [
        { eventAt: '2026-08-12T04:00:00Z' },
        { eventAt: '2026-08-12T05:00:00Z' },
        { eventAt: '2026-08-12T06:00:00Z' },
        { eventAt: '2026-08-12T07:00:00Z' },
        { eventAt: '2026-08-13T00:00:00Z' }, // exactly at the window end — out
      ],
    });
    const result = await calculateMetric({
      definition: metricDefinitionSchema.parse(CROSS_RATIO),
      registry: MULTI_REGISTRY,
      facts: { source },
      at: '2026-08-12T05:00:00Z', // UTC day window [08-12T00:00Z, 08-13T00:00Z)
    });
    expect(result.numerator).toBe(2);
    expect(result.denominator).toBe(4);
    expect(result.value).toBe(0.5);
    expect(result.trace.factsIn).toBe(7); // 3 task rows + 4 booking rows
    expect(result.trace.fetch).toEqual({
      mode: 'port',
      perSource: [
        { entity: 'task', rows: 3, limited: false },
        { entity: 'booking', rows: 4, limited: false },
      ],
    });
  });
});

describe('tier-2 live validation (validateMetricLive)', () => {
  function liveAccess(client: SqlClient): Record<string, LiveSchemaAccess> {
    return { ops: { client, introspector: dialectIntrospector(sqliteDialect) } };
  }

  it('a fully-bound, in-sync definition has no live issues', async () => {
    const client = new SqliteSqlClient(':memory:');
    try {
      client.exec(DDL);
      const issues = await validateMetricLive(metricDefinitionSchema.parse(BOOKING_TAT), REGISTRY, liveAccess(client));
      expect(issues).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('a dropped column surfaces as missing_column with the exact field path', async () => {
    const client = new SqliteSqlClient(':memory:');
    try {
      client.exec(DDL);
      client.exec('ALTER TABLE workEvents DROP COLUMN customer_tier;');
      const issues = await validateMetricLive(metricDefinitionSchema.parse(BOOKING_TAT), REGISTRY, liveAccess(client));
      expect(issues).toEqual([
        {
          path: 'exclusions[0].when.field',
          code: 'missing_column',
          message:
            'column "customer_tier" (field "customerTier" of entity "booking") is missing from table "workEvents" on connection "ops"',
        },
      ]);
    } finally {
      await client.close();
    }
  });

  it('a wrong table surfaces as missing_table on every formula source', async () => {
    const ghostRegistry = new CompiledRegistry(
      registryDocSchema.parse({
        ...structuredClone(REGISTRY_INPUT),
        entities: [{ ...structuredClone(REGISTRY_INPUT.entities![0]!), table: { name: 'ghostEvents' } }],
      }),
      2,
    );
    const client = new SqliteSqlClient(':memory:');
    try {
      client.exec(DDL); // the REAL table exists; the binding points elsewhere
      const issues = await validateMetricLive(metricDefinitionSchema.parse(BOOKING_TAT), ghostRegistry, liveAccess(client));
      const codes = issues.map(({ path, code }) => ({ path, code }));
      expect(codes).toContainEqual({ path: 'formula.numerator.source', code: 'missing_table' });
      expect(codes).toContainEqual({ path: 'formula.denominator.source', code: 'missing_table' });
      expect(issues.every((i) => i.code === 'missing_table')).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('library-mode entities (no table/connection binding) have nothing to check', async () => {
    const unbound = new CompiledRegistry(
      registryDocSchema.parse({
        ...structuredClone(REGISTRY_INPUT),
        entities: [
          (() => {
            const e = structuredClone(REGISTRY_INPUT.entities![0]!);
            delete (e as Record<string, unknown>)['table'];
            delete (e as Record<string, unknown>)['connectionRef'];
            return e;
          })(),
        ],
      }),
      3,
    );
    const issues = await validateMetricLive(metricDefinitionSchema.parse(BOOKING_TAT), unbound, {});
    expect(issues).toEqual([]);
  });

  it('a bound connection without provided access is caller plumbing — throws', async () => {
    await expect(validateMetricLive(metricDefinitionSchema.parse(BOOKING_TAT), REGISTRY, {})).rejects.toThrowError(
      ConfigInvalidError,
    );
  });
});

describe('backtestMetric', () => {
  const source = new MemoryFactSource(WORK_EVENTS);

  it('periodic days: 5 consecutive results incl. a holiday and no_data days — no gaps', async () => {
    const daily: MetricDefinitionInput = {
      ...structuredClone(BOOKING_TAT),
      name: 'booking-tat-daily',
      window: { kind: 'periodic', grain: 'day' },
    };
    const results = await backtestMetric({
      definition: metricDefinitionSchema.parse(daily),
      registry: REGISTRY,
      calendars: [CALENDAR],
      facts: { source },
      range: { fromIso: '2026-08-10T00:00:00Z', toIso: '2026-08-14T18:30:00Z' },
    });

    expect(results.map((r) => r.window.key)).toEqual([
      'day:2026-08-10',
      'day:2026-08-11',
      'day:2026-08-12',
      'day:2026-08-13',
      'day:2026-08-14', // the holiday still yields a result, not a gap
    ]);
    // 08-10: b1,b2,b8,b9 confirmed (b5 bronze excluded) → 2/4 in SLA = 50.
    // 08-11: nothing confirmed → no_data. 08-12: b3,b11,b12,b13 → 4/4 = 100.
    // 08-13 and the 08-14 holiday: nothing confirmed → no_data.
    expect(results.map((r) => r.value)).toEqual([50, null, 100, null, null]);
    expect(results.map((r) => r.status)).toEqual(['breach', 'no_data', 'attained', 'no_data', 'no_data']);
    // Every point evaluates AS OF its window end.
    for (const r of results) expect(r.trace.evaluatedAt).toBe(r.window.endIso);
  });

  const rolling: MetricDefinitionInput = {
    name: 'bookings-7d',
    kind: 'kpi',
    metricType: 'count',
    scope: { dimensions: [] },
    window: { kind: 'rolling', length: 7, unit: 'day' },
    anchor: { kind: 'event', field: 'createdAt' },
    target: { value: 1, direction: 'higher_is_better' },
    formula: { kind: 'aggregate', over: { agg: 'count', source: 'booking' } },
  };

  it('rolling windows step their end daily by default', async () => {
    const results = await backtestMetric({
      definition: metricDefinitionSchema.parse(rolling),
      registry: REGISTRY,
      facts: { source },
      range: { fromIso: '2026-08-12T00:00:00Z', toIso: '2026-08-15T00:00:00Z' },
    });
    expect(results.map((r) => r.window.key)).toEqual([
      'rolling-7d:2026-08-12T00:00:00Z',
      'rolling-7d:2026-08-13T00:00:00Z',
      'rolling-7d:2026-08-14T00:00:00Z',
    ]);
    expect(results.map((r) => r.value)).toEqual([6, 12, 13]);
  });

  it('EngineDefaults.backtestStep widens the stepping', async () => {
    const results = await backtestMetric({
      definition: metricDefinitionSchema.parse(rolling),
      registry: REGISTRY,
      defaults: { backtestStep: 2 },
      facts: { source },
      range: { fromIso: '2026-08-12T00:00:00Z', toIso: '2026-08-15T00:00:00Z' },
    });
    expect(results.map((r) => r.window.key)).toEqual([
      'rolling-7d:2026-08-12T00:00:00Z',
      'rolling-7d:2026-08-14T00:00:00Z',
    ]);
    expect(results.map((r) => r.value)).toEqual([6, 13]);
  });

  it('rejects inverted or unparseable ranges', async () => {
    const definition = metricDefinitionSchema.parse(rolling);
    await expect(
      backtestMetric({
        definition,
        registry: REGISTRY,
        facts: { source },
        range: { fromIso: '2026-08-15T00:00:00Z', toIso: '2026-08-12T00:00:00Z' },
      }),
    ).rejects.toThrowError(ConfigInvalidError);
    await expect(
      backtestMetric({
        definition,
        registry: REGISTRY,
        facts: { source },
        range: { fromIso: 'not-a-time', toIso: '2026-08-12T00:00:00Z' },
      }),
    ).rejects.toThrowError(ConfigInvalidError);
  });
});
