import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UnsupportedError } from '../src/domain/errors.js';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { allOf, describeFilter, MAX_CASE_IDS, type CaseFilter } from '../src/runtime/filter.js';
import { buildDfg } from '../src/runtime/dfg.js';
import { analysePerformance } from '../src/runtime/performance.js';
import { analyseVariants } from '../src/runtime/variants.js';
import { analyseOrganizational } from '../src/runtime/organizational.js';
import { findRootCauses } from '../src/runtime/rootcause.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * The filter exists so a click in an explorer moves every panel together. That
 * makes CONSISTENCY the property worth testing: the same selection must yield
 * the same set of cases in discovery, performance, variants, resources and
 * root cause. A filter that six analyses each interpret slightly differently
 * is worse than no filter at all.
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

/**
 * 60 cases:
 *   20 web    submit -> review -> approve   (alice)
 *   20 phone  submit -> review -> reject    (bob)
 *   20 web    submit -> escalate -> approve (carol), and slow
 */
async function mixedLog(): Promise<SqlClient> {
  const path = join(dir, 'filter-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,org:resource,case:channel'];
  const base = Date.parse('2026-01-01T00:00:00Z');

  const groups = [
    { steps: ['submit', 'review', 'approve'], who: 'alice', channel: 'web', gapMin: 10 },
    { steps: ['submit', 'review', 'reject'], who: 'bob', channel: 'phone', gapMin: 10 },
    { steps: ['submit', 'escalate', 'approve'], who: 'carol', channel: 'web', gapMin: 600 },
  ];

  let caseNo = 0;
  groups.forEach((g, gi) => {
    for (let i = 0; i < 20; i += 1) {
      const id = `c${caseNo++}`;
      const start = base + gi * 30 * 86_400_000 + i * 86_400_000;
      g.steps.forEach((activity, s) => {
        const ts = new Date(start + s * g.gapMin * 60_000).toISOString();
        lines.push(`${id},${activity},${ts},${g.who},${g.channel}`);
      });
    }
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('a filter selects whole cases, not individual events', () => {
  it('keeps the complete trace of every matching case', async () => {
    client = await mixedLog();

    // Clicking "escalate" means: show me the cases that escalate — with all
    // their steps. Filtering events instead would return 20 one-step cases.
    const filter: CaseFilter = { kind: 'activity', activity: 'escalate' };
    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case', filter });

    expect(dfg.caseCount).toBe(20);
    expect(dfg.eventCount).toBe(60); // three events per case, not one
    expect(dfg.activities.map((a) => a.activity).sort()).toEqual([
      'approve',
      'escalate',
      'submit',
    ]);
  });

  it('excludes cases when the activity filter is negated', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'activity', activity: 'escalate', present: false },
    });
    expect(dfg.caseCount).toBe(40);
    expect(dfg.activities.some((a) => a.activity === 'escalate')).toBe(false);
  });
});

describe('the same filter gives the same cases everywhere', () => {
  it('agrees across discovery, performance, variants, resources and root cause', async () => {
    client = await mixedLog();
    const filter: CaseFilter = { kind: 'attribute', key: 'channel', value: 'web' };
    const shared = { objectType: 'case', filter } as const;

    const [dfg, performance, variants, organizational, rootCause] = await Promise.all([
      buildDfg(client, duckdbDialect, shared),
      analysePerformance(client, duckdbDialect, shared),
      analyseVariants(client, duckdbDialect, shared),
      analyseOrganizational(client, duckdbDialect, shared),
      findRootCauses(client, duckdbDialect, {
        ...shared,
        outcome: { kind: 'slowest-fraction', fraction: 0.5 },
        minCases: 1,
      }),
    ]);

    // 40 web cases: alice's 20 and carol's 20.
    expect(dfg.caseCount).toBe(40);
    expect(performance.caseCount).toBe(40);
    expect(variants.totalCases).toBe(40);
    expect(rootCause.totalCases).toBe(40);
    // Resources reports events rather than cases; 40 cases x 3 events.
    expect(organizational.eventCount).toBe(120);
    // bob only ever handles phone cases, so he must be absent.
    expect(organizational.resources.map((r) => r.resource).sort()).toEqual(['alice', 'carol']);
  });

  it('narrows consistently as filters are combined', async () => {
    client = await mixedLog();
    const both = allOf<CaseFilter>(
      { kind: 'attribute', key: 'channel', value: 'web' },
      { kind: 'activity', activity: 'escalate' },
    )!;

    const dfg = await buildDfg(client, duckdbDialect, { objectType: 'case', filter: both });
    const variants = await analyseVariants(client, duckdbDialect, {
      objectType: 'case',
      filter: both,
    });

    expect(dfg.caseCount).toBe(20); // only carol's
    expect(variants.totalVariants).toBe(1);
    expect(variants.variants[0]?.path).toEqual(['submit', 'escalate', 'approve']);
  });
});

describe('filter kinds', () => {
  it('selects by resource', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'resource', resource: 'bob' },
    });
    expect(dfg.caseCount).toBe(20);
    expect(dfg.activities.some((a) => a.activity === 'reject')).toBe(true);
  });

  it('selects by cycle time', async () => {
    client = await mixedLog();
    // carol's cases run 600 minutes per step, so ~20 hours end to end.
    const slow = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'cycleTime', minSeconds: 3600 },
    });
    expect(slow.caseCount).toBe(20);
  });

  it('selects by trace length', async () => {
    client = await mixedLog();
    const all = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'length', min: 3, max: 3 },
    });
    expect(all.caseCount).toBe(60);

    const none = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'length', min: 4 },
    });
    expect(none.caseCount).toBe(0);
  });

  it('selects an explicit list of case ids, as a lasso selection would', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'cases', ids: ['c0', 'c1', 'c41'] },
    });
    expect(dfg.caseCount).toBe(3);
  });

  it('distinguishes cases that STARTED in a window from those merely active in it', async () => {
    client = await mixedLog();
    // Group 0 starts 2026-01-01, group 1 thirty days later, group 2 sixty.
    const started = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: {
        kind: 'window',
        from: new Date('2026-01-01T00:00:00Z'),
        to: new Date('2026-01-21T00:00:00Z'),
        on: 'start',
      },
    });
    expect(started.caseCount).toBe(20);
  });

  it('combines with or, and negates with not', async () => {
    client = await mixedLog();
    const either = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: {
        kind: 'or',
        args: [
          { kind: 'activity', activity: 'reject' },
          { kind: 'activity', activity: 'escalate' },
        ],
      },
    });
    expect(either.caseCount).toBe(40);

    const neither = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: {
        kind: 'not',
        arg: {
          kind: 'or',
          args: [
            { kind: 'activity', activity: 'reject' },
            { kind: 'activity', activity: 'escalate' },
          ],
        },
      },
    });
    expect(neither.caseCount).toBe(20);
  });

  it('matches any of several attribute values', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'attribute', key: 'channel', values: ['web', 'phone'] },
    });
    expect(dfg.caseCount).toBe(60);
  });

  it('treats an empty case list as selecting nothing, not everything', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'cases', ids: [] },
    });
    // The dangerous default would be to ignore an empty selection and report
    // the whole log as though it were the selection.
    expect(dfg.caseCount).toBe(0);
  });

  it('refuses an id list too large to compile', async () => {
    client = await mixedLog();
    const ids = Array.from({ length: MAX_CASE_IDS + 1 }, (_, i) => `c${i}`);
    await expect(
      buildDfg(client, duckdbDialect, { objectType: 'case', filter: { kind: 'cases', ids } }),
    ).rejects.toThrow(UnsupportedError);
  });

  it('composes with the event-level window and lifecycle without conflict', async () => {
    client = await mixedLog();
    const dfg = await buildDfg(client, duckdbDialect, {
      objectType: 'case',
      filter: { kind: 'attribute', key: 'channel', value: 'web' },
      window: { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-21T00:00:00Z') },
    });
    // The case filter keeps web cases; the window then trims to events inside
    // it. Group 0 (alice, web) is the only one in range.
    expect(dfg.caseCount).toBe(20);
  });
});

describe('filter descriptions', () => {
  it('reads back in plain language', () => {
    expect(describeFilter({ kind: 'attribute', key: 'channel', value: 'web' })).toBe('channel = web');
    expect(describeFilter({ kind: 'activity', activity: 'Reject' })).toBe('doing Reject');
    expect(describeFilter({ kind: 'activity', activity: 'Reject', present: false })).toBe(
      'never doing Reject',
    );
    expect(
      describeFilter({
        kind: 'and',
        args: [
          { kind: 'attribute', key: 'channel', value: 'web' },
          { kind: 'activity', activity: 'Escalate' },
        ],
      }),
    ).toBe('channel = web and doing Escalate');
  });

  it('describes an empty and as all cases', () => {
    expect(describeFilter({ kind: 'and', args: [] })).toBe('all cases');
  });
});

describe('allOf', () => {
  it('returns undefined when nothing is supplied', () => {
    expect(allOf(undefined, undefined)).toBeUndefined();
  });

  it('returns the single filter unwrapped', () => {
    const one: CaseFilter = { kind: 'activity', activity: 'a' };
    expect(allOf(undefined, one)).toBe(one);
  });

  it('wraps several in an and', () => {
    const combined = allOf<CaseFilter>(
      { kind: 'activity', activity: 'a' },
      { kind: 'activity', activity: 'b' },
    );
    expect(combined?.kind).toBe('and');
  });
});
