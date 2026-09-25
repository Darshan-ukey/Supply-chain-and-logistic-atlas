#!/usr/bin/env node
/**
 * Lays out a mined log and bins its dotted chart, reporting the sizes that
 * decide whether a browser can render the result.
 *
 *   node examples/layout-check.mjs examples/data/bpic12.duckdb
 */
import {
  buildDfg,
  createDuckDBClient,
  cycleTimeHistogram,
  dottedChart,
  duckdbDialect,
  layoutCacheKey,
  layoutDfg,
  throughput,
} from '@malkom/mining-core';

const store = process.argv[2] ?? 'examples/data/bpic12.duckdb';
const client = await createDuckDBClient(store);

try {
  const t0 = Date.now();
  const dfg = await buildDfg(client, duckdbDialect, {
    objectType: 'case',
    lifecycle: ['complete'],
    edgeThreshold: 0.05,
  });
  const tDfg = Date.now() - t0;

  const t1 = Date.now();
  const graph = await layoutDfg(dfg);
  const tLayout = Date.now() - t1;

  console.log(`\ngraph      ${dfg.activities.length} activities, ${dfg.edges.length} arcs`);
  console.log(`dfg        ${tDfg} ms`);
  console.log(`layout     ${tLayout} ms  ->  ${Math.round(graph.width)} x ${Math.round(graph.height)} px`);
  console.log(`cache key  ${layoutCacheKey(dfg)}`);
  console.log(`nodes      ${graph.nodes.length}  (incl. start/end markers)`);
  console.log(`edges      ${graph.edges.length}, ${graph.edges.filter((e) => e.selfLoop).length} self-loops`);
  console.log(`payload    ${(JSON.stringify(graph).length / 1024).toFixed(0)} KB of JSON`);

  const t2 = Date.now();
  const dotted = await dottedChart(client, duckdbDialect, {
    objectType: 'case',
    lifecycle: ['complete'],
    xBins: 400,
    yBins: 300,
  });
  const tDotted = Date.now() - t2;

  console.log(`\ndotted     ${dotted.eventCount.toLocaleString()} events -> ${dotted.bins.length.toLocaleString()} bins in ${tDotted} ms`);
  console.log(`           ${(dotted.eventCount / Math.max(1, dotted.bins.length)).toFixed(1)}x reduction, busiest cell ${dotted.maxValue}`);
  console.log(`           payload ${(JSON.stringify(dotted).length / 1024).toFixed(0)} KB`);

  const histogram = await cycleTimeHistogram(client, duckdbDialect, {
    objectType: 'case',
    lifecycle: ['complete'],
  });
  console.log(
    `\nhistogram  ${histogram.n.toLocaleString()} cases in ${histogram.buckets.length} ${histogram.logarithmic ? 'log' : 'even'} buckets`,
  );

  const series = await throughput(client, duckdbDialect, {
    objectType: 'case',
    lifecycle: ['complete'],
    granularity: 'week',
  });
  console.log(`throughput ${series.length} weekly points\n`);
} finally {
  await client.close();
}
