import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { streamDefinitionSchema, type StreamDefinition } from '../src/config/schemas.js';
import { filterFingerprint } from '../src/config/validate.js';
import {
  deleteStream,
  ensureStreamRegistry,
  findStream,
  getStream,
  listStreams,
  saveStream,
  saveStreamCoverage,
} from '../src/runtime/streams.js';
import { createRouter } from '../src/http/router.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';

/**
 * The stream registry.
 *
 * A stream is worth saving because it is worth RETURNING to, and the property
 * that makes returning cheap is that coverage survives an edit. Most of what
 * is tested here is that the registry does not throw away a materialisation it
 * did not have to.
 */

let client: SqlClient;

afterEach(async () => {
  await client?.close();
});

const definition = (id: string, extra: Partial<StreamDefinition> = {}): StreamDefinition =>
  streamDefinitionSchema.parse({
    id,
    name: 'UK bookings',
    defaultCaseObject: 'task',
    bindings: [
      {
        id: 'events',
        connectionRef: 'host',
        from: { table: { name: 'task_events' }, alias: 'e' },
        grain: 'event',
        roles: {
          case: 'e.task_id',
          activity: { columns: ['e.type'] },
          timestamp: 'e.created_at',
        },
        objects: [{ type: 'task', column: 'e.task_id' }],
        attributes: [],
      },
    ],
    filters: { where: {}, caseLimit: 0 },
    ...extra,
  });

const open = async (): Promise<SqlClient> => {
  const c = await openMemoryDuckDB();
  await ensureStreamRegistry(c, duckdbDialect);
  return c;
};

describe('saving and reopening a stream', () => {
  it('round-trips the definition exactly', async () => {
    client = await open();
    const saved = await saveStream(client, duckdbDialect, {
      definition: definition('uk-bookings'),
      description: 'Everything from the UK desk',
    });

    expect(saved.id).toBe('uk-bookings');
    expect(saved.name).toBe('UK bookings');
    expect(saved.description).toBe('Everything from the UK desk');

    // The definition must survive JSON storage byte for byte in meaning — a
    // half-read binding would extract different rows without saying so.
    const reopened = await getStream(client, duckdbDialect, 'uk-bookings');
    expect(reopened.definition).toEqual(saved.definition);
    expect(reopened.definition.bindings[0]?.roles.case).toBe('e.task_id');
  });

  it('lists what has been saved, newest first', async () => {
    client = await open();
    await saveStream(client, duckdbDialect, { definition: definition('first') });
    await saveStream(client, duckdbDialect, { definition: definition('second') });

    const streams = await listStreams(client, duckdbDialect);
    expect(streams.map((s) => s.id).sort()).toEqual(['first', 'second']);
    expect(streams[0]?.bindings).toBe(1);
    expect(streams[0]?.eventCount).toBe(0);
    expect(streams[0]?.extent).toBeNull();
  });

  it('refuses to overwrite when asked to create', async () => {
    client = await open();
    await saveStream(client, duckdbDialect, { definition: definition('taken') });
    await expect(
      saveStream(client, duckdbDialect, { definition: definition('taken'), createOnly: true }),
    ).rejects.toBeInstanceOf(ConflictError);

    // Without createOnly the same call is a save, not a clash.
    await expect(
      saveStream(client, duckdbDialect, { definition: definition('taken') }),
    ).resolves.toBeTruthy();
  });

  it('says clearly when a stream is not there', async () => {
    client = await open();
    await expect(getStream(client, duckdbDialect, 'nope')).rejects.toBeInstanceOf(NotFoundError);
    expect(await findStream(client, duckdbDialect, 'nope')).toBeNull();
  });

  it('deletes, and reports whether anything went', async () => {
    client = await open();
    await saveStream(client, duckdbDialect, { definition: definition('doomed') });
    expect(await deleteStream(client, duckdbDialect, 'doomed')).toBe(true);
    expect(await deleteStream(client, duckdbDialect, 'doomed')).toBe(false);
  });
});

describe('coverage on a saved stream', () => {
  const coverageFor = (stream: StreamDefinition, days: number) => ({
    streamId: stream.id,
    windows: [
      { from: new Date('2026-05-01T00:00:00Z'), to: new Date(`2026-05-${String(days).padStart(2, '0')}T00:00:00Z`) },
    ],
    filterFingerprint: filterFingerprint(stream),
    eventCount: 1200,
    caseCount: 300,
    bytesOnDisk: 4096,
  });

  it('records what has been materialised', async () => {
    client = await open();
    const stream = definition('covered');
    await saveStream(client, duckdbDialect, { definition: stream });
    await saveStreamCoverage(client, duckdbDialect, 'covered', coverageFor(stream, 11));

    const [summary] = await listStreams(client, duckdbDialect);
    expect(summary?.eventCount).toBe(1200);
    expect(summary?.caseCount).toBe(300);
    expect(summary?.coveredDays).toBe(10);
    expect(summary?.extent?.from.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(summary?.needsRebuild).toBe(false);
  });

  it('keeps coverage when the edit does not change what would be extracted', async () => {
    client = await open();
    const stream = definition('renamed');
    await saveStream(client, duckdbDialect, { definition: stream });
    await saveStreamCoverage(client, duckdbDialect, 'renamed', coverageFor(stream, 11));

    // Renaming is not a reason to refetch a month of events.
    await saveStream(client, duckdbDialect, { definition: stream, name: 'A better name' });
    const reopened = await getStream(client, duckdbDialect, 'renamed');
    expect(reopened.name).toBe('A better name');
    expect(reopened.coverage?.eventCount).toBe(1200);

    const [summary] = await listStreams(client, duckdbDialect);
    expect(summary?.needsRebuild).toBe(false);
  });

  it('flags a rebuild when the selection itself changed', async () => {
    client = await open();
    const stream = definition('narrowed');
    await saveStream(client, duckdbDialect, { definition: stream });
    await saveStreamCoverage(client, duckdbDialect, 'narrowed', coverageFor(stream, 11));

    // A different case cap means different rows. Saying so beats silently
    // rebuilding, which on a large stream is an expensive surprise.
    const changed = definition('narrowed', { filters: { where: {}, caseLimit: 500 } });
    await saveStream(client, duckdbDialect, { definition: changed });

    const [summary] = await listStreams(client, duckdbDialect);
    expect(summary?.needsRebuild).toBe(true);
    // The held data is still there — the caller decides what to do about it.
    expect(summary?.eventCount).toBe(1200);
  });
});

describe('a stream that came from a file', () => {
  /**
   * An imported log is a stream too — it is named, saved, reopened and mined
   * exactly like an extracted one. What it cannot do is refresh, because there
   * is no host behind it, and the definition has to be able to say so.
   */
  const imported = (id: string): StreamDefinition =>
    streamDefinitionSchema.parse({
      id,
      name: 'Claims export',
      defaultCaseObject: 'claim',
      file: {
        filename: 'claims.csv',
        format: 'csv',
        importedAt: '2026-03-01T00:00:00Z',
        events: 480,
        cases: 120,
        activities: 5,
      },
    });

  it('is valid with no bindings at all', () => {
    const stream = imported('claims');
    expect(stream.bindings).toEqual([]);
    expect(stream.file?.filename).toBe('claims.csv');
  });

  it('saves and reopens like any other stream', async () => {
    client = await open();
    await saveStream(client, duckdbDialect, { definition: imported('claims') });

    const back = await findStream(client, duckdbDialect, 'claims');
    expect(back?.definition.file?.format).toBe('csv');
    expect(back?.definition.file?.cases).toBe(120);

    const listed = await listStreams(client, duckdbDialect);
    expect(listed.map((x) => x.id)).toContain('claims');
  });

  it('refuses a stream with neither bindings nor a file', () => {
    expect(() => streamDefinitionSchema.parse({ id: 'empty', bindings: [] })).toThrow(
      /at least one binding|imported from/,
    );
  });

  it('refuses a stream claiming both a file and a host to read', () => {
    expect(() =>
      streamDefinitionSchema.parse({
        ...definition('both'),
        file: {
          filename: 'x.csv',
          format: 'csv',
          importedAt: '2026-03-01T00:00:00Z',
        },
      }),
    ).toThrow(/no host to extract from/);
  });
});

describe('the streams endpoint refuses bad input properly', () => {
  it('answers 422 with what is wrong, not 500', async () => {
    // A malformed body is the caller's mistake. Reporting it as an internal
    // error tells them to go and read server logs they cannot see.
    client = await open();
    const route = createRouter({ defaultStore: 'x', resolveStore: async () => client });

    const response = await route({
      method: 'POST',
      path: '/v1/streams',
      query: new URLSearchParams(),
      body: {},
    });

    expect(response.status).toBe(422);
    const body = response.body as { error?: { code?: string; details?: string[] } };
    expect(body.error?.code).toBe('INVALID_REQUEST');
    expect(Array.isArray(body.error?.details)).toBe(true);
    expect(body.error?.details?.length ?? 0).toBeGreaterThan(0);
  });

  it('saves and lists over HTTP', async () => {
    client = await open();
    const route = createRouter({ defaultStore: 'x', resolveStore: async () => client });

    const saved = await route({
      method: 'POST',
      path: '/v1/streams',
      query: new URLSearchParams(),
      body: { definition: definition('over-http'), name: 'Over HTTP' },
    });
    expect(saved.status).toBe(200);

    const listed = await route({
      method: 'GET',
      path: '/v1/streams',
      query: new URLSearchParams(),
    });
    const body = listed.body as { streams?: { id: string }[] };
    expect(body.streams?.map((s) => s.id)).toContain('over-http');
  });
});
