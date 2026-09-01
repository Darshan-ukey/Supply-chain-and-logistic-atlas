import { describe, expect, it } from 'vitest';
import {
  MINIEMAIL_CONTRACT_VERSION,
  validateHostConnector,
  type MalkomIntegrationConnection,
  type MiniEmailHostConnector
} from '@malkom/miniemail-core';

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

function connector(
  overrides: Partial<MiniEmailHostConnector> = {}
): MiniEmailHostConnector {
  return {
    engine: 'miniemail',
    contractVersion: MINIEMAIL_CONTRACT_VERSION,
    currentUser: { id: 'u1', displayName: 'Asha' },
    organisation: { id: 'org-1' },
    input: {
      connection,
      anchor: {
        conversationId: 'thread-1',
        messageId: 'msg-1',
        receivedAt: '2026-08-14T09:00:00.000Z'
      }
    },
    ...overrides
  };
}

describe('validateHostConnector', () => {
  it('accepts a well-formed connector and resolves the provider', () => {
    const result = validateHostConnector(connector());
    expect(result).toEqual({ ok: true, provider: 'gmail' });
  });

  it('prefers the explicitly stated provider over the connection hint', () => {
    const result = validateHostConnector(
      connector({
        input: {
          connection,
          provider: 'outlook',
          anchor: {
            conversationId: 't',
            messageId: 'm',
            receivedAt: '2026-08-14T09:00:00.000Z'
          }
        }
      })
    );
    expect(result).toEqual({ ok: true, provider: 'outlook' });
  });

  it('rejects a connector aimed at a different engine', () => {
    const result = validateHostConnector(connector({ engine: 'table' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalidConnector');
  });

  it('rejects a major contract mismatch', () => {
    const result = validateHostConnector(connector({ contractVersion: '2.0.0' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('contractVersionMismatch');
  });

  it('accepts a minor contract difference', () => {
    const result = validateHostConnector(connector({ contractVersion: '1.4.2' }));
    expect(result.ok).toBe(true);
  });

  it('requires both anchor ids', () => {
    const result = validateHostConnector(
      connector({
        input: {
          connection,
          anchor: {
            conversationId: 'thread-1',
            messageId: '',
            receivedAt: '2026-08-14T09:00:00.000Z'
          }
        }
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalidConnector');
  });

  it('fails when no provider can be determined', () => {
    const { provider: _omitted, ...bare } = connection;
    const result = validateHostConnector(
      connector({
        input: {
          connection: bare,
          anchor: {
            conversationId: 't',
            messageId: 'm',
            receivedAt: '2026-08-14T09:00:00.000Z'
          }
        }
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknownProvider');
  });
});
