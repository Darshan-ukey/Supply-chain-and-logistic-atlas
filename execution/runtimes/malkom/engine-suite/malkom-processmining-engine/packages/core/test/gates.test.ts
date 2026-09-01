import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect, postgresDialect } from '../src/sql/dialect.js';
import { activityExpr } from '../src/sql/compile.js';
import { createRouter } from '../src/http/router.js';
import { importCsv } from '../src/offline/csv.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { layoutDfg } from '../src/runtime/layout.js';
import { summariseLog } from '../src/runtime/summary.js';
import { replayFeed } from '../src/runtime/replay.js';
import { reconcileTargets, type DeclaredTarget } from '../src/runtime/targets.js';
import {
  detectCapabilities,
  ensureEventLog,
  insertEventObjects,
  insertEvents,
} from '../src/runtime/eventlog.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * The last three gates: cost, replay, and the bridge to declared targets.
 */

let dir: string;
let client: SqlClient;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterEach(async () => {
  await client?.close();
});

/** 20 cases, three steps, a cost on every event. */
async function costedLog(): Promise<SqlClient> {
  const c = await openMemoryDuckDB();
  await ensureEventLog(c, duckdbDialect);
  const base = Date.parse('2026-08-01T00:00:00Z');

  const events = [];
  const objects = [];
  let id = 0;
  for (let i = 0; i < 20; i += 1) {
    // submit costs 1, review 10, approve 4 — so review dominates the total
    // while submit is the most frequent. The overlay must show review.
    ['submit', 'review', 'approve'].forEach((activity, s) => {
      id += 1;
      events.push({
        eventId: id,
        activity,
        timestamp: new Date(base + i * 86_400_000 + s * 3_600_000),
        lifecycle: 'complete',
        resource: 'ann',
        durationSeconds: null,
        cost: [1, 10, 4][s]!,
        bindingId: 'b',
        attributes: {},
      });
      objects.push({ eventId: id, objectType: 'case', objectId: `c${i}` });
    });
  }
  await insertEvents(c, duckdbDialect, events);
  await insertEventObjects(c, duckdbDialect, objects);
  return c;
}

/** The same shape with no cost column values at all. */
async function uncostedLog(): Promise<SqlClient> {
  const path = join(dir, 'uncosted.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp'];
  const base = Date.parse('2026-08-01T00:00:00Z');
  for (let i = 0; i < 20; i += 1) {
    ['submit', 'review', 'approve'].forEach((activity, s) => {
      lines.push(
        `u${i},${activity},${new Date(base + i * 86_400_000 + s * 3_600_000).toISOString()}`,
      );
    });
  }
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

// ---------------------------------------------------------------------------

describe('cost', () => {
  it('totals cost per activity, and per case', async () => {
    client = await costedLog();
    const caps = await detectCapabilities(client, duckdbDialect);
    const opts = { objectType: 'case', capabilities: caps };

    const dfg = await buildDfg(client, duckdbDialect, opts);
    const review = dfg.activities.find((a) => a.activity === 'review');
    expect(review?.totalCost).toBe(200); // 20 cases x 10
    expect(review?.medianCost).toBe(10);

    const summary = await summariseLog(client, duckdbDialect, opts);
    expect(summary.cost.totalCost).toBe(20 * 15);
    expect(summary.cost.medianCost).toBe(15);
    expect(summary.cost.minCost).toBe(15);
  });

  it('weights the overlay by total, so the costliest step is not the most frequent', async () => {
    client = await costedLog();
    const caps = await detectCapabilities(client, duckdbDialect);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case', capabilities: caps });
    const graph = await layoutDfg(dfg);

    const review = graph.nodes.find((n) => n.label === 'review');
    const submit = graph.nodes.find((n) => n.label === 'submit');
    expect(review?.costWeight).toBe(1);
    // Same frequency, a tenth of the cost — the two channels must disagree.
    expect(submit?.frequency).toBe(review?.frequency);
    expect(submit?.costWeight).toBeCloseTo(0.1, 5);
    expect(graph.scales.maxNodeTotalCost).toBe(200);
  });

  it('reports null, never zero, when the log records no cost', async () => {
    client = await uncostedLog();
    const caps = await detectCapabilities(client, duckdbDialect);
    const opts = { objectType: 'case', capabilities: caps };

    // Zero would read as "this process is free", which is the opposite of
    // "we do not know what it costs".
    const dfg = await buildDfg(client, duckdbDialect, opts);
    for (const a of dfg.activities) {
      expect(a.totalCost).toBeNull();
      expect(a.medianCost).toBeNull();
    }
    const summary = await summariseLog(client, duckdbDialect, opts);
    expect(summary.cost.totalCost).toBeNull();
    expect(summary.cost.medianCost).toBeNull();

    const graph = await layoutDfg(dfg);
    expect(graph.scales.maxNodeTotalCost).toBeNull();
    for (const n of graph.nodes) expect(n.costWeight).toBeNull();
  });

  it('works against a store that predates the cost column', async () => {
    // The compatibility case that matters: read paths open read-only, so they
    // cannot migrate. Omitting capabilities must project a NULL rather than
    // failing to bind a column that is not there.
    client = await uncostedLog();
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    expect(dfg.caseCount).toBe(20);
    expect(dfg.activities.every((a) => a.totalCost === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('replay', () => {
  it('conserves cases: everything that starts also finishes', async () => {
    client = await uncostedLog();
    const feed = await replayFeed(client, duckdbDialect, { objectType: 'case', frames: 24 });

    expect(feed.frames).toHaveLength(24);
    const started = feed.frames.reduce((s, f) => s + f.started, 0);
    const finished = feed.frames.reduce((s, f) => s + f.finished, 0);
    expect(started).toBe(20);
    expect(finished).toBe(20);
    // Nothing may still be running once the log has ended.
    expect(feed.frames[feed.frames.length - 1]?.inFlight).toBe(0);
  });

  it('places a case on the arc it is waiting on, for as long as it waits', async () => {
    client = await uncostedLog();
    const feed = await replayFeed(client, duckdbDialect, { objectType: 'case', frames: 24 });

    // Every frame in the middle of the log should have some arc occupied —
    // that is what distinguishes replay from a series of instantaneous blips.
    const busy = feed.frames.filter((f) => f.arcs.length > 0);
    expect(busy.length).toBeGreaterThan(0);
    for (const frame of busy) {
      for (const arc of frame.arcs) {
        expect(['submit', 'review']).toContain(arc.from);
        expect(arc.cases).toBeGreaterThan(0);
      }
    }
  });

  it('returns an empty feed rather than throwing on an empty selection', async () => {
    client = await uncostedLog();
    const feed = await replayFeed(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'activity', activity: 'nothing-called-this' },
    });
    expect(feed.frames).toEqual([]);
    expect(feed.totalCases).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('declared targets', () => {
  const targets: DeclaredTarget[] = [
    {
      id: 'sla-1',
      name: 'Cases close within 3 hours',
      metric: { kind: 'cycle-time', statistic: 'p90', seconds: 10_800, comparator: 'at-most' },
    },
    {
      id: 'sla-2',
      name: 'Cases close within 1 hour',
      metric: { kind: 'cycle-time', statistic: 'p90', seconds: 3_600, comparator: 'at-most' },
    },
    {
      id: 'kpi-1',
      name: 'Approval rate',
      metric: { kind: 'completion-rate', activity: 'approve', rate: 0.95, comparator: 'at-least' },
    },
    {
      id: 'kpi-2',
      name: 'Rework stays low',
      metric: { kind: 'rework-rate', rate: 0.05, comparator: 'at-most' },
    },
  ];

  it('reports declared against observed, and which way it went', async () => {
    client = await uncostedLog();
    const report = await reconcileTargets(client, duckdbDialect, {
      objectType: 'case',
      targets,
    });

    // Every case runs exactly 2 hours, so 3h passes and 1h fails.
    const passes = report.checks.find((c) => c.id === 'sla-1');
    const fails = report.checks.find((c) => c.id === 'sla-2');
    expect(passes?.meets).toBe(true);
    expect(passes?.observed).toBe(7200);
    expect(fails?.meets).toBe(false);
    expect(fails?.gap).toBe(7200 - 3600);

    // Every case approves, and nothing repeats.
    expect(report.checks.find((c) => c.id === 'kpi-1')?.observed).toBe(1);
    expect(report.checks.find((c) => c.id === 'kpi-2')?.observed).toBe(0);
  });

  it('collects the breaches, and says so in the summary', async () => {
    client = await uncostedLog();
    const report = await reconcileTargets(client, duckdbDialect, {
      objectType: 'case',
      targets,
    });
    expect(report.breaches.map((b) => b.id)).toEqual(['sla-2']);
    expect(report.summary).toContain('3 of 4 targets met');
    expect(report.breaches[0]?.finding).toContain('misses its target');
  });

  it('separates "cannot measure" from "failing"', async () => {
    client = await uncostedLog();
    const report = await reconcileTargets(client, duckdbDialect, {
      objectType: 'case',
      targets: [
        {
          id: 'scoped',
          name: 'Priority cases close fast',
          metric: { kind: 'cycle-time', statistic: 'median', seconds: 60, comparator: 'at-most' },
          filter: { kind: 'attribute', key: 'priority', value: 'high' },
        },
      ],
    });

    // No case carries that attribute. Calling this a breach would invent an
    // alarm; calling it a pass would hide that nothing was checked.
    expect(report.breaches).toHaveLength(0);
    expect(report.unmeasurable).toHaveLength(1);
    expect(report.checks[0]?.meets).toBeNull();
    expect(report.summary).toContain('not measurable');
  });

  it('intersects a target scope with the selection being explored', async () => {
    client = await uncostedLog();
    const report = await reconcileTargets(client, duckdbDialect, {
      objectType: 'case',
      // Exploring a subset...
      filter: { kind: 'cases', ids: ['u0', 'u1', 'u2'] },
      // ...while the target scopes itself further.
      targets: [
        {
          id: 'both',
          name: 'Scoped',
          metric: { kind: 'cycle-time', statistic: 'median', seconds: 10_800, comparator: 'at-most' },
          filter: { kind: 'activity', activity: 'approve' },
        },
      ],
    });
    expect(report.checks[0]?.casesEvaluated).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Activity from a JSON field
// ---------------------------------------------------------------------------

describe("an activity built from a JSON field", () => {
  it("reaches one level into a JSON column", () => {
    // Real audit tables record WHAT changed in a typed column and WHAT IT
    // BECAME inside a JSON payload. Without this, every state transition
    // collapses into a single "STATE_CHANGE" box and the map describes a
    // process with one step.
    const sql = activityExpr(
      {
        activity: {
          columns: ["e.type", { column: "e.new_value", jsonKey: "state" }],
          separator: " · ",
        },
      },
      duckdbDialect,
      { table: "task_events", alias: "e" },
    );

    expect(sql).toContain("json_extract_string");
    expect(sql).toContain("state");
    expect(sql).toContain("concat_ws");
  });

  it("spells the access differently per dialect, but means the same thing", () => {
    const parts = {
      activity: { columns: [{ column: "e.new_value", jsonKey: "state" }], separator: " · " },
    };
    const relation = { table: "task_events", alias: "e" };

    // DuckDB wants a JSONPath, Postgres a bare key. Neither is the other's
    // syntax, which is exactly why this sits behind the dialect.
    expect(activityExpr(parts, duckdbDialect, relation)).toContain('$."state"');
    expect(activityExpr(parts, postgresDialect, relation)).toContain("->>");
  });

  it("still accepts a plain column, so existing bindings are untouched", () => {
    const sql = activityExpr(
      { activity: { columns: ["e.type"], separator: " · " } },
      duckdbDialect,
      { table: "task_events", alias: "e" },
    );
    expect(sql).toContain("CAST");
    expect(sql).not.toContain("json_extract_string");
  });
});

// ---------------------------------------------------------------------------
// The router never reshapes a handler's payload
// ---------------------------------------------------------------------------

describe('the router envelope', () => {
  it('does not turn an array into an object with numeric keys', async () => {
    // Spreading an array into an object yields {"0": …, "1": …}: valid JSON,
    // status 200, and completely wrong — the worst way for this to fail,
    // because nothing downstream can tell it happened.
    client = await uncostedLog();
    const route = createRouter({ defaultStore: 'x', resolveStore: async () => client });

    const response = await route({
      method: 'GET',
      path: '/v1/chart/throughput',
      query: new URLSearchParams({ objectType: 'case' }),
    });

    expect(response.status).toBe(200);
    const body = response.body as { points?: unknown };
    expect(Array.isArray(body.points)).toBe(true);
    expect(body).not.toHaveProperty('0');
  });

  it('still merges meta into an ordinary object payload', async () => {
    client = await uncostedLog();
    const route = createRouter({ defaultStore: 'x', resolveStore: async () => client });

    const response = await route({
      method: 'GET',
      path: '/v1/log/summary',
      query: new URLSearchParams({ objectType: 'case' }),
    });

    const body = response.body as { cases?: number; meta?: { objectType?: string } };
    expect(body.cases).toBe(20);
    expect(body.meta?.objectType).toBe('case');
  });
});

// ---------------------------------------------------------------------------
// The bulk load path
// ---------------------------------------------------------------------------

describe('bulk loading', () => {
  it('writes the same rows the INSERT path would', async () => {
    // The fast path must be indistinguishable from the slow one, or a store
    // built on one machine would differ from the same log built on another.
    client = await openMemoryDuckDB();
    await ensureEventLog(client, duckdbDialect);

    const at = new Date('2026-08-01T09:30:00.000Z');
    await insertEvents(client, duckdbDialect, [
      {
        eventId: 1,
        activity: 'submit',
        timestamp: at,
        lifecycle: 'complete',
        resource: 'ann',
        durationSeconds: 12.5,
        cost: 3.25,
        bindingId: 'b',
        attributes: { channel: 'web' },
      },
      {
        eventId: 2,
        activity: 'approve',
        timestamp: new Date(at.getTime() + 3_600_000),
        lifecycle: null,
        resource: null,
        durationSeconds: null,
        cost: null,
        bindingId: 'b',
        attributes: {},
      },
    ]);

    const { rows } = await client.query(
      'SELECT event_id, activity, ts, lifecycle, resource, duration_s, cost FROM malkom_events ORDER BY event_id',
      [],
    );
    expect(rows).toHaveLength(2);
    expect(String(rows[0]!['activity'])).toBe('submit');
    expect(Number(rows[0]!['duration_s'])).toBe(12.5);
    expect(Number(rows[0]!['cost'])).toBe(3.25);
    // The instant must survive the round trip exactly — a timestamp appended
    // through the wrong unit lands years away and still looks like a date.
    expect(new Date(String(rows[0]!['ts'])).toISOString()).toBe(at.toISOString());
    // Nulls stay null rather than becoming 0 or the string "null".
    expect(rows[1]!['lifecycle']).toBeNull();
    expect(rows[1]!['resource']).toBeNull();
    expect(rows[1]!['duration_s']).toBeNull();
    expect(rows[1]!['cost']).toBeNull();
  });

  it('still works through a client with no bulk path', async () => {
    // A host-supplied client, or a backend without an appender, must keep
    // working — only slower.
    const fast = await openMemoryDuckDB();
    await ensureEventLog(fast, duckdbDialect);
    const slow = { query: fast.query, execute: fast.execute, close: fast.close };
    expect(slow).not.toHaveProperty('bulkInsert');

    await insertEvents(slow, duckdbDialect, [
      {
        eventId: 7,
        activity: 'review',
        timestamp: new Date('2026-08-02T00:00:00.000Z'),
        lifecycle: 'complete',
        resource: 'bob',
        durationSeconds: null,
        bindingId: 'b',
        attributes: {},
      },
    ]);
    const { rows } = await fast.query('SELECT activity FROM malkom_events', []);
    expect(rows).toHaveLength(1);
    expect(String(rows[0]!['activity'])).toBe('review');
    await fast.close();
  });
});
