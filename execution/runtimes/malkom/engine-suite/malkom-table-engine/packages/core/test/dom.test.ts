import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampMenuPosition,
  debounce,
  el,
  escapeHtml,
  formatSyncTime,
  getByPath,
  icon,
  onEscape,
  onOutsideClick,
  uid
} from '../src/internal/dom';

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes a realistic markup string', () => {
    expect(escapeHtml('<img src="x" onerror=\'alert(1)\'> & more')).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; more'
    );
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies non-string values and leaves safe text untouched', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});

describe('el', () => {
  it('creates the requested tag with className, text and title', () => {
    const node = el(document, 'div', {
      className: 'a b',
      text: 'hello',
      title: 'tip'
    });
    expect(node.tagName).toBe('DIV');
    expect(node.className).toBe('a b');
    expect(node.textContent).toBe('hello');
    expect(node.title).toBe('tip');
  });

  it('html option sets innerHTML', () => {
    const node = el(document, 'div', { html: '<b>bold</b>' });
    expect(node.innerHTML).toBe('<b>bold</b>');
    expect(node.querySelector('b')?.textContent).toBe('bold');
  });

  it('attrs are applied via setAttribute', () => {
    const node = el(document, 'div', {
      attrs: { 'data-role': 'menu', 'aria-label': 'Menu' }
    });
    expect(node.getAttribute('data-role')).toBe('menu');
    expect(node.getAttribute('aria-label')).toBe('Menu');
  });

  it('sets type, placeholder and value on an input', () => {
    const input = el(document, 'input', {
      type: 'search',
      placeholder: 'Search...',
      value: 'abc'
    });
    expect(input.type).toBe('search');
    expect(input.placeholder).toBe('Search...');
    expect(input.value).toBe('abc');
  });

  it('ignores type/placeholder/value on elements that do not support them', () => {
    const div = el(document, 'div', {
      type: 'search',
      placeholder: 'nope',
      value: 'nope'
    });
    expect(div.getAttribute('type')).toBeNull();
    expect(div.getAttribute('placeholder')).toBeNull();
    expect(div.getAttribute('value')).toBeNull();
  });

  it('with no options returns a bare element', () => {
    const node = el(document, 'span');
    expect(node.tagName).toBe('SPAN');
    expect(node.className).toBe('');
    expect(node.textContent).toBe('');
  });
});

describe('icon', () => {
  it('creates a span with the default Material Symbols class and the icon name as text', () => {
    const node = icon(document, 'search');
    expect(node.tagName).toBe('SPAN');
    expect(node.className).toBe('material-symbols-rounded');
    expect(node.textContent).toBe('search');
  });

  it('accepts a custom class name', () => {
    const node = icon(document, 'close', 'my-icons text-lg');
    expect(node.className).toBe('my-icons text-lg');
    expect(node.textContent).toBe('close');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires exactly once after the wait, with the latest arguments', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);
    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('third');
  });

  it('each call resets the wait window', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);
    debounced('a');
    vi.advanceTimersByTime(60);
    debounced('b');
    vi.advanceTimersByTime(60);
    // 120ms of wall time, but only 60ms since the last call.
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('b');
  });

  it('cancel prevents the pending invocation', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);
    debounced('doomed');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('cancel on an idle debouncer is a no-op and later calls still work', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 50);
    expect(() => debounced.cancel()).not.toThrow();
    debounced('later');
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('uid', () => {
  it('generates unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });

  it('uses the default "mte" prefix', () => {
    expect(uid()).toMatch(/^mte-/);
  });

  it('uses a custom prefix when given', () => {
    expect(uid('prefilter')).toMatch(/^prefilter-/);
  });
});

describe('clampMenuPosition', () => {
  const viewport = { width: 1000, height: 600 };

  it('places the menu below the anchor with the gap when it fits', () => {
    const pos = clampMenuPosition(
      { left: 100, top: 50, bottom: 80 },
      200,
      150,
      viewport
    );
    expect(pos).toEqual({ left: 100, top: 85 });
  });

  it('honours a custom gap', () => {
    const pos = clampMenuPosition(
      { left: 100, top: 50, bottom: 80 },
      200,
      150,
      viewport,
      20
    );
    expect(pos.top).toBe(100);
  });

  it('clamps against the right edge with an 8px margin', () => {
    const pos = clampMenuPosition(
      { left: 950, top: 50, bottom: 80 },
      200,
      150,
      viewport
    );
    expect(pos.left).toBe(1000 - 200 - 8);
  });

  it('never clamps left past the 8px minimum on a narrow viewport', () => {
    const pos = clampMenuPosition(
      { left: 50, top: 50, bottom: 80 },
      300,
      100,
      { width: 200, height: 600 }
    );
    expect(pos.left).toBe(8);
  });

  it('flips above the anchor when there is no room below', () => {
    const pos = clampMenuPosition(
      { left: 100, top: 500, bottom: 530 },
      200,
      200,
      viewport
    );
    // bottom + gap (535) + height (200) > 600, so flip: top - height - gap.
    expect(pos.top).toBe(500 - 200 - 5);
  });

  it('falls back to the 8px top minimum when it fits neither below nor above', () => {
    const pos = clampMenuPosition(
      { left: 100, top: 100, bottom: 130 },
      200,
      550,
      viewport
    );
    expect(pos.top).toBe(8);
  });
});

describe('getByPath', () => {
  it('reads a plain top-level key', () => {
    expect(getByPath({ name: 'Ada' }, 'name')).toBe('Ada');
  });

  it('returns undefined for a missing top-level key', () => {
    expect(getByPath({ name: 'Ada' }, 'age')).toBeUndefined();
  });

  it('reads a dot-nested path', () => {
    const row = { user: { address: { city: 'Sydney' } } };
    expect(getByPath(row, 'user.address.city')).toBe('Sydney');
  });

  it('returns undefined when an intermediate object is missing', () => {
    expect(getByPath({ user: {} }, 'user.address.city')).toBeUndefined();
  });

  it('is null-safe when an intermediate value is null or a primitive', () => {
    expect(getByPath({ user: null } as never, 'user.address.city')).toBeUndefined();
    expect(getByPath({ user: 'flat' }, 'user.address')).toBeUndefined();
  });

  it('a plain key holding null comes back as null, not undefined', () => {
    expect(getByPath({ user: null }, 'user')).toBeNull();
  });
});

describe('formatSyncTime', () => {
  it('returns a non-empty, human-readable string for a timestamp', () => {
    const formatted = formatSyncTime(Date.UTC(2026, 7, 13, 16, 0));
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toMatch(/\d/);
  });
});

describe('onOutsideClick', () => {
  let inside: HTMLDivElement;
  let outside: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    inside = document.createElement('div');
    outside = document.createElement('div');
    document.body.append(inside, outside);
  });

  afterEach(() => {
    vi.useRealTimers();
    inside.remove();
    outside.remove();
  });

  const mousedown = (target: Element): void => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  };

  it('does not react to a click before the deferred attach tick', () => {
    const onOutside = vi.fn();
    const dispose = onOutsideClick(document, (t) => t === inside, onOutside);
    mousedown(outside);
    expect(onOutside).not.toHaveBeenCalled();
    dispose();
  });

  it('after attaching, fires for outside clicks but not inside clicks', () => {
    const onOutside = vi.fn();
    const dispose = onOutsideClick(document, (t) => t === inside, onOutside);
    vi.runAllTimers();

    mousedown(inside);
    expect(onOutside).not.toHaveBeenCalled();

    mousedown(outside);
    expect(onOutside).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('the disposer removes the listener', () => {
    const onOutside = vi.fn();
    const dispose = onOutsideClick(document, (t) => t === inside, onOutside);
    vi.runAllTimers();
    dispose();
    mousedown(outside);
    expect(onOutside).not.toHaveBeenCalled();
  });

  it('disposing before the attach tick cancels the pending attach', () => {
    const onOutside = vi.fn();
    const dispose = onOutsideClick(document, (t) => t === inside, onOutside);
    dispose();
    vi.runAllTimers();
    mousedown(outside);
    expect(onOutside).not.toHaveBeenCalled();
  });
});

describe('onEscape', () => {
  const keydown = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  it('fires on Escape and only on Escape', () => {
    const onEsc = vi.fn();
    const dispose = onEscape(document, onEsc);

    keydown('Enter');
    keydown('a');
    expect(onEsc).not.toHaveBeenCalled();

    keydown('Escape');
    expect(onEsc).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('the disposer removes the listener', () => {
    const onEsc = vi.fn();
    const dispose = onEscape(document, onEsc);
    dispose();
    keydown('Escape');
    expect(onEsc).not.toHaveBeenCalled();
  });
});
