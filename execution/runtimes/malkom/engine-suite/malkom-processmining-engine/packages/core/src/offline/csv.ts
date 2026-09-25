import { AdapterError, ConfigInvalidError } from '../domain/errors.js';
import { countOf } from '../domain/identifiers.js';
import type { Logger } from '../ports/logger.js';
import { noopLogger } from '../ports/logger.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import { ensureEventLog, eventLogTables } from '../runtime/eventlog.js';
import {
  bareAttributeName,
  classifyAttributeColumns,
  inferMapping,
  type XesColumnMapping,
} from './xes-standard.js';

/**
 * Offline mining from a CSV event log.
 *
 * The import runs ENTIRELY INSIDE DuckDB — `read_csv` reads the file, and
 * INSERT ... SELECT moves it into the canonical event log. No row ever crosses
 * into Node, so a multi-gigabyte log imports in one streaming pass rather than
 * being marshalled a row at a time.
 *
 * Once imported, an offline log is indistinguishable from an extracted one:
 * the DFG, the miners and the performance overlay read the same three tables.
 */

export interface CsvImportOptions {
  /** Path to the CSV. Read by DuckDB, so it must be reachable from this process. */
  path: string;
  /** Column-role overrides. Omit to infer from XES conventions and common aliases. */
  mapping?: Partial<XesColumnMapping>;
  /** Object type the case column becomes. Default 'case'. */
  objectType?: string;
  /** Schema holding the engine's tables in a bring-your-own store. */
  schema?: string;
  /** Field delimiter. Omit to let DuckDB sniff it. */
  delimiter?: string;
  /**
   * strptime format for the timestamp column, e.g. '%Y-%m-%d %H:%M:%S'.
   * Omit to let DuckDB parse ISO-8601 and its common relatives.
   */
  timestampFormat?: string;
  /**
   * IANA zone a NAIVE timestamp should be read in — one carrying no offset,
   * which is what `timestampFormat` always produces.
   *
   * Defaults to UTC, and that default is deliberate. Left to the database, a
   * zoneless timestamp is interpreted in the SESSION's local zone, so the same
   * CSV imports differently on a laptop in Mumbai and a server in Frankfurt,
   * shifting every event by the offset between them. Anchoring explicitly
   * makes an import reproducible on any machine.
   *
   * Ignored when the column already carries an offset (…Z, +05:30).
   */
  timezone?: string;
  /** Binding id recorded on every imported event, for provenance. Default 'csv-import'. */
  bindingId?: string;
  logger?: Logger;
}

export interface ImportResult {
  events: number;
  cases: number;
  activities: number;
  objectType: string;
  mapping: XesColumnMapping;
  eventAttributes: string[];
  caseAttributes: string[];
  timeRange: { from: Date; to: Date } | null;
  warnings: string[];
}

export interface CsvInspectOptions {
  /** Path to the CSV. Read by DuckDB, so it must be reachable from this process. */
  path: string;
  /** Column-role overrides to apply before reporting what is still missing. */
  mapping?: Partial<XesColumnMapping>;
  /** Field delimiter. Omit to let DuckDB sniff it. */
  delimiter?: string;
  /** Rows of real data to return alongside the headers. Default 5, max 50. */
  sampleRows?: number;
  logger?: Logger;
}

export interface CsvInspection {
  /** Every column header, in the order the file declares them. */
  headers: string[];
  /** What each role would bind to, inferred from XES conventions and aliases. */
  mapping: XesColumnMapping;
  /** Roles no column was found for. An import cannot proceed while this is non-empty. */
  missing: string[];
  /** Columns that would ride along as attributes, split by scope. */
  attributes: { event: string[]; case: string[] };
  /** The first few rows exactly as read, so a mapping can be checked against real values. */
  sample: Record<string, string>[];
  /** How many rows the file holds, headers excluded. */
  rows: number;
  /** What is off about the file, stated rather than hidden. */
  warnings: string[];
}

/**
 * Read a CSV's shape without importing it.
 *
 * The import itself is one streaming pass and cannot be undone halfway, so the
 * question "which column is the case, and which is the time" has to be settled
 * BEFORE it runs. This answers it: headers, the mapping they imply, what is
 * still unaccounted for, and a handful of real rows to check the answer
 * against. A mapping confirmed against three visible rows is worth more than
 * one confirmed against a column name.
 *
 * Reads only the file. Nothing is written and the event log is not touched.
 */
export async function inspectCsv(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CsvInspectOptions,
): Promise<CsvInspection> {
  if (dialect.name !== 'duckdb') {
    throw new ConfigInvalidError(
      `CSV inspection runs inside the analytics store; expected the 'duckdb' dialect, got ${JSON.stringify(dialect.name)}`,
    );
  }
  const readCsv = buildReadCsvCall(opts);
  const headers = await readHeaders(client, readCsv, opts.path);
  const { mapping, missing } = inferMapping(headers, opts.mapping ?? {});
  const attributes = classifyAttributeColumns(headers, mapping);

  const wanted = Math.min(50, Math.max(0, Math.trunc(opts.sampleRows ?? 5)));
  const sample: Record<string, string>[] = [];
  if (wanted > 0) {
    const { rows } = await client.query(`SELECT * FROM ${readCsv} LIMIT ${wanted}`, []);
    for (const row of rows) {
      const flat: Record<string, string> = {};
      for (const header of headers) {
        const value = row[header];
        flat[header] = value === null || value === undefined ? '' : String(value);
      }
      sample.push(flat);
    }
  }

  const { rows: countRows } = await client.query(`SELECT COUNT(*) AS n FROM ${readCsv}`, []);
  const rows = countOf(countRows[0]?.['n']);

  // The same two warnings the import would raise, raised early enough to act
  // on: a missing resource column costs a whole perspective, and finding that
  // out after the import is finding it out too late.
  const warnings: string[] = [];
  if (!headers.includes(mapping.resource)) {
    warnings.push(
      'no column names who did the work — the people and handover views will be unavailable for this log',
    );
  }
  if (!headers.includes(mapping.lifecycle)) {
    warnings.push('no lifecycle column — every row is treated as a completed step');
  }
  if (rows === 0) warnings.push('the file has headers but no rows');

  (opts.logger ?? noopLogger).info(
    { path: opts.path, headers: headers.length, rows },
    'csv inspected',
  );

  return { headers, mapping, missing, attributes, sample, rows, warnings };
}

/**
 * DuckDB parses CSV natively, so the only thing this function really does is
 * decide which column means what and then write one INSERT ... SELECT per
 * target table.
 */
export async function importCsv(
  client: SqlClient,
  dialect: SqlDialect,
  opts: CsvImportOptions,
): Promise<ImportResult> {
  if (dialect.name !== 'duckdb') {
    throw new ConfigInvalidError(
      `CSV import runs inside the analytics store; expected the 'duckdb' dialect, got ${JSON.stringify(dialect.name)}`,
    );
  }
  const logger = opts.logger ?? noopLogger;
  const objectType = opts.objectType ?? 'case';
  const bindingId = opts.bindingId ?? 'csv-import';
  const warnings: string[] = [];

  const readCsv = buildReadCsvCall(opts);
  const headers = await readHeaders(client, readCsv, opts.path);

  const { mapping, missing } = inferMapping(headers, opts.mapping ?? {});
  if (missing.length > 0) {
    throw new ConfigInvalidError(
      `CSV import cannot proceed: no column found for ${missing.join(', ')}`,
      [
        `columns present: ${headers.join(', ')}`,
        'pass `mapping` to name the columns explicitly, e.g. { caseId: "booking_ref", activity: "step" }',
      ],
    );
  }
  for (const role of ['resource', 'lifecycle'] as const) {
    if (!headers.includes(mapping[role])) {
      warnings.push(
        role === 'resource'
          ? 'no resource column found — the organizational perspective will be unavailable for this log'
          : 'no lifecycle column found — every event is treated as a completion',
      );
    }
  }

  const attrs = classifyAttributeColumns(headers, mapping);
  await ensureEventLog(client, dialect, opts.schema);
  const tables = eventLogTables(dialect, opts.schema);

  const q = (name: string) => dialect.quoteIdent(name);
  const present = new Set(headers);
  const optional = (column: string | undefined): string =>
    column !== undefined && present.has(column) ? `CAST(${q(column)} AS VARCHAR)` : 'NULL';

  // Naive timestamps are anchored explicitly rather than inheriting the
  // session zone; see CsvImportOptions.timezone for why that matters.
  const zone = literal(opts.timezone ?? 'UTC');
  const rawTs = `CAST(${q(mapping.timestamp)} AS VARCHAR)`;
  const tsExpr =
    opts.timestampFormat !== undefined
      ? `(CAST(strptime(${rawTs}, ${literal(opts.timestampFormat)}) AS TIMESTAMP) AT TIME ZONE ${zone})`
      : opts.timezone !== undefined
        ? `(CAST(${q(mapping.timestamp)} AS TIMESTAMP) AT TIME ZONE ${zone})`
        : `CAST(${q(mapping.timestamp)} AS TIMESTAMPTZ)`;

  // event_id must be unique across repeated imports into the same store, so it
  // continues from whatever is already there rather than restarting at 1.
  const base = await nextEventId(client, tables.events);

  const attributesExpr =
    attrs.event.length === 0
      ? `'{}'`
      : `to_json(struct_pack(${attrs.event
          .map((c) => `${q(sanitiseStructKey(c))} := CAST(${q(c)} AS VARCHAR)`)
          .join(', ')}))`;

  const source = `(SELECT *, row_number() OVER () AS __rn FROM ${readCsv} WHERE ${q(mapping.caseId)} IS NOT NULL AND ${q(mapping.activity)} IS NOT NULL AND ${q(mapping.timestamp)} IS NOT NULL)`;

  const insertedEvents = await run(
    client,
    `INSERT INTO ${tables.events} (event_id, activity, ts, lifecycle, resource, duration_s, binding_id, attributes)
     SELECT ${base} + __rn,
            CAST(${q(mapping.activity)} AS VARCHAR),
            ${tsExpr},
            ${optional(mapping.lifecycle)},
            ${optional(mapping.resource)},
            ${mapping.duration !== undefined && present.has(mapping.duration) ? `CAST(${q(mapping.duration)} AS DOUBLE)` : 'NULL'},
            ${literal(bindingId)},
            ${attributesExpr}
     FROM ${source}`,
    opts.path,
  );

  await run(
    client,
    `INSERT INTO ${tables.objects} (event_id, object_type, object_id)
     SELECT ${base} + __rn, ${literal(objectType)}, CAST(${q(mapping.caseId)} AS VARCHAR)
     FROM ${source}`,
    opts.path,
  );

  // Case attributes are per-case, not per-row: take one value per case rather
  // than one per event, or a 40-event case would write 40 identical rows.
  for (const column of attrs.case) {
    await run(
      client,
      `INSERT INTO ${tables.caseAttrs} (object_type, object_id, key, value)
       SELECT ${literal(objectType)},
              CAST(${q(mapping.caseId)} AS VARCHAR),
              ${literal(bareAttributeName(column, mapping))},
              CAST(any_value(${q(column)}) AS VARCHAR)
       FROM ${source} GROUP BY 2`,
      opts.path,
    );
  }

  const summary = await summarise(client, tables, objectType, dialect);
  logger.info(
    { path: opts.path, events: summary.events, cases: summary.cases, objectType },
    'csv import complete',
  );

  return {
    events: insertedEvents > 0 ? insertedEvents : summary.events,
    cases: summary.cases,
    activities: summary.activities,
    objectType,
    mapping,
    eventAttributes: attrs.event,
    caseAttributes: attrs.case.map((c) => bareAttributeName(c, mapping)),
    timeRange: summary.timeRange,
    warnings,
  };
}

// ---------------------------------------------------------------------------

/**
 * `read_csv(...)` with the options the caller chose.
 *
 * The path is a single-quoted literal rather than a bound parameter: DuckDB
 * resolves table-function arguments while planning, before parameters are
 * bound, so a placeholder here fails to plan. Escaping is therefore the
 * defence, and it is the only place in the engine where a caller-supplied
 * string reaches SQL as a literal.
 */
function buildReadCsvCall(opts: { path: string; delimiter?: string }): string {
  const args = [literal(opts.path), 'header = true', 'all_varchar = true'];
  if (opts.delimiter !== undefined) args.push(`delim = ${literal(opts.delimiter)}`);
  return `read_csv(${args.join(', ')})`;
}

function literal(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

/** struct_pack keys must be identifiers; a header like "unit price" is not one. */
function sanitiseStructKey(header: string): string {
  return header.replaceAll(/[^A-Za-z0-9_]/g, '_');
}

async function readHeaders(client: SqlClient, readCsv: string, path: string): Promise<string[]> {
  try {
    const { rows } = await client.query(`SELECT * FROM ${readCsv} LIMIT 0`, []);
    void rows;
    const described = await client.query(`DESCRIBE SELECT * FROM ${readCsv}`, []);
    return described.rows.map((r) => String(r['column_name']));
  } catch (err) {
    throw new AdapterError(`cannot read CSV ${JSON.stringify(path)}: ${String(err)}`);
  }
}

async function nextEventId(client: SqlClient, eventsTable: string): Promise<number> {
  const { rows } = await client.query(`SELECT COALESCE(MAX(event_id), 0) AS m FROM ${eventsTable}`, []);
  return countOf(rows[0]?.['m']);
}

async function run(client: SqlClient, sql: string, path: string): Promise<number> {
  try {
    const { rowCount } = await client.execute(sql, []);
    return rowCount;
  } catch (err) {
    throw new AdapterError(`CSV import failed for ${JSON.stringify(path)}: ${String(err)}`);
  }
}

async function summarise(
  client: SqlClient,
  tables: { events: string; objects: string },
  objectType: string,
  dialect: SqlDialect,
): Promise<{ events: number; cases: number; activities: number; timeRange: { from: Date; to: Date } | null }> {
  const { rows } = await client.query(
    `SELECT COUNT(*) AS events,
            COUNT(DISTINCT o.object_id) AS cases,
            COUNT(DISTINCT e.activity) AS activities,
            MIN(e.ts) AS min_ts,
            MAX(e.ts) AS max_ts
     FROM ${tables.events} e
     JOIN ${tables.objects} o ON o.event_id = e.event_id
     WHERE o.object_type = ${dialect.placeholder(1)}`,
    [objectType],
  );
  const row = rows[0] ?? {};
  const from = row['min_ts'];
  const to = row['max_ts'];
  return {
    events: countOf(row['events']),
    cases: countOf(row['cases']),
    activities: countOf(row['activities']),
    timeRange:
      from instanceof Date && to instanceof Date ? { from, to } : null,
  };
}
