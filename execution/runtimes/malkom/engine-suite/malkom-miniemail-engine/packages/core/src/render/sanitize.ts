import type { MiniEmailSanitizerProfile } from '../types.js';

/**
 * HTML sanitizer for email bodies.
 *
 * Allowlist, never blocklist: anything not explicitly permitted is removed.
 * Email HTML is arbitrary third-party markup, so the only safe default is to
 * drop what we do not recognise.
 *
 * Faithful, but never trusted — presentational markup and inline styles are
 * kept so the mail still looks like itself; anything executable, navigational
 * or network-fetching is stripped or neutralised.
 */

/** Structural and text markup common to real-world email. */
const BASE_TAGS: readonly string[] = [
  'a', 'abbr', 'address', 'area', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br',
  'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
  'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'label', 'legend',
  'li', 'map', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small',
  'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
  'tfoot', 'th', 'thead', 'time', 'tr', 'tt', 'u', 'ul', 'var', 'wbr'
];

/**
 * Removed with their entire subtree.
 *
 * Everything here either executes, fetches, navigates, or can be layered over
 * the host UI to spoof it. Unwrapping them would leave the payload behind, so
 * the whole node goes.
 */
const DROP_WITH_CONTENT: ReadonlySet<string> = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'audio', 'video', 'source', 'track', 'canvas', 'form', 'input', 'button',
  'select', 'option', 'optgroup', 'textarea', 'template', 'slot', 'link',
  'meta', 'base', 'title', 'noscript', 'svg', 'math', 'portal', 'dialog'
]);

/**
 * Presentational attributes kept on any allowed tag.
 *
 * `class` and `id` are included deliberately. They are inert here — the body
 * renders in a sealed frame with no host stylesheet and no script — and they
 * carry the only reliable evidence of a quoted region (`gmail_quote`,
 * `divRplyFwdMsg`, `yahoo_quoted`). Stripping them would leave quote detection
 * guessing from prose alone.
 */
const BASE_ATTRS: readonly string[] = [
  'align', 'alt', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'class',
  'color', 'colspan', 'dir', 'face', 'height', 'hspace', 'id', 'lang', 'nowrap',
  'rowspan', 'size', 'span', 'start', 'title', 'type', 'valign', 'value',
  'vspace', 'width'
];

/** Attributes permitted only on the tags listed. */
const SCOPED_ATTRS: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'srcset', 'usemap'],
  area: ['href', 'shape', 'coords', 'target', 'rel'],
  map: ['name'],
  time: ['datetime'],
  blockquote: ['cite'],
  q: ['cite'],
  del: ['cite', 'datetime'],
  ins: ['cite', 'datetime']
};

/**
 * CSS properties that can position content outside its own flow, hide it, or
 * pull in a network resource. Kept out of inline styles in every profile.
 */
const FORBIDDEN_CSS_PROPS: ReadonlySet<string> = new Set([
  'position', 'z-index', 'behavior', '-moz-binding', 'binding', 'filter',
  'expression', 'content', 'transform', 'transform-style', 'perspective',
  'clip', 'clip-path', 'mix-blend-mode', 'isolation', 'pointer-events',
  'user-select', 'will-change', 'animation', 'animation-name', 'transition',
  'transition-property'
]);

/** Values that carry code or fetches regardless of which property holds them. */
const DANGEROUS_CSS_VALUE = /(expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:|-moz-binding|url\s*\(\s*['"]?\s*(javascript|vbscript|data)\s*:)/i;

/** Placeholder left in `src` when a remote image is withheld. */
export const BLOCKED_IMAGE_SRC = 'about:blank';

/** Attribute holding the original URL of a withheld remote image. */
export const BLOCKED_IMAGE_ATTR = 'data-malkom-blocked-src';

/** Attribute holding the `cid:` reference an inline image still needs. */
export const INLINE_IMAGE_ATTR = 'data-malkom-cid';

export interface SanitizeOptions {
  readonly profile: MiniEmailSanitizerProfile;
  readonly allowedSchemes: readonly string[];
  /** When true, remote images are withheld and marked for later reveal. */
  readonly blockRemoteImages: boolean;
  readonly openLinksInNewTab: boolean;
  /** Parser override. Defaults to a fresh ambient `DOMParser`. */
  readonly parser?: DOMParser;
}

export interface SanitizeResult {
  readonly html: string;
  /** How many remote images were withheld. Drives the "show images" bar. */
  readonly blockedImageCount: number;
  /** `cid:` values still needing attachment bytes. */
  readonly inlineContentIds: readonly string[];
  /** Nodes removed entirely. Diagnostics only. */
  readonly droppedNodeCount: number;
}

function allowedTags(profile: MiniEmailSanitizerProfile): ReadonlySet<string> {
  const tags = [...BASE_TAGS];
  if (profile === 'balanced') {
    // `style` on elements is handled separately; balanced only widens the
    // structural set to layout wrappers some senders rely on.
    tags.push('article', 'aside', 'header', 'footer', 'main', 'nav');
  }
  return new Set(tags);
}

function isAllowedAttr(tag: string, attr: string): boolean {
  if (attr === 'style') return true; // value-filtered separately
  if (attr.startsWith('data-malkom-')) return true;
  if (BASE_ATTRS.includes(attr)) return true;
  return (SCOPED_ATTRS[tag] ?? []).includes(attr);
}

/**
 * Reads the scheme of a URL without constructing one.
 *
 * `new URL()` needs a base and throws on the relative and malformed values
 * email is full of, so the scheme is matched directly. Control characters are
 * stripped first: `java\0script:` and `java\nscript:` are treated as schemes
 * by browsers but would slip past a naive prefix test.
 */
function schemeOf(rawUrl: string): string | undefined {
  // U+FFFD is included because an HTML parser substitutes it for a NUL byte,
  // so by the time we read the attribute the original NUL is already gone.
  const url = rawUrl.replace(/[\u0000-\u0020\u007f-\u00a0\ufffd]/g, '').toLowerCase();
  const match = /^([a-z][a-z0-9+.-]*):/.exec(url);
  return match?.[1];
}

function isSafeUrl(rawUrl: string, allowedSchemes: readonly string[]): boolean {
  const scheme = schemeOf(rawUrl);
  // No scheme means relative or anchor-only — nothing to escalate to.
  if (!scheme) return true;
  return allowedSchemes.includes(scheme);
}

/** True for a URL that would hit the network when rendered. */
function isRemoteUrl(rawUrl: string): boolean {
  const scheme = schemeOf(rawUrl);
  return scheme === 'http' || scheme === 'https';
}

/**
 * Filters an inline `style` value property by property.
 *
 * Inline style is worth keeping — colours, spacing and fonts are most of what
 * makes an email look like itself — but only the declarations that cannot
 * execute, fetch, or escape the element's own box.
 */
export function sanitizeStyle(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;

    const prop = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (!prop || !value) continue;
    if (FORBIDDEN_CSS_PROPS.has(prop)) continue;
    if (DANGEROUS_CSS_VALUE.test(value)) continue;
    // `!important` in email CSS routinely fights the host stylesheet; drop the
    // flag but keep the declaration.
    kept.push(`${prop}: ${value.replace(/\s*!important\s*$/i, '')}`);
  }
  return kept.join('; ');
}

function resolveParser(explicit: DOMParser | undefined): DOMParser {
  if (explicit) return explicit;
  if (typeof DOMParser !== 'undefined') return new DOMParser();
  throw new Error(
    'MiniEmail sanitizer needs a DOMParser. Pass options.parser in non-DOM environments.'
  );
}

/**
 * Cleans an email body into markup safe to insert into the sealed frame.
 *
 * The input is parsed inertly (`DOMParser`), so nothing loads or executes
 * while we inspect it, and the tree is walked bottom-up so removing a node
 * never invalidates the walk.
 */
export function sanitizeEmailHtml(
  html: string,
  options: SanitizeOptions
): SanitizeResult {
  const parsed = resolveParser(options.parser).parseFromString(html, 'text/html');
  const tags = allowedTags(options.profile);

  let blockedImageCount = 0;
  let droppedNodeCount = 0;
  const inlineContentIds: string[] = [];

  const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [];
  while (walker.nextNode()) elements.push(walker.currentNode as Element);

  // Bottom-up: a child is processed before the parent that may unwrap it, so
  // unwrapped subtrees are already clean.
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    if (!el) continue;
    const tag = el.tagName.toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      droppedNodeCount += 1;
      continue;
    }

    if (!tags.has(tag)) {
      // Unknown but harmless wrapper: keep the text, drop the element.
      unwrap(el);
      droppedNodeCount += 1;
      continue;
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();

      // Every `on*` handler, plus anything that survived as an event alias.
      if (name.startsWith('on') || !isAllowedAttr(tag, name)) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const cleaned = sanitizeStyle(attr.value);
        if (cleaned) el.setAttribute('style', cleaned);
        else el.removeAttribute('style');
        continue;
      }

      if (name === 'href' || name === 'src' || name === 'srcset') {
        if (!isSafeUrl(attr.value, options.allowedSchemes)) {
          el.removeAttribute(attr.name);
        }
      }
    }

    if (tag === 'a') {
      // A link that lost its href to the scheme check must not stay clickable.
      if (!el.getAttribute('href')) el.removeAttribute('target');
      else if (options.openLinksInNewTab) {
        el.setAttribute('target', '_blank');
        // Without this the opened tab can navigate the host window.
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }

    if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      const scheme = schemeOf(src);

      if (scheme === 'cid') {
        const cid = src.slice('cid:'.length).replace(/^<|>$/g, '');
        if (cid) {
          el.setAttribute(INLINE_IMAGE_ATTR, cid);
          el.setAttribute('src', BLOCKED_IMAGE_SRC);
          inlineContentIds.push(cid);
        }
      } else if (options.blockRemoteImages && isRemoteUrl(src)) {
        el.setAttribute(BLOCKED_IMAGE_ATTR, src);
        el.setAttribute('src', BLOCKED_IMAGE_SRC);
        el.removeAttribute('srcset');
        blockedImageCount += 1;
      }
    }
  }

  return {
    html: parsed.body.innerHTML,
    blockedImageCount,
    inlineContentIds: [...new Set(inlineContentIds)],
    droppedNodeCount
  };
}

/** Replaces an element with its children, keeping document order. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) {
    el.remove();
    return;
  }
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}
