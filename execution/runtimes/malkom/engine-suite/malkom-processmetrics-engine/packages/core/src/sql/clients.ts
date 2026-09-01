import { DatabaseSync } from 'node:sqlite';
import { ConfigInvalidError } from '../domain/errors.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
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

// ---------------------------------------------------------------------------
// Optional-driver clients (pg / mysql2), loaded lazily — zero hard deps
// ---------------------------------------------------------------------------

/**
 * The dynamic-import seam for the optional driver packages. Injectable so
 * tests can exercise the driver-shaped plumbing (pool construction, the
 * 'error' listener, error translation) without installing pg/mysql2.
 */
export type ModuleImporter = (specifier: string) => Promise<unknown>;

const realImport: ModuleImporter = (specifier) => import(specifier);

/** Options shared by the lazily-loaded driver client factories. */
export interface DriverClientOptions {
  /** Pool size cap. Default 5. */
  poolMax?: number;
  /**
   * Where driver-level background failures (e.g. an idle pooled connection
   * dropping) are reported. Default jsonConsoleLogger — such errors must be
   * visible, never process-crashing.
   */
  logger?: Logger;
  /** Test seam: replaces `import()` for the optional driver package. */
  importModule?: ModuleImporter;
}

/**
 * Is this error "the optional package `specifier` is not installed" — and
 * nothing else? Only Node's module-not-found code counts, and only when the
 * message names the package itself: an ERR_MODULE_NOT_FOUND raised INSIDE the
 * driver (a broken transitive import) names a different specifier and must
 * surface verbatim, not as an "npm install" hint.
 */
function isModuleNotFound(err: unknown, specifier: string): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') return false;
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]!;
  // Exact quoted names only: "Cannot find package 'pg-connection-string'" (a
  // broken TRANSITIVE dep) must NOT read as "'pg' is not installed".
  return [packageName, specifier].some(
    (name) => err.message.includes(`'${name}'`) || err.message.includes(`"${name}"`),
  );
}

async function importDriver(
  specifier: string,
  notInstalledMessage: string,
  importModule: ModuleImporter,
): Promise<unknown> {
  try {
    return await importModule(specifier);
  } catch (err) {
    if (isModuleNotFound(err, specifier)) throw new ConfigInvalidError(notInstalledMessage);
    throw err; // a real failure inside the driver — never masked as "not installed"
  }
}

/** The minimal shape of a pg Pool this client uses. */
interface PgPoolLike {
  query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end(): Promise<void>;
  on(event: 'error', listener: (err: Error) => void): unknown;
}

interface PgModuleLike {
  Pool?: new (config: { connectionString: string; max: number }) => PgPoolLike;
  default?: { Pool?: new (config: { connectionString: string; max: number }) => PgPoolLike };
}

/**
 * Postgres client over the optional 'pg' package, loaded lazily so the core
 * has zero driver dependencies. Install: npm i pg
 *
 * The pool ALWAYS gets an 'error' listener: pg emits 'error' on the pool when
 * an IDLE pooled connection drops (server restart, network blip), and an
 * unhandled 'error' event crashes the whole process. Those failures are
 * logged and the pool recovers on the next checkout.
 */
export async function createPostgresClient(connectionString: string, opts: DriverClientOptions = {}): Promise<SqlClient> {
  const logger = opts.logger ?? jsonConsoleLogger;
  const mod = (await importDriver(
    'pg',
    "dialect 'postgres' requires the optional 'pg' package — npm install pg",
    opts.importModule ?? realImport,
  )) as PgModuleLike;
  const Pool = mod.default?.Pool ?? mod.Pool;
  if (typeof Pool !== 'function') {
    throw new ConfigInvalidError("the 'pg' package does not expose a Pool constructor — incompatible version?");
  }
  const pool = new Pool({ connectionString, max: opts.poolMax ?? 5 });
  pool.on('error', (err) => {
    logger.error({ err: err.message, driver: 'pg' }, 'postgres pool error (idle connection dropped)');
  });
  return {
    async query(text: string, params: unknown[]) {
      const res = await pool.query(text, params);
      return { rows: res.rows };
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

/** The minimal shape of a mysql2/promise pool this client uses. */
interface MysqlPoolLike {
  query(text: string, params: unknown[]): Promise<[unknown, unknown]>;
  execute(text: string, params: unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

interface MysqlModuleLike {
  createPool?: (config: { uri: string; connectionLimit: number }) => MysqlPoolLike;
  default?: { createPool?: (config: { uri: string; connectionLimit: number }) => MysqlPoolLike };
}

/** MySQL client over the optional 'mysql2' package. Install: npm i mysql2 */
export async function createMysqlClient(uri: string, opts: DriverClientOptions = {}): Promise<SqlClient> {
  const mod = (await importDriver(
    'mysql2/promise',
    "dialect 'mysql' requires the optional 'mysql2' package — npm install mysql2",
    opts.importModule ?? realImport,
  )) as MysqlModuleLike;
  const createPool = mod.default?.createPool ?? mod.createPool;
  if (typeof createPool !== 'function') {
    throw new ConfigInvalidError("the 'mysql2' package does not expose createPool — incompatible version?");
  }
  const pool = createPool({ uri, connectionLimit: opts.poolMax ?? 5 });
  return {
    async query(text: string, params: unknown[]) {
      const [rows] = await pool.query(text, params);
      return { rows: rows as Record<string, unknown>[] };
    },
    async execute(text: string, params: unknown[]) {
      const [res] = await pool.execute(text, params);
      const affected = (res as { affectedRows?: unknown }).affectedRows;
      return { rowCount: Number(affected ?? 0) };
    },
    async close() {
      await pool.end();
    },
  };
}
