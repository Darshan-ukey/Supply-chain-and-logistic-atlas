import type { ResolvedReason } from './catalogue.js';
import type { ConfigBundle } from './schemas.js';

/**
 * What a page renderer needs to draw this engine without anybody writing a
 * screen for it.
 *
 * The MALKOM runtime renders lists, dashboards and forms from definitions that
 * arrive in a generation, resolved against registries — `TASK_COLUMNS`,
 * `METRIC_SOURCES`, `FieldDef`. Those registries are frozen literals, so an
 * engine that publishes nothing into them can only ever be a hand-built React
 * page, which is precisely the deploy-per-change bargain the runtime spent its
 * page work escaping.
 *
 * So the engine publishes its own. A host resolves against the union of what
 * it knows and what its engines contribute, and a query list or a query
 * dashboard becomes a definition rather than a pull request.
 */

export interface ColumnDescriptor {
  readonly key: string;
  readonly label: string;
  readonly type: 'string' | 'number' | 'date' | 'duration' | 'badge';
  /** Where the value comes from in a handover view. Dotted, resolved by the host. */
  readonly path: string;
  readonly sortable: boolean;
}

/** Columns a list definition may name. Anything else the page reports, not draws. */
export const HANDOVER_COLUMNS: readonly ColumnDescriptor[] = [
  { key: 'reason', label: 'Reason', type: 'string', path: 'handover.reasonCode', sortable: true },
  { key: 'subject', label: 'Transaction', type: 'string', path: 'handover.subject.id', sortable: true },
  { key: 'question', label: 'Question', type: 'string', path: 'handover.question', sortable: false },
  { key: 'destination', label: 'Desk', type: 'string', path: 'handover.destination', sortable: true },
  { key: 'department', label: 'Department', type: 'string', path: 'handover.destinationScope.department', sortable: true },
  { key: 'office', label: 'Office', type: 'string', path: 'handover.destinationScope.office', sortable: true },
  { key: 'region', label: 'Region', type: 'string', path: 'handover.destinationScope.region', sortable: true },
  { key: 'holder', label: 'With', type: 'badge', path: 'handover.holder', sortable: true },
  { key: 'round', label: 'Round', type: 'number', path: 'handover.round', sortable: true },
  { key: 'status', label: 'Status', type: 'badge', path: 'handover.status', sortable: true },
  { key: 'raisedAt', label: 'Raised', type: 'date', path: 'handover.createdAt', sortable: true },
  { key: 'dueAt', label: 'Due', type: 'date', path: 'handover.dueAt', sortable: true },
  { key: 'overdue', label: 'Overdue', type: 'badge', path: 'overdue', sortable: true },
  { key: 'budgetUsed', label: 'Budget used', type: 'number', path: 'budgetUsed', sortable: true },
  { key: 'resolverMinutes', label: 'On the desk', type: 'duration', path: 'totals.resolver', sortable: true },
  { key: 'originatorMinutes', label: 'Back with us', type: 'duration', path: 'totals.originator', sortable: true },
  { key: 'pausedMinutes', label: 'Paused', type: 'duration', path: 'totals.paused', sortable: true },
  { key: 'elapsedMinutes', label: 'Age', type: 'duration', path: 'elapsedMinutes', sortable: true },
];

export interface MetricSourceDescriptor {
  readonly name: string;
  readonly endpoint: string;
  readonly kinds: readonly ('stat' | 'countBy' | 'timeSeries')[];
  readonly metrics: readonly string[];
  readonly dimensions: readonly string[];
  readonly series: readonly string[];
}

/**
 * Dashboard sources. The endpoints are relative: a host mounts this engine
 * where it likes and prefixes them, which is the only part of this that is
 * the host's business.
 */
export const HANDOVER_METRIC_SOURCES: readonly MetricSourceDescriptor[] = [
  {
    name: 'exceptions.desks',
    endpoint: '/v1/facts',
    kinds: ['stat', 'countBy'],
    metrics: ['open', 'overdue', 'rounds', 'resolverMinutes', 'originatorMinutes', 'pausedMinutes', 'documentAgeDays'],
    dimensions: [
      'department', 'subDepartment', 'deskOffice', 'deskRegion', 'reasonCode', 'holder', 'status',
      // Slicing by category and by work type is how a supervisor gets from
      // "four hundred open" to "it is all repair agreements at one office".
      'category', 'workType',
    ],
    series: [],
  },
  {
    name: 'exceptions.pauses',
    endpoint: '/v1/facts/pauses',
    kinds: ['stat', 'countBy'],
    metrics: ['minutes', 'open'],
    dimensions: ['pauseReason', 'kind', 'waitingOn', 'department', 'deskOffice'],
    series: [],
  },
  {
    name: 'exceptions.aging',
    endpoint: '/v1/aging',
    kinds: ['countBy'],
    metrics: ['count', 'oldestMinutes'],
    dimensions: ['bucket', 'holder', 'department', 'deskOffice'],
    series: [],
  },
];

/**
 * The runtime's generated-form shape. Matching it exactly is the point: a
 * reason that produces `FieldDef` renders in the form the runtime already
 * ships, so a new reason needs no UI work at all.
 */
export interface FieldDescriptor {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'number' | 'select' | 'date';
  readonly options: readonly string[];
  readonly derived: string | null;
  readonly showIf: string | null;
  readonly required: boolean;
}

const titleCase = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (first) => first.toUpperCase());

/** A guess from the field's name, overridable by the reason's own hints. */
const inferType = (key: string): FieldDescriptor['type'] => {
  const lower = key.toLowerCase();
  if (lower.endsWith('at') || lower.includes('date')) return 'date';
  if (lower.includes('amount') || lower.includes('qty') || lower.includes('count')) return 'number';
  return 'text';
};

const toFields = (keys: readonly string[]): FieldDescriptor[] =>
  keys.map((key) => ({
    key,
    label: titleCase(key),
    type: inferType(key),
    options: [],
    derived: null,
    showIf: null,
    required: true,
  }));

/**
 * The two forms a reason implies: what the raiser must supply for the question
 * to be answerable in one round, and what a valid answer must carry. Both are
 * derived from the same contract that the engine enforces, so a form cannot
 * drift from the rule it is collecting for.
 */
export const formsFor = (reason: ResolvedReason): {
  raise: readonly FieldDescriptor[];
  answer: readonly FieldDescriptor[];
} => ({ raise: toFields(reason.asks), answer: toFields(reason.answerShape) });

/** The words this deployment shows, resolved once so no host keeps a copy. */
export const nounsOf = (config: ConfigBundle | null): ConfigBundle['nouns'] =>
  config?.nouns ?? { caseOne: 'handover', caseMany: 'handovers', originator: 'originator', resolver: 'resolver' };
