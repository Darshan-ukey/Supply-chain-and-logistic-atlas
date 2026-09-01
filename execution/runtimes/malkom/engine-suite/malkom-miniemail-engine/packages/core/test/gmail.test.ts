import { describe, expect, it } from 'vitest';
import { GmailAdapter, buildGmailQuery } from '../src/adapters/gmail.js';
import { MiniEmailAdapterError, type AdapterContext } from '../src/adapters/adapter.js';
import { FakeConnection, gmailData } from './helpers/connection.js';
import type { MiniEmailComposeDraft } from '../src/types.js';

function setup(): { connection: FakeConnection; adapter: GmailAdapter } {
  const connection = new FakeConnection('gmail');
  const context: AdapterContext = { connection, fetchTimeoutMs: 5_000, retryAttempts: 1 };
  return { connection, adapter: new GmailAdapter(context) };
}

/** A Gmail message with an alternative body and one inline image. */
function gmailMessage(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    internalDate: '1755000000000',
    snippet: 'Invoice attached',
    labelIds: ['INBOX'],
    payload: {
      mimeType: 'multipart/mixed',
      headers: [
        { name: 'Subject', value: 'Invoice 4471' },
        { name: 'From', value: 'Asha Patel <asha@example.com>' },
        { name: 'To', value: 'ops@malkom.test, "Rao, Vik" <vik@example.com>' },
        { name: 'Cc', value: 'audit@example.com' },
        { name: 'Message-ID', value: '<abc@mail.example.com>' },
        { name: 'References', value: '<r1@x> <r2@x>' }
      ],
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: gmailData('Plain version') } },
            { mimeType: 'text/html', body: { data: gmailData('<p>HTML version</p>') } }
          ]
        },
        {
          mimeType: 'image/png',
          filename: 'logo.png',
          headers: [
            { name: 'Content-ID', value: '<logo1>' },
            { name: 'Content-Disposition', value: 'inline; filename="logo.png"' }
          ],
          body: { attachmentId: 'att-inline', size: 120 }
        },
        {
          mimeType: 'application/pdf',
          filename: 'invoice.pdf',
          headers: [{ name: 'Content-Disposition', value: 'attachment; filename="invoice.pdf"' }],
          body: { attachmentId: 'att-pdf', size: 8000 }
        }
      ]
    },
    ...over
  };
}

describe('GmailAdapter — fetchThread', () => {
  it('reads the whole conversation in one call', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const thread = await adapter.fetchThread('thread-1', 'msg-1');

    expect(thread.conversationId).toBe('thread-1');
    expect(thread.subject).toBe('Invoice 4471');
    expect(thread.messages).toHaveLength(1);
    expect(connection.callsTo('/threads/')).toHaveLength(1);
  });

  it('prefers the HTML body and keeps the text as fallback', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;

    expect(message?.body.kind).toBe('html');
    expect(message?.body.content).toBe('<p>HTML version</p>');
    expect(message?.body.textFallback).toBe('Plain version');
  });

  it('falls back to text when there is no HTML part', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', {
      messages: [
        gmailMessage({
          payload: {
            mimeType: 'text/plain',
            headers: [{ name: 'Subject', value: 'Plain only' }],
            body: { data: gmailData('just text') }
          }
        })
      ]
    });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;
    expect(message?.body).toEqual({ kind: 'text', content: 'just text' });
  });

  it('parses addresses, including a quoted name containing a comma', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;

    expect(message?.from).toEqual({ email: 'asha@example.com', name: 'Asha Patel' });
    expect(message?.to).toEqual([
      { email: 'ops@malkom.test' },
      { email: 'vik@example.com', name: 'Rao, Vik' }
    ]);
    expect(message?.cc).toEqual([{ email: 'audit@example.com' }]);
  });

  it('lists attachments without fetching their bytes', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;

    expect(message?.attachments).toHaveLength(2);
    expect(message?.attachments[0]).toMatchObject({
      id: 'att-inline',
      filename: 'logo.png',
      isInline: true,
      contentId: 'logo1'
    });
    expect(message?.attachments[1]).toMatchObject({
      filename: 'invoice.pdf',
      isInline: false
    });
    expect(message?.attachments.every((a) => a.content === undefined)).toBe(true);
  });

  it('keeps the threading headers a reply will need', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;

    expect(message?.headers.messageId).toBe('<abc@mail.example.com>');
    expect(message?.headers.references).toEqual(['<r1@x>', '<r2@x>']);
  });

  it('uses internalDate rather than the sender-controlled Date header', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [gmailMessage()] });

    const [message] = (await adapter.fetchThread('thread-1', 'msg-1')).messages;
    expect(message?.receivedAt).toBe(new Date(1755000000000).toISOString());
  });

  it('sorts messages oldest first', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', {
      messages: [
        gmailMessage({ id: 'newer', internalDate: '1755000900000' }),
        gmailMessage({ id: 'older', internalDate: '1755000000000' })
      ]
    });

    const thread = await adapter.fetchThread('thread-1', 'older');
    expect(thread.messages.map((m) => m.id)).toEqual(['older', 'newer']);
  });

  it('fails loudly on an empty thread', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/threads/', { messages: [] });

    await expect(adapter.fetchThread('thread-1', 'msg-1')).rejects.toThrow(
      MiniEmailAdapterError
    );
  });
});

describe('GmailAdapter — attachments', () => {
  it('decodes base64url attachment bytes', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/attachments/', { data: gmailData('hello'), size: 5 });

    const attachment = await adapter.fetchAttachment('msg-1', 'att-pdf');

    expect(new TextDecoder().decode(attachment.content)).toBe('hello');
    expect(attachment.sizeBytes).toBe(5);
  });

  it('reports a missing payload as not found', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/attachments/', { size: 0 });

    await expect(adapter.fetchAttachment('msg-1', 'att')).rejects.toMatchObject({
      detail: { code: 'notFound' }
    });
  });
});

describe('buildGmailQuery', () => {
  it('passes free text through so Gmail syntax still works', () => {
    expect(buildGmailQuery({ text: 'label:starred invoice' })).toBe('label:starred invoice');
  });

  it('folds structured terms into operators', () => {
    const q = buildGmailQuery({
      text: 'invoice',
      from: 'asha@example.com',
      hasAttachment: true
    });
    expect(q).toBe('invoice from:asha@example.com has:attachment');
  });

  it('converts ISO dates to the slash format Gmail expects', () => {
    expect(buildGmailQuery({ text: '', after: '2026-08-01T00:00:00Z' })).toBe(
      'after:2026/08/01'
    );
  });
});

describe('GmailAdapter — search', () => {
  it('lists ids then reads metadata for each hit', async () => {
    const { connection, adapter } = setup();
    connection
      .on('GET', '/messages?', { messages: [{ id: 'm1' }], resultSizeEstimate: 1 })
      .on('GET', '/messages', { messages: [{ id: 'm1' }], resultSizeEstimate: 1 })
      .on('GET', '/messages/m1', {
        id: 'm1',
        threadId: 't1',
        internalDate: '1755000000000',
        snippet: 'hi',
        payload: {
          headers: [
            { name: 'Subject', value: 'Found it' },
            { name: 'From', value: 'a@b.com' }
          ]
        }
      });

    const result = await adapter.search({ text: 'invoice' });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({
      messageId: 'm1',
      conversationId: 't1',
      subject: 'Found it'
    });
    expect(result.estimatedTotal).toBe(1);
  });

  it('returns nothing rather than failing on an empty result', async () => {
    const { connection, adapter } = setup();
    connection.on('GET', '/messages', { resultSizeEstimate: 0 });

    expect((await adapter.search({ text: 'nothing' })).hits).toEqual([]);
  });
});

describe('GmailAdapter — send', () => {
  const draft: MiniEmailComposeDraft = {
    mode: 'reply',
    to: [{ email: 'asha@example.com', name: 'Asha' }],
    cc: [],
    bcc: [],
    subject: 'Re: Invoice 4471',
    body: { kind: 'html', content: '<p>On its way.</p>' },
    attachments: [],
    threadContext: {
      conversationId: 'thread-1',
      messageIdHeader: '<abc@mail.example.com>',
      references: ['<r1@x>', '<abc@mail.example.com>']
    }
  };

  it('sends a base64url MIME message', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', { id: 'sent-1' });

    expect(await adapter.send(draft)).toBe('sent-1');

    const body = connection.lastCall()?.body as Record<string, string>;
    expect(body['raw']).toBeDefined();
    expect(body['raw']).not.toContain('+');
    expect(body['raw']).not.toContain('=');
  });

  it('carries the thread id so the reply joins the conversation', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', { id: 'sent-1' });

    await adapter.send(draft);

    expect((connection.lastCall()?.body as Record<string, string>)['threadId']).toBe(
      'thread-1'
    );
  });

  it('omits the thread id for a brand-new mail', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', { id: 'sent-2' });

    await adapter.send({ ...draft, mode: 'new' });

    expect((connection.lastCall()?.body as Record<string, string>)['threadId']).toBeUndefined();
  });

  it('writes In-Reply-To and References into the MIME headers', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', { id: 'sent-1' });

    await adapter.send(draft);

    const raw = (connection.lastCall()?.body as Record<string, string>)['raw'] ?? '';
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(decoded).toContain('In-Reply-To: <abc@mail.example.com>');
    expect(decoded).toContain('References: <r1@x> <abc@mail.example.com>');
  });

  it('does not retry a send, so nothing is delivered twice', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', { error: 'boom' }, 503);

    await expect(adapter.send(draft)).rejects.toThrow();
    expect(connection.callsTo('/messages/send')).toHaveLength(1);
  });

  it('fails when the provider confirms no id', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/messages/send', {});

    await expect(adapter.send(draft)).rejects.toMatchObject({
      detail: { code: 'sendFailed' }
    });
  });
});

describe('GmailAdapter — drafts', () => {
  const draft: MiniEmailComposeDraft = {
    mode: 'reply',
    to: [{ email: 'a@b.com' }],
    cc: [],
    bcc: [],
    subject: 'Draft',
    body: { kind: 'text', content: 'wip' },
    attachments: []
  };

  it('creates a draft', async () => {
    const { connection, adapter } = setup();
    connection.on('POST', '/drafts', { id: 'draft-1' });

    expect(await adapter.saveDraft(draft)).toBe('draft-1');
    expect(connection.lastCall()?.method).toBe('POST');
  });

  it('updates an existing draft in place', async () => {
    const { connection, adapter } = setup();
    connection.on('PUT', '/drafts/', { id: 'draft-1' });

    await adapter.saveDraft({ ...draft, providerDraftId: 'draft-1' });

    expect(connection.lastCall()?.method).toBe('PUT');
    expect(connection.lastCall()?.path).toContain('/drafts/draft-1');
  });

  it('deletes a draft', async () => {
    const { connection, adapter } = setup();
    connection.on('DELETE', '/drafts/', {});

    await adapter.deleteDraft('draft-1');
    expect(connection.lastCall()?.method).toBe('DELETE');
  });
});
