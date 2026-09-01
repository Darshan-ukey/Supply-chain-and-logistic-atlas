/** Internal DOM helpers — small, dependency-free, testable. */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ElOptions {
  className?: string;
  text?: string;
  html?: string;
  title?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  attrs?: Record<string, string>;
}

/** Create an element with common options. `html` must be pre-escaped/trusted. */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  options: ElOptions = {}
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.title !== undefined) node.title = options.title;
  if (options.type !== undefined && 'type' in node) {
    (node as unknown as { type: string }).type = options.type;
  }
  if (options.placeholder !== undefined && 'placeholder' in node) {
    (node as unknown as { placeholder: string }).placeholder = options.placeholder;
  }
  if (options.value !== undefined && 'value' in node) {
    (node as unknown as { value: string }).value = options.value;
  }
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      node.setAttribute(name, value);
    }
  }
  return node;
}

/** Material Symbols icon span. */
export function icon(
  doc: Document,
  name: string,
  className = 'material-symbols-rounded'
): HTMLSpanElement {
  return el(doc, 'span', { className, text: name });
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel: () => void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
  wrapped.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

let uidCounter = 0;

/** Unique-enough id for saved prefilters and instance namespacing. */
export function uid(prefix = 'mte'): string {
  uidCounter += 1;
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}-${uidCounter}`;
}

/**
 * Does `root` contain this event target?
 *
 * Deliberately avoids `target instanceof Node`: `instanceof` is realm-bound,
 * so a node from a second document (iframe/popout via `advanced.documentRef`)
 * fails the check against this realm's `Node`. `contains` is realm-agnostic
 * and returns false for null.
 */
export function containsTarget(root: Node, target: EventTarget | null): boolean {
  if (target === null) return false;
  try {
    return root.contains(target as unknown as Node);
  } catch {
    return false;
  }
}

/**
 * Register an outside-click closer. Returns a disposer.
 * Attaching is deferred a tick so the opening click doesn't immediately close.
 */
export function onOutsideClick(
  doc: Document,
  isInside: (target: EventTarget | null) => boolean,
  onOutside: () => void
): () => void {
  const handler = (event: MouseEvent): void => {
    if (!isInside(event.target)) onOutside();
  };
  const timer = setTimeout(() => doc.addEventListener('mousedown', handler), 0);
  return () => {
    clearTimeout(timer);
    doc.removeEventListener('mousedown', handler);
  };
}

const escapeStacks = new WeakMap<Document, (() => void)[]>();
const escapeListenerAttached = new WeakSet<Document>();

/**
 * Register an Escape-key closer. Returns a disposer.
 *
 * Handlers form a per-document STACK: one Escape keypress fires only the
 * most recently registered live handler, so stacked overlays (drawer →
 * modal → preview popover) close one layer at a time instead of all at once.
 */
export function onEscape(doc: Document, onEsc: () => void): () => void {
  let stack = escapeStacks.get(doc);
  if (!stack) {
    stack = [];
    escapeStacks.set(doc, stack);
  }
  stack.push(onEsc);

  if (!escapeListenerAttached.has(doc)) {
    escapeListenerAttached.add(doc);
    doc.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const current = escapeStacks.get(doc);
      const top = current?.[current.length - 1];
      if (top) top();
    });
  }

  return () => {
    const current = escapeStacks.get(doc);
    if (!current) return;
    const index = current.lastIndexOf(onEsc);
    if (index >= 0) current.splice(index, 1);
  };
}

/** Clamp a dropdown menu position into the viewport. */
export function clampMenuPosition(
  anchorRect: { left: number; bottom: number; top: number },
  menuWidth: number,
  menuHeight: number,
  viewport: { width: number; height: number },
  gap = 5
): { left: number; top: number } {
  let left = anchorRect.left;
  let top = anchorRect.bottom + gap;
  if (left + menuWidth > viewport.width) {
    left = Math.max(8, viewport.width - menuWidth - 8);
  }
  if (top + menuHeight > viewport.height) {
    top = Math.max(8, anchorRect.top - menuHeight - gap);
  }
  return { left, top };
}

/** "13 Aug 2026, 4:00 PM"-style timestamp for the sync meta line. */
export function formatSyncTime(time: number): string {
  try {
    return new Date(time).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return new Date(time).toISOString();
  }
}

export function getByPath(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return row[path];
  let current: unknown = row;
  for (const part of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
