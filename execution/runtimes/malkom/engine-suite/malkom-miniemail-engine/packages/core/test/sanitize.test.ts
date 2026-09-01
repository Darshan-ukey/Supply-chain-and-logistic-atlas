import { describe, expect, it } from 'vitest';
import {
  BLOCKED_IMAGE_ATTR,
  INLINE_IMAGE_ATTR,
  sanitizeEmailHtml,
  sanitizeStyle,
  type SanitizeOptions
} from '../src/render/sanitize.js';

const OPTIONS: SanitizeOptions = {
  profile: 'strict',
  allowedSchemes: ['http', 'https', 'mailto', 'cid'],
  blockRemoteImages: true,
  openLinksInNewTab: true
};

function clean(html: string, overrides: Partial<SanitizeOptions> = {}): string {
  return sanitizeEmailHtml(html, { ...OPTIONS, ...overrides }).html;
}

describe('sanitizeEmailHtml — execution vectors', () => {
  it('drops script tags with their contents', () => {
    const out = clean('<p>hi</p><script>steal()</script>');
    expect(out).not.toContain('steal');
    expect(out).toContain('hi');
  });

  it('drops style tags so email CSS cannot target the host', () => {
    expect(clean('<style>body{display:none}</style><p>x</p>')).not.toContain('display');
  });

  it('strips every on* handler', () => {
    const out = clean('<div onclick="x()" onmouseover="y()" ONERROR="z()">t</div>');
    expect(out).not.toMatch(/onclick|onmouseover|onerror/i);
    expect(out).toContain('t');
  });

  it('removes javascript: hrefs', () => {
    expect(clean('<a href="javascript:alert(1)">go</a>')).not.toContain('javascript');
  });

  it('sees through control characters in a scheme', () => {
    const out = clean(`<a href="java\u0000script:alert(1)">go</a>`);
    expect(out).not.toContain('href');
  });

  it('sees through whitespace and newlines in a scheme', () => {
    const out = clean('<a href="java\nscript:alert(1)">go</a>');
    expect(out).not.toContain('href');
  });

  it('removes data: URLs, which are not in the allowlist', () => {
    const out = clean('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).not.toContain('data:');
  });

  it('drops iframes, objects and embeds entirely', () => {
    const out = clean('<iframe src="https://evil"></iframe><object></object><embed>');
    expect(out).not.toMatch(/iframe|object|embed/);
  });

  it('drops forms and inputs so nothing can harvest keystrokes', () => {
    const out = clean('<form><input name="password"><button>Go</button></form>');
    expect(out).not.toMatch(/form|input|button/);
  });

  it('drops svg, which can carry script', () => {
    expect(clean('<svg><script>x()</script></svg>')).not.toContain('svg');
  });

  it('keeps unknown tags’ text but removes the tag', () => {
    const out = clean('<custom-thing>keep me</custom-thing>');
    expect(out).toContain('keep me');
    expect(out).not.toContain('custom-thing');
  });
});

describe('sanitizeEmailHtml — faithful rendering', () => {
  it('keeps table layout markup, which email depends on', () => {
    const html = '<table><tbody><tr><td colspan="2" bgcolor="#eee">cell</td></tr></tbody></table>';
    const out = clean(html);
    expect(out).toContain('<table>');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('bgcolor="#eee"');
  });

  it('keeps font tags and presentational attributes', () => {
    const out = clean('<font face="Arial" color="#333" size="2">text</font>');
    expect(out).toContain('face="Arial"');
    expect(out).toContain('color="#333"');
  });

  it('keeps safe inline styles', () => {
    const out = clean('<p style="color: red; margin: 8px; font-weight: bold">x</p>');
    expect(out).toContain('color: red');
    expect(out).toContain('margin: 8px');
  });

  it('keeps mailto links', () => {
    expect(clean('<a href="mailto:a@b.com">mail</a>')).toContain('mailto:a@b.com');
  });

  it('keeps relative and anchor links', () => {
    expect(clean('<a href="#section">jump</a>')).toContain('#section');
  });
});

describe('sanitizeEmailHtml — link handling', () => {
  it('opens links in a new tab with noopener when configured', () => {
    const out = clean('<a href="https://example.com">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('leaves target alone when the host wants same-tab links', () => {
    const out = clean('<a href="https://example.com">x</a>', { openLinksInNewTab: false });
    expect(out).not.toContain('target=');
  });

  it('does not leave a target on a link whose href was stripped', () => {
    const out = clean('<a href="javascript:x()" target="_blank">x</a>');
    expect(out).not.toContain('target=');
  });
});

describe('sanitizeEmailHtml — images', () => {
  it('withholds remote images and remembers the original url', () => {
    const result = sanitizeEmailHtml('<img src="https://tracker/pixel.gif">', OPTIONS);
    expect(result.blockedImageCount).toBe(1);
    expect(result.html).toContain(BLOCKED_IMAGE_ATTR);
    expect(result.html).toContain('https://tracker/pixel.gif');
    // The live src must be the placeholder — the original survives only in the
    // data attribute, where nothing fetches it.
    expect(result.html).toContain('src="about:blank"');
    expect(result.html).not.toMatch(/(^|\s)src="https:/);
  });

  it('drops srcset alongside a blocked src, so nothing loads by the back door', () => {
    const result = sanitizeEmailHtml(
      '<img src="https://a/x.png" srcset="https://a/x2.png 2x">',
      OPTIONS
    );
    expect(result.html).not.toContain('srcset');
  });

  it('lets remote images through when the host unblocks them', () => {
    const result = sanitizeEmailHtml('<img src="https://a/x.png">', {
      ...OPTIONS,
      blockRemoteImages: false
    });
    expect(result.blockedImageCount).toBe(0);
    expect(result.html).toContain('src="https://a/x.png"');
  });

  it('marks cid: images for attachment resolution', () => {
    const result = sanitizeEmailHtml('<img src="cid:logo123">', OPTIONS);
    expect(result.inlineContentIds).toEqual(['logo123']);
    expect(result.html).toContain(`${INLINE_IMAGE_ATTR}="logo123"`);
  });

  it('strips angle brackets some providers wrap around a content id', () => {
    const result = sanitizeEmailHtml('<img src="cid:<logo123>">', OPTIONS);
    expect(result.inlineContentIds).toEqual(['logo123']);
  });

  it('reports each content id once even when reused', () => {
    const result = sanitizeEmailHtml('<img src="cid:a"><img src="cid:a">', OPTIONS);
    expect(result.inlineContentIds).toEqual(['a']);
  });

  it('counts cid images as inline, not blocked', () => {
    const result = sanitizeEmailHtml('<img src="cid:a">', OPTIONS);
    expect(result.blockedImageCount).toBe(0);
  });
});

describe('sanitizeStyle', () => {
  it('drops properties that escape the element box', () => {
    const out = sanitizeStyle('color: red; position: fixed; z-index: 9999');
    expect(out).toContain('color: red');
    expect(out).not.toContain('position');
    expect(out).not.toContain('z-index');
  });

  it('drops values carrying code or fetches', () => {
    expect(sanitizeStyle('width: expression(alert(1))')).toBe('');
    expect(sanitizeStyle('background: url(javascript:alert(1))')).toBe('');
    expect(sanitizeStyle('behavior: url(#default#time2)')).toBe('');
  });

  it('keeps a normal remote background url — the frame governs loading', () => {
    expect(sanitizeStyle('background: url(https://a/b.png)')).toContain('url(https://a/b.png)');
  });

  it('strips !important so email CSS cannot outrank the host', () => {
    expect(sanitizeStyle('color: red !important')).toBe('color: red');
  });

  it('ignores malformed declarations', () => {
    expect(sanitizeStyle('color; ; :red; margin: 4px')).toBe('margin: 4px');
  });
});
