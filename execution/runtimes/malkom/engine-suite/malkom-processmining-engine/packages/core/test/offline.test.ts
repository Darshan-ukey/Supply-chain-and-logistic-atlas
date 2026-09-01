import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConfigInvalidError, UnsupportedError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv, inspectCsv } from '../src/offline/csv.js';
import { importXes } from '../src/offline/xes.js';
import { inferMapping, classifyAttributeColumns, xesColumnMappingSchema } from '../src/offline/xes-standard.js';
import { availableObjectTypes, eventLogTables } from '../src/runtime/eventlog.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { mineProcessTree, treeToString } from '../src/runtime/inductive.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { CHOICE_LOG, LOOP_LOG, makeTempDir, writeCsvLog, writeXesLog } from './helpers/logs.js';

let dir: string;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('column mapping inference', () => {
  it('recognises the XES convention without any configuration', () => {
    const { mapping, missing } = inferMapping([
      'case:concept:name',
      'concept:name',
      'time:timestamp',
      'org:resource',
    ]);
    expect(missing).toEqual([]);
    expect(mapping.caseId).toBe('case:concept:name');
    expect(mapping.activity).toBe('concept:name');
  });

  it('accepts the common non-XES spellings tools actually emit', () => {
    const { mapping, missing } = inferMapping(['Case ID', 'Activity', 'Timestamp', 'Resource']);
    expect(missing).toEqual([]);
    // The header is returned verbatim, because it has to survive into SQL.
    expect(mapping.caseId).toBe('Case ID');
    expect(mapping.activity).toBe('Activity');
    expect(mapping.timestamp).toBe('Timestamp');
  });

  it('reports which roles it could not find', () => {
    const { missing } = inferMapping(['something', 'else']);
    expect(missing).toEqual(['caseId', 'activity', 'timestamp']);
  });

  it('lets an explicit override win over inference', () => {
    const { mapping } = inferMapping(['case:concept:name', 'concept:name', 'time:timestamp'], {
      caseId: 'concept:name',
    });
    expect(mapping.caseId).toBe('concept:name');
  });

  it('splits case-scoped columns from event-scoped ones', () => {
    const mapping = xesColumnMappingSchema.parse({});
    const split = classifyAttributeColumns(
      ['case:concept:name', 'concept:name', 'time:timestamp', 'case:channel', 'cost'],
      mapping,
    );
    expect(split.case).toEqual(['case:channel']);
    expect(split.event).toEqual(['cost']);
  });
});

describe('inspecting a CSV before importing it', () => {
  /**
   * The import is one streaming pass and cannot be undone halfway, so which
   * column is the case and which is the time has to be settled first. These
   * cover what somebody confirming that decision needs to see.
   */
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('reports the headers, the mapping they imply, and real rows to check it against', async () => {
    const path = await writeCsvLog(dir, 'inspect.csv', CHOICE_LOG, { caseAttribute: 'channel' });
    client = await openMemoryDuckDB();

    const found = await inspectCsv(client, duckdbDialect, { path });

    expect(found.missing).toEqual([]);
    expect(found.mapping.caseId).toBe('case:concept:name');
    expect(found.mapping.activity).toBe('concept:name');
    expect(found.rows).toBe(12);
    expect(found.headers).toContain('time:timestamp');
    expect(found.attributes.case).toEqual(['case:channel']);
    // A mapping confirmed against a column NAME is a guess; against a value it
    // is a decision. So the sample carries the values, keyed by header.
    expect(found.sample).toHaveLength(5);
    expect(found.sample[0]?.['concept:name']).toBe('a');
  });

  it('writes nothing — the event log is untouched by a look', async () => {
    const path = await writeCsvLog(dir, 'readonly.csv', CHOICE_LOG);
    client = await openMemoryDuckDB();
    await inspectCsv(client, duckdbDialect, { path });

    const tables = eventLogTables(duckdbDialect);
    // The tables do not even exist yet: inspection must not create them.
    await expect(client.query(`SELECT COUNT(*) AS n FROM ${tables.events}`, [])).rejects.toThrow();
  });

  it('names the roles it could not find instead of failing at import time', async () => {
    const path = join(dir, 'nothing.csv');
    await writeFile(path, 'alpha,beta\n1,2\n', 'utf8');
    client = await openMemoryDuckDB();

    const found = await inspectCsv(client, duckdbDialect, { path });
    expect(found.missing).toEqual(['caseId', 'activity', 'timestamp']);
    expect(found.headers).toEqual(['alpha', 'beta']);
  });

  it('says up front when a whole perspective will be unavailable', async () => {
    const path = join(dir, 'noresource.csv');
    await writeFile(
      path,
      'case:concept:name,concept:name,time:timestamp\nc1,a,2026-01-01T00:00:00Z\n',
      'utf8',
    );
    client = await openMemoryDuckDB();

    const found = await inspectCsv(client, duckdbDialect, { path });
    expect(found.warnings.join(' ')).toContain('who did the work');
  });

  it('honours an override, so a custom log can be confirmed before it lands', async () => {
    const path = join(dir, 'custom.csv');
    await writeFile(path, 'ref,step,when\nR1,start,2026-01-01T00:00:00Z\n', 'utf8');
    client = await openMemoryDuckDB();

    const found = await inspectCsv(client, duckdbDialect, {
      path,
      mapping: { caseId: 'ref', activity: 'step', timestamp: 'when' },
    });
    expect(found.missing).toEqual([]);
    expect(found.rows).toBe(1);
  });
});

describe('CSV import', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('imports an XES-convention CSV and reports what it found', async () => {
    const path = await writeCsvLog(dir, 'import.csv', CHOICE_LOG, { caseAttribute: 'channel' });
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, { path });

    expect(result.events).toBe(12); // 4 traces x 3 events
    expect(result.cases).toBe(4);
    expect(result.activities).toBe(4); // a, b, c, d
    expect(result.objectType).toBe('case');
    expect(result.caseAttributes).toEqual(['channel']);
    expect(result.timeRange?.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('writes one case-attribute row per case, not per event', async () => {
    const path = await writeCsvLog(dir, 'attrs.csv', CHOICE_LOG, { caseAttribute: 'channel' });
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const tables = eventLogTables(duckdbDialect);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM ${tables.caseAttrs}`, []);
    expect(Number(rows[0]?.['n'])).toBe(4); // four cases, one channel each
  });

  it('is immediately minable — offline and extracted logs are indistinguishable', async () => {
    const path = await writeCsvLog(dir, 'minable.csv', LOOP_LOG);
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(treeToString(mineProcessTree(dfg).tree)).toBe("->( 'a', *( 'b', 'c' ), 'd' )");
  });

  it('registers the object type so it can be listed', async () => {
    const path = await writeCsvLog(dir, 'objtype.csv', CHOICE_LOG);
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path, objectType: 'booking' });

    const types = await availableObjectTypes(client, duckdbDialect);
    expect(types).toEqual([{ objectType: 'booking', events: 12, objects: 4 }]);
  });

  it('continues event ids across a second import into the same store', async () => {
    const first = await writeCsvLog(dir, 'first.csv', CHOICE_LOG);
    const second = await writeCsvLog(dir, 'second.csv', LOOP_LOG);
    client = await openMemoryDuckDB();

    await importCsv(client, duckdbDialect, { path: first });
    await importCsv(client, duckdbDialect, { path: second, objectType: 'other' });

    const tables = eventLogTables(duckdbDialect);
    const { rows } = await client.query(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT event_id) AS distinct_ids FROM ${tables.events}`,
      [],
    );
    // Colliding ids would silently merge two logs into one tangled trace.
    expect(Number(rows[0]?.['total'])).toBe(Number(rows[0]?.['distinct_ids']));
  });

  it('skips rows missing a case, activity or timestamp rather than inventing one', async () => {
    const path = join(dir, 'holes.csv');
    await writeFile(
      path,
      [
        'case:concept:name,concept:name,time:timestamp',
        'c1,a,2026-01-01T00:00:00Z',
        ',b,2026-01-01T01:00:00Z', // no case
        'c1,,2026-01-01T02:00:00Z', // no activity
        'c1,b,', // no timestamp
        'c1,c,2026-01-01T03:00:00Z',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, { path });
    expect(result.events).toBe(2); // only the two complete rows
    expect(result.cases).toBe(1);
  });

  it('names the columns it has when it cannot find the ones it needs', async () => {
    const path = join(dir, 'unmappable.csv');
    await writeFile(path, 'foo,bar\n1,2\n', 'utf8');
    client = await openMemoryDuckDB();

    await expect(importCsv(client, duckdbDialect, { path })).rejects.toThrow(ConfigInvalidError);
    await expect(importCsv(client, duckdbDialect, { path })).rejects.toThrow(
      /caseId, activity, timestamp/,
    );
  });

  it('accepts an explicit mapping for a log with entirely custom headers', async () => {
    const path = join(dir, 'custom.csv');
    await writeFile(
      path,
      [
        'booking_ref,step,when,who',
        'BK-1,submit,2026-01-01T00:00:00Z,priya',
        'BK-1,approve,2026-01-01T01:00:00Z,sam',
        'BK-2,submit,2026-01-02T00:00:00Z,priya',
        'BK-2,approve,2026-01-02T01:00:00Z,sam',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, {
      path,
      objectType: 'booking',
      mapping: { caseId: 'booking_ref', activity: 'step', timestamp: 'when', resource: 'who' },
    });
    expect(result.events).toBe(4);
    expect(result.cases).toBe(2);

    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'booking' });
    expect(treeToString(mineProcessTree(dfg).tree)).toBe("->( 'submit', 'approve' )");
  });

  it('warns when the log carries no resource column', async () => {
    const path = join(dir, 'noresource.csv');
    await writeFile(
      path,
      [
        'case:concept:name,concept:name,time:timestamp',
        'c1,a,2026-01-01T00:00:00Z',
        'c1,b,2026-01-01T01:00:00Z',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, { path });
    expect(result.warnings.join(' ')).toContain('organizational perspective');
  });

  it('parses a non-ISO timestamp when given a format, anchored to UTC', async () => {
    const path = join(dir, 'custom-time.csv');
    await writeFile(
      path,
      [
        'case:concept:name,concept:name,time:timestamp',
        'c1,a,01/02/2026 09:30:00',
        'c1,b,01/02/2026 10:30:00',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, {
      path,
      timestampFormat: '%d/%m/%Y %H:%M:%S',
    });
    expect(result.events).toBe(2);
    // Must NOT depend on the machine's local zone.
    expect(result.timeRange?.from.toISOString()).toBe('2026-02-01T09:30:00.000Z');
  });

  it('reads a naive timestamp in a declared zone when the log is local time', async () => {
    const path = join(dir, 'local-time.csv');
    await writeFile(
      path,
      [
        'case:concept:name,concept:name,time:timestamp',
        'c1,a,01/02/2026 09:30:00',
        'c1,b,01/02/2026 10:30:00',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, {
      path,
      timestampFormat: '%d/%m/%Y %H:%M:%S',
      timezone: 'Asia/Kolkata',
    });
    // 09:30 IST is 04:00 UTC.
    expect(result.timeRange?.from.toISOString()).toBe('2026-02-01T04:00:00.000Z');
  });

  it('honours an offset the timestamp already carries', async () => {
    const path = join(dir, 'offset-time.csv');
    await writeFile(
      path,
      [
        'case:concept:name,concept:name,time:timestamp',
        'c1,a,2026-02-01T09:30:00+05:30',
        'c1,b,2026-02-01T10:30:00+05:30',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importCsv(client, duckdbDialect, { path });
    expect(result.timeRange?.from.toISOString()).toBe('2026-02-01T04:00:00.000Z');
  });

  it('reports a missing file rather than importing nothing quietly', async () => {
    client = await openMemoryDuckDB();
    await expect(
      importCsv(client, duckdbDialect, { path: join(dir, 'does-not-exist.csv') }),
    ).rejects.toThrow(/cannot read CSV/);
  });
});

describe('XES XML import', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('imports a XES log and reports its declared extensions', async () => {
    const path = await writeXesLog(dir, 'log.xes', CHOICE_LOG);
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });

    expect(result.traces).toBe(4);
    expect(result.events).toBe(12);
    expect(result.activities).toBe(4);
    expect(result.extensions).toEqual(['Concept', 'Time', 'Organizational']);
    expect(result.globalEventKeys).toContain('org:resource');
  });

  it('produces a log that mines to the same tree as the CSV equivalent', async () => {
    const path = await writeXesLog(dir, 'minable.xes', LOOP_LOG);
    client = await openMemoryDuckDB();
    await importXes(client, duckdbDialect, { path });

    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(treeToString(mineProcessTree(dfg).tree)).toBe("->( 'a', *( 'b', 'c' ), 'd' )");
  });

  it('carries trace attributes through as case attributes', async () => {
    const path = await writeXesLog(dir, 'attrs.xes', CHOICE_LOG);
    client = await openMemoryDuckDB();
    await importXes(client, duckdbDialect, { path });

    const tables = eventLogTables(duckdbDialect);
    const { rows } = await client.query(
      `SELECT key, COUNT(*) AS n FROM ${tables.caseAttrs} GROUP BY key`,
      [],
    );
    expect(rows).toEqual([{ key: 'channel', n: 4n }]);
  });

  it('reads lifecycle and resource into their own columns', async () => {
    const path = await writeXesLog(dir, 'lifecycle.xes', [['a', 'b']]);
    client = await openMemoryDuckDB();
    await importXes(client, duckdbDialect, { path });

    const tables = eventLogTables(duckdbDialect);
    const { rows } = await client.query(
      `SELECT lifecycle, resource FROM ${tables.events} ORDER BY event_id LIMIT 1`,
      [],
    );
    expect(rows[0]).toEqual({ lifecycle: 'complete', resource: 'alice' });
  });

  it('transparently reads a gzipped .xes.gz', async () => {
    const plain = await writeXesLog(dir, 'gz-source.xes', CHOICE_LOG);
    const gzPath = join(dir, 'log.xes.gz');
    await writeFile(gzPath, gzipSync(await readFile(plain)));
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path: gzPath });
    expect(result.events).toBe(12);
  });

  it('handles a single-trace, single-event log without special-casing', async () => {
    // fast-xml-parser collapses one-element lists unless told otherwise; this
    // is the case that silently breaks if isArray is not configured.
    const path = await writeXesLog(dir, 'single.xes', [['only']]);
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });
    expect(result.traces).toBe(1);
    expect(result.events).toBe(1);
  });

  it('refuses a file above the memory limit instead of dying mid-import', async () => {
    const path = await writeXesLog(dir, 'big.xes', CHOICE_LOG);
    client = await openMemoryDuckDB();

    await expect(
      importXes(client, duckdbDialect, { path, maxBytes: 10 }),
    ).rejects.toThrow(UnsupportedError);
    await expect(
      importXes(client, duckdbDialect, { path, maxBytes: 10 }),
    ).rejects.toThrow(/convert to CSV or Parquet/);
  });

  it('rejects a document that is not a XES log', async () => {
    const path = join(dir, 'notxes.xml');
    await writeFile(path, '<?xml version="1.0"?><notalog><x/></notalog>', 'utf8');
    client = await openMemoryDuckDB();

    await expect(importXes(client, duckdbDialect, { path })).rejects.toThrow(/does not look like a XES/);
  });

  it('skips events with no parseable timestamp and says how many', async () => {
    const path = join(dir, 'badtime.xes');
    await writeFile(
      path,
      [
        '<?xml version="1.0"?>',
        '<log>',
        '  <trace>',
        '    <string key="concept:name" value="c1"/>',
        '    <event><string key="concept:name" value="a"/><date key="time:timestamp" value="2026-01-01T00:00:00Z"/></event>',
        '    <event><string key="concept:name" value="b"/><date key="time:timestamp" value="not-a-date"/></event>',
        '    <event><string key="concept:name" value="c"/><date key="time:timestamp" value="2026-01-01T02:00:00Z"/></event>',
        '  </trace>',
        '</log>',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });
    expect(result.events).toBe(2);
    expect(result.warnings.join(' ')).toMatch(/1 events skipped/);
  });

  it('names the package when fast-xml-parser is absent', async () => {
    const path = await writeXesLog(dir, 'nolib.xes', CHOICE_LOG);
    client = await openMemoryDuckDB();

    await expect(
      importXes(client, duckdbDialect, {
        path,
        importModule: async () => {
          const err = new Error("Cannot find package 'fast-xml-parser'");
          (err as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
          throw err;
        },
      }),
    ).rejects.toThrow(/npm install fast-xml-parser/);
  });
});
