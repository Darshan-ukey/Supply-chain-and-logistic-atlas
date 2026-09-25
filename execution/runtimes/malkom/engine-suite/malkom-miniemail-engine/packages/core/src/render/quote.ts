/**
 * Quoted-text detection.
 *
 * Every reply carries the message it replied to, so a thread read top to
 * bottom repeats itself many times over. Providers hide the repeated part
 * behind a small "…" control; this finds the same boundary.
 *
 * There is no standard for marking a quote. Each client leaves its own trace,
 * so detection is a set of recognisers applied in order of confidence:
 * explicit container markers first, then the visible "On <date>, X wrote:"
 * separator, then plain-text `>` prefixes. Nothing here alters content — the
 * quote is marked, never removed, so the reader can always open it.
 */

/** Marks the element that begins the quoted region. */
export const QUOTE_MARKER_ATTR = 'data-malkom-quote';

/**
 * Containers clients use for the quoted region, most reliable first.
 *
 * `gmail_quote` covers Gmail; `OLK_SRC_BODY_SECTION` and the divider ids cover
 * Outlook desktop and web; `yahoo_quoted` covers Yahoo; the Apple Mail and
 * Zimbra classes cover the rest of the common set.
 */
const QUOTE_SELECTORS: readonly string[] = [
  '.gmail_quote',
  'div.OLK_SRC_BODY_SECTION',
  '#divRplyFwdMsg',
  '#appendonsend',
  '.yahoo_quoted',
  '.moz-cite-prefix',
  'blockquote[type="cite"]',
  '.AppleMailSignature ~ blockquote',
  '.zmail_extra',
  '[data-marker="__QUOTED_TEXT__"]'
];

/**
 * The visible separator line clients write above a quote.
 *
 * Kept deliberately loose on the middle: the date format varies by locale and
 * client, but the "On … wrote:" frame is near-universal in English locales.
 * Non-English separators fall through to the container and `>` recognisers.
 */
const SEPARATOR_PATTERNS: readonly RegExp[] = [
  /^\s*On\s.{0,200}\swrote:\s*$/i,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^\s*From:\s.+\s*$/i,
  /^\s*_{5,}\s*$/
];

export interface QuoteSplitResult {
  /** True when a quoted region was found and marked. */
  readonly found: boolean;
  /** Elements from the boundary onward, in document order. */
  readonly quotedElements: readonly Element[];
}

function isSeparatorLine(text: string): boolean {
  const line = text.trim();
  // A separator is a short line; a paragraph starting with "From:" that runs
  // on is body text, not a header block.
  if (!line || line.length > 220) return false;
  return SEPARATOR_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Finds the first element that begins quoted content.
 *
 * Only top-level children are considered for the separator and `>` heuristics:
 * a "wrote:" line nested deep inside a table cell is far more likely to be
 * ordinary prose than a real quote boundary.
 */
function findQuoteBoundary(root: ParentNode): Element | undefined {
  for (const selector of QUOTE_SELECTORS) {
    const hit = root.querySelector(selector);
    if (hit) return hit;
  }

  const children = [...root.children];
  for (const child of children) {
    if (isSeparatorLine(child.textContent ?? '')) return child;
  }

  // Plain-text mail converted to HTML keeps its `>` prefixes. Treat a run of
  // them as the quote, but only once at least two lines agree — a single `>`
  // is as likely to be a stray character.
  let consecutive = 0;
  for (const child of children) {
    const text = (child.textContent ?? '').trim();
    if (text.startsWith('>')) {
      consecutive += 1;
      if (consecutive >= 2) {
        const startIndex = children.indexOf(child) - (consecutive - 1);
        return children[startIndex];
      }
    } else if (text) {
      consecutive = 0;
    }
  }

  return undefined;
}

/**
 * Marks the quoted region of a rendered body.
 *
 * Everything from the boundary onward is flagged with `QUOTE_MARKER_ATTR`, so
 * the frame stylesheet can fold it without the markup being touched again.
 */
export function markQuotedContent(root: ParentNode): QuoteSplitResult {
  const boundary = findQuoteBoundary(root);
  if (!boundary) return { found: false, quotedElements: [] };

  const quoted: Element[] = [];

  // The boundary may sit deep in the tree (a `.gmail_quote` inside a wrapper).
  // Fold from the boundary itself plus every later sibling at that level, then
  // walk up doing the same, so nothing after the boundary is left showing.
  let node: Element | null = boundary;
  while (node && node.parentNode && node !== root) {
    quoted.push(node);
    let sibling = node.nextElementSibling;
    while (sibling) {
      quoted.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    node = node.parentElement;
    if (node === (root as unknown as Element)) break;
  }

  for (const el of quoted) el.setAttribute(QUOTE_MARKER_ATTR, 'true');
  return { found: true, quotedElements: quoted };
}

/** Removes quote marking, so the reader sees the full body again. */
export function unmarkQuotedContent(root: ParentNode): void {
  for (const el of root.querySelectorAll(`[${QUOTE_MARKER_ATTR}]`)) {
    el.removeAttribute(QUOTE_MARKER_ATTR);
  }
}

/**
 * Strips the quoted region from a body.
 *
 * Used when composing a reply: the new quote is built from the message being
 * answered, so carrying its own older quote forward would nest the same text
 * twice.
 */
export function removeQuotedContent(root: ParentNode): boolean {
  const { found, quotedElements } = markQuotedContent(root);
  if (!found) return false;
  for (const el of quotedElements) el.remove();
  return true;
}
