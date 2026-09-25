import type {
  MalkomIntegrationConnection,
  MiniEmailAttachment,
  MiniEmailComposeDraft,
  MiniEmailError,
  MiniEmailProvider,
  MiniEmailProviderRequest,
  MiniEmailProviderResponse,
  MiniEmailSearchQuery,
  MiniEmailSearchResult,
  MiniEmailThread
} from '../types.js';

/**
 * The provider boundary.
 *
 * Everything above this line works in one normalized shape; everything below
 * it is Gmail's or Graph's own idea of what an email is. Adding a provider
 * means adding one implementation of this interface — no other module changes.
 *
 * Adapters own the mess and none of the policy: they translate, they do not
 * decide. Whether an action is offered at all is settled by capability and
 * config before an adapter is ever called.
 */
export interface MiniEmailAdapter {
  readonly provider: MiniEmailProvider;

  /** The full conversation containing this message, oldest first. */
  fetchThread(conversationId: string, messageId: string): Promise<MiniEmailThread>;

  /** Attachment bytes, fetched only when something needs them. */
  fetchAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<MiniEmailAttachment>;

  /** Mailbox search. Returns one page. */
  search(query: MiniEmailSearchQuery): Promise<MiniEmailSearchResult>;

  /** Saves a provider-side draft and returns its id. */
  saveDraft(draft: MiniEmailComposeDraft): Promise<string>;

  /** Sends. Returns the id of the sent message. */
  send(draft: MiniEmailComposeDraft): Promise<string>;

  /** Discards a provider-side draft. */
  deleteDraft(draftId: string): Promise<void>;
}

/** Everything an adapter needs to do its work. */
export interface AdapterContext {
  readonly connection: MalkomIntegrationConnection;
  readonly fetchTimeoutMs: number;
  readonly retryAttempts: number;
}

/** Provider statuses worth trying again. */
const RETRYABLE_STATUS: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/** Maps a provider status onto the engine's own error vocabulary. */
export function errorForStatus(status: number, detail?: string): MiniEmailError {
  const message = detail ? `${detail} (HTTP ${status})` : `Provider returned HTTP ${status}.`;

  if (status === 401 || status === 403) {
    return { code: 'authFailed', message, status, retryable: false };
  }
  if (status === 404) {
    return { code: 'notFound', message, status, retryable: false };
  }
  if (status === 429) {
    return { code: 'rateLimited', message, status, retryable: true };
  }
  if (status === 408 || status === 504) {
    return { code: 'timeout', message, status, retryable: true };
  }
  return {
    code: status >= 500 ? 'connectorUnavailable' : 'unexpected',
    message,
    status,
    retryable: isRetryableStatus(status)
  };
}

export class MiniEmailAdapterError extends Error {
  readonly detail: MiniEmailError;

  constructor(detail: MiniEmailError) {
    super(detail.message);
    this.name = 'MiniEmailAdapterError';
    this.detail = detail;
  }
}

/**
 * Calls the connector with a timeout and bounded retries.
 *
 * Retries only what could plausibly succeed on a second attempt, and only for
 * reads — a retried send would risk delivering the same mail twice, which the
 * reader cannot undo.
 */
export async function callProvider(
  context: AdapterContext,
  request: MiniEmailProviderRequest,
  options: { readonly retry?: boolean } = {}
): Promise<MiniEmailProviderResponse> {
  const attempts = options.retry === false ? 1 : context.retryAttempts + 1;
  let lastError: MiniEmailError | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), context.fetchTimeoutMs);

    try {
      const response = await context.connection.request({
        ...request,
        signal: request.signal ?? controller.signal
      });

      if (response.status >= 200 && response.status < 300) return response;

      lastError = errorForStatus(response.status);
      if (!lastError.retryable) throw new MiniEmailAdapterError(lastError);
    } catch (cause) {
      if (cause instanceof MiniEmailAdapterError) throw cause;

      // An abort is our own timeout firing; anything else is the connector
      // failing to reach the provider at all.
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      lastError = {
        code: aborted ? 'timeout' : 'connectorUnavailable',
        message: aborted
          ? `Provider call timed out after ${context.fetchTimeoutMs}ms.`
          : 'The connector could not reach the provider.',
        retryable: true,
        cause
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new MiniEmailAdapterError(
    lastError ?? {
      code: 'unexpected',
      message: 'Provider call failed with no reported cause.',
      retryable: false
    }
  );
}

/** Narrows an unknown provider body to a record, or fails loudly. */
export function expectRecord(
  body: unknown,
  what: string
): Readonly<Record<string, unknown>> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Readonly<Record<string, unknown>>;
  }
  throw new MiniEmailAdapterError({
    code: 'unexpected',
    message: `Expected an object for ${what}, got ${typeof body}.`,
    retryable: false
  });
}

export function readString(
  source: Readonly<Record<string, unknown>>,
  key: string
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

export function readNumber(
  source: Readonly<Record<string, unknown>>,
  key: string
): number | undefined {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

export function readBoolean(
  source: Readonly<Record<string, unknown>>,
  key: string
): boolean | undefined {
  const value = source[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function readArray(
  source: Readonly<Record<string, unknown>>,
  key: string
): readonly unknown[] {
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

export function readRecord(
  source: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> | undefined {
  const value = source[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return undefined;
}
