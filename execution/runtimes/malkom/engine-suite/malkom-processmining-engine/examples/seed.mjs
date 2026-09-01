#!/usr/bin/env node
/**
 * Seeds examples/booking-ops.duckdb with a small, realistic work-event table
 * so `malkom-mining profile` has something honest to read.
 *
 * Stands in for the host's own database: in a real deployment the engine binds
 * whatever Postgres table the host already has, and creates nothing.
 */
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = join(here, 'booking-ops.duckdb');

await rm(dbPath, { force: true });
await rm(`${dbPath}.wal`, { force: true });

const instance = await DuckDBInstance.create(dbPath);
const connection = await instance.connect();

await connection.run(`
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
`);

// A booking moves through several transactions; each row is one unit of work
// with a start, an end, and a handling time.
const rows = [
  [1, 'BK-1001', 'BK-1001-01', 'New', 'Indexed', 'priya', '2026-03-01 09:00:00+00', '2026-03-01 09:12:00+00', 720],
  [2, 'BK-1001', 'BK-1001-01', 'New', 'Processed', 'priya', '2026-03-01 09:12:00+00', '2026-03-01 09:40:00+00', 1680],
  [3, 'BK-1001', 'BK-1001-01', 'Amendment', 'Indexed', 'sam', '2026-03-02 11:00:00+00', '2026-03-02 11:20:00+00', 1200],
  [4, 'BK-1001', 'BK-1001-01', 'Confirmed', 'Processed', 'sam', '2026-03-02 14:00:00+00', '2026-03-02 14:05:00+00', 300],
  [5, 'BK-1002', 'BK-1002-01', 'New', 'Indexed', 'priya', '2026-03-03 08:30:00+00', '2026-03-03 08:35:00+00', 300],
  [6, 'BK-1002', 'BK-1002-01', 'New', 'Query', 'ravi', '2026-03-03 08:35:00+00', '2026-03-03 10:15:00+00', 600],
  [7, 'BK-1002', 'BK-1002-01', 'Confirmed', 'Processed', 'ravi', '2026-03-03 10:15:00+00', '2026-03-03 10:22:00+00', 420],
  // Five line items on one booking, each amended exactly once. At booking
  // level this reads as five rounds of rework; at item level the loop is gone.
  [8, 'BK-1003', 'BK-1003-01', 'Amendment', 'Processed', 'sam', '2026-03-04 09:00:00+00', '2026-03-04 09:10:00+00', 600],
  [9, 'BK-1003', 'BK-1003-02', 'Amendment', 'Processed', 'sam', '2026-03-04 09:10:00+00', '2026-03-04 09:19:00+00', 540],
  [10, 'BK-1003', 'BK-1003-03', 'Amendment', 'Processed', 'priya', '2026-03-04 09:19:00+00', '2026-03-04 09:31:00+00', 720],
  [11, 'BK-1003', 'BK-1003-04', 'Amendment', 'Processed', 'priya', '2026-03-04 09:31:00+00', '2026-03-04 09:44:00+00', 780],
  [12, 'BK-1003', 'BK-1003-05', 'Amendment', 'Processed', 'ravi', '2026-03-04 09:44:00+00', '2026-03-04 09:58:00+00', 840],
];

for (const r of rows) {
  await connection.run('INSERT INTO "workEvents" VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
}

connection.disconnectSync();
instance.closeSync();

console.log(`seeded ${rows.length} work events into ${dbPath}`);
console.log('now run:');
console.log('  node packages/cli/dist/bin.js profile examples/booking-ops.json');
console.log('  node packages/cli/dist/bin.js profile examples/booking-ops.json --case-object item');
