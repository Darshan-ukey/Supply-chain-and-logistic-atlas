import { ConflictError, NotFoundError } from '../domain/errors.js';
import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';
import {
  coverageRecordSchema,
  streamDefinitionSchema,
  type CoverageRecord,
  type StreamDefinition,
  type StreamFileOrigin,
  type TimeWindow,
} from '../config/schemas.js';
import { filterFingerprint } from '../config/validate.js';
import { coverageExtent, coveredMs } from './coverage.js';

/**
 * The stream registry — named, saved selections of the host's data.
 *
 * A stream is the unit a person actually works with: "UK bookings since
 * April", "everything in the customs queue". They are worth naming because
 * they are worth returning to, and worth returning to because the engine can
 * EXTEND one rather than refetch it — coverage arithmetic already knows which
 * windows are held, so widening a saved stream costs only the gap.
 *
 * They live in the engine's own store rather than in the host's schema, for
 * the same reason the event log does: the engine owns no host tables. A host
 * that wants them elsewhere passes a different store.
 *
 * The definition is stored as JSON rather than shredded into columns. It is
 * validated on the way in and on the way out, so a definition written by an
 * older version either parses or is refused — never half-read into a shape
 * that would extract the wrong rows.
 */

export const STREAMS_TABLE = 'malkom_streams';

export interface StoredStream {
  id: string;
  name: string;
  definition: StreamDefinition;
  /** What has actually been materialised. Absent until the first refresh. */
  coverage: CoverageRecord | null;
  createdAt: Date;
  updatedAt: Date;
  /** Free-text, host-supplied. The engine never interprets it. */
  description: string | null;
}

/** What a listing needs, without carrying every binding for every row. */
export interface StreamSummary {
  id: string;
  name: string;
  description: string | null;
  bindings: number;
  /**
   * Set when this stream was imported from a log rather than extracted.
   *
   * On the summary and not only on the definition because a listing has to be
   * able to offer the right verb: an extracted stream is refreshed, an
   * imported one is replaced, and reading every definition to find out which
   * would defeat the point of a summary.
   */
  file: StreamFileOrigin | null;
  defaultCaseObject: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Held window, or null when nothing has been materialised yet. */
  extent: TimeWindow | null;
  coveredDays: number;
  eventCount: number;
  caseCount: number;
  /**
   * True when the definition changed since the last refresh.
   *
   * Surfaced rather than silently rebuilt: re-extracting a large stream is a
   * decision with a cost, and the person who edited the filter is the one who
   * should make it.
   */
  needsRebuild: boolean;
}

export function streamTableStatements(dialect: SqlDialect, schema?: string): string[] {
  const q = (n: string): string => dialect.quoteIdent(n);
  const table = dialect.qualifyTable(schema !== undefined ? { schema, name: STREAMS_TABLE } : { name: STREAMS_TABLE });
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (
       ${q('id')}          VARCHAR PRIMARY KEY,
       ${q('name')}        VARCHAR NOT NULL,
       ${q('description')} VARCHAR,
       ${q('definition')}  JSON NOT NULL,
       ${q('coverage')}    JSON,
       ${q('created_at')}  TIMESTAMPTZ NOT NULL,
       ${q('updated_at')}  TIMESTAMPTZ NOT NULL
     )`,
  ];
}

export async function ensureStreamRegistry(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<void> {
  for (const statement of streamTableStatements(dialect, schema)) {
    await client.execute(statement, []);
  }
}

const tableOf = (dialect: SqlDialect, schema?: string): string =>
  dialect.qualifyTable(schema !== undefined ? { schema, name: STREAMS_TABLE } : { name: STREAMS_TABLE });

/**
 * Rehydrate a stored row.
 *
 * Coverage windows round-trip through JSON as strings and the arithmetic needs
 * Dates, so they are converted here — once, rather than at each of the dozen
 * places that consume a coverage record.
 */
function hydrate(row: Record<string, unknown>): StoredStream {
  const definition = streamDefinitionSchema.parse(parseJson(row['definition']));
  const rawCoverage = parseJson(row['coverage']);
  const coverage =
    rawCoverage === null
      ? null
      : (() => {
          const parsed = coverageRecordSchema.parse(rawCoverage);
          return {
            ...parsed,
            windows: parsed.windows.map((w) => ({ from: new Date(w.from), to: new Date(w.to) })),
          };
        })();

  return {
    id: String(row['id']),
    name: String(row['name']),
    description: row['description'] === null || row['description'] === undefined ? null : String(row['description']),
    definition,
    coverage,
    createdAt: asDate(row['created_at']),
    updatedAt: asDate(row['updated_at']),
  };
}

function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value === '' ? null : JSON.parse(value);
  return value;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(String(value));
}

export async function listStreams(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<StreamSummary[]> {
  const { rows } = await client.query(
    `SELECT * FROM ${tableOf(dialect, schema)} ORDER BY updated_at DESC`,
    [],
  );
  return rows.map((row) => summarise(hydrate(row)));
}

export function summarise(stream: StoredStream): StreamSummary {
  const coverage = stream.coverage;
  return {
    id: stream.id,
    name: stream.name,
    description: stream.description,
    bindings: stream.definition.bindings.length,
    file: stream.definition.file ?? null,
    defaultCaseObject: stream.definition.defaultCaseObject ?? null,
    createdAt: stream.createdAt,
    updatedAt: stream.updatedAt,
    extent: coverage === null ? null : coverageExtent(coverage),
    coveredDays: coverage === null ? 0 : Math.round(coveredMs(coverage.windows) / 86_400_000),
    eventCount: coverage?.eventCount ?? 0,
    caseCount: coverage?.caseCount ?? 0,
    // Compared against the fingerprint the coverage was built under. The
    // fingerprint deliberately EXCLUDES the time window, so widening a stream
    // appends rather than invalidating everything already held.
    needsRebuild:
      coverage !== null && coverage.filterFingerprint !== filterFingerprint(stream.definition),
  };
}

export async function getStream(
  client: SqlClient,
  dialect: SqlDialect,
  id: string,
  schema?: string,
): Promise<StoredStream> {
  const { rows } = await client.query(
    `SELECT * FROM ${tableOf(dialect, schema)} WHERE id = ${dialect.placeholder(1)}`,
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw new NotFoundError(`stream ${JSON.stringify(id)}`);
  return hydrate(row);
}

export async function findStream(
  client: SqlClient,
  dialect: SqlDialect,
  id: string,
  schema?: string,
): Promise<StoredStream | null> {
  try {
    return await getStream(client, dialect, id, schema);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export interface SaveStreamInput {
  definition: StreamDefinition;
  name?: string;
  description?: string | null;
  /** Refuse to overwrite an existing stream. Used by "create", not by "save". */
  createOnly?: boolean;
}

export async function saveStream(
  client: SqlClient,
  dialect: SqlDialect,
  input: SaveStreamInput,
  schema?: string,
  now: Date = new Date(),
): Promise<StoredStream> {
  const definition = streamDefinitionSchema.parse(input.definition);
  const table = tableOf(dialect, schema);
  const existing = await findStream(client, dialect, definition.id, schema);

  if (existing !== null && input.createOnly === true) {
    throw new ConflictError(`a stream called ${JSON.stringify(definition.id)} already exists`);
  }

  const name = input.name ?? definition.name ?? existing?.name ?? definition.id;
  const description = input.description ?? existing?.description ?? null;
  const createdAt = existing?.createdAt ?? now;

  const ph = (i: number): string => dialect.placeholder(i);
  const ts = (i: number): string => dialect.timestampPlaceholder(i);

  if (existing === null) {
    await client.execute(
      `INSERT INTO ${table} (id, name, description, definition, coverage, created_at, updated_at)
       VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, NULL, ${ts(5)}, ${ts(6)})`,
      [
        definition.id,
        name,
        description,
        JSON.stringify(definition),
        dialect.timestampParam(createdAt),
        dialect.timestampParam(now),
      ],
    );
  } else {
    // Coverage is deliberately NOT cleared here. Whether the edit invalidates
    // what is held is a question the fingerprint answers, and clearing it on
    // every save would throw away a materialisation because someone renamed
    // the stream.
    await client.execute(
      `UPDATE ${table} SET name = ${ph(1)}, description = ${ph(2)}, definition = ${ph(3)}, updated_at = ${ts(4)}
       WHERE id = ${ph(5)}`,
      [name, description, JSON.stringify(definition), dialect.timestampParam(now), definition.id],
    );
  }

  return getStream(client, dialect, definition.id, schema);
}

export async function saveStreamCoverage(
  client: SqlClient,
  dialect: SqlDialect,
  id: string,
  coverage: CoverageRecord,
  schema?: string,
  now: Date = new Date(),
): Promise<void> {
  await client.execute(
    `UPDATE ${tableOf(dialect, schema)} SET coverage = ${dialect.placeholder(1)}, updated_at = ${dialect.timestampPlaceholder(2)}
     WHERE id = ${dialect.placeholder(3)}`,
    [JSON.stringify(coverage), dialect.timestampParam(now), id],
  );
}

export async function deleteStream(
  client: SqlClient,
  dialect: SqlDialect,
  id: string,
  schema?: string,
): Promise<boolean> {
  const { rowCount } = await client.execute(
    `DELETE FROM ${tableOf(dialect, schema)} WHERE id = ${dialect.placeholder(1)}`,
    [id],
  );
  return rowCount > 0;
}
