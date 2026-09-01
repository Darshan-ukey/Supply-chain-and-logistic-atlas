import { describe, expect, it } from 'vitest';
import { ClassificationEngine } from '../src/engine.js';

const definition = {
  id: 'booking-subq',
  name: 'Booking flow classifier',
  classes: ['new', 'amendment', 'cancellation'],
};

describe('classification engine', () => {
  it('creates models via config apply and lists them', () => {
    const engine = new ClassificationEngine();
    const result = engine.applyConfig({ models: [definition] });
    expect(result.applied).toEqual(['booking-subq']);
    expect(engine.listModels()[0]?.answersLearned).toBe(0);
  });

  it('learns from every answer instantly and predicts', () => {
    const engine = new ClassificationEngine();
    engine.applyConfig({ models: [definition] });
    engine.learn('booking-subq', { text: 'please book two containers', label: 'new' });
    engine.learn('booking-subq', { text: 'cancel our booking now', label: 'cancellation' });
    engine.learn('booking-subq', { text: 'change the consignee please', label: 'amendment' });
    const prediction = engine.predict('booking-subq', { text: 'cancel the shipment cancel it' });
    expect(prediction.label).toBe('cancellation');
    expect(engine.listModels()[0]?.answersLearned).toBe(3);
  });

  it('rejects labels outside the model classes', () => {
    const engine = new ClassificationEngine();
    engine.applyConfig({ models: [definition] });
    expect(() => engine.learn('booking-subq', { text: 'hello', label: 'weird' })).toThrow(/not one of/);
  });

  it('tracks corrections and records decisions', () => {
    const engine = new ClassificationEngine();
    engine.applyConfig({ models: [definition] });
    const learned = engine.learn('booking-subq', { text: 'roll to next sailing', label: 'amendment', predictedLabel: 'new' });
    expect(learned.corrected).toBe(true);
    const decisions = engine.decisions('booking-subq', 10, 0);
    expect(decisions[0]?.kind).toBe('learn');
    expect(decisions[0]?.corrected).toBe(true);
  });

  it('flags low confidence under the floor', () => {
    const engine = new ClassificationEngine();
    engine.applyConfig({ models: [{ ...definition, confidenceFloor: 99 }] });
    engine.learn('booking-subq', { text: 'book containers', label: 'new' });
    engine.learn('booking-subq', { text: 'cancel booking', label: 'cancellation' });
    const prediction = engine.predict('booking-subq', { text: 'totally unrelated words entirely' });
    expect(prediction.lowConfidence).toBe(true);
  });
});
