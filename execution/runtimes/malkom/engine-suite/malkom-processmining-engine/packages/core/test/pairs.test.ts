import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { findRootCauses } from '../src/runtime/rootcause.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * Root cause on combinations.
 *
 * The property under test is restraint, not discovery. Testing every pair of
 * attributes is easy; the hard part is not filling the output with pairs that
 * merely inherit one strong parent, which is what makes a findings list look
 * thorough while repeating itself.
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
 * A log built around a genuine INTERACTION.
 *
 *   channel=web  + card=credit  -> rejected 90% of the time
 *   channel=web  + card=debit   -> rejected 10%
 *   channel=shop + card=credit  -> rejected 10%
 *   channel=shop + card=debit   -> rejected 10%
 *
 * Neither attribute alone is strong: web is rejected 50% of the time, credit
 * likewise. Only the combination is remarkable, so a single-factor analysis
 * cannot see this and a pair analysis must.
 */
async function interactionLog(): Promise<SqlClient> {
  const path = join(dir, 'pairs-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,case:channel,case:card'];
  const base = Date.parse('2026-07-01T00:00:00Z');

  const groups = [
    { channel: 'web', card: 'credit', badRate: 0.9 },
    { channel: 'web', card: 'debit', badRate: 0.1 },
    { channel: 'shop', card: 'credit', badRate: 0.1 },
    { channel: 'shop', card: 'debit', badRate: 0.1 },
  ];

  let caseNo = 0;
  groups.forEach((g, gi) => {
    for (let i = 0; i < 200; i += 1) {
      const id = `x${caseNo++}`;
      // Deterministic, not random: the test must not be flaky.
      const bad = i < Math.round(g.badRate * 200);
      const steps = ['submit', 'assess', bad ? 'reject' : 'approve'];
      steps.forEach((activity, s) => {
        const ts = new Date(base + gi * 300 * 3_600_000 + i * 3_600_000 + s * 60_000).toISOString();
        lines.push(`${id},${activity},${ts},${g.channel},${g.card}`);
      });
    }
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

/**
 * One dominant attribute. channel=web is rejected 90% of the time regardless
 * of card, so every pair containing it is just channel=web restated.
 */
async function dominantLog(): Promise<SqlClient> {
  const path = join(dir, 'dominant-fixture.csv');
  const lines = ['case:concept:name,concept:name,time:timestamp,case:channel,case:card'];
  const base = Date.parse('2026-07-01T00:00:00Z');

  const groups = [
    { channel: 'web', card: 'credit', badRate: 0.9 },
    { channel: 'web', card: 'debit', badRate: 0.9 },
    { channel: 'shop', card: 'credit', badRate: 0.1 },
    { channel: 'shop', card: 'debit', badRate: 0.1 },
  ];

  let caseNo = 0;
  groups.forEach((g, gi) => {
    for (let i = 0; i < 200; i += 1) {
      const id = `y${caseNo++}`;
      const bad = i < Math.round(g.badRate * 200);
      ['submit', 'assess', bad ? 'reject' : 'approve'].forEach((activity, s) => {
        const ts = new Date(base + gi * 300 * 3_600_000 + i * 3_600_000 + s * 60_000).toISOString();
        lines.push(`${id},${activity},${ts},${g.channel},${g.card}`);
      });
    }
  });

  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

describe('root cause on pairs of attributes', () => {
  it('finds a cause that exists only as a combination', async () => {
    client = await interactionLog();
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    const pair = report.factors.find((f) => f.kind === 'attribute-pair');
    expect(pair).toBeDefined();

    // The pair must name both halves, whichever order the join produced.
    const named = [
      `${pair?.name}=${pair?.value}`,
      `${pair?.and?.name}=${pair?.and?.value}`,
    ].sort();
    expect(named).toEqual(['card=credit', 'channel=web']);

    // 90% within the pair, against a much lower rate outside it.
    expect(pair!.outcomeRateWith).toBeCloseTo(0.9, 2);
    expect(pair!.lift).toBeGreaterThan(2);
    expect(pair!.finding).toContain('AND');
  });

  it('ranks the interaction above either attribute on its own', async () => {
    client = await interactionLog();
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    const first = report.factors[0];
    expect(first?.kind).toBe('attribute-pair');
  });

  it('suppresses a pair that only inherits one strong half', async () => {
    client = await dominantLog();
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });

    // channel=web is the whole story here. Reporting "web AND credit" and
    // "web AND debit" beside it would be the same finding three times.
    expect(report.factors.some((f) => f.kind === 'attribute-pair')).toBe(false);

    const suppressed = report.suppressed.filter((f) => f.kind === 'attribute-pair');
    expect(suppressed.length).toBeGreaterThan(0);
    expect(suppressed[0]?.reason).toContain('adds nothing');

    // And the honest single-factor finding still comes through.
    const single = report.factors.find((f) => f.kind === 'attribute' && f.name === 'channel');
    expect(single?.value).toBe('web');
  });

  it('can be switched off', async () => {
    client = await interactionLog();
    const report = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
      pairs: false,
    });
    expect(report.factors.every((f) => f.kind !== 'attribute-pair')).toBe(true);
    expect(report.suppressed.every((f) => f.kind !== 'attribute-pair')).toBe(true);
  });

  it('still corrects across the whole family, pairs included', async () => {
    client = await interactionLog();
    const withPairs = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
    });
    const without = await findRootCauses(client, duckdbDialect, {
      objectType: 'case',
      outcome: { kind: 'contains', activity: 'reject' },
      pairs: false,
    });

    // Testing more things must widen the family being corrected across —
    // otherwise adding pairs would quietly make every single-factor finding
    // look more certain than it is.
    expect(withPairs.factorsTested).toBeGreaterThan(without.factorsTested);
  });
});
