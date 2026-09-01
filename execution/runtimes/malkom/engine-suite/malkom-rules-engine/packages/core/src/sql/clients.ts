import { DatabaseSync } from 'node:sqlite';
import { ConfigInvalidError } from '../domain/errors.js';
import type { SqlClient } from '../ports/sql.js';

/** node:sqlite binds only null/number/bigint/string/blob — coerce the rest. */
function coerceParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === true) return 1;
    if (p === false) return 0;
    if (p instanceof Date) return p.toISOString();
    if (p === undefined) return null;
    return p;
  });
}

/** First-party SQLite client on node:sqlite — zero native dependencies. */
export class SqliteSqlClient implements SqlClient {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  /** Test/demo convenience: run DDL or seed SQL directly. */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  async query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }> {
    const rows = this.db.prepare(text).all(...(coerceParams(params) as never[])) as Record<string, unknown>[];
    return { rows };
  }

  async execute(text: string, params: unknown[]): Promise<{ rowCount: number }> {
    const res = this.db.prepare(text).run(...(coerceParams(params) as never[]));
    return { rowCount: Number(res.changes) };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Postgres client over the optional 'pg' package, loaded lazily so the core
 * has zero driver dependencies. Install: npm i pg
 */
export async function createPostgresClient(connectionString: string, poolMax = 5): Promise<SqlClient> {
  const modName = 'pg';
  let mod: any;
  try {
    mod = await import(modName);
  } catch {
    throw new ConfigInvalidError("dialect 'postgres' requires the optional 'pg' package — npm install pg");
  }
  const Pool = mod.default?.Pool ?? mod.Pool;
  const pool = new Pool({ connectionString, max: poolMax });
  return {
    async query(text: string, params: unknown[]) {
      const res = await pool.query(text, params);
      return { rows: res.rows as Record<string, unknown>[] };
    },
    async execute(text: string, params: unknown[]) {
      const res = await pool.query(text, params);
      return { rowCount: Number(res.rowCount ?? 0) };
    },
    async close() {
      await pool.end();
    },
  };
}

/** MySQL client over the optional 'mysql2' package. Install: npm i mysql2 */
export async function createMysqlClient(uri: string, poolMax = 5): Promise<SqlClient> {
  const modName = 'mysql2/promise';
  let mod: any;
  try {
    mod = await import(modName);
  } catch {
    throw new ConfigInvalidError("dialect 'mysql' requires the optional 'mysql2' package — npm install mysql2");
  }
  const createPool = mod.default?.createPool ?? mod.createPool;
  const pool = createPool({ uri, connectionLimit: poolMax });
  return {
    async query(text: string, params: unknown[]) {
      const [rows] = await pool.query(text, params);
      return { rows: rows as Record<string, unknown>[] };
    },
    async execute(text: string, params: unknown[]) {
      const [res] = await pool.execute(text, params);
      return { rowCount: Number((res as any).affectedRows ?? 0) };
    },
    async close() {
      await pool.end();
    },
  };
}
