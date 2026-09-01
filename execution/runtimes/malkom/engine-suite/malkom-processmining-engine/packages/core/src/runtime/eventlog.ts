import type { BulkTable, SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';

/**
 * The canonical event log — the one shape everything downstream reads.
 *
 * Host extraction and offline file import both write THIS, which is why
 * offline mining costs almost nothing architecturally: the DFG, the miners and
 * the performance overlay never learn which one fed them.
 *
 * Three tables rather than one wide denormalised table:
 *
 *  - `malkom_events`        one row per event, already unpivoted from intervals
 *  - `malkom_event_objects` which business objects each event relates to
 *  - `malkom_case_attrs`    case-scoped attributes, from snapshot sources
 *
 * The object table is what keeps the case key a per-analysis choice. Stamping a
 * permanent `case_id` on the event row would be simpler and would permanently
 * fix the projection — the exact thing that manufactures phantom rework loops
 * when several sibling objects share a parent.
 */

export const EVENTS_TABLE = 'malkom_events';
export const EVENT_OBJECTS_TABLE = 'malkom_event_objects';
export const CASE_ATTRS_TABLE = 'malkom_case_attrs';

/** An event as the projection produces it, before it reaches SQL. */
export interface CanonicalEvent {
  eventId: number;
  activity: string;
  timestamp: Date;
  /** XES lifecycle transition: 'start' | 'complete' | host vocabulary. */
  lifecycle: string | null;
  resource: string | null;
  /** Handling time in seconds when the source records it, distinct from waiting. */
  durationSeconds: number | null;
  /** What this step cost, where the source records it. Null when it does not. */
  cost?: number | null;
  /** Which binding produced this row; the audit trail back to the source. */
  bindingId: string;
  /** Event-scoped attributes, serialised as JSON. */
  attributes: Record<string, unknown>;
}

export interface CanonicalEventObject {
  eventId: number;
  objectType: string;
  objectId: string;
}

export interface CanonicalCaseAttribute {
  objectType: string;
  objectId: string;
  key: string;
  value: string | null;
}

/**
 * DDL for the analytics store.
 *
 * `schema` is honoured so a bring-your-own DuckDB never has engine tables
 * scattered through a catalog the host owns.
 */
export function eventLogStatements(dialect: SqlDialect, schema?: string): string[] {
  const q = (n: string) => dialect.quoteIdent(n);
  const t = (name: string) =>
    dialect.qualifyTable(schema !== undefined ? { schema, name } : { name });

  const events = t(EVENTS_TABLE);
  const objects = t(EVENT_OBJECTS_TABLE);
  const caseAttrs = t(CASE_ATTRS_TABLE);

  const statements: string[] = [];
  if (schema !== undefined) statements.push(`CREATE SCHEMA IF NOT EXISTS ${q(schema)}`);

  statements.push(
    `CREATE TABLE IF NOT EXISTS ${events} (
       ${q('event_id')}   BIGINT PRIMARY KEY,
       ${q('activity')}   VARCHAR NOT NULL,
       ${q('ts')}         TIMESTAMPTZ NOT NULL,
       ${q('lifecycle')}  VARCHAR,
       ${q('resource')}   VARCHAR,
       ${q('duration_s')} DOUBLE,
       ${q('cost')}       DOUBLE,
       ${q('binding_id')} VARCHAR NOT NULL,
       ${q('attributes')} JSON
     )`,
    // Added after the table shipped, so a store built by an earlier version
    // gains the column instead of failing every query that mentions it.
    // CREATE TABLE IF NOT EXISTS does nothing to an existing table.
    `ALTER TABLE ${events} ADD COLUMN IF NOT EXISTS ${q('cost')} DOUBLE`,
    `CREATE TABLE IF NOT EXISTS ${objects} (
       ${q('event_id')}    BIGINT NOT NULL,
       ${q('object_type')} VARCHAR NOT NULL,
       ${q('object_id')}   VARCHAR NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS ${caseAttrs} (
       ${q('object_type')} VARCHAR NOT NULL,
       ${q('object_id')}   VARCHAR NOT NULL,
       ${q('key')}         VARCHAR NOT NULL,
       ${q('value')}       VARCHAR
     )`,
    // The pivot join runs on every mining query; without this index each one
    // is a full scan of the object table.
    `CREATE INDEX IF NOT EXISTS ${q(`${EVENT_OBJECTS_TABLE}_pivot_idx`)} ON ${objects} (${q('object_type')}, ${q('object_id')})`,
    `CREATE INDEX IF NOT EXISTS ${q(`${EVENTS_TABLE}_ts_idx`)} ON ${events} (${q('ts')})`,
  );
  return statements;
}

/** Table names resolved against an optional schema — the handle query builders take. */
export interface EventLogTables {
  events: string;
  objects: string;
  caseAttrs: string;
}

export function eventLogTables(dialect: SqlDialect, schema?: string): EventLogTables {
  const t = (name: string) =>
    dialect.qualifyTable(schema !== undefined ? { schema, name } : { name });
  return { events: t(EVENTS_TABLE), objects: t(EVENT_OBJECTS_TABLE), caseAttrs: t(CASE_ATTRS_TABLE) };
}

/** Create the event-log tables if they do not exist. Idempotent. */
export async function ensureEventLog(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<void> {
  for (const statement of eventLogStatements(dialect, schema)) {
    await client.execute(statement, []);
  }
}

/** Drop the event-log tables. Used by rebuild, and by stream deletion. */
export async function dropEventLog(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<void> {
  const tables = eventLogTables(dialect, schema);
  for (const table of [tables.objects, tables.caseAttrs, tables.events]) {
    await client.execute(`DROP TABLE IF EXISTS ${table}`, []);
  }
}

/**
 * Delete every event whose timestamp falls in a window, and the object and
 * attribute rows that hang off them.
 *
 * Refresh deletes before it inserts rather than upserting: a re-fetched window
 * must REPLACE what was there, or a source row that was deleted upstream would
 * survive forever in the materialised log.
 */
export async function deleteWindow(
  client: SqlClient,
  dialect: SqlDialect,
  window: { from: Date; to: Date },
  schema?: string,
): Promise<number> {
  const tables = eventLogTables(dialect, schema);
  const from = dialect.timestampParam(window.from);
  const to = dialect.timestampParam(window.to);
  const ph = (i: number) => dialect.timestampPlaceholder(i);

  const selectDoomed = `SELECT event_id FROM ${tables.events} WHERE ts >= ${ph(1)} AND ts < ${ph(2)}`;
  await client.execute(
    `DELETE FROM ${tables.objects} WHERE event_id IN (${selectDoomed})`,
    [from, to],
  );
  const { rowCount } = await client.execute(
    `DELETE FROM ${tables.events} WHERE ts >= ${ph(1)} AND ts < ${ph(2)}`,
    [from, to],
  );
  return rowCount;
}

/**
 * Rows written into the canonical log, batched.
 *
 * Batched multi-row INSERTs rather than one statement per event: a per-row
 * round trip is the difference between a materialisation that takes seconds and
 * one that takes minutes, and the batch size is bounded so a large import never
 * builds a statement the driver refuses.
 */
export const INSERT_BATCH_SIZE = 500;

/**
 * Column layouts for the bulk path, matching the DDL above exactly.
 *
 * Kept beside the CREATE TABLE rather than derived from it: a mismatch would
 * append values into the wrong columns, which the database cannot detect when
 * the types happen to line up.
 */
const EVENT_COLUMNS = [
  { name: 'event_id', type: 'bigint' },
  { name: 'activity', type: 'varchar' },
  { name: 'ts', type: 'timestamptz' },
  { name: 'lifecycle', type: 'varchar' },
  { name: 'resource', type: 'varchar' },
  { name: 'duration_s', type: 'double' },
  { name: 'cost', type: 'double' },
  { name: 'binding_id', type: 'varchar' },
  { name: 'attributes', type: 'json' },
] as const satisfies BulkTable['columns'];

const OBJECT_COLUMNS = [
  { name: 'event_id', type: 'bigint' },
  { name: 'object_type', type: 'varchar' },
  { name: 'object_id', type: 'varchar' },
] as const satisfies BulkTable['columns'];

const CASE_ATTR_COLUMNS = [
  { name: 'object_type', type: 'varchar' },
  { name: 'object_id', type: 'varchar' },
  { name: 'key', type: 'varchar' },
  { name: 'value', type: 'varchar' },
] as const satisfies BulkTable['columns'];

export async function insertEvents(
  client: SqlClient,
  dialect: SqlDialect,
  events: readonly CanonicalEvent[],
  schema?: string,
): Promise<number> {
  const tables = eventLogTables(dialect, schema);
  let written = 0;

  // The bulk path when the driver has one. Measured on DuckDB, this is the
  // difference between 10.5 s and 126 ms for 16,000 events — materialisation
  // is dominated by binding values one at a time, not by anything in SQL.
  if (client.bulkInsert !== undefined) {
    return client.bulkInsert(
      { table: EVENTS_TABLE, schema, columns: EVENT_COLUMNS },
      events.map((e) => [
        e.eventId,
        e.activity,
        e.timestamp,
        e.lifecycle,
        e.resource,
        e.durationSeconds,
        e.cost ?? null,
        e.bindingId,
        JSON.stringify(e.attributes ?? {}),
      ]),
    );
  }

  for (let i = 0; i < events.length; i += INSERT_BATCH_SIZE) {
    const batch = events.slice(i, i + INSERT_BATCH_SIZE);
    const params: unknown[] = [];
    const tuples = batch.map((e) => {
      const cells = [
        placeholderFor(dialect, params, e.eventId),
        placeholderFor(dialect, params, e.activity),
        timestampPlaceholderFor(dialect, params, e.timestamp),
        placeholderFor(dialect, params, e.lifecycle),
        placeholderFor(dialect, params, e.resource),
        placeholderFor(dialect, params, e.durationSeconds),
        placeholderFor(dialect, params, e.cost ?? null),
        placeholderFor(dialect, params, e.bindingId),
        placeholderFor(dialect, params, JSON.stringify(e.attributes ?? {})),
      ];
      return `(${cells.join(', ')})`;
    });
    const { rowCount } = await client.execute(
      `INSERT INTO ${tables.events} (event_id, activity, ts, lifecycle, resource, duration_s, cost, binding_id, attributes) VALUES ${tuples.join(', ')}`,
      params,
    );
    written += rowCount > 0 ? rowCount : batch.length;
  }
  return written;
}

export async function insertEventObjects(
  client: SqlClient,
  dialect: SqlDialect,
  links: readonly CanonicalEventObject[],
  schema?: string,
): Promise<number> {
  const tables = eventLogTables(dialect, schema);
  let written = 0;

  if (client.bulkInsert !== undefined) {
    return client.bulkInsert(
      { table: EVENT_OBJECTS_TABLE, schema, columns: OBJECT_COLUMNS },
      links.map((l) => [l.eventId, l.objectType, l.objectId]),
    );
  }

  for (let i = 0; i < links.length; i += INSERT_BATCH_SIZE) {
    const batch = links.slice(i, i + INSERT_BATCH_SIZE);
    const params: unknown[] = [];
    const tuples = batch.map((l) => {
      const cells = [
        placeholderFor(dialect, params, l.eventId),
        placeholderFor(dialect, params, l.objectType),
        placeholderFor(dialect, params, l.objectId),
      ];
      return `(${cells.join(', ')})`;
    });
    const { rowCount } = await client.execute(
      `INSERT INTO ${tables.objects} (event_id, object_type, object_id) VALUES ${tuples.join(', ')}`,
      params,
    );
    written += rowCount > 0 ? rowCount : batch.length;
  }
  return written;
}

export async function insertCaseAttributes(
  client: SqlClient,
  dialect: SqlDialect,
  attrs: readonly CanonicalCaseAttribute[],
  schema?: string,
): Promise<number> {
  const tables = eventLogTables(dialect, schema);
  let written = 0;

  if (client.bulkInsert !== undefined) {
    return client.bulkInsert(
      { table: CASE_ATTRS_TABLE, schema, columns: CASE_ATTR_COLUMNS },
      attrs.map((a) => [a.objectType, a.objectId, a.key, a.value]),
    );
  }

  for (let i = 0; i < attrs.length; i += INSERT_BATCH_SIZE) {
    const batch = attrs.slice(i, i + INSERT_BATCH_SIZE);
    const params: unknown[] = [];
    const tuples = batch.map((a) => {
      const cells = [
        placeholderFor(dialect, params, a.objectType),
        placeholderFor(dialect, params, a.objectId),
        placeholderFor(dialect, params, a.key),
        placeholderFor(dialect, params, a.value),
      ];
      return `(${cells.join(', ')})`;
    });
    const { rowCount } = await client.execute(
      `INSERT INTO ${tables.caseAttrs} (object_type, object_id, key, value) VALUES ${tuples.join(', ')}`,
      params,
    );
    written += rowCount > 0 ? rowCount : batch.length;
  }
  return written;
}

function placeholderFor(dialect: SqlDialect, params: unknown[], value: unknown): string {
  params.push(value);
  return dialect.placeholder(params.length);
}

function timestampPlaceholderFor(dialect: SqlDialect, params: unknown[], value: Date): string {
  params.push(dialect.timestampParam(value));
  return dialect.timestampPlaceholder(params.length);
}

/**
 * Canonical event ordering within a case, qualified by a table alias.
 *
 * Lives here rather than in logquery so that filter predicates — which build
 * correlated subqueries over the raw tables — can order events exactly as the
 * projected log does. Two orderings would mean the sequence a variant filter
 * matches against is not the sequence the variant list displayed.
 *
 * The alias is required in a correlated subquery: `malkom_event_objects` also
 * has an `event_id`, so a bare column reference is ambiguous rather than wrong,
 * and the database says so at parse time.
 */
export function eventOrderBy(alias: string): string {
  const p = alias === '' ? '' : `${alias}.`;
  return `${p}ts, CASE lower(COALESCE(${p}lifecycle, ''))
    WHEN 'schedule' THEN 0
    WHEN 'assign'   THEN 1
    WHEN 'start'    THEN 2
    WHEN ''         THEN 3
    WHEN 'complete' THEN 4
    ELSE 5 END, ${p}event_id`;
}

// ---------------------------------------------------------------------------
// The pivot
// ---------------------------------------------------------------------------

/**
 * A SELECT producing (case_id, activity, ts, lifecycle, resource, duration_s)
 * for one object type — the flat, ordinary, case-centric event log every
 * algorithm downstream consumes.
 *
 * Changing `objectType` re-projects the SAME materialised events onto a
 * different case notion. No re-extraction, no second stream.
 */
export type Perspective =
  /** The recorded step. The default, and what "process map" normally means. */
  | { kind: 'activity' }
  /** Who did it — the map becomes a picture of people rather than steps. */
  | { kind: 'resource' }
  /** Any event-scoped attribute: a role, a status, a business object state. */
  | { kind: 'attribute'; key: string };

/**
 * Label for events the chosen perspective cannot name.
 *
 * Such events are LABELLED, never dropped. Removing them would close the gap
 * they left, so the two events either side would appear to follow one another
 * directly — an arc the log does not contain. A visible "(unassigned)" node is
 * an honest description of a real hole in the data; a silent bridge is a
 * fabrication that looks like a finding.
 */
export const UNKNOWN_LABEL = '(unassigned)';

/**
 * The expression naming an event under a given perspective.
 *
 * Shared by the projection and by sequence-aware filters, so that clicking a
 * variant while looking at the resource perspective filters on the sequence of
 * PEOPLE that was displayed, not on the sequence of activities underneath it.
 */
export function perspectiveExpr(
  perspective: Perspective | undefined,
  alias: string,
  dialect: SqlDialect,
  params: unknown[],
): string {
  const p = alias === '' ? '' : `${alias}.`;
  const wrap = (expr: string): string => {
    params.push(UNKNOWN_LABEL);
    return `COALESCE(${expr}, ${dialect.placeholder(params.length)})`;
  };
  switch (perspective?.kind) {
    case undefined:
    case 'activity':
      return `${p}activity`;
    case 'resource':
      return wrap(`${p}resource`);
    case 'attribute':
      return wrap(dialect.jsonField(`${p}attributes`, perspective.key, params));
  }
}

/**
 * What an already-built store actually supports.
 *
 * `cost` arrived after the table shipped. A store written by an earlier
 * version does not have the column, and read paths open READ-ONLY on purpose —
 * so they cannot migrate it, and must not assume it. Probing once and
 * projecting a typed NULL where it is missing keeps every existing store
 * working, and keeps "this log has no cost" as a fact about the data rather
 * than a crash.
 */
export interface LogCapabilities {
  cost: boolean;
}

export async function detectCapabilities(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<LogCapabilities> {
  const { text, params } = dialect.columnsQuery(schema, EVENTS_TABLE);
  const { rows } = await client.query(text, params);
  return { cost: rows.some((r) => String(r['name']).toLowerCase() === 'cost') };
}

export function projectedLogSql(
  tables: EventLogTables,
  objectType: string,
  params: unknown[],
  dialect: SqlDialect,
  perspective?: Perspective,
  capabilities?: LogCapabilities,
): string {
  // The perspective's parameters must be pushed before the object type's, in
  // the order the SELECT references them — numbered placeholders bind by
  // position, so building the list out of order is a silent misalignment.
  const activity = perspectiveExpr(perspective, 'e', dialect, params);
  params.push(objectType);
  const typeParam = dialect.placeholder(params.length);
  return `SELECT o.object_id AS case_id,
                 ${activity}  AS activity,
                 e.ts        AS ts,
                 e.lifecycle AS lifecycle,
                 e.resource  AS resource,
                 e.duration_s AS duration_s,
                 ${capabilities?.cost === true ? 'e.cost' : 'CAST(NULL AS DOUBLE)'} AS cost,
                 e.event_id  AS event_id
          FROM ${tables.events} e
          JOIN ${tables.objects} o ON o.event_id = e.event_id
          WHERE o.object_type = ${typeParam}`;
}

/** Object types present in a materialised log, with how many events each covers. */
/**
 * The case attributes this log actually carries, per case notion.
 *
 * Anything that segments a population — channel, region, customer type — is
 * one of these, and every analysis that takes an attribute name needs a list
 * to offer. Without one the caller has to ask somebody to type a column name
 * from memory, which is the thing the whole discovery path exists to avoid.
 *
 * Counted rather than merely listed: an attribute present on four of nine
 * thousand cases will segment nothing, and the count is what lets a caller
 * say so instead of drawing an almost-empty chart.
 */
export async function availableCaseAttributes(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<{ objectType: string; key: string; cases: number; values: number }[]> {
  const tables = eventLogTables(dialect, schema);
  const { rows } = await client.query(
    `SELECT object_type, key, COUNT(DISTINCT object_id) AS cases, COUNT(DISTINCT value) AS values
     FROM ${tables.caseAttrs}
     GROUP BY object_type, key
     ORDER BY object_type, cases DESC, key`,
    [],
  );
  return rows.map((r) => ({
    objectType: String(r['object_type']),
    key: String(r['key']),
    cases: Number(r['cases']),
    values: Number(r['values']),
  }));
}

export async function availableObjectTypes(
  client: SqlClient,
  dialect: SqlDialect,
  schema?: string,
): Promise<{ objectType: string; events: number; objects: number }[]> {
  const tables = eventLogTables(dialect, schema);
  const { rows } = await client.query(
    `SELECT object_type, COUNT(*) AS events, COUNT(DISTINCT object_id) AS objects
     FROM ${tables.objects} GROUP BY object_type ORDER BY object_type`,
    [],
  );
  return rows.map((r) => ({
    objectType: String(r['object_type']),
    events: Number(r['events']),
    objects: Number(r['objects']),
  }));
}
