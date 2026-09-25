import { AdapterError, ConfigInvalidError, looksLikeSchemaError } from '../domain/errors.js';
import { IDENTIFIER_RE, type Scalar } from '../domain/filter.js';
import type { CompiledRegistry } from '../domain/registry.js';
import type { FactQuery, FactSourcePort } from '../ports/factsource.js';
import { noopLogger, type Logger } from '../ports/logger.js';
import type { SqlClient, SqlIntrospector } from '../ports/sql.js';
import type { ConnectionRegistry } from './connections.js';
import type { SqlDialect } from './dialect.js';

/**
 * The SQL fact-fetch path: for registry entities bound to a table +
 * connectionRef, build ONE parameterized, dialect-quoted SELECT per formula
 * source.
 *
 * DESIGN DECISION — row-filter pushdown only. The WHERE clause carries scope
 * equality and the event-anchor range, nothing else; aggregation happens in
 * the pure evaluation core, because exclusion counting and derived
 * business-time fields make SQL aggregation incorrect in general. Scope +
 * anchor predicates are simple enough to build directly against the M0
 * dialect layer — the alloc engine's full FilterExpr compiler is deliberately
 * NOT ported.
 *
 * Safety: identifiers are regex-validated and dialect-quoted; every value is
 * a bound parameter pushed in the exact order its placeholder appears in the
 * SQL text (a '?'-dialect binds by position — the alloc engine once shipped a
 * real bug by compiling out of order).
 */

/** Ordered parameter sink — placeholder text is emitted at push time, so $n indices stay correct. */
class Params {
  readonly values: unknown[] = [];
  constructor(private readonly dialect: SqlDialect) {}
  add(v: unknown): string {
    this.values.push(v);
    return this.dialect.placeholder(this.values.length);
  }
}

/** Defense-in-depth: the registry schemas already enforce this grammar. */
function checkedIdent(name: string, what: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new ConfigInvalidError(`${what} ${JSON.stringify(name)} is not a plain SQL identifier`);
  }
  return name;
}

export interface FactSelect {
  text: string;
  params: unknown[];
}

/**
 * Build the SELECT for one FactQuery against one bound entity. Projection is
 * exactly `q.fields`, mapped through the registry's `column` renames and
 * aliased back to field ids, so the evaluation core sees registry vocabulary
 * regardless of physical names. Anchor bounds are bound through the dialect's
 * timestamp formatter; the LIMIT is a bound parameter like everything else.
 */
export function buildFactSelect(q: FactQuery, registry: CompiledRegistry, dialect: SqlDialect): FactSelect {
  const entity = registry.entity(q.entity);
  if (entity === undefined) {
    throw new ConfigInvalidError(`buildFactSelect: entity "${q.entity}" is not registered`);
  }
  if (entity.table === undefined) {
    throw new ConfigInvalidError(`buildFactSelect: entity "${q.entity}" has no table binding`);
  }

  const columnOf = (field: string): string => {
    const column = registry.columnFor(q.entity, field);
    if (column === undefined) {
      throw new ConfigInvalidError(`buildFactSelect: field "${field}" is not declared on entity "${q.entity}"`);
    }
    return checkedIdent(column, `column for field "${field}"`);
  };

  if (q.fields.length === 0) {
    throw new ConfigInvalidError(`buildFactSelect: empty projection for entity "${q.entity}"`);
  }
  const cols = q.fields.map((f) => `${dialect.quoteIdent(columnOf(f))} AS ${dialect.quoteIdent(checkedIdent(f, 'field'))}`);

  // WHERE parts are emitted — and their parameters pushed — in text order.
  const p = new Params(dialect);
  const where: string[] = [];
  if (q.scope !== undefined) {
    for (const field of Object.keys(q.scope).sort()) {
      const value = q.scope[field] as Scalar;
      const col = dialect.quoteIdent(columnOf(field));
      where.push(value === null ? `${col} IS NULL` : `${col} = ${p.add(value)}`);
    }
  }
  if (q.anchor !== undefined) {
    // deferred: anchor encoding normalization — the bounds are ISO-8601 UTC
    // TEXT (dialect.formatTimestamp), so the anchor column must hold the same
    // encoding; epoch-INTEGER or naive-local columns break silently. Tier-2
    // flags numeric anchor columns (anchor_encoding_suspect); see README
    // "SQL table bindings".
    const col = dialect.quoteIdent(columnOf(q.anchor.field));
    where.push(`${col} >= ${p.add(dialect.formatTimestamp(new Date(q.anchor.startIso)))}`);
    where.push(`${col} < ${p.add(dialect.formatTimestamp(new Date(q.anchor.endIso)))}`);
  }

  const text =
    `SELECT ${cols.join(', ')} FROM ${dialect.qualifyTable(entity.table)}` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` LIMIT ${p.add(q.limit)}`;
  return { text, params: p.values };
}

/**
 * FactSourcePort over the M0 SQL substrate: resolves the entity's
 * connectionRef through the ConnectionRegistry, builds the parameterized
 * SELECT, and returns rows keyed by field ids. Driver failures surface as
 * AdapterError, flagged as schema-class when they smell like drift.
 */
export class SqlFactSource implements FactSourcePort {
  constructor(
    private readonly connections: ConnectionRegistry,
    private readonly registry: CompiledRegistry,
    /** Driver failures log their FULL detail here; default noop (library callers see .message). */
    private readonly logger: Logger = noopLogger,
  ) {}

  async fetchFacts(q: FactQuery): Promise<ReadonlyArray<Record<string, unknown>>> {
    const entity = this.registry.entity(q.entity);
    if (entity === undefined) {
      throw new ConfigInvalidError(`fetchFacts: entity "${q.entity}" is not registered`);
    }
    if (entity.connectionRef === undefined || entity.table === undefined) {
      throw new ConfigInvalidError(
        `fetchFacts: entity "${q.entity}" has no table + connectionRef binding — bind it in the registry or supply a FactSourcePort`,
      );
    }
    const { client, dialect } = await this.connections.resolve(entity.connectionRef);
    const { text, params } = buildFactSelect(q, this.registry, dialect);
    try {
      const { rows } = await client.query(text, params);
      return rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The full driver detail belongs in the ENGINE log; the HTTP boundary
      // serializes AdapterError generically (driver text carries schema and
      // connection intel that read-scoped callers must not see).
      this.logger.error(
        { entity: q.entity, connection: entity.connectionRef, err: message },
        'fact fetch failed',
      );
      throw new AdapterError(`fact fetch for entity "${q.entity}" failed: ${message}`, {
        schemaClass: looksLikeSchemaError(err),
        entity: q.entity,
      });
    }
  }
}

/**
 * The dialect-backed SqlIntrospector — column inventory via the dialect's
 * information-schema query. Powers tier-2 validation (validateMetricLive).
 */
export function dialectIntrospector(dialect: SqlDialect): SqlIntrospector {
  return {
    async tableColumns(client: SqlClient, schema: string | undefined, table: string) {
      const q = dialect.columnsQuery(schema, table);
      const { rows } = await client.query(q.text, q.params);
      return rows.map((r) => ({ name: String(r['name']), dataType: String(r['data_type'] ?? '') }));
    },
  };
}
