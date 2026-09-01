import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sourceBindingSchema } from '../src/config/schemas.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { profileBinding, profileIsUsable } from '../src/runtime/profile.js';
import { openMemoryDuckDB, seedWorkEvents, SAMPLE_ROWS } from './helpers/duckdb.js';

/**
 * Profiler tests run against a real DuckDB. The point is not that the
 * profiler's arithmetic is right in isolation — it is that the SQL it
 * generates is valid, the driver's return types survive coercion, and the
 * findings it derives match what a human would conclude from the same data.
 */

function binding(overrides: Record<string, unknown> = {}) {
  return sourceBindingSchema.parse({
    id: 'work-events',
    connectionRef: 'ops',
    from: { name: 'workEvents' },
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
    ...overrides,
  });
}

describe('profileBinding against a real DuckDB', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it('reports the shape of a correctly mapped interval source', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());

    expect(profile.rowCount).toBe(SAMPLE_ROWS.length);
    expect(profile.caseCount).toBe(3); // BK-1001, BK-1002, BK-1003
    // interval grain: each row unpivots into a start and a complete event
    expect(profile.eventCount).toBe(SAMPLE_ROWS.length * 2);
    expect(profile.grain).toBe('interval');
    expect(profile.caseColumn).toBe('queueId');
    expect(profileIsUsable(profile)).toBe(true);
  });

  it('composes the activity classifier across two columns', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());
    // 'New · Indexed', 'New · Processed', 'Amendment · Indexed',
    // 'Confirmed · Processed', 'New · Query', 'Amendment · Processed'
    expect(profile.activityCount).toBe(6);
  });

  it('falls to a coarser map when the classifier drops a column', async () => {
    const coarse = await profileBinding(
      client,
      duckdbDialect,
      binding({ roles: { ...binding().roles, activity: 'subqueueId' } }),
    );
    // New, Amendment, Confirmed
    expect(coarse.activityCount).toBe(3);
  });

  it('counts distinct resources for the organizational perspective', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());
    expect(profile.resourceCount).toBe(3); // priya, sam, ravi
  });

  it('derives the rows-per-case distribution in the database', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());
    // BK-1001: 4 rows, BK-1002: 3, BK-1003: 5  →  mean 4, median 4, max 5
    expect(profile.rowsPerCase.mean).toBeCloseTo(4, 5);
    expect(profile.rowsPerCase.median).toBeCloseTo(4, 5);
    expect(profile.rowsPerCase.max).toBe(5);
    expect(profile.eventsPerCase.max).toBe(10); // interval: two events per row
    expect(profile.singleRowCases).toBe(0);
  });

  it('reports the true time span of the source', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());
    expect(profile.timeRange).not.toBeNull();
    expect(profile.timeRange?.from.toISOString()).toBe('2026-03-01T09:00:00.000Z');
    // max is taken from the END expression, not the start
    expect(profile.timeRange?.to.toISOString()).toBe('2026-03-04T09:58:00.000Z');
  });

  it('emits a PROFILE_OK summary when nothing is wrong', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding());
    const ok = profile.findings.find((f) => f.code === 'PROFILE_OK');
    expect(ok).toBeDefined();
    expect(ok?.message).toContain('3 cases');
  });
});

describe('the wrong case key is caught, not silently mined', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it('flags a per-row id used as the case key as an ERROR', async () => {
    // 'id' is the primary key — one row per "case", every trace length 1.
    // This is the classic mistake the profiler exists to catch.
    const profile = await profileBinding(
      client,
      duckdbDialect,
      binding({ roles: { ...binding().roles, case: 'id' }, objects: [] }),
    );

    expect(profile.rowCount).toBe(profile.caseCount);
    const finding = profile.findings.find((f) => f.code === 'SINGLE_ROW_CASES');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('identifies rows, not business items');
    expect(profileIsUsable(profile)).toBe(false);
  });

  it('does not emit PROFILE_OK when an error finding is present', async () => {
    const profile = await profileBinding(
      client,
      duckdbDialect,
      binding({ roles: { ...binding().roles, case: 'id' }, objects: [] }),
    );
    expect(profile.findings.some((f) => f.code === 'PROFILE_OK')).toBe(false);
  });
});

describe('the case key is a per-analysis choice', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it('pivots the same source onto a different object type', async () => {
    const atBooking = await profileBinding(client, duckdbDialect, binding(), {
      caseObject: 'booking',
    });
    const atItem = await profileBinding(client, duckdbDialect, binding(), { caseObject: 'item' });

    expect(atBooking.caseColumn).toBe('queueId');
    expect(atItem.caseColumn).toBe('itemId');

    // Same rows, same stream, two legitimate views of it.
    expect(atBooking.rowCount).toBe(atItem.rowCount);
    expect(atBooking.caseCount).toBe(3);
    expect(atItem.caseCount).toBe(7); // 1 + 1 + 5 line items
  });

  it('shows the divergence artefact that item-level projection removes', async () => {
    // BK-1003 has five line items, each amended exactly once. Flattened onto
    // the booking it reads as five consecutive Amendments — a rework loop that
    // never happened. Projected onto the item, each is a one-step case.
    const atBooking = await profileBinding(client, duckdbDialect, binding(), {
      caseObject: 'booking',
    });
    const atItem = await profileBinding(client, duckdbDialect, binding(), { caseObject: 'item' });

    expect(atBooking.rowsPerCase.max).toBe(5); // the phantom loop
    expect(atItem.rowsPerCase.max).toBe(4); // BK-1001-01's genuine four steps
    expect(atItem.singleRowCases).toBe(5); // the five independently amended items
  });
});

describe('data defects surface as findings', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client.close();
  });

  it('detects intervals that end before they start', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client, [
      ...SAMPLE_ROWS,
      {
        id: 99,
        queueId: 'BK-1004',
        itemId: 'BK-1004-01',
        subqueueId: 'New',
        transactionStateId: 'Indexed',
        allocatedTo: 'priya',
        allocatedOn: '2026-03-05T12:00:00Z',
        completedOn: '2026-03-05T11:00:00Z', // one hour BEFORE it started
        aht: 60,
      },
    ]);

    const profile = await profileBinding(client, duckdbDialect, binding());
    expect(profile.invertedIntervals).toBe(1);
    const finding = profile.findings.find((f) => f.code === 'INVERTED_INTERVALS');
    expect(finding?.severity).toBe('error');
    expect(profileIsUsable(profile)).toBe(false);
  });

  it('reports rows whose case key is null as excluded from every trace', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client, [
      ...SAMPLE_ROWS,
      {
        id: 98,
        queueId: null, // orphan: correlates to nothing
        itemId: 'ORPHAN-01',
        subqueueId: 'New',
        transactionStateId: 'Indexed',
        allocatedTo: 'sam',
        allocatedOn: '2026-03-05T09:00:00Z',
        completedOn: '2026-03-05T09:05:00Z',
        aht: 300,
      },
    ]);

    const profile = await profileBinding(client, duckdbDialect, binding());
    const finding = profile.findings.find((f) => f.code === 'NULL_CASE_KEY');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.message).toContain('1 rows');
    // the orphan is excluded from the case count, not silently bucketed
    expect(profile.caseCount).toBe(3);
  });

  it('warns when a classifier collapses to a single activity', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client, SAMPLE_ROWS.slice(7)); // BK-1003 only: all Amendment/Processed

    const profile = await profileBinding(client, duckdbDialect, binding());
    expect(profile.activityCount).toBe(1);
    const finding = profile.findings.find((f) => f.code === 'SINGLE_ACTIVITY');
    expect(finding?.severity).toBe('warning');
  });

  it('errors rather than guessing when the binding matches no rows', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client, []);

    const profile = await profileBinding(client, duckdbDialect, binding());
    expect(profile.rowCount).toBe(0);
    expect(profile.findings).toHaveLength(1);
    expect(profile.findings[0]?.code).toBe('NO_ROWS');
  });

  it('notes the missing organizational perspective when no resource is mapped', async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);

    const roles = { ...binding().roles };
    delete (roles as Record<string, unknown>)['resource'];
    const profile = await profileBinding(client, duckdbDialect, binding({ roles }));

    expect(profile.resourceCount).toBeUndefined();
    const finding = profile.findings.find((f) => f.code === 'NO_RESOURCE_ROLE');
    expect(finding?.severity).toBe('info');
  });
});

describe('binding filters are pushed into SQL', () => {
  let client: SqlClient;

  beforeEach(async () => {
    client = await openMemoryDuckDB();
    await seedWorkEvents(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it("honours the binding's own where clause", async () => {
    const profile = await profileBinding(
      client,
      duckdbDialect,
      binding({ where: { op: 'eq', column: 'queueId', value: 'BK-1001' } }),
    );
    expect(profile.rowCount).toBe(4);
    expect(profile.caseCount).toBe(1);
  });

  it('ANDs a stream-level filter with the binding filter', async () => {
    const profile = await profileBinding(client, duckdbDialect, binding(), {
      extraWhere: { op: 'in', column: 'allocatedTo', values: ['priya'] },
    });
    // priya: rows 1, 2, 5, 10, 11
    expect(profile.rowCount).toBe(5);
  });

  it('binds filter values as parameters rather than interpolating them', async () => {
    // A value containing a quote must not be able to terminate a literal.
    const profile = await profileBinding(
      client,
      duckdbDialect,
      binding({ where: { op: 'eq', column: 'queueId', value: "BK-1001' OR '1'='1" } }),
    );
    expect(profile.rowCount).toBe(0);
  });
});
