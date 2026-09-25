import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  JsonStore,
  LocalStorageStateStorage,
  MemoryStateStorage,
  resolveWebStorage
} from '@malkom/table-core';

/**
 * A minimal in-memory Storage stand-in for the resolver tests.
 * `partial: true` mimics a half-implemented global (Node >= 25 exposes a
 * built-in `localStorage` that lacks working methods unless
 * --localstorage-file points somewhere valid).
 */
function fakeStorage(options: { partial?: boolean; throws?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    }
  };
  if (options.partial) {
    return {
      ...storage,
      getItem: undefined,
      setItem: undefined,
      removeItem: undefined
    } as unknown as Storage;
  }
  if (options.throws) {
    // Storage-shaped but non-functional — Node >= 25 exposes a built-in
    // localStorage global that fails like this without --localstorage-file.
    const fail = (): never => {
      throw new Error('localStorage is not available');
    };
    return {
      ...storage,
      getItem: fail,
      setItem: fail,
      removeItem: fail
    } as unknown as Storage;
  }
  return storage as unknown as Storage;
}

/** Swap a property on globalThis for one test, restoring it afterwards. */
function stubGlobal(name: string, value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
  return () => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete (globalThis as Record<string, unknown>)[name];
  };
}

describe('MemoryStateStorage', () => {
  it('returns null for a key that was never set', () => {
    const storage = new MemoryStateStorage();
    expect(storage.get('missing')).toBeNull();
  });

  it('stores a value and returns it on get', () => {
    const storage = new MemoryStateStorage();
    storage.set('density', 'compact');
    expect(storage.get('density')).toBe('compact');
  });

  it('overwrites an existing value on repeated set', () => {
    const storage = new MemoryStateStorage();
    storage.set('pageSize', '25');
    storage.set('pageSize', '100');
    expect(storage.get('pageSize')).toBe('100');
  });

  it('keeps an empty string distinct from a missing key', () => {
    const storage = new MemoryStateStorage();
    storage.set('empty', '');
    expect(storage.get('empty')).toBe('');
  });

  it('remove deletes the key so get returns null again', () => {
    const storage = new MemoryStateStorage();
    storage.set('grouping', 'city');
    storage.remove('grouping');
    expect(storage.get('grouping')).toBeNull();
  });

  it('removing a key that does not exist does not throw', () => {
    const storage = new MemoryStateStorage();
    expect(() => storage.remove('never-set')).not.toThrow();
  });

  it('two instances do not share state', () => {
    const a = new MemoryStateStorage();
    const b = new MemoryStateStorage();
    a.set('key', 'from-a');
    expect(b.get('key')).toBeNull();
  });
});

describe('resolveWebStorage', () => {
  const restores: (() => void)[] = [];
  afterEach(() => {
    while (restores.length) restores.pop()?.();
  });

  it('prefers the DOM window storage over the bare global', () => {
    const fromWindow = fakeStorage();
    const fromGlobal = fakeStorage();
    restores.push(stubGlobal('window', { localStorage: fromWindow }));
    restores.push(stubGlobal('localStorage', fromGlobal));
    expect(resolveWebStorage()).toBe(fromWindow);
  });

  it('ignores a non-functional shadowing global and uses the window storage', () => {
    // Regression: Node >= 25 ships its own `localStorage` global that shadows
    // the one jsdom installs and has no working methods.
    const jsdomStorage = fakeStorage();
    restores.push(stubGlobal('window', { localStorage: jsdomStorage }));
    restores.push(stubGlobal('localStorage', fakeStorage({ partial: true })));
    expect(resolveWebStorage()).toBe(jsdomStorage);
  });

  it('rejects a storage whose methods exist but throw when used', () => {
    // Shape checks are not enough: the Node >= 25 global looks like a Storage.
    const working = fakeStorage();
    restores.push(stubGlobal('window', { localStorage: fakeStorage({ throws: true }) }));
    restores.push(stubGlobal('localStorage', working));
    expect(resolveWebStorage()).toBe(working);
  });

  it('rejects a storage that accepts writes but never returns them', () => {
    const blackHole = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined
    } as unknown as Storage;
    restores.push(stubGlobal('window', { localStorage: blackHole }));
    restores.push(stubGlobal('localStorage', undefined));
    expect(resolveWebStorage()).toBeNull();
  });

  it('leaves no probe key behind in a storage it accepted', () => {
    const working = fakeStorage();
    restores.push(stubGlobal('window', { localStorage: working }));
    restores.push(stubGlobal('localStorage', undefined));
    expect(resolveWebStorage()).toBe(working);
    expect(working.length).toBe(0);
  });

  it('falls back to the global when there is no window (server / plain Node)', () => {
    const fromGlobal = fakeStorage();
    restores.push(stubGlobal('window', undefined));
    restores.push(stubGlobal('localStorage', fromGlobal));
    expect(resolveWebStorage()).toBe(fromGlobal);
  });

  it('falls back to the global when the window storage getter throws', () => {
    const fromGlobal = fakeStorage();
    const hostileWindow = {
      get localStorage(): unknown {
        throw new Error('SecurityError: access denied');
      }
    };
    restores.push(stubGlobal('window', hostileWindow));
    restores.push(stubGlobal('localStorage', fromGlobal));
    expect(resolveWebStorage()).toBe(fromGlobal);
  });

  it('returns null when no usable storage exists at all', () => {
    restores.push(stubGlobal('window', undefined));
    restores.push(stubGlobal('localStorage', undefined));
    expect(resolveWebStorage()).toBeNull();
  });

  it('returns null when every candidate is only half-implemented', () => {
    restores.push(stubGlobal('window', { localStorage: fakeStorage({ partial: true }) }));
    restores.push(stubGlobal('localStorage', fakeStorage({ partial: true })));
    expect(resolveWebStorage()).toBeNull();
  });

  it('re-resolves per call so a storage appearing later is picked up', () => {
    restores.push(stubGlobal('window', undefined));
    restores.push(stubGlobal('localStorage', undefined));
    expect(resolveWebStorage()).toBeNull();

    const late = fakeStorage();
    restores.push(stubGlobal('localStorage', late));
    expect(resolveWebStorage()).toBe(late);
  });
});

describe('LocalStorageStateStorage', () => {
  // These run identically on Node 24 (real jsdom storage) and Node >= 25
  // (broken global -> memory fallback), so they never depend on the host's
  // Node version. `hasWebStorage` guards only the assertions that are
  // specifically ABOUT real web storage.
  const hasWebStorage = resolveWebStorage() !== null;
  const clearAmbient = (): void => {
    try {
      resolveWebStorage()?.clear();
    } catch {
      /* nothing to clear */
    }
  };

  beforeEach(clearAmbient);
  afterEach(clearAmbient);

  it('round-trips a value', () => {
    const storage = new LocalStorageStateStorage();
    storage.set('mte:test', 'hello');
    expect(storage.get('mte:test')).toBe('hello');
    storage.remove('mte:test');
  });

  it.skipIf(!hasWebStorage)('writes into real web storage when it is available', () => {
    const storage = new LocalStorageStateStorage();
    storage.set('mte:test', 'hello');
    expect(resolveWebStorage()?.getItem('mte:test')).toBe('hello');
  });

  it('returns null for a key that was never set', () => {
    const storage = new LocalStorageStateStorage();
    expect(storage.get('absent')).toBeNull();
  });

  it('remove deletes the key', () => {
    const storage = new LocalStorageStateStorage();
    storage.set('doomed', 'x');
    storage.remove('doomed');
    expect(storage.get('doomed')).toBeNull();
    if (hasWebStorage) {
      expect(resolveWebStorage()?.getItem('doomed')).toBeNull();
    }
  });

  it('still round-trips state when the only global storage is a broken one (Node >= 25)', () => {
    // vitest sets window === globalThis, so a broken global is ALL there is —
    // exactly what a host running our tests on Node >= 25 sees. State must
    // still round-trip (via the in-memory fallback) instead of vanishing.
    const restore = stubGlobal('localStorage', fakeStorage({ throws: true }));
    try {
      const storage = new LocalStorageStateStorage();
      expect(() => storage.set('mte:node25', 'survives')).not.toThrow();
      expect(storage.get('mte:node25')).toBe('survives');
      storage.remove('mte:node25');
      expect(storage.get('mte:node25')).toBeNull();
    } finally {
      restore();
    }
  });

  it('falls back to memory when no storage exists at all (SSR / plain Node)', () => {
    const restoreWindow = stubGlobal('window', undefined);
    const restoreGlobal = stubGlobal('localStorage', undefined);
    try {
      const storage = new LocalStorageStateStorage();
      expect(() => storage.set('mte:ssr', 'v')).not.toThrow();
      expect(storage.get('mte:ssr')).toBe('v');
      expect(() => storage.remove('mte:ssr')).not.toThrow();
      expect(storage.get('mte:ssr')).toBeNull();
    } finally {
      restoreGlobal();
      restoreWindow();
    }
  });

  it('shares the memory fallback across instances so one page agrees on state', () => {
    const restoreWindow = stubGlobal('window', undefined);
    const restoreGlobal = stubGlobal('localStorage', undefined);
    try {
      new LocalStorageStateStorage().set('mte:shared', 'from-a');
      expect(new LocalStorageStateStorage().get('mte:shared')).toBe('from-a');
      new LocalStorageStateStorage().remove('mte:shared');
    } finally {
      restoreGlobal();
      restoreWindow();
    }
  });

  describe('when accessing localStorage throws (private mode / SSR)', () => {
    // Both candidates must be hostile — otherwise the resolver would simply
    // fall through to the working one and the guard would go untested.
    const throwing = {
      get localStorage(): unknown {
        throw new Error('SecurityError: access denied');
      }
    };
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage'
    );

    beforeEach(() => {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: throwing
      });
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError: access denied');
        }
      });
    });

    afterEach(() => {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else delete (globalThis as { window?: unknown }).window;
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
    });

    it('get returns null instead of throwing', () => {
      const storage = new LocalStorageStateStorage();
      expect(storage.get('anything')).toBeNull();
    });

    it('set silently does nothing instead of throwing', () => {
      const storage = new LocalStorageStateStorage();
      expect(() => storage.set('anything', 'value')).not.toThrow();
    });

    it('remove silently does nothing instead of throwing', () => {
      const storage = new LocalStorageStateStorage();
      expect(() => storage.remove('anything')).not.toThrow();
    });
  });
});

describe('JsonStore', () => {
  it('prefixes stored keys with the namespace', () => {
    const backing = new MemoryStateStorage();
    const store = new JsonStore(backing, 'mte-abc');
    store.write('density', 'compact');
    expect(backing.get('mte-abc:density')).toBe('"compact"');
    // The unprefixed key must not exist.
    expect(backing.get('density')).toBeNull();
  });

  it('round-trips an object value through JSON', () => {
    const backing = new MemoryStateStorage();
    const store = new JsonStore(backing, 'ns');
    const value = { pageSize: 50, columns: ['a', 'b'], nested: { on: true } };
    store.write('state', value);
    expect(store.read('state', null)).toEqual(value);
  });

  it('read returns the fallback when the key is missing', () => {
    const store = new JsonStore(new MemoryStateStorage(), 'ns');
    expect(store.read('missing', 'fallback')).toBe('fallback');
    expect(store.read<number[]>('missing', [1, 2])).toEqual([1, 2]);
  });

  it('read returns the fallback when the stored JSON is corrupt', () => {
    const backing = new MemoryStateStorage();
    backing.set('ns:broken', '{not valid json!!');
    const store = new JsonStore(backing, 'ns');
    expect(store.read('broken', 'fallback')).toBe('fallback');
  });

  it('writing a non-serializable value does not throw and stores nothing', () => {
    const backing = new MemoryStateStorage();
    const store = new JsonStore(backing, 'ns');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => store.write('circular', circular)).not.toThrow();
    expect(backing.get('ns:circular')).toBeNull();
    // BigInt is another value JSON.stringify rejects.
    expect(() => store.write('big', BigInt(1))).not.toThrow();
    expect(backing.get('ns:big')).toBeNull();
  });

  it('remove deletes the namespaced key', () => {
    const backing = new MemoryStateStorage();
    const store = new JsonStore(backing, 'ns');
    store.write('gone', 123);
    store.remove('gone');
    expect(backing.get('ns:gone')).toBeNull();
    expect(store.read('gone', 'fallback')).toBe('fallback');
  });

  it('stores with different namespaces do not collide on the same backing storage', () => {
    const backing = new MemoryStateStorage();
    const a = new JsonStore(backing, 'table-a');
    const b = new JsonStore(backing, 'table-b');
    a.write('pageSize', 25);
    b.write('pageSize', 100);
    expect(a.read('pageSize', 0)).toBe(25);
    expect(b.read('pageSize', 0)).toBe(100);
  });
});
