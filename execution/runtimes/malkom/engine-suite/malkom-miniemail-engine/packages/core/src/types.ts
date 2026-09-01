/**
 * Malkom Mini Email Engine — the entire public type surface.
 *
 * Nothing in this file is provider-specific. Gmail and Microsoft Graph are
 * mapped into these shapes by adapters; a host never sees a provider payload.
 *
 * Ground rules encoded here:
 *  - everything configurable, nothing hardcoded (see `MiniEmailOptions`);
 *  - the engine knows nothing about roles — it reads resolved booleans;
 *  - no approval mechanism anywhere, only switches;
 *  - no `any` at any boundary.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Family standard — MalkomEngineHostConnector
 *
 * Every Malkom engine takes host input through this one named object. The
 * base is identical across engines; the payload is typed per engine.
 * ──────────────────────────────────────────────────────────────────────── */

/** Every engine in the family, so a connector can name its target. */
export type MalkomEngineId =
  | 'miniemail'
  | 'table'
  | 'workallocation'
  | 'rules'
  | 'processmetrics'
  | 'processmining'
  | 'integration'
  | 'classification'
  | 'extraction'
  | 'validation'
  | 'quality'
  | 'workflow'
  | 'aitesting';

/** The human acting in the client. Display and audit only. */
export interface MalkomHostUser {
  readonly id: string;
  readonly displayName: string;
  /** Shown in compose UI where the provider does not supply its own. */
  readonly email?: string;
  readonly avatarUrl?: string;
  /** IETF tag, e.g. 'en-GB'. Drives date and number formatting. */
  readonly locale?: string;
  /** IANA zone, e.g. 'Asia/Kolkata'. Drives displayed timestamps. */
  readonly timeZone?: string;
}

/** The tenant the session belongs to. */
export interface MalkomHostOrganisation {
  readonly id: string;
  readonly name?: string;
}

/**
 * Flat, already-resolved switches common to every engine.
 *
 * The host has finished applying its role rules before this point. The engine
 * sees booleans, never roles, and never asks who decided or why.
 */
export interface MalkomHostSwitches {
  /** Master off switch. When false the engine mounts in a disabled state. */
  readonly engineEnabled?: boolean;
  /** When false, every mutating action is hidden regardless of finer config. */
  readonly writeEnabled?: boolean;
  /** Engine may surface its own settings UI to this user. */
  readonly settingsVisible?: boolean;
}

/** Tailwind class tokens. Every visual surface is overridable. */
export type MalkomTheme = Readonly<Record<string, string>>;

/** Every user-facing string. No literal copy exists in engine code. */
export type MalkomLabels = Readonly<Record<string, string>>;

/** Material Symbols Rounded ligature names, or host-supplied markup. */
export type MalkomIcons = Readonly<Record<string, string>>;

/** Optional host services the engine may call back into. */
export interface MalkomHostServices {
  /** Structured logging. The engine never touches `console` directly. */
  readonly log?: (entry: MalkomLogEntry) => void;
  /** Transient user feedback ("Message sent", "Send undone"). */
  readonly notify?: (notice: MalkomNotice) => void;
  /**
   * Hand an attachment to the host document store. Present only when the
   * host wants attachments captured; see `attachmentDelivery`.
   */
  readonly storeDocument?: (doc: MiniEmailDocumentHandoff) => Promise<void>;
}

export type MalkomLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface MalkomLogEntry {
  readonly level: MalkomLogLevel;
  readonly message: string;
  readonly engine: MalkomEngineId;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface MalkomNotice {
  readonly kind: 'info' | 'success' | 'warning' | 'error';
  readonly message: string;
  /** Inline action, e.g. the Undo affordance on a pending send. */
  readonly action?: {
    readonly label: string;
    readonly run: () => void;
  };
}

/** Engine → host event sink. Lifecycle, actions, errors. */
export interface MalkomHostEventSink<TEvent = MiniEmailEvent> {
  readonly onEvent?: (event: TEvent) => void;
}

/** Family-wide base. Identical for every Malkom engine. */
export interface MalkomEngineHostConnectorBase {
  /** Which engine this connector feeds. */
  readonly engine: MalkomEngineId;
  /** Contract version, so host and engine disagree loudly rather than oddly. */
  readonly contractVersion: string;
  readonly currentUser: MalkomHostUser;
  readonly organisation: MalkomHostOrganisation;
  readonly enabled?: MalkomHostSwitches;
  readonly theme?: MalkomTheme;
  readonly labels?: MalkomLabels;
  readonly icons?: MalkomIcons;
  readonly services?: MalkomHostServices;
}

/** Generic wrapper. Each engine supplies its own payload type. */
export interface MalkomEngineHostConnector<TInput, TEvent = MiniEmailEvent>
  extends MalkomEngineHostConnectorBase,
    MalkomHostEventSink<TEvent> {
  readonly input: TInput;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Provider surface — supplied by malkom-integration-engine
 *
 * The integration engine hands over a live connection, not clean data. All
 * provider mess is handled inside this engine, behind adapters.
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailProvider = 'gmail' | 'outlook';

/** What a connector is permitted to do. Capability, not preference. */
export interface MiniEmailCapabilities {
  readonly canRead: boolean;
  readonly canSearch: boolean;
  readonly canSend: boolean;
  readonly canDraft: boolean;
  readonly canFetchAttachments: boolean;
  readonly canModifyParticipants: boolean;
}

/**
 * A live connection handle from malkom-integration-engine.
 *
 * The engine never sees credentials. It calls `request` and the connector
 * attaches whatever auth the organisation configured.
 */
export interface MalkomIntegrationConnection {
  readonly id: string;
  /** Present when the connector knows; otherwise the host states it. */
  readonly provider?: MiniEmailProvider;
  /** The mailbox replies will be sent from. Display only. */
  readonly mailboxAddress?: string;
  /** Capabilities, resolved by the connector for this organisation. */
  capabilities(): Promise<MiniEmailCapabilities> | MiniEmailCapabilities;
  /** Authenticated provider call. The engine builds path, verb and body. */
  request(req: MiniEmailProviderRequest): Promise<MiniEmailProviderResponse>;
}

export interface MiniEmailProviderRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Provider-relative path, built by the adapter. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | ArrayBuffer | Readonly<Record<string, unknown>>;
  /** Adapters ask for bytes when fetching attachment content. */
  readonly responseType?: 'json' | 'text' | 'binary';
  readonly signal?: AbortSignal;
}

export interface MiniEmailProviderResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Shape follows the request's `responseType`. Adapters narrow it. */
  readonly body: unknown;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Normalized email model
 *
 * One shape for both providers. Unknown provider fields are dropped, never
 * passed through.
 * ──────────────────────────────────────────────────────────────────────── */

export interface MiniEmailAddress {
  readonly email: string;
  readonly name?: string;
}

export type MiniEmailBodyKind = 'html' | 'text';

export interface MiniEmailBody {
  readonly kind: MiniEmailBodyKind;
  /** Raw provider content. Never rendered before sanitizing. */
  readonly content: string;
  /** Plain-text alternative, when the provider supplies one. */
  readonly textFallback?: string;
}

export interface MiniEmailAttachment {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** True for images referenced by the body via `cid:`. */
  readonly isInline: boolean;
  /** Content id, present for inline parts. */
  readonly contentId?: string;
  /** Bytes are fetched on demand; absent until then. */
  readonly content?: ArrayBuffer;
}

export interface MiniEmailMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly subject: string;
  readonly from: MiniEmailAddress;
  readonly to: readonly MiniEmailAddress[];
  readonly cc: readonly MiniEmailAddress[];
  readonly bcc: readonly MiniEmailAddress[];
  readonly replyTo: readonly MiniEmailAddress[];
  /** ISO 8601. */
  readonly receivedAt: string;
  readonly sentAt?: string;
  readonly body: MiniEmailBody;
  readonly attachments: readonly MiniEmailAttachment[];
  readonly snippet?: string;
  readonly isRead?: boolean;
  readonly isDraft?: boolean;
  /** Threading headers, preserved so replies land in the right conversation. */
  readonly headers: MiniEmailThreadHeaders;
}

export interface MiniEmailThreadHeaders {
  readonly messageId?: string;
  readonly inReplyTo?: string;
  readonly references?: readonly string[];
}

export interface MiniEmailThread {
  readonly conversationId: string;
  readonly subject: string;
  /** Oldest first. Always contains at least the requested message. */
  readonly messages: readonly MiniEmailMessage[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4. Search — real provider mailbox search, shown as an overlay
 *
 * The anchor email is never replaced. Results are a picker, not a view.
 * ──────────────────────────────────────────────────────────────────────── */

export interface MiniEmailSearchQuery {
  /** Free text. Adapters translate to Gmail query syntax or Graph $search. */
  readonly text: string;
  readonly from?: string;
  readonly to?: string;
  readonly hasAttachment?: boolean;
  /** ISO 8601 bounds. */
  readonly after?: string;
  readonly before?: string;
  readonly pageSize?: number;
  readonly pageToken?: string;
}

export interface MiniEmailSearchHit {
  readonly messageId: string;
  readonly conversationId: string;
  readonly subject: string;
  readonly from: MiniEmailAddress;
  readonly receivedAt: string;
  readonly snippet?: string;
  readonly hasAttachments: boolean;
}

export interface MiniEmailSearchResult {
  readonly hits: readonly MiniEmailSearchHit[];
  readonly nextPageToken?: string;
  /** Provider estimate; absent when the provider does not report one. */
  readonly estimatedTotal?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Compose, drafts and send
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailComposeMode = 'reply' | 'replyAll' | 'forward' | 'new';

/**
 * What a reply needs in order to land in the right conversation.
 *
 * Carried on the draft rather than looked up at send time, so the association
 * is fixed at the moment the reader chose to reply — even if the thread moves
 * on underneath them.
 */
export interface MiniEmailThreadContext {
  readonly conversationId: string;
  /** The `Message-ID` header of the message being answered. */
  readonly messageIdHeader?: string;
  /** The `References` chain, extended with the answered message. */
  readonly references?: readonly string[];
}

export interface MiniEmailComposeDraft {
  readonly mode: MiniEmailComposeMode;
  /** Message being responded to. Absent for `new`. */
  readonly inReplyToMessageId?: string;
  readonly to: readonly MiniEmailAddress[];
  readonly cc: readonly MiniEmailAddress[];
  readonly bcc: readonly MiniEmailAddress[];
  readonly subject: string;
  readonly body: MiniEmailBody;
  readonly attachments: readonly MiniEmailComposeAttachment[];
  /** Threading ids. Absent for `new`, which starts its own conversation. */
  readonly threadContext?: MiniEmailThreadContext;
  /** Provider draft id, once saved server-side. */
  readonly providerDraftId?: string;
}

export interface MiniEmailComposeAttachment {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: ArrayBuffer;
  /** Set when the attachment was carried over from a forwarded message. */
  readonly copiedFromAttachmentId?: string;
}

/** A send that is holding for the undo window, or already gone. */
export interface MiniEmailPendingSend {
  readonly id: string;
  readonly draft: MiniEmailComposeDraft;
  /** Epoch ms at which the hold expires and the send fires. */
  readonly sendsAt: number;
  readonly state: 'holding' | 'sending' | 'sent' | 'cancelled' | 'failed';
}

/** Attachment handed to the host document store. */
export interface MiniEmailDocumentHandoff {
  readonly messageId: string;
  readonly conversationId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: ArrayBuffer;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Configuration — everything, no exceptions
 *
 * Every field optional. The comment is the default the engine applies when
 * the host says nothing. Defaults ship sensible and on, so a host only
 * overrides what it disagrees with.
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailSanitizerProfile = 'strict' | 'balanced';

export type MiniEmailSignatureMode = 'provider' | 'host' | 'none';

export type MiniEmailDraftMode = 'provider' | 'local' | 'both' | 'off';

export type MiniEmailAttachmentDelivery = 'download' | 'hostStore' | 'both';

export type MiniEmailConnectorDownBehaviour = 'cached' | 'fail';

export interface MiniEmailOptions {
  /* ── Search ────────────────────────────────────────────────────────── */
  readonly searchEnabled?: boolean; // true
  readonly searchPageSize?: number; // 25
  readonly searchDebounceMs?: number; // 300
  readonly searchResultActionsEnabled?: boolean; // true
  readonly searchOverlayDismissOnEscape?: boolean; // true

  /* ── Rendering ─────────────────────────────────────────────────────── */
  readonly blockRemoteImages?: boolean; // true
  readonly rememberImageChoicePerSender?: boolean; // true
  readonly collapseQuotedText?: boolean; // true
  readonly collapseThreadBeyond?: number; // 3 — newest kept open
  readonly maxRenderHeightPx?: number | 'auto'; // 'auto'
  readonly sanitizerProfile?: MiniEmailSanitizerProfile; // 'strict'
  readonly allowedSchemes?: readonly string[]; // http, https, mailto, cid
  readonly openLinksInNewTab?: boolean; // true

  /* ── Compose ───────────────────────────────────────────────────────── */
  readonly replyEnabled?: boolean; // true
  readonly replyAllEnabled?: boolean; // true
  readonly forwardEnabled?: boolean; // true
  readonly newMailEnabled?: boolean; // true
  readonly participantEditEnabled?: boolean; // true
  readonly signatureMode?: MiniEmailSignatureMode; // 'provider'
  readonly quoteOriginalOnReply?: boolean; // true

  /* ── Send (no approvals anywhere — switches only) ──────────────────── */
  readonly undoSendEnabled?: boolean; // true
  readonly undoSendMs?: number; // 8000
  readonly confirmBeforeSend?: boolean; // false — a UI confirm, not approval

  /* ── Drafts ────────────────────────────────────────────────────────── */
  readonly draftMode?: MiniEmailDraftMode; // 'provider'
  readonly draftAutosaveMs?: number; // 5000

  /* ── Attachments ───────────────────────────────────────────────────── */
  readonly attachmentsEnabled?: boolean; // true
  readonly maxAttachmentMb?: number; // 25
  readonly allowedAttachmentTypes?: readonly string[] | 'any'; // 'any'
  readonly attachmentDelivery?: MiniEmailAttachmentDelivery; // 'both'

  /* ── Fetch behaviour ───────────────────────────────────────────────── */
  readonly fetchTimeoutMs?: number; // 20000
  readonly retryAttempts?: number; // 2
  readonly cacheRenderedEmail?: boolean; // true
  readonly connectorDownBehaviour?: MiniEmailConnectorDownBehaviour; // 'cached'
}

/** Options after defaults are applied once, up front. No optionals remain. */
export type ResolvedMiniEmailOptions = Required<MiniEmailOptions>;

/* ────────────────────────────────────────────────────────────────────────────
 * 7. Host input and the mini-email connector
 * ──────────────────────────────────────────────────────────────────────── */

/** The task's email. Captured at intake; never replaced by search. */
export interface MiniEmailAnchor {
  readonly conversationId: string;
  readonly messageId: string;
  /** ISO 8601, as recorded on the queue item. */
  readonly receivedAt: string;
}

export interface MiniEmailHostInput {
  readonly connection: MalkomIntegrationConnection;
  /** Optional when the connection already names its provider. */
  readonly provider?: MiniEmailProvider;
  readonly anchor: MiniEmailAnchor;
  readonly options?: MiniEmailOptions;
}

/** The object the client runtime builds and hands over. */
export type MiniEmailHostConnector = MalkomEngineHostConnector<
  MiniEmailHostInput,
  MiniEmailEvent
>;

/* ────────────────────────────────────────────────────────────────────────────
 * 8. Events — engine → host
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailEvent =
  | { readonly type: 'mounted' }
  | { readonly type: 'anchorLoaded'; readonly thread: MiniEmailThread }
  | { readonly type: 'anchorLoadFailed'; readonly error: MiniEmailError }
  | { readonly type: 'remoteImagesAllowed'; readonly messageId: string }
  | { readonly type: 'searchPerformed'; readonly query: MiniEmailSearchQuery; readonly hitCount: number }
  | { readonly type: 'searchResultOpened'; readonly messageId: string }
  | { readonly type: 'searchDismissed' }
  | { readonly type: 'composeOpened'; readonly mode: MiniEmailComposeMode }
  | { readonly type: 'composeDiscarded'; readonly mode: MiniEmailComposeMode }
  | { readonly type: 'draftSaved'; readonly providerDraftId?: string }
  | { readonly type: 'sendHeld'; readonly pending: MiniEmailPendingSend }
  | { readonly type: 'sendUndone'; readonly pendingId: string }
  | { readonly type: 'sent'; readonly messageId: string; readonly mode: MiniEmailComposeMode }
  | { readonly type: 'sendFailed'; readonly error: MiniEmailError }
  | { readonly type: 'attachmentDownloaded'; readonly attachmentId: string }
  | { readonly type: 'attachmentStored'; readonly attachmentId: string }
  | { readonly type: 'actionBlocked'; readonly action: MiniEmailAction; readonly reason: MiniEmailBlockReason }
  | { readonly type: 'destroyed' };

export type MiniEmailAction =
  | 'read'
  | 'search'
  | 'reply'
  | 'replyAll'
  | 'forward'
  | 'newMail'
  | 'editParticipants'
  | 'attach'
  | 'send'
  | 'saveDraft'
  | 'downloadAttachment';

/** Why an action is unavailable. Two layers, in this order. */
export type MiniEmailBlockReason =
  /** The connector cannot do it — capability. */
  | 'connectorCapability'
  /** The host switched it off — config, with role rules already applied. */
  | 'hostConfig';

/* ────────────────────────────────────────────────────────────────────────────
 * 9. Errors
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailErrorCode =
  | 'invalidConnector'
  | 'contractVersionMismatch'
  | 'unknownProvider'
  | 'connectorUnavailable'
  | 'authFailed'
  | 'notFound'
  | 'rateLimited'
  | 'timeout'
  | 'attachmentTooLarge'
  | 'attachmentTypeNotAllowed'
  | 'sendFailed'
  | 'draftFailed'
  | 'sanitizerFailed'
  | 'unexpected';

export interface MiniEmailError {
  readonly code: MiniEmailErrorCode;
  /** Engine-authored, already localised through `labels`. */
  readonly message: string;
  /** Provider status, when the failure came from a provider call. */
  readonly status?: number;
  /** True when retrying the same action could plausibly succeed. */
  readonly retryable: boolean;
  readonly cause?: unknown;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 10. Engine instance — what the host holds after mounting
 * ──────────────────────────────────────────────────────────────────────── */

export type MiniEmailStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'failed'
  | 'disabled';

export interface MiniEmailState {
  readonly status: MiniEmailStatus;
  /** The task's thread. Present once loaded, and never swapped out. */
  readonly anchorThread?: MiniEmailThread;
  /** A thread opened from a search hit, shown above the anchor. */
  readonly overlayThread?: MiniEmailThread;
  readonly search?: MiniEmailSearchResult;
  readonly compose?: MiniEmailComposeDraft;
  readonly pendingSend?: MiniEmailPendingSend;
  readonly error?: MiniEmailError;
  readonly capabilities?: MiniEmailCapabilities;
  readonly options: ResolvedMiniEmailOptions;
}

/** Which actions are currently available, and why not when they are not. */
export type MiniEmailAvailability = Readonly<
  Record<MiniEmailAction, { readonly allowed: boolean; readonly reason?: MiniEmailBlockReason }>
>;

export interface MiniEmailEngine {
  readonly state: MiniEmailState;
  readonly availability: MiniEmailAvailability;

  /** Load the anchor thread. Called once on mount. */
  load(): Promise<void>;
  /** Re-fetch the anchor from the provider, bypassing cache. */
  refresh(): Promise<void>;

  search(query: MiniEmailSearchQuery): Promise<MiniEmailSearchResult>;
  openSearchHit(messageId: string): Promise<void>;
  dismissSearch(): void;

  compose(mode: MiniEmailComposeMode, sourceMessageId?: string): void;
  updateDraft(patch: Partial<MiniEmailComposeDraft>): void;
  discardDraft(): void;
  saveDraft(): Promise<void>;

  /** Queues the send behind the undo window when it is enabled. */
  send(): Promise<void>;
  undoSend(): void;

  attach(files: readonly File[]): Promise<void>;
  removeAttachment(attachmentId: string): void;
  downloadAttachment(attachmentId: string): Promise<void>;

  /** Reveal blocked remote images for one message. */
  allowRemoteImages(messageId: string): void;

  subscribe(listener: (state: MiniEmailState) => void): () => void;
  destroy(): void;
}
