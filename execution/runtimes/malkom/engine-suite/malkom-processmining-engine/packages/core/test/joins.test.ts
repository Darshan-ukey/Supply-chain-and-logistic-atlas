import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sourceBindingSchema } from '../src/config/schemas.js';
import { relationInputSchema } from '../src/config/relation.js';
import { isValid, validateBinding } from '../src/config/validate.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect, postgresDialect } from '../src/sql/dialect.js';
import { fromClause } from '../src/sql/compile.js';
import { profileBinding, profileIsUsable } from '../src/runtime/profile.js';
import { execAll, openMemoryDuckDB } from './helpers/duckdb.js';

/**
 * The engine follows the host. A host whose data is spread across tables says
 * so declaratively, and joining it is then the engine's problem — not the
 * host's, and certainly not a reason to reshape its schema.
 *
 * The fixture deliberately uses names from no particular domain: a `steps`
 * table with the timestamps, a `cases` header carrying the business reference,
 * and a `people` lookup holding the resource's display name. Nothing about
 * these names appears anywhere in the engine.
 */

const DDL = [
  `CREATE TABLE "cases" (
     "case_pk"   INTEGER PRIMARY KEY,
     "reference" VARCHAR,
     "segment"   VARCHAR
   )`,
  `CREATE TABLE "people" (
     "person_pk" INTEGER PRIMARY KEY,
     "full_name" VARCHAR,
     "team"      VARCHAR
   )`,
  `CREATE TABLE "steps" (
     "step_pk"    INTEGER PRIMARY KEY,
     "case_fk"    INTEGER,
     "person_fk"  INTEGER,
     "step_name"  VARCHAR,
     "status"     VARCHAR,
     "started_at" TIMESTAMPTZ,
     "ended_at"   TIMESTAMPTZ
   )`,
  `INSERT INTO "cases" VALUES (1, 'REF-001', 'retail'), (2, 'REF-002', 'corporate')`,
  `INSERT INTO "people" VALUES (10, 'Priya N', 'ops'), (11, 'Sam T', 'ops'), (12, 'Ravi K', 'risk')`,
  `INSERT INTO "steps" VALUES
     (1, 1, 10, 'Intake',  'done', '2026-04-01T09:00:00Z', '2026-04-01T09:20:00Z'),
     (2, 1, 11, 'Review',  'done', '2026-04-01T10:00:00Z', '2026-04-01T10:45:00Z'),
     (3, 1, 12, 'Approve', 'done', '2026-04-01T11:00:00Z', '2026-04-01T11:05:00Z'),
     (4, 2, 10, 'Intake',  'done', '2026-04-02T09:00:00Z', '2026-04-02T09:15:00Z'),
     (5, 2, 12, 'Approve', 'done', '2026-04-02T12:00:00Z', '2026-04-02T12:10:00Z')`,
];

/**
 * Case reference lives on `cases`, resource NAME on `people`, timestamps on
 * `steps`. None of it is minable without a join — which is the point.
 */
function joinedBinding(overrides: Record<string, unknown> = {}) {
  return sourceBindingSchema.parse({
    id: 'steps',
    connectionRef: 'ops',
    from: {
      table: { name: 'steps' },
      alias: 's',
      joins: [
        {
          table: { name: 'cases' },
          alias: 'c',
          type: 'left',
          on: [{ leftAlias: 's', leftColumn: 'case_fk', rightAlias: 'c', rightColumn: 'case_pk' }],
        },
        {
          table: { name: 'people' },
          alias: 'p',
          type: 'left',
          on: [{ leftAlias: 's', leftColumn: 'person_fk', rightAlias: 'p', rightColumn: 'person_pk' }],
        },
      ],
    },
    grain: 'interval',
    roles: {
      case: 'c.reference',
      activity: ['s.step_name', 's.status'],
      resource: 'p.full_name',
      start: 's.started_at',
      end: 's.ended_at',
    },
    objects: [{ type: 'application', column: 'c.reference' }],
    attributes: [{ column: 'c.segment', scope: 'case' }, { column: 'p.team' }],
    ...overrides,
  });
}

describe('a binding can span joined tables', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = await openMemoryDuckDB();
    await execAll(client, DDL);
  });

  afterEach(async () => {
    await client.close();
  });

  it('profiles a source whose columns come from three tables', async () => {
    const profile = await profileBinding(client, duckdbDialect, joinedBinding());

    expect(profile.rowCount).toBe(5);
    expect(profile.caseCount).toBe(2); // REF-001, REF-002 — from the joined header
    expect(profile.eventCount).toBe(10); // interval grain
    // Intake·done, Review·done, Approve·done
    expect(profile.activityCount).toBe(3);
    // Resource names resolved through the lookup, not raw foreign keys.
    expect(profile.resourceCount).toBe(3);
    expect(profileIsUsable(profile)).toBe(true);
  });

  it('reports the case column with its alias so the source is traceable', async () => {
    const profile = await profileBinding(client, duckdbDialect, joinedBinding());
    expect(profile.caseColumn).toBe('c.reference');
  });

  it('pivots onto an object whose id lives on a joined table', async () => {
    const profile = await profileBinding(client, duckdbDialect, joinedBinding(), {
      caseObject: 'application',
    });
    expect(profile.caseColumn).toBe('c.reference');
    expect(profile.caseCount).toBe(2);
  });

  it('pushes a filter on a joined column into SQL', async () => {
    const profile = await profileBinding(client, duckdbDialect, joinedBinding(), {
      extraWhere: { op: 'eq', column: 'c.segment', value: 'retail' },
    });
    expect(profile.rowCount).toBe(3); // REF-001 only
    expect(profile.caseCount).toBe(1);
  });

  it('still accepts a bare table reference for the single-table case', async () => {
    // The shorthand has to keep working, or every existing binding breaks.
    const single = sourceBindingSchema.parse({
      id: 'steps-only',
      connectionRef: 'ops',
      from: { name: 'steps' },
      grain: 'interval',
      roles: {
        case: 'case_fk',
        activity: 'step_name',
        start: 'started_at',
        end: 'ended_at',
      },
    });
    const profile = await profileBinding(client, duckdbDialect, single);
    expect(profile.rowCount).toBe(5);
    expect(profile.caseCount).toBe(2);
  });
});

describe('FROM clause construction', () => {
  it('builds a left join by default', () => {
    const relation = relationInputSchema.parse({
      table: { schema: 'ops', name: 'steps' },
      alias: 's',
      joins: [
        {
          table: { name: 'people' },
          alias: 'p',
          on: [{ leftAlias: 's', leftColumn: 'person_fk', rightAlias: 'p', rightColumn: 'person_pk' }],
        },
      ],
    });
    expect(fromClause(relation, postgresDialect)).toBe(
      '"ops"."steps" AS "s" LEFT JOIN "people" AS "p" ON "s"."person_fk" = "p"."person_pk"',
    );
  });

  it('supports composite join keys', () => {
    const relation = relationInputSchema.parse({
      table: { name: 'a' },
      alias: 'a',
      joins: [
        {
          table: { name: 'b' },
          alias: 'b',
          type: 'inner',
          on: [
            { leftAlias: 'a', leftColumn: 'k1', rightAlias: 'b', rightColumn: 'k1' },
            { leftAlias: 'a', leftColumn: 'k2', rightAlias: 'b', rightColumn: 'k2' },
          ],
        },
      ],
    });
    expect(fromClause(relation, postgresDialect)).toBe(
      '"a" AS "a" INNER JOIN "b" AS "b" ON "a"."k1" = "b"."k1" AND "a"."k2" = "b"."k2"',
    );
  });

  it('defaults the base alias to the table name', () => {
    expect(fromClause(relationInputSchema.parse({ name: 'steps' }), postgresDialect)).toBe(
      '"steps" AS "steps"',
    );
  });

  it('quotes every identifier, so an odd table name cannot break out', () => {
    const relation = relationInputSchema.parse({ table: { name: 'weird$name' }, alias: 'w' });
    expect(fromClause(relation, postgresDialect)).toBe('"weird$name" AS "w"');
  });
});

describe('join configuration is validated before it reaches SQL', () => {
  it('accepts a well-formed joined binding', () => {
    expect(isValid(validateBinding(joinedBinding()))).toBe(true);
  });

  it('rejects a column naming an alias that is not in the relation', () => {
    const result = validateBinding(
      joinedBinding({
        roles: { ...joinedBinding().roles, resource: 'zzz.full_name' },
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_ALIAS');
    expect(result.errors.find((e) => e.code === 'UNKNOWN_ALIAS')?.message).toContain('s, c, p');
  });

  it('rejects a join key referencing a table not yet joined', () => {
    const result = validateBinding(
      joinedBinding({
        from: {
          table: { name: 'steps' },
          alias: 's',
          joins: [
            {
              table: { name: 'cases' },
              alias: 'c',
              // 'p' is joined later, so it cannot be referenced here.
              on: [{ leftAlias: 'p', leftColumn: 'x', rightAlias: 'c', rightColumn: 'case_pk' }],
            },
          ],
        },
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_ALIAS');
  });

  it('rejects a duplicate alias', () => {
    const result = validateBinding(
      joinedBinding({
        from: {
          table: { name: 'steps' },
          alias: 's',
          joins: [
            {
              table: { name: 'cases' },
              alias: 's', // collides with the base
              on: [{ leftAlias: 's', leftColumn: 'case_fk', rightAlias: 's', rightColumn: 'case_pk' }],
            },
          ],
        },
      }),
    );
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_ALIAS');
  });

  it('warns that an inner join silently drops events', () => {
    const result = validateBinding(
      joinedBinding({
        from: {
          table: { name: 'steps' },
          alias: 's',
          joins: [
            {
              table: { name: 'cases' },
              alias: 'c',
              type: 'inner',
              on: [{ leftAlias: 's', leftColumn: 'case_fk', rightAlias: 'c', rightColumn: 'case_pk' }],
            },
            {
              table: { name: 'people' },
              alias: 'p',
              on: [
                { leftAlias: 's', leftColumn: 'person_fk', rightAlias: 'p', rightColumn: 'person_pk' },
              ],
            },
          ],
        },
      }),
    );
    expect(isValid(result)).toBe(true); // legal, just lossy
    const warning = result.warnings.find((w) => w.code === 'INNER_JOIN_DROPS_EVENTS');
    expect(warning?.message).toContain('cleaner than it is');
  });

  it('rejects a binding whose roles reference a table it forgot to join', () => {
    // The mirror of the case above: dropping the people join while roles still
    // read p.full_name must fail at config time, not as an opaque SQL error.
    const result = validateBinding(
      joinedBinding({
        from: {
          table: { name: 'steps' },
          alias: 's',
          joins: [
            {
              table: { name: 'cases' },
              alias: 'c',
              on: [{ leftAlias: 's', leftColumn: 'case_fk', rightAlias: 'c', rightColumn: 'case_pk' }],
            },
          ],
        },
      }),
    );
    expect(isValid(result)).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('UNKNOWN_ALIAS');
  });

  it('rejects a column reference that is not a plain identifier pair', () => {
    expect(() =>
      sourceBindingSchema.parse({
        ...joinedBinding(),
        roles: { ...joinedBinding().roles, case: 'c.reference; DROP TABLE cases' },
      }),
    ).toThrow();
  });
});

describe('an inner join really does lose events', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client.close();
  });

  it('keeps orphan rows under a left join and drops them under inner', async () => {
    client = await openMemoryDuckDB();
    await execAll(client, [
      ...DDL,
      // A step whose case header is missing — an orphan.
      `INSERT INTO "steps" VALUES (6, 99, 10, 'Intake', 'done', '2026-04-03T09:00:00Z', '2026-04-03T09:10:00Z')`,
    ]);

    const left = await profileBinding(client, duckdbDialect, joinedBinding());
    expect(left.rowCount).toBe(6); // the orphan survives, and is visible

    const innerJoined = joinedBinding({
      from: {
        table: { name: 'steps' },
        alias: 's',
        joins: [
          {
            table: { name: 'cases' },
            alias: 'c',
            type: 'inner',
            on: [{ leftAlias: 's', leftColumn: 'case_fk', rightAlias: 'c', rightColumn: 'case_pk' }],
          },
          {
            table: { name: 'people' },
            alias: 'p',
            on: [{ leftAlias: 's', leftColumn: 'person_fk', rightAlias: 'p', rightColumn: 'person_pk' }],
          },
        ],
      },
    });
    const inner = await profileBinding(client, duckdbDialect, innerJoined);
    expect(inner.rowCount).toBe(5); // the orphan vanished — hence the warning
  });
});
