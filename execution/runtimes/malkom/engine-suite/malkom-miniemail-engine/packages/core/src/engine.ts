import {
  MiniEmailAdapterError,
  type AdapterContext,
  type MiniEmailAdapter
} from './adapters/adapter.js';
import { createAdapter } from './adapters/index.js';
import { resolveAvailability } from './availability.js';
import {
  addParticipant,
  createDraft,
  moveParticipant,
  removeParticipant,
  validateAttachment,
  validateDraft,
  type ParticipantField
} from './compose.js';
import { MINIEMAIL_CONTRACT_VERSION, validateHostConnector } from './contract.js';
import { resolveMiniEmailOptions } from './defaults/options.js';
import { RemoteImageTrust } from './render/images.js';
import { UndoSendBuffer } from './undoSend.js';
import type {
  MiniEmailAction,
  MiniEmailAddress,
  MiniEmailAttachment,
  MiniEmailAvailability,
  MiniEmailComposeAttachment,
  MiniEmailComposeDraft,
  MiniEmailComposeMode,
  MiniEmailEngine,
  MiniEmailError,
  MiniEmailEvent,
  MiniEmailHostConnector,
  MiniEmailMessage,
  MiniEmailSearchQuery,
  MiniEmailSearchResult,
  MiniEmailState,
  MiniEmailThread,
  ResolvedMiniEmailOptions
} from './types.js';

/**
 * The engine.
 *
 * Holds the state a mini mail client needs, and nothing else. It knows about
 * one conversation — the anchor — plus whatever the reader opened from search,
 * which floats above it and never replaces it.
 *
 * Everything it can do is gated the same way, in one place: capability, then
 * config. It never asks who the reader is or what role they hold; the host has
 * already resolved that into the switches it handed over.
 */

const CONTRACT = MINIEMAIL_CONTRACT_VERSION;

/** Converts an unknown throw into the engine's own error shape. */
function toError(cause: unknown, fallback: string): MiniEmailError {
  if (cause instanceof MiniEmailAdapterError) return cause.detail;
  return {
    code: 'unexpected',
    message: cause instanceof Error ? cause.message : fallback,
    retryable: false,
    cause
  };
}

/**
 * A state patch, where `undefined` means "clear this".
 *
 * `Partial<MiniEmailState>` will not do under `exactOptionalPropertyTypes`:
 * it allows a key to be absent but not explicitly `undefined`, and clearing
 * the compose surface or the search overlay is exactly that.
 */
type MiniEmailClearable =
  | 'anchorThread'
  | 'overlayThread'
  | 'search'
  | 'compose'
  | 'pendingSend'
  | 'error'
  | 'capabilities';

type MiniEmailStatePatch = Partial<Omit<MiniEmailState, MiniEmailClearable>> & {
  [K in MiniEmailClearable]?: MiniEmailState[K] | undefined;
};

export interface MiniEmailEngineDeps {
  /** Adapter override, so tests need no real provider. */
  readonly adapter?: MiniEmailAdapter;
  readonly undoSendBuffer?: UndoSendBuffer;
}

export class MalkomMiniEmailEngine implements MiniEmailEngine {
  readonly #connector: MiniEmailHostConnector;
  readonly #options: ResolvedMiniEmailOptions;
  readonly #trust = new RemoteImageTrust();
  readonly #listeners = new Set<(state: MiniEmailState) => void>();

  #adapter: MiniEmailAdapter | undefined;
  #undoSend: UndoSendBuffer | undefined;
  #state: MiniEmailState;
  #destroyed = false;

  constructor(connector: MiniEmailHostConnector, deps: MiniEmailEngineDeps = {}) {
    this.#connector = connector;
    this.#options = resolveMiniEmailOptions(connector.input?.options);
    this.#state = {
      status: 'idle',
      options: this.#options
    };

    const check = validateHostConnector(connector);
    if (!check.ok) {
      // A malformed connector is terminal: nothing can be fetched, so the
      // panel reports why rather than half-rendering.
      this.#state = { ...this.#state, status: 'failed', error: check.error };
      return;
    }

    const context: AdapterContext = {
      connection: connector.input.connection,
      fetchTimeoutMs: this.#options.fetchTimeoutMs,
      retryAttempts: this.#options.retryAttempts
    };

    this.#adapter = deps.adapter ?? createAdapter(check.provider, context);
    this.#undoSend =
      deps.undoSendBuffer ??
      new UndoSendBuffer({
        delayMs: this.#options.undoSendEnabled ? this.#options.undoSendMs : 0
      });

    this.#emit({ type: 'mounted' });
  }

  /* ── state ─────────────────────────────────────────────────────────── */

  get state(): MiniEmailState {
    return this.#state;
  }

  get availability(): MiniEmailAvailability {
    return resolveAvailability({
      capabilities: this.#state.capabilities,
      options: this.#options,
      switches: this.#connector.enabled
    });
  }

  /** The message the reader is currently looking at. */
  get activeMessage(): MiniEmailMessage | undefined {
    const thread = this.#state.overlayThread ?? this.#state.anchorThread;
    return thread?.messages[thread.messages.length - 1];
  }

  subscribe(listener: (state: MiniEmailState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #setState(patch: MiniEmailStatePatch): void {
    if (this.#destroyed) return;

    // `undefined` in a patch means "clear this", so the key is removed rather
    // than left present-but-undefined — which `exactOptionalPropertyTypes`
    // correctly refuses to call the same thing.
    const next: Record<string, unknown> = { ...this.#state };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }

    this.#state = next as unknown as MiniEmailState;
    for (const listener of this.#listeners) listener(this.#state);
  }

  #emit(event: MiniEmailEvent): void {
    this.#connector.onEvent?.(event);
  }

  /**
   * Refuses an action the reader should not have been offered.
   *
   * Reaching here means the UI drew a control it should not have, so the block
   * is reported as an event — it is a host-side bug worth seeing, not a silent
   * no-op.
   */
  #guard(action: MiniEmailAction): boolean {
    const entry = this.availability[action];
    if (entry.allowed) return true;

    this.#emit({
      type: 'actionBlocked',
      action,
      reason: entry.reason ?? 'hostConfig'
    });
    return false;
  }

  #requireAdapter(): MiniEmailAdapter {
    if (!this.#adapter) {
      throw new MiniEmailAdapterError(
        this.#state.error ?? {
          code: 'invalidConnector',
          message: 'The engine has no usable connector.',
          retryable: false
        }
      );
    }
    return this.#adapter;
  }

  /* ── loading ───────────────────────────────────────────────────────── */

  async load(): Promise<void> {
    if (!this.#adapter) return;
    if (this.#connector.enabled?.engineEnabled === false) {
      this.#setState({ status: 'disabled' });
      return;
    }

    this.#setState({ status: 'loading' });

    try {
      // Capabilities first: what the connector may do decides which controls
      // the panel is even allowed to draw.
      const capabilities = await this.#connector.input.connection.capabilities();
      this.#setState({ capabilities });

      if (!capabilities.canRead) {
        const error: MiniEmailError = {
          code: 'authFailed',
          message: 'This connector is not permitted to read mail.',
          retryable: false
        };
        this.#setState({ status: 'failed', error });
        this.#emit({ type: 'anchorLoadFailed', error });
        return;
      }

      const { anchor } = this.#connector.input;
      const thread = await this.#adapter.fetchThread(anchor.conversationId, anchor.messageId);
      const hydrated = await this.#hydrateInlineAttachments(thread);

      this.#setState({ status: 'ready', anchorThread: hydrated });
      this.#emit({ type: 'anchorLoaded', thread: hydrated });
    } catch (cause) {
      const error = toError(cause, 'The email could not be loaded.');

      // With `cached` the panel keeps whatever it already had rather than
      // throwing the reader back to an empty screen on a transient blip.
      const keepCached =
        this.#options.connectorDownBehaviour === 'cached' && this.#state.anchorThread;

      this.#setState({ status: keepCached ? 'ready' : 'failed', error });
      this.#emit({ type: 'anchorLoadFailed', error });
    }
  }

  async refresh(): Promise<void> {
    if (!this.#guard('read')) return;
    await this.load();
  }

  /**
   * Fetches bytes for images the body references.
   *
   * Only inline parts, and only when the connector may fetch them: a `cid:`
   * image with no bytes renders as a hole in the mail, while a document
   * attachment is fine to leave until someone asks for it.
   */
  async #hydrateInlineAttachments(thread: MiniEmailThread): Promise<MiniEmailThread> {
    const capabilities = this.#state.capabilities;
    if (!capabilities?.canFetchAttachments || !this.#adapter) return thread;

    const adapter = this.#adapter;
    const messages = await Promise.all(
      thread.messages.map(async (message) => {
        const needed = message.attachments.filter(
          (attachment) => attachment.isInline && !attachment.content
        );
        if (needed.length === 0) return message;

        const fetched = await Promise.all(
          needed.map(async (attachment) => {
            try {
              const full = await adapter.fetchAttachment(message.id, attachment.id);
              // The list entry holds the real name and content id; the fetch
              // holds the bytes. Neither alone is complete — and a fetch that
              // came back empty must not overwrite the entry with `undefined`.
              return full.content
                ? { ...attachment, content: full.content }
                : attachment;
            } catch {
              // A missing inline image is not worth failing the whole mail
              // for — it renders as a placeholder instead.
              return attachment;
            }
          })
        );

        const byId = new Map(fetched.map((attachment) => [attachment.id, attachment]));
        return {
          ...message,
          attachments: message.attachments.map(
            (attachment) => byId.get(attachment.id) ?? attachment
          )
        };
      })
    );

    return { ...thread, messages };
  }

  /* ── search ────────────────────────────────────────────────────────── */

  async search(query: MiniEmailSearchQuery): Promise<MiniEmailSearchResult> {
    if (!this.#guard('search')) return { hits: [] };

    try {
      const result = await this.#requireAdapter().search({
        ...query,
        pageSize: query.pageSize ?? this.#options.searchPageSize
      });

      this.#setState({ search: result });
      this.#emit({ type: 'searchPerformed', query, hitCount: result.hits.length });
      return result;
    } catch (cause) {
      const error = toError(cause, 'Search failed.');
      this.#setState({ error });
      return { hits: [] };
    }
  }

  /**
   * Opens a search hit above the anchor.
   *
   * The anchor is untouched — it is the email the task is about, and losing it
   * would strand the reader in someone else's mailbox with no way back.
   */
  async openSearchHit(messageId: string): Promise<void> {
    if (!this.#guard('search')) return;

    const hit = this.#state.search?.hits.find((entry) => entry.messageId === messageId);
    if (!hit) return;

    try {
      const thread = await this.#requireAdapter().fetchThread(hit.conversationId, messageId);
      const hydrated = await this.#hydrateInlineAttachments(thread);

      this.#setState({ overlayThread: hydrated });
      this.#emit({ type: 'searchResultOpened', messageId });
    } catch (cause) {
      this.#setState({ error: toError(cause, 'That email could not be opened.') });
    }
  }

  dismissSearch(): void {
    this.#setState({ search: undefined, overlayThread: undefined });
    this.#emit({ type: 'searchDismissed' });
  }

  /* ── compose ───────────────────────────────────────────────────────── */

  compose(mode: MiniEmailComposeMode, sourceMessageId?: string): void {
    const action: MiniEmailAction =
      mode === 'new'
        ? 'newMail'
        : mode === 'replyAll'
          ? 'replyAll'
          : mode === 'forward'
            ? 'forward'
            : 'reply';
    if (!this.#guard(action)) return;

    const source = sourceMessageId ? this.#findMessage(sourceMessageId) : this.activeMessage;
    const self = this.#connector.input.connection.mailboxAddress
      ? { email: this.#connector.input.connection.mailboxAddress }
      : this.#currentUserAddress();

    const draft = createDraft({
      mode,
      ...(source ? { source } : {}),
      ...(self ? { self } : {}),
      options: this.#options,
      ...(this.#connector.currentUser.locale
        ? { locale: this.#connector.currentUser.locale }
        : {})
    });

    this.#setState({ compose: draft });
    this.#emit({ type: 'composeOpened', mode });

    // Forwarding carries the original attachments, which have to be fetched
    // before the message can go anywhere.
    if (mode === 'forward' && source) void this.#carryForwardAttachments(source);
  }

  async #carryForwardAttachments(source: MiniEmailMessage): Promise<void> {
    if (!this.#state.capabilities?.canFetchAttachments) return;
    if (!this.#options.attachmentsEnabled) return;

    const wanted = source.attachments.filter((attachment) => !attachment.isInline);
    if (wanted.length === 0) return;

    const adapter = this.#requireAdapter();
    const carried: MiniEmailComposeAttachment[] = [];

    for (const attachment of wanted) {
      try {
        const full = attachment.content
          ? attachment
          : await adapter.fetchAttachment(source.id, attachment.id);
        if (!full.content) continue;

        carried.push({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes || full.content.byteLength,
          content: full.content,
          copiedFromAttachmentId: attachment.id
        });
      } catch {
        // A forward missing one attachment is better than a forward that
        // cannot be composed at all; the reader can re-attach.
      }
    }

    const draft = this.#state.compose;
    if (!draft || draft.mode !== 'forward' || carried.length === 0) return;

    this.#setState({
      compose: { ...draft, attachments: [...draft.attachments, ...carried] }
    });
  }

  updateDraft(patch: Partial<MiniEmailComposeDraft>): void {
    const draft = this.#state.compose;
    if (!draft) return;
    this.#setState({ compose: { ...draft, ...patch } });
  }

  addParticipant(field: ParticipantField, address: MiniEmailAddress): void {
    if (!this.#guard('editParticipants')) return;
    const draft = this.#state.compose;
    if (!draft) return;
    this.#setState({ compose: addParticipant(draft, field, address) });
  }

  removeParticipant(field: ParticipantField, address: MiniEmailAddress): void {
    if (!this.#guard('editParticipants')) return;
    const draft = this.#state.compose;
    if (!draft) return;
    this.#setState({ compose: removeParticipant(draft, field, address) });
  }

  moveParticipant(
    from: ParticipantField,
    to: ParticipantField,
    address: MiniEmailAddress
  ): void {
    if (!this.#guard('editParticipants')) return;
    const draft = this.#state.compose;
    if (!draft) return;
    this.#setState({ compose: moveParticipant(draft, from, to, address) });
  }

  discardDraft(): void {
    const draft = this.#state.compose;
    if (!draft) return;

    this.#setState({ compose: undefined });
    this.#emit({ type: 'composeDiscarded', mode: draft.mode });

    if (draft.providerDraftId && this.#options.draftMode !== 'off') {
      void this.#requireAdapter()
        .deleteDraft(draft.providerDraftId)
        .catch(() => {
          // The reader has already moved on; a stranded provider draft is a
          // smaller problem than an error they cannot act on.
        });
    }
  }

  async saveDraft(): Promise<void> {
    if (!this.#guard('saveDraft')) return;
    const draft = this.#state.compose;
    if (!draft) return;
    if (this.#options.draftMode === 'local' || this.#options.draftMode === 'off') return;

    try {
      const providerDraftId = await this.#requireAdapter().saveDraft(draft);
      this.#setState({ compose: { ...draft, providerDraftId } });
      this.#emit({ type: 'draftSaved', providerDraftId });
    } catch (cause) {
      this.#setState({ error: toError(cause, 'The draft could not be saved.') });
    }
  }

  /* ── attachments ───────────────────────────────────────────────────── */

  async attach(files: readonly File[]): Promise<void> {
    if (!this.#guard('attach')) return;
    const draft = this.#state.compose;
    if (!draft) return;

    const added: MiniEmailComposeAttachment[] = [];

    for (const file of files) {
      const attachment: MiniEmailComposeAttachment = {
        id: `local-${file.name}-${file.size}`,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        content: await file.arrayBuffer()
      };

      const problem = validateAttachment(attachment, this.#options);
      if (problem) {
        this.#setState({ error: problem });
        continue;
      }
      added.push(attachment);
    }

    if (added.length === 0) return;

    const current = this.#state.compose;
    if (!current) return;
    this.#setState({ compose: { ...current, attachments: [...current.attachments, ...added] } });
  }

  removeAttachment(attachmentId: string): void {
    const draft = this.#state.compose;
    if (!draft) return;

    this.#setState({
      compose: {
        ...draft,
        attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId)
      }
    });
  }

  async downloadAttachment(attachmentId: string): Promise<void> {
    if (!this.#guard('downloadAttachment')) return;

    const found = this.#findAttachment(attachmentId);
    if (!found) return;

    try {
      const full = found.attachment.content
        ? found.attachment
        : await this.#requireAdapter().fetchAttachment(found.messageId, attachmentId);
      if (!full.content) return;

      const delivery = this.#options.attachmentDelivery;

      if (delivery === 'hostStore' || delivery === 'both') {
        await this.#connector.services?.storeDocument?.({
          messageId: found.messageId,
          conversationId: found.conversationId,
          filename: found.attachment.filename,
          mimeType: found.attachment.mimeType,
          sizeBytes: full.content.byteLength,
          content: full.content
        });
        this.#emit({ type: 'attachmentStored', attachmentId });
      }

      if (delivery === 'download' || delivery === 'both') {
        this.#emit({ type: 'attachmentDownloaded', attachmentId });
      }
    } catch (cause) {
      this.#setState({ error: toError(cause, 'The attachment could not be fetched.') });
    }
  }

  /* ── sending ───────────────────────────────────────────────────────── */

  async send(): Promise<void> {
    if (!this.#guard('send')) return;

    const draft = this.#state.compose;
    if (!draft) return;

    const problem = validateDraft(draft, this.#options);
    if (problem) {
      this.#setState({ error: problem });
      this.#emit({ type: 'sendFailed', error: problem });
      return;
    }

    const buffer = this.#undoSend;
    if (!buffer) return;

    const adapter = this.#requireAdapter();

    try {
      const { pending, settled } = buffer.hold(draft, (queued) => adapter.send(queued));

      // The compose surface closes at once. The message is not gone yet — it
      // is holding — but the reader has finished with it either way.
      this.#setState({ compose: undefined, pendingSend: pending, error: undefined });
      this.#emit({ type: 'sendHeld', pending });

      const result = await settled;
      this.#setState({ pendingSend: result });

      if (result.state === 'sent') {
        this.#emit({ type: 'sent', messageId: result.id, mode: draft.mode });
        // The conversation now has one more message in it.
        void this.load();
      } else if (result.state === 'cancelled') {
        // Undo puts the reader back where they were, with everything typed.
        this.#setState({ compose: draft });
        this.#emit({ type: 'sendUndone', pendingId: result.id });
      } else if (result.state === 'failed') {
        const error: MiniEmailError = {
          code: 'sendFailed',
          message: 'The message could not be sent.',
          retryable: true
        };
        this.#setState({ compose: draft, error });
        this.#emit({ type: 'sendFailed', error });
      }
    } catch (cause) {
      const error = toError(cause, 'The message could not be sent.');
      this.#setState({ error });
      this.#emit({ type: 'sendFailed', error });
    }
  }

  undoSend(): void {
    this.#undoSend?.undo();
  }

  /** Milliseconds left before a held message goes. Drives the Undo countdown. */
  undoRemainingMs(): number {
    return this.#undoSend?.remainingMs() ?? 0;
  }

  /* ── images ────────────────────────────────────────────────────────── */

  allowRemoteImages(messageId: string): void {
    const message = this.#findMessage(messageId);
    if (message && this.#options.rememberImageChoicePerSender) {
      this.#trust.trust(message.from.email);
    }
    this.#emit({ type: 'remoteImagesAllowed', messageId });
    // State is unchanged: the frame owns rendered markup, and re-rendering the
    // whole thread to reveal one image would lose scroll position.
    this.#setState({});
  }

  /** Whether this message's remote images should be withheld. */
  shouldBlockRemoteImages(message: MiniEmailMessage): boolean {
    if (!this.#options.blockRemoteImages) return false;
    if (!this.#options.rememberImageChoicePerSender) return true;
    return !this.#trust.trusts(message.from.email);
  }

  /* ── lookup helpers ────────────────────────────────────────────────── */

  #findMessage(messageId: string): MiniEmailMessage | undefined {
    for (const thread of [this.#state.overlayThread, this.#state.anchorThread]) {
      const found = thread?.messages.find((message) => message.id === messageId);
      if (found) return found;
    }
    return undefined;
  }

  #findAttachment(attachmentId: string):
    | {
        readonly attachment: MiniEmailAttachment;
        readonly messageId: string;
        readonly conversationId: string;
      }
    | undefined {
    for (const thread of [this.#state.overlayThread, this.#state.anchorThread]) {
      for (const message of thread?.messages ?? []) {
        const attachment = message.attachments.find((entry) => entry.id === attachmentId);
        if (attachment) {
          return {
            attachment,
            messageId: message.id,
            conversationId: message.conversationId
          };
        }
      }
    }
    return undefined;
  }

  #currentUserAddress(): MiniEmailAddress | undefined {
    const email = this.#connector.currentUser.email;
    return email ? { email } : undefined;
  }

  /* ── lifecycle ─────────────────────────────────────────────────────── */

  destroy(): void {
    if (this.#destroyed) return;

    this.#undoSend?.destroy();
    this.#trust.clear();
    this.#listeners.clear();
    this.#destroyed = true;
    this.#emit({ type: 'destroyed' });
  }
}

/** Builds an engine from a host connector. */
export function createMiniEmailEngine(
  connector: MiniEmailHostConnector,
  deps?: MiniEmailEngineDeps
): MalkomMiniEmailEngine {
  return new MalkomMiniEmailEngine(connector, deps);
}

export { CONTRACT as MINIEMAIL_ENGINE_CONTRACT };
