/**
 * Drive the whole engine against the invented client, and print what happens.
 *
 *   node examples/demo-world.mjs
 *
 * Nothing is mocked. This builds a real engine, loads the demo catalogue,
 * raises real queries with real people, and shows the cascade, the routing,
 * the two clocks, the bulk answer and the instructions the host would apply.
 */
import {
  ExceptionEngine, InMemoryHandoverStore,
  DEMO_ORG, DEMO_DESKS, DEMO_CATEGORIES, DEMO_REASONS, DEMO_SUBJECT_SCHEMA,
  DEMO_PEOPLE, DEMO_INVOICES, DEMO_CALENDARS,
  viewerSchema, describeInstructions, categoryLabel,
} from '../packages/core/dist/index.js';

const line = (s = '') => console.log(s);
const rule = (t) => { line(); line(`\x1b[1m${t}\x1b[0m`); line('─'.repeat(t.length)); };
const who = (k) => viewerSchema.parse(DEMO_PEOPLE[k]);

// ---------------------------------------------------------------- build it
const engine = new ExceptionEngine({
  store: new InMemoryHandoverStore(),
  calendars: {
    get: (id) => DEMO_CALENDARS.find((c) => c.id === id) ?? null,
    list: () => DEMO_CALENDARS,
  },
});
const admin = who('admin');
for (const desk of DEMO_DESKS) engine.putDestination(desk, admin);
engine.applyConfig({ categories: DEMO_CATEGORIES, reasons: DEMO_REASONS });
engine.putSubjectSchema(DEMO_SUBJECT_SCHEMA, admin);

rule(`${DEMO_ORG.name} — ${DEMO_ORG.offices.length} offices, ${DEMO_ORG.workTypes.length} work types`);
line(`${DEMO_DESKS.length} departments · ${DEMO_CATEGORIES.length} categories · ${DEMO_REASONS.length} reasons`);

// ------------------------------------------------- 1. the cascade, per office
rule('1. The raise dialog is not one list — it depends on where the work is');
for (const office of ['ALPHA', 'ECHO']) {
  const scope = { office, country: office === 'ALPHA' ? 'Nordia' : 'Sorland', region: 'WEST',
                  queue: 'ap', subQueue: 'index', workType: 'REPAIR' };
  const cascade = engine.cascade(admin, scope, 'task');
  line(`\n  ${office} (workType REPAIR) — ${cascade.rows} reason${cascade.rows === 1 ? '' : 's'} reachable`);
  for (const option of cascade.steps[0].options) line(`     ▸ ${option.label}  (${option.hint})`);
}
line('\n  Note ECHO offers "Repair Agreement Issues : ECHO" INSTEAD of the plain family —');
line('  a scope qualifier is a condition, so it replaces rather than sits beside.');

// --------------------------------------------- 2. raise, and where it goes
rule('2. Raising one — the department is shown, never asked');
const arun = who('arun');
const invoice = DEMO_INVOICES[0];
const raiseScope = { office: 'ALPHA', country: 'Nordia', region: 'WEST',
                     department: 'Offshore AP', queue: 'ap', subQueue: 'index', workType: 'TERM' };
const snapshotOf = (inv) => ({
  type: 'task', id: inv.reference, path: 'rate', display: inv.reference,
  values: { reference: inv.reference, partyName: inv.partyName, partyCode: inv.partyCode,
            documentType: inv.documentType, documentSubType: inv.documentSubType,
            amount: inv.amount, currency: inv.currency, documentDate: inv.documentDate,
            receivedDate: inv.receivedDate, senderEmail: inv.senderEmail,
            intakeStatus: inv.intakeStatus, brTaxKey: inv.brTaxKey },
  attachments: [{ id: `f_${inv.reference}`, name: `${inv.reference}.pdf`, kind: 'application/pdf',
                  addedBy: 'intake', addedAt: '2026-07-06T04:00:00.000Z', origin: 'SUBJECT' }],
  ageAnchor: `${inv.documentDate}T00:00:00.000Z`,
});
const raised = engine.handle({
  type: 'raise', idempotencyKey: `raise:${invoice.reference}`, at: '2026-07-10T12:40:00.000Z',
  data: { reasonCode: 'RATE_MISMATCH', scope: raiseScope, subject: snapshotOf(invoice),
          question: 'Agreement says 36.20, the document charges 42.75. Which stands?',
          fields: { partyCode: invoice.partyCode, rate: 42.75 } },
}, arun);
const h = raised.handover;
line(`  ${invoice.reference} · ${invoice.partyName}`);
line(`  reason      ${h.reasonCode}   category ${h.categoryKey}`);
line(`  department  ${h.destination}   (decided by: ${h.routedBy} — ${h.routedBecause})`);
line(`  clock now on ${h.holder}, due ${h.dueAt}`);
line(`\n  The host is handed ${raised.instructions.length} instructions:`);
for (const i of raised.instructions) line(`     · ${describeInstructions([i])}`);

rule('3. The work MOVED — that is the whole point');
const move = raised.instructions.find((i) => i.kind === 'MOVE_SUBJECT');
line(`  ${move.subjectId}:  Offshore AP  →  ${move.toDepartment}`);
line(`  task state → ${move.toState}${move.blocking ? '  (blocking: the item stops)' : '  (non-blocking)'}`);
line(`  because: ${move.because}`);
line('\n  The engine wrote none of that. It said what should happen; the runtime,');
line('  which owns `tasks`, does it. One writer per table.');

// ----------------------------------------------- 4. what the resolver sees
rule('4. What the resolver opens');
const nisha = who('nisha');
const drawn = engine.renderSubject(nisha, h.id);
line(`  document age: ${drawn.documentAgeDays} days   (started before the query existed)`);
for (const f of drawn.fields.filter((f) => f.value !== null && f.value !== undefined)) {
  line(`     ${f.label.padEnd(16)} ${String(f.value)}${f.derived ? '   (derived)' : ''}`);
}
line(`  files: ${drawn.attachments.map((a) => a.name).join(', ')}`);

// ------------------------------------------------- 5. bulk: one answer, many
rule('5. One answer, many items — the same problem on three invoices');
const more = DEMO_INVOICES.slice(1, 3).map((inv, n) =>
  engine.handle({
    type: 'raise', idempotencyKey: `raise:${inv.reference}`,
    at: `2026-07-10T12:4${n + 1}:00.000Z`,
    data: { reasonCode: 'RATE_MISMATCH', scope: raiseScope, subject: snapshotOf(inv),
            question: 'Same rate disagreement as the others.',
            fields: { partyCode: inv.partyCode, rate: 42.75 } },
  }, arun).handover);
line(`  raised: ${[h, ...more].map((x) => x.subject.id).join(', ')}`);
line(`  all three: supplier ${invoice.partyCode}, office ALPHA, type TERM — known BEFORE any answer`);

const bulk = engine.handle({
  type: 'answer-many', handoverId: h.id, expectedVersion: h.version,
  idempotencyKey: 'bulk:rate-2026-07', at: '2026-07-13T14:05:00.000Z',
  data: {
    body: 'Amendment 5 raised the rate to 42.75 with effect from 01 Jun. The document is right.',
    fields: { rate: 42.75, decision: 'accept' },
    alsoHandoverIds: more.map((x) => x.id),
    perItemNote: { [more[1].id]: 'This one also has a storage line — checked separately, it is correct.' },
  },
}, nisha);
line(`\n  one act by ${nisha.name} → ${1 + bulk.alsoSettled.length} items settled`);
line(`  each got its own event, its own ledger entry, its own permission check`);
for (const r of [bulk, ...bulk.alsoSettled]) {
  line(`     ${r.handover.subject.id}  clock → ${r.handover.holder}  settledWith=${r.handover.settledWith ?? '— (the lead)'}`);
}

// ------------------------------------------------------------ 6. the clocks
rule('6. The clocks — every minute has exactly one owner');
const [fact] = engine.facts(nisha, { handoverId: [h.id] }, '2026-07-14T09:00:00.000Z');
const show = (k, v, note = '') => line(`     ${k.padEnd(22)} ${String(v).padEnd(10)} ${note}`);
show('resolver minutes', fact.resolverMinutes, 'onshore working hours only');
show('raiser minutes', fact.originatorMinutes, 'offshore working hours only');
show('paused minutes', fact.pausedMinutes, "nobody's");
show('elapsed', fact.elapsedMinutes, 'wall clock, start to finish');
show('document age', `${fact.documentAgeDays}d`, 'started before the query existed');
show('work type', fact.workType, 'sliceable in every metric');
show('category', fact.category);
show('rounds', fact.rounds);
const legs = fact.resolverMinutes + fact.originatorMinutes + fact.pausedMinutes;
line(`\n     ${fact.resolverMinutes} + ${fact.originatorMinutes} + ${fact.pausedMinutes} = ${legs} working minutes, against ${fact.elapsedMinutes} on the wall.`);
line('     Not a discrepancy — the whole point. The legs are counted in each side\'s OWN');
line('     working hours; the wall clock counts nights and weekends nobody was there for.');
line('     Kolkata 09:00-18:00 and Chicago 08:00-17:00 share no hour at all, so a query');
line('     raised at 16:40 offshore burns nothing onshore until Chicago opens next day.');
line('     Report the legs and somebody can act; report the wall clock and they argue.');

// --------------------------------------------------------- 7. who sees what
rule('7. Reach — one store, and everybody gets a different answer');
const stranger = viewerSchema.parse({
  id: 'usr_omar', name: 'Omar Diallo', unit: 'Offshore AP · DELTA',
  grants: [{ capabilities: ['read', 'raise', 'comment', 'accept'], where: { office: 'DELTA' } }],
});
const total = engine.count(who('admin'), {});
for (const v of [who('arun'), who('daniel'), who('nisha'), who('meera'), stranger]) {
  const n = engine.count(v, {});
  line(`  ${v.name.padEnd(14)} ${String(n).padStart(2)} of ${total}   ${v.unit}`);
}
line('\n  Omar is a processor at another office. Nothing is hidden from him by a rule —');
line('  no grant of his reaches this work, so it does not exist for him. Additive only,');
line('  never a list of exclusions, which is why nobody ever has to maintain one.');

// ------------------------------------------------------- 8. close the loop
rule('8. Offshore closes it — and only offshore can');
const closed = engine.handle({
  type: 'accept', handoverId: h.id, expectedVersion: bulk.handover.version,
  idempotencyKey: 'accept:1', at: '2026-07-14T06:30:00.000Z',
  data: {},
}, arun);
line(`  status ${closed.handover.status}, applied to the item: ${JSON.stringify(closed.handover.appliedOnAccept)}`);
for (const i of closed.instructions) line(`     · ${describeInstructions([i])}`);
try {
  engine.handle({ type: 'accept', handoverId: more[0].id, expectedVersion: 99,
    idempotencyKey: 'nope', at: '2026-07-14T06:31:00.000Z', data: {} }, nisha);
} catch (e) {
  line(`\n  Nisha tries to close one herself → refused: ${e.message}`);
}
line();
