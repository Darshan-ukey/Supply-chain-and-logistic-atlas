import type { ConnectionProfile } from '../config/connection.js';
import { ConfigInvalidError, NotFoundError } from '../domain/errors.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type { ColumnInfo, SqlClient } from '../ports/sql.js';
import { createMysqlClient, createPostgresClient, SqliteSqlClient } from './clients.js';
import { dialectByName, type SqlDialect } from './dialect.js';

export interface ResolvedConnection {
  client: SqlClient;
  dialect: SqlDialect;
}

export type SecretResolver = (ref: { provider: string; path: string }) => Promise<string>;

interface Entry {
  profile?: ConnectionProfile;
  factory?: () => Promise<ResolvedConnection>;
  resolved?: ResolvedConnection;
  /**
   * Whether closeAll() may close the resolved client. Registry-created
   * clients (profiles, factories) are owned; clients handed over via
   * registerClient stay the HOST's to close.
   */
  owned: boolean;
  /** In-flight first resolution — concurrent resolves share one creation. */
  pending?: Promise<ResolvedConnection>;
}

/**
 * Connections are registered once and referenced by name everywhere. Config
 * payloads carry references (env names, secret refs) — never raw secrets.
 * Library-mode hosts may hand over live clients or factories directly.
 *
 * Ownership: clients the registry CREATES (from profiles or factories) are
 * closed by closeAll(); clients a host hands over via registerClient() are
 * never closed here — the host manages their lifecycle. closeAll() releases
 * every entry's resolved client either way, so a handed-over client must be
 * registered again before the registry can resolve it after a closeAll().
 */
export class ConnectionRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly secretResolver: SecretResolver | undefined;
  private readonly logger: Logger;

  constructor(opts: { secretResolver?: SecretResolver; logger?: Logger } = {}) {
    this.secretResolver = opts.secretResolver;
    this.logger = opts.logger ?? jsonConsoleLogger;
  }

  /** Register a declarative profile (service mode / config bundles). */
  registerProfile(profile: ConnectionProfile): void {
    this.entries.set(profile.id, { profile, owned: true });
  }

  /**
   * Library mode: hand the engine a live client for a known dialect. The
   * client remains the HOST's — closeAll() will not close it.
   */
  registerClient(id: string, dialectName: string, client: SqlClient): void {
    const dialect = dialectByName(dialectName);
    if (!dialect) throw new ConfigInvalidError(`unknown SQL dialect ${JSON.stringify(dialectName)}`);
    this.entries.set(id, { resolved: { client, dialect }, owned: false });
  }

  /** Library mode: full control — the factory owns credentials and pooling. */
  registerFactory(id: string, dialectName: string, factory: () => Promise<SqlClient>): void {
    const dialect = dialectByName(dialectName);
    if (!dialect) throw new ConfigInvalidError(`unknown SQL dialect ${JSON.stringify(dialectName)}`);
    this.entries.set(id, {
      factory: async () => ({ client: await factory(), dialect }),
      owned: true,
    });
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Names + dialects only — never credentials. */
  list(): Array<{ id: string; dialect: string }> {
    return [...this.entries.entries()]
      .map(([id, e]) => ({
        id,
        dialect: e.resolved?.dialect.name ?? e.profile?.dialect ?? 'custom',
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async resolve(id: string): Promise<ResolvedConnection> {
    const entry = this.entries.get(id);
    if (!entry) throw new NotFoundError(`connection ${JSON.stringify(id)}`);
    if (entry.resolved) return entry.resolved;
    const create =
      entry.factory ?? (entry.profile !== undefined ? () => this.fromProfile(entry.profile!) : undefined);
    if (create === undefined) {
      // A registerClient entry whose client was released by closeAll() (or an
      // entry constructed without any way to re-create its client).
      throw new ConfigInvalidError(
        `connection ${JSON.stringify(id)} has no profile or factory to (re)create its client — ` +
          'it was registered as a live client and released by closeAll(); register it again',
      );
    }
    // Memoize the IN-FLIGHT creation: two concurrent first-touches must share
    // one client — the loser of a naive race would orphan a live pool.
    // A failed creation clears the memo so the next resolve retries.
    entry.pending ??= create().then(
      (resolved) => {
        entry.resolved = resolved;
        delete entry.pending;
        return resolved;
      },
      (err: unknown) => {
        delete entry.pending;
        throw err;
      },
    );
    return entry.pending;
  }

  private async dsnFor(profile: ConnectionProfile): Promise<string> {
    if (profile.env !== undefined) {
      const v = process.env[profile.env];
      if (v === undefined || v === '') {
        throw new ConfigInvalidError(
          `connection ${JSON.stringify(profile.id)}: env var ${JSON.stringify(profile.env)} is not set`,
        );
      }
      return v;
    }
    if (profile.secretRef !== undefined) {
      if (!this.secretResolver) {
        throw new ConfigInvalidError(
          `connection ${JSON.stringify(profile.id)} uses secretRef but no secretResolver is configured`,
        );
      }
      return this.secretResolver(profile.secretRef);
    }
    const filename = profile.config['filename'];
    if (profile.dialect === 'sqlite' && typeof filename === 'string') return filename;
    throw new ConfigInvalidError(
      `connection ${JSON.stringify(profile.id)}: provide env, secretRef, or (sqlite only) config.filename`,
    );
  }

  private async fromProfile(profile: ConnectionProfile): Promise<ResolvedConnection> {
    const dialect = dialectByName(profile.dialect);
    if (!dialect) {
      throw new ConfigInvalidError(
        `connection ${JSON.stringify(profile.id)}: unknown dialect ${JSON.stringify(profile.dialect)} — register a client or factory for it instead`,
      );
    }
    const dsn = await this.dsnFor(profile);
    const poolMax = typeof profile.config['poolMax'] === 'number' ? profile.config['poolMax'] : 5;
    switch (dialect.name) {
      case 'sqlite':
        return { client: new SqliteSqlClient(dsn), dialect };
      case 'postgres':
        return { client: await createPostgresClient(dsn, { poolMax, logger: this.logger }), dialect };
      case 'mysql':
        return { client: await createMysqlClient(dsn, { poolMax, logger: this.logger }), dialect };
      default:
        throw new ConfigInvalidError(`no client factory for dialect ${JSON.stringify(dialect.name)}`);
    }
  }

  /** Live connectivity + column inventory — powers /probe and validate tier 2. */
  async probe(
    id: string,
    table?: { schema?: string | undefined; name: string },
  ): Promise<{ ok: boolean; dialect: string; detail?: string; columns?: ColumnInfo[] }> {
    try {
      const { client, dialect } = await this.resolve(id);
      if (table) {
        const q = dialect.columnsQuery(table.schema, table.name);
        const { rows } = await client.query(q.text, q.params);
        const columns = rows.map((r) => ({
          name: String(r['name']),
          dataType: String(r['data_type'] ?? ''),
        }));
        return { ok: true, dialect: dialect.name, columns };
      }
      await client.query('SELECT 1 AS ok', []);
      return { ok: true, dialect: dialect.name };
    } catch (err) {
      return { ok: false, dialect: 'unknown', detail: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Close every registry-OWNED client and release all resolved entries.
   * Host-registered clients (registerClient) are released but NOT closed —
   * their lifecycle belongs to the host.
   */
  async closeAll(): Promise<void> {
    for (const e of this.entries.values()) {
      if (e.resolved && e.owned) await e.resolved.client.close().catch(() => {});
      delete e.resolved;
      delete e.pending;
    }
  }
}
