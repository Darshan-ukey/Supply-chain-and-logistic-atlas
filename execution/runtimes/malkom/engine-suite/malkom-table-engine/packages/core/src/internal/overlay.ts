/** Body-mounted overlays (header filter menu, export menu, saved-preview
 * popover) escape the shell's overflow clip — and with it the `.mte-shell`
 * scope where every `--mte-*` design token lives. Left alone, the tokens
 * resolve to nothing on those elements and the popover renders transparent
 * over whatever the host page shows underneath. Copying the shell's
 * COMPUTED values keeps host-theme overrides (dark mode included) intact. */

import { CSS_VARIABLES } from './styles.js';

const TOKEN_NAME_PATTERN = /--mte-[a-z0-9-]+(?=\s*:)/g;

/** Every token the default block declares — parsed, not hand-listed, so a
 * new token is picked up the moment it is added to CSS_VARIABLES. */
const TOKEN_NAMES: readonly string[] = Array.from(
  new Set(CSS_VARIABLES.match(TOKEN_NAME_PATTERN) ?? [])
);

export function adoptShellTheme(shell: HTMLElement, overlay: HTMLElement): void {
  const view = shell.ownerDocument.defaultView;
  if (view === null) return;
  const computed = view.getComputedStyle(shell);
  for (const name of TOKEN_NAMES) {
    const value = computed.getPropertyValue(name);
    if (value !== '') overlay.style.setProperty(name, value);
  }
}
