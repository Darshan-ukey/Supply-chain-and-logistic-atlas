/**
 * The SQL client port every engine component runs on. Drivers plug in behind
 * it: `pg` for host Postgres and `@duckdb/node-api` for the analytics store,
 * both loaded lazily so the core package has zero hard driver dependencies.
 */
/**
 * Column types a bulk loader needs to know, kept to the few the canonical log
 * actually uses. Declared by the caller rather than introspected, because the
 * caller wrote the DDL and a round trip to ask would cost more than the append.
 */
export type BulkColumnType = 'bigint' | 'varchar' | 'timestamptz' | 'double' | 'json';

export interface BulkTable {
  table: string;
  schema?: string | undefined;
  columns: readonly { name: string; type: BulkColumnType }[];
}

export interface SqlClient {
  /** Read query. Placeholder style is dialect-specific; the caller matches it. */
  query(text: string, params: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  /** Write statement. Returns affected row count. */
  execute(text: string, params: readonly unknown[]): Promise<{ rowCount: number }>;
  close(): Promise<void>;
  /**
   * Optional bulk load, for writing many rows at once.
   *
   * A parameterised INSERT binds every value across the N-API boundary one at
   * a time, and that cost dominates materialisation completely: measured on
   * DuckDB, 16,000 events took 10.5 s through INSERT and 126 ms through the
   * driver's appender — 83x, and unchanged by batch size, which is what says
   * the cost is per value rather than per statement.
   *
   * Optional because it is a driver capability, not a SQL one. Callers must
   * fall back to INSERT when it is absent, so a host-supplied client or a
   * backend without a bulk path keeps working, only slower.
   */
  bulkInsert?(spec: BulkTable, rows: readonly (readonly unknown[])[]): Promise<number>;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
}

/**
 * Live schema introspection. Powers bind-time verification — a binding that
 * names a column the table does not have is rejected before it can produce a
 * confidently wrong event log.
 */
export interface SqlIntrospector {
  tableColumns(client: SqlClient, schema: string | undefined, table: string): Promise<ColumnInfo[]>;
}
