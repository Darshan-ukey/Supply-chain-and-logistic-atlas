import type {
  MalkomIntegrationConnection,
  MiniEmailCapabilities,
  MiniEmailProviderRequest,
  MiniEmailProviderResponse
} from '../../src/types.js';

export const ALL_CAPABILITIES: MiniEmailCapabilities = {
  canRead: true,
  canSearch: true,
  canSend: true,
  canDraft: true,
  canFetchAttachments: true,
  canModifyParticipants: true
};

export interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly body?: unknown;
}

/**
 * A stand-in for a malkom-integration-engine connection.
 *
 * Routes are matched by `METHOD path-fragment`, so a test states only the
 * calls it cares about. Every call is recorded, which is how the adapter tests
 * assert on what was actually asked of the provider.
 */
export class FakeConnection implements MalkomIntegrationConnection {
  readonly id = 'fake-connection';
  readonly calls: RecordedCall[] = [];

  #routes = new Map<string, MiniEmailProviderResponse>();
  #capabilities: MiniEmailCapabilities;

  constructor(
    readonly provider: 'gmail' | 'outlook',
    capabilities: MiniEmailCapabilities = ALL_CAPABILITIES
  ) {
    this.#capabilities = capabilities;
  }

  capabilities(): MiniEmailCapabilities {
    return this.#capabilities;
  }

  setCapabilities(capabilities: MiniEmailCapabilities): void {
    this.#capabilities = capabilities;
  }

  /** Registers a response for any call whose path contains `fragment`. */
  on(method: string, fragment: string, body: unknown, status = 200): this {
    this.#routes.set(`${method} ${fragment}`, { status, body });
    return this;
  }

  request(req: MiniEmailProviderRequest): Promise<MiniEmailProviderResponse> {
    this.calls.push({
      method: req.method,
      path: req.path,
      ...(req.query ? { query: req.query } : {}),
      ...(req.body !== undefined ? { body: req.body } : {})
    });

    // Most specific route wins: `/messages/m1` must beat `/messages`, which
    // would otherwise swallow every call below it.
    let best: { readonly response: MiniEmailProviderResponse; readonly length: number } | undefined;

    for (const [key, response] of this.#routes) {
      const [method, fragment] = key.split(' ', 2);
      if (req.method !== method || !fragment || !req.path.includes(fragment)) continue;
      if (!best || fragment.length > best.length) {
        best = { response, length: fragment.length };
      }
    }

    return Promise.resolve(best?.response ?? { status: 404, body: { error: 'no route' } });
  }

  lastCall(): RecordedCall | undefined {
    return this.calls[this.calls.length - 1];
  }

  callsTo(fragment: string): RecordedCall[] {
    return this.calls.filter((call) => call.path.includes(fragment));
  }
}

/** base64url encodes text the way Gmail returns it. */
export function gmailData(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
