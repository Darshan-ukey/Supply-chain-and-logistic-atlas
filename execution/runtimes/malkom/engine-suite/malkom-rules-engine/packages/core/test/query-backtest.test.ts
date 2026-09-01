import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { RulesEngine } from '../src/engine.js';
import { SqliteSqlClient } from '../src/sql/clients.js';
import { noopLogger } from '../src/ports/logger.js';
import type { GroupDefinitionInput, RegistryDocInput } from '../src/config/schemas.js';

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      table: { name: 'bookings' },
      connectionRef: 'main',
      subQueueField: 'status',
      fields: [
        { id: 'shipperParty', type: 'string', column: 'shipper_party' },
        { id: 'portOfDischarge', type: 'string', column: 'pod' },
        { id: 'currency', type: 'string' },
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
      ],
    },
  ],
  valueSets: [],
};

const usdGroup: GroupDefinitionInput = {
  name: 'Shipper A — USD corridors',
  entity: 'booking',
  scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
  effectiveTo: '2027-01-01T00:00:00Z',
  rules: [
    {
      when: { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
      then: [{ verb: 'set', field: 'currency', value: 'USD', reason: 'contracted currency' }],
    },
  ],
};

const eurGroup: GroupDefinitionInput = {
  name: 'CNNGB corridor pricing',
  entity: 'booking',
  scope: { all: [{ field: 'portOfDischarge', op: 'in', values: ['CNNGB', 'CNSHA'] }] },
  rules: [
    {
      when: { op: 'eq', field: 'status', value: 'new' },
      then: [{ verb: 'set', field: 'currency', value: 'EUR' }],
    },
  ],
};

async function freshEngine(): Promise<RulesEngine> {
  const engine = new RulesEngine({ logger: noopLogger });
  await engine.start();
  await engine.applyRegistry(REGISTRY);
  return engine;
}

async function activated(engine: RulesEngine, def: GroupDefinitionInput): Promise<string> {
  const head = await engine.createGroup(def, { actor: 'money' });
  await engine.submit(head.id, { actor: 'money' });
  await engine.activate(head.id, { actor: 'priya' });
  return head.id;
}

describe('queryGroups (D6)', () => {
  it('answers the rule-aware questions plain SQL cannot', async () => {
    const engine = await freshEngine();
    const usdId = await activated(engine, usdGroup);
    await activated(engine, eurGroup);

    // "Which groups touch currency?" — both write it.
    const touching = await engine.queryGroups({ touchesField: 'currency' });
    expect(touching.total).toBe(2);

    // "Which groups touch shipperParty?" — only the scope of the USD group.
    const byShipper = await engine.queryGroups({ touchesField: 'shipperParty' });
    expect(byShipper.groups.map((g) => g.id)).toEqual([usdId]);

    // "Groups scoped to shipper A" — explicit scope anchoring, not applicability.
    const scoped = await engine.queryGroups({ scopeValue: { field: 'shipperParty', value: 'A' } });
    expect(scoped.groups.map((g) => g.id)).toEqual([usdId]);
    expect((await engine.queryGroups({ scopeValue: { field: 'shipperParty', value: 'B' } })).total).toBe(0);

    // Text search across names and reasons.
    expect((await engine.queryGroups({ text: 'contracted currency' })).groups[0]?.id).toBe(usdId);
    expect((await engine.queryGroups({ text: 'corridor' })).total).toBe(2);

    // Expiry dashboard: who lapses before 2027-06?
    const expiring = await engine.queryGroups({ expiringBefore: '2027-06-01T00:00:00Z' });
    expect(expiring.groups.map((g) => g.id)).toEqual([usdId]);

    // State + entity filters and pagination bounds.
    expect((await engine.queryGroups({ state: 'active', entity: 'booking' })).total).toBe(2);
    expect((await engine.queryGroups({ limit: 1 })).groups).toHaveLength(1);
  });

  it('sees fields touched by the ACTIVE version even after the draft was edited away', async () => {
    const engine = await freshEngine();
    const id = await activated(engine, usdGroup);
    // Edit the draft so it no longer touches portOfDischarge.
    await engine.updateGroup(
      id,
      {
        ...usdGroup,
        rules: [
          { when: { op: 'eq', field: 'status', value: 'new' }, then: [{ verb: 'set', field: 'currency', value: 'USD' }] },
        ],
      },
      { actor: 'money' },
    );
    // The active v1 still reads portOfDischarge; the query must not hide it.
    const touching = await engine.queryGroups({ touchesField: 'portOfDischarge' });
    expect(touching.groups.map((g) => g.id)).toEqual([id]);
  });
});

describe('consistency tier (§5.2)', () => {
  it('finds overlapping same-field writers and stays quiet for disjoint scopes', async () => {
    const engine = await freshEngine();
    await activated(engine, usdGroup);
    await activated(engine, eurGroup);

    // Shipper A + POD CNNGB can be one row; both write currency.
    const findings = await engine.consistency();
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'overlapping-writes', field: 'currency' });

    // A draft scoped to shipper B on CNSHA overlaps the EUR group only.
    const draft: GroupDefinitionInput = {
      ...usdGroup,
      name: 'Shipper B special',
      scope: {
        all: [
          { field: 'shipperParty', op: 'eq', value: 'B' },
          { field: 'portOfDischarge', op: 'eq', value: 'CNSHA' },
        ],
      },
    };
    const draftFindings = await engine.consistency(draft);
    expect(draftFindings).toHaveLength(1);
    expect(draftFindings[0]?.groups.map((g) => g.name)).toContain('CNNGB corridor pricing');

    // Disjoint from BOTH actives (shipper B ∧ USLAX): no overlap findings.
    // Note a scope of only {portOfDischarge: USLAX} WOULD overlap the
    // shipper-A group — analysis is scope-level and conservative by design.
    const disjoint: GroupDefinitionInput = {
      ...draft,
      scope: {
        all: [
          { field: 'shipperParty', op: 'eq', value: 'B' },
          { field: 'portOfDischarge', op: 'eq', value: 'USLAX' },
        ],
      },
    };
    expect(await engine.consistency(disjoint)).toHaveLength(0);
  });
});

describe('backtest (§5.3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'malkom-rules-bt-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('evaluates a draft against real host rows, read-only, with evidence', async () => {
    const file = join(dir, 'host.db');
    const host = new DatabaseSync(file);
    host.exec(`
      CREATE TABLE bookings (id TEXT PRIMARY KEY, shipper_party TEXT, pod TEXT, currency TEXT, status TEXT);
      INSERT INTO bookings VALUES
        ('B-1', 'A', 'CNNGB', 'EUR', 'new'),
        ('B-2', 'A', 'CNNGB', NULL,  'new'),
        ('B-3', 'A', 'USLAX', 'USD', 'new'),
        ('B-4', 'B', 'CNNGB', 'EUR', 'confirmed'),
        ('B-5', 'A', 'CNNGB', 'USD', 'confirmed');
    `);
    host.close();

    const engine = new RulesEngine({ logger: noopLogger });
    await engine.start();
    await engine.applyRegistry(REGISTRY);
    engine.connections.registerClient('main', 'sqlite', new SqliteSqlClient(file));
    await activated(engine, eurGroup); // an active group also writing currency

    const report = await engine.backtest(usdGroup, { sample: 100 });
    expect(report).toMatchObject({
      entity: 'booking',
      rowsSampled: 5,
      matched: 4, // every shipper-A row
      rowsWithFiredRules: 3, // B-1, B-2, B-5 (POD = CNNGB)
      patches: 3,
      violations: 0,
    });
    // The static analysis warns about the active EUR group before activation.
    expect(report.conflictsWithActive).toHaveLength(1);
    expect(report.conflictsWithActive[0]?.field).toBe('currency');
    expect(report.sampleOutcomes[0]).toMatchObject({
      index: 0,
      matched: true,
      patch: [{ field: 'currency', value: 'USD' }],
    });
    await engine.stop();
  });

  it('refuses drafts that fail tier-1 and entities without a binding', async () => {
    const engine = await freshEngine();
    await expect(
      engine.backtest({ ...usdGroup, scope: { all: [{ field: 'ghost', op: 'eq', value: 1 }] } }),
    ).rejects.toThrow(/tier-1-valid/);
    // Registry has a binding but no connection registered under 'main'.
    await expect(engine.backtest(usdGroup)).rejects.toThrow(/registered connection/);
  });
});
