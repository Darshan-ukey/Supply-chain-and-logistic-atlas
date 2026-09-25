import { describe, expect, it } from 'vitest';
import { buildFetchHandler, ValidationEngine } from '../src/index.js';

const ruleSet = {
  id: 'booking-new',
  name: 'Booking — new',
  checks: [
    { kind: 'required' as const, field: 'bookingNumber' },
    { kind: 'required' as const, field: 'pol' },
    { kind: 'pattern' as const, field: 'pol', pattern: '^[A-Z]{2}[A-Z0-9]{3}$' },
    { kind: 'differentFrom' as const, field: 'pod', otherField: 'pol' },
    { kind: 'range' as const, field: 'grossWeightKg', min: 1, max: 40_000 },
    { kind: 'oneOf' as const, field: 'incoterm', values: ['FOB', 'CIF', 'EXW'] },
    { kind: 'date' as const, field: 'etd' },
    { kind: 'requiredWhen' as const, field: 'reason', whenField: 'subQueue', whenValues: ['cancellation'] },
  ],
  warnOnly: ['etd'],
};

const good = {
  bookingNumber: 'BKG1',
  pol: 'INNSA',
  pod: 'DEHAM',
  grossWeightKg: 12_000,
  incoterm: 'FOB',
  etd: '2026-09-01',
  subQueue: 'new',
};

describe('validation engine', () => {
  it('passes a complete record', () => {
    const engine = new ValidationEngine();
    engine.upsertRuleSet(ruleSet);
    const result = engine.evaluate('booking-new', { fields: good });
    expect(result.passed).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.checksRun).toBe(8);
  });

  it('reports each failing check once, on the right field', () => {
    const engine = new ValidationEngine();
    engine.upsertRuleSet(ruleSet);
    const result = engine.evaluate('booking-new', {
      fields: { ...good, pol: 'BAD', pod: 'BAD', grossWeightKg: 90_000, incoterm: 'DDP' },
    });
    expect(result.passed).toBe(false);
    const rules = result.findings.map((f) => `${f.field}:${f.rule}`);
    expect(rules).toContain('pol:pattern');
    expect(rules).toContain('pod:differentFrom');
    expect(rules).toContain('grossWeightKg:range');
    expect(rules).toContain('incoterm:oneOf');
  });

  it('stays silent on format checks for missing values — that is required\'s job', () => {
    const engine = new ValidationEngine();
    engine.upsertRuleSet(ruleSet);
    const result = engine.evaluate('booking-new', { fields: { bookingNumber: 'BKG1', subQueue: 'new' } });
    const polFindings = result.findings.filter((f) => f.field === 'pol');
    expect(polFindings).toHaveLength(1);
    expect(polFindings[0]?.rule).toBe('required');
  });

  it('arms requiredWhen only on the trigger value and warns without blocking', () => {
    const engine = new ValidationEngine();
    engine.upsertRuleSet(ruleSet);
    const cancel = engine.evaluate('booking-new', { fields: { ...good, subQueue: 'cancellation' } });
    expect(cancel.findings.some((f) => f.field === 'reason' && f.rule === 'requiredWhen')).toBe(true);
    const warned = engine.evaluate('booking-new', { fields: { ...good, etd: 'not-a-date' } });
    expect(warned.passed).toBe(true); // etd is warn-only
    expect(warned.findings[0]?.severity).toBe('WARN');
  });

  it('serves /v1 routes with scoped keys and logs evaluations', async () => {
    const engine = new ValidationEngine();
    engine.applyConfig({ ruleSets: [ruleSet] });
    const handler = buildFetchHandler(engine, { adminKeys: ['adm'], readKeys: ['rdr'] });
    expect((await handler(new Request('http://x/v1/rulesets'))).status).toBe(401);
    const evaluated = await handler(new Request('http://x/v1/rulesets/booking-new/evaluate', {
      method: 'POST',
      headers: { authorization: 'Bearer rdr', 'content-type': 'application/json' },
      body: JSON.stringify({ fields: good }),
    }));
    expect(evaluated.status).toBe(200);
    expect(engine.evaluations('booking-new', 10, 0)).toHaveLength(1);
    expect((await handler(new Request('http://x/v1/health'))).status).toBe(200);
  });
});
