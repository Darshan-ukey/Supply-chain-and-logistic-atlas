import { describe, expect, it } from 'vitest';
import { RulesEngine } from '../src/engine.js';
import { buildFetchHandler, type FetchHandler } from '../src/http/router.js';
import { noopLogger } from '../src/ports/logger.js';
import type { GroupDefinitionInput, RegistryDocInput } from '../src/config/schemas.js';

const REGISTRY: RegistryDocInput = {
  entities: [
    {
      id: 'booking',
      subQueueField: 'status',
      fields: [
        { id: 'shipperParty', type: 'string' },
        { id: 'portOfDischarge', type: 'string' },
        { id: 'currency', type: 'string' },
        { id: 'status', type: 'string', values: ['new', 'confirmed'] },
      ],
    },
  ],
  valueSets: [],
};

const GROUP: GroupDefinitionInput = {
  name: 'Shipper A — USD corridors',
  entity: 'booking',
  scope: { all: [{ field: 'shipperParty', op: 'eq', value: 'A' }] },
  rules: [
    {
      when: { op: 'eq', field: 'portOfDischarge', value: 'CNNGB' },
      then: [
        { verb: 'assert', field: 'currency', check: { op: 'eq', field: 'currency', value: 'USD' } },
      ],
    },
  ],
};

const BOOKING = { id: 'B-9', shipperParty: 'A', status: 'new', portOfDischarge: 'CNNGB', currency: 'EUR' };

async function handler(auth?: { adminKeys: string[]; readKeys: string[] }): Promise<FetchHandler> {
  const engine = new RulesEngine({ logger: noopLogger });
  await engine.start();
  return buildFetchHandler(engine, auth ? { auth } : {});
}

function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`;
  return new Request(`http://engine.local${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function ok(res: Response): Promise<Record<string, unknown>> {
  const parsed = (await res.json()) as Record<string, unknown>;
  expect(res.status, JSON.stringify(parsed)).toBeLessThan(300);
  return parsed;
}

describe('REST control plane (M5 exit: the full loop over HTTP)', () => {
  it('runs authoring → approval → evaluation → audit purely over the router', async () => {
    const fetch = await handler();

    // Discovery before a registry exists.
    const describe1 = await ok(await fetch(req('GET', '/v1')));
    expect(describe1['engine']).toBe('malkom-rules');
    expect(describe1['registry']).toBeNull();
    expect(Object.keys((await ok(await fetch(req('GET', '/v1/schemas')))))).toContain('group-definition');

    // Registry.
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));
    const reg = await ok(await fetch(req('GET', '/v1/registry')));
    expect(reg['version']).toBe(1);

    // Create → validate → submit → activate.
    const created = await ok(
      await fetch(req('POST', '/v1/groups', { definition: GROUP, actor: 'money' })),
    );
    const id = created['id'] as string;
    expect(created['state']).toBe('draft');

    const validation = await ok(await fetch(req('POST', `/v1/groups/${id}/validate`)));
    expect(validation['ok']).toBe(true);

    await ok(await fetch(req('POST', `/v1/groups/${id}/submit`, { actor: 'money' })));
    const active = await ok(await fetch(req('POST', `/v1/groups/${id}/activate`, { actor: 'priya' })));
    expect(active['state']).toBe('active');

    // Discovery + queries (D6 over REST).
    const applicable = await ok(
      await fetch(req('POST', '/v1/eval/applicable', { entity: 'booking', props: { shipperParty: 'A' } })),
    );
    expect(applicable).toHaveLength(1);
    const byField = await ok(await fetch(req('GET', '/v1/groups?touchesField=currency')));
    expect(byField['total']).toBe(1);

    // Evaluation.
    const explained = await ok(
      await fetch(req('POST', '/v1/eval/explain', { entity: 'booking', row: BOOKING })),
    );
    expect((explained['assertions'] as unknown[]).length).toBe(1);

    const applied = await ok(
      await fetch(req('POST', '/v1/eval/apply', { entity: 'booking', row: BOOKING })),
    );
    expect(applied['mode']).toBe('apply');

    // Audit.
    const decisions = await ok(await fetch(req('GET', '/v1/decisions?entity=booking')));
    expect(decisions['total']).toBe(1);

    // Versions + metrics endpoints answer.
    expect((await ok(await fetch(req('GET', `/v1/groups/${id}/versions`)))).toString()).toBeDefined();
    const prom = await fetch(req('GET', '/v1/metrics'));
    expect(prom.status).toBe(200);
    expect(await prom.text()).toContain('malkom_rules_evaluations_total');

    // Errors map to typed envelopes.
    const missing = await fetch(req('GET', '/v1/groups/nope'));
    expect(missing.status).toBe(404);
    const envelope = (await missing.json()) as { error: { code: string } };
    expect(envelope.error.code).toBe('NOT_FOUND');
  });

  it('rejects garbage input with 422 instead of silently-empty 200s', async () => {
    const fetch = await handler();
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));

    // NaN paging and typo'd enums must error, not return empty pages.
    expect((await fetch(req('GET', '/v1/groups?limit=abc'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/groups?state=activ'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/groups?expiringBefore=next-week'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/decisions?since=lastweek'))).status).toBe(422);
    expect((await fetch(req('GET', '/v1/registry?version=latest'))).status).toBe(422);
    // A missing version is a clean 404 with an honest message, and '1.0'
    // coerces to integer 1 — that one is deliberate leniency.
    expect((await fetch(req('GET', '/v1/registry?version=99'))).status).toBe(404);

    // Bad asOf is client error, not a 500.
    const badAsOf = await fetch(
      req('POST', '/v1/eval/explain', { entity: 'booking', row: {}, asOf: 'tomorrow' }),
    );
    expect(badAsOf.status).toBe(422);

    // Malformed JSON body must never become a clean {} verdict.
    const malformed = await fetch(
      new Request('http://engine.local/v1/eval/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{oops',
      }),
    );
    expect(malformed.status).toBe(422);

    // Empty entity is rejected too — no junk decision records.
    expect((await fetch(req('POST', '/v1/eval/apply', { row: {} }))).status).toBe(422);
  });

  it('requires an actor on audited mutations — no silent "anonymous"', async () => {
    const fetch = await handler();
    await ok(await fetch(req('PUT', '/v1/registry', REGISTRY)));
    expect((await fetch(req('POST', '/v1/groups', { definition: GROUP }))).status).toBe(422);
    const created = await ok(
      await fetch(req('POST', '/v1/groups', { definition: GROUP, actor: 'money' })),
    );
    const noActor = await fetch(req('POST', `/v1/groups/${created['id'] as string}/submit`, {}));
    expect(noActor.status).toBe(422);
  });

  it('enforces bearer scopes: read cannot mutate, admin can, unknown is rejected', async () => {
    const fetch = await handler({ adminKeys: ['adm-1'], readKeys: ['rd-1'] });

    // No token.
    expect((await fetch(req('GET', '/v1'))).status).toBe(401);
    // Read token: discovery yes, mutation no.
    expect((await fetch(req('GET', '/v1', undefined, 'rd-1'))).status).toBe(200);
    expect((await fetch(req('PUT', '/v1/registry', REGISTRY, 'rd-1'))).status).toBe(403);
    // apply is admin-scoped (it writes the decision log).
    expect(
      (await fetch(req('POST', '/v1/eval/apply', { entity: 'booking', row: {} }, 'rd-1'))).status,
    ).toBe(403);
    // Backtest returns real host rows — read scope is not enough.
    expect(
      (await fetch(req('POST', '/v1/backtest', { definition: GROUP }, 'rd-1'))).status,
    ).toBe(403);
    // Admin token mutates.
    expect((await fetch(req('PUT', '/v1/registry', REGISTRY, 'adm-1'))).status).toBe(200);
    // Garbage token.
    expect((await fetch(req('GET', '/v1', undefined, 'nope'))).status).toBe(401);
    // RFC 7235: the scheme is case-insensitive.
    const lower = await fetch(
      new Request('http://engine.local/v1', {
        method: 'GET',
        headers: { authorization: 'bearer rd-1' },
      }),
    );
    expect(lower.status).toBe(200);
  });
});
