import type { CategoryDefinitionInput, DestinationInput, ReasonDefinitionInput, ViewerInput } from './schemas.js';
import type { SubjectSchema } from './snapshot.js';
import type { BusinessCalendar } from './calendar.js';

/**
 * A COMPLETE MADE-UP CLIENT, so the engine can be seen working before anybody
 * wires it to a real one.
 *
 * Everything here is invented: NORTHWIND LINES does not exist, nor do its
 * offices, its suppliers, its staff or its invoices. What is NOT invented is
 * the shape — a shared-services floor where offshore processors handle
 * invoices for a carrier and onshore departments answer what they cannot
 * settle. Fixtures that are too abstract to argue with ("office A, reason 1")
 * teach nobody anything and hide every interesting bug, so this one is
 * specific enough to disagree with.
 *
 * Four offices, five kinds of work, seven departments, four categories and
 * fourteen reasons — small enough to hold in your head, big enough that the
 * scoping rules actually bite: one reason routes elsewhere at one office, one
 * category exists only at one site, one reason is switched off in one country.
 */

export const DEMO_ORG = {
  name: 'Northwind Lines',
  region: 'WEST',
  country: 'Nordia',
  offices: [
    { key: 'ALPHA', name: 'Alpha City', country: 'Nordia', region: 'WEST' },
    { key: 'BRAVO', name: 'Bravo Port', country: 'Nordia', region: 'WEST' },
    { key: 'DELTA', name: 'Delta Bay', country: 'Sorland', region: 'WEST' },
    { key: 'ECHO', name: 'Echo Harbour', country: 'Sorland', region: 'WEST' },
  ],
  /** The queue's own work types — what KIND of thing each item is. */
  workTypes: [
    { key: 'TERM', name: 'Terminal handling' },
    { key: 'TRANS', name: 'Inland transport' },
    { key: 'DEPOT', name: 'Depot storage' },
    { key: 'REPAIR', name: 'Unit repair' },
    { key: 'AGENCY', name: 'Agency fees' },
  ],
} as const;

/**
 * The departments that answer. A sub-department is a department with a parent
 * — one list, not two, because "Procurement : Terminal" is a narrower place to
 * send something, not a different kind of thing.
 */
export const DEMO_DESKS: readonly DestinationInput[] = [
  { id: 'onshore.finance', label: 'Onshore Finance', department: 'Onshore Finance', region: 'WEST' },
  { id: 'onshore.tax', label: 'Onshore Finance · Tax', department: 'Onshore Finance', subDepartment: 'Tax', region: 'WEST' },
  { id: 'procurement', label: 'Procurement', department: 'Procurement', region: 'WEST' },
  { id: 'procurement.terminal', label: 'Procurement · Terminal', department: 'Procurement', subDepartment: 'Terminal', region: 'WEST' },
  { id: 'repair.desk', label: 'Repair Desk', department: 'Repair Desk', region: 'WEST' },
  { id: 'road.ops', label: 'Road Ops', department: 'Road Ops', region: 'WEST' },
  { id: 'agency.ops', label: 'Agency Ops', department: 'Agency Ops', country: 'Sorland', region: 'WEST' },
  // Where offshore work sits, so a returned item has a place to come back to.
  { id: 'offshore.ap', label: 'Offshore AP', department: 'Offshore AP', side: 'ORIGINATOR', region: 'WEST' },
];

/**
 * The categories. Note the two different colons:
 *
 *   FINANCE_TAX      is Finance : Tax        — a SUB_FAMILY. It groups.
 *   REPAIR_AGR_ECHO  is Repair Agreement Issues : ECHO — a SCOPE. It is a
 *                    CONDITION, offered INSTEAD of the plain family at that
 *                    one office, never beside it.
 */
export const DEMO_CATEGORIES: readonly CategoryDefinitionInput[] = [
  { key: 'FINANCE_COSTING', family: 'Finance', qualifier: 'Costing', qualifierKind: 'SUB_FAMILY', sequence: 1 },
  { key: 'FINANCE_TAX', family: 'Finance', qualifier: 'Tax', qualifierKind: 'SUB_FAMILY', sequence: 2 },
  { key: 'REPAIR_AGREEMENT', family: 'Repair Agreement Issues', qualifierKind: 'SUB_FAMILY', sequence: 1 },
  {
    key: 'REPAIR_AGREEMENT_ECHO',
    family: 'Repair Agreement Issues',
    qualifier: 'ECHO',
    qualifierKind: 'SCOPE',
    // It IS Repair Agreement Issues, at one site. It carries every reason the
    // plain form carries, plus one of its own — and exists so ECHO can route
    // and time differently without a second copy of the catalogue.
    variantOf: 'REPAIR_AGREEMENT',
    where: { office: 'ECHO' },
    sequence: 1,
  },
  { key: 'UNIT_CONDITION', family: 'Unit Condition Issues', qualifierKind: 'SUB_FAMILY', sequence: 1 },
  { key: 'TERMINAL_INVOICE', family: 'Terminal Invoice Issues', qualifierKind: 'SUB_FAMILY', sequence: 1 },
];

const HOURS = (respond: number, act: number) => ({
  respond: { minutes: respond, calendarId: 'onshore' },
  act: { minutes: act, calendarId: 'offshore' },
  referralMaxMinutes: 7_200,
  autoAcceptMinutes: 4_320,
});

/**
 * The reasons. Each one names its category, what it must be told, what a valid
 * answer carries, and where it lands. The interesting ones are at the bottom.
 */
export const DEMO_REASONS: readonly ReasonDefinitionInput[] = [
  {
    code: 'CHARGE_CODE_QUERY', categoryKey: 'FINANCE_COSTING', label: 'Charge code query',
    subjectTypes: ['task'], asks: ['chargeCode', 'partyCode'], answerShape: ['chargeCode'],
    applyOnAccept: { chargeCode: 'chargeCode' },
    deflectOn: ['partyCode', 'chargeCode'], budgets: HOURS(240, 480),
    defaultDestination: 'onshore.finance',
  },
  {
    code: 'COST_CENTRE_MISSING', categoryKey: 'FINANCE_COSTING', label: 'Cost centre not on the document',
    subjectTypes: ['task'], asks: ['partyCode'], answerShape: ['costCentre'],
    applyOnAccept: { costCentre: 'costCentre' },
    deflectOn: ['partyCode'], budgets: HOURS(240, 480), defaultDestination: 'onshore.finance',
  },
  {
    code: 'TAX_CODE_QUERY', categoryKey: 'FINANCE_TAX', label: 'Tax code query',
    subjectTypes: ['task'], asks: ['partyCode', 'taxRate'], answerShape: ['taxCode'],
    applyOnAccept: { taxCode: 'taxCode' },
    deflectOn: ['partyCode', 'taxRate'], budgets: HOURS(480, 480), defaultDestination: 'onshore.tax',
  },
  {
    code: 'TAX_UNDER_COST', categoryKey: 'FINANCE_TAX', label: 'Tax to be booked under cost',
    subjectTypes: ['task'], asks: ['partyCode'], answerShape: ['decision'],
    budgets: HOURS(480, 480), defaultDestination: 'onshore.tax',
  },
  {
    code: 'NO_AGREEMENT', categoryKey: 'REPAIR_AGREEMENT', label: 'No agreement set up',
    subjectTypes: ['task'], asks: ['partyCode'], answerShape: ['agreementRef'],
    deflectOn: ['partyCode'], budgets: HOURS(480, 960), defaultDestination: 'procurement',
  },
  {
    code: 'RATE_NOT_IN_SOURCE', categoryKey: 'REPAIR_AGREEMENT', label: 'Rate is not in the source system',
    subjectTypes: ['task'], asks: ['partyCode', 'rate'], answerShape: ['rate', 'agreementRef'],
    applyOnAccept: { rate: 'rate' },
    // Keyed on what the RAISER knows. Keying it on the answer would mean
    // needing the answer in order to find the answer.
    deflectOn: ['partyCode', 'rate'], budgets: HOURS(480, 960), defaultDestination: 'procurement',
    variants: [
      // The same reason lands somewhere else at one office. ONE row — not a
      // second copy of the catalogue for that site.
      { where: { office: 'ECHO' }, note: 'Echo runs its own repair procurement', defaultDestination: 'repair.desk' },
    ],
  },
  {
    code: 'AGREEMENT_EXPIRED', categoryKey: 'REPAIR_AGREEMENT', label: 'Agreement has expired',
    subjectTypes: ['task'], asks: ['partyCode', 'agreementRef'], answerShape: ['agreementRef', 'validTo'],
    deflectOn: ['partyCode'], budgets: HOURS(480, 960), defaultDestination: 'procurement',
  },
  {
    code: 'UNIT_PRICE_DIFF', categoryKey: 'REPAIR_AGREEMENT_ECHO', label: 'Unit price differs from the agreement',
    subjectTypes: ['task'], asks: ['partyCode', 'rate'], answerShape: ['rate'],
    applyOnAccept: { rate: 'rate' },
    deflectOn: ['partyCode', 'rate'], budgets: HOURS(240, 480), defaultDestination: 'repair.desk',
  },
  {
    code: 'UNIT_NOT_FOUND', categoryKey: 'UNIT_CONDITION', label: 'Unit number does not exist',
    subjectTypes: ['task'], asks: ['unitNumber'], answerShape: ['unitNumber'],
    applyOnAccept: { unitNumber: 'unitNumber' },
    deflectOn: ['unitNumber'], budgets: HOURS(240, 480), defaultDestination: 'repair.desk',
  },
  {
    code: 'REPAIR_DATE_ODD', categoryKey: 'UNIT_CONDITION', label: 'Repair date is missing or does not fit',
    subjectTypes: ['task'], asks: ['unitNumber'], answerShape: ['repairedOn'],
    budgets: HOURS(240, 480), defaultDestination: 'repair.desk',
  },
  {
    code: 'UPLOAD_TEMPLATE', categoryKey: 'UNIT_CONDITION', label: 'Send the upload template',
    subjectTypes: ['task'], answerShape: ['decision'],
    // Ten a day is a team helping each other. Two hundred is one broken
    // upstream job wearing two hundred hats.
    rateLimit: { maxPerWindow: 25, windowMinutes: 1_440, action: 'WARN' },
    budgets: HOURS(120, 480), defaultDestination: 'repair.desk',
  },
  {
    code: 'RATE_MISMATCH', categoryKey: 'TERMINAL_INVOICE', label: 'Rate differs between agreement and document',
    subjectTypes: ['task'], asks: ['partyCode', 'rate'], answerShape: ['rate', 'decision'],
    applyOnAccept: { rate: 'rate' },
    deflectOn: ['partyCode', 'rate'], budgets: HOURS(240, 480),
    defaultDestination: 'procurement.terminal',
  },
  {
    code: 'DOUBLE_BILLED', categoryKey: 'TERMINAL_INVOICE', label: 'The same line has been billed twice',
    subjectTypes: ['task'], asks: ['partyCode'], answerShape: ['decision'],
    budgets: HOURS(240, 480), defaultDestination: 'procurement.terminal',
  },
  {
    code: 'PERIOD_CONFIRM', categoryKey: 'TERMINAL_INVOICE', label: 'Confirm the period being charged',
    subjectTypes: ['task'], asks: ['partyCode'], answerShape: ['periodFrom', 'periodTo'],
    budgets: HOURS(240, 480), defaultDestination: 'procurement.terminal',
    variants: [
      // Switched off in one country, changed nowhere else. This is what one
      // definition with variants buys over forty maintained copies.
      { where: { country: 'Sorland' }, note: 'Sorland confirms periods in the terminal system', enabled: false },
    ],
  },
];

/**
 * What an invoice-processing queue says its items carry.
 *
 * The engine never reads a single one of these keys. It holds the declaration
 * so it can refuse a snapshot that disagrees with it and lay one out in the
 * order somebody chose — and for nothing else. Move to a booking queue and
 * this becomes vessel, ports and cargo type, with no engine change at all.
 */
export const DEMO_SUBJECT_SCHEMA: SubjectSchema = {
  subjectType: 'task',
  title: 'Invoice',
  ageAnchorKey: 'documentDate',
  fields: [
    { key: 'reference', label: 'Invoice #', kind: 'code', onList: true, searchable: true },
    { key: 'partyName', label: 'Supplier', kind: 'text', onList: true, searchable: true },
    { key: 'partyCode', label: 'Supplier code', kind: 'code', onList: true, searchable: true },
    { key: 'documentType', label: 'Type', kind: 'code', onList: true, searchable: true },
    { key: 'documentSubType', label: 'Sub-type', kind: 'code', searchable: true },
    { key: 'amount', label: 'Amount', kind: 'money', onList: true, searchable: true },
    { key: 'currency', label: 'Currency', kind: 'code' },
    { key: 'documentDate', label: 'Invoice date', kind: 'date', searchable: true },
    { key: 'receivedDate', label: 'Received', kind: 'date', searchable: true },
    // Derived: shown, never stored, never sorted on. A derived value that gets
    // stored is a value that goes stale while still looking authoritative.
    { key: 'sameDay', label: 'Arrived same day', kind: 'boolean', derivedFrom: ['documentDate', 'receivedDate'] },
    { key: 'senderEmail', label: 'Sent by', kind: 'text' },
    { key: 'intakeStatus', label: 'Intake status', kind: 'text' },
    // One country's local need, declared on the queue that needs it — NOT a
    // column on every exception in the world.
    { key: 'brTaxKey', label: 'Brazil tax key', kind: 'code', searchable: true },
  ],
};

/** Made-up people, with the grants their positions would give them. */
export const DEMO_PEOPLE: Readonly<Record<string, ViewerInput>> = {
  // Offshore processor: raises, closes, asks again. One office.
  arun: {
    id: 'usr_arun', name: 'Arun Kale', unit: 'Offshore AP · ALPHA',
    grants: [
      { capabilities: ['read', 'raise', 'comment', 'attach', 'accept', 'requery', 'withdraw', 'reopen'],
        where: { office: 'ALPHA' } },
      { capabilities: ['read', 'comment'], where: { department: 'Offshore AP' } },
    ],
  },
  // Onshore resolver: answers for two departments, across the whole region.
  daniel: {
    id: 'usr_daniel', name: 'Daniel Frey', unit: 'Onshore Finance · WEST',
    grants: [
      { capabilities: ['read', 'comment', 'attach', 'answer', 'refer', 'reassign', 'reroute'],
        where: { department: 'Onshore Finance' } },
      { capabilities: ['read'], where: { region: 'WEST' } },
    ],
  },
  // Procurement, but only for the two Sorland offices.
  nisha: {
    id: 'usr_nisha', name: 'Nisha Rao', unit: 'Procurement · Sorland',
    grants: [
      { capabilities: ['read', 'comment', 'attach', 'answer', 'refer', 'reassign', 'reroute'],
        where: { department: 'Procurement' } },
      { capabilities: ['read'], where: { country: 'Sorland' } },
    ],
  },
  // A lead with two hats: processes at BRAVO, and reviews for the Repair Desk.
  meera: {
    id: 'usr_meera', name: 'Meera Iyer', unit: 'Offshore AP · BRAVO',
    grants: [
      { capabilities: ['read', 'raise', 'comment', 'attach', 'accept', 'requery', 'withdraw', 'reopen'],
        where: { office: 'BRAVO' } },
      { capabilities: ['read', 'comment', 'attach', 'answer', 'reassign'],
        where: { department: 'Repair Desk' } },
    ],
  },
  // Whoever maintains the catalogue.
  admin: {
    id: 'usr_admin', name: 'Catalogue Admin', unit: 'Global',
    grants: [{ capabilities: ['read', 'administer'], where: {} }],
  },
};

/** A few made-up invoices, enough that bulk and deflection have something to bite on. */
export const DEMO_INVOICES = [
  { reference: 'INV-2026-004182', partyName: 'Harbour Terminals Ltd', partyCode: 'SUP-11204',
    documentType: 'TERM', documentSubType: 'DETENTION', amount: 42_180, currency: 'EUR',
    documentDate: '2026-06-30', receivedDate: '2026-06-30', office: 'ALPHA',
    senderEmail: 'billing@harbour.example', intakeStatus: 'Open', brTaxKey: null },
  { reference: 'INV-2026-004410', partyName: 'Harbour Terminals Ltd', partyCode: 'SUP-11204',
    documentType: 'TERM', documentSubType: 'DETENTION', amount: 3_940, currency: 'EUR',
    documentDate: '2026-07-02', receivedDate: '2026-07-03', office: 'ALPHA',
    senderEmail: 'billing@harbour.example', intakeStatus: 'Open', brTaxKey: null },
  { reference: 'INV-2026-004433', partyName: 'Harbour Terminals Ltd', partyCode: 'SUP-11204',
    documentType: 'TERM', documentSubType: 'STORAGE', amount: 7_115, currency: 'EUR',
    documentDate: '2026-07-04', receivedDate: '2026-07-04', office: 'ALPHA',
    senderEmail: 'billing@harbour.example', intakeStatus: 'Open', brTaxKey: null },
  { reference: 'INV-2026-004501', partyName: 'Meridian Depot Services', partyCode: 'SUP-40921',
    documentType: 'REPAIR', documentSubType: 'BOXREP', amount: 1_260, currency: 'EUR',
    documentDate: '2026-07-05', receivedDate: '2026-07-06', office: 'ECHO',
    senderEmail: 'ar@meridian.example', intakeStatus: 'Open', brTaxKey: null },
  { reference: 'INV-2026-004512', partyName: 'Sorland Haulage AS', partyCode: 'SUP-77310',
    documentType: 'TRANS', documentSubType: 'DRAYAGE', amount: 18_400, currency: 'EUR',
    documentDate: '2026-07-05', receivedDate: '2026-07-05', office: 'DELTA',
    senderEmail: 'invoices@sorlandhaulage.example', intakeStatus: 'Open', brTaxKey: null },
] as const;

/**
 * Business hours, so the two clocks have something real to run against.
 *
 * These two share NO working hour — 09:00-18:00 in Kolkata has already ended
 * before 08:00 in Chicago begins. That is the ordinary case in this industry,
 * and it is why a deadline counted in wall-clock hours is confidently wrong:
 * a query raised at 16:40 offshore does not start burning the onshore budget
 * until onshore opens, the next day.
 */
export const DEMO_CALENDARS: readonly BusinessCalendar[] = [
  {
    id: 'offshore', timezone: 'Asia/Kolkata',
    workdays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00',
    holidays: ['2026-08-15'],
  },
  {
    id: 'onshore', timezone: 'America/Chicago',
    workdays: [1, 2, 3, 4, 5], start: '08:00', end: '17:00',
    holidays: ['2026-07-03'],
  },
];
