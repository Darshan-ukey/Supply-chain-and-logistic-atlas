/**
 * SQL-substrate hardening regressions (review wave 2):
 *  - the lazy pg pool ALWAYS carries an 'error' listener routed to the logger
 *    (an idle connection dropping must never crash the process);
 *  - the lazy-import catch translates ONLY "that package is not installed" —
 *    every other failure (including a transitive module-not-found inside the
 *    driver) surfaces verbatim;
 *  - introspection resolves tables exactly like the fetch path: sqlite honors
 *    the binding's schema (ATTACHed database), postgres defaults to
 *    current_schema() not 'public', mysql aliases data_type;
 *  - tier-2 flags clearly-numeric event-anchor columns (the ISO-8601-text
 *    pushdown contract) as the anchor_encoding_suspect ADVISORY;
 *  - ConnectionRegistry ownership: closeAll() never closes host-registered
 *    clients, and the lazy-init race cannot orphan a pool.
 */
import { describe, expect, it } from 'vitest';
import { metricDefinitionSchema, registryDocSchema, type MetricDefinitionInput, type RegistryDocInput } from '../src/config/schemas.js';
import { validateMetricLive } from '../src/config/validate.js';
import { ConfigInvalidError } from '../src/domain/errors.js';
import { CompiledRegistry } from '../src/domain/registry.js';
import type { Logger } from '../src/ports/logger.js';
import { noopLogger } from '../src/ports/logger.js';
import type { SqlClient } from '../src/ports/sql.js';
import { createMysqlClient, createPostgresClient, SqliteSqlClient } from '../src/sql/clients.js';
import { ConnectionRegistry } from '../src/sql/connections.js';
import { mysqlDialect, postgresDialect, sqliteDialect } from '../src/sql/dialect.js';
import { dialectIntrospector } from '../src/sql/factfetch.js';
import { MetricsEngine } from '../src/engine.js';

// ---------------------------------------------------------------------------
// Shared fakes
// ---------------------------------------------------------------------------

class FakeClient implements SqlClient {
  closed = false;
  async query(): Promise<{ rows: Record<string, unknown>[] }> {
    return { rows: [] };
  }
  async execute(): Promise<{ rowCount: number }> {
    return { rowCount: 0 };
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

function capturingLogger(): { logger: Logger; errors: Array<Record<string, unknown>> } {
  const errors: Array<Record<string, unknown>> = [];
  return {
    errors,
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (fields, msg) => errors.push({ ...fields, msg }),
    },
  };
}

/** The exact module shape createPostgresClient consumes, instrumented. */
class FakePgPool {
  static instances: FakePgPool[] = [];
  readonly errorListeners: Array<(err: Error) => void> = [];
  constructor(readonly config: { connectionString: string; max: number }) {
    FakePgPool.instances.push(this);
  }
  on(event: string, listener: (err: Error) => void): this {
    if (event === 'error') this.errorListeners.push(listener);
    return this;
  }
  async query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> {
    return { rows: [{ text, params }], rowCount: 3 };
  }
  async end(): Promise<void> {}
}

function moduleNotFound(packageName: string): Error {
  return Object.assign(new Error(`Cannot find package '${packageName}' imported from /some/host/app.js`), {
    code: 'ERR_MODULE_NOT_FOUND',
  });
}

// ---------------------------------------------------------------------------
// pg pool 'error' listener + lazy-import error translation
// ---------------------------------------------------------------------------

describe('lazy driver clients (pg / mysql2)', () => {
  it("attaches a pool 'error' listener routed to the logger — an idle drop logs, never crashes", async () => {
    const { logger, errors } = capturingLogger();
    const client = await createPostgresClient('postgres://user@db/metrics', {
      poolMax: 7,
      logger,
      importModule: async () => ({ Pool: FakePgPool }),
    });
    const pool = FakePgPool.instances.at(-1)!;
    expect(pool.config).toEqual({ connectionString: 'postgres://user@db/metrics', max: 7 });

    // THE regression: exactly one 'error' listener, wired at construction.
    expect(pool.errorListeners).toHaveLength(1);
    pool.errorListeners[0]!(new Error('terminating connection due to administrator command'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      err: 'terminating connection due to administrator command',
      driver: 'pg',
    });

    // The SqlClient mapping still works over the fake pool.
    expect((await client.query('SELECT 1', [])).rows).toHaveLength(1);
    expect((await client.execute('UPDATE t SET x = 1', [])).rowCount).toBe(3);
    await client.close();
  });

  it("translates ONLY 'pg is not installed' into the npm-install hint", async () => {
    await expect(
      createPostgresClient('postgres://x', { importModule: async () => Promise.reject(moduleNotFound('pg')) }),
    ).rejects.toThrow(/npm install pg/);
  });

  it('surfaces every other import failure verbatim — never masked as "not installed"', async () => {
    // A real failure INSIDE the driver (native binding, syntax error, …).
    await expect(
      createPostgresClient('postgres://x', {
        importModule: async () => Promise.reject(new Error('pg native binding failed to initialize')),
      }),
    ).rejects.toThrow('pg native binding failed to initialize');

    // A TRANSITIVE module-not-found inside the driver names a different
    // package — that is a broken install, not "pg missing".
    let thrown: unknown;
    try {
      await createPostgresClient('postgres://x', {
        importModule: async () => Promise.reject(moduleNotFound('pg-connection-string')),
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('pg-connection-string');
    expect((thrown as Error).message).not.toContain('npm install');
  });

  it('mysql2: the not-installed hint is equally narrow', async () => {
    await expect(
      createMysqlClient('mysql://x', { importModule: async () => Promise.reject(moduleNotFound('mysql2')) }),
    ).rejects.toThrow(/npm install mysql2/);
    await expect(
      createMysqlClient('mysql://x', {
        importModule: async () => Promise.reject(new Error('mysql2 ABI mismatch')),
      }),
    ).rejects.toThrow('mysql2 ABI mismatch');
  });
});

// ---------------------------------------------------------------------------
// Introspection resolves tables like the fetch path does
// ---------------------------------------------------------------------------

describe('dialect introspection: schema resolution parity with the fetch path', () => {
  it('sqlite honors the bound schema (ATTACHed database) — same-named tables resolve correctly', async () => {
    const client = new SqliteSqlClient(':memory:');
    try {
      client.exec(`CREATE TABLE workEvents (confirmed_at TEXT, region TEXT);`);
      client.exec(`ATTACH DATABASE ':memory:' AS ops;`);
      client.exec(`CREATE TABLE ops.workEvents (confirmed_at INTEGER, other_col TEXT);`);

      const introspector = dialectIntrospector(sqliteDialect);
      // Bound schema: the ATTACHed table, NOT main's same-named one.
      const opsColumns = await introspector.tableColumns(client, 'ops', 'workEvents');
      expect(opsColumns.map((c) => c.name).sort()).toEqual(['confirmed_at', 'other_col']);
      expect(opsColumns.find((c) => c.name === 'confirmed_at')?.dataType).toBe('INTEGER');
      // No schema: main, exactly like an unqualified SELECT.
      const mainColumns = await introspector.tableColumns(client, undefined, 'workEvents');
      expect(mainColumns.map((c) => c.name).sort()).toEqual(['confirmed_at', 'region']);
    } finally {
      await client.close();
    }
  });

  it("postgres defaults to current_schema(), never a hardcoded 'public'", () => {
    const unbound = postgresDialect.columnsQuery(undefined, 'workEvents');
    expect(unbound.text).toContain('current_schema()');
    expect(unbound.text).not.toContain("'public'");
    expect(unbound.params).toEqual(['workEvents', null]);
    const bound = postgresDialect.columnsQuery('ops', 'workEvents');
    expect(bound.params).toEqual(['workEvents', 'ops']);
  });

  it('mysql aliases data_type — MySQL 8 returns unaliased names UPPERCASE', () => {
    const q = mysqlDialect.columnsQuery(undefined, 'workEvents');
    expect(q.text).toContain('data_type AS data_type');
    expect(q.text).toContain('column_name AS name');
  });
});

// ---------------------------------------------------------------------------
// Tier-2: schema-qualified bindings + the anchor-encoding advisory
// ---------------------------------------------------------------------------

const SCHEMA_REGISTRY_INPUT: RegistryDocInput = {
  entities: [
    {
      id: 'ev',
      table: { schema: 'ops', name: 'workEvents' },
      connectionRef: 'opsconn',
      fields: [
        { id: 'confirmedAt', type: 'date', column: 'confirmed_at' },
        { id: 'flag', type: 'string', column: 'other_col' },
      ],
    },
  ],
  valueSets: [],
};

const EV_COUNT: MetricDefinitionInput = {
  name: 'ev-count',
  kind: 'kpi',
  metricType: 'count',
  scope: { dimensions: [] },
  window: { kind: 'periodic', grain: 'day' },
  anchor: { kind: 'event', field: 'confirmedAt' },
  target: { value: 1, direction: 'higher_is_better' },
  formula: { kind: 'aggregate', over: { agg: 'count', source: 'ev', where: { op: 'isNotNull', field: 'flag' } } },
};

function attachedClient(): SqliteSqlClient {
  const client = new SqliteSqlClient(':memory:');
  // main has a same-named DECOY table missing other_col — the old
  // schema-blind pragma resolved THIS one and reported a phantom
  // missing_column.
  client.exec(`CREATE TABLE workEvents (confirmed_at TEXT, region TEXT);`);
  client.exec(`ATTACH DATABASE ':memory:' AS ops;`);
  client.exec(`CREATE TABLE ops.workEvents (confirmed_at INTEGER, other_col TEXT);`);
  return client;
}

describe('tier-2 live validation over schema-qualified bindings', () => {
  const registry = new CompiledRegistry(registryDocSchema.parse(SCHEMA_REGISTRY_INPUT), 1);
  const def = metricDefinitionSchema.parse(EV_COUNT);

  it('validates against the BOUND schema and flags the INTEGER anchor column as an advisory', async () => {
    const client = attachedClient();
    try {
      const issues = await validateMetricLive(def, registry, {
        opsconn: { client, introspector: dialectIntrospector(sqliteDialect) },
      });
      // No phantom missing_column (ops.workEvents HAS other_col) …
      expect(issues.filter((i) => i.code === 'missing_column')).toEqual([]);
      expect(issues.filter((i) => i.code === 'missing_table')).toEqual([]);
      // … and the epoch-INTEGER anchor is flagged, as a WARNING.
      const advisory = issues.find((i) => i.code === 'anchor_encoding_suspect');
      expect(advisory).toBeDefined();
      expect(advisory).toMatchObject({ path: 'anchor.field', severity: 'warning' });
      expect(advisory!.message).toContain('ISO-8601');
      expect(advisory!.message).toContain('"INTEGER"');
    } finally {
      await client.close();
    }
  });

  it('an ISO-text anchor column raises NO advisory', async () => {
    const textRegistry = new CompiledRegistry(
      registryDocSchema.parse({
        entities: [
          {
            id: 'ev',
            table: { name: 'workEvents' }, // main: confirmed_at TEXT
            connectionRef: 'opsconn',
            fields: [
              { id: 'confirmedAt', type: 'date', column: 'confirmed_at' },
              { id: 'flag', type: 'string', column: 'region' },
            ],
          },
        ],
        valueSets: [],
      } satisfies RegistryDocInput),
      1,
    );
    const client = attachedClient();
    try {
      const issues = await validateMetricLive(def, textRegistry, {
        opsconn: { client, introspector: dialectIntrospector(sqliteDialect) },
      });
      expect(issues).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it('the advisory informs the engine verdict without failing it (ok stays true)', async () => {
    const client = attachedClient();
    const connections = new ConnectionRegistry({ logger: noopLogger });
    connections.registerClient('opsconn', 'sqlite', client);
    const engine = new MetricsEngine({ connections, logger: noopLogger });
    try {
      await engine.start();
      await engine.applyRegistry(SCHEMA_REGISTRY_INPUT);
      await engine.createMetric(EV_COUNT, { actor: 'money' });
      const verdict = await engine.validateMetric('ev-count', { live: true });
      expect(verdict.schematic).toBe('ran');
      expect(verdict.issues.map((i) => i.code)).toContain('anchor_encoding_suspect');
      expect(verdict.ok).toBe(true); // advisory ≠ broken
    } finally {
      await engine.stop();
      await client.close(); // host-registered → the host closes it
    }
  });
});

// ---------------------------------------------------------------------------
// ConnectionRegistry: ownership + the lazy-init race
// ---------------------------------------------------------------------------

describe('ConnectionRegistry ownership and concurrency', () => {
  it('closeAll() never closes a HOST-registered client; a later resolve is a clear ConfigInvalidError', async () => {
    const registry = new ConnectionRegistry({ logger: noopLogger });
    const hostClient = new FakeClient();
    registry.registerClient('host', 'sqlite', hostClient);
    expect((await registry.resolve('host')).client).toBe(hostClient);

    await registry.closeAll();
    expect(hostClient.closed).toBe(false); // the host's to close, not ours

    // The entry is released — the failure mode is a CLEAR config error, not
    // the old TypeError on an undefined profile.
    let thrown: unknown;
    try {
      await registry.resolve('host');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ConfigInvalidError);
    expect((thrown as Error).message).toContain('"host"');
    expect((thrown as Error).message).toContain('register it again');
  });

  it('closeAll() DOES close registry-created (factory) clients', async () => {
    const registry = new ConnectionRegistry({ logger: noopLogger });
    const owned = new FakeClient();
    registry.registerFactory('own', 'sqlite', async () => owned);
    await registry.resolve('own');
    await registry.closeAll();
    expect(owned.closed).toBe(true);
    // The factory remains — the entry resolves again after closeAll.
    expect((await registry.resolve('own')).client).toBe(owned);
  });

  it('two concurrent first-touches share ONE creation — no orphaned pool', async () => {
    const registry = new ConnectionRegistry({ logger: noopLogger });
    let created = 0;
    registry.registerFactory('lazy', 'sqlite', async () => {
      created += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new FakeClient();
    });
    const [a, b] = await Promise.all([registry.resolve('lazy'), registry.resolve('lazy')]);
    expect(a.client).toBe(b.client);
    expect(created).toBe(1);
  });

  it('a failed creation clears the memo so the next resolve retries', async () => {
    const registry = new ConnectionRegistry({ logger: noopLogger });
    let attempts = 0;
    registry.registerFactory('flaky', 'sqlite', async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient DNS failure');
      return new FakeClient();
    });
    await expect(registry.resolve('flaky')).rejects.toThrow('transient DNS failure');
    const ok = await registry.resolve('flaky');
    expect(ok.dialect.name).toBe('sqlite');
    expect(attempts).toBe(2);
  });
});
