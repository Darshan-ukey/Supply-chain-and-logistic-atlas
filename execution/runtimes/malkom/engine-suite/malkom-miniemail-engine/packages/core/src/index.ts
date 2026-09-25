/**
 * @malkom/miniemail-core — public entry point.
 *
 * A mini mail client for one email, rendered inside a task detail. Provider
 * work sits behind adapters; everything above them speaks one normalized
 * shape. Nothing is hardcoded — see `MiniEmailOptions`.
 */

export * from './types.js';

export {
  DEFAULT_MINIEMAIL_OPTIONS,
  resolveMiniEmailOptions
} from './defaults/options.js';

export { MINIEMAIL_CONTRACT_VERSION, validateHostConnector } from './contract.js';

export {
  MalkomMiniEmailEngine,
  createMiniEmailEngine,
  type MiniEmailEngineDeps
} from './engine.js';

export {
  resolveAvailability,
  isAllowed,
  blockReason,
  type AvailabilityInput
} from './availability.js';

export {
  createDraft,
  addParticipant,
  removeParticipant,
  moveParticipant,
  validateDraft,
  validateAttachment,
  isPlausibleEmail,
  replySubject,
  forwardSubject,
  replyRecipients,
  replyAllRecipients,
  buildQuote,
  attributionLine,
  forwardHeaderBlock,
  type ComposeInput,
  type ParticipantField
} from './compose.js';

export {
  UndoSendBuffer,
  type UndoSendOptions,
  type HoldResult,
  type NowFn
} from './undoSend.js';

/* ── rendering ─────────────────────────────────────────────────────────── */

export {
  SealedFrame,
  type FrameRenderInput,
  type FrameRenderResult
} from './render/frame.js';

export {
  sanitizeEmailHtml,
  sanitizeStyle,
  BLOCKED_IMAGE_ATTR,
  BLOCKED_IMAGE_SRC,
  INLINE_IMAGE_ATTR,
  type SanitizeOptions,
  type SanitizeResult
} from './render/sanitize.js';

export {
  resolveInlineImages,
  revealRemoteImages,
  countBlockedImages,
  pendingContentIds,
  normalizeContentId,
  toDataUrl,
  RemoteImageTrust
} from './render/images.js';

export {
  markQuotedContent,
  unmarkQuotedContent,
  removeQuotedContent,
  QUOTE_MARKER_ATTR,
  type QuoteSplitResult
} from './render/quote.js';

/* ── adapters ──────────────────────────────────────────────────────────── */

export {
  createAdapter,
  GmailAdapter,
  GraphAdapter,
  buildGmailQuery,
  buildGraphFilter,
  buildGraphSearch,
  MiniEmailAdapterError,
  callProvider,
  errorForStatus,
  isRetryableStatus,
  type MiniEmailAdapter,
  type AdapterContext
} from './adapters/index.js';

export {
  parseAddress,
  parseAddressList,
  formatAddress,
  formatAddressList,
  splitAddressList,
  dedupeAddresses,
  sameAddress,
  buildRfc822Message,
  encodeBase64,
  decodeBase64,
  base64ToBase64Url,
  base64UrlToBase64,
  decodeBase64Url,
  decodeBase64UrlText,
  encodeHeaderValue,
  type BuildMessageInput
} from './adapters/mime.js';
