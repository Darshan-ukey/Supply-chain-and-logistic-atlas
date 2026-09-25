import type { Handover } from './engine.js';
import type { Side } from './ledger.js';

/**
 * Where this engine meets the two engines that already solve half its problem.
 *
 * Neither binding reaches into the other engine's store, and neither lets the
 * other reach into this one. What crosses is a descriptor: here is the queue
 * you should run, here is the row that belongs in it, here is the lifecycle
 * these states form. The host wires them, because the host is the only thing
 * entitled to write its own tables.
 */

// ---------------------------------------------------------------------------
// Work allocation
// ---------------------------------------------------------------------------

/**
 * The state vocabulary a handover presents to an allocation queue. It is
 * deliberately coarse: allocation decides WHO picks a thing up, and the only
 * thing it needs to know is whether this one is waiting for somebody.
 */
export type WorkState = 'QUERY_OPEN' | 'QUERY_HELD' | 'QUERY_RETURNED' | 'QUERY_CLOSED';

export const workStateOf = (handover: Handover): WorkState => {
  if (handover.status !== 'OPEN') return 'QUERY_CLOSED';
  const holder: Side = handover.holder;
  if (holder === 'RESOLVER') return handover.holderRef === handover.destination ? 'QUERY_OPEN' : 'QUERY_HELD';
  if (holder === 'ORIGINATOR') return 'QUERY_RETURNED';
  return 'QUERY_HELD';
};

/** One row in the host's shared `workEvents` table, as this engine sees it. */
export interface WorkItem {
  readonly id: string;
  readonly queueId: string;
  readonly subqueueId: string;
  readonly transactionStateId: WorkState;
  /** Null until allocation claims it; the engine never writes this itself. */
  readonly allocatedTo: string | null;
  readonly completedOn: string | null;
}

/**
 * The row a producer should ensure exists for this handover.
 *
 * The engine does NOT write it, and that is not squeamishness: the allocation
 * engine's own bargain is that `workEvents` is a system of record rather than
 * a mirror, so whoever creates the work inserts the row. Here that is the
 * host, on the outbox message this engine emits. An engine that inserted rows
 * into a host table would be a second writer to a table with one owner.
 */
export const workItemOf = (handover: Handover): WorkItem => ({
  id: handover.id,
  queueId: handover.destination ?? 'unrouted',
  subqueueId: handover.destinationScope.department ?? '',
  transactionStateId: workStateOf(handover),
  allocatedTo: handover.holder === 'RESOLVER' && handover.holderRef !== handover.destination ? handover.holderRef : null,
  completedOn: handover.closedAt,
});

export interface AllocationBindingOptions {
  readonly connectionRef: string;
  readonly destination: string;
  readonly table?: string;
}

/**
 * The queue definition a host applies to `@malkom/alloc-core` for one desk.
 * Shaped for `workEventsBinding`, so wiring it is a call rather than a design
 * exercise — and so the guarded claim, the capacity and the race safety that
 * engine already has are used instead of rebuilt here.
 */
export const allocationBinding = (options: AllocationBindingOptions): {
  connectionRef: string;
  queueId: string;
  allocatableStates: WorkState[];
  onAssignSet: Record<string, string>;
  onReleaseSet: Record<string, string>;
  attributes: string[];
  table?: string;
} => ({
  connectionRef: options.connectionRef,
  queueId: options.destination,
  // Only work actually waiting on this desk is allocatable. A handover back
  // with the originator is not the desk's to pick up, and a desk whose queue
  // says otherwise spends its day looking at other people's homework.
  allocatableStates: ['QUERY_OPEN'],
  onAssignSet: { transactionStateId: 'QUERY_HELD' },
  onReleaseSet: { transactionStateId: 'QUERY_OPEN' },
  attributes: ['queueId', 'subqueueId'],
  ...(options.table === undefined ? {} : { table: options.table }),
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export interface LifecycleState {
  readonly key: string;
  readonly label: string;
  readonly terminal: boolean;
  readonly holdsClock: boolean;
  readonly to: readonly string[];
}

export interface LifecycleDefinition {
  readonly id: string;
  readonly name: string;
  readonly initialState: string;
  readonly states: readonly LifecycleState[];
  readonly slaMinutes: number;
}

/**
 * The handover's states as a `@malkom/workflow-core` lifecycle.
 *
 * The open decision in the architecture was whether workflow should own the
 * timing ledger. It should not, and this is why: workflow gives an item ONE
 * clock, and a handover needs two that alternate. Splitting a handover into
 * two workflow items would let the legs drift and stop "the case" being one
 * object.
 *
 * So the division is legality and timing, split. Workflow answers "is this
 * move legal" against a definition an operator can read and change; this
 * engine keeps the two-clock ledger, which is the one thing it exists for.
 * `holdsClock` is set truthfully even though this engine does its own
 * accounting, so anybody reading the definition sees the same pauses.
 */
export const lifecycleDefinition = (nouns?: { caseOne: string }): LifecycleDefinition => ({
  id: 'malkom-handover',
  name: `${(nouns?.caseOne ?? 'handover').replace(/^./, (c) => c.toUpperCase())} lifecycle`,
  initialState: 'WITH_RESOLVER',
  slaMinutes: 0, // budgets are per reason and per leg; one number here would lie
  states: [
    { key: 'WITH_RESOLVER', label: 'With the resolving desk', terminal: false, holdsClock: false,
      to: ['WITH_ORIGINATOR', 'REFERRED', 'PAUSED', 'CLOSED', 'WITHDRAWN'] },
    { key: 'WITH_ORIGINATOR', label: 'Back with the originator', terminal: false, holdsClock: false,
      to: ['WITH_RESOLVER', 'CLOSED', 'WITHDRAWN'] },
    { key: 'REFERRED', label: 'Referred outside', terminal: false, holdsClock: true,
      to: ['WITH_RESOLVER'] },
    { key: 'PAUSED', label: 'Paused', terminal: false, holdsClock: true,
      to: ['WITH_RESOLVER'] },
    { key: 'CLOSED', label: 'Accepted and closed', terminal: true, holdsClock: false, to: ['WITH_RESOLVER'] },
    { key: 'WITHDRAWN', label: 'Withdrawn', terminal: true, holdsClock: false, to: [] },
  ],
});

/** The lifecycle state a handover is in, in that definition's vocabulary. */
export const lifecycleStateOf = (handover: Handover): string => {
  if (handover.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (handover.status === 'ACCEPTED') return 'CLOSED';
  if (handover.holder === 'EXTERNAL') return 'REFERRED';
  if (handover.holder === 'PAUSED') return 'PAUSED';
  return handover.holder === 'ORIGINATOR' ? 'WITH_ORIGINATOR' : 'WITH_RESOLVER';
};

/**
 * A host that runs the workflow engine implements this over it. The engine
 * asks before it moves; a refusal is the workflow's sentence, not a guess.
 * Absent, the aggregate's own invariants stand alone — which is why the
 * standalone engine still cannot be talked into an illegal move.
 */
export interface LifecycleGuard {
  readonly lifecycleId: string;
  legal(itemId: string, from: string, to: string): { legal: boolean; reason: string | null };
}
