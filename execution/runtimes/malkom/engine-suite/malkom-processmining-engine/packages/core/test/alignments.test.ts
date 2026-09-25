import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import type { ProcessTree } from '../src/runtime/inductive.js';
import { treeToPetriNet } from '../src/runtime/petrinet.js';
import { alignLog, alignTrace, type Move } from '../src/runtime/alignments.js';
import { clusterTraces } from '../src/runtime/clustering.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Alignments, and grouping routes into behaviours.
 *
 * An alignment is the answer token replay cannot give: not "82% fitness" but
 * "the check was skipped, here". So every case below states the trace, the
 * model, and the exact sequence of moves that should come back — because an
 * alignment that is merely plausible is worthless. A wrong one still returns a
 * number between 0 and 1 and a list of moves that reads like an explanation.
 *
 * The searches are all checked for `optimal`. A* returning a valid-but-costlier
 * alignment is the failure that hides: the moves are real, the cost is wrong,
 * and the conclusion drawn from it points at the wrong step.
 */

const SEQUENCE: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'submit' },
    { op: 'activity', label: 'check' },
    { op: 'activity', label: 'approve' },
  ],
};

const CHOICE: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'submit' },
    {
      op: 'xor',
      children: [{ op: 'activity', label: 'approve' }, { op: 'activity', label: 'reject' }],
    },
  ],
};

const SKIPPABLE: ProcessTree = {
  op: 'seq',
  children: [
    { op: 'activity', label: 'submit' },
    { op: 'xor', children: [{ op: 'activity', label: 'check' }, { op: 'tau' }] },
    { op: 'activity', label: 'approve' },
  ],
};

/** Render an alignment compactly, so an expectation reads like the picture. */
const render = (moves: readonly Move[]): string =>
  moves
    .map((m) =>
      m.kind === 'sync'
        ? m.activity
        : m.kind === 'log'
          ? `+${m.activity}`
          : m.kind === 'model'
            ? `-${m.activity}`
            : 'tau',
    )
    .join(' ');

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

describe('aligning one trace', () => {
  const net = treeToPetriNet(SEQUENCE);

  it('costs nothing when the log followed the model', async () => {
    const alignment = alignTrace(net, ['submit', 'check', 'approve']);

    expect(alignment.cost).toBe(0);
    expect(alignment.fitness).toBe(1);
    expect(alignment.optimal).toBe(true);
    expect(render(alignment.moves)).toBe('submit check approve');
  });

  it('names the step that was skipped, and where', async () => {
    // The whole reason alignments exist. Replay would say "0.8"; this says
    // which step, at which point in the trace.
    const alignment = alignTrace(net, ['submit', 'approve']);

    expect(render(alignment.moves)).toBe('submit -check approve');
    expect(alignment.cost).toBe(1);
    expect(alignment.optimal).toBe(true);

    const skipped = alignment.moves.find((m) => m.kind === 'model')!;
    expect(skipped.activity).toBe('check');
    expect(skipped.at).toBe(1);
  });

  it('names an event the model has no place for', async () => {
    const alignment = alignTrace(net, ['submit', 'check', 'extra', 'approve']);

    expect(render(alignment.moves)).toBe('submit check +extra approve');
    expect(alignment.cost).toBe(1);
    expect(alignment.optimal).toBe(true);
  });

  it('reports what the model still wanted when a case stopped early', async () => {
    const alignment = alignTrace(net, ['submit', 'check']);
    expect(render(alignment.moves)).toBe('submit check -approve');
    expect(alignment.cost).toBe(1);
  });

  it('walks the model alone for an empty trace', async () => {
    const alignment = alignTrace(net, []);
    expect(render(alignment.moves)).toBe('-submit -check -approve');
    expect(alignment.fitness).toBe(0);
    expect(alignment.optimal).toBe(true);
  });

  it('finds the cheapest explanation, not merely a valid one', async () => {
    // Everything out of order. Several explanations exist; only one is
    // cheapest, and a wrong-but-valid alignment still looks like an answer.
    const alignment = alignTrace(net, ['approve', 'check', 'submit']);

    expect(alignment.optimal).toBe(true);
    expect(alignment.cost).toBe(4);
    // Anything cheaper is impossible: the trace shares only 'submit' with a
    // prefix of the model, so two log moves and two model moves are forced.
    expect(alignment.moves.filter((m) => m.kind === 'sync')).toHaveLength(1);
  });
});

describe('models with choices and silent steps', () => {
  it('takes either branch of a choice for free', async () => {
    const net = treeToPetriNet(CHOICE);
    expect(alignTrace(net, ['submit', 'approve']).cost).toBe(0);
    expect(alignTrace(net, ['submit', 'reject']).cost).toBe(0);
  });

  it('charges for doing both branches', async () => {
    const net = treeToPetriNet(CHOICE);
    const alignment = alignTrace(net, ['submit', 'approve', 'reject']);
    expect(render(alignment.moves)).toBe('submit approve +reject');
    expect(alignment.cost).toBe(1);
  });

  it('charges nothing for a step the model allows to be skipped', async () => {
    // The tau is structure, not behaviour. Charging for it would make every
    // model with an optional branch look violated by a log that follows it.
    const net = treeToPetriNet(SKIPPABLE);
    const alignment = alignTrace(net, ['submit', 'approve']);

    expect(alignment.cost).toBe(0);
    expect(alignment.fitness).toBe(1);
    expect(alignment.moves.some((m) => m.kind === 'silent')).toBe(true);
  });

  it('still aligns the branch that was taken', async () => {
    const net = treeToPetriNet(SKIPPABLE);
    const alignment = alignTrace(net, ['submit', 'check', 'approve']);
    expect(alignment.cost).toBe(0);
    expect(alignment.moves.filter((m) => m.kind === 'sync')).toHaveLength(3);
  });
});

describe('aligning a whole log', () => {
  async function log(traces: readonly (readonly string[])[]): Promise<SqlClient> {
    const path = join(dir, 'align-fixture.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    traces.forEach((trace, t) => {
      trace.forEach((activity, i) => {
        rows.push(`a${t},${activity},2026-03-02T${String(i).padStart(2, '0')}:00:00Z`);
      });
    });
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    const c = await openMemoryDuckDB();
    await importCsv(c, duckdbDialect, { path });
    return c;
  }

  it('rolls deviations up by activity, with the cases behind each', async () => {
    // Seven conforming cases and three that skipped the check. The audit
    // question is "which control was bypassed, on how many", and this is it.
    const traces = [
      ...Array.from({ length: 7 }, () => ['submit', 'check', 'approve']),
      ...Array.from({ length: 3 }, () => ['submit', 'approve']),
    ];
    client = await log(traces);

    const report = await alignLog(client, duckdbDialect, {
      objectType: 'case',
      model: SEQUENCE,
    });

    expect(report.deviations).toHaveLength(1);
    expect(report.deviations[0]).toMatchObject({
      kind: 'model',
      activity: 'check',
      cases: 3,
    });
    expect(report.deviations[0]?.reading).toContain('no record');
  });

  it('weights fitness by how many cases took each route', async () => {
    const traces = [
      ...Array.from({ length: 9 }, () => ['submit', 'check', 'approve']),
      ['submit', 'approve'],
    ];
    client = await log(traces);

    const report = await alignLog(client, duckdbDialect, {
      objectType: 'case',
      model: SEQUENCE,
    });

    // Nine perfect cases, and one that cost 1.
    //
    // The denominator is that trace's OWN worst case — its length plus the
    // shortest run through the model — so the short trace is scored against 5,
    // not against the 6 a conforming trace is scored against. Using one global
    // denominator would make a short deviating trace look better than a long
    // one for no reason but its length.
    expect(report.casesAligned).toBe(10);
    expect(report.coverage).toBe(1);
    expect(report.fitness).toBeCloseTo((9 * 1 + (1 - 1 / 5)) / 10, 10);
  });

  it('reports a clean log as clean', async () => {
    client = await log([['submit', 'check', 'approve']]);
    const report = await alignLog(client, duckdbDialect, {
      objectType: 'case',
      model: SEQUENCE,
    });

    expect(report.deviations).toEqual([]);
    expect(report.fitness).toBe(1);
    expect(report.boundedSearches).toBe(0);
  });
});

describe('grouping routes into behaviours', () => {
  /** Three genuinely different behaviours, each with variation inside it. */
  async function behaviours(): Promise<SqlClient> {
    const path = join(dir, 'cluster-fixture.csv');
    const rows = ['case:concept:name,concept:name,time:timestamp'];
    let n = 0;
    const emit = (steps: readonly string[]): void => {
      steps.forEach((a, i) => {
        rows.push(`c${n},${a},2026-03-02T${String(i).padStart(2, '0')}:00:00Z`);
      });
      n += 1;
    };
    for (let i = 0; i < 30; i += 1) {
      emit(i % 3 === 0 ? ['submit', 'review', 'approve'] : ['submit', 'review', 'approve', 'notify']);
    }
    for (let i = 0; i < 20; i += 1) {
      emit(['submit', 'review', 'escalate', 'legal', i % 2 === 0 ? 'approve' : 'reject']);
    }
    for (let i = 0; i < 15; i += 1) {
      emit(i % 3 === 0 ? ['submit', 'reject'] : ['submit', 'review', 'reject']);
    }
    await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
    const c = await openMemoryDuckDB();
    await importCsv(c, duckdbDialect, { path });
    return c;
  }

  it('puts the escalation routes together and nothing else with them', async () => {
    // The one group a reader would draw by hand. If clustering cannot find
    // this, it cannot find anything.
    client = await behaviours();
    const report = await clusterTraces(client, duckdbDialect, {
      objectType: 'case',
      clusters: 3,
    });

    const escalation = report.clusters.find((c) =>
      c.variants.every((v) => v.path.includes('escalate')),
    )!;
    expect(escalation).toBeDefined();
    expect(escalation.cases).toBe(20);
    expect(escalation.distinctiveActivities.map((a) => a.activity)).toContain('escalate');
  });

  it('accounts for every case it was given', async () => {
    client = await behaviours();
    const report = await clusterTraces(client, duckdbDialect, {
      objectType: 'case',
      clusters: 3,
    });

    expect(report.clusters.reduce((n, c) => n + c.cases, 0)).toBe(report.casesClustered);
    expect(report.casesClustered).toBe(65);
    expect(report.clusters.reduce((n, c) => n + c.variants.length, 0)).toBe(
      report.variantsClustered,
    );
  });

  it('gives the same answer twice', async () => {
    // k-means would not. A grouping that shuffles between runs cannot be built
    // on, and this one has no seed to shuffle.
    client = await behaviours();
    const shape = (r: Awaited<ReturnType<typeof clusterTraces>>) =>
      JSON.stringify(r.clusters.map((c) => c.variants.map((v) => v.path)));

    const first = await clusterTraces(client, duckdbDialect, { objectType: 'case', clusters: 3 });
    const second = await clusterTraces(client, duckdbDialect, { objectType: 'case', clusters: 3 });
    expect(shape(first)).toBe(shape(second));
  });

  it('hands back a filter that selects exactly the group', async () => {
    // A cluster nobody can then look at is a label, not a finding.
    client = await behaviours();
    const report = await clusterTraces(client, duckdbDialect, {
      objectType: 'case',
      clusters: 3,
    });

    for (const cluster of report.clusters) {
      const filter = cluster.filter;
      if (cluster.variants.length === 1) expect(filter.kind).toBe('variant');
      else expect(filter.kind).toBe('or');
    }
  });

  it('never returns more groups than routes', async () => {
    client = await behaviours();
    const report = await clusterTraces(client, duckdbDialect, {
      objectType: 'case',
      clusters: 99,
    });
    expect(report.clusters.length).toBeLessThanOrEqual(report.variantsClustered);
  });

  it('answers an empty log with no groups rather than throwing', async () => {
    const path = join(dir, 'cluster-empty.csv');
    await writeFile(path, 'case:concept:name,concept:name,time:timestamp\n', 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await clusterTraces(client, duckdbDialect, { objectType: 'case' });
    expect(report.clusters).toEqual([]);
    expect(report.casesClustered).toBe(0);
  });
});
