import { describe, expect, it } from 'vitest';
import { ExceptionEngine } from '../src/engine.js';
import type { ReasonDefinitionInput, Viewer } from '../src/index.js';
import { registerDesks } from './viewers.js';

const NOW = '2026-08-24T10:00:00Z';
const B = { respond: { minutes: 240, calendarId: '24x7' }, act: { minutes: 480, calendarId: '24x7' }, referralMaxMinutes: 4320, autoAcceptMinutes: null };
const REASON: ReasonDefinitionInput = {
  code: 'COST_APPROVAL', label: 'Cost approval', subjectTypes: ['task'],
  answerShape: ['decision'], budgets: B, defaultDestination: 'onshore.ap.USHOU',
};

const viewer = (id: string, capabilities: string[], wheres: object[], unit = ''): Viewer => ({
  id, name: id, unit, system: false,
  grants: wheres.map((where) => ({ capabilities: capabilities as never, where, note: '' })),
});

const PRIYA = viewer('usr_priya', ['read', 'raise', 'comment', 'accept'], [{}], 'Offshore AP · Kolkata');
const DALE = viewer('usr_dale', ['read', 'answer', 'comment', 'reassign'], [{}], 'AP Houston');
const TAX = viewer('usr_tax', ['read', 'comment'], [{ department: 'TAX' }], 'Tax EMEA');

const seed = () => {
  const engine = new ExceptionEngine();
  registerDesks(engine);
  engine.putDestination({ id: 'onshore.tax.EMEA', label: 'Tax EMEA', department: 'TAX', office: 'NLRTM', country: 'NL', region: 'EMEA' });
  engine.putReason(REASON);
  const h = engine.handle({
    type: 'raise', idempotencyKey: 'c-1', at: '2026-08-24T08:00:00Z',
    data: { reasonCode: 'COST_APPROVAL', subject: { type: 'task', id: 't-1' }, question: 'approve?', scope: { office: 'USHOU' } },
  } as never, PRIYA).handover;
  const say = (by: Viewer, body: string, audience = {}, key = body.slice(0, 12)) =>
    engine.handle({
      type: 'comment', handoverId: h.id, idempotencyKey: `c-${key}`, at: '2026-08-24T09:00:00Z',
      data: { body, audience },
    } as never, by);
  return { engine, h, say };
};

describe('who said what, to whom, from which desk, when', () => {
  it('records all four', () => {
    const { engine, h, say } = seed();
    say(DALE, 'Checking with the supplier now.');
    const [comment] = engine.timeline(DALE, h.id);
    expect(comment).toMatchObject({
      body: 'Checking with the supplier now.',
      authorId: 'usr_dale', authorName: 'usr_dale',
      authorUnit: 'AP Houston',        // which desk
      authorSide: 'RESOLVER',          // derived, not claimed
      at: '2026-08-24T09:00:00Z',      // when
    });
  });

  it('records who it was said TO, and refuses a desk that does not exist', () => {
    const { engine, h, say } = seed();
    say(DALE, 'Tax, can you confirm?', { to: ['onshore.tax.EMEA'] });
    expect(engine.timeline(DALE, h.id)[0]?.to).toEqual(['onshore.tax.EMEA']);
    expect(() => say(DALE, 'To nobody', { to: ['onshore.tax.MARS'] }, 'mars')).toThrow(/does not exist/);
  });

  it('does not move the baton or stop a clock — saying is not doing', () => {
    const { engine, h, say } = seed();
    const before = engine.get(PRIYA, h.id);
    const after = say(DALE, 'Looking at it.').handover;
    expect(after.holder).toBe(before?.holder);
    expect(after.segments).toHaveLength(before?.segments.length ?? 0);
    expect(engine.events(PRIYA, h.id).at(-1)?.baton).toBeNull();
  });

  it('threads a reply to what it replies to', () => {
    const { engine, h, say } = seed();
    const first = say(DALE, 'Which cost centre?').handover.comments[0];
    say(PRIYA, 'CC-4402.', { to: [] }, 'reply');
    const replied = engine.handle({
      type: 'comment', handoverId: h.id, idempotencyKey: 'c-thread', at: '2026-08-24T09:30:00Z',
      data: { body: 'Thanks.', parentId: first?.id ?? null },
    } as never, DALE).handover;
    expect(replied.comments.at(-1)?.parentId).toBe(first?.id);
  });
});

describe('one-sided remarks are hidden by capability, never by obscurity', () => {
  it('keeps a resolver-only note off the originator’s timeline', () => {
    const { engine, h, say } = seed();
    say(DALE, 'Public: with the supplier.', { visibility: 'BOTH' }, 'pub');
    say(DALE, 'Internal: their credit is on hold.', { visibility: 'RESOLVER_ONLY' }, 'int');

    expect(engine.timeline(DALE, h.id)).toHaveLength(2);
    expect(engine.timeline(PRIYA, h.id).map((c) => c.body)).toEqual(['Public: with the supplier.']);
  });

  it('shows both sides to an auditor holding read.internal', () => {
    const { engine, h, say } = seed();
    say(DALE, 'Internal only.', { visibility: 'RESOLVER_ONLY' }, 'i2');
    const auditor = viewer('usr_audit', ['read', 'read.internal'], [{}], 'Internal Audit');
    expect(engine.timeline(auditor, h.id)).toHaveLength(1);
  });

  it('shows a bystander nothing one-sided, since they are on neither side', () => {
    const { engine, h, say } = seed();
    say(DALE, 'Resolver note.', { visibility: 'RESOLVER_ONLY' }, 'i3');
    say(DALE, 'Everyone.', { visibility: 'BOTH' }, 'i4');
    const watcher = viewer('usr_w', ['read'], [{}]);
    expect(engine.timeline(watcher, h.id).map((c) => c.body)).toEqual(['Everyone.']);
  });
});

describe('tagging another department in', () => {
  it('lets a desk see the handover without taking it away from the one that has it', () => {
    const { engine, h } = seed();
    expect(engine.list(TAX, {}, NOW)).toHaveLength(0);

    const tagged = engine.handle({
      type: 'add-participant', handoverId: h.id, idempotencyKey: 'c-tag', at: '2026-08-24T09:00:00Z',
      data: { destinationId: 'onshore.tax.EMEA', role: 'CONTRIBUTOR', note: 'VAT treatment' },
    } as never, DALE).handover;

    // Tax can now see it — and the handover has not moved.
    expect(engine.list(TAX, {}, NOW)).toHaveLength(1);
    expect(tagged.destination).toBe('onshore.ap.USHOU');
    expect(tagged.holder).toBe('RESOLVER');
    expect(tagged.participants[0]).toMatchObject({ destinationId: 'onshore.tax.EMEA', role: 'CONTRIBUTOR', removedAt: null });
  });

  it('lets a tagged desk comment, but never answer', () => {
    const { engine, h } = seed();
    engine.handle({
      type: 'add-participant', handoverId: h.id, idempotencyKey: 'c-tag2', at: '2026-08-24T09:00:00Z',
      data: { destinationId: 'onshore.tax.EMEA' },
    } as never, DALE);
    expect(() =>
      engine.handle({
        type: 'comment', handoverId: h.id, idempotencyKey: 'c-tc', at: '2026-08-24T09:10:00Z',
        data: { body: 'VAT is recoverable.' },
      } as never, TAX),
    ).not.toThrow();
    expect(() =>
      engine.handle({
        type: 'answer', handoverId: h.id, idempotencyKey: 'c-ta', at: '2026-08-24T09:20:00Z',
        data: { body: 'x', fields: { decision: 'approved' } },
      } as never, TAX),
    ).toThrow(/no answer grant/);
  });

  it('removes softly, because a desk that could see it yesterday is part of the record', () => {
    const { engine, h } = seed();
    engine.handle({ type: 'add-participant', handoverId: h.id, idempotencyKey: 'c-t3', at: '2026-08-24T09:00:00Z',
      data: { destinationId: 'onshore.tax.EMEA' } } as never, DALE);
    const after = engine.handle({ type: 'remove-participant', handoverId: h.id, idempotencyKey: 'c-t4',
      at: '2026-08-24T11:00:00Z', data: { destinationId: 'onshore.tax.EMEA' } } as never, DALE).handover;

    expect(after.participants).toHaveLength(1);
    expect(after.participants[0]?.removedAt).toBe('2026-08-24T11:00:00Z');
    expect(engine.list(TAX, {}, NOW)).toHaveLength(0);
  });

  it('is idempotent, so tagging the same desk twice is not two rows', () => {
    const { engine, h } = seed();
    for (const key of ['a', 'b']) {
      engine.handle({ type: 'add-participant', handoverId: h.id, idempotencyKey: `c-i${key}`,
        at: '2026-08-24T09:00:00Z', data: { destinationId: 'onshore.tax.EMEA' } } as never, DALE);
    }
    expect(engine.get(DALE, h.id)?.participants).toHaveLength(1);
  });
});
