import { createDuckDBClient } from '../../src/sql/clients.js';
import type { SqlClient } from '../../src/ports/sql.js';

/**
 * A real in-process DuckDB, not a fake.
 *
 * These tests run against an actual SQL engine so that dialect output, type
 * coercion (BIGINT counts arriving as bigint, TIMESTAMPTZ as Date) and
 * aggregate semantics are all exercised for real. A hand-written stub would
 * pass while the generated SQL was invalid, which is precisely the failure
 * these tests exist to catch.
 */
export async function openMemoryDuckDB(): Promise<SqlClient> {
  return createDuckDBClient(':memory:');
}

/** Execute a batch of statements, one at a time (DuckDB's run takes one). */
export async function execAll(client: SqlClient, statements: readonly string[]): Promise<void> {
  for (const sql of statements) {
    await client.execute(sql, []);
  }
}

/**
 * The Malkom work-event shape: one row per TRANSACTION on a business item.
 *
 * - `queueId`  the repeating business reference (a booking number)
 * - `itemId`   a line item within that booking — a second, finer object
 * - `subqueueId` / `transactionStateId` compose the activity
 * - `allocatedOn` / `completedOn` make each row an INTERVAL: two events
 * - `aht`      handling time in seconds, distinct from waiting time
 */
export const WORK_EVENTS_DDL = `
  CREATE TABLE "workEvents" (
    "id"                 BIGINT PRIMARY KEY,
    "queueId"            VARCHAR,
    "itemId"             VARCHAR,
    "subqueueId"         VARCHAR,
    "transactionStateId" VARCHAR,
    "allocatedTo"        VARCHAR,
    "allocatedOn"        TIMESTAMPTZ,
    "completedOn"        TIMESTAMPTZ,
    "aht"                DOUBLE
  )
`;

export interface WorkEventRow {
  id: number;
  queueId: string | null;
  itemId: string | null;
  subqueueId: string | null;
  transactionStateId: string;
  allocatedTo: string | null;
  allocatedOn: string | null;
  completedOn: string | null;
  aht: number | null;
}

export function insertWorkEvents(rows: readonly WorkEventRow[]): string[] {
  return rows.map((r) => {
    const v = (x: string | number | null): string =>
      x === null ? 'NULL' : typeof x === 'number' ? String(x) : `'${x.replaceAll("'", "''")}'`;
    return (
      `INSERT INTO "workEvents" VALUES (${r.id}, ${v(r.queueId)}, ${v(r.itemId)}, ` +
      `${v(r.subqueueId)}, ${v(r.transactionStateId)}, ${v(r.allocatedTo)}, ` +
      `${v(r.allocatedOn)}, ${v(r.completedOn)}, ${v(r.aht)})`
    );
  });
}

/**
 * Two bookings with realistic multi-transaction lifecycles, plus one booking
 * whose five line items are each amended exactly once.
 *
 * That last booking is the divergence fixture: flattened to booking level it
 * looks like five rounds of rework; projected to item level the loop vanishes,
 * because it was an artefact of the projection rather than a fact about the
 * process.
 */
export const SAMPLE_ROWS: WorkEventRow[] = [
  // --- BK-1001: a normal booking, four transactions -----------------------
  row(1, 'BK-1001', 'BK-1001-01', 'New', 'Indexed', 'priya', '2026-03-01T09:00:00Z', '2026-03-01T09:12:00Z', 720),
  row(2, 'BK-1001', 'BK-1001-01', 'New', 'Processed', 'priya', '2026-03-01T09:12:00Z', '2026-03-01T09:40:00Z', 1680),
  row(3, 'BK-1001', 'BK-1001-01', 'Amendment', 'Indexed', 'sam', '2026-03-02T11:00:00Z', '2026-03-02T11:20:00Z', 1200),
  row(4, 'BK-1001', 'BK-1001-01', 'Confirmed', 'Processed', 'sam', '2026-03-02T14:00:00Z', '2026-03-02T14:05:00Z', 300),

  // --- BK-1002: a shorter path, with a query detour -----------------------
  row(5, 'BK-1002', 'BK-1002-01', 'New', 'Indexed', 'priya', '2026-03-03T08:30:00Z', '2026-03-03T08:35:00Z', 300),
  row(6, 'BK-1002', 'BK-1002-01', 'New', 'Query', 'ravi', '2026-03-03T08:35:00Z', '2026-03-03T10:15:00Z', 600),
  row(7, 'BK-1002', 'BK-1002-01', 'Confirmed', 'Processed', 'ravi', '2026-03-03T10:15:00Z', '2026-03-03T10:22:00Z', 420),

  // --- BK-1003: five items, each amended exactly once ---------------------
  row(8, 'BK-1003', 'BK-1003-01', 'Amendment', 'Processed', 'sam', '2026-03-04T09:00:00Z', '2026-03-04T09:10:00Z', 600),
  row(9, 'BK-1003', 'BK-1003-02', 'Amendment', 'Processed', 'sam', '2026-03-04T09:10:00Z', '2026-03-04T09:19:00Z', 540),
  row(10, 'BK-1003', 'BK-1003-03', 'Amendment', 'Processed', 'priya', '2026-03-04T09:19:00Z', '2026-03-04T09:31:00Z', 720),
  row(11, 'BK-1003', 'BK-1003-04', 'Amendment', 'Processed', 'priya', '2026-03-04T09:31:00Z', '2026-03-04T09:44:00Z', 780),
  row(12, 'BK-1003', 'BK-1003-05', 'Amendment', 'Processed', 'ravi', '2026-03-04T09:44:00Z', '2026-03-04T09:58:00Z', 840),
];

function row(
  id: number,
  queueId: string | null,
  itemId: string | null,
  subqueueId: string | null,
  transactionStateId: string,
  allocatedTo: string | null,
  allocatedOn: string | null,
  completedOn: string | null,
  aht: number | null,
): WorkEventRow {
  return { id, queueId, itemId, subqueueId, transactionStateId, allocatedTo, allocatedOn, completedOn, aht };
}

/** Seed a fresh in-memory DuckDB with the sample work events. */
export async function seedWorkEvents(
  client: SqlClient,
  rows: readonly WorkEventRow[] = SAMPLE_ROWS,
): Promise<void> {
  await execAll(client, [WORK_EVENTS_DDL, ...insertWorkEvents(rows)]);
}
