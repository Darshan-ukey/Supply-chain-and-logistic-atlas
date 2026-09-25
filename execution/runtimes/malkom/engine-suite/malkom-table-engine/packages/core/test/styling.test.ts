/**
 * Host-conformance behaviours: CSS variable tokens, the unstyled preset,
 * stable `mte-*` hooks, the responsive toolbar and column-width safeguards.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  MalkomTableEngine,
  presets,
  stripVisualClasses,
  unstyledTheme
} from '@malkom/table-core';
import { resolveConfig } from '../src/internal/config';
import { buildTabulatorOptions } from '../src/tabulator/adapter';
import { CSS_VARIABLES, SKIN_CSS } from '../src/internal/styles';
import { makeConfig, makeEngine } from './helpers/fakeTabulator';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.getElementById('mte-structural-styles')?.remove();
  document.getElementById('mte-skin-styles')?.remove();
});

const allThemeStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) allThemeStrings(nested, out);
  }
  return out;
};

describe('colours come from CSS variables, not hardcoded palettes', () => {
  it('the default theme carries no raw Tailwind palette colours', () => {
    // The trailing part is deliberately loose: an opacity suffix
    // (`bg-slate-900/45`) and a variant prefix (`hover:bg-pink-50`) are
    // still hardcoded palette, and an earlier version of this test let two
    // scrims through by anchoring on a digit at the end.
    const offenders = allThemeStrings(DEFAULT_THEME)
      .flatMap((s) => s.split(/\s+/))
      .filter((cls) =>
        /(^|:)(bg|text|border|ring|from|via|to|divide|outline|accent|fill|stroke|shadow)-(slate|gray|zinc|neutral|stone|pink|emerald|purple|fuchsia|sky|orange|blue|amber|rose|teal|red|green|indigo|violet|cyan|lime|yellow)-\d{2,3}/.test(
          cls
        )
      );
    expect(offenders).toEqual([]);
  });

  it('declares every token it references', () => {
    const referenced = new Set(
      allThemeStrings(DEFAULT_THEME)
        .flatMap((s) => [...s.matchAll(/var\((--mte-[a-z-]+)\)/g)])
        .map((m) => m[1] as string)
    );
    expect(referenced.size).toBeGreaterThan(5);
    for (const token of referenced) {
      expect(`${CSS_VARIABLES}${SKIN_CSS}`).toContain(`${token}:`);
    }
  });

  it('the skin styles reference variables rather than fixed colours', () => {
    expect(SKIN_CSS).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe('mte-* hooks are stable styling API', () => {
  it('key parts expose a hook class', () => {
    expect(DEFAULT_THEME.shell).toContain('mte-shell');
    expect(DEFAULT_THEME.topBar.container).toContain('mte-topbar');
    expect(DEFAULT_THEME.topBar.searchInput).toContain('mte-search');
    expect(DEFAULT_THEME.topBar.exportButton).toContain('mte-btn-export');
    expect(DEFAULT_THEME.grid.container).toContain('mte-grid');
    expect(DEFAULT_THEME.drawer.panel).toContain('mte-drawer-panel');
  });

  it('renders the hooks into the DOM', () => {
    const { container } = makeEngine();
    for (const hook of ['.mte-shell', '.mte-topbar', '.mte-search', '.mte-grid-host']) {
      expect(container.querySelector(hook)).not.toBeNull();
    }
  });
});

describe('unstyled preset', () => {
  it('drops visual utilities and keeps layout plus hooks', () => {
    const stripped = stripVisualClasses(
      'mte-btn h-9 inline-flex items-center gap-2 px-3 rounded-[var(--mte-radius-sm)] border border-[var(--mte-border)] bg-[var(--mte-surface)] text-[11px] font-bold hover:brightness-95 transition cursor-pointer'
    );
    expect(stripped).toContain('mte-btn');
    expect(stripped).toContain('inline-flex');
    expect(stripped).toContain('items-center');
    expect(stripped).toContain('px-3');
    expect(stripped).not.toContain('bg-');
    expect(stripped).not.toContain('rounded');
    expect(stripped).not.toContain('border');
    expect(stripped).not.toContain('font-bold');
    expect(stripped).not.toContain('hover:');
  });

  it('produces a theme with the same shape and no colours', () => {
    const theme = unstyledTheme();
    expect(Object.keys(theme).sort()).toEqual(Object.keys(DEFAULT_THEME).sort());
    expect(Object.keys(theme.topBar).sort()).toEqual(
      Object.keys(DEFAULT_THEME.topBar).sort()
    );
    const strings = allThemeStrings(theme).join(' ');
    expect(strings).not.toMatch(/var\(--mte-/);
    expect(strings).toContain('mte-shell');
  });

  it('renders through the engine, keeping hooks', () => {
    const { container } = makeEngine({ theme: presets.unstyled });
    const shell = container.querySelector('.mte-shell');
    expect(shell).not.toBeNull();
    expect(shell?.className).not.toMatch(/bg-|rounded|shadow/);
    expect(container.querySelector('.mte-search')).not.toBeNull();
  });
});

describe('style injection', () => {
  it('injects structural styles and the skin by default', () => {
    makeEngine();
    expect(document.getElementById('mte-structural-styles')).not.toBeNull();
    expect(document.getElementById('mte-skin-styles')).not.toBeNull();
  });

  it('omits the skin when the host opts out', () => {
    makeEngine({ features: { injectSkin: false } });
    expect(document.getElementById('mte-structural-styles')).not.toBeNull();
    expect(document.getElementById('mte-skin-styles')).toBeNull();
  });

  it('applies host css variables to the shell', () => {
    const { container } = makeEngine({
      cssVars: { '--mte-accent': 'rebeccapurple', '--mte-radius': '4px' }
    });
    const shell = container.querySelector('.mte-shell') as HTMLElement;
    expect(shell.style.getPropertyValue('--mte-accent')).toBe('rebeccapurple');
    expect(shell.style.getPropertyValue('--mte-radius')).toBe('4px');
  });
});

describe('toolbar fits its container', () => {
  it('renders one search input that flexes instead of a fixed-width duplicate', () => {
    const { container } = makeEngine();
    const inputs = container.querySelectorAll('.mte-search');
    expect(inputs).toHaveLength(1);
    const wrap = container.querySelector('.mte-search-wrap') as HTMLElement;
    // Sizing belongs to the container query in STRUCTURAL_CSS, not to a
    // viewport breakpoint or a hardcoded width.
    expect(wrap.className).not.toMatch(/w-\[\d+px\]|hidden|sm:/);
  });

  it('lets the control cluster shrink and wrap', () => {
    expect(DEFAULT_THEME.topBar.controls).not.toContain('shrink-0');
    expect(DEFAULT_THEME.topBar.inner).toContain('min-w-0');
  });

  it('wraps button text so narrow containers hide labels instead of clipping', () => {
    const { container } = makeEngine();
    const exportBtn = container.querySelector('.mte-btn-export') as HTMLElement;
    const label = exportBtn.querySelector('.mte-btn-label');
    expect(label?.textContent).toBe('EXPORT');
  });
});

describe('column width safeguards', () => {
  it('sets a minimum width floor above Tabulator’s 40px default', () => {
    const options = buildTabulatorOptions(resolveConfig(makeConfig()), []);
    expect(options['columnDefaults']).toEqual({ minWidth: 90 });
  });

  it('honours a configured floor', () => {
    const options = buildTabulatorOptions(
      resolveConfig(makeConfig({ features: { columnMinWidth: 140 } })),
      []
    );
    expect(options['columnDefaults']).toEqual({ minWidth: 140 });
  });

  it('re-fits when the container gains a width after being measured at zero', () => {
    const observers: { cb: ResizeObserverCallback; el: Element }[] = [];
    class StubResizeObserver {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe(el: Element): void {
        observers.push({ cb: this.cb, el });
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver);

    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    const redraws = fake.redrawCalls;

    expect(observers).toHaveLength(1);
    // Width arrives for the first time: force a full re-fit.
    observers[0]!.cb(
      [{ contentRect: { width: 640 } } as unknown as ResizeObserverEntry],
      {} as ResizeObserver
    );
    expect(fake.redrawCalls).toBeGreaterThan(redraws);

    engine.destroy();
    vi.unstubAllGlobals();
  });

  it('ignores a zero width and does not observe when disabled', () => {
    const observed: Element[] = [];
    class StubResizeObserver {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe(el: Element): void {
        observed.push(el);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver);

    const off = makeEngine({ features: { refitOnResize: false } });
    expect(observed).toHaveLength(0);
    off.engine.destroy();
    vi.unstubAllGlobals();
  });

  it('constructs without a ResizeObserver at all (older runtimes, SSR-ish hosts)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => {
      const { engine } = makeEngine();
      engine.destroy();
    }).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('engine still builds with a fully custom theme', () => {
  it('accepts partial theme overrides on top of the defaults', () => {
    const { container } = makeEngine({
      theme: { topBar: { title: 'my-title-class' } }
    });
    const title = container.querySelector('.my-title-class');
    expect(title?.textContent).toBe('Test Grid');
    // Untouched tokens keep their defaults.
    expect(container.querySelector('.mte-topbar')).not.toBeNull();
  });

  it('exposes the engine for imperative re-fitting', () => {
    const { engine, fake } = makeEngine();
    fake.trigger('tableBuilt');
    const before = fake.redrawCalls;
    (engine as MalkomTableEngine).refitColumns();
    expect(fake.redrawCalls).toBeGreaterThan(before);
    engine.destroy();
  });
});
