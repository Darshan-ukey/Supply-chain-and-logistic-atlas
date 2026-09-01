import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connectionProfileSchema } from '../src/config/connection.js';
import { ConfigInvalidError, NotFoundError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { createDuckDBClient, wrapDuckDBConnection } from '../src/sql/clients.js';
import { ConnectionRegistry } from '../src/sql/connections.js';
import { noopLogger } from '../src/ports/logger.js';

/**
 * Driver-level behaviour that the higher layers quietly depend on. Every test
 * here runs against a real DuckDB — the coercions being checked (bigint counts,
 * Date parameters, TIMESTAMPTZ round-trips) only exist because the real driver
 * behaves this way, and a stub would hide exactly that.
 */

describe('DuckDB client', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('round-trips a query and reports affected rows for writes', async () => {
    client = await createDuckDBClient(':memory:');
    await client.execute('CREATE TABLE t (a INTEGER, b VARCHAR)', []);
    const written = await client.execute("INSERT INTO t VALUES (1, 'x'), (2, 'y')", []);
    expect(written.rowCount).toBe(2);

    const { rows } = await client.query('SELECT a, b FROM t ORDER BY a', []);
    expect(rows).toEqual([
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ]);
  });

  it('returns COUNT(*) as a bigint, which is why countOf exists', async () => {
    client = await createDuckDBClient(':memory:');
    await client.execute('CREATE TABLE t (a INTEGER)', []);
    await client.execute('INSERT INTO t VALUES (1), (2), (3)', []);

    const { rows } = await client.query('SELECT COUNT(*) AS n FROM t', []);
    // Not a number. Arithmetic on this without coercion throws a TypeError.
    expect(typeof rows[0]?.['n']).toBe('bigint');
    expect(rows[0]?.['n']).toBe(3n);
  });

  it('binds positional parameters', async () => {
    client = await createDuckDBClient(':memory:');
    await client.execute('CREATE TABLE t (a INTEGER, b VARCHAR)', []);
    await client.execute('INSERT INTO t VALUES (1, \'keep\'), (2, \'drop\')', []);

    const { rows } = await client.query('SELECT b FROM t WHERE a = ?', [1]);
    expect(rows).toEqual([{ b: 'keep' }]);
  });

  it('converts a Date parameter to ISO text, since DuckDB will not bind a Date', async () => {
    client = await createDuckDBClient(':memory:');
    await client.execute('CREATE TABLE t (ts TIMESTAMPTZ)', []);
    await client.execute("INSERT INTO t VALUES ('2026-03-01T09:00:00Z'), ('2026-06-01T09:00:00Z')", []);

    const { rows } = await client.query(
      'SELECT COUNT(*) AS n FROM t WHERE ts >= CAST(? AS TIMESTAMPTZ)',
      [new Date('2026-04-01T00:00:00Z')],
    );
    expect(Number(rows[0]?.['n'])).toBe(1);
  });

  it('surfaces TIMESTAMPTZ as a JS Date', async () => {
    client = await createDuckDBClient(':memory:');
    await client.execute('CREATE TABLE t (ts TIMESTAMPTZ)', []);
    await client.execute("INSERT INTO t VALUES ('2026-03-01T09:00:00Z')", []);

    const { rows } = await client.query('SELECT ts FROM t', []);
    expect(rows[0]?.['ts']).toBeInstanceOf(Date);
    expect((rows[0]?.['ts'] as Date).toISOString()).toBe('2026-03-01T09:00:00.000Z');
  });

  it('maps undefined parameters to NULL rather than failing to bind', async () => {
    client = await createDuckDBClient(':memory:');
    const { rows } = await client.query('SELECT ? IS NULL AS is_null', [undefined]);
    expect(rows[0]?.['is_null']).toBe(true);
  });

  it('opens read-only so several processes can read one store', async () => {
    // DuckDB allows ONE writer per file. A reader that takes the write lock
    // blocks the API server, other CLI sessions and the refresh job from
    // opening the store at all — which is exactly what happened the first time
    // the server and the CLI were run together.
    const dir = await mkdtemp(join(tmpdir(), 'malkom-ro-'));
    const path = join(dir, 'store.duckdb');
    try {
      const writer = await createDuckDBClient(path);
      await writer.execute('CREATE TABLE t (a INTEGER)', []);
      await writer.execute('INSERT INTO t VALUES (1), (2)', []);
      await writer.close();

      // Two concurrent readers, which is impossible if either takes the lock.
      const first = await createDuckDBClient(path, { readOnly: true });
      const second = await createDuckDBClient(path, { readOnly: true });
      try {
        const a = await first.query('SELECT COUNT(*) AS n FROM t', []);
        const b = await second.query('SELECT COUNT(*) AS n FROM t', []);
        expect(Number(a.rows[0]?.['n'])).toBe(2);
        expect(Number(b.rows[0]?.['n'])).toBe(2);
      } finally {
        await first.close();
        await second.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a write on a read-only connection', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'malkom-ro2-'));
    const path = join(dir, 'store.duckdb');
    try {
      const writer = await createDuckDBClient(path);
      await writer.execute('CREATE TABLE t (a INTEGER)', []);
      await writer.close();

      const reader = await createDuckDBClient(path, { readOnly: true });
      try {
        await expect(reader.execute('INSERT INTO t VALUES (9)', [])).rejects.toThrow();
      } finally {
        await reader.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('tolerates being closed twice', async () => {
    client = await createDuckDBClient(':memory:');
    await client.close();
    await expect(client.close()).resolves.toBeUndefined();
  });
});

describe('bring-your-own DuckDB', () => {
  it('uses a host-supplied connection and leaves it open on close', async () => {
    // A host that already runs DuckDB hands the engine its live connection.
    const duckdb = await import('@duckdb/node-api');
    const instance = await duckdb.DuckDBInstance.create(':memory:');
    const connection = await instance.connect();

    let disconnected = false;
    const wrapped = wrapDuckDBConnection({
      run: (sql, values) => connection.run(sql, values as never),
      runAndReadAll: (sql, values) => connection.runAndReadAll(sql, values as never),
      disconnectSync: () => {
        disconnected = true;
      },
    });

    await wrapped.execute('CREATE TABLE t (a INTEGER)', []);
    await wrapped.execute('INSERT INTO t VALUES (7)', []);
    const { rows } = await wrapped.query('SELECT a FROM t', []);
    expect(rows).toEqual([{ a: 7 }]);

    await wrapped.close();
    expect(disconnected).toBe(true);

    // The host's own instance is untouched — the engine never closes what it
    // did not open.
    const second = await instance.connect();
    const check = await second.runAndReadAll('SELECT a FROM t');
    expect(check.getRowObjectsJS()).toEqual([{ a: 7 }]);
    second.disconnectSync();
    instance.closeSync();
  });
});

describe('ConnectionRegistry', () => {
  it('opens a duckdb profile from config.path', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({
          id: 'analytics',
          dialect: 'duckdb',
          config: { path: ':memory:' },
        }),
      ],
      logger: noopLogger,
    });

    const resolved = await registry.resolve('analytics');
    expect(resolved.dialect.name).toBe('duckdb');
    expect(resolved.owned).toBe(true);
    await registry.closeAll();
  });

  it('opens each profile at most once', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'a', dialect: 'duckdb', config: { path: ':memory:' } }),
      ],
      logger: noopLogger,
    });
    const [first, second] = await Promise.all([registry.resolve('a'), registry.resolve('a')]);
    expect(first).toBe(second); // concurrent resolves share one connect
    await registry.closeAll();
  });

  it('resolves a duckdb path from an environment variable', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'a', dialect: 'duckdb', env: 'MALKOM_TEST_DUCKDB' }),
      ],
      credentials: { env: { MALKOM_TEST_DUCKDB: ':memory:' } },
      logger: noopLogger,
    });
    await expect(registry.resolve('a')).resolves.toBeDefined();
    await registry.closeAll();
  });

  it('names the missing variable rather than failing opaquely', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'a', dialect: 'duckdb', env: 'MALKOM_ABSENT' }),
      ],
      credentials: { env: {} },
      logger: noopLogger,
    });
    await expect(registry.resolve('a')).rejects.toThrow(/MALKOM_ABSENT/);
  });

  it('requires a credential source for a postgres profile', async () => {
    const registry = new ConnectionRegistry({
      profiles: [connectionProfileSchema.parse({ id: 'pg', dialect: 'postgres' })],
      logger: noopLogger,
    });
    await expect(registry.resolve('pg')).rejects.toThrow(ConfigInvalidError);
  });

  it('reports an unknown connection id as NotFound', async () => {
    const registry = new ConnectionRegistry({ logger: noopLogger });
    await expect(registry.resolve('nope')).rejects.toThrow(NotFoundError);
  });

  it('prefers a host-provided client and does not close it', async () => {
    let closed = false;
    const hostClient: SqlClient = {
      query: async () => ({ rows: [] }),
      execute: async () => ({ rowCount: 0 }),
      close: async () => {
        closed = true;
      },
    };

    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'analytics', dialect: 'duckdb', config: { path: ':memory:' } }),
      ],
      logger: noopLogger,
    });
    registry.provide('analytics', hostClient, 'duckdb');

    const resolved = await registry.resolve('analytics');
    expect(resolved.client).toBe(hostClient);
    expect(resolved.owned).toBe(false);

    await registry.closeAll();
    expect(closed).toBe(false);
  });

  it('reports a helpful message when the optional driver is absent', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'a', dialect: 'duckdb', config: { path: ':memory:' } }),
      ],
      logger: noopLogger,
      importModule: async (specifier) => {
        const err = new Error(`Cannot find package '${specifier}' imported from somewhere`);
        (err as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
        throw err;
      },
    });
    await expect(registry.resolve('a')).rejects.toThrow(/npm install @duckdb\/node-api/);
  });

  it('does not disguise a failure INSIDE the driver as a missing package', async () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'a', dialect: 'duckdb', config: { path: ':memory:' } }),
      ],
      logger: noopLogger,
      importModule: async () => {
        // A broken transitive import names a DIFFERENT package.
        const err = new Error("Cannot find package 'some-transitive-dep' imported from duckdb");
        (err as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
        throw err;
      },
    });
    await expect(registry.resolve('a')).rejects.toThrow(/some-transitive-dep/);
  });

  it('lists every known id', () => {
    const registry = new ConnectionRegistry({
      profiles: [
        connectionProfileSchema.parse({ id: 'ops', dialect: 'postgres', env: 'X' }),
        connectionProfileSchema.parse({ id: 'analytics', dialect: 'duckdb', config: { path: ':memory:' } }),
      ],
      logger: noopLogger,
    });
    expect(registry.ids()).toEqual(['analytics', 'ops']);
    expect(registry.has('ops')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });
});
