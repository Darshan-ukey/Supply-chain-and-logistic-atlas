import { describe, expect, it } from 'vitest';
import { buildFetchHandler, QualityEngine, sampleBucket, sampled } from '../src/index.js';

const definition = {
  id: 'booking-quality',
  name: 'Booking quality',
  samplingPercent: 25,
  mandatoryFields: ['bookingNumber', 'portOfLoading'],
};

describe('quality engine', () => {
  it('sampling is deterministic and tracks the configured percentage', () => {
    const same = sampleBucket('s', 'item-1');
    expect(sampleBucket('s', 'item-1')).toBe(same);
    let hits = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (sampled('s', `item-${i}`, 25)) hits += 1;
    }
    expect(hits / 2000).toBeGreaterThan(0.2);
    expect(hits / 2000).toBeLessThan(0.3);
  });

  it('forces review when mandatory fields are missing', () => {
    const engine = new QualityEngine();
    engine.upsertStream({ ...definition, samplingPercent: 0 });
    const missing = engine.decide('booking-quality', { itemId: 'a', fields: { bookingNumber: 'BKG1' } });
    expect(missing.audit).toBe(true);
    expect(missing.reasons).toContain('missing:portOfLoading');
    const complete = engine.decide('booking-quality', {
      itemId: 'a',
      fields: { bookingNumber: 'BKG1', portOfLoading: 'INNSA' },
    });
    expect(complete.audit).toBe(false);
  });

  it('runs the review ledger open → complete and summarises pass rate', () => {
    const engine = new QualityEngine();
    engine.applyConfig({ streams: [definition] });
    const r1 = engine.openReview({ streamId: 'booking-quality', itemId: 'a' });
    const r2 = engine.openReview({ streamId: 'booking-quality', itemId: 'b' });
    engine.completeReview(r1.id, { outcome: 'PASS' });
    engine.completeReview(r2.id, { outcome: 'FAIL', fieldErrors: ['portOfLoading'], notes: 'wrong port' });
    expect(() => engine.completeReview(r2.id, { outcome: 'PASS' })).toThrowError(/already complete/);
    const summary = engine.summary('booking-quality');
    expect(summary.done).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBe(50);
  });

  it('serves /v1 routes with scoped keys', async () => {
    const engine = new QualityEngine();
    engine.upsertStream(definition);
    const handler = buildFetchHandler(engine, { adminKeys: ['adm'], readKeys: ['rdr'] });
    expect((await handler(new Request('http://x/v1/streams'))).status).toBe(401);
    const decide = await handler(new Request('http://x/v1/streams/booking-quality/decide', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ itemId: 'a', fields: {} }),
    }));
    expect(decide.status).toBe(200);
    const openAsRead = await handler(new Request('http://x/v1/reviews', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ streamId: 'booking-quality', itemId: 'a' }),
    }));
    expect(openAsRead.status).toBe(403);
    expect((await handler(new Request('http://x/v1/health'))).status).toBe(200);
  });

  it('404s unknown streams and 409s disabled ones', () => {
    const engine = new QualityEngine();
    expect(() => engine.decide('missing', { itemId: 'a' })).toThrowError(/not found/);
    engine.upsertStream({ ...definition, id: 'off', enabled: false });
    expect(() => engine.decide('off', { itemId: 'a' })).toThrowError(/disabled/);
  });
});
