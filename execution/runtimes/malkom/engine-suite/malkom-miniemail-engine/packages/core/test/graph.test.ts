import { describe, expect, it } from 'vitest';
import { GraphAdapter, buildGraphFilter, buildGraphSearch } from '../src/adapters/graph.js';
import type { AdapterContext } from '../src/adapters/adapter.js';
import { FakeConnection } from './helpers/connection.js';
import type { MiniEmailComposeDraft } from '../src/types.js';

function setup(): { connection: FakeConnection; adapter: GraphAdapter } {
  const connection = new FakeConnection('outlook');
  const context: AdapterContext = { connection, fetchTimeoutMs: 5_000, retryAttempts: 1 };
  return { connection, adapter: new GraphAdapter(context) };
}

function graphMessage(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'AAMk-1',
    conversationId: 'conv-1',
    subject: 'Invoice 4471',
    from: { emailAddress: { name: 'Asha Patel', address: 'asha@example.com' } },
    toRecipients: [{ emailAddress: { address: 'ops@malkom.test' } }],
    ccRecipients: [{ emailAddress: { name: 'Audit', address: 'audit@example.com' } }],
    bccRecipients: [],
    replyTo: [],
    receivedDateTime: '2026-08-12T09:15:00Z',
    sentDateTime: '2026-08-12T09:14:58Z',
    internetMessageId: '<abc@outlook.com>',
    bodyPreview: 'Please find the invoice',
    isRead: true,
    isDraft: false,
    body: { contentType: 'HTML', content: '<p>Please find the invoice</p>' },
    attachments: [
      {
        id: 'att-1',
        name: 'logo.png',
        contentType: 'image/png',
        size: 120,
        isInline: true,
        contentId: '<logo1>',
        contentBytes: 'AQID'
      }
    ],
    ...over
  };
}

describe('GraphAdapter — fetchThread', () => {
  it('assembles the thread from a filtered message list', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    const thread = await adapter.fetchThread('conv-1', 'AAMk-1');

    expect(thread.conversationId).toBe('conv-1');
    expect(thread.subject).toBe('Invoice 4471');
    expect(thread.messages).toHaveLength(1);
  });

  it('filters by conversation and orders oldest first', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    await adapter.fetchThread('conv-1', 'AAMk-1');

    const query = connection.lastCall()?.query ?? {};
    expect(String(query['$filter'])).toContain("conversationId eq 'conv-1'");
    expect(query['$orderby']).toBe('receivedDateTime asc');
    expect(query['$expand']).toBe('attachments');
  });

  it('escapes a quote in the conversation id', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    await adapter.fetchThread("con'v", 'AAMk-1');

    expect(String(connection.lastCall()?.query?.['$filter'])).toContain("con''v");
  });

  it('reads the structured body without any MIME walking', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    const [message] = (await adapter.fetchThread('conv-1', 'AAMk-1')).messages;

    expect(message?.body.kind).toBe('html');
    expect(message?.body.content).toBe('<p>Please find the invoice</p>');
    expect(message?.body.textFallback).toBe('Please find the invoice');
  });

  it('unwraps Graph address objects', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    const [message] = (await adapter.fetchThread('conv-1', 'AAMk-1')).messages;

    expect(message?.from).toEqual({ email: 'asha@example.com', name: 'Asha Patel' });
    expect(message?.to).toEqual([{ email: 'ops@malkom.test' }]);
    expect(message?.cc).toEqual([{ email: 'audit@example.com', name: 'Audit' }]);
  });

  it('decodes attachment bytes that arrive inline with the message', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    const [message] = (await adapter.fetchThread('conv-1', 'AAMk-1')).messages;
    const attachment = message?.attachments[0];

    expect(attachment).toMatchObject({ isInline: true, contentId: 'logo1' });
    expect(new Uint8Array(attachment?.content ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  it('falls back to the single message when the conversation filter finds nothing', async () => {
    const { connection, adapter } = setup();
    connection
      .on('GET', '/me/messages', { value: [] })
      .on('GET', '/me/messages/AAMk-1', graphMessage());

    const thread = await adapter.fetchThread('conv-1', 'AAMk-1');

    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]?.id).toBe('AAMk-1');
  });

  it('keeps the internet message id for threading', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [graphMessage()] });

    const [message] = (await adapter.fetchThread('conv-1', 'AAMk-1')).messages;
    expect(message?.headers.messageId).toBe('<abc@outlook.com>');
  });
});

describe('Graph query building', () => {
  it('builds a KQL search from free text', () => {
    expect(buildGraphSearch({ text: 'invoice' })).toBe('"invoice"');
  });

  it('folds from and to into the search string', () => {
    expect(buildGraphSearch({ text: 'invoice', from: 'a@b.com' })).toBe(
      '"invoice from:a@b.com"'
    );
  });

  it('returns nothing when there is no text to search', () => {
    expect(buildGraphSearch({ text: '' })).toBeUndefined();
  });

  it('builds a filter for structured terms', () => {
    const filter = buildGraphFilter({
      text: '',
      from: 'a@b.com',
      hasAttachment: true,
      after: '2026-08-01T00:00:00Z'
    });
    expect(filter).toContain("from/emailAddress/address eq 'a@b.com'");
    expect(filter).toContain('hasAttachments eq true');
    expect(filter).toContain('receivedDateTime ge 2026-08-01T00:00:00Z');
  });
});

describe('GraphAdapter — search', () => {
  it('uses $search for free text and omits $orderby', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', {
      value: [
        {
          id: 'm1',
          conversationId: 'c1',
          subject: 'Found',
          from: { emailAddress: { address: 'a@b.com' } },
          receivedDateTime: '2026-08-12T09:00:00Z',
          hasAttachments: true
        }
      ]
    });

    const result = await adapter.search({ text: 'invoice' });

    expect(result.hits[0]).toMatchObject({
      messageId: 'm1',
      conversationId: 'c1',
      hasAttachments: true
    });
    const query = connection.lastCall()?.query ?? {};
    expect(query['$search']).toBe('"invoice"');
    expect(query['$orderby']).toBeUndefined();
  });

  it('uses $filter with ordering when there is no free text', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [] });

    await adapter.search({ text: '', hasAttachment: true });

    const query = connection.lastCall()?.query ?? {};
    expect(query['$filter']).toBe('hasAttachments eq true');
    expect(query['$orderby']).toBe('receivedDateTime desc');
    expect(query['$search']).toBeUndefined();
  });

  it('extracts the skiptoken from the next link', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', {
      value: [],
      '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$top=25&$skiptoken=ABC123'
    });

    expect((await adapter.search({ text: 'x' })).nextPageToken).toBe('ABC123');
  });

  it('reports no page token when the provider sent no next link', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { value: [] });

    expect((await adapter.search({ text: 'x' })).nextPageToken).toBeUndefined();
  });
});

describe('GraphAdapter — send', () => {
  const draft: MiniEmailComposeDraft = {
    mode: 'reply',
    to: [{ email: 'asha@example.com', name: 'Asha' }],
    cc: [],
    bcc: [],
    subject: 'Re: Invoice 4471',
    body: { kind: 'html', content: '<p>On its way.</p>' },
    attachments: [],
    threadContext: {
      conversationId: 'conv-1',
      messageIdHeader: '<abc@outlook.com>'
    }
  };

  it('sends structured JSON rather than MIME', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/sendMail', {}, 202);

    await adapter.send(draft);

    const body = connection.lastCall()?.body as Record<string, unknown>;
    const message = body['message'] as Record<string, unknown>;
    expect(message['subject']).toBe('Re: Invoice 4471');
    expect(message['body']).toEqual({ contentType: 'HTML', content: '<p>On its way.</p>' });
    expect(body['saveToSentItems']).toBe(true);
  });

  it('wraps recipients in Graph address objects', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/sendMail', {}, 202);

    await adapter.send(draft);

    const message = (connection.lastCall()?.body as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(message['toRecipients']).toEqual([
      { emailAddress: { address: 'asha@example.com', name: 'Asha' } }
    ]);
  });

  it('carries the conversation id and In-Reply-To header', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/sendMail', {}, 202);

    await adapter.send(draft);

    const message = (connection.lastCall()?.body as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(message['conversationId']).toBe('conv-1');
    expect(message['internetMessageHeaders']).toEqual([
      { name: 'In-Reply-To', value: '<abc@outlook.com>' }
    ]);
  });

  it('sends an existing draft by id instead of re-posting it', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/send', {}, 202);

    expect(await adapter.send({ ...draft, providerDraftId: 'draft-9' })).toBe('draft-9');
    expect(connection.lastCall()?.path).toContain('/messages/draft-9/send');
  });

  it('does not retry a send', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/sendMail', { error: 'boom' }, 503);

    await expect(adapter.send(draft)).rejects.toThrow();
    expect(connection.callsTo('/sendMail')).toHaveLength(1);
  });

  it('base64 encodes attachments', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/sendMail', {}, 202);

    await adapter.send({
      ...draft,
      attachments: [
        {
          id: 'a1',
          filename: 'note.txt',
          mimeType: 'text/plain',
          sizeBytes: 3,
          content: new Uint8Array([1, 2, 3]).buffer
        }
      ]
    });

    const message = (connection.lastCall()?.body as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(message['attachments']).toEqual([
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: 'note.txt',
        contentType: 'text/plain',
        contentBytes: 'AQID'
      }
    ]);
  });
});

describe('GraphAdapter — drafts', () => {
  const draft: MiniEmailComposeDraft = {
    mode: 'new',
    to: [{ email: 'a@b.com' }],
    cc: [],
    bcc: [],
    subject: 'Draft',
    body: { kind: 'text', content: 'wip' },
    attachments: []
  };

  it('creates a draft message', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/me/messages', { id: 'draft-1' });

    expect(await adapter.saveDraft(draft)).toBe('draft-1');
    expect(connection.lastCall()?.method).toBe('POST');
  });

  it('patches an existing draft', async () => {
    const { connection, adapter } = setup();
    connection.on('PATCH', '/me/messages/', { id: 'draft-1' });

    await adapter.saveDraft({ ...draft, providerDraftId: 'draft-1' });

    expect(connection.lastCall()?.method).toBe('PATCH');
    expect(connection.lastCall()?.path).toContain('/messages/draft-1');
  });
});

describe('GraphAdapter — error mapping', () => {
  it('reports an auth failure as authFailed, not retryable', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { error: 'denied' }, 403);

    await expect(adapter.fetchThread('c', 'm')).rejects.toMatchObject({
      detail: { code: 'authFailed', retryable: false }
    });
  });

  it('retries a rate limit before giving up', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/me/messages', { error: 'slow down' }, 429);

    await expect(adapter.fetchThread('c', 'm')).rejects.toMatchObject({
      detail: { code: 'rateLimited', retryable: true }
    });
    // One initial attempt plus the single configured retry.
    expect(connection.callsTo('/me/messages')).toHaveLength(2);
  });
});
