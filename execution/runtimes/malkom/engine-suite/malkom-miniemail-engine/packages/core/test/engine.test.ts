import { describe, expect, it, vi } from 'vitest';
import { MalkomMiniEmailEngine } from '../src/engine.js';
import { MINIEMAIL_CONTRACT_VERSION } from '../src/contract.js';
import { UndoSendBuffer } from '../src/undoSend.js';
import type { MiniEmailAdapter } from '../src/adapters/adapter.js';
import type {
  MiniEmailAttachment,
  MiniEmailCapabilities,
  MiniEmailEvent,
  MiniEmailHostConnector,
  MiniEmailMessage,
  MiniEmailOptions,
  MiniEmailThread
} from '../src/types.js';
import { ALL_CAPABILITIES, FakeConnection } from './helpers/connection.js';

/* ── fixtures ─────────────────────────────────────────────────────────── */

function message(over: Partial<MiniEmailMessage> = {}): MiniEmailMessage {
  return {
    id: 'msg-1',
    conversationId: 'thread-1',
    subject: 'Invoice 4471',
    from: { email: 'asha@example.com', name: 'Asha Patel' },
    to: [{ email: 'ops@malkom.test' }],
    cc: [],
    bcc: [],
    replyTo: [],
    receivedAt: '2026-08-12T09:15:00.000Z',
    body: { kind: 'html', content: '<p>Please pay this.</p>' },
    attachments: [],
    headers: { messageId: '<abc@x>' },
    ...over
  };
}

function thread(messages: MiniEmailMessage[] = [message()]): MiniEmailThread {
  return { conversationId: 'thread-1', subject: 'Invoice 4471', messages };
}

/** An adapter whose every method is a spy, so wiring is observable. */
class FakeAdapter implements MiniEmailAdapter {
  readonly provider = 'gmail' as const;

  fetchThread = vi.fn<MiniEmailAdapter['fetchThread']>(() => Promise.resolve(thread()));
  fetchAttachment = vi.fn<MiniEmailAdapter['fetchAttachment']>((_m, id) =>
    Promise.resolve({
      id,
      filename: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: 3,
      isInline: true,
      content: new Uint8Array([1, 2, 3]).buffer
    } satisfies MiniEmailAttachment)
  );
  search = vi.fn<MiniEmailAdapter['search']>(() => Promise.resolve({ hits: [] }));
  saveDraft = vi.fn<MiniEmailAdapter['saveDraft']>(() => Promise.resolve('draft-1'));
  send = vi.fn<MiniEmailAdapter['send']>(() => Promise.resolve('sent-1'));
  deleteDraft = vi.fn<MiniEmailAdapter['deleteDraft']>(() => Promise.resolve());
}

interface Harness {
  readonly engine: MalkomMiniEmailEngine;
  readonly adapter: FakeAdapter;
  readonly events: MiniEmailEvent[];
  readonly connection: FakeConnection;
}

function harness(
  init: {
    options?: MiniEmailOptions;
    capabilities?: MiniEmailCapabilities;
    connector?: Partial<MiniEmailHostConnector>;
    adapter?: FakeAdapter;
  } = {}
): Harness {
  const connection = new FakeConnection('gmail', init.capabilities ?? ALL_CAPABILITIES);
  const adapter = init.adapter ?? new FakeAdapter();
  const events: MiniEmailEvent[] = [];

  const connector: MiniEmailHostConnector = {
    engine: 'miniemail',
    contractVersion: MINIEMAIL_CONTRACT_VERSION,
    currentUser: { id: 'u1', displayName: 'Ops', email: 'ops@malkom.test' },
    organisation: { id: 'org-1' },
    onEvent: (event) => events.push(event),
    input: {
      connection,
      provider: 'gmail',
      anchor: {
        conversationId: 'thread-1',
        messageId: 'msg-1',
        receivedAt: '2026-08-12T09:15:00.000Z'
      },
      ...(init.options ? { options: init.options } : {})
    },
    ...init.connector
  };

  return {
    engine: new MalkomMiniEmailEngine(connector, {
      adapter,
      undoSendBuffer: new UndoSendBuffer({ delayMs: 0 })
    }),
    adapter,
    events,
    connection
  };
}

function types(events: MiniEmailEvent[]): string[] {
  return events.map((event) => event.type);
}

/* ── tests ────────────────────────────────────────────────────────────── */

describe('engine — construction', () => {
  it('starts idle and announces itself', () => {
    const { engine, events } = harness();

    expect(engine.state.status).toBe('idle');
    expect(types(events)).toContain('mounted');
  });

  it('applies option defaults', () => {
    const { engine } = harness();
    expect(engine.state.options.undoSendMs).toBe(8_000);
    expect(engine.state.options.searchEnabled).toBe(true);
  });

  it('fails on a connector aimed at another engine', () => {
    const { engine } = harness({ connector: { engine: 'table' } });

    expect(engine.state.status).toBe('failed');
    expect(engine.state.error?.code).toBe('invalidConnector');
  });

  it('fails on a major contract mismatch', () => {
    const { engine } = harness({ connector: { contractVersion: '9.0.0' } });
    expect(engine.state.error?.code).toBe('contractVersionMismatch');
  });
});

describe('engine — loading the anchor', () => {
  it('loads the thread and reports it', async () => {
    const { engine, adapter, events } = harness();
    await engine.load();

    expect(adapter.fetchThread).toHaveBeenCalledWith('thread-1', 'msg-1');
    expect(engine.state.status).toBe('ready');
    expect(engine.state.anchorThread?.messages).toHaveLength(1);
    expect(types(events)).toContain('anchorLoaded');
  });

  it('reads capabilities before deciding what to offer', async () => {
    const { engine } = harness();
    await engine.load();

    expect(engine.state.capabilities).toEqual(ALL_CAPABILITIES);
    expect(engine.availability.reply.allowed).toBe(true);
  });

  it('refuses to load when the connector cannot read', async () => {
    const { engine, events } = harness({
      capabilities: { ...ALL_CAPABILITIES, canRead: false }
    });
    await engine.load();

    expect(engine.state.status).toBe('failed');
    expect(engine.state.error?.code).toBe('authFailed');
    expect(types(events)).toContain('anchorLoadFailed');
  });

  it('mounts disabled when the host switched the engine off', async () => {
    const { engine } = harness({ connector: { enabled: { engineEnabled: false } } });
    await engine.load();

    expect(engine.state.status).toBe('disabled');
  });

  it('fetches bytes for inline images so the body is not full of holes', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          attachments: [
            {
              id: 'att-1',
              filename: 'logo.png',
              mimeType: 'image/png',
              sizeBytes: 3,
              isInline: true,
              contentId: 'logo1'
            }
          ]
        })
      ])
    );

    const { engine } = harness({ adapter });
    await engine.load();

    expect(adapter.fetchAttachment).toHaveBeenCalledWith('msg-1', 'att-1');
    expect(engine.state.anchorThread?.messages[0]?.attachments[0]?.content).toBeDefined();
  });

  it('does not pre-fetch ordinary attachments', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          attachments: [
            {
              id: 'att-doc',
              filename: 'invoice.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 9000,
              isInline: false
            }
          ]
        })
      ])
    );

    const { engine } = harness({ adapter });
    await engine.load();

    expect(adapter.fetchAttachment).not.toHaveBeenCalled();
  });

  it('renders on despite a missing inline image', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          attachments: [
            {
              id: 'att-1',
              filename: 'logo.png',
              mimeType: 'image/png',
              sizeBytes: 3,
              isInline: true
            }
          ]
        })
      ])
    );
    adapter.fetchAttachment.mockRejectedValue(new Error('gone'));

    const { engine } = harness({ adapter });
    await engine.load();

    expect(engine.state.status).toBe('ready');
  });

  it('keeps the last good thread when the connector drops out', async () => {
    const adapter = new FakeAdapter();
    const { engine } = harness({ adapter });

    await engine.load();
    adapter.fetchThread.mockRejectedValue(new Error('offline'));
    await engine.refresh();

    expect(engine.state.status).toBe('ready');
    expect(engine.state.anchorThread).toBeDefined();
    expect(engine.state.error).toBeDefined();
  });

  it('fails loudly instead when the host asked for that', async () => {
    const adapter = new FakeAdapter();
    const { engine } = harness({ adapter, options: { connectorDownBehaviour: 'fail' } });

    await engine.load();
    adapter.fetchThread.mockRejectedValue(new Error('offline'));
    await engine.refresh();

    expect(engine.state.status).toBe('failed');
  });
});

describe('engine — search overlay', () => {
  it('searches and records the hits', async () => {
    const adapter = new FakeAdapter();
    adapter.search.mockResolvedValue({
      hits: [
        {
          messageId: 'other-1',
          conversationId: 'thread-2',
          subject: 'Another mail',
          from: { email: 'x@y.com' },
          receivedAt: '2026-08-10T00:00:00Z',
          hasAttachments: false
        }
      ]
    });

    const { engine, events } = harness({ adapter });
    await engine.load();
    const result = await engine.search({ text: 'invoice' });

    expect(result.hits).toHaveLength(1);
    expect(engine.state.search?.hits).toHaveLength(1);
    expect(types(events)).toContain('searchPerformed');
  });

  it('applies the configured page size', async () => {
    const { engine, adapter } = harness({ options: { searchPageSize: 5 } });
    await engine.load();
    await engine.search({ text: 'x' });

    expect(adapter.search).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 5 }));
  });

  it('refuses to search when the host switched search off', async () => {
    const { engine, adapter, events } = harness({ options: { searchEnabled: false } });
    await engine.load();
    await engine.search({ text: 'x' });

    expect(adapter.search).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'actionBlocked')).toHaveLength(1);
  });

  it('opens a hit above the anchor without replacing it', async () => {
    const adapter = new FakeAdapter();
    adapter.search.mockResolvedValue({
      hits: [
        {
          messageId: 'other-1',
          conversationId: 'thread-2',
          subject: 'Another',
          from: { email: 'x@y.com' },
          receivedAt: '2026-08-10T00:00:00Z',
          hasAttachments: false
        }
      ]
    });
    adapter.fetchThread.mockImplementation((conversationId) =>
      Promise.resolve(
        conversationId === 'thread-2'
          ? { conversationId, subject: 'Another', messages: [message({ id: 'other-1' })] }
          : thread()
      )
    );

    const { engine, events } = harness({ adapter });
    await engine.load();
    await engine.search({ text: 'x' });
    await engine.openSearchHit('other-1');

    expect(engine.state.overlayThread?.conversationId).toBe('thread-2');
    // The anchor is exactly where it was.
    expect(engine.state.anchorThread?.conversationId).toBe('thread-1');
    expect(types(events)).toContain('searchResultOpened');
  });

  it('returns to the anchor when the overlay is dismissed', async () => {
    const { engine, events } = harness();
    await engine.load();
    engine.dismissSearch();

    expect(engine.state.overlayThread).toBeUndefined();
    expect(engine.state.search).toBeUndefined();
    expect(engine.state.anchorThread).toBeDefined();
    expect(types(events)).toContain('searchDismissed');
  });

  it('ignores a hit that is not in the current results', async () => {
    const { engine, adapter } = harness();
    await engine.load();
    adapter.fetchThread.mockClear();

    await engine.openSearchHit('never-seen');
    expect(adapter.fetchThread).not.toHaveBeenCalled();
  });
});

describe('engine — compose', () => {
  it('opens a reply filled in from the message', async () => {
    const { engine, events } = harness();
    await engine.load();
    engine.compose('reply');

    expect(engine.state.compose?.mode).toBe('reply');
    expect(engine.state.compose?.subject).toBe('Re: Invoice 4471');
    expect(engine.state.compose?.to).toEqual([
      { email: 'asha@example.com', name: 'Asha Patel' }
    ]);
    expect(types(events)).toContain('composeOpened');
  });

  it('excludes the connector mailbox from reply-all', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          to: [{ email: 'ops@malkom.test' }, { email: 'vik@example.com' }]
        })
      ])
    );

    const { engine } = harness({ adapter });
    await engine.load();
    engine.compose('replyAll');

    expect(engine.state.compose?.to.map((a) => a.email)).toEqual([
      'asha@example.com',
      'vik@example.com'
    ]);
  });

  it('refuses a mode the host switched off', async () => {
    const { engine, events } = harness({ options: { newMailEnabled: false } });
    await engine.load();
    engine.compose('new');

    expect(engine.state.compose).toBeUndefined();
    const blocked = events.find((e) => e.type === 'actionBlocked');
    expect(blocked).toMatchObject({ action: 'newMail', reason: 'hostConfig' });
  });

  it('carries attachments into a forward', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          attachments: [
            {
              id: 'att-doc',
              filename: 'invoice.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 900,
              isInline: false
            }
          ]
        })
      ])
    );

    const { engine } = harness({ adapter });
    await engine.load();
    engine.compose('forward');
    await vi.waitFor(() => expect(engine.state.compose?.attachments).toHaveLength(1));

    expect(engine.state.compose?.attachments[0]?.filename).toBe('invoice.pdf');
  });

  it('edits participants', async () => {
    const { engine } = harness();
    await engine.load();
    engine.compose('reply');

    engine.addParticipant('cc', { email: 'new@example.com' });
    expect(engine.state.compose?.cc).toEqual([{ email: 'new@example.com' }]);

    engine.removeParticipant('cc', { email: 'new@example.com' });
    expect(engine.state.compose?.cc).toEqual([]);
  });

  it('refuses participant edits the connector cannot support', async () => {
    const { engine } = harness({
      capabilities: { ...ALL_CAPABILITIES, canModifyParticipants: false }
    });
    await engine.load();
    engine.compose('reply');
    engine.addParticipant('cc', { email: 'new@example.com' });

    expect(engine.state.compose?.cc).toEqual([]);
  });

  it('discards a draft and deletes the provider copy', async () => {
    const { engine, adapter, events } = harness();
    await engine.load();
    engine.compose('reply');
    await engine.saveDraft();
    engine.discardDraft();

    expect(engine.state.compose).toBeUndefined();
    expect(adapter.deleteDraft).toHaveBeenCalledWith('draft-1');
    expect(types(events)).toContain('composeDiscarded');
  });

  it('does not save a draft when draft mode is off', async () => {
    const { engine, adapter } = harness({ options: { draftMode: 'off' } });
    await engine.load();
    engine.compose('reply');
    await engine.saveDraft();

    expect(adapter.saveDraft).not.toHaveBeenCalled();
  });
});

describe('engine — sending', () => {
  it('sends and reports the sent message', async () => {
    const { engine, adapter, events } = harness();
    await engine.load();
    engine.compose('reply');
    await engine.send();

    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(types(events)).toContain('sent');
    expect(engine.state.compose).toBeUndefined();
  });

  it('refuses a draft with no recipients', async () => {
    const { engine, adapter, events } = harness();
    await engine.load();
    engine.compose('reply');
    engine.updateDraft({ to: [], cc: [], bcc: [] });
    await engine.send();

    expect(adapter.send).not.toHaveBeenCalled();
    expect(types(events)).toContain('sendFailed');
  });

  it('refuses an oversized attachment', async () => {
    const { engine, adapter } = harness({ options: { maxAttachmentMb: 1 } });
    await engine.load();
    engine.compose('reply');
    engine.updateDraft({
      attachments: [
        {
          id: 'big',
          filename: 'big.zip',
          mimeType: 'application/zip',
          sizeBytes: 5 * 1024 * 1024,
          content: new ArrayBuffer(0)
        }
      ]
    });
    await engine.send();

    expect(adapter.send).not.toHaveBeenCalled();
    expect(engine.state.error?.code).toBe('attachmentTooLarge');
  });

  it('restores the draft when a send fails', async () => {
    const adapter = new FakeAdapter();
    adapter.send.mockRejectedValue(new Error('smtp said no'));

    const { engine, events } = harness({ adapter });
    await engine.load();
    engine.compose('reply');
    await engine.send();

    expect(engine.state.compose?.mode).toBe('reply');
    expect(types(events)).toContain('sendFailed');
  });

  it('reloads the conversation after a successful send', async () => {
    const { engine, adapter } = harness();
    await engine.load();
    adapter.fetchThread.mockClear();

    engine.compose('reply');
    await engine.send();
    await vi.waitFor(() => expect(adapter.fetchThread).toHaveBeenCalled());
  });

  it('refuses to send when the connector cannot', async () => {
    const { engine, adapter, events } = harness({
      capabilities: { ...ALL_CAPABILITIES, canSend: false }
    });
    await engine.load();
    await engine.send();

    expect(adapter.send).not.toHaveBeenCalled();
    const blocked = events.find((e) => e.type === 'actionBlocked');
    expect(blocked).toMatchObject({ reason: 'connectorCapability' });
  });
});

describe('engine — undo send', () => {
  it('holds the message and lets the reader take it back', async () => {
    const connection = new FakeConnection('gmail');
    const adapter = new FakeAdapter();
    const events: MiniEmailEvent[] = [];

    const engine = new MalkomMiniEmailEngine(
      {
        engine: 'miniemail',
        contractVersion: MINIEMAIL_CONTRACT_VERSION,
        currentUser: { id: 'u1', displayName: 'Ops' },
        organisation: { id: 'org-1' },
        onEvent: (event) => events.push(event),
        input: {
          connection,
          provider: 'gmail',
          anchor: {
            conversationId: 'thread-1',
            messageId: 'msg-1',
            receivedAt: '2026-08-12T09:15:00.000Z'
          }
        }
      },
      { adapter, undoSendBuffer: new UndoSendBuffer({ delayMs: 10_000 }) }
    );

    await engine.load();
    engine.compose('reply');

    const sending = engine.send();
    expect(engine.state.pendingSend?.state).toBe('holding');
    expect(types(events)).toContain('sendHeld');

    engine.undoSend();
    await sending;

    expect(adapter.send).not.toHaveBeenCalled();
    expect(types(events)).toContain('sendUndone');
    // Everything typed comes back.
    expect(engine.state.compose?.mode).toBe('reply');

    engine.destroy();
  });
});

describe('engine — attachments', () => {
  it('hands a downloaded attachment to the host store', async () => {
    const adapter = new FakeAdapter();
    adapter.fetchThread.mockResolvedValue(
      thread([
        message({
          attachments: [
            {
              id: 'att-doc',
              filename: 'invoice.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 900,
              isInline: false
            }
          ]
        })
      ])
    );

    const storeDocument = vi.fn(() => Promise.resolve());
    const connection = new FakeConnection('gmail');
    const events: MiniEmailEvent[] = [];

    const engine = new MalkomMiniEmailEngine(
      {
        engine: 'miniemail',
        contractVersion: MINIEMAIL_CONTRACT_VERSION,
        currentUser: { id: 'u1', displayName: 'Ops' },
        organisation: { id: 'org-1' },
        services: { storeDocument },
        onEvent: (event) => events.push(event),
        input: {
          connection,
          provider: 'gmail',
          anchor: {
            conversationId: 'thread-1',
            messageId: 'msg-1',
            receivedAt: '2026-08-12T09:15:00.000Z'
          }
        }
      },
      { adapter }
    );

    await engine.load();
    await engine.downloadAttachment('att-doc');

    expect(storeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'invoice.pdf', messageId: 'msg-1' })
    );
    expect(types(events)).toContain('attachmentStored');
    expect(types(events)).toContain('attachmentDownloaded');
  });
});

describe('engine — remote images', () => {
  it('blocks by default and remembers a trusted sender', async () => {
    const { engine, events } = harness();
    await engine.load();

    const msg = engine.state.anchorThread?.messages[0];
    expect(msg && engine.shouldBlockRemoteImages(msg)).toBe(true);

    engine.allowRemoteImages('msg-1');

    expect(msg && engine.shouldBlockRemoteImages(msg)).toBe(false);
    expect(types(events)).toContain('remoteImagesAllowed');
  });

  it('keeps blocking other senders', async () => {
    const { engine } = harness();
    await engine.load();
    engine.allowRemoteImages('msg-1');

    const other = message({ id: 'msg-2', from: { email: 'someone@else.com' } });
    expect(engine.shouldBlockRemoteImages(other)).toBe(true);
  });

  it('does not remember when the host disabled per-sender trust', async () => {
    const { engine } = harness({ options: { rememberImageChoicePerSender: false } });
    await engine.load();
    engine.allowRemoteImages('msg-1');

    const msg = engine.state.anchorThread?.messages[0];
    expect(msg && engine.shouldBlockRemoteImages(msg)).toBe(true);
  });
});

describe('engine — lifecycle', () => {
  it('notifies subscribers of state changes', async () => {
    const { engine } = harness();
    const seen: string[] = [];
    engine.subscribe((state) => seen.push(state.status));

    await engine.load();
    expect(seen).toContain('loading');
    expect(seen).toContain('ready');
  });

  it('stops notifying after unsubscribe', async () => {
    const { engine } = harness();
    const listener = vi.fn();
    engine.subscribe(listener)();

    await engine.load();
    expect(listener).not.toHaveBeenCalled();
  });

  it('goes quiet after destroy', async () => {
    const { engine, events } = harness();
    await engine.load();
    engine.destroy();

    expect(types(events)).toContain('destroyed');
  });
});
