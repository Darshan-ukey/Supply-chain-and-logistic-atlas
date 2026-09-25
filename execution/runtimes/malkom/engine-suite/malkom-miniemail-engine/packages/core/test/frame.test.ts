import { beforeEach, describe, expect, it } from 'vitest';
import { SealedFrame } from '../src/render/frame.js';
import { QUOTE_MARKER_ATTR } from '../src/render/quote.js';
import { DEFAULT_MINIEMAIL_OPTIONS } from '../src/defaults/options.js';
import type { MiniEmailAttachment, ResolvedMiniEmailOptions } from '../src/types.js';

function options(over: Partial<ResolvedMiniEmailOptions> = {}): ResolvedMiniEmailOptions {
  return { ...DEFAULT_MINIEMAIL_OPTIONS, ...over };
}

let container: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
});

function frameDoc(frame: SealedFrame): Document {
  const doc = frame.element.contentDocument;
  if (!doc) throw new Error('frame has no document');
  return doc;
}

describe('SealedFrame — isolation', () => {
  it('sandboxes the frame without allowing scripts', () => {
    const frame = new SealedFrame(container);
    const sandbox = frame.element.getAttribute('sandbox') ?? '';
    expect(sandbox).not.toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
  });

  it('sends no referrer, so image hosts learn nothing about the reader', () => {
    const frame = new SealedFrame(container);
    expect(frame.element.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('renders the body inside the frame, not the host document', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<p>Hello</p>', attachments: [], options: options() });

    expect(frameDoc(frame).body.textContent).toContain('Hello');
    expect(container.textContent).not.toContain('Hello');
  });

  it('gives the frame its own baseline styles', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<p>x</p>', attachments: [], options: options() });

    const style = frameDoc(frame).querySelector('style')?.textContent ?? '';
    expect(style).toContain('overflow-x: auto');
    expect(style).toContain('max-width: 100%');
  });
});

describe('SealedFrame — sanitizing on the way in', () => {
  it('strips script content before it reaches the frame', () => {
    const frame = new SealedFrame(container);
    frame.render({
      html: '<p>ok</p><script>steal()</script>',
      attachments: [],
      options: options()
    });

    expect(frameDoc(frame).body.innerHTML).not.toContain('steal');
  });

  it('withholds remote images and reports the count', () => {
    const frame = new SealedFrame(container);
    const result = frame.render({
      html: '<img src="https://tracker/p.gif">',
      attachments: [],
      options: options()
    });

    expect(result.blockedImageCount).toBe(1);
    expect(frameDoc(frame).images[0]?.getAttribute('src')).toBe('about:blank');
  });

  it('honours a per-message override once the sender is trusted', () => {
    const frame = new SealedFrame(container);
    const result = frame.render({
      html: '<img src="https://a/x.png">',
      attachments: [],
      options: options(),
      blockRemoteImages: false
    });

    expect(result.blockedImageCount).toBe(0);
    expect(frameDoc(frame).images[0]?.getAttribute('src')).toBe('https://a/x.png');
  });
});

describe('SealedFrame — images', () => {
  const inline: MiniEmailAttachment = {
    id: 'a1',
    filename: 'logo.png',
    mimeType: 'image/png',
    sizeBytes: 3,
    isInline: true,
    contentId: 'logo1',
    content: new Uint8Array([1, 2, 3]).buffer
  };

  it('resolves inline images from attachment bytes at render time', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<img src="cid:logo1">', attachments: [inline], options: options() });

    expect(frameDoc(frame).images[0]?.getAttribute('src')).toBe(
      'data:image/png;base64,AQID'
    );
  });

  it('resolves inline images that arrive after the first render', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<img src="cid:logo1">', attachments: [], options: options() });
    expect(frameDoc(frame).images[0]?.getAttribute('src')).toBe('about:blank');

    expect(frame.applyAttachments([inline])).toBe(1);
    expect(frameDoc(frame).images[0]?.getAttribute('src')).toContain('data:image/png');
  });

  it('reveals withheld remote images on request', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<img src="https://a/x.png">', attachments: [], options: options() });

    expect(frame.revealImages()).toBe(1);
    expect(frameDoc(frame).images[0]?.getAttribute('src')).toBe('https://a/x.png');
  });
});

describe('SealedFrame — quoted content', () => {
  const withQuote = '<p>My reply</p><div class="gmail_quote">Older mail</div>';

  it('marks and hides the quote by default', () => {
    const frame = new SealedFrame(container);
    const result = frame.render({ html: withQuote, attachments: [], options: options() });

    expect(result.hasQuotedContent).toBe(true);
    expect(frameDoc(frame).querySelector(`[${QUOTE_MARKER_ATTR}]`)).not.toBeNull();
    expect(frame.quoteVisible).toBe(false);
  });

  it('unfolds the quote when the reader asks', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: withQuote, attachments: [], options: options() });

    expect(frame.toggleQuote()).toBe(true);
    expect(frameDoc(frame).querySelector(`[${QUOTE_MARKER_ATTR}]`)).toBeNull();
  });

  it('folds it again on a second toggle', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: withQuote, attachments: [], options: options() });

    frame.toggleQuote(true);
    frame.toggleQuote(false);
    expect(frameDoc(frame).querySelector(`[${QUOTE_MARKER_ATTR}]`)).not.toBeNull();
  });

  it('leaves the quote showing when the host disabled collapsing', () => {
    const frame = new SealedFrame(container);
    const result = frame.render({
      html: withQuote,
      attachments: [],
      options: options({ collapseQuotedText: false })
    });

    expect(result.hasQuotedContent).toBe(false);
    expect(frame.quoteVisible).toBe(true);
    expect(frameDoc(frame).querySelector(`[${QUOTE_MARKER_ATTR}]`)).toBeNull();
  });
});

describe('SealedFrame — sizing', () => {
  it('reports its height to the host', () => {
    const heights: number[] = [];
    const frame = new SealedFrame(container, (h) => heights.push(h));
    frame.render({ html: '<p>x</p>', attachments: [], options: options() });

    expect(heights.length).toBeGreaterThan(0);
  });

  it('caps the height and scrolls inside itself when configured', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<p>x</p>', attachments: [], options: options() });

    const doc = frameDoc(frame);
    Object.defineProperty(doc.body, 'scrollHeight', { value: 5000, configurable: true });
    frame.setHeightCap(400);

    expect(frame.element.style.height).toBe('400px');
    expect(frame.element.style.overflowY).toBe('auto');
  });

  it('grows freely when the cap is auto', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<p>x</p>', attachments: [], options: options() });

    const doc = frameDoc(frame);
    Object.defineProperty(doc.body, 'scrollHeight', { value: 5000, configurable: true });
    frame.setHeightCap('auto');

    expect(frame.element.style.height).toBe('5000px');
    expect(frame.element.style.overflowY).toBe('hidden');
  });
});

describe('SealedFrame — lifecycle', () => {
  it('removes itself from the host on destroy', () => {
    const frame = new SealedFrame(container);
    frame.render({ html: '<p>x</p>', attachments: [], options: options() });

    frame.destroy();
    expect(container.querySelector('iframe')).toBeNull();
  });
});
