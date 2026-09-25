import {
  addBusinessMinutes,
  ALWAYS_ON,
  businessMinutesBetween,
  type CalendarProvider,
  StaticCalendarProvider,
} from './calendar.js';
import {
  assertContiguous,
  assertMonotonic,
  closeSegment,
  elapsedMinutesOf,
  legMinutes,
  liveTotalsOf,
  openSegment,
  totalsOf,
  type Segment,
  type Side,
  type Totals,
} from './ledger.js';
import {
  answerDataSchema,
  answerManyDataSchema,
  categoryDefinitionSchema,
  evidenceDataSchema,
  commandSchema,
  commentDataSchema,
  configBundleSchema,
  participantDataSchema,
  raiseDataSchema,
  reasonDefinitionSchema,
  TERMINAL_COMMANDS,
  type Actor,
  type Budgets,
  type Command,
  type CommandInput,
  type CommandType,
  destinationSchema,
  escalationLadderSchema,
  scopeMatches,
  scopeOfDestination,
  specificityOf,
  SYSTEM_VIEWER,
  type Capability,
  type Destination,
  type EscalationLadder,
  type EscalationLadderInput,
  type EscalationRung,
  type DestinationInput,
  type ConfigBundle,
  type ReasonDefinition,
  type ReasonDefinitionInput,
  type AttachmentRef,
  type CategoryDefinitionInput,
  type Scope,
  type Viewer,
} from './schemas.js';
import {
  cascadeFor,
  categoriesFor,
  categoryLabel,
  mappingRows,
  reasonsFor,
  type Cascade,
  type CategoryDefinition,
  type MappingRow,
} from './taxonomy.js';
import { instructionsFor, type Instruction } from './instruction.js';
import {
  documentAgeDays,
  renderSnapshot,
  snapshotProblems,
  type SubjectSchema,
  type SubjectSnapshot,
} from './snapshot.js';
import { describe, may, readReachOf, sideOfViewer, type HandoverScopes } from './access.js';
import { resolveCatalogue, resolveReason, type ResolvedReason } from './catalogue.js';
import {
  allocationBinding, lifecycleDefinition, lifecycleStateOf, workItemOf,
  type AllocationBindingOptions, type LifecycleGuard, type WorkItem,
} from './bindings.js';
import { audienceScope, ladderFor, rungFor } from './escalation.js';
import { decideRoute, type RoutedBy, type RoutingAdvisor } from './routing.js';
import {
  formsFor, HANDOVER_COLUMNS, HANDOVER_METRIC_SOURCES, nounsOf,
  type ColumnDescriptor, type FieldDescriptor, type MetricSourceDescriptor,
} from './pages.js';
import type { HandoverQuery, HandoverStore } from './store.js';
import { InMemoryHandoverStore } from './store.js';

/**
 * The aggregate. One command in, one event appended and one projection
 * updated — and if either invariant would break, nothing at all.
 */

export class EngineValidationError extends Error {
  readonly problems: readonly string[];
  constructor(message: string, problems: readonly string[] = []) {
    super(message);
    this.name = 'EngineValidationError';
    this.problems = problems;
  }
}
export class EngineConflictError extends Error {
  readonly currentVersion: number;
  constructor(message: string, currentVersion: number) {
    super(message);
    this.name = 'EngineConflictError';
    this.currentVersion = currentVersion;
  }
}
export class EngineNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineNotFoundError';
  }
}

export type HandoverStatus = 'OPEN' | 'ACCEPTED' | 'WITHDRAWN';

/** One remark, with who said it, from which desk, to whom, and when. */
export interface Comment {
  readonly id: string;
  readonly round: number;
  readonly body: string;
  readonly authorId: string;
  readonly authorName: string;
  /** The desk the author stood in when they said it. Survives a reorg. */
  readonly authorUnit: string;
  readonly authorSide: Side | null;
  readonly at: string;
  readonly to: readonly string[];
  readonly visibility: 'BOTH' | 'RESOLVER_ONLY' | 'ORIGINATOR_ONLY';
  readonly parentId: string | null;
}

/** A desk brought in without being handed the handover. */
export interface Participant {
  readonly destinationId: string;
  readonly scope: Scope;
  readonly role: 'WATCHER' | 'CONTRIBUTOR';
  readonly addedBy: string;
  readonly addedAt: string;
  readonly removedAt: string | null;
  readonly note: string;
}

export interface Answer {
  readonly round: number;
  readonly body: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly answeredBy: string;
  readonly answeredAt: string;
}

export interface Handover {
  readonly id: string;
  readonly version: number;
  readonly reasonCode: string;
  readonly reasonVersion: number;
  /** The work's scope this was raised against — country, office, queue. */
  readonly scope: Scope;
  /** Which base and variants produced the definition that governed it. */
  readonly resolvedFrom: readonly string[];
  readonly subject: {
    type: string;
    id: string;
    path: string | null;
    display: string | null;
    /** The queue's own data, frozen at raise. Opaque to this engine, always. */
    values: Readonly<Record<string, unknown>>;
    attachments: readonly AttachmentRef[];
    /** When the DOCUMENT's clock started — before the query existed. */
    ageAnchor: string | null;
  };
  /** The category the reason lives under, carried so counts can group by it. */
  readonly categoryKey: string;
  readonly question: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly destination: string | null;
  /** The desk's scope as configured when this was raised — what a grant matches. */
  readonly destinationScope: Scope;
  /** Where the routing decision came from, and why. */
  readonly routedBy: RoutedBy;
  readonly routedBecause: string;
  readonly clusterKey: string | null;
  /** Derived at raise from the reason's deflectOn fields; null when it declares none. */
  readonly deflectionKey: string | null;
  readonly blocking: boolean;
  readonly holder: Side;
  readonly holderRef: string | null;
  readonly round: number;
  readonly status: HandoverStatus;
  readonly budgets: Budgets;
  /** The CURRENT holder's deadline, or null when this leg carries no budget. */
  readonly dueAt: string | null;
  readonly segments: readonly Segment[];
  readonly answers: readonly Answer[];
  readonly comments: readonly Comment[];
  readonly participants: readonly Participant[];
  readonly createdAt: string;
  readonly createdBy: string;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  /** Times the destination was corrected by hand — routing-table quality. */
  readonly rerouted: number;
  /** Times work moved inside a side. Never resets that side's clock. */
  readonly reassigned: number;
  readonly reopened: number;
  /** Highest rung already acted on, so a sweep cannot fire the same one twice. */
  readonly escalatedAt: number;
  /** Applied to the subject on accept; the host performs the write. */
  readonly appliedOnAccept: Readonly<Record<string, unknown>>;
  /** Files added after the raise, by either side, as the argument developed. */
  readonly evidence: readonly AttachmentRef[];
  /** Set when this handover was settled as part of a bulk answer, naming the
   *  one that led. A count of these is how you tell real throughput from the
   *  leverage the bulk act gave you. */
  readonly settledWith: string | null;
}

/** Who acted, as they stood at that moment — not as the directory reads today. */
export interface EventActor {
  readonly id: string;
  readonly name: string;
  /** Their desk or team when they acted. A reorg cannot rewrite history. */
  readonly unit: string;
  /** Derived from the handover, never asserted by the caller. */
  readonly side: Side | null;
}

export interface HandoverEvent {
  readonly eventId: string;
  readonly handoverId: string;
  readonly sequence: number;
  readonly type: string;
  readonly at: string;
  readonly actor: EventActor;
  readonly commandId: string;
  readonly baton: { from: Side; to: Side; closed: Segment | null } | null;
  /**
   * Which definitions governed this move. Without it a case worked in March
   * cannot be explained in November, because the reason it was raised under
   * may since have been retired and replaced.
   */
  readonly policy: {
    reason: string;
    reasonVersion: number;
    scope: Scope;
    resolvedFrom: readonly string[];
    calendars: Readonly<Record<string, string>>;
  };
  readonly data: Readonly<Record<string, unknown>>;
}

/** A handover with the numbers a screen needs, computed rather than stored. */
export interface HandoverView {
  readonly handover: Handover;
  readonly totals: Totals;
  readonly elapsedMinutes: number;
  /** Fraction of the current holder's budget spent this round; null = unbudgeted. */
  readonly budgetUsed: number | null;
  readonly overdue: boolean;
}

export interface DeskRow extends HandoverView {
  readonly clusterSize: number;
  readonly clusterMembers: readonly string[];
}

/** One row of the entity this engine publishes to the metrics registry. */
export interface HandoverFact {
  readonly handoverId: string;
  readonly reasonCode: string;
  readonly reasonVersion: number;
  readonly destination: string | null;
  readonly deskRegion: string;
  readonly deskCountry: string;
  readonly deskOffice: string;
  readonly department: string;
  readonly subDepartment: string;
  readonly workRegion: string;
  readonly workCountry: string;
  readonly workOffice: string;
  readonly queue: string;
  readonly subQueue: string;
  readonly subjectType: string;
  readonly subjectId: string;
  /** What KIND of work — the queue's own type, sliceable in every metric. */
  readonly workType: string;
  /** The category the reason sits under, so counts can group above reason. */
  readonly category: string;
  /**
   * Whole days the DOCUMENT has been alive. It started before the query
   * existed, it never pauses, and it is the number on the client's contract —
   * so it belongs on the fact row even though no leg of the ledger owns it.
   */
  readonly documentAgeDays: number | null;
  /**
   * Set when this was settled inside somebody else's bulk answer. Counting
   * these apart is how throughput stops being flattered by leverage.
   */
  readonly settledWith: string | null;
  readonly clusterKey: string | null;
  readonly status: HandoverStatus;
  readonly holder: Side;
  readonly rounds: number;
  readonly raisedAt: string;
  readonly raisedBy: string;
  readonly firstAnsweredAt: string | null;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  readonly resolverMinutes: number;
  readonly originatorMinutes: number;
  readonly pausedMinutes: number;
  readonly pauseCount: number;
  readonly elapsedMinutes: number;
  readonly respondBudgetMinutes: number | null;
  readonly actBudgetMinutes: number | null;
  /** Rounds in which that side went past its budget. Per round, not per case. */
  readonly respondBreaches: number;
  readonly actBreaches: number;
  readonly routedBy: RoutedBy;
  readonly rerouted: number;
  readonly reassigned: number;
  readonly reopened: number;
  readonly withdrawn: boolean;
}

/** One pause, as the metrics registry sees it. */
export interface PauseFact {
  readonly pauseId: string;
  readonly handoverId: string;
  readonly reasonCode: string;
  readonly department: string;
  readonly deskOffice: string;
  readonly pauseReason: string;
  readonly kind: 'PAUSE' | 'REFERRAL';
  readonly waitingOn: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly minutes: number;
  readonly open: boolean;
}

/** Ops buckets. Ordered, and the last one is open-ended. */
export const AGING_BUCKETS: readonly { label: string; underMinutes: number }[] = [
  { label: '<1d', underMinutes: 1440 },
  { label: '1-3d', underMinutes: 4320 },
  { label: '3-7d', underMinutes: 10_080 },
  { label: '7d+', underMinutes: Number.POSITIVE_INFINITY },
];

export interface AgingProfile {
  readonly at: string;
  readonly open: number;
  readonly overdue: number;
  readonly buckets: readonly {
    readonly label: string;
    readonly underMinutes: number;
    readonly total: number;
    /** Never a bare count: a bucket that cannot say whose it is says nothing. */
    readonly byHolder: Readonly<Record<string, number>>;
  }[];
  readonly oldest: {
    readonly handoverId: string;
    readonly minutes: number;
    readonly holder: Side;
    readonly destination: string | null;
  } | null;
}

/** One catalogue change, kept by the engine whatever the host's flow records. */
export interface ConfigChange {
  readonly at: string;
  readonly kind: 'reason' | 'category' | 'destination' | 'ladder';
  readonly id: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly actorUnit: string;
  readonly system: boolean;
  readonly created: boolean;
  readonly before: unknown;
  readonly after: unknown;
}

/** A rung earned and not yet acted on. Reading this writes nothing. */
export interface DueEscalation {
  readonly handoverId: string;
  readonly destination: string | null;
  readonly side: 'RESOLVER' | 'ORIGINATOR';
  readonly budgetUsed: number;
  readonly ladderId: string;
  readonly why: string;
  readonly rung: EscalationRung;
  /** Where to find somebody in the rung's role. A role, never a person. */
  readonly audience: Scope;
  readonly alreadyAt: number;
}

/** A reason measured against its own ceiling. */
export interface ReasonHealth {
  readonly reasonCode: string;
  readonly raised: number;
  readonly ceiling: number;
  readonly windowMinutes: number;
  readonly action: 'WARN' | 'SUPPRESS';
  readonly over: boolean;
  readonly suppressed: boolean;
}

export interface DeflectionCandidate {
  readonly handoverId: string;
  readonly reasonCode: string;
  readonly deflectionKey: string;
  readonly body: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly answeredBy: string;
  readonly answeredAt: string;
  readonly acceptedAt: string | null;
}

export interface CommandResult {
  readonly handover: Handover;
  readonly event: HandoverEvent;
  /** True when an idempotency key replayed and nothing new was written. */
  readonly replayed: boolean;
  /**
   * What the host must now do to make the world agree with this handover —
   * move the work item, offer it to a queue, stamp an event, tell somebody.
   *
   * The engine does not perform any of it. `tasks` belongs to the runtime and
   * `work_events` belongs to allocation, and two writers on one table is how
   * records start disagreeing with no way to tell which was right. A host that
   * applies none of these still leaves the engine's own books balanced — the
   * work simply did not move, which is visible rather than silent.
   */
  readonly instructions: readonly Instruction[];
  /** On a bulk answer, every OTHER handover the same act settled. */
  readonly alsoSettled: readonly CommandResult[];
}

export interface EngineOptions {
  readonly store?: HandoverStore;
  readonly calendars?: CalendarProvider;
  /** Ids are injected so a replay reproduces a run exactly. */
  readonly newId?: (kind: 'handover' | 'event') => string;
  /**
   * Consulted in order at raise; the first opinion wins. Empty is the normal
   * standalone case and leaves the catalogue's scoped default standing.
   */
  readonly routingAdvisors?: readonly RoutingAdvisor[];
  /** A host running @malkom/workflow-core answers "is this move legal". */
  readonly lifecycleGuard?: LifecycleGuard;
}

const EVENT_TYPE: Record<CommandType, string> = {
  raise: 'handover.raised.v1',
  'answer-many': 'handover.answered-in-bulk.v1',
  'add-evidence': 'handover.evidence-added.v1',
  escalate: 'handover.escalated.v1',
  comment: 'handover.commented.v1',
  'add-participant': 'handover.participant-added.v1',
  'remove-participant': 'handover.participant-removed.v1',
  answer: 'handover.answered.v1',
  requery: 'handover.requeried.v1',
  accept: 'handover.accepted.v1',
  withdraw: 'handover.withdrawn.v1',
  'auto-accept': 'handover.auto-accepted.v1',
  reassign: 'handover.reassigned.v1',
  reroute: 'handover.rerouted.v1',
  refer: 'handover.referred.v1',
  'external-response': 'handover.external-response-recorded.v1',
  pause: 'handover.paused.v1',
  resume: 'handover.resumed.v1',
  reopen: 'handover.reopened.v1',
};

/**
 * The capability each command needs. Side is not listed because side is no
 * longer asserted: it falls out of the grant that permits the capability over
 * the desk the handover sits on, which is the only place it was ever a fact.
 */
const CAPABILITY_OF: Record<CommandType, Capability | null> = {
  raise: 'raise',
  // Anyone who can see it can raise the alarm on it. Escalation buys
  // attention and moves nothing, so gating it behind a resolver-side grant
  // would mean the person who notices cannot say so.
  escalate: 'read',
  comment: 'comment',
  // Tagging a desk in widens who can see the handover, so it is a resolver-
  // side act rather than a courtesy: somebody accountable has to do it.
  'add-participant': 'reassign',
  'remove-participant': 'reassign',
  answer: 'answer',
  // Bulk carries exactly the same right as one — and it is checked again for
  // every item in the batch, against that item's own scope. A bulk action is
  // precisely where a permission hole would go unnoticed for months.
  'answer-many': 'answer',
  // Attaching is its own right: a contributor tagged into a query may add the
  // document that settles it without being able to answer it.
  'add-evidence': 'attach',
  requery: 'requery',
  accept: 'accept',
  withdraw: 'withdraw',
  'auto-accept': null, // the engine's own act; never a person's
  reassign: 'reassign',
  reroute: 'reroute',
  refer: 'refer',
  'external-response': 'refer',
  pause: 'refer',
  resume: 'refer',
  reopen: 'reopen',
};

const CALENDAR_OF: Partial<Record<Side, keyof Budgets>> = { RESOLVER: 'respond', ORIGINATOR: 'act' };

let counter = 0;
const defaultId = (kind: 'handover' | 'event'): string => {
  counter += 1;
  return `${kind === 'handover' ? 'hnd' : 'evt'}_${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
};

export class ExceptionEngine {
  private readonly store: HandoverStore;
  private readonly calendars: CalendarProvider;
  private readonly newId: (kind: 'handover' | 'event') => string;
  private readonly advisors: readonly RoutingAdvisor[];
  private readonly lifecycle: LifecycleGuard | null;
  private readonly reasons = new Map<string, ReasonDefinition>();
  private readonly categories = new Map<string, CategoryDefinition>();
  /**
   * What each queue says its subjects carry. Registered by the host, read
   * here only to hold a snapshot against its declaration and to lay one out.
   * The engine never interprets a single field.
   */
  private readonly subjectSchemas = new Map<string, SubjectSchema>();
  private readonly destinations = new Map<string, Destination>();
  private config: ConfigBundle | null = null;
  private readonly ladders = new Map<string, EscalationLadder>();
  private readonly configLog: ConfigChange[] = [];
  /** Injected so a replay reproduces a run; the host owns the real clock. */
  private clockNow: () => string = () => new Date().toISOString();

  constructor(options: EngineOptions = {}) {
    this.store = options.store ?? new InMemoryHandoverStore();
    this.calendars = options.calendars ?? new StaticCalendarProvider();
    this.newId = options.newId ?? defaultId;
    this.advisors = options.routingAdvisors ?? [];
    this.lifecycle = options.lifecycleGuard ?? null;
  }

  // ------------------------------------------------------------ configuration

  /**
   * Change the catalogue. `by` is not decoration: a catalogue change decides
   * what may be asked, of whom and by when, so it is a change to live work and
   * the engine keeps its own record of who made it. The host's approval flow
   * sits in front of this; the log behind it is what survives the host.
   */
  /**
   * Register a category — the rung between "where is this work" and "what
   * exactly is wrong". Authorship is scoped like everything else: a category
   * whose `where` names an office needs an administrator who holds that
   * office, because adding one changes what everybody there is offered.
   */
  putCategory(input: CategoryDefinitionInput, by: Viewer = SYSTEM_VIEWER): CategoryDefinition {
    const parsed = categoryDefinitionSchema.safeParse(input);
    if (!parsed.success) {
      throw new EngineValidationError('category rejected', parsed.error.issues.map((i) => i.message));
    }
    const category = parsed.data;
    if (category.qualifierKind === 'SCOPE' && specificityOf(category.where) === 0) {
      // A SCOPE qualifier that pins nothing is a sub-family with a misleading
      // label — it would suppress the plain family everywhere, which is never
      // what anybody meant by writing a condition down.
      throw new EngineValidationError(
        `category ${category.key} says its qualifier is a condition but names no scope`,
        ['give it a where, or mark the qualifier SUB_FAMILY'],
      );
    }
    this.requireAdminOver(by, category.where, `category ${category.key}`);
    this.recordConfigChange(by, 'category', category.key, this.categories.get(category.key) ?? null, category);
    this.categories.set(category.key, category);
    return category;
  }

  /**
   * Register what a queue's subjects carry. The engine holds the declaration
   * so it can validate a snapshot and lay one out — and for no other reason.
   * It never reads a field's meaning, which is precisely why the same engine
   * works on the next queue without a line changing.
   */
  putSubjectSchema(schema: SubjectSchema, by: Viewer = SYSTEM_VIEWER): SubjectSchema {
    this.requireAdminOver(by, {}, `subject schema for ${schema.subjectType}`);
    this.subjectSchemas.set(schema.subjectType, schema);
    return schema;
  }

  /**
   * THE RAISE DIALOG, in one call.
   *
   * The office, the work type, the queue and the sub-queue are already decided
   * before this is asked — they come off the work item, not off a form. So the
   * person gets two lists and picks twice; the department falls out of the row
   * that matched and is shown rather than offered, because a person who can
   * choose the department can route around the SLA.
   */
  cascade(viewer: Viewer, scope: Scope, subjectType?: string): Cascade {
    const reach: HandoverScopes = { work: scope, destination: {}, createdBy: viewer.id };
    if (!may(viewer, 'raise', reach).allowed && !may(viewer, 'read', reach).allowed) {
      throw new EngineValidationError('you cannot raise on this work', [
        'no grant of yours covers this office, queue or work type',
      ]);
    }
    return cascadeFor([...this.categories.values()], [...this.reasons.values()], scope, subjectType);
  }

  /** Categories that reach one scope, most specific variant winning. */
  categoriesAt(viewer: Viewer, scope: Scope): readonly CategoryDefinition[] {
    const reach: HandoverScopes = { work: scope, destination: {}, createdBy: viewer.id };
    if (!may(viewer, 'read', reach).allowed) throw new EngineValidationError('you cannot read this scope');
    return categoriesFor([...this.categories.values()], scope);
  }

  /**
   * The catalogue as the flat five-key table an administrator exports, diffs
   * and argues about. GENERATED from the definitions rather than authored
   * beside them: two copies of one mapping is how the export and the
   * behaviour start disagreeing, and the export always looks more right.
   */
  mapping(viewer: Viewer, scopes: readonly Scope[]): readonly MappingRow[] {
    const reach: HandoverScopes = { work: scopes[0] ?? {}, destination: {}, createdBy: viewer.id, watching: [...scopes] };
    if (!may(viewer, 'administer', reach).allowed) {
      throw new EngineValidationError('reading the whole mapping is an administrative act');
    }
    return mappingRows([...this.categories.values()], [...this.reasons.values()], scopes);
  }

  /**
   * The work item as a screen should draw it — the host's declared order, its
   * labels, its kinds. Undeclared values are kept and marked rather than
   * dropped: a field arriving with no declaration usually means somebody added
   * it upstream and forgot the other half, and swallowing it hides that for
   * months.
   */
  renderSubject(viewer: Viewer, handoverId: string): {
    fields: ReturnType<typeof renderSnapshot>;
    documentAgeDays: number | null;
    attachments: readonly AttachmentRef[];
    evidence: readonly AttachmentRef[];
  } {
    const handover = this.requireHandover(handoverId);
    if (!may(viewer, 'read', this.scopesOf(handover)).allowed) {
      throw new EngineValidationError('you cannot read this handover');
    }
    const snapshot: SubjectSnapshot = {
      subjectType: handover.subject.type,
      subjectId: handover.subject.id,
      takenAt: handover.createdAt,
      values: handover.subject.values,
      attachments: handover.subject.attachments,
      ageAnchor: handover.subject.ageAnchor,
    };
    return {
      fields: renderSnapshot(this.subjectSchemas.get(handover.subject.type) ?? null, snapshot),
      documentAgeDays: documentAgeDays(snapshot, new Date().toISOString()),
      attachments: handover.subject.attachments,
      evidence: handover.evidence,
    };
  }

  putReason(input: ReasonDefinitionInput, by: Viewer = SYSTEM_VIEWER): ReasonDefinition {
    const parsed = reasonDefinitionSchema.safeParse(input);
    if (!parsed.success) {
      throw new EngineValidationError('reason definition rejected', parsed.error.issues.map((i) => i.message));
    }
    const reason = parsed.data;
    const missing = Object.keys(reason.applyOnAccept).filter((field) => !reason.answerShape.includes(field));
    if (missing.length > 0) {
      // The verifier's rule, enforced at the door: a mapping that reads a
      // field the answer never carries writes undefined into the subject.
      throw new EngineValidationError(
        `reason ${reason.code} maps answer fields it never asks for`,
        missing.map((field) => `applyOnAccept reads "${field}", which is not in answerShape`),
      );
    }
    // Authorship is scoped like everything else. A Houston administrator may
    // touch the Houston variant and the desks under it; changing the base, or
    // a variant for a region they do not hold, needs somebody who does.
    const touched = this.changedScopes(this.reasons.get(reason.code) ?? null, reason);
    for (const scope of touched) this.requireAdminOver(by, scope, `${reason.code} at ${describe(scope)}`);
    this.recordConfigChange(by, 'reason', reason.code, this.reasons.get(reason.code) ?? null, reason);
    this.reasons.set(reason.code, reason);
    return reason;
  }

  /** Which scopes a proposed reason actually alters — nothing else needs rights. */
  private changedScopes(before: ReasonDefinition | null, after: ReasonDefinition): readonly Scope[] {
    const shape = (definition: ReasonDefinition | null, where: Scope): string =>
      JSON.stringify(
        definition === null
          ? null
          : { ...resolveReason(definition, where), scope: undefined, resolvedFrom: undefined },
      );
    const candidates: Scope[] = [{}, ...after.variants.map((variant) => variant.where)];
    for (const variant of before?.variants ?? []) candidates.push(variant.where);
    const seen = new Set<string>();
    const changed: Scope[] = [];
    for (const where of candidates) {
      const key = JSON.stringify(where);
      if (seen.has(key)) continue;
      seen.add(key);
      if (shape(before, where) !== shape(after, where)) changed.push(where);
    }
    return changed;
  }

  private requireAdminOver(by: Viewer, scope: Scope, what: string): void {
    if (by.system) return;
    const allowed = by.grants.some(
      (grant) => grant.capabilities.includes('administer') && scopeMatches(grant.where, scope),
    );
    if (!allowed) {
      throw new EngineValidationError(
        `you have no administer grant covering ${describe(scope)}`,
        [`${what} cannot be changed from where you sit`],
      );
    }
  }

  private recordConfigChange(
    by: Viewer,
    kind: 'reason' | 'category' | 'destination' | 'ladder',
    id: string,
    before: unknown,
    after: unknown,
  ): void {
    this.configLog.push({
      at: this.clockNow(),
      kind,
      id,
      actorId: by.id,
      actorName: by.name,
      actorUnit: by.unit,
      system: by.system,
      created: before === null,
      before,
      after,
    });
  }

  // ------------------------------------------------------------- escalation
  /**
   * An escalation ladder, settable once and scoped. Written per reason they
   * get copied per reason, and the copies drift until nobody can say what the
   * escalation policy actually is.
   */
  putLadder(input: EscalationLadderInput, by: Viewer = SYSTEM_VIEWER): EscalationLadder {
    const parsed = escalationLadderSchema.safeParse(input);
    if (!parsed.success) {
      throw new EngineValidationError('ladder rejected', parsed.error.issues.map((i) => i.message));
    }
    const ladder = parsed.data;
    const seen = new Set<number>();
    for (const rung of ladder.rungs) {
      if (seen.has(rung.atPercent)) {
        throw new EngineValidationError(`ladder ${ladder.id} has two rungs at ${rung.atPercent}%`);
      }
      seen.add(rung.atPercent);
    }
    this.requireAdminOver(by, ladder.where, `ladder ${ladder.id}`);
    this.recordConfigChange(by, 'ladder', ladder.id, this.ladders.get(ladder.id) ?? null, ladder);
    this.ladders.set(ladder.id, ladder);
    return ladder;
  }

  getLadder(id: string): EscalationLadder | null {
    return this.ladders.get(id) ?? null;
  }

  /** The ladder governing a desk and reason, resolved most-specific-first. */
  ladderFor(scope: Scope, reasonCode: string, side: 'RESOLVER' | 'ORIGINATOR'): EscalationLadder | null {
    return ladderFor([...this.ladders.values()], scope, reasonCode, side)?.ladder ?? null;
  }

  /**
   * Which handovers have earned a rung nobody has acted on. This is what a
   * sweep reads; looking writes nothing, so a crashed sweep loses no state.
   */
  dueEscalations(viewer: Viewer, query: HandoverQuery = {}, now?: string): readonly DueEscalation[] {
    const at = now ?? new Date().toISOString();
    const ladders = [...this.ladders.values()];
    const due: DueEscalation[] = [];
    for (const handover of this.store.list({
      ...query, status: ['OPEN'], limit: query.limit ?? 5000, reach: readReachOf(viewer),
    })) {
      // Paused means nobody's budget is running, so nobody has overrun one.
      const side = handover.holder === 'RESOLVER' || handover.holder === 'ORIGINATOR' ? handover.holder : null;
      if (side === null) continue;
      const match = ladderFor(ladders, handover.destinationScope, handover.reasonCode, side);
      if (match === null) continue;
      const used = this.budgetUsed(viewer, handover.id, at);
      if (used === null) continue; // an unbudgeted leg accrues but cannot breach
      const rung = rungFor(match.ladder, used);
      if (rung === null || rung.atPercent <= handover.escalatedAt) continue;
      due.push({
        handoverId: handover.id, destination: handover.destination, side,
        budgetUsed: used, ladderId: match.ladder.id, why: match.why, rung,
        audience: audienceScope(rung, handover.destinationScope),
        alreadyAt: handover.escalatedAt,
      });
    }
    return due;
  }

  /**
   * How hot a reason is running against its own ceiling. Null when it has no
   * ceiling, because a reason with no ceiling can never be suppressed and
   * pretending otherwise would put a meaningless dial on a screen.
   */
  reasonHealth(reasonCode: string, scope: Scope = {}, now?: string): ReasonHealth | null {
    const reason = this.reasonFor(reasonCode, scope);
    const limit = reason?.rateLimit;
    if (reason === null || limit === null || limit === undefined) return null;
    const at = now ?? new Date().toISOString();
    const since = new Date(Date.parse(at) - limit.windowMinutes * 60_000).toISOString();
    const raised = this.store.count({ reasonCode: [reasonCode], raisedAfter: since });
    return {
      reasonCode,
      raised,
      ceiling: limit.maxPerWindow,
      windowMinutes: limit.windowMinutes,
      action: limit.action,
      over: raised >= limit.maxPerWindow,
      suppressed: raised >= limit.maxPerWindow && limit.action === 'SUPPRESS',
    };
  }

  /** Who changed the catalogue, when, and from which desk. */
  configHistory(kind?: 'reason' | 'category' | 'destination' | 'ladder', id?: string): readonly ConfigChange[] {
    return this.configLog.filter(
      (entry) => (kind === undefined || entry.kind === kind) && (id === undefined || entry.id === id),
    );
  }

  // ------------------------------------------------------------ destinations
  /**
   * The desks that answer questions. Configuration rather than free strings,
   * because a grant saying "everything under EMEA" can only reach a desk that
   * knows its region, and a metric sliced by department needs the department
   * to exist as a value rather than a substring of an id.
   */
  putDestination(input: DestinationInput, by: Viewer = SYSTEM_VIEWER): Destination {
    const parsed = destinationSchema.safeParse(input);
    if (!parsed.success) {
      throw new EngineValidationError('destination rejected', parsed.error.issues.map((i) => i.message));
    }
    this.requireAdminOver(by, scopeOfDestination(parsed.data), `desk ${parsed.data.id}`);
    this.recordConfigChange(by, 'destination', parsed.data.id, this.destinations.get(parsed.data.id) ?? null, parsed.data);
    this.destinations.set(parsed.data.id, parsed.data);
    return parsed.data;
  }

  getDestination(id: string): Destination | null {
    return this.destinations.get(id) ?? null;
  }

  /** Desks a viewer may answer for — what a desk picker offers, and no more. */
  desksFor(viewer: Viewer, capability: Capability = 'answer'): readonly Destination[] {
    return [...this.destinations.values()].filter(
      (destination) =>
        destination.enabled &&
        may(viewer, capability, {
          work: {}, destination: scopeOfDestination(destination), createdBy: '\u0000',
        }).allowed,
    );
  }

  // ----------------------------------------------------------- the bindings
  /**
   * The queue definition a host applies to the allocation engine for one desk,
   * and the rows that belong in it. The engine does not insert them: the
   * allocation engine's own bargain is that workEvents is a system of record
   * rather than a mirror, so whoever creates the work inserts the row.
   */
  allocationQueue(options: AllocationBindingOptions): ReturnType<typeof allocationBinding> {
    if (!this.destinations.has(options.destination)) {
      throw new EngineValidationError(`${options.destination} is not a configured desk`);
    }
    return allocationBinding(options);
  }

  /** What the producer should ensure exists, for the handovers a viewer sees. */
  workItems(viewer: Viewer, query: HandoverQuery = {}): readonly WorkItem[] {
    return this.store.list({ ...query, limit: query.limit ?? 5000, reach: readReachOf(viewer) }).map(workItemOf);
  }

  /** The handover's states as a workflow-engine lifecycle definition. */
  lifecycleDefinition(): ReturnType<typeof lifecycleDefinition> {
    return lifecycleDefinition(this.config?.nouns);
  }

  lifecycleState(viewer: Viewer, handoverId: string): string | null {
    const handover = this.get(viewer, handoverId);
    return handover === null ? null : lifecycleStateOf(handover);
  }

  // ------------------------------------------------------- page management
  /**
   * What a page renderer needs to draw this engine with no screen written for
   * it: the columns a list definition may name, the sources a dashboard widget
   * may point at, and the words to print. A host resolves against the union of
   * its own registries and these.
   */
  pageRegistry(): {
    columns: readonly ColumnDescriptor[];
    metricSources: readonly MetricSourceDescriptor[];
    nouns: ReturnType<typeof nounsOf>;
  } {
    return { columns: HANDOVER_COLUMNS, metricSources: HANDOVER_METRIC_SOURCES, nouns: nounsOf(this.config) };
  }

  /**
   * The raise and answer forms a reason implies, in the runtime's own FieldDef
   * shape. Derived from the contract the engine enforces, so a form cannot
   * drift from the rule it collects for.
   */
  formsFor(code: string, scope: Scope): { raise: readonly FieldDescriptor[]; answer: readonly FieldDescriptor[] } | null {
    const reason = this.reasonFor(code, scope);
    return reason === null ? null : formsFor(reason);
  }

  /** The configured vocabulary. Declared once, read from one place. */
  applyConfig(bundle: ConfigBundle): ConfigBundle {
    const parsed = configBundleSchema.safeParse(bundle);
    if (!parsed.success) {
      throw new EngineValidationError('config rejected', parsed.error.issues.map((i) => i.message));
    }
    this.config = parsed.data;
    // Categories first: a reason whose category does not exist yet would be
    // offered under a heading nobody declared.
    for (const category of parsed.data.categories) this.putCategory(category);
    for (const reason of parsed.data.reasons) this.putReason(reason);
    for (const ladder of parsed.data.ladders) this.putLadder(ladder);
    return parsed.data;
  }

  /** The stored definition, base and all its variants. Authoring reads this. */
  getReason(code: string): ReasonDefinition | null {
    return this.reasons.get(code) ?? null;
  }

  /**
   * The exception list for one country, region, office and queue: what a raise
   * dialog shows, already resolved, with `resolvedFrom` explaining why this
   * office got this version.
   */
  catalogue(scope: Scope, subjectType?: string): readonly ResolvedReason[] {
    return resolveCatalogue([...this.reasons.values()], scope, subjectType);
  }

  /** One reason as it applies here, or null when it does not reach this scope. */
  reasonFor(code: string, scope: Scope): ResolvedReason | null {
    const definition = this.reasons.get(code);
    return definition === undefined ? null : resolveReason(definition, scope);
  }

  /**
   * Every read names whose view it is. There is no unscoped read on this
   * class: `SYSTEM_VIEWER` exists for the engine's own sweeps and is explicit
   * enough to grep for, so a bypass is never something that just happened.
   */
  get(viewer: Viewer, handoverId: string): Handover | null {
    const found = this.store.get(handoverId);
    if (found === null) return null;
    return may(viewer, 'read', this.scopesOf(found)).allowed ? found : null;
  }

  /** Why a read was refused, when a caller deserves better than an empty list. */
  mayRead(viewer: Viewer, handoverId: string): { allowed: boolean; reason: string } {
    const found = this.store.get(handoverId);
    if (found === null) return { allowed: false, reason: 'no such handover' };
    return may(viewer, 'read', this.scopesOf(found));
  }

  private scopesOf(handover: Handover): HandoverScopes {
    return {
      work: handover.scope,
      destination: handover.destinationScope,
      createdBy: handover.createdBy,
      watching: handover.participants.filter((p) => p.removedAt === null).map((p) => p.scope),
    };
  }

  /**
   * The conversation as this viewer may see it: every remark they are entitled
   * to, in order, with who said it and from which desk.
   *
   * A one-sided remark is hidden by CAPABILITY, never by obscurity. Somebody
   * holding read.internal sees both sides — an auditor must, or the record is
   * not a record — and the filtering happens here rather than in a UI, so a
   * second client cannot forget it.
   */
  timeline(viewer: Viewer, handoverId: string): readonly Comment[] {
    const handover = this.get(viewer, handoverId);
    if (handover === null) return [];
    const side = sideOfViewer(viewer, this.scopesOf(handover));
    const seesBoth =
      viewer.system ||
      viewer.grants.some((grant) => grant.capabilities.includes('read.internal'));
    return handover.comments.filter((comment) => {
      if (comment.visibility === 'BOTH' || seesBoth) return true;
      // Participants are neither side, so a one-sided remark is not theirs.
      if (side === null) return false;
      return comment.visibility === `${side}_ONLY`;
    });
  }

  events(viewer: Viewer, handoverId: string): readonly HandoverEvent[] {
    return this.get(viewer, handoverId) === null ? [] : this.store.events(handoverId);
  }

  /** Every handover on one transaction — what the case panel reads. */
  onSubject(viewer: Viewer, subjectType: string, subjectId: string): readonly Handover[] {
    return this.store
      .bySubject(subjectType, subjectId)
      .filter((handover) => may(viewer, 'read', this.scopesOf(handover)).allowed);
  }

  /** Every handover one answer can settle. */
  inCluster(viewer: Viewer, clusterKey: string): readonly Handover[] {
    return this.store
      .byCluster(clusterKey)
      .filter((handover) => may(viewer, 'read', this.scopesOf(handover)).allowed);
  }

  // ------------------------------------------------------------ the lists
  /**
   * The surface everything above a single case is built from. A ledger you
   * cannot look across is an archive: without this there is no resolver desk,
   * no "what am I waiting on", no breach list, and nothing for a metrics
   * engine to read.
   */
  list(viewer: Viewer, query: HandoverQuery = {}, now?: string): readonly HandoverView[] {
    const at = now ?? new Date().toISOString();
    return this.store.list({ ...query, reach: readReachOf(viewer) }).map((handover) => this.view(handover, at));
  }

  count(viewer: Viewer, query: HandoverQuery = {}): number {
    return this.store.count({ ...query, reach: readReachOf(viewer) });
  }

  /**
   * One resolver desk, soonest deadline first. Clustered handovers collapse to
   * their leader, with the rest carried as members — forty invoices blocked on
   * one work order is one question, and a desk that shows it forty times
   * invites forty answers.
   */
  desk(viewer: Viewer, destination: string, now?: string): readonly DeskRow[] {
    const at = now ?? new Date().toISOString();
    const open = this.store.list({
      destination: [destination], status: ['OPEN'], holder: ['RESOLVER'], order: 'due', limit: 500,
      reach: readReachOf(viewer),
    });
    const seen = new Set<string>();
    const rows: DeskRow[] = [];
    for (const handover of open) {
      const key = handover.clusterKey;
      if (key !== null) {
        if (seen.has(key)) continue;
        seen.add(key);
        const members = open.filter((candidate) => candidate.clusterKey === key);
        rows.push({ ...this.view(handover, at), clusterSize: members.length, clusterMembers: members.map((m) => m.id) });
        continue;
      }
      rows.push({ ...this.view(handover, at), clusterSize: 1, clusterMembers: [handover.id] });
    }
    return rows;
  }

  /**
   * The row the process-metrics engine registers as an entity. The engine
   * computes no percentages of its own — it publishes facts and lets clients
   * author SLAs where they author every other SLA.
   */
  facts(viewer: Viewer, query: HandoverQuery = {}, now?: string): readonly HandoverFact[] {
    const at = now ?? new Date().toISOString();
    return this.store
      .list({ ...query, limit: query.limit ?? 5000, reach: readReachOf(viewer) })
      .map((handover) => {
      const totals = liveTotalsOf(handover.segments, at, this.calendars);
      const respond = handover.budgets.respond;
      const act = handover.budgets.act;
      const rounds = Array.from({ length: handover.round }, (unused, index) => index + 1);
      const over = (side: Side, budget: { minutes: number } | null): number =>
        budget === null ? 0 : rounds.filter((round) => legMinutes(handover.segments, side, round, at, this.calendars) > budget.minutes).length;
      const first = handover.answers[0];
      return {
        handoverId: handover.id,
        reasonCode: handover.reasonCode,
        reasonVersion: handover.reasonVersion,
        destination: handover.destination,
        // Flattened scalars, because the metrics registry takes
        // string|number|boolean|date and a metric sliced by department needs
        // the department to be a value rather than a substring of an id.
        deskRegion: handover.destinationScope.region ?? '',
        deskCountry: handover.destinationScope.country ?? '',
        deskOffice: handover.destinationScope.office ?? '',
        department: handover.destinationScope.department ?? '',
        subDepartment: handover.destinationScope.subDepartment ?? '',
        workRegion: handover.scope.region ?? '',
        workCountry: handover.scope.country ?? '',
        workOffice: handover.scope.office ?? '',
        queue: handover.scope.queue ?? '',
        subQueue: handover.scope.subQueue ?? '',
        subjectType: handover.subject.type,
        workType: handover.scope.workType ?? '',
        category: handover.categoryKey,
        documentAgeDays: documentAgeDays(
          {
            subjectType: handover.subject.type,
            subjectId: handover.subject.id,
            takenAt: handover.createdAt,
            values: handover.subject.values,
            attachments: handover.subject.attachments,
            ageAnchor: handover.subject.ageAnchor,
          },
          handover.closedAt ?? at,
        ),
        settledWith: handover.settledWith,
        subjectId: handover.subject.id,
        clusterKey: handover.clusterKey,
        status: handover.status,
        holder: handover.holder,
        rounds: handover.round,
        raisedAt: handover.createdAt,
        raisedBy: handover.createdBy,
        firstAnsweredAt: first?.answeredAt ?? null,
        closedAt: handover.closedAt,
        closedBy: handover.closedBy,
        resolverMinutes: totals.resolver,
        originatorMinutes: totals.originator,
        pausedMinutes: totals.paused,
        pauseCount: handover.segments.filter((seg) => seg.side === 'PAUSED' || seg.side === 'EXTERNAL').length,
        elapsedMinutes: elapsedMinutesOf(handover.segments, at),
        respondBudgetMinutes: respond?.minutes ?? null,
        actBudgetMinutes: act?.minutes ?? null,
        respondBreaches: over('RESOLVER', respond),
        actBreaches: over('ORIGINATOR', act),
        routedBy: handover.routedBy,
        rerouted: handover.rerouted,
        reassigned: handover.reassigned,
        reopened: handover.reopened,
        withdrawn: handover.status === 'WITHDRAWN',
      };
    });
  }

  /**
   * One row per pause, so "thirty per cent of our ageing is paused" can be
   * followed by "on whom". A separate entity rather than a map on the handover
   * row, because the metrics registry takes scalars and because the question
   * is naturally per-pause: one handover can wait on three different things.
   */
  pauseFacts(viewer: Viewer, query: HandoverQuery = {}, now?: string): readonly PauseFact[] {
    const at = now ?? new Date().toISOString();
    return this.store
      .list({ ...query, limit: query.limit ?? 5000, reach: readReachOf(viewer) })
      .flatMap((handover) =>
        handover.segments
          .filter((segment) => segment.side === 'PAUSED' || segment.side === 'EXTERNAL')
          .map((segment, index) => ({
            pauseId: `${handover.id}:${index}`,
            handoverId: handover.id,
            reasonCode: handover.reasonCode,
            department: handover.destinationScope.department ?? '',
            deskOffice: handover.destinationScope.office ?? '',
            pauseReason: segment.note ?? 'UNNAMED',
            kind: segment.side === 'EXTERNAL' ? ('REFERRAL' as const) : ('PAUSE' as const),
            waitingOn: segment.holderRef ?? '',
            startedAt: segment.startedAt,
            endedAt: segment.endedAt,
            minutes:
              segment.minutes ??
              businessMinutesBetween(segment.startedAt, at, this.calendars.get(segment.calendarId)),
            open: segment.endedAt === null,
          })),
      );
  }

  /**
   * The registry document the process-metrics engine applies. The engine
   * computes no percentages of its own: it declares the entities and their
   * field types, and clients author SLAs where they author every other SLA,
   * against calendars they already trust.
   */
  registryDoc(): {
    entities: { id: string; name: string; fields: { id: string; type: 'string' | 'number' | 'boolean' | 'date' }[] }[];
  } {
    const fields = (
      spec: Record<string, 'string' | 'number' | 'boolean' | 'date'>,
    ): { id: string; type: 'string' | 'number' | 'boolean' | 'date' }[] =>
      Object.entries(spec).map(([id, type]) => ({ id, type }));
    return {
      entities: [
        {
          id: 'handover',
          name: 'Exception handovers',
          fields: fields({
            handoverId: 'string', reasonCode: 'string', reasonVersion: 'number',
            destination: 'string', deskRegion: 'string', deskCountry: 'string', deskOffice: 'string',
            department: 'string', subDepartment: 'string',
            workRegion: 'string', workCountry: 'string', workOffice: 'string', queue: 'string', subQueue: 'string',
            subjectType: 'string', subjectId: 'string', clusterKey: 'string',
            // The three the process actually reports on. workType slices every
            // number by what KIND of work it was; category groups above reason;
            // documentAgeDays is the number on the client's contract, and no
            // leg of the ledger owns it.
            workType: 'string', category: 'string', documentAgeDays: 'number', settledWith: 'string',
            status: 'string', holder: 'string', rounds: 'number',
            raisedAt: 'date', raisedBy: 'string', firstAnsweredAt: 'date', closedAt: 'date', closedBy: 'string',
            resolverMinutes: 'number', originatorMinutes: 'number', pausedMinutes: 'number',
            pauseCount: 'number', elapsedMinutes: 'number',
            respondBudgetMinutes: 'number', actBudgetMinutes: 'number',
            respondBreaches: 'number', actBreaches: 'number',
            routedBy: 'string', rerouted: 'number', reassigned: 'number', reopened: 'number', withdrawn: 'boolean',
          }),
        },
        {
          id: 'handover_pause',
          name: 'Exception pauses',
          fields: fields({
            pauseId: 'string', handoverId: 'string', reasonCode: 'string',
            department: 'string', deskOffice: 'string', pauseReason: 'string', kind: 'string',
            waitingOn: 'string', startedAt: 'date', endedAt: 'date', minutes: 'number', open: 'boolean',
          }),
        },
      ],
    };
  }

  /**
   * A FactSourcePort the metrics engine can read directly:
   * `new MetricsEngine({ factSource: engine.factSource(viewer) })`.
   *
   * Scoped to a viewer like every other read, so a metric computed for a
   * regional lead covers their region and no more — the alternative is a
   * dashboard that quietly leaks the rest of the business.
   */
  factSource(viewer: Viewer, now?: () => string): {
    fetchFacts: (query: { entity?: string; source?: string }) => Promise<readonly Record<string, unknown>[]>;
  } {
    return {
      fetchFacts: async (query) => {
        const at = (now ?? (() => new Date().toISOString()))();
        const entity = query.entity ?? query.source ?? 'handover';
        const rows = entity === 'handover_pause' ? this.pauseFacts(viewer, {}, at) : this.facts(viewer, {}, at);
        return rows.map((row) => ({ ...row }));
      },
    };
  }

  /**
   * Queue aging, split by who is holding it.
   *
   * Every ops tool has aging buckets. The one thing they almost never say is
   * whose hands the age was spent in — so a desk gets a report showing forty
   * items over three days and no way to tell that thirty of them have been
   * sitting with the requester the whole time. Buckets here are always broken
   * out by holder, because a bucket that is not is the same lie as a single
   * waitedMinutes column.
   */
  aging(viewer: Viewer, query: HandoverQuery = {}, now?: string): AgingProfile {
    const at = now ?? new Date().toISOString();
    const rows = this.store.list({
      ...query, status: query.status ?? ['OPEN'], limit: 5000, reach: readReachOf(viewer),
    });
    const buckets = AGING_BUCKETS.map((bucket) => ({
      ...bucket,
      total: 0,
      byHolder: {} as Record<string, number>,
    }));
    let oldest: { handoverId: string; minutes: number; holder: Side; destination: string | null } | null = null;
    for (const handover of rows) {
      const age = elapsedMinutesOf(handover.segments, at);
      const bucket = buckets.find((candidate) => age < candidate.underMinutes) ?? buckets[buckets.length - 1];
      if (bucket !== undefined) {
        bucket.total += 1;
        bucket.byHolder[handover.holder] = (bucket.byHolder[handover.holder] ?? 0) + 1;
      }
      if (oldest === null || age > oldest.minutes) {
        oldest = { handoverId: handover.id, minutes: age, holder: handover.holder, destination: handover.destination };
      }
    }
    return {
      at,
      open: rows.length,
      overdue: rows.filter((h) => h.dueAt !== null && Date.parse(h.dueAt) < Date.parse(at)).length,
      buckets: buckets.map((bucket) => ({
        label: bucket.label, underMinutes: bucket.underMinutes, total: bucket.total, byHolder: bucket.byHolder,
      })),
      // The starvation alarm, matching the allocation engine's
      // malkom_oldest_unassigned_seconds. A queue's worst case is the number
      // that gets somebody out of their chair; an average never does.
      oldest,
    };
  }

  /**
   * The known answer, if there is one. Shown at the moment of raising: the
   * best handover is the one never opened, and a deflection is the most
   * valuable number this engine produces.
   */
  deflectionCandidate(
    viewer: Viewer,
    reasonCode: string,
    fields: Readonly<Record<string, unknown>>,
    scope: Scope = {},
    now?: string,
  ): DeflectionCandidate | null {
    const reason = this.reasonFor(reasonCode, scope);
    if (reason === null) return null;
    const deflectionKey = deflectionKeyOf(reason, fields);
    if (deflectionKey === null) return null;
    const at = now ?? new Date().toISOString();
    const since = new Date(Date.parse(at) - reason.deflectWithinMinutes * 60_000).toISOString();
    const settled = this.store
      .list({
        reasonCode: [reasonCode], deflectionKey, status: ['ACCEPTED'], raisedAfter: since,
        order: 'raised-desc', limit: 20, reach: readReachOf(viewer),
      })
      .find((handover) => handover.answers.length > 0);
    if (settled === undefined) return null;
    const answer = settled.answers[settled.answers.length - 1];
    if (answer === undefined) return null;
    return {
      handoverId: settled.id,
      reasonCode: settled.reasonCode,
      deflectionKey,
      body: answer.body,
      fields: answer.fields,
      answeredBy: answer.answeredBy,
      answeredAt: answer.answeredAt,
      acceptedAt: settled.closedAt,
    };
  }

  private view(handover: Handover, now: string): HandoverView {
    const totals = liveTotalsOf(handover.segments, now, this.calendars);
    const budget = this.budgetFor(handover.budgets, handover.holder);
    const spent = budget === null ? null : legMinutes(handover.segments, handover.holder, handover.round, now, this.calendars);
    return {
      handover,
      totals,
      elapsedMinutes: elapsedMinutesOf(handover.segments, now),
      // Null means unbudgeted, which is not the same as on time — the leg is
      // still measured, it simply cannot breach.
      budgetUsed: budget === null || spent === null ? null : spent / budget.minutes,
      overdue: handover.dueAt !== null && Date.parse(handover.dueAt) < Date.parse(now),
    };
  }

  /** Owned time as of `now`, including the running segment. Nothing written. */
  totals(viewer: Viewer, handoverId: string, now: string): Totals {
    const handover = this.readable(viewer, handoverId);
    return liveTotalsOf(handover.segments, now, this.calendars);
  }

  private readable(viewer: Viewer, handoverId: string): Handover {
    const found = this.get(viewer, handoverId);
    if (found === null) throw new EngineNotFoundError(`no handover ${handoverId} in your view`);
    return found;
  }

  elapsedMinutes(viewer: Viewer, handoverId: string, now: string): number {
    return elapsedMinutesOf(this.readable(viewer, handoverId).segments, now);
  }

  /** Fraction of the current holder's budget spent. null when unbudgeted. */
  budgetUsed(viewer: Viewer, handoverId: string, now: string): number | null {
    const handover = this.readable(viewer, handoverId);
    const leg = CALENDAR_OF[handover.holder];
    if (leg === undefined) return null;
    const budget = handover.budgets[leg];
    if (budget === null || typeof budget === 'number') return null;
    const running = handover.segments[handover.segments.length - 1];
    if (running === undefined || running.endedAt !== null) return null;
    const spent = liveTotalsOf([running], now, this.calendars);
    const minutes = handover.holder === 'RESOLVER' ? spent.resolver : spent.originator;
    return minutes / budget.minutes;
  }

  // ---------------------------------------------------------------- commands

  /**
   * One command, from one named person, with the grants that person holds.
   *
   * The viewer is not optional and not a formality: it is where side comes
   * from. A caller that could name its own side could name the side allowed to
   * close a handover, and the four-eyes rule would be a suggestion.
   */
  handle(input: CommandInput, viewer: Viewer): CommandResult {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) {
      throw new EngineValidationError('command rejected', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    }
    const command = parsed.data;

    const seen = this.store.findByIdempotencyKey(command.idempotencyKey);
    if (seen !== null) {
      const handover = this.store.get(seen.handoverId);
      const event = this.store.events(seen.handoverId).find((candidate) => candidate.eventId === seen.eventId);
      if (handover !== null && event !== undefined) {
        // A replay hands the instructions back too. A host that retried
        // because its OWN write failed has to be able to apply them again —
        // returning an empty list would strand the work while the engine is
        // convinced it already moved.
        return {
          handover,
          event,
          replayed: true,
          instructions: instructionsFor(null, handover, command.type, command.at),
          alsoSettled: [],
        };
      }
    }

    const before = command.type === 'raise' ? null : this.requireHandover(command.handoverId ?? '');
    const scopes = this.scopesFor(command, before, viewer);
    this.checkAccess(command, before, viewer, scopes);
    if (before !== null && command.expectedVersion !== null && command.expectedVersion !== before.version) {
      throw new EngineConflictError(
        `handover ${before.id} is at version ${before.version}; re-read before writing`,
        before.version,
      );
    }

    const next = before === null ? this.applyRaise(command, viewer) : this.applyToOpen(command, before, viewer);
    const side = command.type === 'auto-accept' ? null : sideOfViewer(viewer, scopes);

    // Legality is workflow's to answer when a host runs it. Asked AFTER the
    // move is computed and BEFORE anything is written, so a refusal costs
    // nothing and comes back in the workflow's own words.
    if (this.lifecycle !== null && before !== null) {
      const from = lifecycleStateOf(before);
      const to = lifecycleStateOf(next);
      if (from !== to) {
        const verdict = this.lifecycle.legal(next.id, from, to);
        if (!verdict.legal) {
          throw new EngineValidationError(
            `${command.type} refused by lifecycle ${this.lifecycle.lifecycleId}: ${verdict.reason ?? `${from} → ${to} is not a legal move`}`,
          );
        }
      }
    }

    // Invariant 2, on every command without exception.
    assertMonotonic(before === null ? totalsOf([]) : totalsOf(before.segments), totalsOf(next.segments), command.type);
    assertContiguous(next.segments);

    const event: HandoverEvent = {
      eventId: this.newId('event'),
      handoverId: next.id,
      sequence: next.version,
      type: EVENT_TYPE[command.type],
      at: command.at,
      actor: { id: viewer.id, name: viewer.name, unit: viewer.unit, side },
      commandId: command.idempotencyKey,
      baton:
        before === null
          ? { from: 'NONE', to: next.holder, closed: null }
          : before.holder === next.holder
            ? null
            : { from: before.holder, to: next.holder, closed: lastClosed(next.segments) },
      policy: {
        reason: next.reasonCode,
        reasonVersion: next.reasonVersion,
        scope: next.scope,
        resolvedFrom: next.resolvedFrom,
        calendars: {
          respond: next.budgets.respond?.calendarId ?? ALWAYS_ON.id,
          act: next.budgets.act?.calendarId ?? ALWAYS_ON.id,
        },
      },
      data: {
        reason: command.reason,
        ...(command.type === 'raise' || command.type === 'reroute'
          ? { routedBy: next.routedBy, routedBecause: next.routedBecause }
          : {}),
        ...command.data,
      },
    };

    this.store.commit(next, event, command.idempotencyKey);

    // A bulk answer settles the rest AFTER the lead is safely written. Each
    // one goes through the front door as a real command — its own permission
    // check against its own scope, its own ledger, its own event — because a
    // batch that wrote rows directly would be a batch nobody could audit, and
    // the one place a permission hole hides best is inside a bulk action.
    const alsoSettled: CommandResult[] = [];
    if (command.type === 'answer-many') {
      const data = answerManyDataSchema.parse(command.data);
      for (const otherId of data.alsoHandoverIds) {
        if (otherId === next.id) continue;
        const note = data.perItemNote[otherId] ?? '';
        alsoSettled.push(
          this.handle(
            {
              type: 'answer',
              handoverId: otherId,
              idempotencyKey: `${command.idempotencyKey}:${otherId}`,
              at: command.at,
              reason: `settled in bulk with ${next.id}`,
              data: {
                body: note === '' ? data.body : `${data.body}\n\n${note}`,
                fields: data.fields,
                settledWith: next.id,
              },
            },
            viewer,
          ),
        );
      }
    }

    return {
      handover: next,
      event,
      replayed: false,
      instructions: instructionsFor(before, next, command.type, command.at),
      alsoSettled,
    };
  }

  // ----------------------------------------------------------------- internals

  private requireHandover(id: string): Handover {
    const found = this.store.get(id);
    if (found === null) throw new EngineNotFoundError(`no handover ${id}`);
    return found;
  }

  /** The two scopes a grant is matched against for this command. */
  private scopesFor(command: Command, before: Handover | null, viewer: Viewer): HandoverScopes {
    // scopesOf, not a hand-rolled triple: a desk tagged in may comment, and a
    // second copy of this shape is how that stops being true.
    if (before !== null) return this.scopesOf(before);
    // On a raise there is no handover yet: the work scope comes from the
    // command and the desk from the reason that will route it.
    const raise = raiseDataSchema.safeParse(command.data);
    const work = raise.success ? raise.data.scope : {};
    const reason = raise.success ? this.reasonFor(raise.data.reasonCode, work) : null;
    const target = (raise.success ? raise.data.destination : null) ?? reason?.defaultDestination ?? null;
    const desk = target === null ? null : this.destinations.get(target) ?? null;
    return {
      work,
      destination: desk === null ? {} : scopeOfDestination(desk),
      createdBy: viewer.id,
    };
  }

  /**
   * Invariant 1 lives here now, and it is stronger than it was. `accept`,
   * `withdraw` and `reopen` need an originator-side grant, so a resolver
   * cannot reach a terminal state however it phrases the request — and the
   * person who raised it cannot answer it, however wide their grants are.
   */
  private checkAccess(command: Command, before: Handover | null, viewer: Viewer, scopes: HandoverScopes): void {
    const capability = CAPABILITY_OF[command.type];
    if (capability === null) {
      if (!viewer.system) throw new EngineValidationError(`${command.type} is the engine's own act, not a person's`);
    } else {
      const decision = may(viewer, capability, scopes);
      if (!decision.allowed) throw new EngineValidationError(`${command.type} refused: ${decision.reason}`);
    }
    if (before !== null && before.status !== 'OPEN' && command.type !== 'reopen') {
      throw new EngineValidationError(`handover ${before.id} is ${before.status.toLowerCase()} and takes no further commands`);
    }
  }

  private budgetFor(budgets: Budgets, side: Side): { minutes: number; calendarId: string } | null {
    const leg = CALENDAR_OF[side];
    if (leg === undefined) return null;
    const budget = budgets[leg];
    return budget === null || typeof budget === 'number' ? null : budget;
  }

  private dueFor(budgets: Budgets, side: Side, from: string): string | null {
    const budget = this.budgetFor(budgets, side);
    if (budget === null) return null;
    return addBusinessMinutes(from, budget.minutes, this.calendars.get(budget.calendarId));
  }

  private calendarIdFor(budgets: Budgets, side: Side): string {
    return this.budgetFor(budgets, side)?.calendarId ?? ALWAYS_ON.id;
  }

  /** Close the running segment and open one for `to`, at the same instant. */
  private pass(
    handover: Handover,
    to: Side,
    at: string,
    holderRef: string | null,
    note: string | null,
    round = handover.round,
  ): Segment[] {
    const segments = handover.segments.map((segment, index) =>
      index === handover.segments.length - 1 ? closeSegment(segment, at, this.calendars) : segment,
    );
    if (to !== 'NONE') {
      segments.push(openSegment(to, holderRef, at, this.calendarIdFor(handover.budgets, to), round, note));
    }
    return segments;
  }

  private applyRaise(command: Command, viewer: Viewer): Handover {
    const parsed = raiseDataSchema.safeParse(command.data);
    if (!parsed.success) {
      throw new EngineValidationError('raise rejected', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    }
    const data = parsed.data;
    const stored = this.reasons.get(data.reasonCode);
    if (stored === undefined) throw new EngineValidationError(`unknown reason ${data.reasonCode}`);
    // Resolved against the WORK's scope, not the raiser's. A processor in
    // Kolkata raising on a Houston invoice gets Houston's version of the
    // question, Houston's destination and Houston's clock.
    const scope = data.scope;
    const reason = resolveReason(stored, scope);
    if (reason === null) {
      throw new EngineValidationError(
        `reason ${stored.code} does not apply to this work`,
        [`scope ${JSON.stringify(scope)} is outside where ${stored.code} is available`],
      );
    }
    if (!reason.subjectTypes.includes(data.subject.type)) {
      throw new EngineValidationError(`reason ${reason.code} does not apply to a ${data.subject.type}`);
    }
    // A reason firing far above its usual rate is an upstream defect, not a
    // thousand separate questions. Counted from the engine's own store, so it
    // needs no denominator from the host and cannot be wrong about its history.
    const limit = reason.rateLimit;
    if (limit !== null && limit !== undefined) {
      const since = new Date(Date.parse(command.at) - limit.windowMinutes * 60_000).toISOString();
      const recent = this.store.count({ reasonCode: [reason.code], raisedAfter: since });
      if (recent >= limit.maxPerWindow && limit.action === 'SUPPRESS') {
        throw new EngineValidationError(
          `${reason.code} is suppressed: ${recent} raised in the last ${limit.windowMinutes} minutes`,
          [
            `the ceiling is ${limit.maxPerWindow}`,
            'this many at once is an upstream defect, not this many questions — fix the cause, then lift the ceiling',
          ],
        );
      }
    }

    const missing = reason.asks.filter((field) => !(field in data.fields));
    if (missing.length > 0) {
      throw new EngineValidationError(`reason ${reason.code} needs more to be answerable in one round`, missing.map((f) => `missing "${f}"`));
    }

    // The snapshot is held against the queue's own declaration when the host
    // has registered one. A value that arrives as text where a number was
    // declared only surfaces when somebody sorts that column three months
    // later, and by then there are ten thousand of them.
    const schema = this.subjectSchemas.get(data.subject.type) ?? null;
    const snapshotIssues = snapshotProblems(schema, {
      subjectType: data.subject.type,
      subjectId: data.subject.id,
      takenAt: command.at,
      values: data.subject.values,
      attachments: data.subject.attachments,
      ageAnchor: data.subject.ageAnchor,
    });
    if (snapshotIssues.length > 0) {
      throw new EngineValidationError(
        `the ${data.subject.type} snapshot does not match what this queue declares`,
        snapshotIssues.map((issue) => issue.problem),
      );
    }

    const route = decideRoute(
      { reason, scope, subject: data.subject, fields: data.fields },
      this.advisors,
      data.destination,
    );
    const destination = route.destination;
    const desk = destination === null ? null : this.destinations.get(destination) ?? null;
    if (destination !== null && desk === null) {
      // A route to a desk nobody configured is a black hole: no grant can
      // reach it, so nobody will ever see the question.
      throw new EngineValidationError(
        `destination ${destination} is not a configured desk`,
        ['add it with putDestination, or the handover would be unreachable by every grant'],
      );
    }
    return {
      id: this.newId('handover'),
      version: 1,
      reasonCode: reason.code,
      reasonVersion: reason.version,
      categoryKey: (reason as { categoryKey?: string }).categoryKey ?? '',
      scope,
      resolvedFrom: reason.resolvedFrom,
      subject: data.subject,
      question: data.question,
      fields: data.fields,
      destination,
      destinationScope: desk === null ? {} : scopeOfDestination(desk),
      routedBy: route.routedBy,
      routedBecause: route.because,
      clusterKey: data.clusterKey ?? null,
      deflectionKey: deflectionKeyOf(reason, data.fields),
      blocking: reason.blocking,
      holder: 'RESOLVER',
      holderRef: destination,
      round: 1,
      status: 'OPEN',
      budgets: reason.budgets,
      dueAt: this.dueFor(reason.budgets, 'RESOLVER', command.at),
      segments: [openSegment('RESOLVER', destination, command.at, this.calendarIdFor(reason.budgets, 'RESOLVER'), 1)],
      answers: [],
      comments: [],
      participants: [],
      createdAt: command.at,
      createdBy: viewer.id,
      closedAt: null,
      closedBy: null,
      rerouted: 0,
      reassigned: 0,
      reopened: 0,
      escalatedAt: 0,
      appliedOnAccept: {},
      evidence: [],
      settledWith: null,
    };
  }

  private applyToOpen(command: Command, before: Handover, viewer: Viewer): Handover {
    const at = command.at;
    const bump = { version: before.version + 1 };

    switch (command.type) {
      case 'answer': {
        const parsed = answerDataSchema.safeParse(command.data);
        if (!parsed.success) throw new EngineValidationError('answer rejected', parsed.error.issues.map((i) => i.message));
        const reason = this.reasonFor(before.reasonCode, before.scope);
        const shape = reason?.answerShape ?? [];
        const missing = shape.filter((field) => !(field in parsed.data.fields));
        if (missing.length > 0) {
          throw new EngineValidationError(
            `this answer cannot close the question`,
            missing.map((field) => `${before.reasonCode} requires "${field}" in the answer`),
          );
        }
        const answer: Answer = {
          round: before.round,
          body: parsed.data.body,
          fields: parsed.data.fields,
          answeredBy: viewer.id,
          answeredAt: at,
        };
        return {
          ...before,
          ...bump,
          holder: 'ORIGINATOR',
          holderRef: before.createdBy,
          // A fresh leg is a fresh budget, so the ladder starts again. Carrying
          // it over would mean one side inherits the other's overrun.
          escalatedAt: 0,
          answers: [...before.answers, answer],
          segments: this.pass(before, 'ORIGINATOR', at, before.createdBy, null),
          dueAt: this.dueFor(before.budgets, 'ORIGINATOR', at),
          settledWith: parsed.data.settledWith,
        };
      }
      /**
       * The lead item of a bulk answer. It is answered exactly as one would be
       * — same shape check, same clock flip, same entry — and the batch is
       * recorded on it. The OTHER items are settled after this one is written,
       * each through a real command of its own, so every one of them gets a
       * proper ledger, a proper event and a proper permission check against
       * its own scope. A bulk act that wrote forty rows directly would be
       * forty rows nobody could audit.
       */
      case 'answer-many': {
        const parsed = answerManyDataSchema.safeParse(command.data);
        if (!parsed.success) {
          throw new EngineValidationError('bulk answer rejected', parsed.error.issues.map((i) => i.message));
        }
        const reason = this.reasonFor(before.reasonCode, before.scope);
        const shape = reason?.answerShape ?? [];
        const missing = shape.filter((field) => !(field in parsed.data.fields));
        if (missing.length > 0) {
          throw new EngineValidationError(
            'this answer cannot close the question',
            missing.map((field) => `${before.reasonCode} requires "${field}" in the answer`),
          );
        }
        const note = parsed.data.perItemNote[before.id] ?? '';
        const answer: Answer = {
          round: before.round,
          body: note === '' ? parsed.data.body : `${parsed.data.body}\n\n${note}`,
          fields: parsed.data.fields,
          answeredBy: viewer.id,
          answeredAt: at,
        };
        return {
          ...before,
          ...bump,
          holder: 'ORIGINATOR',
          holderRef: before.createdBy,
          escalatedAt: 0,
          answers: [...before.answers, answer],
          segments: this.pass(before, 'ORIGINATOR', at, before.createdBy, null),
          dueAt: this.dueFor(before.budgets, 'ORIGINATOR', at),
        };
      }
      /**
       * A file added after the raise. It changes no state and moves no clock —
       * attaching the agreement you checked is not answering the question, and
       * a command that quietly passed the baton would let a resolver stop their
       * own clock by uploading a PDF.
       */
      case 'add-evidence': {
        const parsed = evidenceDataSchema.safeParse(command.data);
        if (!parsed.success) {
          throw new EngineValidationError('evidence rejected', parsed.error.issues.map((i) => i.message));
        }
        const held = new Set(before.evidence.map((file) => file.id));
        const fresh = parsed.data.attachments
          .filter((file) => !held.has(file.id))
          .map((file) => ({ ...file, addedBy: viewer.id, addedAt: at, origin: 'EVIDENCE' as const }));
        if (fresh.length === 0) {
          throw new EngineValidationError('every one of those files is already on this handover');
        }
        return { ...before, ...bump, evidence: [...before.evidence, ...fresh] };
      }
      case 'escalate': {
        const rung = Number(command.data['atPercent'] ?? 0);
        if (!Number.isFinite(rung) || rung <= 0) {
          throw new EngineValidationError('escalate needs the rung it is acting on');
        }
        if (rung <= before.escalatedAt) {
          // Idempotent by design: two sweeps racing must not notify twice.
          return { ...before, ...bump };
        }
        // The baton does not move and no clock stops. Escalation adds
        // attention; only a transfer moves work, and a system where escalating
        // makes something somebody else's problem teaches everyone to escalate.
        return { ...before, ...bump, escalatedAt: rung };
      }
      case 'comment': {
        const parsed = commentDataSchema.safeParse(command.data);
        if (!parsed.success) throw new EngineValidationError('comment rejected', parsed.error.issues.map((i) => i.message));
        const unknown = parsed.data.audience.to.filter((id) => !this.destinations.has(id));
        if (unknown.length > 0) {
          throw new EngineValidationError(`addressed to a desk that does not exist: ${unknown.join(', ')}`);
        }
        const comment: Comment = {
          id: this.newId('event'),
          round: before.round,
          body: parsed.data.body,
          authorId: viewer.id,
          authorName: viewer.name,
          authorUnit: viewer.unit,
          authorSide: sideOfViewer(viewer, this.scopesOf(before)),
          at,
          to: parsed.data.audience.to,
          visibility: parsed.data.audience.visibility,
          parentId: parsed.data.parentId,
        };
        // A comment is not a move: the baton does not shift and no clock stops.
        // Saying something is not the same as doing something about it, and a
        // system that treats a remark as progress rewards the wrong behaviour.
        return { ...before, ...bump, comments: [...before.comments, comment] };
      }
      case 'add-participant': {
        const parsed = participantDataSchema.safeParse(command.data);
        if (!parsed.success) throw new EngineValidationError('participant rejected', parsed.error.issues.map((i) => i.message));
        const desk = this.destinations.get(parsed.data.destinationId);
        if (desk === undefined) throw new EngineValidationError(`${parsed.data.destinationId} is not a configured desk`);
        if (before.participants.some((p) => p.destinationId === desk.id && p.removedAt === null)) {
          return { ...before, ...bump };
        }
        return {
          ...before, ...bump,
          participants: [...before.participants, {
            destinationId: desk.id, scope: scopeOfDestination(desk), role: parsed.data.role,
            addedBy: viewer.id, addedAt: at, removedAt: null, note: parsed.data.note,
          }],
        };
      }
      case 'remove-participant': {
        const target = String(command.data['destinationId'] ?? '');
        return {
          ...before, ...bump,
          // Soft removal: a desk that could see this yesterday is part of the
          // record, and deleting the row makes the timeline unexplainable.
          participants: before.participants.map((p) =>
            p.destinationId === target && p.removedAt === null ? { ...p, removedAt: at } : p),
        };
      }
      case 'requery':
        return {
          ...before,
          ...bump,
          holder: 'RESOLVER',
          holderRef: before.destination,
          round: before.round + 1,
          escalatedAt: 0,
          segments: this.pass(before, 'RESOLVER', at, before.destination, null, before.round + 1),
          dueAt: this.dueFor(before.budgets, 'RESOLVER', at),
        };
      case 'accept':
      case 'auto-accept': {
        const reason = this.reasonFor(before.reasonCode, before.scope);
        const latest = before.answers[before.answers.length - 1];
        if (latest === undefined) throw new EngineValidationError('nothing has been answered yet');
        const applied: Record<string, unknown> = {};
        for (const [field, path] of Object.entries(reason?.applyOnAccept ?? {})) {
          if (field in latest.fields) applied[path] = latest.fields[field];
        }
        return {
          ...before,
          ...bump,
          holder: 'NONE',
          holderRef: null,
          status: 'ACCEPTED',
          segments: this.pass(before, 'NONE', at, null, null),
          dueAt: null,
          closedAt: at,
          closedBy: command.type === 'auto-accept' ? 'system' : viewer.id,
          appliedOnAccept: applied,
        };
      }
      case 'withdraw':
        return {
          ...before,
          ...bump,
          holder: 'NONE',
          holderRef: null,
          status: 'WITHDRAWN',
          segments: this.pass(before, 'NONE', at, null, null),
          dueAt: null,
          closedAt: at,
          closedBy: viewer.id,
        };
      case 'reassign': {
        // Same side, new hands. The clock does not notice, and that is the point.
        const to = String(command.data['holderRef'] ?? '');
        if (to === '') throw new EngineValidationError('reassign needs a holderRef');
        return { ...before, ...bump, holderRef: to, reassigned: before.reassigned + 1 };
      }
      case 'reroute': {
        const to = String(command.data['destination'] ?? '');
        if (to === '') throw new EngineValidationError('reroute needs a destination');
        // A correction, not a fresh start: the responding side keeps its clock.
        const desk = this.destinations.get(to);
        if (desk === undefined) throw new EngineValidationError(`destination ${to} is not a configured desk`);
        return {
          ...before, ...bump, destination: to, rerouted: before.rerouted + 1,
          destinationScope: scopeOfDestination(desk),
          routedBy: 'override',
          routedBecause: `corrected by hand: ${command.reason || 'no reason given'}`,
          holderRef: before.holder === 'RESOLVER' ? to : before.holderRef,
        };
      }
      case 'refer':
      case 'pause': {
        if (before.holder === 'EXTERNAL' || before.holder === 'PAUSED') {
          throw new EngineValidationError(`handover ${before.id} is already paused`);
        }
        const note = String(command.data['pauseReason'] ?? command.reason);
        const bounded = this.boundedPause(before, note, command.type);
        const waitingOn = (command.data['waitingOn'] as string | undefined) ?? null;
        const side = command.type === 'refer' ? 'EXTERNAL' : 'PAUSED';
        return {
          ...before,
          ...bump,
          holder: side,
          holderRef: waitingOn,
          // The party we are waiting on belongs on the SEGMENT, not only on the
          // projection: the projection moves on at resume, and "who was this
          // waiting on in March" has to survive that.
          segments: this.pass(before, side, at, waitingOn, note),
          dueAt: bounded,
        };
      }
      case 'resume':
      case 'external-response': {
        if (before.holder !== 'EXTERNAL' && before.holder !== 'PAUSED') {
          throw new EngineValidationError(`handover ${before.id} is not paused`);
        }
        return {
          ...before,
          ...bump,
          holder: 'RESOLVER',
          holderRef: before.destination,
          segments: this.pass(before, 'RESOLVER', at, before.destination, null),
          dueAt: this.dueFor(before.budgets, 'RESOLVER', at),
        };
      }
      case 'reopen':
        return {
          ...before,
          ...bump,
          holder: 'RESOLVER',
          holderRef: before.destination,
          round: before.round + 1,
          reopened: before.reopened + 1,
          status: 'OPEN',
          segments: this.pass(before, 'RESOLVER', at, before.destination, null, before.round + 1),
          dueAt: this.dueFor(before.budgets, 'RESOLVER', at),
          closedAt: null,
          closedBy: null,
        };
      case 'raise':
        throw new EngineValidationError('raise creates a handover; it cannot be applied to one');
      default: {
        const exhaustive: never = command.type;
        throw new EngineValidationError(`unhandled command ${String(exhaustive)}`);
      }
    }
  }

  /** No unbounded pause: the bound is when the engine puts the clock back on. */
  private boundedPause(before: Handover, note: string, kind: 'refer' | 'pause'): string {
    const reason = this.reasonFor(before.reasonCode, before.scope);
    const configured = reason?.pauseReasons.find((candidate) => candidate.code === note);
    const cap = configured?.maxMinutes ?? (kind === 'refer' ? before.budgets.referralMaxMinutes : null);
    if (cap === null || cap === undefined) {
      throw new EngineValidationError(
        `"${note}" is not a bounded pause reason for ${before.reasonCode}`,
        ['every pause names a reason from the catalogue and every reason carries a maxMinutes'],
      );
    }
    return addBusinessMinutes(before.segments[before.segments.length - 1]?.startedAt ?? before.createdAt, cap, ALWAYS_ON);
  }
}

/**
 * The known-answer key for a question, from what the raiser already knows.
 * Exported so a raise dialog can ask "has this been answered?" BEFORE it
 * creates anything — which is the only moment a deflection is worth having.
 */
export const deflectionKeyOf = (
  reason: ReasonDefinition,
  fields: Readonly<Record<string, unknown>>,
): string | null => {
  if (reason.deflectOn.length === 0) return null;
  const missing = reason.deflectOn.some((field) => fields[field] === undefined || fields[field] === null);
  if (missing) return null;
  return reason.deflectOn.map((field) => `${field}=${String(fields[field])}`).join('|');
};

const lastClosed = (segments: readonly Segment[]): Segment | null => {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment !== undefined && segment.endedAt !== null) return segment;
  }
  return null;
};

/** Terminal commands, exported so a host can show only the moves that exist. */
export const isTerminalCommand = (type: CommandType): boolean => TERMINAL_COMMANDS.includes(type);
