import { describe, expect, it } from 'vitest';
import {
  ExceptionEngine, InMemoryHandoverStore, viewerSchema,
  DEMO_CATEGORIES, DEMO_DESKS, DEMO_REASONS, DEMO_PEOPLE, DEMO_SUBJECT_SCHEMA, DEMO_CALENDARS,
  type Instruction,
} from '../src/index.js';

const who = (k: keyof typeof DEMO_PEOPLE) => viewerSchema.parse(DEMO_PEOPLE[k]);

const build = () => {
  const engine = new ExceptionEngine({
    store: new InMemoryHandoverStore(),
    calendars: { get: (id) => DEMO_CALENDARS.find((c) => c.id === id) ?? null, list: () => DEMO_CALENDARS },
  });
  const admin = who('admin');
  for (const desk of DEMO_DESKS) engine.putDestination(desk, admin);
  engine.applyConfig({ categories: DEMO_CATEGORIES, reasons: DEMO_REASONS });
  engine.putSubjectSchema(DEMO_SUBJECT_SCHEMA, admin);
  return engine;
};

const SCOPE = {
  office: 'ALPHA', country: 'Nordia', region: 'WEST',
  department: 'Offshore AP', queue: 'ap', subQueue: 'index', workType: 'TERM',
};

const snapshot = (reference: string, over: Record<string, unknown> = {}) => ({
  type: 'task', id: reference, path: 'rate', display: reference,
  values: {
    reference, partyName: 'Harbour Terminals Ltd', partyCode: 'SUP-11204',
    documentType: 'TERM', amount: 42_180, currency: 'EUR',
    documentDate: '2026-06-30', receivedDate: '2026-06-30', ...over,
  },
  attachments: [],
  ageAnchor: '2026-06-30T00:00:00.000Z',
});

const raise = (engine: ExceptionEngine, reference: string, n = 0) =>
  engine.handle({
    type: 'raise', idempotencyKey: `raise:${reference}`, at: `2026-07-10T12:4${n}:00.000Z`,
    data: {
      reasonCode: 'RATE_MISMATCH', scope: SCOPE, subject: snapshot(reference),
      question: 'Agreement says 36.20, the document charges 42.75.',
      fields: { partyCode: 'SUP-11204', rate: 42.75 },
    },
  }, who('arun'));

const of = <K extends Instruction['kind']>(list: readonly Instruction[], kind: K) =>
  list.find((i) => i.kind === kind) as Extract<Instruction, { kind: K }> | undefined;

describe('the work moves — the engine says so, the host does it', () => {
  it('tells the host to take the item out of its queue and hand it to the department', () => {
    const engine = build();
    const { instructions } = raise(engine, 'INV-1');
    const move = of(instructions, 'MOVE_SUBJECT');
    expect(move).toMatchObject({
      subjectId: 'INV-1', toState: 'QUERY', toDepartment: 'procurement.terminal',
      fromDepartment: 'Offshore AP', blocking: true,
    });
    // The instruction carries WHY, because it lands in somebody else's audit
    // trail and "state changed to QUERY" with no reason is unreadable.
    expect(move?.because).toContain('RATE_MISMATCH');
  });

  it('offers the item to the answering department, and never picks a person', () => {
    const engine = build();
    const offer = of(raise(engine, 'INV-2').instructions, 'OFFER_WORK');
    expect(offer).toMatchObject({ queueId: 'procurement.terminal', state: 'QUERY_OPEN', available: true });
    // Picking well needs shift, capacity and skill. An engine that learned
    // those would become a second allocation engine disagreeing with the real
    // one — so it hands over and stops.
    expect(Object.keys(offer ?? {})).not.toContain('assignTo');
  });

  it('sends the item back when the answer comes, without closing the query', () => {
    const engine = build();
    const raised = raise(engine, 'INV-3');
    const answered = engine.handle({
      type: 'answer', handoverId: raised.handover.id, expectedVersion: raised.handover.version,
      idempotencyKey: 'a1', at: '2026-07-13T14:00:00.000Z',
      data: { body: 'Amendment 5 raised it. The document is right.', fields: { rate: 42.75, decision: 'accept' } },
    }, who('nisha'));
    const move = of(answered.instructions, 'MOVE_SUBJECT');
    expect(move).toMatchObject({ toState: 'QUERY', toDepartment: 'Offshore AP' });
    expect(answered.handover.status).toBe('OPEN');
    // And the raiser is told, because their item is theirs again.
    expect(of(answered.instructions, 'NOTIFY')).toMatchObject({ audience: 'RAISER' });
  });

  it('returns the item to its ordinary state only when the query actually ends', () => {
    const engine = build();
    const raised = raise(engine, 'INV-4');
    const answered = engine.handle({
      type: 'answer', handoverId: raised.handover.id, expectedVersion: raised.handover.version,
      idempotencyKey: 'a2', at: '2026-07-13T14:00:00.000Z',
      data: { body: 'Confirmed.', fields: { rate: 42.75, decision: 'accept' } },
    }, who('nisha'));
    const closed = engine.handle({
      type: 'accept', handoverId: raised.handover.id, expectedVersion: answered.handover.version,
      idempotencyKey: 'c1', at: '2026-07-14T06:00:00.000Z', data: {},
    }, who('arun'));
    expect(of(closed.instructions, 'RETURN_SUBJECT')).toMatchObject({
      toState: 'INDEXED', toDepartment: 'Offshore AP',
    });
    expect(of(closed.instructions, 'OFFER_WORK')).toMatchObject({ available: false, state: 'QUERY_CLOSED' });
  });

  it('hands the instructions back on a replay too', () => {
    // A host that retried because its OWN write failed must be able to apply
    // them again. An empty list would strand the work while the engine is
    // convinced it already moved.
    const engine = build();
    raise(engine, 'INV-5');
    const again = raise(engine, 'INV-5');
    expect(again.replayed).toBe(true);
    expect(again.instructions.length).toBeGreaterThan(0);
  });

  it('stamps one line for the runtime event stream, with the clock on it', () => {
    const engine = build();
    const stamp = of(raise(engine, 'INV-6').instructions, 'STAMP_EVENT');
    expect(stamp?.name).toBe('query.raise');
    expect(stamp?.facts).toMatchObject({ clockNowOn: 'resolver', category: 'TERMINAL_INVOICE' });
  });
});

describe('the subject snapshot — held to the queue\'s own declaration', () => {
  it('refuses a snapshot that disagrees with what the queue declares', () => {
    const engine = build();
    expect(() =>
      engine.handle({
        type: 'raise', idempotencyKey: 'bad', at: '2026-07-10T12:40:00.000Z',
        data: {
          reasonCode: 'RATE_MISMATCH', scope: SCOPE,
          // amount was declared as money; text here only surfaces when
          // somebody sorts that column three months and ten thousand rows later.
          subject: snapshot('INV-BAD', { amount: 'forty-two thousand' }),
          question: 'q', fields: { partyCode: 'SUP-11204', rate: 1 },
        },
      }, who('arun')),
    ).toThrow(/does not match what this queue declares/);
  });

  it('lays the values out in the order the host declared, labels and all', () => {
    const engine = build();
    const raised = raise(engine, 'INV-7');
    const drawn = engine.renderSubject(who('nisha'), raised.handover.id);
    expect(drawn.fields.slice(0, 3).map((f) => f.label)).toEqual(['Invoice #', 'Supplier', 'Supplier code']);
    // Derived fields are marked, so nothing downstream stores or sorts on one.
    expect(drawn.fields.find((f) => f.key === 'sameDay')?.derived).toBe(true);
  });

  it('counts the document age from a date that existed before the query did', () => {
    const engine = build();
    const raised = raise(engine, 'INV-8');
    const [fact] = engine.facts(who('nisha'), { handoverId: [raised.handover.id] }, '2026-07-14T00:00:00.000Z');
    // Fourteen days from the invoice date — and no leg of the ledger owns any
    // of it. It is the number on the client's contract.
    expect(fact?.documentAgeDays).toBe(14);
  });
});

describe('one answer, many items', () => {
  const setup = () => {
    const engine = build();
    const lead = raise(engine, 'INV-A', 0).handover;
    const rest = ['INV-B', 'INV-C'].map((ref, n) => raise(engine, ref, n + 1).handover);
    return { engine, lead, rest };
  };

  it('settles the whole batch with one act, and writes a proper entry for each', () => {
    const { engine, lead, rest } = setup();
    const result = engine.handle({
      type: 'answer-many', handoverId: lead.id, expectedVersion: lead.version,
      idempotencyKey: 'bulk:1', at: '2026-07-13T14:05:00.000Z',
      data: {
        body: 'Amendment 5 raised the rate. All three documents are right.',
        fields: { rate: 42.75, decision: 'accept' },
        alsoHandoverIds: rest.map((h) => h.id),
      },
    }, who('nisha'));

    expect(result.alsoSettled).toHaveLength(2);
    for (const settled of [result, ...result.alsoSettled]) {
      expect(settled.handover.holder).toBe('ORIGINATOR');
      expect(settled.handover.answers).toHaveLength(1);
      // Its own event — the record must never look like one thing happened.
      expect(settled.event.handoverId).toBe(settled.handover.id);
    }
    // And each follower says which act settled it, so throughput is never
    // flattered by the leverage a bulk answer gave.
    expect(result.alsoSettled.map((r) => r.handover.settledWith)).toEqual([lead.id, lead.id]);
    expect(result.handover.settledWith).toBeNull();
  });

  it('carries a note meant for one item onto that item only', () => {
    const { engine, lead, rest } = setup();
    const result = engine.handle({
      type: 'answer-many', handoverId: lead.id, expectedVersion: lead.version,
      idempotencyKey: 'bulk:2', at: '2026-07-13T14:05:00.000Z',
      data: {
        body: 'Amendment 5 raised the rate.',
        fields: { rate: 42.75, decision: 'accept' },
        alsoHandoverIds: rest.map((h) => h.id),
        perItemNote: { [rest[1]!.id]: 'This one also carries a storage line — checked, it is correct.' },
      },
    }, who('nisha'));
    const bodies = result.alsoSettled.map((r) => r.handover.answers[0]?.body ?? '');
    expect(bodies[0]).not.toContain('storage line');
    expect(bodies[1]).toContain('storage line');
  });

  it('refuses the whole batch when one item is outside the actor\'s reach', () => {
    // A bulk action is precisely where a permission hole hides best.
    const { engine, lead, rest } = setup();
    const stranger = viewerSchema.parse({
      id: 'usr_omar', name: 'Omar', unit: 'DELTA',
      grants: [{ capabilities: ['read', 'answer'], where: { office: 'DELTA' } }],
    });
    expect(() =>
      engine.handle({
        type: 'answer-many', handoverId: lead.id, expectedVersion: lead.version,
        idempotencyKey: 'bulk:3', at: '2026-07-13T14:05:00.000Z',
        data: { body: 'x', fields: { rate: 1, decision: 'accept' }, alsoHandoverIds: rest.map((h) => h.id) },
      }, stranger),
    ).toThrow();
  });
});

describe('evidence added after the raise', () => {
  it('attaches without moving the clock or the item', () => {
    const engine = build();
    const raised = raise(engine, 'INV-E');
    const before = raised.handover.holder;
    const result = engine.handle({
      type: 'add-evidence', handoverId: raised.handover.id, expectedVersion: raised.handover.version,
      idempotencyKey: 'ev:1', at: '2026-07-11T09:00:00.000Z',
      data: {
        attachments: [{ id: 'f1', name: 'agreement-amendment-5.pdf', kind: 'application/pdf', addedAt: '2026-07-11T09:00:00.000Z' }],
        note: 'The amendment I checked against.',
      },
    }, who('nisha'));
    expect(result.handover.evidence.map((f) => f.name)).toEqual(['agreement-amendment-5.pdf']);
    // Attaching the document you checked is not answering the question — a
    // command that quietly passed the baton would let a resolver stop their
    // own clock by uploading a PDF.
    expect(result.handover.holder).toBe(before);
    expect(result.instructions.some((i) => i.kind === 'MOVE_SUBJECT')).toBe(false);
  });

  it('records who added it and when, whatever the caller claimed', () => {
    const engine = build();
    const raised = raise(engine, 'INV-F');
    const result = engine.handle({
      type: 'add-evidence', handoverId: raised.handover.id, expectedVersion: raised.handover.version,
      idempotencyKey: 'ev:2', at: '2026-07-11T09:00:00.000Z',
      data: { attachments: [{ id: 'f2', name: 'x.pdf', addedBy: 'somebody-else', addedAt: '1999-01-01T00:00:00.000Z' }] },
    }, who('nisha'));
    expect(result.handover.evidence[0]).toMatchObject({
      addedBy: 'usr_nisha', addedAt: '2026-07-11T09:00:00.000Z', origin: 'EVIDENCE',
    });
  });

  it('refuses a file already on the handover rather than doubling it', () => {
    const engine = build();
    const raised = raise(engine, 'INV-G');
    const first = engine.handle({
      type: 'add-evidence', handoverId: raised.handover.id, expectedVersion: raised.handover.version,
      idempotencyKey: 'ev:3', at: '2026-07-11T09:00:00.000Z',
      data: { attachments: [{ id: 'f3', name: 'x.pdf', addedAt: '2026-07-11T09:00:00.000Z' }] },
    }, who('nisha'));
    expect(() =>
      engine.handle({
        type: 'add-evidence', handoverId: raised.handover.id, expectedVersion: first.handover.version,
        idempotencyKey: 'ev:4', at: '2026-07-11T09:05:00.000Z',
        data: { attachments: [{ id: 'f3', name: 'x.pdf', addedAt: '2026-07-11T09:05:00.000Z' }] },
      }, who('nisha')),
    ).toThrow(/already on this handover/);
  });
});
