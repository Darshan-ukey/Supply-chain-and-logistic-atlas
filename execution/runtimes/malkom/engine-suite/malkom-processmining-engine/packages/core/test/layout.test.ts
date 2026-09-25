import { rm } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConfigInvalidError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { buildDfg } from '../src/runtime/dfg.js';
import {
  END_NODE_ID,
  START_NODE_ID,
  layoutCacheKey,
  layoutDfg,
} from '../src/runtime/layout.js';
import { cycleTimeHistogram, dottedChart, throughput } from '../src/runtime/charts.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { CHOICE_LOG, LOOP_LOG, makeTempDir, writeCsvLog } from './helpers/logs.js';

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

async function load(name: string, traces: readonly (readonly string[])[]): Promise<SqlClient> {
  const path = await writeCsvLog(dir, name, traces);
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('layout', () => {
  it('gives every activity a position and a size', async () => {
    client = await load('layout-basic.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    const activities = graph.nodes.filter((n) => n.kind === 'activity');
    expect(activities).toHaveLength(4); // a, b, c, d
    for (const node of activities) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
    expect(graph.width).toBeGreaterThan(0);
    expect(graph.height).toBeGreaterThan(0);
  });

  it('adds start and end markers, sized as markers not as activities', async () => {
    client = await load('layout-endpoints.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    const start = graph.nodes.find((n) => n.id === START_NODE_ID);
    const end = graph.nodes.find((n) => n.id === END_NODE_ID);
    expect(start?.kind).toBe('start');
    expect(end?.kind).toBe('end');
    // A marker must not be sized like a labelled box or it distorts its layer.
    const widest = Math.max(...graph.nodes.filter((n) => n.kind === 'activity').map((n) => n.width));
    expect(start!.width).toBeLessThan(widest);
  });

  it('omits the markers when asked to', async () => {
    client = await load('layout-noendpoints.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg, { includeEndpoints: false });
    expect(graph.nodes.every((n) => n.kind === 'activity')).toBe(true);
  });

  it('routes every edge as a polyline of at least two points', async () => {
    client = await load('layout-edges.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    for (const edge of graph.edges) {
      // An empty polyline makes an arc silently vanish from the map.
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(edge.labelAnchor.x)).toBe(true);
    }
  });

  it('keeps a self-loop visible rather than dropping it', async () => {
    // Rework arcs are exactly what a reader is looking for; losing them to a
    // routing failure would remove the finding along with the line.
    client = await load('layout-loop.csv', [
      ['a', 'b', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    const loop = graph.edges.find((e) => e.selfLoop);
    expect(loop).toBeDefined();
    expect(loop!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('returns weights the renderer can map straight to a visual channel', async () => {
    client = await load('layout-weights.csv', [
      ...Array.from({ length: 10 }, () => ['a', 'b']),
      ['a', 'z'],
    ]);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    const busiest = graph.edges.find((e) => e.from === 'a' && e.to === 'b');
    const rare = graph.edges.find((e) => e.from === 'a' && e.to === 'z');
    expect(busiest!.weight).toBeCloseTo(1, 5);
    expect(rare!.weight).toBeLessThan(busiest!.weight);
    for (const node of graph.nodes.filter((n) => n.kind === 'activity')) {
      expect(node.weight).toBeGreaterThanOrEqual(0);
      expect(node.weight).toBeLessThanOrEqual(1);
    }
  });

  it('keeps frequency and delay as separate visual channels', async () => {
    // A rare arc can be the slowest, and a busy one instant. Collapsing both
    // into one channel makes a map look informative while hiding the delay.
    client = await load('layout-channels.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const graph = await layoutDfg(dfg);

    for (const edge of graph.edges) {
      expect(edge).toHaveProperty('weight');
      expect(edge).toHaveProperty('delayWeight');
    }
    expect(graph.scales.maxEdgeFrequency).toBeGreaterThan(0);
  });

  it('lays out left-to-right when asked', async () => {
    client = await load('layout-rtl.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const down = await layoutDfg(dfg, { direction: 'DOWN' });
    const right = await layoutDfg(dfg, { direction: 'RIGHT' });

    expect(right.direction).toBe('RIGHT');
    // A sequence laid out sideways is wider than tall, and vice versa.
    expect(right.width / right.height).toBeGreaterThan(down.width / down.height);
  });

  it('is deterministic, so a cached layout stays valid', async () => {
    client = await load('layout-stable.csv', LOOP_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const first = await layoutDfg(dfg);
    const second = await layoutDfg(dfg);
    expect(second.nodes.map((n) => [n.id, n.x, n.y])).toEqual(
      first.nodes.map((n) => [n.id, n.x, n.y]),
    );
  });

  it('keys the cache on structure, not on frequencies', async () => {
    client = await load('layout-cachekey.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const key = layoutCacheKey(dfg);

    // Same shape, different counts: the geometry is identical, so a refresh
    // must not miss the cache.
    const busier = {
      ...dfg,
      activities: dfg.activities.map((a) => ({ ...a, frequency: a.frequency * 3 })),
      edges: dfg.edges.map((e) => ({ ...e, frequency: e.frequency * 3 })),
    };
    expect(layoutCacheKey(busier)).toBe(key);

    // A different direction is a different layout.
    expect(layoutCacheKey(dfg, { direction: 'RIGHT' })).not.toBe(key);
  });

  it('names the package when elkjs is absent', async () => {
    client = await load('layout-noelk.csv', CHOICE_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    await expect(
      layoutDfg(dfg, {
        importModule: async () => {
          const err = new Error("Cannot find package 'elkjs'");
          (err as NodeJS.ErrnoException).code = 'ERR_MODULE_NOT_FOUND';
          throw err;
        },
      }),
    ).rejects.toThrow(ConfigInvalidError);
  });
});

describe('dotted chart', () => {
  it('returns a bounded grid rather than one mark per event', async () => {
    // The whole point: a real log has millions of events and SVG dies at ~5k.
    const traces = Array.from({ length: 200 }, (_, i) => ['a', 'b', 'c', `x${i % 7}`]);
    client = await load('dotted-grid.csv', traces);

    const chart = await dottedChart(client, duckdbDialect, {
      objectType: 'case',
      xBins: 20,
      yBins: 10,
    });

    expect(chart.eventCount).toBe(800);
    expect(chart.bins.length).toBeLessThanOrEqual(20 * 10);
    expect(chart.bins.length).toBeLessThan(chart.eventCount);
    expect(chart.binned).toBe(true);
    for (const bin of chart.bins) {
      expect(bin.x).toBeGreaterThanOrEqual(0);
      expect(bin.x).toBeLessThan(20);
      expect(bin.y).toBeGreaterThanOrEqual(0);
      expect(bin.y).toBeLessThan(10);
    }
  });

  it('accounts for every event exactly once', async () => {
    client = await load('dotted-total.csv', CHOICE_LOG);
    const chart = await dottedChart(client, duckdbDialect, { objectType: 'case', xBins: 8, yBins: 8 });
    const summed = chart.bins.reduce((total, b) => total + b.value, 0);
    expect(summed).toBe(chart.eventCount);
  });

  it('reports the busiest cell so opacity can be scaled in one pass', async () => {
    client = await load('dotted-max.csv', CHOICE_LOG);
    const chart = await dottedChart(client, duckdbDialect, { objectType: 'case' });
    expect(chart.maxValue).toBe(Math.max(...chart.bins.map((b) => b.value)));
  });

  it('changes the picture when the sort changes', async () => {
    // Sorted by start it shows arrivals; by duration it shows the long tail.
    // Same data, two different stories — so it is never chosen silently.
    const traces = [
      ...Array.from({ length: 30 }, () => ['a', 'b']),
      ...Array.from({ length: 30 }, () => ['a', 'b', 'c', 'd', 'e']),
    ];
    client = await load('dotted-sort.csv', traces);

    const byStart = await dottedChart(client, duckdbDialect, { objectType: 'case', sortBy: 'start' });
    const byDuration = await dottedChart(client, duckdbDialect, {
      objectType: 'case',
      sortBy: 'duration',
    });
    expect(byStart.sortedBy).toBe('start');
    expect(byDuration.sortedBy).toBe('duration');
    expect(byDuration.bins).not.toEqual(byStart.bins);
  });

  it('honours a case filter', async () => {
    client = await load('dotted-filter.csv', CHOICE_LOG);
    const all = await dottedChart(client, duckdbDialect, { objectType: 'case' });
    const some = await dottedChart(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'activity', activity: 'b' },
    });
    expect(some.caseCount).toBeLessThan(all.caseCount);
  });

  it('returns an empty grid for an empty selection instead of failing', async () => {
    client = await load('dotted-empty.csv', CHOICE_LOG);
    const chart = await dottedChart(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'cases', ids: [] },
    });
    expect(chart.bins).toEqual([]);
    expect(chart.eventCount).toBe(0);
    expect(chart.timeFrom).toBeNull();
  });
});

describe('cycle time histogram', () => {
  it('buckets durations logarithmically by default', async () => {
    // Even buckets put 99% of cases in the first bar for this shape of data.
    const traces = [
      ...Array.from({ length: 50 }, () => ['a', 'b']),
      ...Array.from({ length: 5 }, () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
    ];
    client = await load('hist-log.csv', traces);

    const histogram = await cycleTimeHistogram(client, duckdbDialect, {
      objectType: 'case',
      buckets: 10,
    });
    expect(histogram.logarithmic).toBe(true);
    expect(histogram.buckets).toHaveLength(10);
    expect(histogram.n).toBe(55);
    // Bucket edges grow, they do not step evenly.
    const first = histogram.buckets[0]!;
    const last = histogram.buckets[9]!;
    expect(last.to - last.from).toBeGreaterThan(first.to - first.from);
  });

  it('counts every case exactly once', async () => {
    client = await load('hist-total.csv', CHOICE_LOG);
    const histogram = await cycleTimeHistogram(client, duckdbDialect, { objectType: 'case' });
    expect(histogram.buckets.reduce((t, b) => t + b.count, 0)).toBe(histogram.n);
  });

  it('supports even buckets on request', async () => {
    client = await load('hist-linear.csv', CHOICE_LOG);
    const histogram = await cycleTimeHistogram(client, duckdbDialect, {
      objectType: 'case',
      linear: true,
      buckets: 5,
    });
    expect(histogram.logarithmic).toBe(false);
    const widths = histogram.buckets.map((b) => b.to - b.from);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-6);
  });

  it('carries percentiles alongside the buckets', async () => {
    client = await load('hist-pct.csv', CHOICE_LOG);
    const histogram = await cycleTimeHistogram(client, duckdbDialect, { objectType: 'case' });
    expect(histogram.p50).not.toBeNull();
    expect(histogram.p90).toBeGreaterThanOrEqual(histogram.p50!);
  });
});

describe('throughput', () => {
  it('counts cases per interval', async () => {
    client = await load('tp-basic.csv', CHOICE_LOG); // one case per day
    const series = await throughput(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'day',
    });
    expect(series.length).toBeGreaterThan(0);
    expect(series.reduce((t, p) => t + p.cases, 0)).toBe(4);
    expect(series[0]?.at).toBeInstanceOf(Date);
  });

  it('separates demand from delivery', async () => {
    // Counting at the start shows arrivals, at the end shows completions, and
    // the gap between them is the backlog.
    client = await load('tp-updown.csv', [
      ['a', 'b'],
      ['a', 'b', 'c', 'd', 'e', 'f'],
    ]);
    const started = await throughput(client, duckdbDialect, {
      objectType: 'case',
      countAt: 'start',
    });
    const ended = await throughput(client, duckdbDialect, { objectType: 'case', countAt: 'end' });
    expect(started.reduce((t, p) => t + p.cases, 0)).toBe(2);
    expect(ended.reduce((t, p) => t + p.cases, 0)).toBe(2);
  });

  it('aggregates to a coarser grain', async () => {
    client = await load('tp-month.csv', CHOICE_LOG);
    const monthly = await throughput(client, duckdbDialect, {
      objectType: 'case',
      granularity: 'month',
    });
    expect(monthly).toHaveLength(1); // the fixture spans four days
    expect(monthly[0]?.cases).toBe(4);
  });
});
