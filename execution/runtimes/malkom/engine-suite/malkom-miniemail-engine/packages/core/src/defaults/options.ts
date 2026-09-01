import type { MiniEmailOptions, ResolvedMiniEmailOptions } from '../types.js';

/**
 * Every behavioural constant in the engine, in one place.
 *
 * Nothing is hardcoded elsewhere: engine code reads `ResolvedMiniEmailOptions`
 * only. Defaults are chosen so the engine works fully out of the box — the
 * host overrides just what it disagrees with.
 */
export const DEFAULT_MINIEMAIL_OPTIONS: ResolvedMiniEmailOptions = {
  // Search — real provider mailbox search, on by default.
  searchEnabled: true,
  searchPageSize: 25,
  searchDebounceMs: 300,
  searchResultActionsEnabled: true,
  searchOverlayDismissOnEscape: true,

  // Rendering — faithful, but never trusted.
  blockRemoteImages: true,
  rememberImageChoicePerSender: true,
  collapseQuotedText: true,
  collapseThreadBeyond: 3,
  maxRenderHeightPx: 'auto',
  sanitizerProfile: 'strict',
  allowedSchemes: ['http', 'https', 'mailto', 'cid'],
  openLinksInNewTab: true,

  // Compose.
  replyEnabled: true,
  replyAllEnabled: true,
  forwardEnabled: true,
  newMailEnabled: true,
  participantEditEnabled: true,
  signatureMode: 'provider',
  quoteOriginalOnReply: true,

  // Send. No approval mechanism exists — switches only.
  undoSendEnabled: true,
  undoSendMs: 8_000,
  confirmBeforeSend: false,

  // Drafts.
  draftMode: 'provider',
  draftAutosaveMs: 5_000,

  // Attachments.
  attachmentsEnabled: true,
  maxAttachmentMb: 25,
  allowedAttachmentTypes: 'any',
  attachmentDelivery: 'both',

  // Fetch behaviour.
  fetchTimeoutMs: 20_000,
  retryAttempts: 2,
  cacheRenderedEmail: true,
  connectorDownBehaviour: 'cached'
};

/**
 * Applies defaults once, up front. Engine code never falls back inline.
 *
 * `undefined` is treated as "not stated", so a host may pass a sparse object
 * without wiping defaults.
 */
export function resolveMiniEmailOptions(
  options: MiniEmailOptions | undefined
): ResolvedMiniEmailOptions {
  if (!options) return { ...DEFAULT_MINIEMAIL_OPTIONS };

  const resolved: Record<string, unknown> = { ...DEFAULT_MINIEMAIL_OPTIONS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) resolved[key] = value;
  }
  return resolved as ResolvedMiniEmailOptions;
}
