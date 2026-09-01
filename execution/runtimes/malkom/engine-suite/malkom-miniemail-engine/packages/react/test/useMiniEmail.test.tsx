import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIEMAIL_CONTRACT_VERSION,
  type MalkomIntegrationConnection,
  type MiniEmailAdapter,
  type MiniEmailHostConnector,
  type MiniEmailState,
  type MiniEmailThread
} from '@malkom/miniemail-core';
import { useMiniEmail } from '../src/useMiniEmail.js';

// React's test-only flag; without it every act() call warns.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const thread: MiniEmailThread = {
  conversationId: 'thread-1',
  subject: 'Invoice 4471',
  messages: [
    {
      id: 'msg-1',
      conversationId: 'thread-1',
      subject: 'Invoice 4471',
      from: { email: 'asha@example.com' },
      to: [{ email: 'ops@malkom.test' }],
      cc: [],
      bcc: [],
      replyTo: [],
      receivedAt: '2026-08-12T09:15:00.000Z',
      body: { kind: 'html', content: '<p>hi</p>' },
      attachments: [],
      headers: {}
    }
  ]
};

const connection: MalkomIntegrationConnection = {
  id: 'conn-1',
  provider: 'gmail',
  capabilities: () => ({
    canRead: true,
    canSearch: true,
    canSend: true,
    canDraft: true,
    canFetchAttachments: true,
    canModifyParticipants: true
  }),
  request: () => Promise.resolve({ status: 200, body: {} })
};

const connector: MiniEmailHostConnector = {
  engine: 'miniemail',
  contractVersion: MINIEMAIL_CONTRACT_VERSION,
  currentUser: { id: 'u1', displayName: 'Ops' },
  organisation: { id: 'org-1' },
  input: {
    connection,
    provider: 'gmail',
    anchor: {
      conversationId: 'thread-1',
      messageId: 'msg-1',
      receivedAt: '2026-08-12T09:15:00.000Z'
    }
  }
};

function fakeAdapter(): MiniEmailAdapter {
  return {
    provider: 'gmail',
    fetchThread: vi.fn(() => Promise.resolve(thread)),
    fetchAttachment: vi.fn(() =>
      Promise.resolve({
        id: 'a',
        filename: 'x',
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        isInline: false
      })
    ),
    search: vi.fn(() => Promise.resolve({ hits: [] })),
    saveDraft: vi.fn(() => Promise.resolve('d1')),
    send: vi.fn(() => Promise.resolve('s1')),
    deleteDraft: vi.fn(() => Promise.resolve())
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useMiniEmail', () => {
  it('loads the anchor on mount and exposes the state', async () => {
    const adapter = fakeAdapter();
    const seen: MiniEmailState[] = [];

    function Probe(): null {
      const { state } = useMiniEmail(connector, { adapter });
      seen.push(state);
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(adapter.fetchThread).toHaveBeenCalledWith('thread-1', 'msg-1');
    expect(seen[seen.length - 1]?.status).toBe('ready');
    expect(seen[seen.length - 1]?.anchorThread?.conversationId).toBe('thread-1');
  });

  it('does not load when the host wants to control timing', async () => {
    const adapter = fakeAdapter();

    function Probe(): null {
      useMiniEmail(connector, { adapter, autoLoad: false });
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(adapter.fetchThread).not.toHaveBeenCalled();
  });

  it('exposes availability alongside state', async () => {
    const adapter = fakeAdapter();
    let allowed: boolean | undefined;

    function Probe(): null {
      const { availability } = useMiniEmail(connector, { adapter });
      allowed = availability.reply.allowed;
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(allowed).toBe(true);
  });

  it('keeps the same engine across re-renders of the same mail', async () => {
    const adapter = fakeAdapter();
    const engines: unknown[] = [];

    function Probe(): null {
      const { engine } = useMiniEmail(connector, { adapter });
      engines.push(engine);
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {
      root.render(<Probe />);
    });

    expect(new Set(engines).size).toBe(1);
    expect(adapter.fetchThread).toHaveBeenCalledTimes(1);
  });

  it('re-renders when the engine state moves', async () => {
    const adapter = fakeAdapter();
    const statuses: string[] = [];

    function Probe(): null {
      const { state } = useMiniEmail(connector, { adapter });
      statuses.push(state.status);
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(statuses).toContain('ready');
  });
});
