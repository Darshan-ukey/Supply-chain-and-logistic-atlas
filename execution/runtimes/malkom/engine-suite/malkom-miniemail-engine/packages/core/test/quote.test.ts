import { describe, expect, it } from 'vitest';
import {
  QUOTE_MARKER_ATTR,
  markQuotedContent,
  removeQuotedContent,
  unmarkQuotedContent
} from '../src/render/quote.js';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

function marked(host: HTMLElement): string[] {
  return [...host.querySelectorAll(`[${QUOTE_MARKER_ATTR}]`)].map(
    (el) => el.textContent?.trim() ?? ''
  );
}

describe('markQuotedContent — container markers', () => {
  it('finds the Gmail quote container', () => {
    const host = mount('<div>My reply</div><div class="gmail_quote">Older mail</div>');
    expect(markQuotedContent(host).found).toBe(true);
    expect(marked(host)).toEqual(['Older mail']);
  });

  it('finds the Outlook reply divider', () => {
    const host = mount('<p>Reply</p><div id="divRplyFwdMsg">Original</div>');
    expect(markQuotedContent(host).found).toBe(true);
    expect(marked(host)).toContain('Original');
  });

  it('finds a cite blockquote', () => {
    const host = mount('<p>Reply</p><blockquote type="cite">Older</blockquote>');
    expect(markQuotedContent(host).found).toBe(true);
  });

  it('folds everything after the boundary, not just the boundary itself', () => {
    const host = mount(
      '<p>Reply</p><div class="gmail_quote">Older</div><div>Trailing quote tail</div>'
    );
    markQuotedContent(host);
    expect(marked(host)).toEqual(['Older', 'Trailing quote tail']);
  });

  it('leaves the new content untouched', () => {
    const host = mount('<p>My reply</p><div class="gmail_quote">Older</div>');
    markQuotedContent(host);
    expect(host.querySelector('p')?.hasAttribute(QUOTE_MARKER_ATTR)).toBe(false);
  });
});

describe('markQuotedContent — separator lines', () => {
  it('recognises the "On … wrote:" line', () => {
    const host = mount(
      '<div>Reply</div><div>On 12 Aug 2026, Asha wrote:</div><div>Older</div>'
    );
    expect(markQuotedContent(host).found).toBe(true);
    expect(marked(host)).toEqual(['On 12 Aug 2026, Asha wrote:', 'Older']);
  });

  it('recognises the Original Message divider', () => {
    const host = mount('<div>Reply</div><div>----- Original Message -----</div>');
    expect(markQuotedContent(host).found).toBe(true);
  });

  it('recognises a forwarded-message divider', () => {
    const host = mount('<div>Note</div><div>---------- Forwarded message ----------</div>');
    expect(markQuotedContent(host).found).toBe(true);
  });

  it('recognises an Outlook header block starting at From:', () => {
    const host = mount('<div>Reply</div><div>From: asha@example.com</div><div>Body</div>');
    expect(markQuotedContent(host).found).toBe(true);
  });

  it('does not treat a long paragraph that merely starts with From: as a quote', () => {
    const long = `From: the beginning of the project we have argued about ${'x'.repeat(250)}`;
    const host = mount(`<div>Reply</div><div>${long}</div>`);
    expect(markQuotedContent(host).found).toBe(false);
  });
});

describe('markQuotedContent — plain-text prefixes', () => {
  it('folds a run of > prefixed lines', () => {
    const host = mount('<div>Reply</div><div>&gt; older one</div><div>&gt; older two</div>');
    expect(markQuotedContent(host).found).toBe(true);
    expect(marked(host).length).toBe(2);
  });

  it('ignores a single stray > line', () => {
    const host = mount('<div>Reply</div><div>&gt; hmm</div><div>more of my reply</div>');
    expect(markQuotedContent(host).found).toBe(false);
  });
});

describe('markQuotedContent — no quote', () => {
  it('reports nothing found on a first message', () => {
    const host = mount('<p>Hello, please see the attached invoice.</p>');
    const result = markQuotedContent(host);
    expect(result.found).toBe(false);
    expect(result.quotedElements).toEqual([]);
  });

  it('marks nothing when nothing was found', () => {
    const host = mount('<p>Hello</p>');
    markQuotedContent(host);
    expect(marked(host)).toEqual([]);
  });
});

describe('unmarkQuotedContent', () => {
  it('restores the full body', () => {
    const host = mount('<p>Reply</p><div class="gmail_quote">Older</div>');
    markQuotedContent(host);
    unmarkQuotedContent(host);
    expect(marked(host)).toEqual([]);
  });
});

describe('removeQuotedContent', () => {
  it('drops the quote so a reply does not nest it twice', () => {
    const host = mount('<p>My reply</p><div class="gmail_quote">Older</div>');
    expect(removeQuotedContent(host)).toBe(true);
    expect(host.textContent?.trim()).toBe('My reply');
  });

  it('leaves a body with no quote alone', () => {
    const host = mount('<p>Just this</p>');
    expect(removeQuotedContent(host)).toBe(false);
    expect(host.textContent?.trim()).toBe('Just this');
  });
});
