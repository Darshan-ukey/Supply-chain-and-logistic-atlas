import type { TableRef } from '../config/schemas.js';

/**
 * Everything dialect-specific lives here: identifier quoting, placeholder
 * style, UTC-now expressions, timestamp literals, ordering NULLS emulation.
 * The compiler is dialect-agnostic.
 */
export interface SqlDialect {
  readonly name: string;
  /** Quote a (regex-validated) identifier. Quoting is the defense; the regex is early feedback. */
  quoteIdent(name: string): string;
  qualifyTable(t: TableRef): string;
  /** 1-based positional placeholder ('?' or '$1'). */
  placeholder(index: number): string;
  /** SQL expression for "now" in UTC, matching formatTimestamp's shape for comparisons. */
  nowUtcExpr(): string;
  /**
   * Render a Date as a bound-parameter literal this dialect's timestamp
   * columns accept. With tz: a NAIVE local-time string for legacy columns.
   */
  formatTimestamp(date: Date, tz?: string): string;
  /** ORDER BY term with NULLS FIRST/LAST, emulated where unsupported. */
  orderTerm(quotedColumn: string, dir: 'asc' | 'desc', nulls?: 'first' | 'last'): string;
  supportsSkipLocked: boolean;
  /** Introspection query returning rows with { name, data_type }. */
  columnsQuery(schema: string | undefined, table: string): { text: string; params: unknown[] };
}

/** Format a Date as a naive 'YYYY-MM-DD HH:mm:ss.SSS' string in an IANA timezone. */
export function formatNaiveInZone(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const hour = p['hour'] === '24' ? '00' : p['hour']; // some ICU versions emit 24:00
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${p['year']}-${p['month']}-${p['day']} ${hour}:${p['minute']}:${p['second']}.${ms}`;
}

function doubleQuote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export const sqliteDialect: SqlDialect = {
  name: 'sqlite',
  quoteIdent: doubleQuote,
  qualifyTable: (t) => (t.schema ? `${doubleQuote(t.schema)}.${doubleQuote(t.name)}` : doubleQuote(t.name)),
  placeholder: () => '?',
  // ISO-8601 UTC with 'T' and 'Z' — identical shape to Date.toISOString(), so
  // db-now stamps and engine-bound cutoffs compare lexically.
  nowUtcExpr: () => "strftime('%Y-%m-%dT%H:%M:%fZ','now')",
  formatTimestamp: (date, tz) => (tz ? formatNaiveInZone(date, tz) : date.toISOString()),
  orderTerm: (col, dir, nulls) =>
    nulls ? `${col} ${dir.toUpperCase()} NULLS ${nulls.toUpperCase()}` : `${col} ${dir.toUpperCase()}`,
  supportsSkipLocked: false,
  columnsQuery: (_schema, table) => ({
    text: `SELECT name AS name, type AS data_type FROM pragma_table_info(?)`,
    params: [table],
  }),
};

export const postgresDialect: SqlDialect = {
  name: 'postgres',
  quoteIdent: doubleQuote,
  qualifyTable: (t) => (t.schema ? `${doubleQuote(t.schema)}.${doubleQuote(t.name)}` : doubleQuote(t.name)),
  placeholder: (i) => `$${i}`,
  nowUtcExpr: () => 'now()',
  formatTimestamp: (date, tz) => (tz ? formatNaiveInZone(date, tz) : date.toISOString()),
  orderTerm: (col, dir, nulls) =>
    nulls ? `${col} ${dir.toUpperCase()} NULLS ${nulls.toUpperCase()}` : `${col} ${dir.toUpperCase()}`,
  supportsSkipLocked: true,
  columnsQuery: (schema, table) => ({
    text: `SELECT column_name AS name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = $2`,
    params: [table, schema ?? 'public'],
  }),
};

function backtick(name: string): string {
  return `\`${name.replaceAll('`', '``')}\``;
}

export const mysqlDialect: SqlDialect = {
  name: 'mysql',
  quoteIdent: backtick,
  qualifyTable: (t) => (t.schema ? `${backtick(t.schema)}.${backtick(t.name)}` : backtick(t.name)),
  placeholder: () => '?',
  nowUtcExpr: () => 'UTC_TIMESTAMP(3)',
  // MySQL DATETIME prefers 'YYYY-MM-DD HH:mm:ss.SSS'; render UTC in that shape.
  formatTimestamp: (date, tz) => formatNaiveInZone(date, tz ?? 'UTC'),
  // MySQL has no NULLS FIRST/LAST — emulate with an IS NULL prefix term.
  orderTerm: (col, dir, nulls) =>
    nulls
      ? `(${col} IS NULL) ${nulls === 'first' ? 'DESC' : 'ASC'}, ${col} ${dir.toUpperCase()}`
      : `${col} ${dir.toUpperCase()}`,
  supportsSkipLocked: true,
  columnsQuery: (schema, table) => ({
    text: `SELECT column_name AS name, data_type FROM information_schema.columns WHERE table_name = ? AND table_schema = COALESCE(?, DATABASE())`,
    params: [table, schema ?? null],
  }),
};

const DIALECTS: Record<string, SqlDialect> = {
  sqlite: sqliteDialect,
  postgres: postgresDialect,
  mysql: mysqlDialect,
};

export function dialectByName(name: string): SqlDialect | null {
  return DIALECTS[name] ?? null;
}

export function knownDialects(): string[] {
  return Object.keys(DIALECTS).sort();
}
