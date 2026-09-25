import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UnsupportedError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importXes } from '../src/offline/xes.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Regressions found by running BPI Challenge 2012 — 262,200 events, the
 * canonical public benchmark — rather than synthetic fixtures.
 *
 * Every case here passed against generated logs and failed against the real
 * one. They are kept because the next real log will have the same kind of
 * quirks, not the same ones.
 */

let dir: string;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A log in the shape BPIC 2012 actually ships: UPPERCASE lifecycle, no global org:resource. */
function realShapedXes(): string {
  const event = (activity: string, ts: string, lifecycle: string, resource?: string): string =>
    [
      '    <event>',
      `      <string key="concept:name" value="${activity}"/>`,
      `      <date key="time:timestamp" value="${ts}"/>`,
      `      <string key="lifecycle:transition" value="${lifecycle}"/>`,
      ...(resource !== undefined ? [`      <string key="org:resource" value="${resource}"/>`] : []),
      '    </event>',
    ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<log xes.version="1.0">',
    // Declares concept and time, but NOT org:resource — exactly like BPIC 2012.
    '  <global scope="event">',
    '    <string key="concept:name" value="__INVALID__"/>',
    '    <date key="time:timestamp" value="1970-01-01T00:00:00.000+00:00"/>',
    '  </global>',
    '  <trace>',
    '    <string key="concept:name" value="c1"/>',
    // Three transitions of one work item, all stamped at the SAME instant.
    // Only the lifecycle says what order they happened in.
    event('W_Task', '2026-01-01T00:00:00Z', 'COMPLETE', '112'),
    event('W_Task', '2026-01-01T00:00:00Z', 'SCHEDULE', '112'),
    event('W_Task', '2026-01-01T00:00:00Z', 'START', '112'),
    event('A_Done', '2026-01-01T01:00:00Z', 'COMPLETE', '113'),
    '  </trace>',
    '</log>',
  ].join('\n');
}

describe('lifecycle transitions arrive in whatever case the log used', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('orders same-instant events by UPPERCASE lifecycle, not by insertion order', async () => {
    // XES specifies lowercase transition names; real logs ignore that. A
    // case-sensitive tie-break silently matches none of them, so the three
    // events would keep their arbitrary document order and the graph would
    // gain an arc running backwards through the work item's own lifecycle.
    const path = join(dir, 'uppercase-lifecycle.xes');
    await writeFile(path, realShapedXes(), 'utf8');
    client = await openMemoryDuckDB();
    await importXes(client, duckdbDialect, { path });

    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });

    // Correct order is SCHEDULE -> START -> COMPLETE, so the only self-arc on
    // W_Task is a forward one and A_Done follows the completion.
    expect([...dfg.starts.keys()]).toEqual(['W_Task']);
    expect([...dfg.ends.keys()]).toEqual(['A_Done']);
    const arcs = dfg.edges.map((e) => `${e.from}->${e.to}`);
    expect(arcs).toContain('W_Task->A_Done');
  });

  it('filters to a single transition so mixed granularities do not tangle', async () => {
    const path = join(dir, 'lifecycle-filter.xes');
    await writeFile(path, realShapedXes(), 'utf8');
    client = await openMemoryDuckDB();
    await importXes(client, duckdbDialect, { path });

    const all = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(all.eventCount).toBe(4);

    // Case-insensitive: the caller says 'complete', the log says 'COMPLETE'.
    const completed = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      lifecycle: ['complete'],
    });
    expect(completed.eventCount).toBe(2);
    expect(completed.edges.map((e) => `${e.from}->${e.to}`)).toEqual(['W_Task->A_Done']);
  });
});

describe('resource availability is judged on events, not on the header', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('does not claim the organizational perspective is unavailable when events carry a resource', async () => {
    // BPIC 2012 declares no global org:resource yet supplies one on 244k of
    // its 262k events. Trusting the header reports a perspective as missing
    // when it is fully available.
    const path = join(dir, 'undeclared-resource.xes');
    await writeFile(path, realShapedXes(), 'utf8');
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });
    expect(result.warnings.join(' ')).not.toMatch(/organizational perspective is unavailable/);

    const { rows } = await client.query(
      'SELECT COUNT(resource) AS with_res, COUNT(DISTINCT resource) AS distinct_res FROM malkom_events',
      [],
    );
    expect(Number(rows[0]?.['with_res'])).toBe(4);
    expect(Number(rows[0]?.['distinct_res'])).toBe(2);
  });

  it('warns when the perspective really is unavailable', async () => {
    const path = join(dir, 'no-resource-at-all.xes');
    await writeFile(
      path,
      [
        '<?xml version="1.0"?>',
        '<log>',
        '  <trace>',
        '    <string key="concept:name" value="c1"/>',
        '    <event><string key="concept:name" value="a"/><date key="time:timestamp" value="2026-01-01T00:00:00Z"/></event>',
        '    <event><string key="concept:name" value="b"/><date key="time:timestamp" value="2026-01-01T01:00:00Z"/></event>',
        '  </trace>',
        '</log>',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });
    expect(result.warnings.join(' ')).toMatch(/organizational perspective is unavailable/);
  });

  it('quantifies partial resource coverage rather than passing it in silence', async () => {
    const path = join(dir, 'partial-resource.xes');
    await writeFile(
      path,
      [
        '<?xml version="1.0"?>',
        '<log>',
        '  <trace>',
        '    <string key="concept:name" value="c1"/>',
        '    <event><string key="concept:name" value="a"/><date key="time:timestamp" value="2026-01-01T00:00:00Z"/><string key="org:resource" value="alice"/></event>',
        '    <event><string key="concept:name" value="b"/><date key="time:timestamp" value="2026-01-01T01:00:00Z"/></event>',
        '  </trace>',
        '</log>',
      ].join('\n'),
      'utf8',
    );
    client = await openMemoryDuckDB();

    const result = await importXes(client, duckdbDialect, { path });
    expect(result.warnings.join(' ')).toMatch(/1 of 2 events have no org:resource/);
  });
});

describe('the memory guard measures what is actually parsed', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('refuses a small .gz that expands past the limit', async () => {
    // XES compresses roughly 40:1 — BPIC 2012 is 3 MB on disk and well over
    // 100 MB parsed. A guard that only stats the archive lets exactly the
    // files it exists to stop sail straight through.
    const plain = realShapedXes() + '\n' + '<!-- '.padEnd(400_000, 'x') + ' -->';
    const path = join(dir, 'compressible.xes.gz');
    await writeFile(path, gzipSync(Buffer.from(plain, 'utf8')));

    const onDisk = (await import('node:fs/promises')).stat;
    const compressedSize = (await onDisk(path)).size;
    expect(compressedSize).toBeLessThan(50_000); // the archive is genuinely small

    client = await openMemoryDuckDB();
    await expect(
      importXes(client, duckdbDialect, { path, maxBytes: 100_000 }),
    ).rejects.toThrow(UnsupportedError);
    await expect(
      importXes(client, duckdbDialect, { path, maxBytes: 100_000 }),
    ).rejects.toThrow(/expands to/);
  });
});
