import type { ActivityStats, Dfg } from '../../src/runtime/dfg.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Known-answer fixtures: logs whose process structure is decided in advance,
 * so the miner's output can be checked against a correct answer rather than
 * against whatever it happened to produce.
 */

export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'malkom-mining-'));
}

/** Write traces as an XES-convention CSV. Each trace is a list of activities. */
export async function writeCsvLog(
  dir: string,
  name: string,
  traces: readonly (readonly string[])[],
  opts: { resources?: readonly string[]; caseAttribute?: string } = {},
): Promise<string> {
  const path = join(dir, name);
  const headers = ['case:concept:name', 'concept:name', 'time:timestamp', 'org:resource'];
  if (opts.caseAttribute !== undefined) headers.push('case:channel');

  const lines = [headers.join(',')];
  // A fixed base instant keeps ordering deterministic and the assertions
  // independent of when the suite runs.
  const base = Date.parse('2026-01-01T00:00:00Z');
  const resources = opts.resources ?? ['alice', 'bob'];

  traces.forEach((trace, t) => {
    trace.forEach((activity, i) => {
      const ts = new Date(base + t * 86_400_000 + i * 3_600_000).toISOString();
      const resource = resources[(t + i) % resources.length]!;
      const cells = [`case-${t + 1}`, activity, ts, resource];
      if (opts.caseAttribute !== undefined) cells.push(t % 2 === 0 ? 'web' : 'phone');
      lines.push(cells.join(','));
    });
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  return path;
}

/** Write traces as a XES XML document. */
export async function writeXesLog(
  dir: string,
  name: string,
  traces: readonly (readonly string[])[],
): Promise<string> {
  const path = join(dir, name);
  const base = Date.parse('2026-01-01T00:00:00Z');

  const body = traces
    .map((trace, t) => {
      const events = trace
        .map((activity, i) => {
          const ts = new Date(base + t * 86_400_000 + i * 3_600_000).toISOString();
          return [
            '    <event>',
            `      <string key="concept:name" value="${activity}"/>`,
            `      <date key="time:timestamp" value="${ts}"/>`,
            `      <string key="org:resource" value="${t % 2 === 0 ? 'alice' : 'bob'}"/>`,
            '      <string key="lifecycle:transition" value="complete"/>',
            '    </event>',
          ].join('\n');
        })
        .join('\n');
      return [
        '  <trace>',
        `    <string key="concept:name" value="case-${t + 1}"/>`,
        `    <string key="channel" value="${t % 2 === 0 ? 'web' : 'phone'}"/>`,
        events,
        '  </trace>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<log xes.version="1.0" xmlns="http://www.xes-standard.org/">',
    '  <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>',
    '  <extension name="Time" prefix="time" uri="http://www.xes-standard.org/time.xesext"/>',
    '  <extension name="Organizational" prefix="org" uri="http://www.xes-standard.org/org.xesext"/>',
    '  <global scope="event">',
    '    <string key="concept:name" value="__INVALID__"/>',
    '    <date key="time:timestamp" value="1970-01-01T00:00:00.000+00:00"/>',
    '    <string key="org:resource" value="__INVALID__"/>',
    '  </global>',
    body,
    '</log>',
  ].join('\n');

  await writeFile(path, xml, 'utf8');
  return path;
}

/**
 * A directly-follows graph built straight from arc counts.
 *
 * For the analyses that are pure functions over the graph — dependency
 * strength, the footprint — going through a CSV import and a real query to
 * arrive at counts the test already knows adds a database round trip without
 * adding a check. Counts stated here are the known answer.
 */
export function dfgFixture(edges: readonly (readonly [string, string, number])[]): Dfg {
  const names = new Set<string>();
  for (const [from, to] of edges) {
    names.add(from);
    names.add(to);
  }

  const activities: ActivityStats[] = [...names].sort().map((activity) => ({
    activity,
    frequency: edges
      .filter(([from, to]) => from === activity || to === activity)
      .reduce((sum, [, , n]) => sum + n, 0),
    caseCount: 1,
    medianDurationSeconds: null,
    totalCost: null,
    medianCost: null,
  }));

  return {
    objectType: 'case',
    activities,
    edges: edges.map(([from, to, frequency]) => ({
      from,
      to,
      frequency,
      caseCount: frequency,
      medianSeconds: null,
      meanSeconds: null,
    })),
    starts: new Map(),
    ends: new Map(),
    caseCount: 1,
    eventCount: edges.reduce((sum, [, , n]) => sum + n, 0),
  };
}

// ---------------------------------------------------------------------------
// The fixtures, with their expected process trees
// ---------------------------------------------------------------------------

/** a → b → c. Expected: ->( 'a', 'b', 'c' ) */
export const SEQUENCE_LOG: string[][] = [
  ['a', 'b', 'c'],
  ['a', 'b', 'c'],
  ['a', 'b', 'c'],
];

/** a → (b XOR c) → d. Expected: ->( 'a', X( 'b', 'c' ), 'd' ) */
export const CHOICE_LOG: string[][] = [
  ['a', 'b', 'd'],
  ['a', 'b', 'd'],
  ['a', 'c', 'd'],
  ['a', 'c', 'd'],
];

/**
 * a → (b AND c) → d. Both interleavings appear, which is exactly how
 * concurrency shows up in a log — there is no "parallel" marker to read.
 * Expected: ->( 'a', +( 'b', 'c' ), 'd' )
 */
export const PARALLEL_LOG: string[][] = [
  ['a', 'b', 'c', 'd'],
  ['a', 'c', 'b', 'd'],
  ['a', 'b', 'c', 'd'],
  ['a', 'c', 'b', 'd'],
];

/** a → b → (c → b)* → d. Expected: ->( 'a', *( 'b', 'c' ), 'd' ) */
export const LOOP_LOG: string[][] = [
  ['a', 'b', 'd'],
  ['a', 'b', 'c', 'b', 'd'],
  ['a', 'b', 'c', 'b', 'c', 'b', 'd'],
  ['a', 'b', 'd'],
];

/** Two completely disjoint processes — nothing links them. Expected a top-level XOR. */
export const DISJOINT_LOG: string[][] = [
  ['a', 'b'],
  ['a', 'b'],
  ['x', 'y'],
  ['x', 'y'],
];
