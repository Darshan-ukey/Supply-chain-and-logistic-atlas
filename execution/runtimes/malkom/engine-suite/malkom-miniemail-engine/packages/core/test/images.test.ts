import { describe, expect, it } from 'vitest';
import {
  RemoteImageTrust,
  countBlockedImages,
  normalizeContentId,
  pendingContentIds,
  resolveInlineImages,
  revealRemoteImages,
  toDataUrl
} from '../src/render/images.js';
import { sanitizeEmailHtml, type SanitizeOptions } from '../src/render/sanitize.js';
import type { MiniEmailAttachment } from '../src/types.js';

const OPTIONS: SanitizeOptions = {
  profile: 'strict',
  allowedSchemes: ['http', 'https', 'mailto', 'cid'],
  blockRemoteImages: true,
  openLinksInNewTab: true
};

/** Builds a live DOM from a body, the way the sealed frame does. */
function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = sanitizeEmailHtml(html, OPTIONS).html;
  return host;
}

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

function attachment(over: Partial<MiniEmailAttachment> = {}): MiniEmailAttachment {
  return {
    id: 'att-1',
    filename: 'logo.png',
    mimeType: 'image/png',
    sizeBytes: 3,
    isInline: true,
    contentId: 'logo123',
    content: bytes(1, 2, 3),
    ...over
  };
}

describe('toDataUrl', () => {
  it('encodes bytes as a base64 data url', () => {
    expect(toDataUrl('image/png', bytes(1, 2, 3))).toBe('data:image/png;base64,AQID');
  });

  it('handles a payload larger than one chunk', () => {
    const big = new Uint8Array(70_000).fill(65);
    const url = toDataUrl('image/jpeg', big.buffer);
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(90_000);
  });
});

describe('normalizeContentId', () => {
  it('strips the cid: prefix and angle brackets', () => {
    expect(normalizeContentId('cid:<abc>')).toBe('abc');
    expect(normalizeContentId('<abc>')).toBe('abc');
    expect(normalizeContentId('abc')).toBe('abc');
  });
});

describe('resolveInlineImages', () => {
  it('points a cid image at its attachment bytes', () => {
    const host = mount('<img src="cid:logo123">');
    expect(resolveInlineImages(host, [attachment()])).toBe(1);

    const img = host.querySelector('img');
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AQID');
  });

  it('matches on filename when the sender referenced one', () => {
    const host = mount('<img src="cid:logo.png">');
    expect(resolveInlineImages(host, [attachment({ contentId: 'other' })])).toBe(1);
  });

  it('tolerates the angle-bracket form on the attachment side', () => {
    const host = mount('<img src="cid:logo123">');
    expect(resolveInlineImages(host, [attachment({ contentId: '<logo123>' })])).toBe(1);
  });

  it('leaves the placeholder when no attachment matches', () => {
    const host = mount('<img src="cid:missing">');
    expect(resolveInlineImages(host, [attachment()])).toBe(0);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('about:blank');
  });

  it('ignores attachments whose bytes have not arrived yet', () => {
    const host = mount('<img src="cid:logo123">');
    const { content: _none, ...noBytes } = attachment();
    expect(resolveInlineImages(host, [noBytes])).toBe(0);
  });

  it('resolves every occurrence of a reused content id', () => {
    const host = mount('<img src="cid:logo123"><img src="cid:logo123">');
    expect(resolveInlineImages(host, [attachment()])).toBe(2);
  });

  it('reports what is still waiting on bytes', () => {
    const host = mount('<img src="cid:a"><img src="cid:b">');
    resolveInlineImages(host, [attachment({ contentId: 'a', filename: 'a.png' })]);
    expect(pendingContentIds(host)).toEqual(['b']);
  });
});

describe('revealRemoteImages', () => {
  it('restores the original url when the reader allows images', () => {
    const host = mount('<img src="https://a/x.png">');
    expect(countBlockedImages(host)).toBe(1);

    expect(revealRemoteImages(host)).toBe(1);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('https://a/x.png');
    expect(countBlockedImages(host)).toBe(0);
  });

  it('is safe to call twice', () => {
    const host = mount('<img src="https://a/x.png">');
    revealRemoteImages(host);
    expect(revealRemoteImages(host)).toBe(0);
  });

  it('does not disturb inline images', () => {
    const host = mount('<img src="cid:logo123">');
    expect(revealRemoteImages(host)).toBe(0);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('about:blank');
  });
});

describe('RemoteImageTrust', () => {
  it('remembers a sender, case-insensitively', () => {
    const trust = new RemoteImageTrust();
    trust.trust('Asha@Example.com');
    expect(trust.trusts('asha@example.com')).toBe(true);
  });

  it('does not trust anyone by default', () => {
    expect(new RemoteImageTrust().trusts('a@b.com')).toBe(false);
  });

  it('forgets everything on clear', () => {
    const trust = new RemoteImageTrust();
    trust.trust('a@b.com');
    trust.clear();
    expect(trust.trusts('a@b.com')).toBe(false);
  });
});
