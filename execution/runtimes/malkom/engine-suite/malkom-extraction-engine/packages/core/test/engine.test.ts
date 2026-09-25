import { describe, expect, it } from 'vitest';
import { buildFetchHandler, ExtractionEngine } from '../src/index.js';

const SAMPLE = [
  'Subject: New booking request',
  'Booking Number: BKG4471023',
  'From: INNSA to USNYC, 2 x 40HC, CIF.',
  'Gross weight: 18,400 kgs. ETD 2026-08-20.',
  'Shipper: Acme Exports Ltd, Mumbai.',
].join('\n');

const definition = {
  id: 'booking-fields',
  name: 'Booking fields',
  fields: [
    { key: 'bookingNumber', label: 'Booking Number', type: 'text' },
    { key: 'portOfLoading', label: 'Port of Loading', type: 'text' },
    { key: 'portOfDischarge', label: 'Port of Discharge', type: 'text' },
    { key: 'incoterm', label: 'Incoterm', type: 'text' },
    { key: 'grossWeightKg', label: 'Gross Weight', type: 'number' },
    { key: 'etd', label: 'ETD', type: 'date' },
    { key: 'shipperName', label: 'Shipper', type: 'text' },
  ],
};

describe('extraction engine', () => {
  it('extracts typed shipping fields with honest confidences', () => {
    const engine = new ExtractionEngine();
    engine.upsertExtractor(definition);
    const result = engine.extract('booking-fields', { text: SAMPLE });
    expect(result.fields['bookingNumber']).toBe('BKG4471023');
    expect(result.fields['portOfLoading']).toBe('INNSA');
    expect(result.fields['portOfDischarge']).toBe('USNYC');
    expect(result.fields['incoterm']).toBe('CIF');
    expect(result.fields['grossWeightKg']).toBe(18400);
    expect(result.fields['shipperName']).toBe('Acme Exports Ltd');
    expect(result.confidence['bookingNumber']).toBeGreaterThanOrEqual(0.9);
    expect(result.extracted).toBeGreaterThanOrEqual(6);
  });

  it('never overwrites existing values and honours hints + floor', () => {
    const engine = new ExtractionEngine();
    engine.upsertExtractor({
      ...definition,
      id: 'hinted',
      fieldHints: { shipperName: '/Shipper:\\s*([^,\\n]+)/' },
      confidenceFloor: 0.8,
    });
    const result = engine.extract('hinted', { text: SAMPLE, existing: { bookingNumber: 'KEEP-ME' } });
    expect(result.fields['bookingNumber']).toBeUndefined();
    expect(result.fields['shipperName']).toBe('Acme Exports Ltd');
    expect(result.fields['etd']).toBeUndefined(); // 0.75 < floor
  });

  it('applies config bundles and logs runs', () => {
    const engine = new ExtractionEngine();
    const applied = engine.applyConfig({ extractors: [definition] });
    expect(applied.applied).toEqual(['booking-fields']);
    engine.extract('booking-fields', { text: SAMPLE });
    const runs = engine.runs('booking-fields', 10, 0);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.extracted).toBeGreaterThan(0);
  });

  it('serves /v1 routes with scoped keys', async () => {
    const engine = new ExtractionEngine();
    engine.upsertExtractor(definition);
    const handler = buildFetchHandler(engine, { adminKeys: ['adm'], readKeys: ['rdr'] });
    const noKey = await handler(new Request('http://x/v1/extractors'));
    expect(noKey.status).toBe(401);
    const read = await handler(new Request('http://x/v1/extractors/booking-fields/extract', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ text: SAMPLE }),
    }));
    expect(read.status).toBe(200);
    const readApply = await handler(new Request('http://x/v1/config/apply', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ extractors: [] }),
    }));
    expect(readApply.status).toBe(403);
    const health = await handler(new Request('http://x/v1/health'));
    expect(health.status).toBe(200);
  });

  it('404s unknown extractors and 409s disabled ones', () => {
    const engine = new ExtractionEngine();
    expect(() => engine.extract('missing', { text: 'x' })).toThrowError(/not found/);
    engine.upsertExtractor({ ...definition, id: 'off', enabled: false });
    expect(() => engine.extract('off', { text: 'x' })).toThrowError(/disabled/);
  });
});
