import type { MiniEmailAttachment, ResolvedMiniEmailOptions } from '../types.js';
import { resolveInlineImages, revealRemoteImages, countBlockedImages } from './images.js';
import { markQuotedContent, unmarkQuotedContent, QUOTE_MARKER_ATTR } from './quote.js';
import { sanitizeEmailHtml } from './sanitize.js';

/**
 * The sealed frame.
 *
 * Email carries its own CSS, written years ago against clients we do not
 * control, and it fights any stylesheet around it. Rendering it inline would
 * mean two-way damage: the mail would restyle Malkom, and Malkom's resets
 * would restyle the mail until it no longer looked like itself.
 *
 * So the body renders inside a same-document `iframe`:
 *
 *  - the frame is `sandbox`ed, so even if something survived sanitizing it has
 *    no script execution, no form submission, no top-level navigation;
 *  - the frame carries no host stylesheet, so the mail renders as its sender
 *    wrote it;
 *  - the frame reports its own height, so the panel grows to fit rather than
 *    scrolling a box inside a box.
 *
 * `srcdoc` is deliberately not used: the frame is written through its own
 * document so the live DOM stays reachable for image reveal and quote folding
 * without a re-parse.
 */

/** Sandbox tokens. `allow-scripts` is absent, and must stay absent. */
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

/**
 * Baseline styles inside the frame.
 *
 * Minimal on purpose — enough to stop a wide table from forcing a horizontal
 * scrollbar on the whole panel, and to fold the quoted region, without
 * imposing a look on the mail.
 */
function frameStyles(options: ResolvedMiniEmailOptions): string {
  return `
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      /* Email assumes a desktop client default, not a CSS reset. */
      font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: inherit;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    /* Wide content scrolls inside itself; the panel never scrolls sideways. */
    body { overflow-x: auto; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
    ${
      options.collapseQuotedText
        ? `[${QUOTE_MARKER_ATTR}] { display: none; }`
        : ''
    }
  `;
}

export interface FrameRenderInput {
  readonly html: string;
  readonly attachments: readonly MiniEmailAttachment[];
  readonly options: ResolvedMiniEmailOptions;
  /** Overridden per message once the reader allows this sender's images. */
  readonly blockRemoteImages?: boolean;
}

export interface FrameRenderResult {
  readonly blockedImageCount: number;
  readonly inlineContentIds: readonly string[];
  readonly hasQuotedContent: boolean;
}

/**
 * Owns one `iframe` and the message rendered inside it.
 *
 * The host never touches the frame directly; every mutation the reader can
 * trigger — reveal images, unfold the quote, attachment bytes arriving — is a
 * method here, so nothing re-parses or re-sanitizes behind the scenes.
 */
export class SealedFrame {
  readonly #iframe: HTMLIFrameElement;
  readonly #onHeightChange: ((height: number) => void) | undefined;
  #resizeObserver: ResizeObserver | undefined;
  #quoteVisible = false;
  #heightCap: number | undefined;

  constructor(
    container: HTMLElement,
    onHeightChange?: (height: number) => void
  ) {
    this.#onHeightChange = onHeightChange;

    const doc = container.ownerDocument;
    const iframe = doc.createElement('iframe');
    iframe.setAttribute('sandbox', SANDBOX);
    // Referrer would leak the reader's location to every image host.
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Email message');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.height = '0px';

    container.appendChild(iframe);
    this.#iframe = iframe;
  }

  get element(): HTMLIFrameElement {
    return this.#iframe;
  }

  /** The frame's document, once the browser has created it. */
  get #document(): Document | undefined {
    return this.#iframe.contentDocument ?? undefined;
  }

  /**
   * Sanitizes, writes and wires up one message body.
   *
   * Returns what the surrounding UI needs to decide which bars to show: how
   * many images are withheld, which attachment bytes are still needed, and
   * whether there is a quote to unfold.
   */
  render(input: FrameRenderInput): FrameRenderResult {
    const { options } = input;
    const blockRemote = input.blockRemoteImages ?? options.blockRemoteImages;

    const sanitized = sanitizeEmailHtml(input.html, {
      profile: options.sanitizerProfile,
      allowedSchemes: options.allowedSchemes,
      blockRemoteImages: blockRemote,
      openLinksInNewTab: options.openLinksInNewTab
    });

    const doc = this.#document;
    if (!doc) {
      // The frame is not in a document yet. Nothing is rendered, and the
      // caller learns the shape of the message anyway.
      return {
        blockedImageCount: sanitized.blockedImageCount,
        inlineContentIds: sanitized.inlineContentIds,
        hasQuotedContent: false
      };
    }

    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();

    const style = doc.createElement('style');
    style.textContent = frameStyles(options);
    doc.head.appendChild(style);

    doc.body.innerHTML = sanitized.html;

    // A link opening inside a sandboxed frame would go nowhere; send it to a
    // new tab instead, which the sandbox explicitly permits.
    if (options.openLinksInNewTab) {
      const base = doc.createElement('base');
      base.setAttribute('target', '_blank');
      doc.head.appendChild(base);
    }

    resolveInlineImages(doc.body, input.attachments);

    const quote = options.collapseQuotedText
      ? markQuotedContent(doc.body)
      : { found: false, quotedElements: [] };
    this.#quoteVisible = !options.collapseQuotedText;

    this.#heightCap =
      options.maxRenderHeightPx === 'auto' ? undefined : options.maxRenderHeightPx;
    this.#watchHeight();

    return {
      blockedImageCount: countBlockedImages(doc.body),
      inlineContentIds: sanitized.inlineContentIds,
      hasQuotedContent: quote.found
    };
  }

  /** Reveals withheld remote images. Returns how many appeared. */
  revealImages(): number {
    const doc = this.#document;
    if (!doc) return 0;
    const revealed = revealRemoteImages(doc.body);
    this.#measure();
    return revealed;
  }

  /** Re-resolves inline images once more attachment bytes have arrived. */
  applyAttachments(attachments: readonly MiniEmailAttachment[]): number {
    const doc = this.#document;
    if (!doc) return 0;
    const resolved = resolveInlineImages(doc.body, attachments);
    this.#measure();
    return resolved;
  }

  /** Folds or unfolds the quoted region. */
  toggleQuote(visible?: boolean): boolean {
    const doc = this.#document;
    if (!doc) return this.#quoteVisible;

    const next = visible ?? !this.#quoteVisible;
    if (next) unmarkQuotedContent(doc.body);
    else markQuotedContent(doc.body);

    this.#quoteVisible = next;
    this.#measure();
    return next;
  }

  get quoteVisible(): boolean {
    return this.#quoteVisible;
  }

  /**
   * Keeps the frame's height matched to its content.
   *
   * Images decode after layout and quotes fold on demand, so a single
   * measurement is always wrong. `ResizeObserver` is used when the host
   * provides one; otherwise the load event is the fallback.
   */
  #watchHeight(): void {
    const doc = this.#document;
    if (!doc) return;

    this.#resizeObserver?.disconnect();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.#measure());
      observer.observe(doc.documentElement);
      this.#resizeObserver = observer;
    }

    // Images that decode late change the height after the observer is wired.
    for (const img of doc.images) {
      img.addEventListener('load', () => this.#measure(), { once: true });
      img.addEventListener('error', () => this.#measure(), { once: true });
    }

    this.#measure();
  }

  #measure(): void {
    const doc = this.#document;
    if (!doc?.body) return;

    const content = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight
    );

    // A cap turns the frame into its own scroll region rather than letting one
    // enormous mail push the task detail off screen.
    const cap = this.#heightCap;
    const height = cap === undefined ? content : Math.min(content, cap);

    this.#iframe.style.height = `${height}px`;
    this.#iframe.style.overflowY = cap !== undefined && content > cap ? 'auto' : 'hidden';
    this.#onHeightChange?.(height);
  }

  /** Applies the configured height cap. `'auto'` means no cap. */
  setHeightCap(cap: number | 'auto'): void {
    this.#heightCap = cap === 'auto' ? undefined : cap;
    this.#measure();
  }

  destroy(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#iframe.remove();
  }
}
