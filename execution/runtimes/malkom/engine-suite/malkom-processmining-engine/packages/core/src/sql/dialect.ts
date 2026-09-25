import { UnsupportedError } from '../domain/errors.js';

/** A schema-qualified table reference. */
export interface TableRef {
  schema?: string | undefined;
  name: string;
}

/**
 * Everything dialect-specific lives here; every query builder above is
 * dialect-agnostic. Two dialects ship: `postgres` for host extraction and
 * `duckdb` for the analytics store.
 *
 * DuckDB speaks near-Postgres SQL, so the surface below is small — but the
 * differences that DO exist (duration arithmetic, timestamp binding) are
 * exactly the ones the mining queries lean on hardest, which is why they are
 * dialect methods rather than shared string constants.
 */
export interface SqlDialect {
  readonly name: string;
  /** Quote a (regex-validated) identifier. Quoting is the defense; the regex is early feedback. */
  quoteIdent(name: string): string;
  qualifyTable(t: TableRef): string;
  /** 1-based positional placeholder. */
  placeholder(index: number): string;
  /** SQL expression for "now" in UTC. */
  nowUtcExpr(): string;
  /**
   * Bind-parameter form for a Date. Postgres accepts a Date through `pg`
   * directly; DuckDB's binder accepts no Date at all (its value union is
   * null | boolean | number | bigint | string | DuckDBValue classes), so an
   * ISO string plus an explicit cast is the portable form.
   */
  timestampParam(date: Date): unknown;
  /** Cast a placeholder holding a timestamp so comparisons are typed, not textual. */
  timestampPlaceholder(index: number): string;
  /** Cast a column expression to a timestamp, for sources storing them as text. */
  castTimestamp(expr: string): string;
  /**
   * An instant read as LOCAL WALL TIME in the given zone, as a zoneless
   * timestamp.
   *
   * The business calendar is defined in wall time — a team works nine to five
   * whatever the clocks did overnight — so every part of that calculation reads
   * from here rather than from the instant itself. `zone` is a placeholder: a
   * timezone arrives from configuration and configuration is never text in SQL.
   */
  localTimestamp(expr: string, zone: string): string;
  /** The date part of a zoneless timestamp. */
  dateOf(expr: string): string;
  /** Whole days from a fixed YYYY-MM-DD to a zoneless timestamp's date. May be negative. */
  daysFromDate(from: string, expr: string): string;
  /** Seconds since local midnight, 0 to 86,399. */
  secondsIntoDay(expr: string): string;
  /**
   * An instant as fractional seconds since the Unix epoch.
   *
   * The wall-clock counterpart of the business calendar: with no calendar
   * configured every duration is a difference of these, which is exactly what
   * `durationSeconds` gave before and keeps existing figures unchanged.
   */
  epochSeconds(expr: string): string;
  /** Seconds between two timestamp expressions, as a float. Negative if `to` precedes `from`. */
  durationSeconds(from: string, to: string): string;
  /** NULL-tolerant concatenation with a separator — the composite activity classifier. */
  concatWs(separator: string, parts: readonly string[]): string;
  /**
   * Median of a numeric expression, as an aggregate.
   *
   * Deliberately a dialect method: Postgres spells this as the ordered-set
   * aggregate `percentile_cont(0.5) WITHIN GROUP (ORDER BY x)`, DuckDB as the
   * plain aggregate `quantile_cont(x, 0.5)`. Trace-length and duration medians
   * matter more than means here — both distributions are long-tailed, and a
   * mean trace length is dragged upward by a handful of pathological cases.
   */
  medianOf(expr: string): string;
  /**
   * An arbitrary quantile, 0–1.
   *
   * Cycle times are heavily right-skewed, so a mean describes almost no real
   * case. p50 says what usually happens; p90 and p95 are where the complaints
   * come from, and they are what an SLA is actually written against.
   */
  quantileOf(expr: string, q: number): string;
  /**
   * Concatenate a column across a group in a given order.
   *
   * The trace-variant key: the ordered sequence of activity names IS the
   * variant, so this has to be order-deterministic or two runs would disagree
   * about which cases followed the same path.
   */
  stringAgg(expr: string, separator: string, orderBy: string): string;
  /**
   * Read a text field out of a JSON column, pushing whatever bind value the
   * dialect's own accessor wants.
   *
   * The two spellings disagree about more than syntax: DuckDB's
   * `json_extract_string` takes a JSONPath, Postgres's `->>` takes a bare key.
   * The key is bound rather than interpolated — it comes from caller
   * configuration, and a quoted identifier is not a defence inside a string
   * literal.
   */
  jsonField(expr: string, key: string, params: unknown[]): string;
  /**
   * The same access with the key interpolated rather than bound.
   *
   * Needed where the expression is assembled with no parameter array to hand:
   * the activity classifier is built while composing a SELECT list, long
   * before anything is bound. Safe only because the key is validated as an
   * identifier first, so it cannot carry a quote to break out with.
   */
  jsonFieldConst(expr: string, key: string): string;
  /** Introspection query returning rows with { name, data_type }. */
  columnsQuery(schema: string | undefined, table: string): { text: string; params: unknown[] };
}

/**
 * Quantiles reach SQL as a numeric literal, not a bound parameter — some
 * dialects will not plan a parameterised quantile. Clamping to [0,1] and
 * formatting the number ourselves keeps that literal safe by construction.
 */
function clampQuantile(q: number): string {
  const bounded = Number.isFinite(q) ? Math.min(1, Math.max(0, q)) : 0.5;
  return bounded.toFixed(6);
}

function doubleQuote(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function qualify(t: TableRef): string {
  return t.schema ? `${doubleQuote(t.schema)}.${doubleQuote(t.name)}` : doubleQuote(t.name);
}

/**
 * Single-quoted SQL string literal. Used ONLY for engine-authored constants
 * (the activity separator, date-part names) — never for host data, which
 * always travels as a bound parameter.
 */
function quoteLiteral(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

export const postgresDialect: SqlDialect = {
  name: 'postgres',
  quoteIdent: doubleQuote,
  qualifyTable: qualify,
  placeholder: (i) => `$${i}`,
  nowUtcExpr: () => 'now() AT TIME ZONE \'UTC\'',
  // node-postgres serializes a Date to a timestamptz literal itself.
  timestampParam: (date) => date,
  timestampPlaceholder: (i) => `$${i}::timestamptz`,
  castTimestamp: (expr) => `CAST(${expr} AS timestamptz)`,
  localTimestamp: (expr, zone) => `((${expr}) AT TIME ZONE ${zone})`,
  dateOf: (expr) => `CAST(${expr} AS date)`,
  daysFromDate: (from, expr) => `(CAST(${expr} AS date) - DATE '${from}')`,
  secondsIntoDay: (expr) => `EXTRACT(EPOCH FROM CAST(${expr} AS time))`,
  epochSeconds: (expr) => `EXTRACT(EPOCH FROM ${expr})`,
  durationSeconds: (from, to) => `EXTRACT(EPOCH FROM (${to} - ${from}))`,
  concatWs: (sep, parts) => `concat_ws(${quoteLiteral(sep)}, ${parts.join(', ')})`,
  medianOf: (expr) => `percentile_cont(0.5) WITHIN GROUP (ORDER BY ${expr})`,
  quantileOf: (expr, q) => `percentile_cont(${clampQuantile(q)}) WITHIN GROUP (ORDER BY ${expr})`,
  stringAgg: (expr, sep, orderBy) => `string_agg(${expr}, ${quoteLiteral(sep)} ORDER BY ${orderBy})`,
  jsonField: (expr, key, params) => {
    params.push(key);
    return `((${expr})::jsonb ->> $${params.length})`;
  },
  jsonFieldConst: (expr, key) => `((${expr})::jsonb ->> ${quoteLiteral(key)})`,
  // No bound schema means "whatever an unqualified SELECT would hit" — that is
  // current_schema() (search_path head), NOT a hardcoded 'public': extraction
  // and introspection must resolve the same table.
  columnsQuery: (schema, table) => ({
    text: `SELECT column_name AS name, data_type FROM information_schema.columns
           WHERE table_name = $1 AND table_schema = COALESCE($2, current_schema())
           ORDER BY ordinal_position`,
    params: [table, schema ?? null],
  }),
};

export const duckdbDialect: SqlDialect = {
  name: 'duckdb',
  quoteIdent: doubleQuote,
  qualifyTable: qualify,
  // Numbered, not positional.
  //
  // DuckDB accepts both '?' and '$n', but '?' binds by the order placeholders
  // appear in the SQL TEXT. Queries here are assembled from nested fragments —
  // a CASE expression written before the FROM clause it depends on, say — so
  // the order parameters are collected in is not the order they appear in.
  // With '?' that silently misaligns every value; with '$n' the index is
  // explicit and assembly order stops mattering. Verified against the driver:
  // out-of-order and repeated references both bind correctly.
  placeholder: (i) => `$${i}`,
  nowUtcExpr: () => 'get_current_timestamp()',
  // DuckDB's binder has no Date member in its value union — bind the ISO text
  // and let the explicit cast in timestampPlaceholder type it.
  timestampParam: (date) => date.toISOString(),
  timestampPlaceholder: (i) => `CAST($${i} AS TIMESTAMPTZ)`,
  castTimestamp: (expr) => `CAST(${expr} AS TIMESTAMPTZ)`,
  localTimestamp: (expr, zone) => `((${expr}) AT TIME ZONE ${zone})`,
  dateOf: (expr) => `CAST(${expr} AS DATE)`,
  daysFromDate: (from, expr) => `date_diff('day', DATE '${from}', CAST(${expr} AS DATE))`,
  // No time cast: DuckDB's TIME has no epoch extractor, and the parts are exact.
  secondsIntoDay: (expr) =>
    `(datepart('hour', ${expr}) * 3600 + datepart('minute', ${expr}) * 60 + datepart('second', ${expr}))`,
  // Milliseconds then divided, not epoch(): the latter truncates to whole
  // seconds and would quietly round every sub-second duration in the engine.
  epochSeconds: (expr) => `(epoch_ms(${expr}) / 1000.0)`,
  // date_diff returns a whole-number count of the unit, so milliseconds then
  // scale — 'second' alone would truncate sub-second handling times to zero.
  durationSeconds: (from, to) => `(date_diff('millisecond', ${from}, ${to}) / 1000.0)`,
  concatWs: (sep, parts) => `concat_ws(${quoteLiteral(sep)}, ${parts.join(', ')})`,
  medianOf: (expr) => `quantile_cont(${expr}, 0.5)`,
  quantileOf: (expr, q) => `quantile_cont(${expr}, ${clampQuantile(q)})`,
  stringAgg: (expr, sep, orderBy) => `string_agg(${expr}, ${quoteLiteral(sep)} ORDER BY ${orderBy})`,
  // A JSONPath, not a bare key. The key is double-quoted inside the path so
  // that an attribute named with a dot or a space still addresses one field
  // rather than being read as a nested route.
  jsonField: (expr, key, params) => {
    params.push(`$."${key.replace(/"/g, '\\"')}"`);
    return `json_extract_string(${expr}, $${params.length})`;
  },
  jsonFieldConst: (expr, key) =>
    `json_extract_string(${expr}, ${quoteLiteral(`$."${key}"`)})`,
  columnsQuery: (schema, table) => ({
    text: `SELECT column_name AS name, data_type FROM information_schema.columns
           WHERE table_name = ? AND (? IS NULL OR table_schema = ?)
           ORDER BY ordinal_position`,
    params: [table, schema ?? null, schema ?? null],
  }),
};

const DIALECTS: Record<string, SqlDialect> = {
  postgres: postgresDialect,
  duckdb: duckdbDialect,
};

export function dialectByName(name: string): SqlDialect | null {
  return DIALECTS[name] ?? null;
}

export function knownDialects(): string[] {
  return Object.keys(DIALECTS).sort();
}

export function requireDialect(name: string): SqlDialect {
  const d = dialectByName(name);
  if (d === null) {
    throw new UnsupportedError(
      `unknown dialect ${JSON.stringify(name)} — known dialects: ${knownDialects().join(', ')}`,
    );
  }
  return d;
}
