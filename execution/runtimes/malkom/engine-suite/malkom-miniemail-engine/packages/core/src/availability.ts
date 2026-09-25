import type {
  MalkomHostSwitches,
  MiniEmailAction,
  MiniEmailAvailability,
  MiniEmailBlockReason,
  MiniEmailCapabilities,
  ResolvedMiniEmailOptions
} from './types.js';

/**
 * Which actions the panel may offer.
 *
 * Two layers decide, in order:
 *
 *   connector capability  →  config
 *      (can it?)             (does the host want it?)
 *
 * Both must agree. Capability is a fact about the connection; config is the
 * host's decision, with its role rules already resolved into booleans. The
 * engine has no concept of roles and never asks who decided.
 *
 * When an action is unavailable the reason is reported, so the host can tell
 * the user why a button is missing instead of leaving a silent gap.
 */

const ALL_ACTIONS: readonly MiniEmailAction[] = [
  'read',
  'search',
  'reply',
  'replyAll',
  'forward',
  'newMail',
  'editParticipants',
  'attach',
  'send',
  'saveDraft',
  'downloadAttachment'
];

/** Which capability each action needs. */
const REQUIRED_CAPABILITY: Readonly<Record<MiniEmailAction, keyof MiniEmailCapabilities>> = {
  read: 'canRead',
  search: 'canSearch',
  // Composing a reply is useless without the ability to send it, so the
  // compose actions are gated on sending rather than on reading.
  reply: 'canSend',
  replyAll: 'canSend',
  forward: 'canSend',
  newMail: 'canSend',
  editParticipants: 'canModifyParticipants',
  attach: 'canSend',
  send: 'canSend',
  saveDraft: 'canDraft',
  downloadAttachment: 'canFetchAttachments'
};

/** Which config switch each action reads. `undefined` means always wanted. */
function configAllows(
  action: MiniEmailAction,
  options: ResolvedMiniEmailOptions
): boolean {
  switch (action) {
    case 'read':
      return true;
    case 'search':
      return options.searchEnabled;
    case 'reply':
      return options.replyEnabled;
    case 'replyAll':
      return options.replyAllEnabled;
    case 'forward':
      return options.forwardEnabled;
    case 'newMail':
      return options.newMailEnabled;
    case 'editParticipants':
      return options.participantEditEnabled;
    case 'attach':
      return options.attachmentsEnabled;
    case 'send':
      // Sending is offered when at least one way of composing exists.
      return (
        options.replyEnabled ||
        options.replyAllEnabled ||
        options.forwardEnabled ||
        options.newMailEnabled
      );
    case 'saveDraft':
      return options.draftMode !== 'off';
    case 'downloadAttachment':
      return options.attachmentsEnabled;
    default: {
      const unreachable: never = action;
      throw new Error(`Unhandled action ${String(unreachable)}`);
    }
  }
}

export interface AvailabilityInput {
  readonly capabilities: MiniEmailCapabilities | undefined;
  readonly options: ResolvedMiniEmailOptions;
  /** Family-wide switches from the connector base. */
  readonly switches?: MalkomHostSwitches | undefined;
}

/**
 * Resolves every action at once.
 *
 * Done as a whole rather than per button so the answer cannot drift between
 * two places in the UI asking the same question.
 */
export function resolveAvailability(input: AvailabilityInput): MiniEmailAvailability {
  const { capabilities, options, switches } = input;

  const engineOff = switches?.engineEnabled === false;
  const readOnly = switches?.writeEnabled === false;

  const entries = ALL_ACTIONS.map((action) => {
    // Until capabilities are known, nothing is offered — better a missing
    // button for a moment than one that fails when pressed.
    if (!capabilities || engineOff) {
      return [action, { allowed: false, reason: 'connectorCapability' as const }] as const;
    }

    if (!capabilities[REQUIRED_CAPABILITY[action]]) {
      return [action, { allowed: false, reason: 'connectorCapability' as const }] as const;
    }

    const mutating = action !== 'read' && action !== 'search' && action !== 'downloadAttachment';
    if (readOnly && mutating) {
      return [action, { allowed: false, reason: 'hostConfig' as const }] as const;
    }

    if (!configAllows(action, options)) {
      return [action, { allowed: false, reason: 'hostConfig' as const }] as const;
    }

    return [action, { allowed: true }] as const;
  });

  return Object.fromEntries(entries) as MiniEmailAvailability;
}

/** Convenience for guard clauses inside the engine. */
export function isAllowed(
  availability: MiniEmailAvailability,
  action: MiniEmailAction
): boolean {
  return availability[action].allowed;
}

export function blockReason(
  availability: MiniEmailAvailability,
  action: MiniEmailAction
): MiniEmailBlockReason | undefined {
  return availability[action].reason;
}
