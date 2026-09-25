import type { ConnectionProfile, CredentialSources } from '../config/connection.js';
import { ConfigInvalidError, NotFoundError } from '../domain/errors.js';
import { jsonConsoleLogger, type Logger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import { createDuckDBClient, createPostgresClient, type ModuleImporter } from './clients.js';
import { requireDialect, type SqlDialect } from './dialect.js';

/** A resolved, open connection plus the dialect its SQL must be written in. */
export interface ResolvedConnection {
  readonly id: string;
  readonly client: SqlClient;
  readonly dialect: SqlDialect;
  /** False for host-supplied clients — the engine never closes what it did not open. */
  readonly owned: boolean;
}

export interface ConnectionRegistryOptions {
  profiles?: readonly ConnectionProfile[];
  credentials?: CredentialSources;
  logger?: Logger;
  /** Test seam for the optional driver imports. */
  importModule?: ModuleImporter;
}

/**
 * Opens connections lazily and at most once per profile id.
 *
 * Hosts that already hold an open database — the bring-your-own-DuckDB case —
 * register the live client with `provide()` instead of a profile. Resolution
 * checks provided clients first, so a host connection always wins over a
 * profile with the same id, and `closeAll` leaves it open.
 */
export class ConnectionRegistry {
  private readonly profiles = new Map<string, ConnectionProfile>();
  private readonly open = new Map<string, ResolvedConnection>();
  /** In-flight opens, so concurrent resolves of one id share a single connect. */
  private readonly opening = new Map<string, Promise<ResolvedConnection>>();
  private readonly credentials: CredentialSources;
  private readonly logger: Logger;
  private readonly importModule: ModuleImporter | undefined;

  constructor(opts: ConnectionRegistryOptions = {}) {
    for (const p of opts.profiles ?? []) this.profiles.set(p.id, p);
    this.credentials = opts.credentials ?? {};
    this.logger = opts.logger ?? jsonConsoleLogger;
    this.importModule = opts.importModule;
  }

  /** Register a profile after construction. */
  register(profile: ConnectionProfile): void {
    if (this.open.has(profile.id)) {
      throw new ConfigInvalidError(
        `connection ${JSON.stringify(profile.id)} is already open — close the registry before redefining it`,
      );
    }
    this.profiles.set(profile.id, profile);
  }

  /**
   * Hand the registry an already-open client. This is how a host shares its
   * own DuckDB (or a pooled Postgres it manages elsewhere) with the engine.
   * The registry will use it and will NOT close it.
   */
  provide(id: string, client: SqlClient, dialectName: string): void {
    this.open.set(id, { id, client, dialect: requireDialect(dialectName), owned: false });
  }

  has(id: string): boolean {
    return this.open.has(id) || this.profiles.has(id);
  }

  ids(): string[] {
    return [...new Set([...this.open.keys(), ...this.profiles.keys()])].sort();
  }

  async resolve(id: string): Promise<ResolvedConnection> {
    const existing = this.open.get(id);
    if (existing !== undefined) return existing;

    const inFlight = this.opening.get(id);
    if (inFlight !== undefined) return inFlight;

    const profile = this.profiles.get(id);
    if (profile === undefined) throw new NotFoundError(`connection ${JSON.stringify(id)}`);

    const pending = this.openProfile(profile)
      .then((resolved) => {
        this.open.set(id, resolved);
        return resolved;
      })
      .finally(() => {
        this.opening.delete(id);
      });
    this.opening.set(id, pending);
    return pending;
  }

  private async openProfile(profile: ConnectionProfile): Promise<ResolvedConnection> {
    const dialect = requireDialect(profile.dialect);
    const target = await this.resolveTarget(profile);
    const poolMax = readPositiveInt(profile.config['poolMax']);

    if (profile.dialect === 'postgres') {
      const client = await createPostgresClient(target, {
        logger: this.logger,
        ...(poolMax !== undefined ? { poolMax } : {}),
        ...(this.importModule !== undefined ? { importModule: this.importModule } : {}),
      });
      return { id: profile.id, client, dialect, owned: true };
    }

    const duckdbOptions = readStringRecord(profile.config['options']);
    const client = await createDuckDBClient(target, {
      logger: this.logger,
      ownsInstance: true,
      ...(duckdbOptions !== undefined ? { duckdbOptions } : {}),
      ...(this.importModule !== undefined ? { importModule: this.importModule } : {}),
    });
    return { id: profile.id, client, dialect, owned: true };
  }

  /**
   * The DSN (postgres) or file path (duckdb) for a profile. Exactly one source
   * must be present: an env var, a secret ref, or — for DuckDB only — a plain
   * `config.path`, which is a filesystem location rather than a credential.
   */
  private async resolveTarget(profile: ConnectionProfile): Promise<string> {
    if (profile.env !== undefined) {
      const env = this.credentials.env ?? process.env;
      const value = env[profile.env];
      if (value === undefined || value === '') {
        throw new ConfigInvalidError(
          `connection ${JSON.stringify(profile.id)}: environment variable ${JSON.stringify(profile.env)} is unset or empty`,
        );
      }
      return value;
    }
    if (profile.secretRef !== undefined) {
      const resolver = this.credentials.secrets;
      if (resolver === undefined) {
        throw new ConfigInvalidError(
          `connection ${JSON.stringify(profile.id)} uses secretRef but no secret resolver was configured`,
        );
      }
      return resolver(profile.secretRef);
    }
    if (profile.dialect === 'duckdb') {
      const path = profile.config['path'];
      if (typeof path === 'string' && path.length > 0) return path;
      throw new ConfigInvalidError(
        `connection ${JSON.stringify(profile.id)}: duckdb profiles need one of env, secretRef, or config.path`,
      );
    }
    throw new ConfigInvalidError(
      `connection ${JSON.stringify(profile.id)}: postgres profiles need one of env or secretRef`,
    );
  }

  /** Close every connection the registry itself opened. Host-provided clients are left alone. */
  async closeAll(): Promise<void> {
    const owned = [...this.open.values()].filter((c) => c.owned);
    this.open.clear();
    const results = await Promise.allSettled(owned.map((c) => c.client.close()));
    for (const [i, r] of results.entries()) {
      if (r.status === 'rejected') {
        this.logger.error(
          { connection: owned[i]?.id, err: String(r.reason) },
          'failed to close connection',
        );
      }
    }
  }
}

function readPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string') continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
