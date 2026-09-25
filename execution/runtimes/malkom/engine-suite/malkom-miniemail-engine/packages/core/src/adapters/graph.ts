import type {
  MiniEmailAddress,
  MiniEmailAttachment,
  MiniEmailBody,
  MiniEmailComposeDraft,
  MiniEmailMessage,
  MiniEmailSearchHit,
  MiniEmailSearchQuery,
  MiniEmailSearchResult,
  MiniEmailThread
} from '../types.js';
import {
  MiniEmailAdapterError,
  callProvider,
  expectRecord,
  readArray,
  readBoolean,
  readNumber,
  readRecord,
  readString,
  type AdapterContext,
  type MiniEmailAdapter
} from './adapter.js';
import { decodeBase64, encodeBase64 } from './mime.js';

/**
 * Microsoft Graph (Outlook) adapter.
 *
 * Shape of the provider, in brief:
 *  - a conversation is a `conversationId` **property on messages**, not an
 *    object you can fetch — so a thread is assembled with a filtered list
 *    query rather than a single get;
 *  - a message is already structured JSON: addresses, body and flags are
 *    fields, so there is no MIME tree to walk;
 *  - attachments are a sub-collection, with bytes in `contentBytes` as plain
 *    base64;
 *  - send takes structured JSON, so no RFC 5322 message is built;
 *  - replying through `createReply` / `reply` keeps threading correct without
 *    the engine handling headers at all.
 */

const BASE = '/v1.0/me';

/** Graph's `emailAddress` wrapper, which appears everywhere addresses do. */
function toAddress(value: unknown): MiniEmailAddress | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const wrapper = value as Readonly<Record<string, unknown>>;
  const inner = readRecord(wrapper, 'emailAddress') ?? wrapper;

  const email = readString(inner, 'address');
  if (!email) return undefined;

  const name = readString(inner, 'name');
  return name ? { email, name } : { email };
}

function toAddressList(values: readonly unknown[]): readonly MiniEmailAddress[] {
  const out: MiniEmailAddress[] = [];
  for (const value of values) {
    const address = toAddress(value);
    if (address) out.push(address);
  }
  return out;
}

/** Renders an address back into Graph's wrapper form. */
function fromAddress(address: MiniEmailAddress): Readonly<Record<string, unknown>> {
  return {
    emailAddress: {
      address: address.email,
      ...(address.name ? { name: address.name } : {})
    }
  };
}

function toBody(raw: Readonly<Record<string, unknown>>): MiniEmailBody {
  const body = readRecord(raw, 'body');
  const content = body ? readString(body, 'content') ?? '' : '';
  const contentType = body ? readString(body, 'contentType') ?? 'text' : 'text';
  const preview = readString(raw, 'bodyPreview');

  const kind = contentType.toLowerCase() === 'html' ? 'html' : 'text';
  return {
    kind,
    content,
    // Graph gives a plain-text preview rather than a full text alternative;
    // it is the only text form available without a second request.
    ...(kind === 'html' && preview ? { textFallback: preview } : {})
  };
}

function toAttachment(raw: Readonly<Record<string, unknown>>): MiniEmailAttachment | undefined {
  const id = readString(raw, 'id');
  if (!id) return undefined;

  const contentBytes = readString(raw, 'contentBytes');
  const contentId = readString(raw, 'contentId');

  return {
    id,
    filename: readString(raw, 'name') ?? 'attachment',
    mimeType: readString(raw, 'contentType') ?? 'application/octet-stream',
    sizeBytes: readNumber(raw, 'size') ?? 0,
    isInline: readBoolean(raw, 'isInline') ?? Boolean(contentId),
    ...(contentId ? { contentId: contentId.replace(/^<|>$/g, '') } : {}),
    ...(contentBytes ? { content: decodeBase64(contentBytes) } : {})
  };
}

function toMessage(raw: Readonly<Record<string, unknown>>): MiniEmailMessage {
  const id = readString(raw, 'id');
  if (!id) {
    throw new MiniEmailAdapterError({
      code: 'unexpected',
      message: 'Graph message is missing id.',
      retryable: false
    });
  }

  const from =
    toAddress(raw['from']) ?? toAddress(raw['sender']) ?? { email: 'unknown@unknown' };

  const received = readString(raw, 'receivedDateTime');
  const sent = readString(raw, 'sentDateTime');
  const internetMessageId = readString(raw, 'internetMessageId');
  const preview = readString(raw, 'bodyPreview');

  return {
    id,
    conversationId: readString(raw, 'conversationId') ?? '',
    subject: readString(raw, 'subject') ?? '',
    from,
    to: toAddressList(readArray(raw, 'toRecipients')),
    cc: toAddressList(readArray(raw, 'ccRecipients')),
    bcc: toAddressList(readArray(raw, 'bccRecipients')),
    replyTo: toAddressList(readArray(raw, 'replyTo')),
    receivedAt: received ?? new Date(0).toISOString(),
    ...(sent ? { sentAt: sent } : {}),
    body: toBody(raw),
    attachments: readArray(raw, 'attachments')
      .map((entry) => toAttachment(expectRecord(entry, 'Graph attachment')))
      .filter((entry): entry is MiniEmailAttachment => entry !== undefined),
    ...(preview ? { snippet: preview } : {}),
    isRead: readBoolean(raw, 'isRead') ?? false,
    isDraft: readBoolean(raw, 'isDraft') ?? false,
    headers: internetMessageId ? { messageId: internetMessageId } : {}
  };
}

/**
 * Builds a Graph `$filter` for structured search terms.
 *
 * Graph will not accept `$search` and `$filter` together, so free text and
 * structured terms are mutually exclusive. Free text wins when both are
 * present, because that is what the reader typed.
 */
export function buildGraphFilter(query: MiniEmailSearchQuery): string | undefined {
  const clauses: string[] = [];
  if (query.from) {
    clauses.push(`from/emailAddress/address eq '${query.from.replace(/'/g, "''")}'`);
  }
  if (query.hasAttachment) clauses.push('hasAttachments eq true');
  if (query.after) clauses.push(`receivedDateTime ge ${query.after}`);
  if (query.before) clauses.push(`receivedDateTime le ${query.before}`);
  return clauses.length ? clauses.join(' and ') : undefined;
}

/** Builds the KQL string Graph's `$search` expects. */
export function buildGraphSearch(query: MiniEmailSearchQuery): string | undefined {
  const terms: string[] = [];
  if (query.text.trim()) terms.push(query.text.trim());
  if (query.from) terms.push(`from:${query.from}`);
  if (query.to) terms.push(`to:${query.to}`);
  return terms.length ? `"${terms.join(' ').replace(/"/g, '')}"` : undefined;
}

export class GraphAdapter implements MiniEmailAdapter {
  readonly provider = 'outlook' as const;
  readonly #context: AdapterContext;

  constructor(context: AdapterContext) {
    this.#context = context;
  }

  async fetchThread(conversationId: string, messageId: string): Promise<MiniEmailThread> {
    // There is no "get conversation" endpoint. The thread is every message
    // carrying this conversationId, which is a filtered list.
    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages`,
      query: {
        $filter: `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
        $orderby: 'receivedDateTime asc',
        $expand: 'attachments',
        $top: 50
      },
      responseType: 'json'
    });

    const body = expectRecord(response.body, 'Graph thread');
    const messages = readArray(body, 'value').map((entry) =>
      toMessage(expectRecord(entry, 'Graph message'))
    );

    if (messages.length === 0) {
      // A filter that returns nothing usually means the message moved or the
      // mailbox scope is wrong; fall back to the single message so the reader
      // still sees the mail their task is about.
      const single = await this.#fetchMessage(messageId);
      return { conversationId, subject: single.subject, messages: [single] };
    }

    const anchor = messages.find((message) => message.id === messageId);
    return {
      conversationId,
      subject: anchor?.subject ?? messages[0]?.subject ?? '',
      messages
    };
  }

  async #fetchMessage(messageId: string): Promise<MiniEmailMessage> {
    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages/${encodeURIComponent(messageId)}`,
      query: { $expand: 'attachments' },
      responseType: 'json'
    });
    return toMessage(expectRecord(response.body, 'Graph message'));
  }

  async fetchAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<MiniEmailAttachment> {
    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      responseType: 'json'
    });

    const attachment = toAttachment(expectRecord(response.body, 'Graph attachment'));
    if (!attachment) {
      throw new MiniEmailAdapterError({
        code: 'notFound',
        message: `Graph attachment ${attachmentId} could not be read.`,
        retryable: false
      });
    }
    return attachment;
  }

  async search(query: MiniEmailSearchQuery): Promise<MiniEmailSearchResult> {
    const search = buildGraphSearch(query);
    const filter = search ? undefined : buildGraphFilter(query);

    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages`,
      query: {
        ...(search ? { $search: search } : {}),
        ...(filter ? { $filter: filter } : {}),
        // $orderby is rejected alongside $search, which sorts by relevance.
        ...(search ? {} : { $orderby: 'receivedDateTime desc' }),
        $select: 'id,conversationId,subject,from,receivedDateTime,bodyPreview,hasAttachments',
        $top: query.pageSize ?? 25,
        ...(query.pageToken ? { $skiptoken: query.pageToken } : {})
      },
      responseType: 'json'
    });

    const body = expectRecord(response.body, 'Graph search');
    const hits: MiniEmailSearchHit[] = [];

    for (const entry of readArray(body, 'value')) {
      const raw = expectRecord(entry, 'Graph search hit');
      const id = readString(raw, 'id');
      if (!id) continue;

      const preview = readString(raw, 'bodyPreview');
      hits.push({
        messageId: id,
        conversationId: readString(raw, 'conversationId') ?? '',
        subject: readString(raw, 'subject') ?? '',
        from: toAddress(raw['from']) ?? { email: 'unknown@unknown' },
        receivedAt: readString(raw, 'receivedDateTime') ?? new Date(0).toISOString(),
        ...(preview ? { snippet: preview } : {}),
        hasAttachments: readBoolean(raw, 'hasAttachments') ?? false
      });
    }

    // Graph pages with an opaque @odata.nextLink; the skiptoken inside it is
    // the only part that survives being handed back as a page token.
    const nextLink = readString(body, '@odata.nextLink');
    const skipToken = nextLink
      ? /[?&]\$skiptoken=([^&]+)/.exec(nextLink)?.[1]
      : undefined;

    return {
      hits,
      ...(skipToken ? { nextPageToken: decodeURIComponent(skipToken) } : {})
    };
  }

  async saveDraft(draft: MiniEmailComposeDraft): Promise<string> {
    const existing = draft.providerDraftId;

    const response = await callProvider(
      this.#context,
      {
        method: existing ? 'PATCH' : 'POST',
        path: existing
          ? `${BASE}/messages/${encodeURIComponent(existing)}`
          : `${BASE}/messages`,
        body: this.#toGraphMessage(draft),
        responseType: 'json'
      },
      { retry: false }
    );

    const body = expectRecord(response.body, 'Graph draft');
    const id = readString(body, 'id');
    if (!id) {
      throw new MiniEmailAdapterError({
        code: 'draftFailed',
        message: 'Graph did not return a draft id.',
        retryable: false
      });
    }
    return id;
  }

  async send(draft: MiniEmailComposeDraft): Promise<string> {
    // A saved draft is sent by id, which preserves whatever the reader edited
    // server-side; anything else goes through sendMail in one call.
    if (draft.providerDraftId) {
      await callProvider(
        this.#context,
        {
          method: 'POST',
          path: `${BASE}/messages/${encodeURIComponent(draft.providerDraftId)}/send`,
          responseType: 'json'
        },
        { retry: false }
      );
      return draft.providerDraftId;
    }

    await callProvider(
      this.#context,
      {
        method: 'POST',
        path: `${BASE}/sendMail`,
        body: { message: this.#toGraphMessage(draft), saveToSentItems: true },
        responseType: 'json'
      },
      // Never retried — a resend would deliver twice.
      { retry: false }
    );

    // sendMail returns 202 with no body, so there is no provider id to report.
    // The draft's own id is the best stable reference the engine has.
    return draft.providerDraftId ?? '';
  }

  async deleteDraft(draftId: string): Promise<void> {
    await callProvider(
      this.#context,
      {
        method: 'DELETE',
        path: `${BASE}/messages/${encodeURIComponent(draftId)}`,
        responseType: 'json'
      },
      { retry: false }
    );
  }

  #toGraphMessage(draft: MiniEmailComposeDraft): Readonly<Record<string, unknown>> {
    return {
      subject: draft.subject,
      body: {
        contentType: draft.body.kind === 'html' ? 'HTML' : 'Text',
        content: draft.body.content
      },
      toRecipients: draft.to.map(fromAddress),
      ccRecipients: draft.cc.map(fromAddress),
      bccRecipients: draft.bcc.map(fromAddress),
      ...(draft.attachments.length
        ? {
            attachments: draft.attachments.map((attachment) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: attachment.filename,
              contentType: attachment.mimeType,
              contentBytes: encodeBase64(attachment.content)
            }))
          }
        : {}),
      // Graph threads replies by these two fields; the engine sets them from
      // the message being answered.
      ...(draft.threadContext?.conversationId
        ? { conversationId: draft.threadContext.conversationId }
        : {}),
      ...(draft.threadContext?.messageIdHeader
        ? { internetMessageHeaders: [
            { name: 'In-Reply-To', value: draft.threadContext.messageIdHeader }
          ] }
        : {})
    };
  }
}
