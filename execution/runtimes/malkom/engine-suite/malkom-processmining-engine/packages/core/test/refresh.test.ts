import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sourceBindingSchema, streamDefinitionSchema } from '../src/config/schemas.js';
import { FixedClock } from '../src/ports/clock.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { fromQueryFunction, hostRequirements } from '../src/sql/host-adapters.js';
import { previewRefresh, refreshStream } from '../src/runtime/refresh.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { mineProcessTree, treeToString } from '../src/runtime/inductive.js';
import { availableObjectTypes, eventLogTables } from '../src/runtime/eventlog.js';
import { execAll, openMemoryDuckDB } from './helpers/duckdb.js';

/**
 * Reading from a host database into a persisted stream, and doing it again
 * without re-reading what is already there.
 *
 * The "host" here is a second, separate DuckDB standing in for whatever the
 * host actually runs. That is the point: the engine talks to it through the
 * same SqlClient port a Prisma client or a pg Pool arrives through, so the
 * test exercises the real code path rather than a special one.
 */

const HOST_DDL = [
  `CREATE TABLE "ticket_events" (
     "row_id"     INTEGER PRIMARY KEY,
     "ticket_ref" VARCHAR,
     "step"       VARCHAR,
     "agent"      VARCHAR,
     "opened_at"  TIMESTAMPTZ,
     "closed_at"  TIMESTAMPTZ,
     "handle_s"   DOUBLE
   )`,
];

/** Three tickets, each running Triage -> Diagnose -> Resolve, over three months. */
function hostRows(): string[] {
  const rows: string[] = [];
  let id = 0;
  const months = ['2026-01', '2026-02', '2026-03'];
  months.forEach((month, m) => {
    for (let t = 1; t <= 3; t += 1) {
      const ref = `TK-${month}-${t}`;
      ['Triage', 'Diagnose', 'Resolve'].forEach((step, s) => {
        id += 1;
        const day = String(t * 3 + s).padStart(2, '0');
        rows.push(
          `INSERT INTO "ticket_events" VALUES (${id}, '${ref}', '${step}', 'agent${(m + s) % 2}', ` +
            `'${month}-${day}T09:00:00Z', '${month}-${day}T09:30:00Z', 1800)`,
        );
      });
    }
  });
  return rows;
}

const BINDING = sourceBindingSchema.parse({
  id: 'tickets',
  connectionRef: 'host',
  from: { name: 'ticket_events' },
  grain: 'interval',
  roles: {
    activity: 'step',
    resource: 'agent',
    start: 'opened_at',
    end: 'closed_at',
    duration: 'handle_s',
  },
  objects: [{ type: 'ticket', column: 'ticket_ref' }],
});

const STREAM = streamDefinitionSchema.parse({
  id: 'support',
  defaultCaseObject: 'ticket',
  bindings: [BINDING],
});

function window(from: string, to: string) {
  return { from: new Date(from), to: new Date(to) };
}

describe('reading from a host database', () => {
  let host: SqlClient;
  let store: SqlClient;
  const clock = new FixedClock('2026-04-01T00:00:00Z');

  beforeEach(async () => {
    host = await openMemoryDuckDB();
    await execAll(host, [...HOST_DDL, ...hostRows()]);
    store = await openMemoryDuckDB();
  });

  afterEach(async () => {
    await host.close();
    await store.close();
  });

  const base = () => ({
    hostClient: host,
    hostDialect: duckdbDialect,
    storeClient: store,
    storeDialect: duckdbDialect,
    stream: STREAM,
    clock,
  });

  it('pulls rows into the store and unpivots intervals into events', async () => {
    const result = await refreshStream(base());

    expect(result.rowsRead).toBe(27); // 3 months x 3 tickets x 3 steps
    expect(result.eventsWritten).toBe(54); // interval grain: two events per row
    expect(result.coverage.eventCount).toBe(54);
    expect(result.coverage.caseCount).toBe(9);
    expect(result.coverage.lastRefreshedAt?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('produces a log that mines to the real process', async () => {
    await refreshStream(base());

    const dfg = await buildDfg(store, duckdbDialect, { objectType: 'ticket', lifecycle: ['complete'] });
    expect(dfg.caseCount).toBe(9);
    expect(treeToString(mineProcessTree(dfg).tree)).toBe("->( 'Triage', 'Diagnose', 'Resolve' )");
  });

  it('registers the object type declared in the binding', async () => {
    await refreshStream(base());
    const types = await availableObjectTypes(store, duckdbDialect);
    expect(types).toEqual([{ objectType: 'ticket', events: 54, objects: 9 }]);
  });

  it('records handling time once per unit of work, not once per end of it', async () => {
    await refreshStream(base());
    const tables = eventLogTables(duckdbDialect);
    const { rows } = await store.query(
      `SELECT SUM(duration_s) AS total, COUNT(duration_s) AS n FROM ${tables.events}`,
      [],
    );
    // 27 source rows at 1800s. Stamping it on both the start and the complete
    // would double every duration that is later summed.
    expect(Number(rows[0]?.['n'])).toBe(27);
    expect(Number(rows[0]?.['total'])).toBe(27 * 1800);
  });

  it('carries the resource through for the organizational perspective', async () => {
    await refreshStream(base());
    const tables = eventLogTables(duckdbDialect);
    const { rows } = await store.query(
      `SELECT COUNT(DISTINCT resource) AS n FROM ${tables.events}`,
      [],
    );
    expect(Number(rows[0]?.['n'])).toBe(2);
  });
});

describe('a second refresh only fetches what is missing', () => {
  let host: SqlClient;
  let store: SqlClient;
  const clock = new FixedClock('2026-04-01T00:00:00Z');

  beforeEach(async () => {
    host = await openMemoryDuckDB();
    await execAll(host, [...HOST_DDL, ...hostRows()]);
    store = await openMemoryDuckDB();
  });

  afterEach(async () => {
    await host.close();
    await store.close();
  });

  const base = () => ({
    hostClient: host,
    hostDialect: duckdbDialect,
    storeClient: store,
    storeDialect: duckdbDialect,
    stream: STREAM,
    clock,
  });

  it('asks the host for nothing when the request is already covered', async () => {
    const first = await refreshStream({ ...base(), window: window('2026-01-01', '2026-04-01') });
    expect(first.queries).toBeGreaterThan(0);

    // A narrower request inside what is already materialised.
    const second = await refreshStream({
      ...base(),
      window: window('2026-02-01', '2026-03-01'),
      coverage: first.coverage,
    });
    expect(second.plan.kind).toBe('hit');
    expect(second.queries).toBe(0);
    expect(second.fetched).toEqual([]);
    expect(second.eventsWritten).toBe(0);
  });

  it('fetches forward only, when asked for newer data', async () => {
    const first = await refreshStream({ ...base(), window: window('2026-01-01', '2026-02-01') });
    expect(first.eventsWritten).toBe(18); // January only

    const second = await refreshStream({
      ...base(),
      window: window('2026-01-01', '2026-04-01'),
      coverage: first.coverage,
    });
    expect(second.plan.kind).toBe('partial');
    // Only the uncovered tail was fetched.
    expect(second.fetched.map((w) => w.from.toISOString())).toEqual(['2026-02-01T00:00:00.000Z']);
    expect(second.eventsWritten).toBe(36); // February and March
    expect(second.coverage.eventCount).toBe(54);
  });

  it('fetches backward when asked for older data than it holds', async () => {
    // The case a newest-timestamp watermark alone cannot serve.
    const first = await refreshStream({ ...base(), window: window('2026-03-01', '2026-04-01') });
    expect(first.eventsWritten).toBe(18); // March only

    const second = await refreshStream({
      ...base(),
      window: window('2026-01-01', '2026-04-01'),
      coverage: first.coverage,
    });
    expect(second.fetched.map((w) => w.to.toISOString())).toEqual(['2026-03-01T00:00:00.000Z']);
    expect(second.eventsWritten).toBe(36); // January and February
    expect(second.coverage.eventCount).toBe(54);
  });

  it('records a watermark so the next incremental fetch has a starting point', async () => {
    const result = await refreshStream(base());
    expect(result.coverage.sourceWatermark).toBeDefined();
    expect(result.coverage.sourceWatermark!.getTime()).toBeGreaterThan(
      new Date('2026-03-01').getTime(),
    );
  });

  it('rebuilds from scratch when the definition changes', async () => {
    const first = await refreshStream(base());
    expect(first.rebuilt).toBe(false);

    // Remapping the activity changes what the stored rows MEAN.
    const remapped = streamDefinitionSchema.parse({
      ...STREAM,
      bindings: [{ ...BINDING, roles: { ...BINDING.roles, activity: 'agent' } }],
    });
    const second = await refreshStream({ ...base(), stream: remapped, coverage: first.coverage });

    expect(second.rebuilt).toBe(true);
    expect(second.plan.kind).toBe('rebuild');
    expect(second.coverage.eventCount).toBe(54); // rebuilt, not doubled
  });

  it('replaces a window rather than duplicating it on re-fetch', async () => {
    const first = await refreshStream({ ...base(), window: window('2026-01-01', '2026-02-01') });
    // Force a re-fetch of the same window by discarding coverage.
    const again = await refreshStream({ ...base(), window: window('2026-01-01', '2026-02-01') });

    expect(again.eventsWritten).toBe(18);
    const tables = eventLogTables(duckdbDialect);
    const { rows } = await store.query(`SELECT COUNT(*) AS n FROM ${tables.events}`, []);
    // 18, not 36 — the window was deleted before being rewritten.
    expect(Number(rows[0]?.['n'])).toBe(18);
    expect(first.eventsWritten).toBe(18);
  });

  it('subdivides a slice that exceeds the row limit', async () => {
    const result = await refreshStream({ ...base(), sliceRowLimit: 4 });
    // Every row still arrives; the window was just halved until each fit.
    expect(result.rowsRead).toBe(27);
    expect(result.eventsWritten).toBe(54);
    expect(result.queries).toBeGreaterThan(1);
  });
});

describe('cost preview', () => {
  let host: SqlClient;
  let store: SqlClient;

  beforeEach(async () => {
    host = await openMemoryDuckDB();
    await execAll(host, [...HOST_DDL, ...hostRows()]);
    store = await openMemoryDuckDB();
  });

  afterEach(async () => {
    await host.close();
    await store.close();
  });

  it('reports the size of a refresh before running it', async () => {
    const preview = await previewRefresh({
      hostClient: host,
      hostDialect: duckdbDialect,
      storeClient: store,
      storeDialect: duckdbDialect,
      stream: STREAM,
    });
    expect(preview.rowsToFetch).toBe(27);
    expect(preview.eventsToWrite).toBe(54);
    expect(preview.perBinding).toEqual([{ bindingId: 'tickets', rows: 27, events: 54 }]);
  });

  it('reports zero once the data is already materialised', async () => {
    const done = await refreshStream({
      hostClient: host,
      hostDialect: duckdbDialect,
      storeClient: store,
      storeDialect: duckdbDialect,
      stream: STREAM,
      window: window('2026-01-01', '2026-04-01'),
    });
    const preview = await previewRefresh({
      hostClient: host,
      hostDialect: duckdbDialect,
      storeClient: store,
      storeDialect: duckdbDialect,
      stream: STREAM,
      window: window('2026-02-01', '2026-03-01'),
      coverage: done.coverage,
    });
    expect(preview.rowsToFetch).toBe(0);
    expect(preview.plan.kind).toBe('hit');
  });
});

describe('the host supplies the connection, not credentials', () => {
  let host: SqlClient;
  let store: SqlClient;

  beforeEach(async () => {
    host = await openMemoryDuckDB();
    await execAll(host, [...HOST_DDL, ...hostRows()]);
    store = await openMemoryDuckDB();
  });

  afterEach(async () => {
    await host.close();
    await store.close();
  });

  it('works through an arbitrary host query function', async () => {
    // Stands in for a Prisma client, a pg Pool, or anything else the host
    // already authenticates. The engine never sees a credential.
    let callCount = 0;
    const borrowed = fromQueryFunction(async (text, params) => {
      callCount += 1;
      const { rows } = await host.query(text, params);
      return rows;
    });

    const result = await refreshStream({
      hostClient: borrowed,
      hostDialect: duckdbDialect,
      storeClient: store,
      storeDialect: duckdbDialect,
      stream: STREAM,
    });

    expect(callCount).toBeGreaterThan(0);
    expect(result.eventsWritten).toBe(54);
  });

  it('never closes a connection the host owns', async () => {
    let closed = false;
    const borrowed = fromQueryFunction(async (text, params) => {
      const { rows } = await host.query(text, params);
      return rows;
    });
    // The adapter's close is a deliberate no-op.
    await borrowed.close();
    expect(closed).toBe(false);
    const { rows } = await borrowed.query('SELECT 1 AS ok', []);
    expect(rows).toEqual([{ ok: 1 }]);
  });
});

describe('the input contract is discoverable', () => {
  it('states what the host must supply, and why', () => {
    const requirements = hostRequirements();
    const keys = requirements.map((r) => r.key);

    expect(keys).toContain('connection');
    expect(keys).toContain('from');
    expect(keys).toContain('grain');
    expect(keys).toContain('roles.case');

    const connection = requirements.find((r) => r.key === 'connection');
    expect(connection?.required).toBe(true);
    expect(connection?.why).toContain('never stores credentials');

    // Optional roles must be genuinely optional, and say what is lost.
    const resource = requirements.find((r) => r.key === 'roles.resource');
    expect(resource?.required).toBe(false);
    expect(resource?.why).toContain('organizational');
  });
});
