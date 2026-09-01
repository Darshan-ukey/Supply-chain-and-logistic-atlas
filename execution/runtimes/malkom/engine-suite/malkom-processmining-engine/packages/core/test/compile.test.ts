import { afterEach, describe, expect, it } from 'vitest';
import { filterExprSchema, sourceBindingSchema, type FilterExpr } from '../src/config/schemas.js';
import { UnsupportedError } from '../src/domain/errors.js';
import {
  activityExpr,
  andAll,
  caseKeyExpr,
  compileFilter,
  eventTimestamps,
  fromClause,
  ParamBuilder,
  quoteColumn,
  timestampExpr,
  whereClause,
} from '../src/sql/compile.js';
import { relationInputSchema, type Relation } from '../src/config/relation.js';
import { duckdbDialect, postgresDialect, requireDialect } from '../src/sql/dialect.js';
import type { SqlClient } from '../src/ports/sql.js';
import { openMemoryDuckDB, seedWorkEvents } from './helpers/duckdb.js';

/** Single table aliased 't', so expected SQL reads "t"."col". */
const REL: Relation = relationInputSchema.parse({ name: 't' });

function compile(expr: unknown, dialect = postgresDialect): { text: string; params: unknown[] } {
  const parsed: FilterExpr = filterExprSchema.parse(expr);
  const params = new ParamBuilder(dialect);
  const text = compileFilter(parsed, dialect, params, REL);
  return { text, params: params.params };
}

describe('filter compilation', () => {
  it('binds values rather than interpolating them', () => {
    const { text, params } = compile({ op: 'eq', column: 'queueId', value: "BK'1001" });
    expect(text).toBe('("t"."queueId" = $1)');
    expect(params).toEqual(["BK'1001"]);
  });

  it('numbers placeholders sequentially across a nested expression', () => {
    const { text, params } = compile({
      op: 'and',
      args: [
        { op: 'eq', column: 'a', value: 1 },
        { op: 'or', args: [{ op: 'eq', column: 'b', value: 2 }, { op: 'eq', column: 'c', value: 3 }] },
      ],
    });
    expect(text).toBe('(("t"."a" = $1) AND (("t"."b" = $2) OR ("t"."c" = $3)))');
    expect(params).toEqual([1, 2, 3]);
  });

  it('uses numbered placeholders for DuckDB, not positional ones', () => {
    // Positional '?' binds by order of appearance in the SQL text, which
    // breaks as soon as a query is assembled from fragments out of order.
    const { text, params } = compile(
      { op: 'and', args: [{ op: 'eq', column: 'a', value: 1 }, { op: 'eq', column: 'b', value: 2 }] },
      duckdbDialect,
    );
    expect(text).toBe('(("t"."a" = $1) AND ("t"."b" = $2))');
    expect(params).toEqual([1, 2]);
  });

  it('expands IN to one placeholder per value', () => {
    const { text, params } = compile({ op: 'in', column: 'state', values: ['A', 'B', 'C'] });
    expect(text).toBe('("t"."state" IN ($1, $2, $3))');
    expect(params).toEqual(['A', 'B', 'C']);
  });

  it('negates notIn without a second traversal', () => {
    const { text } = compile({ op: 'notIn', column: 'state', values: ['A'] });
    expect(text).toBe('("t"."state" NOT IN ($1))');
  });

  it('reads eq-null as IS NULL, because SQL = NULL matches nothing', () => {
    const { text, params } = compile({ op: 'eq', column: 'completedOn', value: null });
    expect(text).toBe('("t"."completedOn" IS NULL)');
    expect(params).toEqual([]);
  });

  it('reads neq-null as IS NOT NULL', () => {
    const { text } = compile({ op: 'neq', column: 'completedOn', value: null });
    expect(text).toBe('("t"."completedOn" IS NOT NULL)');
  });

  it('refuses an ordering comparison against null instead of emitting dead SQL', () => {
    const params = new ParamBuilder(postgresDialect);
    expect(() =>
      compileFilter({ op: 'gt', column: 'a', value: null } as FilterExpr, postgresDialect, params, REL),
    ).toThrow(UnsupportedError);
  });

  it('quotes identifiers defensively', () => {
    const { text } = compile({ op: 'isNull', column: 'weird_col$1' });
    expect(text).toBe('("t"."weird_col$1" IS NULL)');
  });

  it('rejects a non-identifier column at parse time', () => {
    expect(() => filterExprSchema.parse({ op: 'isNull', column: 'a; DROP TABLE t' })).toThrow();
  });
});

describe('predicate assembly', () => {
  it('drops undefined members', () => {
    expect(andAll(['a = 1', undefined, 'b = 2'])).toBe('(a = 1 AND b = 2)');
  });

  it('does not wrap a lone predicate', () => {
    expect(andAll([undefined, 'a = 1'])).toBe('a = 1');
  });

  it('returns undefined when nothing is left', () => {
    expect(andAll([undefined, undefined])).toBeUndefined();
    expect(whereClause(undefined)).toBe('');
  });
});

describe('role expressions', () => {
  const binding = sourceBindingSchema.parse({
    id: 'we',
    connectionRef: 'ops',
    from: { schema: 'ops', name: 'workEvents' },
    grain: 'interval',
    roles: {
      case: 'queueId',
      activity: ['subqueueId', 'transactionStateId'],
      start: 'allocatedOn',
      end: 'completedOn',
    },
    objects: [
      { type: 'booking', column: 'queueId' },
      { type: 'item', column: 'itemId' },
    ],
  });

  it('emits a single column for a one-column classifier', () => {
    const single = sourceBindingSchema.parse({
      ...binding,
      roles: { ...binding.roles, activity: 'subqueueId' },
    });
    expect(activityExpr(single.roles, postgresDialect, single.from)).toBe(
      'CAST("workEvents"."subqueueId" AS VARCHAR)',
    );
  });

  it('joins a composite classifier NULL-tolerantly', () => {
    expect(activityExpr(binding.roles, postgresDialect, binding.from)).toBe(
      `concat_ws(' · ', CAST("workEvents"."subqueueId" AS VARCHAR), CAST("workEvents"."transactionStateId" AS VARCHAR))`,
    );
  });

  it('lets an explicit case object override the case role', () => {
    expect(caseKeyExpr(binding, postgresDialect)).toBe('"workEvents"."queueId"');
    expect(caseKeyExpr(binding, postgresDialect, 'item')).toBe('"workEvents"."itemId"');
  });

  it('returns undefined for an object type this binding does not carry', () => {
    expect(caseKeyExpr(binding, postgresDialect, 'invoice')).toBeUndefined();
  });

  it('yields two ordered timestamps for interval grain', () => {
    const ts = eventTimestamps(binding, postgresDialect);
    expect(ts.map((t) => t.label)).toEqual(['start', 'complete']);
  });

  it('yields none for snapshot grain, which has no history to give', () => {
    const snapshot = sourceBindingSchema.parse({
      id: 'b',
      connectionRef: 'ops',
      from: { name: 'bookings' },
      grain: 'snapshot',
      roles: { case: 'ref' },
      attributes: ['channel'],
    });
    expect(eventTimestamps(snapshot, postgresDialect)).toEqual([]);
  });

  it('qualifies a schema-bearing table in both dialects', () => {
    expect(postgresDialect.qualifyTable(binding.from.table)).toBe('"ops"."workEvents"');
    expect(duckdbDialect.qualifyTable(binding.from.table)).toBe('"ops"."workEvents"');
  });

  it('interprets a naive local-time column in its declared zone', () => {
    const expr = timestampExpr({ column: 'localTs', tz: 'Asia/Kolkata' }, postgresDialect, REL);
    expect(expr).toBe(`(CAST("t"."localTs" AS timestamp) AT TIME ZONE 'Asia/Kolkata')`);
  });

  it('casts a plain timestamp column without a zone', () => {
    expect(timestampExpr({ column: 'ts' }, postgresDialect, REL)).toBe('CAST("t"."ts" AS timestamptz)');
  });
});

describe('dialect registry', () => {
  it('resolves the two shipped dialects', () => {
    expect(requireDialect('postgres').name).toBe('postgres');
    expect(requireDialect('duckdb').name).toBe('duckdb');
  });

  it('names the alternatives when asked for an unknown dialect', () => {
    expect(() => requireDialect('oracle')).toThrow(/duckdb, postgres/);
  });
});

const WORK_EVENTS_REL: Relation = relationInputSchema.parse({ name: 'workEvents' });

describe('generated SQL actually executes', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('runs a compiled predicate against a real DuckDB', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);

    const params = new ParamBuilder(duckdbDialect);
    const predicate = compileFilter(
      filterExprSchema.parse({
        op: 'and',
        args: [
          { op: 'in', column: 'transactionStateId', values: ['Processed', 'Query'] },
          { op: 'isNotNull', column: 'completedOn' },
        ],
      }),
      duckdbDialect,
      params,
      WORK_EVENTS_REL,
    );

    const { rows } = await client.query(
      `SELECT COUNT(*) AS n FROM ${fromClause(WORK_EVENTS_REL, duckdbDialect)}${whereClause(predicate)}`,
      params.params,
    );
    // Processed: ids 2, 4, 7, 8, 9, 10, 11, 12 — Query: id 6
    expect(Number(rows[0]?.['n'])).toBe(9);
  });

  it('applies a composite classifier in a real GROUP BY', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);

    const binding = sourceBindingSchema.parse({
      id: 'we',
      connectionRef: 'ops',
      from: { name: 'workEvents' },
      grain: 'interval',
      roles: {
        case: 'queueId',
        activity: ['subqueueId', 'transactionStateId'],
        start: 'allocatedOn',
        end: 'completedOn',
      },
    });
    const expr = activityExpr(binding.roles, duckdbDialect, binding.from)!;
    const { rows } = await client.query(
      `SELECT ${expr} AS activity, COUNT(*) AS n FROM ${fromClause(binding.from, duckdbDialect)} GROUP BY 1 ORDER BY 1`,
      [],
    );
    expect(rows.map((r) => r['activity'])).toContain('New · Indexed');
    expect(rows).toHaveLength(6);
  });
});
