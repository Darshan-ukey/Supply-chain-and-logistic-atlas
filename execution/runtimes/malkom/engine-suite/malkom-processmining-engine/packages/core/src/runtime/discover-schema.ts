import type { SqlClient } from '../ports/sql.js';
import type { SqlDialect } from '../sql/dialect.js';

/**
 * Reading the host's schema, so a person never has to type a table name.
 *
 * Configuring a mining binding by hand means knowing which table holds the
 * events, which column is the case key, and which of forty columns is the
 * timestamp. That is a developer's job description, and it is the reason
 * process mining tools have a reputation for needing a consultant.
 *
 * The engine can see all of it. Tables, columns, types, row counts and the
 * foreign keys between them are already in the catalog; reading them turns
 * configuration from typing into choosing, and lets the engine PROPOSE a
 * binding with its reasons rather than presenting an empty form.
 *
 * Everything here is read-only catalog access. No host row is read.
 */

export type ColumnKind = 'timestamp' | 'text' | 'number' | 'boolean' | 'json' | 'other';

export interface DiscoveredColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  /** Coarse kind, so a picker can offer only columns that could play a role. */
  kind: ColumnKind;
}

export interface ForeignKey {
  column: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
}

export interface DiscoveredTable {
  schema: string;
  name: string;
  columns: DiscoveredColumn[];
  /** Planner estimate, not a count. Cheap, and only used for ordering. */
  approxRows: number | null;
  foreignKeys: ForeignKey[];
}

export interface SchemaMap {
  tables: DiscoveredTable[];
}

/** Map a database type name onto something a picker can reason about. */
export function kindOf(dataType: string): ColumnKind {
  const type = dataType.toLowerCase();
  if (type.includes('timestamp') || type.includes('date') || type === 'time') return 'timestamp';
  if (type.includes('json')) return 'json';
  if (type === 'boolean' || type === 'bool') return 'boolean';
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('real') ||
    type.includes('double') ||
    type.includes('float')
  ) {
    return 'number';
  }
  if (type.includes('char') || type.includes('text') || type === 'uuid' || type.includes('enum')) {
    return 'text';
  }
  return 'other';
}

const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast'];

export interface DiscoverSchemaOptions {
  /** Restrict to these schemas. Default: everything that is not a system one. */
  schemas?: readonly string[];
  /** Cap on tables returned, largest first. Default 300. */
  limit?: number;
}

/**
 * Read the host catalog.
 *
 * Postgres-specific, because catalogs are: there is no portable way to ask for
 * foreign keys. A dialect without an implementation returns nothing rather
 * than throwing — the settings page then falls back to typing, which is worse
 * but still works.
 */
export async function discoverSchema(
  client: SqlClient,
  dialect: SqlDialect,
  opts: DiscoverSchemaOptions = {},
): Promise<SchemaMap> {
  if (dialect.name !== 'postgres') return { tables: [] };

  const limit = Math.max(1, Math.trunc(opts.limit ?? 300));
  const schemas = opts.schemas;

  const { rows: columnRows } = await client.query(
    `SELECT c.table_schema  AS schema,
            c.table_name    AS table_name,
            c.column_name   AS column_name,
            c.data_type     AS data_type,
            c.is_nullable   AS is_nullable,
            c.ordinal_position AS position
     FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE t.table_type = 'BASE TABLE'
       AND c.table_schema <> ALL($1)
       AND ($2::text[] IS NULL OR c.table_schema = ANY($2))
     ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
    [SYSTEM_SCHEMAS, schemas === undefined ? null : [...schemas]],
  );

  // Planner estimates rather than COUNT(*): a count on every table in a large
  // database is minutes of work to decide a display order.
  const { rows: sizeRows } = await client.query(
    `SELECT n.nspname AS schema, c.relname AS table_name, c.reltuples::bigint AS approx_rows
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r' AND n.nspname <> ALL($1)`,
    [SYSTEM_SCHEMAS],
  );
  // reltuples is -1 for a table the planner has never analysed, which is
  // "unknown" rather than "negative rows". Showing it raw would put "-1 rows"
  // in front of a person and destroy their trust in everything beside it.
  const sizes = new Map<string, number | null>();
  for (const row of sizeRows) {
    const estimate = Number(row['approx_rows']);
    sizes.set(
      `${String(row['schema'])}.${String(row['table_name'])}`,
      Number.isFinite(estimate) && estimate >= 0 ? estimate : null,
    );
  }

  const { rows: fkRows } = await client.query(
    `SELECT src_ns.nspname  AS schema,
            src.relname     AS table_name,
            src_col.attname AS column_name,
            tgt_ns.nspname  AS to_schema,
            tgt.relname     AS to_table,
            tgt_col.attname AS to_column
     FROM pg_constraint con
     JOIN pg_class src        ON src.oid = con.conrelid
     JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
     JOIN pg_class tgt        ON tgt.oid = con.confrelid
     JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
     JOIN LATERAL unnest(con.conkey)  WITH ORDINALITY AS sk(attnum, ord) ON TRUE
     JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS tk(attnum, ord) ON tk.ord = sk.ord
     JOIN pg_attribute src_col ON src_col.attrelid = src.oid AND src_col.attnum = sk.attnum
     JOIN pg_attribute tgt_col ON tgt_col.attrelid = tgt.oid AND tgt_col.attnum = tk.attnum
     WHERE con.contype = 'f' AND src_ns.nspname <> ALL($1)`,
    [SYSTEM_SCHEMAS],
  );

  const byTable = new Map<string, DiscoveredTable>();
  for (const row of columnRows) {
    const schema = String(row['schema']);
    const name = String(row['table_name']);
    const key = `${schema}.${name}`;
    let table = byTable.get(key);
    if (table === undefined) {
      table = {
        schema,
        name,
        columns: [],
        approxRows: sizes.get(key) ?? null,
        foreignKeys: [],
      };
      byTable.set(key, table);
    }
    const dataType = String(row['data_type']);
    table.columns.push({
      name: String(row['column_name']),
      dataType,
      nullable: String(row['is_nullable']).toUpperCase() === 'YES',
      kind: kindOf(dataType),
    });
  }

  for (const row of fkRows) {
    const table = byTable.get(`${String(row['schema'])}.${String(row['table_name'])}`);
    if (table === undefined) continue;
    table.foreignKeys.push({
      column: String(row['column_name']),
      toSchema: String(row['to_schema']),
      toTable: String(row['to_table']),
      toColumn: String(row['to_column']),
    });
  }

  const tables = [...byTable.values()]
    .sort((a, b) => (b.approxRows ?? 0) - (a.approxRows ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit);

  return { tables };
}

// ---------------------------------------------------------------------------
// Proposing a binding
// ---------------------------------------------------------------------------

export interface RoleGuess {
  column: string;
  /** Why this column, in a sentence a non-specialist can check. */
  because: string;
}

export interface BindingSuggestion {
  schema: string;
  table: string;
  /** 0–1. Ordering only — a person still confirms. */
  confidence: number;
  approxRows: number | null;
  caseKey: RoleGuess | null;
  timestamp: RoleGuess | null;
  activity: RoleGuess | null;
  resource: RoleGuess | null;
  /** A table worth joining for extra context, usually the case's own row. */
  joinTo: { schema: string; table: string; localColumn: string; foreignColumn: string } | null;
  /** Plain-language reasons, shown to the person choosing. */
  reasons: string[];
  /** What is missing, if anything. Stated rather than hidden. */
  missing: string[];
}

const CASE_HINTS = ['task_id', 'case_id', 'order_id', 'booking', 'reference', 'ref', 'correlation'];
const ACTIVITY_HINTS = ['type', 'event', 'action', 'activity', 'status', 'state', 'step', 'stage'];
const RESOURCE_HINTS = ['actor', 'user', 'agent', 'owner', 'assigned', 'performed_by', 'created_by'];
const TIME_HINTS = ['created', 'occurred', 'happened', 'timestamp', 'logged', 'at'];

/**
 * Split an identifier into its words, whatever convention wrote it.
 *
 * Half the databases in the world are snake_case and the other half are
 * camelCase, and a matcher that only understands one of them is blind to
 * every table in the other. `case_id`, `caseId`, `CaseID` and `case-id` are
 * the same word to a person, so they have to be the same word here: matching
 * `caseId` against the hint `case_id` as raw text fails, and the failure is
 * silent — the table simply never appears, with nothing on screen to say why.
 */
const words = (name: string): string[] =>
  name
    // Break an acronym off the word that follows it: XMLHttp -> XML Http.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // Then the ordinary camel hump: workItem -> work Item, workID -> work ID.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');

/** Whether `needle` appears in `hay` as a run of whole words. */
const containsPhrase = (hay: readonly string[], needle: readonly string[]): boolean => {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let start = 0; start <= hay.length - needle.length; start += 1) {
    let hit = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (hay[start + offset] !== needle[offset]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
};

/**
 * How strongly a column name suggests a role, 0 when it does not.
 *
 * Three tiers, weakest last: the whole name IS the hint, the hint appears in
 * it as whole words, or the hint appears in the run-together letters. The
 * third tier is what still catches `username` for the hint `user`; without it
 * the stricter word matching would be a regression on glued names.
 */
const scoreName = (name: string, hints: readonly string[]): number => {
  const nameWords = words(name);
  const phrase = nameWords.join(' ');
  const glued = nameWords.join('');
  for (const [index, hint] of hints.entries()) {
    const hintWords = words(hint);
    if (phrase === hintWords.join(' ')) return 1 - index * 0.02;
    if (containsPhrase(nameWords, hintWords)) return 0.8 - index * 0.02;
    if (glued.includes(hintWords.join(''))) return 0.6 - index * 0.02;
  }
  return 0;
};

/**
 * Propose bindings, best first, with reasons.
 *
 * The heuristic is deliberately simple and explainable: an event log is a
 * table with a timestamp, something that names what happened, and a reference
 * that repeats across rows. Every guess carries the sentence that justifies
 * it, because a suggestion a person cannot check is worse than no suggestion —
 * they would accept it, and the map would be quietly wrong.
 */
export function suggestBindings(schema: SchemaMap, limit?: number): BindingSuggestion[] {
  const suggestions: BindingSuggestion[] = [];

  for (const table of schema.tables) {
    const timestamps = table.columns.filter((c) => c.kind === 'timestamp');
    if (timestamps.length === 0) continue; // no time, no process

    const pickTime = timestamps
      .map((c) => ({ c, score: Math.max(scoreName(c.name, TIME_HINTS), 0.2) }))
      .sort((a, b) => b.score - a.score)[0]!;

    // The case key: a foreign key is the strongest signal there is — it says
    // this row belongs to something, and that something is the case.
    const fk = table.foreignKeys[0];
    const namedCase = table.columns
      .map((c) => ({ c, score: scoreName(c.name, CASE_HINTS) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    /**
     * Last resort: a column whose name ends in `id` and is not the row's own.
     *
     * `workItemId`, `orderID`, `request_ref_id` — the commonest case key in
     * the wild is simply the id of the thing the row is about, and no list of
     * hint words will ever contain every business noun somebody named a table
     * after. The row's own `id` is excluded on purpose: it is unique per row,
     * so grouping by it yields one event per case and draws a map with no
     * arrows on it.
     */
    const idColumn = table.columns.find((c) => {
      const parts = words(c.name);
      return parts.length > 1 && parts[parts.length - 1] === 'id';
    });

    const caseKey: RoleGuess | null =
      fk !== undefined
        ? {
            column: fk.column,
            because: `every row points at one ${fk.toTable} row, so that is what a case is`,
          }
        : namedCase !== undefined
          ? { column: namedCase.c.name, because: `the name suggests a reference that repeats per item` }
          : idColumn !== undefined
            ? {
                column: idColumn.name,
                because: `the name ends in id, so rows sharing it are one piece of work`,
              }
            : null;

    const activityCandidates = table.columns
      .filter((c) => c.kind === 'text' || c.kind === 'json')
      .map((c) => ({ c, score: scoreName(c.name, ACTIVITY_HINTS) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const activity: RoleGuess | null =
      activityCandidates[0] === undefined
        ? null
        : {
            column: activityCandidates[0].c.name,
            because: 'this column says what happened, which becomes a step on the map',
          };

    const resourceCandidate = table.columns
      .map((c) => ({ c, score: scoreName(c.name, RESOURCE_HINTS) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    const resource: RoleGuess | null =
      resourceCandidate === undefined
        ? null
        : { column: resourceCandidate.c.name, because: 'this looks like who did it' };

    const reasons: string[] = [];
    const missing: string[] = [];

    reasons.push(`${table.name} has a time column (${pickTime.c.name}), so its rows can be ordered`);
    if (caseKey !== null) reasons.push(`${caseKey.column} — ${caseKey.because}`);
    else missing.push('nothing obviously groups rows into one case — you will need to pick that');
    if (activity !== null) reasons.push(`${activity.column} — ${activity.because}`);
    else missing.push('no column obviously says what happened');
    if (resource !== null) reasons.push(`${resource.column} — ${resource.because}`);
    else missing.push('no column names who did the work, so the people view will be unavailable');

    // Rows-per-case is what separates an event log from a list of things: a
    // table with one row per item has no process in it.
    const confidence =
      (caseKey !== null ? 0.4 : 0) +
      (activity !== null ? 0.3 : 0) +
      0.2 +
      (resource !== null ? 0.1 : 0);

    suggestions.push({
      schema: table.schema,
      table: table.name,
      confidence,
      approxRows: table.approxRows,
      caseKey,
      timestamp: {
        column: pickTime.c.name,
        because: 'this is when it happened, which is what puts steps in order',
      },
      activity,
      resource,
      joinTo:
        fk === undefined
          ? null
          : {
              schema: fk.toSchema,
              table: fk.toTable,
              localColumn: fk.column,
              foreignColumn: fk.toColumn,
            },
      reasons,
      missing,
    });
  }

  // Ranked, and by default ALL of them. A cap here is a table somebody cannot
  // choose, with nothing on screen to say it was left out — deciding how many
  // to show at once belongs to whatever is doing the showing.
  const ranked = suggestions.sort(
    (a, b) => b.confidence - a.confidence || (b.approxRows ?? 0) - (a.approxRows ?? 0),
  );
  return limit === undefined ? ranked : ranked.slice(0, Math.max(1, Math.trunc(limit)));
}
