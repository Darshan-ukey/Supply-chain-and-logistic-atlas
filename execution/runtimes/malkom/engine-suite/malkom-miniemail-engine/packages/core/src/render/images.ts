import type { MiniEmailAttachment } from '../types.js';
import {
  BLOCKED_IMAGE_ATTR,
  BLOCKED_IMAGE_SRC,
  INLINE_IMAGE_ATTR
} from './sanitize.js';

/**
 * Image resolution for a sanitized body.
 *
 * Two kinds of image survive sanitizing, both parked on `about:blank`:
 *
 *  - **inline** (`cid:`) — part of the mail itself. Resolved from attachment
 *    bytes as soon as they arrive; no network request is involved.
 *  - **remote** (`http(s)`) — fetched from a third-party server. Withheld
 *    until the reader asks for them, because loading one tells the sender the
 *    mail was opened and by whom.
 *
 * Both operate on a live DOM inside the sealed frame, so nothing is
 * re-serialized and re-parsed after sanitizing.
 */

/** Encodes attachment bytes as a `data:` URL the frame can render offline. */
export function toDataUrl(mimeType: string, content: ArrayBuffer): string {
  const bytes = new Uint8Array(content);
  let binary = '';
  // Chunked so a large image cannot blow the argument limit of `fromCharCode`.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/** Normalizes the content id forms providers use: `<id>`, `id`, `cid:id`. */
export function normalizeContentId(raw: string): string {
  return raw.replace(/^cid:/i, '').replace(/^<|>$/g, '').trim();
}

/**
 * Points inline images at their attachment bytes.
 *
 * Matching is by content id first, then by filename: a few senders reference
 * `cid:logo.png` while the part is only named, not content-id'd.
 *
 * Returns the number of images resolved. Unmatched ones keep the placeholder
 * rather than showing a broken image.
 */
export function resolveInlineImages(
  root: ParentNode,
  attachments: readonly MiniEmailAttachment[]
): number {
  const byId = new Map<string, MiniEmailAttachment>();
  for (const att of attachments) {
    if (!att.content) continue;
    if (att.contentId) byId.set(normalizeContentId(att.contentId), att);
    if (att.filename) byId.set(att.filename.toLowerCase(), att);
  }
  if (byId.size === 0) return 0;

  let resolved = 0;
  for (const el of root.querySelectorAll(`img[${INLINE_IMAGE_ATTR}]`)) {
    const cid = el.getAttribute(INLINE_IMAGE_ATTR);
    if (!cid) continue;

    const match = byId.get(cid) ?? byId.get(cid.toLowerCase());
    if (!match?.content) continue;

    el.setAttribute('src', toDataUrl(match.mimeType, match.content));
    el.removeAttribute(INLINE_IMAGE_ATTR);
    resolved += 1;
  }
  return resolved;
}

/**
 * Restores withheld remote images after the reader allows them.
 *
 * The original URL was parked in a data attribute at sanitize time, so this
 * needs no re-sanitizing — the URL already passed the scheme allowlist.
 */
export function revealRemoteImages(root: ParentNode): number {
  let revealed = 0;
  for (const el of root.querySelectorAll(`img[${BLOCKED_IMAGE_ATTR}]`)) {
    const src = el.getAttribute(BLOCKED_IMAGE_ATTR);
    if (!src) continue;

    el.setAttribute('src', src);
    el.removeAttribute(BLOCKED_IMAGE_ATTR);
    revealed += 1;
  }
  return revealed;
}

/** How many remote images are still withheld in this tree. */
export function countBlockedImages(root: ParentNode): number {
  return root.querySelectorAll(`img[${BLOCKED_IMAGE_ATTR}]`).length;
}

/** Content ids still waiting on attachment bytes. */
export function pendingContentIds(root: ParentNode): readonly string[] {
  const ids = new Set<string>();
  for (const el of root.querySelectorAll(`img[${INLINE_IMAGE_ATTR}]`)) {
    const cid = el.getAttribute(INLINE_IMAGE_ATTR);
    if (cid) ids.add(cid);
  }
  return [...ids];
}

/**
 * Remembers who the reader trusts with remote images.
 *
 * Deliberately in-memory and per-instance: a durable store would need host
 * consent and a retention decision, so the host owns that if it wants it.
 */
export class RemoteImageTrust {
  readonly #trusted = new Set<string>();

  trust(senderEmail: string): void {
    this.#trusted.add(senderEmail.toLowerCase());
  }

  trusts(senderEmail: string): boolean {
    return this.#trusted.has(senderEmail.toLowerCase());
  }

  clear(): void {
    this.#trusted.clear();
  }
}

export { BLOCKED_IMAGE_SRC };
