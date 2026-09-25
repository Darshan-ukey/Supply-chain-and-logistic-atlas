import { z } from 'zod';
import { identifierSchema, registryIdSchema } from '../domain/identifiers.js';

/**
 * Connection configuration — the single source of truth. Every TypeScript type
 * here is a z.infer output, so no hand-written type can drift from the schema.
 *
 * Profiles reference credentials (env var names, secret refs); configuration
 * never carries a raw secret.
 */

export const tableRefSchema = z.object({
  schema: identifierSchema.optional(),
  name: identifierSchema,
});
export type TableRef = z.infer<typeof tableRefSchema>;

export const connectionProfileSchema = z.object({
  id: registryIdSchema,
  /** 'postgres' for host extraction, 'duckdb' for an analytics store. */
  dialect: z.enum(['postgres', 'duckdb']),
  /** Env var holding the DSN or file path, resolved at use time. Never a raw secret. */
  env: z.string().min(1).optional(),
  /** Pointer into a secret store; resolution is pluggable. Never a raw secret. */
  secretRef: z.object({ provider: z.string().min(1), path: z.string().min(1) }).optional(),
  /** Non-secret driver options: { poolMax } for postgres, { path, options } for duckdb. */
  config: z.record(z.string(), z.unknown()).default({}),
});
export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;

/**
 * Where materialised streams live.
 *
 * `builtin` — the engine manages one DuckDB file per stream under `directory`,
 * opening and closing them itself. Nothing to set up; this is the default and
 * covers hosts that have never run DuckDB.
 *
 * `host` — the host already runs DuckDB and hands the engine either a
 * connection profile to open or a live connection object (see
 * `EngineOptions.analyticsConnection`). The engine then shares that database
 * instead of opening a competing one against the same files, and never closes
 * what it did not open.
 *
 * The trade is real and worth stating: `builtin` gets per-stream file isolation
 * for free — deleting a stream is deleting a file, and two streams can refresh
 * in parallel without contending for a writer. A shared host database puts
 * every stream in one catalog under one writer, so refreshes serialise.
 */
export const analyticsStoreSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('builtin'),
    /** Directory for per-stream .duckdb files. Must be on persistent disk. */
    directory: z.string().min(1),
    /** Passed to DuckDBInstance.create, e.g. { memory_limit: '4GB', threads: '4' }. */
    duckdbOptions: z.record(z.string(), z.string()).default({}),
    /** Disk budget across all stream files; eviction is LRU by last read. 0 = unbounded. */
    maxTotalBytes: z.number().int().min(0).default(0),
  }),
  z.object({
    mode: z.literal('host'),
    /**
     * Connection profile to open, when the host wants the engine to connect
     * for it. Omit when passing a live connection through EngineOptions —
     * exactly one of the two must be present, which `validateEngineConfig`
     * checks because a schema cannot see the runtime object.
     */
    connectionRef: registryIdSchema.optional(),
    /**
     * Schema inside the host's DuckDB that the engine may create tables in.
     * Kept explicit so the engine never scatters tables through a catalog it
     * does not own.
     */
    schema: identifierSchema.default('malkom_mining'),
  }),
]);
export type AnalyticsStoreConfig = z.infer<typeof analyticsStoreSchema>;

/**
 * Resolve a profile's DSN (or DuckDB file path) from the environment or a
 * secret provider. Kept separate from the profile schema so configuration can
 * be serialised, diffed and version-controlled without ever holding a secret.
 */
export interface SecretResolver {
  (ref: { provider: string; path: string }): Promise<string>;
}

export interface CredentialSources {
  /** Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Required only when a profile uses secretRef. */
  secrets?: SecretResolver;
}
