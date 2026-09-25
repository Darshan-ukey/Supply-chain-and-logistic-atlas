import { describe, expect, it } from 'vitest';
import { admin, asViewer, DESKS, observer, offshore, onshore, registerDesks, run } from './viewers.js';
import { ExceptionEngine } from '../src/engine.js';
import { buildFetchHandler } from '../src/router.js';
import type { ReasonDefinitionInput } from '../src/schemas.js';

/**
 * The control plane the MALKOM runtime bridges at
 * /api/exceptions/engine/* behind its own JWT and roles. If the CLI can do it,
 * any client can — so this is the whole surface, tested as a client sees it.
 */

const REASON: ReasonDefinitionInput = {
  code: 'WORK_ORDER_MISSING',
  label: 'Work order not updated',
  subjectTypes: ['invoice'],
  answerShape: ['workOrderRef'],
  budgets: { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: null, autoAcceptMinutes: null },
  clusterBy: 'workOrderRef',
  defaultDestination: 'onshore.ap.USHOU',
};

const handlerWith = () => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putReason(REASON);
  return buildFetchHandler(engine);
};

const call = (handler: ReturnType<typeof handlerWith>, method: string, path: string, body?: unknown) =>
  handler(
    new Request(`http://engine.internal${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
    }),
  );

const RAISE = {
  idempotencyKey: 'k-1',
  at: '2026-08-21T09:00:00Z',
  actor: { id: 'usr_off', name: 'Priya', side: 'ORIGINATOR' },
  data: {
    reasonCode: 'WORK_ORDER_MISSING',
    subject: { type: 'invoice', id: 'INV-9001', path: 'fields.workOrderRef' },
    question: 'The work order is not on the PO yet — which one applies?',
    clusterKey: 'WO-88213',
  },
};

describe('the control plane', () => {
  it('describes itself and reports health without a key', async () => {
    const handler = handlerWith();
    expect((await call(handler, 'GET', '/v1/health')).status).toBe(200);
    const discovery = (await (await call(handler, 'GET', '/v1')).json()) as { capabilities: string[] };
    expect(discovery.capabilities).toContain('two-clock-ledger');
  });

  it('raises, answers and accepts over HTTP', async () => {
    const handler = handlerWith();
    const raised = await call(handler, 'POST', '/v1/handovers', RAISE);
    expect(raised.status).toBe(201);
    const { handover } = (await raised.json()) as { handover: { id: string; holder: string } };
    expect(handover.holder).toBe('RESOLVER');

    const answered = await call(handler, 'POST', `/v1/handovers/${handover.id}/commands`, {
      type: 'answer', idempotencyKey: 'k-2', at: '2026-08-21T11:00:00Z',
      actor: { id: 'usr_on', name: 'Dale', side: 'RESOLVER' },
      data: { body: 'WO-88213 applies.', fields: { workOrderRef: 'WO-88213' } },
    });
    expect(answered.status).toBe(200);

    const read = (await (await call(handler, 'GET', `/v1/handovers/${handover.id}?now=2026-08-21T12:00:00Z`)).json()) as {
      totals: { resolver: number; originator: number };
      budgetUsed: number | null;
    };
    expect(read.totals.resolver).toBe(120);
    expect(read.totals.originator).toBe(60); // live, from the running segment
    expect(read.budgetUsed).toBeCloseTo(60 / 480, 5);
  });

  it('refuses a stale If-Match with the current version', async () => {
    const handler = handlerWith();
    const { handover } = (await (await call(handler, 'POST', '/v1/handovers', RAISE)).json()) as { handover: { id: string } };
    await call(handler, 'POST', `/v1/handovers/${handover.id}/commands`, {
      type: 'reassign', idempotencyKey: 'k-3', at: '2026-08-21T10:00:00Z',
      actor: { id: 'usr_on', name: 'Dale', side: 'RESOLVER' }, data: { holderRef: 'usr_on_2' },
    });
    const stale = await handler(
      new Request(`http://engine.internal/v1/handovers/${handover.id}/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'if-match': '1' },
        body: JSON.stringify({
          type: 'reassign', idempotencyKey: 'k-4', at: '2026-08-21T10:10:00Z',
          actor: { id: 'usr_on', name: 'Dale', side: 'RESOLVER' }, data: { holderRef: 'usr_on_3' },
        }),
      }),
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()) as { error: { details: string[] } }).toMatchObject({
      error: { code: 'version_conflict', details: ['current version is 2'] },
    });
  });

  it('answers the case panel and the cluster in one call each', async () => {
    const handler = handlerWith();
    await call(handler, 'POST', '/v1/handovers', RAISE);
    await call(handler, 'POST', '/v1/handovers', { ...RAISE, idempotencyKey: 'k-9' , data: { ...RAISE.data, question: 'And the cost centre?' } });

    const panel = (await (await call(handler, 'GET', '/v1/subjects/invoice/INV-9001/handovers')).json()) as {
      handovers: unknown[];
    };
    expect(panel.handovers).toHaveLength(2);

    const cluster = (await (await call(handler, 'GET', '/v1/clusters/WO-88213')).json()) as { handovers: unknown[] };
    expect(cluster.handovers).toHaveLength(2);
  });

  it('turns a refused command into a 400 that names what was wrong', async () => {
    const handler = handlerWith();
    const { handover } = (await (await call(handler, 'POST', '/v1/handovers', RAISE)).json()) as { handover: { id: string } };
    const thin = await call(handler, 'POST', `/v1/handovers/${handover.id}/commands`, {
      type: 'answer', idempotencyKey: 'k-5', at: '2026-08-21T11:00:00Z',
      actor: { id: 'usr_on', name: 'Dale', side: 'RESOLVER' }, data: { body: 'will revert' },
    });
    expect(thin.status).toBe(400);
    expect(JSON.stringify(await thin.json())).toContain('workOrderRef');
  });

  it('refuses a write from a read-only key and admits a reader', async () => {
    const engine = new ExceptionEngine();
  registerDesks(engine);
    engine.putReason(REASON);
    const guarded = buildFetchHandler(engine, { adminKeys: ['admin-key'], readKeys: ['read-key'] });
    const bearer = (key: string) =>
      new Request('http://engine.internal/v1/handovers', {
        method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(RAISE),
      });
    expect((await guarded(bearer('read-key'))).status).toBe(403);
    expect((await guarded(bearer('nope'))).status).toBe(401);
    expect((await guarded(bearer('admin-key'))).status).toBe(201);
  });
});
