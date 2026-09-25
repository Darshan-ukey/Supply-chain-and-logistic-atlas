/**
 * Pluggable state persistence. The engine persists small JSON blobs
 * (prefilters, density, page size, grouping) through a `StateStorage`.
 */

import type { StateStorage } from './types.js';

/**
 * Web-storage resolution.
 *
 * "Is there a localStorage?" is not a yes/no question across the
 * environments this engine has to work in:
 *
 * - **Browser** — `window.localStorage` and `globalThis.localStorage` are the
 *   same working Storage. Blocked cookies / private mode can make the getter
 *   itself throw, or make writes throw on quota.
 * - **jsdom on Node < 25** — vitest installs jsdom's Storage on the global.
 * - **jsdom on Node >= 25** — Node exposes its OWN built-in `localStorage`
 *   global, which is non-functional unless `--localstorage-file` points
 *   somewhere valid. vitest's `populateGlobal` skips any key that already
 *   exists on the Node global (`getWindowKeys`: `if (k in global) return
 *   keysArray.includes(k)`, and `localStorage` is not in that list), and it
 *   sets `global.window = global` — so jsdom's Storage is never installed and
 *   `window.localStorage` is Node's broken one too. Shape checks alone do not
 *   catch this; only actually using it does.
 * - **SSR / plain Node** — no storage at all.
 *
 * So candidates are probed with a real write/read/remove round-trip (results
 * cached per object), and callers that need persistence get an in-memory
 * fallback rather than a silent no-op.
 */

const PROBE_KEY = '__mte_storage_probe__';
const probedUsable = new WeakSet<object>();
const probedUnusable = new WeakSet<object>();

function hasStorageMethods(value: unknown): value is Storage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['getItem'] === 'function' &&
    typeof candidate['setItem'] === 'function' &&
    typeof candidate['removeItem'] === 'function'
  );
}

/** Does this candidate actually store and return a value? (cached per object) */
function isUsableStorage(value: unknown): value is Storage {
  if (!hasStorageMethods(value)) return false;
  const asObject = value as unknown as object;
  if (probedUsable.has(asObject)) return true;
  if (probedUnusable.has(asObject)) return false;
  try {
    value.setItem(PROBE_KEY, '1');
    const roundTripped = value.getItem(PROBE_KEY) === '1';
    value.removeItem(PROBE_KEY);
    if (roundTripped) {
      probedUsable.add(asObject);
      return true;
    }
  } catch {
    /* throws on access/write — treat as unusable */
  }
  probedUnusable.add(asObject);
  return false;
}

/**
 * The real web storage for this environment, or null when there is none that
 * actually works. Use this when you must target the SAME storage the browser
 * (or a third-party library such as Tabulator) writes to.
 */
export function resolveWebStorage(): Storage | null {
  const candidates: unknown[] = [];
  try {
    const win = (globalThis as { window?: { localStorage?: unknown } }).window;
    if (win && typeof win === 'object') candidates.push(win.localStorage);
  } catch {
    /* the window.localStorage getter itself can throw (blocked storage) */
  }
  try {
    candidates.push((globalThis as { localStorage?: unknown }).localStorage);
  } catch {
    /* the global getter can throw too (SecurityError in private mode) */
  }
  for (const candidate of candidates) {
    if (isUsableStorage(candidate)) return candidate;
  }
  return null;
}

/** Process-wide fallback so all engine instances on a page agree. */
const fallbackMemory = new Map<string, string>();

const memoryBackedStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => fallbackMemory.get(key) ?? null,
  setItem: (key, value) => void fallbackMemory.set(key, value),
  removeItem: (key) => void fallbackMemory.delete(key)
};

/**
 * localStorage-backed storage with an in-memory fallback.
 *
 * Where real web storage works, this IS localStorage. Where it does not
 * (SSR, private mode, jsdom on Node >= 25), state still round-trips for the
 * life of the page/process instead of silently vanishing — so the engine
 * behaves the same everywhere; only durability across reloads differs.
 */
export class LocalStorageStateStorage implements StateStorage {
  private target(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
    return resolveWebStorage() ?? memoryBackedStorage;
  }

  get(key: string): string | null {
    try {
      return this.target().getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    try {
      this.target().setItem(key, value);
    } catch {
      /* quota exceeded mid-session — persistence silently unavailable */
    }
  }
  remove(key: string): void {
    try {
      this.target().removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory storage; useful for tests and persistence-off scenarios. */
export class MemoryStateStorage implements StateStorage {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

/** Namespaced JSON convenience wrapper over a StateStorage. */
export class JsonStore {
  constructor(
    private readonly storage: StateStorage,
    private readonly namespace: string
  ) {}

  private key(name: string): string {
    return `${this.namespace}:${name}`;
  }

  read<T>(name: string, fallback: T): T {
    const raw = this.storage.get(this.key(name));
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write(name: string, value: unknown): void {
    try {
      this.storage.set(this.key(name), JSON.stringify(value));
    } catch {
      /* non-serializable — skip persistence rather than break the UI */
    }
  }

  remove(name: string): void {
    this.storage.remove(this.key(name));
  }
}
