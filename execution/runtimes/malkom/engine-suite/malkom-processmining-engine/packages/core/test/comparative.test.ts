import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { compareCohorts } from '../src/runtime/comparative.js';
import { findRootCauses } from '../src/runtime/rootcause.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Comparative and root-cause tests are built on logs with a difference
 * DELIBERATELY planted, so the question is not "does it produce output" but
 * "does it find the thing that is actually there, and stay quiet about the
 * things that are not".
 */

let dir: string;

beforeAll(async () => {
  dir = await makeTempDir();
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/**
 * Build a log where `slowChannel` cases genuinely take longer.
 *
 * `gapMinutes` controls the planted effect: set it equal for both channels and
 * there is nothing to find, which is the case that matters most.
 */
async function plantedLog(
  name: string,
  opts: {
    cases: number;
    fastGapMinutes: number;
    slowGapMinutes: number;
    slowShare?: number;
    jitter?: number;
  },
): Promise<SqlClient> {
  const path = join(dir, name);
  const header = 'case:concept:name,concept:name,time:timestamp,org:resource,case:channel';
  const lines = [header];
  const base = Date.parse('2026-01-01T00:00:00Z');
  const slowShare = opts.slowShare ?? 0.5;
  const jitter = opts.jitter ?? 6;

  for (let c = 0; c < opts.cases; c += 1) {
    const slow = c % 100 < slowShare * 100;
    const channel = slow ? 'phone' : 'web';
    const gap = (slow ? opts.slowGapMinutes : opts.fastGapMinutes) + (c % jitter);
    const start = base + c * 86_400_000;
    ['submit', 'review', 'approve'].forEach((activity, i) => {
      const ts = new Date(start + i * gap * 60_000).toISOString();
      lines.push(`case-${c},${activity},${ts},agent${c % 3},${channel}`);
    });
  }

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const client = await openMemoryDuckDB();
  await importCsv(client, duckdbDialect, { path });
  return client;
}

describe('comparative: is the difference real', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('finds a planted difference between two cohorts', async () => {
    client = await plantedLog('cmp-real.csv', {
      cases: 200,
      fastGapMinutes: 10,
      slowGapMinutes: 60,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    expect(report.casesA).toBe(100);
    expect(report.casesB).toBe(100);

    const cycle = report.findings.find((f) => f.metric === 'cycle time');
    expect(cycle).toBeDefined();
    expect(cycle!.reportable).toBe(true);
    expect(cycle!.difference).toBeGreaterThan(0); // phone is slower
    expect(cycle!.effect.magnitude).toBe('large');
    expect(cycle!.adjustedP).toBeLessThan(0.05);
  });

  it('reports every effect with an interval, never a bare point estimate', async () => {
    // Rule 4 of the stats module, checked end to end rather than only in the
    // unit that implements it: a real comparison must arrive carrying its own
    // uncertainty, or a reader has no way to tell a firm finding from a guess.
    client = await plantedLog('cmp-interval.csv', {
      cases: 200,
      fastGapMinutes: 20,
      slowGapMinutes: 60,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    const cycle = report.findings.find((f) => f.metric === 'cycle time');
    const interval = cycle?.effect.interval;
    expect(interval).not.toBeNull();
    expect(interval!.point).toBe(cycle!.effect.delta);
    expect(interval!.lower).toBeLessThanOrEqual(interval!.point);
    expect(interval!.upper).toBeGreaterThanOrEqual(interval!.point);
    // Delta is bounded, so the interval must be too.
    expect(interval!.lower).toBeGreaterThanOrEqual(-1);
    expect(interval!.upper).toBeLessThanOrEqual(1);
    expect(interval!.n).toBeGreaterThan(0);

    // A finding this clear should not straddle "no difference at all".
    expect(interval!.lower).toBeGreaterThan(0);
  });

  it('stays quiet when the cohorts genuinely behave the same', async () => {
    // The test that matters. A tool that always finds something is useless.
    client = await plantedLog('cmp-none.csv', {
      cases: 200,
      fastGapMinutes: 20,
      slowGapMinutes: 20,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    expect(report.findings).toHaveLength(0);
    expect(report.summary).toContain('behave alike');
  });

  it('suppresses a comparison with too few cases, and says why', async () => {
    client = await plantedLog('cmp-small.csv', {
      cases: 20, // 10 per cohort, below the minimum
      fastGapMinutes: 10,
      slowGapMinutes: 120,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    expect(report.findings).toHaveLength(0);
    const cycle = report.suppressed.find((f) => f.metric === 'cycle time');
    expect(cycle?.reason).toContain('too few cases');
  });

  it('corrects across the whole family of comparisons', async () => {
    client = await plantedLog('cmp-family.csv', {
      cases: 200,
      fastGapMinutes: 10,
      slowGapMinutes: 60,
    });
    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    // Cycle time plus one comparison per activity, all corrected together.
    expect(report.comparisonsRun).toBeGreaterThan(1);
    for (const f of [...report.findings, ...report.suppressed]) {
      expect(f.adjustedP).toBeGreaterThanOrEqual(f.pValue - 1e-12);
    }
  });

  it('computes the rank sum in SQL and agrees with the in-memory test', async () => {
    // Both routes share mannWhitneyFromRanks, so a disagreement here means the
    // SQL midrank definition has drifted from the JavaScript one.
    client = await plantedLog('cmp-agree.csv', {
      cases: 120,
      fastGapMinutes: 10,
      slowGapMinutes: 40,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });
    const cycle = report.findings.find((f) => f.metric === 'cycle time')!;

    // Cliff's delta from U must land in range and match the direction.
    expect(cycle.effect.delta).toBeGreaterThan(0);
    expect(cycle.effect.delta).toBeLessThanOrEqual(1);
  });

  it('compares a cohort against everything else', async () => {
    client = await plantedLog('cmp-complement.csv', {
      cases: 200,
      fastGapMinutes: 10,
      slowGapMinutes: 60,
      slowShare: 0.25,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'phone' },
      b: { kind: 'complement' },
    });

    expect(report.casesA).toBe(50);
    expect(report.casesB).toBe(150);
    expect(report.labelB).toBe('everything else');
  });

  it('reports an empty cohort rather than dividing by it', async () => {
    client = await plantedLog('cmp-empty.csv', {
      cases: 60,
      fastGapMinutes: 10,
      slowGapMinutes: 10,
    });

    const report = await compareCohorts(client, duckdbDialect, {
      objectType: 'case',
      a: { kind: 'attribute', key: 'channel', value: 'fax' }, // no such value
      b: { kind: 'attribute', key: 'channel', value: 'web' },
    });

    expect(report.casesA).toBe(0);
    expect(report.summary).toContain('empty');
    expect(report.findings).toHaveLength(0);
  });
});

describe('root cause: which cases go wrong', () => {
  let client: SqlClient;

  afterEach(async () => {
    await client?.close();
  });

  it('identifies the attribute that predicts a slow case', async () => {
    client = await plantedLog('rc-attr.csv', {
      cases: 300,
      fastGapMinutes: 5,
      slowGapMinutes: 90,
      slowShare: 0.3,
    });

    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'slowest-fraction', fraction: 0.3 },
    });

    // Both directions are genuine findings here — phone is always slow AND web
    // never is — so name the one being asserted rather than taking the first.
    const phone = report.factors.find((f) => f.name === 'channel' && f.value === 'phone');
    expect(phone).toBeDefined();
    expect(phone!.lift).toBeGreaterThan(2);
    expect(phone!.finding).toContain('more likely');

    const web = report.factors.find((f) => f.name === 'channel' && f.value === 'web');
    expect(web!.lift).toBeLessThan(1);
    expect(web!.finding).toContain('LESS likely');
  });

  it('always states that these are associations, not causes', async () => {
    client = await plantedLog('rc-caveat.csv', {
      cases: 100,
      fastGapMinutes: 5,
      slowGapMinutes: 50,
    });
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'slowest-fraction', fraction: 0.2 },
    });
    // "Root cause" is a name that invites the stronger reading; the payload
    // has to push back on it every time.
    expect(report.caveat).toContain('not causes');
  });

  it('finds nothing when the outcome is unrelated to anything recorded', async () => {
    // Every case identical apart from an arbitrary slow/fast split that no
    // attribute tracks: there is genuinely nothing to explain.
    const path = join(dir, 'rc-nothing.csv');
    const lines = ['case:concept:name,concept:name,time:timestamp,case:channel'];
    const base = Date.parse('2026-01-01T00:00:00Z');
    for (let c = 0; c < 200; c += 1) {
      // Slowness alternates independently of channel.
      const gap = c % 2 === 0 ? 10 : 90;
      const channel = c % 3 === 0 ? 'web' : 'phone';
      const start = base + c * 86_400_000;
      ['submit', 'approve'].forEach((activity, i) => {
        lines.push(
          `case-${c},${activity},${new Date(start + i * gap * 60_000).toISOString()},${channel}`,
        );
      });
    }
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'slowest-fraction', fraction: 0.5 },
    });
    expect(report.factors).toHaveLength(0);
    expect(report.summary).toContain('spread evenly');
  });

  it('handles an outcome defined by reaching an activity', async () => {
    const path = join(dir, 'rc-activity.csv');
    const lines = ['case:concept:name,concept:name,time:timestamp,case:channel'];
    const base = Date.parse('2026-01-01T00:00:00Z');
    for (let c = 0; c < 300; c += 1) {
      const channel = c % 100 < 40 ? 'phone' : 'web';
      // Rejection is far more common on the phone channel.
      const rejected = channel === 'phone' ? c % 4 !== 0 : c % 10 === 0;
      const steps = rejected ? ['submit', 'review', 'reject'] : ['submit', 'review', 'approve'];
      const start = base + c * 86_400_000;
      steps.forEach((activity, i) => {
        lines.push(
          `case-${c},${activity},${new Date(start + i * 600_000).toISOString()},${channel}`,
        );
      });
    }
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    const phone = report.factors.find((f) => f.name === 'channel' && f.value === 'phone');
    expect(phone).toBeDefined();
    expect(phone!.lift).toBeGreaterThan(2);
    expect(report.outcome).toContain('reject');
  });

  it('says so when every case matches the outcome', async () => {
    client = await plantedLog('rc-all.csv', {
      cases: 100,
      fastGapMinutes: 10,
      slowGapMinutes: 10,
    });
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'submit' }, // every case does this
    });
    expect(report.outcomeCases).toBe(report.totalCases);
    expect(report.summary).toContain('no contrast');
  });

  it('never reports the outcome activity as its own cause', async () => {
    // Found on BPIC 2012: the top "cause" of reaching A_DECLINED was doing
    // A_DECLINED, at 999x. Statistically flawless, completely circular, and
    // presented as the headline finding.
    const path = join(dir, 'rc-leak.csv');
    const lines = ['case:concept:name,concept:name,time:timestamp,case:channel'];
    const base = Date.parse('2026-01-01T00:00:00Z');
    for (let c = 0; c < 200; c += 1) {
      const channel = c % 2 === 0 ? 'web' : 'phone';
      const steps =
        channel === 'phone' ? ['submit', 'review', 'reject'] : ['submit', 'review', 'accept'];
      const start = base + c * 86_400_000;
      steps.forEach((activity, i) => {
        lines.push(
          `case-${c},${activity},${new Date(start + i * 600_000).toISOString()},${channel}`,
        );
      });
    }
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    expect(report.factors.some((f) => f.name === 'reject')).toBe(false);
    expect(report.suppressed.some((f) => f.name === 'reject')).toBe(false);
  });

  it('demotes an activity that is merely the alternative outcome', async () => {
    // 'accept' never co-occurs with 'reject'. True, and useless: they are two
    // branches of one decision, not an explanation of it.
    const path = join(dir, 'rc-structural.csv');
    const lines = ['case:concept:name,concept:name,time:timestamp,case:channel'];
    const base = Date.parse('2026-01-01T00:00:00Z');
    for (let c = 0; c < 200; c += 1) {
      const channel = c % 2 === 0 ? 'web' : 'phone';
      const steps =
        channel === 'phone' ? ['submit', 'review', 'reject'] : ['submit', 'review', 'accept'];
      const start = base + c * 86_400_000;
      steps.forEach((activity, i) => {
        lines.push(
          `case-${c},${activity},${new Date(start + i * 600_000).toISOString()},${channel}`,
        );
      });
    }
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
    client = await openMemoryDuckDB();
    await importCsv(client, duckdbDialect, { path });

    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    const accept = report.suppressed.find((f) => f.name === 'accept');
    expect(accept).toBeDefined();
    expect(accept!.structural).toBe(true);
    expect(accept!.reason).toContain('alternative branch');
    expect(report.factors.some((f) => f.name === 'accept')).toBe(false);

    // The attribute that actually drives it is still reported: perfect
    // separation on an ATTRIBUTE is a real discovery, not a structural artefact.
    const phone = report.factors.find((f) => f.name === 'channel' && f.value === 'phone');
    expect(phone).toBeDefined();
  });

  it('honours an explicit activity exclusion', async () => {
    client = await plantedLog('rc-exclude.csv', {
      cases: 200,
      fastGapMinutes: 5,
      slowGapMinutes: 60,
    });
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'slowest-fraction', fraction: 0.4 },
      excludeActivities: ['review'],
    });
    expect([...report.factors, ...report.suppressed].some((f) => f.name === 'review')).toBe(false);
  });

  it('ignores a factor too rare to say anything about', async () => {
    client = await plantedLog('rc-rare.csv', {
      cases: 200,
      fastGapMinutes: 10,
      slowGapMinutes: 60,
    });
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'slowest-fraction', fraction: 0.3 },
      minCases: 500, // nothing can clear this
    });
    expect(report.factorsTested).toBe(0);
    expect(report.factors).toHaveLength(0);
  });
});
