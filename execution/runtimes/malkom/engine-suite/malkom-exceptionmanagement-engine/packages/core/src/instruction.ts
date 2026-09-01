import type { Handover } from './engine.js';
import type { Side } from './ledger.js';

/**
 * THE FIX FOR THE THING I BUILT WRONG.
 *
 * The first version of this engine created a query as its own object with its
 * own queue, sitting BESIDE the work item while the item stayed exactly where
 * it was. Two rows, two lists, two places to look — and the processor's own
 * queue still showed an invoice they could not touch.
 *
 * That is not the process. In the real process THE WORK MOVES: the item leaves
 * the queue it was in, lands in the answering department's queue carrying the
 * question with it, and comes back when it is settled. The query is not a note
 * attached to the work; it is the reason the work travelled.
 *
 * But the engine must not write that itself. `tasks` belongs to the runtime,
 * `work_events` belongs to allocation, and two writers on one table is how
 * records start disagreeing with no way to tell which one was right.
 *
 * So the engine says what should happen and hands it over. Every command
 * returns instructions; the host applies them in its own transaction, against
 * its own tables, with its own audit. If the host applies none of them the
 * engine's own books still balance — it just means the work did not move, and
 * that is visible rather than silent.
 */

export type Instruction =
  /**
   * Put the work item into its query state and move it to the answering
   * department's queue. `blocking: false` says the reason does not stop the
   * item — the rest of the work can carry on while this one field waits.
   */
  | {
      readonly kind: 'MOVE_SUBJECT';
      readonly subjectType: string;
      readonly subjectId: string;
      readonly toState: 'QUERY';
      readonly toDepartment: string;
      readonly fromDepartment: string | null;
      readonly blocking: boolean;
      readonly because: string;
    }
  /** Settled: put the item back where it came from, in its ordinary state. */
  | {
      readonly kind: 'RETURN_SUBJECT';
      readonly subjectType: string;
      readonly subjectId: string;
      readonly toState: 'INDEXED';
      readonly toDepartment: string;
      readonly because: string;
    }
  /**
   * The answer, written onto the work item. Paths come from the reason's own
   * `applyOnAccept` map, so what a reason may write is declared in the
   * catalogue and approved with it — never decided at answer time.
   */
  | {
      readonly kind: 'PATCH_SUBJECT';
      readonly subjectType: string;
      readonly subjectId: string;
      readonly set: Readonly<Record<string, unknown>>;
      readonly because: string;
    }
  /**
   * Offer this item to a department's queue, or take it back off. Allocation
   * decides WHO — this engine never picks a person, because picking well needs
   * shift, capacity and skill, and an engine that learned those would slowly
   * become a second allocation engine disagreeing with the real one.
   */
  | {
      readonly kind: 'OFFER_WORK';
      readonly workId: string;
      readonly queueId: string;
      readonly subQueueId: string;
      readonly state: string;
      readonly available: boolean;
    }
  /** One line for the runtime's own event stream, so mining and metrics see it. */
  | {
      readonly kind: 'STAMP_EVENT';
      readonly name: string;
      readonly subjectType: string;
      readonly subjectId: string;
      readonly at: string;
      readonly facts: Readonly<Record<string, string | number | boolean | null>>;
    }
  /** Somebody should be told. The host owns the channel; the engine owns the "who". */
  | {
      readonly kind: 'NOTIFY';
      readonly audience: 'RAISER' | 'DEPARTMENT' | 'ESCALATION';
      readonly target: string;
      readonly subject: string;
      readonly urgency: 'NORMAL' | 'DUE' | 'BREACHED';
    };

/** Which side's clock a command left running, in the host's words. */
const clockOf = (holder: Side): string =>
  holder === 'ORIGINATOR' ? 'raiser' : holder === 'RESOLVER' ? 'resolver' : 'nobody';

const workIdOf = (handover: Handover): string => `${handover.subject.type}:${handover.subject.id}`;

/**
 * What the host must do to make the world agree with this handover.
 *
 * Computed from the BEFORE and AFTER of one command rather than from the
 * command's name, for one reason worth stating: several commands cause the
 * same movement (an answer and a withdrawal both send the item back), and
 * several do not move it at all (a comment, a tag-in). Reading the state
 * change means new commands get the right instructions without anyone
 * remembering to add them to a list.
 */
export const instructionsFor = (
  before: Handover | null,
  after: Handover,
  commandType: string,
  at: string,
): readonly Instruction[] => {
  const out: Instruction[] = [];
  const workId = workIdOf(after);
  const { type: subjectType, id: subjectId } = after.subject;

  const wasWithRaiser = before === null || before.holder === 'ORIGINATOR';
  const nowWithRaiser = after.holder === 'ORIGINATOR';
  const closed = after.status !== 'OPEN';
  const wasClosed = before !== null && before.status !== 'OPEN';

  // ---- the work item itself ------------------------------------------------
  if (before === null) {
    out.push({
      kind: 'MOVE_SUBJECT',
      subjectType,
      subjectId,
      toState: 'QUERY',
      toDepartment: after.destination ?? 'unrouted',
      fromDepartment: after.scope.department ?? null,
      blocking: after.blocking,
      because: `${after.reasonCode}: ${after.question.slice(0, 140)}`,
    });
  } else if (!wasClosed && closed) {
    out.push({
      kind: 'RETURN_SUBJECT',
      subjectType,
      subjectId,
      toState: 'INDEXED',
      toDepartment: after.scope.department ?? '',
      because: `query ${after.status.toLowerCase()}`,
    });
  } else if (!wasWithRaiser && nowWithRaiser) {
    // Answered or sent back for more: the item is the raiser's again, but the
    // query is still open, so the item stays in its query state.
    out.push({
      kind: 'MOVE_SUBJECT',
      subjectType,
      subjectId,
      toState: 'QUERY',
      toDepartment: after.scope.department ?? '',
      fromDepartment: before.destination,
      blocking: after.blocking,
      because: commandType === 'answer' ? 'answered — over to you' : 'sent back',
    });
  } else if (before.destination !== after.destination && after.destination !== null) {
    out.push({
      kind: 'MOVE_SUBJECT',
      subjectType,
      subjectId,
      toState: 'QUERY',
      toDepartment: after.destination,
      fromDepartment: before.destination,
      blocking: after.blocking,
      because: `routed on to ${after.destination}`,
    });
  }

  // ---- what allocation is allowed to hand out -----------------------------
  const offerable = !closed && after.holder === 'RESOLVER' && after.destination !== null;
  out.push({
    kind: 'OFFER_WORK',
    workId,
    queueId: after.destination ?? 'unrouted',
    subQueueId: after.destinationScope.subDepartment ?? after.destinationScope.department ?? '',
    state: closed ? 'QUERY_CLOSED' : nowWithRaiser ? 'QUERY_RETURNED' : 'QUERY_OPEN',
    available: offerable,
  });

  // ---- the event stream ----------------------------------------------------
  out.push({
    kind: 'STAMP_EVENT',
    name: `query.${commandType}`,
    subjectType,
    subjectId,
    at,
    facts: {
      handoverId: after.id,
      reason: after.reasonCode,
      category: after.categoryKey,
      department: after.destination,
      status: after.status,
      clockNowOn: clockOf(after.holder),
      round: after.round,
    },
  });

  // ---- who needs to know ---------------------------------------------------
  if (before !== null && !wasWithRaiser && nowWithRaiser && !closed) {
    out.push({
      kind: 'NOTIFY',
      audience: 'RAISER',
      target: after.createdBy,
      subject: `Your query on ${subjectId} has come back`,
      urgency: 'NORMAL',
    });
  }
  if ((before === null || before.destination !== after.destination) && after.destination !== null && !closed) {
    out.push({
      kind: 'NOTIFY',
      audience: 'DEPARTMENT',
      target: after.destination,
      subject: `A query has arrived: ${after.reasonCode} on ${subjectId}`,
      urgency: 'NORMAL',
    });
  }
  return out;
};

/**
 * A one-line reading of what a batch of instructions will do, for a host that
 * wants to log it, and for the person who has to debug it at 2am.
 */
export const describeInstructions = (instructions: readonly Instruction[]): string =>
  instructions
    .map((instruction) => {
      switch (instruction.kind) {
        case 'MOVE_SUBJECT':
          return `move ${instruction.subjectId} → ${instruction.toDepartment} (${instruction.toState})`;
        case 'RETURN_SUBJECT':
          return `return ${instruction.subjectId} → ${instruction.toDepartment}`;
        case 'PATCH_SUBJECT':
          return `patch ${instruction.subjectId}: ${Object.keys(instruction.set).join(', ')}`;
        case 'OFFER_WORK':
          return `${instruction.available ? 'offer' : 'withdraw'} ${instruction.workId} in ${instruction.queueId}`;
        case 'STAMP_EVENT':
          return `stamp ${instruction.name}`;
        case 'NOTIFY':
          return `tell ${instruction.audience.toLowerCase()} ${instruction.target}`;
      }
    })
    .join(' · ');
