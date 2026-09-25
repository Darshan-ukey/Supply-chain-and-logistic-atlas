import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sourceBindingSchema } from '../src/config/schemas.js';
import type { SqlClient } from '../src/ports/sql.js';
import { createPostgresClient } from '../src/sql/clients.js';
import { postgresDialect } from '../src/sql/dialect.js';
import { profileBinding, profileIsUsable } from '../src/runtime/profile.js';
import { noopLogger } from '../src/ports/logger.js';
import { SAMPLE_ROWS } from './helpers/duckdb.js';

/**
 * The Postgres extraction path, against a real server.
 *
 * Gated on MALKOM_TEST_PG_DSN rather than mocked: the whole value of this
 * suite is that Postgres genuinely returns COUNT(*) as a decimal STRING,
 * genuinely rejects a `FILTER (WHERE ...)` typo, and genuinely applies
 * `percentile_cont ... WITHIN GROUP` — none of which a stub would reproduce.
 * Skipped, loudly, when no DSN is configured.
 *
 *   MALKOM_TEST_PG_DSN=postgres://user:pass@localhost:5432/postgres npm test
 */

const DSN = process.env['MALKOM_TEST_PG_DSN'];
const SCHEMA = 'malkom_mining_test';

describe.skipIf(DSN === undefined || DSN === '')('Postgres extraction (live server)', () => {
  let client: SqlClient;

  beforeAll(async () => {
    client = await createPostgresClient(DSN!, { logger: noopLogger, poolMax: 2 });
    await client.execute(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`, []);
    await client.execute(`CREATE SCHEMA ${SCHEMA}`, []);
    await client.execute(
      `CREATE TABLE ${SCHEMA}."workEvents" (
         "id"                 BIGINT PRIMARY KEY,
         "queueId"            TEXT,
         "itemId"             TEXT,
         "subqueueId"         TEXT,
         "transactionStateId" TEXT,
         "allocatedTo"        TEXT,
         "allocatedOn"        TIMESTAMPTZ,
         "completedOn"        TIMESTAMPTZ,
         "aht"                DOUBLE PRECISION
       )`,
      [],
    );
    for (const r of SAMPLE_ROWS) {
      await client.execute(
        `INSERT INTO ${SCHEMA}."workEvents" VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          r.id,
          r.queueId,
          r.itemId,
          r.subqueueId,
          r.transactionStateId,
          r.allocatedTo,
          r.allocatedOn,
          r.completedOn,
          r.aht,
        ],
      );
    }
  });

  afterAll(async () => {
    if (client !== undefined) {
      await client.execute(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`, []);
      await client.close();
    }
  });

  const binding = sourceBindingSchema.parse({
    id: 'work-events',
    connectionRef: 'ops',
    from: { schema: SCHEMA, name: 'workEvents' },
    grain: 'interval',
    roles: {
      case: 'queueId',
      activity: ['subqueueId', 'transactionStateId'],
      resource: 'allocatedTo',
      start: 'allocatedOn',
      end: 'completedOn',
      duration: 'aht',
    },
    objects: [
      { type: 'booking', column: 'queueId' },
      { type: 'item', column: 'itemId' },
    ],
  });

  it('produces the same profile as DuckDB for the same data', async () => {
    const profile = await profileBinding(client, postgresDialect, binding);

    expect(profile.rowCount).toBe(SAMPLE_ROWS.length);
    expect(profile.caseCount).toBe(3);
    expect(profile.eventCount).toBe(SAMPLE_ROWS.length * 2);
    expect(profile.activityCount).toBe(6);
    expect(profile.resourceCount).toBe(3);
    expect(profile.rowsPerCase.median).toBeCloseTo(4, 5);
    expect(profile.rowsPerCase.max).toBe(5);
    expect(profileIsUsable(profile)).toBe(true);
  });

  it('coerces the decimal-string COUNT that node-postgres returns for int8', async () => {
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM ${SCHEMA}."workEvents"`, []);
    // pg refuses to guess at int8, so this arrives as a string. countOf handles it.
    expect(typeof rows[0]?.['n']).toBe('string');
  });

  it('pivots the case key onto another object type', async () => {
    const atItem = await profileBinding(client, postgresDialect, binding, { caseObject: 'item' });
    expect(atItem.caseColumn).toBe('itemId');
    expect(atItem.caseCount).toBe(7);
    expect(atItem.singleRowCases).toBe(5);
  });

  it('catches a per-row id used as the case key', async () => {
    const wrong = sourceBindingSchema.parse({
      ...binding,
      roles: { ...binding.roles, case: 'id' },
      objects: [],
    });
    const profile = await profileBinding(client, postgresDialect, wrong);
    expect(profile.findings.some((f) => f.code === 'SINGLE_ROW_CASES')).toBe(true);
    expect(profileIsUsable(profile)).toBe(false);
  });

  it('classifies a missing column as schema drift', async () => {
    const drifted = sourceBindingSchema.parse({
      ...binding,
      roles: { ...binding.roles, case: 'noSuchColumn' },
      objects: [],
    });
    await expect(profileBinding(client, postgresDialect, drifted)).rejects.toMatchObject({
      code: 'ADAPTER_ERROR',
      schemaClass: true,
      binding: 'work-events',
    });
  });
});
