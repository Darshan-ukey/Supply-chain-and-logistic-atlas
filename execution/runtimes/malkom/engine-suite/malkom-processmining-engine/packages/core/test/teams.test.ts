import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SqlClient } from '../src/ports/sql.js';
import { duckdbDialect } from '../src/sql/dialect.js';
import { importCsv } from '../src/offline/csv.js';
import { analyseTeam } from '../src/runtime/teams.js';
import { analyseOrganizational } from '../src/runtime/organizational.js';
import { agglomerate, cosineDistance, unitVector } from '../src/runtime/vectors.js';
import { openMemoryDuckDB } from './helpers/duckdb.js';
import { makeTempDir } from './helpers/logs.js';

/**
 * The team picture — the shape of a team rather than its workload.
 *
 * Each fixture is built to embody exactly one of the three findings, because
 * all three are invisible in the numbers the organizational report already
 * produces: two people can have identical workloads and never once appear on
 * the same piece of work, and a handover and a delegation are the same event
 * count with opposite meanings.
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

const pad = (n: number): string => String(n).padStart(2, '0');
const HEAD = 'case:concept:name,concept:name,time:timestamp,org:resource';

async function load(name: string, rows: readonly string[]): Promise<SqlClient> {
  const path = join(dir, `${name}.csv`);
  await writeFile(path, `${rows.join('\n')}\n`, 'utf8');
  const c = await openMemoryDuckDB();
  await importCsv(c, duckdbDialect, { path });
  return c;
}

/**
 * Two pairs who never meet.
 *
 * ann and bob work the odd cases; cal and dee work the even ones. Every one of
 * the four has the same workload and the same activity mix, so a workload
 * table cannot tell them apart — the only thing that separates them is which
 * cases they turn up on.
 */
function twoTeamsRows(): string[] {
  const rows = [HEAD];
  for (let i = 0; i < 10; i += 1) {
    const [first, second] = i % 2 === 0 ? ['ann', 'bob'] : ['cal', 'dee'];
    rows.push(`t${i},open,2026-03-${pad(i + 1)}T09:00:00Z,${first}`);
    rows.push(`t${i},check,2026-03-${pad(i + 1)}T10:00:00Z,${second}`);
  }
  return rows;
}

/**
 * A supervisor and two juniors.
 *
 * sam hands to jan and gets it back, every time — a round trip. sam also hands
 * to raj and never gets it back, which is an onward handover. The two look
 * identical in a handover count and mean opposite things.
 */
function delegationRows(): string[] {
  const rows = [HEAD];
  for (let i = 0; i < 6; i += 1) {
    rows.push(`d${i},triage,2026-03-${pad(i + 1)}T09:00:00Z,sam`);
    rows.push(`d${i},assess,2026-03-${pad(i + 1)}T10:00:00Z,jan`);
    rows.push(`d${i},approve,2026-03-${pad(i + 1)}T11:00:00Z,sam`);
    rows.push(`d${i},archive,2026-03-${pad(i + 1)}T12:00:00Z,raj`);
  }
  return rows;
}

/**
 * Two jobs, four people, no job titles.
 *
 * ann and bob only ever intake; cal and dee only ever settle. Everybody shares
 * every case, so co-occurrence says nothing here — the roles are visible only
 * in the mix of work each person does.
 */
function rolesRows(): string[] {
  const rows = [HEAD];
  for (let i = 0; i < 8; i += 1) {
    rows.push(`r${i},intake,2026-03-${pad(i + 1)}T09:00:00Z,${i % 2 === 0 ? 'ann' : 'bob'}`);
    rows.push(`r${i},verify,2026-03-${pad(i + 1)}T10:00:00Z,${i % 2 === 0 ? 'ann' : 'bob'}`);
    rows.push(`r${i},settle,2026-03-${pad(i + 1)}T11:00:00Z,${i % 2 === 0 ? 'cal' : 'dee'}`);
    rows.push(`r${i},payout,2026-03-${pad(i + 1)}T12:00:00Z,${i % 2 === 0 ? 'cal' : 'dee'}`);
  }
  return rows;
}

describe('who works alongside whom', () => {
  it('finds the informal teams a workload table cannot see', async () => {
    client = await load('two-teams', twoTeamsRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });

    const pair = (a: string, b: string): number =>
      team.worksAlongside.find(
        (p) => (p.a === a && p.b === b) || (p.a === b && p.b === a),
      )?.cases ?? 0;

    expect(pair('ann', 'bob')).toBe(5);
    expect(pair('cal', 'dee')).toBe(5);
    // The point of the fixture: identical workloads, and these two never meet.
    expect(pair('ann', 'cal')).toBe(0);
    expect(pair('ann', 'dee')).toBe(0);
  });

  it('reports affinity, not just volume', async () => {
    client = await load('affinity', twoTeamsRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });

    // ann and bob share all five of the cases either touched, so the Jaccard
    // index is 1 — they are always together, not merely often together.
    const together = team.worksAlongside.find((p) => p.a === 'ann' && p.b === 'bob');
    expect(together?.affinity).toBeCloseTo(1, 6);
  });

  it('counts a case once however many times somebody touched it', async () => {
    // ann appears three times on one case; that is one case together, not three.
    client = await load('repeats', [
      HEAD,
      'x1,a,2026-03-01T09:00:00Z,ann',
      'x1,b,2026-03-01T10:00:00Z,ann',
      'x1,c,2026-03-01T11:00:00Z,ann',
      'x1,d,2026-03-01T12:00:00Z,bob',
    ]);
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });
    expect(team.worksAlongside).toHaveLength(1);
    expect(team.worksAlongside[0]?.cases).toBe(1);
  });
});

describe('who delegates and gets work back', () => {
  it('tells a round trip apart from an onward handover', async () => {
    client = await load('delegation', delegationRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });

    const back = team.delegations.find((d) => d.from === 'sam' && d.to === 'jan');
    expect(back?.count).toBe(6);
    // sam → raj happens just as often and never comes back, so it is not a
    // delegation at all.
    expect(team.delegations.some((d) => d.from === 'sam' && d.to === 'raj')).toBe(false);
  });

  it('reports the share of handovers that came back, not just the count', async () => {
    client = await load('return-rate', delegationRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });
    // Every sam → jan handover returns.
    expect(team.delegations.find((d) => d.from === 'sam' && d.to === 'jan')?.returnRate).toBeCloseTo(1, 6);
  });

  it('agrees with the handover count it is a subset of', async () => {
    // The two modules order events with the same expression, written out
    // separately. This is the check that catches them drifting apart.
    client = await load('agree', delegationRows());
    const [team, org] = await Promise.all([
      analyseTeam(client, duckdbDialect, { objectType: 'case' }),
      analyseOrganizational(client, duckdbDialect, { objectType: 'case' }),
    ]);

    for (const delegation of team.delegations) {
      const handover = org.handovers.find(
        (h) => h.from === delegation.from && h.to === delegation.to,
      );
      expect(handover, `${delegation.from} → ${delegation.to} must exist as a handover`).toBeDefined();
      // A round trip is one particular handover, so it can never outnumber them.
      expect(delegation.count).toBeLessThanOrEqual(handover?.count ?? 0);
    }
  });
});

describe('the roles behaviour reveals', () => {
  it('groups people by what they do, with nobody having said what they are', async () => {
    client = await load('roles', rolesRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case', roles: 2 });

    expect(team.roles).toHaveLength(2);
    const members = team.roles.map((r) => r.members.join(','));
    expect(members).toContain('ann,bob');
    expect(members).toContain('cal,dee');
  });

  it('names what each role actually does', async () => {
    client = await load('signature', rolesRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case', roles: 2 });

    const intake = team.roles.find((r) => r.members.includes('ann'));
    expect(intake?.signature.map((s) => s.activity).sort()).toEqual(['intake', 'verify']);
    // Two activities, evenly split, so each is half of what the role does.
    expect(intake?.signature[0]?.share).toBeCloseTo(0.5, 6);
  });

  it('scores a group of identical workers as perfectly cohesive', async () => {
    client = await load('cohesion', rolesRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case', roles: 2 });
    for (const role of team.roles) expect(role.cohesion).toBeCloseTo(1, 6);
  });

  it('does not report two people as alike when they share no work at all', async () => {
    client = await load('unalike', rolesRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });
    // ann does intake and verify; cal does settle and payout. No overlap.
    expect(
      team.doesAlike.some(
        (p) => (p.a === 'ann' && p.b === 'cal') || (p.a === 'cal' && p.b === 'ann'),
      ),
    ).toBe(false);
  });

  it('says in words that a team of specialists has thin cover', async () => {
    client = await load('specialists', rolesRows());
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });
    expect(team.reading).toMatch(/specialists|group/i);
  });
});

describe('bounds and refusals', () => {
  it('caps by headcount and says how many were left out', async () => {
    const rows = [HEAD];
    for (let i = 0; i < 12; i += 1) {
      // Each person's volume decreases, so the cap takes a predictable set.
      for (let j = 0; j <= i; j += 1) {
        rows.push(`c${i}-${j},step,2026-03-01T0${j % 10}:00:00Z,p${pad(11 - i)}`);
      }
    }
    client = await load('capped', rows);
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case', limit: 4 });

    expect(team.people).toHaveLength(4);
    expect(team.omittedPeople).toBe(8);
    // Everything downstream respects the cap, or the counts would describe a
    // different population from the one named.
    const inside = new Set(team.people.map((p) => p.resource));
    for (const pair of team.worksAlongside) {
      expect(inside.has(pair.a) && inside.has(pair.b)).toBe(true);
    }
  });

  it('refuses rather than returning a team of nobody', async () => {
    client = await load('anonymous', [
      'case:concept:name,concept:name,time:timestamp',
      'n1,a,2026-03-01T09:00:00Z',
      'n1,b,2026-03-01T10:00:00Z',
    ]);
    await expect(analyseTeam(client, duckdbDialect, { objectType: 'case' })).rejects.toThrow(
      /who performed the work/,
    );
  });

  it('describes a one-person log without pretending it is a team', async () => {
    client = await load('solo', [
      HEAD,
      's1,a,2026-03-01T09:00:00Z,ann',
      's1,b,2026-03-01T10:00:00Z,ann',
    ]);
    const team = await analyseTeam(client, duckdbDialect, { objectType: 'case' });
    expect(team.roles).toEqual([]);
    expect(team.worksAlongside).toEqual([]);
    expect(team.reading).toContain('one person');
  });
});

describe('the shared vector maths', () => {
  it('scales to unit length so volume cannot masquerade as difference', () => {
    const busy = unitVector(new Map([['a', 100], ['b', 100]]));
    const quiet = unitVector(new Map([['a', 1], ['b', 1]]));
    // Same job, different volumes: identical vectors, zero distance.
    expect(cosineDistance(busy, quiet)).toBeCloseTo(0, 9);
  });

  it('is 1 for vectors that share nothing', () => {
    const one = unitVector(new Map([['a', 3]]));
    const other = unitVector(new Map([['b', 3]]));
    expect(cosineDistance(one, other)).toBe(1);
  });

  it('never returns a negative distance', () => {
    // Float error on a dot product can exceed 1; every consumer would have to
    // guard against a negative distance if this did not clamp.
    const v = unitVector(new Map([['a', 1], ['b', 1], ['c', 1]]));
    expect(cosineDistance(v, v)).toBeGreaterThanOrEqual(0);
  });

  it('groups the same input the same way every time', () => {
    const vectors = [
      unitVector(new Map([['a', 1]])),
      unitVector(new Map([['a', 1]])),
      unitVector(new Map([['b', 1]])),
      unitVector(new Map([['b', 1]])),
    ];
    const once = agglomerate(vectors, 2);
    const twice = agglomerate(vectors, 2);
    expect(once).toEqual(twice);
    expect(once).toEqual([[0, 1], [2, 3]]);
  });

  it('returns the input untouched when there is nothing to merge', () => {
    const vectors = [unitVector(new Map([['a', 1]]))];
    expect(agglomerate(vectors, 4)).toEqual([[0]]);
  });
});
