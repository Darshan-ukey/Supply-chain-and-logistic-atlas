import type {
  MiniEmailAttachment,
  MiniEmailBody,
  MiniEmailComposeDraft,
  MiniEmailMessage,
  MiniEmailSearchHit,
  MiniEmailSearchQuery,
  MiniEmailSearchResult,
  MiniEmailThread,
  MiniEmailThreadHeaders
} from '../types.js';
import {
  MiniEmailAdapterError,
  callProvider,
  expectRecord,
  readArray,
  readNumber,
  readString,
  type AdapterContext,
  type MiniEmailAdapter
} from './adapter.js';
import {
  base64ToBase64Url,
  buildRfc822Message,
  decodeBase64Url,
  decodeBase64UrlText,
  encodeBase64,
  parseAddress,
  parseAddressList
} from './mime.js';

/**
 * Gmail adapter.
 *
 * Shape of the provider, in brief:
 *  - a conversation is a **thread**, and `threads.get` returns every message
 *    in it in one call — cheaper and more consistent than fetching messages
 *    one at a time;
 *  - a message is a nested tree of MIME **parts**; the body is somewhere in
 *    that tree and has to be found, not read off a field;
 *  - all payload data is **base64url**, not base64;
 *  - send takes a raw RFC 5322 message, so the engine builds one.
 */

const BASE = '/gmail/v1/users/me';

/** One node of Gmail's MIME part tree. */
interface GmailPart {
  readonly partId?: string;
  readonly mimeType?: string;
  readonly filename?: string;
  readonly headers?: readonly { readonly name?: string; readonly value?: string }[];
  readonly body?: {
    readonly attachmentId?: string;
    readonly size?: number;
    readonly data?: string;
  };
  readonly parts?: readonly GmailPart[];
}

function asPart(value: unknown): GmailPart | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as GmailPart;
  }
  return undefined;
}

/** Reads a header off a part, case-insensitively. */
function header(part: GmailPart, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const entry of part.headers ?? []) {
    if (entry.name?.toLowerCase() === wanted) return entry.value;
  }
  return undefined;
}

/** Walks the part tree depth-first. */
function* walkParts(part: GmailPart): Generator<GmailPart> {
  yield part;
  for (const child of part.parts ?? []) yield* walkParts(child);
}

/**
 * Finds the body to display.
 *
 * Gmail nests alternatives: `multipart/alternative` holds both a text and an
 * HTML rendering of the same content. HTML is preferred because it is what the
 * sender actually composed; text is kept as a fallback for the reply quote and
 * for mail that has no HTML at all.
 */
function extractBody(root: GmailPart): MiniEmailBody {
  let html: string | undefined;
  let text: string | undefined;

  for (const part of walkParts(root)) {
    // A part with a filename is an attachment, even when its type is text.
    if (part.filename) continue;

    const data = part.body?.data;
    if (!data) continue;

    if (part.mimeType === 'text/html' && html === undefined) {
      html = decodeBase64UrlText(data);
    } else if (part.mimeType === 'text/plain' && text === undefined) {
      text = decodeBase64UrlText(data);
    }
  }

  if (html !== undefined) {
    return text === undefined
      ? { kind: 'html', content: html }
      : { kind: 'html', content: html, textFallback: text };
  }
  return { kind: 'text', content: text ?? '' };
}

/**
 * Collects attachment metadata, without bytes.
 *
 * Bytes are a separate call per attachment, so they are fetched only when
 * something needs them — an inline image being resolved, or a download.
 */
function extractAttachments(root: GmailPart): readonly MiniEmailAttachment[] {
  const out: MiniEmailAttachment[] = [];

  for (const part of walkParts(root)) {
    const attachmentId = part.body?.attachmentId;
    if (!attachmentId) continue;

    const disposition = header(part, 'Content-Disposition') ?? '';
    const contentId = header(part, 'Content-ID');
    // Inline parts are referenced by the body via `cid:`; Gmail marks them
    // either by disposition or simply by carrying a Content-ID.
    const isInline = /inline/i.test(disposition) || Boolean(contentId);

    const attachment: MiniEmailAttachment = {
      id: attachmentId,
      filename: part.filename || 'attachment',
      mimeType: part.mimeType ?? 'application/octet-stream',
      sizeBytes: part.body?.size ?? 0,
      isInline,
      ...(contentId ? { contentId: contentId.replace(/^<|>$/g, '') } : {})
    };
    out.push(attachment);
  }

  return out;
}

function extractThreadHeaders(root: GmailPart): MiniEmailThreadHeaders {
  const messageId = header(root, 'Message-ID');
  const inReplyTo = header(root, 'In-Reply-To');
  const references = header(root, 'References');

  return {
    ...(messageId ? { messageId } : {}),
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references ? { references: references.split(/\s+/).filter(Boolean) } : {})
  };
}

function toMessage(raw: Readonly<Record<string, unknown>>): MiniEmailMessage {
  const id = readString(raw, 'id');
  const threadId = readString(raw, 'threadId');
  if (!id || !threadId) {
    throw new MiniEmailAdapterError({
      code: 'unexpected',
      message: 'Gmail message is missing id or threadId.',
      retryable: false
    });
  }

  const payload = asPart(raw['payload']) ?? {};
  const fromHeader = header(payload, 'From');
  const from = (fromHeader ? parseAddress(fromHeader) : undefined) ?? {
    email: 'unknown@unknown'
  };

  // `internalDate` is epoch milliseconds as a string, and is the value Gmail
  // itself sorts by — more reliable than the Date header, which the sender
  // controls.
  const internalDate = readString(raw, 'internalDate');
  const receivedAt = internalDate
    ? new Date(Number(internalDate)).toISOString()
    : new Date(0).toISOString();

  const dateHeader = header(payload, 'Date');
  const labels = readArray(raw, 'labelIds').filter(
    (label): label is string => typeof label === 'string'
  );
  const snippet = readString(raw, 'snippet');

  return {
    id,
    conversationId: threadId,
    subject: header(payload, 'Subject') ?? '',
    from,
    to: parseAddressList(header(payload, 'To')),
    cc: parseAddressList(header(payload, 'Cc')),
    bcc: parseAddressList(header(payload, 'Bcc')),
    replyTo: parseAddressList(header(payload, 'Reply-To')),
    receivedAt,
    ...(dateHeader ? { sentAt: new Date(dateHeader).toISOString() } : {}),
    body: extractBody(payload),
    attachments: extractAttachments(payload),
    ...(snippet ? { snippet } : {}),
    isRead: !labels.includes('UNREAD'),
    isDraft: labels.includes('DRAFT'),
    headers: extractThreadHeaders(payload)
  };
}

/**
 * Translates the engine's structured query into Gmail search syntax.
 *
 * Gmail takes one `q` string, so the structured fields are folded into
 * operators. Free text goes in as-is, which lets a user who knows Gmail
 * syntax type it directly.
 */
export function buildGmailQuery(query: MiniEmailSearchQuery): string {
  const terms: string[] = [];
  if (query.text.trim()) terms.push(query.text.trim());
  if (query.from) terms.push(`from:${query.from}`);
  if (query.to) terms.push(`to:${query.to}`);
  if (query.hasAttachment) terms.push('has:attachment');
  // Gmail's after/before take dates, not timestamps.
  if (query.after) terms.push(`after:${query.after.slice(0, 10).replace(/-/g, '/')}`);
  if (query.before) terms.push(`before:${query.before.slice(0, 10).replace(/-/g, '/')}`);
  return terms.join(' ');
}

export class GmailAdapter implements MiniEmailAdapter {
  readonly provider = 'gmail' as const;
  readonly #context: AdapterContext;

  constructor(context: AdapterContext) {
    this.#context = context;
  }

  async fetchThread(conversationId: string, messageId: string): Promise<MiniEmailThread> {
    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/threads/${encodeURIComponent(conversationId)}`,
      query: { format: 'full' },
      responseType: 'json'
    });

    const body = expectRecord(response.body, 'Gmail thread');
    const messages = readArray(body, 'messages')
      .map((entry) => toMessage(expectRecord(entry, 'Gmail message')))
      // Gmail returns thread messages in order, but a thread edited on another
      // client can arrive out of order; sorting keeps the reader's view stable.
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    if (messages.length === 0) {
      throw new MiniEmailAdapterError({
        code: 'notFound',
        message: `Gmail thread ${conversationId} contains no messages.`,
        retryable: false
      });
    }

    const anchor = messages.find((message) => message.id === messageId);
    return {
      conversationId,
      // The anchor's subject is the one the task was raised against; a later
      // reply may have changed it.
      subject: anchor?.subject ?? messages[0]?.subject ?? '',
      messages
    };
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

    const body = expectRecord(response.body, 'Gmail attachment');
    const data = readString(body, 'data');
    if (!data) {
      throw new MiniEmailAdapterError({
        code: 'notFound',
        message: `Gmail attachment ${attachmentId} returned no data.`,
        retryable: false
      });
    }

    const content = decodeBase64Url(data);
    return {
      id: attachmentId,
      filename: 'attachment',
      mimeType: 'application/octet-stream',
      sizeBytes: readNumber(body, 'size') ?? content.byteLength,
      isInline: false,
      content
    };
  }

  async search(query: MiniEmailSearchQuery): Promise<MiniEmailSearchResult> {
    const listResponse = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages`,
      query: {
        q: buildGmailQuery(query),
        maxResults: query.pageSize ?? 25,
        ...(query.pageToken ? { pageToken: query.pageToken } : {})
      },
      responseType: 'json'
    });

    const list = expectRecord(listResponse.body, 'Gmail search');
    const ids = readArray(list, 'messages')
      .map((entry) => readString(expectRecord(entry, 'Gmail search row'), 'id'))
      .filter((id): id is string => Boolean(id));

    // The list endpoint returns ids only, so each hit needs a metadata read to
    // show a sender and subject. `format=metadata` keeps that cheap — no
    // bodies, no attachments.
    const hits = await Promise.all(ids.map((id) => this.#fetchHit(id)));

    const nextPageToken = readString(list, 'nextPageToken');
    const estimate = readNumber(list, 'resultSizeEstimate');

    return {
      hits: hits.filter((hit): hit is MiniEmailSearchHit => hit !== undefined),
      ...(nextPageToken ? { nextPageToken } : {}),
      ...(estimate !== undefined ? { estimatedTotal: estimate } : {})
    };
  }

  async #fetchHit(id: string): Promise<MiniEmailSearchHit | undefined> {
    const response = await callProvider(this.#context, {
      method: 'GET',
      path: `${BASE}/messages/${encodeURIComponent(id)}`,
      query: {
        format: 'metadata',
        // Repeated query keys are not expressible here, so the header filter
        // goes as one comma-joined value; Gmail accepts both forms.
        metadataHeaders: 'From,Subject,Date'
      },
      responseType: 'json'
    });

    const raw = expectRecord(response.body, 'Gmail search hit');
    const payload = asPart(raw['payload']) ?? {};
    const threadId = readString(raw, 'threadId');
    if (!threadId) return undefined;

    const fromHeader = header(payload, 'From');
    const internalDate = readString(raw, 'internalDate');
    const snippet = readString(raw, 'snippet');

    return {
      messageId: id,
      conversationId: threadId,
      subject: header(payload, 'Subject') ?? '',
      from: (fromHeader ? parseAddress(fromHeader) : undefined) ?? { email: 'unknown@unknown' },
      receivedAt: internalDate
        ? new Date(Number(internalDate)).toISOString()
        : new Date(0).toISOString(),
      ...(snippet ? { snippet } : {}),
      // Metadata format omits the part tree, so attachment presence is not
      // knowable here without a second full read per hit.
      hasAttachments: false
    };
  }

  async saveDraft(draft: MiniEmailComposeDraft): Promise<string> {
    const raw = this.#buildRaw(draft);
    const existing = draft.providerDraftId;

    const response = await callProvider(
      this.#context,
      {
        method: existing ? 'PUT' : 'POST',
        path: existing
          ? `${BASE}/drafts/${encodeURIComponent(existing)}`
          : `${BASE}/drafts`,
        body: { message: { raw } },
        responseType: 'json'
      },
      { retry: false }
    );

    const body = expectRecord(response.body, 'Gmail draft');
    const id = readString(body, 'id');
    if (!id) {
      throw new MiniEmailAdapterError({
        code: 'draftFailed',
        message: 'Gmail did not return a draft id.',
        retryable: false
      });
    }
    return id;
  }

  async send(draft: MiniEmailComposeDraft): Promise<string> {
    const message: Record<string, unknown> = { raw: this.#buildRaw(draft) };

    // Supplying the thread id is what makes Gmail file the reply inside the
    // existing conversation rather than starting a new one.
    if (draft.mode !== 'new' && draft.threadContext) {
      message['threadId'] = draft.threadContext.conversationId;
    }

    const response = await callProvider(
      this.#context,
      {
        method: 'POST',
        path: `${BASE}/messages/send`,
        body: message,
        responseType: 'json'
      },
      // Never retried: a resend would deliver the same mail twice, and the
      // reader has no way to take that back.
      { retry: false }
    );

    const body = expectRecord(response.body, 'Gmail send');
    const id = readString(body, 'id');
    if (!id) {
      throw new MiniEmailAdapterError({
        code: 'sendFailed',
        message: 'Gmail did not confirm a sent message id.',
        retryable: false
      });
    }
    return id;
  }

  async deleteDraft(draftId: string): Promise<void> {
    await callProvider(
      this.#context,
      {
        method: 'DELETE',
        path: `${BASE}/drafts/${encodeURIComponent(draftId)}`,
        responseType: 'json'
      },
      { retry: false }
    );
  }

  #buildRaw(draft: MiniEmailComposeDraft): string {
    const inReplyTo = draft.threadContext?.messageIdHeader;
    const references = draft.threadContext?.references ?? [];

    const mime = buildRfc822Message({
      draft,
      ...(inReplyTo ? { inReplyTo } : {}),
      ...(references.length ? { references } : {})
    });

    return base64ToBase64Url(
      encodeBase64(new TextEncoder().encode(mime).buffer as ArrayBuffer)
    );
  }
}
