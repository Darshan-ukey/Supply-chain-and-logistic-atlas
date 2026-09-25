import type { SqlClient } from '../ports/sql.js';

/**
 * Borrowing the host's existing database connection.
 *
 * This is the preferred way to connect the engine, and the reason is security
 * rather than convenience: a host embedding the engine already authenticates
 * to its database somehow — a pooled connection, an IAM token that rotates, a
 * client certificate, a unix socket, a cloud proxy. Handing the engine a
 * connection string would mean re-implementing all of that a second time, in a
 * second place, with a second set of credentials to store and rotate.
 *
 * So the engine takes a live connection instead. It never sees a username, a
 * password or a token; whatever the host is allowed to read, the engine can
 * read, and no more. Revoking the host's access revokes the engine's in the
 * same instant.
 *
 *   registry.provide('ops', fromPrisma(prisma), 'postgres');
 *
 * A connection string via an env var is still supported, for standalone use
 * such as the CLI, where there is no host process to borrow from.
 */

/**
 * The slice of a Prisma client the engine needs. Declared structurally so the
 * core never imports Prisma or pins a version.
 */
export interface PrismaLike {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * Use a Prisma client as the engine's connection.
 *
 * `$queryRawUnsafe` is the right call here despite its name: the engine
 * composes every statement from validated identifiers and passes all host DATA
 * as bound parameters, so the "unsafe" it refers to — string interpolation of
 * user input — is exactly what the compiler refuses to do. The tagged-template
 * `$queryRaw` cannot express a dynamically built FROM clause at all.
 */
export function fromPrisma(prisma: PrismaLike): SqlClient {
  return {
    async query(text, params) {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(text, ...params);
      return { rows: Array.isArray(rows) ? rows : [] };
    },
    async execute(text, params) {
      const rowCount = await prisma.$executeRawUnsafe(text, ...params);
      return { rowCount: Number(rowCount ?? 0) };
    },
    async close() {
      // The host owns this client's lifecycle. Disconnecting it here would
      // take down the rest of the application's database access.
    },
  };
}

/** The slice of a `pg` Pool or Client the engine needs. */
export interface PgClientLike {
  query(
    text: string,
    params: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

/**
 * Use the host's existing `pg` Pool (or Client) as the engine's connection.
 *
 * The pool keeps whatever auth, TLS, timeout and sizing the host configured.
 * Its lifecycle stays with the host — `close()` here is deliberately a no-op.
 */
export function fromPgPool(pool: PgClientLike): SqlClient {
  return {
    async query(text, params) {
      const result = await pool.query(text, params);
      return { rows: result.rows };
    },
    async execute(text, params) {
      const result = await pool.query(text, params);
      return { rowCount: Number(result.rowCount ?? 0) };
    },
    async close() {
      // The host opened it; the host closes it.
    },
  };
}

/**
 * Wrap any function that can run parameterised SQL.
 *
 * The escape hatch for a host whose data access is none of the above — a
 * bespoke pool, a proxy, an ORM the engine has never heard of. Implementing
 * this is roughly ten lines, and it keeps the "engine follows the host" rule
 * intact for stacks nobody anticipated.
 */
export function fromQueryFunction(
  run: (text: string, params: readonly unknown[]) => Promise<Record<string, unknown>[]>,
  opts: { execute?: (text: string, params: readonly unknown[]) => Promise<number> } = {},
): SqlClient {
  return {
    async query(text, params) {
      return { rows: await run(text, params) };
    },
    async execute(text, params) {
      if (opts.execute !== undefined) return { rowCount: await opts.execute(text, params) };
      await run(text, params);
      return { rowCount: 0 };
    },
    async close() {},
  };
}

// ---------------------------------------------------------------------------
// What the host has to supply
// ---------------------------------------------------------------------------

export interface HostRequirement {
  key: string;
  required: boolean;
  what: string;
  why: string;
}

/**
 * The engine's input contract, in one place.
 *
 * A host should not have to read the source to find out what it owes the
 * engine. This is what `GET /v1/requirements` serves, and what the CLI prints
 * when a configuration is incomplete.
 */
export function hostRequirements(): HostRequirement[] {
  return [
    {
      key: 'connection',
      required: true,
      what: 'A live SQL connection (Prisma client, pg Pool, or any query function), passed to registry.provide()',
      why: 'The engine reuses the security you already have. It never stores credentials, and it cannot read anything your own connection cannot. A DSN in an env var is the fallback for standalone use',
    },
    {
      key: 'from',
      required: true,
      what: 'Which table the rows come from — or which tables, and the keys that join them',
      why: 'The engine assumes no table name and no schema shape. It reads what you point it at',
    },
    {
      key: 'grain',
      required: true,
      what: "'event' (one row per occurrence), 'interval' (row with start and end), or 'snapshot' (current state)",
      why: 'Decides what the source can support. Snapshot sources contribute case attributes only, never steps, and the engine refuses a process map rather than inventing one',
    },
    {
      key: 'roles.case',
      required: true,
      what: 'The column whose value REPEATS across every row of one business item',
      why: 'Without it there is no trace to mine. The profiler reports it immediately if the mapping is wrong',
    },
    {
      key: 'roles.activity',
      required: true,
      what: 'The column (or columns) naming what happened',
      why: 'The nodes of the process map. Composing several gives a finer map',
    },
    {
      key: 'roles.timestamp | roles.start + roles.end',
      required: true,
      what: 'When it happened — one column for event grain, two for interval grain',
      why: 'Ordering is the whole basis of the map. UTC, or declare the zone for naive local-time columns',
    },
    {
      key: 'roles.resource',
      required: false,
      what: 'The column naming who performed the work',
      why: 'Enables the organizational perspective. Everything else works without it',
    },
    {
      key: 'roles.duration',
      required: false,
      what: 'Recorded handling time in seconds',
      why: 'Lets the engine separate time spent being worked from time spent waiting — which decides whether a bottleneck needs more people or different routing',
    },
    {
      key: 'objects',
      required: false,
      what: 'Other business objects each row relates to (line item, invoice, customer)',
      why: 'Lets the same stream be mined at more than one case notion without re-extracting',
    },
    {
      key: 'attributes',
      required: false,
      what: 'Extra columns to carry, event-scoped or case-scoped',
      why: 'The data perspective — what distinguishes the cases that take one path from those that take another',
    },
    {
      key: 'analytics store',
      required: true,
      what: "A directory for the engine's DuckDB files, or your own DuckDB connection",
      why: 'Streams persist so a refresh fetches only what is new. Must be on disk that survives a restart',
    },
  ];
}
