/**
 * Interrogation harness.
 *
 * Seeds a realistic week of handovers, then puts the questions an exception
 * management process actually gets asked — by the offshore processor who
 * raised them, the onshore desk that owes the answers, the lead who is asked
 * why something is late, and the auditor who arrives a quarter later.
 *
 * Every question either gets a real answer from a real call, or is recorded
 * as one the engine cannot answer. Run: node examples/interrogate.mjs
 */
import { ExceptionEngine, StaticCalendarProvider } from '../packages/core/dist/index.js';

const NOW = '2026-08-24T10:00:00Z'; // Monday 15:30 IST / 05:00 Houston
const HOUSTON = { id: 'onshore-houston', timezone: 'America/Chicago', workdays: [1,2,3,4,5], start: '09:00', end: '18:00', holidays: [] };
const KOLKATA = { id: 'offshore-kolkata', timezone: 'Asia/Kolkata', workdays: [1,2,3,4,5], start: '09:00', end: '18:00', holidays: [] };

const engine = new ExceptionEngine({ calendars: new StaticCalendarProvider([HOUSTON, KOLKATA]) });

const budgets = (respond, act) => ({
  respond: { minutes: respond, calendarId: HOUSTON.id },
  act: { minutes: act, calendarId: KOLKATA.id },
  referralMaxMinutes: 4320, autoAcceptMinutes: 2880,
});

// Desks are configuration: a grant saying "everything under EMEA" can only
// reach a desk that knows its region.
for (const desk of [
  { id: 'onshore.ap.USHOU', label: 'AP Houston', department: 'AP', office: 'USHOU', country: 'US', region: 'AMER' },
  { id: 'onshore.ap.USDAL', label: 'AP Dallas', department: 'AP', office: 'USDAL', country: 'US', region: 'AMER' },
  { id: 'onshore.ap.EMEA', label: 'AP EMEA', department: 'AP', office: 'NLRTM', country: 'NL', region: 'EMEA' },
  { id: 'onshore.ap.DEFRA', label: 'AP Frankfurt', department: 'AP', office: 'DEFRA', country: 'DE', region: 'EMEA' },
  { id: 'onshore.wh.USDAL', label: 'Warehouse Dallas', department: 'WAREHOUSE', office: 'USDAL', country: 'US', region: 'AMER' },
  { id: 'onshore.wh.USHOU', label: 'Warehouse Houston', department: 'WAREHOUSE', office: 'USHOU', country: 'US', region: 'AMER' },
]) engine.putDestination(desk);

engine.putReason({ code: 'WORK_ORDER_MISSING', label: 'Work order not updated', subjectTypes: ['task'],
  answerShape: ['workOrderRef'], applyOnAccept: { workOrderRef: 'fields.workOrderRef' },
  budgets: budgets(240, 480), clusterBy: 'workOrderRef', defaultDestination: 'onshore.ap.USHOU',
  pauseReasons: [{ code: 'AWAITING_SUPPLIER', label: 'Waiting on the supplier', maxMinutes: 4320 }] });
engine.putReason({ code: 'COST_APPROVAL', label: 'Cost approval needed', subjectTypes: ['task'],
  asks: ['amount'], answerShape: ['decision'], budgets: budgets(480, 480), defaultDestination: 'onshore.ap.USHOU',
  variants: [
    { where: { region: 'EMEA' }, note: 'one shift, so twice the window', budgets: budgets(960, 480), defaultDestination: 'onshore.ap.EMEA' },
    { where: { office: 'USHOU' }, note: 'staffed all day', budgets: budgets(240, 480) },
    { where: { country: 'DE' }, note: 'German entities approve in SAP, not here', enabled: false },
  ] });
// A reason that exists in exactly one country.
engine.putReason({ code: 'STEUERNUMMER_MISSING', label: 'Steuernummer missing', subjectTypes: ['task'],
  where: { country: 'DE' }, answerShape: ['steuernummer'], budgets: budgets(240, 480),
  defaultDestination: 'onshore.ap.DEFRA' });
engine.putReason({ code: 'MISSING_GRN', label: 'Goods receipt not posted', subjectTypes: ['task'],
  answerShape: ['grnRef'], budgets: budgets(120, 240), defaultDestination: 'onshore.wh.USDAL',
  asks: ['supplierId', 'office'], deflectOn: ['supplierId', 'office'], deflectWithinMinutes: 43200 });

const OFF = { id: 'usr_priya', name: 'Priya', side: 'ORIGINATOR' };

/** Principals. Grants are additive; a viewer with none reaches nothing. */
const caps = (...c) => [{ capabilities: c, where: {}, note: '' }];
const ADMIN = { id: 'usr_admin', name: 'Admin', unit: 'Operations', system: false,
  grants: caps('read','raise','requery','accept','withdraw','reopen','comment','attach','answer','refer','reassign','reroute','administer') };
const OFFSHORE_V = { id: 'usr_priya', name: 'Priya', unit: 'Offshore AP · Kolkata', system: false,
  grants: caps('read','raise','requery','accept','withdraw','reopen','comment') };
const ONSHORE_V = { id: 'usr_dale', name: 'Dale', unit: 'AP Houston', system: false,
  grants: caps('read','answer','refer','reassign','reroute','comment') };
const SYSTEM_V = { id: 'system', name: 'engine', unit: '', grants: [], system: true };
const viewerFor = (actor) => actor === undefined ? ADMIN
  : actor.side === 'RESOLVER' ? ONSHORE_V : actor.side === 'NONE' ? SYSTEM_V : OFFSHORE_V;
const act = (command) => engine.handle(command, viewerFor(command.actor));
const ON  = { id: 'usr_dale',  name: 'Dale',  side: 'RESOLVER' };
let seq = 0;
const cmd = (o) => act({ idempotencyKey: `seed-${(seq += 1)}`, ...o });
const raise = (task, reasonCode, at, extra = {}) => cmd({
  type: 'raise', at, actor: OFF,
  data: { reasonCode, subject: { type: 'task', id: task, path: 'fields.workOrderRef' },
          question: `${reasonCode} on ${task}`, ...extra },
}).handover;
const on = (id, type, at, data = {}) => cmd({ type, handoverId: id, at, actor: ON, data });
const off = (id, type, at, data = {}) => cmd({ type, handoverId: id, at, actor: OFF, data });

// ── a week of work ──────────────────────────────────────────────────────────
// Four invoices blocked on one work order: the cluster.
const cluster = ['task-201','task-202','task-203','task-204'].map((task) =>
  raise(task, 'WORK_ORDER_MISSING', '2026-08-20T06:00:00Z', { clusterKey: 'WO-88213' }));

// Answered, accepted, applied — the clean one.
const clean = raise('task-210', 'MISSING_GRN', '2026-08-20T14:30:00Z',
  { fields: { supplierId: 'SUP-114', office: 'USHOU' } });
on(clean.id, 'answer', '2026-08-20T15:30:00Z', { body: 'GRN 5512.', fields: { grnRef: 'GRN-5512' } });
off(clean.id, 'accept', '2026-08-21T04:00:00Z');

// Two round-trips, still open with onshore: the badly-asked one.
const pingpong = raise('task-220', 'COST_APPROVAL', '2026-08-19T05:00:00Z',
  { fields: { amount: '18400 USD' }, scope: { country: 'US', office: 'USHOU', queue: 'AP' } });
on(pingpong.id, 'answer', '2026-08-19T15:00:00Z', { body: 'Need the cost centre.', fields: { decision: 'revised' } });
off(pingpong.id, 'requery', '2026-08-20T05:30:00Z');
on(pingpong.id, 'answer', '2026-08-20T16:00:00Z', { body: 'Still unclear.', fields: { decision: 'revised' } });
off(pingpong.id, 'requery', '2026-08-21T05:00:00Z');

// Rerouted once — the routing table got it wrong.
const misrouted = raise('task-230', 'MISSING_GRN', '2026-08-21T06:00:00Z',
  { fields: { supplierId: 'SUP-902', office: 'USDAL' } });
on(misrouted.id, 'reroute', '2026-08-21T14:30:00Z', { destination: 'onshore.wh.USHOU' });

// Referred to the supplier, still paused.
const referred = raise('task-240', 'WORK_ORDER_MISSING', '2026-08-20T07:00:00Z');
on(referred.id, 'refer', '2026-08-20T15:00:00Z', { pauseReason: 'AWAITING_SUPPLIER', waitingOn: 'SUP-114' });

// Answered on Friday, still sitting with offshore — the invisible leg.
const sitting = raise('task-250', 'COST_APPROVAL', '2026-08-20T06:30:00Z', { fields: { amount: '900 USD' } });
on(sitting.id, 'answer', '2026-08-21T14:00:00Z', { body: 'Approved.', fields: { decision: 'approved' } });

// Raised then withdrawn — the answer was on the PO all along.
const withdrawn = raise('task-260', 'MISSING_GRN', '2026-08-21T06:15:00Z',
  { fields: { supplierId: 'SUP-777', office: 'USHOU' } });
off(withdrawn.id, 'withdraw', '2026-08-21T07:00:00Z', {});

const ALL = [...cluster, clean, pingpong, misrouted, referred, sitting, withdrawn];

// ── the interrogation ───────────────────────────────────────────────────────
const results = [];
const ask = (who, question, attempt) => {
  let verdict, answer;
  try {
    const out = attempt();
    if (out === undefined || out === null) { verdict = 'NO'; answer = 'the engine exposes no call for this'; }
    else { verdict = out.partial ? 'PARTIAL' : 'YES'; answer = out.text; }
  } catch (error) { verdict = 'NO'; answer = error.message; }
  results.push({ who, question, verdict, answer });
};

const H = (h) => engine.get(ADMIN, h.id);

const pct = (n, d) => (d === 0 ? 'n/a' : `${Math.round((n / d) * 100)}%`);

// —— the offshore processor who raised them
ask('offshore', 'What am I waiting on, and who has it?', () => ({
  text: engine.list(ADMIN, { createdBy: OFF.id, status: ['OPEN'], holder: ['RESOLVER','EXTERNAL','PAUSED'], order: 'due' }, NOW)
    .map((v) => `${v.handover.subject.id} ${v.handover.reasonCode} → ${v.handover.holder === 'EXTERNAL' ? 'supplier' : v.handover.destination}`)
    .join('; '),
}));
ask('offshore', 'Which of my queries are overdue on the other side?', () => {
  const late = engine.list(ADMIN, { createdBy: OFF.id, status: ['OPEN'], holder: ['RESOLVER'], dueBefore: NOW, order: 'due' }, NOW);
  return { text: late.map((v) => `${v.handover.subject.id} ${Math.round((v.budgetUsed ?? 0) * 100)}% of budget`).join('; ') || 'none' };
});
ask('offshore', 'Has this exact question already been answered?', () => {
  // Asked with what the raiser already knows, before any handover exists.
  const hit  = engine.deflectionCandidate(ADMIN, 'MISSING_GRN', { supplierId: 'SUP-114', office: 'USHOU' }, NOW);
  const miss = engine.deflectionCandidate(ADMIN, 'MISSING_GRN', { supplierId: 'SUP-000', office: 'USHOU' }, NOW);
  if (hit === null) return { partial: true, text: 'no candidate for a supplier/office that WAS settled — the index is not finding it' };
  if (miss !== null) return { partial: true, text: 'a candidate for a supplier never asked about — false positive' };
  return { text: `SUP-114/USHOU → "${hit.body}" (${hit.answeredBy}, accepted ${hit.acceptedAt?.slice(0,10)}); SUP-000/USHOU → nothing, correctly` };
});
ask('offshore', 'What is waiting for me to accept?', () => ({
  text: engine.list(ADMIN, { createdBy: OFF.id, status: ['OPEN'], holder: ['ORIGINATOR'], order: 'due' }, NOW)
    .map((v) => `${v.handover.subject.id} answered ${v.handover.answers.at(-1)?.answeredAt.slice(5,10)}, ${v.totals.originator}m on my clock`)
    .join('; '),
}));

// —— the onshore desk that owes the answers
ask('onshore', 'What is on my desk, soonest deadline first?', () => ({
  text: engine.desk(ADMIN, 'onshore.ap.USHOU', NOW)
    .map((r) => `${r.handover.subject.id}${r.clusterSize > 1 ? ` (+${r.clusterSize - 1} same question)` : ''} due ${r.handover.dueAt?.slice(5,16) ?? '—'}${r.overdue ? ' OVERDUE' : ''}`)
    .join(' | '),
}));
ask('onshore', 'Which of these are really one question?', () => ({
  text: `cluster WO-88213 → ${engine.inCluster(ADMIN, 'WO-88213').length} handovers, one answer settles all`,
}));
ask('onshore', 'What have I already breached?', () => {
  const breached = engine.facts(ADMIN, { destination: ['onshore.ap.USHOU','onshore.wh.USDAL','onshore.wh.USHOU'] }, NOW)
    .filter((f) => f.respondBreaches > 0);
  return { text: breached.map((f) => `${f.subjectId} ${f.reasonCode}: ${f.respondBreaches} round(s) over the ${f.respondBudgetMinutes}m budget`).join('; ') || 'none' };
});

// —— the lead asked why something is late
ask('lead', 'Every query on transaction task-220', () => ({
  text: engine.onSubject(ADMIN, 'task', 'task-220').map((h) => `${h.reasonCode} round ${h.round} holder ${h.holder}`).join('; '),
}));
ask('lead', 'Who owed the time on task-220 — us or them?', () => {
  const t = engine.totals(ADMIN, pingpong.id, NOW);
  return { text: `onshore ${t.resolver}m · offshore ${t.originator}m · paused ${t.paused}m of ${engine.elapsedMinutes(ADMIN, pingpong.id, NOW)}m elapsed` };
});
ask('lead', 'How much of the current holder’s budget is gone?', () => ({
  text: `task-220 is at ${Math.round((engine.budgetUsed(ADMIN, pingpong.id, NOW) ?? 0) * 100)}% of the onshore budget`,
}));
ask('lead', 'Our response compliance this month', () => {
  const f = engine.facts(ADMIN, { raisedAfter: '2026-08-01T00:00:00Z' }, NOW);
  const budgeted = f.filter((r) => r.respondBudgetMinutes !== null);
  return { text: `${pct(budgeted.filter((r) => r.respondBreaches === 0).length, budgeted.length)} of ${budgeted.length} handovers answered inside the respond budget every round` };
});
ask('lead', 'Which reason burns the most round-trips?', () => {
  const byReason = {};
  for (const f of engine.facts(ADMIN, {}, NOW)) (byReason[f.reasonCode] ??= []).push(f.rounds);
  return { text: Object.entries(byReason)
    .map(([code, rounds]) => [code, rounds.reduce((a, b) => a + b, 0) / rounds.length])
    .sort((a, b) => b[1] - a[1])
    .map(([code, avg]) => `${code} ${avg.toFixed(2)}`).join(' · ') };
});
ask('lead', 'How much of our ageing is paused, and on whom?', () => {
  const f = engine.facts(ADMIN, {}, NOW);
  const paused = f.reduce((a, r) => a + r.pausedMinutes, 0);
  const age = f.reduce((a, r) => a + r.elapsedMinutes, 0);
  // Pause detail is its own registry entity now — one row per pause, because
  // one handover can wait on three different things.
  const byReason = {};
  for (const pause of engine.pauseFacts(ADMIN, {}, NOW)) {
    byReason[pause.pauseReason] = (byReason[pause.pauseReason] ?? 0) + pause.minutes;
  }
  const split = Object.entries(byReason).map(([why, mins]) => `${why} ${mins}m`).join(', ');
  if (split === '' && paused > 0) return { partial: true, text: `${paused}m paused but the engine cannot say on whom` };
  return { text: `${pct(paused, age)} of ageing is paused (${paused}m of ${age}m) — ${split}` };
});
ask('lead', 'How often is the routing table wrong?', () => {
  const f = engine.facts(ADMIN, {}, NOW);
  return { text: `${pct(f.filter((r) => r.rerouted > 0).length, f.length)} of handovers had their destination corrected by hand` };
});
ask('lead', 'How often do we raise and then withdraw?', () => {
  const f = engine.facts(ADMIN, {}, NOW);
  return { text: `${pct(f.filter((r) => r.withdrawn).length, f.length)} withdrawn — raised before looking` };
});

// —— the administrator who maintains the lists
ask('admin', 'What is the exception list for Houston?', () => ({
  text: engine.catalogue({ country: 'US', office: 'USHOU', queue: 'AP' }, 'task')
    .map((r) => `${r.code} (respond ${r.budgets.respond?.minutes}m → ${r.defaultDestination})`).join('; '),
}));
ask('admin', 'And for Germany?', () => ({
  text: engine.catalogue({ country: 'DE', region: 'EMEA', queue: 'AP' }, 'task')
    .map((r) => `${r.code} (respond ${r.budgets.respond?.minutes}m → ${r.defaultDestination})`).join('; ')
    + ' — COST_APPROVAL withdrawn here, STEUERNUMMER_MISSING exists nowhere else',
}));
ask('admin', 'Why is Rotterdam’s window longer than Houston’s?', () => {
  const rot = engine.reasonFor('COST_APPROVAL', { region: 'EMEA', office: 'NLRTM', queue: 'AP' });
  const hou = engine.reasonFor('COST_APPROVAL', { region: 'AMER', office: 'USHOU', queue: 'AP' });
  return { text: `Rotterdam ${rot.budgets.respond.minutes}m via [${rot.resolvedFrom.join(' → ')}]; Houston ${hou.budgets.respond.minutes}m via [${hou.resolvedFrom.join(' → ')}]` };
});
ask('admin', 'If the global cost-approval window changes, how many edits?', () => {
  // Two offices carry their own variant, two inherit the base.
  const desks = [
    { office: 'USHOU', region: 'AMER' },  // own office variant
    { office: 'NLRTM', region: 'EMEA' },  // EMEA variant
    { office: 'SGSIN', region: 'APAC' },  // no variant — follows the base
    { office: 'USDAL', region: 'AMER' },  // no variant — follows the base
  ];
  const read = () => desks.map((d) => `${d.office} ${engine.reasonFor('COST_APPROVAL', { ...d, queue: 'AP' })?.budgets.respond.minutes}m`);
  const before = read();
  const stored = engine.getReason('COST_APPROVAL');
  engine.putReason({ ...stored, budgets: budgets(600, 480) }); // ONE edit, one document
  const after = read();
  engine.putReason(stored); // restore, so the rest of the run is unaffected
  return { text: `one edit to one document — base 480→600m\n           before: ${before.join(' · ')}\n           after:  ${after.join(' · ')}` };
});

// —— the auditor, a quarter later
ask('auditor', 'Show me every move on task-220 and who made it', () => ({
  text: engine.events(ADMIN, pingpong.id).map((e) => `${e.type.replace('handover.', '').replace('.v1', '')}/${e.actor.id}`).join(' → '),
}));
ask('auditor', 'Which reason version, and resolved how, governed this case?', () => {
  const stamps = new Set(engine.events(ADMIN, pingpong.id).map((e) =>
    `${e.policy.reason}@v${e.policy.reasonVersion} resolved [${e.policy.resolvedFrom.join(' → ')}] for ${JSON.stringify(e.policy.scope)}`));
  return { text: [...stamps].join(' | ') };
});
ask('auditor', 'Which calendar was each segment measured in?', () => ({
  text: H(pingpong).segments.map((s) => `${s.side}:${s.calendarId}`).join(' '),
}));

// ── scoreboard ──────────────────────────────────────────────────────────────
const mark = { YES: ' OK  ', PARTIAL: 'PART ', NO: 'MISS ' };
let who = '';
for (const r of results) {
  if (r.who !== who) { who = r.who; console.log(`\n── ${who.toUpperCase()} ${'─'.repeat(66 - who.length)}`); }
  console.log(`[${mark[r.verdict]}] ${r.question}`);
  console.log(`         ${r.answer}`);
}
const tally = results.reduce((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] ?? 0) + 1 }), {});
console.log(`\n${'═'.repeat(72)}`);
console.log(`answered ${tally.YES ?? 0} · partial ${tally.PARTIAL ?? 0} · unanswerable ${tally.NO ?? 0}   (of ${results.length})`);
console.log(`seeded: ${ALL.length} handovers across ${new Set(ALL.map((h) => h.subject.id)).size} transactions`);
