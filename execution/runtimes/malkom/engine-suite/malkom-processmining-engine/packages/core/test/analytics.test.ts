import { rm } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PerspectiveUnavailableError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { analysePerformance, formatDuration } from '../src/runtime/performance.js';
import { analyseVariants, formatPath } from '../src/runtime/variants.js';
import { analyseOrganizational, normalisedEntropy } from '../src/runtime/organizational.js';
import { checkConformance } from '../src/runtime/conformance.js';
import { treeToPetriNet, NetIndex, modelActivities } from '../src/runtime/petrinet.js';
import { replayTrace } from '../src/runtime/conformance.js';
import type { ProcessTree } from '../src/runtime/inductive.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { mineProcessTree } from '../src/runtime/inductive.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir, writeCsvLog, CHOICE_LOG, LOOP_LOG } from './helpers/logs.js';

let dir: string;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/**
 * The fixture spaces events one hour apart within a case and gives every case
 * a fresh day, so waiting times are exactly 3600s and every figure below can
 * be worked out by hand rather than copied from a previous run.
 */
async function loadLog(name: string, traces: readonly (readonly string[])[]): Promise<SqlClient> {
  const path = await writeCsvLog(dir, name, traces);
  const client = await openMemoryDuckDB();
  await importCsv(client, duckdbDialect, { path });
  return client;
}

describe('performance: where the time goes', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('measures waiting between consecutive steps', async () => {
    client = await loadLog('perf-seq.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });

    expect(report.caseCount).toBe(2);
    expect(report.eventCount).toBe(6);

    const bWait = report.activities.find((x) => x.activity === 'b')?.waiting;
    expect(bWait?.p50).toBeCloseTo(3600, 0);
    expect(bWait?.count).toBe(2);

    // Nothing precedes 'a', so it has no waiting observations at all.
    expect(report.activities.find((x) => x.activity === 'a')?.waiting.count).toBe(0);
  });

  it('reports cycle time per case', async () => {
    client = await loadLog('perf-cycle.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });
    // Three events an hour apart: first to last is two hours.
    expect(report.cases.cycleTime.p50).toBeCloseTo(7200, 0);
    expect(report.cases.caseCount).toBe(2);
  });

  it('ranks transitions by TOTAL delay, not by the slowest single instance', async () => {
    // a->b happens 10 times at 1h each; x->y happens once at ~1h. Frequency,
    // not per-instance duration, is what should decide the ranking.
    const traces = [...Array.from({ length: 10 }, () => ['a', 'b']), ['x', 'y']];
    client = await loadLog('perf-rank.csv', traces);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });

    const ab = report.transitions.find((t) => t.from === 'a' && t.to === 'b');
    const xy = report.transitions.find((t) => t.from === 'x' && t.to === 'y');
    expect(ab?.frequency).toBe(10);
    expect(xy?.frequency).toBe(1);
    expect((ab?.totalWait ?? 0)).toBeGreaterThan(xy?.totalWait ?? 0);
    expect(report.transitions[0]?.from).toBe('a'); // sorted worst-first
  });

  it('separates waiting from handling in the bottleneck advice', async () => {
    client = await loadLog('perf-advice.csv', [['a', 'b'], ['a', 'b']]);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });

    const waitBottleneck = report.bottlenecks.find((b) => b.kind === 'transition-wait');
    expect(waitBottleneck?.advice).toContain('routing');
    expect(waitBottleneck?.advice).not.toContain('headcount, ');
  });

  it('reports SLA breaches against a threshold', async () => {
    client = await loadLog('perf-sla.csv', [
      ['a', 'b'], // 1 hour
      ['a', 'b', 'c', 'd'], // 3 hours
    ]);
    const report = await analysePerformance(client, duckdbDialect, {
      objectType: 'case',
      slaSeconds: 7200, // 2 hours
    });

    expect(report.sla?.total).toBe(2);
    expect(report.sla?.breached).toBe(1);
    expect(report.sla?.breachRate).toBeCloseTo(0.5, 5);
    expect(report.sla?.medianOvershoot).toBeCloseTo(3600, 0);
  });

  it('gives percentiles as well as a mean, because the tail is the point', async () => {
    client = await loadLog('perf-pct.csv', [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
    ]);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });
    const wait = report.activities.find((x) => x.activity === 'b')?.waiting;
    expect(wait?.p50).toBeCloseTo(3600, 0);
    expect(wait?.p90).toBeCloseTo(3600, 0);
    expect(wait?.mean).toBeCloseTo(3600, 0);
  });

  it('formats durations for humans', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(5400)).toBe('1.5h');
    expect(formatDuration(172800)).toBe('2.0d');
    expect(formatDuration(null)).toBe('—');
  });

  it('says handling is UNKNOWN, not zero, when the log never recorded it', async () => {
    // Found on BPI Challenge 2012, which records no handling times. Reporting
    // "0% being worked, 100% waiting" asserts a measurement never taken, and
    // reads as though the work sat untouched the whole time.
    client = await loadLog('perf-noduration.csv', [['a', 'b', 'c']]);
    const report = await analysePerformance(client, duckdbDialect, { objectType: 'case' });

    expect(report.cases.durationsRecorded).toBe(0);
    expect(report.cases.handlingRatio).toBeNull();
    // And no handling bottleneck is invented from the absence.
    expect(report.bottlenecks.every((b) => b.kind !== 'activity-handling')).toBe(true);
  });
});

describe('variants: which paths people actually take', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('groups cases by their exact activity sequence', async () => {
    client = await loadLog('var-basic.csv', CHOICE_LOG); // 2x a,b,d and 2x a,c,d
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });

    expect(report.totalCases).toBe(4);
    expect(report.totalVariants).toBe(2);
    expect(report.variants[0]?.cases).toBe(2);
    expect(report.variants[0]?.share).toBeCloseTo(0.5, 5);
    expect(report.variants.map((v) => v.path.join('>')).sort()).toEqual(['a>b>d', 'a>c>d']);
  });

  it('distinguishes paths that share activities but not order', async () => {
    client = await loadLog('var-order.csv', [
      ['a', 'b', 'c'],
      ['a', 'c', 'b'],
    ]);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    // Same three activities, two different processes.
    expect(report.totalVariants).toBe(2);
  });

  it('accumulates share so the head of the distribution is visible', async () => {
    const traces = [
      ...Array.from({ length: 8 }, () => ['a', 'b']),
      ...Array.from({ length: 2 }, () => ['a', 'c']),
    ];
    client = await loadLog('var-cum.csv', traces);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });

    expect(report.variants[0]?.share).toBeCloseTo(0.8, 5);
    expect(report.variants[0]?.cumulativeShare).toBeCloseTo(0.8, 5);
    expect(report.variants[1]?.cumulativeShare).toBeCloseTo(1.0, 5);
  });

  it('reports how many variants cover 80% of cases', async () => {
    // One dominant path plus four one-offs, 12 cases total. 80% of 12 is 9.6,
    // so 10 cases must be covered: 8 + 1 + 1 gets there at the THIRD variant.
    const traces = [
      ...Array.from({ length: 8 }, () => ['a', 'b']),
      ['a', 'c'],
      ['a', 'd'],
      ['a', 'e'],
      ['a', 'f'],
    ];
    client = await loadLog('var-80.csv', traces);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });

    expect(report.totalVariants).toBe(5);
    expect(report.variantsFor80Percent).toBe(3);
    expect(report.singletonVariants).toBe(4);
    expect(report.singletonCases).toBe(4);
  });

  it('needs only one variant when the process is standardised', async () => {
    // The contrast that makes the number meaningful: 3 says standardised,
    // 400 says it is not.
    client = await loadLog('var-80-tight.csv', Array.from({ length: 10 }, () => ['a', 'b']));
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    expect(report.variantsFor80Percent).toBe(1);
    expect(report.singletonVariants).toBe(0);
  });

  it('rolls up the tail rather than dropping it silently', async () => {
    const traces = Array.from({ length: 10 }, (_, i) => ['start', `step-${i}`, 'end']);
    client = await loadLog('var-tail.csv', traces);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case', limit: 3 });

    expect(report.variants).toHaveLength(3);
    expect(report.remainder?.variants).toBe(7);
    expect(report.remainder?.cases).toBe(7);
    expect(report.remainder?.share).toBeCloseTo(0.7, 5);
  });

  it('reports cycle time per variant, since one path can run at two speeds', async () => {
    client = await loadLog('var-speed.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    expect(report.variants[0]?.medianCycleSeconds).toBeCloseTo(7200, 0);
  });

  it('carries sample case ids so a finding can be traced back', async () => {
    client = await loadLog('var-samples.csv', CHOICE_LOG);
    const report = await analyseVariants(client, duckdbDialect, { objectType: 'case' });
    expect(report.variants[0]?.sampleCases.length).toBeGreaterThan(0);
    expect(report.variants[0]?.sampleCases[0]).toMatch(/^case-/);
  });

  it('truncates a long path for display without losing the count', () => {
    expect(formatPath(['a', 'b', 'c'])).toBe('a → b → c');
    const long = Array.from({ length: 20 }, (_, i) => `s${i}`);
    expect(formatPath(long, 4)).toContain('(+17 more)');
  });
});

describe('organizational: who does the work', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('profiles each resource and their share of the work', async () => {
    // writeCsvLog alternates alice/bob by (trace + position).
    client = await loadLog('org-basic.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const report = await analyseOrganizational(client, duckdbDialect, { objectType: 'case' });

    expect(report.resourceCount).toBe(2);
    const shares = report.resources.map((r) => r.workloadShare);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('counts handovers only when the person actually changes', async () => {
    client = await loadLog('org-handover.csv', [['a', 'b', 'c']]);
    const report = await analyseOrganizational(client, duckdbDialect, { objectType: 'case' });

    for (const h of report.handovers) {
      expect(h.from).not.toBe(h.to); // a person handing to themselves is not a handover
    }
    expect(report.handovers.length).toBeGreaterThan(0);
  });

  it('identifies an activity only one person ever does', async () => {
    const path = await writeCsvLog(dir, 'org-spof.csv', [['intake', 'approve'], ['intake', 'approve']], {
      resources: ['solo'],
    });
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await analyseOrganizational(client, duckdbDialect, { objectType: 'case' });
    const approve = report.activityOwnership.find((a) => a.activity === 'approve');
    expect(approve?.distinctResources).toBe(1);
    expect(approve?.singlePointOfFailure).toBe(true);
    expect(report.singleHandlerCases).toBe(2);
    expect(report.handovers).toHaveLength(0);
  });

  it('refuses rather than reporting an empty team', async () => {
    // A log with no resource column at all: reporting zeros would read as
    // "nobody did anything", which is a different claim from "not recorded".
    const path = await writeCsvLog(dir, 'org-none.csv', [['a', 'b']]);
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path, mapping: { resource: '__absent__' } });

    await expect(
      analyseOrganizational(client, duckdbDialect, { objectType: 'case' }),
    ).rejects.toThrow(PerspectiveUnavailableError);
    await expect(
      analyseOrganizational(client, duckdbDialect, { objectType: 'case' }),
    ).rejects.toThrow(/records who performed the work/);
  });

  it('scores specialisation from 0 (one task) to 1 (evenly spread)', () => {
    expect(normalisedEntropy([10])).toBe(0);
    expect(normalisedEntropy([5, 5])).toBeCloseTo(1, 5);
    expect(normalisedEntropy([9, 1])).toBeLessThan(0.5);
    expect(normalisedEntropy([])).toBe(0);
    // Normalisation is what makes two people comparable across different
    // numbers of activity types.
    expect(normalisedEntropy([5, 5])).toBeCloseTo(normalisedEntropy([5, 5, 5]), 5);
  });
});

describe('petri net translation', () => {
  it('turns a sequence into a chain with one source and one sink', () => {
    const tree: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'a' },
        { op: 'activity', label: 'b' },
      ],
    };
    const net = treeToPetriNet(tree);
    expect(modelActivities(net)).toEqual(['a', 'b']);
    expect(net.initial).not.toBe(net.final);

    const index = new NetIndex(net);
    // 'a' is enabled at the start; 'b' is not.
    const start = new Map([[net.initial, 1]]);
    expect(index.byLabel.get('a')!.some((t) => index.isEnabled(start, t))).toBe(true);
    expect(index.byLabel.get('b')!.some((t) => index.isEnabled(start, t))).toBe(false);
  });

  it('gives a parallel block an explicit split and join', () => {
    const tree: ProcessTree = {
      op: 'and',
      children: [
        { op: 'activity', label: 'a' },
        { op: 'activity', label: 'b' },
      ],
    };
    const net = treeToPetriNet(tree);
    // Two silent transitions: the split and the join.
    expect(net.transitions.filter((t) => t.label === null)).toHaveLength(2);
  });

  it('routes a loop redo back to the body entry', () => {
    const tree: ProcessTree = {
      op: 'loop',
      children: [
        { op: 'activity', label: 'body' },
        { op: 'activity', label: 'redo' },
      ],
    };
    const net = treeToPetriNet(tree);
    const index = new NetIndex(net);
    // After body, redo is enabled; after redo, body is enabled again.
    let marking = new Map([[net.initial, 1]]);
    const body = index.byLabel.get('body')![0]!;
    marking = index.fire(marking, body);
    const redo = index.byLabel.get('redo')![0]!;
    expect(index.isEnabled(marking, redo)).toBe(true);
    marking = index.fire(marking, redo);
    expect(index.isEnabled(marking, body)).toBe(true);
  });
});

describe('conformance: reality against intent', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  const intended: ProcessTree = {
    op: 'seq',
    children: [
      { op: 'activity', label: 'a' },
      { op: 'activity', label: 'b' },
      { op: 'activity', label: 'c' },
    ],
  };

  it('scores a conforming log as perfectly fitting', async () => {
    client = await loadLog('conf-good.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ]);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });

    expect(report.logFitness).toBeCloseTo(1, 5);
    expect(report.perfectlyFittingRate).toBeCloseTo(1, 5);
    expect(report.deviations).toHaveLength(0);
  });

  it('flags an activity the model does not contain', async () => {
    client = await loadLog('conf-extra.csv', [
      ['a', 'b', 'c'],
      ['a', 'b', 'rogue', 'c'],
    ]);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });

    expect(report.unmodelledActivities).toEqual(['rogue']);
    const deviation = report.deviations.find((d) => d.activity === 'rogue');
    expect(deviation?.kind).toBe('not-in-model');
    expect(deviation?.cases).toBe(1);
    expect(deviation?.explanation).toContain('off-process');
  });

  it('flags a skipped prerequisite as out of order', async () => {
    client = await loadLog('conf-skip.csv', [
      ['a', 'b', 'c'],
      ['a', 'c'], // b never happened
    ]);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });

    expect(report.logFitness).toBeLessThan(1);
    expect(report.perfectlyFittingCases).toBe(1);
    expect(report.deviations.some((d) => d.activity === 'c' && d.kind === 'out-of-order')).toBe(true);
  });

  it('reports model steps the log never performs', async () => {
    client = await loadLog('conf-unused.csv', [['a', 'b']]);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });
    expect(report.unusedModelActivities).toEqual(['c']);
  });

  it('weights findings by how many cases they affect', async () => {
    const traces = [
      ...Array.from({ length: 9 }, () => ['a', 'b', 'c']),
      ['a', 'b', 'rogue', 'c'],
    ];
    client = await loadLog('conf-weight.csv', traces);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });

    expect(report.totalCases).toBe(10);
    expect(report.perfectlyFittingCases).toBe(9);
    expect(report.perfectlyFittingRate).toBeCloseTo(0.9, 5);
    // Two variants, ten cases — replay runs per variant, not per case.
    expect(report.variantsReplayed).toBe(2);
  });

  it('accepts a discovered model as its own reference', async () => {
    // Discovery then conformance against the discovered model: by construction
    // the log should fit its own map almost perfectly. A poor score here would
    // mean discovery and replay disagree about the same data.
    client = await loadLog('conf-selfcheck.csv', LOOP_LOG);
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case' });
    const discovered = mineProcessTree(dfg).tree;

    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: discovered,
    });
    expect(report.logFitness).toBeGreaterThan(0.95);
  });

  it('replays a silent skip without calling it a deviation', () => {
    // ->( 'a', X( 'b', tau ), 'c' ) — b is optional by design.
    const optional: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'a' },
        { op: 'xor', children: [{ op: 'activity', label: 'b' }, { op: 'tau' }] },
        { op: 'activity', label: 'c' },
      ],
    };
    const net = treeToPetriNet(optional);
    const index = new NetIndex(net);
    const labels = new Set(modelActivities(net));

    expect(replayTrace(index, ['a', 'b', 'c'], labels).perfect).toBe(true);
    // Taking the silent branch must score as a clean fit, not a skipped step.
    expect(replayTrace(index, ['a', 'c'], labels).perfect).toBe(true);
  });

  it('replays a loop repeated more than once', () => {
    const loop: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'start' },
        { op: 'loop', children: [{ op: 'activity', label: 'work' }, { op: 'activity', label: 'again' }] },
        { op: 'activity', label: 'done' },
      ],
    };
    const net = treeToPetriNet(loop);
    const index = new NetIndex(net);
    const labels = new Set(modelActivities(net));

    const result = replayTrace(index, ['start', 'work', 'again', 'work', 'again', 'work', 'done'], labels);
    expect(result.perfect).toBe(true);
    expect(result.fitness).toBeCloseTo(1, 5);
  });

  it('reports how much of the log it actually replayed', async () => {
    // Capping the variant page and then printing a rate over the whole log
    // overstates the result. Found on BPIC 2012: 2,000 of 4,336 paths replayed,
    // reported as "100%".
    const traces = Array.from({ length: 10 }, (_, i) => ['a', `x${i}`, 'b']);
    client = await loadLog('conf-coverage.csv', traces);

    const capped = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
      limit: 3,
    });
    expect(capped.variantsReplayed).toBe(3);
    expect(capped.casesReplayed).toBe(3);
    expect(capped.totalCases).toBe(10);
    expect(capped.coverage).toBeCloseTo(0.3, 5);
    expect(capped.remainder?.variants).toBe(7);

    const full = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
      limit: 100,
    });
    expect(full.coverage).toBeCloseTo(1, 5);
  });

  it('flags a flower model, whose perfect fitness means nothing', async () => {
    client = await loadLog('conf-flower.csv', [['a', 'b', 'c']]);

    // A flower buried inside a tidy sequence still accepts almost anything —
    // checking only the root would miss it.
    const nestedFlower: ProcessTree = {
      op: 'seq',
      children: [
        { op: 'activity', label: 'a' },
        {
          op: 'loop',
          children: [{ op: 'tau' }, { op: 'activity', label: 'b' }, { op: 'activity', label: 'c' }],
        },
      ],
    };

    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: nestedFlower,
    });
    expect(report.logFitness).toBeCloseTo(1, 5);
    expect(report.modelIsPermissive).toBe(true);
    expect(report.permissiveShare).toBeCloseTo(2 / 3, 3);
  });

  it('does not flag a genuinely structured model as permissive', async () => {
    client = await loadLog('conf-structured.csv', [['a', 'b', 'c']]);
    const report = await checkConformance(client, duckdbDialect, {
      objectType: 'case',
      model: intended,
    });
    expect(report.modelIsPermissive).toBe(false);
    expect(report.permissiveShare).toBe(0);
  });

  it('scores an entirely wrong trace poorly but never below zero', () => {
    const net = treeToPetriNet({
      op: 'seq',
      children: [
        { op: 'activity', label: 'a' },
        { op: 'activity', label: 'b' },
      ],
    });
    const index = new NetIndex(net);
    const labels = new Set(modelActivities(net));

    const result = replayTrace(index, ['b', 'b', 'b'], labels);
    expect(result.fitness).toBeGreaterThanOrEqual(0);
    expect(result.fitness).toBeLessThan(0.9);
    expect(result.perfect).toBe(false);
  });
});
