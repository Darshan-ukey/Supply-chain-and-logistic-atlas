/**
 * Theme presets.
 *
 * `unstyled` keeps the engine's layout and its `mte-*` hook classes but
 * drops every visual utility (colour, border, radius, shadow, typography),
 * so a host can style the grid entirely from its own CSS. Pair it with
 * `features.injectSkin: false` to also suppress the default Tabulator skin.
 */

import type { MalkomTableTheme } from '../types.js';
import { DEFAULT_THEME } from './theme.js';

/**
 * Utility classes considered "visual" rather than structural.
 * `mte-*` hooks are always kept — they are the styling API.
 */
const VISUAL_CLASS = new RegExp(
  [
    '^(hover:|focus:|focus-within:|active:|group-hover:|disabled:)',
    '^-?(bg|text|border|ring|outline|divide|from|via|to|fill|stroke|accent|caret|placeholder|decoration|shadow|rounded|font|tracking|leading|opacity|backdrop|blur|brightness|animate|transition|duration|ease|delay)(-|$)',
    '^(uppercase|lowercase|capitalize|italic|underline|truncate|antialiased)$'
  ].join('|')
);

const STRUCTURAL_EXCEPTIONS = new Set([
  // Keeps single-line ellipsis behaviour, which is layout, not decoration.
  'truncate'
]);

/** Drop visual utilities from a space-separated class string. */
export function stripVisualClasses(classNames: string): string {
  return classNames
    .split(/\s+/)
    .filter(Boolean)
    .filter((cls) => {
      if (cls.startsWith('mte-')) return true;
      if (cls.startsWith('material-symbols')) return true;
      if (STRUCTURAL_EXCEPTIONS.has(cls)) return true;
      return !VISUAL_CLASS.test(cls);
    })
    .join(' ');
}

function stripTheme<T>(value: T): T {
  if (typeof value === 'string') return stripVisualClasses(value) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stripTheme(nested);
    }
    return out as unknown as T;
  }
  return value;
}

/** A theme with layout and hooks only — the host supplies the look. */
export function unstyledTheme(base: MalkomTableTheme = DEFAULT_THEME): MalkomTableTheme {
  return stripTheme(base);
}

export const presets = {
  /** The default Malkom look, driven by `--mte-*` custom properties. */
  get malkom(): MalkomTableTheme {
    return DEFAULT_THEME;
  },
  /** Layout and `mte-*` hooks only. */
  get unstyled(): MalkomTableTheme {
    return unstyledTheme();
  }
};
