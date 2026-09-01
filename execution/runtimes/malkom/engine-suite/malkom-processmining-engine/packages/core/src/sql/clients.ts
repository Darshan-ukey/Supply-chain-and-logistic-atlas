import { AdapterError, ConfigInvalidError } from '../domain/errors.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type { BulkColumnType, BulkTable, SqlClient } from '../ports/sql.js';

/**
 * Driver clients, both loaded through `import()` at first use. A host that only
 * mines Postgres never installs DuckDB, and vice versa.
 *
 * `pg` is declared an optional peer. `@duckdb/node-api` deliberately is NOT,
 * and the reason is worth recording because it looks like an omission: every
 * version that package has ever published carries a prerelease tag, and semver
 * matches a prerelease only against a comparator sharing its exact
 * major.minor.patch. No forward-compatible range exists — `>=1.3.0` matches
 * none of them, and neither does `*` — so any range declared here would break
 * `npm install` for every consumer at the next upstream release.
 *
 * Nothing is given up by dropping it. The requirement is checked below at the
 * point of use, against the API the engine actually calls, which is a stricter
 * test than a version string and cannot go stale.
 */

/** The dynamic-import seam. Injectable so tests can exercise the plumbing without the driver. */
export type ModuleImporter = (specifier: string) => Promise<unknown>;

const realImport: ModuleImporter = (specifier) => import(specifier);

export interface DriverClientOptions {
  /** Pool size cap for pooled drivers. Default 5. */
  poolMax?: number;
  /** Where driver-level background failures are reported. Default jsonConsoleLogger. */
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

// ---------------------------------------------------------------------------
// Postgres — host extraction tier
// ---------------------------------------------------------------------------

interface PgPoolLike {
  query(
    text: string,
    params: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end(): Promise<void>;
  on(event: 'error', listener: (err: Error) => void): unknown;
}

interface PgModuleLike {
  Pool?: new (config: { connectionString: string; max: number }) => PgPoolLike;
  default?: { Pool?: new (config: { connectionString: string; max: number }) => PgPoolLike };
}

/**
 * Postgres client over the optional 'pg' package. Install: npm i pg
 *
 * The pool ALWAYS gets an 'error' listener: pg emits 'error' on the pool when
 * an IDLE pooled connection drops (server restart, network blip), and an
 * unhandled 'error' event crashes the whole process. Those failures are logged
 * and the pool recovers on the next checkout.
 */
export async function createPostgresClient(
  connectionString: string,
  opts: DriverClientOptions = {},
): Promise<SqlClient> {
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
    async query(text, params) {
      const res = await pool.query(text, params);
      return { rows: res.rows };
    },
    async execute(text, params) {
      const res = await pool.query(text, params);
      return { rowCount: Number(res.rowCount ?? 0) };
    },
    async close() {
      await pool.end();
    },
  };
}

// ---------------------------------------------------------------------------
// DuckDB — engine analytics tier
// ---------------------------------------------------------------------------

/**
 * The slice of `@duckdb/node-api` this client uses, declared structurally so
 * the core never imports the package's types. Matches @duckdb/node-api 1.x.
 */
/**
 * The appender: DuckDB's bulk-load path.
 *
 * Structurally typed like everything else here, so the core keeps no hard
 * dependency on the driver and a test can stand in for it.
 */
export interface DuckDBAppenderLike {
  appendBigInt(value: bigint): void;
  appendVarchar(value: string): void;
  appendDouble(value: number): void;
  appendValue(value: unknown): void;
  appendNull(): void;
  endRow(): void;
  flushSync(): void;
  closeSync(): void;
}

export interface DuckDBConnectionLike {
  run(sql: string, values?: readonly unknown[]): Promise<{ rowsChanged: number }>;
  runAndReadAll(sql: string, values?: readonly unknown[]): Promise<{
    getRowObjectsJS(): Record<string, unknown>[];
  }>;
  /** Present from @duckdb/node-api 1.x; absent on older or partial stand-ins. */
  createAppender?(table: string, schema?: string | null): Promise<DuckDBAppenderLike>;
  disconnectSync(): void;
}

export interface DuckDBInstanceLike {
  connect(): Promise<DuckDBConnectionLike>;
  closeSync(): void;
}

interface DuckDBModuleLike {
  timestampTZValue?: (micros: bigint) => unknown;
  DuckDBInstance?: { create(path?: string, options?: Record<string, string>): Promise<DuckDBInstanceLike> };
  default?: {
    DuckDBInstance?: { create(path?: string, options?: Record<string, string>): Promise<DuckDBInstanceLike> };
  };
}

/**
 * DuckDB's binder accepts null | boolean | number | bigint | string and its own
 * value classes — a JS Date is NOT among them, and `undefined` is not either.
 * Timestamps travel as ISO text and are cast in SQL (see duckdbDialect).
 */
function coerceDuckDBParams(params: readonly unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (p instanceof Date) return p.toISOString();
    return p;
  });
}

export interface DuckDBClientOptions extends DriverClientOptions {
  /**
   * Open the database read-only.
   *
   * DuckDB allows ONE writer per file. A process that only reads — an API
   * server, a report job — must say so, or it takes the write lock and blocks
   * every other process from opening the store at all, including the
   * materialisation worker that keeps it current.
   */
  readOnly?: boolean;
  /**
   * DuckDB configuration passed straight through to `DuckDBInstance.create`
   * (e.g. `{ memory_limit: '4GB', threads: '4' }`). Host-supplied.
   */
  duckdbOptions?: Record<string, string>;
  /**
   * Close the underlying instance when this client closes. False when the
   * instance was handed in by the host — the engine never closes what it did
   * not open.
   */
  ownsInstance?: boolean;
}

/**
 * Wrap an already-open DuckDB connection as an engine SqlClient.
 *
 * This is the bring-your-own path: a host that already runs DuckDB passes its
 * own connection and the engine uses it rather than opening a second instance
 * against the same file. Closing this client disconnects but leaves the host's
 * instance open — the engine never closes what it did not open.
 */
export function wrapDuckDBConnection(
  connection: DuckDBConnectionLike,
  opts: {
    instance?: DuckDBInstanceLike;
    ownsInstance?: boolean;
    /** The driver's timestampTZValue, needed to append a TIMESTAMPTZ. */
    timestampValue?: (micros: bigint) => unknown;
  } = {},
): SqlClient {
  let closed = false;
  return {
    async query(text, params) {
      const reader = await connection.runAndReadAll(text, coerceDuckDBParams(params));
      return { rows: reader.getRowObjectsJS() };
    },
    async execute(text, params) {
      const res = await connection.run(text, coerceDuckDBParams(params));
      return { rowCount: Number(res.rowsChanged ?? 0) };
    },
    async close() {
      if (closed) return; // disconnectSync is not idempotent in the bindings
      closed = true;
      connection.disconnectSync();
      if (opts.ownsInstance === true && opts.instance !== undefined) opts.instance.closeSync();
    },
    // Advertised only when the driver actually has it, so callers fall back to
    // INSERT against an older version rather than failing.
    ...(typeof connection.createAppender === 'function'
      ? {
          bulkInsert: async (spec: BulkTable, rows: readonly (readonly unknown[])[]) => {
            if (rows.length === 0) return 0;
            const appender = await connection.createAppender!(
              spec.table,
              spec.schema ?? null,
            );
            try {
              for (const row of rows) {
                for (const [index, column] of spec.columns.entries()) {
                  appendCell(appender, column.type, row[index], opts.timestampValue);
                }
                appender.endRow();
              }
              appender.flushSync();
            } finally {
              appender.closeSync();
            }
            return rows.length;
          },
        }
      : {}),
  };
}

/**
 * Append one value in the column's declared type.
 *
 * Null is checked first and appended as null rather than coerced: a timestamp
 * column given the string "null" is a parse error, and a numeric one given 0
 * is a silent lie.
 */
function appendCell(
  appender: DuckDBAppenderLike,
  type: BulkColumnType,
  value: unknown,
  timestampValue: ((micros: bigint) => unknown) | undefined,
): void {
  if (value === null || value === undefined) {
    appender.appendNull();
    return;
  }
  switch (type) {
    case 'bigint':
      appender.appendBigInt(BigInt(value as number | bigint | string));
      return;
    case 'double':
      appender.appendDouble(Number(value));
      return;
    case 'timestamptz': {
      const ms = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
      if (Number.isNaN(ms) || timestampValue === undefined) {
        // No way to build the driver's timestamp value: refuse rather than
        // write an instant that is merely plausible.
        appender.appendNull();
        return;
      }
      appender.appendValue(timestampValue(BigInt(Math.round(ms)) * 1000n));
      return;
    }
    case 'varchar':
    case 'json':
      appender.appendVarchar(typeof value === 'string' ? value : JSON.stringify(value));
      return;
  }
}

/**
 * Open a DuckDB database file (or ':memory:') as an engine SqlClient.
 * Install: npm i @duckdb/node-api
 *
 * ONE writer per file. The materialisation worker owns writes to a stream
 * file; readers should open the same path with `{ access_mode: 'READ_ONLY' }`.
 * Two writers against one file is a corruption path the engine cannot detect
 * for you.
 */
export async function createDuckDBClient(
  path: string,
  opts: DuckDBClientOptions = {},
): Promise<SqlClient> {
  const mod = (await importDriver(
    '@duckdb/node-api',
    "dialect 'duckdb' requires the optional '@duckdb/node-api' package — npm install @duckdb/node-api",
    opts.importModule ?? realImport,
  )) as DuckDBModuleLike;
  const DuckDBInstance = mod.default?.DuckDBInstance ?? mod.DuckDBInstance;
  if (DuckDBInstance === undefined || typeof DuckDBInstance.create !== 'function') {
    throw new ConfigInvalidError(
      "the installed '@duckdb/node-api' does not expose DuckDBInstance.create — this engine needs " +
        "the 1.x API; the separate 'duckdb' package and releases before it expose a different one",
    );
  }
  const duckdbOptions = {
    ...opts.duckdbOptions,
    ...(opts.readOnly === true ? { access_mode: 'READ_ONLY' } : {}),
  };
  const instance = await DuckDBInstance.create(path, duckdbOptions);
  let connection: DuckDBConnectionLike;
  try {
    connection = await instance.connect();
    // Pin the session to UTC. Converting a zoneless timestamp to TIMESTAMPTZ
    // otherwise uses the HOST's local zone, so the identical log would import
    // shifted by hours depending on which machine ran the job. Set only on
    // connections the engine opens — a host-supplied connection keeps whatever
    // session settings its owner chose.
    await connection.run("SET TimeZone='UTC'");
  } catch (err) {
    instance.closeSync(); // never leak the instance when connect fails
    throw new AdapterError(`duckdb connect failed for ${JSON.stringify(path)}: ${String(err)}`);
  }
  return wrapDuckDBConnection(connection, {
    instance,
    ownsInstance: opts.ownsInstance ?? true,
    ...(typeof mod.timestampTZValue === 'function' ? { timestampValue: mod.timestampTZValue } : {}),
  });
}
