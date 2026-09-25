import type {
  MiniEmailAddress,
  MiniEmailComposeAttachment,
  MiniEmailComposeDraft,
  MiniEmailComposeMode,
  MiniEmailError,
  MiniEmailMessage,
  ResolvedMiniEmailOptions
} from './types.js';
import { dedupeAddresses, formatAddress, sameAddress } from './adapters/mime.js';

/**
 * Building a reply, reply-all, forward or new mail.
 *
 * Pure functions over a message — no provider, no DOM, no state. What comes
 * out is a draft the adapters know how to send, with the threading ids already
 * attached so the reply cannot drift out of its conversation.
 */

/** Prefixes the provider itself would use. */
const REPLY_PREFIX = 'Re: ';
const FORWARD_PREFIX = 'Fwd: ';

/** Subject prefixes already meaning "reply", across common locales. */
const EXISTING_REPLY = /^\s*(re|aw|antw|sv|res|r)\s*(\[\d+\])?\s*:\s*/i;
const EXISTING_FORWARD = /^\s*(fwd?|wg|vs|tr|enc)\s*:\s*/i;

export function replySubject(subject: string): string {
  return EXISTING_REPLY.test(subject) ? subject : `${REPLY_PREFIX}${subject}`;
}

export function forwardSubject(subject: string): string {
  return EXISTING_FORWARD.test(subject) ? subject : `${FORWARD_PREFIX}${subject}`;
}

/**
 * Who a reply goes to.
 *
 * `Reply-To` wins over `From` when the sender set it — that is exactly what it
 * is for, and ignoring it sends the reply to a no-reply address.
 */
export function replyRecipients(message: MiniEmailMessage): readonly MiniEmailAddress[] {
  return message.replyTo.length ? message.replyTo : [message.from];
}

/**
 * Who a reply-all goes to.
 *
 * Everyone on the original except the mailbox replying, which would otherwise
 * receive its own reply. Bcc is deliberately not carried forward: those
 * recipients were hidden, and revealing them would be a leak.
 */
export function replyAllRecipients(
  message: MiniEmailMessage,
  self: MiniEmailAddress | undefined
): { readonly to: readonly MiniEmailAddress[]; readonly cc: readonly MiniEmailAddress[] } {
  const isSelf = (address: MiniEmailAddress): boolean =>
    self !== undefined && sameAddress(address, self);

  const to = dedupeAddresses([...replyRecipients(message), ...message.to]).filter(
    (address) => !isSelf(address)
  );
  const cc = dedupeAddresses(message.cc).filter(
    (address) => !isSelf(address) && !to.some((existing) => sameAddress(existing, address))
  );

  return { to, cc };
}

/** Formats the attribution line above a quote, the way mail clients do. */
export function attributionLine(message: MiniEmailMessage, locale?: string): string {
  const when = new Date(message.receivedAt);
  const stamp = Number.isNaN(when.getTime())
    ? message.receivedAt
    : when.toLocaleString(locale ?? undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
  return `On ${stamp}, ${formatAddress(message.from)} wrote:`;
}

/** Escapes text for safe placement inside the quote block. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the quoted block carried into a reply.
 *
 * The original body is embedded as-is inside a `blockquote`. It is the
 * sender's own markup, and it will be sanitized again on the way back in when
 * the reply is later read, so it is not re-cleaned here.
 */
export function buildQuote(message: MiniEmailMessage, locale?: string): string {
  const attribution = escapeHtml(attributionLine(message, locale));
  const body =
    message.body.kind === 'html'
      ? message.body.content
      : `<pre style="white-space: pre-wrap; font-family: inherit">${escapeHtml(
          message.body.content
        )}</pre>`;

  return [
    `<div class="gmail_quote">`,
    `<div dir="ltr">${attribution}</div>`,
    `<blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">`,
    body,
    `</blockquote>`,
    `</div>`
  ].join('');
}

/** Header block a forward carries above the original message. */
export function forwardHeaderBlock(message: MiniEmailMessage): string {
  const rows: string[] = [
    `From: ${escapeHtml(formatAddress(message.from))}`,
    `Date: ${escapeHtml(message.receivedAt)}`,
    `Subject: ${escapeHtml(message.subject)}`,
    `To: ${escapeHtml(message.to.map(formatAddress).join(', '))}`
  ];
  if (message.cc.length) {
    rows.push(`Cc: ${escapeHtml(message.cc.map(formatAddress).join(', '))}`);
  }

  return [
    `<div class="gmail_quote">`,
    `<div dir="ltr">---------- Forwarded message ----------</div>`,
    `<div dir="ltr">${rows.join('<br>')}</div>`,
    `<br>`,
    message.body.kind === 'html'
      ? message.body.content
      : `<pre style="white-space: pre-wrap; font-family: inherit">${escapeHtml(
          message.body.content
        )}</pre>`,
    `</div>`
  ].join('');
}

export interface ComposeInput {
  readonly mode: MiniEmailComposeMode;
  /** The message being answered. Absent only for `new`. */
  readonly source?: MiniEmailMessage;
  /** The mailbox the connector owns; excluded from reply-all. */
  readonly self?: MiniEmailAddress;
  readonly options: ResolvedMiniEmailOptions;
  readonly locale?: string;
}

/**
 * Builds an opening draft.
 *
 * Everything a reader would expect the provider to have filled in already:
 * recipients, subject prefix, quoted original, forwarded attachments, and the
 * threading ids that keep the reply in its conversation.
 */
export function createDraft(input: ComposeInput): MiniEmailComposeDraft {
  const { mode, source, self, options, locale } = input;

  if (mode === 'new' || !source) {
    return {
      mode: 'new',
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      body: { kind: 'html', content: '' },
      attachments: []
    };
  }

  const threadContext = {
    conversationId: source.conversationId,
    ...(source.headers.messageId ? { messageIdHeader: source.headers.messageId } : {}),
    // The new reply extends the chain rather than replacing it, which is what
    // keeps deep threads intact in every client that reads them.
    references: [
      ...(source.headers.references ?? []),
      ...(source.headers.messageId ? [source.headers.messageId] : [])
    ]
  };

  if (mode === 'forward') {
    return {
      mode,
      inReplyToMessageId: source.id,
      to: [],
      cc: [],
      bcc: [],
      subject: forwardSubject(source.subject),
      body: {
        kind: 'html',
        content: `<div><br></div>${forwardHeaderBlock(source)}`
      },
      // Forwarding without the attachments would drop the very thing most
      // forwards exist to pass on. Bytes are filled in by the engine, which
      // knows whether the connector may fetch them.
      attachments: [],
      threadContext
    };
  }

  const recipients =
    mode === 'replyAll'
      ? replyAllRecipients(source, self)
      : { to: replyRecipients(source), cc: [] as readonly MiniEmailAddress[] };

  const quote = options.quoteOriginalOnReply ? buildQuote(source, locale) : '';

  return {
    mode,
    inReplyToMessageId: source.id,
    to: recipients.to,
    cc: recipients.cc,
    bcc: [],
    subject: replySubject(source.subject),
    body: { kind: 'html', content: `<div><br></div>${quote}` },
    attachments: [],
    threadContext
  };
}

/* ── participants ────────────────────────────────────────────────────────── */

export type ParticipantField = 'to' | 'cc' | 'bcc';

/** Adds a participant, refusing a duplicate on the same line. */
export function addParticipant(
  draft: MiniEmailComposeDraft,
  field: ParticipantField,
  address: MiniEmailAddress
): MiniEmailComposeDraft {
  const existing = draft[field];
  if (existing.some((entry) => sameAddress(entry, address))) return draft;
  return { ...draft, [field]: [...existing, address] };
}

/** Removes a participant from one line. */
export function removeParticipant(
  draft: MiniEmailComposeDraft,
  field: ParticipantField,
  address: MiniEmailAddress
): MiniEmailComposeDraft {
  return {
    ...draft,
    [field]: draft[field].filter((entry) => !sameAddress(entry, address))
  };
}

/** Moves a participant between lines, e.g. To → Cc. */
export function moveParticipant(
  draft: MiniEmailComposeDraft,
  from: ParticipantField,
  to: ParticipantField,
  address: MiniEmailAddress
): MiniEmailComposeDraft {
  if (from === to) return draft;
  return addParticipant(removeParticipant(draft, from, address), to, address);
}

/* ── validation ──────────────────────────────────────────────────────────── */

/**
 * Deliberately permissive.
 *
 * The provider is the real authority on whether an address exists, and a
 * stricter local rule would reject valid but unusual addresses. This catches
 * only what is obviously not an address at all.
 */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(value: string): boolean {
  return PLAUSIBLE_EMAIL.test(value.trim());
}

/** Checks a draft is sendable, reporting the first blocking problem. */
export function validateDraft(
  draft: MiniEmailComposeDraft,
  options: ResolvedMiniEmailOptions
): MiniEmailError | undefined {
  const recipients = [...draft.to, ...draft.cc, ...draft.bcc];

  if (recipients.length === 0) {
    return {
      code: 'sendFailed',
      message: 'Add at least one recipient before sending.',
      retryable: false
    };
  }

  const bad = recipients.find((address) => !isPlausibleEmail(address.email));
  if (bad) {
    return {
      code: 'sendFailed',
      message: `"${bad.email}" does not look like an email address.`,
      retryable: false
    };
  }

  const limit = options.maxAttachmentMb * 1024 * 1024;
  const oversized = draft.attachments.find((attachment) => attachment.sizeBytes > limit);
  if (oversized) {
    return {
      code: 'attachmentTooLarge',
      message: `"${oversized.filename}" is larger than the ${options.maxAttachmentMb} MB limit.`,
      retryable: false
    };
  }

  if (options.allowedAttachmentTypes !== 'any') {
    const allowed = options.allowedAttachmentTypes;
    const rejected = draft.attachments.find(
      (attachment) => !allowed.includes(attachment.mimeType)
    );
    if (rejected) {
      return {
        code: 'attachmentTypeNotAllowed',
        message: `"${rejected.filename}" is not an allowed file type.`,
        retryable: false
      };
    }
  }

  return undefined;
}

/** Checks one attachment before it is added, so the reader hears immediately. */
export function validateAttachment(
  attachment: MiniEmailComposeAttachment,
  options: ResolvedMiniEmailOptions
): MiniEmailError | undefined {
  if (attachment.sizeBytes > options.maxAttachmentMb * 1024 * 1024) {
    return {
      code: 'attachmentTooLarge',
      message: `"${attachment.filename}" is larger than the ${options.maxAttachmentMb} MB limit.`,
      retryable: false
    };
  }

  if (
    options.allowedAttachmentTypes !== 'any' &&
    !options.allowedAttachmentTypes.includes(attachment.mimeType)
  ) {
    return {
      code: 'attachmentTypeNotAllowed',
      message: `"${attachment.filename}" is not an allowed file type.`,
      retryable: false
    };
  }

  return undefined;
}
