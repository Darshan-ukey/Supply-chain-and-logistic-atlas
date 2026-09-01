/**
 * Minimal SQL client port the binding adapter runs on. Drivers plug in behind
 * this: node:sqlite ships first-party; pg/mysql2 register via a factory so the
 * core has zero driver dependencies.
 */
export interface SqlClient {
  /** Read query. Placeholder style is dialect-specific; the compiler matches it. */
  query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  /** Write statement. Returns affected row count — the optimistic guard's verdict. */
  execute(text: string, params: unknown[]): Promise<{ rowCount: number }>;
  close(): Promise<void>;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
}

/** Live schema introspection — powers /validate tier 2 and UI column dropdowns. */
export interface SqlIntrospector {
  tableColumns(client: SqlClient, schema: string | undefined, table: string): Promise<ColumnInfo[]>;
}
